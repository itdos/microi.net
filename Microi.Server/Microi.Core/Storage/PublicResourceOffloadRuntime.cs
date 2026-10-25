using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// 共享热点分流运行时。目录是管理投影，真正的复制/切流授权保存在当前存储主租户的
    /// 签名共享状态中；源桶始终使用原 Provider，备用桶始终单独使用 SaaS MinIO 配置。
    /// 此处只承担凭据、流式文件、当前公开版本和租约边界，普通目录 CRUD 仍由 Managed V8 负责。
    /// </summary>
    public static partial class PublicResourceOffloadRuntime
    {
        private static readonly HttpClient PublicHttp = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false })
        { Timeout = TimeSpan.FromSeconds(45) };
        private static string RootKey(Binding binding) => "Microi:" + binding.Owner.ToLowerInvariant() + ":PublicResourceOffload:v2:";

        private sealed class Binding
        {
            internal string Owner;
            internal OsClientSecret Client;
            internal JObject Config;
            internal string Origin;
            internal string Bucket;
            internal string SigningSecret;
            internal string ConfigHash;
            internal IDatabase Redis;
        }

        private static async Task<Binding> BindAsync(string owner)
        {
            if (!PublicResourceOffloadProtocol.Identifier(owner, 64)
                || !string.Equals(owner, OsClientDefault.OsClient, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("StorageOwnerRequired");
            var client = OsClientExtend.GetClient(owner);
            var result = await MicroiEngine.FormEngine.GetSysConfig(owner).ConfigureAwait(false);
            if (result.Code != 1 || result.Data == null) throw new InvalidOperationException("SystemSettingsUnavailable");
            var config = JObject.FromObject((object)result.Data);
            var origin = PublicResourceOffloadProtocol.HttpsOrigin(config.Value<string>("FileServerBak"));
            var endpoint = PublicResourceOffloadProtocol.HttpsOrigin(client.OsClientModel.Value<string>("MinIOEndPoint"));
            var publicEndpoint = PublicResourceOffloadProtocol.HttpsOrigin(client.OsClientModel.Value<string>("MinIOEndPointInternet"));
            var bucket = client.OsClientModel.Value<string>("MinIOPublicBucketName");
            if (origin == null || endpoint == null || origin != publicEndpoint || endpoint != origin
                || string.IsNullOrWhiteSpace(bucket) || bucket == client.OsClientModel.Value<string>("MinIOPrivateBucketName")
                || !PublicResourceOffloadProtocol.ReachedThreshold(long.MaxValue, config.Value<decimal?>("FileServerBakThresholdGiB"))
                || config.Value<int?>("FileServerBakWindowHours") != 24)
                throw new InvalidOperationException("BackupBindingNotConfigured");
            var secret = client.OsClientModel.Value<string>("AuthSecret");
            if (string.IsNullOrEmpty(secret) || secret.Length < 16) throw new InvalidOperationException("SigningConfigurationMissing");
            return new Binding
            {
                Owner = owner, Client = client, Config = config, Origin = origin, Bucket = bucket, SigningSecret = secret,
                ConfigHash = PublicResourceOffloadProtocol.Digest(origin + "\n" + bucket + "\n" + endpoint),
                Redis = MicroiEngine.CacheTenant.Cache(owner).GetIDatabase()
            };
        }

        private static string StateKey(Binding binding, string tenant, string appKey) => RootKey(binding)
            + "group:" + tenant.ToLowerInvariant() + ":" + appKey.ToLowerInvariant();
        private static async Task<JObject> ReadAsync(Binding binding, string tenant, string appKey)
        {
            var wire = await binding.Redis.StringGetAsync(StateKey(binding, tenant, appKey)).ConfigureAwait(false);
            return wire.HasValue ? PublicResourceOffloadProtocol.Open(wire.ToString(), binding.Owner, binding.SigningSecret) : null;
        }
        private static async Task WriteAsync(Binding binding, string tenant, string appKey, JObject state,
            IMicroiLockLease lease)
        {
            await lease.EnsureHeldAsync().ConfigureAwait(false);
            state["UpdatedAtUtc"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var wire = PublicResourceOffloadProtocol.Seal(state, binding.Owner, binding.SigningSecret);
            // 验租与状态写入之间仍可能暂停；单调栅栏必须在Redis中原子比较，拒绝旧持有者迟到提交。
            const string fencedWrite = @"
local old = redis.call('GET', KEYS[2])
local incoming = ARGV[1]
if old and (#old > #incoming or (#old == #incoming and old > incoming)) then return 0 end
redis.call('SET', KEYS[2], incoming)
redis.call('SET', KEYS[1], ARGV[2])
return 1";
            var key = StateKey(binding, tenant, appKey);
            var acknowledged = (long)await binding.Redis.ScriptEvaluateAsync(fencedWrite,
                new RedisKey[] { key, key + ":fence" },
                new RedisValue[] { lease.FencingToken.ToString(CultureInfo.InvariantCulture), wire }).ConfigureAwait(false);
            if (acknowledged != 1)
                throw new InvalidOperationException("OffloadStateNotAcknowledged");
        }

        private static JObject SourceSnapshot(Binding binding, string tenant, string appKey)
        {
            if (!PublicResourceOffloadProtocol.Identifier(tenant, 64) || !PublicResourceOffloadProtocol.Identifier(appKey))
                throw new InvalidOperationException("InvalidPublicApplicationIdentity");
            var source = OsClientExtend.GetClient(tenant);
            // 主租户治理只覆盖同一个已配置公有桶，不借公开文件路径跨到另一个租户的私有存储。
            foreach (var field in new[] { "AliOssPublicEndpoint", "AliOssPublicBucketName" })
                if (source.OsClientModel.Value<string>(field) != binding.Client.OsClientModel.Value<string>(field))
                    throw new InvalidOperationException("PublicStorageOwnerMismatch");
            if (source.OsClientModel.Value<string>("HDFS") != "Aliyun")
                throw new InvalidOperationException("PublicSourceProviderUnsupported");
            var applications = JArray.FromObject(source.Db.FromSql("SELECT Id,AppId,AppKey,IsPublic,Status,BuildStatus,CommittedPublishVersionId,CommittedRuntimeManifestHash FROM sys_microistore WHERE (AppKey=@app OR AppId=@app) AND (IsDeleted IS NULL OR IsDeleted=0)")
                .AddInParameter("@app", appKey).ToArray());
            if (applications.Count != 1 || !(applications[0] is JObject application)
                || application["IsPublic"] != null && application["IsPublic"].Type != JTokenType.Null && application.Value<int>("IsPublic") != 1
                || application.Value<string>("Status") != "Published" || application.Value<string>("BuildStatus") != "Success")
                throw new InvalidOperationException("PublishedPublicApplicationRequired");
            var rows = source.Db.FromSql("SELECT BuildVersion,StorageMode,AssetManifestJson,AssetsJson FROM sys_microiservice WHERE MsKey=@app AND IsEnable=1 AND (IsDeleted IS NULL OR IsDeleted=0)")
                .AddInParameter("@app", appKey).ToArray();
            var services = JArray.FromObject(rows);
            if (services.Count != 1) throw new InvalidOperationException("CurrentPublicApplicationNotUnique");
            var service = (JObject)services[0];
            if (!string.Equals(service.Value<string>("StorageMode"), "file", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("FileRuntimeRequired");
            var manifestText = service.Value<string>("AssetManifestJson");
            var assetsText = service.Value<string>("AssetsJson");
            var manifest = string.IsNullOrWhiteSpace(manifestText) ? null : JObject.Parse(manifestText);
            var assets = manifest?["Assets"] as JArray;
            if (assets == null && !string.IsNullOrWhiteSpace(assetsText)) assets = JArray.Parse(assetsText);
            if (assets == null || assets.Count == 0 || assets.Count > 10000)
                throw new InvalidOperationException("CompletePublicManifestRequired");
            var selected = new JArray();
            foreach (var asset in assets.OfType<JObject>())
            {
                var path = Text(asset, "Path", "path");
                var key = Text(asset, "FilePathName", "filePathName", "HdfsPath").TrimStart('/');
                var hash = Text(asset, "Sha256", "sha256", "ContentHash", "contentHash").ToLowerInvariant();
                var size = Number(asset, "Size", "size");
                if (!PublicResourceOffloadProtocol.AssetPath(path) || !PublicResourceOffloadProtocol.PublicObject(tenant, key)
                    || !PublicResourceOffloadProtocol.Hash(hash) || size <= 0)
                    throw new InvalidOperationException("AuthoritativePublicAssetRequired");
                selected.Add(new JObject { ["Path"] = path, ["ObjectKey"] = key, ["Sha256"] = hash, ["Size"] = size });
            }
            if (selected.Count != assets.Count || selected.Select(a => a.Value<string>("Path")).Distinct(StringComparer.Ordinal).Count() != selected.Count)
                throw new InvalidOperationException("CompleteUniquePublicManifestRequired");
            var sorted = new JArray(selected.OrderBy(a => a.Value<string>("Path"), StringComparer.Ordinal));
            var version = service.Value<string>("BuildVersion");
            if (string.IsNullOrWhiteSpace(version)) throw new InvalidOperationException("CurrentPublicVersionRequired");
            var committedId = application.Value<string>("CommittedPublishVersionId");
            if (!string.IsNullOrWhiteSpace(committedId))
            {
                var versions = JArray.FromObject(source.Db.FromSql("SELECT PublishProtocolVersion,PublishState,VersionNo,RuntimeManifestHash FROM mci_ai_app_version WHERE Id=@id AND AppId=@application AND (IsDeleted IS NULL OR IsDeleted=0)")
                    .AddInParameter("@id", committedId).AddInParameter("@application", application.Value<string>("Id")).ToArray());
                if (versions.Count != 1 || !(versions[0] is JObject committed)
                    || committed.Value<int>("PublishProtocolVersion") != 3 || committed.Value<string>("PublishState") != "Completed"
                    || committed.Value<string>("VersionNo") != version)
                    throw new InvalidOperationException("CommittedRuntimeRequired");
                var actual = string.Join("\n", sorted.Select(a => a.Value<string>("Path") + "\t" + a.Value<string>("Sha256") + "\t" + a.Value<long>("Size").ToString(CultureInfo.InvariantCulture)));
                var digest = PublicResourceOffloadProtocol.Digest(actual);
                if (digest != committed.Value<string>("RuntimeManifestHash") || digest != application.Value<string>("CommittedRuntimeManifestHash"))
                    throw new InvalidOperationException("CommittedRuntimeManifestMismatch");
            }
            var identity = tenant.ToLowerInvariant() + "\n" + appKey + "\n" + version + "\n" + committedId + "\n" + sorted.ToString(Formatting.None);
            return new JObject { ["SourceTenant"] = tenant, ["AppKey"] = appKey, ["Version"] = version,
                ["SourceRevision"] = PublicResourceOffloadProtocol.Digest(identity), ["Assets"] = sorted };
        }

        /// <summary>
        /// 管理动作必须由 V8Method 的固定 Key + 当前主租户管理员门进入；后台 Tick 仅恢复
        /// 已签名的晋级记录，不接受任意 URL、存储凭据、SHA、字节数或 Ready 参数。
        /// </summary>
        public static async Task<DosResult> ManageAsync(string owner, JObject request, CancellationToken cancellationToken)
        {
            try
            {
                var binding = await BindAsync(owner).ConfigureAwait(false);
                var action = request.Value<string>("Action");
                if (action == "Capabilities") return new DosResult(1, new JObject
                {
                    ["Protocol"] = PublicResourceOffloadProtocol.Contract, ["ThresholdBytes"] = decimal.Ceiling(binding.Config.Value<decimal>("FileServerBakThresholdGiB") * PublicResourceOffloadProtocol.GiB),
                    ["WindowHours"] = 24, ["TrustedCollectorsEnabled"] = true, ["ReplicaWorkersEnabled"] = true,
                    ["RuntimeRoutingEnabled"] = true, ["PrivateRoutingSupported"] = false,
                    ["Actions"] = new JArray("Capabilities", "ProbeBackup", "Collect", "List", "Status", "Prepare", "PinHistoricalHotspot", "Disable", "Enable"),
                    ["Scope"] = "StorageOwnerPublicRuntimeGroups", ["Retention"] = "KeepVerifiedSourceVersionUntilDisabledOrChanged"
                });
                if (action == "ProbeBackup")
                {
                    var storage = MicroiEngine.HDFSFactory(HDFSType.MinIO) as IPublicResourceReplicaStore;
                    return storage == null ? new DosResult(0, null, "BackupStorageCapabilityMissing")
                        : await storage.ProbePublicReplicaStoreAsync(binding.Client, cancellationToken).ConfigureAwait(false);
                }
                if (action == "Collect") return await CollectAsync(binding, cancellationToken).ConfigureAwait(false);
                if (action == "List") return new DosResult(1, await ListSafeAsync(binding).ConfigureAwait(false));
                if (action == "Status") return new DosResult(1, await RuntimeStatusAsync(binding).ConfigureAwait(false));
                if (action != "Prepare" && action != "PinHistoricalHotspot" && action != "Disable" && action != "Enable") return new DosResult(0, null, "UnknownOffloadAction");
                var tenant = request.Value<string>("SourceTenant");
                var appKey = request.Value<string>("AppKey");
                // 显式的人工热点纳入独立留因，不伪造当前24小时统计或阈值通过。
                return await QueueAsync(binding, tenant, appKey, action, cancellationToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) { throw; }
            catch (Exception error)
            {
                var code = error is InvalidOperationException && SafeCode(error.Message) ? error.Message : "PublicOffloadOperationFailed";
                return new DosResult(0, null, code);
            }
        }

        // HTTP只持久化意图并快速返回；正文复制由可恢复共享工作器领取，避免MCP超时后重复传输。
        private static async Task<DosResult> QueueAsync(Binding binding, string tenant, string appKey, string action, CancellationToken token)
        {
            JObject response = null;
            var locked = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
            {
                OsClient = binding.Owner, Key = "PublicResourceOffload:storage:" + binding.ConfigHash,
                Expiry = TimeSpan.FromSeconds(30), AcquireTimeout = TimeSpan.FromSeconds(2), CancellationToken = token
            }, async lease =>
            {
                if (!PublicResourceOffloadProtocol.Identifier(tenant, 64) || !PublicResourceOffloadProtocol.Identifier(appKey))
                    throw new InvalidOperationException("InvalidPublicApplicationIdentity");
                var state = await ReadAsync(binding, tenant, appKey).ConfigureAwait(false);
                var snapshot = action == "Disable" ? null : SourceSnapshot(binding, tenant, appKey);
                var qualification = await ReadQualificationAsync(binding, tenant, appKey).ConfigureAwait(false);
                if (action == "Prepare" && qualification == null) throw new InvalidOperationException("VerifiedDayThresholdRequired");
                if (state == null) state = new JObject { ["SourceTenant"] = tenant, ["AppKey"] = appKey, ["State"] = "Queued" };
                if (action == "PinHistoricalHotspot") state["Eligibility"] = "ExplicitHistoricalHotspotSelection";
                state["Enabled"] = action != "Disable";
                if (action == "Disable") state["HealthValidUntilUtc"] = 0;
                state["RetryAtUtc"] = 0;
                if (snapshot != null) state["RequestedSourceRevision"] = snapshot["SourceRevision"];
                await WriteAsync(binding, tenant, appKey, state, lease).ConfigureAwait(false);
                await binding.Redis.SetAddAsync(RootKey(binding) + "groups", tenant + "|" + appKey).ConfigureAwait(false);
                response = SafeState(state);
            }).ConfigureAwait(false);
            return locked.Code == 1 && response != null ? new DosResult(1, response) : new DosResult(0, null, "OffloadQueueBusy");
        }

        private static async Task<DosResult> PrepareAsync(Binding binding, string tenant, string appKey, bool pin,
            CancellationToken cancellationToken)
        {
            JObject response = null;
            var result = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
            {
                OsClient = binding.Owner, Key = "PublicResourceOffload:storage:" + binding.ConfigHash,
                Expiry = TimeSpan.FromSeconds(30), AcquireTimeout = TimeSpan.FromSeconds(1), AutoRenew = true,
                MaxLeaseDuration = TimeSpan.FromMinutes(20), CancellationToken = cancellationToken
            }, async lease =>
            {
                var state = await ReadAsync(binding, tenant, appKey).ConfigureAwait(false);
                if (state?.Value<bool?>("Enabled") == false) { response = SafeState(state); return; }
                if (state?.Value<long?>("RetryAtUtc") > DateTimeOffset.UtcNow.ToUnixTimeSeconds()) { response = SafeState(state); return; }
                try
                {
                var snapshot = SourceSnapshot(binding, tenant, appKey);
                var same = state?.Value<string>("SourceRevision") == snapshot.Value<string>("SourceRevision")
                    && state?.Value<string>("TargetConfigHash") == binding.ConfigHash;
                if (same && state.Value<string>("State") == "Ready")
                {
                    await RefreshHealthAsync(binding, state, cancellationToken).ConfigureAwait(false);
                    state["LastErrorCode"] = null; state["RetryAtUtc"] = 0; state["Attempt"] = 0;
                    await WriteAsync(binding, tenant, appKey, state, lease).ConfigureAwait(false);
                    response = SafeState(state); return;
                }
                var qualification = await ReadQualificationAsync(binding, tenant, appKey).ConfigureAwait(false);
                if (!pin && qualification == null) throw new InvalidOperationException("VerifiedDayThresholdRequired");
                // 同一清单恢复已确认的文件检查点；源/配置改变才创建新的不可变组。
                // 没有条件PUT的旧MinIO不声称网络副作用恰好一次：中断中的最后一份文件先回读对账。
                var resume = same && state.Value<string>("State") == "Copying";
                var runId = resume ? state.Value<string>("RunId") : Guid.NewGuid().ToString("N");
                var prefix = resume ? state.Value<string>("TargetPrefix") : PublicResourceOffloadProtocol.Prefix
                    + tenant.ToLowerInvariant() + "/" + appKey.ToLowerInvariant() + "/"
                    + snapshot.Value<string>("SourceRevision") + "/" + runId + "/";
                if (!resume)
                {
                    state = (JObject)snapshot.DeepClone();
                    state["Contract"] = PublicResourceOffloadProtocol.Contract;
                    state["TargetConfigHash"] = binding.ConfigHash; state["TargetPrefix"] = prefix;
                    state["State"] = "Copying"; state["RunId"] = runId;
                    state["Eligibility"] = pin ? "ExplicitHistoricalHotspotSelection" : "VerifiedCloudDayBytesLowerBound";
                    state["Qualification"] = qualification?.DeepClone(); state["CopiedFiles"] = 0; state["CopiedBytes"] = 0;
                    state["Retention"] = "KeepVerifiedSourceVersionUntilDisabledOrChanged";
                    state["Enabled"] = true;
                }
                state["FencingToken"] = lease.FencingToken;
                await WriteAsync(binding, tenant, appKey, state, lease).ConfigureAwait(false);
                var sourceClient = OsClientExtend.GetClient(tenant);
                var sourceStore = MicroiEngine.HDFSFactory(HDFSType.Aliyun);
                var backupStore = MicroiEngine.HDFSFactory(HDFSType.MinIO);
                var processed = 0;
                foreach (var asset in ((JArray)state["Assets"]).OfType<JObject>())
                {
                    if (processed++ < state.Value<int>("CopiedFiles")) continue;
                    cancellationToken.ThrowIfCancellationRequested();
                    await lease.EnsureHeldAsync().ConfigureAwait(false);
                    await CopyVerifiedAssetAsync(sourceStore, sourceClient, backupStore, binding.Client, asset,
                        prefix + asset.Value<string>("Path"), cancellationToken).ConfigureAwait(false);
                    await lease.EnsureHeldAsync().ConfigureAwait(false);
                    state["CopiedFiles"] = state.Value<int>("CopiedFiles") + 1;
                    state["CopiedBytes"] = state.Value<long>("CopiedBytes") + asset.Value<long>("Size");
                    await WriteAsync(binding, tenant, appKey, state, lease).ConfigureAwait(false);
                }
                // 复制期间发布了新版则旧组不能激活；它仍是独立、不覆盖源对象的可审计副本。
                if (SourceSnapshot(binding, tenant, appKey).Value<string>("SourceRevision") != state.Value<string>("SourceRevision"))
                    throw new InvalidOperationException("PublicSourceChangedDuringCopy");
                var replica = backupStore as IPublicResourceReplicaStore ?? throw new InvalidOperationException("BackupStorageCapabilityMissing");
                var permission = await replica.AllowVerifiedPublicReplicaPrefixAsync(binding.Client, prefix, cancellationToken).ConfigureAwait(false);
                if (permission.Code != 1) throw new InvalidOperationException("BackupPublicReadNotConfirmed");
                foreach (var asset in ((JArray)state["Assets"]).OfType<JObject>())
                    await VerifyAnonymousAsync(binding, state, asset, true, cancellationToken).ConfigureAwait(false);
                await lease.EnsureHeldAsync().ConfigureAwait(false);
                state["State"] = "Ready"; state["VerifiedAtUtc"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                state["HealthValidUntilUtc"] = DateTimeOffset.UtcNow.AddMinutes(5).ToUnixTimeSeconds();
                state["LastErrorCode"] = null; state["RetryAtUtc"] = 0; state["Attempt"] = 0;
                await WriteAsync(binding, tenant, appKey, state, lease).ConfigureAwait(false);
                await binding.Redis.SetAddAsync(RootKey(binding) + "groups", tenant + "|" + appKey).ConfigureAwait(false);
                response = SafeState(state);
                }
                catch (Exception error) when (!(error is OperationCanceledException))
                {
                    state ??= new JObject { ["SourceTenant"] = tenant, ["AppKey"] = appKey, ["State"] = "Queued", ["Enabled"] = true };
                    state["HealthValidUntilUtc"] = 0;
                    state["LastErrorCode"] = error is InvalidOperationException && SafeCode(error.Message) ? error.Message : "ReplicaOperationFailed";
                    var attempt = Math.Min(10, state.Value<int>("Attempt") + 1);
                    state["Attempt"] = attempt; state["RetryAtUtc"] = DateTimeOffset.UtcNow.AddMinutes(Math.Min(60, Math.Pow(2, attempt))).ToUnixTimeSeconds();
                    await WriteAsync(binding, tenant, appKey, state, lease).ConfigureAwait(false);
                    response = SafeState(state);
                }
            }).ConfigureAwait(false);
            return result.Code == 1 && response != null ? new DosResult(1, response) : new DosResult(0, null, "ReplicaLeaseOrPreparationFailed");
        }

        internal static async Task CopyVerifiedAssetAsync(IMicroiHDFS source, OsClientSecret sourceClient,
            IMicroiHDFS target, OsClientSecret targetClient, JObject asset, string targetKey, CancellationToken token)
        {
            using var migrationRead = new ReplicaReadScope();
            // 响应未知后不盲重传：完整已有目标只做流式摘要回读，异内容目标绝不覆盖。
            using (var existing = new PublicResourceHashSink())
            {
                var existingRead = await target.CopyObjectToStream(new HDFSParam { ClientModel = targetClient, Limit = false,
                    FileFullPath = targetKey, FileStream = existing, CancellationToken = token, TimeoutSeconds = 300 }).ConfigureAwait(false);
                if (existingRead.Code == 1)
                {
                    if (existing.Bytes != asset.Value<long>("Size") || existing.Finish() != asset.Value<string>("Sha256"))
                        throw new InvalidOperationException("ExistingReplicaMismatch");
                    return;
                }
                var append = existingRead.DataAppend as JObject ?? (existingRead.DataAppend == null ? null : JObject.FromObject(existingRead.DataAppend));
                if (append?.Value<string>("StorageReadErrorCode") != "NoSuchKey")
                    throw new InvalidOperationException("ReplicaExistenceUnknown");
            }
            // 大文件不进入 V8/JSON/byte[]；独占临时文件在成功、失败和取消路径均关闭并回收。
            var temporary = Path.Combine(Path.GetTempPath(), "microi-public-replica-" + Guid.NewGuid().ToString("N"));
            try
            {
                using var file = new FileStream(temporary, FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None,
                    65536, FileOptions.Asynchronous | FileOptions.SequentialScan | FileOptions.DeleteOnClose);
                using var bounded = new PublicResourceBoundedWriteStream(file, asset.Value<long>("Size"));
                var read = await source.CopyObjectToStream(new HDFSParam { ClientModel = sourceClient, Limit = false,
                    FileFullPath = asset.Value<string>("ObjectKey"), FileStream = bounded, CancellationToken = token, TimeoutSeconds = 300 }).ConfigureAwait(false);
                if (read.Code != 1 || file.Length != asset.Value<long>("Size")) throw new InvalidOperationException("SourceReadOrSizeMismatch");
                file.Position = 0;
                using (var sha = SHA256.Create())
                    if (PublicResourceOffloadProtocol.Hex(sha.ComputeHash(file)) != asset.Value<string>("Sha256"))
                        throw new InvalidOperationException("SourceHashMismatch");
                file.Position = 0;
                var write = await target.PutObject(new HDFSParam { ClientModel = targetClient, Limit = false,
                    FileFullPath = targetKey, FileStream = file, ContentLength = file.Length, CancellationToken = token,
                    TimeoutSeconds = 300 }).ConfigureAwait(false);
                if (write.Code != 1) throw new InvalidOperationException("BackupWriteNotConfirmed");
                using var sink = new PublicResourceHashSink();
                var verify = await target.CopyObjectToStream(new HDFSParam { ClientModel = targetClient, Limit = false,
                    FileFullPath = targetKey, FileStream = sink, CancellationToken = token, TimeoutSeconds = 300 }).ConfigureAwait(false);
                if (verify.Code != 1 || sink.Bytes != asset.Value<long>("Size") || sink.Finish() != asset.Value<string>("Sha256"))
                    throw new InvalidOperationException("BackupReadbackMismatch");
            }
            finally { if (File.Exists(temporary)) File.Delete(temporary); }
        }

        private static async Task VerifyAnonymousAsync(Binding binding, JObject state, JObject asset, bool full, CancellationToken token)
        {
            var url = PublicResourceOffloadProtocol.BackupUrl(binding.Origin, binding.Bucket,
                state.Value<string>("TargetPrefix"), asset.Value<string>("Path"));
            if (url == null) throw new InvalidOperationException("InvalidBackupPublicUrl");
            using var request = new HttpRequestMessage(full ? HttpMethod.Get : HttpMethod.Head, url);
            request.Headers.TryAddWithoutValidation("Origin", PublicResourceOffloadProtocol.HttpsOrigin(binding.Config.Value<string>("ApiBase")));
            using var response = await PublicHttp.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, token).ConfigureAwait(false);
            if ((int)response.StatusCode != 200 || response.Content.Headers.ContentLength != asset.Value<long>("Size"))
                throw new InvalidOperationException("BackupAnonymousReadFailed");
            if (!PublicResourceOffloadProtocol.MimeMatches(asset.Value<string>("Path"), response.Content.Headers.ContentType?.MediaType))
                throw new InvalidOperationException("BackupContentTypeMismatch");
            if (!full) return;
            var cors = response.Headers.TryGetValues("Access-Control-Allow-Origin", out var origins) ? origins.SingleOrDefault() : null;
            if (cors != "*" && cors != request.Headers.GetValues("Origin").Single()) throw new InvalidOperationException("BackupCorsNotConfirmed");
            using var sink = new PublicResourceHashSink();
            using var body = await response.Content.ReadAsStreamAsync().ConfigureAwait(false);
            await body.CopyToAsync(sink, 65536, token).ConfigureAwait(false);
            if (sink.Bytes != asset.Value<long>("Size") || sink.Finish() != asset.Value<string>("Sha256"))
                throw new InvalidOperationException("BackupAnonymousHashMismatch");
            using var rangeRequest = new HttpRequestMessage(HttpMethod.Get, url);
            rangeRequest.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(0, 0);
            using var rangeResponse = await PublicHttp.SendAsync(rangeRequest, HttpCompletionOption.ResponseHeadersRead, token).ConfigureAwait(false);
            var contentRange = rangeResponse.Content.Headers.ContentRange;
            if ((int)rangeResponse.StatusCode != 206 || contentRange?.From != 0 || contentRange.To != 0
                || contentRange.Length != asset.Value<long>("Size") || rangeResponse.Content.Headers.ContentLength != 1)
                throw new InvalidOperationException("BackupRangeNotConfirmed");
        }

        private static async Task RefreshHealthAsync(Binding binding, JObject state, CancellationToken token)
        {
            state["HealthValidUntilUtc"] = 0;
            foreach (var asset in ((JArray)state["Assets"]).OfType<JObject>())
                await VerifyAnonymousAsync(binding, state, asset, false, token).ConfigureAwait(false);
            state["HealthValidUntilUtc"] = DateTimeOffset.UtcNow.AddMinutes(5).ToUnixTimeSeconds();
        }

        /// <summary>
        /// 由已经完成公开版本权威解析的运行入口调用，必须在读取 OSS 正文之前执行。
        /// 任一配置/共享状态/版本/摘要/健康不匹配均返回 null，沿原路径有限回退。
        /// </summary>
        public static async Task<string> ResolveRuntimeAsync(string sourceTenant, string appKey, string currentVersion,
            string path, JObject currentAsset)
        {
            try
            {
                if (!PublicResourceOffloadProtocol.Identifier(sourceTenant, 64) || !PublicResourceOffloadProtocol.Identifier(appKey)
                    || !PublicResourceOffloadProtocol.AssetPath(path)) return null;
                var binding = await BindAsync(OsClientDefault.OsClient).ConfigureAwait(false);
                var state = await ReadAsync(binding, sourceTenant, appKey).ConfigureAwait(false);
                if (!ReadyAssetMatches(state, binding.ConfigHash, currentVersion, path, currentAsset, DateTimeOffset.UtcNow.ToUnixTimeSeconds())) return null;
                if (SourceSnapshot(binding, sourceTenant, appKey).Value<string>("SourceRevision") != state.Value<string>("SourceRevision")) return null;
                if (path.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
                {
                    // 新页面在跳转前做有界NAS入口探测；断网时不让浏览器先跳到失效地址。
                    using var probeTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
                    try
                    {
                        var entry = ((JArray)state["Assets"]).OfType<JObject>().Single(a => a.Value<string>("Path") == path);
                        await VerifyAnonymousAsync(binding, state, entry, false, probeTimeout.Token).ConfigureAwait(false);
                    }
                    catch
                    {
                        await InvalidateHealthAsync(binding, sourceTenant, appKey).ConfigureAwait(false);
                        return null;
                    }
                }
                var selected = PublicResourceOffloadProtocol.BackupUrl(binding.Origin, binding.Bucket, state.Value<string>("TargetPrefix"), path);
                if (selected != null && path.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
                {
                    // 整组副本保留相对依赖，HTML启动只附加公开连接坐标，不转发Token/Cookie或任意查询串。
                    var apiBase = PublicResourceOffloadProtocol.HttpsOrigin(binding.Config.Value<string>("ApiBase"));
                    if (apiBase == null) return null;
                    selected += "?ApiBase=" + Uri.EscapeDataString(apiBase) + "&OsClient=" + Uri.EscapeDataString(sourceTenant);
                }
                return selected;
            }
            catch { return null; }
        }

        private static async Task InvalidateHealthAsync(Binding binding, string tenant, string app)
        {
            using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
            {
                OsClient = binding.Owner, Key = "PublicResourceOffload:storage:" + binding.ConfigHash,
                Expiry = TimeSpan.FromSeconds(10), AcquireTimeout = TimeSpan.FromSeconds(1), CancellationToken = deadline.Token
            }, async lease =>
            {
                var latest = await ReadAsync(binding, tenant, app).ConfigureAwait(false);
                if (latest == null || latest.Value<string>("TargetConfigHash") != binding.ConfigHash) return;
                latest["HealthValidUntilUtc"] = 0; latest["LastErrorCode"] = "BackupEntryUnavailable";
                await WriteAsync(binding, tenant, app, latest, lease).ConfigureAwait(false);
            }).ConfigureAwait(false);
        }

        /// <summary>商城公开链接的只读选择原子。调用者只能指定公有对象键，仍以当前完整清单和签名健康状态决定。</summary>
        public static async Task<string> ResolvePublicObjectAsync(string objectKey)
        {
            try
            {
                if (!PublicResourceOffloadProtocol.AssetPath(objectKey)) return null;
                var parts = objectKey.Split('/'); string tenant, app;
                if (parts.Length >= 4 && parts[1] == "micro-app") { tenant = parts[0]; app = parts[2]; }
                else if (parts.Length >= 10 && parts[0] == "microi" && parts[1] == "application-assets" && parts[2] == "v3"
                    && parts[3] == "tenants" && parts[5] == "kinds" && parts[6] == "runtime" && parts[7] == "apps")
                { tenant = parts[4]; app = parts[8]; }
                else return null;
                var binding = await BindAsync(OsClientDefault.OsClient).ConfigureAwait(false);
                var snapshot = SourceSnapshot(binding, tenant, app);
                var version = snapshot.Value<string>("Version");
                var currentPrefix = tenant.ToLowerInvariant() + "/micro-app/" + app + "/";
                var asset = ((JArray)snapshot["Assets"]).OfType<JObject>().SingleOrDefault(item =>
                    item.Value<string>("ObjectKey") == objectKey || currentPrefix + item.Value<string>("Path") == objectKey
                    || currentPrefix + version + "/" + item.Value<string>("Path") == objectKey);
                return asset == null ? null : await ResolveRuntimeAsync(tenant, app, version, asset.Value<string>("Path"), asset).ConfigureAwait(false);
            }
            catch { return null; }
        }

        internal static bool ReadyAssetMatches(JObject state, string configHash, string currentVersion,
            string path, JObject currentAsset, long now)
        {
            if (state == null || currentAsset == null || !PublicResourceOffloadProtocol.AssetPath(path)
                || state.Value<bool?>("Enabled") != true || state.Value<string>("State") != "Ready"
                || state.Value<string>("TargetConfigHash") != configHash || state.Value<string>("Version") != currentVersion
                || state.Value<long>("HealthValidUntilUtc") <= now) return false;
            var matches = (state["Assets"] as JArray)?.OfType<JObject>().Where(a => a.Value<string>("Path") == path).ToArray();
            return matches?.Length == 1 && matches[0].Value<string>("Sha256") == Text(currentAsset, "Sha256", "sha256", "ContentHash", "contentHash").ToLowerInvariant()
                && matches[0].Value<long>("Size") == Number(currentAsset, "Size", "size");
        }

        private static JObject SafeState(JObject state) => new JObject
        {
            ["SourceTenant"] = state["SourceTenant"], ["AppKey"] = state["AppKey"], ["Version"] = state["Version"],
            ["SourceRevision"] = state["SourceRevision"], ["State"] = state["State"], ["Eligibility"] = state["Eligibility"],
            ["CopiedFiles"] = state["CopiedFiles"], ["CopiedBytes"] = state["CopiedBytes"], ["Qualification"] = state["Qualification"],
            ["HealthValidUntilUtc"] = state["HealthValidUntilUtc"], ["Retention"] = state["Retention"]
            , ["Enabled"] = state["Enabled"], ["LastErrorCode"] = state["LastErrorCode"], ["RetryAtUtc"] = state["RetryAtUtc"], ["Attempt"] = state["Attempt"]
        };
        private static string Text(JObject item, params string[] names) => names.Select(name => item.Value<string>(name)).FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? "";
        private static long Number(JObject item, params string[] names)
        {
            foreach (var name in names) if (long.TryParse(item[name]?.ToString(), NumberStyles.None, CultureInfo.InvariantCulture, out var value)) return value;
            return -1;
        }
        private static bool SafeCode(string code) => SafeErrorCodes.Contains(code);
        private static readonly HashSet<string> SafeErrorCodes = new HashSet<string>(StringComparer.Ordinal)
        {
            "StorageOwnerRequired", "SystemSettingsUnavailable", "BackupBindingNotConfigured", "SigningConfigurationMissing",
            "InvalidPublicApplicationIdentity", "PublicStorageOwnerMismatch", "PublicSourceProviderUnsupported",
            "PublishedPublicApplicationRequired", "CurrentPublicApplicationNotUnique", "FileRuntimeRequired",
            "CompletePublicManifestRequired", "AuthoritativePublicAssetRequired", "CompleteUniquePublicManifestRequired",
            "CurrentPublicVersionRequired", "CommittedRuntimeRequired", "CommittedRuntimeManifestMismatch",
            "VerifiedDayThresholdRequired", "PublicSourceChangedDuringCopy", "BackupStorageCapabilityMissing",
            "BackupPublicReadNotConfirmed", "ExistingReplicaMismatch", "ReplicaExistenceUnknown", "SourceReadOrSizeMismatch",
            "SourceHashMismatch", "SourceSizeLimitExceeded", "BackupWriteNotConfirmed", "BackupReadbackMismatch",
            "InvalidBackupPublicUrl", "BackupAnonymousReadFailed", "BackupContentTypeMismatch", "BackupCorsNotConfirmed",
            "BackupAnonymousHashMismatch", "BackupRangeNotConfirmed", "CompleteDayRequired", "CloudReadActionDenied",
            "CloudReadCredentialsIncomplete", "CloudReadCredentialsMissing", "CloudReportReadFailed", "CloudReportTooLarge", "CloudReportRejected"
        };
    }

    /// <summary>流式计数与 SHA，不缓存完整文件；中途失败不会产生已验证结果。</summary>
    internal sealed class PublicResourceHashSink : Stream
    {
        private readonly IncrementalHash hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        internal long Bytes { get; private set; }
        internal string Finish() => PublicResourceOffloadProtocol.Hex(hash.GetHashAndReset());
        public override void Write(byte[] buffer, int offset, int count) { hash.AppendData(buffer, offset, count); Bytes = checked(Bytes + count); }
        public override Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
        { cancellationToken.ThrowIfCancellationRequested(); Write(buffer, offset, count); return Task.CompletedTask; }
        public override bool CanRead => false; public override bool CanSeek => false; public override bool CanWrite => true;
        public override long Length => Bytes; public override long Position { get => Bytes; set => throw new NotSupportedException(); }
        public override void Flush() { }
        public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
        public override void SetLength(long value) => throw new NotSupportedException();
        protected override void Dispose(bool disposing) { if (disposing) hash.Dispose(); base.Dispose(disposing); }
    }
}

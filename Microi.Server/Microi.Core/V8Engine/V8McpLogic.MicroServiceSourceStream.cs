using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Private-source streaming protocol for Web/UniApp/MicroService projects.
    ///
    /// Files are first written to a tenant-private, delivery-scoped immutable
    /// prefix and represented by hidden PrivateSourceStaged metadata rows.  A
    /// manifest finalize validates every staged object and atomically switches
    /// the active source rows in one primary-database transaction.  The legacy
    /// JSON SyncMicroServiceSource endpoint remains available; callers that send
    /// the three Expected* preconditions are transparently routed through this
    /// protocol instead of mutating the active source one file at a time.
    /// </summary>
    public static partial class V8McpLogic
    {
        public const int MicroServiceSourceStreamProtocolVersion = 1;
        public const string StagedPrivateSourceStorageScope = "PrivateSourceStaged";
        public const string ArchivedPrivateSourceStorageScope = "PrivateSourceArchived";
        private const int MaxMicroServiceSourceStreamFiles = 5000;

        public static object GetMicroServiceSourceStreamCapabilities()
        {
            return new
            {
                SourceStreamPublish = true,
                SourceStreamProtocolVersion = MicroServiceSourceStreamProtocolVersion,
                StageRoute = "/api/V8Debug/StageMicroServiceSourceFile",
                FinalizeRoute = "/api/V8Debug/FinalizeMicroServiceSourceManifest",
                MaxFileBytes = ApplicationAssetStreamMaxFileBytes,
                MaxFileCount = MaxMicroServiceSourceStreamFiles,
                SupportsGzip = false,
                RequiresReplacePrivateSourceOnly = true,
                CasFields = new[]
                {
                    "ExpectedCurrentVersion",
                    "ExpectedAppVersion",
                    "ExpectedSourceManifestHash"
                }
            };
        }

        internal static bool HasMicroServiceSourceCasPreconditions(JObject param)
        {
            if (param == null) return false;
            return GetSourceToken(param, "ExpectedCurrentVersion") != null
                   || HasSourceProperty(param, "ExpectedAppVersion")
                   || HasSourceProperty(param, "ExpectedSourceManifestHash");
        }

        private static bool HasSourceProperty(JObject source, string name)
        {
            return source?.Properties().Any(property =>
                string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase)) == true;
        }

        private static JToken GetSourceToken(JObject source, string name)
        {
            return source?.GetValue(name, StringComparison.OrdinalIgnoreCase);
        }

        private static string ReadNullableSourceString(JObject source, string name)
        {
            var token = GetSourceToken(source, name);
            if (token == null || token.Type == JTokenType.Null || token.Type == JTokenType.Undefined)
                return null;
            return token.Type == JTokenType.String ? token.Value<string>() : token.ToString();
        }

        public static string NormalizeMicroServiceSourceDeliveryBatchId(string value)
        {
            var normalized = SafeString(value).Trim();
            if (!Regex.IsMatch(
                    normalized,
                    "^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$",
                    RegexOptions.CultureInvariant))
            {
                throw new ArgumentException(
                    "DeliveryBatchId 只能包含英文、数字、点、中划线、下划线，长度1-50",
                    nameof(value));
            }
            return normalized;
        }

        public static string BuildMicroServiceSourceStagingRoot(
            string osClient,
            string appId,
            string deliveryBatchId)
        {
            if (IsBlank(appId)) throw new ArgumentException("AppId 不能为空", nameof(appId));
            deliveryBatchId = NormalizeMicroServiceSourceDeliveryBatchId(deliveryBatchId);
            return TenantConfigurationSecurity.NormalizeStoragePath(
                    osClient,
                    $"ai-app-source-staged/{appId}/{deliveryBatchId}")
                .TrimEnd('/');
        }

        public static string BuildMicroServiceSourceStagingPath(
            string osClient,
            string appId,
            string deliveryBatchId,
            string relativePath)
        {
            relativePath = NormalizeMicroServiceSourcePath(relativePath);
            if (IsBlank(relativePath)) throw new ArgumentException("RelativePath 不合法", nameof(relativePath));
            var result = BuildMicroServiceSourceStagingRoot(osClient, appId, deliveryBatchId)
                         + "/" + relativePath;
            if (result.Length > 1000)
                throw new ArgumentException("私有源码暂存路径超过数据库 varchar(1000) 上限", nameof(relativePath));
            return result;
        }

        private static string BuildMicroServiceSourceApplicationId(string osClient, string appKey)
        {
            return BuildApplicationStreamRecordId(
                "microservice",
                osClient,
                appKey,
                "private-source-application");
        }

        private static string BuildMicroServiceSourceFileId(
            string osClient,
            string appId,
            string deliveryBatchId,
            string relativePath)
        {
            return BuildApplicationStreamRecordId(
                "file",
                osClient,
                appId,
                "private-source\n" + deliveryBatchId + "\n" + relativePath);
        }

        /// <summary>
        /// mci_ai_app_file historically has a global VersionId+FilePathHash
        /// unique index. DeliveryBatchId is caller-scoped, so derive a compact
        /// application-qualified VersionId instead of assuming that two clients
        /// will never reuse a human-readable batch name for different apps.
        /// </summary>
        public static string BuildMicroServiceSourceStageVersionId(
            string appId,
            string deliveryBatchId)
        {
            if (IsBlank(appId)) throw new ArgumentException("AppId 不能为空", nameof(appId));
            deliveryBatchId = NormalizeMicroServiceSourceDeliveryBatchId(deliveryBatchId);
            return "src-" + Sha256Hex(appId + "\n" + deliveryBatchId).Substring(0, 46);
        }

        private static JArray NormalizeMicroServiceSourceManifest(JArray sourceManifest)
        {
            if (sourceManifest == null || sourceManifest.Count == 0)
                throw new ArgumentException("Manifest 不能为空", nameof(sourceManifest));
            if (sourceManifest.Count > MaxMicroServiceSourceStreamFiles)
                throw new ArgumentException(
                    $"Manifest 最多包含 {MaxMicroServiceSourceStreamFiles} 个源码文件",
                    nameof(sourceManifest));

            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var normalized = new JArray();
            foreach (var token in sourceManifest)
            {
                if (!(token is JObject file))
                    throw new ArgumentException("Manifest 每一项必须是对象", nameof(sourceManifest));
                var path = NormalizeMicroServiceSourcePath(
                    SafeJString(file, "Path", SafeJString(file, "RelativePath", SafeJString(file, "FilePath"))));
                if (IsBlank(path)) throw new ArgumentException("Manifest.Path 不合法", nameof(sourceManifest));
                if (!seen.Add(path)) throw new ArgumentException("Manifest 源码路径重复：" + path, nameof(sourceManifest));

                var sha256 = SafeJString(file, "Sha256", SafeJString(file, "Hash")).Trim();
                if (!Regex.IsMatch(sha256, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
                    throw new ArgumentException("Manifest.Sha256 必须是64位小写十六进制：" + path, nameof(sourceManifest));
                var size = file["Size"]?.Val<long?>() ?? -1L;
                if (size < 0 || size > ApplicationAssetStreamMaxFileBytes)
                    throw new ArgumentException("Manifest.Size 超出允许范围：" + path, nameof(sourceManifest));
                normalized.Add(new JObject
                {
                    ["Path"] = path,
                    ["Sha256"] = sha256,
                    ["Size"] = size
                });
            }
            return new JArray(normalized
                .OfType<JObject>()
                .OrderBy(file => SafeJString(file, "Path"), StringComparer.Ordinal));
        }

        internal static JArray BuildMicroServiceSourceManifestFromRows(IEnumerable<JObject> rows)
        {
            return new JArray((rows ?? Enumerable.Empty<JObject>())
                .Where(IsPrivateAiApplicationSourceFile)
                .Where(row => SafeJInt(row, "IsDeleted", 0) != 1)
                .Select(row => new JObject
                {
                    ["Path"] = NormalizeMicroServiceSourcePath(SafeJString(row, "FilePath")),
                    ["Sha256"] = SafeJString(row, "ContentHash").Trim().ToLowerInvariant(),
                    ["Size"] = row["Size"]?.Val<long?>() ?? 0L
                })
                .Where(row => !IsBlank(SafeJString(row, "Path")))
                .OrderBy(row => SafeJString(row, "Path"), StringComparer.Ordinal));
        }

        public static string ComputeMicroServiceSourceRowsManifestHash(IEnumerable<JObject> rows)
        {
            var manifest = BuildMicroServiceSourceManifestFromRows(rows);
            return manifest.Count == 0 ? null : ComputeMicroServiceManifestHash(manifest);
        }

        internal static string ValidateMicroServiceSourceFinalizeCas(
            JObject app,
            string activeSourceManifestHash,
            JObject param)
        {
            if (!HasSourceProperty(param, "ExpectedCurrentVersion"))
                return "ExpectedCurrentVersion 是必填的 CAS 前置条件";
            var currentVersionToken = GetSourceToken(param, "ExpectedCurrentVersion");
            if (currentVersionToken == null
                || currentVersionToken.Type == JTokenType.Null
                || !int.TryParse(currentVersionToken.ToString(), out var expectedCurrentVersion)
                || expectedCurrentVersion < 0)
            {
                return "ExpectedCurrentVersion 必须是非负 int 整数";
            }
            if (!HasSourceProperty(param, "ExpectedAppVersion"))
                return "ExpectedAppVersion 是必填的 CAS 前置条件（无版本时显式传 null）";
            if (!HasSourceProperty(param, "ExpectedSourceManifestHash"))
                return "ExpectedSourceManifestHash 是必填的 CAS 前置条件（无源码时显式传 null）";

            var actualCurrentVersion = SafeJInt(app, "CurrentVersion", 0);
            if (expectedCurrentVersion != actualCurrentVersion)
                return $"源码 CAS 冲突：ExpectedCurrentVersion={expectedCurrentVersion}，Actual={actualCurrentVersion}";

            var expectedAppVersion = ReadNullableSourceString(param, "ExpectedAppVersion");
            var actualAppVersion = ReadNullableSourceString(app, "AppVersion");
            if (!string.Equals(expectedAppVersion, actualAppVersion, StringComparison.Ordinal))
                return "源码 CAS 冲突：ExpectedAppVersion 与当前 AppVersion 不一致";

            var expectedSourceHash = ReadNullableSourceString(param, "ExpectedSourceManifestHash");
            if (!IsBlank(expectedSourceHash)
                && !Regex.IsMatch(expectedSourceHash, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
            {
                return "ExpectedSourceManifestHash 必须是 null 或64位小写十六进制 SHA-256";
            }
            if (!string.Equals(
                    IsBlank(expectedSourceHash) ? null : expectedSourceHash,
                    IsBlank(activeSourceManifestHash) ? null : activeSourceManifestHash,
                    StringComparison.Ordinal))
            {
                return "源码 CAS 冲突：ExpectedSourceManifestHash 与当前私有源码清单不一致";
            }
            return null;
        }

        internal static IReadOnlyList<string> ResolveMicroServiceSourceManifestDeletions(
            IEnumerable<JObject> activeRows,
            JArray incomingManifest)
        {
            var incoming = new HashSet<string>(
                (incomingManifest ?? new JArray())
                .OfType<JObject>()
                .Select(file => SafeJString(file, "Path")),
                StringComparer.OrdinalIgnoreCase);
            return (activeRows ?? Enumerable.Empty<JObject>())
                .Where(IsPrivateAiApplicationSourceFile)
                .Select(row => NormalizeMicroServiceSourcePath(SafeJString(row, "FilePath")))
                .Where(path => !IsBlank(path) && !incoming.Contains(path))
                .OrderBy(path => path, StringComparer.Ordinal)
                .ToArray();
        }

        private static async Task<JObject> EnsureMicroServiceSourceApplication(
            string osClient,
            string appIdOrKey,
            JObject source,
            object currentToken)
        {
            var existing = await FindAiApplication(osClient, appIdOrKey).ConfigureAwait(false);
            if (existing != null) return existing;

            var appKey = NormalizeMicroServiceKey(
                source?["MsKey"]?.Val<string>()
                ?? source?["MicroServiceKey"]?.Val<string>()
                ?? source?["AppKey"]?.Val<string>()
                ?? appIdOrKey);
            if (IsBlank(appKey)) return null;
            existing = await FindAiApplication(osClient, appKey).ConfigureAwait(false);
            if (existing != null) return existing;

            var appId = BuildMicroServiceSourceApplicationId(osClient, appKey);
            var appName = source?["MsName"]?.Val<string>()
                          ?? source?["Name"]?.Val<string>()
                          ?? source?["AppName"]?.Val<string>()
                          ?? appKey;
            var applicationType = ResolveMicroServiceSourceApplicationType(source, null);
            if (!new[] { "Web", "UniApp", "MicroService" }
                    .Contains(applicationType, StringComparer.OrdinalIgnoreCase))
            {
                return null;
            }
            var description = source?["Description"]?.Val<string>()
                              ?? source?["Remark"]?.Val<string>()
                              ?? string.Empty;
            var appData = new JObject
            {
                ["OsClient"] = osClient,
                ["Id"] = appId,
                ["Name"] = appName,
                ["AppName"] = appName,
                ["AppKey"] = appKey,
                ["AppId"] = appKey,
                ["AppType"] = applicationType,
                ["ApplicationType"] = applicationType,
                ["Category"] = ResolveMicroServiceSourceCategory(source, null),
                ["PublisherType"] = "官方应用",
                ["Description"] = description,
                ["AppDetail"] = description,
                ["Status"] = "Draft",
                ["BuildStatus"] = "Changed",
                ["PrivateSourcePath"] = $"ai-app-source/{appId}",
                ["CurrentVersion"] = 1
            };
            try
            {
                var currentUser = JObject.FromObject(((dynamic)currentToken).CurrentUser);
                appData["OwnerUserId"] = SafeJString(currentUser, "Id");
                appData["OwnerName"] = SafeJString(
                    currentUser,
                    "Name",
                    SafeJString(currentUser, "Account"));
            }
            catch
            {
                // Ownership metadata is best-effort; authorization was already
                // enforced at the controller boundary.
            }

            var upsert = await UpsertRecordByIdOrKey(
                osClient,
                "sys_microistore",
                appData,
                "AppKey",
                "在线 AI 微服务").ConfigureAwait(false);
            if (upsert.Code != 1)
            {
                // A concurrent creator uses the same deterministic Id/AppKey.
                // Re-read before reporting failure so this remains idempotent.
                existing = await FindAiApplication(osClient, appKey).ConfigureAwait(false);
                if (existing == null) return null;
                return existing;
            }
            return await FindAiApplication(osClient, appKey).ConfigureAwait(false);
        }

        private static async Task<byte[]> ReadPrivateMicroServiceSourceObject(
            string osClient,
            string hdfsPath)
        {
            var read = await ReadApplicationStorageBytes(osClient, hdfsPath, true).ConfigureAwait(false);
            if (read.Code != 1 || read.Data == null) return null;
            if (read.Data is byte[] bytes) return bytes;
            return System.Text.Encoding.UTF8.GetBytes(Convert.ToString(read.Data));
        }

        private static async Task<DosResult<object>> PutAndVerifyPrivateMicroServiceSourceObject(
            string osClient,
            string hdfsPath,
            Stream stream,
            long length,
            string sha256,
            CancellationToken cancellationToken)
        {
            var hdfs = ResolveApplicationAssetHdfs(osClient, out var clientModel);
            var storagePath = hdfsPath.TrimStart('/');
            var exists = await hdfs.ObjectExist(new HDFSParam
            {
                ClientModel = clientModel,
                Limit = true,
                FileFullPath = storagePath
            }).ConfigureAwait(false);
            if (exists.Code != 1)
                return new DosResult<object>(0, null, "检查私有源码暂存对象失败：" + exists.Msg);

            var idempotent = exists.Data;
            if (!exists.Data)
            {
                if (stream.CanSeek) stream.Position = 0;
                var put = await hdfs.PutObject(new HDFSParam
                {
                    ClientModel = clientModel,
                    Limit = true,
                    FileFullPath = storagePath,
                    FileStream = stream,
                    ContentLength = length,
                    TimeoutSeconds = length >= 64L * 1024 * 1024 ? 7200 : (int?)null,
                    CancellationToken = cancellationToken
                }).ConfigureAwait(false);
                if (put.Code != 1)
                    return new DosResult<object>(put.Code, put.Data, "写入私有源码暂存对象失败：" + put.Msg);
            }

            using var readBudget = await AcquireApplicationAssetReadBudgetAsync(
                length,
                cancellationToken).ConfigureAwait(false);
            var bytes = await ReadPrivateMicroServiceSourceObject(osClient, hdfsPath).ConfigureAwait(false);
            if (bytes == null)
                return new DosResult<object>(0, null, "私有源码暂存对象写入后无法回读");
            if (bytes.LongLength != length)
                return new DosResult<object>(0, null, "私有源码暂存对象回读大小不一致");
            var actualHash = HashMicroServiceSource(bytes);
            if (!string.Equals(actualHash, sha256, StringComparison.Ordinal))
                return new DosResult<object>(0, null, "私有源码暂存对象回读 SHA-256 不一致");
            return new DosResult<object>(1, new { Idempotent = idempotent },
                idempotent ? "私有源码暂存对象已精确幂等复用" : "私有源码暂存对象已写入并回读校验");
        }

        public static async Task<DosResult<object>> StageMicroServiceSourceFile(
            string osClient,
            string appIdOrKey,
            string relativePath,
            string expectedSha256,
            string deliveryBatchId,
            JObject source,
            Stream stream,
            long length,
            object currentToken,
            CancellationToken cancellationToken)
        {
            try
            {
                if (IsBlank(osClient)) return new DosResult<object>(0, null, "OsClient 不能为空");
                if (IsBlank(appIdOrKey)) return new DosResult<object>(0, null, "AppIdOrKey 不能为空");
                if (stream == null || !stream.CanRead) return new DosResult<object>(0, null, "源码文件流不可读");
                if (!stream.CanSeek) return new DosResult<object>(0, null, "源码文件流必须可定位");
                if (length < 0 || length > ApplicationAssetStreamMaxFileBytes)
                    return new DosResult<object>(0, null,
                        $"源码文件不能超过 {ApplicationAssetStreamMaxFileBytes} bytes");
                relativePath = NormalizeMicroServiceSourcePath(relativePath);
                if (IsBlank(relativePath)) return new DosResult<object>(0, null, "RelativePath 不合法");
                if (relativePath.Length > 900) return new DosResult<object>(0, null, "RelativePath 超过900字符");
                deliveryBatchId = NormalizeMicroServiceSourceDeliveryBatchId(deliveryBatchId);
                expectedSha256 = SafeString(expectedSha256).Trim();
                if (!Regex.IsMatch(expectedSha256, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
                    return new DosResult<object>(0, null, "ExpectedSha256 必须是64位小写十六进制 SHA-256");

                var actualHash = await Sha256HexAsync(stream, cancellationToken).ConfigureAwait(false);
                if (!string.Equals(actualHash, expectedSha256, StringComparison.Ordinal))
                    return new DosResult<object>(0, null, "源码文件流 SHA-256 与 ExpectedSha256 不一致");
                if (stream.Length != length)
                    return new DosResult<object>(0, null, "源码文件流长度与声明长度不一致");

                source ??= new JObject();
                var app = await EnsureMicroServiceSourceApplication(
                    osClient,
                    appIdOrKey,
                    source,
                    currentToken).ConfigureAwait(false);
                if (app == null)
                    return new DosResult<object>(0, null, "在线 AI 应用不存在且无法按 AppIdOrKey 创建");
                var appId = SafeJString(app, "Id");
                var appKey = NormalizeMicroServiceKey(SafeJString(app, "AppKey", SafeJString(app, "AppId")));
                if (IsBlank(appId) || IsBlank(appKey))
                    return new DosResult<object>(0, null, "在线 AI 应用缺少不可变 Id 或合法 AppKey");
                var activeSourceRows = await GetAiApplicationFiles(osClient, appId).ConfigureAwait(false);
                var baselineSourceManifestHash = ComputeMicroServiceSourceRowsManifestHash(
                    activeSourceRows.OfType<JObject>());
                var baseline = new
                {
                    CurrentVersion = SafeJInt(app, "CurrentVersion", 0),
                    AppVersion = ReadNullableSourceString(app, "AppVersion"),
                    SourceManifestHash = baselineSourceManifestHash
                };

                var hdfsPath = BuildMicroServiceSourceStagingPath(
                    osClient,
                    appId,
                    deliveryBatchId,
                    relativePath);
                var stored = await PutAndVerifyPrivateMicroServiceSourceObject(
                    osClient,
                    hdfsPath,
                    stream,
                    length,
                    expectedSha256,
                    cancellationToken).ConfigureAwait(false);
                if (stored.Code != 1) return stored;

                DosResult<object> metadataResult = null;
                var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
                {
                    Key = BuildApplicationAssetPublishLockKey(osClient, appId),
                    OsClient = osClient,
                    Expiry = TimeSpan.FromMinutes(2),
                    AcquireTimeout = TimeSpan.FromMinutes(1),
                    CancellationToken = cancellationToken,
                    RetryIntervalMs = 100,
                    UseExponentialBackoff = true,
                    AutoRenew = true,
                    MaxLeaseDuration = TimeSpan.FromMinutes(10)
                }, async lease =>
                {
                    await lease.EnsureHeldAsync().ConfigureAwait(false);
                    var rowId = BuildMicroServiceSourceFileId(
                        osClient,
                        appId,
                        deliveryBatchId,
                        relativePath);
                    var existingResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(
                        "mci_ai_app_file",
                        new { OsClient = osClient, Id = rowId }).ConfigureAwait(false);
                    if (existingResult.Code == 1 && existingResult.Data != null)
                    {
                        var existing = JObject.FromObject(existingResult.Data);
                        var exact = string.Equals(SafeJString(existing, "AppId"), appId, StringComparison.Ordinal)
                                    && string.Equals(SafeJString(existing, "FilePath"), relativePath, StringComparison.Ordinal)
                                    && string.Equals(SafeJString(existing, "ContentHash"), expectedSha256, StringComparison.Ordinal)
                                    && (existing["Size"]?.Val<long?>() ?? -1L) == length
                                    && string.Equals(
                                        NormalizeAiApplicationStoragePath(SafeJString(existing, "HdfsPath")),
                                        NormalizeAiApplicationStoragePath(hdfsPath),
                                        StringComparison.OrdinalIgnoreCase);
                        var existingScope = SafeJString(existing, "StorageScope");
                        if (!exact
                            || (!string.Equals(existingScope, StagedPrivateSourceStorageScope, StringComparison.Ordinal)
                                && !string.Equals(existingScope, "Private", StringComparison.Ordinal)))
                        {
                            metadataResult = new DosResult<object>(0, null,
                                "同一 DeliveryBatchId+RelativePath 已存在不同的源码事实，拒绝覆盖");
                            return;
                        }
                        metadataResult = new DosResult<object>(1, new
                        {
                            AppId = appId,
                            AppKey = appKey,
                            DeliveryBatchId = deliveryBatchId,
                            RelativePath = relativePath,
                            HdfsPath = hdfsPath,
                            Size = length,
                            Sha256 = expectedSha256,
                            ContentHash = expectedSha256,
                            StorageScope = existingScope,
                            Idempotent = true,
                            AlreadyFinalized = string.Equals(existingScope, "Private", StringComparison.Ordinal),
                            SourceReadbackVerified = true,
                            Baseline = baseline,
                            Capabilities = GetMicroServiceSourceStreamCapabilities()
                        }, "源码文件暂存已精确幂等复用");
                        return;
                    }

                    var fileName = Path.GetFileName(relativePath);
                    var fileData = new JObject
                    {
                        ["OsClient"] = osClient,
                        ["Id"] = rowId,
                        ["AppId"] = appId,
                        ["AppName"] = SafeJString(app, "AppName", SafeJString(app, "Name")),
                        ["VersionId"] = BuildMicroServiceSourceStageVersionId(appId, deliveryBatchId),
                        ["FilePath"] = relativePath,
                        ["FilePathHash"] = Sha256Hex(relativePath),
                        ["FileName"] = fileName,
                        ["FileType"] = Path.GetExtension(fileName).TrimStart('.').ToLowerInvariant(),
                        ["HdfsPath"] = hdfsPath,
                        ["PublishHdfsPath"] = string.Empty,
                        ["StorageScope"] = StagedPrivateSourceStorageScope,
                        ["ContentHash"] = expectedSha256,
                        ["Size"] = length,
                        ["IsDirectory"] = 0,
                        ["Version"] = 1
                    };
                    var upsert = await UpsertRecordByIdOrKey(
                        osClient,
                        "mci_ai_app_file",
                        fileData,
                        string.Empty,
                        "在线 AI 微服务源码暂存").ConfigureAwait(false);
                    if (upsert.Code != 1)
                    {
                        metadataResult = new DosResult<object>(
                            upsert.Code,
                            upsert.Data,
                            "源码对象已安全暂存，但写入暂存元数据失败：" + upsert.Msg);
                        return;
                    }
                    metadataResult = new DosResult<object>(1, new
                    {
                        AppId = appId,
                        AppKey = appKey,
                        DeliveryBatchId = deliveryBatchId,
                        RelativePath = relativePath,
                        HdfsPath = hdfsPath,
                        Size = length,
                        Sha256 = expectedSha256,
                        ContentHash = expectedSha256,
                        StorageScope = StagedPrivateSourceStorageScope,
                        Idempotent = false,
                        AlreadyFinalized = false,
                        SourceReadbackVerified = true,
                        Baseline = baseline,
                        Capabilities = GetMicroServiceSourceStreamCapabilities()
                    }, "源码文件已写入租户私有暂存区并完成全量回读校验");
                }).ConfigureAwait(false);
                if (lockResult.Code != 1)
                    return new DosResult<object>(0, null, "未获得应用源码元数据锁：" + lockResult.Msg);
                return metadataResult ?? new DosResult<object>(0, null, "源码文件暂存元数据未执行");
            }
            catch (OperationCanceledException)
            {
                return new DosResult<object>(0, null, "源码文件流式暂存已取消");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "源码文件流式暂存失败：" + ex.Message);
            }
        }

        private static List<JObject> ReadMicroServiceSourceRowsStrong(
            DbTrans trans,
            ApplicationAssetV3SqlDialect dialect,
            string appId,
            bool forUpdate)
        {
            string Q(string name) => QuoteApplicationAssetV3Identifier(dialect, name);
            var sql = BuildApplicationAssetV3SelectSql(
                dialect,
                "mci_ai_app_file",
                "*",
                $"{Q("AppId")}=@appId AND COALESCE({Q("IsDeleted")},0)<>1",
                forUpdate);
            return (trans.FromSql(sql)
                        .AddInParameter("@appId", appId)
                        .ToList<dynamic>()
                    ?? new List<dynamic>())
                .Select(row => row as JObject ?? JObject.FromObject((object)row))
                .ToList();
        }

        private static JObject ReadMicroServiceSourceAppStrong(
            DbTrans trans,
            ApplicationAssetV3SqlDialect dialect,
            string appId,
            bool forUpdate)
        {
            string Q(string name) => QuoteApplicationAssetV3Identifier(dialect, name);
            var sql = BuildApplicationAssetV3LimitedSelectSql(
                dialect,
                "sys_microistore",
                "*",
                $"{Q("Id")}=@appId AND COALESCE({Q("IsDeleted")},0)<>1",
                2,
                forUpdate);
            var rows = trans.FromSql(sql)
                           .AddInParameter("@appId", appId)
                           .ToList<dynamic>()
                       ?? new List<dynamic>();
            if (rows.Count != 1) return null;
            return rows[0] as JObject ?? JObject.FromObject((object)rows[0]);
        }

        private static string ValidateStagedMicroServiceSourceRows(
            IEnumerable<JObject> stagedRows,
            JArray manifest,
            string appId,
            string deliveryBatchId,
            string stagingRoot)
        {
            var stageVersionId = BuildMicroServiceSourceStageVersionId(appId, deliveryBatchId);
            var rows = (stagedRows ?? Enumerable.Empty<JObject>()).ToList();
            if (rows.Count != manifest.Count)
                return $"暂存源码清单数量不一致：Expected={manifest.Count}，Actual={rows.Count}";
            var byPath = rows.ToDictionary(
                row => SafeJString(row, "FilePath"),
                StringComparer.Ordinal);
            foreach (var file in manifest.OfType<JObject>())
            {
                var path = SafeJString(file, "Path");
                if (!byPath.TryGetValue(path, out var row)) return "暂存源码缺少文件：" + path;
                if (!string.Equals(SafeJString(row, "AppId"), appId, StringComparison.Ordinal)
                    || !string.Equals(SafeJString(row, "VersionId"), stageVersionId, StringComparison.Ordinal)
                    || !string.Equals(
                        SafeJString(row, "StorageScope"),
                        StagedPrivateSourceStorageScope,
                        StringComparison.Ordinal)
                    || !string.Equals(SafeJString(row, "ContentHash"), SafeJString(file, "Sha256"), StringComparison.Ordinal)
                    || (row["Size"]?.Val<long?>() ?? -1L) != (file["Size"]?.Val<long?>() ?? -2L)
                    || !string.Equals(SafeJString(row, "FilePathHash"), Sha256Hex(path), StringComparison.Ordinal))
                {
                    return "暂存源码元数据与清单不一致：" + path;
                }
                var hdfsPath = NormalizeAiApplicationStoragePath(SafeJString(row, "HdfsPath"));
                var normalizedRoot = NormalizeAiApplicationStoragePath(stagingRoot);
                if (!hdfsPath.StartsWith(normalizedRoot + "/", StringComparison.OrdinalIgnoreCase))
                    return "暂存源码对象不属于当前交付批次私有前缀：" + path;
            }
            return null;
        }

        private static async Task<string> VerifyStagedMicroServiceSourceObjects(
            string osClient,
            IEnumerable<JObject> stagedRows,
            CancellationToken cancellationToken)
        {
            foreach (var row in stagedRows ?? Enumerable.Empty<JObject>())
            {
                cancellationToken.ThrowIfCancellationRequested();
                var size = row["Size"]?.Val<long?>() ?? -1L;
                using var readBudget = await AcquireApplicationAssetReadBudgetAsync(
                    Math.Max(0L, size),
                    cancellationToken).ConfigureAwait(false);
                var bytes = await ReadPrivateMicroServiceSourceObject(
                    osClient,
                    SafeJString(row, "HdfsPath")).ConfigureAwait(false);
                if (bytes == null) return "暂存源码对象无法从租户私有桶回读：" + SafeJString(row, "FilePath");
                if (bytes.LongLength != size) return "暂存源码对象回读大小不一致：" + SafeJString(row, "FilePath");
                if (!string.Equals(
                        HashMicroServiceSource(bytes),
                        SafeJString(row, "ContentHash"),
                        StringComparison.Ordinal))
                {
                    return "暂存源码对象回读 SHA-256 不一致：" + SafeJString(row, "FilePath");
                }
            }
            return null;
        }

        public static async Task<DosResult<object>> FinalizeMicroServiceSourceManifest(
            string osClient,
            JObject param,
            object currentToken,
            CancellationToken cancellationToken)
        {
            try
            {
                if (IsBlank(osClient)) return new DosResult<object>(0, null, "OsClient 不能为空");
                if (param == null) return new DosResult<object>(0, null, "参数不能为空");
                var replaceToken = GetSourceToken(param, "ReplacePrivateSourceOnly");
                if (replaceToken == null
                    || replaceToken.Type != JTokenType.Boolean
                    || replaceToken.Value<bool>() != true)
                {
                    return new DosResult<object>(0, null, "ReplacePrivateSourceOnly 必须显式为 JSON boolean true");
                }
                var appIdOrKey = SafeJString(param, "AppIdOrKey",
                    SafeJString(param, "AppId", SafeJString(param, "AppKey", SafeJString(param, "MsKey"))));
                if (IsBlank(appIdOrKey)) return new DosResult<object>(0, null, "AppIdOrKey 不能为空");
                var deliveryBatchId = NormalizeMicroServiceSourceDeliveryBatchId(SafeJString(param, "DeliveryBatchId"));
                var manifest = NormalizeMicroServiceSourceManifest(
                    GetSourceToken(param, "Manifest") as JArray
                    ?? GetSourceToken(param, "SourceFiles") as JArray
                    ?? GetSourceToken(param, "Files") as JArray);
                var sourceManifestHash = SafeJString(param, "SourceManifestHash").Trim();
                if (!Regex.IsMatch(sourceManifestHash, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
                    return new DosResult<object>(0, null, "SourceManifestHash 必须是64位小写十六进制 SHA-256");
                var computedHash = ComputeMicroServiceManifestHash(manifest);
                if (!string.Equals(sourceManifestHash, computedHash, StringComparison.Ordinal))
                    return new DosResult<object>(0, null, "SourceManifestHash 与规范化 Manifest 不一致");

                var app = await FindAiApplication(osClient, appIdOrKey).ConfigureAwait(false);
                if (app == null) return new DosResult<object>(2, null, "在线 AI 应用不存在，请先 stage 至少一个源码文件");
                var appId = SafeJString(app, "Id");
                var appKey = NormalizeMicroServiceKey(SafeJString(app, "AppKey", SafeJString(app, "AppId")));
                if (IsBlank(appId) || IsBlank(appKey))
                    return new DosResult<object>(0, null, "在线 AI 应用缺少不可变 Id 或合法 AppKey");
                var stagingRoot = BuildMicroServiceSourceStagingRoot(osClient, appId, deliveryBatchId);
                var stageVersionId = BuildMicroServiceSourceStageVersionId(appId, deliveryBatchId);

                var stagedResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>(
                    "mci_ai_app_file",
                    new
                    {
                        OsClient = osClient,
                        _Where = new List<object>
                        {
                            new List<object> { "AppId", "=", appId },
                            new List<object> { "AND", "VersionId", "=", stageVersionId },
                            new List<object> { "AND", "StorageScope", "=", StagedPrivateSourceStorageScope }
                        },
                        _PageSize = MaxMicroServiceSourceStreamFiles + 1
                    }).ConfigureAwait(false);
                if (stagedResult.Code != 1)
                    return new DosResult<object>(stagedResult.Code, stagedResult.Data,
                        "读取私有源码暂存元数据失败：" + stagedResult.Msg);
                var stagedRows = stagedResult.Code == 1 && stagedResult.Data != null
                    ? JArray.FromObject(stagedResult.Data).OfType<JObject>().ToList()
                    : new List<JObject>();
                var stagedError = ValidateStagedMicroServiceSourceRows(
                    stagedRows,
                    manifest,
                    appId,
                    deliveryBatchId,
                    stagingRoot);
                if (stagedError != null)
                {
                    // A retry after a committed finalize has no staged rows.  It
                    // is resolved under the application lock from active facts.
                    if (stagedRows.Count > 0)
                        return new DosResult<object>(0, null, stagedError);
                }
                else
                {
                    var objectError = await VerifyStagedMicroServiceSourceObjects(
                        osClient,
                        stagedRows,
                        cancellationToken).ConfigureAwait(false);
                    if (objectError != null) return new DosResult<object>(0, null, objectError);
                }

                DosResult<object> finalizeResult = null;
                var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
                {
                    Key = BuildApplicationAssetPublishLockKey(osClient, appId),
                    OsClient = osClient,
                    Expiry = TimeSpan.FromMinutes(5),
                    AcquireTimeout = TimeSpan.FromMinutes(1),
                    CancellationToken = cancellationToken,
                    RetryIntervalMs = 100,
                    UseExponentialBackoff = true,
                    AutoRenew = true,
                    MaxLeaseDuration = TimeSpan.FromHours(1)
                }, async lease =>
                {
                    await lease.EnsureHeldAsync().ConfigureAwait(false);
                    var client = OsClientExtend.GetClient(osClient);
                    if (client?.Db == null)
                    {
                        finalizeResult = new DosResult<object>(0, null, "未找到租户主库连接");
                        return;
                    }
                    var dialect = ResolveApplicationAssetV3SqlDialect(osClient);
                    string Q(string name) => QuoteApplicationAssetV3Identifier(dialect, name);
                    using var trans = client.Db.BeginTransaction();
                    var committed = false;
                    try
                    {
                        var lockedApp = ReadMicroServiceSourceAppStrong(trans, dialect, appId, true);
                        if (lockedApp == null)
                        {
                            finalizeResult = new DosResult<object>(0, null, "在线 AI 应用在 finalize 前已删除");
                            return;
                        }
                        if (!string.Equals(
                                NormalizeMicroServiceKey(SafeJString(lockedApp, "AppKey", SafeJString(lockedApp, "AppId"))),
                                appKey,
                                StringComparison.Ordinal))
                        {
                            finalizeResult = new DosResult<object>(0, null, "在线 AI 应用 AppKey 在 finalize 前发生漂移");
                            return;
                        }

                        var allRows = ReadMicroServiceSourceRowsStrong(trans, dialect, appId, true);
                        if (allRows.Count > MaxMicroServiceSourceStreamFiles * 3)
                        {
                            finalizeResult = new DosResult<object>(0, null, "应用源码控制记录超过安全上限，已 fail closed");
                            return;
                        }
                        var activeRows = allRows.Where(IsPrivateAiApplicationSourceFile).ToList();
                        var activeManifest = BuildMicroServiceSourceManifestFromRows(activeRows);
                        var activeHash = activeManifest.Count == 0
                            ? null
                            : ComputeMicroServiceManifestHash(activeManifest);
                        var lockedStagedRows = allRows.Where(row =>
                                string.Equals(SafeJString(row, "VersionId"), stageVersionId, StringComparison.Ordinal)
                                && string.Equals(
                                    SafeJString(row, "StorageScope"),
                                    StagedPrivateSourceStorageScope,
                                    StringComparison.Ordinal))
                            .ToList();

                        // A lost response after commit is a normal retry.  The
                        // desired manifest is already the active fact, so stale
                        // expected baselines must not turn an exact replay into a
                        // conflict.
                        if (string.Equals(activeHash, sourceManifestHash, StringComparison.Ordinal)
                            && JToken.DeepEquals(activeManifest, manifest))
                        {
                            var activeObjectError = await VerifyStagedMicroServiceSourceObjects(
                                osClient,
                                activeRows,
                                cancellationToken).ConfigureAwait(false);
                            if (activeObjectError != null)
                            {
                                finalizeResult = new DosResult<object>(0, null,
                                    "目标私有源码清单虽然已激活，但 HDFS 回读失败：" + activeObjectError);
                                return;
                            }
                            foreach (var redundantStage in lockedStagedRows)
                            {
                                var discarded = trans.FromSql(
                                        $"UPDATE {Q("mci_ai_app_file")} SET " +
                                        $"{Q("StorageScope")}=@scope,{Q("IsDeleted")}=1,{Q("UpdateTime")}=@now " +
                                        $"WHERE {Q("Id")}=@id AND {Q("StorageScope")}=@stagedScope " +
                                        $"AND {Q("VersionId")}=@versionId AND COALESCE({Q("IsDeleted")},0)<>1")
                                    .AddInParameter("@scope", ArchivedPrivateSourceStorageScope)
                                    .AddInParameter("@now", DbType.DateTime, DateTime.Now)
                                    .AddInParameter("@id", SafeJString(redundantStage, "Id"))
                                    .AddInParameter("@stagedScope", StagedPrivateSourceStorageScope)
                                    .AddInParameter("@versionId", stageVersionId)
                                    .ExecuteNonQuery();
                                if (discarded != 1)
                                {
                                    finalizeResult = new DosResult<object>(0, null,
                                        "清理幂等重放的冗余暂存元数据失败：" + SafeJString(redundantStage, "FilePath"));
                                    return;
                                }
                            }
                            await lease.EnsureHeldAsync().ConfigureAwait(false);
                            trans.Commit();
                            committed = true;
                            finalizeResult = new DosResult<object>(1, new
                            {
                                ProtocolVersion = MicroServiceSourceStreamProtocolVersion,
                                AppId = appId,
                                AppKey = appKey,
                                DeliveryBatchId = deliveryBatchId,
                                FileCount = manifest.Count,
                                TotalSize = manifest.OfType<JObject>().Sum(file => file["Size"]?.Val<long?>() ?? 0L),
                                SourceManifestHash = sourceManifestHash,
                                PreviousSourceManifestHash = activeHash,
                                ArchivedFileCount = 0,
                                DiscardedStagedFileCount = lockedStagedRows.Count,
                                Idempotent = true,
                                SourceReadbackVerified = true,
                                Files = activeManifest
                            }, "私有源码清单已是目标版本，finalize 精确幂等复用");
                            return;
                        }

                        var casError = ValidateMicroServiceSourceFinalizeCas(lockedApp, activeHash, param);
                        if (casError != null)
                        {
                            finalizeResult = new DosResult<object>(0, new
                            {
                                ErrorType = "MICRO_SERVICE_SOURCE_CAS_CONFLICT",
                                ActualCurrentVersion = SafeJInt(lockedApp, "CurrentVersion", 0),
                                ActualAppVersion = ReadNullableSourceString(lockedApp, "AppVersion"),
                                ActualSourceManifestHash = activeHash
                            }, casError);
                            return;
                        }

                        var lockedStageError = ValidateStagedMicroServiceSourceRows(
                            lockedStagedRows,
                            manifest,
                            appId,
                            deliveryBatchId,
                            stagingRoot);
                        if (lockedStageError != null)
                        {
                            finalizeResult = new DosResult<object>(0, null, lockedStageError);
                            return;
                        }

                        var now = DateTime.Now;
                        foreach (var oldRow in activeRows)
                        {
                            var archived = trans.FromSql(
                                    $"UPDATE {Q("mci_ai_app_file")} SET " +
                                    $"{Q("StorageScope")}=@scope,{Q("IsDeleted")}=1,{Q("UpdateTime")}=@now " +
                                    $"WHERE {Q("Id")}=@id AND COALESCE({Q("IsDeleted")},0)<>1")
                                .AddInParameter("@scope", ArchivedPrivateSourceStorageScope)
                                .AddInParameter("@now", DbType.DateTime, now)
                                .AddInParameter("@id", SafeJString(oldRow, "Id"))
                                .ExecuteNonQuery();
                            if (archived != 1)
                            {
                                finalizeResult = new DosResult<object>(0, null,
                                    "归档旧私有源码元数据 CAS 失败：" + SafeJString(oldRow, "FilePath"));
                                return;
                            }
                        }

                        foreach (var stagedRow in lockedStagedRows)
                        {
                            var promoted = trans.FromSql(
                                    $"UPDATE {Q("mci_ai_app_file")} SET " +
                                    $"{Q("StorageScope")}=@activeScope,{Q("VersionId")}=NULL,{Q("IsDeleted")}=0," +
                                    $"{Q("Version")}=COALESCE({Q("Version")},0)+1,{Q("UpdateTime")}=@now " +
                                    $"WHERE {Q("Id")}=@id AND {Q("StorageScope")}=@stagedScope " +
                                    $"AND {Q("VersionId")}=@batch AND {Q("FilePathHash")}=@pathHash " +
                                    $"AND {Q("ContentHash")}=@contentHash AND {Q("Size")}=@size " +
                                    $"AND COALESCE({Q("IsDeleted")},0)<>1")
                                .AddInParameter("@activeScope", "Private")
                                .AddInParameter("@now", DbType.DateTime, now)
                                .AddInParameter("@id", SafeJString(stagedRow, "Id"))
                                .AddInParameter("@stagedScope", StagedPrivateSourceStorageScope)
                                .AddInParameter("@batch", stageVersionId)
                                .AddInParameter("@pathHash", SafeJString(stagedRow, "FilePathHash"))
                                .AddInParameter("@contentHash", SafeJString(stagedRow, "ContentHash"))
                                .AddInParameter("@size", stagedRow["Size"]?.Val<long?>() ?? 0L)
                                .ExecuteNonQuery();
                            if (promoted != 1)
                            {
                                finalizeResult = new DosResult<object>(0, null,
                                    "提升暂存源码元数据 CAS 失败：" + SafeJString(stagedRow, "FilePath"));
                                return;
                            }
                        }

                        var actualAppVersion = ReadNullableSourceString(lockedApp, "AppVersion");
                        var appUpdated = trans.FromSql(
                                $"UPDATE {Q("sys_microistore")} SET " +
                                $"{Q("PrivateSourcePath")}=@privatePath,{Q("BuildStatus")}=@buildStatus,{Q("UpdateTime")}=@now " +
                                $"WHERE {Q("Id")}=@appId AND COALESCE({Q("CurrentVersion")},0)=@currentVersion " +
                                $"AND {BuildApplicationAssetV3NullableStringEqualsSql(dialect, "AppVersion", "@appVersion")}")
                            .AddInParameter("@privatePath", stagingRoot)
                            .AddInParameter("@buildStatus", "Changed")
                            .AddInParameter("@now", DbType.DateTime, now)
                            .AddInParameter("@appId", appId)
                            .AddInParameter("@currentVersion", SafeJInt(lockedApp, "CurrentVersion", 0))
                            .AddInParameter("@appVersion", actualAppVersion)
                            .ExecuteNonQuery();
                        if (appUpdated != 1)
                        {
                            finalizeResult = new DosResult<object>(0, null,
                                "sys_microistore 私有源码指针 CAS 失败，未提交任何变更");
                            return;
                        }

                        var readbackRows = ReadMicroServiceSourceRowsStrong(trans, dialect, appId, false)
                            .Where(IsPrivateAiApplicationSourceFile)
                            .ToList();
                        var readbackManifest = BuildMicroServiceSourceManifestFromRows(readbackRows);
                        var readbackHash = readbackManifest.Count == 0
                            ? null
                            : ComputeMicroServiceManifestHash(readbackManifest);
                        if (!string.Equals(readbackHash, sourceManifestHash, StringComparison.Ordinal)
                            || !JToken.DeepEquals(readbackManifest, manifest))
                        {
                            finalizeResult = new DosResult<object>(0, null,
                                "私有源码原子切换后事务内回读清单不一致");
                            return;
                        }
                        await lease.EnsureHeldAsync().ConfigureAwait(false);
                        trans.Commit();
                        committed = true;
                        finalizeResult = new DosResult<object>(1, new
                        {
                            ProtocolVersion = MicroServiceSourceStreamProtocolVersion,
                            AppId = appId,
                            AppKey = appKey,
                            DeliveryBatchId = deliveryBatchId,
                            ActivePrivateSourcePath = stagingRoot,
                            FileCount = manifest.Count,
                            TotalSize = manifest.OfType<JObject>().Sum(file => file["Size"]?.Val<long?>() ?? 0L),
                            SourceManifestHash = sourceManifestHash,
                            PreviousSourceManifestHash = activeHash,
                            ArchivedFileCount = activeRows.Count,
                            RemovedFileCount = ResolveMicroServiceSourceManifestDeletions(activeRows, manifest).Count,
                            Idempotent = false,
                            SourceReadbackVerified = true,
                            Files = readbackManifest
                        }, "私有源码清单已原子切换；旧源码元数据已归档，公开运行产物未修改");
                    }
                    catch
                    {
                        if (!committed)
                        {
                            try { trans.Rollback(); } catch { }
                        }
                        throw;
                    }
                }).ConfigureAwait(false);
                if (lockResult.Code != 1)
                    return new DosResult<object>(0, null, "未获得应用私有源码 finalize 分布式锁：" + lockResult.Msg);
                return finalizeResult ?? new DosResult<object>(0, null, "私有源码 finalize 未执行");
            }
            catch (OperationCanceledException)
            {
                return new DosResult<object>(0, null, "私有源码清单 finalize 已取消");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "私有源码清单 finalize 失败：" + ex.Message);
            }
        }

        internal static async Task<DosResult<object>> SyncMicroServiceSourceWithCasProtocol(
            string osClient,
            JObject param,
            object currentToken)
        {
            if (!HasSourceProperty(param, "ExpectedCurrentVersion")
                || !HasSourceProperty(param, "ExpectedAppVersion")
                || !HasSourceProperty(param, "ExpectedSourceManifestHash"))
            {
                return new DosResult<object>(0, null,
                    "使用源码 CAS 时必须同时传 ExpectedCurrentVersion、ExpectedAppVersion、ExpectedSourceManifestHash");
            }
            var source = UnwrapMicroServiceParam(param);
            var appIdOrKey = source?["MsKey"]?.Val<string>()
                             ?? source?["MicroServiceKey"]?.Val<string>()
                             ?? source?["AppKey"]?.Val<string>()
                             ?? param?["AppIdOrKey"]?.Val<string>();
            var files = GetArrayParam(param, "SourceFiles", "sourceFiles", "Files", "files");
            if (files.Count == 0) return new DosResult<object>(0, null, "SourceFiles 不能为空");
            if (files.Count > 1000) return new DosResult<object>(0, null, "单次最多同步 1000 个源码文件");
            var deliveryBatchId = SafeJString(param, "DeliveryBatchId");
            if (IsBlank(deliveryBatchId)) deliveryBatchId = Ulid.NewUlid().ToString();
            deliveryBatchId = NormalizeMicroServiceSourceDeliveryBatchId(deliveryBatchId);

            var manifest = new JArray();
            long totalSize = 0;
            for (var i = 0; i < files.Count; i++)
            {
                if (!(files[i] is JObject file))
                    return new DosResult<object>(0, null, $"SourceFiles[{i}] 必须是对象");
                var relativePath = NormalizeMicroServiceSourcePath(
                    SafeJString(file, "Path", SafeJString(file, "RelativePath", SafeJString(file, "FilePath"))));
                if (IsBlank(relativePath)) return new DosResult<object>(0, null, $"SourceFiles[{i}].Path 不合法");
                var base64 = SafeJString(file, "FileByteBase64",
                    SafeJString(file, "ContentBase64", SafeJString(file, "Base64")));
                if (IsBlank(base64)) return new DosResult<object>(0, null, $"SourceFiles[{i}].FileByteBase64 不能为空");
                byte[] bytes;
                try { bytes = Convert.FromBase64String(NormalizeBase64Payload(base64)); }
                catch { return new DosResult<object>(0, null, $"SourceFiles[{i}] 不是有效的 Base64：{relativePath}"); }
                if (bytes.LongLength > 10L * 1024 * 1024)
                    return new DosResult<object>(0, null, "旧 JSON CAS 兼容路径单文件不能超过10MB，请使用源码流式接口：" + relativePath);
                totalSize += bytes.LongLength;
                if (totalSize > 100L * 1024 * 1024)
                    return new DosResult<object>(0, null, "旧 JSON CAS 兼容路径总大小不能超过100MB，请使用源码流式接口");
                var sha256 = HashMicroServiceSource(bytes);
                var declaredHash = SafeJString(file, "Sha256", SafeJString(file, "Hash"));
                if (!IsBlank(declaredHash) && !string.Equals(declaredHash, sha256, StringComparison.Ordinal))
                    return new DosResult<object>(0, null, "源码声明 SHA-256 不一致：" + relativePath);
                manifest.Add(new JObject
                {
                    ["Path"] = relativePath,
                    ["Sha256"] = sha256,
                    ["Size"] = bytes.LongLength
                });
                using var stream = new MemoryStream(bytes, false);
                var staged = await StageMicroServiceSourceFile(
                    osClient,
                    appIdOrKey,
                    relativePath,
                    sha256,
                    deliveryBatchId,
                    source,
                    stream,
                    bytes.LongLength,
                    currentToken,
                    CancellationToken.None).ConfigureAwait(false);
                if (staged.Code != 1) return staged;
            }

            manifest = NormalizeMicroServiceSourceManifest(manifest);
            var computedHash = ComputeMicroServiceManifestHash(manifest);
            var requestedHash = SafeJString(param, "SourceManifestHash");
            if (!IsBlank(requestedHash) && !string.Equals(requestedHash, computedHash, StringComparison.Ordinal))
                return new DosResult<object>(0, null, "SourceManifestHash 与 SourceFiles 不一致");
            var finalizeParam = new JObject
            {
                ["AppIdOrKey"] = appIdOrKey,
                ["DeliveryBatchId"] = deliveryBatchId,
                ["ExpectedCurrentVersion"] = GetSourceToken(param, "ExpectedCurrentVersion")?.DeepClone(),
                ["ExpectedAppVersion"] = GetSourceToken(param, "ExpectedAppVersion")?.DeepClone() ?? JValue.CreateNull(),
                ["ExpectedSourceManifestHash"] = GetSourceToken(param, "ExpectedSourceManifestHash")?.DeepClone() ?? JValue.CreateNull(),
                ["SourceManifestHash"] = computedHash,
                ["ReplacePrivateSourceOnly"] = true,
                ["Manifest"] = manifest
            };
            return await FinalizeMicroServiceSourceManifest(
                osClient,
                finalizeParam,
                currentToken,
                CancellationToken.None).ConfigureAwait(false);
        }
    }
}

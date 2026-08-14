using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// MCP application-asset publishing primitives.
    /// File bytes enter through a multipart stream and go directly to HDFS;
    /// Jint only needs paths, hashes and manifest metadata for legacy flows.
    /// </summary>
    public static partial class V8McpLogic
    {
        private const int MaxStreamPublishAssetCount = 20_000;
        private const long MaxStreamPublishFileBytes = 128L * 1024 * 1024;
        private const long MaxStreamPublishTotalBytes = 1L * 1024 * 1024 * 1024;
        private const long ApplicationPublishDailyQuotaBytes =
            FileUploadSecurityOptions.DefaultAbsoluteDailyQuotaMegabytes * 1024L * 1024L;
        private const int DefaultStreamPublishIoConcurrency = 8;
        private const int MaxStreamPublishIoConcurrency = 8;
        private const long StreamPublishReadBudgetUnitBytes = 1L * 1024 * 1024;
        private const long MaxStreamPublishReadInFlightBytes = MaxStreamPublishFileBytes;
        private const int StreamPublishReadBudgetUnits =
            (int)(MaxStreamPublishReadInFlightBytes / StreamPublishReadBudgetUnitBytes);
        private const string ImmutableRuntimeEntryMarker = "data-microi-immutable-runtime";
        private const string ActiveStreamBuildStorageScope = "PublicBuildStream";
        private const string ArchivedStreamBuildStorageScope = "PublicBuildStreamArchived";
        private const int StreamBuildMetadataPageSize = 1000;

        public static long ApplicationAssetStreamMaxFileBytes => MaxStreamPublishFileBytes;
        public static long ApplicationAssetStreamMaxTotalBytes => MaxStreamPublishTotalBytes;
        public static int ApplicationAssetStreamIoConcurrency => DefaultStreamPublishIoConcurrency;
        public static long ApplicationAssetStreamReadBudgetBytes => MaxStreamPublishReadInFlightBytes;

        // This gate is intentionally process-local: it protects the managed heap
        // shared by all finalize requests on this API node. It is not publish
        // state or a distributed correctness primitive; every node owns a
        // separate heap and therefore needs its own identical bound.
        private static readonly SemaphoreSlim ApplicationAssetReadBudgetAllocation = new SemaphoreSlim(1, 1);
        private static readonly SemaphoreSlim ApplicationAssetReadBudgetUnits = new SemaphoreSlim(
            StreamPublishReadBudgetUnits,
            StreamPublishReadBudgetUnits);

        private sealed class ApplicationAssetReadBudgetLease : IDisposable
        {
            private int _units;

            public ApplicationAssetReadBudgetLease(int units)
            {
                _units = units;
            }

            public void Dispose()
            {
                var units = Interlocked.Exchange(ref _units, 0);
                if (units > 0) ApplicationAssetReadBudgetUnits.Release(units);
            }
        }

        /// <summary>
        /// New immutable-runtime entries resolve every runtime asset from the
        /// version directory. They can therefore be promoted first as the single
        /// runtime switch; legacy entries stay last to preserve old behavior.
        /// </summary>
        public static bool HasApplicationImmutableRuntimeMarker(byte[] entryBytes)
        {
            if (entryBytes == null || entryBytes.Length == 0) return false;
            var marker = Encoding.ASCII.GetBytes(ImmutableRuntimeEntryMarker);
            if (entryBytes.Length < marker.Length) return false;
            for (var offset = 0; offset <= entryBytes.Length - marker.Length; offset++)
            {
                var matched = true;
                for (var index = 0; index < marker.Length; index++)
                {
                    var current = entryBytes[offset + index];
                    if (current >= (byte)'A' && current <= (byte)'Z') current = (byte)(current + 32);
                    if (current == marker[index]) continue;
                    matched = false;
                    break;
                }
                if (matched) return true;
            }
            return false;
        }

        public static int GetApplicationAssetPromotionPriority(bool immutableRuntimeEntry, bool isEntry)
        {
            return immutableRuntimeEntry
                ? (isEntry ? 0 : 1)
                : (isEntry ? 1 : 0);
        }

        private sealed class ApplicationAssetPaths
        {
            public string VersionPath { get; set; }
            public string RootPath { get; set; }
            public string LatestPath { get; set; }
            public string IntegrityMarkerPath { get; set; }
        }

        private sealed class StreamPublishAsset
        {
            public string RelativePath { get; set; }
            public string Sha256 { get; set; }
            public long Size { get; set; }
            public bool IsEntry { get; set; }
            public ApplicationAssetPaths Paths { get; set; }
        }

        private sealed class StreamPublishAliasTarget
        {
            public StreamPublishAsset Asset { get; set; }
            public string Path { get; set; }
        }

        /// <summary>
        /// Normalize a built application's relative path without allowing it to
        /// collide with the publisher's versions/latest/integrity namespaces.
        /// Public for focused regression tests and MCP client parity tests.
        /// </summary>
        public static string NormalizeApplicationAssetRelativePath(string value)
        {
            var path = (value ?? string.Empty).Trim().Replace('\u005c', '/');
            if (path.Length == 0) throw new ArgumentException("应用资产相对路径不能为空。", nameof(value));
            if (path.Length > 1024) throw new ArgumentException("应用资产相对路径不能超过1024个字符。", nameof(value));
            if (path.StartsWith("/", StringComparison.Ordinal)
                || path.Contains("//", StringComparison.Ordinal)
                || path.Contains(":", StringComparison.Ordinal)
                || Regex.IsMatch(path, "%2e|%2f|%5c", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)
                || path.Any(char.IsControl))
            {
                throw new ArgumentException("应用资产相对路径包含非法字符。", nameof(value));
            }

            var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (segments.Length == 0 || segments.Any(segment => segment == "." || segment == ".."))
                throw new ArgumentException("应用资产相对路径包含非法路径段。", nameof(value));

            var reservedRoot = segments[0];
            if (string.Equals(reservedRoot, "versions", StringComparison.OrdinalIgnoreCase)
                || string.Equals(reservedRoot, "latest", StringComparison.OrdinalIgnoreCase)
                || string.Equals(reservedRoot, ".microi-integrity", StringComparison.OrdinalIgnoreCase))
            {
                throw new ArgumentException("应用资产不能占用发布器保留目录。", nameof(value));
            }

            foreach (var segment in segments)
            {
                if (segment.Length > 255 || segment.IndexOfAny(new[] { '<', '>', '"', '|', '?', '*' }) >= 0)
                    throw new ArgumentException("应用资产路径段不合法。", nameof(value));
            }
            return string.Join("/", segments);
        }

        public static string NormalizeApplicationAssetVersion(string value)
        {
            var version = (value ?? string.Empty).Trim();
            if (!version.StartsWith("v", StringComparison.OrdinalIgnoreCase)) version = "v" + version;
            var match = Regex.Match(version, @"^v(\d+)\.(\d+)\.(\d+)$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
            if (!match.Success) throw new ArgumentException("VersionNo 必须是 v1.2.3 格式。", nameof(value));
            return $"v{int.Parse(match.Groups[1].Value)}.{int.Parse(match.Groups[2].Value)}.{int.Parse(match.Groups[3].Value)}";
        }

        /// <summary>
        /// RequestId is persisted in publish metadata and may be reused across
        /// nodes after an ambiguous timeout. Keep it header/JSON/lock safe and
        /// bounded instead of accepting arbitrary user-controlled text.
        /// </summary>
        public static string NormalizeApplicationAssetRequestId(string value)
        {
            var requestId = (value ?? string.Empty).Trim();
            if (!Regex.IsMatch(
                    requestId,
                    @"^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$",
                    RegexOptions.CultureInvariant))
            {
                throw new ArgumentException(
                    "RequestId 必须为8-128位，并且只能包含字母、数字、点、下划线、冒号和短横线。",
                    nameof(value));
            }
            return requestId;
        }

        public static string NormalizeApplicationAssetDeliveryBatchId(string value)
        {
            var deliveryBatchId = (value ?? string.Empty).Trim();
            if (!Regex.IsMatch(
                    deliveryBatchId,
                    @"^[A-Za-z0-9][A-Za-z0-9._:-]{7,49}$",
                    RegexOptions.CultureInvariant))
            {
                throw new ArgumentException(
                    "DeliveryBatchId 必须为8-50位，并且只能包含字母、数字、点、下划线、冒号和短横线。",
                    nameof(value));
            }
            return deliveryBatchId;
        }

        private static string ResolveApplicationAssetRequestId(string value, string prefix, string stableSeed)
        {
            if (!string.IsNullOrWhiteSpace(value)) return NormalizeApplicationAssetRequestId(value);
            var safePrefix = Regex.Replace(prefix ?? "request", @"[^A-Za-z0-9_-]", "-").Trim('-');
            if (safePrefix.Length == 0) safePrefix = "request";
            return NormalizeApplicationAssetRequestId($"{safePrefix}-{Sha256Hex(stableSeed).Substring(0, 48)}");
        }

        private static string ResolveApplicationAssetDeliveryBatchId(string value, string stableSeed)
        {
            if (!string.IsNullOrWhiteSpace(value)) return NormalizeApplicationAssetDeliveryBatchId(value);
            return NormalizeApplicationAssetDeliveryBatchId($"batch-{Sha256Hex(stableSeed).Substring(0, 44)}");
        }

        private static string NormalizeOptionalApplicationAssetSha256(string value, string fieldName)
        {
            var normalized = (value ?? string.Empty).Trim().ToLowerInvariant();
            if (normalized.Length > 0 && !Regex.IsMatch(normalized, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
                throw new ArgumentException($"{fieldName} 必须是64位十六进制 SHA-256。", fieldName);
            return normalized;
        }

        private static JObject GetMcpOperator(object currentToken)
        {
            try
            {
                if (currentToken is CurrentToken typedToken)
                    return typedToken.CurrentUser ?? new JObject();
                if (currentToken == null) return new JObject();

                JObject tokenObject = currentToken as JObject ?? JObject.FromObject(currentToken);
                JToken currentUserToken = tokenObject["CurrentUser"];
                if (currentUserToken is JObject currentUser) return currentUser;
                return currentUserToken == null || currentUserToken.Type == JTokenType.Null
                    ? new JObject()
                    : JObject.FromObject(currentUserToken);
            }
            catch
            {
                return new JObject();
            }
        }

        private static DosResult<object> ValidateStreamPublishOperator(
            object currentToken,
            string osClient,
            string action,
            string resource)
        {
            JObject currentUser = GetMcpOperator(currentToken);
            string userId = SafeJString(currentUser, "Id", SafeJString(currentUser, "UserId"));
            int roleLevel = SafeJInt(currentUser, "Level");
            object Diagnostic(string reasonCode, string rule) => new
            {
                ReasonCode = reasonCode,
                CurrentUserId = userId,
                RoleLevel = roleLevel,
                Action = action,
                Resource = resource,
                Rule = rule,
                OsClient = osClient
            };
            if (roleLevel < DiyCommon.MaxRoleLevel)
                return new DosResult<object>(0, Diagnostic("ROLE_LEVEL_DENIED", $"RoleLevel >= {DiyCommon.MaxRoleLevel}"), "仅平台超级管理员可以发布应用资产。");
            if (UserAccessKeySecurity.IsSession(currentUser))
                return new DosResult<object>(0, Diagnostic("ACCESS_KEY_SESSION_DENIED", "InteractiveAdminSessionRequired"), "访问密钥会话不能发布应用资产。");
            return null;
        }

        private static IMicroiHDFS ResolveApplicationAssetHdfs(string osClient, out OsClientSecret clientModel)
        {
            clientModel = OsClientExtend.GetClient(osClient);
            if (clientModel?.OsClientModel == null) throw new InvalidOperationException("当前租户 HDFS 配置不可用。");
            var hdfs = NormalizeApplicationAssetHdfsType((object)clientModel.OsClientModel);
            return hdfs switch
            {
                "MinIO" => MicroiEngine.HDFSFactory(HDFSType.MinIO),
                "S3" => MicroiEngine.HDFSFactory(HDFSType.AmazonS3),
                _ => MicroiEngine.HDFSFactory(HDFSType.Aliyun)
            };
        }

        /// <summary>
        /// Normalize the tenant HDFS selector at the object boundary before reading
        /// any JToken value. The explicit object/JObject conversion is intentional:
        /// invoking Val&lt;T&gt; on a dynamically-bound JValue is not supported by the
        /// C# runtime binder and previously aborted the first streamed asset upload.
        /// Public for a focused rolling-upgrade regression test.
        /// </summary>
        public static string NormalizeApplicationAssetHdfsType(object tenantConfig)
        {
            if (tenantConfig == null) return "Aliyun";
            var config = tenantConfig as JObject ?? JObject.FromObject(tenantConfig);
            return SafeJString(config, "HDFS", "Aliyun");
        }

        private static string Sha256Hex(string value)
        {
            using var sha256 = SHA256.Create();
            return BitConverter.ToString(sha256.ComputeHash(Encoding.UTF8.GetBytes(value ?? string.Empty)))
                .Replace("-", string.Empty)
                .ToLowerInvariant();
        }

        /// <summary>
        /// Existing production tables already have a primary key, while legacy
        /// duplicate business rows can prevent adding a broad unique index. Use
        /// a deterministic platform-standard 36-character key so concurrent
        /// nodes still converge on one insert without widening the established
        /// mci_ai_app_file / mci_ai_app_version / sys_microiservice primary-key columns.
        /// </summary>
        public static string BuildApplicationStreamRecordId(
            string recordType,
            string osClient,
            string appId,
            string businessKey)
        {
            var normalizedType = (recordType ?? string.Empty).Trim().ToLowerInvariant();
            var prefix = normalizedType switch
            {
                "file" => "mciaf-",
                "version" => "mciav-",
                "microservice" => "mcims-",
                "upload" => "mciau-",
                _ => throw new ArgumentException("recordType 只支持 file、version 或 microservice。", nameof(recordType))
            };
            if (string.IsNullOrWhiteSpace(osClient)) throw new ArgumentException("OsClient 不能为空。", nameof(osClient));
            if (string.IsNullOrWhiteSpace(appId)) throw new ArgumentException("AppId 不能为空。", nameof(appId));
            if (string.IsNullOrWhiteSpace(businessKey)) throw new ArgumentException("业务键不能为空。", nameof(businessKey));
            var seed = string.Join(
                "\n",
                normalizedType,
                osClient.Trim().ToLowerInvariant(),
                appId.Trim(),
                businessKey.Trim());
            // Both metadata tables define Id as varchar(36). Keep the readable
            // six-character type prefix and 120 bits of SHA-256 entropy.
            return prefix + Sha256Hex(seed).Substring(0, 30);
        }

        private static async Task<string> Sha256HexAsync(Stream stream, CancellationToken cancellationToken)
        {
            if (!stream.CanSeek) throw new InvalidOperationException("应用资产上传流必须可定位，才能在写入前校验 SHA-256。");
            stream.Position = 0;
            using var sha256 = SHA256.Create();
            var buffer = new byte[128 * 1024];
            int read;
            while ((read = await stream.ReadAsync(buffer, 0, buffer.Length, cancellationToken).ConfigureAwait(false)) > 0)
            {
                sha256.TransformBlock(buffer, 0, read, null, 0);
            }
            sha256.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
            stream.Position = 0;
            return BitConverter.ToString(sha256.Hash ?? Array.Empty<byte>())
                .Replace("-", string.Empty)
                .ToLowerInvariant();
        }

        private static ApplicationAssetPaths BuildApplicationAssetPaths(
            string osClient,
            string appKey,
            string applicationType,
            string versionNo,
            string relativePath,
            string sha256)
        {
            var tenant = TenantConfigurationSecurity.NormalizeTenantId(osClient).ToLowerInvariant();
            var isMicroService = string.Equals(applicationType, "MicroService", StringComparison.OrdinalIgnoreCase);
            var root = $"{tenant}/{(isMicroService ? "micro-app" : "ai-app-publish")}/{appKey}";
            var versionRoot = isMicroService
                ? $"{root}/{versionNo}"
                : $"{root}/versions/{versionNo}";
            var pathHash = Sha256Hex(relativePath).Substring(0, 24);
            return new ApplicationAssetPaths
            {
                VersionPath = $"{versionRoot}/{relativePath}",
                RootPath = $"{root}/{relativePath}",
                LatestPath = $"{root}/latest/{relativePath}",
                IntegrityMarkerPath = $"{versionRoot}/.microi-integrity/{pathHash}-{sha256}.ok"
            };
        }

        private static byte[] BuildApplicationAssetIntegrityMarker(
            string appKey,
            string versionNo,
            string relativePath,
            string sha256,
            long size,
            string requestId)
        {
            return Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(new
            {
                AppKey = appKey,
                VersionNo = versionNo,
                RelativePath = relativePath,
                Sha256 = sha256,
                Size = size,
                RequestId = requestId
            }));
        }

        /// <summary>
        /// Validate the marker body instead of treating object existence as proof.
        /// RequestId is audit metadata and may be absent on rolling-upgrade legacy
        /// markers; immutable identity is AppKey/version/path/size/hash.
        /// </summary>
        public static string ValidateApplicationAssetIntegrityMarker(
            byte[] markerBytes,
            string appKey,
            string versionNo,
            string relativePath,
            string sha256,
            long size)
        {
            if (markerBytes == null || markerBytes.Length == 0) return "完整性标记为空";
            JObject marker;
            try
            {
                marker = JObject.Parse(Encoding.UTF8.GetString(markerBytes));
            }
            catch
            {
                return "完整性标记不是有效 JSON";
            }

            if (!string.Equals(SafeJString(marker, "AppKey"), appKey, StringComparison.Ordinal))
                return "完整性标记 AppKey 不一致";
            if (!string.Equals(SafeJString(marker, "VersionNo"), versionNo, StringComparison.Ordinal))
                return "完整性标记 VersionNo 不一致";
            if (!string.Equals(SafeJString(marker, "RelativePath"), relativePath, StringComparison.Ordinal))
                return "完整性标记 RelativePath 不一致";
            if (!string.Equals(SafeJString(marker, "Sha256"), sha256, StringComparison.OrdinalIgnoreCase))
                return "完整性标记 SHA-256 不一致";
            if ((marker["Size"]?.Val<long?>() ?? -1L) != size)
                return "完整性标记 Size 不一致";

            var markerRequestId = SafeJString(marker, "RequestId");
            if (!markerRequestId.DosIsNullOrWhiteSpace())
            {
                try { NormalizeApplicationAssetRequestId(markerRequestId); }
                catch (ArgumentException) { return "完整性标记 RequestId 不合法"; }
            }
            return null;
        }

        private static async Task<(bool Exists, DosResult Error)> ApplicationObjectExists(
            IMicroiHDFS hdfs,
            OsClientSecret clientModel,
            string path)
        {
            var result = await hdfs.ObjectExist(new HDFSParam
            {
                ClientModel = clientModel,
                Limit = false,
                FileFullPath = path
            }).ConfigureAwait(false);
            return result.Code == 1
                ? (result.Data, null)
                : (false, new DosResult(0, null, result.Msg));
        }

        private static async Task<byte[]> ReadApplicationObjectBytes(
            IMicroiHDFS hdfs,
            OsClientSecret clientModel,
            string path)
        {
            // Finalization already resolved the tenant provider and immutable
            // client model once. Calling the high-level DiyUpload facade here
            // would repeat sys_config/FormEngine/V8 work for every byte read and
            // would put non-storage state inside the parallel region.
            // IMicroiHDFS currently exposes provider readback as ReturnFileType
            // "Byte" only; the OSS/MinIO/S3 adapters buffer before returning.
            // Until that interface gains a cancellable streaming/hash contract,
            // callers must hold the process-wide declared-byte budget for the
            // whole read/validate operation and verify bytes.Length immediately.
            var result = await hdfs.GetPrivateFileUrl(new HDFSParam
            {
                ClientModel = clientModel,
                Limit = false,
                FileFullPath = path,
                ReturnFileType = "Byte",
                NetworkIsInternet = false
            }).ConfigureAwait(false);
            if (result.Code != 1 || result.Data == null) return null;
            if (result.Data is byte[] bytes) return bytes;
            return Encoding.UTF8.GetBytes(Convert.ToString(result.Data));
        }

        private static async Task<DosResult> PutApplicationObject(
            IMicroiHDFS hdfs,
            OsClientSecret clientModel,
            string path,
            Stream stream,
            long? contentLength = null,
            CancellationToken cancellationToken = default)
        {
            if (stream.CanSeek) stream.Position = 0;
            var effectiveContentLength = contentLength
                                         ?? (stream.CanSeek ? stream.Length : (long?)null);
            return await hdfs.PutObject(new HDFSParam
            {
                ClientModel = clientModel,
                Limit = false,
                FileFullPath = path,
                FileStream = stream,
                ContentLength = effectiveContentLength,
                // Application assets at or above the native multipart boundary
                // are durable publishing operations, not ordinary form uploads.
                // Give the object-store operation the existing two-hour HDFS
                // ceiling while retaining the normal 60-second behavior for
                // small files. This remains a per-operation transport choice;
                // it does not introduce another production configuration source.
                TimeoutSeconds = effectiveContentLength >= 64L * 1024 * 1024
                    ? 7200
                    : (int?)null,
                CancellationToken = cancellationToken
            }).ConfigureAwait(false);
        }

        private static async Task<DosResult> CopyApplicationObject(
            IMicroiHDFS hdfs,
            OsClientSecret clientModel,
            string source,
            string destination)
        {
            return await hdfs.CopyObject(new HDFSParam
            {
                ClientModel = clientModel,
                Limit = false,
                FileFullPath = source,
                DestPath = destination
            }).ConfigureAwait(false);
        }

        /// <summary>
        /// Every mutable HDFS/Redis-quota/database side effect in streamed
        /// publishing is fenced by an ownership check both before and after the
        /// call. A lost lease is therefore fail-closed and cannot be reported as
        /// a successful delivery.
        /// </summary>
        private static async Task<T> ExecuteApplicationAssetSideEffect<T>(
            IMicroiLockLease lease,
            Func<Task<T>> action)
        {
            if (lease == null) throw new InvalidOperationException("应用资产发布缺少分布式租约上下文");
            if (action == null) throw new ArgumentNullException(nameof(action));
            await lease.EnsureHeldAsync().ConfigureAwait(false);
            var result = await action().ConfigureAwait(false);
            await lease.EnsureHeldAsync().ConfigureAwait(false);
            return result;
        }

        /// <summary>
        /// Lease ownership is advisory around a remote database call; it is not a
        /// database compare-and-swap. Mutable publish facts therefore use an
        /// atomic UPDATE ... WHERE over the exact snapshot read by this owner and
        /// require exactly one affected row. A former owner that resumes after a
        /// lease expiry cannot overwrite a newer owner's state.
        /// </summary>
        private static async Task<DosResult> ExecuteApplicationAssetConditionalUpdate(
            string osClient,
            string tableName,
            JObject rowModel,
            object where,
            IMicroiLockLease lease,
            string operationName)
        {
            if (rowModel == null) return new DosResult(0, null, operationName + "缺少更新数据");
            if (where == null) return new DosResult(0, null, operationName + "缺少原子条件");
            var safeRowModel = (JObject)rowModel.DeepClone();
            // Identity belongs in the WHERE predicate. Never ask the generic
            // FormEngine update-by-where path to rewrite a primary key/tenant.
            safeRowModel.Remove("Id");
            safeRowModel.Remove("OsClient");
            var param = new DiyTableRowParam
            {
                OsClient = osClient,
                FormEngineKey = tableName,
                _InvokeType = InvokeType.Server.ToString(),
                _TrustedServerInvocation = true,
                _Where = where,
                _RowModel = safeRowModel
            };
            var result = await ExecuteApplicationAssetSideEffect(
                lease,
                () => MicroiEngine.FormEngine.UptFormDataByWhereAsync(
                    tableName,
                    param)).ConfigureAwait(false);
            if (result.Code != 1) return result;
            if (result.DataCount != 1)
            {
                return new DosResult(
                    0,
                    result.Data,
                    $"{operationName}的原子条件已失效，ExpectedAffected=1，ActualAffected={result.DataCount ?? 0}",
                    result.DataCount);
            }
            return result;
        }

        public static string ValidateApplicationStreamIdentity(
            JObject app,
            string expectedAppId,
            string expectedAppKey)
        {
            if (app == null) return "应用元数据不存在";
            var actualAppId = SafeJString(app, "Id");
            if (actualAppId.DosIsNullOrWhiteSpace()) return "应用元数据缺少不可变 Id";
            if (!string.Equals(actualAppId, expectedAppId, StringComparison.Ordinal))
                return $"应用 Id 已漂移：Expected={expectedAppId}，Actual={actualAppId}";
            string actualAppKey;
            try
            {
                actualAppKey = NormalizeMicroServiceKey(SafeJString(app, "AppKey", SafeJString(app, "AppId")));
            }
            catch (Exception ex)
            {
                return "应用 AppKey 不合法：" + ex.Message;
            }
            if (!string.Equals(actualAppKey, expectedAppKey, StringComparison.Ordinal))
                return $"应用 AppKey 已漂移：Expected={expectedAppKey}，Actual={actualAppKey}";
            return null;
        }

        private static string ValidateApplicationStreamExistingRecordId(
            JObject row,
            string recordName)
        {
            return row != null && SafeJString(row, "Id").DosIsNullOrWhiteSpace()
                ? $"既有{recordName}记录缺少 Id，已在任何发布副作用前拒绝继续"
                : null;
        }

        public static string ValidateApplicationStreamFinalizePreconditions(JObject param)
        {
            if (param == null) return "发布清单不能为空";
            if (param.Property("ExpectedCurrentVersion") == null)
                return "finalize 必须提供 ExpectedCurrentVersion；stage 上传不受此约束";
            if (param.Property("ExpectedAppVersion") == null)
                return "finalize 必须提供 ExpectedAppVersion（无版本时显式传 null）；stage 上传不受此约束";
            return null;
        }

        private static List<object> BuildApplicationStreamAppSnapshotWhere(
            JObject app,
            string expectedAppId,
            string expectedAppKey)
        {
            return new List<object>
            {
                new List<object> { "Id", "=", expectedAppId },
                new List<object> { "AND", "AppKey", "=", expectedAppKey },
                new List<object> { "AND", "ApplicationType", "=", CloneToken(app?["ApplicationType"]) },
                new List<object> { "AND", "CurrentVersion", "=", CloneToken(app?["CurrentVersion"]) },
                new List<object> { "AND", "AppVersion", "=", CloneToken(app?["AppVersion"]) },
                new List<object> { "AND", "Status", "=", CloneToken(app?["Status"]) },
                new List<object> { "AND", "PublicPublishPath", "=", CloneToken(app?["PublicPublishPath"]) },
                new List<object> { "AND", "LastBuildTaskId", "=", CloneToken(app?["LastBuildTaskId"]) }
            };
        }

        public static long GetApplicationAssetReadBudgetReservationBytes(long declaredBytes)
        {
            if (declaredBytes < 0)
                throw new ArgumentOutOfRangeException(nameof(declaredBytes), "声明字节数不能小于0。");
            var units = declaredBytes <= 0
                ? 1L
                : declaredBytes >= MaxStreamPublishReadInFlightBytes
                    ? StreamPublishReadBudgetUnits
                    : ((declaredBytes - 1L) / StreamPublishReadBudgetUnitBytes) + 1L;
            return units * StreamPublishReadBudgetUnitBytes;
        }

        private static async Task<IDisposable> AcquireApplicationAssetReadBudgetAsync(
            long declaredBytes,
            CancellationToken cancellationToken)
        {
            var reservationBytes = GetApplicationAssetReadBudgetReservationBytes(declaredBytes);
            var requestedUnits = checked((int)(reservationBytes / StreamPublishReadBudgetUnitBytes));
            var acquiredUnits = 0;

            // Serializing weighted allocation prevents two large readers from
            // each holding a partial token set and deadlocking. A max-size file
            // reserves every unit and therefore runs alone across all finalize
            // requests in this process.
            await ApplicationAssetReadBudgetAllocation.WaitAsync(cancellationToken).ConfigureAwait(false);
            try
            {
                while (acquiredUnits < requestedUnits)
                {
                    await ApplicationAssetReadBudgetUnits.WaitAsync(cancellationToken).ConfigureAwait(false);
                    acquiredUnits++;
                }
            }
            catch
            {
                if (acquiredUnits > 0) ApplicationAssetReadBudgetUnits.Release(acquiredUnits);
                throw;
            }
            finally
            {
                ApplicationAssetReadBudgetAllocation.Release();
            }

            return new ApplicationAssetReadBudgetLease(requestedUnits);
        }

        /// <summary>
        /// Run storage-only work through a small fixed worker pool and, when a
        /// byte selector is supplied, a process-wide weighted byte budget shared
        /// by concurrent finalize requests. Declared bytes are trusted only after
        /// the immutable integrity marker and actual byte length are checked by
        /// the operation. The first failure cancels the shared token and stops
        /// workers from claiming more items; already-started work is awaited
        /// before the caller can continue to metadata commits.
        /// Public so focused contract tests can prove the cap and fail-fast rule
        /// without reaching a real tenant storage service.
        /// </summary>
        public static async Task<string> RunApplicationAssetBoundedParallelAsync<T>(
            IReadOnlyList<T> items,
            Func<T, CancellationToken, Task<string>> operation,
            CancellationToken cancellationToken = default,
            int? maxDegreeOfParallelism = null,
            Func<T, long> declaredByteSize = null)
        {
            if (items == null) throw new ArgumentNullException(nameof(items));
            if (operation == null) throw new ArgumentNullException(nameof(operation));
            if (items.Count == 0) return null;

            var requestedConcurrency = maxDegreeOfParallelism ?? DefaultStreamPublishIoConcurrency;
            if (requestedConcurrency <= 0)
                throw new ArgumentOutOfRangeException(nameof(maxDegreeOfParallelism), "并发度必须大于0。");
            var workerCount = Math.Min(
                items.Count,
                Math.Min(requestedConcurrency, MaxStreamPublishIoConcurrency));
            using var linkedCancellation = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            var nextIndex = -1;
            string firstFailure = null;

            void StopOnFirstFailure(string failure)
            {
                if (string.IsNullOrWhiteSpace(failure)) failure = "有界并行操作失败";
                if (Interlocked.CompareExchange(ref firstFailure, failure, null) != null) return;
                try { linkedCancellation.Cancel(); }
                catch (AggregateException) { /* The first storage failure remains authoritative. */ }
            }

            async Task WorkerLoop()
            {
                while (!linkedCancellation.IsCancellationRequested)
                {
                    var index = Interlocked.Increment(ref nextIndex);
                    if (index >= items.Count) return;
                    IDisposable byteBudgetLease = null;
                    try
                    {
                        if (declaredByteSize != null)
                        {
                            byteBudgetLease = await AcquireApplicationAssetReadBudgetAsync(
                                declaredByteSize(items[index]),
                                linkedCancellation.Token).ConfigureAwait(false);
                        }
                        var failure = await operation(items[index], linkedCancellation.Token).ConfigureAwait(false);
                        if (!string.IsNullOrWhiteSpace(failure)) StopOnFirstFailure(failure);
                    }
                    catch (OperationCanceledException) when (linkedCancellation.IsCancellationRequested)
                    {
                        return;
                    }
                    catch (Exception ex)
                    {
                        StopOnFirstFailure("有界并行操作异常：" + ex.Message);
                    }
                    finally
                    {
                        byteBudgetLease?.Dispose();
                    }
                }
            }

            // Aliyun's current CopyObject adapter is synchronously blocking even
            // though it returns Task. Starting each bounded worker on the pool is
            // required for the same concurrency contract across OSS/MinIO/S3.
            var workers = Enumerable.Range(0, workerCount)
                .Select(_ => Task.Run(WorkerLoop, CancellationToken.None))
                .ToArray();
            await Task.WhenAll(workers).ConfigureAwait(false);
            cancellationToken.ThrowIfCancellationRequested();
            return firstFailure;
        }

        private static List<StreamPublishAliasTarget> BuildStreamPublishAliasTargets(
            IEnumerable<StreamPublishAsset> assets)
        {
            return (assets ?? Enumerable.Empty<StreamPublishAsset>())
                .SelectMany(asset => new[]
                {
                    new StreamPublishAliasTarget { Asset = asset, Path = asset.Paths.RootPath },
                    new StreamPublishAliasTarget { Asset = asset, Path = asset.Paths.LatestPath }
                })
                .ToList();
        }

        public static string ValidateApplicationStreamFileMetadata(
            JObject row,
            string appId,
            string filePath,
            string contentHash,
            long size,
            string hdfsPath,
            string publishHdfsPath)
        {
            if (row == null) return "文件元数据不存在";
            if (!string.Equals(SafeJString(row, "AppId"), appId, StringComparison.Ordinal)) return "AppId 不一致";
            if (!string.Equals(SafeJString(row, "FilePath"), filePath, StringComparison.Ordinal)) return "FilePath 不一致";
            if (!string.Equals(SafeJString(row, "ContentHash"), contentHash, StringComparison.OrdinalIgnoreCase)) return "ContentHash 不一致";
            if ((row["Size"]?.Val<long?>() ?? -1L) != size) return "Size 不一致";
            if (!string.Equals(SafeJString(row, "HdfsPath"), hdfsPath, StringComparison.Ordinal)) return "HdfsPath 不一致";
            if (!string.Equals(SafeJString(row, "PublishHdfsPath"), publishHdfsPath, StringComparison.Ordinal)) return "PublishHdfsPath 不一致";
            if (!string.Equals(SafeJString(row, "StorageScope"), ActiveStreamBuildStorageScope, StringComparison.Ordinal)) return "StorageScope 不一致";
            return null;
        }

        private static async Task<DosResult> UpsertStreamPublishedFile(
            string osClient,
            JObject app,
            StreamPublishAsset asset,
            IMicroiLockLease lease)
        {
            var appId = SafeJString(app, "Id");
            var filePath = "dist/" + asset.RelativePath;
            var existing = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("mci_ai_app_file", new
            {
                OsClient = osClient,
                _Where = new List<object>
                {
                    new List<object> { "AppId", "=", appId },
                    new List<object> { "AND", "FilePath", "=", filePath },
                    new List<object>
                    {
                        "AND", "StorageScope", "In",
                        new[] { ActiveStreamBuildStorageScope, ArchivedStreamBuildStorageScope }
                    }
                }
            }).ConfigureAwait(false);

            var row = new JObject
            {
                ["AppId"] = appId,
                ["AppName"] = SafeJString(app, "Name", SafeJString(app, "AppName")),
                ["FilePath"] = filePath,
                ["FileName"] = Path.GetFileName(asset.RelativePath),
                ["FileType"] = Path.GetExtension(asset.RelativePath).TrimStart('.').ToLowerInvariant(),
                ["HdfsPath"] = asset.Paths.VersionPath,
                ["PublishHdfsPath"] = asset.Paths.RootPath,
                // Re-publishing a path that was reversibly archived promotes the
                // same stream-owned row back into the active build scope.
                ["StorageScope"] = ActiveStreamBuildStorageScope,
                ["ContentHash"] = asset.Sha256,
                ["Size"] = asset.Size,
                ["IsDirectory"] = 0,
                ["Version"] = 1
            };

            if (existing.Code != 1 && existing.Code != 2)
                return new DosResult(existing.Code, (object)existing.Data, "读取既有发布文件元数据失败：" + existing.Msg);
            if (existing.Code == 1 && existing.Data != null)
            {
                var old = JObject.FromObject((object)existing.Data);
                var existingIdError = ValidateApplicationStreamExistingRecordId(old, "发布文件元数据");
                if (existingIdError != null) return new DosResult(0, null, existingIdError);
                var oldId = SafeJString(old, "Id");
                var oldVersion = Math.Max(1, SafeJInt(old, "Version", 1));
                row["Id"] = oldId;
                // Even an exact replay advances the row revision through CAS.
                // This is the durable "current manifest claimed this path" fence;
                // otherwise a stale archive plan could still match an unchanged
                // active row after a newer publish had legitimately reused it.
                row["Version"] = oldVersion + 1;

                var updateResult = await ExecuteApplicationAssetConditionalUpdate(
                    osClient,
                    "mci_ai_app_file",
                    row,
                    new List<object>
                    {
                        new List<object> { "Id", "=", oldId },
                        new List<object> { "AND", "AppId", "=", appId },
                        new List<object> { "AND", "FilePath", "=", filePath },
                        new List<object> { "AND", "StorageScope", "=", SafeJString(old, "StorageScope") },
                        new List<object> { "AND", "Version", "=", oldVersion }
                    },
                    lease,
                    "更新发布文件元数据").ConfigureAwait(false);
                if (updateResult.Code == 1) return updateResult;

                var afterConflict = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("mci_ai_app_file", new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "Id", "=", oldId },
                        new List<object> { "AND", "AppId", "=", appId },
                        new List<object> { "AND", "FilePath", "=", filePath }
                    }
                }).ConfigureAwait(false);
                if (afterConflict.Code == 1 && afterConflict.Data != null)
                {
                    var conflictRow = JObject.FromObject((object)afterConflict.Data);
                    var conflict = ValidateApplicationStreamFileMetadata(
                        conflictRow,
                        appId,
                        filePath,
                        asset.Sha256,
                        asset.Size,
                        asset.Paths.VersionPath,
                        asset.Paths.RootPath);
                    if (conflict == null)
                        return new DosResult(1, conflictRow, "发布文件元数据已由当前请求的其它持有者幂等收敛");
                }
                return updateResult;
            }

            row["Id"] = BuildApplicationStreamRecordId("file", osClient, appId, filePath);
            var addResult = await ExecuteApplicationAssetSideEffect(
                lease,
                () => MicroiEngine.FormEngine.AddFormDataAsync(
                    "mci_ai_app_file",
                    BuildTrustedMcpFormWriteParam(osClient, row))).ConfigureAwait(false);
            if (addResult.Code == 1) return addResult;

            // A concurrent node may have inserted the same deterministic primary
            // key after our pre-read. Re-read by the business key and only accept
            // an exact content/path match; a hash collision or divergent publish
            // fails closed and preserves the winning row.
            var concurrent = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("mci_ai_app_file", new
            {
                OsClient = osClient,
                _Where = new List<object>
                {
                    new List<object> { "AppId", "=", appId },
                    new List<object> { "AND", "FilePath", "=", filePath },
                    new List<object>
                    {
                        "AND", "StorageScope", "In",
                        new[] { ActiveStreamBuildStorageScope, ArchivedStreamBuildStorageScope }
                    }
                }
            }).ConfigureAwait(false);
            if (concurrent.Code == 1 && concurrent.Data != null)
            {
                var concurrentRow = JObject.FromObject((object)concurrent.Data);
                var conflict = ValidateApplicationStreamFileMetadata(
                    concurrentRow,
                    appId,
                    filePath,
                    asset.Sha256,
                    asset.Size,
                    asset.Paths.VersionPath,
                    asset.Paths.RootPath);
                if (conflict == null)
                    return new DosResult(1, (object)concurrent.Data, "并发文件元数据已按确定性主键幂等收敛");
                return new DosResult(0, (object)concurrent.Data, "并发文件元数据冲突，拒绝覆盖：" + conflict);
            }
            return new DosResult(addResult.Code, addResult.Data,
                "新增发布文件元数据失败，且未回读到相同业务键：" + addResult.Msg);
        }

        /// <summary>
        /// Build the reversible archive patch set for stream-owned public build
        /// metadata. Private/source rows and non-dist paths are intentionally
        /// outside this operation. Returning patches instead of mutating the
        /// supplied rows keeps retries deterministic and makes the boundary
        /// independently testable without a tenant database.
        /// </summary>
        public static IReadOnlyList<JObject> BuildApplicationStreamArchiveUpdates(
            IEnumerable<JObject> existingRows,
            IEnumerable<string> currentFilePaths)
        {
            if (existingRows == null) throw new ArgumentNullException(nameof(existingRows));
            if (currentFilePaths == null) throw new ArgumentNullException(nameof(currentFilePaths));

            var currentPaths = new HashSet<string>(
                currentFilePaths.Where(path => !string.IsNullOrWhiteSpace(path)),
                StringComparer.OrdinalIgnoreCase);
            var archivedIds = new HashSet<string>(StringComparer.Ordinal);
            var updates = new List<JObject>();
            foreach (var row in existingRows
                         .Where(item => item != null)
                         .OrderBy(item => SafeJString(item, "FilePath"), StringComparer.Ordinal)
                         .ThenBy(item => SafeJString(item, "Id"), StringComparer.Ordinal))
            {
                if (!string.Equals(
                        SafeJString(row, "StorageScope"),
                        ActiveStreamBuildStorageScope,
                        StringComparison.Ordinal))
                {
                    continue;
                }

                var filePath = SafeJString(row, "FilePath");
                if (!filePath.StartsWith("dist/", StringComparison.OrdinalIgnoreCase)
                    || currentPaths.Contains(filePath))
                {
                    continue;
                }

                var id = SafeJString(row, "Id");
                if (id.DosIsNullOrWhiteSpace())
                    throw new InvalidOperationException("待归档的流式发布文件元数据缺少 Id：" + filePath);
                var appId = SafeJString(row, "AppId");
                if (appId.DosIsNullOrWhiteSpace())
                    throw new InvalidOperationException("待归档的流式发布文件元数据缺少 AppId：" + filePath);
                if (!archivedIds.Add(id)) continue;

                var previousVersion = Math.Max(1, SafeJInt(row, "Version", 1));

                updates.Add(new JObject
                {
                    ["Id"] = id,
                    ["AppId"] = appId,
                    ["FilePath"] = filePath,
                    ["PreviousStorageScope"] = ActiveStreamBuildStorageScope,
                    ["PreviousVersion"] = previousVersion,
                    ["StorageScope"] = ArchivedStreamBuildStorageScope,
                    ["Version"] = previousVersion + 1
                });
            }
            return updates;
        }

        public static string ValidateApplicationStreamExistingFileRows(
            IEnumerable<JObject> rows,
            string expectedAppId)
        {
            if (rows == null) return "既有发布文件元数据清单不存在";
            var businessKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var row in rows.Where(item => item != null))
            {
                var idError = ValidateApplicationStreamExistingRecordId(row, "发布文件元数据");
                if (idError != null) return idError;
                var appId = SafeJString(row, "AppId");
                if (!string.Equals(appId, expectedAppId, StringComparison.Ordinal))
                    return $"既有发布文件元数据 AppId 不一致：Expected={expectedAppId}，Actual={appId}";
                var filePath = SafeJString(row, "FilePath");
                if (filePath.DosIsNullOrWhiteSpace()) return "既有发布文件元数据缺少 FilePath";
                if (!businessKeys.Add(filePath))
                    return "同一 AppId 存在重复的流式发布文件业务键，拒绝非确定性更新：" + filePath;
            }
            return null;
        }

        private static async Task<(List<JObject> Rows, DosResult Error)> ReadApplicationStreamFileRows(
            string osClient,
            string appId,
            IMicroiLockLease lease,
            CancellationToken cancellationToken)
        {
            var rows = new List<JObject>();
            for (var pageIndex = 1; ; pageIndex++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                await lease.EnsureHeldAsync().ConfigureAwait(false);
                var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("mci_ai_app_file", new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "AppId", "=", appId },
                        new List<object>
                        {
                            "AND", "StorageScope", "In",
                            new[] { ActiveStreamBuildStorageScope, ArchivedStreamBuildStorageScope }
                        },
                        new List<object> { "AND", "FilePath", "StartLike", "dist/" }
                    },
                    _SelectFields = new[]
                    {
                        "Id", "AppId", "FilePath", "StorageScope", "Version",
                        "ContentHash", "Size", "HdfsPath", "PublishHdfsPath"
                    },
                    _OrderBy = "Id",
                    _OrderByType = "ASC",
                    _PageIndex = pageIndex,
                    _PageSize = StreamBuildMetadataPageSize
                }).ConfigureAwait(false);
                await lease.EnsureHeldAsync().ConfigureAwait(false);
                if (result.Code != 1)
                {
                    return (rows, new DosResult(
                        result.Code,
                        (object)result.Data,
                        "读取既有流式发布文件元数据失败：" + result.Msg));
                }

                var page = result.Data == null ? new JArray() : JArray.FromObject((object)result.Data);
                if (page.Count == 0) break;
                var beforeCount = rows.Count;
                foreach (var token in page)
                {
                    if (token is JObject row) rows.Add(row);
                }
                if (rows.Count == beforeCount)
                    return (rows, new DosResult(0, null, "流式发布文件元数据分页未取得有效记录"));
                if (page.Count < StreamBuildMetadataPageSize) break;
            }

            var validationError = ValidateApplicationStreamExistingFileRows(rows, appId);
            return validationError == null
                ? (rows, null)
                : (rows, new DosResult(0, null, validationError));
        }

        /// <summary>
        /// Reconcile current stream metadata under the renewable application
        /// publish lease. New/current paths are upserted first (which restores a
        /// previously archived path), then obsolete active dist rows are moved
        /// into a reversible non-active scope. Any read, write, or readback
        /// failure aborts before version/application terminal metadata commits.
        /// </summary>
        private static async Task<DosResult> ReconcileStreamPublishedFiles(
            string osClient,
            JObject app,
            IReadOnlyList<StreamPublishAsset> assets,
            IMicroiLockLease lease,
            CancellationToken cancellationToken)
        {
            if (app == null) return new DosResult(0, null, "应用元数据不能为空");
            if (assets == null) return new DosResult(0, null, "发布资产清单不能为空");
            var appId = SafeJString(app, "Id");
            if (appId.DosIsNullOrWhiteSpace()) return new DosResult(0, null, "应用 Id 不能为空");

            // Validate every existing stream-owned record before the first upsert.
            // This prevents a malformed legacy row from being discovered only
            // after partial DB work has already been committed.
            var existingRowsResult = await ReadApplicationStreamFileRows(
                osClient,
                appId,
                lease,
                cancellationToken).ConfigureAwait(false);
            if (existingRowsResult.Error != null) return existingRowsResult.Error;

            foreach (var asset in assets)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var metadataResult = await UpsertStreamPublishedFile(
                    osClient,
                    app,
                    asset,
                    lease).ConfigureAwait(false);
                if (metadataResult.Code != 1)
                {
                    return new DosResult(
                        metadataResult.Code,
                        metadataResult.Data,
                        "保存发布文件元数据失败：" + metadataResult.Msg);
                }
            }

            // Work from the immutable preflight snapshot. Upserts above may
            // reactivate a current path, but those paths are excluded from the
            // stale plan; obsolete paths retain their exact old Version/scope and
            // the atomic archive CAS below detects any concurrent change.
            var activeRows = existingRowsResult.Rows
                .Where(row => string.Equals(
                    SafeJString(row, "StorageScope"),
                    ActiveStreamBuildStorageScope,
                    StringComparison.Ordinal))
                .ToList();

            IReadOnlyList<JObject> archiveUpdates;
            try
            {
                archiveUpdates = BuildApplicationStreamArchiveUpdates(
                    activeRows,
                    assets.Select(asset => "dist/" + asset.RelativePath));
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "生成旧发布资产归档计划失败：" + ex.Message);
            }

            foreach (var update in archiveUpdates)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var archiveId = SafeJString(update, "Id");
                var archiveAppId = SafeJString(update, "AppId");
                var archiveFilePath = SafeJString(update, "FilePath");
                var previousStorageScope = SafeJString(update, "PreviousStorageScope");
                var previousVersion = SafeJInt(update, "PreviousVersion");
                var archiveRow = new JObject
                {
                    ["StorageScope"] = ArchivedStreamBuildStorageScope,
                    ["Version"] = SafeJInt(update, "Version")
                };
                var archiveResult = await ExecuteApplicationAssetConditionalUpdate(
                    osClient,
                    "mci_ai_app_file",
                    archiveRow,
                    new List<object>
                    {
                        new List<object> { "Id", "=", archiveId },
                        new List<object> { "AND", "AppId", "=", archiveAppId },
                        new List<object> { "AND", "FilePath", "=", archiveFilePath },
                        new List<object> { "AND", "StorageScope", "=", previousStorageScope },
                        new List<object> { "AND", "Version", "=", previousVersion }
                    },
                    lease,
                    "归档旧发布资产元数据").ConfigureAwait(false);
                if (archiveResult.Code != 1)
                {
                    return new DosResult(
                        archiveResult.Code,
                        archiveResult.Data,
                        "归档旧发布资产元数据失败，已拒绝提交终态：" + archiveResult.Msg);
                }

                // Fail closed if events, compatibility code, or a concurrent
                // external writer prevented the intended scope transition.
                await lease.EnsureHeldAsync().ConfigureAwait(false);
                var archivedReadback = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("mci_ai_app_file", new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "Id", "=", SafeJString(update, "Id") },
                        new List<object> { "AND", "AppId", "=", appId },
                        new List<object> { "AND", "FilePath", "=", archiveFilePath }
                    },
                    _SelectFields = new[] { "Id", "AppId", "FilePath", "StorageScope", "Version" }
                }).ConfigureAwait(false);
                await lease.EnsureHeldAsync().ConfigureAwait(false);
                var archivedRow = archivedReadback.Code == 1 && archivedReadback.Data != null
                    ? JObject.FromObject((object)archivedReadback.Data)
                    : null;
                if (archivedReadback.Code != 1
                    || archivedReadback.Data == null
                    || !string.Equals(
                        SafeJString(archivedRow, "StorageScope"),
                        ArchivedStreamBuildStorageScope,
                        StringComparison.Ordinal)
                    || SafeJInt(archivedRow, "Version") != previousVersion + 1
                    || !string.Equals(SafeJString(archivedRow, "AppId"), archiveAppId, StringComparison.Ordinal)
                    || !string.Equals(SafeJString(archivedRow, "FilePath"), archiveFilePath, StringComparison.Ordinal))
                {
                    return new DosResult(
                        archivedReadback.Code == 1 ? 0 : archivedReadback.Code,
                        (object)archivedReadback.Data,
                        "旧发布资产归档后严格回读失败，已拒绝提交终态：" + archivedReadback.Msg);
                }
            }

            return new DosResult(1, new
            {
                ActiveAssetCount = assets.Count,
                ArchivedAssetCount = archiveUpdates.Count
            }, "发布文件元数据已完成 active/archived 对账");
        }

        /// <summary>
        /// Upload one immutable application-version asset from a multipart stream.
        /// The file is written once; stable aliases are promoted only by the
        /// metadata-only finalization call after the complete manifest exists.
        /// </summary>
        public static async Task<DosResult<object>> UploadApplicationAssetStream(
            string osClient,
            string appIdOrKey,
            string versionNo,
            string relativePath,
            string expectedSha256,
            string fileName,
            Stream fileStream,
            long contentLength,
            string requestId,
            object currentToken,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var operatorError = ValidateStreamPublishOperator(currentToken, osClient, "application-asset:upload", appIdOrKey);
                if (operatorError != null) return operatorError;
                if (IsBlank(osClient)) return new DosResult<object>(0, null, "OsClient 不能为空");
                if (fileStream == null) return new DosResult<object>(0, null, "未接收到应用资产文件流");

                // v2 remains available only while the authoritative tenant gate
                // is LegacyOpen. Read the primary database before app, quota,
                // Redis-lock or object-storage work; Drain/V3Only fail closed.
                var gateCoordinate = ResolveApplicationAssetStreamGateCoordinate(osClient);
                var gate = ReadApplicationAssetStreamGateStrong(
                    osClient,
                    gateCoordinate.OsClientType,
                    gateCoordinate.OsClientNetwork,
                    null,
                    false);
                var gateError = ValidateApplicationAssetStreamGate(gate, 2, null);
                if (gateError != null) return new DosResult<object>(0, null, gateError);

                relativePath = NormalizeApplicationAssetRelativePath(relativePath);
                versionNo = NormalizeApplicationAssetVersion(versionNo);
                expectedSha256 = (expectedSha256 ?? string.Empty).Trim().ToLowerInvariant();
                if (!Regex.IsMatch(expectedSha256, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
                    return new DosResult<object>(0, null, "ExpectedSha256 必须是64位小写十六进制 SHA-256");

                var safeFileName = Path.GetFileName((fileName ?? string.Empty).Replace('\u005c', '/'));
                if (!string.Equals(safeFileName, Path.GetFileName(relativePath), StringComparison.Ordinal))
                    return new DosResult<object>(0, null, "multipart 文件名必须与 RelativePath 的文件名一致");

                var app = await FindAiApplication(osClient, appIdOrKey).ConfigureAwait(false);
                if (app == null) return new DosResult<object>(2, null, "在线 AI 应用不存在");
                var appId = SafeJString(app, "Id");
                if (appId.DosIsNullOrWhiteSpace())
                    return new DosResult<object>(0, null, "既有应用记录缺少不可变 Id，拒绝上传资产");
                var appKey = NormalizeMicroServiceKey(SafeJString(app, "AppKey", SafeJString(app, "AppId")));
                if (IsBlank(appKey)) return new DosResult<object>(0, null, "应用 AppKey 不合法");
                // AppType 是官方/社区历史分类；运行形态只读取 ApplicationType。
                var applicationType = SafeJString(app, "ApplicationType", "Web");
                if (!new[] { "Web", "UniApp", "MicroService" }.Contains(applicationType, StringComparer.OrdinalIgnoreCase))
                    return new DosResult<object>(0, null, "流式发布仅支持 Web、UniApp 和 MicroService");
                requestId = ResolveApplicationAssetRequestId(
                    requestId,
                    "asset",
                    string.Join("\n", osClient, appKey, versionNo, relativePath, expectedSha256));

                if (!fileStream.CanSeek)
                    return new DosResult<object>(0, null, "当前 multipart 文件流不可定位，无法安全校验大小和 SHA-256");
                fileStream.Position = 0;
                var actualLength = fileStream.Length;
                if (contentLength > 0 && contentLength != actualLength)
                    return new DosResult<object>(0, null, "Content-Length 与实际文件长度不一致");
                if (actualLength > MaxStreamPublishFileBytes)
                    return new DosResult<object>(0, null,
                        $"单个应用资产不能超过 {MaxStreamPublishFileBytes} bytes（128MB）");

                var currentUser = GetMcpOperator(currentToken);
                var tenantUploadOptions = FileUploadSecurityOptions.Load(OsClientExtend.GetClient(osClient)?.OsClientModel);
                if (!tenantUploadOptions.UploadEnabled)
                {
                    var disabled = FileUploadSecurity.CreateTenantUploadDisabledResult(osClient);
                    return new DosResult<object>(disabled.Code, null, disabled.Msg, disabled.DataAppend);
                }
                // Strict readback currently materializes one object as byte[]. Keep
                // each immutable asset bounded so hash verification cannot turn a
                // declared multi-gigabyte payload into process-wide memory pressure.
                var uploadOptions = new FileUploadSecurityOptions
                {
                    MaxFileBytes = MaxStreamPublishFileBytes,
                    MaxTotalBytes = MaxStreamPublishFileBytes,
                    MaxFileCount = 1,
                    DailyUserQuotaBytes = ApplicationPublishDailyQuotaBytes,
                    DailyTenantQuotaBytes = ApplicationPublishDailyQuotaBytes,
                    UploadEnabled = true
                };
                var payload = new DiyUploadParam
                {
                    OsClient = osClient,
                    Limit = false,
                    Preview = false,
                    _CurrentUser = currentUser,
                    _InvokeType = InvokeType.Server.ToString(),
                    Files = new Dictionary<string, Stream> { [safeFileName] = fileStream }
                };
                var payloadError = FileUploadSecurity.ValidatePayload(payload, out var totalBytes, uploadOptions);
                if (payloadError != null) return new DosResult<object>(payloadError.Code, null, payloadError.Msg);

                var actualSha256 = await Sha256HexAsync(fileStream, cancellationToken).ConfigureAwait(false);
                if (!string.Equals(actualSha256, expectedSha256, StringComparison.Ordinal))
                    return new DosResult<object>(0, null, "上传文件 SHA-256 与 ExpectedSha256 不一致");

                var paths = BuildApplicationAssetPaths(osClient, appKey, applicationType, versionNo, relativePath, actualSha256);
                var hdfs = ResolveApplicationAssetHdfs(osClient, out var clientModel);
                var idempotent = false;
                var integrityMarkerRepaired = false;
                var markerBytes = BuildApplicationAssetIntegrityMarker(
                    appKey,
                    versionNo,
                    relativePath,
                    actualSha256,
                    actualLength,
                    requestId);
                DosResult uploadResult = null;
                long fencingToken = 0;
                var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
                {
                    Key = $"V8Mcp:ApplicationAsset:{TenantConfigurationSecurity.NormalizeTenantId(osClient).ToLowerInvariant()}:{appId}:{versionNo}:{Sha256Hex(relativePath)}",
                    OsClient = osClient,
                    Expiry = TimeSpan.FromMinutes(10),
                    AcquireTimeout = TimeSpan.FromMinutes(1),
                    CancellationToken = cancellationToken,
                    RetryIntervalMs = 50,
                    UseExponentialBackoff = true,
                    AutoRenew = true,
                    MaxLeaseDuration = TimeSpan.FromHours(2)
                }, async lease =>
                {
                    var lockedGate = ReadApplicationAssetStreamGateStrong(
                        osClient,
                        gateCoordinate.OsClientType,
                        gateCoordinate.OsClientNetwork,
                        null,
                        false);
                    var lockedGateError = ValidateApplicationAssetStreamGate(lockedGate, 2, null);
                    if (lockedGateError != null)
                    {
                        uploadResult = new DosResult(0, null, lockedGateError);
                        return;
                    }
                    fencingToken = lease.FencingToken;
                    await lease.EnsureHeldAsync().ConfigureAwait(false);
                    var lockedApp = await FindAiApplication(osClient, appId).ConfigureAwait(false);
                    var lockedIdentityError = ValidateApplicationStreamIdentity(lockedApp, appId, appKey);
                    if (lockedIdentityError != null)
                    {
                        uploadResult = new DosResult(0, null, "资产锁内应用身份校验失败：" + lockedIdentityError);
                        return;
                    }
                    var lockedApplicationType = SafeJString(lockedApp, "ApplicationType", "Web");
                    if (!string.Equals(lockedApplicationType, applicationType, StringComparison.OrdinalIgnoreCase))
                    {
                        uploadResult = new DosResult(0, null,
                            $"资产锁内 ApplicationType 已漂移：Expected={applicationType}，Actual={lockedApplicationType}");
                        return;
                    }
                    await lease.EnsureHeldAsync().ConfigureAwait(false);
                    var versionExists = await ApplicationObjectExists(hdfs, clientModel, paths.VersionPath).ConfigureAwait(false);
                    if (versionExists.Error != null)
                    {
                        uploadResult = versionExists.Error;
                        return;
                    }
                    var markerExists = await ApplicationObjectExists(hdfs, clientModel, paths.IntegrityMarkerPath).ConfigureAwait(false);
                    if (markerExists.Error != null)
                    {
                        uploadResult = markerExists.Error;
                        return;
                    }

                    if (!versionExists.Exists && markerExists.Exists)
                    {
                        uploadResult = new DosResult(0, null,
                            "完整性标记已存在但目标历史版本文件缺失；已拒绝覆盖或复用异常版本");
                        return;
                    }

                    if (versionExists.Exists)
                    {
                        // A previous node may have finished the immutable object write
                        // and then stopped before writing its marker. Never overwrite the
                        // object: read it through the shared tenant HDFS facade and only
                        // repair the marker after exact size/hash verification.
                        using var storedReadBudget = await AcquireApplicationAssetReadBudgetAsync(
                            actualLength,
                            cancellationToken).ConfigureAwait(false);
                        var storedBytes = await ReadApplicationObjectBytes(
                            hdfs,
                            clientModel,
                            paths.VersionPath).ConfigureAwait(false);
                        var storedContentError = ValidateApplicationAssetContent(
                            relativePath,
                            actualLength,
                            actualSha256,
                            storedBytes,
                            false);
                        if (storedContentError != null)
                        {
                            uploadResult = new DosResult(0, null,
                                storedContentError + "；已拒绝覆盖不可变历史版本");
                            return;
                        }

                        if (markerExists.Exists)
                        {
                            var storedMarkerBytes = await ReadApplicationObjectBytes(
                                hdfs,
                                clientModel,
                                paths.IntegrityMarkerPath).ConfigureAwait(false);
                            var markerError = ValidateApplicationAssetIntegrityMarker(
                                storedMarkerBytes,
                                appKey,
                                versionNo,
                                relativePath,
                                actualSha256,
                                actualLength);
                            if (markerError != null)
                            {
                                uploadResult = new DosResult(0, null,
                                    markerError + "；已拒绝复用异常完整性标记");
                                return;
                            }
                        }
                        else
                        {
                            await using var repairMarkerStream = new MemoryStream(markerBytes, false);
                            var repairMarker = await ExecuteApplicationAssetSideEffect(
                                lease,
                                () => PutApplicationObject(
                                    hdfs,
                                    clientModel,
                                    paths.IntegrityMarkerPath,
                                    repairMarkerStream)).ConfigureAwait(false);
                            if (repairMarker.Code != 1)
                            {
                                uploadResult = new DosResult(
                                    repairMarker.Code,
                                    repairMarker.Data,
                                    "历史版本内容校验通过，但补写完整性标记失败：" + repairMarker.Msg);
                                return;
                            }
                            integrityMarkerRepaired = true;
                        }

                        idempotent = true;
                        uploadResult = new DosResult(1);
                        return;
                    }

                    // 只有确实需要写入新对象时才占用日额度；SHA 校验失败和幂等重试不扣额度。
                    if (totalBytes > 0)
                    {
                        var userId = SafeJString(currentUser, "Id", SafeJString(currentUser, "UserId"));
                        var quotaError = await ExecuteApplicationAssetSideEffect(
                            lease,
                            () => FileUploadSecurity.ReserveDailyQuotaAsync(
                                osClient,
                                userId,
                                totalBytes,
                                uploadOptions,
                                FileUploadSecurity.ApplicationPublishQuotaScope)).ConfigureAwait(false);
                        if (quotaError != null)
                        {
                            uploadResult = quotaError;
                            return;
                        }
                    }

                    // 完整性标记必须最后写入。即使进程在上传中途退出，也不会把半成品误认作可发布资产。
                    var versionPut = await ExecuteApplicationAssetSideEffect(
                        lease,
                        () => PutApplicationObject(
                            hdfs,
                            clientModel,
                            paths.VersionPath,
                            fileStream)).ConfigureAwait(false);
                    if (versionPut.Code != 1)
                    {
                        uploadResult = new DosResult(versionPut.Code, versionPut.Data, "流式写入应用版本资产失败：" + versionPut.Msg);
                        return;
                    }

                    await using var markerStream = new MemoryStream(markerBytes, false);
                    var markerPut = await ExecuteApplicationAssetSideEffect(
                        lease,
                        () => PutApplicationObject(
                            hdfs,
                            clientModel,
                            paths.IntegrityMarkerPath,
                            markerStream)).ConfigureAwait(false);
                    if (markerPut.Code != 1)
                    {
                        var cleanup = await ExecuteApplicationAssetSideEffect(
                            lease,
                            () => hdfs.DeleteObject(new HDFSParam
                            {
                                ClientModel = clientModel,
                                Limit = false,
                                FileFullPath = paths.VersionPath
                            })).ConfigureAwait(false);
                        uploadResult = new DosResult(markerPut.Code, markerPut.Data,
                            "写入完整性标记失败，版本资产已" + (cleanup.Code == 1 ? "回滚" : "进入待清理状态") + "：" + markerPut.Msg);
                        return;
                    }
                    uploadResult = new DosResult(1);
                }).ConfigureAwait(false);
                if (lockResult.Code != 1)
                    return new DosResult<object>(0, null, "未获得应用资产分布式发布锁：" + lockResult.Msg);
                if (uploadResult == null || uploadResult.Code != 1)
                    return new DosResult<object>(uploadResult?.Code ?? 0, uploadResult?.Data, uploadResult?.Msg ?? "应用资产流式上传未执行");

                return new DosResult<object>(1, new
                {
                    AppId = SafeJString(app, "Id"),
                    AppKey = appKey,
                    ApplicationType = applicationType,
                    VersionNo = versionNo,
                    RequestId = requestId,
                    FencingToken = fencingToken,
                    Path = relativePath,
                    Sha256 = actualSha256,
                    Size = actualLength,
                    VersionFilePath = paths.VersionPath,
                    RootFilePath = paths.RootPath,
                    LatestFilePath = paths.LatestPath,
                    IntegrityMarkerPath = paths.IntegrityMarkerPath,
                    Streamed = true,
                    Idempotent = idempotent,
                    IntegrityMarkerRepaired = integrityMarkerRepaired,
                    StablePromoted = false
                }, integrityMarkerRepaired
                    ? "历史版本资产校验通过，已幂等补写完整性标记"
                    : idempotent ? "相同版本资产及完整性标记已严格校验并幂等复用" : "应用版本资产已流式上传");
            }
            catch (OperationCanceledException)
            {
                return new DosResult<object>(0, null, "应用资产流式上传已取消");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "应用资产流式上传失败：" + ex.Message);
            }
        }

        private static async Task<string> ResolveApplicationPublicUrl(string osClient, string path)
        {
            try
            {
                var result = await MicroiEngine.FormEngine.GetSysConfig(osClient).ConfigureAwait(false);
                if (result.Code == 1 && result.Data != null)
                {
                    var config = result.Data is JObject obj ? obj : JObject.FromObject((object)result.Data);
                    var fileServer = SafeJString(config, "FileServer").TrimEnd('/');
                    if (!fileServer.DosIsNullOrWhiteSpace()) return fileServer + "/" + path.TrimStart('/');
                }
            }
            catch { }
            return path.TrimStart('/');
        }

        private static async Task<DosResult> UpsertStreamPublishVersion(
            string osClient,
            JObject app,
            string versionNo,
            string entryVersionPath,
            string previewUrl,
            int fileCount,
            long totalSize,
            JArray aliasManifest,
            string changeSummary,
            string requestId,
            string deliveryBatchId,
            string sourceManifestHash,
            string runtimeManifestHash,
            int? expectedCurrentVersion,
            bool expectedAppVersionSupplied,
            string expectedAppVersion,
            string publishStatus,
            long fencingToken,
            IMicroiLockLease lease)
        {
            var appId = SafeJString(app, "Id");
            var existing = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("mci_ai_app_version", new
            {
                OsClient = osClient,
                _Where = new List<object>
                {
                    new List<object> { "AppId", "=", appId },
                    new List<object> { "AND", "VersionNo", "=", versionNo }
                }
            }).ConfigureAwait(false);
            var buildLog = new JObject
            {
                ["Mode"] = "StreamedAssets",
                ["RequestId"] = requestId,
                ["DeliveryBatchId"] = deliveryBatchId,
                ["FencingToken"] = fencingToken,
                ["SourceManifestHash"] = sourceManifestHash,
                ["RuntimeManifestHash"] = runtimeManifestHash,
                ["HasExpectedCurrentVersion"] = expectedCurrentVersion.HasValue,
                ["HasExpectedAppVersion"] = expectedAppVersionSupplied,
                ["PublishStatus"] = publishStatus,
                ["AliasStatus"] = string.Equals(publishStatus, "Published", StringComparison.OrdinalIgnoreCase)
                    ? "Published"
                    : "Pending",
                ["StableAliasesVerified"] = string.Equals(publishStatus, "Published", StringComparison.OrdinalIgnoreCase),
                ["RuntimeVerified"] = true,
                ["AssetCount"] = fileCount,
                ["TotalSize"] = totalSize
            };
            if (expectedCurrentVersion.HasValue)
                buildLog["ExpectedCurrentVersion"] = expectedCurrentVersion.Value;
            if (expectedAppVersionSupplied)
                buildLog["ExpectedAppVersion"] = expectedAppVersion ?? string.Empty;
            ApplyApplicationAliasRecoveryMetadata(buildLog, aliasManifest, publishStatus);

            var row = new JObject
            {
                ["AppId"] = appId,
                ["AppName"] = SafeJString(app, "Name", SafeJString(app, "AppName")),
                ["VersionNo"] = versionNo,
                ["VersionName"] = versionNo,
                ["Status"] = publishStatus,
                ["SourceSnapshotPath"] = SafeJString(app, "PrivateSourcePath", "ai-app-source/" + appId),
                ["PublishPath"] = entryVersionPath,
                ["PreviewUrl"] = previewUrl,
                ["BuildTaskId"] = "",
                ["BuildLog"] = buildLog.ToString(Formatting.None),
                ["ChangeSummary"] = changeSummary.DosIsNullOrWhiteSpace() ? "二进制流式发布" : changeSummary,
                ["FileCount"] = fileCount,
                ["TotalSize"] = totalSize
            };
            if (existing.Code != 1 && existing.Code != 2)
                return new DosResult(existing.Code, (object)existing.Data, "读取既有应用版本失败：" + existing.Msg);
            if (existing.Code == 1 && existing.Data != null)
            {
                var existingRow = JObject.FromObject((object)existing.Data);
                var existingIdError = ValidateApplicationStreamExistingRecordId(existingRow, "应用版本");
                if (existingIdError != null) return new DosResult(0, null, existingIdError);
                if (!string.Equals(SafeJString(existingRow, "AppId"), appId, StringComparison.Ordinal))
                    return new DosResult(0, null, "既有应用版本 AppId 不一致，拒绝覆盖");
                var metadataConflict = ValidateApplicationStreamVersionMetadata(
                    existingRow,
                    versionNo,
                    entryVersionPath,
                    requestId,
                    deliveryBatchId,
                    sourceManifestHash,
                    runtimeManifestHash,
                    fileCount,
                    totalSize,
                    expectedCurrentVersion,
                    expectedAppVersionSupplied,
                    expectedAppVersion);
                if (metadataConflict != null)
                    return new DosResult(0, null, "既有应用版本不可变元数据冲突，拒绝覆盖：" + metadataConflict);
                var existingId = SafeJString(existingRow, "Id");
                row["Id"] = existingId;
                var updateResult = await ExecuteApplicationAssetConditionalUpdate(
                    osClient,
                    "mci_ai_app_version",
                    row,
                    new List<object>
                    {
                        new List<object> { "Id", "=", existingId },
                        new List<object> { "AND", "AppId", "=", appId },
                        new List<object> { "AND", "VersionNo", "=", versionNo },
                        new List<object> { "AND", "Status", "=", CloneToken(existingRow["Status"]) },
                        new List<object> { "AND", "PublishPath", "=", CloneToken(existingRow["PublishPath"]) },
                        new List<object> { "AND", "FileCount", "=", CloneToken(existingRow["FileCount"]) },
                        new List<object> { "AND", "TotalSize", "=", CloneToken(existingRow["TotalSize"]) }
                    },
                    lease,
                    "更新应用版本状态").ConfigureAwait(false);
                if (updateResult.Code == 1) return updateResult;

                var afterConflict = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("mci_ai_app_version", new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "Id", "=", existingId },
                        new List<object> { "AND", "AppId", "=", appId },
                        new List<object> { "AND", "VersionNo", "=", versionNo }
                    }
                }).ConfigureAwait(false);
                if (afterConflict.Code == 1 && afterConflict.Data != null)
                {
                    var conflictRow = JObject.FromObject((object)afterConflict.Data);
                    var convergedError = ValidateApplicationStreamVersionMetadata(
                        conflictRow,
                        versionNo,
                        entryVersionPath,
                        requestId,
                        deliveryBatchId,
                        sourceManifestHash,
                        runtimeManifestHash,
                        fileCount,
                        totalSize,
                        expectedCurrentVersion,
                        expectedAppVersionSupplied,
                        expectedAppVersion);
                    if (convergedError == null
                        && string.Equals(SafeJString(conflictRow, "Status"), publishStatus, StringComparison.OrdinalIgnoreCase))
                    {
                        return new DosResult(1, conflictRow, "应用版本状态已由当前请求的其它持有者幂等收敛");
                    }
                }
                return updateResult;
            }
            row["Id"] = BuildApplicationStreamRecordId("version", osClient, appId, versionNo);
            var addResult = await ExecuteApplicationAssetSideEffect(
                lease,
                () => MicroiEngine.FormEngine.AddFormDataAsync(
                    "mci_ai_app_version",
                    BuildTrustedMcpFormWriteParam(osClient, row))).ConfigureAwait(false);
            if (addResult.Code == 1) return addResult;

            var concurrent = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("mci_ai_app_version", new
            {
                OsClient = osClient,
                _Where = new List<object>
                {
                    new List<object> { "AppId", "=", appId },
                    new List<object> { "AND", "VersionNo", "=", versionNo }
                }
            }).ConfigureAwait(false);
            if (concurrent.Code == 1 && concurrent.Data != null)
            {
                var concurrentRow = JObject.FromObject((object)concurrent.Data);
                var conflict = ValidateApplicationStreamVersionMetadata(
                    concurrentRow,
                    versionNo,
                    entryVersionPath,
                    requestId,
                    deliveryBatchId,
                    sourceManifestHash,
                    runtimeManifestHash,
                    fileCount,
                    totalSize,
                    expectedCurrentVersion,
                    expectedAppVersionSupplied,
                    expectedAppVersion);
                if (conflict == null)
                    return new DosResult(1, (object)concurrent.Data, "并发版本元数据已按确定性主键幂等收敛");
                return new DosResult(0, (object)concurrent.Data, "并发版本元数据冲突，拒绝覆盖：" + conflict);
            }
            return new DosResult(addResult.Code, addResult.Data,
                "新增应用版本失败，且未回读到相同业务键：" + addResult.Msg);
        }

        private static bool IsStreamMicroServiceDesiredState(JObject row, JObject desired)
        {
            if (row == null || desired == null) return false;
            return string.Equals(SafeJString(row, "Id"), SafeJString(desired, "Id"), StringComparison.Ordinal)
                   && string.Equals(SafeJString(row, "MsKey"), SafeJString(desired, "MsKey"), StringComparison.Ordinal)
                   && string.Equals(SafeJString(row, "BuildVersion"), SafeJString(desired, "BuildVersion"), StringComparison.Ordinal)
                   && string.Equals(SafeJString(row, "DistHash"), SafeJString(desired, "DistHash"), StringComparison.OrdinalIgnoreCase)
                   && string.Equals(SafeJString(row, "EntryPath"), SafeJString(desired, "EntryPath"), StringComparison.Ordinal)
                   && string.Equals(SafeJString(row, "AssetsJson"), SafeJString(desired, "AssetsJson"), StringComparison.Ordinal)
                   && string.Equals(SafeJString(row, "AssetManifestJson"), SafeJString(desired, "AssetManifestJson"), StringComparison.Ordinal);
        }

        private static async Task<DosResult<object>> UpsertStreamMicroService(
            string osClient,
            string appId,
            string appKey,
            JObject serviceData,
            JObject previousService,
            IMicroiLockLease lease)
        {
            if (serviceData == null) return new DosResult<object>(0, null, "微服务运行元数据不能为空");
            if (previousService != null)
            {
                var idError = ValidateApplicationStreamExistingRecordId(previousService, "微服务运行元数据");
                if (idError != null) return new DosResult<object>(0, null, idError);
                var serviceId = SafeJString(previousService, "Id");
                serviceData["Id"] = serviceId;
                var updateResult = await ExecuteApplicationAssetConditionalUpdate(
                    osClient,
                    "sys_microiservice",
                    serviceData,
                    new List<object>
                    {
                        new List<object> { "Id", "=", serviceId },
                        new List<object> { "AND", "MsKey", "=", appKey },
                        new List<object> { "AND", "BuildVersion", "=", CloneToken(previousService["BuildVersion"]) },
                        new List<object> { "AND", "DistHash", "=", CloneToken(previousService["DistHash"]) },
                        new List<object> { "AND", "EntryPath", "=", CloneToken(previousService["EntryPath"]) }
                    },
                    lease,
                    "切换微服务运行元数据").ConfigureAwait(false);
                if (updateResult.Code == 1)
                    return new DosResult<object>(1, new { Id = serviceId, Updated = true });

                var afterConflict = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_microiservice", new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "Id", "=", serviceId },
                        new List<object> { "AND", "MsKey", "=", appKey }
                    }
                }).ConfigureAwait(false);
                if (afterConflict.Code == 1 && afterConflict.Data != null
                    && IsStreamMicroServiceDesiredState(
                        JObject.FromObject((object)afterConflict.Data),
                        serviceData))
                {
                    return new DosResult<object>(1, new { Id = serviceId, Updated = true, Idempotent = true });
                }
                return new DosResult<object>(updateResult.Code, updateResult.Data, updateResult.Msg);
            }

            var deterministicId = BuildApplicationStreamRecordId(
                "microservice",
                osClient,
                appId,
                appKey);
            serviceData["Id"] = deterministicId;
            var addResult = await ExecuteApplicationAssetSideEffect(
                lease,
                () => MicroiEngine.FormEngine.AddFormDataAsync(
                    "sys_microiservice",
                    BuildTrustedMcpFormWriteParam(osClient, serviceData))).ConfigureAwait(false);
            if (addResult.Code == 1)
                return new DosResult<object>(1, new { Id = deterministicId, Created = true });

            var concurrent = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("sys_microiservice", new
            {
                OsClient = osClient,
                _Where = new List<object> { new List<object> { "MsKey", "=", appKey } }
            }).ConfigureAwait(false);
            if (concurrent.Code == 1 && concurrent.Data != null)
            {
                var concurrentRow = JObject.FromObject((object)concurrent.Data);
                var idError = ValidateApplicationStreamExistingRecordId(concurrentRow, "微服务运行元数据");
                if (idError != null) return new DosResult<object>(0, null, idError);
                if (IsStreamMicroServiceDesiredState(concurrentRow, serviceData))
                    return new DosResult<object>(1, concurrentRow, "并发微服务运行元数据已幂等收敛");
                return new DosResult<object>(0, concurrentRow, "并发微服务运行元数据冲突，拒绝覆盖");
            }
            return new DosResult<object>(addResult.Code, addResult.Data,
                "新增微服务运行元数据失败，且未回读到相同 MsKey：" + addResult.Msg);
        }

        /// <summary>
        /// Validate immutable facts before any existing AppId+VersionNo row can
        /// be reused or transition from Verified to Published.
        /// </summary>
        public static string ValidateApplicationStreamVersionMetadata(
            JObject versionRow,
            string versionNo,
            string publishPath,
            string requestId,
            string deliveryBatchId,
            string sourceManifestHash,
            string runtimeManifestHash,
            int fileCount,
            long totalSize)
        {
            if (versionRow == null) return "版本元数据不存在";
            if (!string.Equals(SafeJString(versionRow, "VersionNo"), versionNo, StringComparison.Ordinal))
                return "VersionNo 不一致";
            if (!string.Equals(SafeJString(versionRow, "PublishPath"), publishPath, StringComparison.Ordinal))
                return "PublishPath 不一致";
            if (SafeJInt(versionRow, "FileCount", -1) != fileCount)
                return "FileCount 不一致";
            if ((versionRow["TotalSize"]?.Val<long?>() ?? -1L) != totalSize)
                return "TotalSize 不一致";

            JObject buildLog;
            try { buildLog = JObject.Parse(SafeJString(versionRow, "BuildLog")); }
            catch { return "BuildLog 不是有效 JSON"; }
            if (!string.Equals(SafeJString(buildLog, "Mode"), "StreamedAssets", StringComparison.Ordinal))
                return "BuildLog.Mode 不一致";
            var storedRequestId = SafeJString(buildLog, "RequestId");
            if (!storedRequestId.DosIsNullOrWhiteSpace()
                && !string.Equals(storedRequestId, requestId, StringComparison.Ordinal))
                return "RequestId 不一致";
            if (!string.Equals(SafeJString(buildLog, "DeliveryBatchId"), deliveryBatchId, StringComparison.Ordinal))
                return "DeliveryBatchId 不一致";
            if (buildLog["FencingToken"] != null
                && (buildLog["FencingToken"]?.Val<long?>() ?? 0L) <= 0L)
                return "FencingToken 不合法";
            if (!string.Equals(SafeJString(buildLog, "SourceManifestHash"), sourceManifestHash, StringComparison.OrdinalIgnoreCase))
                return "SourceManifestHash 不一致";
            if (!string.Equals(SafeJString(buildLog, "RuntimeManifestHash"), runtimeManifestHash, StringComparison.OrdinalIgnoreCase))
                return "RuntimeManifestHash 不一致";
            var rowStatus = SafeJString(versionRow, "Status");
            if (!new[] { "Verified", "Published" }.Contains(rowStatus, StringComparer.OrdinalIgnoreCase))
                return "版本状态不是 Verified 或 Published";
            if (!string.Equals(SafeJString(buildLog, "PublishStatus"), rowStatus, StringComparison.OrdinalIgnoreCase))
                return "BuildLog.PublishStatus 与版本状态不一致";
            var aliasStatus = SafeJString(buildLog, "AliasStatus");
            if (!aliasStatus.DosIsNullOrWhiteSpace())
            {
                var expectedAliasStatus = string.Equals(rowStatus, "Published", StringComparison.OrdinalIgnoreCase)
                    ? "Published"
                    : "Pending";
                if (!string.Equals(aliasStatus, expectedAliasStatus, StringComparison.OrdinalIgnoreCase))
                    return "BuildLog.AliasStatus 与版本状态不一致";
            }
            if (buildLog["StableAliasesVerified"] != null)
            {
                var expectedStableAliasesVerified = string.Equals(
                    rowStatus,
                    "Published",
                    StringComparison.OrdinalIgnoreCase);
                if (buildLog["StableAliasesVerified"]?.Val<bool?>() != expectedStableAliasesVerified)
                    return "BuildLog.StableAliasesVerified 与版本状态不一致";
            }
            if (buildLog["RuntimeVerified"]?.Val<bool?>() != true)
                return "RuntimeVerified 不一致";
            if (SafeJInt(buildLog, "AssetCount", -1) != fileCount)
                return "BuildLog.AssetCount 不一致";
            if ((buildLog["TotalSize"]?.Val<long?>() ?? -1L) != totalSize)
                return "BuildLog.TotalSize 不一致";
            return null;
        }

        /// <summary>
        /// Parse every optimistic-concurrency request fact before comparing the
        /// live application row. Parsing must not stop at the first live-state
        /// mismatch: after a successful publish that mismatch is expected, and
        /// the complete original fingerprint is needed to prove an exact replay.
        /// </summary>
        public static string ParseApplicationStreamExpectedState(
            JObject param,
            out int? expectedCurrentVersion,
            out bool expectedAppVersionSupplied,
            out string expectedAppVersion)
        {
            expectedCurrentVersion = null;
            expectedAppVersionSupplied = false;
            expectedAppVersion = null;
            if (param == null) return null;

            var expectedCurrentVersionProperty = param.Property("ExpectedCurrentVersion");
            if (expectedCurrentVersionProperty != null)
            {
                var token = expectedCurrentVersionProperty.Value;
                if (token == null || token.Type != JTokenType.Integer)
                    return "ExpectedCurrentVersion 必须是非负 int 整数";
                try
                {
                    var value = token.Value<long>();
                    if (value < 0 || value > int.MaxValue)
                        return "ExpectedCurrentVersion 必须是非负 int 整数";
                    expectedCurrentVersion = (int)value;
                }
                catch
                {
                    return "ExpectedCurrentVersion 必须是非负 int 整数";
                }
            }

            var expectedAppVersionProperty = param.Property("ExpectedAppVersion");
            expectedAppVersionSupplied = expectedAppVersionProperty != null;
            if (!expectedAppVersionSupplied) return null;

            var expectedAppVersionToken = expectedAppVersionProperty.Value;
            if (expectedAppVersionToken == null
                || expectedAppVersionToken.Type == JTokenType.Null
                || expectedAppVersionToken.Type == JTokenType.Undefined)
            {
                expectedAppVersion = string.Empty;
            }
            else if (expectedAppVersionToken.Type == JTokenType.String)
            {
                expectedAppVersion = expectedAppVersionToken.Value<string>() ?? string.Empty;
            }
            else
            {
                return "ExpectedAppVersion 必须是字符串或 null";
            }
            return null;
        }

        public static string ValidateApplicationStreamExpectedValues(
            JObject app,
            int? expectedCurrentVersion,
            bool expectedAppVersionSupplied,
            string expectedAppVersion)
        {
            if (app == null) return "应用元数据不存在";
            if (expectedCurrentVersion.HasValue)
            {
                var actualCurrentVersion = SafeJInt(app, "CurrentVersion");
                if (actualCurrentVersion != expectedCurrentVersion.Value)
                    return $"ExpectedCurrentVersion 不一致：Expected={expectedCurrentVersion.Value}，Actual={actualCurrentVersion}";
            }
            if (expectedAppVersionSupplied)
            {
                var actualAppVersion = SafeJString(app, "AppVersion");
                if (!string.Equals(actualAppVersion, expectedAppVersion ?? string.Empty, StringComparison.Ordinal))
                    return $"ExpectedAppVersion 不一致：Expected={expectedAppVersion ?? string.Empty}，Actual={actualAppVersion}";
            }
            return null;
        }

        /// <summary>
        /// Parse and compare the optional optimistic-concurrency preconditions
        /// against the application row read while the publish lease is held.
        /// A supplied null/empty AppVersion is the same canonical empty value;
        /// omission remains a distinct "no precondition" state.
        /// </summary>
        public static string ValidateApplicationStreamExpectedState(
            JObject app,
            JObject param,
            out int? expectedCurrentVersion,
            out bool expectedAppVersionSupplied,
            out string expectedAppVersion)
        {
            if (app == null)
            {
                expectedCurrentVersion = null;
                expectedAppVersionSupplied = false;
                expectedAppVersion = null;
                return "应用元数据不存在";
            }
            var parseError = ParseApplicationStreamExpectedState(
                param,
                out expectedCurrentVersion,
                out expectedAppVersionSupplied,
                out expectedAppVersion);
            return parseError ?? ValidateApplicationStreamExpectedValues(
                app,
                expectedCurrentVersion,
                expectedAppVersionSupplied,
                expectedAppVersion);
        }

        /// <summary>
        /// Expected-state presence and canonical values are immutable request
        /// facts. This prevents a previously Published row from being replayed
        /// with a different preflight baseline under the same version/batch.
        /// </summary>
        public static string ValidateApplicationStreamExpectedFingerprint(
            JObject versionRow,
            int? expectedCurrentVersion,
            bool expectedAppVersionSupplied,
            string expectedAppVersion)
        {
            if (versionRow == null) return "版本元数据不存在";
            JObject buildLog;
            try { buildLog = JObject.Parse(SafeJString(versionRow, "BuildLog")); }
            catch { return "BuildLog 不是有效 JSON"; }

            var storedCurrentProperty = buildLog.Property("ExpectedCurrentVersion");
            var storedCurrentFlag = buildLog["HasExpectedCurrentVersion"];
            var storedAppProperty = buildLog.Property("ExpectedAppVersion");
            var storedAppFlag = buildLog["HasExpectedAppVersion"];
            // Rolling-upgrade compatibility: versions created before optimistic
            // baseline persistence have neither flag nor value. Finalize callers
            // must still supply both baselines now; the live app-state gate and
            // terminal application CAS remain authoritative for these legacy rows.
            if (storedCurrentProperty == null
                && storedCurrentFlag == null
                && storedAppProperty == null
                && storedAppFlag == null)
            {
                return null;
            }
            bool storedHasExpectedCurrentVersion;
            if (storedCurrentFlag == null)
            {
                storedHasExpectedCurrentVersion = storedCurrentProperty != null;
            }
            else if (storedCurrentFlag.Type == JTokenType.Boolean)
            {
                storedHasExpectedCurrentVersion = storedCurrentFlag.Value<bool>();
            }
            else
            {
                return "BuildLog.HasExpectedCurrentVersion 不合法";
            }
            if (storedHasExpectedCurrentVersion != expectedCurrentVersion.HasValue)
                return "ExpectedCurrentVersion 提供状态不一致";
            if (storedHasExpectedCurrentVersion)
            {
                if (storedCurrentProperty == null || storedCurrentProperty.Value.Type != JTokenType.Integer)
                    return "BuildLog.ExpectedCurrentVersion 不合法";
                long storedCurrentVersion;
                try { storedCurrentVersion = storedCurrentProperty.Value.Value<long>(); }
                catch { return "BuildLog.ExpectedCurrentVersion 不合法"; }
                if (storedCurrentVersion < 0 || storedCurrentVersion > int.MaxValue)
                    return "BuildLog.ExpectedCurrentVersion 不合法";
                if (storedCurrentVersion != expectedCurrentVersion.Value)
                    return "ExpectedCurrentVersion 不一致";
            }
            else if (storedCurrentProperty != null)
            {
                return "BuildLog.ExpectedCurrentVersion 提供状态不一致";
            }

            bool storedHasExpectedAppVersion;
            if (storedAppFlag == null)
            {
                storedHasExpectedAppVersion = storedAppProperty != null;
            }
            else if (storedAppFlag.Type == JTokenType.Boolean)
            {
                storedHasExpectedAppVersion = storedAppFlag.Value<bool>();
            }
            else
            {
                return "BuildLog.HasExpectedAppVersion 不合法";
            }
            if (storedHasExpectedAppVersion != expectedAppVersionSupplied)
                return "ExpectedAppVersion 提供状态不一致";
            if (storedHasExpectedAppVersion)
            {
                if (storedAppProperty == null)
                    return "BuildLog.ExpectedAppVersion 缺失";
                var storedToken = storedAppProperty.Value;
                if (storedToken.Type != JTokenType.String
                    && storedToken.Type != JTokenType.Null
                    && storedToken.Type != JTokenType.Undefined)
                    return "BuildLog.ExpectedAppVersion 不合法";
                var storedAppVersion = storedToken.Type == JTokenType.String
                    ? storedToken.Value<string>() ?? string.Empty
                    : string.Empty;
                if (!string.Equals(storedAppVersion, expectedAppVersion ?? string.Empty, StringComparison.Ordinal))
                    return "ExpectedAppVersion 不一致";
            }
            else if (storedAppProperty != null)
            {
                return "BuildLog.ExpectedAppVersion 提供状态不一致";
            }

            return null;
        }

        private static string ValidateApplicationStreamVersionMetadata(
            JObject versionRow,
            string versionNo,
            string publishPath,
            string requestId,
            string deliveryBatchId,
            string sourceManifestHash,
            string runtimeManifestHash,
            int fileCount,
            long totalSize,
            int? expectedCurrentVersion,
            bool expectedAppVersionSupplied,
            string expectedAppVersion)
        {
            var metadataError = ValidateApplicationStreamVersionMetadata(
                versionRow,
                versionNo,
                publishPath,
                requestId,
                deliveryBatchId,
                sourceManifestHash,
                runtimeManifestHash,
                fileCount,
                totalSize);
            return metadataError ?? ValidateApplicationStreamExpectedFingerprint(
                versionRow,
                expectedCurrentVersion,
                expectedAppVersionSupplied,
                expectedAppVersion);
        }

        /// <summary>
        /// Return null only when a completed version row is an exact replay of
        /// the immutable publish request. Legacy rows may lack RequestId, but
        /// still need the same stable DeliveryBatchId and every content fact.
        /// </summary>
        public static string ValidatePublishedApplicationStreamReplay(
            JObject versionRow,
            string versionNo,
            string publishPath,
            string requestId,
            string deliveryBatchId,
            string sourceManifestHash,
            string runtimeManifestHash,
            int fileCount,
            long totalSize)
        {
            var metadataError = ValidateApplicationStreamVersionMetadata(
                versionRow,
                versionNo,
                publishPath,
                requestId,
                deliveryBatchId,
                sourceManifestHash,
                runtimeManifestHash,
                fileCount,
                totalSize);
            if (metadataError != null) return metadataError;
            return string.Equals(SafeJString(versionRow, "Status"), "Published", StringComparison.OrdinalIgnoreCase)
                ? null
                : "版本状态不是 Published";
        }

        public static string ValidatePublishedApplicationStreamReplay(
            JObject versionRow,
            string versionNo,
            string publishPath,
            string requestId,
            string deliveryBatchId,
            string sourceManifestHash,
            string runtimeManifestHash,
            int fileCount,
            long totalSize,
            int? expectedCurrentVersion,
            bool expectedAppVersionSupplied,
            string expectedAppVersion)
        {
            var metadataError = ValidateApplicationStreamVersionMetadata(
                versionRow,
                versionNo,
                publishPath,
                requestId,
                deliveryBatchId,
                sourceManifestHash,
                runtimeManifestHash,
                fileCount,
                totalSize,
                expectedCurrentVersion,
                expectedAppVersionSupplied,
                expectedAppVersion);
            if (metadataError != null) return metadataError;
            return string.Equals(SafeJString(versionRow, "Status"), "Published", StringComparison.OrdinalIgnoreCase)
                ? null
                : "版本状态不是 Published";
        }

        public static string ValidatePublishedApplicationMetadataReplay(
            JObject app,
            string versionNo,
            string publishPath,
            string deliveryBatchId)
        {
            if (app == null) return "应用元数据不存在";
            if (!string.Equals(SafeJString(app, "Status"), "Published", StringComparison.OrdinalIgnoreCase))
                return "应用状态不是 Published";
            var appVersion = SafeJString(app, "AppVersion");
            if (!appVersion.DosIsNullOrWhiteSpace()
                && !string.Equals(appVersion, versionNo, StringComparison.Ordinal))
                return "应用 AppVersion 与已发布版本不一致";
            if (!string.Equals(SafeJString(app, "PublicPublishPath"), publishPath, StringComparison.Ordinal))
                return "应用 PublicPublishPath 不一致";
            if (!string.Equals(SafeJString(app, "LastBuildTaskId"), deliveryBatchId, StringComparison.Ordinal))
                return "应用 DeliveryBatchId 不一致";
            return null;
        }

        public static bool IsApplicationStreamPublishApplied(
            JObject app,
            string versionNo,
            string publishPath,
            string deliveryBatchId,
            int? expectedCurrentVersion = null)
        {
            var pointerApplied = app != null
                                 && string.Equals(SafeJString(app, "Status"), "Published", StringComparison.OrdinalIgnoreCase)
                                 && string.Equals(SafeJString(app, "AppVersion"), versionNo, StringComparison.Ordinal)
                                 && string.Equals(SafeJString(app, "PublicPublishPath"), publishPath, StringComparison.Ordinal)
                                 && string.Equals(SafeJString(app, "LastBuildTaskId"), deliveryBatchId, StringComparison.Ordinal);
            if (!pointerApplied || !expectedCurrentVersion.HasValue) return pointerApplied;
            try
            {
                return SafeJInt(app, "CurrentVersion") == checked(expectedCurrentVersion.Value + 1);
            }
            catch (OverflowException)
            {
                return false;
            }
        }

        /// <summary>
        /// A live expected-state baseline may be consumed only by the exact
        /// request that already advanced the application pointer. This covers a
        /// lost response after Published and the narrower crash window where the
        /// application CAS succeeded but the version row is still Verified.
        /// Every immutable request fact, including the original expected-state
        /// fingerprint, is checked before the stale live baseline is bypassed.
        /// </summary>
        public static string ValidateApplicationStreamConsumedBaselineReplay(
            JObject app,
            JObject versionRow,
            string versionNo,
            string versionPublishPath,
            string applicationPublishPath,
            string requestId,
            string deliveryBatchId,
            string sourceManifestHash,
            string runtimeManifestHash,
            int fileCount,
            long totalSize,
            int? expectedCurrentVersion,
            bool expectedAppVersionSupplied,
            string expectedAppVersion)
        {
            var metadataError = ValidateApplicationStreamVersionMetadata(
                versionRow,
                versionNo,
                versionPublishPath,
                requestId,
                deliveryBatchId,
                sourceManifestHash,
                runtimeManifestHash,
                fileCount,
                totalSize,
                expectedCurrentVersion,
                expectedAppVersionSupplied,
                expectedAppVersion);
            if (metadataError != null) return metadataError;

            JObject buildLog;
            try { buildLog = JObject.Parse(SafeJString(versionRow, "BuildLog")); }
            catch { return "BuildLog 不是有效 JSON"; }
            // The generic metadata validator keeps rolling-upgrade read
            // compatibility for legacy rows that predate RequestId/baseline
            // persistence. Such a row cannot prove that a now-stale live
            // baseline belongs to this exact request, so it must not use the
            // consumed-baseline bypass.
            if (SafeJString(buildLog, "RequestId").DosIsNullOrWhiteSpace())
                return "BuildLog.RequestId 缺失，无法证明精确幂等重放";
            if (buildLog.Property("HasExpectedCurrentVersion") == null
                || buildLog.Property("ExpectedCurrentVersion") == null
                || buildLog.Property("HasExpectedAppVersion") == null
                || buildLog.Property("ExpectedAppVersion") == null)
            {
                return "BuildLog 缺少完整 ExpectedState 指纹，无法消费已变化的应用基线";
            }

            if (!expectedCurrentVersion.HasValue)
                return "ExpectedCurrentVersion 缺失，无法证明应用版本计数只前进一次";
            int expectedAppliedCurrentVersion;
            try
            {
                expectedAppliedCurrentVersion = checked(expectedCurrentVersion.Value + 1);
            }
            catch (OverflowException)
            {
                return "ExpectedCurrentVersion + 1 溢出，拒绝消费已变化的应用基线";
            }

            var status = SafeJString(versionRow, "Status");
            if (!string.Equals(status, "Published", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(status, "Verified", StringComparison.OrdinalIgnoreCase))
            {
                return "版本状态不是 Published 或 Verified";
            }
            if (!IsApplicationStreamPublishApplied(app, versionNo, applicationPublishPath, deliveryBatchId))
                return "应用尚未处于本次发布的精确目标状态";

            var actualCurrentVersion = SafeJInt(app, "CurrentVersion");
            return IsApplicationStreamPublishApplied(
                    app,
                    versionNo,
                    applicationPublishPath,
                    deliveryBatchId,
                    expectedCurrentVersion)
                ? null
                : $"应用 CurrentVersion 不一致：ExpectedApplied={expectedAppliedCurrentVersion}，Actual={actualCurrentVersion}";
        }

        private static JObject BuildStreamPublishedApplicationUpdate(
            JObject app,
            string appKey,
            string versionNo,
            string previewUrl,
            string publishPath,
            string requestId,
            string deliveryBatchId,
            int assetCount,
            string runtimeManifestHash,
            bool applicationVersionAlreadyApplied)
        {
            return new JObject
            {
                ["Id"] = SafeJString(app, "Id"),
                ["AppKey"] = appKey,
                ["AppVersion"] = versionNo,
                ["CurrentVersion"] = SafeJInt(app, "CurrentVersion") + (applicationVersionAlreadyApplied ? 0 : 1),
                ["Status"] = "Published",
                ["BuildStatus"] = "Success",
                ["PreviewUrl"] = previewUrl,
                ["PublicPublishPath"] = publishPath,
                ["LastBuildTaskId"] = deliveryBatchId,
                ["LastBuildMsg"] = $"RequestId={requestId}；真实编译产物已完成租户存储回读与哈希校验，共 {assetCount} 个文件，运行清单 {runtimeManifestHash}。",
                ["UpdateTime"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
            };
        }

        /// <summary>
        /// Verify a complete immutable version manifest, then promote stable root
        /// and latest aliases by storage-provider CopyObject. No file body or
        /// Base64 value enters Jint or this JSON request.
        /// </summary>
        public static async Task<DosResult<object>> FinalizeApplicationStreamPublish(
            string osClient,
            JObject param,
            object currentToken,
            CancellationToken cancellationToken = default)
        {
            try
            {
                if (param == null) return new DosResult<object>(0, null, "发布清单不能为空");
                var appIdOrKey = param["AppIdOrKey"]?.Val<string>() ?? param["AppId"]?.Val<string>() ?? param["AppKey"]?.Val<string>();
                var operatorError = ValidateStreamPublishOperator(currentToken, osClient, "application:publish", appIdOrKey);
                if (operatorError != null) return operatorError;

                var protocolVersion = 2;
                long? expectedGateEpoch = null;
                if (param.Property("ProtocolVersion") != null)
                {
                    var parsedProtocol = ReadRequiredApplicationAssetV3Long(
                        param,
                        "ProtocolVersion",
                        out var protocolError);
                    if (protocolError != null || (parsedProtocol != 2L && parsedProtocol != 3L))
                    {
                        return new DosResult<object>(0, null,
                            protocolError ?? "ProtocolVersion 只允许 2 或 3");
                    }
                    protocolVersion = checked((int)parsedProtocol);
                }
                if (protocolVersion == ApplicationAssetStreamV3ProtocolVersion)
                {
                    var v3RequestError = ParseApplicationAssetV3ProtocolRequest(
                        param,
                        out var v3Request);
                    if (v3RequestError != null)
                        return new DosResult<object>(0, null, v3RequestError);
                    expectedGateEpoch = v3Request.ExpectedGateEpoch;
                }

                var gateCoordinate = ResolveApplicationAssetStreamGateCoordinate(osClient);
                var gate = ReadApplicationAssetStreamGateStrong(
                    osClient,
                    gateCoordinate.OsClientType,
                    gateCoordinate.OsClientNetwork,
                    null,
                    false);
                var gateError = ValidateApplicationAssetStreamGate(
                    gate,
                    protocolVersion,
                    expectedGateEpoch);
                if (gateError != null) return new DosResult<object>(0, null, gateError);

                var requiredPreconditionError = ValidateApplicationStreamFinalizePreconditions(param);
                if (requiredPreconditionError != null)
                    return new DosResult<object>(0, null, requiredPreconditionError);

                var app = protocolVersion == ApplicationAssetStreamV3ProtocolVersion
                    ? ReadApplicationAssetV3AppStrong(osClient, appIdOrKey, null, false)
                    : await FindAiApplication(osClient, appIdOrKey).ConfigureAwait(false);
                if (app == null) return new DosResult<object>(2, null, "在线 AI 应用不存在");
                var appId = SafeJString(app, "Id");
                if (appId.DosIsNullOrWhiteSpace())
                    return new DosResult<object>(0, null, "既有应用记录缺少不可变 Id，拒绝 finalize");
                var appKey = NormalizeMicroServiceKey(SafeJString(app, "AppKey", SafeJString(app, "AppId")));
                if (IsBlank(appKey)) return new DosResult<object>(0, null, "应用 AppKey 不合法");

                DosResult<object> publishResult = null;
                var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
                {
                    // 同一个应用的稳定 root/latest 入口必须跨节点串行切换，避免两个版本交叉复制成混合版本。
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
                    if (protocolVersion == ApplicationAssetStreamV3ProtocolVersion)
                    {
                        publishResult = await FinalizeApplicationStreamPublishV3Core(
                            osClient,
                            param,
                            currentToken,
                            appId,
                            appKey,
                            lease,
                            cancellationToken).ConfigureAwait(false);
                    }
                    else
                    {
                        var lockedGate = ReadApplicationAssetStreamGateStrong(
                            osClient,
                            gateCoordinate.OsClientType,
                            gateCoordinate.OsClientNetwork,
                            null,
                            false);
                        var lockedGateError = ValidateApplicationAssetStreamGate(
                            lockedGate,
                            2,
                            null);
                        if (lockedGateError != null)
                        {
                            publishResult = new DosResult<object>(0, null, lockedGateError);
                            return;
                        }
                        publishResult = await FinalizeApplicationStreamPublishCore(
                            osClient,
                            param,
                            currentToken,
                            appId,
                            appKey,
                            lease,
                            cancellationToken).ConfigureAwait(false);
                    }
                }).ConfigureAwait(false);
                if (lockResult.Code != 1)
                    return new DosResult<object>(0, null, "未获得应用稳定入口分布式发布锁：" + lockResult.Msg);
                return publishResult ?? new DosResult<object>(0, null, "应用资产发布未执行");
            }
            catch (OperationCanceledException)
            {
                return new DosResult<object>(0, null, "应用资产发布已取消");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "应用资产流式发布失败：" + ex.Message);
            }
        }

        private static async Task<DosResult<object>> FinalizeApplicationStreamPublishCore(
            string osClient,
            JObject param,
            object currentToken,
            string expectedAppId,
            string expectedAppKey,
            IMicroiLockLease lease,
            CancellationToken cancellationToken)
        {
            try
            {
                if (param == null) return new DosResult<object>(0, null, "发布清单不能为空");

                var appIdOrKey = param["AppIdOrKey"]?.Val<string>() ?? param["AppId"]?.Val<string>() ?? param["AppKey"]?.Val<string>();
                var operatorError = ValidateStreamPublishOperator(currentToken, osClient, "application:publish", appIdOrKey);
                if (operatorError != null) return operatorError;
                var requiredPreconditionError = ValidateApplicationStreamFinalizePreconditions(param);
                if (requiredPreconditionError != null)
                    return new DosResult<object>(0, null, requiredPreconditionError);
                await lease.EnsureHeldAsync().ConfigureAwait(false);
                var app = await FindAiApplication(osClient, expectedAppId).ConfigureAwait(false);
                if (app == null) return new DosResult<object>(2, null, "在线 AI 应用不存在");
                var identityError = ValidateApplicationStreamIdentity(app, expectedAppId, expectedAppKey);
                if (identityError != null)
                    return new DosResult<object>(0, null, "发布锁内应用身份校验失败：" + identityError);
                await lease.EnsureHeldAsync().ConfigureAwait(false);
                var expectedStateParseError = ParseApplicationStreamExpectedState(
                    param,
                    out var expectedCurrentVersion,
                    out var expectedAppVersionSupplied,
                    out var expectedAppVersion);
                if (expectedStateParseError != null)
                {
                    return new DosResult<object>(0, new
                    {
                        ExpectedCurrentVersion = expectedCurrentVersion,
                        ExpectedAppVersion = expectedAppVersionSupplied ? expectedAppVersion : null,
                        HasExpectedAppVersion = expectedAppVersionSupplied,
                        ActualCurrentVersion = SafeJInt(app, "CurrentVersion"),
                        ActualAppVersion = SafeJString(app, "AppVersion")
                    }, "发布前应用版本门禁失败：" + expectedStateParseError);
                }
                var expectedStateError = ValidateApplicationStreamExpectedValues(
                    app,
                    expectedCurrentVersion,
                    expectedAppVersionSupplied,
                    expectedAppVersion);
                var appKey = NormalizeMicroServiceKey(SafeJString(app, "AppKey", SafeJString(app, "AppId")));
                // AppType 是官方/社区历史分类；运行形态只读取 ApplicationType。
                var applicationType = SafeJString(app, "ApplicationType", "Web");
                var versionNo = NormalizeApplicationAssetVersion(param["VersionNo"]?.Val<string>() ?? param["BuildVersion"]?.Val<string>());
                var entryPath = NormalizeApplicationAssetRelativePath(param["EntryPath"]?.Val<string>() ?? "index.html");
                var assetsJson = param["Assets"] as JArray ?? param["Manifest"] as JArray ?? new JArray();
                if (assetsJson.Count == 0) return new DosResult<object>(0, null, "Assets 发布清单不能为空");
                if (assetsJson.Count > MaxStreamPublishAssetCount)
                    return new DosResult<object>(0, null, $"单次发布清单最多 {MaxStreamPublishAssetCount} 个文件");

                var assets = new List<StreamPublishAsset>();
                var uniquePaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                long totalSize = 0;
                foreach (var token in assetsJson)
                {
                    if (!(token is JObject item)) return new DosResult<object>(0, null, "Assets 中存在非对象记录");
                    var relativePath = NormalizeApplicationAssetRelativePath(item["Path"]?.Val<string>() ?? item["RelativePath"]?.Val<string>());
                    if (!uniquePaths.Add(relativePath)) return new DosResult<object>(0, null, "发布清单路径重复：" + relativePath);
                    var sha256 = (item["Sha256"]?.Val<string>() ?? item["Hash"]?.Val<string>() ?? string.Empty).Trim().ToLowerInvariant();
                    if (!Regex.IsMatch(sha256, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
                        return new DosResult<object>(0, null, "发布清单 SHA-256 不合法：" + relativePath);
                    var size = item["Size"]?.Val<long?>() ?? 0L;
                    if (size < 0) return new DosResult<object>(0, null, "发布清单文件大小不合法：" + relativePath);
                    if (size > MaxStreamPublishFileBytes)
                        return new DosResult<object>(0, null,
                            $"发布清单单文件不能超过 {MaxStreamPublishFileBytes} bytes（128MB）：" + relativePath);
                    if (totalSize > long.MaxValue - size) return new DosResult<object>(0, null, "发布清单总大小溢出");
                    totalSize += size;
                    if (totalSize > MaxStreamPublishTotalBytes)
                        return new DosResult<object>(0, null,
                            $"单次应用发布总大小不能超过 {MaxStreamPublishTotalBytes} bytes（1GB）");
                    assets.Add(new StreamPublishAsset
                    {
                        RelativePath = relativePath,
                        Sha256 = sha256,
                        Size = size,
                        IsEntry = string.Equals(relativePath, entryPath, StringComparison.OrdinalIgnoreCase),
                        Paths = BuildApplicationAssetPaths(osClient, appKey, applicationType, versionNo, relativePath, sha256)
                    });
                }
                if (!assets.Any(asset => asset.IsEntry)) return new DosResult<object>(0, null, "发布清单缺少入口文件：" + entryPath);

                var rawDeliveryBatchId = SafeJString(param, "DeliveryBatchId");
                var sourceManifestHash = NormalizeOptionalApplicationAssetSha256(
                    SafeJString(param, "SourceManifestHash"),
                    "SourceManifestHash");
                var runtimeManifestAssets = new JArray(assets.Select(asset => new JObject
                {
                    ["Path"] = asset.RelativePath,
                    ["Sha256"] = asset.Sha256,
                    ["Size"] = asset.Size,
                    ["IsEntry"] = asset.IsEntry
                }));
                var runtimeManifestHash = ComputeMicroServiceManifestHash(runtimeManifestAssets);
                var aliasManifest = BuildApplicationAliasRecoveryManifest(assets);
                var suppliedRuntimeManifestHash = NormalizeOptionalApplicationAssetSha256(
                    SafeJString(param, "RuntimeManifestHash"),
                    "RuntimeManifestHash");
                if (!suppliedRuntimeManifestHash.DosIsNullOrWhiteSpace()
                    && !string.Equals(suppliedRuntimeManifestHash, runtimeManifestHash, StringComparison.OrdinalIgnoreCase))
                {
                    return new DosResult<object>(0, null, "RuntimeManifestHash 与服务端计算结果不一致");
                }

                var stablePublishIdSeed = string.Join("\n", osClient, appKey, versionNo, entryPath, runtimeManifestHash);
                var deliveryBatchId = ResolveApplicationAssetDeliveryBatchId(
                    rawDeliveryBatchId,
                    stablePublishIdSeed);
                string requestId;
                if (!SafeJString(param, "RequestId").DosIsNullOrWhiteSpace())
                {
                    requestId = NormalizeApplicationAssetRequestId(SafeJString(param, "RequestId"));
                }
                else if (!rawDeliveryBatchId.DosIsNullOrWhiteSpace())
                {
                    requestId = NormalizeApplicationAssetRequestId(deliveryBatchId);
                }
                else
                {
                    requestId = ResolveApplicationAssetRequestId(
                        null,
                        "publish",
                        stablePublishIdSeed);
                }

                var hdfs = ResolveApplicationAssetHdfs(osClient, out var clientModel);
                var immutableRuntimeEntryFlag = 0;
                var immutableVersionValidationError = await RunApplicationAssetBoundedParallelAsync(
                    assets,
                    async (asset, batchCancellationToken) =>
                    {
                        batchCancellationToken.ThrowIfCancellationRequested();
                        var versionExists = await ApplicationObjectExists(
                            hdfs,
                            clientModel,
                            asset.Paths.VersionPath).ConfigureAwait(false);
                        if (versionExists.Error != null)
                            return asset.RelativePath + "：" + versionExists.Error.Msg;
                        var markerExists = await ApplicationObjectExists(
                            hdfs,
                            clientModel,
                            asset.Paths.IntegrityMarkerPath).ConfigureAwait(false);
                        if (markerExists.Error != null)
                            return asset.RelativePath + "：" + markerExists.Error.Msg;
                        if (!versionExists.Exists || !markerExists.Exists)
                            return "版本资产或完整性标记不存在，拒绝切换稳定入口：" + asset.RelativePath;

                        var markerBytes = await ReadApplicationObjectBytes(
                            hdfs,
                            clientModel,
                            asset.Paths.IntegrityMarkerPath).ConfigureAwait(false);
                        var markerError = ValidateApplicationAssetIntegrityMarker(
                            markerBytes,
                            appKey,
                            versionNo,
                            asset.RelativePath,
                            asset.Sha256,
                            asset.Size);
                        if (markerError != null)
                            return markerError + "，拒绝切换稳定入口：" + asset.RelativePath;

                        // Existence markers prove upload ordering, but they do not
                        // prove that this tenant can read the actual immutable bytes.
                        var bytes = await ReadApplicationObjectBytes(
                            hdfs,
                            clientModel,
                            asset.Paths.VersionPath).ConfigureAwait(false);
                        if (bytes == null)
                            return "版本资产无法从当前租户存储回读，拒绝切换稳定入口：" + asset.RelativePath;
                        var contentError = ValidateApplicationAssetContent(
                            asset.RelativePath,
                            asset.Size,
                            asset.Sha256,
                            bytes,
                            asset.IsEntry);
                        if (contentError != null) return contentError + "；稳定入口尚未切换";
                        if (asset.IsEntry && HasApplicationImmutableRuntimeMarker(bytes))
                            Interlocked.Exchange(ref immutableRuntimeEntryFlag, 1);
                        return null;
                    },
                    cancellationToken,
                    declaredByteSize: asset => asset.Size).ConfigureAwait(false);
                if (immutableVersionValidationError != null)
                {
                    return new DosResult<object>(0, null, immutableVersionValidationError);
                }
                var immutableRuntimeEntry = Volatile.Read(ref immutableRuntimeEntryFlag) == 1;

                var entry = assets.First(asset => asset.IsEntry);
                var previewUrl = await ResolveApplicationPublicUrl(osClient, entry.Paths.RootPath).ConfigureAwait(false);
                var existingVersion = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("mci_ai_app_version", new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "AppId", "=", SafeJString(app, "Id") },
                        new List<object> { "AND", "VersionNo", "=", versionNo }
                    },
                    _PageIndex = 1,
                    _PageSize = 2
                }).ConfigureAwait(false);
                if (existingVersion.Code != 1)
                    return new DosResult<object>(existingVersion.Code, (object)existingVersion.Data, "读取应用版本元数据失败：" + existingVersion.Msg);
                var existingVersionRows = existingVersion.Data == null
                    ? new JArray()
                    : JArray.FromObject((object)existingVersion.Data);
                if (existingVersionRows.Count > 1)
                    return new DosResult<object>(0, existingVersion.Data,
                        "同一 AppId + VersionNo 存在重复版本记录，拒绝非确定性 finalize");
                var versionAlreadyRecorded = existingVersionRows.Count == 1;
                var existingVersionData = versionAlreadyRecorded
                    ? existingVersionRows[0] as JObject ?? JObject.FromObject(existingVersionRows[0])
                    : null;
                if (versionAlreadyRecorded)
                {
                    var existingVersionIdError = ValidateApplicationStreamExistingRecordId(
                        existingVersionData,
                        "应用版本");
                    if (existingVersionIdError != null)
                        return new DosResult<object>(0, null, existingVersionIdError);
                    if (!string.Equals(
                            SafeJString(existingVersionData, "AppId"),
                            expectedAppId,
                            StringComparison.Ordinal))
                    {
                        return new DosResult<object>(0, null, "既有应用版本 AppId 不一致，稳定入口尚未切换");
                    }
                    var existingMetadataConflict = ValidateApplicationStreamVersionMetadata(
                        existingVersionData,
                        versionNo,
                        entry.Paths.VersionPath,
                        requestId,
                        deliveryBatchId,
                        sourceManifestHash,
                        runtimeManifestHash,
                        assets.Count,
                        totalSize,
                        expectedCurrentVersion,
                        expectedAppVersionSupplied,
                        expectedAppVersion);
                    if (existingMetadataConflict != null)
                        return new DosResult<object>(0, null, "既有应用版本不可变元数据冲突，稳定入口尚未切换：" + existingMetadataConflict);
                }

                // All existing record identities are validated before the first
                // HDFS CopyObject or database mutation. Read-only immutable asset
                // verification above is safe; every later effect is fenced by a
                // database CAS or the application lease.
                var fileIdentityPreflight = await ReadApplicationStreamFileRows(
                    osClient,
                    expectedAppId,
                    lease,
                    cancellationToken).ConfigureAwait(false);
                if (fileIdentityPreflight.Error != null)
                    return new DosResult<object>(
                        fileIdentityPreflight.Error.Code,
                        fileIdentityPreflight.Error.Data,
                        fileIdentityPreflight.Error.Msg);

                JObject previousMicroService = null;
                if (string.Equals(applicationType, "MicroService", StringComparison.OrdinalIgnoreCase))
                {
                    var previousServiceResult = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>("sys_microiservice", new
                    {
                        OsClient = osClient,
                        _Where = new List<object> { new List<object> { "MsKey", "=", appKey } },
                        _PageIndex = 1,
                        _PageSize = 2
                    }).ConfigureAwait(false);
                    if (previousServiceResult.Code != 1)
                        return new DosResult<object>(previousServiceResult.Code, previousServiceResult.Data,
                            "读取既有微服务运行元数据失败：" + previousServiceResult.Msg);
                    var previousServiceRows = previousServiceResult.Data == null
                        ? new JArray()
                        : JArray.FromObject((object)previousServiceResult.Data);
                    if (previousServiceRows.Count > 1)
                        return new DosResult<object>(0, previousServiceResult.Data,
                            "同一 MsKey 存在重复微服务运行记录，拒绝非确定性 finalize");
                    if (previousServiceRows.Count == 1)
                    {
                        previousMicroService = previousServiceRows[0] as JObject
                            ?? JObject.FromObject(previousServiceRows[0]);
                        var existingServiceIdError = ValidateApplicationStreamExistingRecordId(
                            previousMicroService,
                            "微服务运行元数据");
                        if (existingServiceIdError != null)
                            return new DosResult<object>(0, null, existingServiceIdError);
                        if (!string.Equals(
                                SafeJString(previousMicroService, "MsKey"),
                                appKey,
                                StringComparison.Ordinal))
                        {
                            return new DosResult<object>(0, null, "既有微服务运行元数据 MsKey 不一致");
                        }
                    }
                }
                var publishedReplay = versionAlreadyRecorded
                                      && string.Equals(
                                          SafeJString(existingVersionData, "Status"),
                                          "Published",
                                          StringComparison.OrdinalIgnoreCase);
                var applicationPointerAlreadyApplied = IsApplicationStreamPublishApplied(
                    app,
                    versionNo,
                    entry.Paths.RootPath,
                    deliveryBatchId);
                var applicationVersionAlreadyApplied = publishedReplay
                    || applicationPointerAlreadyApplied;
                if (expectedStateError != null)
                {
                    var consumedBaselineReplayError = versionAlreadyRecorded
                        ? ValidateApplicationStreamConsumedBaselineReplay(
                            app,
                            existingVersionData,
                            versionNo,
                            entry.Paths.VersionPath,
                            entry.Paths.RootPath,
                            requestId,
                            deliveryBatchId,
                            sourceManifestHash,
                            runtimeManifestHash,
                            assets.Count,
                            totalSize,
                            expectedCurrentVersion,
                            expectedAppVersionSupplied,
                            expectedAppVersion)
                        : "尚无可证明为同一请求的 Published/Verified 版本记录";
                    if (consumedBaselineReplayError != null)
                    {
                        return new DosResult<object>(0, new
                        {
                            ExpectedCurrentVersion = expectedCurrentVersion,
                            ExpectedAppVersion = expectedAppVersion,
                            ActualCurrentVersion = SafeJInt(app, "CurrentVersion"),
                            ActualAppVersion = SafeJString(app, "AppVersion")
                        }, "发布前应用版本门禁失败：" + expectedStateError
                           + "；幂等重放校验：" + consumedBaselineReplayError);
                    }
                }
                var stableAliasesRepaired = false;
                var stableAliasTargets = BuildStreamPublishAliasTargets(assets);

                if (publishedReplay)
                {
                    var replayError = ValidatePublishedApplicationStreamReplay(
                        existingVersionData,
                        versionNo,
                        entry.Paths.VersionPath,
                        requestId,
                        deliveryBatchId,
                        sourceManifestHash,
                        runtimeManifestHash,
                        assets.Count,
                        totalSize,
                        expectedCurrentVersion,
                        expectedAppVersionSupplied,
                        expectedAppVersion);
                    if (replayError != null)
                        return new DosResult<object>(0, null, "已发布版本与本次幂等请求不一致，拒绝覆盖：" + replayError);

                    var appReplayError = ValidatePublishedApplicationMetadataReplay(
                        app,
                        versionNo,
                        entry.Paths.RootPath,
                        deliveryBatchId);
                    if (appReplayError != null)
                        return new DosResult<object>(0, null, "已发布应用元数据与本次幂等请求不一致，拒绝覆盖：" + appReplayError);

                    var stableAliasesVerificationError = await RunApplicationAssetBoundedParallelAsync(
                        stableAliasTargets,
                        async (target, batchCancellationToken) =>
                        {
                            batchCancellationToken.ThrowIfCancellationRequested();
                            var stableExists = await ApplicationObjectExists(
                                hdfs,
                                clientModel,
                                target.Path).ConfigureAwait(false);
                            if (stableExists.Error != null || !stableExists.Exists)
                                return stableExists.Error?.Msg
                                       ?? "稳定入口不存在：" + target.Path;
                            var stableBytes = await ReadApplicationObjectBytes(
                                hdfs,
                                clientModel,
                                target.Path).ConfigureAwait(false);
                            var contentError = ValidateApplicationAssetContent(
                                    target.Asset.RelativePath,
                                    target.Asset.Size,
                                    target.Asset.Sha256,
                                    stableBytes,
                                    target.Asset.IsEntry);
                            return contentError == null
                                ? null
                                : contentError + "；稳定入口幂等回读失败：" + target.Path;
                        },
                        cancellationToken,
                        declaredByteSize: target => target.Asset.Size).ConfigureAwait(false);
                    var stableAliasesVerified = stableAliasesVerificationError == null;

                    if (stableAliasesVerified)
                    {
                        // Published replays are also repair operations. A build
                        // created before stale-row reconciliation may already
                        // have terminal version/application facts while obsolete
                        // dist metadata is still active; reconcile it before the
                        // idempotent success return.
                        var replayFileReconcileResult = await ReconcileStreamPublishedFiles(
                            osClient,
                            app,
                            assets,
                            lease,
                            cancellationToken).ConfigureAwait(false);
                        if (replayFileReconcileResult.Code != 1)
                        {
                            return new DosResult<object>(
                                replayFileReconcileResult.Code,
                                replayFileReconcileResult.Data,
                                "已发布版本的文件元数据对账失败：" + replayFileReconcileResult.Msg);
                        }

                        // Older Published rows may predate AppVersion. Repair only
                        // the missing fact; a conflicting value was rejected above.
                        if (SafeJString(app, "AppVersion").DosIsNullOrWhiteSpace())
                        {
                            var appVersionRepair = await ExecuteApplicationAssetConditionalUpdate(
                                osClient,
                                "sys_microistore",
                                new JObject
                                {
                                    ["AppVersion"] = versionNo,
                                    ["UpdateTime"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                                },
                                BuildApplicationStreamAppSnapshotWhere(app, expectedAppId, expectedAppKey),
                                lease,
                                "补齐应用 AppVersion").ConfigureAwait(false);
                            if (appVersionRepair.Code != 1)
                                return new DosResult<object>(appVersionRepair.Code, appVersionRepair.Data, "补齐应用 AppVersion 失败：" + appVersionRepair.Msg);
                        }

                        // A replay runs under a fresh lease. FencingToken is audit
                        // metadata rather than an immutable request fingerprint, so
                        // persist the latest successful owner without rejecting the
                        // same RequestId/DeliveryBatchId across retries.
                        var replayVersionAudit = await UpsertStreamPublishVersion(
                            osClient,
                            app,
                            versionNo,
                            entry.Paths.VersionPath,
                            previewUrl,
                            assets.Count,
                            totalSize,
                            aliasManifest,
                            param["ChangeSummary"]?.Val<string>(),
                            requestId,
                            deliveryBatchId,
                            sourceManifestHash,
                            runtimeManifestHash,
                            expectedCurrentVersion,
                            expectedAppVersionSupplied,
                            expectedAppVersion,
                            "Published",
                            lease.FencingToken,
                            lease).ConfigureAwait(false);
                        if (replayVersionAudit.Code != 1)
                            return new DosResult<object>(
                                replayVersionAudit.Code,
                                replayVersionAudit.Data,
                                "记录幂等重放 FencingToken 失败：" + replayVersionAudit.Msg);

                        return new DosResult<object>(1, new
                        {
                            AppId = SafeJString(app, "Id"),
                            AppKey = appKey,
                            ApplicationType = applicationType,
                            VersionNo = versionNo,
                            RequestId = requestId,
                            ExpectedCurrentVersion = expectedCurrentVersion,
                            ExpectedAppVersion = expectedAppVersionSupplied ? expectedAppVersion : null,
                            FencingToken = lease.FencingToken,
                            EntryPath = entryPath,
                            PreviewUrl = previewUrl,
                            PublishPath = entry.Paths.RootPath,
                            LatestPath = entry.Paths.LatestPath,
                            VersionPath = entry.Paths.VersionPath,
                            AssetCount = assets.Count,
                            TotalSize = totalSize,
                            DeliveryBatchId = deliveryBatchId,
                            SourceManifestHash = sourceManifestHash,
                            RuntimeManifestHash = runtimeManifestHash,
                            PublishStatus = "Published",
                            VerificationStatus = "Verified",
                            RuntimeVerified = true,
                            Streamed = true,
                            StablePromoted = true,
                            StableAliasesVerified = true,
                            ImmutableRuntimeEntry = immutableRuntimeEntry,
                            Idempotent = true,
                            IdempotentVersion = true
                        }, "相同 RequestId 与 DeliveryBatchId 的已发布版本及稳定入口均已严格校验，已幂等成功");
                    }

                    // Metadata is an exact replay but root/latest is missing or
                    // corrupt. Continue through CopyObject and repair both aliases
                    // instead of hiding the broken runtime behind a DB-only success.
                    stableAliasesRepaired = true;
                }

                // Persist every fallible database prepare step before switching a
                // stable object alias. Status=Verified + AliasStatus=Pending is a
                // durable roll-forward checkpoint: if CopyObject or a later
                // terminal pointer update fails, the same immutable request can
                // replay from this state without inventing a second version.
                var fileReconcileResult = await ReconcileStreamPublishedFiles(
                    osClient,
                    app,
                    assets,
                    lease,
                    cancellationToken).ConfigureAwait(false);
                if (fileReconcileResult.Code != 1)
                {
                    return new DosResult<object>(
                        fileReconcileResult.Code,
                        fileReconcileResult.Data,
                        "发布文件元数据对账失败，稳定入口尚未切换：" + fileReconcileResult.Msg);
                }

                var initialVersionStatus = string.Equals(
                    SafeJString(existingVersionData, "Status"),
                    "Published",
                    StringComparison.OrdinalIgnoreCase)
                    ? "Published"
                    : "Verified";
                var versionResult = await UpsertStreamPublishVersion(
                    osClient,
                    app,
                    versionNo,
                    entry.Paths.VersionPath,
                    previewUrl,
                    assets.Count,
                    totalSize,
                    aliasManifest,
                    param["ChangeSummary"]?.Val<string>(),
                    requestId,
                    deliveryBatchId,
                    sourceManifestHash,
                    runtimeManifestHash,
                    expectedCurrentVersion,
                    expectedAppVersionSupplied,
                    expectedAppVersion,
                    initialVersionStatus,
                    lease.FencingToken,
                    lease).ConfigureAwait(false);
                if (versionResult.Code != 1)
                    return new DosResult<object>(versionResult.Code, versionResult.Data,
                        "保存应用版本 prepare 状态失败，稳定入口尚未切换：" + versionResult.Msg);

                // Immutable-runtime entries load assets from /versions/{VersionNo}/
                // and are the single runtime pointer, so switch them first. Legacy
                // entries still switch last because they reference mutable aliases.
                var promotionGroups = stableAliasTargets
                    .OrderBy(target => GetApplicationAssetPromotionPriority(
                        immutableRuntimeEntry,
                        target.Asset.IsEntry))
                    .ThenBy(target => target.Asset.RelativePath, StringComparer.Ordinal)
                    .ThenBy(target => target.Path, StringComparer.Ordinal)
                    .GroupBy(target => GetApplicationAssetPromotionPriority(
                        immutableRuntimeEntry,
                        target.Asset.IsEntry))
                    .OrderBy(group => group.Key)
                    .ToList();
                foreach (var promotionGroup in promotionGroups)
                {
                    var promotionError = await RunApplicationAssetBoundedParallelAsync(
                        promotionGroup.ToList(),
                        async (target, batchCancellationToken) =>
                        {
                            batchCancellationToken.ThrowIfCancellationRequested();
                            var copy = await ExecuteApplicationAssetSideEffect(
                                lease,
                                () => CopyApplicationObject(
                                    hdfs,
                                    clientModel,
                                    target.Asset.Paths.VersionPath,
                                    target.Path)).ConfigureAwait(false);
                            if (copy.Code != 1)
                            {
                                return $"服务端复制失败：{target.Asset.RelativePath} -> {target.Path}，{copy.Msg}";
                            }
                            var copied = await ApplicationObjectExists(
                                hdfs,
                                clientModel,
                                target.Path).ConfigureAwait(false);
                            if (copied.Error != null || !copied.Exists)
                                return copied.Error?.Msg ?? "服务端复制后回读不存在：" + target.Path;
                            var copiedBytes = await ReadApplicationObjectBytes(
                                hdfs,
                                clientModel,
                                target.Path).ConfigureAwait(false);
                            var copiedContentError = ValidateApplicationAssetContent(
                                target.Asset.RelativePath,
                                target.Asset.Size,
                                target.Asset.Sha256,
                                copiedBytes,
                                target.Asset.IsEntry);
                            return copiedContentError == null
                                ? null
                                : copiedContentError + "；稳定入口复制后严格回读失败：" + target.Path;
                        },
                        cancellationToken,
                        declaredByteSize: target => target.Asset.Size).ConfigureAwait(false);
                    if (promotionError != null)
                        return new DosResult<object>(0, null, promotionError);
                    await lease.EnsureHeldAsync().ConfigureAwait(false);
                }

                // Verify the complete alias set once more while the renewable
                // lease is still held; per-object readback alone cannot detect a
                // later overwrite in the same promotion loop.
                await lease.EnsureHeldAsync().ConfigureAwait(false);
                var finalAliasVerificationError = await RunApplicationAssetBoundedParallelAsync(
                    stableAliasTargets,
                    async (target, batchCancellationToken) =>
                    {
                        batchCancellationToken.ThrowIfCancellationRequested();
                        var finalBytes = await ReadApplicationObjectBytes(
                            hdfs,
                            clientModel,
                            target.Path).ConfigureAwait(false);
                        var finalContentError = ValidateApplicationAssetContent(
                            target.Asset.RelativePath,
                            target.Asset.Size,
                            target.Asset.Sha256,
                            finalBytes,
                            target.Asset.IsEntry);
                        return finalContentError == null
                            ? null
                            : finalContentError + "；稳定入口完整清单终检失败：" + target.Path;
                    },
                    cancellationToken,
                    declaredByteSize: target => target.Asset.Size).ConfigureAwait(false);
                if (finalAliasVerificationError != null)
                    return new DosResult<object>(0, null, finalAliasVerificationError);
                await lease.EnsureHeldAsync().ConfigureAwait(false);

                object microServiceInfo = null;
                if (string.Equals(applicationType, "MicroService", StringComparison.OrdinalIgnoreCase))
                {
                    var source = new JObject
                    {
                        ["MsKey"] = appKey,
                        ["MsName"] = SafeJString(app, "Name", SafeJString(app, "AppName", appKey)),
                        ["StorageMode"] = "file",
                        ["BuildVersion"] = versionNo,
                        ["EntryPath"] = entryPath,
                        ["AssetCount"] = assets.Count,
                        ["TotalSize"] = totalSize,
                        ["DistHash"] = runtimeManifestHash,
                        ["MsUrl"] = $"/micro-app/{Uri.EscapeDataString(osClient)}/{Uri.EscapeDataString(appKey)}/index.html",
                        ["Description"] = SafeJString(app, "Description", SafeJString(app, "AppDetail"))
                    };
                    var publishedAssets = new JArray(assets.Select(asset => new JObject
                    {
                        ["Path"] = asset.RelativePath,
                        ["FilePathName"] = asset.Paths.VersionPath,
                        ["StableFilePathName"] = asset.Paths.RootPath,
                        ["Sha256"] = asset.Sha256,
                        ["Size"] = asset.Size,
                        ["IsEntry"] = asset.IsEntry
                    }));
                    var manifest = new JObject
                    {
                        ["SchemaVersion"] = 2,
                        ["MsKey"] = appKey,
                        ["BuildVersion"] = versionNo,
                        ["EntryPath"] = entryPath,
                        ["StorageMode"] = "file",
                        ["PublishStatus"] = "Published",
                        ["VerificationStatus"] = "Verified",
                        ["RequestId"] = requestId,
                        ["DeliveryBatchId"] = deliveryBatchId,
                        ["SourceManifestHash"] = sourceManifestHash,
                        ["RuntimeManifestHash"] = runtimeManifestHash,
                        ["VerifiedAt"] = DateTime.UtcNow.ToString("O"),
                        ["PublishedAt"] = DateTime.UtcNow.ToString("O"),
                        ["Assets"] = publishedAssets
                    };
                    source["Id"] = previousMicroService != null
                        ? SafeJString(previousMicroService, "Id")
                        : BuildApplicationStreamRecordId("microservice", osClient, expectedAppId, appKey);
                    var serviceData = BuildMicroServiceData(
                        osClient,
                        source,
                        versionNo,
                        publishedAssets.ToString(Formatting.None),
                        manifest.ToString(Formatting.None));
                    var serviceUpsert = await UpsertStreamMicroService(
                        osClient,
                        expectedAppId,
                        appKey,
                        serviceData,
                        previousMicroService,
                        lease).ConfigureAwait(false);
                    if (serviceUpsert.Code != 1)
                        return new DosResult<object>(serviceUpsert.Code, serviceUpsert.Data, "应用商城已发布，但微服务运行元数据更新失败：" + serviceUpsert.Msg);
                    var detailResult = await GetMicroService(osClient, appKey).ConfigureAwait(false);
                    if (detailResult.Code != 1 || detailResult.Data == null)
                    {
                        return new DosResult<object>(0, detailResult.Data,
                            "微服务运行指针写入后无法回读；拒绝执行无 CAS 的旧快照回滚，"
                            + "Verified/Pending checkpoint 已保留供同一交付重放");
                    }
                    if (detailResult.Code == 1 && detailResult.Data != null)
                    {
                        var detail = JObject.FromObject((object)detailResult.Data);
                        var service = detail["Service"] as JObject;
                        if (!IsStreamMicroServiceDesiredState(service, serviceData))
                        {
                            return new DosResult<object>(0, detailResult.Data,
                                "微服务运行元数据严格回读不一致，拒绝同步页面和提交应用终态");
                        }
                        var routes = GetArrayParam(param, "Routes", "routes", "Pages", "pages");
                        var routeResult = await ExecuteApplicationAssetSideEffect(
                            lease,
                            () => SyncMicroServicePages(
                                osClient,
                                SafeJString(service, "Id"),
                                appKey,
                                versionNo,
                                entryPath,
                                routes)).ConfigureAwait(false);
                        if (routeResult.Code != 1)
                        {
                            return new DosResult<object>(0, routeResult.Data,
                                routeResult.Msg + "；拒绝执行可能覆盖更新发布的旧快照回滚，"
                                + "Verified/Pending checkpoint 与当前运行指针已保留供幂等重放");
                        }
                        microServiceInfo = new { Service = service, RouteSync = routeResult.Data };
                    }
                }

                // sys_microiservice is the runtime pointer. Only after it and its
                // page facts are verified do we mark the AI application delivery
                // successful. Failed terminal writes retain the durable
                // Verified/Pending checkpoint for roll-forward; stale owners never
                // restore an unfenced old runtime snapshot over a newer publish.
                var appUpdate = BuildStreamPublishedApplicationUpdate(
                    app,
                    appKey,
                    versionNo,
                    previewUrl,
                    entry.Paths.RootPath,
                    requestId,
                    deliveryBatchId,
                    assets.Count,
                    runtimeManifestHash,
                    applicationVersionAlreadyApplied);
                appUpdate["LastBuildMsg"] = SafeJString(appUpdate, "LastBuildMsg")
                                            + $" FencingToken={lease.FencingToken}.";
                var appUpdateResult = await ExecuteApplicationAssetConditionalUpdate(
                    osClient,
                    "sys_microistore",
                    appUpdate,
                    BuildApplicationStreamAppSnapshotWhere(app, expectedAppId, expectedAppKey),
                    lease,
                    "提交应用发布终态").ConfigureAwait(false);
                if (appUpdateResult.Code != 1)
                {
                    // The conditional write may have succeeded on another node
                    // after an ambiguous response. Accept only the exact same
                    // immutable delivery; a newer/different application pointer
                    // must never be rolled back by this former owner.
                    var currentApp = await FindAiApplication(osClient, expectedAppId).ConfigureAwait(false);
                    if (IsApplicationStreamPublishApplied(
                            currentApp,
                            versionNo,
                            entry.Paths.RootPath,
                            deliveryBatchId))
                    {
                        appUpdateResult = new DosResult(1, currentApp, "应用发布终态已由相同交付幂等提交");
                    }
                    else
                    {
                        return new DosResult<object>(appUpdateResult.Code, appUpdateResult.Data,
                            "应用发布终态 CAS 失败，拒绝回滚可能属于更新发布的运行指针；"
                            + "Verified/Pending checkpoint 已保留，可按同一 RequestId 与 DeliveryBatchId 安全重放："
                            + appUpdateResult.Msg);
                    }
                }

                var publishVersionResult = await UpsertStreamPublishVersion(
                    osClient,
                    app,
                    versionNo,
                    entry.Paths.VersionPath,
                    previewUrl,
                    assets.Count,
                    totalSize,
                    aliasManifest,
                    param["ChangeSummary"]?.Val<string>(),
                    requestId,
                    deliveryBatchId,
                    sourceManifestHash,
                    runtimeManifestHash,
                    expectedCurrentVersion,
                    expectedAppVersionSupplied,
                    expectedAppVersion,
                    "Published",
                    lease.FencingToken,
                    lease).ConfigureAwait(false);
                if (publishVersionResult.Code != 1)
                {
                    return new DosResult<object>(publishVersionResult.Code, publishVersionResult.Data,
                        "版本状态无法从 Verified 切换为 Published；稳定入口、应用终态与"
                        + " Verified/Pending checkpoint 已保留，拒绝无 fencing 回滚，"
                        + "请按同一 RequestId 与 DeliveryBatchId 幂等重放：" + publishVersionResult.Msg);
                }

                // Re-read the whole alias set after both terminal DB CAS writes.
                // This is not claimed as object-store CAS; it narrows the window
                // in which a CopyObject started by an expired owner can land late.
                // Any detected drift leaves the Published/Verified facts durable,
                // and an exact replay repairs aliases from immutable version paths.
                await lease.EnsureHeldAsync().ConfigureAwait(false);
                var committedAliasVerificationError = await RunApplicationAssetBoundedParallelAsync(
                    stableAliasTargets,
                    async (target, batchCancellationToken) =>
                    {
                        batchCancellationToken.ThrowIfCancellationRequested();
                        var committedBytes = await ReadApplicationObjectBytes(
                            hdfs,
                            clientModel,
                            target.Path).ConfigureAwait(false);
                        var committedContentError = ValidateApplicationAssetContent(
                            target.Asset.RelativePath,
                            target.Asset.Size,
                            target.Asset.Sha256,
                            committedBytes,
                            target.Asset.IsEntry);
                        return committedContentError == null
                            ? null
                            : committedContentError + "；终态提交后的稳定入口复核失败：" + target.Path;
                    },
                    cancellationToken,
                    declaredByteSize: target => target.Asset.Size).ConfigureAwait(false);
                if (committedAliasVerificationError != null)
                {
                    return new DosResult<object>(0, new
                    {
                        RecoveryRequired = true,
                        AppId = expectedAppId,
                        AppKey = expectedAppKey,
                        VersionNo = versionNo,
                        RequestId = requestId,
                        DeliveryBatchId = deliveryBatchId
                    }, committedAliasVerificationError
                       + "；终态元数据已持久化，请用相同 RequestId 与 DeliveryBatchId 立即幂等重放以 roll-forward");
                }
                await lease.EnsureHeldAsync().ConfigureAwait(false);

                return new DosResult<object>(1, new
                {
                    AppId = SafeJString(app, "Id"),
                    AppKey = appKey,
                    ApplicationType = applicationType,
                    VersionNo = versionNo,
                    RequestId = requestId,
                    ExpectedCurrentVersion = expectedCurrentVersion,
                    ExpectedAppVersion = expectedAppVersionSupplied ? expectedAppVersion : null,
                    FencingToken = lease.FencingToken,
                    EntryPath = entryPath,
                    PreviewUrl = previewUrl,
                    PublishPath = entry.Paths.RootPath,
                    LatestPath = entry.Paths.LatestPath,
                    VersionPath = entry.Paths.VersionPath,
                    AssetCount = assets.Count,
                    TotalSize = totalSize,
                    DeliveryBatchId = deliveryBatchId,
                    SourceManifestHash = sourceManifestHash,
                    RuntimeManifestHash = runtimeManifestHash,
                    PublishStatus = "Published",
                    VerificationStatus = "Verified",
                    RuntimeVerified = true,
                    Streamed = true,
                    StablePromoted = true,
                    StableAliasesVerified = true,
                    StableAliasesRepaired = stableAliasesRepaired,
                    ImmutableRuntimeEntry = immutableRuntimeEntry,
                    Idempotent = publishedReplay || applicationVersionAlreadyApplied,
                    IdempotentVersion = versionAlreadyRecorded,
                    MicroService = microServiceInfo
                }, stableAliasesRepaired
                    ? "已发布元数据匹配，root/latest 稳定入口已严格回读并完成自愈"
                    : "应用资产已完成流式发布并切换稳定入口");
            }
            catch (OperationCanceledException)
            {
                return new DosResult<object>(0, null, "应用资产发布已取消");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "应用资产流式发布失败：" + ex.Message);
            }
        }
    }
}

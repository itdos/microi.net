using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Security.Cryptography;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Durable, cross-node resumable transport for immutable application assets.
    /// Logical files no longer inherit the legacy 128MiB/1GiB publisher caps.
    /// Bytes stay out of JSON/Jint and are verified again from HDFS on completion.
    /// </summary>
    public static partial class V8McpLogic
    {
        private const string ApplicationAssetMultipartStorageScope =
            "ApplicationAssetMultipartSession";
        private const long ApplicationAssetMultipartDefaultChunkBytes =
            16L * 1024 * 1024;
        private const long ApplicationAssetMultipartChunkUnitBytes =
            1L * 1024 * 1024;
        private const long ApplicationAssetMultipartMaxChunkBytes =
            1024L * 1024 * 1024;
        private const int ApplicationAssetMultipartTargetMaxParts = 10_000;
        private const int ApplicationAssetMultipartProtocolVersion = 1;
        public static bool ApplicationAssetResumableSupported => true;
        public static int ApplicationAssetResumableProtocolVersion =>
            ApplicationAssetMultipartProtocolVersion;
        public static long ApplicationAssetResumableDefaultChunkBytes =>
            ApplicationAssetMultipartDefaultChunkBytes;
        public static long ApplicationAssetResumableMaxChunkBytes =>
            ApplicationAssetMultipartMaxChunkBytes;
        public static int ApplicationAssetResumableMaxParts =>
            ApplicationAssetMultipartTargetMaxParts;
        public static long ApplicationAssetResumableMaxObjectBytes =>
            ApplicationAssetMultipartMaxChunkBytes * ApplicationAssetMultipartTargetMaxParts;
        public static long ApplicationAssetResumableProductSizeLimitBytes => 0;
        private static readonly ConcurrentDictionary<string, long>
            ApplicationAssetMultipartAuditProjectionReady =
                new ConcurrentDictionary<string, long>(StringComparer.OrdinalIgnoreCase);

        private sealed class ApplicationAssetHashingReadStream : Stream
        {
            private readonly Stream _source;
            private readonly SHA256 _sha256 = SHA256.Create();
            private bool _completed;

            public ApplicationAssetHashingReadStream(Stream source)
            {
                _source = source ?? throw new ArgumentNullException(nameof(source));
                if (!source.CanRead) throw new ArgumentException("源流不可读。", nameof(source));
            }

            public long BytesRead { get; private set; }
            public override bool CanRead => true;
            public override bool CanSeek => false;
            public override bool CanWrite => false;
            public override long Length => throw new NotSupportedException();
            public override long Position
            {
                get => BytesRead;
                set => throw new NotSupportedException();
            }

            public string CompleteHash()
            {
                if (!_completed)
                {
                    _sha256.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
                    _completed = true;
                }
                return BitConverter.ToString(_sha256.Hash ?? Array.Empty<byte>())
                    .Replace("-", string.Empty)
                    .ToLowerInvariant();
            }

            private void Observe(byte[] buffer, int offset, int count)
            {
                if (count <= 0) return;
                if (_completed) throw new InvalidOperationException("哈希流已完成。");
                _sha256.TransformBlock(buffer, offset, count, null, 0);
                BytesRead += count;
            }

            public override int Read(byte[] buffer, int offset, int count)
            {
                var read = _source.Read(buffer, offset, count);
                Observe(buffer, offset, read);
                return read;
            }

            public override async Task<int> ReadAsync(
                byte[] buffer,
                int offset,
                int count,
                CancellationToken cancellationToken)
            {
                var read = await _source.ReadAsync(buffer, offset, count, cancellationToken)
                    .ConfigureAwait(false);
                Observe(buffer, offset, read);
                return read;
            }

            public override void Flush() { }
            public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
            public override void SetLength(long value) => throw new NotSupportedException();
            public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

            protected override void Dispose(bool disposing)
            {
                if (disposing) _sha256.Dispose();
                base.Dispose(disposing);
            }
        }

        private sealed class ApplicationAssetHashingWriteStream : Stream
        {
            private readonly Stream _destination;
            private readonly bool _leaveOpen;
            private readonly SHA256 _sha256 = SHA256.Create();
            private bool _completed;

            public ApplicationAssetHashingWriteStream(Stream destination, bool leaveOpen)
            {
                _destination = destination ?? throw new ArgumentNullException(nameof(destination));
                if (!destination.CanWrite)
                    throw new ArgumentException("目标流不可写。", nameof(destination));
                _leaveOpen = leaveOpen;
            }

            public long BytesWritten { get; private set; }
            public override bool CanRead => false;
            public override bool CanSeek => false;
            public override bool CanWrite => true;
            public override long Length => BytesWritten;
            public override long Position
            {
                get => BytesWritten;
                set => throw new NotSupportedException();
            }

            public string CompleteHash()
            {
                if (!_completed)
                {
                    _sha256.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
                    _completed = true;
                }
                return BitConverter.ToString(_sha256.Hash ?? Array.Empty<byte>())
                    .Replace("-", string.Empty)
                    .ToLowerInvariant();
            }

            private void Observe(byte[] buffer, int offset, int count)
            {
                if (count <= 0) return;
                if (_completed) throw new InvalidOperationException("哈希流已完成。");
                _sha256.TransformBlock(buffer, offset, count, null, 0);
                BytesWritten += count;
            }

            public override void Write(byte[] buffer, int offset, int count)
            {
                Observe(buffer, offset, count);
                _destination.Write(buffer, offset, count);
            }

            public override async Task WriteAsync(
                byte[] buffer,
                int offset,
                int count,
                CancellationToken cancellationToken)
            {
                Observe(buffer, offset, count);
                await _destination.WriteAsync(buffer, offset, count, cancellationToken)
                    .ConfigureAwait(false);
            }

            public override void Flush() => _destination.Flush();
            public override Task FlushAsync(CancellationToken cancellationToken) =>
                _destination.FlushAsync(cancellationToken);
            public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
            public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
            public override void SetLength(long value) => throw new NotSupportedException();

            protected override void Dispose(bool disposing)
            {
                if (disposing)
                {
                    _sha256.Dispose();
                    if (!_leaveOpen) _destination.Dispose();
                }
                base.Dispose(disposing);
            }
        }

        private sealed class ApplicationAssetObjectDigest
        {
            public long Size { get; set; }
            public string Sha256 { get; set; }
            public string Error { get; set; }
        }

        public static long CalculateApplicationAssetMultipartChunkBytes(
            long totalBytes,
            long requestedChunkBytes = 0)
        {
            if (totalBytes < 0
                || totalBytes > ApplicationAssetStreamV3JavaScriptMaxSafeInteger)
                throw new ArgumentOutOfRangeException(nameof(totalBytes));
            var required = totalBytes == 0
                ? ApplicationAssetMultipartDefaultChunkBytes
                : (totalBytes + ApplicationAssetMultipartTargetMaxParts - 1L)
                  / ApplicationAssetMultipartTargetMaxParts;
            var requested = requestedChunkBytes <= 0
                ? ApplicationAssetMultipartDefaultChunkBytes
                : requestedChunkBytes;
            var candidate = Math.Max(
                ApplicationAssetMultipartDefaultChunkBytes,
                Math.Max(required, requested));
            var rounded = ((candidate + ApplicationAssetMultipartChunkUnitBytes - 1L)
                           / ApplicationAssetMultipartChunkUnitBytes)
                          * ApplicationAssetMultipartChunkUnitBytes;
            if (rounded > ApplicationAssetMultipartMaxChunkBytes)
                throw new ArgumentOutOfRangeException(
                    nameof(totalBytes),
                    "逻辑文件超过当前对象存储或JavaScript安全整数协商边界。请拆分业务对象后重试。");
            return rounded;
        }

        public static int CalculateApplicationAssetMultipartPartCount(
            long totalBytes,
            long chunkBytes)
        {
            if (totalBytes < 0) throw new ArgumentOutOfRangeException(nameof(totalBytes));
            if (chunkBytes <= 0) throw new ArgumentOutOfRangeException(nameof(chunkBytes));
            var count = totalBytes == 0 ? 0L : (totalBytes + chunkBytes - 1L) / chunkBytes;
            if (count > ApplicationAssetMultipartTargetMaxParts)
                throw new ArgumentOutOfRangeException(nameof(totalBytes), "上传分块超过10000块协商边界。");
            return checked((int)count);
        }

        private static string BuildApplicationAssetMultipartLockKey(
            string osClient,
            string sessionId)
        {
            return "V8Mcp:ApplicationAssetMultipart:"
                   + TenantConfigurationSecurity.NormalizeTenantId(osClient).ToLowerInvariant()
                   + ":"
                   + sessionId;
        }

        private static string BuildApplicationAssetMultipartStagingPrefix(
            ApplicationAssetV3ReleaseIdentity identity,
            string sessionId)
        {
            return BuildApplicationAssetV3ReleasePrefix(identity)
                   + "/.microi-upload/"
                   + sessionId;
        }

        private static string BuildApplicationAssetMultipartPartPath(
            string stagingPrefix,
            int partNumber,
            string sha256)
        {
            return stagingPrefix
                   + "/parts/"
                   + partNumber.ToString("D5", CultureInfo.InvariantCulture)
                   + "-"
                   + sha256
                   + ".part";
        }

        private static async Task<ApplicationAssetObjectDigest> DigestApplicationObjectAsync(
            IMicroiHDFS hdfs,
            OsClientSecret clientModel,
            string path,
            CancellationToken cancellationToken)
        {
            using var sink = new ApplicationAssetHashingWriteStream(Stream.Null, true);
            var read = await hdfs.CopyObjectToStream(new HDFSParam
            {
                ClientModel = clientModel,
                Limit = false,
                FileFullPath = path,
                FileStream = sink,
                NetworkIsInternet = false,
                TimeoutSeconds = 7200,
                CancellationToken = cancellationToken
            }).ConfigureAwait(false);
            return read.Code == 1
                ? new ApplicationAssetObjectDigest
                {
                    Size = sink.BytesWritten,
                    Sha256 = sink.CompleteHash()
                }
                : new ApplicationAssetObjectDigest { Error = read.Msg ?? "HDFS对象流式回读失败" };
        }

        private static async Task<(JObject Row, string Error)> ReadApplicationAssetMultipartSessionAsync(
            string osClient,
            string sessionId)
        {
            var result = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(
                "mci_ai_app_file",
                new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "Id", "=", sessionId },
                        new List<object>
                        {
                            "AND", "StorageScope", "=", ApplicationAssetMultipartStorageScope
                        }
                    }
                }).ConfigureAwait(false);
            if (result.Code == 2 || result.Data == null) return (null, "上传会话不存在或已清理。");
            if (result.Code != 1) return (null, "读取上传会话失败：" + result.Msg);
            return (JObject.FromObject((object)result.Data), null);
        }

        private static JObject ParseApplicationAssetMultipartState(JObject row, out string error)
        {
            error = null;
            var raw = SafeJString(row, "Remark");
            try
            {
                var state = JObject.Parse(raw);
                if (SafeJInt(state, "ProtocolVersion") != ApplicationAssetMultipartProtocolVersion)
                {
                    error = "上传会话协议版本不受支持。";
                    return null;
                }
                return state;
            }
            catch
            {
                error = "上传会话检查点不是合法JSON。";
                return null;
            }
        }

        private static string FormatApplicationAssetMultipartAuditDate(JToken value)
        {
            var raw = value?.ToString() ?? string.Empty;
            return DateTime.TryParse(
                raw,
                CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind,
                out var parsed)
                ? parsed.ToUniversalTime().ToString(
                    "yyyy-MM-dd HH:mm:ss",
                    CultureInfo.InvariantCulture)
                : null;
        }

        /// <summary>
        /// Remark remains the durable checkpoint and is sufficient for old
        /// tenants.  The explicit columns are a read-only administrative
        /// projection.  UploadRecoveryHint is deliberately the last field in
        /// the marketplace package, so its presence proves that the complete
        /// projection was installed before a rolling node starts writing it.
        /// </summary>
        private static void ApplyApplicationAssetMultipartAuditProjection(
            string osClient,
            JObject row,
            JObject state)
        {
            if (row == null || state == null) return;
            var cacheKey = osClient + "|mci_ai_app_file|UploadRecoveryHint";
            var nowTicks = DateTime.UtcNow.Ticks;
            if (ApplicationAssetMultipartAuditProjectionReady.TryGetValue(
                    cacheKey,
                    out var cachedUntil))
            {
                if (cachedUntil == long.MaxValue) goto ProjectionReady;
                if (cachedUntil > nowTicks) return;
            }
            var projectionReady = HasPhysicalColumn(
                osClient,
                "mci_ai_app_file",
                "UploadRecoveryHint");
            ApplicationAssetMultipartAuditProjectionReady[cacheKey] = projectionReady
                ? long.MaxValue
                : DateTime.UtcNow.AddMinutes(1).Ticks;
            if (!projectionReady) return;

        ProjectionReady:

            row["UploadStatus"] = SafeJString(state, "Status");
            row["UploadPhase"] = SafeJString(state, "Phase");
            row["UploadedBytes"] = SafeApplicationAssetV3Long(
                state,
                "Current",
                SafeApplicationAssetV3Long(state, "ReceivedBytes", 0L));
            row["UploadProgress"] = state["ProgressPercent"]?.Value<decimal?>() ?? 0m;
            row["UploadedParts"] = SafeJInt(state, "ReceivedParts");
            row["UploadTotalParts"] = SafeJInt(state, "TotalParts");
            row["UploadHeartbeatAt"] = FormatApplicationAssetMultipartAuditDate(
                state["HeartbeatAt"] ?? state["UpdatedAt"]);
            row["UploadCompletedAt"] = FormatApplicationAssetMultipartAuditDate(
                state["CompletedAt"] ?? state["CanceledAt"]);
            row["UploadLastError"] = SafeJString(state, "LastError");
            row["UploadRecoveryHint"] = SafeJString(state, "RecoveryHint");
        }

        private static async Task<DosResult> UpdateApplicationAssetMultipartSessionAsync(
            string osClient,
            JObject row,
            JObject state,
            IMicroiLockLease lease,
            string operation)
        {
            var oldVersion = Math.Max(1, SafeJInt(row, "Version", 1));
            var heartbeatAt = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture);
            state["UpdatedAt"] = heartbeatAt;
            state["HeartbeatAt"] = heartbeatAt;
            state["LeaseFencingToken"] = lease.FencingToken.ToString(CultureInfo.InvariantCulture);
            var update = new JObject
            {
                ["Id"] = SafeJString(row, "Id"),
                ["Version"] = oldVersion + 1,
                ["Remark"] = state.ToString(Formatting.None),
                ["HdfsPath"] = SafeJString(state, "StagingPrefix"),
                ["PublishHdfsPath"] = SafeJString(state, "FinalPath"),
                ["StorageScope"] = ApplicationAssetMultipartStorageScope,
                ["ContentHash"] = SafeJString(state, "ExpectedSha256"),
                ["Size"] = SafeApplicationAssetV3Long(state, "TotalSize", 0L)
            };
            ApplyApplicationAssetMultipartAuditProjection(osClient, update, state);
            var result = await ExecuteApplicationAssetConditionalUpdate(
                osClient,
                "mci_ai_app_file",
                update,
                new List<object>
                {
                    new List<object> { "Id", "=", SafeJString(row, "Id") },
                    new List<object> { "AND", "Version", "=", oldVersion },
                    new List<object>
                    {
                        "AND", "StorageScope", "=", ApplicationAssetMultipartStorageScope
                    }
                },
                lease,
                operation).ConfigureAwait(false);
            if (result.Code == 1) row["Version"] = oldVersion + 1;
            return result;
        }

        private static JObject BuildApplicationAssetMultipartEvidence(
            JObject state,
            bool idempotent,
            bool completed)
        {
            return new JObject
            {
                ["ProtocolVersion"] = 3,
                ["TransportProtocolVersion"] = ApplicationAssetMultipartProtocolVersion,
                ["Transport"] = "resumable-hdfs-multipart",
                ["PublishMode"] = "stage",
                ["AppId"] = SafeJString(state, "AppId"),
                ["AppKey"] = SafeJString(state, "AppKey"),
                ["VersionNo"] = SafeJString(state, "VersionNo"),
                ["RequestId"] = SafeJString(state, "RequestId"),
                ["RequestFingerprint"] = SafeJString(state, "RequestFingerprint"),
                ["DeliveryBatchId"] = SafeJString(state, "DeliveryBatchId"),
                ["GateEpoch"] = SafeJString(state, "GateEpoch"),
                ["RouteSnapshotJson"] = SafeJString(state, "RouteSnapshotJson"),
                ["RouteSnapshotHash"] = SafeJString(state, "RouteSnapshotHash"),
                ["RuntimeManifestHash"] = SafeJString(state, "RuntimeManifestHash"),
                ["SourceManifestHash"] = SafeJString(state, "SourceManifestHash"),
                ["FencingToken"] = SafeJString(state, "FencingToken"),
                ["LeaseFencingToken"] = SafeJString(state, "LeaseFencingToken"),
                ["Path"] = SafeJString(state, "RelativePath"),
                ["Sha256"] = SafeJString(state, "ExpectedSha256"),
                ["Size"] = SafeApplicationAssetV3Long(state, "TotalSize", 0L),
                ["ReleaseFilePath"] = SafeJString(state, "FinalPath"),
                ["IntegrityMarkerPath"] = SafeJString(state, "MarkerPath"),
                ["SessionId"] = SafeJString(state, "SessionId"),
                ["ChunkSize"] = SafeApplicationAssetV3Long(state, "ChunkSize", 0L),
                ["UploadedParts"] = SafeJInt(state, "ReceivedParts"),
                ["TotalParts"] = SafeJInt(state, "TotalParts"),
                ["Idempotent"] = idempotent,
                // The transport is complete, but the immutable release is still
                // pending the directory-level v3 finalize/pointer commit.
                ["Pending"] = true,
                ["Completed"] = completed,
                ["PointerState"] = "Uncommitted",
                ["PublishState"] = completed ? "Prepared" : "Uploading",
                ["RetryAfterMs"] = completed ? 0 : 1000
            };
        }

        private static DosResult<object> ApplicationAssetMultipartResponse(
            JObject state,
            bool idempotent,
            string message)
        {
            var completed = string.Equals(
                SafeJString(state, "Status"),
                "Succeeded",
                StringComparison.Ordinal);
            var evidence = BuildApplicationAssetMultipartEvidence(state, idempotent, completed);
            evidence["Status"] = SafeJString(state, "Status");
            evidence["ReceivedBytes"] = SafeApplicationAssetV3Long(state, "ReceivedBytes", 0L);
            evidence["HeartbeatAt"] = SafeJString(state, "UpdatedAt");
            evidence["Phase"] = SafeJString(state, "Phase", SafeJString(state, "Status"));
            evidence["Current"] = SafeApplicationAssetV3Long(state, "Current", 0L);
            evidence["Total"] = SafeApplicationAssetV3Long(
                state,
                "Total",
                SafeApplicationAssetV3Long(state, "TotalSize", 0L));
            evidence["ProgressPercent"] = state["ProgressPercent"]?.DeepClone() ?? 0;
            evidence["OperatorId"] = SafeJString(state, "OperatorId");
            evidence["OperatorName"] = SafeJString(state, "OperatorName");
            evidence["CreatedAt"] = SafeJString(state, "CreatedAt");
            evidence["CompletedAt"] = SafeJString(state, "CompletedAt");
            evidence["LastError"] = SafeJString(state, "LastError");
            evidence["RecoveryHint"] = SafeJString(state, "RecoveryHint");
            evidence["Parts"] = state["Parts"]?.DeepClone() ?? new JArray();
            return new DosResult<object>(1, evidence, message);
        }

        private static string ValidateApplicationAssetMultipartImmutableState(
            JObject state,
            string appId,
            string versionNo,
            string relativePath,
            string sha256,
            long totalSize,
            string requestFingerprint)
        {
            if (!string.Equals(SafeJString(state, "AppId"), appId, StringComparison.Ordinal)
                || !string.Equals(SafeJString(state, "VersionNo"), versionNo, StringComparison.Ordinal)
                || !string.Equals(SafeJString(state, "RelativePath"), relativePath, StringComparison.Ordinal)
                || !string.Equals(SafeJString(state, "ExpectedSha256"), sha256, StringComparison.Ordinal)
                || SafeApplicationAssetV3Long(state, "TotalSize", -1L) != totalSize
                || !string.Equals(
                    SafeJString(state, "RequestFingerprint"),
                    requestFingerprint,
                    StringComparison.Ordinal))
            {
                return "同一上传会话Id对应的不可变应用、版本、路径、大小或哈希事实发生冲突。";
            }
            return null;
        }

        private static string NormalizeApplicationAssetMultipartSessionId(string sessionId)
        {
            var value = (sessionId ?? string.Empty).Trim();
            if (!Regex.IsMatch(value, "^mciau-[a-f0-9]{30}$", RegexOptions.CultureInvariant))
                throw new ArgumentException("SessionId格式不合法。", nameof(sessionId));
            return value;
        }

        private static string NormalizeApplicationAssetMultipartSha256(string sha256, string name)
        {
            var value = (sha256 ?? string.Empty).Trim().ToLowerInvariant();
            if (!Regex.IsMatch(value, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
                throw new ArgumentException(name + "必须是64位小写SHA-256。", name);
            return value;
        }

        private static JArray OrderedApplicationAssetMultipartParts(JObject state)
        {
            return new JArray((state["Parts"] as JArray ?? new JArray())
                .OfType<JObject>()
                .OrderBy(item => SafeJInt(item, "Number"))
                .Select(item => item.DeepClone()));
        }

        private static JObject FindApplicationAssetMultipartPart(JObject state, int partNumber)
        {
            return (state["Parts"] as JArray ?? new JArray())
                .OfType<JObject>()
                .FirstOrDefault(item => SafeJInt(item, "Number") == partNumber);
        }

        private static long ExpectedApplicationAssetMultipartPartSize(
            JObject state,
            int partNumber)
        {
            var totalSize = SafeApplicationAssetV3Long(state, "TotalSize", -1L);
            var chunkSize = SafeApplicationAssetV3Long(state, "ChunkSize", -1L);
            var totalParts = SafeJInt(state, "TotalParts", -1);
            if (partNumber <= 0 || partNumber > totalParts || totalSize < 0 || chunkSize <= 0)
                return -1;
            var offset = checked((long)(partNumber - 1) * chunkSize);
            return Math.Min(chunkSize, totalSize - offset);
        }

        private static JObject BuildApplicationAssetMultipartProtocolSnapshot(JObject param)
        {
            var result = new JObject();
            foreach (var field in new[]
                     {
                         "ProtocolVersion", "PublishMode", "ExpectedGateEpoch", "RequestId",
                         "RequestFingerprint", "DeliveryBatchId", "SourceManifestHash",
                         "RuntimeManifestHash", "RouteSnapshotJson", "RouteSnapshotHash",
                         "ExpectedCurrentVersion", "ExpectedAppVersion", "ExpectedPublishFence",
                         "ExpectedPublishRowVersion", "ExpectedVersionRowVersion",
                         "ExpectedActivePublishVersionId", "ExpectedCommittedPublishVersionId"
                     })
            {
                if (param?[field] != null) result[field] = param[field].DeepClone();
            }
            return result;
        }

        public static async Task<DosResult<object>> InitiateApplicationAssetMultipart(
            string osClient,
            JObject param,
            object currentToken,
            CancellationToken cancellationToken = default)
        {
            try
            {
                param = param ?? new JObject();
                var appIdOrKey = SafeJString(param, "AppIdOrKey");
                var operatorError = ValidateStreamPublishOperator(
                    currentToken,
                    osClient,
                    "application-asset:upload",
                    appIdOrKey);
                if (operatorError != null) return operatorError;
                var protocolError = ParseApplicationAssetV3ProtocolRequest(param, out var request);
                if (protocolError != null) return new DosResult<object>(0, null, protocolError);
                if (!string.Equals(request.PublishMode, "stage", StringComparison.Ordinal))
                    return new DosResult<object>(0, null, "断点上传只允许PublishMode=stage。");

                var coordinate = ResolveApplicationAssetStreamGateCoordinate(osClient);
                var gate = ReadApplicationAssetStreamGateStrong(
                    osClient,
                    coordinate.OsClientType,
                    coordinate.OsClientNetwork,
                    null,
                    false);
                var gateError = ValidateApplicationAssetStreamGate(
                    gate,
                    request.ProtocolVersion,
                    request.ExpectedGateEpoch);
                if (gateError != null) return new DosResult<object>(0, null, gateError);

                var versionNo = NormalizeApplicationAssetVersion(SafeJString(param, "VersionNo"));
                var relativePath = SafeJString(param, "RelativePath");
                var pathError = ValidateApplicationAssetV3RelativePath(relativePath);
                if (pathError != null) return new DosResult<object>(0, null, pathError);
                relativePath = NormalizeApplicationAssetRelativePath(relativePath);
                var expectedSha256 = NormalizeApplicationAssetMultipartSha256(
                    SafeJString(param, "ExpectedSha256"),
                    "ExpectedSha256");
                var totalSize = SafeApplicationAssetV3Long(param, "TotalSize", -1L);
                if (totalSize < 0 || totalSize > ApplicationAssetStreamV3JavaScriptMaxSafeInteger)
                    return new DosResult<object>(0, null, "TotalSize必须是JavaScript安全整数范围内的非负整数。");
                var requestedChunkBytes = SafeApplicationAssetV3Long(param, "RequestedChunkSize", 0L);
                var chunkSize = CalculateApplicationAssetMultipartChunkBytes(
                    totalSize,
                    requestedChunkBytes);
                var totalParts = CalculateApplicationAssetMultipartPartCount(totalSize, chunkSize);

                var app = ReadApplicationAssetV3AppStrong(osClient, appIdOrKey, null, false);
                if (app == null) return new DosResult<object>(2, null, "在线AI应用不存在。");
                var appError = ValidateApplicationAssetV3AppExpectedState(app, request);
                if (appError != null) return new DosResult<object>(0, null, appError);
                var appId = SafeJString(app, "Id");
                var appKey = NormalizeMicroServiceKey(
                    SafeJString(app, "AppKey", SafeJString(app, "AppId")));
                var applicationType = SafeJString(app, "ApplicationType", "Web").ToLowerInvariant();
                if (!new[] { "web", "uniapp", "microservice" }.Contains(
                        applicationType,
                        StringComparer.Ordinal))
                    return new DosResult<object>(0, null, "断点上传只支持Web、UniApp和MicroService应用。");

                var versionRows = ReadApplicationAssetV3VersionRowsStrong(
                    osClient,
                    appId,
                    versionNo,
                    null,
                    false);
                var versionError = ValidateApplicationAssetV3ExpectedVersionRow(
                    versionRows,
                    request,
                    appId,
                    versionNo,
                    true);
                if (versionError != null) return new DosResult<object>(0, null, versionError);

                var identity = new ApplicationAssetV3ReleaseIdentity
                {
                    Tenant = TenantConfigurationSecurity.NormalizeTenantId(osClient).ToLowerInvariant(),
                    Kind = "runtime",
                    AppKey = appKey,
                    Version = versionNo,
                    RequestFingerprint = request.RequestFingerprint
                };
                var identityError = ValidateApplicationAssetV3ReleaseIdentity(identity);
                if (identityError != null) return new DosResult<object>(0, null, identityError);
                var paths = BuildApplicationAssetV3Paths(identity, relativePath, expectedSha256);
                var sessionId = BuildApplicationStreamRecordId(
                    "upload",
                    osClient,
                    appId,
                    string.Join("\n", versionNo, request.RequestFingerprint, relativePath, expectedSha256));
                var stagingPrefix = BuildApplicationAssetMultipartStagingPrefix(identity, sessionId);
                var currentUser = GetMcpOperator(currentToken);
                var now = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture);
                var state = new JObject
                {
                    ["ProtocolVersion"] = ApplicationAssetMultipartProtocolVersion,
                    ["SessionId"] = sessionId,
                    ["Status"] = "Uploading",
                    ["Phase"] = "Uploading",
                    ["AppId"] = appId,
                    ["AppKey"] = appKey,
                    ["ApplicationType"] = applicationType,
                    ["VersionNo"] = versionNo,
                    ["RelativePath"] = relativePath,
                    ["ExpectedSha256"] = expectedSha256,
                    ["TotalSize"] = totalSize,
                    ["ChunkSize"] = chunkSize,
                    ["TotalParts"] = totalParts,
                    ["ReceivedParts"] = 0,
                    ["ReceivedBytes"] = 0,
                    ["Current"] = 0,
                    ["Total"] = totalSize,
                    ["ProgressPercent"] = totalSize == 0 ? 100 : 0,
                    ["RequestId"] = request.RequestId,
                    ["RequestFingerprint"] = request.RequestFingerprint,
                    ["DeliveryBatchId"] = request.DeliveryBatchId,
                    ["GateEpoch"] = FormatApplicationAssetV3Int64(request.ExpectedGateEpoch),
                    ["RouteSnapshotJson"] = request.RouteSnapshotJson,
                    ["RouteSnapshotHash"] = request.RouteSnapshotHash,
                    ["RuntimeManifestHash"] = request.RuntimeManifestHash,
                    ["SourceManifestHash"] = request.SourceManifestHash,
                    ["FencingToken"] = FormatApplicationAssetV3Int64(
                        BuildApplicationAssetV3NextPublishFence(request.ExpectedPublishFence)),
                    ["StagingPrefix"] = stagingPrefix,
                    ["FinalPath"] = paths.VersionPath,
                    ["MarkerPath"] = paths.IntegrityMarkerPath,
                    ["OperatorId"] = SafeJString(currentUser, "Id", SafeJString(currentUser, "UserId")),
                    ["OperatorName"] = SafeJString(currentUser, "Name", SafeJString(currentUser, "Account")),
                    ["CreatedAt"] = now,
                    ["UpdatedAt"] = now,
                    ["HeartbeatAt"] = now,
                    ["RecoveryHint"] = "重新查询会话状态并仅补传缺失块；同一SessionId必须复用不可变文件哈希。",
                    ["Protocol"] = BuildApplicationAssetMultipartProtocolSnapshot(param),
                    ["Parts"] = new JArray()
                };

                DosResult<object> operationResult = null;
                var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
                {
                    Key = BuildApplicationAssetMultipartLockKey(osClient, sessionId),
                    OsClient = osClient,
                    Expiry = TimeSpan.FromMinutes(2),
                    AcquireTimeout = TimeSpan.FromMinutes(1),
                    CancellationToken = cancellationToken,
                    RetryIntervalMs = 50,
                    UseExponentialBackoff = true,
                    AutoRenew = true,
                    MaxLeaseDuration = TimeSpan.FromMinutes(30)
                }, async lease =>
                {
                    var existing = await ReadApplicationAssetMultipartSessionAsync(
                        osClient,
                        sessionId).ConfigureAwait(false);
                    if (existing.Row != null)
                    {
                        var existingState = ParseApplicationAssetMultipartState(
                            existing.Row,
                            out var parseError);
                        if (parseError != null)
                        {
                            operationResult = new DosResult<object>(0, null, parseError);
                            return;
                        }
                        var conflict = ValidateApplicationAssetMultipartImmutableState(
                            existingState,
                            appId,
                            versionNo,
                            relativePath,
                            expectedSha256,
                            totalSize,
                            request.RequestFingerprint);
                        operationResult = conflict == null
                            ? ApplicationAssetMultipartResponse(existingState, true, "上传会话已按不可变事实幂等复用。")
                            : new DosResult<object>(0, null, conflict);
                        return;
                    }

                    state["LeaseFencingToken"] = lease.FencingToken.ToString(
                        CultureInfo.InvariantCulture);
                    var row = new JObject
                    {
                        ["Id"] = sessionId,
                        ["AppId"] = appId,
                        ["AppName"] = SafeJString(app, "Name", SafeJString(app, "AppName")),
                        ["VersionId"] = request.RequestFingerprint.Substring(0, 36),
                        ["FilePath"] = "upload/" + versionNo + "/" + relativePath,
                        ["FilePathHash"] = Sha256Hex(
                            "upload/" + versionNo + "/" + relativePath),
                        ["FileName"] = Path.GetFileName(relativePath),
                        ["FileType"] = Path.GetExtension(relativePath).TrimStart('.').ToLowerInvariant(),
                        ["HdfsPath"] = stagingPrefix,
                        ["PublishHdfsPath"] = paths.VersionPath,
                        ["StorageScope"] = ApplicationAssetMultipartStorageScope,
                        ["ContentHash"] = expectedSha256,
                        ["Size"] = totalSize,
                        ["Version"] = 1,
                        ["IsDirectory"] = 0,
                        ["UserId"] = SafeJString(
                            currentUser,
                            "Id",
                            SafeJString(currentUser, "UserId")),
                        ["UserName"] = SafeJString(
                            currentUser,
                            "Name",
                            SafeJString(currentUser, "Account")),
                        ["Remark"] = state.ToString(Formatting.None)
                    };
                    ApplyApplicationAssetMultipartAuditProjection(osClient, row, state);
                    var add = await ExecuteApplicationAssetSideEffect(
                        lease,
                        () => MicroiEngine.FormEngine.AddFormDataAsync(
                            "mci_ai_app_file",
                            BuildTrustedMcpFormWriteParam(osClient, row))).ConfigureAwait(false);
                    if (add.Code == 1)
                    {
                        operationResult = ApplicationAssetMultipartResponse(state, false, "断点上传会话已创建。");
                        return;
                    }

                    var concurrent = await ReadApplicationAssetMultipartSessionAsync(
                        osClient,
                        sessionId).ConfigureAwait(false);
                    if (concurrent.Row != null)
                    {
                        var concurrentState = ParseApplicationAssetMultipartState(
                            concurrent.Row,
                            out var concurrentError);
                        var conflict = concurrentError ?? ValidateApplicationAssetMultipartImmutableState(
                            concurrentState,
                            appId,
                            versionNo,
                            relativePath,
                            expectedSha256,
                            totalSize,
                            request.RequestFingerprint);
                        operationResult = conflict == null
                            ? ApplicationAssetMultipartResponse(concurrentState, true, "并发创建已按确定性主键收敛。")
                            : new DosResult<object>(0, null, conflict);
                        return;
                    }
                    operationResult = new DosResult<object>(add.Code, add.Data, "创建上传会话失败：" + add.Msg);
                }).ConfigureAwait(false);
                if (lockResult.Code != 1)
                    return new DosResult<object>(0, null, "未获得上传会话分布式锁：" + lockResult.Msg);
                return operationResult ?? new DosResult<object>(0, null, "上传会话未执行。");
            }
            catch (OperationCanceledException)
            {
                return new DosResult<object>(0, null, "创建上传会话已取消。");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "创建上传会话失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> GetApplicationAssetMultipartStatus(
            string osClient,
            JObject param,
            object currentToken,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var appIdOrKey = SafeJString(param, "AppIdOrKey");
                var operatorError = ValidateStreamPublishOperator(
                    currentToken,
                    osClient,
                    "application-asset:upload",
                    appIdOrKey);
                if (operatorError != null) return operatorError;
                var sessionId = NormalizeApplicationAssetMultipartSessionId(
                    SafeJString(param, "SessionId"));
                var session = await ReadApplicationAssetMultipartSessionAsync(
                    osClient,
                    sessionId).ConfigureAwait(false);
                if (session.Error != null) return new DosResult<object>(2, null, session.Error);
                var state = ParseApplicationAssetMultipartState(session.Row, out var parseError);
                if (parseError != null) return new DosResult<object>(0, null, parseError);
                if (!string.Equals(SafeJString(state, "AppId"), appIdOrKey, StringComparison.Ordinal)
                    && !string.Equals(SafeJString(state, "AppKey"), appIdOrKey, StringComparison.Ordinal))
                    return new DosResult<object>(0, null, "上传会话不属于指定应用。");
                cancellationToken.ThrowIfCancellationRequested();
                return ApplicationAssetMultipartResponse(state, true, "上传会话状态已回读。");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "读取上传会话失败：" + ex.Message);
            }
        }
    }
}

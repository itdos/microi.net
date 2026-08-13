using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public static partial class V8McpLogic
    {
        private sealed class ApplicationAssetMultipartComposeResult
        {
            public DosResult PutResult { get; set; }
            public ApplicationAssetObjectDigest Digest { get; set; }
            public string Error { get; set; }
        }

        private static void RefreshApplicationAssetMultipartProgress(JObject state)
        {
            var parts = OrderedApplicationAssetMultipartParts(state);
            state["Parts"] = parts;
            state["ReceivedParts"] = parts.Count;
            var receivedBytes = parts
                .OfType<JObject>()
                .Aggregate(0L, (current, item) => checked(
                    current + SafeApplicationAssetV3Long(item, "Size", 0L)));
            var totalBytes = SafeApplicationAssetV3Long(state, "TotalSize", 0L);
            state["ReceivedBytes"] = receivedBytes;
            state["Current"] = receivedBytes;
            state["Total"] = totalBytes;
            state["Phase"] = "Uploading";
            state["ProgressPercent"] = totalBytes == 0
                ? 100m
                : Math.Round(
                    Math.Min(100m, receivedBytes * 100m / totalBytes),
                    2,
                    MidpointRounding.AwayFromZero);
        }

        private static bool IsApplicationAssetMultipartUploadState(string status)
        {
            return string.Equals(status, "Uploading", StringComparison.Ordinal)
                   || string.Equals(status, "Failed", StringComparison.Ordinal);
        }

        private static async Task<DosResult<object>> PersistApplicationAssetMultipartFailureAsync(
            string osClient,
            JObject row,
            JObject state,
            IMicroiLockLease lease,
            string message,
            string operation)
        {
            state["Status"] = "Failed";
            state["LastError"] = message;
            state["FailureCount"] = SafeJInt(state, "FailureCount") + 1;
            state["FailedAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture);
            state["RecoveryHint"] =
                "会话与已校验分片仍保留；查询状态后补传缺失块，再重试完成操作。";
            var update = await UpdateApplicationAssetMultipartSessionAsync(
                osClient,
                row,
                state,
                lease,
                operation).ConfigureAwait(false);
            var suffix = update.Code == 1
                ? string.Empty
                : "；会话错误检查点写入失败：" + update.Msg;
            return new DosResult<object>(0, BuildApplicationAssetMultipartEvidence(
                state,
                false,
                false), message + suffix);
        }

        private static async Task<ApplicationAssetObjectDigest> ComposeApplicationAssetMultipartAsync(
            IMicroiHDFS hdfs,
            OsClientSecret clientModel,
            JArray orderedParts,
            Stream destination,
            CancellationToken cancellationToken)
        {
            using var totalWriter = new ApplicationAssetHashingWriteStream(destination, true);
            foreach (var part in orderedParts.OfType<JObject>())
            {
                cancellationToken.ThrowIfCancellationRequested();
                using var partWriter = new ApplicationAssetHashingWriteStream(totalWriter, true);
                var read = await hdfs.CopyObjectToStream(new HDFSParam
                {
                    ClientModel = clientModel,
                    Limit = false,
                    FileFullPath = SafeJString(part, "Path"),
                    FileStream = partWriter,
                    NetworkIsInternet = false,
                    TimeoutSeconds = 7200,
                    CancellationToken = cancellationToken
                }).ConfigureAwait(false);
                if (read.Code != 1)
                    throw new IOException(
                        $"读取第{SafeJInt(part, "Number")}块失败：{read.Msg}");
                var partHash = partWriter.CompleteHash();
                var expectedSize = SafeApplicationAssetV3Long(part, "Size", -1L);
                var expectedHash = SafeJString(part, "Sha256");
                if (partWriter.BytesWritten != expectedSize
                    || !string.Equals(partHash, expectedHash, StringComparison.Ordinal))
                {
                    throw new InvalidDataException(
                        $"第{SafeJInt(part, "Number")}块HDFS回读不一致："
                        + $"ExpectedSize={expectedSize},ActualSize={partWriter.BytesWritten},"
                        + $"ExpectedSha256={expectedHash},ActualSha256={partHash}");
                }
            }
            await totalWriter.FlushAsync(cancellationToken).ConfigureAwait(false);
            return new ApplicationAssetObjectDigest
            {
                Size = totalWriter.BytesWritten,
                Sha256 = totalWriter.CompleteHash()
            };
        }

        private static async Task<ApplicationAssetMultipartComposeResult>
            PutComposedApplicationAssetMultipartAsync(
                IMicroiHDFS hdfs,
                OsClientSecret clientModel,
                JArray orderedParts,
                string finalPath,
                long totalSize,
                IMicroiLockLease lease,
                CancellationToken cancellationToken)
        {
            var temporaryPath = Path.Combine(
                Path.GetTempPath(),
                "microi-application-asset-compose-" + Guid.NewGuid().ToString("N") + ".tmp");
            try
            {
                // Object-store SDKs own the lifetime of their upload stream and may
                // close it as soon as a provider request fails. Feeding that stream
                // through an anonymous pipe turns the useful provider error into a
                // producer-side "Broken pipe" and can leave an immutable destination
                // object with unchecked content. Compose to a DeleteOnClose file
                // first: memory stays bounded, every source part is verified before
                // publication, and Aliyun OSS receives the seekable stream it expects
                // for multipart retries. This also works for multi-gigabyte objects.
                await using var composed = new FileStream(
                    temporaryPath,
                    FileMode.CreateNew,
                    FileAccess.ReadWrite,
                    FileShare.None,
                    1024 * 1024,
                    FileOptions.Asynchronous | FileOptions.DeleteOnClose | FileOptions.SequentialScan);
                var digest = await ComposeApplicationAssetMultipartAsync(
                    hdfs,
                    clientModel,
                    orderedParts,
                    composed,
                    cancellationToken).ConfigureAwait(false);
                if (digest.Size != totalSize)
                {
                    return new ApplicationAssetMultipartComposeResult
                    {
                        Digest = digest,
                        Error = $"HDFS分片合并长度不一致：Expected={totalSize},Actual={digest.Size}"
                    };
                }
                await composed.FlushAsync(cancellationToken).ConfigureAwait(false);
                composed.Position = 0;
                var put = await ExecuteApplicationAssetSideEffect(
                    lease,
                    () => PutApplicationObject(
                        hdfs,
                        clientModel,
                        finalPath,
                        composed,
                        totalSize,
                        cancellationToken)).ConfigureAwait(false);
                return new ApplicationAssetMultipartComposeResult
                {
                    PutResult = put,
                    Digest = digest,
                    Error = put.Code == 1 ? null : "最终对象流式写入失败：" + put.Msg
                };
            }
            catch (Exception ex)
            {
                return new ApplicationAssetMultipartComposeResult
                {
                    Error = "最终对象合并异常：" + ex.Message
                };
            }
            finally
            {
                try { if (File.Exists(temporaryPath)) File.Delete(temporaryPath); } catch { }
            }
        }

        public static async Task<DosResult<object>> UploadApplicationAssetMultipartPart(
            string osClient,
            string sessionId,
            int partNumber,
            string expectedPartSha256,
            Stream requestBody,
            long contentLength,
            object currentToken,
            CancellationToken cancellationToken = default)
        {
            try
            {
                sessionId = NormalizeApplicationAssetMultipartSessionId(sessionId);
                expectedPartSha256 = NormalizeApplicationAssetMultipartSha256(
                    expectedPartSha256,
                    "ExpectedPartSha256");
                if (requestBody == null || !requestBody.CanRead)
                    return new DosResult<object>(0, null, "分片请求体不可读。");

                var initial = await ReadApplicationAssetMultipartSessionAsync(
                    osClient,
                    sessionId).ConfigureAwait(false);
                if (initial.Error != null) return new DosResult<object>(2, null, initial.Error);
                var initialState = ParseApplicationAssetMultipartState(initial.Row, out var initialError);
                if (initialError != null) return new DosResult<object>(0, null, initialError);
                var operatorError = ValidateStreamPublishOperator(
                    currentToken,
                    osClient,
                    "application-asset:upload-part",
                    SafeJString(initialState, "AppId"));
                if (operatorError != null) return operatorError;
                var tenantUploadOptions = FileUploadSecurityOptions.Load(
                    OsClientExtend.GetClient(osClient)?.OsClientModel);
                if (!tenantUploadOptions.UploadEnabled)
                    return new DosResult<object>(
                        FileUploadSecurity.CreateTenantUploadDisabledResult(osClient).Code,
                        null,
                        FileUploadSecurity.CreateTenantUploadDisabledResult(osClient).Msg);

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
                    MaxLeaseDuration = TimeSpan.FromHours(2)
                }, async lease =>
                {
                    var session = await ReadApplicationAssetMultipartSessionAsync(
                        osClient,
                        sessionId).ConfigureAwait(false);
                    if (session.Error != null)
                    {
                        operationResult = new DosResult<object>(2, null, session.Error);
                        return;
                    }
                    var state = ParseApplicationAssetMultipartState(session.Row, out var parseError);
                    if (parseError != null)
                    {
                        operationResult = new DosResult<object>(0, null, parseError);
                        return;
                    }
                    var status = SafeJString(state, "Status");
                    if (string.Equals(status, "Succeeded", StringComparison.Ordinal))
                    {
                        operationResult = ApplicationAssetMultipartResponse(
                            state,
                            true,
                            "文件已完成合并，无需再上传分片。");
                        return;
                    }
                    if (!IsApplicationAssetMultipartUploadState(status))
                    {
                        operationResult = new DosResult<object>(
                            0,
                            BuildApplicationAssetMultipartEvidence(state, false, false),
                            "当前会话状态不允许上传分片：" + status);
                        return;
                    }
                    var expectedSize = ExpectedApplicationAssetMultipartPartSize(state, partNumber);
                    if (expectedSize < 0)
                    {
                        operationResult = new DosResult<object>(0, null, "PartNumber超出会话范围。");
                        return;
                    }
                    if (contentLength != expectedSize)
                    {
                        operationResult = new DosResult<object>(
                            0,
                            null,
                            $"分片长度不一致：Expected={expectedSize},Actual={contentLength}。");
                        return;
                    }

                    var hdfs = ResolveApplicationAssetHdfs(osClient, out var clientModel);
                    var existing = FindApplicationAssetMultipartPart(state, partNumber);
                    if (existing != null)
                    {
                        if (SafeApplicationAssetV3Long(existing, "Size", -1L) != expectedSize
                            || !string.Equals(
                                SafeJString(existing, "Sha256"),
                                expectedPartSha256,
                                StringComparison.Ordinal))
                        {
                            operationResult = new DosResult<object>(
                                0,
                                null,
                                "同一PartNumber已绑定不同大小或SHA-256，拒绝覆盖。");
                            return;
                        }
                        var existingDigest = await ExecuteApplicationAssetSideEffect(
                            lease,
                            () => DigestApplicationObjectAsync(
                                hdfs,
                                clientModel,
                                SafeJString(existing, "Path"),
                                cancellationToken)).ConfigureAwait(false);
                        if (existingDigest.Error == null
                            && existingDigest.Size == expectedSize
                            && string.Equals(
                                existingDigest.Sha256,
                                expectedPartSha256,
                                StringComparison.Ordinal))
                        {
                            operationResult = ApplicationAssetMultipartResponse(
                                state,
                                true,
                                $"第{partNumber}块已通过HDFS回读，幂等跳过。");
                            return;
                        }
                        // Metadata exists but the temporary object was lost or
                        // corrupted. Rewriting the deterministic same-hash part
                        // key is safe; the checkpoint is replaced only after a
                        // second HDFS digest succeeds.
                        (state["Parts"] as JArray)?.Remove(existing);
                        RefreshApplicationAssetMultipartProgress(state);
                    }

                    var partPath = BuildApplicationAssetMultipartPartPath(
                        SafeJString(state, "StagingPrefix"),
                        partNumber,
                        expectedPartSha256);
                    using var hashingBody = new ApplicationAssetHashingReadStream(requestBody);
                    var put = await ExecuteApplicationAssetSideEffect(
                        lease,
                        () => PutApplicationObject(
                            hdfs,
                            clientModel,
                            partPath,
                            hashingBody,
                            contentLength,
                            cancellationToken)).ConfigureAwait(false);
                    var actualHash = hashingBody.CompleteHash();
                    if (put.Code != 1
                        || hashingBody.BytesRead != expectedSize
                        || !string.Equals(actualHash, expectedPartSha256, StringComparison.Ordinal))
                    {
                        try
                        {
                            await ExecuteApplicationAssetSideEffect(
                                lease,
                                () => hdfs.DeleteObject(new HDFSParam
                                {
                                    ClientModel = clientModel,
                                    Limit = false,
                                    FileFullPath = partPath,
                                    CancellationToken = cancellationToken
                                })).ConfigureAwait(false);
                        }
                        catch { }
                        var failure = put.Code != 1
                            ? "HDFS分片写入失败：" + put.Msg
                            : $"分片流校验失败：ExpectedSize={expectedSize},ActualSize={hashingBody.BytesRead},"
                              + $"ExpectedSha256={expectedPartSha256},ActualSha256={actualHash}";
                        operationResult = await PersistApplicationAssetMultipartFailureAsync(
                            osClient,
                            session.Row,
                            state,
                            lease,
                            failure,
                            "记录分片写入失败").ConfigureAwait(false);
                        return;
                    }

                    var storedDigest = await ExecuteApplicationAssetSideEffect(
                        lease,
                        () => DigestApplicationObjectAsync(
                            hdfs,
                            clientModel,
                            partPath,
                            cancellationToken)).ConfigureAwait(false);
                    if (storedDigest.Error != null
                        || storedDigest.Size != expectedSize
                        || !string.Equals(
                            storedDigest.Sha256,
                            expectedPartSha256,
                            StringComparison.Ordinal))
                    {
                        var failure = "HDFS分片回读校验失败："
                                      + (storedDigest.Error ??
                                         $"ExpectedSize={expectedSize},ActualSize={storedDigest.Size},"
                                         + $"ExpectedSha256={expectedPartSha256},ActualSha256={storedDigest.Sha256}");
                        operationResult = await PersistApplicationAssetMultipartFailureAsync(
                            osClient,
                            session.Row,
                            state,
                            lease,
                            failure,
                            "记录分片回读失败").ConfigureAwait(false);
                        return;
                    }

                    var parts = state["Parts"] as JArray ?? new JArray();
                    parts.Add(new JObject
                    {
                        ["Number"] = partNumber,
                        ["Size"] = expectedSize,
                        ["Sha256"] = expectedPartSha256,
                        ["Path"] = partPath,
                        ["UploadedAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture)
                    });
                    state["Parts"] = parts;
                    state["Status"] = "Uploading";
                    state["LastError"] = null;
                    state["LastPartAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture);
                    state["RecoveryHint"] = "连接中断后查询本会话，客户端只需补传缺失PartNumber。";
                    RefreshApplicationAssetMultipartProgress(state);
                    var update = await UpdateApplicationAssetMultipartSessionAsync(
                        osClient,
                        session.Row,
                        state,
                        lease,
                        "提交分片检查点").ConfigureAwait(false);
                    operationResult = update.Code == 1
                        ? ApplicationAssetMultipartResponse(
                            state,
                            false,
                            $"第{partNumber}块已流式写入并通过HDFS回读校验。")
                        : new DosResult<object>(
                            0,
                            BuildApplicationAssetMultipartEvidence(state, false, false),
                            "分片对象已写入，但检查点CAS失败；重试同一块可自动收敛：" + update.Msg);
                }).ConfigureAwait(false);
                if (lockResult.Code != 1)
                    return new DosResult<object>(0, null, "未获得上传会话分布式锁：" + lockResult.Msg);
                return operationResult ?? new DosResult<object>(0, null, "分片上传未执行。");
            }
            catch (OperationCanceledException)
            {
                return new DosResult<object>(0, null, "分片上传连接已中断；已完成块可从会话状态恢复。");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "分片上传失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> CompleteApplicationAssetMultipart(
            string osClient,
            JObject param,
            object currentToken,
            CancellationToken cancellationToken = default)
        {
            try
            {
                param ??= new JObject();
                var appIdOrKey = SafeJString(param, "AppIdOrKey");
                var operatorError = ValidateStreamPublishOperator(
                    currentToken,
                    osClient,
                    "application-asset:complete-upload",
                    appIdOrKey);
                if (operatorError != null) return operatorError;
                var sessionId = NormalizeApplicationAssetMultipartSessionId(
                    SafeJString(param, "SessionId"));

                DosResult<object> operationResult = null;
                var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
                {
                    Key = BuildApplicationAssetMultipartLockKey(osClient, sessionId),
                    OsClient = osClient,
                    Expiry = TimeSpan.FromMinutes(10),
                    AcquireTimeout = TimeSpan.FromMinutes(2),
                    CancellationToken = cancellationToken,
                    RetryIntervalMs = 100,
                    UseExponentialBackoff = true,
                    AutoRenew = true,
                    MaxLeaseDuration = TimeSpan.FromHours(2)
                }, async lease =>
                {
                    var session = await ReadApplicationAssetMultipartSessionAsync(
                        osClient,
                        sessionId).ConfigureAwait(false);
                    if (session.Error != null)
                    {
                        operationResult = new DosResult<object>(2, null, session.Error);
                        return;
                    }
                    var state = ParseApplicationAssetMultipartState(session.Row, out var parseError);
                    if (parseError != null)
                    {
                        operationResult = new DosResult<object>(0, null, parseError);
                        return;
                    }
                    if (!string.Equals(SafeJString(state, "AppId"), appIdOrKey, StringComparison.Ordinal)
                        && !string.Equals(SafeJString(state, "AppKey"), appIdOrKey, StringComparison.Ordinal))
                    {
                        operationResult = new DosResult<object>(0, null, "上传会话不属于指定应用。");
                        return;
                    }
                    var status = SafeJString(state, "Status");
                    if (string.Equals(status, "Canceled", StringComparison.Ordinal))
                    {
                        operationResult = new DosResult<object>(0, null, "上传会话已取消，不能完成。");
                        return;
                    }

                    var totalSize = SafeApplicationAssetV3Long(state, "TotalSize", -1L);
                    var totalParts = SafeJInt(state, "TotalParts", -1);
                    var expectedSha256 = SafeJString(state, "ExpectedSha256");
                    var finalPath = SafeJString(state, "FinalPath");
                    var markerPath = SafeJString(state, "MarkerPath");
                    var orderedParts = OrderedApplicationAssetMultipartParts(state);
                    if (totalSize < 0 || totalParts < 0 || orderedParts.Count != totalParts)
                    {
                        operationResult = new DosResult<object>(
                            0,
                            BuildApplicationAssetMultipartEvidence(state, false, false),
                            $"分片尚未完整：ExpectedParts={totalParts},ActualParts={orderedParts.Count}。");
                        return;
                    }
                    long accumulated = 0;
                    for (var index = 0; index < orderedParts.Count; index++)
                    {
                        var part = (JObject)orderedParts[index];
                        var expectedNumber = index + 1;
                        var expectedSize = ExpectedApplicationAssetMultipartPartSize(
                            state,
                            expectedNumber);
                        if (SafeJInt(part, "Number") != expectedNumber
                            || SafeApplicationAssetV3Long(part, "Size", -1L) != expectedSize
                            || !System.Text.RegularExpressions.Regex.IsMatch(
                                SafeJString(part, "Sha256"),
                                "^[a-f0-9]{64}$",
                                System.Text.RegularExpressions.RegexOptions.CultureInvariant))
                        {
                            operationResult = new DosResult<object>(
                                0,
                                null,
                                $"第{expectedNumber}块检查点顺序、大小或哈希不合法。");
                            return;
                        }
                        accumulated = checked(accumulated + expectedSize);
                    }
                    if (accumulated != totalSize)
                    {
                        operationResult = new DosResult<object>(
                            0,
                            null,
                            $"分片累计大小不一致：Expected={totalSize},Actual={accumulated}。");
                        return;
                    }

                    var hdfs = ResolveApplicationAssetHdfs(osClient, out var clientModel);
                    var identity = new ApplicationAssetV3ReleaseIdentity
                    {
                        Tenant = TenantConfigurationSecurity.NormalizeTenantId(osClient).ToLowerInvariant(),
                        Kind = "runtime",
                        AppKey = SafeJString(state, "AppKey"),
                        Version = SafeJString(state, "VersionNo"),
                        RequestFingerprint = SafeJString(state, "RequestFingerprint")
                    };
                    var identityError = ValidateApplicationAssetV3ReleaseIdentity(identity);
                    if (identityError != null)
                    {
                        operationResult = new DosResult<object>(0, null, identityError);
                        return;
                    }
                    var markerBytes = BuildApplicationAssetV3IntegrityMarker(
                        identity,
                        SafeJString(state, "RelativePath"),
                        expectedSha256,
                        totalSize,
                        SafeJString(state, "RequestId"));

                    state["Status"] = "Completing";
                    state["Phase"] = "ComposingFinalObject";
                    state["LastError"] = null;
                    state["RecoveryHint"] =
                        "正在流式合并；若节点中断，重试完成操作会先回读不可变最终对象并幂等收敛。";
                    var completingUpdate = await UpdateApplicationAssetMultipartSessionAsync(
                        osClient,
                        session.Row,
                        state,
                        lease,
                        "进入分片合并阶段").ConfigureAwait(false);
                    if (completingUpdate.Code != 1)
                    {
                        operationResult = new DosResult<object>(
                            0,
                            BuildApplicationAssetMultipartEvidence(state, false, false),
                            "进入完成阶段CAS失败：" + completingUpdate.Msg);
                        return;
                    }

                    var finalExists = await ExecuteApplicationAssetSideEffect(
                        lease,
                        () => ApplicationObjectExists(
                            hdfs,
                            clientModel,
                            finalPath)).ConfigureAwait(false);
                    if (finalExists.Error != null)
                    {
                        operationResult = await PersistApplicationAssetMultipartFailureAsync(
                            osClient,
                            session.Row,
                            state,
                            lease,
                            "检查最终对象失败：" + finalExists.Error.Msg,
                            "记录最终对象检查失败").ConfigureAwait(false);
                        return;
                    }

                    ApplicationAssetObjectDigest finalDigest;
                    var idempotent = false;
                    if (finalExists.Exists)
                    {
                        finalDigest = await ExecuteApplicationAssetSideEffect(
                            lease,
                            () => DigestApplicationObjectAsync(
                                hdfs,
                                clientModel,
                                finalPath,
                                cancellationToken)).ConfigureAwait(false);
                        if (finalDigest.Error != null
                            || finalDigest.Size != totalSize
                            || !string.Equals(
                                finalDigest.Sha256,
                                expectedSha256,
                                StringComparison.Ordinal))
                        {
                            operationResult = await PersistApplicationAssetMultipartFailureAsync(
                                osClient,
                                session.Row,
                                state,
                                lease,
                                "immutable最终路径已存在但内容不一致，拒绝覆盖："
                                + (finalDigest.Error ??
                                   $"ExpectedSize={totalSize},ActualSize={finalDigest.Size},"
                                   + $"ExpectedSha256={expectedSha256},ActualSha256={finalDigest.Sha256}"),
                                "记录不可变对象冲突").ConfigureAwait(false);
                            return;
                        }
                        idempotent = true;
                    }
                    else
                    {
                        var compose = await PutComposedApplicationAssetMultipartAsync(
                            hdfs,
                            clientModel,
                            orderedParts,
                            finalPath,
                            totalSize,
                            lease,
                            cancellationToken).ConfigureAwait(false);
                        if (compose.Error != null
                            || compose.Digest == null
                            || compose.Digest.Size != totalSize
                            || !string.Equals(
                                compose.Digest.Sha256,
                                expectedSha256,
                                StringComparison.Ordinal))
                        {
                            var message = compose.Error
                                          ?? $"分片合并哈希不一致：ExpectedSize={totalSize},"
                                             + $"ActualSize={compose.Digest?.Size ?? -1L},"
                                             + $"ExpectedSha256={expectedSha256},"
                                             + $"ActualSha256={compose.Digest?.Sha256}";
                            operationResult = await PersistApplicationAssetMultipartFailureAsync(
                                osClient,
                                session.Row,
                                state,
                                lease,
                                message,
                                "记录分片合并失败").ConfigureAwait(false);
                            return;
                        }
                        finalDigest = await ExecuteApplicationAssetSideEffect(
                            lease,
                            () => DigestApplicationObjectAsync(
                                hdfs,
                                clientModel,
                                finalPath,
                                cancellationToken)).ConfigureAwait(false);
                        if (finalDigest.Error != null
                            || finalDigest.Size != totalSize
                            || !string.Equals(
                                finalDigest.Sha256,
                                expectedSha256,
                                StringComparison.Ordinal))
                        {
                            operationResult = await PersistApplicationAssetMultipartFailureAsync(
                                osClient,
                                session.Row,
                                state,
                                lease,
                                "最终对象HDFS回读校验失败："
                                + (finalDigest.Error ??
                                   $"ExpectedSize={totalSize},ActualSize={finalDigest.Size},"
                                   + $"ExpectedSha256={expectedSha256},ActualSha256={finalDigest.Sha256}"),
                                "记录最终对象回读失败").ConfigureAwait(false);
                            return;
                        }
                    }

                    var markerExists = await ExecuteApplicationAssetSideEffect(
                        lease,
                        () => ApplicationObjectExists(
                            hdfs,
                            clientModel,
                            markerPath)).ConfigureAwait(false);
                    if (markerExists.Error != null)
                    {
                        operationResult = await PersistApplicationAssetMultipartFailureAsync(
                            osClient,
                            session.Row,
                            state,
                            lease,
                            "检查完整性标记失败：" + markerExists.Error.Msg,
                            "记录完整性标记检查失败").ConfigureAwait(false);
                        return;
                    }
                    if (markerExists.Exists)
                    {
                        var markerDigest = await ExecuteApplicationAssetSideEffect(
                            lease,
                            () => DigestApplicationObjectAsync(
                                hdfs,
                                clientModel,
                                markerPath,
                                cancellationToken)).ConfigureAwait(false);
                        var expectedMarkerHash = Sha256Hex(Encoding.UTF8.GetString(markerBytes));
                        if (markerDigest.Error != null
                            || markerDigest.Size != markerBytes.LongLength
                            || !string.Equals(
                                markerDigest.Sha256,
                                expectedMarkerHash,
                                StringComparison.Ordinal))
                        {
                            operationResult = await PersistApplicationAssetMultipartFailureAsync(
                                osClient,
                                session.Row,
                                state,
                                lease,
                                "既有完整性标记与本次不可变请求冲突，拒绝覆盖。",
                                "记录完整性标记冲突").ConfigureAwait(false);
                            return;
                        }
                    }
                    else
                    {
                        await using var markerStream = new MemoryStream(markerBytes, false);
                        var markerPut = await ExecuteApplicationAssetSideEffect(
                            lease,
                            () => PutApplicationObject(
                                hdfs,
                                clientModel,
                                markerPath,
                                markerStream,
                                markerBytes.LongLength,
                                cancellationToken)).ConfigureAwait(false);
                        if (markerPut.Code != 1)
                        {
                            operationResult = await PersistApplicationAssetMultipartFailureAsync(
                                osClient,
                                session.Row,
                                state,
                                lease,
                                "最终对象已验证，但完整性标记写入失败；重试可修复：" + markerPut.Msg,
                                "记录完整性标记写入失败").ConfigureAwait(false);
                            return;
                        }
                    }

                    var cleanupErrors = new JArray();
                    foreach (var part in orderedParts.OfType<JObject>())
                    {
                        var cleanup = await ExecuteApplicationAssetSideEffect(
                            lease,
                            () => hdfs.DeleteObject(new HDFSParam
                            {
                                ClientModel = clientModel,
                                Limit = false,
                                FileFullPath = SafeJString(part, "Path"),
                                CancellationToken = cancellationToken
                            })).ConfigureAwait(false);
                        if (cleanup.Code != 1)
                        {
                            cleanupErrors.Add(new JObject
                            {
                                ["PartNumber"] = SafeJInt(part, "Number"),
                                ["Path"] = SafeJString(part, "Path"),
                                ["Error"] = cleanup.Msg
                            });
                        }
                    }

                    var completedAt = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture);
                    state["Status"] = "Succeeded";
                    state["Phase"] = "Prepared";
                    state["Current"] = totalSize;
                    state["Total"] = totalSize;
                    state["ReceivedBytes"] = totalSize;
                    state["ReceivedParts"] = totalParts;
                    state["ProgressPercent"] = 100;
                    state["CompletedAt"] = completedAt;
                    state["LastError"] = null;
                    state["CleanupErrors"] = cleanupErrors;
                    state["RecoveryHint"] = cleanupErrors.Count == 0
                        ? "该文件已Prepared，可继续执行目录级v3 finalize。"
                        : "最终文件已Prepared；临时块清理失败已记入管理员日志，不影响发布。";
                    var completedUpdate = await UpdateApplicationAssetMultipartSessionAsync(
                        osClient,
                        session.Row,
                        state,
                        lease,
                        "提交分片上传完成检查点").ConfigureAwait(false);
                    operationResult = completedUpdate.Code == 1
                        ? ApplicationAssetMultipartResponse(
                            state,
                            idempotent,
                            idempotent
                                ? "最终对象已精确回读并幂等完成。"
                                : "全部分片已流式合并，最终对象与完整性标记均通过回读校验。")
                        : new DosResult<object>(
                            0,
                            BuildApplicationAssetMultipartEvidence(state, false, true),
                            "最终对象已写入并验证，但完成检查点CAS失败；重试完成操作可收敛："
                            + completedUpdate.Msg);
                }).ConfigureAwait(false);
                if (lockResult.Code != 1)
                    return new DosResult<object>(0, null, "未获得上传会话完成锁：" + lockResult.Msg);
                return operationResult ?? new DosResult<object>(0, null, "完成上传未执行。");
            }
            catch (OperationCanceledException)
            {
                return new DosResult<object>(
                    0,
                    null,
                    "完成上传已中断；会话与不可变对象均可在重试时回读恢复。");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "完成上传失败：" + ex.Message);
            }
        }

        public static async Task<DosResult<object>> AbortApplicationAssetMultipart(
            string osClient,
            JObject param,
            object currentToken,
            CancellationToken cancellationToken = default)
        {
            try
            {
                param ??= new JObject();
                var appIdOrKey = SafeJString(param, "AppIdOrKey");
                var operatorError = ValidateStreamPublishOperator(
                    currentToken,
                    osClient,
                    "application-asset:abort-upload",
                    appIdOrKey);
                if (operatorError != null) return operatorError;
                var sessionId = NormalizeApplicationAssetMultipartSessionId(
                    SafeJString(param, "SessionId"));
                var reason = SafeJString(param, "Reason");
                if (reason.Length > 500) reason = reason.Substring(0, 500);

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
                    var session = await ReadApplicationAssetMultipartSessionAsync(
                        osClient,
                        sessionId).ConfigureAwait(false);
                    if (session.Error != null)
                    {
                        operationResult = new DosResult<object>(2, null, session.Error);
                        return;
                    }
                    var state = ParseApplicationAssetMultipartState(session.Row, out var parseError);
                    if (parseError != null)
                    {
                        operationResult = new DosResult<object>(0, null, parseError);
                        return;
                    }
                    if (!string.Equals(SafeJString(state, "AppId"), appIdOrKey, StringComparison.Ordinal)
                        && !string.Equals(SafeJString(state, "AppKey"), appIdOrKey, StringComparison.Ordinal))
                    {
                        operationResult = new DosResult<object>(0, null, "上传会话不属于指定应用。");
                        return;
                    }
                    if (string.Equals(SafeJString(state, "Status"), "Succeeded", StringComparison.Ordinal))
                    {
                        operationResult = new DosResult<object>(
                            0,
                            BuildApplicationAssetMultipartEvidence(state, true, true),
                            "已Prepared的不可变最终对象不能通过取消接口删除。");
                        return;
                    }
                    if (string.Equals(SafeJString(state, "Status"), "Canceled", StringComparison.Ordinal))
                    {
                        operationResult = ApplicationAssetMultipartResponse(
                            state,
                            true,
                            "上传会话已取消，幂等返回。");
                        return;
                    }

                    var hdfs = ResolveApplicationAssetHdfs(osClient, out var clientModel);
                    var cleanupErrors = new JArray();
                    foreach (var part in OrderedApplicationAssetMultipartParts(state).OfType<JObject>())
                    {
                        var cleanup = await ExecuteApplicationAssetSideEffect(
                            lease,
                            () => hdfs.DeleteObject(new HDFSParam
                            {
                                ClientModel = clientModel,
                                Limit = false,
                                FileFullPath = SafeJString(part, "Path"),
                                CancellationToken = cancellationToken
                            })).ConfigureAwait(false);
                        if (cleanup.Code != 1)
                        {
                            cleanupErrors.Add(new JObject
                            {
                                ["PartNumber"] = SafeJInt(part, "Number"),
                                ["Path"] = SafeJString(part, "Path"),
                                ["Error"] = cleanup.Msg
                            });
                        }
                    }
                    var now = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture);
                    state["Status"] = "Canceled";
                    state["Phase"] = "Canceled";
                    state["CanceledAt"] = now;
                    state["CancelReason"] = reason.DosIsNullOrWhiteSpace()
                        ? "管理员主动取消"
                        : reason;
                    state["CleanupErrors"] = cleanupErrors;
                    state["RecoveryHint"] =
                        "取消记录永久保留用于审计；需要重传时必须创建新的不可变请求指纹。";
                    var update = await UpdateApplicationAssetMultipartSessionAsync(
                        osClient,
                        session.Row,
                        state,
                        lease,
                        "提交上传取消检查点").ConfigureAwait(false);
                    operationResult = update.Code == 1
                        ? ApplicationAssetMultipartResponse(state, false, "上传会话已取消并清理临时分片。")
                        : new DosResult<object>(0, null, "取消检查点CAS失败：" + update.Msg);
                }).ConfigureAwait(false);
                if (lockResult.Code != 1)
                    return new DosResult<object>(0, null, "未获得上传会话取消锁：" + lockResult.Msg);
                return operationResult ?? new DosResult<object>(0, null, "取消上传未执行。");
            }
            catch (OperationCanceledException)
            {
                return new DosResult<object>(0, null, "取消上传操作被中断，请查询会话状态后重试。");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "取消上传失败：" + ex.Message);
            }
        }
    }
}

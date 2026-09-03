using Dos.Common;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Microi.net.Api
{
    public partial class HDFSController
    {
        private const long TenantDatabaseDefaultChunkBytes = 16L * 1024 * 1024;
        private const long TenantDatabaseMaximumChunkBytes = 32L * 1024 * 1024;
        private const int TenantDatabaseMaximumParts = 10_000;
        private const int TenantDatabaseSessionDays = 7;
        private const string TenantDatabaseStorageScope = ".microi-upload/tenant-database";

        /// <summary>
        /// 创建或幂等恢复一个租户数据库 ZIP 分片上传会话。逻辑文件大小受当前租户
        /// sys_osclients.FileUploadMaxFileMB 约束，默认 500MB，平台绝对上限 2GB。
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> InitiateTenantDatabaseUpload([FromBody] JObject body)
        {
            body ??= new JObject();
            var access = await ResolveTenantDatabaseUploadAccessAsync(TokenText(body["OsClient"]));
            if (access.Error != null) return Json(access.Error);

            try
            {
                var fileName = NormalizeTenantDatabaseFileName(TokenText(body["FileName"]));
                var totalSize = TokenLong(body["TotalSize"], -1L);
                var requestId = NormalizeTenantDatabaseRequestId(TokenText(body["RequestId"]));
                var expectedSha256 = NormalizeOptionalSha256(TokenText(body["ExpectedSha256"]));
                var requestedChunk = TokenLong(body["RequestedChunkSize"], 0L);
                var policy = MicroiHDFS.GetFileUploadSecurityOptions(access.Param.OsClient);
                if (!policy.UploadEnabled)
                    return Json(FileUploadSecurity.CreateTenantUploadDisabledResult(access.Param.OsClient));
                if (totalSize <= 0)
                    return Json(new DosResult(0, null, "数据库 ZIP 不能为空。"));
                if (totalSize > policy.MaxFileBytes)
                {
                    return Json(new DosResult(
                        0,
                        new
                        {
                            ErrorType = "FileUploadMaxFileExceeded",
                            TotalSize = totalSize,
                            MaxFileBytes = policy.MaxFileBytes,
                            ConfigField = "FileUploadMaxFileMB"
                        },
                        $"数据库 ZIP 超过当前租户单文件上限 {policy.MaxFileBytes / 1024 / 1024}MB；请在 SaaS 引擎系统设置中调整 FileUploadMaxFileMB（最大 2048MB）。"));
                }

                var chunkSize = NormalizeTenantDatabaseChunkSize(totalSize, requestedChunk);
                var totalParts = checked((int)((totalSize + chunkSize - 1) / chunkSize));
                if (totalParts > TenantDatabaseMaximumParts)
                    return Json(new DosResult(0, null, "数据库 ZIP 分片数量超过平台安全上限。"));

                var userId = ResolveTenantDatabaseUserId(access.Param._CurrentUser);
                var sessionId = BuildTenantDatabaseSessionId(
                    access.Param.OsClient,
                    userId,
                    requestId,
                    fileName,
                    totalSize,
                    expectedSha256);
                var storage = ResolveTenantDatabaseStorage(access.Param.OsClient);
                var statePath = BuildTenantDatabaseStatePath(access.Param.OsClient, sessionId);
                DosResult operationResult = null;
                var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
                {
                    Key = BuildTenantDatabaseLockKey(access.Param.OsClient, sessionId),
                    OsClient = access.Param.OsClient,
                    Expiry = TimeSpan.FromMinutes(2),
                    AcquireTimeout = TimeSpan.FromMinutes(1),
                    RetryIntervalMs = 50,
                    UseExponentialBackoff = true,
                    AutoRenew = true,
                    MaxLeaseDuration = TimeSpan.FromMinutes(30),
                    CancellationToken = CancellationToken.None
                }, async lease =>
                {
                    var existing = await ReadTenantDatabaseStateIfExistsAsync(
                        storage.Hdfs,
                        storage.Client,
                        statePath,
                        CancellationToken.None);
                    if (existing.Error != null)
                    {
                        operationResult = new DosResult(0, null, existing.Error);
                        return;
                    }
                    if (existing.State != null)
                    {
                        var immutableError = ValidateTenantDatabaseImmutableState(
                            existing.State,
                            access.Param.OsClient,
                            userId,
                            fileName,
                            totalSize,
                            expectedSha256,
                            requestId);
                        operationResult = immutableError == null
                            ? BuildTenantDatabaseUploadResponse(existing.State, "已恢复断点上传会话。", true)
                            : new DosResult(0, null, immutableError);
                        return;
                    }

                    var quotaError = await FileUploadSecurity.ReserveDailyQuotaAsync(
                        access.Param.OsClient,
                        userId,
                        totalSize,
                        policy);
                    if (quotaError != null)
                    {
                        operationResult = quotaError;
                        return;
                    }

                    var now = DateTime.UtcNow;
                    var finalPath = BuildTenantDatabaseFinalPath(
                        access.Param.OsClient,
                        sessionId,
                        fileName,
                        now);
                    var state = new JObject
                    {
                        ["ProtocolVersion"] = 1,
                        ["StorageScope"] = "TenantDatabaseResumableUpload",
                        ["SessionId"] = sessionId,
                        ["Status"] = "Uploading",
                        ["Phase"] = "Uploading",
                        ["OsClient"] = access.Param.OsClient,
                        ["UserId"] = userId,
                        ["UserName"] = TokenText(access.Param._CurrentUser?["Name"]),
                        ["RequestId"] = requestId,
                        ["FileName"] = fileName,
                        ["ContentType"] = "application/zip",
                        ["TotalSize"] = totalSize,
                        ["ExpectedSha256"] = expectedSha256,
                        ["MaxFileBytes"] = policy.MaxFileBytes,
                        ["MaximumChunkBytes"] = TenantDatabaseMaximumChunkBytes,
                        ["ChunkSize"] = chunkSize,
                        ["TotalParts"] = totalParts,
                        ["ReceivedParts"] = 0,
                        ["ReceivedBytes"] = 0,
                        ["ProgressPercent"] = 0,
                        ["StatePath"] = statePath,
                        ["StagingPrefix"] = BuildTenantDatabaseStagingPrefix(access.Param.OsClient, sessionId),
                        ["FinalPath"] = finalPath,
                        ["CreatedAt"] = now.ToString("O", CultureInfo.InvariantCulture),
                        ["UpdatedAt"] = now.ToString("O", CultureInfo.InvariantCulture),
                        ["ExpiresAt"] = now.AddDays(TenantDatabaseSessionDays).ToString("O", CultureInfo.InvariantCulture),
                        ["RecoveryHint"] = "重新选择同一文件后会校验已完成分片，并只补传缺失分片。",
                        ["Parts"] = new JArray()
                    };
                    var save = await WriteTenantDatabaseStateAsync(
                        storage.Hdfs,
                        storage.Client,
                        statePath,
                        state,
                        CancellationToken.None);
                    operationResult = save.Code == 1
                        ? BuildTenantDatabaseUploadResponse(state, "断点上传会话已创建。", false)
                        : new DosResult(0, null, "保存断点上传会话失败：" + save.Msg);
                });
                if (lockResult.Code != 1)
                    return Json(new DosResult(0, null, "未获得断点上传分布式锁：" + lockResult.Msg));
                return Json(operationResult ?? new DosResult(0, null, "断点上传会话未执行。"));
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, "创建数据库 ZIP 断点上传会话失败：" + ex.Message));
            }
        }

        [HttpPost]
        public async Task<JsonResult> GetTenantDatabaseUploadStatus([FromBody] JObject body)
        {
            body ??= new JObject();
            var access = await ResolveTenantDatabaseUploadAccessAsync(TokenText(body["OsClient"]));
            if (access.Error != null) return Json(access.Error);
            try
            {
                var sessionId = NormalizeTenantDatabaseSessionId(TokenText(body["SessionId"]));
                var storage = ResolveTenantDatabaseStorage(access.Param.OsClient);
                var read = await ReadTenantDatabaseStateIfExistsAsync(
                    storage.Hdfs,
                    storage.Client,
                    BuildTenantDatabaseStatePath(access.Param.OsClient, sessionId),
                    HttpContext.RequestAborted);
                if (read.Error != null) return Json(new DosResult(0, null, read.Error));
                if (read.State == null) return Json(new DosResult(2, null, "断点上传会话不存在。"));
                var ownerError = ValidateTenantDatabaseSessionOwner(read.State, access.Param);
                return Json(ownerError ?? BuildTenantDatabaseUploadResponse(read.State, "断点上传状态已读取。", true));
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, "读取数据库 ZIP 断点上传状态失败：" + ex.Message));
            }
        }

        /// <summary>
        /// 上传一个 16MB 原始二进制分片。该请求不经过 multipart/form-data，
        /// 因此外层代理即使仍保留 100MB 默认限制，也不会阻断 500MB/1GB/2GB 逻辑文件。
        /// </summary>
        [HttpPost]
        [Consumes("application/octet-stream")]
        [RequestSizeLimit(64L * 1024 * 1024)]
        public async Task<JsonResult> UploadTenantDatabasePart(
            [FromQuery] string osClient,
            [FromQuery] string sessionId,
            [FromQuery] int partNumber,
            [FromQuery] string expectedPartSha256)
        {
            var access = await ResolveTenantDatabaseUploadAccessAsync(osClient);
            if (access.Error != null) return Json(access.Error);
            if (!Request.ContentLength.HasValue || Request.ContentLength.Value <= 0)
                return Json(new DosResult(0, null, "数据库 ZIP 分片必须提供精确 Content-Length。"));
            if (!string.IsNullOrWhiteSpace(Request.Headers.ContentEncoding)
                && !string.Equals(Request.Headers.ContentEncoding.ToString(), "identity", StringComparison.OrdinalIgnoreCase))
                return Json(new DosResult(0, null, "数据库 ZIP 分片不允许 Content-Encoding 压缩转换。"));

            try
            {
                sessionId = NormalizeTenantDatabaseSessionId(sessionId);
                expectedPartSha256 = NormalizeRequiredSha256(expectedPartSha256, "ExpectedPartSha256");
                var contentLength = Request.ContentLength.Value;
                var storage = ResolveTenantDatabaseStorage(access.Param.OsClient);
                DosResult operationResult = null;
                var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
                {
                    Key = BuildTenantDatabaseLockKey(access.Param.OsClient, sessionId),
                    OsClient = access.Param.OsClient,
                    Expiry = TimeSpan.FromMinutes(2),
                    AcquireTimeout = TimeSpan.FromMinutes(1),
                    RetryIntervalMs = 50,
                    UseExponentialBackoff = true,
                    AutoRenew = true,
                    MaxLeaseDuration = TimeSpan.FromMinutes(30),
                    CancellationToken = HttpContext.RequestAborted
                }, async lease =>
                {
                    var statePath = BuildTenantDatabaseStatePath(access.Param.OsClient, sessionId);
                    var read = await ReadTenantDatabaseStateIfExistsAsync(
                        storage.Hdfs,
                        storage.Client,
                        statePath,
                        HttpContext.RequestAborted);
                    if (read.Error != null || read.State == null)
                    {
                        operationResult = new DosResult(0, null, read.Error ?? "断点上传会话不存在。");
                        return;
                    }
                    var ownerError = ValidateTenantDatabaseSessionOwner(read.State, access.Param);
                    if (ownerError != null) { operationResult = ownerError; return; }
                    if (!string.Equals(TokenText(read.State["Status"]), "Uploading", StringComparison.Ordinal))
                    {
                        operationResult = string.Equals(TokenText(read.State["Status"]), "Succeeded", StringComparison.Ordinal)
                            ? BuildTenantDatabaseUploadResponse(read.State, "数据库 ZIP 已完成上传。", true)
                            : new DosResult(0, null, "当前断点上传会话状态不允许继续上传分片。");
                        return;
                    }

                    var totalParts = TokenInt(read.State["TotalParts"], -1);
                    var chunkSize = TokenLong(read.State["ChunkSize"], -1L);
                    var totalSize = TokenLong(read.State["TotalSize"], -1L);
                    if (partNumber <= 0 || partNumber > totalParts)
                    {
                        operationResult = new DosResult(0, null, "分片序号超出会话范围。");
                        return;
                    }
                    var expectedSize = Math.Min(
                        chunkSize,
                        totalSize - checked((long)(partNumber - 1) * chunkSize));
                    if (contentLength != expectedSize || contentLength > TenantDatabaseMaximumChunkBytes)
                    {
                        operationResult = new DosResult(
                            0,
                            null,
                            $"第 {partNumber} 片长度不正确：Expected={expectedSize},Actual={contentLength}。");
                        return;
                    }

                    var existingPart = FindTenantDatabasePart(read.State, partNumber);
                    if (existingPart != null)
                    {
                        if (TokenLong(existingPart["Size"], -1L) == contentLength
                            && string.Equals(TokenText(existingPart["Sha256"]), expectedPartSha256, StringComparison.Ordinal))
                        {
                            operationResult = BuildTenantDatabaseUploadResponse(
                                read.State,
                                $"第 {partNumber} 片已存在并幂等跳过。",
                                true);
                        }
                        else
                        {
                            operationResult = new DosResult(0, null, "已上传分片与本地文件不一致，请取消会话后重新上传。");
                        }
                        return;
                    }

                    var partPath = BuildTenantDatabasePartPath(
                        TokenText(read.State["StagingPrefix"]),
                        partNumber,
                        expectedPartSha256);
                    using var hashing = new TenantDatabaseHashingReadStream(Request.Body);
                    var put = await storage.Hdfs.PutObject(new HDFSParam
                    {
                        ClientModel = storage.Client,
                        Limit = true,
                        FileFullPath = partPath,
                        FileStream = hashing,
                        ContentLength = contentLength,
                        NetworkIsInternet = false,
                        TimeoutSeconds = 1800,
                        CancellationToken = HttpContext.RequestAborted
                    });
                    var actualPartSha256 = hashing.CompleteHash();
                    if (put.Code != 1 || hashing.BytesRead != contentLength
                        || !string.Equals(actualPartSha256, expectedPartSha256, StringComparison.Ordinal))
                    {
                        await TryDeleteTenantDatabaseObjectAsync(storage.Hdfs, storage.Client, partPath);
                        operationResult = new DosResult(
                            0,
                            null,
                            put.Code != 1
                                ? "分片写入 HDFS 失败：" + put.Msg
                                : $"分片传输校验失败：Expected={expectedPartSha256},Actual={actualPartSha256},Bytes={hashing.BytesRead}。");
                        return;
                    }

                    var digest = await DigestTenantDatabaseObjectAsync(
                        storage.Hdfs,
                        storage.Client,
                        partPath,
                        HttpContext.RequestAborted);
                    if (digest.Error != null || digest.Size != contentLength
                        || !string.Equals(digest.Sha256, expectedPartSha256, StringComparison.Ordinal))
                    {
                        await TryDeleteTenantDatabaseObjectAsync(storage.Hdfs, storage.Client, partPath);
                        operationResult = new DosResult(0, null, "分片 HDFS 回读校验失败：" + (digest.Error ?? digest.Sha256));
                        return;
                    }

                    var parts = read.State["Parts"] as JArray ?? new JArray();
                    parts.Add(new JObject
                    {
                        ["Number"] = partNumber,
                        ["Size"] = contentLength,
                        ["Sha256"] = expectedPartSha256,
                        ["Path"] = partPath,
                        ["CompletedAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture)
                    });
                    read.State["Parts"] = new JArray(parts.OfType<JObject>()
                        .OrderBy(item => TokenInt(item["Number"], int.MaxValue))
                        .Select(item => item.DeepClone()));
                    RefreshTenantDatabaseProgress(read.State);
                    read.State["UpdatedAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture);
                    var save = await WriteTenantDatabaseStateAsync(
                        storage.Hdfs,
                        storage.Client,
                        statePath,
                        read.State,
                        HttpContext.RequestAborted);
                    operationResult = save.Code == 1
                        ? BuildTenantDatabaseUploadResponse(read.State, $"第 {partNumber} 片上传并回读校验成功。", false)
                        : new DosResult(0, null, "分片已写入但保存断点失败；重试会安全收敛：" + save.Msg);
                });
                if (lockResult.Code != 1)
                    return Json(new DosResult(0, null, "未获得分片上传锁：" + lockResult.Msg));
                NetworkTrafficObservabilityService.AnnotateTransfer(
                    HttpContext,
                    "Upload",
                    1,
                    contentLength,
                    new[] { $"tenant-database-part-{partNumber}" },
                    new[] { ".part" });
                return Json(operationResult ?? new DosResult(0, null, "数据库 ZIP 分片未执行。"));
            }
            catch (OperationCanceledException)
            {
                return Json(new DosResult(0, null, "分片连接已中断；已完成分片可从会话状态恢复。"));
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, "数据库 ZIP 分片上传失败：" + ex.Message));
            }
        }

        [HttpPost]
        public async Task<JsonResult> CompleteTenantDatabaseUpload([FromBody] JObject body)
        {
            body ??= new JObject();
            var access = await ResolveTenantDatabaseUploadAccessAsync(TokenText(body["OsClient"]));
            if (access.Error != null) return Json(access.Error);
            try
            {
                var sessionId = NormalizeTenantDatabaseSessionId(TokenText(body["SessionId"]));
                var declaredFullHash = NormalizeOptionalSha256(TokenText(body["ExpectedSha256"]));
                var storage = ResolveTenantDatabaseStorage(access.Param.OsClient);
                DosResult operationResult = null;
                var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
                {
                    Key = BuildTenantDatabaseLockKey(access.Param.OsClient, sessionId),
                    OsClient = access.Param.OsClient,
                    Expiry = TimeSpan.FromMinutes(5),
                    AcquireTimeout = TimeSpan.FromMinutes(2),
                    RetryIntervalMs = 100,
                    UseExponentialBackoff = true,
                    AutoRenew = true,
                    MaxLeaseDuration = TimeSpan.FromHours(12),
                    CancellationToken = CancellationToken.None
                }, async lease =>
                {
                    var statePath = BuildTenantDatabaseStatePath(access.Param.OsClient, sessionId);
                    var read = await ReadTenantDatabaseStateIfExistsAsync(
                        storage.Hdfs,
                        storage.Client,
                        statePath,
                        CancellationToken.None);
                    if (read.Error != null || read.State == null)
                    {
                        operationResult = new DosResult(0, null, read.Error ?? "断点上传会话不存在。");
                        return;
                    }
                    var ownerError = ValidateTenantDatabaseSessionOwner(read.State, access.Param);
                    if (ownerError != null) { operationResult = ownerError; return; }
                    if (string.Equals(TokenText(read.State["Status"]), "Succeeded", StringComparison.Ordinal))
                    {
                        operationResult = BuildTenantDatabaseUploadResponse(read.State, "数据库 ZIP 已幂等完成。", true);
                        return;
                    }
                    if (!string.Equals(TokenText(read.State["Status"]), "Uploading", StringComparison.Ordinal)
                        && !string.Equals(TokenText(read.State["Status"]), "Completing", StringComparison.Ordinal))
                    {
                        operationResult = new DosResult(0, null, "当前断点上传会话状态不允许完成上传。");
                        return;
                    }

                    var totalParts = TokenInt(read.State["TotalParts"], -1);
                    var totalSize = TokenLong(read.State["TotalSize"], -1L);
                    var parts = (read.State["Parts"] as JArray ?? new JArray())
                        .OfType<JObject>()
                        .OrderBy(item => TokenInt(item["Number"], int.MaxValue))
                        .ToArray();
                    if (parts.Length != totalParts
                        || parts.Select((part, index) => TokenInt(part["Number"], -1) == index + 1).Any(valid => !valid)
                        || parts.Sum(part => TokenLong(part["Size"], 0L)) != totalSize)
                    {
                        operationResult = new DosResult(0, null, "分片尚未全部上传或断点元数据不完整。");
                        return;
                    }

                    read.State["Status"] = "Completing";
                    read.State["Phase"] = "ComposingFinalObject";
                    read.State["UpdatedAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture);
                    var checkpoint = await WriteTenantDatabaseStateAsync(
                        storage.Hdfs,
                        storage.Client,
                        statePath,
                        read.State,
                        CancellationToken.None);
                    if (checkpoint.Code != 1)
                    {
                        operationResult = new DosResult(0, null, "进入合并阶段检查点失败：" + checkpoint.Msg);
                        return;
                    }

                    var tempDirectory = Path.Combine(
                        Path.GetTempPath(),
                        "microi-tenant-database-upload",
                        sessionId);
                    var tempFile = Path.Combine(tempDirectory, "assembled.zip");
                    try
                    {
                        Directory.CreateDirectory(tempDirectory);
                        await using (var output = new FileStream(
                                         tempFile,
                                         FileMode.Create,
                                         FileAccess.Write,
                                         FileShare.None,
                                         1024 * 1024,
                                         FileOptions.Asynchronous | FileOptions.SequentialScan))
                        {
                            foreach (var part in parts)
                            {
                                var copy = await storage.Hdfs.CopyObjectToStream(new HDFSParam
                                {
                                    ClientModel = storage.Client,
                                    Limit = true,
                                    FileFullPath = TokenText(part["Path"]),
                                    FileStream = output,
                                    NetworkIsInternet = false,
                                    TimeoutSeconds = 7200,
                                    CancellationToken = CancellationToken.None
                                });
                                if (copy.Code != 1)
                                    throw new IOException("读取分片失败：" + copy.Msg);
                            }
                            await output.FlushAsync(CancellationToken.None);
                            if (output.Length != totalSize)
                                throw new InvalidDataException($"合并文件大小不一致：Expected={totalSize},Actual={output.Length}。");
                        }

                        await using (var signature = System.IO.File.OpenRead(tempFile))
                        {
                            var header = new byte[4];
                            var readHeader = await signature.ReadAsync(header.AsMemory(0, header.Length));
                            if (readHeader < 4 || header[0] != (byte)'P' || header[1] != (byte)'K')
                                throw new InvalidDataException("上传内容不是有效的 ZIP 文件签名。");
                        }

                        var actualFullHash = await ComputeTenantDatabaseFileSha256Async(tempFile);
                        var stateExpectedHash = NormalizeOptionalSha256(TokenText(read.State["ExpectedSha256"]));
                        var authoritativeExpectedHash = declaredFullHash.Length > 0 ? declaredFullHash : stateExpectedHash;
                        if (stateExpectedHash.Length > 0 && declaredFullHash.Length > 0
                            && !string.Equals(stateExpectedHash, declaredFullHash, StringComparison.Ordinal))
                            throw new InvalidDataException("完成请求的整包 SHA-256 与会话不可变事实冲突。");
                        if (authoritativeExpectedHash.Length > 0
                            && !string.Equals(authoritativeExpectedHash, actualFullHash, StringComparison.Ordinal))
                            throw new InvalidDataException(
                                $"数据库 ZIP 整包 SHA-256 不一致：Expected={authoritativeExpectedHash},Actual={actualFullHash}。");

                        var finalPath = TokenText(read.State["FinalPath"]);
                        var finalExists = await storage.Hdfs.ObjectExist(new HDFSParam
                        {
                            ClientModel = storage.Client,
                            Limit = true,
                            FileFullPath = finalPath,
                            NetworkIsInternet = false,
                            CancellationToken = CancellationToken.None
                        });
                        if (finalExists.Code != 1)
                            throw new IOException("检查最终 ZIP 对象失败：" + finalExists.Msg);
                        if (finalExists.Data)
                        {
                            var existingDigest = await DigestTenantDatabaseObjectAsync(
                                storage.Hdfs,
                                storage.Client,
                                finalPath,
                                CancellationToken.None);
                            if (existingDigest.Error != null || existingDigest.Size != totalSize
                                || !string.Equals(existingDigest.Sha256, actualFullHash, StringComparison.Ordinal))
                                throw new InvalidDataException("最终 ZIP 路径已存在但内容不同，拒绝覆盖。");
                        }
                        else
                        {
                            await using var finalStream = new FileStream(
                                tempFile,
                                FileMode.Open,
                                FileAccess.Read,
                                FileShare.Read,
                                1024 * 1024,
                                FileOptions.Asynchronous | FileOptions.SequentialScan);
                            var put = await storage.Hdfs.PutObject(new HDFSParam
                            {
                                ClientModel = storage.Client,
                                Limit = true,
                                FileFullPath = finalPath,
                                FileStream = finalStream,
                                ContentLength = totalSize,
                                NetworkIsInternet = false,
                                TimeoutSeconds = 7200,
                                CancellationToken = CancellationToken.None
                            });
                            if (put.Code != 1) throw new IOException("写入最终 ZIP 对象失败：" + put.Msg);
                        }

                        var finalDigest = await DigestTenantDatabaseObjectAsync(
                            storage.Hdfs,
                            storage.Client,
                            finalPath,
                            CancellationToken.None);
                        if (finalDigest.Error != null || finalDigest.Size != totalSize
                            || !string.Equals(finalDigest.Sha256, actualFullHash, StringComparison.Ordinal))
                            throw new InvalidDataException("最终 ZIP 对象 HDFS 回读校验失败：" + (finalDigest.Error ?? finalDigest.Sha256));

                        read.State["Status"] = "Succeeded";
                        read.State["Phase"] = "Completed";
                        read.State["ExpectedSha256"] = authoritativeExpectedHash;
                        read.State["ActualSha256"] = actualFullHash;
                        read.State["CompletedAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture);
                        read.State["UpdatedAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture);
                        read.State["ProgressPercent"] = 100;
                        read.State["RecoveryHint"] = "最终 ZIP 已通过整包 HDFS 回读校验，可提交创建 SaaS 租户任务。";
                        var completed = await WriteTenantDatabaseStateAsync(
                            storage.Hdfs,
                            storage.Client,
                            statePath,
                            read.State,
                            CancellationToken.None);
                        if (completed.Code != 1)
                            throw new IOException("最终对象已验证，但完成检查点写入失败；重试可收敛：" + completed.Msg);

                        var cleanupErrors = new JArray();
                        foreach (var part in parts)
                        {
                            var cleanup = await TryDeleteTenantDatabaseObjectAsync(
                                storage.Hdfs,
                                storage.Client,
                                TokenText(part["Path"]));
                            if (cleanup.Code != 1) cleanupErrors.Add(cleanup.Msg);
                        }
                        read.State["CleanupErrors"] = cleanupErrors;
                        await WriteTenantDatabaseStateAsync(
                            storage.Hdfs,
                            storage.Client,
                            statePath,
                            read.State,
                            CancellationToken.None);
                        operationResult = BuildTenantDatabaseUploadResponse(
                            read.State,
                            cleanupErrors.Count == 0
                                ? "数据库 ZIP 分片合并与整包校验成功。"
                                : "数据库 ZIP 已完成；临时分片清理告警已记录。",
                            false);
                    }
                    catch (Exception ex)
                    {
                        read.State["Status"] = "Uploading";
                        read.State["Phase"] = "CompletionFailed";
                        read.State["LastError"] = ex.Message;
                        read.State["UpdatedAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture);
                        read.State["RecoveryHint"] = "已上传分片仍然保留；修复存储或磁盘问题后重新点击继续上传即可重试合并。";
                        await WriteTenantDatabaseStateAsync(
                            storage.Hdfs,
                            storage.Client,
                            statePath,
                            read.State,
                            CancellationToken.None);
                        operationResult = new DosResult(0, BuildTenantDatabaseResponseData(read.State), "完成数据库 ZIP 上传失败：" + ex.Message);
                    }
                    finally
                    {
                        try
                        {
                            if (System.IO.File.Exists(tempFile)) System.IO.File.Delete(tempFile);
                            if (Directory.Exists(tempDirectory)) Directory.Delete(tempDirectory, recursive: false);
                        }
                        catch { }
                    }
                });
                if (lockResult.Code != 1)
                    return Json(new DosResult(0, null, "未获得数据库 ZIP 合并锁：" + lockResult.Msg));
                return Json(operationResult ?? new DosResult(0, null, "数据库 ZIP 合并未执行。"));
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, "完成数据库 ZIP 断点上传失败：" + ex.Message));
            }
        }

        [HttpPost]
        public async Task<JsonResult> AbortTenantDatabaseUpload([FromBody] JObject body)
        {
            body ??= new JObject();
            var access = await ResolveTenantDatabaseUploadAccessAsync(TokenText(body["OsClient"]));
            if (access.Error != null) return Json(access.Error);
            try
            {
                var sessionId = NormalizeTenantDatabaseSessionId(TokenText(body["SessionId"]));
                var storage = ResolveTenantDatabaseStorage(access.Param.OsClient);
                DosResult operationResult = null;
                var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
                {
                    Key = BuildTenantDatabaseLockKey(access.Param.OsClient, sessionId),
                    OsClient = access.Param.OsClient,
                    Expiry = TimeSpan.FromMinutes(2),
                    AcquireTimeout = TimeSpan.FromMinutes(1),
                    AutoRenew = true,
                    MaxLeaseDuration = TimeSpan.FromMinutes(30),
                    CancellationToken = HttpContext.RequestAborted
                }, async lease =>
                {
                    var statePath = BuildTenantDatabaseStatePath(access.Param.OsClient, sessionId);
                    var read = await ReadTenantDatabaseStateIfExistsAsync(
                        storage.Hdfs,
                        storage.Client,
                        statePath,
                        HttpContext.RequestAborted);
                    if (read.Error != null || read.State == null)
                    {
                        operationResult = new DosResult(0, null, read.Error ?? "断点上传会话不存在。");
                        return;
                    }
                    var ownerError = ValidateTenantDatabaseSessionOwner(read.State, access.Param);
                    if (ownerError != null) { operationResult = ownerError; return; }
                    if (string.Equals(TokenText(read.State["Status"]), "Succeeded", StringComparison.Ordinal))
                    {
                        operationResult = new DosResult(0, BuildTenantDatabaseResponseData(read.State), "已完成的数据库 ZIP 不允许通过中止接口删除。");
                        return;
                    }
                    foreach (var part in (read.State["Parts"] as JArray ?? new JArray()).OfType<JObject>())
                        await TryDeleteTenantDatabaseObjectAsync(storage.Hdfs, storage.Client, TokenText(part["Path"]));
                    read.State["Status"] = "Aborted";
                    read.State["Phase"] = "Aborted";
                    read.State["AbortedAt"] = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture);
                    read.State["UpdatedAt"] = read.State["AbortedAt"];
                    read.State["RecoveryHint"] = "该会话已中止；重新选择文件会创建新会话。";
                    var save = await WriteTenantDatabaseStateAsync(
                        storage.Hdfs,
                        storage.Client,
                        statePath,
                        read.State,
                        CancellationToken.None);
                    operationResult = save.Code == 1
                        ? BuildTenantDatabaseUploadResponse(read.State, "断点上传会话已中止并清理临时分片。", false)
                        : new DosResult(0, null, "中止状态保存失败：" + save.Msg);
                });
                if (lockResult.Code != 1)
                    return Json(new DosResult(0, null, "未获得数据库 ZIP 中止锁：" + lockResult.Msg));
                return Json(operationResult ?? new DosResult(0, null, "数据库 ZIP 中止操作未执行。"));
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, "中止数据库 ZIP 断点上传失败：" + ex.Message));
            }
        }

        private async Task<(DiyUploadParam Param, DosResult Error)> ResolveTenantDatabaseUploadAccessAsync(string osClient)
        {
            var param = new DiyUploadParam
            {
                OsClient = osClient,
                Path = "file",
                Limit = true,
                Preview = false
            };
            var accessError = await DefaultParam(param);
            if (accessError != null) return (param, accessError);
            var adminError = RequirePlatformAdmin(param);
            return (param, adminError);
        }

        private static (IMicroiHDFS Hdfs, OsClientSecret Client) ResolveTenantDatabaseStorage(string osClient)
        {
            var client = OsClient.GetClient(osClient)
                         ?? throw new InvalidOperationException("当前租户 HDFS 配置不存在。");
            var name = TokenText(client.OsClientModel?["HDFS"]);
            if (string.Equals(name, "MinIO", StringComparison.OrdinalIgnoreCase))
                return (MicroiEngine.HDFSFactory(HDFSType.MinIO), client);
            if (string.Equals(name, "S3", StringComparison.OrdinalIgnoreCase)
                || string.Equals(name, "AmazonS3", StringComparison.OrdinalIgnoreCase))
                return (MicroiEngine.HDFSFactory(HDFSType.AmazonS3), client);
            if (name.DosIsNullOrWhiteSpace()
                || string.Equals(name, "Aliyun", StringComparison.OrdinalIgnoreCase)
                || string.Equals(name, "AliOss", StringComparison.OrdinalIgnoreCase))
                return (MicroiEngine.HDFSFactory(HDFSType.Aliyun), client);
            throw new InvalidOperationException("当前租户配置了不受支持的分布式存储类型。");
        }

        private static string NormalizeTenantDatabaseFileName(string fileName)
        {
            var raw = Path.GetFileName((fileName ?? string.Empty).Trim());
            if (raw.DosIsNullOrWhiteSpace() || !raw.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("数据库包必须是 .zip 文件。", nameof(fileName));
            raw = Regex.Replace(raw, @"[^A-Za-z0-9._\-\u4e00-\u9fff]", "_", RegexOptions.CultureInvariant);
            if (raw.Length > 120)
            {
                var extension = Path.GetExtension(raw);
                raw = raw.Substring(0, Math.Max(1, 120 - extension.Length)) + extension;
            }
            return raw;
        }

        private static string NormalizeTenantDatabaseRequestId(string requestId)
        {
            var value = (requestId ?? string.Empty).Trim();
            if (!Regex.IsMatch(value, "^[A-Za-z0-9_-]{8,100}$", RegexOptions.CultureInvariant))
                throw new ArgumentException("RequestId 格式不合法。", nameof(requestId));
            return value;
        }

        private static string NormalizeTenantDatabaseSessionId(string sessionId)
        {
            var value = (sessionId ?? string.Empty).Trim().ToLowerInvariant();
            if (!Regex.IsMatch(value, "^mcitu-[a-f0-9]{32}$", RegexOptions.CultureInvariant))
                throw new ArgumentException("SessionId 格式不合法。", nameof(sessionId));
            return value;
        }

        private static string NormalizeOptionalSha256(string value)
        {
            value = (value ?? string.Empty).Trim().ToLowerInvariant();
            return value.Length == 0 ? string.Empty : NormalizeRequiredSha256(value, "ExpectedSha256");
        }

        private static string NormalizeRequiredSha256(string value, string name)
        {
            value = (value ?? string.Empty).Trim().ToLowerInvariant();
            if (!Regex.IsMatch(value, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
                throw new ArgumentException(name + " 必须是 64 位小写 SHA-256。", name);
            return value;
        }

        private static long NormalizeTenantDatabaseChunkSize(long totalSize, long requested)
        {
            var value = requested <= 0 ? TenantDatabaseDefaultChunkBytes : requested;
            value = Math.Max(1024 * 1024, Math.Min(TenantDatabaseMaximumChunkBytes, value));
            value = ((value + 1024 * 1024 - 1) / (1024 * 1024)) * (1024 * 1024);
            var required = (totalSize + TenantDatabaseMaximumParts - 1L) / TenantDatabaseMaximumParts;
            if (required > value)
                value = ((required + 1024 * 1024 - 1) / (1024 * 1024)) * (1024 * 1024);
            if (value > TenantDatabaseMaximumChunkBytes)
                throw new InvalidOperationException("逻辑文件过大，无法在当前分片数量上限内上传。");
            return value;
        }

        private static string ResolveTenantDatabaseUserId(JObject user)
        {
            var value = TokenText(user?["Id"]);
            if (value.DosIsNullOrWhiteSpace()) value = TokenText(user?["UserId"]);
            if (value.DosIsNullOrWhiteSpace()) throw new InvalidOperationException("当前管理员身份缺少 UserId。");
            return value;
        }

        private static string BuildTenantDatabaseSessionId(
            string osClient,
            string userId,
            string requestId,
            string fileName,
            long totalSize,
            string sha256)
        {
            var source = string.Join("\n", osClient.ToLowerInvariant(), userId, requestId, fileName, totalSize, sha256);
            return "mcitu-" + Sha256Text(source).Substring(0, 32);
        }

        private static string BuildTenantDatabaseLockKey(string osClient, string sessionId) =>
            "HDFS:TenantDatabaseUpload:" + osClient.ToLowerInvariant() + ":" + sessionId;

        private static string BuildTenantDatabaseStagingPrefix(string osClient, string sessionId) =>
            TenantConfigurationSecurity.NormalizeStoragePath(
                osClient,
                TenantDatabaseStorageScope + "/" + sessionId).TrimStart('/');

        private static string BuildTenantDatabaseStatePath(string osClient, string sessionId) =>
            BuildTenantDatabaseStagingPrefix(osClient, sessionId) + "/session.json";

        private static string BuildTenantDatabasePartPath(string prefix, int partNumber, string sha256) =>
            prefix.Trim('/') + "/parts/" + partNumber.ToString("D5", CultureInfo.InvariantCulture) + "-" + sha256 + ".part";

        private static string BuildTenantDatabaseFinalPath(
            string osClient,
            string sessionId,
            string fileName,
            DateTime now) =>
            TenantConfigurationSecurity.NormalizeStoragePath(
                osClient,
                "file/tenant-database/" + now.ToString("yyyyMM", CultureInfo.InvariantCulture)
                + "/" + sessionId + "/" + fileName).TrimStart('/');

        private static string ValidateTenantDatabaseImmutableState(
            JObject state,
            string osClient,
            string userId,
            string fileName,
            long totalSize,
            string expectedSha256,
            string requestId)
        {
            if (!string.Equals(TokenText(state["OsClient"]), osClient, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(TokenText(state["UserId"]), userId, StringComparison.Ordinal)
                || !string.Equals(TokenText(state["FileName"]), fileName, StringComparison.Ordinal)
                || TokenLong(state["TotalSize"], -1L) != totalSize
                || !string.Equals(TokenText(state["ExpectedSha256"]), expectedSha256, StringComparison.Ordinal)
                || !string.Equals(TokenText(state["RequestId"]), requestId, StringComparison.Ordinal))
                return "同一 RequestId 对应的租户、文件名、大小或哈希事实发生冲突。";
            if (string.Equals(TokenText(state["Status"]), "Aborted", StringComparison.Ordinal))
                return "该断点会话已中止，请重新选择文件创建新会话。";
            if (DateTime.TryParse(TokenText(state["ExpiresAt"]), null, DateTimeStyles.RoundtripKind, out var expires)
                && expires < DateTime.UtcNow
                && !string.Equals(TokenText(state["Status"]), "Succeeded", StringComparison.Ordinal))
                return "该断点会话已过期，请取消后重新上传。";
            return null;
        }

        private static DosResult ValidateTenantDatabaseSessionOwner(JObject state, DiyUploadParam param)
        {
            var currentUserId = ResolveTenantDatabaseUserId(param._CurrentUser);
            return string.Equals(TokenText(state["OsClient"]), param.OsClient, StringComparison.OrdinalIgnoreCase)
                   && string.Equals(TokenText(state["UserId"]), currentUserId, StringComparison.Ordinal)
                ? null
                : new DosResult(0, null, "断点上传会话不属于当前租户管理员。");
        }

        private static JObject FindTenantDatabasePart(JObject state, int partNumber) =>
            (state["Parts"] as JArray ?? new JArray())
            .OfType<JObject>()
            .FirstOrDefault(item => TokenInt(item["Number"], -1) == partNumber);

        private static void RefreshTenantDatabaseProgress(JObject state)
        {
            var parts = (state["Parts"] as JArray ?? new JArray()).OfType<JObject>().ToArray();
            var receivedBytes = parts.Sum(item => TokenLong(item["Size"], 0L));
            var totalBytes = TokenLong(state["TotalSize"], 0L);
            state["ReceivedParts"] = parts.Length;
            state["ReceivedBytes"] = receivedBytes;
            state["ProgressPercent"] = totalBytes <= 0
                ? 0
                : Math.Min(99, (int)Math.Floor(receivedBytes * 100D / totalBytes));
        }

        private static DosResult BuildTenantDatabaseUploadResponse(JObject state, string message, bool idempotent) =>
            new DosResult(1, BuildTenantDatabaseResponseData(state, idempotent), message);

        private static JObject BuildTenantDatabaseResponseData(JObject state, bool idempotent = false)
        {
            var parts = new JArray((state["Parts"] as JArray ?? new JArray())
                .OfType<JObject>()
                .OrderBy(item => TokenInt(item["Number"], int.MaxValue))
                .Select(item => new JObject
                {
                    ["Number"] = TokenInt(item["Number"], 0),
                    ["Size"] = TokenLong(item["Size"], 0L),
                    ["Sha256"] = TokenText(item["Sha256"])
                }));
            var finalPath = TokenText(state["FinalPath"]);
            var succeeded = string.Equals(TokenText(state["Status"]), "Succeeded", StringComparison.Ordinal);
            return new JObject
            {
                ["ProtocolVersion"] = 1,
                ["SessionId"] = TokenText(state["SessionId"]),
                ["Status"] = TokenText(state["Status"]),
                ["Phase"] = TokenText(state["Phase"]),
                ["FileName"] = TokenText(state["FileName"]),
                ["TotalSize"] = TokenLong(state["TotalSize"], 0L),
                ["MaxFileBytes"] = TokenLong(
                    state["MaxFileBytes"],
                    FileUploadSecurityOptions.DefaultMaxFileMegabytes * 1024L * 1024L),
                ["MaximumChunkBytes"] = TokenLong(state["MaximumChunkBytes"], TenantDatabaseMaximumChunkBytes),
                ["ChunkSize"] = TokenLong(state["ChunkSize"], TenantDatabaseDefaultChunkBytes),
                ["TotalParts"] = TokenInt(state["TotalParts"], 0),
                ["ReceivedParts"] = TokenInt(state["ReceivedParts"], 0),
                ["ReceivedBytes"] = TokenLong(state["ReceivedBytes"], 0L),
                ["ProgressPercent"] = TokenInt(state["ProgressPercent"], 0),
                ["ExpectedSha256"] = TokenText(state["ExpectedSha256"]),
                ["ActualSha256"] = TokenText(state["ActualSha256"]),
                ["Path"] = succeeded && finalPath.Length > 0 ? "/" + finalPath.TrimStart('/') : string.Empty,
                ["FilePathName"] = succeeded && finalPath.Length > 0 ? "/" + finalPath.TrimStart('/') : string.Empty,
                ["RecoveryHint"] = TokenText(state["RecoveryHint"]),
                ["ExpiresAt"] = TokenText(state["ExpiresAt"]),
                ["LastError"] = TokenText(state["LastError"]),
                ["Idempotent"] = idempotent,
                ["Resumable"] = true,
                ["Parts"] = parts
            };
        }

        private static async Task<(JObject State, string Error)> ReadTenantDatabaseStateIfExistsAsync(
            IMicroiHDFS hdfs,
            OsClientSecret client,
            string path,
            CancellationToken cancellationToken)
        {
            var exists = await hdfs.ObjectExist(new HDFSParam
            {
                ClientModel = client,
                Limit = true,
                FileFullPath = path,
                NetworkIsInternet = false,
                CancellationToken = cancellationToken
            });
            if (exists.Code != 1) return (null, "检查断点会话失败：" + exists.Msg);
            if (!exists.Data) return (null, null);
            using var output = new MemoryStream();
            var copy = await hdfs.CopyObjectToStream(new HDFSParam
            {
                ClientModel = client,
                Limit = true,
                FileFullPath = path,
                FileStream = output,
                NetworkIsInternet = false,
                TimeoutSeconds = 120,
                CancellationToken = cancellationToken
            });
            if (copy.Code != 1) return (null, "读取断点会话失败：" + copy.Msg);
            if (output.Length <= 0 || output.Length > 2 * 1024 * 1024)
                return (null, "断点会话元数据大小异常。");
            try
            {
                output.Position = 0;
                using var reader = new StreamReader(output, Encoding.UTF8, true, 4096, true);
                return (JObject.Parse(await reader.ReadToEndAsync()), null);
            }
            catch (Exception ex)
            {
                return (null, "断点会话元数据损坏：" + ex.Message);
            }
        }

        private static async Task<DosResult> WriteTenantDatabaseStateAsync(
            IMicroiHDFS hdfs,
            OsClientSecret client,
            string path,
            JObject state,
            CancellationToken cancellationToken)
        {
            var bytes = Encoding.UTF8.GetBytes(state.ToString(Formatting.None));
            await using var stream = new MemoryStream(bytes, writable: false);
            return await hdfs.PutObject(new HDFSParam
            {
                ClientModel = client,
                Limit = true,
                FileFullPath = path,
                FileStream = stream,
                ContentLength = bytes.LongLength,
                NetworkIsInternet = false,
                TimeoutSeconds = 120,
                CancellationToken = cancellationToken
            });
        }

        private static async Task<TenantDatabaseObjectDigest> DigestTenantDatabaseObjectAsync(
            IMicroiHDFS hdfs,
            OsClientSecret client,
            string path,
            CancellationToken cancellationToken)
        {
            using var sink = new TenantDatabaseHashingWriteStream(Stream.Null);
            var copy = await hdfs.CopyObjectToStream(new HDFSParam
            {
                ClientModel = client,
                Limit = true,
                FileFullPath = path,
                FileStream = sink,
                NetworkIsInternet = false,
                TimeoutSeconds = 7200,
                CancellationToken = cancellationToken
            });
            return copy.Code == 1
                ? new TenantDatabaseObjectDigest { Size = sink.BytesWritten, Sha256 = sink.CompleteHash() }
                : new TenantDatabaseObjectDigest { Error = copy.Msg ?? "HDFS 回读失败。" };
        }

        private static Task<DosResult> TryDeleteTenantDatabaseObjectAsync(
            IMicroiHDFS hdfs,
            OsClientSecret client,
            string path) =>
            path.DosIsNullOrWhiteSpace()
                ? Task.FromResult(new DosResult(1))
                : hdfs.DeleteObject(new HDFSParam
                {
                    ClientModel = client,
                    Limit = true,
                    FileFullPath = path,
                    NetworkIsInternet = false,
                    CancellationToken = CancellationToken.None
                });

        private static async Task<string> ComputeTenantDatabaseFileSha256Async(string path)
        {
            await using var stream = new FileStream(
                path,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                1024 * 1024,
                FileOptions.Asynchronous | FileOptions.SequentialScan);
            using var sha256 = SHA256.Create();
            var hash = await sha256.ComputeHashAsync(stream, CancellationToken.None);
            return Convert.ToHexString(hash).ToLowerInvariant();
        }

        private static string Sha256Text(string value)
        {
            using var sha256 = SHA256.Create();
            return Convert.ToHexString(sha256.ComputeHash(Encoding.UTF8.GetBytes(value ?? string.Empty)))
                .ToLowerInvariant();
        }

        private static string TokenText(JToken token) => token == null ? string.Empty : token.ToString().Trim();

        private static long TokenLong(JToken token, long fallback)
        {
            return token != null && long.TryParse(token.ToString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
                ? value
                : fallback;
        }

        private static int TokenInt(JToken token, int fallback)
        {
            return token != null && int.TryParse(token.ToString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var value)
                ? value
                : fallback;
        }

        private sealed class TenantDatabaseObjectDigest
        {
            public long Size { get; set; }
            public string Sha256 { get; set; }
            public string Error { get; set; }
        }

        private sealed class TenantDatabaseHashingReadStream : Stream
        {
            private readonly Stream _source;
            private readonly SHA256 _sha256 = SHA256.Create();
            private bool _completed;

            public TenantDatabaseHashingReadStream(Stream source) =>
                _source = source ?? throw new ArgumentNullException(nameof(source));
            public long BytesRead { get; private set; }
            public override bool CanRead => true;
            public override bool CanSeek => false;
            public override bool CanWrite => false;
            public override long Length => throw new NotSupportedException();
            public override long Position { get => BytesRead; set => throw new NotSupportedException(); }
            public override void Flush() { }
            public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
            public override void SetLength(long value) => throw new NotSupportedException();
            public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();

            public string CompleteHash()
            {
                if (!_completed)
                {
                    _sha256.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
                    _completed = true;
                }
                return Convert.ToHexString(_sha256.Hash ?? Array.Empty<byte>()).ToLowerInvariant();
            }

            public override int Read(byte[] buffer, int offset, int count)
            {
                var read = _source.Read(buffer, offset, count);
                Observe(buffer, offset, read);
                return read;
            }

            public override async Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
            {
                var read = await _source.ReadAsync(buffer, offset, count, cancellationToken);
                Observe(buffer, offset, read);
                return read;
            }

            private void Observe(byte[] buffer, int offset, int count)
            {
                if (count <= 0) return;
                if (_completed) throw new InvalidOperationException("哈希流已完成。");
                _sha256.TransformBlock(buffer, offset, count, null, 0);
                BytesRead += count;
            }

            protected override void Dispose(bool disposing)
            {
                if (disposing) _sha256.Dispose();
                base.Dispose(disposing);
            }
        }

        private sealed class TenantDatabaseHashingWriteStream : Stream
        {
            private readonly Stream _target;
            private readonly SHA256 _sha256 = SHA256.Create();
            private bool _completed;

            public TenantDatabaseHashingWriteStream(Stream target) =>
                _target = target ?? throw new ArgumentNullException(nameof(target));
            public long BytesWritten { get; private set; }
            public override bool CanRead => false;
            public override bool CanSeek => false;
            public override bool CanWrite => true;
            public override long Length => BytesWritten;
            public override long Position { get => BytesWritten; set => throw new NotSupportedException(); }
            public override void Flush() => _target.Flush();
            public override Task FlushAsync(CancellationToken cancellationToken) => _target.FlushAsync(cancellationToken);
            public override int Read(byte[] buffer, int offset, int count) => throw new NotSupportedException();
            public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
            public override void SetLength(long value) => throw new NotSupportedException();

            public string CompleteHash()
            {
                if (!_completed)
                {
                    _sha256.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
                    _completed = true;
                }
                return Convert.ToHexString(_sha256.Hash ?? Array.Empty<byte>()).ToLowerInvariant();
            }

            public override void Write(byte[] buffer, int offset, int count)
            {
                Observe(buffer, offset, count);
                _target.Write(buffer, offset, count);
            }

            public override async Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
            {
                Observe(buffer, offset, count);
                await _target.WriteAsync(buffer, offset, count, cancellationToken);
            }

            private void Observe(byte[] buffer, int offset, int count)
            {
                if (count <= 0) return;
                if (_completed) throw new InvalidOperationException("哈希流已完成。");
                _sha256.TransformBlock(buffer, offset, count, null, 0);
                BytesWritten += count;
            }

            protected override void Dispose(bool disposing)
            {
                if (disposing) _sha256.Dispose();
                base.Dispose(disposing);
            }
        }
    }
}

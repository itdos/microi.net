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

        private static JObject GetMcpOperator(dynamic currentToken)
        {
            try
            {
                if (currentToken?.CurrentUser is JObject currentUser) return currentUser;
                return currentToken?.CurrentUser == null ? new JObject() : JObject.FromObject(currentToken.CurrentUser);
            }
            catch
            {
                return new JObject();
            }
        }

        private static DosResult ValidateStreamPublishOperator(dynamic currentToken)
        {
            var currentUser = GetMcpOperator(currentToken);
            if (currentUser["Level"].Val<int>() < DiyCommon.MaxRoleLevel)
                return new DosResult(0, null, "仅平台超级管理员可以发布应用资产。");
            if (UserAccessKeySecurity.IsSession(currentUser))
                return new DosResult(0, null, "访问密钥会话不能发布应用资产。");
            return null;
        }

        private static IMicroiHDFS ResolveApplicationAssetHdfs(string osClient, out OsClientSecret clientModel)
        {
            clientModel = OsClientExtend.GetClient(osClient);
            if (clientModel?.OsClientModel == null) throw new InvalidOperationException("当前租户 HDFS 配置不可用。");
            var hdfs = clientModel.OsClientModel["HDFS"].Val<string>() ?? "Aliyun";
            return hdfs switch
            {
                "MinIO" => MicroiEngine.HDFSFactory(HDFSType.MinIO),
                "S3" => MicroiEngine.HDFSFactory(HDFSType.AmazonS3),
                _ => MicroiEngine.HDFSFactory(HDFSType.Aliyun)
            };
        }

        private static string Sha256Hex(string value)
        {
            using var sha256 = SHA256.Create();
            return BitConverter.ToString(sha256.ComputeHash(Encoding.UTF8.GetBytes(value ?? string.Empty)))
                .Replace("-", string.Empty)
                .ToLowerInvariant();
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

        private static async Task<DosResult> PutApplicationObject(
            IMicroiHDFS hdfs,
            OsClientSecret clientModel,
            string path,
            Stream stream)
        {
            if (stream.CanSeek) stream.Position = 0;
            return await hdfs.PutObject(new HDFSParam
            {
                ClientModel = clientModel,
                Limit = false,
                FileFullPath = path,
                FileStream = stream
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

        private static async Task<DosResult> UpsertStreamPublishedFile(
            string osClient,
            JObject app,
            StreamPublishAsset asset)
        {
            var appId = SafeJString(app, "Id");
            var filePath = "dist/" + asset.RelativePath;
            var existing = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("mci_ai_app_file", new
            {
                OsClient = osClient,
                _Where = new List<object>
                {
                    new List<object> { "AppId", "=", appId },
                    new List<object> { "AND", "FilePath", "=", filePath }
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
                ["StorageScope"] = "PublicBuildStream",
                ["ContentHash"] = asset.Sha256,
                ["Size"] = asset.Size,
                ["IsDirectory"] = 0,
                ["Version"] = 1
            };

            if (existing.Code == 1 && existing.Data != null)
            {
                var old = JObject.FromObject(existing.Data);
                row["Id"] = SafeJString(old, "Id");
                var unchanged = string.Equals(SafeJString(old, "ContentHash"), asset.Sha256, StringComparison.OrdinalIgnoreCase)
                                && string.Equals(SafeJString(old, "HdfsPath"), asset.Paths.VersionPath, StringComparison.OrdinalIgnoreCase);
                row["Version"] = unchanged ? Math.Max(1, SafeJInt(old, "Version", 1)) : Math.Max(1, SafeJInt(old, "Version", 1)) + 1;
                return await MicroiEngine.FormEngine.UptFormDataAsync(
                    "mci_ai_app_file",
                    BuildTrustedMcpFormWriteParam(osClient, row)).ConfigureAwait(false);
            }

            row["Id"] = Ulid.NewUlid().ToString();
            return await MicroiEngine.FormEngine.AddFormDataAsync(
                "mci_ai_app_file",
                BuildTrustedMcpFormWriteParam(osClient, row)).ConfigureAwait(false);
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
            dynamic currentToken,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var operatorError = ValidateStreamPublishOperator(currentToken);
                if (operatorError != null) return new DosResult<object>(operatorError.Code, null, operatorError.Msg);
                if (IsBlank(osClient)) return new DosResult<object>(0, null, "OsClient 不能为空");
                if (fileStream == null) return new DosResult<object>(0, null, "未接收到应用资产文件流");

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
                var appKey = NormalizeMicroServiceKey(SafeJString(app, "AppKey", SafeJString(app, "AppId")));
                if (IsBlank(appKey)) return new DosResult<object>(0, null, "应用 AppKey 不合法");
                // AppType 是官方/社区历史分类；运行形态只读取 ApplicationType。
                var applicationType = SafeJString(app, "ApplicationType", "Web");
                if (!new[] { "Web", "UniApp", "MicroService" }.Contains(applicationType, StringComparer.OrdinalIgnoreCase))
                    return new DosResult<object>(0, null, "流式发布仅支持 Web、UniApp 和 MicroService");

                if (!fileStream.CanSeek)
                    return new DosResult<object>(0, null, "当前 multipart 文件流不可定位，无法安全校验大小和 SHA-256");
                fileStream.Position = 0;
                var actualLength = fileStream.Length;
                if (contentLength > 0 && contentLength != actualLength)
                    return new DosResult<object>(0, null, "Content-Length 与实际文件长度不一致");

                var currentUser = GetMcpOperator(currentToken);
                var uploadOptions = FileUploadSecurityOptions.Load(OsClientExtend.GetClient(osClient)?.OsClientModel);
                if (!uploadOptions.UploadEnabled) return new DosResult<object>(0, null, "当前租户已停用文件上传");
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
                DosResult uploadResult = null;
                var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
                {
                    Key = $"V8Mcp:ApplicationAsset:{appKey}:{versionNo}:{Sha256Hex(relativePath)}",
                    OsClient = osClient,
                    Expiry = TimeSpan.FromMinutes(30),
                    RetryIntervalMs = 50,
                    UseExponentialBackoff = true
                }, async () =>
                {
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

                    if (versionExists.Exists && !markerExists.Exists)
                    {
                        uploadResult = new DosResult(0, null,
                            "目标历史版本文件已存在，但缺少匹配的完整性标记；为保护不可变历史版本，已拒绝覆盖");
                        return;
                    }

                    idempotent = versionExists.Exists && markerExists.Exists;
                    if (idempotent)
                    {
                        uploadResult = new DosResult(1);
                        return;
                    }

                    // 只有确实需要写入新对象时才占用日额度；SHA 校验失败和幂等重试不扣额度。
                    if (totalBytes > 0)
                    {
                        var userId = SafeJString(currentUser, "Id", SafeJString(currentUser, "UserId"));
                        var quotaError = await FileUploadSecurity.ReserveDailyQuotaAsync(osClient, userId, totalBytes, uploadOptions).ConfigureAwait(false);
                        if (quotaError != null)
                        {
                            uploadResult = quotaError;
                            return;
                        }
                    }

                    // 完整性标记必须最后写入。即使进程在上传中途退出，也不会把半成品误认作可发布资产。
                    var versionPut = await PutApplicationObject(hdfs, clientModel, paths.VersionPath, fileStream).ConfigureAwait(false);
                    if (versionPut.Code != 1)
                    {
                        uploadResult = new DosResult(versionPut.Code, versionPut.Data, "流式写入应用版本资产失败：" + versionPut.Msg);
                        return;
                    }

                    var markerJson = JsonConvert.SerializeObject(new
                    {
                        AppKey = appKey,
                        VersionNo = versionNo,
                        RelativePath = relativePath,
                        Sha256 = actualSha256,
                        Size = actualLength
                    });
                    await using var markerStream = new MemoryStream(Encoding.UTF8.GetBytes(markerJson), false);
                    var markerPut = await PutApplicationObject(hdfs, clientModel, paths.IntegrityMarkerPath, markerStream).ConfigureAwait(false);
                    if (markerPut.Code != 1)
                    {
                        var cleanup = await hdfs.DeleteObject(new HDFSParam
                        {
                            ClientModel = clientModel,
                            Limit = false,
                            FileFullPath = paths.VersionPath
                        }).ConfigureAwait(false);
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
                    Path = relativePath,
                    Sha256 = actualSha256,
                    Size = actualLength,
                    VersionFilePath = paths.VersionPath,
                    RootFilePath = paths.RootPath,
                    LatestFilePath = paths.LatestPath,
                    IntegrityMarkerPath = paths.IntegrityMarkerPath,
                    Streamed = true,
                    Idempotent = idempotent,
                    StablePromoted = false
                }, idempotent ? "相同版本资产已存在，已幂等复用" : "应用版本资产已流式上传");
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
                    var config = result.Data is JObject obj ? obj : JObject.FromObject(result.Data);
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
            string changeSummary)
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
            var row = new JObject
            {
                ["AppId"] = appId,
                ["AppName"] = SafeJString(app, "Name", SafeJString(app, "AppName")),
                ["VersionNo"] = versionNo,
                ["VersionName"] = versionNo,
                ["Status"] = "Published",
                ["SourceSnapshotPath"] = SafeJString(app, "PrivateSourcePath", "ai-app-source/" + appId),
                ["PublishPath"] = entryVersionPath,
                ["PreviewUrl"] = previewUrl,
                ["BuildTaskId"] = "",
                ["BuildLog"] = JsonConvert.SerializeObject(new { Mode = "StreamedAssets", AssetCount = fileCount, TotalSize = totalSize }),
                ["ChangeSummary"] = changeSummary.DosIsNullOrWhiteSpace() ? "二进制流式发布" : changeSummary,
                ["FileCount"] = fileCount,
                ["TotalSize"] = totalSize
            };
            if (existing.Code == 1 && existing.Data != null)
            {
                row["Id"] = Convert.ToString(existing.Data.Id);
                return await MicroiEngine.FormEngine.UptFormDataAsync(
                    "mci_ai_app_version",
                    BuildTrustedMcpFormWriteParam(osClient, row)).ConfigureAwait(false);
            }
            row["Id"] = Ulid.NewUlid().ToString();
            return await MicroiEngine.FormEngine.AddFormDataAsync(
                "mci_ai_app_version",
                BuildTrustedMcpFormWriteParam(osClient, row)).ConfigureAwait(false);
        }

        /// <summary>
        /// Verify a complete immutable version manifest, then promote stable root
        /// and latest aliases by storage-provider CopyObject. No file body or
        /// Base64 value enters Jint or this JSON request.
        /// </summary>
        public static async Task<DosResult<object>> FinalizeApplicationStreamPublish(
            string osClient,
            JObject param,
            dynamic currentToken,
            CancellationToken cancellationToken = default)
        {
            try
            {
                var operatorError = ValidateStreamPublishOperator(currentToken);
                if (operatorError != null) return new DosResult<object>(operatorError.Code, null, operatorError.Msg);
                if (param == null) return new DosResult<object>(0, null, "发布清单不能为空");

                var appIdOrKey = param["AppIdOrKey"]?.Val<string>() ?? param["AppId"]?.Val<string>() ?? param["AppKey"]?.Val<string>();
                var app = await FindAiApplication(osClient, appIdOrKey).ConfigureAwait(false);
                if (app == null) return new DosResult<object>(2, null, "在线 AI 应用不存在");
                var appKey = NormalizeMicroServiceKey(SafeJString(app, "AppKey", SafeJString(app, "AppId")));
                if (IsBlank(appKey)) return new DosResult<object>(0, null, "应用 AppKey 不合法");

                DosResult<object> publishResult = null;
                var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
                {
                    // 同一个应用的稳定 root/latest 入口必须跨节点串行切换，避免两个版本交叉复制成混合版本。
                    Key = $"V8Mcp:ApplicationPublish:{appKey}",
                    OsClient = osClient,
                    Expiry = TimeSpan.FromHours(2),
                    RetryIntervalMs = 100,
                    UseExponentialBackoff = true
                }, async () =>
                {
                    publishResult = await FinalizeApplicationStreamPublishCore(
                        osClient,
                        param,
                        currentToken,
                        cancellationToken).ConfigureAwait(false);
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
            dynamic currentToken,
            CancellationToken cancellationToken)
        {
            try
            {
                var operatorError = ValidateStreamPublishOperator(currentToken);
                if (operatorError != null) return new DosResult<object>(operatorError.Code, null, operatorError.Msg);
                if (param == null) return new DosResult<object>(0, null, "发布清单不能为空");

                var appIdOrKey = param["AppIdOrKey"]?.Val<string>() ?? param["AppId"]?.Val<string>() ?? param["AppKey"]?.Val<string>();
                var app = await FindAiApplication(osClient, appIdOrKey).ConfigureAwait(false);
                if (app == null) return new DosResult<object>(2, null, "在线 AI 应用不存在");
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
                    if (totalSize > long.MaxValue - size) return new DosResult<object>(0, null, "发布清单总大小溢出");
                    totalSize += size;
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

                var hdfs = ResolveApplicationAssetHdfs(osClient, out var clientModel);
                foreach (var asset in assets)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    var versionExists = await ApplicationObjectExists(hdfs, clientModel, asset.Paths.VersionPath).ConfigureAwait(false);
                    if (versionExists.Error != null) return new DosResult<object>(0, null, versionExists.Error.Msg);
                    var markerExists = await ApplicationObjectExists(hdfs, clientModel, asset.Paths.IntegrityMarkerPath).ConfigureAwait(false);
                    if (markerExists.Error != null) return new DosResult<object>(0, null, markerExists.Error.Msg);
                    if (!versionExists.Exists || !markerExists.Exists)
                        return new DosResult<object>(0, null, "版本资产或完整性标记不存在，拒绝切换稳定入口：" + asset.RelativePath);
                }

                // 单文件上传阶段不改数据库“当前发布文件”元数据。只有完整清单都存在时才更新，
                // 避免中断的半套版本提前出现在应用上下文中；失败后重试仍按 Path+Hash 幂等。
                foreach (var asset in assets)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    var metadataResult = await UpsertStreamPublishedFile(osClient, app, asset).ConfigureAwait(false);
                    if (metadataResult.Code != 1)
                        return new DosResult<object>(metadataResult.Code, metadataResult.Data, "保存发布文件元数据失败，稳定入口尚未切换：" + metadataResult.Msg);
                }

                // Publish non-entry assets first and switch the entry last so users
                // never observe an entry that references assets not yet promoted.
                foreach (var asset in assets.OrderBy(asset => asset.IsEntry ? 1 : 0).ThenBy(asset => asset.RelativePath, StringComparer.Ordinal))
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    foreach (var destination in new[] { asset.Paths.RootPath, asset.Paths.LatestPath })
                    {
                        var copy = await CopyApplicationObject(hdfs, clientModel, asset.Paths.VersionPath, destination).ConfigureAwait(false);
                        if (copy.Code != 1)
                            return new DosResult<object>(copy.Code, copy.Data, $"服务端复制失败：{asset.RelativePath} -> {destination}，{copy.Msg}");
                        var copied = await ApplicationObjectExists(hdfs, clientModel, destination).ConfigureAwait(false);
                        if (copied.Error != null || !copied.Exists)
                            return new DosResult<object>(0, null, "服务端复制后回读不存在：" + destination);
                    }
                }

                var entry = assets.First(asset => asset.IsEntry);
                var previewUrl = await ResolveApplicationPublicUrl(osClient, entry.Paths.RootPath).ConfigureAwait(false);
                var existingVersion = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("mci_ai_app_version", new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "AppId", "=", SafeJString(app, "Id") },
                        new List<object> { "AND", "VersionNo", "=", versionNo }
                    }
                }).ConfigureAwait(false);
                var versionAlreadyRecorded = existingVersion.Code == 1 && existingVersion.Data != null;
                var versionResult = await UpsertStreamPublishVersion(
                    osClient,
                    app,
                    versionNo,
                    entry.Paths.VersionPath,
                    previewUrl,
                    assets.Count,
                    totalSize,
                    param["ChangeSummary"]?.Val<string>()).ConfigureAwait(false);
                if (versionResult.Code != 1) return new DosResult<object>(versionResult.Code, versionResult.Data, "保存应用版本失败：" + versionResult.Msg);

                var appUpdate = new JObject
                {
                    ["Id"] = SafeJString(app, "Id"),
                    ["AppKey"] = appKey,
                    ["CurrentVersion"] = SafeJInt(app, "CurrentVersion") + (versionAlreadyRecorded ? 0 : 1),
                    ["Status"] = "Published",
                    ["BuildStatus"] = "Success",
                    ["PreviewUrl"] = previewUrl,
                    ["PublicPublishPath"] = entry.Paths.RootPath,
                    ["LastBuildTaskId"] = "",
                    ["LastBuildMsg"] = $"真实编译产物已通过流式 HDFS 发布，共 {assets.Count} 个文件。",
                    ["UpdateTime"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                };
                var appUpdateResult = await MicroiEngine.FormEngine.UptFormDataAsync(
                    "sys_microistore",
                    BuildTrustedMcpFormWriteParam(osClient, appUpdate)).ConfigureAwait(false);
                if (appUpdateResult.Code != 1)
                    return new DosResult<object>(appUpdateResult.Code, appUpdateResult.Data, "稳定资产已切换，但应用商城元数据更新失败：" + appUpdateResult.Msg);

                object microServiceInfo = null;
                if (string.Equals(applicationType, "MicroService", StringComparison.OrdinalIgnoreCase))
                {
                    var source = new JObject
                    {
                        ["MsKey"] = appKey,
                        ["MsName"] = SafeJString(app, "Name", SafeJString(app, "AppName", appKey)),
                        ["BuildVersion"] = versionNo,
                        ["EntryPath"] = entryPath,
                        ["AssetCount"] = assets.Count,
                        ["TotalSize"] = totalSize,
                        ["MsUrl"] = previewUrl,
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
                        ["MsKey"] = appKey,
                        ["BuildVersion"] = versionNo,
                        ["EntryPath"] = entryPath,
                        ["Assets"] = publishedAssets
                    };
                    var serviceData = BuildMicroServiceData(
                        osClient,
                        source,
                        versionNo,
                        publishedAssets.ToString(Formatting.None),
                        manifest.ToString(Formatting.None));
                    var serviceUpsert = await UpsertRecordByIdOrKey(osClient, "sys_microiservice", serviceData, "MsKey", "微服务").ConfigureAwait(false);
                    if (serviceUpsert.Code != 1)
                        return new DosResult<object>(serviceUpsert.Code, serviceUpsert.Data, "应用商城已发布，但微服务运行元数据更新失败：" + serviceUpsert.Msg);
                    var detailResult = await GetMicroService(osClient, appKey).ConfigureAwait(false);
                    if (detailResult.Code == 1 && detailResult.Data != null)
                    {
                        var detail = JObject.FromObject(detailResult.Data);
                        var service = detail["Service"] as JObject;
                        var routes = GetArrayParam(param, "Routes", "routes", "Pages", "pages");
                        var routeWarnings = await SyncMicroServicePages(
                            osClient,
                            SafeJString(service, "Id"),
                            appKey,
                            versionNo,
                            entryPath,
                            routes).ConfigureAwait(false);
                        microServiceInfo = new { Service = service, RouteWarnings = routeWarnings };
                    }
                }

                return new DosResult<object>(1, new
                {
                    AppId = SafeJString(app, "Id"),
                    AppKey = appKey,
                    ApplicationType = applicationType,
                    VersionNo = versionNo,
                    EntryPath = entryPath,
                    PreviewUrl = previewUrl,
                    PublishPath = entry.Paths.RootPath,
                    LatestPath = entry.Paths.LatestPath,
                    VersionPath = entry.Paths.VersionPath,
                    AssetCount = assets.Count,
                    TotalSize = totalSize,
                    Streamed = true,
                    StablePromoted = true,
                    IdempotentVersion = versionAlreadyRecorded,
                    MicroService = microServiceInfo
                }, "应用资产已完成流式发布并切换稳定入口");
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

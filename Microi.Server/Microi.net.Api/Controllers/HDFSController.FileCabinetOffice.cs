using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Microi.net.Api
{
    public partial class HDFSController
    {
        private const int FileCabinetOfficeManifestMaxBytes = 1024 * 1024;

        // Object storage is the durable source of file-cabinet versions. The private
        // history prefix is keyed by tenant, bucket and exact original object key;
        // clients never supply a manifest or snapshot path.
        private static string FileCabinetOfficeRoot(string osClient, bool limit, string originalPath)
            => $"{osClient.ToLowerInvariant()}/.microi-office-history/{Sha256Hex((limit ? "private" : "public") + "|" + originalPath)}/";

        private static (IMicroiHDFS Client, OsClientSecret Model) FileCabinetOfficeStore(string osClient)
        {
            var model = OsClient.GetClient(osClient);
            if (model?.OsClientModel == null) return (null, null);
            var kind = Convert.ToString(model.OsClientModel["HDFS"]);
            var client = string.Equals(kind, "MinIO", StringComparison.OrdinalIgnoreCase)
                ? MicroiEngine.HDFSFactory(HDFSType.MinIO)
                : string.Equals(kind, "S3", StringComparison.OrdinalIgnoreCase)
                    || string.Equals(kind, "AmazonS3", StringComparison.OrdinalIgnoreCase)
                    ? MicroiEngine.HDFSFactory(HDFSType.AmazonS3)
                    : string.IsNullOrWhiteSpace(kind)
                        || string.Equals(kind, "Aliyun", StringComparison.OrdinalIgnoreCase)
                        || string.Equals(kind, "AliOss", StringComparison.OrdinalIgnoreCase)
                        ? MicroiEngine.HDFSFactory(HDFSType.Aliyun)
                        : null;
            return (client, model);
        }

        /// <summary>
        /// Move a versioned file's private snapshots and manifest before moving the
        /// current object. A failed staging step leaves the original file and index
        /// authoritative. Staged orphan objects are harmless and may be swept later.
        /// </summary>
        private async Task<DosResult> MoveFileCabinetOfficeObjectAsync(
            DiyUploadParam param, Func<Task<DosResult>> moveCurrent)
        {
            var source = param.FilePathName;
            var destination = param.Path;
            if (source.EndsWith('/') || !OfficePreviewSourceExtensions.Contains(Path.GetExtension(source)))
                return await moveCurrent().ConfigureAwait(false);
            if (!string.Equals(Path.GetExtension(source), Path.GetExtension(destination), StringComparison.OrdinalIgnoreCase))
                return new DosResult(0, null, "Office文件移动或重命名必须保留原扩展名！");
            var osClient = param.OsClient;
            var limit = param.Limit != false;
            var store = FileCabinetOfficeStore(osClient);
            if (store.Client == null) return new DosResult(0, null, "当前租户的对象存储配置不可用！");
            var originalRoot = FileCabinetOfficeRoot(osClient, limit, source);
            var originalManifest = originalRoot + "manifest.json";
            var hasHistory = await store.Client.ObjectExist(new HDFSParam
            {
                ClientModel = store.Model, Limit = true, FileFullPath = originalManifest
            }).ConfigureAwait(false);
            if (hasHistory?.Code != 1) return new DosResult(0, null, "检查Office版本索引失败！");
            if (!hasHistory.Data) return await moveCurrent().ConfigureAwait(false);

            var leaseResult = await TryAcquireOfficeSaveLeaseAsync(osClient, "FileCabinet", source,
                limit ? "private" : "public", HttpContext.RequestAborted);
            if (leaseResult.Error != null) return leaseResult.Error;
            await using var lease = leaseResult.Lease;
            var current = await ReadFileCabinetOfficeMetaAsync(osClient, source, limit);
            if (current.Error != null) return current.Error;
            var destinationExists = await store.Client.ObjectExist(new HDFSParam
            {
                ClientModel = store.Model, Limit = limit, FileFullPath = destination
            }).ConfigureAwait(false);
            if (destinationExists?.Code != 1 || destinationExists.Data)
                return new DosResult(0, null, "目标文件已存在或无法验证目标路径！");
            var newRoot = FileCabinetOfficeRoot(osClient, limit, destination);
            var newManifestExists = await store.Client.ObjectExist(new HDFSParam
            {
                ClientModel = store.Model, Limit = true, FileFullPath = newRoot + "manifest.json"
            }).ConfigureAwait(false);
            if (newManifestExists?.Code != 1 || newManifestExists.Data)
                return new DosResult(0, null, "目标路径已有Office版本索引！");

            var updatedMeta = (JObject)current.Meta.DeepClone();
            updatedMeta["OriginalPath"] = destination;
            updatedMeta["Path"] = destination;
            updatedMeta["Name"] = GetFileNameFromPath(destination);
            foreach (var item in (updatedMeta["Versions"] as JArray ?? new JArray()).OfType<JObject>())
            {
                if (item["IsLatest"]?.Value<bool>() == true)
                {
                    item["Path"] = destination;
                    item["Name"] = GetFileNameFromPath(destination);
                    continue;
                }
                var oldPath = TokenString(item["Path"]);
                if (oldPath == null || !oldPath.TrimStart('/').StartsWith(originalRoot, StringComparison.Ordinal))
                    return new DosResult(0, null, "Office历史版本路径不合法！");
                var newPath = "/" + newRoot + oldPath.TrimStart('/')[originalRoot.Length..];
                var copy = await store.Client.CopyObject(new HDFSParam
                {
                    ClientModel = store.Model,
                    Limit = true,
                    FileFullPath = oldPath,
                    DestPath = newPath
                }).ConfigureAwait(false);
                if (copy.Code != 1) return new DosResult(0, null, "迁移Office历史版本失败！");
                item["Path"] = newPath;
            }
            if (!await lease.IsOwnerAsync()) return new DosResult(0, null, "Office保存租约已失效！");
            var indexWrite = await WriteFileCabinetOfficeMetaAsync(osClient, destination, limit, updatedMeta);
            if (indexWrite.Code != 1) return new DosResult(0, null, "迁移Office版本索引失败！");
            var moveResult = await moveCurrent().ConfigureAwait(false);
            if (moveResult.Code != 1)
            {
                // The original path is still authoritative. Remove the staged index
                // so a later retry is not rejected as a destination collision.
                try
                {
                    await store.Client.DeleteObject(new HDFSParam
                    {
                        ClientModel = store.Model, Limit = true, FileFullPath = newRoot + "manifest.json"
                    }).ConfigureAwait(false);
                }
                catch (Exception ex)
                {
                    MicroiEngine.QueueSystemLog(osClient, "HDFS", "OfficeHistoryCleanupFailed",
                        "文件柜Office迁移失败后清理暂存索引失败", ex.ToString(), 2, false, HttpContext.TraceIdentifier);
                }
                return moveResult;
            }

            // Cleanup is deliberately after the authoritative new file and manifest
            // exist. Failure leaves only unreachable old snapshots, never lost history.
            try
            {
                foreach (var oldVersion in (current.Meta["Versions"] as JArray ?? new JArray()).OfType<JObject>())
                {
                    if (oldVersion["IsLatest"]?.Value<bool>() == true) continue;
                    await store.Client.DeleteObject(new HDFSParam
                    {
                        ClientModel = store.Model, Limit = true,
                        FileFullPath = TokenString(oldVersion["Path"])
                    }).ConfigureAwait(false);
                }
                await store.Client.DeleteObject(new HDFSParam
                {
                    ClientModel = store.Model, Limit = true,
                    FileFullPath = originalManifest
                }).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                MicroiEngine.QueueSystemLog(osClient, "HDFS", "OfficeHistoryCleanupFailed",
                    "文件柜Office旧版本清理失败", ex.ToString(), 2, false, HttpContext.TraceIdentifier);
            }
            return moveResult;
        }

        private async Task<DosResult> DeleteFileCabinetOfficeObjectAsync(
            DiyUploadParam param, Func<Task<DosResult>> deleteCurrent)
        {
            var path = param.FilePathName;
            if (path.EndsWith('/') || !OfficePreviewSourceExtensions.Contains(Path.GetExtension(path)))
                return await deleteCurrent().ConfigureAwait(false);
            var store = FileCabinetOfficeStore(param.OsClient);
            if (store.Client == null) return new DosResult(0, null, "当前租户的对象存储配置不可用！");
            var limit = param.Limit != false;
            var manifest = FileCabinetOfficeRoot(param.OsClient, limit, path) + "manifest.json";
            var exists = await store.Client.ObjectExist(new HDFSParam
            {
                ClientModel = store.Model, Limit = true, FileFullPath = manifest
            }).ConfigureAwait(false);
            if (exists?.Code != 1) return new DosResult(0, null, "检查Office版本索引失败！");
            if (!exists.Data) return await deleteCurrent().ConfigureAwait(false);
            var leaseResult = await TryAcquireOfficeSaveLeaseAsync(param.OsClient, "FileCabinet", path,
                limit ? "private" : "public", HttpContext.RequestAborted);
            if (leaseResult.Error != null) return leaseResult.Error;
            await using var lease = leaseResult.Lease;
            var current = await ReadFileCabinetOfficeMetaAsync(param.OsClient, path, limit);
            if (current.Error != null) return current.Error;
            var deleted = await deleteCurrent().ConfigureAwait(false);
            if (deleted.Code != 1) return deleted;
            try
            {
                foreach (var version in (current.Meta["Versions"] as JArray ?? new JArray()).OfType<JObject>())
                {
                    if (version["IsLatest"]?.Value<bool>() == true) continue;
                    await store.Client.DeleteObject(new HDFSParam
                    {
                        ClientModel = store.Model, Limit = true,
                        FileFullPath = TokenString(version["Path"])
                    }).ConfigureAwait(false);
                }
                await store.Client.DeleteObject(new HDFSParam
                {
                    ClientModel = store.Model, Limit = true, FileFullPath = manifest
                }).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                MicroiEngine.QueueSystemLog(param.OsClient, "HDFS", "OfficeHistoryCleanupFailed",
                    "文件柜Office删除后历史清理失败", ex.ToString(), 2, false, HttpContext.TraceIdentifier);
            }
            return deleted;
        }

        private static async Task<DosResult> AuthorizeFileCabinetOfficeAsync(
            string osClient, JObject user, string sourcePath, string sysMenuId, bool limit)
            => await PrivateFileAccessAuthorization.AuthorizeFileManagerOfficeAsync(new DiyUploadParam
            {
                OsClient = osClient,
                ResourceKind = "FileManagerObject",
                ResourceId = sourcePath,
                FilePathName = sourcePath,
                SysMenuId = sysMenuId,
                Limit = limit,
                _CurrentUser = user
            }).ConfigureAwait(false);

        private static JObject NewFileCabinetOfficeMeta(string path, bool limit)
        {
            var name = GetFileNameFromPath(path);
            return new JObject
            {
                ["OriginalPath"] = path,
                ["Path"] = path,
                ["Name"] = name,
                ["Limit"] = limit,
                ["Version"] = "v1.0.0",
                ["Versions"] = new JArray(new JObject
                {
                    ["Version"] = "v1.0.0",
                    ["Path"] = path,
                    ["Name"] = name,
                    ["Limit"] = limit,
                    ["IsLatest"] = true
                })
            };
        }

        private static bool IsValidFileCabinetOfficeMeta(JObject meta, string path, bool limit, string root)
        {
            if (!string.Equals(TokenString(meta["OriginalPath"]), path, StringComparison.Ordinal)
                || !string.Equals(TokenString(meta["Path"]), path, StringComparison.Ordinal)
                || meta["Limit"]?.Value<bool>() != limit)
                return false;
            var versions = meta["Versions"] as JArray;
            if (versions == null || versions.Count == 0 || versions.Count > 5000) return false;
            var latestCount = 0;
            var versionNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var item in versions.OfType<JObject>())
            {
                var version = TokenString(item["Version"]);
                var versionPath = TokenString(item["Path"]);
                if (version == null || !Regex.IsMatch(version, @"^v\d+\.\d+\.\d+$")
                    || !versionNames.Add(version) || versionPath == null)
                    return false;
                if (item["IsLatest"]?.Value<bool>() == true)
                {
                    latestCount++;
                    if (!string.Equals(versionPath, path, StringComparison.Ordinal)
                        || item["Limit"]?.Value<bool>() != limit
                        || !string.Equals(version, TokenString(meta["Version"]), StringComparison.Ordinal))
                        return false;
                }
                else if (item["Limit"]?.Value<bool>() != true
                    || !versionPath.TrimStart('/').StartsWith(root, StringComparison.Ordinal))
                    return false;
            }
            return latestCount == 1 && versions.OfType<JObject>().Count() == versions.Count;
        }

        private async Task<(JObject Meta, DosResult Error)> ReadFileCabinetOfficeMetaAsync(
            string osClient, string path, bool limit)
        {
            var store = FileCabinetOfficeStore(osClient);
            if (store.Client == null) return (null, new DosResult(0, null, "当前租户的对象存储配置不可用！"));
            var root = FileCabinetOfficeRoot(osClient, limit, path);
            var manifest = root + "manifest.json";
            var exists = await store.Client.ObjectExist(new HDFSParam
            {
                ClientModel = store.Model, Limit = true, FileFullPath = manifest
            }).ConfigureAwait(false);
            if (exists?.Code != 1) return (null, new DosResult(0, null, "读取Office版本索引失败！"));
            if (!exists.Data) return (NewFileCabinetOfficeMeta(path, limit), null);

            using var output = new FileCabinetOfficeLimitedStream(FileCabinetOfficeManifestMaxBytes);
            var read = await store.Client.CopyObjectToStream(new HDFSParam
            {
                ClientModel = store.Model,
                Limit = true,
                FileFullPath = manifest,
                FileStream = output,
                CancellationToken = HttpContext.RequestAborted
            }).ConfigureAwait(false);
            if (read?.Code != 1) return (null, new DosResult(0, null, "读取Office版本索引失败！"));
            try
            {
                var meta = JObject.Parse(Encoding.UTF8.GetString(output.ToArray()));
                if (!IsValidFileCabinetOfficeMeta(meta, path, limit, root))
                    return (null, new DosResult(0, null, "Office版本索引与当前对象不匹配或包含无效路径！"));
                return (meta, null);
            }
            catch
            {
                return (null, new DosResult(0, null, "Office版本索引格式错误！"));
            }
        }

        private async Task<DosResult> WriteFileCabinetOfficeMetaAsync(
            string osClient, string path, bool limit, JObject meta)
        {
            var bytes = Encoding.UTF8.GetBytes(meta.ToString(Newtonsoft.Json.Formatting.None));
            if (bytes.Length > FileCabinetOfficeManifestMaxBytes)
                return new DosResult(0, null, "Office版本索引超过上限！");
            using var stream = new MemoryStream(bytes, writable: false);
            return await PutOfficeObject(osClient, true,
                FileCabinetOfficeRoot(osClient, limit, path) + "manifest.json", stream).ConfigureAwait(false);
        }

        private async Task<(byte[] Bytes, DosResult Error)> ReadFileCabinetOfficeObjectAsync(
            string osClient, string path, bool limit, long maxBytes)
        {
            var store = FileCabinetOfficeStore(osClient);
            if (store.Client == null) return (null, new DosResult(0, null, "当前租户的对象存储配置不可用！"));
            try
            {
                using var output = new FileCabinetOfficeLimitedStream(maxBytes);
                var read = await store.Client.CopyObjectToStream(new HDFSParam
                {
                    ClientModel = store.Model,
                    Limit = limit,
                    FileFullPath = path.TrimStart('/'),
                    FileStream = output,
                    CancellationToken = HttpContext.RequestAborted
                }).ConfigureAwait(false);
                return read?.Code == 1
                    ? (output.ToArray(), null)
                    : (null, new DosResult(0, null, "读取Office原文件失败！"));
            }
            catch
            {
                return (null, new DosResult(0, null, "Office原文件超过平台单文件上限或读取失败！"));
            }
        }

        private sealed class FileCabinetOfficeLimitedStream : MemoryStream
        {
            private readonly long _maxBytes;
            internal FileCabinetOfficeLimitedStream(long maxBytes) => _maxBytes = maxBytes;
            private void Check(int count)
            {
                if (count < 0 || Length > _maxBytes - count) throw new IOException("Office object exceeds size limit");
            }
            public override void Write(byte[] buffer, int offset, int count)
            {
                Check(count);
                base.Write(buffer, offset, count);
            }
            public override void Write(ReadOnlySpan<byte> buffer)
            {
                Check(buffer.Length);
                base.Write(buffer);
            }
            public override ValueTask WriteAsync(ReadOnlyMemory<byte> buffer, CancellationToken cancellationToken = default)
            {
                Check(buffer.Length);
                return base.WriteAsync(buffer, cancellationToken);
            }
            public override Task WriteAsync(byte[] buffer, int offset, int count, CancellationToken cancellationToken)
            {
                Check(count);
                return base.WriteAsync(buffer, offset, count, cancellationToken);
            }
        }

        [HttpPost]
        public async Task<JsonResult> GetFileCabinetOfficeMeta([FromBody] JObject param)
        {
            if (param == null) return Json(new DosResult(0, null, "请求参数不能为空！"));
            var token = await DiyToken.GetCurrentToken();
            if (token?.CurrentUser == null) return Json(new DosResult(1001, null, "登录身份已过期！"));
            var osClient = token.OsClient?.ToString();
            if (!TryValidateAuthenticatedOsClient(param, osClient, out var tenantError)) return Json(tenantError);
            var path = TokenString(param["FilePathName"]);
            if (string.IsNullOrWhiteSpace(path)) return Json(new DosResult(0, null, "FilePathName不能为空！"));
            try { path = TenantConfigurationSecurity.NormalizeStoragePath(osClient, path); }
            catch { return Json(new DosResult(0, null, "文件路径不合法！")); }
            if (!OfficePreviewSourceExtensions.Contains(Path.GetExtension(path)))
                return Json(new DosResult(0, null, "当前文件类型不支持Office在线编辑！"));
            var limit = param["Limit"]?.Value<bool>() != false;
            var access = await AuthorizeFileCabinetOfficeAsync(osClient, ToJObject(token.CurrentUser),
                path, TokenString(param["SysMenuId"]), limit);
            if (access != null) return Json(access);
            var result = await ReadFileCabinetOfficeMetaAsync(osClient, path, limit);
            return Json(result.Error ?? new DosResult(1, new { FileMeta = result.Meta, EnableVersion = true }));
        }

        [HttpPost]
        public async Task<JsonResult> SaveFileCabinetOfficeDocument([FromBody] JObject param)
        {
            if (param == null) return Json(new DosResult(0, null, "请求参数不能为空！"));
            var token = await DiyToken.GetCurrentToken();
            if (token?.CurrentUser == null) return Json(new DosResult(1001, null, "登录身份已过期！"));
            var osClient = token.OsClient?.ToString();
            if (!TryValidateAuthenticatedOsClient(param, osClient, out var tenantError)) return Json(tenantError);
            var path = TokenString(param["FilePathName"]);
            var downloadUrl = TokenString(param["DownloadUrl"]);
            if (string.IsNullOrWhiteSpace(path) || string.IsNullOrWhiteSpace(downloadUrl))
                return Json(new DosResult(0, null, "FilePathName和DownloadUrl不能为空！"));
            try { path = TenantConfigurationSecurity.NormalizeStoragePath(osClient, path); }
            catch { return Json(new DosResult(0, null, "文件路径不合法！")); }
            var extension = Path.GetExtension(path);
            if (!OfficePreviewSourceExtensions.Contains(extension) || extension.Equals(".pdf", StringComparison.OrdinalIgnoreCase))
                return Json(new DosResult(0, null, "当前文件类型不支持Office在线保存！"));
            if (!IsAllowedOfficeDownloadUrl(downloadUrl, await GetOnlyOfficeApiBase(osClient)))
                return Json(new DosResult(0, null, "OnlyOffice导出地址不在平台配置的文档服务域名内！"));

            var limit = param["Limit"]?.Value<bool>() != false;
            var user = ToJObject(token.CurrentUser);
            var menuId = TokenString(param["SysMenuId"]);
            var access = await AuthorizeFileCabinetOfficeAsync(osClient, user, path, menuId, limit);
            if (access != null) return Json(access);

            var leaseResult = await TryAcquireOfficeSaveLeaseAsync(osClient, "FileCabinet", path,
                limit ? "private" : "public", HttpContext.RequestAborted);
            if (leaseResult.Error != null) return Json(leaseResult.Error);
            await using var lease = leaseResult.Lease;
            access = await AuthorizeFileCabinetOfficeAsync(osClient, user, path, menuId, limit);
            if (access != null) return Json(access);
            var current = await ReadFileCabinetOfficeMetaAsync(osClient, path, limit);
            if (current.Error != null) return Json(current.Error);
            var meta = current.Meta;
            var currentVersion = TokenString(meta["Version"]);
            if (!string.Equals(TokenString(param["ExpectedVersion"]), currentVersion, StringComparison.Ordinal))
                return Json(new DosResult(0, null, "文件已产生新版本，请刷新后重新编辑！"));

            var limits = MicroiHDFS.GetFileUploadSecurityOptions(osClient);
            if (!limits.UploadEnabled) return Json(FileUploadSecurity.CreateTenantUploadDisabledResult(osClient));
            byte[] newBytes;
            try
            {
                using var handler = new HttpClientHandler { AllowAutoRedirect = false };
                using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(90) };
                using var response = await client.GetAsync(downloadUrl,
                    HttpCompletionOption.ResponseHeadersRead, HttpContext.RequestAborted);
                if (!response.IsSuccessStatusCode || response.Content.Headers.ContentLength > limits.MaxFileBytes)
                    return Json(new DosResult(0, null, "OnlyOffice导出文件下载失败或超过平台单文件上限！"));
                await using var input = await response.Content.ReadAsStreamAsync(HttpContext.RequestAborted);
                using var output = new FileCabinetOfficeLimitedStream(limits.MaxFileBytes);
                await input.CopyToAsync(output, HttpContext.RequestAborted);
                newBytes = output.ToArray();
            }
            catch (Exception ex) when (ex is IOException or HttpRequestException or OperationCanceledException)
            {
                return Json(new DosResult(0, null, "OnlyOffice导出文件下载失败或超过平台单文件上限！"));
            }
            if (newBytes.Length == 0 || !HasExpectedOfficeFileSignature(extension, newBytes))
                return Json(new DosResult(0, null, "OnlyOffice导出内容与原文件类型不匹配！"));
            var quotaError = await FileUploadSecurity.ReserveDailyQuotaAsync(osClient,
                TokenString(user?["Id"]), newBytes.LongLength, limits);
            if (quotaError != null) return Json(quotaError);

            var old = await ReadFileCabinetOfficeObjectAsync(osClient, path, limit, limits.MaxFileBytes);
            if (old.Error != null) return Json(old.Error);
            var versions = meta["Versions"] as JArray ?? new JArray();
            var nextVersion = NextMicroiVersion(versions);
            var root = FileCabinetOfficeRoot(osClient, limit, path);
            var archivePath = "/" + root + currentVersion + extension.ToLowerInvariant();
            using (var archive = new MemoryStream(old.Bytes, writable: false))
            {
                var archiveResult = await PutOfficeObject(osClient, true, archivePath, archive);
                if (archiveResult.Code != 1) return Json(new DosResult(0, null, "保存Office历史版本失败！"));
            }
            if (!await lease.IsOwnerAsync()) return Json(new DosResult(0, null, "Office保存租约已失效！"));
            using (var updated = new MemoryStream(newBytes, writable: false))
            {
                var put = await PutOfficeObject(osClient, limit, path, updated);
                if (put.Code != 1) return Json(new DosResult(0, null, "保存Office文件失败！"));
            }
            foreach (var item in versions.OfType<JObject>())
            {
                if (item["IsLatest"]?.Value<bool>() == true)
                {
                    item["Path"] = archivePath;
                    item["Limit"] = true;
                    item["IsLatest"] = false;
                }
            }
            var now = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss");
            versions.Add(new JObject
            {
                ["Version"] = nextVersion,
                ["Path"] = path,
                ["Name"] = GetFileNameFromPath(path),
                ["Limit"] = limit,
                ["Size"] = newBytes.Length,
                ["CreateTime"] = now,
                ["IsLatest"] = true,
                ["UserId"] = TokenString(user?["Id"]),
                ["UserName"] = TokenString(user?["Name"]) ?? TokenString(user?["Account"])
            });
            meta["Versions"] = versions;
            meta["Version"] = nextVersion;
            meta["Size"] = newBytes.Length;
            meta["UpdateTime"] = now;
            if (!await lease.IsOwnerAsync()) return Json(new DosResult(0, null, "Office保存租约已失效，请刷新文件后重试！"));
            var manifestResult = await WriteFileCabinetOfficeMetaAsync(osClient, path, limit, meta);
            if (manifestResult.Code != 1)
            {
                using var restore = new MemoryStream(old.Bytes, writable: false);
                var rollback = await PutOfficeObject(osClient, limit, path, restore);
                return Json(new DosResult(0, null, rollback.Code == 1
                    ? "Office版本索引保存失败，原文件已恢复！"
                    : "Office版本索引保存失败且原文件恢复失败，请联系管理员核查！"));
            }
            return Json(new DosResult(1, new
            {
                FilePathName = path,
                FileName = GetFileNameFromPath(path),
                FileSize = newBytes.Length,
                Version = nextVersion,
                FileMeta = meta
            }, "保存成功"));
        }
    }
}

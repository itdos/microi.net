using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public static partial class V8McpLogic
    {
        private static readonly HttpClient ExternalAttachmentHttpClient = CreateExternalAttachmentHttpClient();

        private static HttpClient CreateExternalAttachmentHttpClient()
        {
            var handler = new HttpClientHandler
            {
                AllowAutoRedirect = true,
                MaxAutomaticRedirections = 20,
                AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate
            };
            return new HttpClient(handler) { Timeout = Timeout.InfiniteTimeSpan };
        }

        public static DosResult<object> GetSupportedDatabaseTypes()
        {
            var list = ExternalDatabaseCatalog.Definitions.Select(item => new
            {
                item.Key,
                item.DisplayName,
                item.DefaultPort,
                item.Aliases,
                item.ConnectionStringExample
            }).ToList();
            return new DosResult<object>(1, new { List = list, Count = list.Count });
        }

        public static async Task<DosResult<object>> InspectExternalDatabase(
            string osClient,
            string databaseType,
            string connectionString,
            string dbKey,
            string tableName,
            int maxTables,
            bool includeColumns,
            int commandTimeoutSeconds)
        {
            try
            {
                var resolved = await ResolveExternalDatabaseConnection(
                    osClient, databaseType, connectionString, dbKey);
                var result = ExternalDatabaseInspector.Inspect(
                    resolved.DatabaseType,
                    resolved.ConnectionString,
                    tableName,
                    maxTables,
                    includeColumns,
                    commandTimeoutSeconds);
                return new DosResult<object>(1, result, "外部数据库结构读取成功");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null,
                    ExternalDatabaseCatalog.SanitizeError(ex.Message, connectionString));
            }
        }

        public static async Task<DosResult<object>> QueryExternalDatabase(
            string osClient,
            string databaseType,
            string connectionString,
            string dbKey,
            string sql,
            JObject parameters,
            int maxRows,
            int commandTimeoutSeconds)
        {
            try
            {
                var resolved = await ResolveExternalDatabaseConnection(
                    osClient, databaseType, connectionString, dbKey);
                var parameterValues = parameters?.Properties().ToDictionary(
                    item => item.Name,
                    item => ConvertExternalQueryParameter(item.Value),
                    StringComparer.OrdinalIgnoreCase);
                var result = ExternalDatabaseInspector.Query(
                    resolved.DatabaseType,
                    resolved.ConnectionString,
                    sql,
                    parameterValues,
                    maxRows,
                    commandTimeoutSeconds);
                return new DosResult<object>(1, result, "外部数据库只读查询成功");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null,
                    ExternalDatabaseCatalog.SanitizeError(ex.Message, connectionString));
            }
        }

        public static string GetAdministrativeSqlConfirmation(string sql)
        {
            var bytes = Encoding.UTF8.GetBytes(sql ?? string.Empty);
            using var sha256 = SHA256.Create();
            return string.Concat(sha256.ComputeHash(bytes).Select(item => item.ToString("x2")));
        }

        public static async Task<DosResult<object>> ExecuteExternalDatabaseSql(
            string osClient,
            string databaseType,
            string connectionString,
            string dbKey,
            string sql,
            string mode,
            JObject parameters,
            int maxRows,
            int commandTimeoutSeconds,
            dynamic currentToken)
        {
            var sqlHash = GetAdministrativeSqlConfirmation(sql);
            var target = IsBlank(dbKey) ? $"temporary:{databaseType}" : $"DbKey:{dbKey}";
            try
            {
                var resolved = await ResolveExternalDatabaseConnection(
                    osClient, databaseType, connectionString, dbKey);
                var parameterValues = parameters?.Properties().ToDictionary(
                    item => item.Name,
                    item => ConvertExternalQueryParameter(item.Value),
                    StringComparer.OrdinalIgnoreCase);
                var result = ExternalDatabaseInspector.ExecuteAdministrativeSql(
                    resolved.DatabaseType,
                    resolved.ConnectionString,
                    sql,
                    mode,
                    parameterValues,
                    maxRows,
                    commandTimeoutSeconds);
                await WriteMcpAuditLog(
                    osClient,
                    "microi_execute_external_database",
                    target,
                    new JObject
                    {
                        ["SqlSha256"] = sqlHash,
                        ["SqlLength"] = sql?.Length ?? 0,
                        ["Mode"] = result.Mode,
                        ["DatabaseType"] = result.DatabaseType,
                        ["Succeeded"] = true
                    }.ToString(Newtonsoft.Json.Formatting.None),
                    currentToken);
                return new DosResult<object>(1, result, "外部数据库管理 SQL 执行成功");
            }
            catch (Exception ex)
            {
                await WriteMcpAuditLog(
                    osClient,
                    "microi_execute_external_database",
                    target,
                    new JObject
                    {
                        ["SqlSha256"] = sqlHash,
                        ["SqlLength"] = sql?.Length ?? 0,
                        ["Mode"] = mode ?? string.Empty,
                        ["Succeeded"] = false
                    }.ToString(Newtonsoft.Json.Formatting.None),
                    currentToken);
                return new DosResult<object>(0, null,
                    ExternalDatabaseCatalog.SanitizeError(ex.Message, connectionString));
            }
        }

        public static async Task<DosResult<object>> SaveDatabaseConnection(
            string osClient,
            JObject param,
            dynamic currentToken)
        {
            var connectionString = param?["ConnectionString"].Val<string>()
                                   ?? param?["DbConn"].Val<string>();
            var readConnectionString = param?["DbReadConn"].Val<string>();
            try
            {
                var dbKey = param?["DbKey"].Val<string>()?.Trim();
                var databaseType = param?["DatabaseType"].Val<string>()
                                   ?? param?["DbType"].Val<string>();
                var dbName = param?["DbName"].Val<string>()?.Trim();
                if (IsBlank(osClient)) return new DosResult<object>(0, null, "OsClient 不能为空");
                if (!Regex.IsMatch(dbKey ?? string.Empty, @"^[A-Za-z_][A-Za-z0-9_]{0,49}$"))
                    return new DosResult<object>(0, null, "DbKey 仅允许 1-50 位字母、数字、下划线，且不能以数字开头");
                if (V8DatabaseCollection.IsReservedKey(dbKey))
                    return new DosResult<object>(0, null, $"DbKey[{dbKey}]与 V8.Dbs 内置成员冲突，请更换");
                if (IsBlank(dbName)) dbName = dbKey;
                if (dbName.Length > 100) return new DosResult<object>(0, null, "DbName 不能超过 100 个字符");
                if (IsBlank(connectionString)) return new DosResult<object>(0, null, "ConnectionString 不能为空");

                var definition = ExternalDatabaseCatalog.Resolve(databaseType);
                // 保存前真实读取表清单，避免把无法连接或类型错误的凭据写入控制面表。
                ExternalDatabaseInspector.Inspect(
                    definition.Key,
                    connectionString,
                    null,
                    1,
                    false,
                    Math.Max(5, Math.Min(param?["CommandTimeoutSeconds"]?.Val<int>() ?? 30, 120)));

                if (IsBlank(readConnectionString)) readConnectionString = connectionString;
                if (!string.Equals(readConnectionString, connectionString, StringComparison.Ordinal))
                {
                    ExternalDatabaseInspector.Inspect(
                        definition.Key,
                        readConnectionString,
                        null,
                        1,
                        false,
                        Math.Max(5, Math.Min(param?["CommandTimeoutSeconds"]?.Val<int>() ?? 30, 120)));
                }

                DosResult<object> saveResult = null;
                var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
                {
                    OsClient = osClient,
                    Key = $"ExternalDatabase:Save:{dbKey.ToLowerInvariant()}",
                    Expiry = TimeSpan.FromSeconds(30),
                    MaxRetryCount = 20,
                    RetryIntervalMs = 25,
                    UseExponentialBackoff = true
                }, async () =>
                {
                    saveResult = await SaveDatabaseConnectionInsideLock(
                        osClient, param, dbKey, dbName, definition, connectionString, readConnectionString);
                });
                if (lockResult.Code != 1)
                    return new DosResult<object>(lockResult.Code, null,
                        "保存数据库连接未取得分布式锁：" + lockResult.Msg);
                return saveResult ?? new DosResult<object>(0, null, "保存数据库连接未返回写入结果");
            }
            catch (Exception ex)
            {
                var safeMessage = ExternalDatabaseCatalog.SanitizeError(ex.Message, connectionString);
                safeMessage = ExternalDatabaseCatalog.SanitizeError(safeMessage, readConnectionString);
                return new DosResult<object>(0, null, "保存数据库连接失败：" + safeMessage);
            }
        }

        private static async Task<DosResult<object>> SaveDatabaseConnectionInsideLock(
            string osClient,
            JObject param,
            string dbKey,
            string dbName,
            ExternalDatabaseDefinition definition,
            string connectionString,
            string readConnectionString)
        {
            var existing = FindSavedDatabase(osClient, dbKey, includeDisabled: true, includeDeleted: true);
            var row = new JObject
            {
                ["OsClient"] = osClient,
                ["DbName"] = dbName,
                ["DbKey"] = dbKey,
                ["DbType"] = definition.Key,
                ["DbConn"] = connectionString,
                ["DbReadConn"] = readConnectionString,
                ["DbVersion"] = param?["DbVersion"].Val<string>() ?? string.Empty,
                ["Remark"] = param?["Remark"].Val<string>() ?? string.Empty,
                ["IsEnable"] = param?["IsEnable"]?.Val<int>() ?? 1,
                ["IsDeleted"] = 0,
                ["_InvokeType"] = InvokeType.Server.ToString()
            };

            DosResult writeResult;
            var action = "created";
            if (existing != null)
            {
                row["Id"] = existing["Id"]?.ToString();
                writeResult = await MicroiEngine.FormEngine.UptFormDataAsync(
                    "microi_database",
                    BuildTrustedMcpFormWriteParam(osClient, row));
                action = existing["IsDeleted"]?.Val<int>() == 1 ? "restored" : "updated";
            }
            else
            {
                row["Id"] = Ulid.NewUlid().ToString();
                writeResult = await MicroiEngine.FormEngine.AddFormDataAsync(
                    "microi_database",
                    BuildTrustedMcpFormWriteParam(osClient, row));
            }
            if (writeResult.Code != 1)
                return new DosResult<object>(writeResult.Code, null, "保存数据库连接失败：" + writeResult.Msg);

            var cacheResult = OsClientExtend.InvalidateExtensionDatabaseCache(osClient);
            if (cacheResult.Code != 1)
            {
                return new DosResult<object>(0, new
                {
                    DbKey = dbKey,
                    DbType = definition.Key,
                    Written = true,
                    CacheRefreshSucceeded = false
                }, "数据库连接已写入，但多节点 V8.Dbs 即时刷新失败：" + cacheResult.Msg);
            }

            var readback = FindSavedDatabase(osClient, dbKey, includeDisabled: true);
            if (readback == null)
                return new DosResult<object>(0, null, "数据库连接已写入，但回读验证失败");
            return new DosResult<object>(1, new
            {
                Id = readback["Id"]?.ToString(),
                DbKey = dbKey,
                DbName = dbName,
                DbType = definition.Key,
                IsEnable = readback["IsEnable"]?.ToString(),
                Action = action,
                Verified = true,
                CacheRefreshSucceeded = true
            }, "数据库连接已保存并通过回读验证；连接字符串未回显");
        }

        /// <summary>
        /// 超级管理员附件迁移入口。允许 HTTP/HTTPS、服务器绝对本机路径和 UNC，
        /// 使用临时文件/文件流上传，不经过 Base64，也不设置 MCP 固定大小上限。
        /// MaxBytes=0 表示不设本工具上限，最终能力由磁盘、网络和对象存储决定。
        /// </summary>
        public static async Task<DosResult<object>> ImportExternalAttachmentAdministrative(
            string osClient,
            JObject param,
            dynamic currentToken)
        {
            var sourceUrl = param?["SourceUrl"].Val<string>()?.Trim();
            var sourcePath = param?["SourcePath"].Val<string>()?.Trim();
            var sourceIdentifier = !IsBlank(sourceUrl) ? sourceUrl : sourcePath;
            var sourceHash = GetAdministrativeSqlConfirmation(sourceIdentifier ?? string.Empty);
            string tempFile = null;
            try
            {
                if (IsBlank(osClient)) return new DosResult<object>(0, null, "OsClient 不能为空");
                if (IsBlank(sourceUrl) == IsBlank(sourcePath))
                    return new DosResult<object>(0, null, "SourceUrl 与 SourcePath 必须且只能提供一个");

                var maxBytes = param?["MaxBytes"]?.Val<long?>() ?? 0L;
                if (maxBytes < 0) return new DosResult<object>(0, null, "MaxBytes 不能小于 0；0 表示不设 MCP 上限");
                var timeoutSeconds = Math.Max(5,
                    Math.Min(param?["TimeoutSeconds"]?.Val<int>() ?? 3600, 86400));

                string sourceKind;
                string fileName = param?["FileName"].Val<string>();
                long byteLength;
                DosResult<object> uploadResult;
                if (!IsBlank(sourcePath))
                {
                    sourceKind = "LocalOrUncPath";
                    if (!Path.IsPathFullyQualified(sourcePath))
                        return new DosResult<object>(0, null, "SourcePath 必须是服务器绝对路径或 UNC 路径");
                    var fullPath = Path.GetFullPath(sourcePath);
                    if (!File.Exists(fullPath))
                        return new DosResult<object>(0, null, "SourcePath 不存在，或当前 API 服务帐号无权访问该本机/UNC 文件");
                    var fileInfo = new FileInfo(fullPath);
                    byteLength = fileInfo.Length;
                    EnsureAttachmentWithinOptionalLimit(byteLength, maxBytes);
                    if (IsBlank(fileName)) fileName = fileInfo.Name;
                    using var sourceStream = new FileStream(
                        fullPath,
                        FileMode.Open,
                        FileAccess.Read,
                        FileShare.Read,
                        1024 * 1024,
                        FileOptions.Asynchronous | FileOptions.SequentialScan);
                    uploadResult = await UploadExternalAttachmentStream(
                        osClient, param, NormalizeExternalFileName(fileName), sourceStream, byteLength, currentToken);
                }
                else
                {
                    sourceKind = "Http";
                    if (!Uri.TryCreate(sourceUrl, UriKind.Absolute, out var uri)
                        || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
                        return new DosResult<object>(0, null, "SourceUrl 仅允许绝对 http/https 地址");

                    var tempRoot = Path.Combine(Path.GetTempPath(), "microi-mcp-external-attachment");
                    Directory.CreateDirectory(tempRoot);
                    tempFile = Path.Combine(tempRoot, Guid.NewGuid().ToString("N") + ".tmp");
                    byteLength = await DownloadExternalAttachmentToFile(
                        uri,
                        param?["Headers"] as JObject,
                        tempFile,
                        maxBytes,
                        timeoutSeconds);
                    if (IsBlank(fileName)) fileName = Path.GetFileName(uri.LocalPath);
                    if (IsBlank(fileName)) fileName = $"external-{DateTime.Now:yyyyMMddHHmmssfff}.bin";
                    using var sourceStream = new FileStream(
                        tempFile,
                        FileMode.Open,
                        FileAccess.Read,
                        FileShare.Read,
                        1024 * 1024,
                        FileOptions.Asynchronous | FileOptions.SequentialScan);
                    uploadResult = await UploadExternalAttachmentStream(
                        osClient, param, NormalizeExternalFileName(fileName), sourceStream, byteLength, currentToken);
                }

                await WriteMcpAuditLog(
                    osClient,
                    "microi_import_external_attachment",
                    sourceKind,
                    new JObject
                    {
                        ["SourceSha256"] = sourceHash,
                        ["SourceKind"] = sourceKind,
                        ["ByteLength"] = byteLength,
                        ["Succeeded"] = uploadResult.Code == 1
                    }.ToString(Newtonsoft.Json.Formatting.None),
                    currentToken);
                return uploadResult;
            }
            catch (Exception ex)
            {
                await WriteMcpAuditLog(
                    osClient,
                    "microi_import_external_attachment",
                    IsBlank(sourceUrl) ? "LocalOrUncPath" : "Http",
                    new JObject
                    {
                        ["SourceSha256"] = sourceHash,
                        ["Succeeded"] = false
                    }.ToString(Newtonsoft.Json.Formatting.None),
                    currentToken);
                var safeMessage = ex.Message ?? string.Empty;
                if (!IsBlank(sourcePath)) safeMessage = safeMessage.Replace(sourcePath, "[LOCAL_PATH]");
                if (Uri.TryCreate(sourceUrl, UriKind.Absolute, out var failedUri))
                    safeMessage = SanitizeAttachmentError(safeMessage, failedUri);
                return new DosResult<object>(0, null, "外部附件迁移失败：" + safeMessage);
            }
            finally
            {
                if (!IsBlank(tempFile))
                {
                    try { if (File.Exists(tempFile)) File.Delete(tempFile); }
                    catch { }
                }
            }
        }

        private static async Task<long> DownloadExternalAttachmentToFile(
            Uri sourceUri,
            JObject headers,
            string targetFile,
            long maxBytes,
            int timeoutSeconds)
        {
            using var request = new HttpRequestMessage(HttpMethod.Get, sourceUri);
            if (headers != null)
            {
                foreach (var item in headers.Properties())
                    request.Headers.TryAddWithoutValidation(item.Name, item.Value?.ToString() ?? string.Empty);
            }
            using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds));
            using var response = await ExternalAttachmentHttpClient.SendAsync(
                request,
                HttpCompletionOption.ResponseHeadersRead,
                cancellation.Token);
            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException($"HTTP {(int)response.StatusCode} {response.ReasonPhrase}");
            if (response.Content.Headers.ContentLength.HasValue)
                EnsureAttachmentWithinOptionalLimit(response.Content.Headers.ContentLength.Value, maxBytes);

            using var input = await response.Content.ReadAsStreamAsync();
            using var output = new FileStream(
                targetFile,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.Read,
                1024 * 1024,
                FileOptions.Asynchronous | FileOptions.SequentialScan);
            var buffer = new byte[1024 * 1024];
            long total = 0;
            while (true)
            {
                var read = await input.ReadAsync(buffer, 0, buffer.Length, cancellation.Token);
                if (read <= 0) break;
                total += read;
                EnsureAttachmentWithinOptionalLimit(total, maxBytes);
                await output.WriteAsync(buffer, 0, read, cancellation.Token);
            }
            await output.FlushAsync(cancellation.Token);
            if (total == 0) throw new InvalidOperationException("外部附件内容为空");
            return total;
        }

        private static void EnsureAttachmentWithinOptionalLimit(long byteLength, long maxBytes)
        {
            if (maxBytes > 0 && byteLength > maxBytes)
                throw new InvalidOperationException($"附件大小 {byteLength} 字节，超过调用方指定的 MaxBytes={maxBytes}");
        }

        private static string NormalizeExternalFileName(string fileName)
        {
            var safeName = Path.GetFileName((fileName ?? string.Empty).Replace('\\', '/'));
            safeName = Regex.Replace(safeName ?? string.Empty, "[\\x00-\\x1f<>:\\\"/\\\\|?*]", "_");
            if (safeName.DosIsNullOrWhiteSpace()) safeName = "external-file.bin";
            return safeName.Length <= 240 ? safeName : safeName.Substring(safeName.Length - 240);
        }

        private static async Task<DosResult<object>> UploadExternalAttachmentStream(
            string osClient,
            JObject param,
            string fileName,
            Stream fileStream,
            long byteLength,
            dynamic currentToken)
        {
            var client = OsClientExtend.GetClient(osClient);
            var exactPath = param?["FilePathName"].Val<string>();
            string normalizedPath;
            if (!IsBlank(exactPath))
            {
                normalizedPath = TenantConfigurationSecurity.NormalizeStoragePath(osClient, exactPath);
                if (!string.Equals(Path.GetFileName(normalizedPath), fileName, StringComparison.Ordinal))
                    throw new InvalidOperationException("FileName 必须与 FilePathName 中的文件名一致");
            }
            else
            {
                var subPath = TenantConfigurationSecurity.NormalizeUploadSubPath(
                    osClient,
                    param?["Path"].Val<string>() ?? "mcp/external-attachment");
                var generated = $"{subPath.Trim('/')}/{DateTime.Now:yyyyMMdd}/{Ulid.NewUlid()}-{fileName}";
                normalizedPath = TenantConfigurationSecurity.NormalizeStoragePath(osClient, generated);
            }

            var hdfsName = client.OsClientModel["HDFS"].Val<string>() ?? "Aliyun";
            var hdfs = hdfsName == "MinIO"
                ? MicroiEngine.HDFSFactory(HDFSType.MinIO)
                : hdfsName == "S3"
                    ? MicroiEngine.HDFSFactory(HDFSType.AmazonS3)
                    : MicroiEngine.HDFSFactory(HDFSType.Aliyun);
            if (fileStream.CanSeek) fileStream.Position = 0;
            var limit = param?["Limit"]?.Val<bool?>() ?? true;
            var putResult = await hdfs.PutObject(new HDFSParam
            {
                ClientModel = client,
                Limit = limit,
                FileFullPath = normalizedPath.TrimStart('/'),
                FileStream = fileStream
            });
            if (putResult.Code != 1)
                return new DosResult<object>(putResult.Code, putResult.Data, "外部附件流式上传失败：" + putResult.Msg);

            object updateInfo = null;
            var targetTable = param?["TargetTable"].Val<string>();
            var targetId = param?["TargetId"].Val<string>();
            var targetField = param?["TargetField"].Val<string>();
            if (!IsBlank(targetTable) || !IsBlank(targetId) || !IsBlank(targetField))
            {
                if (IsBlank(targetTable) || IsBlank(targetId) || IsBlank(targetField))
                    return new DosResult<object>(0, null, "TargetTable、TargetId、TargetField 必须同时提供");
                var row = new JObject
                {
                    ["Id"] = targetId,
                    [targetField] = normalizedPath,
                    ["_InvokeType"] = InvokeType.Server.ToString()
                };
                var updateResult = await MicroiEngine.FormEngine.UptFormDataAsync(
                    targetTable,
                    BuildTrustedMcpFormWriteParam(osClient, row));
                if (updateResult.Code != 1)
                    return new DosResult<object>(updateResult.Code, new { FilePathName = normalizedPath },
                        "文件已上传，但写入目标字段失败：" + updateResult.Msg);
                updateInfo = updateResult.Data;
            }

            return new DosResult<object>(1, new
            {
                FileName = fileName,
                FilePathName = normalizedPath,
                ByteLength = byteLength,
                Limit = limit,
                Streamed = true,
                PreviewGenerated = false,
                Updated = updateInfo
            }, "外部附件已流式上传到吾码平台");
        }

        private static string SanitizeAttachmentError(string message, Uri sourceUri)
        {
            if (string.IsNullOrWhiteSpace(message)) return string.Empty;
            if (sourceUri == null) return message;

            var host = sourceUri.HostNameType == UriHostNameType.IPv6
                ? $"[{sourceUri.Host}]"
                : sourceUri.IdnHost;
            var port = sourceUri.IsDefaultPort ? string.Empty : ":" + sourceUri.Port;
            var safeSource = $"{sourceUri.Scheme}://{host}{port}/[REDACTED]";
            var result = message.Replace(sourceUri.AbsoluteUri, safeSource);
            if (!string.IsNullOrEmpty(sourceUri.Query))
                result = result.Replace(sourceUri.Query, "?***");
            return result;
        }

        private sealed class ResolvedExternalDatabaseConnection
        {
            public string DatabaseType { get; set; }
            public string ConnectionString { get; set; }
        }

        private static Task<ResolvedExternalDatabaseConnection> ResolveExternalDatabaseConnection(
            string osClient,
            string databaseType,
            string connectionString,
            string dbKey)
        {
            if (!IsBlank(connectionString))
            {
                var definition = ExternalDatabaseCatalog.Resolve(databaseType);
                return Task.FromResult(new ResolvedExternalDatabaseConnection
                {
                    DatabaseType = definition.Key,
                    ConnectionString = connectionString
                });
            }

            if (IsBlank(dbKey))
                throw new ArgumentException("ConnectionString 与 DbKey 至少提供一个");
            var saved = FindSavedDatabase(osClient, dbKey, includeDisabled: false);
            if (saved == null) throw new InvalidOperationException($"未找到已启用数据库连接 DbKey={dbKey}");
            return Task.FromResult(new ResolvedExternalDatabaseConnection
            {
                DatabaseType = ExternalDatabaseCatalog.Resolve(saved["DbType"]?.ToString()).Key,
                ConnectionString = saved["DbConn"]?.ToString()
            });
        }

        private static JObject FindSavedDatabase(
            string osClient,
            string dbKey,
            bool includeDisabled,
            bool includeDeleted = false)
        {
            var client = OsClientExtend.GetClient(osClient);
            var dbInfo = DiyCommon.GetDbInfo(client.OsClientModel["DbType"].Val<string>());
            var sql = "SELECT Id, DbName, DbKey, DbType, DbConn, DbReadConn, DbVersion, Remark, IsEnable, IsDeleted "
                      + "FROM microi_database WHERE LOWER(DbKey) = LOWER(" + dbInfo.P + "dbKey)"
                      + (includeDeleted ? string.Empty : " AND IsDeleted = 0")
                      + (includeDisabled ? string.Empty : " AND IsEnable = 1");
            var rows = client.DbRead.FromSql(sql)
                .AddInParameter("dbKey", DbType.String, dbKey)
                .ToList<dynamic>();
            if (rows.Count > 1)
                throw new InvalidOperationException(
                    $"microi_database 存在多个大小写等价的 DbKey={dbKey}，请先合并重复连接");
            return rows.Count == 0 ? null : JObject.FromObject(rows[0]);
        }

        private static object ConvertExternalQueryParameter(JToken value)
        {
            if (value == null || value.Type == JTokenType.Null || value.Type == JTokenType.Undefined)
                return DBNull.Value;
            if (value is JValue scalar) return scalar.Value;
            return value.ToString(Newtonsoft.Json.Formatting.None);
        }
    }
}

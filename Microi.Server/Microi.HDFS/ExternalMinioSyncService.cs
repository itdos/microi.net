using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Dos.Common;
using Minio;
using Minio.DataModel.Args;

namespace Microi.net
{
    /// <summary>
    /// File cabinet synchronization adapter for a directly configured MinIO service.
    /// Credentials are request-scoped and are never persisted by this service.
    /// </summary>
    public class ExternalMinioSyncService
    {
        private static readonly HttpClient SyncHttpClient = new HttpClient
        {
            Timeout = TimeSpan.FromMinutes(30)
        };

        public async Task<DosResult> Probe(MinioProbeParam param)
        {
            try
            {
                var connection = RequireConnection(param?.Connection);
                var client = CreateClient(connection);
                var listResult = await client.ListBucketsAsync().ConfigureAwait(false);
                var buckets = listResult.Buckets.Select(item => item.Name).OrderBy(name => name).ToList();
                var privateBucket = ResolveBucketName(connection.PrivateBucketName, buckets, "private");
                var publicBucket = ResolveBucketName(connection.PublicBucketName, buckets, "public");
                var privateCreated = false;
                var publicCreated = false;

                if (param.EnsureBuckets)
                {
                    if (privateBucket.DosIsNullOrWhiteSpace() || publicBucket.DosIsNullOrWhiteSpace())
                    {
                        return new DosResult(0, null, "请先填写私有桶和公有桶名称，再创建目标桶。");
                    }
                    privateCreated = await EnsureBucket(client, privateBucket).ConfigureAwait(false);
                    publicCreated = privateBucket.Equals(publicBucket, StringComparison.OrdinalIgnoreCase)
                        ? privateCreated
                        : await EnsureBucket(client, publicBucket).ConfigureAwait(false);
                    listResult = await client.ListBucketsAsync().ConfigureAwait(false);
                    buckets = listResult.Buckets.Select(item => item.Name).OrderBy(name => name).ToList();
                }

                return new DosResult(1, new MinioProbeResult
                {
                    Buckets = buckets,
                    PrivateBucketName = privateBucket,
                    PublicBucketName = publicBucket,
                    PrivateBucketCreated = privateCreated,
                    PublicBucketCreated = publicCreated
                }, "MinIO连接成功");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "MinIO连接失败：" + ex.Message);
            }
        }

        public async Task<DosResult> ListObjects(MinioListObjectsParam param)
        {
            try
            {
                var connection = RequireConnection(param?.Connection);
                var prefix = NormalizeFolderPath(param.Path);
                EnsureWithinRoot(prefix, connection.RootPath, "目录");
                var client = CreateClient(connection);
                var bucketName = RequireBucket(connection, param.Limit);
                await RequireExistingBucket(client, bucketName).ConfigureAwait(false);

                var args = new ListObjectsArgs()
                    .WithBucket(bucketName)
                    .WithPrefix(prefix)
                    .WithRecursive(param.Recursive);
                var folders = new List<object>();
                var files = new List<object>();
                var seenPrefixes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                var maxKeys = param.MaxKeys <= 0 ? 10000 : Math.Min(param.MaxKeys, 50000);
                var count = 0;
                var truncated = false;

                void AddFolderHierarchy(string objectKey, bool isFolderObject)
                {
                    var normalizedKey = NormalizeObjectKey(objectKey);
                    var folderPath = isFolderObject
                        ? NormalizeFolderPath(normalizedKey)
                        : NormalizeFolderPath(normalizedKey.Contains("/")
                            ? normalizedKey.Substring(0, normalizedKey.LastIndexOf('/') + 1)
                            : "");
                    if (folderPath.Length == 0 || (prefix.Length > 0 && !folderPath.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))) return;

                    var relativePath = prefix.Length > 0 ? folderPath.Substring(prefix.Length) : folderPath;
                    var currentPath = prefix;
                    foreach (var segment in relativePath.Split(new[] { '/' }, StringSplitOptions.RemoveEmptyEntries))
                    {
                        currentPath += segment + "/";
                        if (currentPath == prefix || !seenPrefixes.Add(currentPath)) continue;
                        folders.Add(new { Name = segment, FullPath = currentPath, IsFolder = true });
                    }
                }

                await foreach (var item in client.ListObjectsEnumAsync(args).ConfigureAwait(false))
                {
                    if (++count > maxKeys)
                    {
                        truncated = true;
                        break;
                    }

                    var key = NormalizeObjectKey(item.Key);
                    var isFolder = item.IsDir || key.EndsWith("/", StringComparison.Ordinal);
                    if (param.Recursive)
                    {
                        AddFolderHierarchy(key, isFolder);
                        if (isFolder) continue;
                    }
                    else if (isFolder)
                    {
                        var folderPath = NormalizeFolderPath(key);
                        var relative = prefix.Length > 0 && folderPath.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                            ? folderPath.Substring(prefix.Length).TrimEnd('/')
                            : folderPath.TrimEnd('/');
                        if (relative.Length == 0 || relative.Contains("/") || !seenPrefixes.Add(folderPath)) continue;
                        folders.Add(new { Name = relative, FullPath = folderPath, IsFolder = true });
                        continue;
                    }

                    if (isFolder || key == prefix) continue;
                    var fileName = key.Contains("/") ? key.Substring(key.LastIndexOf('/') + 1) : key;
                    if (!param.Keyword.DosIsNullOrWhiteSpace()
                        && fileName.IndexOf(param.Keyword, StringComparison.OrdinalIgnoreCase) < 0) continue;
                    files.Add(new
                    {
                        Name = fileName,
                        FullPath = key,
                        Size = (long)item.Size,
                        Type = Path.GetExtension(fileName).TrimStart('.').ToLowerInvariant(),
                        LastModified = item.LastModifiedDateTime?.ToString("yyyy-MM-dd HH:mm:ss") ?? "",
                        IsFolder = false
                    });
                }

                return new DosResult(1, new
                {
                    Folders = folders,
                    Files = files,
                    IsTruncated = truncated,
                    NextMarker = ""
                });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "MinIO目录加载失败：" + ex.Message);
            }
        }

        public async Task<DosResult> CreateFolder(MinioCreateFolderParam param)
        {
            try
            {
                var connection = RequireConnection(param?.Connection);
                var folderPath = NormalizeFolderPath(param.FilePathName);
                if (folderPath.Length == 0) return new DosResult(0, null, "文件夹路径不能为空。");
                EnsureWithinRoot(folderPath, connection.RootPath, "文件夹");
                var client = CreateClient(connection);
                var bucketName = RequireBucket(connection, param.Limit);
                await RequireExistingBucket(client, bucketName).ConfigureAwait(false);
                using (var stream = new MemoryStream(Array.Empty<byte>()))
                {
                    await client.PutObjectAsync(new PutObjectArgs()
                        .WithBucket(bucketName)
                        .WithObject(folderPath)
                        .WithStreamData(stream)
                        .WithObjectSize(0)
                        .WithContentType("application/octet-stream")).ConfigureAwait(false);
                }
                return new DosResult(1, new { FullPath = folderPath });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "MinIO创建文件夹失败：" + ex.Message);
            }
        }

        public async Task<DosResult> SyncObject(MinioObjectSyncParam param)
        {
            string tempFile = null;
            try
            {
                if (param == null) return new DosResult(0, null, "同步参数不能为空。");
                var source = ResolveConnection(param.SourcePlatformType, param.SourceConnection, param.CurrentOsClient);
                var target = ResolveConnection(param.TargetPlatformType, param.TargetConnection, param.CurrentOsClient);
                var sourcePath = NormalizeObjectKey(param.SourcePath);
                var targetPath = NormalizeObjectKey(param.TargetPath);
                if (sourcePath.Length == 0 || targetPath.Length == 0) return new DosResult(0, null, "源路径和目标路径不能为空。");
                EnsureWithinRoot(sourcePath, source.RootPath, "源文件");
                EnsureWithinRoot(targetPath, target.RootPath, "目标文件");

                var sourceClient = CreateClient(source);
                var targetClient = CreateClient(target);
                var sourceBucket = RequireBucket(source, param.SourceLimit);
                var targetBucket = RequireBucket(target, param.TargetLimit);
                var targetExists = await ObjectExists(targetClient, targetBucket, targetPath).ConfigureAwait(false);
                if (targetExists && !string.Equals(param.SyncRule, "overwrite", StringComparison.OrdinalIgnoreCase))
                {
                    return new DosResult(1, new { Status = "Ignored", SourcePath = sourcePath, TargetPath = targetPath, Size = 0L }, "目标文件已存在，已忽略");
                }

                tempFile = Path.Combine(Path.GetTempPath(), "microi-file-sync-" + Guid.NewGuid().ToString("N") + ".tmp");
                var sourceUrl = await sourceClient.PresignedGetObjectAsync(new PresignedGetObjectArgs()
                    .WithBucket(sourceBucket)
                    .WithObject(sourcePath)
                    .WithExpiry(30 * 60)).ConfigureAwait(false);
                using (var response = await SyncHttpClient.GetAsync(sourceUrl, HttpCompletionOption.ResponseHeadersRead).ConfigureAwait(false))
                {
                    response.EnsureSuccessStatusCode();
                    using (var sourceStream = await response.Content.ReadAsStreamAsync().ConfigureAwait(false))
                    using (var output = new FileStream(tempFile, FileMode.Create, FileAccess.Write, FileShare.None))
                    {
                        await sourceStream.CopyToAsync(output).ConfigureAwait(false);
                    }
                }

                long syncedSize;
                using (var input = new FileStream(tempFile, FileMode.Open, FileAccess.Read, FileShare.Read))
                {
                    syncedSize = input.Length;
                    var putResult = await targetClient.PutObjectAsync(new PutObjectArgs()
                        .WithBucket(targetBucket)
                        .WithObject(targetPath)
                        .WithStreamData(input)
                        .WithObjectSize(input.Length)
                        .WithContentType(GetContentType(targetPath))).ConfigureAwait(false);
                    if (putResult.ResponseStatusCode != HttpStatusCode.OK)
                    {
                        return new DosResult(0, null, "目标MinIO写入失败：" + putResult.ResponseContent);
                    }
                }

                return new DosResult(1, new { Status = "Success", SourcePath = sourcePath, TargetPath = targetPath, Size = syncedSize }, "文件同步成功");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "MinIO文件同步失败：" + ex.Message);
            }
            finally
            {
                if (!tempFile.DosIsNullOrWhiteSpace() && File.Exists(tempFile))
                {
                    try { File.Delete(tempFile); } catch { }
                }
            }
        }

        private static MinioConnectionOptions ResolveConnection(string platformType, MinioConnectionOptions direct, string currentOsClient)
        {
            if (string.Equals(platformType, "minio", StringComparison.OrdinalIgnoreCase)) return RequireConnection(direct);
            if (!string.Equals(platformType, "current", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("MinIO服务端同步仅支持当前平台与MinIO直连；远程吾码平台请使用原文件同步通道。");
            }
            if (currentOsClient.DosIsNullOrWhiteSpace()) throw new InvalidOperationException("当前平台OsClient不能为空。");

            var clientModel = OsClient.GetClient(currentOsClient);
            if (clientModel == null || !string.Equals(clientModel.OsClientModel["HDFS"].Val<string>(), "MinIO", StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException("当前平台未配置MinIO存储，无法使用MinIO服务端同步。");
            }
            var network = Environment.GetEnvironmentVariable("OsClientNetwork", EnvironmentVariableTarget.Process)
                ?? ConfigHelper.GetAppSettings("OsClientNetwork") ?? "";
            var useInternet = string.Equals(network, "Internet", StringComparison.OrdinalIgnoreCase);
            var endpoint = useInternet
                ? clientModel.OsClientModel["MinIOEndPointInternet"].Val<string>()
                : clientModel.OsClientModel["MinIOEndPoint"].Val<string>();
            var ssl = useInternet
                ? clientModel.OsClientModel["MinIOEndPointSSL"].Val<int>() == 1
                : clientModel.OsClientModel["MinIOPrivateEndPointSSL"].Val<int>() == 1;
            if (!endpoint.Contains("://")) endpoint = (ssl ? "https://" : "http://") + endpoint;

            return RequireConnection(new MinioConnectionOptions
            {
                Endpoint = endpoint,
                AccessKey = clientModel.OsClientModel["MinIOAccessKey"].Val<string>(),
                SecretKey = clientModel.OsClientModel["MinIOSecretKey"].Val<string>(),
                Region = clientModel.OsClientModel["MinIORegion"].Val<string>()
                    .DosIsNullOrWhiteSpace("us-east-1"),
                PrivateBucketName = clientModel.OsClientModel["MinIOPrivateBucketName"].Val<string>(),
                PublicBucketName = clientModel.OsClientModel["MinIOPublicBucketName"].Val<string>(),
                RootPath = NormalizeFolderPath(currentOsClient.ToLowerInvariant())
            });
        }

        private static MinioConnectionOptions RequireConnection(MinioConnectionOptions connection)
        {
            if (connection == null) throw new ArgumentException("MinIO连接配置不能为空。");
            if (connection.Endpoint.DosIsNullOrWhiteSpace()) throw new ArgumentException("MinIO Endpoint不能为空。");
            if (connection.AccessKey.DosIsNullOrWhiteSpace()) throw new ArgumentException("MinIO帐号不能为空。");
            if (connection.SecretKey.DosIsNullOrWhiteSpace()) throw new ArgumentException("MinIO密码不能为空。");
            connection.RootPath = NormalizeFolderPath(connection.RootPath);
            return connection;
        }

        private static IMinioClient CreateClient(MinioConnectionOptions connection)
        {
            var endpointText = connection.Endpoint.Trim();
            var hasScheme = endpointText.Contains("://");
            var uriText = hasScheme ? endpointText : "http://" + endpointText;
            if (!Uri.TryCreate(uriText, UriKind.Absolute, out var uri) || uri.Host.DosIsNullOrWhiteSpace())
            {
                throw new ArgumentException("MinIO Endpoint格式不正确。");
            }
            if (!uri.AbsolutePath.DosIsNullOrWhiteSpace() && uri.AbsolutePath != "/")
            {
                throw new ArgumentException("MinIO Endpoint不能包含路径。");
            }

            var builder = new MinioClient()
                .WithEndpoint(uri.Host, uri.IsDefaultPort ? (uri.Scheme == "https" ? 443 : 80) : uri.Port)
                .WithCredentials(connection.AccessKey, connection.SecretKey);
            if (uri.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase)) builder = builder.WithSSL();
            if (!connection.Region.DosIsNullOrWhiteSpace()) builder = builder.WithRegion(connection.Region);
            return builder.Build();
        }

        private static string RequireBucket(MinioConnectionOptions connection, bool limit)
        {
            var bucket = limit ? connection.PrivateBucketName : connection.PublicBucketName;
            if (bucket.DosIsNullOrWhiteSpace()) throw new ArgumentException(limit ? "私有桶名称不能为空。" : "公有桶名称不能为空。");
            return bucket.Trim();
        }

        private static async Task RequireExistingBucket(IMinioClient client, string bucket)
        {
            var exists = await client.BucketExistsAsync(new BucketExistsArgs().WithBucket(bucket)).ConfigureAwait(false);
            if (!exists) throw new InvalidOperationException("MinIO桶不存在：" + bucket);
        }

        private static async Task<bool> EnsureBucket(IMinioClient client, string bucket)
        {
            if (await client.BucketExistsAsync(new BucketExistsArgs().WithBucket(bucket)).ConfigureAwait(false)) return false;
            await client.MakeBucketAsync(new MakeBucketArgs().WithBucket(bucket)).ConfigureAwait(false);
            return true;
        }

        private static async Task<bool> ObjectExists(IMinioClient client, string bucket, string objectName)
        {
            try
            {
                await client.StatObjectAsync(new StatObjectArgs().WithBucket(bucket).WithObject(objectName)).ConfigureAwait(false);
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static string ResolveBucketName(string configured, List<string> buckets, string suffix)
        {
            if (!configured.DosIsNullOrWhiteSpace()) return configured.Trim();
            return buckets.FirstOrDefault(name => name.EndsWith("-" + suffix, StringComparison.OrdinalIgnoreCase))
                ?? buckets.FirstOrDefault(name => name.Equals(suffix, StringComparison.OrdinalIgnoreCase))
                ?? "";
        }

        private static string NormalizeObjectKey(string value)
        {
            var normalized = (value ?? "").Replace('\\', '/').Trim().TrimStart('/');
            while (normalized.Contains("//")) normalized = normalized.Replace("//", "/");
            if (normalized.Split('/').Any(segment => segment == "..")) throw new ArgumentException("文件路径不能包含上级目录。");
            return normalized;
        }

        private static string NormalizeFolderPath(string value)
        {
            var normalized = NormalizeObjectKey(value).TrimEnd('/');
            return normalized.Length == 0 ? "" : normalized + "/";
        }

        private static void EnsureWithinRoot(string path, string rootPath, string label)
        {
            var root = NormalizeFolderPath(rootPath);
            var normalized = NormalizeObjectKey(path);
            if (root.Length > 0 && !normalized.StartsWith(root, StringComparison.OrdinalIgnoreCase))
            {
                throw new InvalidOperationException(label + "超出允许的MinIO根目录：" + root);
            }
        }

        private static string GetContentType(string path)
        {
            switch (Path.GetExtension(path).ToLowerInvariant())
            {
                case ".pdf": return "application/pdf";
                case ".gif": return "image/gif";
                case ".png": return "image/png";
                case ".bmp": return "image/bmp";
                case ".jpg":
                case ".jpeg": return "image/jpeg";
                case ".svg": return "image/svg+xml";
                case ".mp4": return "video/mp4";
                case ".webm": return "video/webm";
                case ".json": return "application/json";
                case ".txt": return "text/plain";
                default: return "application/octet-stream";
            }
        }
    }
}

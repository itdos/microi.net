using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Aliyun.OSS;
using Aliyun.OSS.Common;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// 阿里云OSS分布式存储。
    /// </summary>
    public class MicroiHDFSAliyun : MicroiHDFS, IMicroiHDFS
    {
        private static string BuildOssFailureMessage(
            string operation,
            HDFSParam param,
            string bucketName,
            Exception exception)
        {
            var scope = param?.Limit == true ? "私有桶" : "公有桶";
            var objectKey = (param?.FileFullPath ?? "").DosTrimStart('/');
            var original = exception?.GetBaseException()?.Message ?? exception?.Message ?? "未知错误";
            if (original.Length > 1200) original = original.Substring(0, 1200);
            var forbidden = original.IndexOf("403", StringComparison.OrdinalIgnoreCase) >= 0
                            || original.IndexOf("Forbidden", StringComparison.OrdinalIgnoreCase) >= 0
                            || original.IndexOf("AccessDenied", StringComparison.OrdinalIgnoreCase) >= 0
                            || original.IndexOf("Access Denied", StringComparison.OrdinalIgnoreCase) >= 0;
            var errorType = forbidden ? "OBJECT_STORAGE_FORBIDDEN" : "OBJECT_STORAGE_OPERATION_FAILED";
            var solution = forbidden
                ? "请核对目标租户 SaaS 引擎中的 AliOss Endpoint、Bucket 与 AccessKey 是否属于同一账号/地域，"
                  + "并为该对象前缀补齐 oss:GetObject 与 oss:PutObject；若使用 RAM 临时凭证，还需检查凭证是否过期。"
                : "请检查目标租户 SaaS 引擎的 AliOss Endpoint、Bucket、网络路由和凭证完整性后重试。";
            return $"阿里云 OSS {operation}失败；ErrorType={errorType}；StorageScope={scope}；"
                   + $"Bucket={bucketName}；Object={objectKey}；原始错误={original}；解决方案={solution}";
        }

        /// <summary>
        /// 判断是否存在此文件。传入ClientModel、Limit、FileFullPath
        /// 注意，当Limit为false时，也要判断为true时是否存在，因为原图要在私有oss存1次，原图不存公有。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult<bool>> ObjectExist(HDFSParam param)
        {
            try
            {
                var bucketName = "";
                var clientModel = param.ClientModel;
                OssClient ossClient = null;
                //如果是直接判断私有OSS
                if (param.Limit == true)
                {
                    bucketName = clientModel.OsClientModel["AliOssPrivateBucketName"].Val<string>();
                    var config = new ClientConfiguration
                    {
                        ConnectionTimeout = 30000, // 连接超时：30秒
                        MaxErrorRetry = 2 // 最大重试次数
                    };
                    ossClient = new OssClient(clientModel.OsClientModel["AliOssPrivateEndpoint"].Val<string>(),
                                        clientModel.OsClientModel["AliOssPrivateAccessKeyId"].Val<string>(),
                                        clientModel.OsClientModel["AliOssPrivateAccessKeySecret"].Val<string>(),
                                        config);
                    var objectExist = ossClient.DoesObjectExist(bucketName, param.FileFullPath.DosTrimStart('/'));
                    return new DosResult<bool>(1, objectExist);
                }
                else//如果是判断公有OSS
                {
                    bucketName = clientModel.OsClientModel["AliOssPublicBucketName"].Val<string>();
                    var config = new ClientConfiguration
                    {
                        ConnectionTimeout = 5000,
                        MaxErrorRetry = 2
                    };
                    ossClient = new OssClient(clientModel.OsClientModel["AliOssPublicEndpoint"].Val<string>(),
                                        clientModel.OsClientModel["AliOssPublicAccessKeyId"].Val<string>(),
                                        clientModel.OsClientModel["AliOssPublicAccessKeySecret"].Val<string>(),
                                        config);
                    var objectExist = ossClient.DoesObjectExist(bucketName, param.FileFullPath.DosTrimStart('/'));
                    //注意：当不公有OSS不存在文件时，同样也要判断私有OSS是否存在，因为原图是在私有oss存储，并不不存存公有OSS。
                    if (!objectExist)
                    {
                        bucketName = clientModel.OsClientModel["AliOssPrivateBucketName"].Val<string>();
                        ossClient = null;
                        var configPrivate = new ClientConfiguration
                        {
                            ConnectionTimeout = 30000, // 连接超时：30秒
                            MaxErrorRetry = 2 // 最大重试次数
                        };
                        ossClient = new OssClient(clientModel.OsClientModel["AliOssPrivateEndpoint"].Val<string>(),
                                            clientModel.OsClientModel["AliOssPrivateAccessKeyId"].Val<string>(),
                                            clientModel.OsClientModel["AliOssPrivateAccessKeySecret"].Val<string>(),
                                            configPrivate);
                        objectExist = ossClient.DoesObjectExist(bucketName, param.FileFullPath.DosTrimStart('/'));
                    }
                    return new DosResult<bool>(1, objectExist);
                }
            }
            catch (Exception ex)
            {
                var bucketName = param?.Limit == true
                    ? param.ClientModel?.OsClientModel?["AliOssPrivateBucketName"].Val<string>()
                    : param?.ClientModel?.OsClientModel?["AliOssPublicBucketName"].Val<string>();
                var diagnostic = BuildOssFailureMessage("对象存在性检查", param, bucketName ?? "", ex);
                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "OSS日志",
                    Title = "OSS判断文件是否存在失败",
                    Content = diagnostic,
                    OsClient = param.ClientModel?.OsClient
                });
                return new DosResult<bool>(0, false, diagnostic);
            }
        }

        public async Task<DosResult> CopyObjectToStream(HDFSParam param)
        {
            if (param?.FileStream == null || !param.FileStream.CanWrite)
                return new DosResult(0, null, "HDFS流式读取需要可写的目标流。");
            var clientModel = param.ClientModel;
            var usePrivate = param.Limit == true;
            var bucketName = usePrivate
                ? clientModel.OsClientModel["AliOssPrivateBucketName"].Val<string>()
                : clientModel.OsClientModel["AliOssPublicBucketName"].Val<string>();
            var endpoint = usePrivate
                ? clientModel.OsClientModel["AliOssPrivateEndpoint"].Val<string>()
                : clientModel.OsClientModel["AliOssPublicEndpoint"].Val<string>();
            var accessKeyId = usePrivate
                ? clientModel.OsClientModel["AliOssPrivateAccessKeyId"].Val<string>()
                : clientModel.OsClientModel["AliOssPublicAccessKeyId"].Val<string>();
            var accessKeySecret = usePrivate
                ? clientModel.OsClientModel["AliOssPrivateAccessKeySecret"].Val<string>()
                : clientModel.OsClientModel["AliOssPublicAccessKeySecret"].Val<string>();
            try
            {
                var timeoutSeconds = Math.Max(5, Math.Min(7200, param.TimeoutSeconds ?? 600));
                var client = new OssClient(endpoint, accessKeyId, accessKeySecret, new ClientConfiguration
                {
                    ConnectionTimeout = checked(timeoutSeconds * 1000),
                    MaxErrorRetry = 3,
                    EnableCrcCheck = false
                });
                using var source = client.GetObject(bucketName, param.FileFullPath.DosTrimStart('/'));
                await source.ResponseStream.CopyToAsync(
                    param.FileStream,
                    128 * 1024,
                    param.CancellationToken).ConfigureAwait(false);
                return new DosResult(1, new
                {
                    Size = source.Metadata?.ContentLength ?? 0,
                    ETag = source.Metadata?.ETag ?? ""
                });
            }
            catch (OperationCanceledException)
            {
                return new DosResult(0, null, "HDFS流式读取已取消。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, BuildOssFailureMessage(
                    "对象流式读取",
                    param,
                    bucketName,
                    ex));
            }
        }

        /// <summary>
        /// 上传文件。传入ClientModel、Limit、FileFullPath、FileStream
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> PutObject(HDFSParam param)
        {
            var clientModel = param.ClientModel;
            var requiredConfig = new[]
            {
                "AliOssPrivateBucketName", "AliOssPrivateEndpoint",
                "AliOssPrivateAccessKeyId", "AliOssPrivateAccessKeySecret",
                "AliOssPublicBucketName", "AliOssPublicEndpoint",
                "AliOssPublicAccessKeyId", "AliOssPublicAccessKeySecret"
            };
            var missingConfig = requiredConfig
                .Where(name => clientModel == null
                    || clientModel.OsClientModel == null
                    || clientModel.OsClientModel[name].Val<string>().DosIsNullOrWhiteSpace())
                .ToArray();
            if (missingConfig.Length > 0)
            {
                return new DosResult(
                    0,
                    null,
                    "阿里云 OSS 配置不完整；ErrorType=OBJECT_STORAGE_CONFIG_INCOMPLETE；"
                    + "缺失字段=" + string.Join(",", missingConfig)
                    + "；解决方案=请在目标租户 SaaS 引擎补齐私有桶与公有桶配置并刷新租户缓存后重试。"
                );
            }
            var bucketName = "";
            var bucketNamePrivate = "";
            OssClient ossClientPrivate = null;
            OssClient ossClient = null;

            var configPrivate = CreateUploadClientConfiguration(param);
            var configPublic = CreateUploadClientConfiguration(param);

            bucketNamePrivate = clientModel.OsClientModel["AliOssPrivateBucketName"].Val<string>();
            //这里无需再判断是走内网、还是走外网，因为clientModel.AliOssPrivateEndpoint已经是根据OsClientNetwork=Internet/Internal存储的内网或外网地址
            ossClientPrivate = new OssClient(clientModel.OsClientModel["AliOssPrivateEndpoint"].Val<string>(),
                                clientModel.OsClientModel["AliOssPrivateAccessKeyId"].Val<string>(),
                                clientModel.OsClientModel["AliOssPrivateAccessKeySecret"].Val<string>(),
                                configPrivate);
            bucketName = clientModel.OsClientModel["AliOssPublicBucketName"].Val<string>();
            ossClient = new OssClient(clientModel.OsClientModel["AliOssPublicEndpoint"].Val<string>(),
                                clientModel.OsClientModel["AliOssPublicAccessKeyId"].Val<string>(),
                                clientModel.OsClientModel["AliOssPublicAccessKeySecret"].Val<string>(),
                                configPublic);
            try
            {
                if (param.Preview == true && !param.FileFullPathOrigin.DosIsNullOrWhiteSpace())
                {
                    //ConfigHelper.GetAppSettings("AliOssImgProcess")
                    var process = string.Format(clientModel.OsClientModel["AliOssImgProcess"].Val<string>(), 780);
                    //注意：这里要传入压缩前的图片路径，因为此时压缩后的图片还未上传
                    //2023-09-02：注意压缩前的文件是放在私有的，因此使用ossClientPrivate
                    var ossObject = ossClientPrivate.GetObject(new GetObjectRequest(bucketNamePrivate, param.FileFullPathOrigin.TrimStart('/'), process));
                    
                    // 将 ResponseStream 复制到 MemoryStream，避免 Content-Length 问题
                    using (var memoryStream = new MemoryStream())
                    {
                        await ossObject.ResponseStream.CopyToAsync(memoryStream);
                        memoryStream.Position = 0;
                        
                        //上传（Preview压缩场景）
                        if (param.Limit == true)
                        {
                            var ossResult = ossClientPrivate.PutObject(bucketNamePrivate, param.FileFullPath.TrimStart('/'), memoryStream);
                            return new DosResult(1, ossResult);
                        }
                        else
                        {
                            var ossResult = ossClient.PutObject(bucketName, param.FileFullPath.TrimStart('/'), memoryStream);
                            return new DosResult(1, ossResult);
                        }
                    }
                }
                else//如果不压缩
                {
                    // 确保 Stream Position 为 0
                    if (param.FileStream.CanSeek)
                    {
                        param.FileStream.Position = 0;
                    }
                    
                    var objectKey = param.FileFullPath.DosTrimStart('/');

                    var declaredLength = param.ContentLength
                                         ?? (param.FileStream.CanSeek ? param.FileStream.Length : -1L);
                    if (declaredLength < 0)
                        return new DosResult(0, null, "阿里云OSS流式上传必须提供ContentLength。");

                    // OSS multipart cannot complete an empty part list. A
                    // non-seekable producer pipe may still represent a valid
                    // zero-byte object, so route that boundary explicitly.
                    if (declaredLength == 0)
                    {
                        using var empty = new MemoryStream(Array.Empty<byte>(), false);
                        var emptyResult = param.Limit == true
                            ? ossClientPrivate.PutObject(bucketNamePrivate, objectKey, empty)
                            : ossClient.PutObject(bucketName, objectKey, empty);
                        return new DosResult(1, emptyResult);
                    }

                    // OSS single PUT has a provider boundary.  Large and
                    // non-seekable publisher streams therefore use the native
                    // multipart API with a bounded window per part.
                    if (declaredLength >= 64L * 1024 * 1024 || !param.FileStream.CanSeek)
                    {
                        return await PutMultipartObjectAsync(
                            param.Limit == true ? ossClientPrivate : ossClient,
                            param.Limit == true ? bucketNamePrivate : bucketName,
                            objectKey,
                            param.FileStream,
                            declaredLength,
                            param.CancellationToken).ConfigureAwait(false);
                    }
                    
                    // 直接上传，让SDK自动处理
                    if (param.Limit == true)
                    {
                        var ossResult = ossClientPrivate.PutObject(bucketNamePrivate, objectKey, param.FileStream);
                        return new DosResult(1, ossResult);
                    }
                    else
                    {
                        var ossResult = ossClient.PutObject(bucketName, objectKey, param.FileStream);
                        return new DosResult(1, ossResult);
                    }
                }
            }
            catch (Exception ex)
            {
                var failedBucket = param.Limit == true ? bucketNamePrivate : bucketName;
                return new DosResult(0, null, BuildOssFailureMessage("对象上传", param, failedBucket, ex));
            }
        }

        internal static long CalculateMultipartPartSize(long totalBytes)
        {
            if (totalBytes < 0) throw new ArgumentOutOfRangeException(nameof(totalBytes));
            // Keep provider requests below common proxy/SDK timeout windows.
            // 5 GiB therefore uses 320 OSS parts, still far below the provider
            // limit of 10,000.  The dynamic lower bound grows automatically for
            // multi-terabyte objects so the same limit is never exceeded.
            const long minimum = 16L * 1024 * 1024;
            const long unit = 1024L * 1024;
            const long providerMaxPart = 5L * 1024 * 1024 * 1024;
            var required = totalBytes == 0 ? minimum : (totalBytes + 9_999L) / 10_000L;
            var rounded = ((required + unit - 1L) / unit) * unit;
            var partSize = Math.Max(minimum, rounded);
            if (partSize > providerMaxPart)
                throw new ArgumentOutOfRangeException(
                    nameof(totalBytes),
                    "对象超过阿里云OSS原生multipart的10000分片/单片5GB能力边界。");
            return partSize;
        }

        internal static ClientConfiguration CreateUploadClientConfiguration(HDFSParam param)
        {
            // 普通上传保持原 60 秒；数据库备份、应用发布等已授权长任务可按单次请求
            // 显式放宽。上限 2 小时，避免把错误端点变成无限挂起。
            var uploadTimeoutSeconds = Math.Max(5, Math.Min(7200, param?.TimeoutSeconds ?? 60));
            var declaredLength = param?.ContentLength
                                 ?? (param?.FileStream?.CanSeek == true
                                     ? param.FileStream.Length
                                     : -1L);
            var useStableLargeObjectTransport = declaredLength >= 64L * 1024 * 1024
                                                || param?.FileStream?.CanSeek == false;
            return new ClientConfiguration
            {
                ConnectionTimeout = checked(uploadTimeoutSeconds * 1000),
                MaxErrorRetry = 3,
                EnableCrcCheck = false,
                // Aliyun OSS SDK 2.14.1 defaults to a shared HttpClient whose
                // timeout cancellation has been observed during long UploadPart
                // requests. Its retained HttpWebRequest implementation applies
                // both request and read/write timeouts per request and supports
                // direct streaming. Limit this compatibility path to large or
                // non-seekable objects; ordinary uploads keep the default client.
                UseNewServiceClient = !useStableLargeObjectTransport,
                DirectWriteStreamThreshold = useStableLargeObjectTransport ? 1L : 0L
            };
        }

        private static string BuildMultipartFailureMessage(
            string phase,
            int partNumber,
            long offset,
            long partSize,
            long totalBytes,
            CancellationToken cancellationToken,
            Exception exception)
        {
            var root = exception?.GetBaseException() ?? exception;
            var message = root?.Message ?? exception?.Message ?? "未知错误";
            if (message.Length > 1200) message = message.Substring(0, 1200);
            return "阿里云OSS multipart上传失败："
                   + $"Phase={phase};PartNumber={partNumber};Offset={offset};"
                   + $"PartSize={partSize};TotalBytes={totalBytes};"
                   + $"CallerCancellationRequested={cancellationToken.IsCancellationRequested};"
                   + $"ExceptionType={exception?.GetType().FullName ?? "Unknown"};"
                   + $"RootExceptionType={root?.GetType().FullName ?? "Unknown"};"
                   + "Message=" + message;
        }

        private static async Task<DosResult> PutMultipartObjectAsync(
            OssClient client,
            string bucketName,
            string objectKey,
            Stream source,
            long totalBytes,
            CancellationToken cancellationToken)
        {
            InitiateMultipartUploadResult initiated = null;
            var phase = "InitiateMultipartUpload";
            var partNumber = 0;
            long offset = 0;
            long currentSize = 0;
            try
            {
                cancellationToken.ThrowIfCancellationRequested();
                initiated = client.InitiateMultipartUpload(
                    new InitiateMultipartUploadRequest(bucketName, objectKey));
                var partSize = CalculateMultipartPartSize(totalBytes);
                var partETags = new List<PartETag>();
                partNumber = 1;
                while (offset < totalBytes)
                {
                    phase = "PreparePart";
                    cancellationToken.ThrowIfCancellationRequested();
                    currentSize = Math.Min(partSize, totalBytes - offset);
                    // Aliyun OSS SDK 2.14 seeks its UploadPart input while
                    // calculating or retrying the request. HTTP request bodies
                    // and resumable chunk streams are intentionally not
                    // seekable, so spool only this bounded provider part to a
                    // DeleteOnClose file. Memory remains constant and the full
                    // multi-gigabyte logical object is never materialized.
                    using var window = await CreateSeekableMultipartPartAsync(
                        source,
                        currentSize,
                        cancellationToken).ConfigureAwait(false);
                    phase = "UploadPart";
                    var upload = client.UploadPart(new UploadPartRequest(
                        bucketName,
                        objectKey,
                        initiated.UploadId)
                    {
                        InputStream = window,
                        PartNumber = partNumber,
                        PartSize = currentSize
                    });
                    partETags.Add(upload.PartETag ?? new PartETag(partNumber, upload.ETag));
                    offset += currentSize;
                    partNumber++;
                }

                // Empty objects stay on the ordinary PutObject route, so a
                // multipart completion always contains at least one part.
                phase = "CompleteMultipartUpload";
                currentSize = 0;
                var complete = new CompleteMultipartUploadRequest(
                    bucketName,
                    objectKey,
                    initiated.UploadId);
                foreach (var part in partETags) complete.PartETags.Add(part);
                var result = client.CompleteMultipartUpload(complete);
                return new DosResult(1, result);
            }
            catch (Exception ex)
            {
                var failure = BuildMultipartFailureMessage(
                    phase,
                    partNumber,
                    offset,
                    currentSize,
                    totalBytes,
                    cancellationToken,
                    ex);
                if (initiated != null && !initiated.UploadId.DosIsNullOrWhiteSpace())
                {
                    try
                    {
                        client.AbortMultipartUpload(new AbortMultipartUploadRequest(
                            bucketName,
                            objectKey,
                            initiated.UploadId));
                    }
                    catch { }
                }
                return new DosResult(0, null, failure);
            }
        }

        internal static async Task<FileStream> CreateSeekableMultipartPartAsync(
            Stream source,
            long length,
            CancellationToken cancellationToken)
        {
            if (source == null) throw new ArgumentNullException(nameof(source));
            if (!source.CanRead) throw new ArgumentException("源流不可读。", nameof(source));
            if (length < 0) throw new ArgumentOutOfRangeException(nameof(length));

            var temporaryPath = Path.Combine(
                Path.GetTempPath(),
                "microi-oss-part-" + Guid.NewGuid().ToString("N") + ".tmp");
            FileStream seekable = null;
            try
            {
                seekable = new FileStream(
                    temporaryPath,
                    FileMode.CreateNew,
                    FileAccess.ReadWrite,
                    FileShare.None,
                    128 * 1024,
                    FileOptions.DeleteOnClose | FileOptions.SequentialScan);
                var buffer = new byte[128 * 1024];
                long copied = 0;
                while (copied < length)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    var requested = (int)Math.Min(buffer.Length, length - copied);
                    // ASP.NET Core request bodies reject synchronous reads by
                    // default. Always consume the inbound body asynchronously;
                    // only the bounded temporary FileStream is later read
                    // synchronously by Aliyun OSS SDK 2.14.
                    var read = await source.ReadAsync(
                        buffer,
                        0,
                        requested,
                        cancellationToken).ConfigureAwait(false);
                    if (read <= 0)
                    {
                        throw new EndOfStreamException(
                            $"OSS multipart临时分片长度不足，期望{length}，实际{copied}。");
                    }
                    await seekable.WriteAsync(
                        buffer,
                        0,
                        read,
                        cancellationToken).ConfigureAwait(false);
                    copied += read;
                }
                await seekable.FlushAsync(cancellationToken).ConfigureAwait(false);
                seekable.Position = 0;
                return seekable;
            }
            catch
            {
                seekable?.Dispose();
                try { if (File.Exists(temporaryPath)) File.Delete(temporaryPath); } catch { }
                throw;
            }
        }

        /// <summary>
        /// 获取单个私有文件的临时访问地址。传入FileFullPath、ClientModel、
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> GetPrivateFileUrl(HDFSParam param)
        {
            var clientModel = param.ClientModel;

            if (param.FileFullPath.DosIsNullOrWhiteSpace() && param.FileFullPaths == null)
            {
                return new DosResult(0, null, DiyMessage.GetLang(clientModel.OsClient, "ParamError", param._Lang));
            }

            var usePrivateBucket = param.Limit != false;
            var bucketName = usePrivateBucket
                ? clientModel.OsClientModel["AliOssPrivateBucketName"].Val<string>()
                : clientModel.OsClientModel["AliOssPublicBucketName"].Val<string>();
            var endpoint = usePrivateBucket
                ? clientModel.OsClientModel["AliOssPrivateEndpoint"].Val<string>()
                : clientModel.OsClientModel["AliOssPublicEndpoint"].Val<string>();
            var accessKeyId = usePrivateBucket
                ? clientModel.OsClientModel["AliOssPrivateAccessKeyId"].Val<string>()
                : clientModel.OsClientModel["AliOssPublicAccessKeyId"].Val<string>();
            var accessKeySecret = usePrivateBucket
                ? clientModel.OsClientModel["AliOssPrivateAccessKeySecret"].Val<string>()
                : clientModel.OsClientModel["AliOssPublicAccessKeySecret"].Val<string>();
            var config = new ClientConfiguration
            {
                ConnectionTimeout = 5000,
                MaxErrorRetry = 2
            };

            OssClient ossClient = null;
            try
            {
                if (!param.FileFullPath.DosIsNullOrWhiteSpace())
                {
                    //如果是返回byte[]
                    if (param.ReturnFileType == "Byte")
                    {
                        ossClient = new OssClient(endpoint, accessKeyId, accessKeySecret);
                        var ossObject = ossClient.GetObject(new GetObjectRequest(bucketName, param.FileFullPath.TrimStart('/')));
                        using (MemoryStream memStream = new MemoryStream())
                        {
                            ossObject.ResponseStream.CopyTo(memStream);
                            memStream.Seek(0, SeekOrigin.Begin);
                            return new DosResult(1, StreamHelper.StreamToBytes(memStream));
                        }
                    }
                    else
                    {
                        //如果是返回url，只给5秒钟时间
                        ossClient = new OssClient(endpoint, accessKeyId, accessKeySecret, config);
                        // 生成签名URL。
                        var req = new GeneratePresignedUriRequest(bucketName, param.FileFullPath.DosTrimStart('/'), SignHttpMethod.Get);
                        var uri = ossClient.GeneratePresignedUri(req);
                        //当OsClientNetwork=Internal时，使用的是局域网的oss地址AliOssPrivateEndpoint，返回的也是局域网临时url，因此要做替换。应该还有更好的解决方案，暂时不研究了。
                        //2024-07-24:支持https绑定域名访问私有桶
                        //var url = uri.AbsoluteUri.Replace("-internal.aliyuncs.com", ".aliyuncs.com");
                        var domain = usePrivateBucket
                            ? clientModel.OsClientModel["AliOssPrivateDomain"].Val<string>()
                            : clientModel.OsClientModel["AliOssPublicDomain"].Val<string>();
                        var url = domain + uri.PathAndQuery;
                        return new DosResult(1, url);
                    }
                }
                else
                {
                    //如果是返回url，只给5秒钟时间
                    ossClient = new OssClient(endpoint, accessKeyId, accessKeySecret, config);
                    var listResult = new List<string>();
                    foreach (var fileFullPath in param.FileFullPaths)
                    {
                        // 生成签名URL。
                        var req = new GeneratePresignedUriRequest(bucketName, fileFullPath.DosTrimStart('/'), SignHttpMethod.Get);
                        var uri = ossClient.GeneratePresignedUri(req);
                        //当OsClientNetwork=Internal时，使用的是局域网的oss地址AliOssPrivateEndpoint，返回的也是局域网临时url，因此要做替换。应该还有更好的解决方案，暂时不研究了。
                        //2024-07-24:支持https绑定域名访问私有桶
                        //var url = uri.AbsoluteUri.Replace("-internal.aliyuncs.com", ".aliyuncs.com");
                        var domain = usePrivateBucket
                            ? clientModel.OsClientModel["AliOssPrivateDomain"].Val<string>()
                            : clientModel.OsClientModel["AliOssPublicDomain"].Val<string>();
                        var url = domain + uri.PathAndQuery;
                        listResult.Add(url);
                    }
                    return new DosResult(1, listResult);
                }
            }
            catch (Exception e)
            {
                //MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                //{
                //    Type = "OSS日志",
                //    Title = "OSS获取下载链接失败",
                //    Content = "param：" + param.FilePathName + "。" + e.Message + "。" + e.StackTrace,
                //    OsClient = param.OsClient
                //});
                return new DosResult(0, null, e.Message);
            }
        }

        /// <summary>
        /// 列出指定前缀下的文件和文件夹
        /// </summary>
        public async Task<DosResult> ListObjects(HDFSParam param)
        {
            try
            {
                var clientModel = param.ClientModel;
                var bucketName = param.Limit == true
                    ? clientModel.OsClientModel["AliOssPrivateBucketName"].Val<string>()
                    : clientModel.OsClientModel["AliOssPublicBucketName"].Val<string>();

                var endpoint = param.Limit == true
                    ? clientModel.OsClientModel["AliOssPrivateEndpoint"].Val<string>()
                    : clientModel.OsClientModel["AliOssPublicEndpoint"].Val<string>();
                var accessKeyId = param.Limit == true
                    ? clientModel.OsClientModel["AliOssPrivateAccessKeyId"].Val<string>()
                    : clientModel.OsClientModel["AliOssPublicAccessKeyId"].Val<string>();
                var accessKeySecret = param.Limit == true
                    ? clientModel.OsClientModel["AliOssPrivateAccessKeySecret"].Val<string>()
                    : clientModel.OsClientModel["AliOssPublicAccessKeySecret"].Val<string>();

                var config = new ClientConfiguration
                {
                    ConnectionTimeout = 30000,
                    MaxErrorRetry = 2
                };
                var ossClient = new OssClient(endpoint, accessKeyId, accessKeySecret, config);

                static string NormalizeFolderPath(string value)
                {
                    var normalized = (value ?? "").Replace('\\', '/').TrimStart('/');
                    while (normalized.Contains("//"))
                    {
                        normalized = normalized.Replace("//", "/");
                    }
                    normalized = normalized.TrimEnd('/');
                    return normalized.Length > 0 ? normalized + "/" : "";
                }

                var prefix = NormalizeFolderPath(param.Prefix);
                var isRecursive = param.Recursive == true;
                var delimiter = param.Delimiter ?? "/";

                var listRequest = new ListObjectsRequest(bucketName)
                {
                    Prefix = prefix,
                    Delimiter = isRecursive ? null : delimiter,
                    MaxKeys = param.MaxKeys > 0 ? param.MaxKeys : 1000
                };
                if (!param.Marker.DosIsNullOrWhiteSpace())
                {
                    listRequest.Marker = param.Marker;
                }

                var listing = ossClient.ListObjects(listRequest);

                var folders = new List<object>();
                var files = new List<object>();
                var seenPrefixes = new HashSet<string>();

                void AddFolderHierarchy(string objectKey, bool isFolderObject)
                {
                    var normalizedKey = (objectKey ?? "").Replace('\\', '/');
                    var folderPath = isFolderObject
                        ? NormalizeFolderPath(normalizedKey)
                        : NormalizeFolderPath(normalizedKey.Contains("/")
                            ? normalizedKey.Substring(0, normalizedKey.LastIndexOf('/') + 1)
                            : "");
                    if (folderPath.Length == 0 || (prefix.Length > 0 && !folderPath.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)))
                    {
                        return;
                    }

                    var relativePath = prefix.Length > 0 ? folderPath.Substring(prefix.Length) : folderPath;
                    var currentPath = prefix;
                    foreach (var segment in relativePath.Split('/', StringSplitOptions.RemoveEmptyEntries))
                    {
                        currentPath += segment + "/";
                        if (currentPath == prefix || !seenPrefixes.Add(currentPath)) continue;
                        folders.Add(new { Name = segment, FullPath = currentPath, IsFolder = true });
                    }
                }

                // 公共前缀 = 子文件夹
                if (listing.CommonPrefixes != null)
                {
                    foreach (var commonPrefix in listing.CommonPrefixes)
                    {
                        var folderPath = NormalizeFolderPath(commonPrefix);
                        if (folderPath == prefix)
                        {
                            continue;
                        }

                        if (!seenPrefixes.Add(folderPath)) continue;

                        var relativePath = prefix.Length > 0 && folderPath.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                            ? folderPath.Substring(prefix.Length).TrimEnd('/')
                            : folderPath.TrimEnd('/');
                        if (relativePath.Length == 0 || relativePath.Contains("/"))
                        {
                            continue;
                        }

                        var folderName = folderPath.TrimEnd('/');
                        if (folderName.Contains("/"))
                        {
                            folderName = folderName.Substring(folderName.LastIndexOf('/') + 1);
                        }
                        folders.Add(new
                        {
                            Name = folderName,
                            FullPath = folderPath,
                            IsFolder = true
                        });
                    }
                }

                // 对象 = 文件
                if (listing.ObjectSummaries != null)
                {
                    foreach (var obj in listing.ObjectSummaries)
                    {
                        // 排除文件夹自身的空对象
                        if (obj.Key == prefix)
                            continue;

                        var isFolderObject = obj.Key.EndsWith("/");
                        if (isRecursive)
                        {
                            AddFolderHierarchy(obj.Key, isFolderObject);
                        }
                        if (isFolderObject) continue;

                        var fileName = obj.Key;
                        if (fileName.Contains("/"))
                        {
                            fileName = fileName.Substring(fileName.LastIndexOf('/') + 1);
                        }

                        // 关键字过滤
                        if (!param.Keyword.DosIsNullOrWhiteSpace())
                        {
                            if (!fileName.ToLower().Contains(param.Keyword.ToLower()))
                                continue;
                        }

                        var ext = Path.GetExtension(fileName).TrimStart('.').ToLower();
                        files.Add(new
                        {
                            Name = fileName,
                            FullPath = obj.Key,
                            Size = obj.Size,
                            Type = ext,
                            LastModified = obj.LastModified.ToString("yyyy-MM-dd HH:mm:ss"),
                            IsFolder = false
                        });
                    }
                }

                return new DosResult(1, new
                {
                    Folders = folders,
                    Files = files,
                    IsTruncated = listing.IsTruncated,
                    NextMarker = listing.NextMarker
                });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "Aliyun OSS ListObjects Error: " + ex.Message);
            }
        }

        /// <summary>
        /// 删除文件
        /// </summary>
        public async Task<DosResult> DeleteObject(HDFSParam param)
        {
            try
            {
                var clientModel = param.ClientModel;
                var bucketName = param.Limit == true
                    ? clientModel.OsClientModel["AliOssPrivateBucketName"].Val<string>()
                    : clientModel.OsClientModel["AliOssPublicBucketName"].Val<string>();

                var endpoint = param.Limit == true
                    ? clientModel.OsClientModel["AliOssPrivateEndpoint"].Val<string>()
                    : clientModel.OsClientModel["AliOssPublicEndpoint"].Val<string>();
                var accessKeyId = param.Limit == true
                    ? clientModel.OsClientModel["AliOssPrivateAccessKeyId"].Val<string>()
                    : clientModel.OsClientModel["AliOssPublicAccessKeyId"].Val<string>();
                var accessKeySecret = param.Limit == true
                    ? clientModel.OsClientModel["AliOssPrivateAccessKeySecret"].Val<string>()
                    : clientModel.OsClientModel["AliOssPublicAccessKeySecret"].Val<string>();

                var config = new ClientConfiguration
                {
                    ConnectionTimeout = 30000,
                    MaxErrorRetry = 2
                };
                var ossClient = new OssClient(endpoint, accessKeyId, accessKeySecret, config);

                var objectKey = param.FileFullPath.DosTrimStart('/');

                // 如果是文件夹，递归删除所有子对象
                if (objectKey.EndsWith("/"))
                {
                    var allKeys = new List<string>();
                    string marker = null;
                    bool isTruncated = true;
                    while (isTruncated)
                    {
                        var listRequest = new ListObjectsRequest(bucketName)
                        {
                            Prefix = objectKey,
                            MaxKeys = 1000
                        };
                        if (marker != null) listRequest.Marker = marker;

                        var listing = ossClient.ListObjects(listRequest);
                        if (listing.ObjectSummaries != null)
                        {
                            foreach (var obj in listing.ObjectSummaries)
                            {
                                allKeys.Add(obj.Key);
                            }
                        }
                        isTruncated = listing.IsTruncated;
                        marker = listing.NextMarker;
                    }

                    if (allKeys.Count > 0)
                    {
                        // 批量删除，每次最多1000个
                        for (int i = 0; i < allKeys.Count; i += 1000)
                        {
                            var batch = allKeys.Skip(i).Take(1000).ToList();
                            var deleteRequest = new DeleteObjectsRequest(bucketName, batch, false);
                            ossClient.DeleteObjects(deleteRequest);
                        }
                    }
                }
                else
                {
                    ossClient.DeleteObject(bucketName, objectKey);
                }

                return new DosResult(1);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "Aliyun OSS DeleteObject Error: " + ex.Message);
            }
        }

        /// <summary>
        /// 创建文件夹
        /// </summary>
        public async Task<DosResult> CreateFolder(HDFSParam param)
        {
            try
            {
                var clientModel = param.ClientModel;
                var bucketName = param.Limit == true
                    ? clientModel.OsClientModel["AliOssPrivateBucketName"].Val<string>()
                    : clientModel.OsClientModel["AliOssPublicBucketName"].Val<string>();

                var endpoint = param.Limit == true
                    ? clientModel.OsClientModel["AliOssPrivateEndpoint"].Val<string>()
                    : clientModel.OsClientModel["AliOssPublicEndpoint"].Val<string>();
                var accessKeyId = param.Limit == true
                    ? clientModel.OsClientModel["AliOssPrivateAccessKeyId"].Val<string>()
                    : clientModel.OsClientModel["AliOssPublicAccessKeyId"].Val<string>();
                var accessKeySecret = param.Limit == true
                    ? clientModel.OsClientModel["AliOssPrivateAccessKeySecret"].Val<string>()
                    : clientModel.OsClientModel["AliOssPublicAccessKeySecret"].Val<string>();

                var config = new ClientConfiguration
                {
                    ConnectionTimeout = 30000,
                    MaxErrorRetry = 2
                };
                var ossClient = new OssClient(endpoint, accessKeyId, accessKeySecret, config);

                var folderKey = param.FileFullPath.DosTrimStart('/');
                if (!folderKey.EndsWith("/"))
                {
                    folderKey += "/";
                }

                // 上传空对象模拟文件夹
                using (var emptyStream = new MemoryStream(new byte[0]))
                {
                    ossClient.PutObject(bucketName, folderKey, emptyStream);
                }

                return new DosResult(1, new { FullPath = folderKey });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "Aliyun OSS CreateFolder Error: " + ex.Message);
            }
        }

        /// <summary>
        /// 复制文件
        /// </summary>
        public async Task<DosResult> CopyObject(HDFSParam param)
        {
            try
            {
                var clientModel = param.ClientModel;
                var bucketName = param.Limit == true
                    ? clientModel.OsClientModel["AliOssPrivateBucketName"].Val<string>()
                    : clientModel.OsClientModel["AliOssPublicBucketName"].Val<string>();

                var endpoint = param.Limit == true
                    ? clientModel.OsClientModel["AliOssPrivateEndpoint"].Val<string>()
                    : clientModel.OsClientModel["AliOssPublicEndpoint"].Val<string>();
                var accessKeyId = param.Limit == true
                    ? clientModel.OsClientModel["AliOssPrivateAccessKeyId"].Val<string>()
                    : clientModel.OsClientModel["AliOssPublicAccessKeyId"].Val<string>();
                var accessKeySecret = param.Limit == true
                    ? clientModel.OsClientModel["AliOssPrivateAccessKeySecret"].Val<string>()
                    : clientModel.OsClientModel["AliOssPublicAccessKeySecret"].Val<string>();

                var config = new ClientConfiguration
                {
                    ConnectionTimeout = 60000,
                    MaxErrorRetry = 3
                };
                var ossClient = new OssClient(endpoint, accessKeyId, accessKeySecret, config);

                var sourceKey = param.FileFullPath.DosTrimStart('/');
                var destKey = param.DestPath.DosTrimStart('/');

                var copyRequest = new CopyObjectRequest(bucketName, sourceKey, bucketName, destKey);
                ossClient.CopyObject(copyRequest);

                return new DosResult(1);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "Aliyun OSS CopyObject Error: " + ex.Message);
            }
        }

        /// <summary>
        /// 移动文件（复制+删除）
        /// </summary>
        public async Task<DosResult> MoveObject(HDFSParam param)
        {
            try
            {
                var copyResult = await CopyObject(param);
                if (copyResult.Code != 1)
                {
                    return copyResult;
                }

                var deleteResult = await DeleteObject(new HDFSParam
                {
                    ClientModel = param.ClientModel,
                    Limit = param.Limit,
                    FileFullPath = param.FileFullPath
                });
                if (deleteResult.Code != 1)
                {
                    return new DosResult(0, null, "文件复制成功但删除源文件失败: " + deleteResult.Msg);
                }

                return new DosResult(1);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "Aliyun OSS MoveObject Error: " + ex.Message);
            }
        }
    }
}


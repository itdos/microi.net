using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Minio;
using Minio.DataModel.Args;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// MinIO分布式存储。
    /// 服务器上传一定是走内网EndPoint，外网调试上传一定是走外网EndPoint
    /// </summary>
	public class MicroiHDFSMinIO : MicroiHDFS, IMicroiHDFS
    {
        private static readonly HttpClient UploadReadbackHttpClient = CreateUploadReadbackHttpClient();

        public sealed class MinioEndpointConfiguration
        {
            public string Host { get; set; }
            public int Port { get; set; }
            public bool UseSsl { get; set; }
        }

        /// <summary>
        /// Accept both the historical host[:port] form and full http(s) URLs.
        /// MinioClient.WithEndpoint(string) treats a scheme-bearing value as a host
        /// and later fails with "hostname could not be parsed". Normalize once and
        /// use the host/port overload in every object operation.
        /// </summary>
        public static MinioEndpointConfiguration NormalizeEndpoint(string endpoint, bool configuredSsl)
        {
            var text = (endpoint ?? "").Trim();
            if (text.DosIsNullOrWhiteSpace()) throw new ArgumentException("MinIO Endpoint不能为空。");

            var hasScheme = text.Contains("://", StringComparison.Ordinal);
            var candidate = hasScheme
                ? text
                : (configuredSsl ? "https://" : "http://") + text;
            if (!Uri.TryCreate(candidate, UriKind.Absolute, out var uri)
                || uri.Host.DosIsNullOrWhiteSpace()
                || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                throw new ArgumentException("MinIO Endpoint格式不正确，请填写 host:port 或 http(s)://host:port。");
            }
            if (!uri.UserInfo.DosIsNullOrWhiteSpace()
                || !uri.Query.DosIsNullOrWhiteSpace()
                || !uri.Fragment.DosIsNullOrWhiteSpace()
                || (uri.AbsolutePath != "/" && !uri.AbsolutePath.DosIsNullOrWhiteSpace()))
            {
                throw new ArgumentException("MinIO Endpoint只能包含协议、主机和端口，不能包含凭据、路径、查询或片段。");
            }

            var useSsl = hasScheme
                ? string.Equals(uri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
                : configuredSsl;
            return new MinioEndpointConfiguration
            {
                Host = uri.Host,
                Port = uri.IsDefaultPort ? (useSsl ? 443 : 80) : uri.Port,
                UseSsl = useSsl
            };
        }

        private static IMinioClient BuildMinioClient(
            string endpoint,
            bool configuredSsl,
            string accessKey,
            string secretKey,
            string region = null)
        {
            var normalized = NormalizeEndpoint(endpoint, configuredSsl);
            var builder = new MinioClient()
                .WithEndpoint(normalized.Host, normalized.Port)
                .WithCredentials(accessKey, secretKey);
            if (normalized.UseSsl) builder = builder.WithSSL();
            if (!region.DosIsNullOrWhiteSpace()) builder = builder.WithRegion(region);
            return builder.Build();
        }

        private static HttpClient CreateUploadReadbackHttpClient()
        {
            return new HttpClient(new HttpClientHandler
            {
                // Pre-signed URLs contain temporary credentials in the query.
                // Never forward them to a redirect target during readback.
                AllowAutoRedirect = false
            })
            {
                Timeout = TimeSpan.FromSeconds(30)
            };
        }

        private static bool ShouldUseInternetEndpoint(bool? networkIsInternet, string returnFileType)
        {
            return networkIsInternet
                ?? !string.Equals(returnFileType, "Byte", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// 获取私有文件的临时访问url
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> GetPrivateFileUrl(HDFSParam param)
        {
            var result = new DosResult();
            try
            {
                var clientModel = param.ClientModel;
                //2023-06-11：
                //如果MinIOEndPoint填写的是局域网IP+端口，虽然上传走了内网，但返回的地址用域名是不能访问此文件的
                //所以临时建议MinIOEndPoint填写外网地址：也就是9010映射的file.microios.com
                //2023-08-22：如果是S3，可能私有、公有是2个不同的EndPoint，所以不能单纯的使用MinIOEndPointInternet
                var internalEndPoint = clientModel.OsClientModel["MinIOEndPoint"].Val<string>();
                var internetEndPoint = clientModel.OsClientModel["MinIOEndPointInternet"].Val<string>();
                // Server-side byte reads (AI source context, exports, templates) must prefer
                // the internal MinIO endpoint. The internet endpoint can sit behind a public
                // proxy whose policy intentionally denies the private bucket.
                var useInternet = ShouldUseInternetEndpoint(param.NetworkIsInternet, param.ReturnFileType);
                var endPoint = useInternet
                    ? internetEndPoint.DosIsNullOrWhiteSpace(internalEndPoint)
                    : internalEndPoint.DosIsNullOrWhiteSpace(internetEndPoint);

                var minioClient = BuildMinioClient(
                    endPoint,
                    useInternet
                        ? clientModel.OsClientModel["MinIOEndPointSSL"].Val<int>() == 1
                        : clientModel.OsClientModel["MinIOPrivateEndPointSSL"].Val<int>() == 1,
                    clientModel.OsClientModel["MinIOAccessKey"].Val<string>(),
                    clientModel.OsClientModel["MinIOSecretKey"].Val<string>(),
                    clientModel.OsClientModel["MinIORegion"].Val<string>());
                var bucketName = param.Limit == false
                    ? clientModel.OsClientModel["MinIOPublicBucketName"].Val<string>()
                    : clientModel.OsClientModel["MinIOPrivateBucketName"].Val<string>();

                //如果是单文件
                if (!param.FileFullPath.DosIsNullOrWhiteSpace())
                {
                    //如果是返回byte[]
                    if (param.ReturnFileType == "Byte")
                    {
                        GetObjectArgs getArgs = new GetObjectArgs()
                                               .WithBucket(bucketName);
                        //getArgs.WithFile(param.FilePathName.TrimStart('/'));
                        getArgs.WithObject(param.FileFullPath.TrimStart('/'));

                        using (var memoryStream = new MemoryStream())
                        {
                            getArgs.WithCallbackStream(stream =>
                            {
                                stream.CopyTo(memoryStream);
                            });

                            var byteResult = await minioClient.GetObjectAsync(getArgs);
                            memoryStream.Position = 0;

                            result = new DosResult(1, StreamHelper.StreamToBytes(memoryStream));
                        }
                    }
                    else//如果是返回Url
                    {
                        PresignedGetObjectArgs args = new PresignedGetObjectArgs()
                                                .WithBucket(bucketName)
                                                .WithExpiry(60 * 30);//30分钟，后期建议动态配置
                        args = args.WithObject(param.FileFullPath.TrimStart('/'));
                        var url = await minioClient.PresignedGetObjectAsync(args);
                        result = new DosResult(1, url);
                    }

                }
                else //如果是多文件
                {
                    PresignedGetObjectArgs args = new PresignedGetObjectArgs()
                                                .WithBucket(bucketName)
                                                .WithExpiry(60 * 30);//30分钟，后期建议动态配置
                    var fileList = new List<string>();
                    foreach (var item in param.FileFullPaths)
                    {
                        args = args.WithObject(item.TrimStart('/'));
                        var url = await minioClient.PresignedGetObjectAsync(args);
                        fileList.Add(url);
                    }
                    result = new DosResult(1, fileList);
                }
            }
            catch (Exception ex)
            {


                result = new DosResult(0, null, ex.Message);
            }
            return result;
        }

        /// <summary>
        /// 判断文件是否存在
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult<bool>> ObjectExist(HDFSParam param)
        {
            var clientModel = param.ClientModel;
            if (clientModel.OsClientModel["MinIOEndPoint"].Val<string>().DosIsNullOrWhiteSpace()
                    || clientModel.OsClientModel["MinIOEndPointInternet"].Val<string>().DosIsNullOrWhiteSpace()
                    || clientModel.OsClientModel["MinIOAccessKey"].Val<string>().DosIsNullOrWhiteSpace()
                    || clientModel.OsClientModel["MinIOSecretKey"].Val<string>().DosIsNullOrWhiteSpace()
                    || clientModel.OsClientModel["MinIOPrivateBucketName"].Val<string>().DosIsNullOrWhiteSpace()
                    || clientModel.OsClientModel["MinIOPublicBucketName"].Val<string>().DosIsNullOrWhiteSpace()
                    )
            {
                return new DosResult<bool>(0, false, "MinIO分布式存储配置不完整！");
            }

            var bucketName = "";

            IMinioClient minIOClient = null;
            var endPoint = clientModel.OsClientModel["MinIOEndPoint"].Val<string>();
            var osClientNetwork = Environment.GetEnvironmentVariable("OsClientNetwork", EnvironmentVariableTarget.Process) ?? (ConfigHelper.GetAppSettings("OsClientNetwork") ?? "");
            if (param.NetworkIsInternet == null)
            {
                param.NetworkIsInternet = osClientNetwork == "Internet";
            }
            if (param.NetworkIsInternet == true)
            {
                endPoint = clientModel.OsClientModel["MinIOEndPointInternet"].Val<string>();
            }

            //只有GetPrivateFileUrl才需要用到这个判断
            //if (param.Limit != true)
            //{
            //    endPoint = clientModel.OsClientModel["MinIOEndPointInternet"].Val<string>();
            //}

            minIOClient = BuildMinioClient(
                endPoint,
                param.NetworkIsInternet == true
                    ? clientModel.OsClientModel["MinIOEndPointSSL"].Val<int>() == 1
                    : clientModel.OsClientModel["MinIOPrivateEndPointSSL"].Val<int>() == 1,
                clientModel.OsClientModel["MinIOAccessKey"].Val<string>(),
                clientModel.OsClientModel["MinIOSecretKey"].Val<string>(),
                clientModel.OsClientModel["MinIORegion"].Val<string>());
            var objectExist = false;
            if (param.Limit == true)
            {
                bucketName = clientModel.OsClientModel["MinIOPrivateBucketName"].Val<string>();
            }
            else
            {
                bucketName = clientModel.OsClientModel["MinIOPublicBucketName"].Val<string>();
            }

            try
            {
                var statObjectArgs = new StatObjectArgs()
                                    .WithBucket(bucketName)
                                    .WithObject(param.FileFullPath.DosTrimStart('/'));

                var tempResult = await minIOClient.StatObjectAsync(statObjectArgs);
                objectExist = !tempResult.ObjectName.DosIsNullOrWhiteSpace();
            }
            catch (Exception ex)
            {
                // Minio SDK 7 performs a signed HEAD /{bucket}/ before the
                // object request. A cache proxy can change that signed HEAD
                // into GET, while object-scoped credentials may intentionally
                // lack bucket-list permission. A signed one-byte GET remains
                // an exact, fail-closed existence proof in both cases.
                var rangeReadback = await ReadObjectRangeAsync(
                    minIOClient,
                    bucketName,
                    param.FileFullPath.DosTrimStart('/'));
                if (IsRangeReadbackObjectPresent(
                    (int)rangeReadback.StatusCode,
                    rangeReadback.ContentLength,
                    rangeReadback.ContentRangeLength,
                    rangeReadback.BytesRead))
                {
                    return new DosResult<bool>(1, true);
                }
                if (rangeReadback.StatusCode == HttpStatusCode.NotFound)
                {
                    return new DosResult<bool>(1, false);
                }
                return new DosResult<bool>(
                    0,
                    false,
                    "MinIO 对象存在性回读失败：HEAD/Stat 未通过，签名 Range GET 也未能确认对象。"
                    + $"Bucket={bucketName}，Object={param.FileFullPath.DosTrimStart('/')}。"
                    + "请检查 s3:GetObject、s3:ListBucket/GetBucketLocation 以及 Nginx "
                    + "proxy_cache_convert_head off。Stat原始错误："
                    + (ex?.Message ?? "未知错误")
                    + "；Range回读：" + rangeReadback.Error);
            }
            return new DosResult<bool>(1, objectExist);
        }

        /// <summary>
        /// Streams an object into a caller-owned destination without allocating a
        /// whole-object MemoryStream.  The async callback is awaited by MinIO, so
        /// the response stays alive until the bounded pipeline has consumed it.
        /// </summary>
        public async Task<DosResult> CopyObjectToStream(HDFSParam param)
        {
            if (param?.FileStream == null || !param.FileStream.CanWrite)
                return new DosResult(0, null, "HDFS流式读取需要可写的目标流。");
            try
            {
                var clientModel = param.ClientModel;
                var useInternet = param.NetworkIsInternet == true;
                var endPoint = useInternet
                    ? clientModel.OsClientModel["MinIOEndPointInternet"].Val<string>()
                    : clientModel.OsClientModel["MinIOEndPoint"].Val<string>();
                var client = BuildMinioClient(
                    endPoint,
                    useInternet
                        ? clientModel.OsClientModel["MinIOEndPointSSL"].Val<int>() == 1
                        : clientModel.OsClientModel["MinIOPrivateEndPointSSL"].Val<int>() == 1,
                    clientModel.OsClientModel["MinIOAccessKey"].Val<string>(),
                    clientModel.OsClientModel["MinIOSecretKey"].Val<string>(),
                    clientModel.OsClientModel["MinIORegion"].Val<string>());
                var bucketName = param.Limit == true
                    ? clientModel.OsClientModel["MinIOPrivateBucketName"].Val<string>()
                    : clientModel.OsClientModel["MinIOPublicBucketName"].Val<string>();
                var args = new GetObjectArgs()
                    .WithBucket(bucketName)
                    .WithObject(param.FileFullPath.DosTrimStart('/'))
                    .WithCallbackStream(async (source, callbackToken) =>
                    {
                        using var linked = CancellationTokenSource.CreateLinkedTokenSource(
                            callbackToken,
                            param.CancellationToken);
                        await source.CopyToAsync(param.FileStream, 128 * 1024, linked.Token)
                            .ConfigureAwait(false);
                    });
                var stat = await client.GetObjectAsync(args, param.CancellationToken).ConfigureAwait(false);
                return new DosResult(1, new { Size = stat.Size, ETag = stat.ETag });
            }
            catch (OperationCanceledException)
            {
                return new DosResult(0, null, "HDFS流式读取已取消。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "MinIO Stream Read Error:" + ex.Message);
            }
        }

        /// <summary>
        /// 上传文件
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult> PutObject(HDFSParam param)
        {
            var clientModel = param.ClientModel;
            if (clientModel.OsClientModel["MinIOEndPoint"].Val<string>().DosIsNullOrWhiteSpace()
                    || clientModel.OsClientModel["MinIOEndPointInternet"].Val<string>().DosIsNullOrWhiteSpace()
                    || clientModel.OsClientModel["MinIOAccessKey"].Val<string>().DosIsNullOrWhiteSpace()
                    || clientModel.OsClientModel["MinIOSecretKey"].Val<string>().DosIsNullOrWhiteSpace()
                    || clientModel.OsClientModel["MinIOPrivateBucketName"].Val<string>().DosIsNullOrWhiteSpace()
                    || clientModel.OsClientModel["MinIOPublicBucketName"].Val<string>().DosIsNullOrWhiteSpace()
                    )
            {
                return new DosResult(0, null, "MinIO分布式存储配置不完整！");
            }

            var bucketName = "";

            IMinioClient minIOClient = null;

            //服务器上传文件一般是走内网EndPoint，但是本地调试可能是走外网EndPoint

            var endPoint = clientModel.OsClientModel["MinIOEndPoint"].Val<string>();
            var osClientNetwork = Environment.GetEnvironmentVariable("OsClientNetwork", EnvironmentVariableTarget.Process) ?? (ConfigHelper.GetAppSettings("OsClientNetwork") ?? "");
            if (param.NetworkIsInternet == null)
            {
                param.NetworkIsInternet = osClientNetwork == "Internet";
            }
            if (param.NetworkIsInternet == true)
            {
                endPoint = clientModel.OsClientModel["MinIOEndPointInternet"].Val<string>();
            }

            //2023-11-30注释，上传如果使用 MinIOEndPointInternet，会导致过大的图片上传失败
            //过大报错：MinIO Upload Error5:MinIO API responded with message=The specified key does not exist.
            //if (param.Limit != true)
            //{
            //    endPoint = clientModel.OsClientModel["MinIOEndPointInternet"].Val<string>();
            //}

            minIOClient = BuildMinioClient(
                endPoint,
                param.NetworkIsInternet == true
                    ? clientModel.OsClientModel["MinIOEndPointSSL"].Val<int>() == 1
                    : clientModel.OsClientModel["MinIOPrivateEndPointSSL"].Val<int>() == 1,
                clientModel.OsClientModel["MinIOAccessKey"].Val<string>(),
                clientModel.OsClientModel["MinIOSecretKey"].Val<string>(),
                clientModel.OsClientModel["MinIORegion"].Val<string>());

            if (param.Limit == true)
            {
                bucketName = clientModel.OsClientModel["MinIOPrivateBucketName"].Val<string>();
            }
            else
            {
                bucketName = clientModel.OsClientModel["MinIOPublicBucketName"].Val<string>();
            }

            var fileSuffix = Path.GetExtension(param.FileFullPath).ToLower();
            var objectName = param.FileFullPath.DosTrimStart('/');
            var expectedSize = param.ContentLength
                               ?? (param.FileStream.CanSeek ? param.FileStream.Length : -1L);
            if (expectedSize < 0)
                return new DosResult(0, null, "MinIO流式上传必须提供ContentLength。");
            //很重要，否则直接访问图片路径会直接下载，而不是直接预览
            var contentType = "application/octet-stream";
            if (fileSuffix == ".pdf")
                contentType = "application/pdf";
            else if (fileSuffix == ".gif")
                contentType = "image/gif";
            else if (fileSuffix == ".png")
                contentType = "image/png";
            else if (fileSuffix == ".bmp")
                contentType = "image/bmp";
            else if (fileSuffix == ".jpg" || fileSuffix == ".jpeg")
                contentType = "image/jpeg";

            try
            {
                if (param.FileStream.CanSeek && param.FileStream.Position != 0)
                {
                    //param.FileStream.Position = 0;
                    //或者
                    param.FileStream.Seek(0, SeekOrigin.Begin);
                }
                // 上传文件。注意：objectName不能以/开头，并且objectName区分大小写
                var putObjParam = new PutObjectArgs()
                                .WithObject(objectName)
                                .WithStreamData(param.FileStream)
                                .WithObjectSize(expectedSize)
                                .WithContentType(contentType)
                                ;
                putObjParam = putObjParam.WithBucket(bucketName);
                var result = await minIOClient.PutObjectAsync(putObjParam, param.CancellationToken);
                if (result.ResponseStatusCode == HttpStatusCode.OK)
                {
                    var verification = await VerifyUploadedObjectAsync(
                        minIOClient,
                        bucketName,
                        objectName,
                        expectedSize);
                    return verification.Verified
                        ? new DosResult(1)
                        : new DosResult(0, null, "MinIO 上传后回读校验失败：" + verification.Error);
                }
                return new DosResult(0, result, result.ResponseContent);
            }
            catch (Exception ex)
            {
                // 部分反向代理会在对象已落盘后返回空或非 XML 响应，MinIO SDK
                // 因解析响应失败而抛异常。以同 Endpoint 的 StatObject 大小回读作为
                // 最终事实源，避免把已成功的后台应用资源写入误判成失败并回滚。
                var verification = await VerifyUploadedObjectAsync(
                    minIOClient,
                    bucketName,
                    objectName,
                    expectedSize);
                if (verification.Verified)
                {
                    return new DosResult(1, null, "MinIO 响应解析异常，但对象已通过回读校验。");
                }
                return new DosResult(
                    0,
                    null,
                    "MinIO Upload Error5:" + ex.Message + "；回读校验：" + verification.Error);
            }
        }

        private static async Task<(bool Verified, string Error)> VerifyUploadedObjectAsync(
            IMinioClient minioClient,
            string bucketName,
            string objectName,
            long expectedSize)
        {
            try
            {
                var stat = await minioClient.StatObjectAsync(
                    new StatObjectArgs()
                        .WithBucket(bucketName)
                        .WithObject(objectName));
                var actualSize = Convert.ToInt64(stat.Size);
                if (actualSize != expectedSize)
                {
                    return (false, $"对象大小不一致，期望{expectedSize}，实际{actualSize}。");
                }
                return (true, string.Empty);
            }
            catch (Exception verificationException)
            {
                var rangeReadback = await ReadObjectRangeAsync(
                    minioClient,
                    bucketName,
                    objectName);
                if (IsRangeReadbackVerified(
                    (int)rangeReadback.StatusCode,
                    rangeReadback.ContentLength,
                    rangeReadback.ContentRangeLength,
                    rangeReadback.BytesRead,
                    expectedSize))
                {
                    return (true, string.Empty);
                }
                return (false, BuildUploadReadbackDiagnostic(
                    verificationException,
                    bucketName,
                    objectName)
                    + "；签名 Range GET 兼容回读也未通过："
                    + rangeReadback.Error);
            }
        }

        private sealed class ObjectRangeReadback
        {
            public HttpStatusCode StatusCode { get; set; }
            public long? ContentLength { get; set; }
            public long? ContentRangeLength { get; set; }
            public int BytesRead { get; set; }
            public string Error { get; set; }
        }

        private static Task<ObjectRangeReadback> ReadObjectRangeAsync(
            IMinioClient minioClient,
            string bucketName,
            string objectName)
        {
            return ReadObjectRangeAsync(
                minioClient,
                bucketName,
                objectName,
                UploadReadbackHttpClient);
        }

        private static async Task<ObjectRangeReadback> ReadObjectRangeAsync(
            IMinioClient minioClient,
            string bucketName,
            string objectName,
            HttpClient httpClient)
        {
            try
            {
                var signedUrl = await minioClient.PresignedGetObjectAsync(
                    new PresignedGetObjectArgs()
                        .WithBucket(bucketName)
                        .WithObject(objectName)
                        .WithExpiry(60));
                using (var request = new HttpRequestMessage(HttpMethod.Get, signedUrl))
                {
                    request.Headers.Range = new RangeHeaderValue(0, 0);
                    using (var response = await httpClient.SendAsync(
                        request,
                        HttpCompletionOption.ResponseHeadersRead))
                    {
                        var bytesRead = 0;
                        if (response.StatusCode == HttpStatusCode.OK
                            || response.StatusCode == HttpStatusCode.PartialContent)
                        {
                            using (var stream = await response.Content.ReadAsStreamAsync())
                            {
                                var firstByte = new byte[1];
                                bytesRead = await stream.ReadAsync(firstByte, 0, firstByte.Length);
                            }
                        }
                        return new ObjectRangeReadback
                        {
                            StatusCode = response.StatusCode,
                            ContentLength = response.Content.Headers.ContentLength,
                            ContentRangeLength = response.Content.Headers.ContentRange?.Length,
                            BytesRead = bytesRead,
                            Error = $"HTTP {(int)response.StatusCode}，Content-Length="
                                    + (response.Content.Headers.ContentLength?.ToString() ?? "null")
                                    + "，Content-Range-Length="
                                    + (response.Content.Headers.ContentRange?.Length?.ToString() ?? "null")
                                    + $"，BytesRead={bytesRead}"
                        };
                    }
                }
            }
            catch (Exception exception)
            {
                // Never include the pre-signed URL or its query in diagnostics.
                return new ObjectRangeReadback
                {
                    StatusCode = 0,
                    Error = "签名 Range GET 回读异常（ExceptionType="
                            + exception.GetType().Name + "）"
                };
            }
        }

        private static bool IsRangeReadbackObjectPresent(
            int statusCode,
            long? contentLength,
            long? contentRangeLength,
            int bytesRead)
        {
            if (statusCode == (int)HttpStatusCode.PartialContent)
            {
                return bytesRead == 1;
            }
            if (statusCode == (int)HttpStatusCode.OK)
            {
                return bytesRead == 1 || (bytesRead == 0 && contentLength == 0);
            }
            return statusCode == (int)HttpStatusCode.RequestedRangeNotSatisfiable
                   && contentRangeLength == 0;
        }

        private static bool IsRangeReadbackVerified(
            int statusCode,
            long? contentLength,
            long? contentRangeLength,
            int bytesRead,
            long expectedSize)
        {
            if (expectedSize < 0) return false;
            if (expectedSize == 0)
            {
                return (statusCode == (int)HttpStatusCode.OK
                        && contentLength == 0
                        && bytesRead == 0)
                       || (statusCode == (int)HttpStatusCode.RequestedRangeNotSatisfiable
                           && contentRangeLength == 0);
            }
            if (statusCode == (int)HttpStatusCode.PartialContent)
            {
                return contentRangeLength == expectedSize
                       && (contentLength == null || contentLength == 1)
                       && bytesRead == 1;
            }
            return statusCode == (int)HttpStatusCode.OK
                   && contentLength == expectedSize
                   && bytesRead == 1;
        }

        private static string BuildUploadReadbackDiagnostic(
            Exception exception,
            string bucketName,
            string objectName)
        {
            var rawMessage = exception?.Message ?? "未知错误";
            if (rawMessage.IndexOf("Access denied", StringComparison.OrdinalIgnoreCase) >= 0
                || rawMessage.IndexOf("AccessDenied", StringComparison.OrdinalIgnoreCase) >= 0
                || rawMessage.IndexOf("403", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return $"对象上传请求已返回成功，但同一 MinIO 凭据执行 HEAD/Stat 回读被拒绝"
                       + $"（Bucket={bucketName}，Object={objectName}）。"
                       + "MinIO SDK 可能先执行 HEAD Bucket，请检查该凭据至少具有目标对象的 s3:GetObject，"
                       + "并按部署需要配置 s3:ListBucket / s3:GetBucketLocation；"
                       + "若权限已配置且 Endpoint 前存在 Nginx/缓存代理，请确认 HEAD 请求未被错误转换为 GET，"
                       + "必要时对该代理位置设置 proxy_cache_convert_head off。"
                       + "平台还会使用同凭据的签名 Range GET 校验对象大小并读取首字节，"
                       + "不会跳过上传后回读校验。原始错误："
                       + rawMessage;
            }

            return "对象上传请求已返回成功，但 HEAD/Stat 回读校验失败"
                   + $"（Bucket={bucketName}，Object={objectName}）。"
                   + "请检查 MinIO Endpoint、TLS、桶名、对象读取权限及反向代理配置。原始错误："
                   + rawMessage;
        }

        private IMinioClient CreateMinioClient(OsClientSecret clientModel, bool isPrivate)
        {
            var endPoint = clientModel.OsClientModel["MinIOEndPoint"].Val<string>();
            var osClientNetwork = Environment.GetEnvironmentVariable("OsClientNetwork", EnvironmentVariableTarget.Process) ?? (ConfigHelper.GetAppSettings("OsClientNetwork") ?? "");
            if (osClientNetwork == "Internet")
            {
                endPoint = clientModel.OsClientModel["MinIOEndPointInternet"].Val<string>();
            }

            return BuildMinioClient(
                endPoint,
                osClientNetwork == "Internet"
                    ? clientModel.OsClientModel["MinIOEndPointSSL"].Val<int>() == 1
                    : clientModel.OsClientModel["MinIOPrivateEndPointSSL"].Val<int>() == 1,
                clientModel.OsClientModel["MinIOAccessKey"].Val<string>(),
                clientModel.OsClientModel["MinIOSecretKey"].Val<string>(),
                clientModel.OsClientModel["MinIORegion"].Val<string>());
        }

        private string GetBucketName(OsClientSecret clientModel, bool isPrivate)
        {
            return isPrivate
                ? clientModel.OsClientModel["MinIOPrivateBucketName"].Val<string>()
                : clientModel.OsClientModel["MinIOPublicBucketName"].Val<string>();
        }

        /// <summary>
        /// 列出指定前缀下的文件和文件夹
        /// </summary>
        public async Task<DosResult> ListObjects(HDFSParam param)
        {
            try
            {
                var clientModel = param.ClientModel;
                var isPrivate = param.Limit == true;
                var minioClient = CreateMinioClient(clientModel, isPrivate);
                var bucketName = GetBucketName(clientModel, isPrivate);

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

                var listArgs = new ListObjectsArgs()
                    .WithBucket(bucketName)
                    .WithPrefix(prefix)
                    .WithRecursive(isRecursive);

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

                void AddFile(string key, long size, string lastModified)
                {
                    var fileName = key;
                    if (fileName.Contains("/"))
                    {
                        fileName = fileName.Substring(fileName.LastIndexOf('/') + 1);
                    }
                    if (!param.Keyword.DosIsNullOrWhiteSpace() && !fileName.ToLower().Contains(param.Keyword.ToLower())) return;

                    files.Add(new
                    {
                        Name = fileName,
                        FullPath = key,
                        Size = size,
                        Type = Path.GetExtension(fileName).TrimStart('.').ToLower(),
                        LastModified = lastModified,
                        IsFolder = false
                    });
                }

                await foreach (var item in minioClient.ListObjectsEnumAsync(listArgs))
                {
                    var key = item.Key;
                    if (isRecursive)
                    {
                        var isFolderObject = item.IsDir || key.EndsWith("/");
                        AddFolderHierarchy(key, isFolderObject);
                        if (!isFolderObject)
                        {
                            AddFile(key, (long)item.Size, item.LastModifiedDateTime?.ToString("yyyy-MM-dd HH:mm:ss") ?? "");
                        }
                        continue;
                    }

                    if (item.IsDir)
                    {
                        var folderPath = NormalizeFolderPath(key);
                        if (folderPath == prefix || seenPrefixes.Contains(folderPath))
                        {
                            continue;
                        }

                        var relativePath = prefix.Length > 0 && folderPath.StartsWith(prefix, StringComparison.OrdinalIgnoreCase)
                            ? folderPath.Substring(prefix.Length).TrimEnd('/')
                            : folderPath.TrimEnd('/');
                        if (relativePath.Length == 0 || relativePath.Contains("/"))
                        {
                            continue;
                        }

                        if (!seenPrefixes.Contains(folderPath))
                        {
                            seenPrefixes.Add(folderPath);
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
                    else
                    {
                        // 排除文件夹自身的空对象
                        if (key == prefix || key.EndsWith("/"))
                            continue;
                        AddFile(key, (long)item.Size, item.LastModifiedDateTime?.ToString("yyyy-MM-dd HH:mm:ss") ?? "");
                    }
                }

                return new DosResult(1, new
                {
                    Folders = folders,
                    Files = files,
                    IsTruncated = false,
                    NextMarker = ""
                });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "MinIO ListObjects Error: " + ex.Message);
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
                var isPrivate = param.Limit == true;
                var minioClient = CreateMinioClient(clientModel, isPrivate);
                var bucketName = GetBucketName(clientModel, isPrivate);

                var objectKey = param.FileFullPath.DosTrimStart('/');

                // 如果是文件夹，递归删除所有子对象
                if (objectKey.EndsWith("/"))
                {
                    var keysToDelete = new List<string>();
                    var listArgs = new ListObjectsArgs()
                        .WithBucket(bucketName)
                        .WithPrefix(objectKey)
                        .WithRecursive(true);

                    await foreach (var item in minioClient.ListObjectsEnumAsync(listArgs))
                    {
                        keysToDelete.Add(item.Key);
                    }

                    foreach (var key in keysToDelete)
                    {
                        var removeArgs = new RemoveObjectArgs()
                            .WithBucket(bucketName)
                            .WithObject(key);
                        await minioClient.RemoveObjectAsync(removeArgs);
                    }
                }
                else
                {
                    var removeArgs = new RemoveObjectArgs()
                        .WithBucket(bucketName)
                        .WithObject(objectKey);
                    await minioClient.RemoveObjectAsync(removeArgs);
                }

                return new DosResult(1);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "MinIO DeleteObject Error: " + ex.Message);
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
                var isPrivate = param.Limit == true;
                var minioClient = CreateMinioClient(clientModel, isPrivate);
                var bucketName = GetBucketName(clientModel, isPrivate);

                var folderKey = param.FileFullPath.DosTrimStart('/');
                if (!folderKey.EndsWith("/"))
                {
                    folderKey += "/";
                }

                using (var emptyStream = new MemoryStream(new byte[0]))
                {
                    var putArgs = new PutObjectArgs()
                        .WithBucket(bucketName)
                        .WithObject(folderKey)
                        .WithStreamData(emptyStream)
                        .WithObjectSize(0)
                        .WithContentType("application/octet-stream");
                    await minioClient.PutObjectAsync(putArgs);
                }

                return new DosResult(1, new { FullPath = folderKey });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "MinIO CreateFolder Error: " + ex.Message);
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
                var isPrivate = param.Limit == true;
                var minioClient = CreateMinioClient(clientModel, isPrivate);
                var bucketName = GetBucketName(clientModel, isPrivate);

                var sourceKey = param.FileFullPath.DosTrimStart('/');
                var destKey = param.DestPath.DosTrimStart('/');

                var cpSrcArgs = new CopySourceObjectArgs()
                    .WithBucket(bucketName)
                    .WithObject(sourceKey);

                var copyArgs = new CopyObjectArgs()
                    .WithBucket(bucketName)
                    .WithObject(destKey)
                    .WithCopyObjectSource(cpSrcArgs);

                await minioClient.CopyObjectAsync(copyArgs);

                return new DosResult(1);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "MinIO CopyObject Error: " + ex.Message);
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
                return new DosResult(0, null, "MinIO MoveObject Error: " + ex.Message);
            }
        }
    }
}


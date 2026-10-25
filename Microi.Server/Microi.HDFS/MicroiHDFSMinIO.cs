using System;
using System.Buffers;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading;
using System.Threading.Tasks;
using System.Xml;
using System.Xml.Linq;
using Dos.Common;
using Minio;
using Minio.DataModel.Args;
using Minio.Exceptions;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// MinIO分布式存储。
    /// 服务器上传一定是走内网EndPoint，外网调试上传一定是走外网EndPoint
    /// </summary>
	public partial class MicroiHDFSMinIO : MicroiHDFS, IMicroiHDFS
    {
        private static readonly HttpClient UploadReadbackHttpClient = CreateUploadReadbackHttpClient();
        private static readonly HttpClient ObjectReadHttpClient = new HttpClient(new HttpClientHandler
        {
            // 签名仅授权当前租户的精确对象，不得把签名查询串转发给重定向目标。
            AllowAutoRedirect = false
        }) { Timeout = Timeout.InfiniteTimeSpan };

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
            string region = null,
            HttpClient httpClient = null)
        {
            var normalized = NormalizeEndpoint(endpoint, configuredSsl);
            var builder = new MinioClient()
                .WithEndpoint(normalized.Host, normalized.Port)
                .WithCredentials(accessKey, secretKey);
            if (normalized.UseSsl) builder = builder.WithSSL();
            if (!region.DosIsNullOrWhiteSpace()) builder = builder.WithRegion(region);
            if (httpClient != null) builder = builder.WithHttpClient(httpClient);
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

                using var minioClient = BuildMinioClient(
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
                        using (var memoryStream = new MemoryStream())
                        {
                            var read = await CopySignedObjectToStreamAsync(
                                minioClient, bucketName, param.FileFullPath.TrimStart('/'),
                                memoryStream, param.TimeoutSeconds, param.CancellationToken,
                                ObjectReadHttpClient).ConfigureAwait(false);
                            result = read.Code == 1
                                ? new DosResult(1, memoryStream.ToArray())
                                : read;
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
        /// 使用当前租户凭据直接签名读取精确对象，避免 SDK 的 HEAD Bucket/Stat
        /// 预检查在对象可读但桶级检查被拒绝时阻断断点恢复与数据库 ZIP 还原。
        /// 全程有界流式传输，目标流由调用方持有；失败后不自动重试或追加第二份内容。
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
                using var client = BuildMinioClient(
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
                return await CopySignedObjectToStreamAsync(
                    client, bucketName, param.FileFullPath.DosTrimStart('/'),
                    param.FileStream, param.TimeoutSeconds, param.CancellationToken,
                    ObjectReadHttpClient).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                return new DosResult(0, null, "HDFS流式读取已取消。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "MinIO Stream Read Error:初始化读取失败（ExceptionType="
                    + ex.GetType().Name + "）。");
            }
        }

        /// <summary>
        /// 签名 URL 只在服务端内存中使用；HTTP 状态和完整长度校验通过才返回成功。
        /// 不依赖流的 Length/Position，支持哈希流、限额流与大文件，不缓冲整个对象。
        /// MinIO 与 Amazon S3 共用此协议边界，避免 SDK 丢弃错误码后把普通 404 误判为空对象。
        /// </summary>
        internal static async Task<DosResult> CopySignedObjectToStreamAsync(
            IMinioClient client,
            string bucketName,
            string objectName,
            Stream destination,
            int? timeoutSeconds,
            CancellationToken cancellationToken,
            HttpClient httpClient = null)
        {
            var seconds = timeoutSeconds.GetValueOrDefault() > 0 ? timeoutSeconds.Value : 600;
            try
            {
                httpClient = httpClient ?? ObjectReadHttpClient;
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                timeout.CancelAfter(TimeSpan.FromSeconds(seconds));
                timeout.Token.ThrowIfCancellationRequested();
                var signedUrl = await client.PresignedGetObjectAsync(new PresignedGetObjectArgs()
                    .WithBucket(bucketName).WithObject(objectName).WithExpiry(60)).ConfigureAwait(false);
                using var request = new HttpRequestMessage(HttpMethod.Get, signedUrl);
                using var response = await httpClient.SendAsync(
                    request, HttpCompletionOption.ResponseHeadersRead, timeout.Token).ConfigureAwait(false);

                // 不把错误 XML、重定向或非预期的部分响应写入会话/ZIP 目标流。
                if (response.StatusCode != HttpStatusCode.OK)
                {
                    // CDN 首次投影以明确的 NoSuchKey 决定是否补写；普通代理 404、缺桶和权限
                    // 错误不能获得此语义。只解析有界 S3 错误，不回显正文或临时签名凭据。
                    var missingKey = response.StatusCode == HttpStatusCode.NotFound
                        && await IsSignedObjectMissingAsync(response.Content, bucketName, objectName,
                            timeout.Token).ConfigureAwait(false);
                    return new DosResult(0, null, $"S3对象流读取失败：对象读取返回 HTTP {(int)response.StatusCode}"
                        + (missingKey ? "（NoSuchKey）" : "")
                        + "。请检查对象读取权限与存储代理。")
                    {
                        // 对象路径与桶名可以包含任意业务词；机器判定只使用本原子验证后的语义，
                        // 不扫描 Msg，避免 assets/nosuchkey.js 等合法路径获得补写权限。
                        DataAppend = missingKey
                            ? new { StorageReadErrorCode = "NoSuchKey", StorageReadHttpStatusCode = 404 }
                            : null
                    };
                }

                var expectedLength = response.Content.Headers.ContentLength;
                using var source = await response.Content.ReadAsStreamAsync().ConfigureAwait(false);
                var buffer = ArrayPool<byte>.Shared.Rent(128 * 1024);
                long bytesRead = 0;
                try
                {
                    int count;
                    while ((count = await source.ReadAsync(buffer, 0, 128 * 1024, timeout.Token)
                        .ConfigureAwait(false)) > 0)
                    {
                        bytesRead = checked(bytesRead + count);
                        if (expectedLength.HasValue && bytesRead > expectedLength.Value)
                            return new DosResult(0, null, "MinIO Stream Read Error:对象实际字节数超过响应声明长度。");
                        await destination.WriteAsync(buffer, 0, count, timeout.Token).ConfigureAwait(false);
                    }
                }
                finally
                {
                    ArrayPool<byte>.Shared.Return(buffer, clearArray: true);
                }

                timeout.Token.ThrowIfCancellationRequested();
                if (expectedLength.HasValue && bytesRead != expectedLength.Value)
                    return new DosResult(0, null, $"MinIO Stream Read Error:对象读取不完整，期望 {expectedLength.Value} 字节，实际 {bytesRead} 字节。");
                return new DosResult(1, new
                {
                    Size = bytesRead,
                    ETag = response.Headers.ETag?.Tag?.Trim('"')
                });
            }
            catch (OperationCanceledException)
            {
                return new DosResult(0, null, cancellationToken.IsCancellationRequested
                    ? "HDFS流式读取已取消。"
                    : $"HDFS流式读取超时（{seconds}秒）。");
            }
            catch (Exception ex)
            {
                // 网络与 SDK 异常可能带完整签名 URL，诊断只记录类型，禁止回显临时凭据。
                return new DosResult(0, null, "MinIO Stream Read Error:对象流式读取失败（ExceptionType="
                    + ex.GetType().Name + "）。");
            }
        }

        /// <summary>
        /// 只归一化当前精确对象的 S3 NoSuchKey；限制错误正文大小、禁止 DTD/外部实体，
        /// 并保留取消、超时和截断读取的失败语义，不把不明 404 当作可覆盖的空对象。
        /// </summary>
        private static async Task<bool> IsSignedObjectMissingAsync(
            HttpContent content, string bucketName, string objectName, CancellationToken token)
        {
            const int maxErrorBytes = 8 * 1024;
            var declaredLength = content.Headers.ContentLength;
            if (declaredLength.HasValue && (declaredLength.Value <= 0 || declaredLength.Value > maxErrorBytes))
                return false;

            using var source = await content.ReadAsStreamAsync().ConfigureAwait(false);
            // 多读一个字节用于识别未声明长度的超限正文；内存和网络读取均有固定上限。
            var bytes = new byte[maxErrorBytes + 1];
            var length = 0;
            while (length < bytes.Length)
            {
                var read = await source.ReadAsync(bytes, length, bytes.Length - length, token).ConfigureAwait(false);
                if (read == 0) break;
                length += read;
            }
            token.ThrowIfCancellationRequested();
            if (length == 0 || length > maxErrorBytes || (declaredLength.HasValue && length != declaredLength.Value))
                return false;

            try
            {
                using var buffer = new MemoryStream(bytes, 0, length, writable: false);
                using var reader = XmlReader.Create(buffer, new XmlReaderSettings
                {
                    DtdProcessing = DtdProcessing.Prohibit,
                    XmlResolver = null,
                    MaxCharactersInDocument = maxErrorBytes
                });
                var root = XDocument.Load(reader).Root;
                if (root == null || root.Name.LocalName != "Error"
                    || (root.Name.NamespaceName != "" && root.Name.NamespaceName != "http://s3.amazonaws.com/doc/2006-03-01/"))
                    return false;
                var codes = root.Elements().Where(element => element.Name.LocalName == "Code").ToArray();
                if (codes.Length != 1 || codes[0].Name.Namespace != root.Name.Namespace
                    || codes[0].HasElements || codes[0].Value != "NoSuchKey")
                    return false;
                // S3 可省略 Key/BucketName；存在时必须唯一且与本次签名请求完全一致。
                foreach (var identity in new[] { new { Name = "Key", Value = objectName }, new { Name = "BucketName", Value = bucketName } })
                {
                    var fields = root.Elements().Where(element => element.Name.LocalName == identity.Name).ToArray();
                    if (fields.Length > 1 || (fields.Length == 1
                        && (fields[0].Name.Namespace != root.Name.Namespace || fields[0].HasElements || fields[0].Value != identity.Value)))
                        return false;
                }
                return true;
            }
            catch (XmlException)
            {
                return false;
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

            var objectName = param.FileFullPath.DosTrimStart('/');
            var expectedSize = param.ContentLength
                               ?? (param.FileStream.CanSeek ? param.FileStream.Length : -1L);
            if (expectedSize < 0)
                return new DosResult(0, null, "MinIO流式上传必须提供ContentLength。");
            // 网页产物与图片共用同一映射，公有/私有桶都不能把脚本样式标成二进制。
            var contentType = ObjectStorageContentTypes.GetContentType(param.FileFullPath);

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

        private IMinioClient CreateMinioClient(OsClientSecret clientModel, bool isPrivate, HttpClient httpClient = null)
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
                clientModel.OsClientModel["MinIORegion"].Val<string>(), httpClient);
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
            if (param?.EmptyDirectoryOnly == true && (param.ClientModel == null || !param.Limit.HasValue))
                return new DosResult(0, null, "空目录标记删除缺少可信租户或明确桶选择。");
            try
            {
                var clientModel = param.ClientModel;
                var isPrivate = param.Limit == true;
                var minioClient = CreateMinioClient(clientModel, isPrivate);
                var bucketName = GetBucketName(clientModel, isPrivate);
                if (param.EmptyDirectoryOnly == true)
                    return await EmptyDirectoryMarkerDeletion.DeleteMinioCompatibleAsync(param, minioClient, bucketName).ConfigureAwait(false);

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
                if (param?.EmptyDirectoryOnly == true)
                    return new DosResult(0, new { OutcomeUnknown = false, Stage = "ResolveProvider" }, "空目录标记存储配置暂不可核验。");
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
        private static HttpClient CreateCopyHttpClient(HttpMessageHandler transport)
        {
            return new HttpClient(new MinioCopyContentTypeHandler(transport))
            {
                Timeout = Timeout.InfiniteTimeSpan
            };
        }

        /// <summary>
        /// SDK 7 在复制前额外 HEAD 整个桶；前缀受限账号可能能读写对象却无桶级权限。
        /// 兼容路径仍由同一 SDK/租户凭据签名精确源对象和目标对象，不申请桶列表权限。
        /// S3 默认 COPY 保留原 MIME/元数据；HTTP 200 内嵌 Error 也必须作为失败处理。
        /// </summary>
        private static async Task<DosResult> CopySignedObjectAsync(
            IMinioClient client, string bucketName, string sourceKey, string destKey,
            HttpClient httpClient, CancellationToken token)
        {
            token.ThrowIfCancellationRequested();
            var sourceHeader = "/" + bucketName + "/"
                + string.Join("/", sourceKey.Split('/').Select(Uri.EscapeDataString));
            var signedUrl = await client.PresignedPutObjectAsync(new PresignedPutObjectArgs()
                .WithBucket(bucketName).WithObject(destKey).WithExpiry(60)
                .WithHeaders(new Dictionary<string, string> { ["x-amz-copy-source"] = sourceHeader }))
                .ConfigureAwait(false);
            // SDK 7 将附加头放入已签名查询串；两种签名形式都必须绑定同一个源路径。
            var query = new Uri(signedUrl).Query.TrimStart('?').Split('&');
            var signedHeaders = query.FirstOrDefault(value =>
                value.StartsWith("X-Amz-SignedHeaders=", StringComparison.OrdinalIgnoreCase));
            var signedSource = query.FirstOrDefault(value =>
                value.StartsWith("x-amz-copy-source=", StringComparison.OrdinalIgnoreCase));
            var sourceInHeaders = signedHeaders != null && Uri.UnescapeDataString(signedHeaders.Split('=')[1])
                .Split(';').Contains("x-amz-copy-source");
            var sourceInQuery = signedSource != null
                && Uri.UnescapeDataString(signedSource.Substring(signedSource.IndexOf('=') + 1)) == sourceHeader;
            if (!sourceInHeaders && !sourceInQuery)
                return new DosResult(0, null, "MinIO 精确对象复制缺少已签名源路径，已停止发送。");

            using var request = new HttpRequestMessage(HttpMethod.Put, signedUrl);
            request.Headers.TryAddWithoutValidation("x-amz-copy-source", sourceHeader);
            request.Content = new ByteArrayContent(Array.Empty<byte>());
            using var response = await httpClient.SendAsync(request,
                HttpCompletionOption.ResponseHeadersRead, token).ConfigureAwait(false);
            if (response.StatusCode != HttpStatusCode.OK)
                return new DosResult(0, null, $"MinIO 精确对象复制返回 HTTP {(int)response.StatusCode}，请检查源对象读取及目标对象写入权限。");
            using var stream = await response.Content.ReadAsStreamAsync().ConfigureAwait(false);
            // 有界读取成功回执，禁止把错误页或签名地址回显到客户端。
            using var body = new MemoryStream();
            var buffer = new byte[4096];
            int count;
            while ((count = await stream.ReadAsync(buffer, 0, buffer.Length, token).ConfigureAwait(false)) > 0)
            {
                if (body.Length + count > 65536)
                    return new DosResult(0, null, "MinIO 精确对象复制回执超过限制，结果待回读。");
                body.Write(buffer, 0, count);
            }
            body.Position = 0;
            using var reader = XmlReader.Create(body, new XmlReaderSettings
            { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 65536 });
            var document = XDocument.Load(reader);
            if (document.Root?.Name.LocalName != "CopyObjectResult"
                || !document.Root.Elements().Any(element => element.Name.LocalName == "ETag"
                    && !string.IsNullOrWhiteSpace(element.Value)))
                return new DosResult(0, null, "MinIO 精确对象复制未返回成功回执，结果待回读。");
            return new DosResult(1);
        }

        /// <summary>在同一租户桶内由存储服务复制对象，保留原 MIME 和源对象。</summary>
        public async Task<DosResult> CopyObject(HDFSParam param)
        {
            try
            {
                var clientModel = param.ClientModel;
                var isPrivate = param.Limit == true;
                // 复制请求的签名和服务端元数据仍由 SDK/S3 处理；这里只修复 SDK 7
                // 将带参数 MIME 额外追加到 StringContent 默认 MIME 的传输错误。
                using var httpClient = CreateCopyHttpClient(new HttpClientHandler { AllowAutoRedirect = false });
                using var minioClient = CreateMinioClient(clientModel, isPrivate, httpClient);
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(param.CancellationToken);
                timeout.CancelAfter(TimeSpan.FromSeconds(param.TimeoutSeconds.GetValueOrDefault() > 0 ? param.TimeoutSeconds.Value : 600));
                timeout.Token.ThrowIfCancellationRequested();
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

                try
                {
                    await minioClient.CopyObjectAsync(copyArgs, timeout.Token).ConfigureAwait(false);
                }
                catch (AccessDeniedException)
                {
                    // 不改变任何凭据或策略；让对象存储对精确 COPY 独立执行原有鉴权。
                    // 这也兼容只允许对象读写、禁止 SDK 桶预检查的反向代理。
                    return await CopySignedObjectAsync(minioClient, bucketName, sourceKey, destKey,
                        ObjectReadHttpClient, timeout.Token).ConfigureAwait(false);
                }

                return new DosResult(1);
            }
            catch (OperationCanceledException)
            {
                // 响应前取消不能证明对象未写入；由原请求键读回，禁止隐式重试复制。
                return new DosResult(0, null, "MinIO 文件复制已取消或超时，结果可能已写入，请沿用原请求键回读。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "MinIO CopyObject Error: " + ex.GetType().Name
                    + "，复制未确认成功，请沿用原请求键回读。");
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

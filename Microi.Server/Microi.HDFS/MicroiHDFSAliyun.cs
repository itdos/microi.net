using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
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
                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "OSS日志",
                    Title = "OSS判断文件是否存在失败",
                    Content = $"FileFullPath: {param.FileFullPath}, Limit: {param.Limit}, Error: {ex.Message}, InnerException: {ex.InnerException?.Message}",
                    OsClient = param.ClientModel?.OsClient
                });
                return new DosResult<bool>(0, false, ex.Message);
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
            if (clientModel.OsClientModel["AliOssPrivateBucketName"].Val<string>().DosIsNullOrWhiteSpace()
                    || clientModel.OsClientModel["AliOssPrivateEndpoint"].Val<string>().DosIsNullOrWhiteSpace()
                    || clientModel.OsClientModel["AliOssPrivateAccessKeyId"].Val<string>().DosIsNullOrWhiteSpace()
                    || clientModel.OsClientModel["AliOssPrivateAccessKeySecret"].Val<string>().DosIsNullOrWhiteSpace()

                    || clientModel.OsClientModel["AliOssPublicBucketName"].Val<string>().DosIsNullOrWhiteSpace()
                    || clientModel.OsClientModel["AliOssPublicEndpoint"].Val<string>().DosIsNullOrWhiteSpace()
                    || clientModel.OsClientModel["AliOssPublicAccessKeyId"].Val<string>().DosIsNullOrWhiteSpace()
                    || clientModel.OsClientModel["AliOssPublicAccessKeySecret"].Val<string>().DosIsNullOrWhiteSpace()
                    )
            {
                return new DosResult(0, null, "阿里云oss分布式存储配置不完整！");
            }
            var bucketName = "";
            var bucketNamePrivate = "";
            OssClient ossClientPrivate = null;
            OssClient ossClient = null;

            // 创建配置对象，使用合理的超时时间
            var configPrivate = new ClientConfiguration
            {
                ConnectionTimeout = 60000, // 60秒超时
                MaxErrorRetry = 3,
                EnableCrcCheck = false // 禁用CRC校验，可能影响某些上传
            };
            var configPublic = new ClientConfiguration
            {
                ConnectionTimeout = 60000,
                MaxErrorRetry = 3,
                EnableCrcCheck = false
            };

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


                return new DosResult(0, null, "Aliyun Oss Upload Error:" + ex.Message);
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

                var prefix = (param.Prefix ?? "").TrimStart('/');
                var delimiter = param.Delimiter ?? "/";

                var listRequest = new ListObjectsRequest(bucketName)
                {
                    Prefix = prefix,
                    Delimiter = delimiter,
                    MaxKeys = param.MaxKeys > 0 ? param.MaxKeys : 1000
                };
                if (!param.Marker.DosIsNullOrWhiteSpace())
                {
                    listRequest.Marker = param.Marker;
                }

                var listing = ossClient.ListObjects(listRequest);

                var folders = new List<object>();
                var files = new List<object>();

                // 公共前缀 = 子文件夹
                if (listing.CommonPrefixes != null)
                {
                    foreach (var commonPrefix in listing.CommonPrefixes)
                    {
                        var folderName = commonPrefix.TrimEnd('/');
                        if (folderName.Contains("/"))
                        {
                            folderName = folderName.Substring(folderName.LastIndexOf('/') + 1);
                        }
                        folders.Add(new
                        {
                            Name = folderName,
                            FullPath = commonPrefix,
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
                        if (obj.Key == prefix || obj.Key.EndsWith("/"))
                            continue;

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


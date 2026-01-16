using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
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
                var endPoint = clientModel.OsClientModel["MinIOEndPointInternet"].Val<string>().DosIsNullOrWhiteSpace(clientModel.OsClientModel["MinIOEndPoint"].Val<string>());

                var minioClient = new MinioClient()
                                    .WithEndpoint(endPoint)
                                    .WithCredentials(clientModel.OsClientModel["MinIOAccessKey"].Val<string>(), clientModel.OsClientModel["MinIOSecretKey"].Val<string>());

                //只有GetPrivateFileUrl才需要用到这个判断。
                //--2024-03-29补充，不仅是GetPrivateFileUrl才用到MinIOEndPointSSL判断
                if (!clientModel.OsClientModel["MinIOEndPointInternet"].Val<string>().DosIsNullOrWhiteSpace())
                {
                    if (clientModel.OsClientModel["MinIOEndPointSSL"].Val<int>() == 1)
                    {
                        minioClient = minioClient.WithSSL();
                    }
                }
                else
                {
                    if (clientModel.OsClientModel["MinIOPrivateEndPointSSL"].Val<int>() == 1)
                    {
                        minioClient = minioClient.WithSSL();
                    }
                }

                if (!clientModel.OsClientModel["MinIORegion"].Val<string>().DosIsNullOrWhiteSpace())
                {
                    minioClient.WithRegion(clientModel.OsClientModel["MinIORegion"].Val<string>());//"ap-southeast-1"
                }
                minioClient = minioClient.Build();

                //如果是单文件
                if (!param.FileFullPath.DosIsNullOrWhiteSpace())
                {
                    //如果是返回byte[]
                    if (param.ReturnFileType == "Byte")
                    {
                        GetObjectArgs getArgs = new GetObjectArgs()
                                               .WithBucket(clientModel.OsClientModel["MinIOPrivateBucketName"].Val<string>());
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
                                                .WithBucket(clientModel.OsClientModel["MinIOPrivateBucketName"].Val<string>())
                                                .WithExpiry(60 * 30);//30分钟，后期建议动态配置
                        args = args.WithObject(param.FileFullPath.TrimStart('/'));
                        var url = await minioClient.PresignedGetObjectAsync(args);
                        result = new DosResult(1, url);
                    }

                }
                else //如果是多文件
                {
                    PresignedGetObjectArgs args = new PresignedGetObjectArgs()
                                                .WithBucket(clientModel.OsClientModel["MinIOPrivateBucketName"].Val<string>())
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

            minIOClient = new MinioClient()
                                .WithEndpoint(endPoint)
                                .WithCredentials(clientModel.OsClientModel["MinIOAccessKey"].Val<string>(), clientModel.OsClientModel["MinIOSecretKey"].Val<string>());

            //只有GetPrivateFileUrl才需要用到这个判断
            //if (clientModel.MinIOEndPointSSL == 1)
            if (param.NetworkIsInternet == true)
            {
                if (clientModel.OsClientModel["MinIOEndPointSSL"].Val<int>() == 1)
                {
                    minIOClient = minIOClient.WithSSL();
                }
            }
            else
            {
                if (clientModel.OsClientModel["MinIOPrivateEndPointSSL"].Val<int>() == 1)
                {
                    minIOClient = minIOClient.WithSSL();
                }
            }

            minIOClient = minIOClient.Build();
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


                objectExist = false;
            }
            return new DosResult<bool>(1, objectExist);
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

            minIOClient = new MinioClient()
                                .WithEndpoint(endPoint)
                                .WithCredentials(clientModel.OsClientModel["MinIOAccessKey"].Val<string>(), clientModel.OsClientModel["MinIOSecretKey"].Val<string>());

            //只有GetPrivateFileUrl才需要用到这个判断
            //2024-03-29有些客户的【MinIOPrivateEndPoint】也是https，因此这里其实是可能需要WithSSL【MinIOPrivateEndPointSSL】
            //if (clientModel.MinIOEndPointSSL == 1)
            if (param.NetworkIsInternet == true)
            {
                if (clientModel.OsClientModel["MinIOEndPointSSL"].Val<int>() == 1)
                {
                    minIOClient = minIOClient.WithSSL();
                }
            }
            else
            {
                if (clientModel.OsClientModel["MinIOPrivateEndPointSSL"].Val<int>() == 1)
                {
                    minIOClient = minIOClient.WithSSL();
                }
            }

            minIOClient = minIOClient.Build();

            if (param.Limit == true)
            {
                bucketName = clientModel.OsClientModel["MinIOPrivateBucketName"].Val<string>();
            }
            else
            {
                bucketName = clientModel.OsClientModel["MinIOPublicBucketName"].Val<string>();
            }

            var fileSuffix = Path.GetExtension(param.FileFullPath).ToLower();
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
                if (param.FileStream.Position != 0)
                {
                    //param.FileStream.Position = 0;
                    //或者
                    param.FileStream.Seek(0, SeekOrigin.Begin);
                }
                // 上传文件。注意：objectName不能以/开头，并且objectName区分大小写
                var putObjParam = new PutObjectArgs()
                                .WithObject(param.FileFullPath.DosTrimStart('/'))
                                .WithStreamData(param.FileStream)
                                .WithObjectSize(param.FileStream.Length)
                                .WithContentType(contentType)
                                ;
                if (!clientModel.OsClientModel["MinIORegion"].Val<string>().DosIsNullOrWhiteSpace())
                {
                    minIOClient.WithRegion(clientModel.OsClientModel["MinIORegion"].Val<string>());//"ap-southeast-1"
                }
                else
                {
                    putObjParam = putObjParam.WithBucket(bucketName);
                }
                var result = await minIOClient.PutObjectAsync(putObjParam);
                if (result.ResponseStatusCode == HttpStatusCode.OK)
                {
                    return new DosResult(1);
                }
                return new DosResult(0, result, result.ResponseContent);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "MinIO Upload Error5:" + ex.Message);
            }
        }
    }
}


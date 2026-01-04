using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using Aliyun.OSS;
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
                    bucketName = clientModel.AliOssPrivateBucketName;
                    ossClient = new OssClient(clientModel.AliOssPrivateEndpoint,
                                        clientModel.AliOssPrivateAccessKeyId,
                                        clientModel.AliOssPrivateAccessKeySecret);
                    var objectExist = ossClient.DoesObjectExist(bucketName, param.FileFullPath.DosTrimStart('/'));
                    return new DosResult<bool>(1, objectExist);
                }
                else//如果是判断公有OSS
                {
                    bucketName = clientModel.AliOssPublicBucketName;
                    ossClient = new OssClient(clientModel.AliOssPublicEndpoint,
                                        clientModel.AliOssPublicAccessKeyId,
                                        clientModel.AliOssPublicAccessKeySecret);
                    var objectExist = ossClient.DoesObjectExist(bucketName, param.FileFullPath.DosTrimStart('/'));
                    //注意：当不公有OSS不存在文件时，同样也要判断私有OSS是否存在，因为原图是在私有oss存储，并不不存存公有OSS。
                    if (!objectExist)
                    {
                        bucketName = clientModel.AliOssPrivateBucketName;
                        ossClient = null;
                        ossClient = new OssClient(clientModel.AliOssPrivateEndpoint,
                                            clientModel.AliOssPrivateAccessKeyId,
                                            clientModel.AliOssPrivateAccessKeySecret);
                        objectExist = ossClient.DoesObjectExist(bucketName, param.FileFullPath.DosTrimStart('/'));
                    }
                    return new DosResult<bool>(1, objectExist);
                }
            }
            catch (Exception ex)
            {
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
            if (clientModel.AliOssPrivateBucketName.DosIsNullOrWhiteSpace()
                    || clientModel.AliOssPrivateEndpoint.DosIsNullOrWhiteSpace()
                    || clientModel.AliOssPrivateAccessKeyId.DosIsNullOrWhiteSpace()
                    || clientModel.AliOssPrivateAccessKeySecret.DosIsNullOrWhiteSpace()

                    || clientModel.AliOssPublicBucketName.DosIsNullOrWhiteSpace()
                    || clientModel.AliOssPublicEndpoint.DosIsNullOrWhiteSpace()
                    || clientModel.AliOssPublicAccessKeyId.DosIsNullOrWhiteSpace()
                    || clientModel.AliOssPublicAccessKeySecret.DosIsNullOrWhiteSpace()
                    )
            {
                return new DosResult(0, null, "阿里云oss分布式存储配置不完整！");
            }
            var bucketName = "";
            var bucketNamePrivate = "";
            OssClient ossClientPrivate = null;
            OssClient ossClient = null;

            bucketNamePrivate = clientModel.AliOssPrivateBucketName;
            //这里无需再判断是走内网、还是走外网，因为clientModel.AliOssPrivateEndpoint已经是根据OsClientNetwork=Internet/Internal存储的内网或外网地址
            ossClientPrivate = new OssClient(clientModel.AliOssPrivateEndpoint,
                                clientModel.AliOssPrivateAccessKeyId,
                                clientModel.AliOssPrivateAccessKeySecret);
            bucketName = clientModel.AliOssPublicBucketName;
            ossClient = new OssClient(clientModel.AliOssPublicEndpoint,
                                clientModel.AliOssPublicAccessKeyId,
                                clientModel.AliOssPublicAccessKeySecret);
            try
            {
                if (param.Preview == true && !param.FileFullPathOrigin.DosIsNullOrWhiteSpace())
                {
                    //ConfigHelper.GetAppSettings("AliOssImgProcess")
                    var process = string.Format(clientModel.AliOssImgProcess, 780);
                    //注意：这里要传入压缩前的图片路径，因为此时压缩后的图片还未上传
                    //2023-09-02：注意压缩前的文件是放在私有的，因此使用ossClientPrivate
                    var ossObject = ossClientPrivate.GetObject(new GetObjectRequest(bucketNamePrivate, param.FileFullPathOrigin.TrimStart('/'), process));
                    //上传
                    if (param.Limit == true)
                    {
                        var ossResult = ossClientPrivate.PutObject(bucketNamePrivate, param.FileFullPath.TrimStart('/'), ossObject.ResponseStream);
                        return new DosResult(1, ossResult);
                    }
                    else
                    {
                        var ossResult = ossClient.PutObject(bucketName, param.FileFullPath.TrimStart('/'), ossObject.ResponseStream);
                        return new DosResult(1, ossResult);
                    }
                }
                else//如果不压缩
                {
                    // 上传文件。
                    if (param.Limit == true)
                    {
                        var ossResult = ossClientPrivate.PutObject(bucketNamePrivate, param.FileFullPath.DosTrimStart('/'), param.FileStream);
                        //ossResult.HttpStatusCode.ToString() == "OK"表示成功。
                        return new DosResult(1, ossResult);
                    }
                    else {
                        var ossResult = ossClient.PutObject(bucketName, param.FileFullPath.DosTrimStart('/'), param.FileStream);
                        //ossResult.HttpStatusCode.ToString() == "OK"表示成功。
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
                return new DosResult(0, null , DiyMessage.GetLang(clientModel.OsClient, "ParamError", param._Lang));
            }

            var bucketName = clientModel.AliOssPrivateBucketName;

            OssClient ossClient = new OssClient(clientModel.AliOssPrivateEndpoint,
                                clientModel.AliOssPrivateAccessKeyId,
                                clientModel.AliOssPrivateAccessKeySecret);

            try
            {
                if (!param.FileFullPath.DosIsNullOrWhiteSpace())
                {
                    //如果是返回byte[]
                    if (param.ReturnFileType == "Byte")
                    {
                        var ossObject = ossClient.GetObject(new GetObjectRequest(bucketName, param.FileFullPath.TrimStart('/')));
                        using (MemoryStream memStream = new MemoryStream())
                        {
                            ossObject.ResponseStream.CopyTo(memStream);
                            memStream.Seek(0, SeekOrigin.Begin);
                            return new DosResult(1, StreamHelper.StreamToBytes(memStream));
                        }
                    }
                    else//如果是返回Url
                    {
                        // 生成签名URL。
                        var req = new GeneratePresignedUriRequest(bucketName, param.FileFullPath.DosTrimStart('/'), SignHttpMethod.Get);
                        var uri = ossClient.GeneratePresignedUri(req);
                        //当OsClientNetwork=Internal时，使用的是局域网的oss地址AliOssPrivateEndpoint，返回的也是局域网临时url，因此要做替换。应该还有更好的解决方案，暂时不研究了。
                        //2024-07-24:支持https绑定域名访问私有桶
                        //var url = uri.AbsoluteUri.Replace("-internal.aliyuncs.com", ".aliyuncs.com");
                        var url = clientModel.AliOssPrivateDomain + uri.PathAndQuery;
                        return new DosResult(1, url);
                    }
                }
                else
                {
                    var listResult = new List<string>();
                    foreach (var fileFullPath in param.FileFullPaths)
                    {
                        // 生成签名URL。
                        var req = new GeneratePresignedUriRequest(bucketName, fileFullPath.DosTrimStart('/'), SignHttpMethod.Get);
                        var uri = ossClient.GeneratePresignedUri(req);
                        //当OsClientNetwork=Internal时，使用的是局域网的oss地址AliOssPrivateEndpoint，返回的也是局域网临时url，因此要做替换。应该还有更好的解决方案，暂时不研究了。
                        //2024-07-24:支持https绑定域名访问私有桶
                        //var url = uri.AbsoluteUri.Replace("-internal.aliyuncs.com", ".aliyuncs.com");
                        var url = clientModel.AliOssPrivateDomain + uri.PathAndQuery;
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
    }
}


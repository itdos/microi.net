using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Web;
using Dos.Common;
using Microi.net;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

#if NETSTANDARD || NETCOREAPP
using Microsoft.AspNetCore.Http;
using Aliyun.OSS;
#else
#endif

namespace Microi.net.Api
{
    /// <summary>
    /// UploadHandler 的摘要说明
    /// </summary>
    public class UploadHandler : Handler
    {
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public UploadConfig UploadConfig { get; private set; }
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public UploadResult Result { get; private set; }

        /// <summary>
        /// 
        /// </summary>
        public UploadHandler(HttpContext context, UploadConfig config)
            : base(context)
        {
            this.UploadConfig = config;
            this.Result = new UploadResult() { State = UploadState.Unknown };
        }
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        public async override Task<UEditorResult> Process()
        {
            byte[]? uploadFileBytes = null;
            string? uploadFileName = null;

            if (UploadConfig.Base64)
            {
                uploadFileName = UploadConfig.Base64Filename;
                uploadFileBytes = Convert.FromBase64String(Request.Form[UploadConfig.UploadFieldName]);
            }
            else
            {
#if NETSTANDARD || NETCOREAPP
                var file = Request.Form.Files[UploadConfig.UploadFieldName];
                if (file == null)
                {
                    file = Request.Form.Files[0];
                }
#else
                var file = Request.Files[UploadConfig.UploadFieldName];
                 if (file == null)
                {
                    file = Request.Files[0];
                }
#endif
                uploadFileName = file.FileName;

                if (!CheckFileType(uploadFileName))
                {
                    Result.State = UploadState.TypeNotAllow;
                    return WriteResult();
                }
#if NETSTANDARD || NETCOREAPP
                if (!CheckFileSize(file.Length))
#else
                if (!CheckFileSize(file.ContentLength))
#endif

                {
                    Result.State = UploadState.SizeLimitExceed;
                    return WriteResult();

                }
#if NETSTANDARD || NETCOREAPP
                uploadFileBytes = new byte[file.Length];
                try
                {
                    file.OpenReadStream().ReadExactly(uploadFileBytes, 0, (int)file.Length);
                }
#else
                uploadFileBytes = new byte[file.ContentLength];
                try
                {
                    file.InputStream.Read(uploadFileBytes, 0, file.ContentLength);
                }
#endif

                catch (Exception)
                {
                    Result.State = UploadState.NetworkError;
                    WriteResult();
                }
            }

            Result.OriginFileName = uploadFileName;

            var savePathYasuo = PathFormatter.Format(uploadFileName, UploadConfig.PathFormat).ToLower();
            //当默认压缩
            //注意：只压缩jpg、jpeg、bmp、png等格式，gif那些不压缩。
            var isCanPreview = false;
            var fileSuffix = Path.GetExtension(savePathYasuo).ToLower();
            if (fileSuffix == ".jpg"
                || fileSuffix == ".jpeg"
                || fileSuffix == ".png"
                || fileSuffix == ".bmp"
                )
            {
                isCanPreview = true;
            }
            var savePathOrigin = (savePathYasuo.Replace(Path.GetFileName(savePathYasuo),
                                            Path.GetFileNameWithoutExtension(savePathYasuo) + "_origin")
                            + Path.GetExtension(savePathYasuo)).ToLower();
            if (!isCanPreview)
            {
                savePathOrigin = savePathYasuo;
            }
            var localPath = Path.Combine(UeditorConfig.WebRootPath, savePathOrigin).ToLower();
            var localPathYasuo = Path.Combine(UeditorConfig.WebRootPath, savePathYasuo).ToLower();
            //#if NETSTANDARD || NETCOREAPP
            //            #region 初始化OSS参数
            //            //var useAliOss = ConfigHelper.GetAppSettings("UseAliOssPublic") == "1";//Microi.net.DiyToken.GetCurrentOsClient()
            //            var clientModel = OsClient.GetClient();
            //            var useAliOss = clientModel.UseAliOssPublic == "1";

            //            var endpoint = "";
            //            var accessKeyId = "";
            //            var accessKeySecret = "";
            //            var bucketName = "";
            //            OssClient ossClient = null;
            //            #endregion
            //#else
            //            var useAliOss = false;
            //#endif
            UEditorResult result;
            var uploadResult = new DosResult();
            try
            {
                //2023-08-18
                var param = new DiyUploadParam()
                {
                    Limit = false,
                    Preview = false,
                    Multiple = false,
                    Path = savePathOrigin.TrimStart('/')
                };
                var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
                if (currentTokenDynamic != null)
                {
                    param.OsClient = currentTokenDynamic.OsClient;
                }

                param.Files = new Dictionary<string, Stream>();
                param.Files.Add(uploadFileName, StreamHelper.BytesToStream(uploadFileBytes));

                //uploadResult = await DiyCommon.Upload(param);
                uploadResult = await MicroiEngine.HDFS.Upload(param);


                //if (useAliOss)
                {
#if NETSTANDARD || NETCOREAPP
                    //#region OSS 参数初始化
                    //var limit = "Public";
                    //endpoint = clientModel.AliOssPublicEndpoint;//ConfigHelper.GetAppSettings("AliOss" + limit + "Endpoint");
                    //accessKeyId = clientModel.AliOssPublicAccessKeyId;//ConfigHelper.GetAppSettings("AliOss" + limit + "AccessKeyId");
                    //accessKeySecret = clientModel.AliOssPublicAccessKeySecret;//ConfigHelper.GetAppSettings("AliOss" + limit + "AccessKeySecret");
                    //bucketName = clientModel.AliOssPublicBucketName;//ConfigHelper.GetAppSettings("AliOss" + limit + "BucketName");
                    //// 创建OssClient实例。
                    //ossClient = new OssClient(endpoint, accessKeyId, accessKeySecret);
                    //#endregion
                    //#region OSS上传

                    //try
                    //{
                    //    // 上传文件。
                    //    var ossResult = ossClient.PutObject(bucketName, savePathOrigin.TrimStart('/'), StreamHelper.BytesToStream(uploadFileBytes));
                    //    Result.Url = savePathOrigin;
                    //    Result.State = UploadState.Success;
                    //}
                    //catch (Exception ex)
                    //{
                    //    Result.ErrorMessage = ex.Message;
                    //    Result.State = UploadState.NetworkError;
                    //    WriteResult();
                    //}
                    //#endregion
#else
                    //if (!Directory.Exists(Path.GetDirectoryName(localPath)))
                    //{
                    //    Directory.CreateDirectory(Path.GetDirectoryName(localPath));
                    //}
                    ////上传原文件
                    //File.WriteAllBytes(localPath, uploadFileBytes);
                    //Result.Url = savePathOrigin;
                    //Result.State = UploadState.Success;
#endif
                }
                //else
                //{
                //    if (!Directory.Exists(Path.GetDirectoryName(localPath)))
                //    {
                //        Directory.CreateDirectory(Path.GetDirectoryName(localPath));
                //    }
                //    //上传原文件
                //    File.WriteAllBytes(localPath, uploadFileBytes);
                //    Result.Url = savePathOrigin;
                //    Result.State = UploadState.Success;

                //    //写一个临时文件，用于压缩
                //    //后来发现并不需要写一个临时文件
                //    //File.WriteAllBytes(localPathYasuo, new byte[0]);
                //}

            }
            catch (Exception e)
            {
                Result.State = UploadState.FileAccessError;
                Result.ErrorMessage = e.Message;
            }
            finally
            {
                result = WriteResult();
            }

            //压缩图片

            if (isCanPreview && Result.State == UploadState.Success)
            {
#if NETSTANDARD || NETCOREAPP

                //是否使用阿里OSS的图片压缩服务。注：oss压缩只能指定最大宽高、按比例压缩质量，并不能像程序那样控制MaxLength最大体积。
                //if (ConfigHelper.GetAppSettings("UseAliOssImgProcess") == "1")
                //if (clientModel.UseAliOssImgProcess == "1")
                //    {
                //    #region OSS上传
                //    try
                //    {
                //        //var process = string.Format(ConfigHelper.GetAppSettings("AliOssImgProcess"), 780);
                //        var process = string.Format(clientModel.AliOssImgProcess, 780);
                //        //注意：这里要传入压缩前的图片路径，因为此时压缩后的图片还未上传
                //        var ossObject = ossClient.GetObject(new GetObjectRequest(bucketName, savePathOrigin.TrimStart('/'), process));
                //        //上传
                //        var ossResult = ossClient.PutObject(bucketName, savePathYasuo.TrimStart('/'), ossObject.ResponseStream);
                //        result.Url = savePathYasuo;
                //    }
                //    catch (Exception ex)
                //    {
                //        Result.ErrorMessage = ex.Message;
                //        Result.State = UploadState.NetworkError;
                //        WriteResult();
                //    }
                //    #endregion
                //}
#else
 //               if (false)
	//{

	//}
#endif
                //else
                {
                    //#region 压缩图片，水印  by itdos.com
                    //Stream stream = new MemoryStream(uploadFileBytes);

                    ////注意：这里设置MaxWidth=780，一张4M图片先转成780宽度后就只有60多kb了，所以不能设置780。应该设置1920.
                    //var img = ImageHelper.MakeThumbnail(new ImageParam()
                    //{
                    //    Mode = EnumHelper.ImageMode.W,
                    //    MaxWidth = 780,
                    //    Image = stream,//file.OpenReadStream(),//file.InputStream,
                    //    MaxLength = 300,//300
                    //    NearlyLength = 50
                    //});
                    ////注意这里的不再的网站的根目录，而是FilServer(CDN)的根目录
                    ////暂时不打水印了。
                    ////img = ImageHelper.MakeWaterImage(new ImageParam()
                    ////{
                    ////    Image = img,
                    ////    WaterImage = new MemoryStream(File.ReadAllBytes(Path.Combine(Config.WebRootPath, "App_Data/tzy.png"))),
                    ////    ImageWaterPosition = EnumHelper.ImageWaterPosition.RightBottom
                    ////});

                    ////这句因为底层Dos.Common的StreamToMemoryStream（）返回值，会报：Parameter is not valid
                    ////new Bitmap(img).Save(localPathYasuo);
                    ////这句因为底层Dos.Common的StreamToMemoryStream（）返回值，会报：Parameter is not valid
                    ////Image.FromStream(img).Save(localPathYasuo);

                    ////临时处理方案
                    //if (img.Length >= uploadFileBytes.Length)
                    //{
                    //    //即使是这样，保存后的体积仍然更大。
                    //    //new Bitmap(stream).Save(localPathYasuo);
                    //}
                    //else
                    //{
                    //    new Bitmap(img).Save(localPathYasuo);
                    //    result.Url = savePathYasuo;
                    //}

                    //#endregion
                }
            }
            //result.Url = "https://static-ali-img.itdos.com/" + result.Url;
            if (uploadResult.Code == 1)
            {
                result.Url = JObject.FromObject(uploadResult.Data)["Path"].Value<string>();
            }
            result.Code = 200;
            return result;
        }

        private UEditorResult WriteResult()
        {
            return new UEditorResult
            {
                State = GetStateMessage(Result.State),
                Url = Result.Url,
                Title = Result.OriginFileName,
                Original = Result.OriginFileName,
                Error = Result.ErrorMessage
            };
        }

        private string GetStateMessage(UploadState state)
        {
            switch (state)
            {
                case UploadState.Success:
                    return "SUCCESS";
                case UploadState.FileAccessError:
                    return "文件访问出错，请检查写入权限";
                case UploadState.SizeLimitExceed:
                    return "文件大小超出服务器限制";
                case UploadState.TypeNotAllow:
                    return "不允许的文件格式";
                case UploadState.NetworkError:
                    return "网络错误";
            }
            return "未知错误";
        }

        private bool CheckFileType(string filename)
        {
            var fileExtension = Path.GetExtension(filename).ToLower();
            return UploadConfig.AllowExtensions?.Select(x => x.ToLower()).Contains(fileExtension) ?? false;
        }

        private bool CheckFileSize(long size)
        {
            return size < UploadConfig.SizeLimit;
        }
    }
    /// <summary>
    /// 
    /// </summary>
    public class UploadConfig
    {
        /// <summary>
        /// 文件命名规则
        /// </summary>
        public string? PathFormat { get; set; }

        /// <summary>
        /// 上传表单域名称
        /// </summary>
        public string? UploadFieldName { get; set; }

        /// <summary>
        /// 上传大小限制
        /// </summary>
        public int SizeLimit { get; set; }

        /// <summary>
        /// 上传允许的文件格式
        /// </summary>
        public string[]? AllowExtensions { get; set; }

        /// <summary>
        /// 文件是否以 Base64 的形式上传
        /// </summary>
        public bool Base64 { get; set; }

        /// <summary>
        /// Base64 字符串所表示的文件名
        /// </summary>
        public string? Base64Filename { get; set; }
    }
    /// <summary>
    /// 
    /// </summary>
    public class UploadResult
    {
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public UploadState State { get; set; }
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string? Url { get; set; }
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string? OriginFileName { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string? ErrorMessage { get; set; }
    }
    /// <summary>
    /// 
    /// </summary>
    public enum UploadState
    {
        /// <summary>
        /// 
        /// </summary>
        Success = 0,
        /// <summary>
        /// 
        /// </summary>
        SizeLimitExceed = -1,
        /// <summary>
        /// 
        /// </summary>
        TypeNotAllow = -2,
        /// <summary>
        /// 
        /// </summary>
        FileAccessError = -3,
        /// <summary>
        /// 
        /// </summary>
        NetworkError = -4,
        /// <summary>
        /// 
        /// </summary>
        Unknown = 1,
    }
}
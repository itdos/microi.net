using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using System.IO;

namespace Microi.net.Api
{
    /// <summary>
    /// 文件上传。支持公有/私有，单文件/多文件，阿里云OSS/MinIO
    /// </summary>
    [Route("api/[controller]/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public partial class HDFSController : Controller
    {
        private async Task DefaultParam(DiyUploadParam param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            if (currentTokenDynamic != null)
            {
                param._CurrentUser = currentTokenDynamic.CurrentUser;
                param.OsClient = currentTokenDynamic.OsClient;
            }
            param._InvokeType = InvokeType.Client.ToString();
        }
        /// <summary>
        /// 上传文件、图片。返回/路径。支持单文件、多文件。
        /// Multiple：是否多文件
        /// Limit：是否上传至需要有权限才能访问的文件夹
        /// Preview：是否压缩
        /// </summary>
        /// <returns></returns>
        [Consumes("application/json", "multipart/form-data")]
        [HttpPost]
        public async Task<JsonResult> Upload(DiyUploadParam param)
        {
            await DefaultParam(param);

            #region 测试手动传入文件流，也可以不用这样
            param.Files = new Dictionary<string, Stream>();
            if (HttpContext.Request.HasFormContentType)
            {
                foreach (var file in HttpContext.Request.Form.Files)
                {
                    if (file != null)
                        param.Files.Add(file.FileName, file.OpenReadStream());
                }
            }
            #endregion

            //HttpContext为可选参数，在Controller层调用DiyCommon.Upload可以不用传入HttpContext，内部可以自动获取，也可以直接传入文件流。
            //var result = await DiyCommon.Upload(param);//, HttpContext
            var result = await MicroiEngine.HDFS.Upload(param);//, HttpContext
            return Json(result);
        }
        /// <summary>
        /// Uniapp上传，移除Consumes。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> UniappUpload(DiyUploadParam param)
        {
            return await Upload(param);
        }

        /// <summary>
        /// 匿名上传。比如用于未登录时用户注册上传头像。此接口作废，建议在接口引擎中实现，考虑更多的安全性。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        // [Consumes("application/json", "multipart/form-data")]
        // [HttpPost]
        // [AllowAnonymous]
        // public async Task<JsonResult> UploadAnonymous(DiyUploadParam param)
        // {
        //     await DefaultParam(param);

        //     #region 测试手动传入文件流，也可以不用这样
        //     param.Files = new Dictionary<string, Stream>();
        //     if(HttpContext.Request.HasFormContentType){
        //         foreach (var file in HttpContext.Request.Form.Files)
        //         {
        //             if (file != null)
        //                 param.Files.Add(file.FileName, file.OpenReadStream());
        //         }
        //     }
        //     #endregion

        //     //HttpContext为可选参数，在Controller层调用DiyCommon.Upload可以不用传入HttpContext，内部可以自动获取，也可以直接传入文件流。
        //     //var result = await DiyCommon.Upload(param);//, HttpContext
        //     var result = await new MicroiHDFS().Upload(param);//, HttpContext
        //     return Json(result);
        // }

        /// <summary>
        /// 传入 FilePathName
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        public async Task<JsonResult> GetPrivateFileUrl(DiyUploadParam param)
        {
            await DefaultParam(param);
            //var result = await DiyCommon.GetPrivateFileUrl(param);
            var result = await MicroiEngine.HDFS.GetPrivateFileUrl(param);
            return Json(result);
        }

        #region 文件管理接口

        /// <summary>
        /// 列出指定路径下的文件和文件夹。
        /// 传入 Path（前缀路径，如 "osclient/upload/"）、Limit（是否私有桶）
        /// </summary>
        [HttpGet, HttpPost]
        public async Task<JsonResult> ListObjects(DiyUploadParam param)
        {
            await DefaultParam(param);
            var result = await new MicroiHDFS().ListObjects(param);
            return Json(result);
        }

        /// <summary>
        /// 删除文件或文件夹。
        /// 传入 FilePathName（文件完整路径），如果是文件夹路径需以"/"结尾
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> DeleteObject(DiyUploadParam param)
        {
            await DefaultParam(param);

            if (param.FilePathName.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "FilePathName不能为空！"));
            }

            var result = await new MicroiHDFS().DeleteObject(param);
            return Json(result);
        }

        /// <summary>
        /// 创建文件夹。
        /// 传入 FilePathName（文件夹完整路径，如 "osclient/upload/newfolder"）
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> CreateFolder(DiyUploadParam param)
        {
            await DefaultParam(param);

            if (param.FilePathName.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "FilePathName不能为空！"));
            }

            var result = await new MicroiHDFS().CreateFolder(param);
            return Json(result);
        }

        /// <summary>
        /// 重命名文件或文件夹。
        /// 传入 FilePathName（原路径）、Path（新路径）
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> RenameObject(DiyUploadParam param)
        {
            await DefaultParam(param);

            if (param.FilePathName.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "FilePathName不能为空！"));
            }
            if (param.Path.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "新路径Path不能为空！"));
            }

            var result = await new MicroiHDFS().RenameObject(param);
            return Json(result);
        }

        /// <summary>
        /// 移动文件。
        /// 传入 FilePathName（原路径）、Path（目标路径）
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> MoveObject(DiyUploadParam param)
        {
            await DefaultParam(param);

            if (param.FilePathName.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "FilePathName不能为空！"));
            }
            if (param.Path.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "目标路径Path不能为空！"));
            }

            var result = await new MicroiHDFS().MoveObject(param);
            return Json(result);
        }

        /// <summary>
        /// 文件管理专用上传 - 上传到指定的存储路径。
        /// 传入 Path（存储路径前缀）、Limit（是否私有桶）
        /// </summary>
        [Consumes("application/json", "multipart/form-data")]
        [HttpPost]
        public async Task<JsonResult> FileManageUpload(DiyUploadParam param)
        {
            await DefaultParam(param);

            param.Files = new Dictionary<string, Stream>();
            if (HttpContext.Request.HasFormContentType)
            {
                foreach (var file in HttpContext.Request.Form.Files)
                {
                    if (file != null)
                        param.Files.Add(file.FileName, file.OpenReadStream());
                }
            }

            // 文件管理上传不压缩
            param.Preview = false;

            var result = await MicroiEngine.HDFS.Upload(param);
            return Json(result);
        }

        #endregion
    }
}
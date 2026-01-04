using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

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
            var currentToken = await DiyToken.GetCurrentToken<SysUser>();
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            if (currentToken != null)
            {
                param._CurrentSysUser = currentToken.CurrentUser;
                param.OsClient = currentToken.OsClient;
            }
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
            if(HttpContext.Request.HasFormContentType){
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
    }
}
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
    /// 2023-03-23：为了解决swagger的问题，前端需使用HDFSController替代，此控制器作废，保留此接口目的是为了兼容老前端程序。
    /// </summary>
    [Route("api/Upload")]
    //[Route("api/[controller]/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class UploadController : Controller
    {
        /// <summary>
        /// 上传文件、图片。返回/路径。支持单文件、多文件。
        /// Multiple：是否多文件
        /// Limit：是否上传至需要有权限才能访问的文件夹
        /// Preview：是否压缩
        /// </summary>
        /// <returns></returns>
        [Consumes("application/json", "multipart/form-data")]
        [HttpPost]
        [Route("api/Upload")]
        public async Task<JsonResult> Post(DiyUploadParam param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            param.OsClient = currentTokenDynamic?.OsClient;

            #region 测试手动传入文件流，也可以不用这样
            param.Files = new Dictionary<string, Stream>();
            foreach (var file in HttpContext.Request.Form.Files)
            {
                if (file != null)
                    param.Files.Add(file.FileName, file.OpenReadStream());
            }
            #endregion

            //HttpContext为可选参数，在Controller层调用DiyCommon.Upload可以不用传入HttpContext，内部可以自动获取，也可以直接传入文件流。
            //var result = await DiyCommon.Upload(param);//, HttpContext
            var result = await MicroiEngine.HDFS.Upload(param);//, HttpContext
            return Json(result);
        }
    }
}
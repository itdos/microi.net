using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api.Controllers
{
    /// <summary>
    /// 
    /// </summary>
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class UEditorController : Controller
    {
        private readonly UEditorService _ueditorService;
        /// <summary>
        /// 
        /// </summary>
        /// <param name="ueditorService"></param>
        public UEditorController(UEditorService ueditorService)
        {
            this._ueditorService = ueditorService;
        }

        /// <summary>
        /// 如果是API，可以按MVC的方式特别指定一下API的URI
        /// 传入Path是指哪个客户，比如说Tzy、Tdx、Nbgysh等。然后会指定存储到对应文件夹目录下。
        /// Path值可以为【Tdx】，也可以为【Tdx/Plant】，不能以/结尾。
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        [HttpPost]
        [EnableCors("any")]
        public async Task<ContentResult> UploadAsync(string Path)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();

            if (Path.DosIsNullOrWhiteSpace())
            {
                Path = currentTokenDynamic.OsClient;
            }

            #region 这是以前默认的百度编辑器上传
            var response = _ueditorService.UploadAndGetResponse(HttpContext, Path);
            return Content(response.Result, response.ContentType);
            #endregion

            #region 修改为分布式上传

            #endregion
        }
    }
}

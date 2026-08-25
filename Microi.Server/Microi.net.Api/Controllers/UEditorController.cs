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
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            // Path is a storage namespace, not a client-selectable display value.
            // Always bind it to the authenticated tenant to prevent cross-tenant
            // local/object-storage path selection through this legacy endpoint.
            Path = TenantConfigurationSecurity.NormalizeTenantId(
                Convert.ToString(currentTokenDynamic.OsClient));

            // 只读取 ASP.NET Core 已缓存的 multipart 文件元数据，不读取文件内容。
            // 这样旧版富文本上传也能在系统日志/监控中按帐号、IP、类型和字节归因。
            if (HttpContext.Request.HasFormContentType)
            {
                try
                {
                    var form = await HttpContext.Request.ReadFormAsync();
                    var files = form.Files.Where(file => file != null).ToList();
                    if (files.Count > 0)
                    {
                        NetworkTrafficObservabilityService.AnnotateTransfer(
                            HttpContext,
                            "Upload",
                            files.Count,
                            files.Sum(file => Math.Max(0L, file.Length)),
                            files.Select(file => file.FileName),
                            files.Select(file => System.IO.Path.GetExtension(file.FileName)));
                    }
                }
                catch
                {
                    // 观测元数据为旁路；格式异常由原上传逻辑返回，不改变业务接口语义。
                }
            }

            #region 这是以前默认的百度编辑器上传
            var response = await _ueditorService.UploadAndGetResponseAsync(
                HttpContext,
                Path);
            return Content(response.Result, response.ContentType);
            #endregion

            #region 修改为分布式上传

            #endregion
        }
    }
}

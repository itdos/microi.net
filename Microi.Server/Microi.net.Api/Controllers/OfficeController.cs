using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Authorization;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api;

/// <summary>
/// Office相关
/// </summary>
[EnableCors("any")]
[ServiceFilter(typeof(DiyFilter<dynamic>))]
[Route("api/[controller]/[action]")]
public class OfficeController : Controller
{
    private static async Task DefaultParam(OfficeExportParam param)
    {
        var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
        if (currentTokenDynamic != null)
        {
            param._CurrentUser = currentTokenDynamic.CurrentUser;
            param.OsClient = currentTokenDynamic.OsClient;
        }
        param._InvokeType = InvokeType.Client.ToString();
    }
    /// <summary>
    /// 根据模板导出word
    /// 必传：TemplateId、FormDataId
    /// </summary>
    /// <param name="param"></param>
    /// <returns></returns>
    [HttpPost, HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult> ExportWordByTpl(OfficeExportParam param)
    {
        await DefaultParam(param);

        var tokenModelJobj = await DiyToken.GetCurrentToken<JObject>(param.authorization, param.OsClient);
        if (tokenModelJobj != null)
        {
            param.OsClient = tokenModelJobj.OsClient;
            param._CurrentUser = tokenModelJobj.CurrentUser;
        }
        else
        {
            return new ContentResult() { Content = DiyMessage.GetLang(param.OsClient, "NoLogin", param._Lang) };
        }

        var result = await MicroiEngine.Office.ExportWordByTpl(param);
        if (result.Code != 1)
        {
            return Json(result);
        }
        return File(result.Data, "application/vnd.ms-word", "word模板导出"
                    + " - "
                    + DateTime.Now.ToString("yyyyMMddHHmmss") + ".doc");
    }
}


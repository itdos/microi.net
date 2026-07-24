using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;

using Microsoft.AspNetCore.Cors;
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
        var currentTokenDynamic = await DiyToken.GetCurrentToken();
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
    [HttpPost]
    public async Task<ActionResult> ExportWordByTpl([FromForm] OfficeExportParam param)
    {
        if (param == null)
        {
            return Json(new DosResult(0, null, DiyMessage.GetLang("", "ParamError")));
        }
        await DefaultParam(param);

        if (param._CurrentUser == null)
        {
            return Json(new DosResult(
                int.Parse(DiyMessage.GetLangCode(param.OsClient, "NoLogin")),
                null,
                DiyMessage.GetLang(param.OsClient, "NoLogin", param._Lang)));
        }

        if (param._SysMenuId.DosIsNullOrWhiteSpace()
            && param.ModuleEngineKey.DosIsNullOrWhiteSpace())
        {
            return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "NoAuth", param._Lang)));
        }

        var authorization = await MicroiEngine.FormEngine.AuthorizeClientTableOperationAsync(
            new DiyTableRowParam
            {
                FormEngineKey = param.FormEngineKey,
                Id = param.FormDataId,
                _SysMenuId = param._SysMenuId,
                ModuleEngineKey = param.ModuleEngineKey,
                _InvokeType = InvokeType.Client.ToString(),
                _CurrentUser = param._CurrentUser,
                OsClient = param.OsClient,
                _Lang = param._Lang
            },
            "Read");
        if (authorization.Code != 1)
        {
            return Json(authorization);
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


using Dos.Common;
using Microsoft.AspNetCore.Mvc;

namespace Microi.net.Api;

/// <summary>
/// API 根地址展示页。租户自定义 HTML 仍从 SaaS 引擎读取；异常响应由全局中间件统一处理。
/// </summary>
public sealed class HomeController : Controller
{
    public IActionResult Index()
    {
        var osClient = DiyToken.GetCurrentOsClient();
        var clientModel = OsClient.GetClient(osClient);
        var indexCode = clientModel.OsClientModel["IndexCodeApi"].Val<string>();
        return indexCode.DosIsNullOrWhiteSpace()
            ? View()
            : Content(indexCode, "text/html; charset=utf-8");
    }
}

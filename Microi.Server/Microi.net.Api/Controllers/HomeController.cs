using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;

using Dos.Common;

namespace Microi.net.Api;
/// <summary>
/// 
/// </summary>
public class HomeController : Controller
{
    private readonly ILogger<HomeController> _logger;
    /// <summary>
    /// 
    /// </summary>
    /// <param name="logger"></param>
    public HomeController(ILogger<HomeController> logger)
    {
        _logger = logger;
    }
    /// <summary>
    /// 
    /// </summary>
    /// <returns></returns>
    public IActionResult Index()
    {
        var osClient = DiyTokenExtend.GetCurrentOsClient();
        var clientModel = OsClient.GetClient(osClient);
        if (!clientModel.IndexCodeApi.DosIsNullOrWhiteSpace())
        {
            return Content(clientModel.IndexCodeApi, "text/html; charset=utf-8");
        }
        return View();
    }
    /// <summary>
    /// 
    /// </summary>
    /// <returns></returns>
    public IActionResult Privacy()
    {
        return View();
    }
    /// <summary>
    /// 
    /// </summary>
    /// <returns></returns> <summary>
    /// 
    /// </summary>
    /// <returns></returns>
    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}


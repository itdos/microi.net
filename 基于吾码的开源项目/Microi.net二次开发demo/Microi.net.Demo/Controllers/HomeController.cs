using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microi.net.Demo.Models;
using Microi.net;
using Newtonsoft.Json;

namespace Microi.net.Demo.Controllers;

public class HomeController : Controller
{
    private readonly FormEngine _formEngine = new FormEngine();
    private readonly IV8Engine _v8Engine = new V8Engine();
    private readonly ApiEngine _apiEngine = new ApiEngine();

    private readonly ILogger<HomeController> _logger;

    public HomeController(ILogger<HomeController> logger)
    {
        _logger = logger;
    }

    public IActionResult Index()
    {
        //测试FormEngine
        var getSysUserResult = _formEngine.GetFormData("sys_user", new {
            _Where = new List<DiyWhere>() {
                new DiyWhere(){
                    Name = "Account",
                    Value = "admin",
                    Type = "="
                }
            },
            OsClient = "iTdos"
        });

        ViewBag.SysUserResult = JsonConvert.SerializeObject(getSysUserResult);
        //测试V8Engine
        var v8EngineResult = _v8Engine.Run(new V8EngineParam() 
        {
            V8Code = "return 1 + 1;",
            OsClient = "iTdos"
        });
        ViewBag.V8EngineResult = v8EngineResult.Result;

        //测试ApiEngine
        var apiEngineResult = _apiEngine.Run("microi-init", new {
            OsClient = "iTdos"
        });//下个版本可以不必传第二个参数
        ViewBag.ApiEngineResult = JsonConvert.SerializeObject(apiEngineResult);
        return View();
    }

    public IActionResult Privacy()
    {
        return View();
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error()
    {
        return View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
    }
}

using System.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microi.net.Grpc.Client.Models;
using Grpc.Net.Client;
using Microi.net.Grpc.Server;

namespace Microi.net.Grpc.Client.Controllers;

public class HomeController : Controller
{
    private readonly ILogger<HomeController> _logger;

    public HomeController(ILogger<HomeController> logger)
    {
        _logger = logger;
    }

    public async Task<IActionResult>  Index()
    {
        var channel = GrpcChannel.ForAddress("http://localhost:50001"); // 服务端地址
                                                                        //var channel = GrpcChannel.ForAddress("https://localhost:7110"); // 服务端地址

        var client = new Greeter.GreeterClient(channel);
        var reply = await client.SayHelloAsync(new HelloRequest { Name = "Anderson." });

        var sysUserClient = new SysUserProto.SysUserProtoClient(channel);
        var sysUserReply = await sysUserClient.LoginAsync(new SysUserRequest()
        {
            Account = "admin",
            Pwd = "1234567",
            OsClient = "xjy"
        });

        ViewBag.TestGrpcResult = reply.Message + (sysUserReply.Code == 1 ? "登陆成功！" : "登陆失败：" + sysUserReply.Msg);
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


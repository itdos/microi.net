//【MacOS VS Code】折叠代码快捷键：【command + K + 0】

#region using
using System.Diagnostics;
using Dos.Common;
using Microi.net;
using Microi.net.Api;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Newtonsoft.Json.Serialization;
using Senparc.CO2NET;
using Senparc.CO2NET.Cache;
using Senparc.CO2NET.Cache.Redis;
using Senparc.Weixin.AspNet;
using Senparc.Weixin.RegisterServices;
using Senparc.CO2NET.Extensions;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Newtonsoft.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting.StaticWebAssets;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.SignalR;
using StackExchange.Redis;
using Microsoft.Extensions.Caching.StackExchangeRedis;
using Microsoft.AspNetCore.SignalR.StackExchangeRedis;
#endregion

var builder = WebApplication.CreateBuilder(args);

#region Microi.net 初始化
StaticWebAssetsLoader.UseStaticWebAssets(builder.Environment, builder.Configuration);
// ------- 文件上传大小限制 -------
//USE LINUX【发布到Linux使用以下代码】
builder.WebHost.UseKestrel((host, options) =>
{
    options.Limits.MaxRequestLineSize = int.MaxValue;//HTTP 请求行的最大允许大小。 默认为 8kb
    options.Limits.MaxRequestBufferSize = int.MaxValue;//请求缓冲区的最大大小。 默认为 1M
    options.Limits.MaxRequestBodySize = long.MaxValue;//任何请求正文的最大允许大小（以字节为单位）,默认 30,000,000 字节，大约为 28.6MB
});
//USE IIS【发布到Windows IIS使用以下代码】
//builder.WebHost.UseIISIntegration();
var services = builder.Services;
services.Configure<FormOptions>(options =>
{
    options.ValueLengthLimit = int.MaxValue;
    options.MultipartBodyLengthLimit = long.MaxValue;
});
Console.WriteLine($"------------------------------------------------------------------------------");
Console.WriteLine($"------------------------------------------------------------------------------");
Console.WriteLine("Microi：【成功】开始初始化！" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
Stopwatch timer = new Stopwatch();
timer.Start();
var dbConn = Environment.GetEnvironmentVariable("OsClientDbConn", EnvironmentVariableTarget.Process) ?? ConfigHelper.GetAppSettings("OsClientDbConn") ?? "";
var microiNetDllVersion = "";
try
{
    var filePath = Path.Combine(AppContext.BaseDirectory, "Microi.net.dll");
    var filePath2 = (Debugger.IsAttached ? ConfigHelper.GetAppSettings("DebuggerFolder").DosTrimStart('/').DosTrimEnd('/') + "/" : "") + "Microi.net.dll";
    microiNetDllVersion = FileVersionInfo.GetVersionInfo(filePath).FileVersion
                        + " - "
                        + File.GetLastWriteTime(filePath).ToString("yyyy-MM-dd HH:mm:ss");
}
catch (Exception ex)
{
    microiNetDllVersion = ex.Message;
}
Console.WriteLine("Microi：【成功】您的平台服务器端版本号：v" + microiNetDllVersion);
services.AddMicroi();//【必须】Microi初始化
services.AddMicroiORM();//【必须】注入【数据库ORM】插件
services.AddMicroiCache();//【必须】注入【缓存】插件
services.AddMicroiHttp();//【必须】注入【Http】插件
services.AddMicroiMongoDB();//【可选】注入【MongoDB】插件
services.AddMicroiUpgrade();//【可选】注入【平台自动更新】插件
services.AddMicroiWeChat();//【可选】注入【微信公众号平台】插件
services.AddMicroiOffice();//【可选】注入【Office】插件
services.AddMicroiSpider();//【可选】注入【采集引擎】插件
services.AddMicroiMQ();//【可选】注入【MQ消息队列】插件
services.AddMicroiSearchEngine();//【可选】注入【搜索引擎】插件
services.AddMicroiAI();//【可选】注入【AI引擎】插件
services.AddMicroiMQTT();//【可选】注入【MQTT引擎】插件
services.AddMicroiHDFS();//【可选】注入【分布式存储】插件
services.AddMicroiCaptcha();//【可选】注入验证码插件
services.AddMicroiJob(dbConn);//【可选】注入【任务调度引擎】插件
services.TryAddSingleton(typeof(DiyFilter<>));
services.AddSingleton<DynamicRoute>();
// 注册配置器
services.AddSingleton<IConfigureOptions<JwtBearerOptions>, JwtBearerOptionsConfigurator>();
services.AddSingleton<IConfigureOptions<CorsOptions>, CorsOptionsConfigurator>();
// 数据校验
services.Configure<ApiBehaviorOptions>(opt =>
{
    opt.InvalidModelStateResponseFactory = actionContext =>
    {
        //获取验证失败的模型字段
        var errors = actionContext.ModelState
            .Where(e => e.Value.Errors.Count > 0)
            .Select(e => e.Value.Errors.First().ErrorMessage)
            .ToList();
        var str = string.Join("|", errors);
        //设置返回内容
        var result = new
        {
            Code = 0,
            Msg = str
        };
        return new BadRequestObjectResult(result);
    };
});
services.AddHttpContextAccessor();
services.AddAuthorization();
services.AddSession(opt =>
{
    opt.IdleTimeout = TimeSpan.FromMinutes(20);
});
services.AddHttpClient();
services.AddUEditorService("ueditor.json", true, AppContext.BaseDirectory + "/wwwroot/");
services.AddControllersWithViews().AddRazorRuntimeCompilation().AddNewtonsoftJson(options => {
    //取消json首字母小写
    options.SerializerSettings.ContractResolver = new DefaultContractResolver();
    options.SerializerSettings.DateFormatString = "yyyy-MM-dd HH:mm:ss";
    options.SerializerSettings.DateParseHandling = DateParseHandling.None; // 禁用日期解析
});
//services.AddGrpc();
Console.WriteLine("Microi：【成功】Microi所有初始化成功！");
#endregion

#region SignalR、Redis
var redisConn = RedisConnBuilder.BuildDefaultRedisConn();
services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    //客户端发保持连接请求到服务端最长间隔，默认30秒，改成4分钟，网页需跟着设置connection.keepAliveIntervalInMilliseconds = 12e4;即2分钟
    options.ClientTimeoutInterval = TimeSpan.FromMinutes(20);
    //服务端发保持连接请求到客户端间隔，默认15秒，改成2分钟，网页需跟着设置connection.serverTimeoutInMilliseconds = 24e4;即4分钟
    options.KeepAliveInterval = TimeSpan.FromMinutes(20);
    options.EnableDetailedErrors = true;
    options.MaximumReceiveMessageSize = 1024 * 1024 * 10;//10M
})
.AddNewtonsoftJsonProtocol(options =>
{
    options.PayloadSerializerSettings.ContractResolver = new DefaultContractResolver();
})
.AddMessagePackProtocol()

.AddStackExchangeRedis(redisConn, options => //暂时还没找到方案在【builder.Build()】之后注册redis连接字符串，因此使用初始化redis配置
{
    options.Configuration.ChannelPrefix = RedisChannel.Literal("MicroiSignalR");
});
services.AddStackExchangeRedisCache(options =>
{
    //暂时还没找到方案在【builder.Build()】之后注册redis连接字符串，因此使用初始化redis配置
    options.Configuration = redisConn;
    options.InstanceName = "Microi:";
});
#endregion

#region Swagger
services.AddSwaggerGen(s =>
{
    s.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "开源低代码平台 - Microi吾码",
        // Description = clientModel.ClientName.DosIsNullOrWhiteSpace() ? "Microi.net" : clientModel.ClientName,
        Version = microiNetDllVersion,
        Contact = new OpenApiContact
        {
            Name = "Anderson",
            Email = "admin@itdos.com",
            // Url = new Uri((clientModel.DomainName.DosIsNullOrWhiteSpace() || clientModel.DomainName.Contains("$"))
            //                 ? "https://microi.net"
            //                 : (clientModel.DomainName.Contains("http") ? clientModel.DomainName : "http://" + clientModel.DomainName)
            //              )
        }
    })
    ;
});
#endregion

#region JWT、跨域
services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
services.AddCors();
#endregion

#region 添加微信配置
services.AddSenparcWeixinServices(builder.Configuration);
// CacheStrategyFactory.RegisterObjectCacheStrategy(() => RedisObjectCacheStrategy.Instance);
#endregion

var app = builder.Build();

#region .Net 系统默认
//app.MapGrpcService<GreeterService>();
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}
app.UseHttpsRedirection();
app.MapStaticAssets();
app.UseRouting();
//-------注意以下两者的顺序-------
app.UseAuthentication();
app.UseAuthorization();
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");
#endregion

#region Microi.net 启用
MicroiEngine.Init(app.Services);
app.UseMicroi();//初始化平台
app.UseMicroiJob();//启用任务计划
app.UseMicroiMQ();//启用消息队列
app.UseMicroiUpgrade();//启用平台自动升级
app.MapHub<DiyWebSocket>("/diy-websocket").RequireCors("any");
var osClientName = Environment.GetEnvironmentVariable("OsClient", EnvironmentVariableTarget.Process) ?? ConfigHelper.GetAppSettings("OsClient") ?? "";
var clientModel = OsClient.GetClient(osClientName);
#endregion

#region Redis
redisConn = RedisConnBuilder.Build(clientModel);
#endregion

#region MQTT
if (clientModel.MqttEnable == 1)
{
    var mqttService = app.Services.GetRequiredService<IMicroiMQTT>();
    _ = Task.Run(async () =>
    {
        await Task.Delay(5000); // 等待Host启动完成
        await mqttService.StartServerAsync(clientModel);
    });
}
#endregion 

#region 启用微信配置
Senparc.CO2NET.Cache.Redis.Register.SetConfigurationOption(redisConn);
var registerService = app.UseSenparcWeixin(app.Environment,
    /* 不为 null 则覆盖 appsettings  中的 SenparcSetting 配置*/
    new SenparcSetting()
    {
        IsDebug = false,
        DefaultCacheNamespace = "MicroiWeChatCache",
        Cache_Redis_Configuration = redisConn
    }, null,
    register =>
    {
    },
    (register, weixinSetting) =>
    {
        //register.RegisterMpAccount("wxb3fb0a1b44902df3", "xxx", "微吾科技");
    }
);
#endregion

#region 接口引擎初始化
Task.Run(async () =>
{
    //初始化 DynamicApiEngine
    foreach (var item in OsClient.ClientList)
    {
        await new DynamicRoute().Init(item.Value);
    }
});
try
{
    //-------接口引擎、数据源引擎动态接口
    app.MapDynamicControllerRoute<DynamicRoute>("{controller}");//"{controller}/{action}"
    app.MapDynamicControllerRoute<DynamicRoute>("{controller}/{action}");
    app.MapDynamicControllerRoute<DynamicRoute>("{controller}/{action}/{param1}");
    app.MapDynamicControllerRoute<DynamicRoute>("{controller}/{action}/{param1}/{param2}");
    app.MapDynamicControllerRoute<DynamicRoute>("{controller}/{action}/{param1}/{param2}/{param3}");
    app.MapDynamicControllerRoute<DynamicRoute>("{controller}/{action}/{param1}/{param2}/{param3}/{param4}");
    app.MapDynamicControllerRoute<DynamicRoute>("{controller}/{action}/{param1}/{param2}/{param3}/{param4}/{param5}");
    Console.WriteLine("Microi：【成功】接口引擎、数据源引擎动态接口地址配置成功！");
}
catch (Exception ex)
{
    Console.WriteLine("Microi：【Error异常】接口引擎、数据源引擎动态接口地址配置失败：" + ex.Message);
}
#endregion

#region 其它
app.UseDeveloperExceptionPage();
app.UseSession();
app.UseCors("any");
app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromMinutes(20)
});
if (clientModel.EnableSwagger == 1)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
#endregion

Console.WriteLine($"Microi：【成功】Microi全部启动成功！{DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")}。总耗时：{timer.ElapsedMilliseconds}ms");
timer.Stop();
Console.WriteLine($"Microi：【成功】开始访问系统吧！访问地址一般是【/Microi.net.Api/Properties/launchSettings.json】里的applicationUrl属性值【https://localhost:7266】");
Console.WriteLine($"------------------------------------------------------------------------------");
Console.WriteLine($"------------------------------------------------------------------------------");

app.Run();
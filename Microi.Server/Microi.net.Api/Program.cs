using System.Diagnostics;
using System.Security.Cryptography;
using Dos.Common;
using Microi.net;
using Microi.net.Api;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
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

var builder = WebApplication.CreateBuilder(args);

#region ------- Microi.net -------

//-------文件上传大小限制
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

//-------Microi.net初始化
Console.WriteLine("Microi：【成功】开始初始化！" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
Stopwatch timer = new Stopwatch();
timer.Start();
services.AddMicroi();
services.AddMicroiUpgrade();//【可选】注入验证码插件
//注入Microi.net低代码平台相关功能
services.AddMicroiWeChat();//【可选】注入Microi.WeChat微信公众号平台插件
services.AddMicroiOffice();//【可选】注入Microi.Office插件
services.AddMicroiSpider();//【可选】注入Microi.Spider采集引擎插件
//【注意】：可选注入Microi.Job任务调度插件，本地调度时建议注释关闭注入，否则可能导致与线上定时任务冲突。注意还有【 UseMicroiJob 】
services.AddMicroiJob();//.Init(services.BuildServiceProvider());
services.AddMicroiMQ();//.Init(services.BuildServiceProvider()); ;//【可选】注入Microi.MQ消息队列插件插件
services.AddMicroiSearchEngine(); ;//【可选】注入Microi.SearchEngine搜索引擎插件
services.AddMicroiAI();//【可选】注入Microi.AI插件
services.AddMicroiMQTT();//【可选】注入Microi.MQTT插件
var osClientName = Environment.GetEnvironmentVariable("OsClient", EnvironmentVariableTarget.Process) ?? (ConfigHelper.GetAppSettings("OsClient") ?? "");
var clientModel = OsClient.GetClient(osClientName);
services.AddMicroiCaptcha(clientModel);//【可选】注入验证码插件

services.AddSingleton<IV8MethodExtend, V8MethodExtend>(); // 注册 MVC 项目中的 V8MethodExtend
services.AddSingleton<V8Method>(provider => new V8Method(provider.GetRequiredService<IV8MethodExtend>())); // 注册 V8Method
services.TryAddSingleton(typeof(DiyFilter<>));

//2023-03-31:这里DynamicRoute.Init没加await，但仍然是同步执行，导致程序启动长达10s+，所以新增Task.Run
Task.Run(async () =>
{
    //初始化 DynamicApiEngine
    foreach (var item in OsClient.ClientList)
    {
        await DynamicRoute.Init(item.Value);
    }
});
//-------
Console.WriteLine("Microi：【成功】初始化接口引擎、数据源引擎动态接口！" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
services.AddSingleton<DynamicRoute>();

#region 获取OsClient对象


#endregion 获取OsClient对象

//builder.Services.AddGrpc();
services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            //获取或设置元数据地址或权限是否需要HTTPS。默认是true。这应该只在开发环境中禁用。
            options.RequireHttpsMetadata = false;
            var jwtKey = clientModel.AuthSecret.DosIsNullOrWhiteSpace() ? clientModel.OsClient : clientModel.AuthSecret;
            jwtKey = jwtKey.Length > 32 ? jwtKey.Substring(0, 32) : jwtKey.PadRight(32, '.');
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidAudience = "microi",
                ValidateLifetime = true,
                ValidateAudience = true,//2024-12-22修改为true
                ValidateIssuer = true,//2024-09-29新增，2024-12-22修改为true
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),//2024-09-29新增
            };
            // options.MapInboundClaims = false;//加了这句貌似没用
            options.SaveToken = true;
            options.Audience = "microi";
        });
services.AddAuthorization();

services.AddSession(opt =>
{
    opt.IdleTimeout = TimeSpan.FromMinutes(20);
});
services.AddHttpClient();
services.AddUEditorService("ueditor.json", true, AppContext.BaseDirectory + "/wwwroot/");

//-------动态跨域配置
services.AddCors(options =>
{
    options.AddPolicy("any", builder =>
    {
        var corsAllowOrigins = clientModel.CorsAllowOrigins.DosTrim();
        var corsAllowOriginsArr = new List<string>();
        if (!corsAllowOrigins.DosIsNullOrWhiteSpace())
        {
            corsAllowOriginsArr = corsAllowOrigins.Split(';', StringSplitOptions.RemoveEmptyEntries).ToList();
        }
        if (!corsAllowOriginsArr.Any())
        {
            builder.SetIsOriginAllowed(s => true)
                    .AllowAnyMethod()
                    .AllowAnyHeader()
                    .AllowCredentials()
                    .WithExposedHeaders("authorization", "osclient", "set-cookie", "did", "apiengine", "token", "lang", "captchaid")
                    .SetPreflightMaxAge(TimeSpan.FromHours(24));
        }
        else
        {
            // builder.WithOrigins(corsAllowOriginsArr.ToArray());
            builder.SetIsOriginAllowed(origin =>
            {
                if (string.IsNullOrWhiteSpace(origin)) return false;

                return corsAllowOriginsArr.Any(pattern =>
                {
                    // 处理通配符转正则表达式
                    var regexPattern = "^" +
                        Regex.Escape(pattern)
                            .Replace("\\*", "[a-zA-Z0-9-]+")
                            .Replace("\\?", "[a-zA-Z0-9]") + "$";

                    // 精确匹配或正则匹配
                    return pattern == origin ||
                        Regex.IsMatch(origin, regexPattern, RegexOptions.IgnoreCase);
                });
            })
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials()
            .WithExposedHeaders("authorization", "osclient", "set-cookie", "did", "apiengine", "token", "lang", "captchaid")
            .SetPreflightMaxAge(TimeSpan.FromHours(24));
        }
    });
});

//-------redis托管session
string redisConnectiong = clientModel.RedisHost
                                    + ":" + clientModel.RedisPort
                                    + ",defaultDatabase=" + clientModel.RedisDataBase
                                    + ",password=" + clientModel.RedisPwd
                                    + ",abortConnect=false,ssl=false,connectTimeout=5000"
                                    ;

if (!clientModel.CacheConnectionType.IsNullOrEmpty())
{
    // 哨兵连接类型
    string sentinelType = "2";
    if (clientModel.CacheConnectionType.Equals(sentinelType))
    {
        var ipArr = clientModel.SentinelHost.Split(',');
        string hostStr = "";
        foreach (var ip in ipArr)
        {
            hostStr += $"{ip},";
        }
        redisConnectiong = $"{hostStr}serviceName={clientModel.SentinelServiceName},password={clientModel.SentinelPwd}," +
                           $"connectTimeout=5000,connectRetry=3,KeepAlive=180,DefaultDatabase={clientModel.RedisDataBase},allowAdmin = true";
    }
}

#region SignalR

services.AddHttpContextAccessor();
services.AddSingleton<IActionContextAccessor, ActionContextAccessor>();
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
.AddStackExchangeRedis(redisConnectiong, options =>
{
    options.Configuration.ChannelPrefix = "DiyWebSocket";
})
;

services.AddStackExchangeRedisCache(options =>
{
    options.Configuration = redisConnectiong;
    options.InstanceName = "Microi:";//: + clientModel.OsClient
});

#endregion SignalR

#region Swagger

if (clientModel.EnableSwagger == 1)
{
    services.AddSwaggerGen(s =>
    {
        var microiNetDllVersion = "";
        try
        {
            var filePath = Path.Combine(AppContext.BaseDirectory, "Microi.net.dll");
            var filePath2 = (Debugger.IsAttached ? ConfigHelper.GetAppSettings("DebuggerFolder").DosTrimStart('/').DosTrimEnd('/') + "/" : "") + "Microi.net.dll";
            microiNetDllVersion = FileVersionInfo.GetVersionInfo(filePath).FileVersion
                                + " - "
                                + System.IO.File.GetLastWriteTime(filePath).ToString("yyyy-MM-dd HH:mm:ss");
        }
        catch (Exception ex)
        {
            microiNetDllVersion = ex.Message;
        }
        s.SwaggerDoc("v1", new OpenApiInfo
        {
            Title = "Microi.net api",
            Description = clientModel.ClientName.DosIsNullOrWhiteSpace() ? "Microi.net" : clientModel.ClientName,
            Version = microiNetDllVersion,
            Contact = new OpenApiContact
            {
                Name = "Anderson",
                Email = "admin@itdos.com",
                Url = new Uri((clientModel.DomainName.DosIsNullOrWhiteSpace() || clientModel.DomainName.Contains("$"))
                                ? "https://microi.net"
                                : (clientModel.DomainName.Contains("http") ? clientModel.DomainName : "http://" + clientModel.DomainName)
                             )
            }
        })
        ;
    });
}

#endregion Swagger

//-------json.net
services.AddControllersWithViews()
        .AddNewtonsoftJson(options =>
{
    //取消json首字母小写
    options.SerializerSettings.ContractResolver = new DefaultContractResolver();
    options.SerializerSettings.DateFormatString = "yyyy-MM-dd HH:mm:ss";
    options.SerializerSettings.DateParseHandling = DateParseHandling.None; // 禁用日期解析
});
Console.WriteLine("Microi：【成功】services相关执行成功！");

#endregion ------- Microi.net -------

#region region 添加微信配置（一行代码）。--若没有注入[AddMicroiWeChat]，以下代码无需执行。

//Senparc.Weixin 注册（必须）
builder.Services.AddSenparcWeixinServices(builder.Configuration);
//Senparc.CO2NET.Cache.Redis.Register.SetConfigurationOption($"{clientModel.RedisHost}:{clientModel.RedisPort},password={clientModel.RedisPwd}");
Senparc.CO2NET.Cache.Redis.Register.SetConfigurationOption(redisConnectiong);
CacheStrategyFactory.RegisterObjectCacheStrategy(() => RedisObjectCacheStrategy.Instance);

#endregion region 添加微信配置（一行代码）。--若没有注入[AddMicroiWeChat]，以下代码无需执行。

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

var app = builder.Build();

#region MQTT 启动服务器（需修改为异步安全方式）

if (clientModel.MqttEnable == 1)
{
    var mqttService = app.Services.GetRequiredService<IMicroiMQTT>();
    _ = Task.Run(async () =>
    {
        await Task.Delay(5000); // 等待Host启动完成
        await mqttService.StartServerAsync(clientModel);
    });
}

#endregion MQTT 启动服务器（需修改为异步安全方式）

#region 启用微信配置（一句代码）。--若没有注入[AddMicroiWeChat]，以下代码无需执行。

//手动获取配置信息可使用以下方法
//var senparcWeixinSetting = app.Services.GetService<IOptions<SenparcWeixinSetting>>()!.Value;

//启用微信配置（必须）
var registerService = app.UseSenparcWeixin(app.Environment,
    /* 不为 null 则覆盖 appsettings  中的 SenparcSetting 配置*/
    //null
    new SenparcSetting()
    {
        IsDebug = false,
        DefaultCacheNamespace = "MicroiWeChatCache",
        //Cache_Redis_Configuration = $"{clientModel.RedisHost}:{clientModel.RedisPort},password={clientModel.RedisPwd}"
        Cache_Redis_Configuration = redisConnectiong
    }
    ,
    /* 不为 null 则覆盖 appsettings  中的 SenpacWeixinSetting 配置*/
    null,
    register =>
    {
        /* CO2NET 全局配置 */
    },
    (register, weixinSetting) =>
    {
        //注册公众号信息（可以执行多次，注册多个公众号）
        //register.RegisterMpAccount(weixinSetting, "【Microi】公众号");
        //其它地方实现动态注册
        //register.RegisterMpAccount("wxb5758292bc0b6d25", "xxx", "宁波交投咨询服务号");
        //register.RegisterMpAccount("wxb3fb0a1b44902df3", "xxx", "微吾科技");
    }
);

#endregion 启用微信配置（一句代码）。--若没有注入[AddMicroiWeChat]，以下代码无需执行。

//app.MapGrpcService<GreeterService>();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
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

#region ------- Microi.net -------

//-------Microi.net初始化
// app.UseMicroi();//初始化平台，暂时不需要
app.UseMicroiJob();//初始化任务计划
app.UseMicroiMQ();//初始化消息队列
app.UseMicroiUpgrade();//初始化平台自动升级
IWebHostEnvironment env = app.Environment;
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
    Console.WriteLine("Microi：【异常】接口引擎、数据源引擎动态接口地址配置失败：" + ex.Message);
}
Console.WriteLine("Microi：【成功】Microi初始化成功！");
//-----END

app.UseDeveloperExceptionPage();
app.UseSession();
app.UseCors("any");

//-------SignalR
app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromMinutes(20)
});
app.UseEndpoints(endpoints =>
{
    endpoints.MapHub<DiyWebSocket>(new PathString("/diy-websocket")
            ).RequireCors("any");
});

//-------Swagger
if (clientModel.EnableSwagger == 1)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
Console.WriteLine($"Microi：【成功】初始化成功！{DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")}。耗时：{timer.ElapsedMilliseconds}ms");
timer.Stop();

#endregion ------- Microi.net -------

Console.WriteLine($"Microi：【成功】开始访问系统吧！访问地址一般是【/Microi.net.Api/Properties/launchSettings.json】里的applicationUrl属性值【https://localhost:7266】");

app.Run();
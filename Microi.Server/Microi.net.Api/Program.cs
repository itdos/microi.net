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
Console.WriteLine("Microi：开始初始化！" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
Stopwatch timer = new Stopwatch();
timer.Start();
services.AddMicroi();
//注入Microi.net低代码平台相关功能【必须】
services.AddMicroiWeChat();//【可选】注入Microi.WeChat微信公众号平台插件
services.AddMicroiOffice();//【可选】注入Microi.Office插件
services.AddMicroiSpider();//【可选】注入Microi.Spider采集引擎插件
services.AddMicroiJob().MicroiSyncTaskTime(services.BuildServiceProvider());;//【可选】注入Microi.Job任务调度插件
services.AddMicroiMQ().MicroiConsumerInit(services.BuildServiceProvider());;//【可选】注入Microi.MQ消息队列插件插件
services.AddMicroiSearchEngine();;//【可选】注入Microi.SearchEngine搜索引擎插件
services.AddMicroiAI();;//【可选】注入Microi.AI插件

services.AddSingleton<IV8MethodExtend, V8MethodExtend>(); // 注册 MVC 项目中的 V8MethodExtend
services.AddSingleton<V8Method>(provider => new V8Method(provider.GetRequiredService<IV8MethodExtend>())); // 注册 V8Method
services.TryAddSingleton(typeof(DiyFilter<>));

//2023-03-31:这里DynamicRoute.Init没加await，但仍然是同步执行，导致程序启动长达10s+，所以新增Task.Run
Task.Run(async () => {
    //初始化 DynamicApiEngine
    foreach (var item in OsClient.ClientList)
    {
        await DynamicRoute.Init(item.Value);
    }
});
//-------
Console.WriteLine("Microi：初始化接口引擎、数据源引擎动态接口！" + DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"));
services.AddSingleton<DynamicRoute>();

#region IS4 服务端 --【2024-12-22废弃IS4配置】
/*
#region RSA 
//RSA：证书长度2048以上，否则抛异常
var rsa = new RSACryptoServiceProvider();
rsa.ImportCspBlob(Convert.FromBase64String(ConfigHelper.GetAppSettings("IS4SigningCredential")));
//var rsa = RSA.Create();
//rsa.ImportParameters(new RSAParameters());
#endregion

//IdentityServer4授权服务配置，要在services.AddAuthentication("Bearer")之前执行
var is4 = services.AddIdentityServer()
    .AddSigningCredential(new RsaSecurityKey(rsa), IdentityServer4.IdentityServerConstants.RsaSigningAlgorithm.RS512)
    .AddInMemoryIdentityResources(IS4Config.GetIR())
    .AddInMemoryApiScopes(IS4Config.GetApis())
    .AddInMemoryClients(IS4Config.GetClients())
    //如果是client credentials模式那么就不需要设置验证User了
    .AddResourceOwnerValidator<ResourceOwnerPasswordValidator>()//User验证接口  //2023-10-16注释
    //.AddInMemoryUsers(OAuth2Config.GetUsers())    //将固定的Users加入到内存中 
    .AddProfileService<ProfileService>()//2023-10-16注释
    ;
*/
#endregion

//builder.Services.AddGrpc();
services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            // var osClient = OsClient.OsClientName;
            // options.Authority = OsClient.GetClient(osClient).AuthServer;
            //var apiBaseInternal = Environment.GetEnvironmentVariable("ApiBaseInternal", EnvironmentVariableTarget.Process) ?? ConfigHelper.GetAppSettings("ApiBaseInternal") ?? "";
            //if (!apiBaseInternal.DosIsNullOrWhiteSpace())
            //{
            //    options.Authority = apiBaseInternal;
            //}
            //获取或设置元数据地址或权限是否需要HTTPS。默认是true。这应该只在开发环境中禁用。
            options.RequireHttpsMetadata = false;

            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidAudience = "microi",
                ValidateLifetime = true,
                ValidateAudience = true,//2024-12-22修改为true
                ValidateIssuer = true,//2024-09-29新增，2024-12-22修改为true
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(ConfigHelper.GetAppSettings("IS4SigningCredential"))),//2024-09-29新增
            };
            // options.MapInboundClaims = false;//加了这句貌似没用
            options.SaveToken = true;
            options.Audience = "microi";
        });
services.AddAuthorization();
// options =>
// {
//     options.AddPolicy("Microi", policy =>
//     {
//         policy.RequireAuthenticatedUser();
//         policy.RequireClaim("scope", "microi");
//     });
// }

services.TryAddSingleton(typeof(Microi.net.Api.DiyFilterCustom<>));
//-------获取OsClient对象
var osClientName = Environment.GetEnvironmentVariable("OsClient", EnvironmentVariableTarget.Process) ?? (ConfigHelper.GetAppSettings("OsClient") ?? "");
var clientModel = OsClient.GetClient(osClientName);
services.AddMicroiCaptcha(clientModel);//注入验证码插件【可选】
services.AddSession(opt =>
{
    opt.IdleTimeout = TimeSpan.FromMinutes(20);
});
services.AddHttpClient();
//services.AddHttpClient("WeChat",(client) =>
//{
//    client.BaseAddress = new Uri(clientModel.WeChatBaseUrl);
//});
services.AddUEditorService("ueditor.json", true, AppContext.BaseDirectory + "/wwwroot/");

//-------跨域
services.AddCors(options =>
{
    options.AddPolicy("any", builder =>
    {
        builder
            .SetIsOriginAllowed(s => true)
            // .AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader()
            .AllowCredentials();
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

//var redisSessionResult = services.AddDistributedRedisCache(options =>
//{
//    options.Configuration = redisConnectiong;
//    options.InstanceName = clientModel.OsClient + "_session:";
//});

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
#endregion


#region Swagger
if(!clientModel.EnableSwagger)
{
    services.AddSwaggerGen(s =>
    {
        var microiNetDllVersion = "";
        try
        {
            microiNetDllVersion = FileVersionInfo.GetVersionInfo((Debugger.IsAttached ? ConfigHelper.GetAppSettings("DebuggerFolder").DosTrimStart('/').DosTrimEnd('/') + "/" : "") + "Microi.net.dll").FileVersion + " - 20241224";
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
#endregion

//-------json.net
services.AddControllersWithViews()
        .AddNewtonsoftJson(options =>
{
    //取消json首字母小写
    options.SerializerSettings.ContractResolver = new DefaultContractResolver();
    options.SerializerSettings.DateFormatString = "yyyy-MM-dd HH:mm:ss";
    options.SerializerSettings.DateParseHandling = DateParseHandling.None; // 禁用日期解析
});
// services.AddRazorRuntimeCompilation();

//services.Configure<MvcOptions>(opt =>
//{
//    opt.ModelBinderProviders.Insert(0, new CustFmtBinderProviderV2(opt));
//});

Console.WriteLine("Microi：services相关执行成功！");
#endregion



#region region 添加微信配置（一行代码）。--若没有注入[AddMicroiWeChat]，以下代码无需执行。

//Senparc.Weixin 注册（必须）
builder.Services.AddSenparcWeixinServices(builder.Configuration);
//Senparc.CO2NET.Cache.Redis.Register.SetConfigurationOption($"{clientModel.RedisHost}:{clientModel.RedisPort},password={clientModel.RedisPwd}");
Senparc.CO2NET.Cache.Redis.Register.SetConfigurationOption(redisConnectiong);
CacheStrategyFactory.RegisterObjectCacheStrategy(() => RedisObjectCacheStrategy.Instance);

#endregion

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

#region 启用微信配置（一句代码）。--若没有注入[AddMicroiWeChat]，以下代码无需执行。

//手动获取配置信息可使用以下方法
//var senparcWeixinSetting = app.Services.GetService<IOptions<SenparcWeixinSetting>>()!.Value;

//启用微信配置（必须）
var registerService = app.UseSenparcWeixin(app.Environment,
    /* 不为 null 则覆盖 appsettings  中的 SenparcSetting 配置*/
    //null
    new SenparcSetting() {
        IsDebug = false,
        DefaultCacheNamespace = "MicroiWeChatCache",
        //Cache_Redis_Configuration = $"{clientModel.RedisHost}:{clientModel.RedisPort},password={clientModel.RedisPwd}"
        Cache_Redis_Configuration = redisConnectiong
    }
    ,
    /* 不为 null 则覆盖 appsettings  中的 SenpacWeixinSetting 配置*/
    null,
    register => {
        /* CO2NET 全局配置 */
    },
    (register, weixinSetting) => {
        //注册公众号信息（可以执行多次，注册多个公众号）
        //register.RegisterMpAccount(weixinSetting, "【Microi】公众号");
        //其它地方实现动态注册
        //register.RegisterMpAccount("wxb5758292bc0b6d25", "xxx", "宁波交投咨询服务号");
        //register.RegisterMpAccount("wxb3fb0a1b44902df3", "xxx", "微吾科技");
    }
);

#endregion

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

#region IS4 服务端 --【2024-12-22废弃IS4配置】
//app.UseIdentityServer();
#endregion

//-------注意以下两者的顺序-------
app.UseAuthentication();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

#region ------- Microi.net -------
//-------Microi.net初始化
// app.UseMicroi();//【必须】
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
    Console.WriteLine("Microi：接口引擎、数据源引擎动态接口地址配置成功！");
}
catch (Exception ex)
{
    Console.WriteLine("Microi：接口引擎、数据源引擎动态接口地址配置失败：" + ex.Message);
}

Console.WriteLine("Microi：app.UseMicroi(env) 执行成功！");
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
if(clientModel.EnableSwagger)
{
    app.UseSwagger();
    app.UseSwaggerUI(
    // s =>
    // {
    //     s.SwaggerEndpoint("/swagger/v1/swagger.json", "Microi.net api v1.8.3.4");
    // }
    );
}

Console.WriteLine($"Microi：初始化成功！{DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")}。耗时：{timer.ElapsedMilliseconds}ms");
timer.Stop();
#endregion

Console.WriteLine($"Microi：开始访问系统吧！访问地址一般是【/Microi.net.Api/Properties/launchSettings.json】里的applicationUrl属性值【https://localhost:7266】");

app.Run();

//【MacOS VS Code】折叠代码快捷键：【command + K + 0】

#region using
using System.Net;
using System.Text;
using System.Diagnostics;
using Dos.Common;
using Microi.License;
using Microi.net;
using Microi.net.Api;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.OpenApi;
using Newtonsoft.Json.Serialization;
using Senparc.CO2NET;
using Senparc.Weixin.AspNet;
using Senparc.Weixin.RegisterServices;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.SignalR;
using Newtonsoft.Json;
using Microsoft.AspNetCore.Hosting.StaticWebAssets;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.Cors.Infrastructure;
using StackExchange.Redis;
using Newtonsoft.Json.Linq;
#endregion

// 调试/集成终端下中文与 emoji 输出更稳定（Windows 默认代码页易导致乱码）
Console.OutputEncoding = Encoding.UTF8;
Console.InputEncoding = Encoding.UTF8;

// ⚙️ 注册 Console 分流器：平台级关键日志保留 stdout，其它历史 Console 日志写入 MongoDB。
Console.SetOut(new Microi.net.ConsoleLogInterceptor(Console.Out));
Console.SetError(new Microi.net.ConsoleLogInterceptor(Console.Error));

// 🔧 本地环境快速切换：读取 .microi-local 文件（已加入 .gitignore，每位开发者本地独立配置）
// 优先级：IDE 环境变量（launch.json env / launchSettings.json）> .microi-local > 系统环境变量
// 切换方式：编辑 Microi.Server/Microi.net.Api/.microi-local，写入环境名（如 iTdos / renyiPro）
//           或执行 PowerShell：.\switch-env.ps1 renyiPro
if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")))
{
    // 依次查找：cwd（dotnet run / F5 调试 cwd）→ bin/Debug/net10.0 上三级（项目根）
    var localEnvFile = new[]
    {
        Path.Combine(Directory.GetCurrentDirectory(), ".microi-local"),
        Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".microi-local")
    }.FirstOrDefault(File.Exists);
    if (localEnvFile != null)
    {
        var localEnv = File.ReadAllText(localEnvFile).Trim();
        if (!string.IsNullOrEmpty(localEnv))
        {
            Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", localEnv);
            Environment.SetEnvironmentVariable("DOTNET_ENVIRONMENT", localEnv);
            Console.WriteLine($"Microi：【🔧本地环境】已从 .microi-local 加载：{localEnv}");
        }
    }
}

var builder = WebApplication.CreateBuilder(args);
Console.WriteLine(
    $"Microi：【诊断】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】EnvironmentName={builder.Environment.EnvironmentName}，" +
    "ASPNETCORE_ENVIRONMENT=" + (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "(null)") + "，" +
    "DOTNET_ENVIRONMENT=" + (Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT") ?? "(null)"));
var startupAddresses = StartupDiagnostics.GetConfiguredAddresses(builder.Configuration);
var startupOccupiedAddresses = StartupDiagnostics.FindOccupiedAddresses(startupAddresses);
if (startupOccupiedAddresses.Count > 0)
{
    StartupDiagnostics.WriteAddressInUseMessage(startupOccupiedAddresses);
    Environment.ExitCode = 1;
    return;
}

#region Microi.net 初始化
StaticWebAssetsLoader.UseStaticWebAssets(builder.Environment, builder.Configuration);
// ------- 文件上传大小限制 -------
// 启动接收层只负责提供统一的固定安全硬顶；租户业务开关、单文件、单次总量、
// 文件数与日额度均在请求进入 HDFS 后从 sys_osclients 动态读取。
// 不再要求安装者用额外环境变量重复维护同一套配置。
const int maxRequestBodyMb = 2048;
const int maxMultipartBodyMb = 2048;
const int maxFormValueMb = 128;
var maxRequestBodyBytes = maxRequestBodyMb * 1024L * 1024L;
var maxMultipartBodyBytes = maxMultipartBodyMb * 1024L * 1024L;
var maxFormValueBytes = maxFormValueMb * 1024L * 1024L;

//USE LINUX【发布到Linux使用以下代码】
builder.WebHost.UseKestrel((host, options) =>
{
    // Long-running V8/API engine requests should not be aborted by Kestrel while business logic is still executing.
    // Kestrel has no request-processing timeout by default; disable data-rate timeouts for slow request/response streams.
    options.Limits.MinRequestBodyDataRate = null;
    options.Limits.MinResponseDataRate = null;
    options.Limits.MaxRequestLineSize = 32 * 1024;
    options.Limits.MaxRequestBufferSize = 1024 * 1024;
    options.Limits.MaxRequestBodySize = maxRequestBodyBytes;
});
//USE IIS【发布到Windows IIS使用以下代码】
//builder.WebHost.UseIISIntegration();
var services = builder.Services;
services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    // 只接受离 Kestrel 最近的一跳。框架保留安全的 loopback 默认值；其它反向代理
    // 必须在 KnownProxies/KnownNetworks 明确配置，公网请求自报 XFF 不会被采信。
    options.ForwardLimit = 1;
    var forwardedHeaderKnownProxies = (ConfigHelper.GetRuntimeConfigurationValue(
            "ForwardedHeaders:KnownProxies") ?? "")
        .Split(new[] { ',', ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
        .Where(item => !string.IsNullOrWhiteSpace(item))
        .Select(item => item.Trim())
        .Distinct(StringComparer.OrdinalIgnoreCase);
    var forwardedHeaderKnownNetworks = (ConfigHelper.GetRuntimeConfigurationValue(
            "ForwardedHeaders:KnownNetworks") ?? "")
        .Split(new[] { ',', ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
        .Where(item => !string.IsNullOrWhiteSpace(item))
        .Select(item => item.Trim())
        .Distinct(StringComparer.OrdinalIgnoreCase);
    foreach (var value in forwardedHeaderKnownProxies)
    {
        if (IPAddress.TryParse(value, out var proxy))
        {
            options.KnownProxies.Add(proxy);
        }
    }
    foreach (var value in forwardedHeaderKnownNetworks)
    {
        if (System.Net.IPNetwork.TryParse(value, out var network))
        {
            options.KnownIPNetworks.Add(network);
        }
    }
});
services.Configure<FormOptions>(options =>
{
    options.ValueLengthLimit = checked((int)Math.Min(maxFormValueBytes, int.MaxValue));
    options.MultipartBodyLengthLimit = maxMultipartBodyBytes;
});
Console.WriteLine(
    $"Microi：【文件安全】HTTP正文上限{maxRequestBodyMb}MB，Multipart上限{maxMultipartBodyMb}MB，" +
    $"单个表单值上限{maxFormValueMb}MB。");
Console.WriteLine($"------------------------------------------------------------------------------");
Console.WriteLine($"------------------------------------------------------------------------------");
Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】开始初始化！");
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
Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】您的平台服务器端版本号：v{microiNetDllVersion}");
// ORM 引擎：Dos.ORM
services.AddMicroi();//【必须】Microi初始化
services.AddMicroiORM();//【必须】注入【数据库ORM】插件
services.AddMicroiCache();//【必须】注入【分布式缓存】插件
services.AddMicroiHttp();//【必须】注入【Http】插件
services.AddMicroiMongoDB();//【可选】注入【MongoDB】插件
// 所有SysLog/用户行为日志统一由单消费者后台服务批量、幂等持久化。
services.AddSingleton(SysLogQueueOptions.CreateDefault());
services.AddSingleton<SysLogQueueService>();
services.AddSingleton<ISysLogQueue>(sp => sp.GetRequiredService<SysLogQueueService>());
services.AddHostedService(sp => sp.GetRequiredService<SysLogQueueService>());
// 进程级内存最后防线：软阈值退出流量，硬阈值有界停机，避免单节点拖垮宿主机。
services.AddSingleton(ProcessMemoryGuardOptions.CreateDefault());
services.AddSingleton<ProcessMemoryPressureState>();
services.AddHostedService<ProcessMemoryGuardService>();
services.AddHostedService<BackgroundTaskWorkerService>();
services.AddSingleton<UserBehaviorSessionTracker>();
services.AddSingleton<IPrivateFileAuditLinkService, PrivateFileAuditLinkService>();
// zhy：注册无进程内业务状态的微信内容安全服务，审核事实统一存放共享 Redis。
services.AddSingleton<WeChatContentSecurityService>();
services.AddMicroiUpgrade();//【可选】注入【平台自动更新】插件
services.AddMicroiWeChat();//【可选】注入【微信公众号平台】插件
services.AddMicroiOffice();//【可选】注入【Office】插件
services.AddMicroiSpider();//【可选】注入【采集引擎】插件
services.AddMicroiOCR();//【可选】注入【OCR识别】插件
services.AddMicroiMQ();//【可选】注入【MQ消息队列】插件
services.AddMicroiSearchEngine();//【可选】注入【搜索引擎】插件
services.AddMicroiAI();//【可选】注入【AI引擎】插件
services.AddMicroiMQTT();//【可选】注入【MQTT引擎】插件
services.AddMicroiHDFS();//【可选】注入【分布式存储】插件
services.AddHostedService<ApplicationAssetAliasReconciliationWorkerService>();
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
            .Where(e => e.Value?.Errors.Count > 0)
            .Select(e => e.Value?.Errors.First().ErrorMessage)
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
services.AddControllersWithViews(options =>
{
    // 添加自定义 ModelBinder，支持同时接收 form-data 和 JSON
    options.ModelBinderProviders.Insert(0, new FormDataOrJsonModelBinderProvider());
}).AddRazorRuntimeCompilation().AddNewtonsoftJson(options =>
{
    //取消json首字母小写
    options.SerializerSettings.ContractResolver = new DefaultContractResolver();
    options.SerializerSettings.DateFormatString = "yyyy-MM-dd HH:mm:ss";
    options.SerializerSettings.DateParseHandling = DateParseHandling.None; // 禁用日期解析
    // 确保整数值的 double 序列化为整数格式（防止 0 变成 0.0）
    options.SerializerSettings.Converters.Add(new IntegerDoubleConverter());
});
//services.AddGrpc();
Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】Microi所有初始化成功！");
#endregion

#region SignalR、Redis
var redisConn = RedisConnBuilder.BuildDefaultRedisConn();
var showSignalRDetailedErrors = builder.Environment.IsDevelopment();
var signalRBuilder = services.AddSignalR(options =>
{
    options.EnableDetailedErrors = showSignalRDetailedErrors;
    //客户端发保持连接请求到服务端最长间隔，默认30秒，改成4分钟，网页需跟着设置connection.keepAliveIntervalInMilliseconds = 12e4;即2分钟
    options.ClientTimeoutInterval = TimeSpan.FromMinutes(20);
    //服务端发保持连接请求到客户端间隔，默认15秒，改成2分钟，网页需跟着设置connection.serverTimeoutInMilliseconds = 24e4;即4分钟
    options.KeepAliveInterval = TimeSpan.FromMinutes(20);
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
signalRBuilder.AddHubOptions<GameRealtimeHub>(options =>
{
    // 游戏 Hub 只接收小型订阅命令，限制输入体并使用更短的断线检测周期；
    // 权威牌局数据继续通过接口引擎 Snapshot 返回，不经过 SignalR。
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(45);
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.MaximumReceiveMessageSize = 16 * 1024;
    options.EnableDetailedErrors = showSignalRDetailedErrors;
});
signalRBuilder.AddHubOptions<ApiEngineRealtimeHub>(options =>
{
    // 通用 Hub 只接收 ChannelKey + SubjectId；服务端可推送小型安全事件投影，
    // 业务事实仍由接口引擎与共享存储维护，版本缺口通过 HTTP Snapshot 收敛。
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(45);
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.MaximumReceiveMessageSize = 16 * 1024;
    options.EnableDetailedErrors = showSignalRDetailedErrors;
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
            // Url = new Uri((clientModel.OsClientModel["DomainName"].Val<string>().DosIsNullOrWhiteSpace() || clientModel.OsClientModel["DomainName"].Val<string>().Contains("$"))
            //                 ? "https://microi.net"
            //                 : (clientModel.OsClientModel["DomainName"].Val<string>().Contains("http") ? clientModel.OsClientModel["DomainName"].Val<string>() : "http://" + clientModel.OsClientModel["DomainName"].Val<string>())
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

// 必须先由框架验证直接对端是否为受信代理，再把 X-Forwarded-For 投影到
// Connection.RemoteIpAddress。SecurityGuard 自身永远不直接解析客户端 Header。
app.UseForwardedHeaders();

// Production 内置异常页先注册为外层保险；吾码全局异常处理必须在其内层，
// 否则 UseExceptionHandler 会先吞掉 Kestrel/Multipart 异常，无法返回标准 DosResult。
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

// ========== 吾码全局异常处理中间件 ==========
app.UseGlobalExceptionHandler();

// HDFS 上传响应暴露当前 API 进程的启动级解析硬顶，便于区分租户业务额度与
// nginx/Kestrel/Multipart 限制。这里只返回容量，不包含任何租户密钥或连接信息。
app.Use(async (context, next) =>
{
    if (RequestBodyLimitError.IsHdfsUploadPath(context.Request.Path))
    {
        context.Response.OnStarting(() =>
        {
            context.Response.Headers["X-Microi-Upload-Max-Request-MB"] = maxRequestBodyMb.ToString();
            context.Response.Headers["X-Microi-Upload-Max-Multipart-MB"] = maxMultipartBodyMb.ToString();
            context.Response.Headers["X-Microi-Upload-Limit-Source"] = "api-startup";
            return Task.CompletedTask;
        });
    }

    await next();
});

app.UseHttpsRedirection();
app.MapStaticAssets();
app.Use(async (context, next) =>
{
    var method = context.Request.Method;
    var contentType = context.Request.ContentType ?? "";
    if ((HttpMethods.IsPost(method) || HttpMethods.IsPut(method) || HttpMethods.IsPatch(method))
        && !contentType.Contains("multipart/form-data", StringComparison.OrdinalIgnoreCase)
        && (context.Request.ContentLength ?? 0) <= 10 * 1024 * 1024)
    {
        context.Request.EnableBuffering();
    }
    await next();
});
app.UseRouting();
// 安全防护可能在 Controller 前直接返回 DosResult。CORS 必须先执行，
// 否则独立部署的前端无法读取 SecurityBlocked JSON，会误报成 API 不可用。
app.UseCors("any");
app.UseSecurityGuard();
app.UseRequestPressureGuard();
//-------注意以下两者的顺序-------
app.UseAuthentication();
app.UseAuthorization();
app.MapDynamicControllerRoute<DynamicRoute>("apiengine/{*path}");
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");
#endregion

#region Microi.net 启用
MicroiEngine.Init(app.Services);
Dos.ORM.Database.OnConnectionGuardEvent += (eventName, guardKey, message) =>
{
    var title = eventName == "MySqlHostCacheRepairSucceeded"
        ? "MySQL host_cache 自动修复成功"
        : "MySQL host_cache 自动修复失败";
    var level = eventName == "MySqlHostCacheRepairSucceeded" ? 2 : 3;
    var osClientForLog = OsClient.GetConfigOsClient();
    Console.WriteLine($"Microi：【数据库连接保护】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】{title}，GuardKey={guardKey}，Msg={message}");
    _ = Task.Run(async () =>
    {
        try
        {
            await MicroiEngine.MongoDB.AddSysLog(new SysLogParam
            {
                OsClient = osClientForLog,
                Type = "数据库连接保护",
                Title = title,
                Content = $"GuardKey={guardKey}\n{message}",
                Level = level
            });
        }
        catch
        {
        }
    });
};
app.UseMicroi();      // 初始化 SaaS 引擎（同步加载 sys_osclients → ClientList）
app.UseMicroiJob();   // 启用任务计划
app.UseMicroiMQ();    // 启用消息队列
app.MapHub<DiyWebSocket>("/diy-websocket").RequireCors("any");
app.MapHub<GameRealtimeHub>(GameRealtimeRuntime.HubPath).RequireCors("any");
app.MapHub<ApiEngineRealtimeHub>(ApiEngineRealtimeRuntime.HubPath).RequireCors("any");
var realtimeHubContext = app.Services.GetRequiredService<Microsoft.AspNetCore.SignalR.IHubContext<DiyWebSocket>>();
RealtimePushRuntime.Configure((connectionIds, eventName, payload) =>
    realtimeHubContext.Clients.Clients(connectionIds.ToList()).SendAsync(eventName, payload));
var gameRealtimeHubContext = app.Services.GetRequiredService<Microsoft.AspNetCore.SignalR.IHubContext<GameRealtimeHub>>();
RealtimePushRuntime.ConfigureGroups((groupName, eventName, payload) =>
    gameRealtimeHubContext.Clients.Group(groupName).SendAsync(eventName, payload));
var apiEngineRealtimeHubContext = app.Services.GetRequiredService<Microsoft.AspNetCore.SignalR.IHubContext<ApiEngineRealtimeHub>>();
RealtimePushRuntime.ConfigureGroups(
    ApiEngineRealtimeRuntime.TransportName,
    (groupName, eventName, payload) =>
        apiEngineRealtimeHubContext.Clients.Group(groupName).SendAsync(eventName, payload));

// 解析主租户名称（统一使用 OsClient.GetConfigOsClient，避免在 Program.cs 里重复读取 env / appsettings）
var osClientName = OsClient.GetConfigOsClient();
if (osClientName.DosIsNullOrWhiteSpace())
{
    osClientName = OsClientDefault.OsClient;
}

// 【关键修复】确保主租户的 OsClientModel 已从 sys_osclients 表中正确挂载，
// 否则 InitializeDefaultClient 创建的占位模型不会包含 MqttEnable / EnableSwagger 等 DB 字段，
// 导致 MQTT 等可选模块无法按配置启动。
if (!OsClient.EnsureHydrated(osClientName))
{
    Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】主租户[{osClientName}]的 OsClientModel 未能从 sys_osclients 完整挂载，部分 DB 配置项将以默认值生效。");
}
var clientModel = OsClient.GetClient(osClientName);
var jwtSigningKeyStatus = DiyToken.GetJwtSigningKeyStatus(clientModel);
if (!jwtSigningKeyStatus.Ready)
{
    throw new InvalidOperationException(jwtSigningKeyStatus.Message);
}
Console.WriteLine($"Microi：【安全】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】JWT签名密钥发布门禁通过：Source={jwtSigningKeyStatus.Source}，Fingerprint={jwtSigningKeyStatus.Fingerprint}");
// 自动升级必须在主租户完成 Hydrate 后启动。否则首次启动时 ClientList 仍为空，
// 后台任务会静默遍历零个租户，导致本应执行的数据库迁移被跳过。
app.UseMicroiUpgrade();// 启用平台自动升级
#endregion

#region Redis
redisConn = RedisConnBuilder.Build(clientModel);
#endregion

#region License 自动恢复
var scheduleLicenseRestoreRetry = false;
try
{
    var licenseRestoreResult = await LicenseServerStore.RestoreCurrentServerLicenseAsync(osClientName);
    if (licenseRestoreResult != null && licenseRestoreResult.Code == 1)
    {
        Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】{licenseRestoreResult.Msg}");
    }
    else if (licenseRestoreResult != null && licenseRestoreResult.Code == 2)
    {
        Console.WriteLine($"Microi：【ℹ️提示】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】License自动恢复跳过：{licenseRestoreResult.Msg}");
    }
    else
    {
        scheduleLicenseRestoreRetry = true;
        Console.WriteLine($"Microi：【⚠️注意】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】License自动恢复首次执行未完成：{licenseRestoreResult?.Msg ?? "未返回执行结果"}，应用启动后将自动重试。");
    }
}
catch (Exception ex)
{
    scheduleLicenseRestoreRetry = true;
    Console.WriteLine($"Microi：【⚠️注意】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】License自动恢复首次执行失败：{ex.Message}，应用启动后将自动重试。");
}

if (scheduleLicenseRestoreRetry)
{
    var lifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();
    lifetime.ApplicationStarted.Register(() =>
    {
        _ = Task.Run(async () =>
        {
            const int maxAttempts = 3;
            const int retrySeconds = 10;

            for (var attempt = 1; attempt <= maxAttempts; attempt++)
            {
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(retrySeconds), lifetime.ApplicationStopping);

                    // 编排更新时数据库通常晚于 API 就绪；每次重试先重新挂载主租户连接。
                    OsClient.EnsureHydrated(osClientName);
                    var retryResult = await LicenseServerStore.RestoreCurrentServerLicenseAsync(osClientName);
                    if (retryResult != null && retryResult.Code == 1)
                    {
                        Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】License自动恢复重试第{attempt}次成功：{retryResult.Msg}");
                        return;
                    }

                    if (retryResult != null && retryResult.Code == 2)
                    {
                        Console.WriteLine($"Microi：【ℹ️提示】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】License自动恢复重试停止：{retryResult.Msg}");
                        return;
                    }

                    Console.WriteLine($"Microi：【⚠️注意】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】License自动恢复重试第{attempt}/{maxAttempts}次未完成：{retryResult?.Msg ?? "未返回执行结果"}");
                }
                catch (OperationCanceledException) when (lifetime.ApplicationStopping.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：【⚠️注意】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】License自动恢复重试第{attempt}/{maxAttempts}次失败：{ex.Message}");
                }
            }

            Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】License自动恢复在{maxAttempts}次重试后仍未完成，请检查主租户数据库及表[{LicenseServerStore.TableName}]。");
        });
    });
}
#endregion

#region MQTT（在主机完全启动后再启动 Broker，确保依赖注入与 V8 引擎就绪）
if (clientModel.OsClientModel["MqttEnable"].Val<int>() == 1)
{
    var lifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();
    lifetime.ApplicationStarted.Register(() =>
    {
        _ = Task.Run(async () =>
        {
            try
            {
                // 再次取最新 clientModel（防止启动期间被 V8 ReloadOsClient 刷新过）
                var latest = OsClient.GetClient(osClientName);
                var mqttService = app.Services.GetRequiredService<IMicroiMQTT>();
                await mqttService.StartServerAsync(latest);
                if (mqttService.IsRunning)
                {
                    Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】【MQTT】插件启动成功！");
                }
                else
                {
                    Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】【MQTT】插件未能启动，请查看系统日志中的 MQTT 诊断信息。");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】MQTT延迟启动失败：{ex.Message}");
            }
        });
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

#region 接口引擎 / 数据源引擎动态路由
try
{
    app.MapDynamicControllerRoute<DynamicRoute>("{controller}");
    app.MapDynamicControllerRoute<DynamicRoute>("{controller}/{action}");
    app.MapDynamicControllerRoute<DynamicRoute>("{controller}/{action}/{param1}");
    app.MapDynamicControllerRoute<DynamicRoute>("{controller}/{action}/{param1}/{param2}");
    app.MapDynamicControllerRoute<DynamicRoute>("{controller}/{action}/{param1}/{param2}/{param3}");
    app.MapDynamicControllerRoute<DynamicRoute>("{controller}/{action}/{param1}/{param2}/{param3}/{param4}");
    app.MapDynamicControllerRoute<DynamicRoute>("{controller}/{action}/{param1}/{param2}/{param3}/{param4}/{param5}");
    Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】接口引擎、数据源引擎动态接口地址配置成功！");
}
catch (Exception ex)
{
    Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】接口引擎、数据源引擎动态接口地址配置失败：{ex.Message}");
}
#endregion

#region 其它
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】开发环境诊断模式已启用");
}
app.UseSession();
app.UseWebSockets(new WebSocketOptions
{
    KeepAliveInterval = TimeSpan.FromMinutes(20)
});
app.UseMiddleware<V8DebugWebSocketMiddleware>(); // V8 逐行调试 WebSocket
if (clientModel.OsClientModel["EnableSwagger"].Val<int>() == 1)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
#endregion

#region 应用完全启动后的延迟初始化（接口引擎缓存 / 多语言元数据）
{
    var lifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();
    lifetime.ApplicationStarted.Register(() =>
    {
        timer.Stop();
        var listeningAddresses = StartupDiagnostics.GetConfiguredAddresses(app);
        Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】Microi全部启动成功！总耗时：{timer.ElapsedMilliseconds}ms");
        Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】开始访问系统吧！访问地址：【{string.Join("、", listeningAddresses)}】");
        Console.WriteLine("------------------------------------------------------------------------------");
        Console.WriteLine("------------------------------------------------------------------------------");

        _ = Task.Run(async () =>
        {
            // 接口引擎初始化（并行，租户数量可能较大）
            try
            {
                var maxConcurrency = ConfigHelper.GetRuntimeConfigurationInt(
                    "StartupLimits:DynamicRouteInitMaxConcurrency",
                    2);
                var startupGate = new System.Threading.SemaphoreSlim(maxConcurrency, maxConcurrency);
                var initTasks = OsClient.ClientList.Values.Select(async c =>
                {
                    await startupGate.WaitAsync();
                    try
                    {
                        await new DynamicRoute().Init(c);
                    }
                    finally
                    {
                        startupGate.Release();
                    }
                }).ToList();
                await Task.WhenAll(initTasks);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】接口引擎初始化失败：{ex.Message}");
            }

            // 多语言元数据延迟修复
            try
            {
                _ = Task.Run(async () =>
                {
                    await Task.Delay(TimeSpan.FromMinutes(2));
                    var startupOsClients = OsClientExtend.ClientList.Keys
                        .Where(item => !item.DosIsNullOrWhiteSpace())
                        .Distinct(StringComparer.OrdinalIgnoreCase)
                        .ToList();
                    if (startupOsClients.Count == 0)
                    {
                        var configOsClient = OsClient.GetConfigOsClient();
                        if (!configOsClient.DosIsNullOrWhiteSpace())
                        {
                            startupOsClients.Add(configOsClient);
                        }
                    }
                    foreach (var item in startupOsClients)
                    {
                        await MicroiEngine.FormEngine.RepairMissingDiyLangTranslationsAsync(item, "startup");
                    }
                    Console.WriteLine($"Microi：【多语言】{DateTime.Now:yyyy-MM-dd HH:mm:ss} 已排队同步 diy_lang 元数据与前端固定文案。");
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【多语言】{DateTime.Now:yyyy-MM-dd HH:mm:ss} 排队同步 diy_lang 失败：{ex.Message}");
            }

        });
    });
}
#endregion

var configuredAddresses = StartupDiagnostics.GetConfiguredAddresses(app);
try
{
    app.Run();
}
catch (Exception ex) when (StartupDiagnostics.IsAddressAlreadyInUse(ex))
{
    timer.Stop();
    StartupDiagnostics.WriteAddressInUseMessage(configuredAddresses);
    Environment.ExitCode = 1;
}
catch (Exception ex)
{
    timer.Stop();
    StartupDiagnostics.WriteUnexpectedStartupFailure(ex);
    Environment.ExitCode = 1;
}

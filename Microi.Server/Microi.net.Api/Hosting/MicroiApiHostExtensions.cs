using System.Diagnostics;
using System.IO.Compression;
using System.Net;
using System.Text;
using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.Hosting.StaticWebAssets;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.ResponseCompression;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

// ASP.NET Core 宿主组合与传输管线。
namespace Microi.net.Api;

/// <summary>
/// 仅属于 ASP.NET Core 宿主的固定传输配置。租户业务、升级、应用资源和插件
/// 运行逻辑不得进入这里；Program.cs 只保留插件注册与生命周期编排。
/// </summary>
public static class MicroiApiHostExtensions
{
    public const int MaxRequestBodyMb = 2048;
    public const int MaxMultipartBodyMb = 2048;
    public const int MaxFormValueMb = 128;

    public sealed record HostContext(
        Stopwatch Timer,
        string ServerVersion,
        string DatabaseTypeName,
        string DatabaseConnection,
        string RedisConnection);

    public static void InitializeMicroiProcess()
    {
        Console.OutputEncoding = Encoding.UTF8;
        Console.InputEncoding = Encoding.UTF8;
        Console.SetOut(new ConsoleLogInterceptor(Console.Out));
        Console.SetError(new ConsoleLogInterceptor(Console.Error));
        LoadLocalEnvironment();
    }

    /// <summary>
    /// 准备固定 ASP.NET Core 宿主上下文。这里只处理端口、版本和基础连接，
    /// 不读取或编排任何租户业务资源。
    /// </summary>
    public static HostContext? PrepareMicroiApiHost(this WebApplicationBuilder builder)
    {
        Console.WriteLine(
            $"Microi：【成功】【诊断】EnvironmentName={builder.Environment.EnvironmentName}，" +
            "ASPNETCORE_ENVIRONMENT=" + (Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT") ?? "(null)") + "，" +
            "DOTNET_ENVIRONMENT=" + (Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT") ?? "(null)"));

        var occupiedAddresses = StartupDiagnostics.FindOccupiedAddresses(
            StartupDiagnostics.GetConfiguredAddresses(builder.Configuration));
        if (occupiedAddresses.Count > 0)
        {
            StartupDiagnostics.WriteAddressInUseMessage(occupiedAddresses);
            Environment.ExitCode = 1;
            return null;
        }

        var timer = Stopwatch.StartNew();
        var serverVersion = builder.ConfigureMicroiWebHost();
        var databaseTypeName = ResolveDatabaseTypeName();
        var databaseConnection = ResolveDatabaseConnection();
        var redisConnection = RedisConnBuilder.BuildDefaultRedisConn();

        Console.WriteLine("Microi：【成功】开始初始化！");
        Console.WriteLine($"Microi：【成功】您的平台服务器端版本号：v{serverVersion}");
        return new HostContext(timer, serverVersion, databaseTypeName, databaseConnection, redisConnection);
    }

    /// <summary>
    /// 统一拥有 ASP.NET Core 中间件、主租户升级门禁和宿主失败汇总。
    /// Program.cs 仅声明插件，任何业务或升级实现都不得回流到入口文件。
    /// </summary>
    public static async Task RunMicroiApiAsync(
        this WebApplicationBuilder builder,
        HostContext context)
    {
        var configuredAddresses = StartupDiagnostics.GetConfiguredAddresses(builder.Configuration);
        try
        {
            builder.Services.AddSingleton<MemoryDiagnosticsService>();
            builder.Services.AddSingleton<IMemoryDiagnosticsRuntime>(sp => sp.GetRequiredService<MemoryDiagnosticsService>());
            builder.Services.AddHostedService(sp => sp.GetRequiredService<MemoryDiagnosticsService>());
            builder.Services.AddHostedService<DatabasePoolRecoveryHostedService>();
            var app = builder.Build();
            app.UseMicroiApiTransport();

            MicroiEngine.Init(app.Services);
            app.UseMicroi();
            app.UseMicroiJob();
            app.UseMicroiMQ();
            app.MapMicroiRealtimeTransport();

            // Microi.Upgrade 完整拥有主租户启动前门禁；其它 SaaS 租户在开始
            // 监听后由升级 HostedService 后台维护，避免历史租户阻塞全站。
            var mainTenantResult = await app.Services
                .GetRequiredService<MicroiStartupGate>()
                .EnsureConfiguredMainTenantReadyAsync();
            if (mainTenantResult.Code != 1 || mainTenantResult.Data == null)
                throw new InvalidOperationException(mainTenantResult.Msg);

            var mainTenant = mainTenantResult.Data;
            var redisConnection = RedisConnBuilder.Build(mainTenant);
            app.UseMicroiWeChat(app.Environment, redisConnection);
            app.MapMicroiDynamicCompatibilityRoutes();
            app.UseMicroiApiFinalTransport(mainTenant);

            StartupDiagnostics.RegisterStartedReport(app, context.Timer);
            configuredAddresses = StartupDiagnostics.GetConfiguredAddresses(app);
            await app.RunAsync();
        }
        catch (Exception ex) when (StartupDiagnostics.IsAddressAlreadyInUse(ex))
        {
            context.Timer.Stop();
            StartupDiagnostics.WriteAddressInUseMessage(configuredAddresses);
            Environment.ExitCode = 1;
        }
        catch (Exception ex)
        {
            context.Timer.Stop();
            StartupDiagnostics.WriteUnexpectedStartupFailure(ex);
            Environment.ExitCode = 1;
        }
    }

    public static string ConfigureMicroiWebHost(this WebApplicationBuilder builder)
    {
        StaticWebAssetsLoader.UseStaticWebAssets(builder.Environment, builder.Configuration);
        var maxRequestBodyBytes = MaxRequestBodyMb * 1024L * 1024L;
        var maxMultipartBodyBytes = MaxMultipartBodyMb * 1024L * 1024L;
        var maxFormValueBytes = MaxFormValueMb * 1024L * 1024L;

        builder.WebHost.UseKestrel((host, options) =>
        {
            options.Limits.MinRequestBodyDataRate = null;
            options.Limits.MinResponseDataRate = null;
            options.Limits.MaxRequestLineSize = 32 * 1024;
            options.Limits.MaxRequestBufferSize = 1024 * 1024;
            options.Limits.MaxRequestBodySize = maxRequestBodyBytes;
        });

        builder.Services.Configure<ForwardedHeadersOptions>(options =>
        {
            options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
            options.ForwardLimit = 1;
            foreach (var proxy in ReadConfiguredIpAddresses("ForwardedHeaders:KnownProxies"))
                options.KnownProxies.Add(proxy);
            foreach (var network in ReadConfiguredNetworks("ForwardedHeaders:KnownNetworks"))
                options.KnownIPNetworks.Add(network);
            foreach (var proxy in ForwardedProxyTrustPolicy.DiscoverContainerGatewayProxies())
            {
                if (!options.KnownProxies.Contains(proxy)) options.KnownProxies.Add(proxy);
            }
        });
        builder.Services.Configure<FormOptions>(options =>
        {
            options.ValueLengthLimit = checked((int)Math.Min(maxFormValueBytes, int.MaxValue));
            options.MultipartBodyLengthLimit = maxMultipartBodyBytes;
        });
        Console.WriteLine(
            $"Microi：【成功】【文件安全】HTTP正文上限{MaxRequestBodyMb}MB，Multipart上限{MaxMultipartBodyMb}MB，单个表单值上限{MaxFormValueMb}MB。");
        return ResolveServerVersion();
    }

    public static IServiceCollection AddMicroiApiTransport(
        this IServiceCollection services,
        WebApplicationBuilder builder,
        string redisConnection,
        string serverVersion)
    {
        services.TryAddSingleton(typeof(DiyFilter<>));
        services.AddSingleton<DynamicRoute>();
        services.AddSingleton<IConfigureOptions<JwtBearerOptions>, JwtBearerOptionsConfigurator>();
        services.AddSingleton<IConfigureOptions<CorsOptions>, CorsOptionsConfigurator>();
        services.Configure<ApiBehaviorOptions>(options =>
        {
            options.InvalidModelStateResponseFactory = actionContext =>
            {
                var errors = actionContext.ModelState
                    .Where(entry => entry.Value?.Errors.Count > 0)
                    .Select(entry => entry.Value?.Errors.First().ErrorMessage)
                    .ToList();
                return new BadRequestObjectResult(new
                {
                    Code = 0,
                    Msg = string.Join("|", errors)
                });
            };
        });
        services.AddHttpContextAccessor();
        services.AddAuthorization();
        services.AddResponseCompression(options =>
        {
            options.EnableForHttps = true;
            options.Providers.Add<GzipCompressionProvider>();
            options.MimeTypes = ResponseCompressionDefaults.MimeTypes
                .Concat(new[]
                {
                    "application/json",
                    "application/problem+json",
                    "application/vnd.api+json",
                    "application/javascript",
                    "image/svg+xml"
                })
                .Distinct(StringComparer.OrdinalIgnoreCase);
        });
        services.Configure<GzipCompressionProviderOptions>(options =>
            options.Level = CompressionLevel.Fastest);
        services.AddSession(options => options.IdleTimeout = TimeSpan.FromMinutes(20));
        services.AddHttpClient();
        // WebAuthn/FIDO2 必须在 ASP.NET Core 宿主内完成可信验签；这里只注册无公开路由的
        // 协议原子，公开地址、匿名策略与动作白名单统一由 Managed 接口引擎负责。
        services.AddTransient<IdentityVerificationRuntime>();
        PlatformApiRuntimeRegistry.RegisterFactory(
            "IdentityVerification",
            () => DiyHttpContext.Current?.RequestServices
                ?.GetRequiredService<IdentityVerificationRuntime>());
        services.AddUEditorService("ueditor.json", true, Path.Combine(AppContext.BaseDirectory, "wwwroot"));
        services.AddControllersWithViews(options =>
            {
                options.ModelBinderProviders.Insert(0, new FormDataOrJsonModelBinderProvider());
            })
            .AddRazorRuntimeCompilation()
            .AddNewtonsoftJson(options =>
            {
                options.SerializerSettings.ContractResolver = new DefaultContractResolver();
                options.SerializerSettings.DateFormatString = "yyyy-MM-dd HH:mm:ss";
                options.SerializerSettings.DateParseHandling = DateParseHandling.None;
                options.SerializerSettings.Converters.Add(new IntegerDoubleConverter());
            });
        services.AddMicroiRealtimeTransport(
            redisConnection,
            builder.Environment.IsDevelopment());
        services.AddSwaggerGen(options =>
        {
            options.SwaggerDoc("v1", new OpenApiInfo
            {
                Title = "开源低代码平台 - Microi吾码",
                Version = serverVersion,
                Contact = new OpenApiContact
                {
                    Name = "Anderson",
                    Email = "admin@itdos.com"
                }
            });
        });
        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
        services.AddCors();
        return services;
    }

    public static WebApplication UseMicroiApiTransport(this WebApplication app)
    {
        app.UseForwardedHeaders();
        if (!app.Environment.IsDevelopment()) app.UseHsts();
        app.UseGlobalExceptionHandler();
        app.Use(async (context, next) =>
        {
            if (RequestBodyLimitError.IsHdfsUploadPath(context.Request.Path))
            {
                context.Response.OnStarting(() =>
                {
                    context.Response.Headers["X-Microi-Upload-Max-Request-MB"] = MaxRequestBodyMb.ToString();
                    context.Response.Headers["X-Microi-Upload-Max-Multipart-MB"] = MaxMultipartBodyMb.ToString();
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
            var contentType = context.Request.ContentType ?? string.Empty;
            if ((HttpMethods.IsPost(context.Request.Method)
                 || HttpMethods.IsPut(context.Request.Method)
                 || HttpMethods.IsPatch(context.Request.Method))
                && !contentType.Contains("multipart/form-data", StringComparison.OrdinalIgnoreCase)
                && (context.Request.ContentLength ?? 0) <= 10 * 1024 * 1024)
            {
                context.Request.EnableBuffering();
            }
            await next();
        });
        app.UseRouting();
        // 路由元数据只在 ASP.NET 宿主解析；旧 netstandard 压力中间件消费可信 Items 标记，
        // 不能仅凭客户端提交的 URL 前缀或 Header 绕过业务请求槽。
        app.Use(async (context, next) =>
        {
            var recovery = context.GetEndpoint()?.Metadata.GetMetadata<DatabasePoolRecoveryEndpointAttribute>();
            if (recovery != null) context.Items[typeof(DatabasePoolRecoveryEndpointAttribute)] = recovery;
            await next();
        });
        app.UseCors("any");
        app.UseSystemObservability();
        app.UseResponseCompression();
        app.UseSecurityGuard();
        app.UseRequestPressureGuard();
        app.UseAuthentication();
        app.UseAuthorization();
        app.MapMicroiApiRootPage();
        app.MapDynamicControllerRoute<DynamicRoute>("apiengine/{*path}");
        app.MapControllerRoute("default", "{controller=Home}/{action=Index}/{id?}");
        return app;
    }

    public static WebApplication MapMicroiDynamicCompatibilityRoutes(this WebApplication app)
    {
        try
        {
            app.MapDynamicControllerRoute<DynamicRoute>("{controller}");
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
            Console.WriteLine($"Microi：【失败】接口引擎、数据源引擎动态接口地址配置失败：{ex.Message}");
        }
        return app;
    }

    public static WebApplication UseMicroiApiFinalTransport(
        this WebApplication app,
        OsClientSecret mainTenant)
    {
        if (app.Environment.IsDevelopment())
        {
            app.UseDeveloperExceptionPage();
            Console.WriteLine("Microi：【成功】开发环境诊断模式已启用");
        }
        app.UseSession();
        app.UseWebSockets(new WebSocketOptions
        {
            KeepAliveInterval = TimeSpan.FromMinutes(20)
        });
        app.UseMiddleware<V8DebugWebSocketMiddleware>();
        if (mainTenant.OsClientModel["EnableSwagger"].Val<int>() == 1)
        {
            app.UseSwagger();
            app.UseSwaggerUI();
        }
        return app;
    }

    public static string ResolveDatabaseConnection()
    {
        return Environment.GetEnvironmentVariable(
                   "OsClientDbConn",
                   EnvironmentVariableTarget.Process)
               ?? ConfigHelper.GetAppSettings("OsClientDbConn")
               ?? string.Empty;
    }

    public static string ResolveDatabaseTypeName()
    {
        return Environment.GetEnvironmentVariable(
                   "OsClientDbType",
                   EnvironmentVariableTarget.Process)
               ?? ConfigHelper.GetAppSettings("OsClientDbType")
               ?? "MySql";
    }

    private static void LoadLocalEnvironment()
    {
        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"))) return;
        var localFile = new[]
        {
            Path.Combine(Directory.GetCurrentDirectory(), ".microi-local"),
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".microi-local"))
        }.FirstOrDefault(File.Exists);
        if (localFile == null) return;
        var localEnvironment = File.ReadAllText(localFile).Trim();
        if (string.IsNullOrEmpty(localEnvironment)) return;
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", localEnvironment);
        Environment.SetEnvironmentVariable("DOTNET_ENVIRONMENT", localEnvironment);
        Console.WriteLine($"Microi：【成功】【本地环境】已从 .microi-local 加载：{localEnvironment}");
    }

    private static string ResolveServerVersion()
    {
        try
        {
            var assemblyPath = Path.Combine(AppContext.BaseDirectory, "Microi.net.dll");
            return FileVersionInfo.GetVersionInfo(assemblyPath).FileVersion
                   + " - "
                   + File.GetLastWriteTime(assemblyPath).ToString("yyyy-MM-dd HH:mm:ss");
        }
        catch (Exception ex)
        {
            return ex.Message;
        }
    }

    private static IEnumerable<IPAddress> ReadConfiguredIpAddresses(string key)
    {
        foreach (var value in ReadConfiguredList(key))
            if (IPAddress.TryParse(value, out var address)) yield return address;
    }

    private static IEnumerable<System.Net.IPNetwork> ReadConfiguredNetworks(string key)
    {
        foreach (var value in ReadConfiguredList(key))
            if (System.Net.IPNetwork.TryParse(value, out var network)) yield return network;
    }

    private static IEnumerable<string> ReadConfiguredList(string key)
    {
        return (ConfigHelper.GetRuntimeConfigurationValue(key) ?? string.Empty)
            .Split(new[] { ',', ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
            .Select(value => value.Trim())
            .Where(value => value.Length > 0)
            .Distinct(StringComparer.OrdinalIgnoreCase);
    }
}

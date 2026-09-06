using System.Security.Claims;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microi.Ops;

if (args.Contains("--bootstrap", StringComparer.Ordinal)) { await Bootstrap.Run(CancellationToken.None); return; }
var options = OpsOptions.Load();
Directory.CreateDirectory(options.DataDir);
Directory.CreateDirectory(options.LogDir);
Directory.CreateDirectory(Path.Combine(options.DataDir, "keys"));
if (!OperatingSystem.IsWindows())
{
    File.SetUnixFileMode(options.DataDir, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
    File.SetUnixFileMode(Path.Combine(options.DataDir, "keys"), UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
}
var builder = WebApplication.CreateBuilder(args);
builder.WebHost.ConfigureKestrel(server => server.Limits.MaxRequestBodySize = 128 * 1024);
builder.Logging.AddFilter("Microsoft.AspNetCore", LogLevel.Warning);
builder.Services.AddSingleton(options);
builder.Services.AddSingleton<OpsStore>();
builder.Services.AddSingleton<DockerEngine>();
builder.Services.AddSingleton<OpsAudit>();
builder.Services.AddSingleton<PlatformConnection>();
builder.Services.AddSingleton<UpdateCoordinator>();
builder.Services.AddHostedService(provider => provider.GetRequiredService<UpdateCoordinator>());
builder.Services.AddHostedService<PlatformOutboxWorker>();
builder.Services.AddDataProtection().SetApplicationName("Microi.Ops")
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(options.DataDir, "keys")));
builder.Services.AddAntiforgery(antiforgery =>
{
    antiforgery.HeaderName = "X-Ops-CSRF";
    antiforgery.Cookie.Name = "microi.ops.antiforgery";
    antiforgery.Cookie.SecurePolicy = options.PublicUrl.Scheme == "https" ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
});
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(cookie =>
{
    cookie.Cookie.Name = options.PublicUrl.Scheme == "https" ? "__Host-MicroiOps" : "microi.ops.local";
    cookie.Cookie.HttpOnly = true; cookie.Cookie.Path = "/";
    cookie.Cookie.SecurePolicy = options.PublicUrl.Scheme == "https" ? CookieSecurePolicy.Always : CookieSecurePolicy.SameAsRequest;
    cookie.Cookie.SameSite = options.PublicUrl.Scheme == "https" ? SameSiteMode.None : SameSiteMode.Lax;
    cookie.ExpireTimeSpan = TimeSpan.FromMinutes(30); cookie.SlidingExpiration = true;
    cookie.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = 401; return Task.CompletedTask; };
    cookie.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = 403; return Task.CompletedTask; };
    cookie.Events.OnValidatePrincipal = async ctx =>
    {
        if (ctx.Principal?.FindFirstValue("credential-version") != options.CredentialVersion
            || !long.TryParse(ctx.Principal.FindFirstValue("login-at"), out var issued)
            || DateTimeOffset.FromUnixTimeSeconds(issued) < DateTimeOffset.UtcNow.AddHours(-8))
        { ctx.RejectPrincipal(); await ctx.HttpContext.SignOutAsync(); }
    };
});
builder.Services.AddAuthorization();
builder.Services.AddRateLimiter(rate =>
{
    rate.RejectionStatusCode = 429;
    rate.AddPolicy("login", _ => RateLimitPartition.GetFixedWindowLimiter("ops-login", _ => new() { PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
var app = builder.Build();
_ = app.Services.GetRequiredService<OpsStore>();
// 只信任已登记代理传递的协议；不接受任意客户端伪造 HTTPS 或 Host。
var forwarded = new ForwardedHeadersOptions { ForwardedHeaders = ForwardedHeaders.XForwardedProto, ForwardLimit = 1 };
foreach (var ip in options.TrustedProxyIps) forwarded.KnownProxies.Add(ip);
app.UseForwardedHeaders(forwarded);
app.Use(async (context, next) =>
{
    context.Response.Headers.ContentSecurityPolicy = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors "
        + (options.FrameOrigins.Length == 0 ? "'none'" : string.Join(' ', options.FrameOrigins));
    context.Response.Headers.XContentTypeOptions = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    if (context.Request.Path.StartsWithSegments("/ops-api")) context.Response.Headers.CacheControl = "no-store";
    try { await next(); }
    catch (AntiforgeryValidationException) { context.Response.StatusCode = 400; await context.Response.WriteAsJsonAsync(new { error = "页面验证已失效，请刷新后重试。" }); }
    catch (OpsException error) { context.Response.StatusCode = error.Status; await context.Response.WriteAsJsonAsync(new { error = Redaction.Clean(error.Message) }); }
    catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested) { }
    catch (Exception error)
    {
        app.Logger.LogError("Ops 请求失败：{ErrorType}", error.GetType().Name);
        context.Response.StatusCode = 503; await context.Response.WriteAsJsonAsync(new { error = "服务暂不可用，请检查运维日志、平台连接或 Docker 状态。" });
    }
});
app.UseAuthentication(); app.UseAuthorization(); app.UseRateLimiter();
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/ops-api") && !HttpMethods.IsGet(context.Request.Method) && !HttpMethods.IsHead(context.Request.Method))
    {
        var origin = context.Request.Headers.Origin.ToString();
        if (origin.Length > 0 && origin != options.PublicUrl.GetLeftPart(UriPartial.Authority)) throw new OpsException("请求来源不在 Ops 访问范围内。", 403);
        await context.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(context);
    }
    await next();
});
app.MapGet("/health", () => Results.Ok(new { status = "healthy", service = "Microi.Ops", version = "1.0.1" }));
app.MapGet("/ops-api/session", (HttpContext ctx, IAntiforgery antiforgery) => Results.Ok(new
{
    authenticated = ctx.User.Identity?.IsAuthenticated == true, account = ctx.User.Identity?.Name,
    csrfToken = antiforgery.GetAndStoreTokens(ctx).RequestToken, publicUrl = options.PublicUrl.ToString(), version = "1.0.1"
}));
app.MapPost("/ops-api/login", async (OpsLogin request, HttpContext ctx, OpsAudit audit) =>
{
    if (request.Account?.Length > 100 || request.Password?.Length > 512 || !options.ValidatePassword(request.Account ?? "", request.Password ?? ""))
    { audit.Write("LoginFailed", "anonymous", "运维账号验证失败。", false); return Results.Json(new { error = "账号或密码错误。" }, statusCode: 401); }
    var claims = new[] { new Claim(ClaimTypes.Name, options.AdminUsername), new Claim("credential-version", options.CredentialVersion), new Claim("login-at", DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString()) };
    await ctx.SignInAsync(new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)));
    audit.Write("LoginSucceeded", options.AdminUsername, "独立运维登录成功。"); return Results.Ok(new { success = true });
}).RequireRateLimiting("login");
var api = app.MapGroup("/ops-api").RequireAuthorization();
api.MapPost("/logout", async (HttpContext ctx, OpsAudit audit) => { audit.Write("Logout", ctx.User.Identity!.Name!, "独立运维会话已退出。"); await ctx.SignOutAsync(); return Results.Ok(); });
api.MapGet("/snapshot", async (DockerEngine docker, OpsStore store, PlatformConnection platform, OpsAudit audit, CancellationToken ct) =>
{
    var containers = new List<object>(); var dockerError = "";
    try { containers = await docker.Containers(ct); }
    catch (Exception error) when (error is not OperationCanceledException) { dockerError = error is OpsException ? error.Message : "Docker 连接不可用；历史记录仍可查看。"; }
    return Results.Ok(new
    {
        deployment = new { options.Deployment.Id, options.Deployment.Name, services = options.Deployment.Services.Select(x => new { x.Name, x.Role, x.Repository, x.Tag, x.AllowAutomatic, x.ImageRollbackCompatible }), options.Deployment.WatchtowerName },
        containers, dockerError, policy = store.Get<UpdatePolicy>("policy") ?? new(), tasks = store.Tasks(), platform = platform.Status(),
        logDirectory = options.LogDir, logWarning = audit.LastFileError, dataDirectory = options.DataDir, publicUrl = options.PublicUrl.ToString()
    });
});
api.MapGet("/events", (OpsStore store) => Results.Ok(store.Events()));
api.MapGet("/containers/{name}/logs", async (string name, DockerEngine docker, CancellationToken ct) =>
{
    if (!options.Deployment.Services.Any(x => x.Name == name) && name != options.Deployment.WatchtowerName) throw new OpsException("该容器不在日志读取清单中。", 403);
    return Results.Ok(new { content = await docker.Logs(name, ct) });
});
api.MapPost("/plans", async (PlanRequest request, UpdateCoordinator updates, CancellationToken ct) => Results.Ok((await updates.CreatePlan(request, ct)).Public()));
api.MapGet("/plans/{id}", (string id, OpsStore store) => Results.Ok(store.Plan(id).Public()));
api.MapPost("/tasks", (SubmitPlan request, UpdateCoordinator updates, HttpContext ctx) => Results.Ok(updates.Enqueue(request, ctx.User.Identity!.Name!)));
api.MapGet("/tasks/{id}", (string id, OpsStore store) => Results.Ok(store.FindTask(id) ?? throw new OpsException("任务不存在。", 404)));
api.MapPost("/tasks/{id}/restore", async (string id, RestoreRequest request, UpdateCoordinator updates, HttpContext ctx) =>
{
    if (request.Confirm != id) throw new OpsException("请确认正在恢复的任务。");
    await updates.RequestRestore(id, ctx.User.Identity!.Name!, request.DatabaseCompatible, ctx.RequestAborted); return Results.Ok(new { accepted = true });
});
api.MapPut("/policy", (UpdatePolicy policy, OpsStore store, OpsAudit audit, HttpContext ctx) =>
{
    policy.Validate(); policy.NextCheck = DateTimeOffset.UtcNow.AddSeconds(policy.IntervalSeconds);
    store.Set("policy", policy); audit.Write("PolicyChanged", ctx.User.Identity!.Name!, "更新模式：" + policy.Mode); return Results.Ok(policy);
});
api.MapPost("/watchtower", async (WatchtowerRequest request, UpdateCoordinator updates, HttpContext ctx) =>
{
    if (request.Confirm != options.Deployment.WatchtowerName) throw new OpsException("请确认登记的 Watchtower 容器名称。");
    await updates.Watchtower(request.Enabled, ctx.User.Identity!.Name!, ctx.RequestAborted); return Results.Ok();
});
api.MapGet("/platform/config", async (PlatformConnection platform, CancellationToken ct) => Results.Ok(await platform.LoginConfig(ct)));
api.MapGet("/platform/captcha", async (PlatformConnection platform, CancellationToken ct) => Results.Ok(await platform.Captcha(ct)));
api.MapPost("/platform/login", async (PlatformLogin request, PlatformConnection platform, OpsAudit audit, HttpContext ctx) =>
{
    var result = await platform.Login(request, ctx.RequestAborted); audit.Write("PlatformConnected", ctx.User.Identity!.Name!, "平台连接已登录；运维权限仍使用独立账号。"); return Results.Ok(result);
}).RequireRateLimiting("login");
api.MapPost("/platform/disconnect", (PlatformConnection platform, OpsAudit audit, HttpContext ctx) =>
{
    platform.Disconnect(); audit.Write("PlatformDisconnected", ctx.User.Identity!.Name!, "平台凭据已从 Ops 移除，待投递日志保留。"); return Results.Ok();
});
app.UseDefaultFiles(); app.UseStaticFiles();
app.Map("/ops-api/{**path}", () => Results.NotFound(new { error = "接口不存在。" }));
app.MapFallbackToFile("index.html");
await app.RunAsync();

public sealed record OpsLogin(string Account, string Password);
public sealed record RestoreRequest(string Confirm, bool DatabaseCompatible);
public sealed record WatchtowerRequest(string Confirm, bool Enabled);
public sealed class PlatformOutboxWorker(PlatformConnection platform, OpsStore store, OpsOptions options, ILogger<PlatformOutboxWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try { await platform.Flush(stoppingToken); store.PruneDelivered(options.LogRetentionDays); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error) { logger.LogWarning("运维日志补投暂缓：{ErrorType}", error.GetType().Name); }
            await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
        }
    }
}

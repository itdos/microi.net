using System.Globalization;
using Dos.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;

namespace Microi.net.Api;

/// <summary>
/// 宿主诊断协议。健康动作避开租户与外部依赖；连接池应急动作独立鉴权并调用 Core 控制面。
/// </summary>
[ApiController]
[AllowAnonymous]
[EnableCors("any")]
[Route("api/[controller]")]
public sealed class DiagnosticsController : ControllerBase
{
    /// <summary>
    /// 可信应急协议边界：内部强制 DiyToken 与无池主库管理员复核，不能套用依赖故障池的 MCP 过滤器。
    /// AllowAnonymous 只跳过 ASP.NET 默认认证，不代表本动作允许匿名操作。
    /// </summary>
    [HttpPost("database-pools")]
    [DatabasePoolRecoveryEndpoint]
    [RequestSizeLimit(4096)]
    public Task<DosResult> DatabasePools([FromBody] Newtonsoft.Json.Linq.JObject request)
    {
        DisableCaching();
        return DatabasePoolRecoveryService.ExecuteAsync(request);
    }

    [HttpGet("liveness")]
    public DosResult Liveness()
    {
        DisableCaching();
        return BuildHealthyResult("microi-api-host/liveness-v1");
    }

    [HttpGet("health")]
    [HttpGet("/apiengine/platform-service-health")]
    [HttpGet("/itdos-heart")]
    public DosResult Health()
    {
        DisableCaching();
        return BuildHealthyResult("microi-api-host/health-v1");
    }

    private static DosResult BuildHealthyResult(string healthContract)
    {
        return new DosResult(1, new
        {
            Status = "Healthy",
            BackendVersion = V8Method.GetCurrentBackendVersion(),
            HealthContract = healthContract,
            CheckedAt = DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
        });
    }

    private void DisableCaching()
    {
        if (ControllerContext.HttpContext == null) return;
        Response.Headers.CacheControl = "no-store, no-cache, must-revalidate";
        Response.Headers.Pragma = "no-cache";
        Response.Headers.Expires = "0";
    }
}

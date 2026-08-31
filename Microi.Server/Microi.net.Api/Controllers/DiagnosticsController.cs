using System.Globalization;
using Dos.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;

namespace Microi.net.Api;

/// <summary>
/// Fixed host-level health endpoints. These routes deliberately avoid tenant
/// configuration, databases, Redis, ApiEngine and V8 so they remain available
/// while child-tenant application upgrades are still running.
/// </summary>
[ApiController]
[AllowAnonymous]
[EnableCors("any")]
[Route("api/[controller]")]
public sealed class DiagnosticsController : ControllerBase
{
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

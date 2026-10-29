using System.Text.Json.Nodes;

namespace Microi.Panel.Panel;

/// <summary>已有面板网站的有限操作入口；继承独立面板身份、CSRF 和 no-store。</summary>
public static class HostNginxEndpoints
{
    public static void MapHostNginx(this RouteGroupBuilder authenticatedOps)
    {
        var api = authenticatedOps.MapGroup("/panel/host-nginx");
        api.MapGet("/instances", (HostNginxService host, CancellationToken ct) => host.Instances(ct));
        api.MapGet("/instances/{instanceId}/sites", (string instanceId, HostNginxService host, CancellationToken ct) => host.Sites(instanceId, ct));
        api.MapGet("/instances/{instanceId}/sites/{siteId}/configuration", (string instanceId, string siteId, HostNginxService host, CancellationToken ct) => host.Configuration(instanceId, siteId, ct));
        api.MapGet("/instances/{instanceId}/sites/{siteId}/history", (string instanceId, string siteId, HostNginxService host, CancellationToken ct) => host.History(instanceId, siteId, ct));
        api.MapPost("/attach", async (HostNginxAttachRequest request, HostNginxService host, HttpContext ctx, OpsAudit audit, CancellationToken ct) =>
            Audited(await host.Attach(request, ct), "HostNginxAttached", ctx, audit));
        api.MapPost("/configuration", async (HostNginxService host, HttpContext ctx, OpsAudit audit, CancellationToken ct) =>
        {
            // 128 KiB UTF-8 配置被 JSON 转义后可增大；仅此认证入口提高封包预算，正文仍由服务层限长。
            var limit = ctx.Features.Get<Microsoft.AspNetCore.Http.Features.IHttpMaxRequestBodySizeFeature>();
            if (limit is { IsReadOnly: false }) limit.MaxRequestBodySize = 1024 * 1024;
            var request = await ctx.Request.ReadFromJsonAsync<HostNginxSaveRequest>(ct)
                ?? throw new OpsException("网站配置请求不能为空。");
            return Audited(await host.Save(request, ct), "HostNginxConfigurationSaved", ctx, audit);
        });
        api.MapPost("/rollback", async (HostNginxRollbackRequest request, HostNginxService host, HttpContext ctx, OpsAudit audit, CancellationToken ct) =>
            Audited(await host.Rollback(request, ct), "HostNginxConfigurationRestored", ctx, audit));
        api.MapPost("/test", async (HostNginxControlRequest request, HostNginxService host, HttpContext ctx, OpsAudit audit, CancellationToken ct) =>
            Audited(await host.Test(request, ct), "HostNginxConfigurationTested", ctx, audit));
        api.MapPost("/reload", async (HostNginxControlRequest request, HostNginxService host, HttpContext ctx, OpsAudit audit, CancellationToken ct) =>
            Audited(await host.Reload(request, ct), "HostNginxReloaded", ctx, audit));
    }

    private static IResult Audited(JsonObject result, string action, HttpContext context, OpsAudit audit)
    {
        // 配置可能包含上游凭据；只记录宿主确认的对象和操作编号，不记录正文或命令输出。
        audit.Write(action, context.User.Identity!.Name!, string.Join(" / ",
            result["instanceId"]?.ToString(), result["siteId"]?.ToString(), result["requestId"]?.ToString()));
        return Results.Ok(result);
    }
}

using System.Net;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Microi.Panel.Panel;

public static class PanelSecurityEndpoints
{
    private static DateTimeOffset? Unix(JsonNode? value) => value == null ? null : DateTimeOffset.FromUnixTimeMilliseconds(checked((long)(value.GetValue<double>() * 1000)));
    private static PanelLoginPolicy ParsePolicy(JsonNode? node)
    {
        if (node is not JsonObject policy || policy["enabled"] is not JsonValue enabled || !enabled.TryGetValue<bool>(out _)
            || policy["allowlist"] is not JsonArray || policy["revision"] is not JsonValue revision || !revision.TryGetValue<string>(out var rev)
            || string.IsNullOrEmpty(rev) || rev.Length > 128
            || policy["maxFailures"] == null || policy["banSeconds"] == null || policy["windowSeconds"] == null || policy["generation"] == null)
            throw new OpsException("主机防护策略无效。", 502);
        var parsed = policy.Deserialize<PanelLoginPolicy>(JsonDefaults.Options) ?? throw new OpsException("主机防护策略无效。", 502);
        if (parsed.MaxFailures is < 1 or > 100 || parsed.BanSeconds is < 60 or > 31536000 || parsed.WindowSeconds is < 0 or > 86400
            || parsed.Generation <= 0 || parsed.Allowlist == null || parsed.Allowlist.Length > 256
            || parsed.Allowlist.Any(value => !IPAddress.TryParse(value, out _) && !IPNetwork.TryParse(value, out _)))
            throw new OpsException("主机防护策略无效。", 502);
        return parsed;
    }
    private static bool ValidReceipt(JsonObject receipt, string ip)
    {
        try
        {
            // 在确认投递前验证整个后续会读取的结构，畸形 HTTP 200 不能先删 outbox 再解析失败。
            var policy = ParsePolicy(receipt["policy"]);
            var count = receipt["failedAttempts"]?.GetValue<int>();
            var observed = Unix(receipt["observedAt"]);
            if (receipt["ip"]?.ToString() != ip || count is not (>= 0 and <= 100000) || observed == null || observed > DateTimeOffset.UtcNow.AddSeconds(5)
                || receipt["banned"] is not JsonValue flag || !flag.TryGetValue<bool>(out var banned)
                || receipt["recentFailureTimes"] is not JsonArray times || times.Count > 100) return false;
            foreach (var time in times)
                if (Unix(time) is not { } occurred || occurred > observed.Value.AddSeconds(1)) return false;
            if (policy.WindowSeconds > 0 && count != times.Count) return false;
            if (count > 0 && Unix(receipt["lastFailure"]) == null) return false;
            _ = Unix(receipt["lastFailure"]); _ = Unix(receipt["resetEpoch"]);
            if (receipt["ban"] == null) return !banned;
            return banned && receipt["ban"] is JsonObject ban && ban["ip"]?.ToString() == ip && Unix(ban["expiresAt"]) != null;
        }
        catch (Exception error) when (error is InvalidOperationException or FormatException or OverflowException or ArgumentOutOfRangeException or JsonException or OpsException) { return false; }
    }
    public static bool ApplyReceipt(PanelLoginSecurity login, string ip, JsonObject? receipt)
    {
        if (receipt == null || !ValidReceipt(receipt, ip)) return false;
        SyncPolicy(login, receipt["policy"]);
        if (receipt["observedAt"] == null || receipt["failedAttempts"] == null) return false;
        var times = receipt["recentFailureTimes"]?.AsArray().Select(x => Unix(x)!.Value).ToArray();
        return login.MirrorHost(ip, receipt["failedAttempts"]!.GetValue<int>(), Unix(receipt["ban"]?["expiresAt"]),
            Unix(receipt["lastFailure"]), Unix(receipt["observedAt"])!.Value, times, receipt["policy"]!["generation"]!.GetValue<long>());
    }
    public static async Task FlushFailures(PanelAuthGuardClient guard, PanelLoginSecurity login, CancellationToken ct, string? ip = null)
    {
        foreach (var item in login.PendingFailures(32, ip))
        {
            var receipt = await guard.Failure(item.Ip, item.Id, ct, item.OccurredAt);
            if (receipt == null || !ValidReceipt(receipt, item.Ip)
                || receipt["accepted"] is not JsonValue accepted || !accepted.TryGetValue<bool>(out var recorded)
                || !recorded && receipt["ignoredReason"]?.ToString() is not ("disabled" or "allowlisted" or "stale" or "duplicate" or "already-banned")) break;
            // 只有完整回执才能确认投递；镜像可能因同时到达的新事件或旧generation被拒，不能反过来清空新事件。
            SyncPolicy(login, receipt["policy"]);
            login.AckFailure(item.Id);
            ApplyReceipt(login, item.Ip, receipt);
        }
    }
    public static async Task<JsonObject?> CheckHost(PanelAuthGuardClient guard, PanelLoginSecurity login, string ip, CancellationToken ct)
    {
        await FlushFailures(guard, login, ct, ip);
        var receipt = await guard.Check(ip, ct);
        return ApplyReceipt(login, ip, receipt) ? receipt : null;
    }
    public static void SyncPolicy(PanelLoginSecurity login, JsonNode? policy)
    {
        if (policy == null) return;
        var parsed = ParsePolicy(policy);
        var current = login.Policy();
        if (JsonSerializer.Serialize(parsed, JsonDefaults.Options) != JsonSerializer.Serialize(current, JsonDefaults.Options))
            login.SetPolicy(parsed, "host-guard");
    }
    public static void MapPanelSecurity(this RouteGroupBuilder api)
    {
        api.MapGet("/panel/security", async (PanelAuthGuardClient guard, PanelLoginSecurity login, PanelRepository repository, HttpContext ctx) =>
        {
            var host = await guard.Status(ctx.RequestAborted);
            SyncPolicy(login, host?["policy"]);
            return Results.Ok(new { host, panel = login.GetStatus(), pendingPanelIps = login.PendingFailures(100).Select(x => x.Ip).Distinct(), currentIp = PanelLoginSecurity.NormalizeIp(ctx.Connection.RemoteIpAddress),
                resources = repository.Resources().Where(x => x.PluginId is "mysql" or "mongodb" or "redis" or "postgresql" or "sqlserver" or "oracle").Select(x => new { x.Id, x.PluginId, x.State, x.RedisAuthProxy }) });
        });
        api.MapPut("/panel/security/policy", async (SecurityPolicyRequest request, PanelAuthGuardClient guard, PanelLoginSecurity login, OpsAudit audit, HttpContext ctx) =>
        {
            if (request.Scope is not ("all" or "panel")) throw new OpsException("请选择主机防护或面板登录防护。");
            if (request.MaxFailures is < 1 or > 100 || request.BanSeconds is < 60 or > 31536000 || request.WindowSeconds is < 0 or > 86400
                || request.Allowlist == null || request.Allowlist.Length > 256) throw new OpsException("防护参数超出允许范围。");
            foreach (var value in request.Allowlist)
                if (!IPAddress.TryParse(value, out _) && !IPNetwork.TryParse(value, out _)) throw new OpsException("白名单只允许 IP 地址或 CIDR 网段。");
            if (request.Scope == "all")
            {
                var update = new JsonObject { ["enabled"] = request.Enabled, ["maxFailures"] = request.MaxFailures, ["banSeconds"] = request.BanSeconds,
                    ["windowSeconds"] = request.WindowSeconds, ["allowlist"] = JsonSerializer.SerializeToNode(request.Allowlist), ["expectedRevision"] = request.ExpectedRevision };
                var result = await guard.SavePolicy(update, ctx.RequestAborted);
                var status = await guard.Status(ctx.RequestAborted) ?? throw new OpsException("策略已提交，但主机回读失败，请刷新核对后再操作。", 503);
                SyncPolicy(login, status["policy"]);
                audit.Write("HostProtectionPolicyChanged", ctx.User.Identity!.Name!, "主机认证防护策略已提交并回读。");
                return Results.Ok(new { scope = "all", policy = status["policy"]?.DeepClone(), receipt = result });
            }
            if (await guard.Status(ctx.RequestAborted) != null) throw new OpsException("主机防护已接入，请统一修改主机策略。", 409);
            var saved = login.SetPolicyIfRevision(new(request.Enabled, request.MaxFailures, request.BanSeconds, request.WindowSeconds, request.Allowlist), ctx.User.Identity!.Name!, request.ExpectedRevision);
            return Results.Ok(new { scope = "panel", policy = saved });
        });
        api.MapPost("/panel/security/unban", async (SecurityUnbanRequest request, PanelAuthGuardClient guard, PanelLoginSecurity login, OpsAudit audit, HttpContext ctx) =>
        {
            if (!IPAddress.TryParse(request.Ip, out var address) || request.Scope is not ("all" or "panel")) throw new OpsException("解封 IP 或范围无效。");
            var ip = PanelLoginSecurity.NormalizeIp(address);
            if (request.Confirm != ip) throw new OpsException("请核对本次解封 IP。");
            if (request.Scope == "all")
            {
                var receipt = await guard.Unban(ip, ctx.RequestAborted);
                if (receipt["ip"]?.ToString() != ip || receipt["removed"]?.ToString() != "true"
                    || receipt["banned"]?.ToString() != "false" || receipt["firewallVerified"]?.ToString() != "true")
                    throw new OpsException("主机解封回执无效，请刷新核对。", 503);
                var check = await guard.Check(ip, ctx.RequestAborted);
                if (check == null || !ValidReceipt(check, ip) || check["banned"]?.GetValue<bool>() != false)
                    throw new OpsException("主机解封尚未确认，请刷新核对。", 503);
            }
            login.Unban(ip, ctx.User.Identity!.Name!);
            audit.Write("ProtectionIpUnbanned", ctx.User.Identity!.Name!, "IP " + ip + " 解封范围：" + request.Scope);
            return Results.Ok(new { ip, scope = request.Scope, success = true });
        });
    }
}

public sealed record SecurityPolicyRequest(bool Enabled, int MaxFailures, int BanSeconds, int WindowSeconds, string[] Allowlist, string? ExpectedRevision, string Scope = "all");
public sealed record SecurityUnbanRequest(string Ip, string Confirm, string Scope = "all");

public sealed class PanelSecuritySync(PanelAuthGuardClient guard, PanelLoginSecurity login, ILogger<PanelSecuritySync> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PanelSecurityEndpoints.FlushFailures(guard, login, stoppingToken);
                var status = await guard.Status(stoppingToken); PanelSecurityEndpoints.SyncPolicy(login, status?["policy"]);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error) { logger.LogWarning("主机防护策略缓存同步失败：{ErrorType}", error.GetType().Name); }
            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
        }
    }
}

using System.Net.Sockets;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Microi.Panel.Panel;

/// <summary>固定本机 root 维护协议；浏览器不能选择 socket、执行命令或删除卷。</summary>
public sealed class HostDiskMaintenanceClient : IDisposable
{
    public const string SocketPath = "/run/microi-disk-guard/control.sock";
    private readonly HttpClient client;
    public HostDiskMaintenanceClient() : this(new SocketsHttpHandler
    {
        ConnectCallback = async (_, ct) =>
        {
            var socket = new Socket(AddressFamily.Unix, SocketType.Stream, ProtocolType.Unspecified);
            try { await socket.ConnectAsync(new UnixDomainSocketEndPoint(SocketPath), ct); return new NetworkStream(socket, true); }
            catch { socket.Dispose(); throw; }
        }, UseProxy = false, AllowAutoRedirect = false
    }) { }
    internal HostDiskMaintenanceClient(HttpMessageHandler handler) => client = new(handler)
        { BaseAddress = new("http://localhost"), Timeout = TimeSpan.FromSeconds(20), MaxResponseContentBufferSize = 8 * 1024 * 1024 };
    private async Task<JsonObject> Send(HttpMethod method, string path, object? body, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(method, path);
        if (body != null)
        {
            request.Content = new ByteArrayContent(JsonSerializer.SerializeToUtf8Bytes(body, JsonDefaults.Options));
            request.Content.Headers.ContentType = new("application/json");
        }
        try
        {
            using var response = await client.SendAsync(request, ct);
            var result = JsonNode.Parse(await response.Content.ReadAsByteArrayAsync(ct)) as JsonObject ?? throw new OpsException("宿主维护返回格式无效。", 502);
            if (!response.IsSuccessStatusCode) throw new OpsException(Redaction.Clean(result["error"]?.ToString() ?? "宿主维护未完成。", 600), (int)response.StatusCode);
            return result;
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { throw new OpsException("宿主磁盘维护响应超时，保持原服务并停止新增维护写入。", 503); }
        catch (Exception error) when (error is HttpRequestException or IOException or SocketException or JsonException)
        { throw new OpsException("无法连接独立宿主磁盘维护服务，请检查其安装、运行状态和只读 socket 挂载。", 503); }
    }
    public async Task<JsonObject> Status(CancellationToken ct)
    {
        var result = await Send(HttpMethod.Get, "/status", null, ct);
        if (result["protocol"]?.GetValue<int>() != 1 || result["volumesNeverDeleted"]?.GetValue<bool>() != true || result["policy"] is not JsonObject)
            throw new OpsException("宿主维护协议或数据卷保护声明无效。", 502);
        return result;
    }
    public async Task<JsonObject?> OptionalStatus(CancellationToken ct)
    {
        try { return await Status(ct); }
        catch (OpsException) { return null; }
    }
    public Task<JsonObject> Preview(CancellationToken ct) => Send(HttpMethod.Get, "/preview", null, ct);
    public Task<JsonObject> Save(DiskPolicyRequest request, CancellationToken ct) => Send(HttpMethod.Put, "/policy", request, ct);
    public Task<JsonObject> Run(DiskRunRequest request, CancellationToken ct) => Send(HttpMethod.Post, "/run", request, ct);
    public Task<JsonObject> Enroll(string name, string role, string expectedRepository, CancellationToken ct) => Send(HttpMethod.Post, "/enroll", new { name, role, expectedRepository }, ct);
    public async Task Protect(string id, IEnumerable<string> images, long requiredBytes, CancellationToken ct)
    {
        var result = await Send(HttpMethod.Post, "/preflight", new { operationId = id, images = images.Distinct().Order().ToArray(), requiredBytes }, ct);
        if (result["ready"]?.GetValue<bool>() != true || result["operationId"]?.ToString() != id)
            throw new OpsException("宿主未确认本任务的空间预算与镜像保护。", 503);
    }
    public async Task Complete(string id, IEnumerable<string> verified, CancellationToken ct)
    {
        var result = await Send(HttpMethod.Post, "/complete", new { operationId = id, verifiedContainers = verified.Distinct().ToArray() }, ct);
        if (result["completed"]?.GetValue<bool>() != true) throw new OpsException("维护任务保护尚未确认完成。", 503);
    }
    public async Task Prepared(string id, IEnumerable<object> images, CancellationToken ct)
    {
        var result = await Send(HttpMethod.Post, "/prepared", new { operationId = id, images = images.ToArray() }, ct);
        if (result["completed"]?.GetValue<bool>() != true) throw new OpsException("预拉取镜像保护尚未确认。", 503);
    }
    public void Dispose() => client.Dispose();
}

public sealed record DiskPolicy(bool Enabled, int WarningPercent, int PausePercent, int MinimumFreeGiB,
    int InodeWarningPercent, int InodePausePercent, int IdleDays, int RollbackVersions, int CleanupHour, int UtcOffsetMinutes);
public sealed record DiskPolicyRequest(string ExpectedRevision, DiskPolicy Policy);
public sealed record DiskRunRequest(string RequestId, string Fingerprint, string Confirm);

/// <summary>复用面板会话、CSRF 与审计；不把宿主维护授权交给业务 DiyToken/V8。</summary>
public static class HostDiskMaintenanceEndpoints
{
    public static void MapHostDiskMaintenance(this RouteGroupBuilder api)
    {
        api.MapGet("/panel/disk", async (HostDiskMaintenanceClient client, CancellationToken ct) =>
        {
            var status = await client.OptionalStatus(ct);
            return Results.Ok(new { available = status != null, status, message = status == null ? "独立宿主维护尚未就绪，请从安装器完成安装或检查服务。" : "" });
        });
        api.MapGet("/panel/disk/preview", async (HostDiskMaintenanceClient client, CancellationToken ct) => Results.Ok(await client.Preview(ct)));
        api.MapPut("/panel/disk/policy", async (DiskPolicyRequest request, HostDiskMaintenanceClient client, OpsAudit audit, HttpContext ctx) =>
        {
            var result = await client.Save(request, ctx.RequestAborted);
            audit.Write("HostDiskPolicyChanged", ctx.User.Identity!.Name!, "宿主安全清理策略已持久化；数据卷与容器始终保留。");
            return Results.Ok(result);
        });
        api.MapPost("/panel/disk/run", async (DiskRunRequest request, HostDiskMaintenanceClient client, OpsAudit audit, HttpContext ctx) =>
        {
            var result = await client.Run(request, ctx.RequestAborted);
            audit.Write("HostDiskCleanupAccepted", ctx.User.Identity!.Name!, "已提交绑定主机预览的镜像安全清理。", taskId: result["id"]?.ToString());
            return Results.Accepted(value: result);
        });
    }
}

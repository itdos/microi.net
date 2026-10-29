using System.Net.Sockets;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Microi.Panel.Panel;

/// <summary>The root-owned local socket is a typed host boundary; browsers cannot select its address or submit commands.</summary>
public sealed class PanelAuthGuardClient : IDisposable
{
    public const string SocketPath = "/run/microi-auth-guard/control.sock";
    private readonly HttpClient client;
    public PanelAuthGuardClient() : this(new SocketsHttpHandler
    {
        ConnectCallback = async (_, ct) =>
        {
            var socket = new Socket(AddressFamily.Unix, SocketType.Stream, ProtocolType.Unspecified);
            try { await socket.ConnectAsync(new UnixDomainSocketEndPoint(SocketPath), ct); return new NetworkStream(socket, ownsSocket: true); }
            catch { socket.Dispose(); throw; }
        },
        UseProxy = false, AllowAutoRedirect = false
    }) { }
    internal PanelAuthGuardClient(HttpMessageHandler handler)
    {
        client = new HttpClient(handler) { BaseAddress = new Uri("http://localhost"), Timeout = TimeSpan.FromSeconds(3), MaxResponseContentBufferSize = 4 * 1024 * 1024 };
    }
    private async Task<JsonObject> Send(HttpMethod method, string path, object? body, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(method, path);
        if (body != null)
        {
            // root Unix 协议拒绝 chunked/Expect；固定序列化后的 UTF-8 字节长，避免认证请求静默退回本地计数。
            request.Content = new ByteArrayContent(JsonSerializer.SerializeToUtf8Bytes(body, JsonDefaults.Options));
            request.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json") { CharSet = "utf-8" };
        }
        using var response = await client.SendAsync(request, ct);
        var text = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new OpsException(response.StatusCode == System.Net.HttpStatusCode.Conflict
                ? "防护策略已被其他管理员修改，请刷新后重试。"
                : "主机防护操作未完成，请检查安全防护状态或主机控制台。", (int)response.StatusCode);
        return JsonNode.Parse(text) as JsonObject ?? throw new OpsException("主机防护返回格式异常。", 502);
    }
    private async Task<JsonObject?> Optional(HttpMethod method, string path, object? body, CancellationToken ct)
    {
        try { return await Send(method, path, body, ct); }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { return null; }
        catch (Exception error) when (error is HttpRequestException or IOException or SocketException or JsonException or OpsException) { return null; }
    }
    public Task<JsonObject?> Status(CancellationToken ct) => Optional(HttpMethod.Get, "/status", null, ct);
    public Task<JsonObject?> Check(string ip, CancellationToken ct) => Optional(HttpMethod.Post, "/check", new { ip }, ct);
    public Task<JsonObject?> Failure(string ip, string eventId, CancellationToken ct, DateTimeOffset? occurredAt = null) => Optional(HttpMethod.Post, "/failures", new { ip, eventId, service = "panel", occurredAt = (occurredAt ?? DateTimeOffset.UtcNow).ToUnixTimeMilliseconds() / 1000d }, ct);
    public Task<JsonObject> SavePolicy(JsonObject policy, CancellationToken ct) => Send(HttpMethod.Put, "/policy", policy, ct);
    public Task<JsonObject> Unban(string ip, CancellationToken ct) => Send(HttpMethod.Post, "/unban", new { ip }, ct);
    public async Task RequireRedisReady(string resourceId, CancellationToken ct)
    {
        var status = await Status(ct);
        var adapter = status?["adapters"]?.AsArray().FirstOrDefault(x => x?["service"]?.ToString() == "redis" && (x?["id"]?.ToString() == resourceId || x?["resourceId"]?.ToString() == resourceId));
        // 禁用认证计数不能关闭 Redis 通道；但两种策略均须证明代理监听和后端隔离已实际就绪。
        var state = adapter?["status"]?.ToString();
        var allowedState = state == "protecting" || state == "disabled" && status?["policy"]?["enabled"]?.ToString() == "false";
        var observed = status?["firewall"]?["observedAt"];
        var fresh = observed is JsonValue value && value.TryGetValue<double>(out var seconds)
            && Math.Abs(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() / 1000d - seconds) <= 30;
        if (!allowedState || adapter?["proxy"]?["state"]?.ToString() != "listening"
            || status?["firewall"]?["verified"]?.ToString() != "true" || !fresh)
            throw new OpsException("Redis 已保留在隔离网络中，但认证防护入口尚未就绪。请先检查安全防护中的主机服务和代理状态，再继续原安装任务。", 503);
    }
    public void Dispose() => client.Dispose();
}

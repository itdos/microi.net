using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using System.Security.Cryptography;

namespace Microi.Panel.Panel;

public sealed record HostNginxAttachRequest(string InstanceId, string ExpectedFingerprint, string Confirm);
public sealed record HostNginxControlRequest(string InstanceId, string ExpectedFingerprint, string Confirm);
public sealed record HostNginxSaveRequest(string InstanceId, string SiteId, string ExpectedFingerprint, string ExpectedSha256, string RequestId, string Content, string Confirm);
public sealed record HostNginxRollbackRequest(string InstanceId, string SiteId, string ExpectedFingerprint, string ExpectedSha256, string RequestId, string RevisionId, string Confirm);
public sealed record HostNginxHttp01Request(string InstanceId, string SiteId, string ExpectedFingerprint, string ExpectedSha256, string RequestId, string Confirm, string[]? ExpectedDomains = null);
public sealed record HostNginxCertificateRequest(string InstanceId, string SiteId, string ExpectedFingerprint, string ExpectedSha256, string RequestId, string CertificatePem, string PrivateKeyPem, string Confirm);
public sealed record HostNginxTlsDomain(string ServerName, string CertificateSha256);
public sealed record HostNginxManagedTlsRequest(string OwnerId, string ResourceId, string ContainerId, HostNginxTlsDomain[] Domains);

/// <summary>只通过固定 root Unix socket 管理明确接入的外部网站；请求不接受命令、可执行路径或 socket 地址。</summary>
public sealed class HostNginxService : IDisposable
{
    private readonly HttpClient client;
    public HostNginxService() : this(new SocketsHttpHandler
    {
        ConnectCallback = async (_, ct) =>
        {
            var socket = new Socket(AddressFamily.Unix, SocketType.Stream, ProtocolType.Unspecified);
            try { await socket.ConnectAsync(new UnixDomainSocketEndPoint(PanelAuthGuardClient.SocketPath), ct); return new NetworkStream(socket, ownsSocket: true); }
            catch { socket.Dispose(); throw; }
        }, UseProxy = false, AllowAutoRedirect = false
    }) { }
    internal HostNginxService(HttpMessageHandler handler)
    {
        // 宿主事务可能包含 nginx -t、平滑重载及失败恢复，不能沿用登录保护的三秒超时。
        client = new HttpClient(handler) { BaseAddress = new Uri("http://localhost"), Timeout = TimeSpan.FromMinutes(2), MaxResponseContentBufferSize = 4 * 1024 * 1024 };
    }
    public Task<JsonObject> Instances(CancellationToken ct) => Send(HttpMethod.Get, "/nginx/instances", null, ct);
    public Task<JsonObject> Sites(string instanceId, CancellationToken ct) => Send(HttpMethod.Get, Query("sites", instanceId), null, ct);
    public Task<JsonObject> Configuration(string instanceId, string siteId, CancellationToken ct) => Send(HttpMethod.Get, Query("config", instanceId, siteId), null, ct);
    public Task<JsonObject> History(string instanceId, string siteId, CancellationToken ct) => Send(HttpMethod.Get, Query("history", instanceId, siteId), null, ct);
    public Task<JsonObject> Attach(HostNginxAttachRequest request, CancellationToken ct) => Send(HttpMethod.Post, "/nginx/attach", request, ct);
    public Task<JsonObject> Save(HostNginxSaveRequest request, CancellationToken ct)
    {
        if (request.Content is null || Encoding.UTF8.GetByteCount(request.Content) is < 1 or > 128 * 1024 || request.Content.Contains('\0'))
            throw new OpsException("网站配置必须为不超过 128 KiB 的文本。");
        return Send(HttpMethod.Post, "/nginx/config", request, ct);
    }
    public Task<JsonObject> Rollback(HostNginxRollbackRequest request, CancellationToken ct) => Send(HttpMethod.Post, "/nginx/rollback", request, ct);
    public Task<JsonObject> Test(HostNginxControlRequest request, CancellationToken ct) => Send(HttpMethod.Post, "/nginx/test", request, ct);
    public Task<JsonObject> Reload(HostNginxControlRequest request, CancellationToken ct) => Send(HttpMethod.Post, "/nginx/reload", request, ct);
    public Task<JsonObject> PrepareHttp01(HostNginxHttp01Request request, CancellationToken ct)
    {
        if (request.ExpectedDomains is not {Length: >0 and <=100} || request.ExpectedDomains.Any(x => string.IsNullOrWhiteSpace(x)))
            throw new OpsException("请刷新网站域名快照后再申请证书。");
        return Send(HttpMethod.Post, "/nginx/http01", request, ct);
    }
    public Task<JsonObject> DeployCertificate(HostNginxCertificateRequest request, CancellationToken ct)
    {
        _ = PanelCertificate.Import("external", "外部网站自动证书", request.CertificatePem, request.PrivateKeyPem);
        return Send(HttpMethod.Post, "/nginx/certificate", request, ct);
    }
    public Task<JsonObject> VerifyManagedTls(HostNginxManagedTlsRequest request, CancellationToken ct) => Send(HttpMethod.Post, "/nginx/verify-managed-tls", request, ct);
    private static string Query(string action, string instanceId, string? siteId = null) => "/nginx/" + action + "?instanceId=" + Uri.EscapeDataString(instanceId)
        + (siteId is null ? "" : "&siteId=" + Uri.EscapeDataString(siteId));
    private async Task<JsonObject> Send(HttpMethod method, string path, object? body, CancellationToken ct)
    {
        try
        {
            using var request = new HttpRequestMessage(method, path);
            if (body is not null)
            {
                // Unix 控制协议明确拒绝 chunked/Expect；先固定 UTF-8 字节与 Content-Length，不能靠放宽宿主解析绕过。
                request.Content = new ByteArrayContent(JsonSerializer.SerializeToUtf8Bytes(body, JsonDefaults.Options));
                request.Content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/json") { CharSet = "utf-8" };
            }
            using var response = await client.SendAsync(request, ct);
            var result = JsonNode.Parse(await response.Content.ReadAsStringAsync(ct)) as JsonObject
                ?? throw new OpsException("宿主 Nginx 服务返回格式无效。", 502);
            if (!response.IsSuccessStatusCode)
                throw new OpsException(result["error"]?.GetValue<string>() is { Length: > 0 and <= 1000 } error ? error : "宿主 Nginx 操作失败，请回读网站状态。", (int)response.StatusCode);
            ValidateReceipt(method, path, body, result);
            return result;
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested) { throw new OpsException("宿主 Nginx 操作超时，结果未知；请使用原请求标识回读或重试，不能盲目提交新操作。", 504); }
        catch (Exception error) when (error is HttpRequestException or IOException or SocketException)
        { throw new OpsException("无法连接宿主 Nginx 管理服务，请确认主机服务已安装并运行。", 503); }
        catch (Exception error) when (error is JsonException or InvalidOperationException or FormatException)
        { throw new OpsException("宿主 Nginx 服务返回格式无效。", 502); }
    }
    // HTTP 200 只是传输结果；逐动作校验身份和生效字段，旧宿主、空 JSON 和错误实例均不能显示成功。
    private static void ValidateReceipt(HttpMethod method, string path, object? body, JsonObject receipt)
    {
        void Require(bool value) { if (!value) throw new OpsException("宿主 Nginx 回执未确认当前实例和操作结果。", 502); }
        string? Text(string name) => receipt[name]?.GetValue<string>();
        bool True(string name) => receipt[name]?.GetValue<bool>() == true;
        bool Hash(string name) => Regex.IsMatch(Text(name) ?? "", "^[a-f0-9]{64}$", RegexOptions.CultureInvariant);
        var action = path.Split('?')[0];
        if (body is HostNginxManagedTlsRequest tls)
        {
            Require(True("verified") && receipt["certificates"] is JsonArray);
            var actual = receipt["certificates"]!.AsArray();
            Require(actual.Count == tls.Domains.Length && tls.Domains.Select(x => x.ServerName).Distinct(StringComparer.OrdinalIgnoreCase).Count() == tls.Domains.Length);
            foreach (var domain in tls.Domains)
                Require(actual.Count(x => x?["serverName"]?.GetValue<string>() == domain.ServerName && string.Equals(x?["sha256"]?.GetValue<string>(), domain.CertificateSha256, StringComparison.OrdinalIgnoreCase)) == 1);
            return;
        }
        var request = body is null ? null : JsonSerializer.SerializeToNode(body, JsonDefaults.Options)!.AsObject();
        if (request is not null)
        {
            Require(Text("instanceId") == request["instanceId"]?.GetValue<string>() && Hash("fingerprint") && Text("fingerprint") == request["expectedFingerprint"]?.GetValue<string>());
            if (request.ContainsKey("siteId")) Require(Text("siteId") == request["siteId"]?.GetValue<string>());
            if (request.ContainsKey("requestId")) Require(Guid.TryParse(Text("requestId"), out var resultId) && Guid.TryParse(request["requestId"]?.GetValue<string>(), out var requestedId) && resultId == requestedId);
            if (action == "/nginx/attach") { Require(True("attached")); return; }
            Require(True("validated"));
            if (action != "/nginx/test") Require(True("reloaded"));
            if (request.ContainsKey("siteId")) Require(Hash("configSha256"));
            if (body is HostNginxSaveRequest save) Require(Text("configSha256") == Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(save.Content))).ToLowerInvariant());
            if (action == "/nginx/http01")
            {
                Require(True("prepared") && Hash("isolationId") && receipt["domains"] is JsonArray { Count: > 0 });
                var returnedDomains = receipt["domains"]!.AsArray().Select(x => x?.GetValue<string>() ?? "").Order(StringComparer.Ordinal).ToArray();
                Require(body is HostNginxHttp01Request http01 && http01.ExpectedDomains is not null && returnedDomains.SequenceEqual(http01.ExpectedDomains.Distinct().Order(StringComparer.Ordinal)));
                PanelAcme.ValidateChallengePath(Text("challengeHostPath") ?? "");
                Require(Text("challengeHostPath")!.EndsWith("/.microi-acme-" + Text("isolationId"), StringComparison.Ordinal));
            }
            if (body is HostNginxCertificateRequest certificate)
                Require(True("verified") && Hash("certificateSha256") && Text("certificateSha256") == PanelAcme.CertificateSha256(PanelCertificate.Import("external", "外部证书", certificate.CertificatePem, certificate.PrivateKeyPem)));
            return;
        }
        if (action == "/nginx/instances") { Require(receipt["instances"] is JsonArray && receipt["errors"] is JsonArray && receipt["protocol"]?.GetValue<int>() == 1); return; }
        var query = System.Web.HttpUtility.ParseQueryString(new Uri("http://localhost" + path).Query);
        Require(Text("instanceId") == query["instanceId"]);
        if (query["siteId"] is { } siteId) Require(Text("siteId") == siteId);
        if (action == "/nginx/sites") Require(Hash("fingerprint") && receipt["sites"] is JsonArray);
        else if (action == "/nginx/config")
        {
            Require(Hash("fingerprint") && Hash("sha256") && receipt["content"] is JsonValue && receipt["domains"] is JsonArray);
            var content = Text("content")!;
            Require(Encoding.UTF8.GetByteCount(content) is >0 and <=128*1024 && Text("sha256") == Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(content))).ToLowerInvariant());
            Require(receipt["domains"]!.AsArray().All(x => x?.GetValue<string>() is {Length: >0 and <=253}));
        }
        else if (action == "/nginx/history") Require(receipt["revisions"] is JsonArray);
        else Require(false);
    }
    public void Dispose() => client.Dispose();
}

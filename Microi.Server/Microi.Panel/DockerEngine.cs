using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json.Nodes;

namespace Microi.Panel;

public sealed partial class DockerEngine : IDisposable
{
    private readonly HttpClient http;
    private readonly OpsOptions options;
    private readonly SemaphoreSlim negotiation = new(1, 1);
    public HostOperationGate HostOperations { get; } = new();
    private string prefix = "";
    public DockerEngine(OpsOptions options)
    {
        this.options = options;
        var handler = new SocketsHttpHandler
        {
            ConnectCallback = async (_, ct) =>
            {
                var socket = new Socket(AddressFamily.Unix, SocketType.Stream, ProtocolType.Unspecified);
                try { await socket.ConnectAsync(new UnixDomainSocketEndPoint(options.DockerSocket), ct); return new NetworkStream(socket, true); }
                catch { socket.Dispose(); throw; }
            }
        };
        http = new(handler) { BaseAddress = new("http://docker"), Timeout = Timeout.InfiniteTimeSpan };
    }
    private async Task Negotiate(CancellationToken ct)
    {
        if (prefix.Length > 0) return;
        await negotiation.WaitAsync(ct);
        try
        {
            if (prefix.Length > 0) return;
            using var limit = CancellationTokenSource.CreateLinkedTokenSource(ct); limit.CancelAfter(TimeSpan.FromSeconds(15));
            var version = JsonNode.Parse(await http.GetStringAsync("/version", limit.Token))!;
            var max = Version.Parse(version["ApiVersion"]!.GetValue<string>());
            var min = Version.Parse(version["MinAPIVersion"]?.GetValue<string>() ?? "1.24");
            var selected = max < new Version(1, 53) ? max : new Version(1, 53);
            if (selected < min || selected < new Version(1, 41)) throw new OpsException("Docker Engine API 版本不受支持。", 503);
            if (version["Os"]?.GetValue<string>() != "linux") throw new OpsException("当前版本支持 Linux Docker Engine。", 503);
            prefix = "/v" + selected;
        }
        finally { negotiation.Release(); }
    }
    public async Task<JsonNode?> Json(HttpMethod method, string path, JsonNode? body = null, CancellationToken ct = default, bool allowMissing = false, string registryImage = "")
    {
        await Negotiate(ct);
        using var limit = CancellationTokenSource.CreateLinkedTokenSource(ct); limit.CancelAfter(TimeSpan.FromSeconds(65));
        using var request = Request(method, prefix + path, body, registryImage);
        using var response = await http.SendAsync(request, limit.Token);
        if (allowMissing && response.StatusCode == HttpStatusCode.NotFound) return null;
        var text = await response.Content.ReadAsStringAsync(limit.Token);
        if (!response.IsSuccessStatusCode) throw new OpsException("Docker 操作失败：" + Redaction.Clean(text, 600), (int)response.StatusCode == 409 ? 409 : 502);
        return text.Length > 0 ? JsonNode.Parse(text) : null;
    }
    private HttpRequestMessage Request(HttpMethod method, string path, JsonNode? body, string registryImage = "")
    {
        var request = new HttpRequestMessage(method, path);
        if (body != null) request.Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
        if (registryImage.Length > 0 && File.Exists(options.RegistryConfigFile))
        {
            var config = JsonNode.Parse(File.ReadAllText(options.RegistryConfigFile));
            var registry = registryImage.Split('/')[0];
            var auth = config?["auths"]?[registry];
            if (auth?["auth"]?.GetValue<string>() is { Length: > 0 } encoded)
            {
                var credentials = Encoding.UTF8.GetString(Convert.FromBase64String(encoded)).Split(':', 2);
                if (credentials.Length != 2) throw new OpsException("私有镜像仓库凭据格式无效。");
                var value = new JsonObject { ["username"] = credentials[0], ["password"] = credentials[1], ["serveraddress"] = registry };
                request.Headers.Add("X-Registry-Auth", Convert.ToBase64String(Encoding.UTF8.GetBytes(value.ToJsonString())));
            }
            else if (auth?["identitytoken"]?.GetValue<string>() is { Length: > 0 } identity)
            {
                var value = new JsonObject { ["identitytoken"] = identity, ["serveraddress"] = registry };
                request.Headers.Add("X-Registry-Auth", Convert.ToBase64String(Encoding.UTF8.GetBytes(value.ToJsonString())));
            }
        }
        return request;
    }
    public Task<JsonNode?> Inspect(string id, CancellationToken ct = default) => Json(HttpMethod.Get, "/containers/" + Uri.EscapeDataString(id) + "/json", ct: ct, allowMissing: true);
    public Task<JsonNode?> Image(string id, CancellationToken ct = default) => Json(HttpMethod.Get, "/images/" + Uri.EscapeDataString(id) + "/json", ct: ct, allowMissing: true);
    public Task<JsonNode?> Info(CancellationToken ct = default) => Json(HttpMethod.Get, "/info", ct: ct);
    public async Task<string> RemoteDigest(string image, CancellationToken ct)
    {
        var data = await Json(HttpMethod.Get, "/distribution/" + Uri.EscapeDataString(image) + "/json", ct: ct, registryImage: image);
        return data?["Descriptor"]?["digest"]?.GetValue<string>() ?? throw new OpsException("仓库未返回镜像摘要。", 502);
    }
    public async Task Pull(string image, Action<JsonNode> progress, CancellationToken ct)
    {
        await Negotiate(ct);
        using var limit = CancellationTokenSource.CreateLinkedTokenSource(ct); limit.CancelAfter(TimeSpan.FromMinutes(30));
        using var request = Request(HttpMethod.Post, prefix + "/images/create?fromImage=" + Uri.EscapeDataString(image), null, image);
        using var response = await http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, limit.Token);
        if (!response.IsSuccessStatusCode) throw new OpsException("镜像拉取失败，HTTP " + (int)response.StatusCode, 502);
        using var stream = await response.Content.ReadAsStreamAsync(limit.Token); using var reader = new StreamReader(stream);
        while (await reader.ReadLineAsync(limit.Token) is { } line)
        {
            if (line.Length > 1024 * 1024) throw new OpsException("Docker 进度响应超过限制。", 502);
            var item = JsonNode.Parse(line); if (item == null) continue;
            if (item["error"] != null) throw new OpsException("镜像拉取失败：" + Redaction.Clean(item["error"]!.ToString(), 500), 502);
            progress(item);
        }
    }
    public async Task<string> Logs(string name, CancellationToken ct, string? since = null)
    {
        await Negotiate(ct);
        using var limit = CancellationTokenSource.CreateLinkedTokenSource(ct); limit.CancelAfter(TimeSpan.FromSeconds(15));
        using var response = await http.GetAsync(prefix + "/containers/" + Uri.EscapeDataString(name) + "/logs?stdout=1&stderr=1&tail=120&timestamps=1"
            + (since==null?"":"&since="+LogTimestamp(since)), limit.Token);
        if (!response.IsSuccessStatusCode) throw new OpsException("无法读取容器日志，HTTP " + (int)response.StatusCode + "：" + Redaction.Clean(await response.Content.ReadAsStringAsync(limit.Token),600), 502);
        var bytes = await response.Content.ReadAsByteArrayAsync(limit.Token);
        if (bytes.Length > 1024 * 1024) throw new OpsException("日志过大，请缩小容器输出。", 502);
        using var output = new MemoryStream(); var index = 0;
        while (index + 8 <= bytes.Length && bytes[index] <= 2 && bytes[index + 1] == 0 && bytes[index + 2] == 0 && bytes[index + 3] == 0)
        {
            var size = System.Buffers.Binary.BinaryPrimitives.ReadInt32BigEndian(bytes.AsSpan(index + 4, 4));
            if (size < 0 || index + 8 + size > bytes.Length) break;
            output.Write(bytes, index + 8, size); index += size + 8;
        }
        return Redaction.Clean(Encoding.UTF8.GetString(index == bytes.Length ? output.ToArray() : bytes), 64000);
    }
    // Engine API accepts Unix seconds, unlike the CLI which converts RFC3339 itself.
    // Preserve subsecond precision so errors from a previous attempt cannot affect recovery.
    public static string LogTimestamp(string value)
    {
        if(!DateTimeOffset.TryParse(value,System.Globalization.CultureInfo.InvariantCulture,System.Globalization.DateTimeStyles.AssumeUniversal,out var timestamp))
            throw new OpsException("容器日志起始时间无效。",502);
        return ((timestamp.UtcTicks-DateTimeOffset.UnixEpoch.Ticks)/(decimal)TimeSpan.TicksPerSecond)
            .ToString("0.0000000",System.Globalization.CultureInfo.InvariantCulture);
    }
    public async Task<List<object>> Containers(CancellationToken ct)
    {
        var items = (await Json(HttpMethod.Get, "/containers/json?all=1", ct: ct))?.AsArray() ?? [];
        var managed = options.Deployment.Services.Select(x => x.Name).ToHashSet(StringComparer.Ordinal);
        return items.Where(x => x != null).Select(x => x!).Where(x =>
        {
            var name = x["Names"]?[0]?.ToString().TrimStart('/') ?? "";
            return managed.Contains(name) || name.Contains("microi", StringComparison.OrdinalIgnoreCase) || name == options.Deployment.WatchtowerName;
        }).Select(x => (object)new
        {
            Id = x["Id"]?.ToString(), Name = x["Names"]?[0]?.ToString().TrimStart('/'), Image = x["Image"]?.ToString(),
            State = x["State"]?.ToString(), Status = x["Status"]?.ToString(), Managed = managed.Contains(x["Names"]?[0]?.ToString().TrimStart('/') ?? "")
        }).ToList();
    }
    public void Dispose() { http.Dispose(); negotiation.Dispose(); }
}

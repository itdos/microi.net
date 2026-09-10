using Microsoft.AspNetCore.DataProtection;
using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Microi.Panel;

public sealed class PlatformConnection : IDisposable
{
    private readonly OpsOptions options;
    private readonly OpsStore store;
    private readonly IDataProtector protector;
    private readonly HttpClient http;
    private readonly SemaphoreSlim loginGate = new(1, 1);
    private long disconnectGeneration;
    private readonly object sessionGate = new();
    private const string DefaultPublicKey = """
        -----BEGIN PUBLIC KEY-----
        MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC7q21EG3HiSFNO9XFUJoMeyz2R
        XaFX8UgCFE4d4pvK6IvQsWunm+WfYqgrSzBMS1LH1fstmZB0wnVUX1uGROaZTKGZ
        1rS/MVn4i6CsPgP9Q7nFV6dZvbxro1byH/E3CV/Q1CgCDeue9FzQUlWQ+UZld8Jg
        1DsI9VJ7gTHGL3R7sQIDAQAB
        -----END PUBLIC KEY-----
        """;
    public PlatformConnection(OpsOptions options, OpsStore store, IDataProtectionProvider protection)
    {
        this.options = options; this.store = store;
        protector = protection.CreateProtector("microi.ops.platform-session.v1", CurrentBinding);
        var handler = new HttpClientHandler { AllowAutoRedirect = false, UseCookies = false };
        if (options.PlatformCertificateFile.Length > 0)
        {
            var pinned = X509CertificateLoader.LoadCertificateFromFile(options.PlatformCertificateFile).GetCertHash(HashAlgorithmName.SHA256);
            handler.ServerCertificateCustomValidationCallback = (_, certificate, _, errors) => certificate != null
                && (errors == System.Net.Security.SslPolicyErrors.None || CryptographicOperations.FixedTimeEquals(pinned, certificate.GetCertHash(HashAlgorithmName.SHA256)));
        }
        http = new(handler) { Timeout = TimeSpan.FromSeconds(25) };
        http.DefaultRequestHeaders.Add("did", "Microi.Ops:" + options.Deployment.Id);
    }
    public static string Binding(string apiBase, string osClient) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(apiBase.TrimEnd('/') + "\0" + osClient.ToLowerInvariant())));
    public string CurrentBinding => Binding(options.Deployment.PlatformApiBase, options.Deployment.PlatformOsClient);
    private string Endpoint(string path)
    {
        if (options.Deployment.PlatformApiBase.Length == 0 || options.Deployment.PlatformOsClient.Length == 0)
            throw new OpsException("请在受控部署清单配置 platformApiBase 与 platformOsClient 后连接平台。");
        return options.Deployment.PlatformApiBase.TrimEnd('/') + "/" + path.TrimStart('/');
    }
    public PlatformSession? Session()
    {
        var session = store.Get<PlatformSession>("platform");
        return session?.Binding == CurrentBinding ? session : null;
    }
    public object Status()
    {
        var session = Session();
        return new
        {
            ApiBase = options.Deployment.PlatformApiBase, OsClient = options.Deployment.PlatformOsClient,
            Connected = session?.TokenCipher.Length > 0, session?.Account, session?.Name, session?.ConnectedAt,
            session?.LastSync, session?.LastError, PendingEvents = store.PendingEvents(CurrentBinding)
        };
    }
    public async Task<JsonObject> LoginConfig(CancellationToken ct)
    {
        var config = await Config(ct);
        return new()
        {
            ["apiBase"] = options.Deployment.PlatformApiBase, ["osClient"] = options.Deployment.PlatformOsClient,
            ["title"] = config["SysTitle"]?.ToString() ?? "吾码平台", ["enableCaptcha"] = Enabled(config["EnableCaptcha"]),
            ["enablePrivacyPolicy"] = Enabled(config["EnablePrivacyPolicy"]), ["privacyPolicyName"] = config["PrivacyPolicyName"]?.ToString() ?? "同意隐私协议"
        };
    }
    private async Task<JsonNode> Config(CancellationToken ct)
    {
        var payload = new JsonObject { ["OsClient"] = options.Deployment.PlatformOsClient };
        PlatformReply reply;
        try { reply = await Send("apiengine/platform-sys-config", payload, "", ct); }
        catch (PlatformHttpException e) when (e.Status is 404 or 405 or 501) { reply = await Send("api/FormEngine/GetSysConfig", payload, "", ct); }
        var message = reply.Body?["Msg"]?.ToString() ?? "";
        if (!Success(reply.Body) && message.Contains("platform-sys-config", StringComparison.OrdinalIgnoreCase)
            && (message.Contains("NoExistData", StringComparison.OrdinalIgnoreCase) || message.Contains("不存在")))
            reply = await Send("api/FormEngine/GetSysConfig", payload, "", ct);
        EnsureSuccess(reply.Body, "读取平台登录设置失败");
        return reply.Body?["Data"] ?? throw new OpsException("平台登录设置为空，不能推断验证码已关闭。", 502);
    }
    public async Task<object> Captcha(CancellationToken ct)
    {
        var config = await Config(ct);
        if (!Enabled(config["EnableCaptcha"])) return new { enabled = false, id = "", image = "" };
        using var response = await http.GetAsync(Endpoint("api/Captcha/GetCaptcha") + "?OsClient=" + Uri.EscapeDataString(options.Deployment.PlatformOsClient), ct);
        if (!response.IsSuccessStatusCode || !response.Headers.TryGetValues("captchaid", out var ids)) throw new OpsException("无法获取平台验证码。", 502);
        var bytes = await response.Content.ReadAsByteArrayAsync(ct);
        if (bytes.Length > 512 * 1024 || response.Content.Headers.ContentType?.MediaType?.StartsWith("image/", StringComparison.OrdinalIgnoreCase) != true)
            throw new OpsException("验证码响应无效。", 502);
        return new { enabled = true, id = ids.First(), image = "data:image/png;base64," + Convert.ToBase64String(bytes) };
    }
    public async Task<object> Login(PlatformLogin request, CancellationToken ct)
    {
        var generation = Interlocked.Read(ref disconnectGeneration);
        await loginGate.WaitAsync(ct);
        try
        {
            if (string.IsNullOrWhiteSpace(request.Account) || request.Account.Length > 100 || string.IsNullOrEmpty(request.Password) || request.Password.Length > 512) throw new OpsException("请输入平台账号密码。");
            // 每次登录重新读取权威开关，不相信浏览器报告的验证码状态。
            var config = await Config(ct);
            if (Enabled(config["EnableCaptcha"]) && (string.IsNullOrEmpty(request.CaptchaId) || string.IsNullOrEmpty(request.CaptchaValue))) throw new OpsException("请输入平台验证码。");
            if (Enabled(config["EnablePrivacyPolicy"]) && !request.AcceptPrivacy) throw new OpsException("请先同意平台隐私协议。");
            var publicKey = config["LoginRsaPublicKey"]?.ToString().Replace("\\n", "\n");
            using var rsa = RSA.Create(); rsa.ImportFromPem(string.IsNullOrWhiteSpace(publicKey) ? DefaultPublicKey : publicKey);
            var encrypted = Convert.ToBase64String(rsa.Encrypt(Encoding.UTF8.GetBytes(request.Password), RSAEncryptionPadding.Pkcs1));
            var payload = new JsonObject
            {
                ["OsClient"] = options.Deployment.PlatformOsClient, ["Account"] = request.Account, ["Pwd"] = encrypted,
                ["_ClientType"] = "MCP", ["_CaptchaId"] = request.CaptchaId, ["_CaptchaValue"] = request.CaptchaValue
            };
            var reply = await Send("api/SysUser/Login", payload, "", ct); EnsureSuccess(reply.Body, "平台登录失败");
            var token = reply.Authorization;
            if (token.Length == 0) token = reply.Body?["DataAppend"]?["Token"]?.ToString() ?? reply.Body?["Data"]?["Authorization"]?.ToString() ?? "";
            if (token.Length == 0) throw new OpsException("平台登录未返回会话。", 502);
            var session = new PlatformSession
            {
                Binding = CurrentBinding, Account = request.Account, Name = reply.Body?["Data"]?["Name"]?.ToString() ?? request.Account,
                TokenCipher = protector.Protect(token), ConnectedAt = DateTimeOffset.UtcNow
            };
            lock (sessionGate)
            {
                if (generation != Interlocked.Read(ref disconnectGeneration)) throw new OpsException("平台连接已取消，请重新登录。", 409);
                store.Set("platform", session);
            }
            return Status();
        }
        finally { loginGate.Release(); }
    }
    public void Disconnect() { lock (sessionGate) { Interlocked.Increment(ref disconnectGeneration); store.Set<PlatformSession?>("platform", null); } }
    public async Task Flush(CancellationToken ct)
    {
        var session = Session(); if (session?.TokenCipher.Length is not > 0) return;
        var expected = JsonSerializer.Deserialize<PlatformSession>(JsonSerializer.Serialize(session, JsonDefaults.Options), JsonDefaults.Options)!;
        var pending = store.Events(true, CurrentBinding); if (pending.Count == 0) return;
        var token = protector.Unprotect(session.TokenCipher);
        foreach (var entry in pending)
        {
            if (Session()?.ConnectedAt != expected.ConnectedAt) return;
            try
            {
                var payload = JsonSerializer.SerializeToNode(entry, JsonDefaults.Options)!.AsObject();
                payload["OsClient"] = options.Deployment.PlatformOsClient;
                var reply = await Send("apiengine/platform-ops-event-ingest", payload, token, ct);
                EnsureSuccess(reply.Body, "平台未确认运维日志持久化");
                if (reply.Body?["Data"]?["EventId"]?.ToString() != entry.EventId) throw new OpsException("平台日志回执 Id 不一致。", 502);
                if (reply.Authorization.Length > 0) { token = reply.Authorization; session.TokenCipher = protector.Protect(token); }
                store.EventResult(entry.EventId, true); session.LastSync = DateTimeOffset.UtcNow; session.LastError = "";
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception error)
            {
                store.EventResult(entry.EventId, false);
                session.LastError = error is OpsException or PlatformHttpException ? Redaction.Clean(error.Message, 400) : "平台暂不可用，日志已保留等待补投。";
                if (error is PlatformHttpException { Status: 401 or 403 }) session.TokenCipher = "";
                store.CompareExchange("platform", expected, session); return;
            }
        }
        store.CompareExchange("platform", expected, session);
    }
    private async Task<PlatformReply> Send(string path, JsonObject body, string token, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, Endpoint(path));
        request.Content = new StringContent(body.ToJsonString(), Encoding.UTF8, "application/json");
        if (token.Length > 0) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) ? token[7..] : token);
        using var response = await http.SendAsync(request, ct);
        if (!response.IsSuccessStatusCode) throw new PlatformHttpException((int)response.StatusCode);
        var text = await response.Content.ReadAsStringAsync(ct);
        if (text.Length > 2 * 1024 * 1024) throw new OpsException("平台响应超过限制。", 502);
        var json = JsonNode.Parse(text);
        if (json?["Code"]?.ToString() is "1001" or "1002") throw new PlatformHttpException(401);
        return new(json, response.Headers.TryGetValues("authorization", out var values) ? values.First() : "");
    }
    private static bool Enabled(JsonNode? value) => value?.ToString().ToLowerInvariant() is "1" or "true";
    private static bool Success(JsonNode? body) => body?["Code"]?.ToString() == "1";
    private static void EnsureSuccess(JsonNode? body, string message)
    {
        if (!Success(body)) throw new OpsException(message + "：" + Redaction.Clean(body?["Msg"]?.ToString(), 400), 502);
    }
    public void Dispose() { http.Dispose(); loginGate.Dispose(); }
    private sealed record PlatformReply(JsonNode? Body, string Authorization);
    private sealed class PlatformHttpException(int status) : Exception("平台请求失败，HTTP " + status) { public int Status { get; } = status; }
}
public sealed class PlatformSession
{
    public string Binding { get; set; } = "";
    public string TokenCipher { get; set; } = "";
    public string Account { get; set; } = "";
    public string Name { get; set; } = "";
    public DateTimeOffset ConnectedAt { get; set; }
    public DateTimeOffset? LastSync { get; set; }
    public string LastError { get; set; } = "";
}
public sealed record PlatformLogin(string Account, string Password, string CaptchaId = "", string CaptchaValue = "", bool AcceptPrivacy = false);

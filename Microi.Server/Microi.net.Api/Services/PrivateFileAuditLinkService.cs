using System.Security.Cryptography;
using Dos.Common;
using Microi.net;

namespace Microi.net.Api;

public sealed class PrivateFileAuditLinkService : IPrivateFileAuditLinkService
{
    private static readonly TimeSpan TicketLifetime = TimeSpan.FromMinutes(30);
    private readonly IHttpContextAccessor _httpContextAccessor;

    public PrivateFileAuditLinkService(IHttpContextAccessor httpContextAccessor) => _httpContextAccessor = httpContextAccessor;

    public async Task<DosResult> WrapAsync(DosResult result, DiyUploadParam param)
    {
        if (result?.Code != 1 || result.Data == null || param == null || param.OsClient.DosIsNullOrWhiteSpace()) return result;
        try
        {
            var urls = result.Data is IEnumerable<string> many && result.Data is not string
                ? many.ToList()
                : new List<string> { result.Data.ToString() };
            var paths = param.FilePathNames?.ToList() ?? new List<string>();
            if (paths.Count == 0) paths.Add(param.FilePathName);
            var wrapped = new List<string>();
            for (var i = 0; i < urls.Count; i++)
            {
                var upstream = urls[i];
                if (!Uri.TryCreate(upstream, UriKind.Absolute, out var upstreamUri)
                    || (upstreamUri.Scheme != Uri.UriSchemeHttp && upstreamUri.Scheme != Uri.UriSchemeHttps))
                    continue;
                var ticketId = Base64Url(RandomNumberGenerator.GetBytes(32));
                var path = i < paths.Count ? paths[i] : paths.FirstOrDefault();
                var ticket = new PrivateFileAuditTicket
                {
                    OsClient = param.OsClient,
                    UpstreamUrl = upstream,
                    FilePath = path,
                    FileName = Path.GetFileName(path ?? upstreamUri.AbsolutePath),
                    IssuedAt = DateTime.Now,
                    ExpiresAt = DateTime.Now.Add(TicketLifetime),
                    IssuerUserId = param._CurrentUser?["Id"]?.ToString(),
                    IssuerUserName = UserBehaviorAudit.FormatUser(param._CurrentUser)
                };
                var key = PrivateFileAuditTicket.CacheKey(param.OsClient, ticketId);
                await MicroiEngine.CacheTenant.Cache(param.OsClient).SetAsync(key, ticket, TicketLifetime).ConfigureAwait(false);
                wrapped.Add(await BuildProxyUrlAsync(param.OsClient, ticketId, param.ForOfficePreview == true).ConfigureAwait(false));
                UserBehaviorAudit.Track(param, "File", "PrivateFileUrlIssued", "私有附件", "PrivateFile", path,
                    $"获取了私有附件[{ticket.FileName}]的临时访问地址", new { FilePath = path, TicketExpiresAt = ticket.ExpiresAt },
                    true, null, "ServerFileGateway", eventId:
                    UserBehaviorAudit.DeterministicEventId($"private-file-issued|{param.OsClient}|{ticketId}"));
            }
            if (wrapped.Count != urls.Count)
                return new DosResult(0, null, "私有文件审计代理未能生成完整访问地址，请稍后重试。");
            result.Data = result.Data is string ? wrapped[0] : wrapped;
            return result;
        }
        catch (Exception ex)
        {
            // 私有文件默认失败关闭，禁止在审计代理异常时把真实对象存储签名地址泄漏给客户端。
            MicroiEngine.QueueSysLog(new SysLogParam
            {
                OsClient = param.OsClient,
                Category = "File",
                Action = "PrivateFileProxyIssueFailed",
                Source = "ServerFileGateway",
                Type = "私有附件",
                Title = "私有附件审计代理地址生成失败",
                Content = ex.Message,
                Success = false,
                OccurredAt = DateTime.Now,
                Level = 2
            });
            return new DosResult(0, null, "私有文件审计通道暂时不可用，请稍后重试。");
        }
    }

    private async Task<string> BuildProxyUrlAsync(string osClient, string ticketId, bool preferConfiguredApiBase)
    {
        var request = _httpContextAccessor.HttpContext?.Request;
        string apiBase = null;
        if (preferConfiguredApiBase)
        {
            try
            {
                var config = await MicroiEngine.FormEngine.GetSysConfig(osClient).ConfigureAwait(false);
                apiBase = DynamicHelper.GetDynamicStringValue(config?.Data, "ApiBase");
            }
            catch { }
        }
        if (!IsHttpBaseUrl(apiBase) && request != null)
        {
            apiBase = $"{request.Scheme}://{request.Host}{request.PathBase}";
        }
        if (!IsHttpBaseUrl(apiBase))
        {
            try
            {
                var config = await MicroiEngine.FormEngine.GetSysConfig(osClient).ConfigureAwait(false);
                apiBase = DynamicHelper.GetDynamicStringValue(config?.Data, "ApiBase");
            }
            catch { }
        }
        if (apiBase.DosIsNullOrWhiteSpace()) return $"/api/HDFS/OpenPrivateFile?o={Uri.EscapeDataString(osClient)}&t={ticketId}";
        return apiBase.TrimEnd('/') + $"/api/HDFS/OpenPrivateFile?o={Uri.EscapeDataString(osClient)}&t={ticketId}";
    }

    private static bool IsHttpBaseUrl(string value)
    {
        return Uri.TryCreate(value, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
            && !string.IsNullOrWhiteSpace(uri.Host);
    }

    private static string Base64Url(byte[] bytes) => Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}

public sealed class PrivateFileAuditTicket
{
    public string OsClient { get; set; }
    public string UpstreamUrl { get; set; }
    public string FilePath { get; set; }
    public string FileName { get; set; }
    public DateTime IssuedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public string IssuerUserId { get; set; }
    public string IssuerUserName { get; set; }

    public static string CacheKey(string osClient, string ticketId) => $"Microi:{osClient}:Audit:PrivateFile:{ticketId}";
}

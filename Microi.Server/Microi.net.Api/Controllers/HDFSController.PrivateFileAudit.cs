using System.Net;
using System.Net.Http.Headers;
using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api;

public partial class HDFSController
{
    /// <summary>
    /// 私有附件审计代理。Ticket只保存于Redis且30分钟过期；对象存储真实签名地址不会暴露给浏览器。
    /// 支持匿名打开转发链接，并以流式转发避免大文件占用服务器内存。
    /// </summary>
    [HttpGet, HttpHead]
    [AllowAnonymous]
    public async Task<IActionResult> OpenPrivateFile(string o, string t)
    {
        if (o.DosIsNullOrWhiteSpace() || t.DosIsNullOrWhiteSpace() || t.Length > 128)
            return NotFound();
        PrivateFileAuditTicket ticket;
        try
        {
            ticket = await MicroiEngine.CacheTenant.Cache(o)
                .GetAsync<PrivateFileAuditTicket>(PrivateFileAuditTicket.CacheKey(o, t)).ConfigureAwait(false);
        }
        catch { return StatusCode(StatusCodes.Status503ServiceUnavailable); }
        if (ticket == null || ticket.ExpiresAt <= DateTime.Now || !string.Equals(ticket.OsClient, o, StringComparison.OrdinalIgnoreCase))
        {
            QueuePrivateFileOpen(ticket, o, t, false, "临时链接不存在或已过期", null, null);
            return NotFound();
        }

        JObject currentUser = null;
        try
        {
            var currentToken = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
            if (currentToken?.CurrentUser != null && string.Equals(currentToken.OsClient, o, StringComparison.OrdinalIgnoreCase))
                currentUser = currentToken.CurrentUser;
        }
        catch { }

        var factory = HttpContext.RequestServices.GetRequiredService<IHttpClientFactory>();
        using var upstreamRequest = new HttpRequestMessage(HttpMethod.Get, ticket.UpstreamUrl);
        if (Request.Headers.TryGetValue("Range", out var rangeValue)
            && RangeHeaderValue.TryParse(rangeValue.ToString(), out var range)) upstreamRequest.Headers.Range = range;
        try
        {
            using var upstream = await factory.CreateClient().SendAsync(upstreamRequest,
                HttpCompletionOption.ResponseHeadersRead, HttpContext.RequestAborted).ConfigureAwait(false);
            if (!upstream.IsSuccessStatusCode && upstream.StatusCode != HttpStatusCode.PartialContent)
            {
                QueuePrivateFileOpen(ticket, o, t, false, $"上游返回{(int)upstream.StatusCode}", currentUser, null);
                return StatusCode((int)upstream.StatusCode);
            }

            Response.StatusCode = (int)upstream.StatusCode;
            if (upstream.Content.Headers.ContentType != null) Response.ContentType = upstream.Content.Headers.ContentType.ToString();
            if (upstream.Content.Headers.ContentLength.HasValue) Response.ContentLength = upstream.Content.Headers.ContentLength.Value;
            CopyHeader(upstream, "Accept-Ranges");
            CopyHeader(upstream, "Content-Range");
            CopyHeader(upstream, "Content-Disposition");
            Response.Headers["X-Content-Type-Options"] = "nosniff";
            if (!HttpMethods.IsHead(Request.Method))
            {
                QueuePrivateFileOpen(ticket, o, t, true, null, currentUser, upstream.Content.Headers.ContentLength);
                await using var stream = await upstream.Content.ReadAsStreamAsync(HttpContext.RequestAborted).ConfigureAwait(false);
                await stream.CopyToAsync(Response.Body, HttpContext.RequestAborted).ConfigureAwait(false);
            }
            return new EmptyResult();
        }
        catch (OperationCanceledException) when (HttpContext.RequestAborted.IsCancellationRequested)
        {
            QueuePrivateFileOpen(ticket, o, t, false, "访问者取消了下载", currentUser, null);
            return new EmptyResult();
        }
        catch (Exception ex)
        {
            QueuePrivateFileOpen(ticket, o, t, false, ex.Message, currentUser, null);
            return StatusCode(StatusCodes.Status502BadGateway);
        }
    }

    private void CopyHeader(HttpResponseMessage upstream, string name)
    {
        if (upstream.Headers.TryGetValues(name, out var values) || upstream.Content.Headers.TryGetValues(name, out values))
            Response.Headers[name] = values.ToArray();
    }

    private void QueuePrivateFileOpen(PrivateFileAuditTicket ticket, string osClient, string ticketId, bool success, string error,
        JObject currentUser, long? contentLength)
    {
        var ip = IPHelper.GetClientIP(HttpContext).Data;
        var tracker = MicroiEngine.TryGetService<UserBehaviorSessionTracker>();
        var dedupKey = success
            ? $"private-file|{osClient}|{ticketId}|{currentUser?["Id"]}|{ip}"
            : $"private-file-failure|{osClient}|{ip}";
        if (tracker?.ShouldLogOnce(dedupKey, success ? TimeSpan.FromSeconds(30) : TimeSpan.FromSeconds(10)) == false)
            return;
        var actor = UserBehaviorAudit.FormatUser(currentUser);
        MicroiEngine.QueueSysLog(new SysLogParam
        {
            EventId = UserBehaviorAudit.DeterministicEventId(dedupKey,
                success ? TimeSpan.FromSeconds(30) : TimeSpan.FromSeconds(10)),
            OsClient = osClient,
            _CurrentUser = currentUser,
            UserId = currentUser?["Id"]?.ToString(),
            UserName = actor,
            Category = "File",
            Action = "PrivateFileOpen",
            Source = "ServerFileGateway",
            TargetType = "PrivateFile",
            TargetId = ticket?.FilePath,
            Type = "私有附件",
            Title = $"用户[{actor}]{(success ? "访问了" : "访问失败") }私有附件[{ticket?.FileName ?? "未知"}]",
            Content = Newtonsoft.Json.JsonConvert.SerializeObject(new
            {
                FilePath = ticket?.FilePath,
                FileName = ticket?.FileName,
                Issuer = ticket?.IssuerUserName,
                Anonymous = currentUser == null,
                ContentLength = contentLength,
                Range = Request.Headers["Range"].ToString(),
                Error = error
            }),
            IP = ip,
            Success = success,
            OccurredAt = DateTime.Now,
            Level = success ? 1 : 2
        });
    }
}

using Dos.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api;

[Route("api/[controller]/[action]")]
[EnableCors("any")]
// 提供受登录态约束的审核状态查询，以及经过微信签名验证的匿名回调入口。
public sealed class WeChatContentSecurityController : Controller
{
    private const int MaxCallbackCharacters = 256 * 1024;
    private readonly WeChatContentSecurityService _service;

    public WeChatContentSecurityController(WeChatContentSecurityService service)
    {
        _service = service;
    }

    /// <summary>
    /// 客户端只读取属于当前登录用户的审核状态；未知、过期和跨用户记录均失败关闭。
    /// </summary>
    [HttpPost]
    [AllowAnonymous]
    public async Task<JsonResult> Status(WeChatContentSecurityStatusParam param)
    {
        param ??= new WeChatContentSecurityStatusParam();
        string osClient;
        try
        {
            osClient = TenantConfigurationSecurity.NormalizeTenantId(param.OsClient);
        }
        catch
        {
            return Json(new DosResult(0, null, WeChatContentSecurityService.UnavailableContentMessage));
        }

        var user = await ResolveCurrentUserAsync(osClient).ConfigureAwait(false);
        var userId = user?["Id"]?.ToString();
        if (userId.DosIsNullOrWhiteSpace())
        {
            Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Json(new DosResult(1001, null, "登录身份已过期，请重新登录。"));
        }
        return Json(await _service.GetStatusAsync(osClient, param.ReviewId, userId).ConfigureAwait(false));
    }

    /// <summary>
    /// 微信公众平台“小程序消息推送”地址：
    /// /api/WeChatContentSecurity/Callback--OsClient--{OsClient}--（推荐）
    /// /api/WeChatContentSecurity/Callback?OsClient={OsClient}
    /// 同时处理首次 GET 校验和 mediaCheckAsync 的 POST 结果通知。
    /// </summary>
    [AcceptVerbs("GET", "POST")]
    [Route("~/api/WeChatContentSecurity/Callback")]
    [Route("~/api/WeChatContentSecurity/Callback--OsClient--{routeOsClient}--")]
    [AllowAnonymous]
    public async Task<IActionResult> Callback(
        [FromRoute] string routeOsClient,
        [FromQuery(Name = "OsClient")] string queryOsClient,
        string signature,
        string msg_signature,
        string timestamp,
        string nonce,
        string echostr)
    {
        if (!WeChatContentSecurityService.TryResolveCallbackTenant(
                routeOsClient,
                queryOsClient,
                out var osClient))
            return BadRequest();

        if (HttpMethods.IsGet(Request.Method))
        {
            var challenge = _service.ResolveCallbackChallenge(
                osClient, signature, msg_signature, timestamp, nonce, echostr);
            return challenge != null ? Content(challenge, "text/plain") : Unauthorized();
        }

        Request.EnableBuffering();
        Request.Body.Position = 0;
        var body = await ReadBoundedBodyAsync(HttpContext.RequestAborted).ConfigureAwait(false);
        Request.Body.Position = 0;
        if (body == null) return BadRequest();
        var accepted = await _service.ProcessCallbackAsync(
                osClient,
                body,
                signature,
                msg_signature,
                timestamp,
                nonce)
            .ConfigureAwait(false);
        return accepted ? Content("success", "text/plain") : Unauthorized();
    }

    private async Task<string> ReadBoundedBodyAsync(CancellationToken cancellationToken)
    {
        if (Request.ContentLength.HasValue
            && Request.ContentLength.Value > MaxCallbackCharacters)
            return null;
        using var reader = new StreamReader(Request.Body, leaveOpen: true);
        var buffer = new char[4096];
        var result = new System.Text.StringBuilder();
        while (true)
        {
            var read = await reader.ReadAsync(buffer.AsMemory(), cancellationToken).ConfigureAwait(false);
            if (read == 0) return result.ToString();
            if (result.Length + read > MaxCallbackCharacters) return null;
            result.Append(buffer, 0, read);
        }
    }

    private async Task<JObject> ResolveCurrentUserAsync(string osClient)
    {
        try
        {
            var current = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
            if (current?.CurrentUser != null
                && string.Equals(current.OsClient, osClient, StringComparison.OrdinalIgnoreCase))
                return current.CurrentUser;
        }
        catch { }

        var token = Request.Headers["Authorization"].ToString().DosTrim().DosReplace("Bearer ", "");
        if (token.DosIsNullOrWhiteSpace()) return null;
        var cache = MicroiEngine.CacheTenant.Cache(osClient);
        foreach (var key in new[]
                 {
                     $"Microi:{osClient}:ClientUserToken:{token}",
                     $"Microi:{osClient}:MobileMemberToken:{token}",
                     $"Microi:{osClient}:MallMemberToken:{token}"
                 })
        {
            var value = await cache.GetAsync(key).ConfigureAwait(false);
            if (value == null) continue;
            try { return JObject.Parse(value.ToString()); }
            catch
            {
                try { return await cache.GetAsync<JObject>(key).ConfigureAwait(false); }
                catch { }
            }
        }
        return null;
    }
}

public sealed class WeChatContentSecurityStatusParam : BaseParam
{
    public string ReviewId { get; set; }
}

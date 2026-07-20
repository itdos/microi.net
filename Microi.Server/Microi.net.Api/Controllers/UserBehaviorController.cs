using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api;

[Route("api/[controller]/[action]")]
[EnableCors("any")]
[ServiceFilter(typeof(DiyFilter<dynamic>))]
public sealed class UserBehaviorController : Controller
{
    private static readonly HashSet<string> AllowedSignals = new(StringComparer.OrdinalIgnoreCase)
    {
        "V8ButtonClick", "DetailClose", "PageHidden", "PageVisible", "PageClosed", "AttachmentClick"
    };

    private readonly UserBehaviorSessionTracker _tracker;
    public UserBehaviorController(UserBehaviorSessionTracker tracker) => _tracker = tracker;

    [HttpPost]
    public async Task<JsonResult> Signal([FromBody] JObject? param)
    {
        param ??= new JObject();
        var action = param["Action"].Val<string>();
        if (!AllowedSignals.Contains(action)) return Json(new DosResult(0, null, "不支持的行为信号。"));

        CurrentToken token = await DiyToken.GetCurrentToken().ConfigureAwait(false);
        JObject user = token?.CurrentUser;
        if (user == null) return Json(new DosResult(1001, null, "登录身份已过期！"));

        var osClient = token.OsClient;
        var requestToken = Request.Headers["Authorization"].ToString();
        var tokenEntry = DiyToken.GetActiveCachedTokenEntry(token, requestToken);
        var clientType = tokenEntry?.ClientType;
        var did = tokenEntry?.Did;
        var table = Limit(param["Table"]?.ToString(), 128);
        var rowId = Limit(param["RowId"]?.ToString(), 256);

        if (string.Equals(action, "DetailClose", StringComparison.OrdinalIgnoreCase))
        {
            await _tracker.CloseDetailAsync(osClient, user, table, rowId, clientType, did, "ClientSignal").ConfigureAwait(false);
            return Json(new DosResult(1));
        }

        var context = new DiyTableRowParam
        {
            OsClient = osClient,
            _CurrentUser = user,
            _ClientType = clientType,
            _InvokeType = InvokeType.Client.ToString()
        };
        var name = Limit(param["Name"]?.ToString(), 256);
        var targetId = Limit(param["TargetId"]?.ToString(), 256);
        var descriptions = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["V8ButtonClick"] = $"点击了V8按钮[{name}]",
            ["PageHidden"] = "将浏览器标签页切换到后台或休眠",
            ["PageVisible"] = "将浏览器标签页恢复到前台",
            ["PageClosed"] = "关闭或离开了浏览器标签页",
            ["AttachmentClick"] = $"点击了附件[{name}]"
        };
        long? durationSeconds = null;
        if (action.StartsWith("Page", StringComparison.OrdinalIgnoreCase) && tokenEntry != null)
        {
            durationSeconds = Math.Max(0, (long)(DateTime.Now - tokenEntry.CreateTime).TotalSeconds);
            descriptions[action] += $"，本次登录已持续{UserBehaviorAudit.FormatDuration(durationSeconds.Value)}";
        }
        var categories = action.StartsWith("Page", StringComparison.OrdinalIgnoreCase) ? "Session" : action == "AttachmentClick" ? "File" : "Interaction";
        var sessionId = UserBehaviorAudit.HashIdentifier(tokenEntry?.Token);
        UserBehaviorAudit.Track(context, categories, action, "用户行为", action == "AttachmentClick" ? "PrivateFile" : "UI",
            targetId, descriptions[action], new
            {
                Name = name,
                TargetId = targetId,
                Table = table,
                RowId = rowId,
                LoginDuration = durationSeconds.HasValue ? UserBehaviorAudit.FormatDuration(durationSeconds.Value) : null
            }, true, durationSeconds, "ClientSignal", sessionId, did);
        return Json(new DosResult(1));
    }

    private static string? Limit(string? value, int max) => value != null && value.Length > max ? value[..max] : value;
}

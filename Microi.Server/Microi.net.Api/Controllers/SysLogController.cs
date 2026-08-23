using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;

namespace Microi.net.Api
{
    /// <summary>
    /// 仅保留历史客户端写日志兼容入口。查询、统计、队列、运行态与安全操作已迁移到
    /// mci-system-observability-* 接口引擎，不再由定制 Controller 承载。
    /// </summary>
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [PlatformAdminOnly]
    [Route("api/[controller]/[action]")]
    public class SysLogController : Controller
    {
        private static readonly HashSet<string> ReservedBehaviorTypes =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "访问菜单", "点击V8按钮", "查看数据", "数据操作", "导入数据", "导出数据",
                "用户登录", "用户退出", "登录失效", "私有附件", "登录失败"
            };

        [HttpGet, HttpPost]
        public async Task<JsonResult> AddSysLog(SysLogParam paramLog)
        {
            var param = paramLog;
            if (param == null) return Json(new DosResult(0, null, "日志参数不能为空。"));
            if (!param.Category.DosIsNullOrWhiteSpace() || !param.Action.DosIsNullOrWhiteSpace()
                || ReservedBehaviorTypes.Contains(param.Type ?? ""))
            {
                return Json(new DosResult(0, null, "平台用户行为日志只能由后端可信执行点生成。"));
            }

            var currentToken = await DiyToken.GetCurrentToken().ConfigureAwait(false);
            if (currentToken?.CurrentUser == null)
                return Json(new DosResult(1001, null, "登录身份已过期。"));
            param.OsClient = currentToken.OsClient;
            param.UserName = UserBehaviorAudit.FormatUser(currentToken.CurrentUser);
            param.UserId = currentToken.CurrentUser["Id"].Val<string>();
            param.Category = "Legacy";
            param.Action = "ClientLog";
            param.Source = "LegacyClientEndpoint";

            if (string.IsNullOrWhiteSpace(param.IP))
            {
                var ipResult = IPHelper.GetClientIP(HttpContext);
                if (ipResult.Code == 1) param.IP = ipResult.Data;
            }

            return Json(await MicroiEngine.MongoDB.AddSysLog(param).ConfigureAwait(false));
        }
    }
}

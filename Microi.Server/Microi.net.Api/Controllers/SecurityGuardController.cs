using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microi.net;

namespace Microi.net.Api
{
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    public class SecurityGuardController : Controller
    {
        [HttpGet, HttpPost]
        public JsonResult ListBlocked()
        {
            return Json(new DosResult(1, SecurityGuardService.GetBlockedIps()));
        }

        [HttpGet, HttpPost]
        public JsonResult ListRecentAccess(int top = 200)
        {
            return Json(new DosResult(1, SecurityGuardService.GetRecentAccess(top)));
        }

        [HttpGet, HttpPost]
        public async Task<JsonResult> BlockIp(string ip, string reason = "", int blockMinutes = 30)
        {
            if (string.IsNullOrWhiteSpace(ip))
            {
                return Json(new DosResult(0, null, "IP不能为空。"));
            }

            var identity = await GetOperatorIdentity().ConfigureAwait(false);
            var message = string.IsNullOrWhiteSpace(reason)
                ? $"管理员[{identity.UserName}]手动封禁IP。"
                : reason;
            var result = SecurityGuardService.BlockIp(
                ip.Trim(),
                message,
                blockMinutes,
                true,
                0,
                0,
                identity.OsClient,
                "ManualBlock",
                identity.UserId,
                identity.UserName);
            return Json(new DosResult(1, result, "已封禁。"));
        }

        [HttpGet, HttpPost]
        public async Task<JsonResult> UnblockIp(string ip)
        {
            if (string.IsNullOrWhiteSpace(ip))
            {
                return Json(new DosResult(0, null, "IP不能为空。"));
            }

            var identity = await GetOperatorIdentity().ConfigureAwait(false);
            var ok = SecurityGuardService.UnblockIp(ip.Trim(), identity.OsClient, identity.UserId, identity.UserName);
            return Json(new DosResult(ok ? 1 : 0, null, ok ? "已解封。" : "未找到该IP的封禁记录。"));
        }

        private async Task<SecurityOperatorIdentity> GetOperatorIdentity()
        {
            dynamic token = await DiyToken.GetCurrentToken().ConfigureAwait(false);
            var identity = new SecurityOperatorIdentity();
            try { identity.OsClient = token?.OsClient; } catch { }
            try { identity.UserId = token?.CurrentUser?.Id; } catch { }
            try { identity.UserName = token?.CurrentUser?.Name; } catch { }
            if (identity.UserId.DosIsNullOrWhiteSpace())
            {
                try { identity.UserId = token?.CurrentUser?["Id"].Val<string>(); } catch { }
            }
            if (identity.UserName.DosIsNullOrWhiteSpace())
            {
                try { identity.UserName = token?.CurrentUser?["Name"].Val<string>(); } catch { }
            }
            if (identity.OsClient.DosIsNullOrWhiteSpace())
            {
                identity.OsClient = Request.Query["OsClient"].FirstOrDefault()
                                    ?? Request.Headers["OsClient"].FirstOrDefault()
                                    ?? Request.Headers["X-OsClient"].FirstOrDefault()
                                    ?? Microi.net.OsClient.GetConfigOsClient();
            }
            if (identity.UserName.DosIsNullOrWhiteSpace())
            {
                identity.UserName = "管理员";
            }
            return identity;
        }

        private sealed class SecurityOperatorIdentity
        {
            public string OsClient { get; set; } = "";
            public string UserId { get; set; } = "";
            public string UserName { get; set; } = "";
        }
    }
}

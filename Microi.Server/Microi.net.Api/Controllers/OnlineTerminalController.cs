using System.Threading.Tasks;
using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    [Route("api/[controller]/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class OnlineTerminalController : Controller
    {
        [HttpPost]
        public async Task<IActionResult> Mine([FromBody] JObject param)
        {
            var identity = await GetIdentity(param).ConfigureAwait(false);
            if (identity.CurrentUser == null)
            {
                return Json(new DosResult(1001, null, "登录身份已过期"));
            }

            return Json(new DosResult(1, OnlineTerminalService.GetUserTerminals(identity.OsClient, identity.UserId)));
        }

        [HttpPost]
        public async Task<IActionResult> List([FromBody] JObject param)
        {
            var identity = await GetIdentity(param).ConfigureAwait(false);
            if (identity.CurrentUser == null)
            {
                return Json(new DosResult(1001, null, "登录身份已过期"));
            }
            if (identity.Level < 9999)
            {
                return Json(new DosResult(0, null, "仅超级管理员可查看当前登录用户"));
            }

            return Json(new DosResult(1, OnlineTerminalService.ListOnlineUsers(identity.OsClient)));
        }

        [HttpPost]
        public async Task<IActionResult> Kick([FromBody] JObject param)
        {
            param ??= new JObject();
            var identity = await GetIdentity(param).ConfigureAwait(false);
            if (identity.CurrentUser == null)
            {
                return Json(new DosResult(1001, null, "登录身份已过期"));
            }

            var userId = param["UserId"]?.ToString();
            var connectionId = param["ConnectionId"]?.ToString();
            var result = await OnlineTerminalService.KickTerminalAsync(identity.OsClient, identity.CurrentUser, userId, connectionId).ConfigureAwait(false);
            return Json(result);
        }

        private static async Task<RequestIdentity> GetIdentity(JObject param)
        {
            var token = await DiyToken.GetCurrentToken().ConfigureAwait(false);
            var currentUser = token?.CurrentUser;
            var osClient = token?.OsClient;
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = param?["OsClient"]?.ToString()
                           ?? param?["_OsClient"]?.ToString()
                           ?? Microi.net.OsClient.GetConfigOsClient();
            }

            return new RequestIdentity
            {
                OsClient = osClient ?? "",
                CurrentUser = currentUser,
                UserId = currentUser?["Id"]?.Val<string>() ?? "",
                Level = currentUser?["Level"]?.Val<int>() ?? 0,
            };
        }

        private sealed class RequestIdentity
        {
            public string OsClient { get; set; }
            public JObject CurrentUser { get; set; }
            public string UserId { get; set; }
            public int Level { get; set; }
        }
    }
}

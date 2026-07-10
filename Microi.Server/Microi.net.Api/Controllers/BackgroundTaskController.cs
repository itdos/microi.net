using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    [Route("api/[controller]/[action]")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    public class BackgroundTaskController : Controller
    {
        [HttpPost]
        public async Task<IActionResult> List([FromBody] JObject param)
        {
            var identity = await GetIdentity(param).ConfigureAwait(false);
            var data = BackgroundTaskService.List(identity.OsClient, identity.UserKey);
            return Json(new DosResult(1, data));
        }

        [HttpPost]
        public async Task<IActionResult> ClearCompleted([FromBody] JObject param)
        {
            var identity = await GetIdentity(param).ConfigureAwait(false);
            var count = BackgroundTaskService.ClearCompleted(identity.OsClient, identity.UserKey);
            await BackgroundTaskService.SendTaskListToUserAsync(identity.OsClient, identity.UserKey).ConfigureAwait(false);
            return Json(new DosResult(1, new { Count = count }, $"已清除{count}条已完成任务"));
        }

        [HttpPost]
        public async Task<IActionResult> Cancel([FromBody] JObject param)
        {
            param ??= new JObject();
            var taskId = param["Id"]?.ToString();
            if (taskId.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "任务Id不能为空"));
            }

            var identity = await GetIdentity(param).ConfigureAwait(false);
            var result = BackgroundTaskService.Cancel(identity.OsClient, identity.UserKey, taskId);
            return Json(result
                ? new DosResult(1, null, "已请求停止后台任务")
                : new DosResult(0, null, "未找到可停止的后台任务"));
        }

        [HttpPost]
        public async Task<IActionResult> RunApiEngine([FromBody] JObject param)
        {
            param ??= new JObject();
            var apiEngineKey = param["ApiEngineKey"]?.ToString();
            if (apiEngineKey.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "ApiEngineKey不能为空"));
            }

            var identity = await GetIdentity(param).ConfigureAwait(false);
            var apiParam = param["Param"] as JObject ?? new JObject();
            apiParam["ApiEngineKey"] = apiEngineKey;
            apiParam["OsClient"] = identity.OsClient;
            if (identity.CurrentUser != null)
            {
                apiParam["_CurrentUser"] = JTokenEx.FromObject(identity.CurrentUser);
            }
            apiParam["_InvokeType"] = "Client";

            var title = param["Title"]?.ToString();
            var item = BackgroundTaskService.StartApiEngine(identity.OsClient, identity.UserKey, title, apiParam);
            return Json(new DosResult(1, item, "后台任务已提交"));
        }

        private static async Task<RequestIdentity> GetIdentity(JObject param)
        {
            dynamic token = await DiyToken.GetCurrentToken().ConfigureAwait(false);
            string osClient = null;
            object currentUser = null;
            string userKey = null;

            try { osClient = token?.OsClient; } catch { }
            try { currentUser = token?.CurrentUser; } catch { }
            if (currentUser is JObject currentUserJObject)
            {
                userKey = currentUserJObject["Id"]?.Val<string>();
                if (userKey.DosIsNullOrWhiteSpace())
                {
                    userKey = currentUserJObject["Account"]?.Val<string>();
                }
            }
            if (userKey.DosIsNullOrWhiteSpace())
            {
                try { userKey = token?.CurrentUser?.Account; } catch { }
            }

            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = param?["OsClient"]?.ToString()
                           ?? param?["_OsClient"]?.ToString()
                           ?? Microi.net.OsClient.GetConfigOsClient();
            }

            if (userKey.DosIsNullOrWhiteSpace())
            {
                userKey = "anonymous";
            }

            return new RequestIdentity
            {
                OsClient = osClient ?? "",
                UserKey = userKey,
                CurrentUser = currentUser
            };
        }

        private sealed class RequestIdentity
        {
            public string OsClient { get; set; }
            public string UserKey { get; set; }
            public object CurrentUser { get; set; }
        }
    }
}

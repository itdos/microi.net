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
            return Json(new DosResult(1, new { Count = count }, $"已清除{count}条成功任务"));
        }

        [HttpPost]
        public async Task<IActionResult> Remove([FromBody] JObject param)
        {
            param ??= new JObject();
            var taskId = param["Id"]?.ToString();
            if (taskId.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "任务Id不能为空"));
            }

            var identity = await GetIdentity(param).ConfigureAwait(false);
            var result = BackgroundTaskService.Remove(identity.OsClient, identity.UserKey, taskId);
            if (result)
            {
                await BackgroundTaskService.SendTaskListToUserAsync(identity.OsClient, identity.UserKey).ConfigureAwait(false);
            }
            return Json(result
                ? new DosResult(1, null, "后台任务已清除")
                : new DosResult(0, null, "只能清除属于当前用户且已结束的后台任务"));
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
            if (BackgroundTaskService.IsReservedNativeWorkerKey(apiEngineKey))
            {
                return Json(new DosResult(
                    0,
                    null,
                    "该任务标识属于平台保留的原生 Worker，不能通过通用接口引擎入口提交。"));
            }

            var identity = await GetIdentity(param).ConfigureAwait(false);
            if (identity.CurrentUser == null || identity.CurrentUser["Id"]?.ToString().DosIsNullOrWhiteSpace() != false)
            {
                return Json(new DosResult(0, null, "登录身份已失效，请重新登录后再提交后台任务"));
            }
            if (!UserAccessKeySecurity.IsApiEngineAllowed(
                    identity.CurrentUser,
                    apiEngineKey))
            {
                return Json(new DosResult(
                    0,
                    null,
                    "当前访问密钥未授权运行此接口引擎。"));
            }

            // A background task executes after this request, possibly on another
            // node. Authorize against the shared database now for an immediate
            // response, then persist a marker so the worker repeats the check
            // against the authoritative model immediately before execution.
            var apiEngineModelResult = await MicroiEngine.ApiEngine
                .GetAuthoritativeApiEngineModel(new ApiEngineParam
                {
                    OsClient = identity.OsClient,
                    ApiEngineKey = apiEngineKey,
                    _CurrentUser = identity.CurrentUser
                })
                .ConfigureAwait(false);
            if (apiEngineModelResult.Code != 1 || apiEngineModelResult.Data == null)
            {
                return Json(new DosResult(
                    0,
                    null,
                    apiEngineModelResult.Msg ?? "接口引擎不存在或已停用。"));
            }

            var apiRole = DynamicHelper.GetDynamicStringValue(
                apiEngineModelResult.Data,
                "ApiRole",
                "");
            var roleAuthorization = ApiEngineRoleAuthorization.Evaluate(
                identity.CurrentUser,
                apiRole);
            if (!roleAuthorization.IsAllowed)
            {
                var deniedMessage = roleAuthorization.HasOnlyGet
                                    && !roleAuthorization.HasExplicitRoles
                                    && !roleAuthorization.HasMalformedPolicy
                    ? ApiEngineRoleAuthorization.OnlyGetDeniedMessage
                    : DiyMessage.GetLang(identity.OsClient, "NoAuth");
                return Json(new DosResult(0, null, deniedMessage));
            }

            // 客户端业务参数不允许决定执行身份。身份由服务端从当前登录令牌读取，
            // 并作为后台任务的可信快照单独传给执行器。
            var apiParam = param["Param"] as JObject ?? new JObject();
            apiParam = (JObject)apiParam.DeepClone();
            apiParam.Remove("_CurrentUser");
            apiParam.Remove(ApiEngineRoleAuthorization.BackgroundAuthorizationMarker);
            apiParam["ApiEngineKey"] = apiEngineKey;
            apiParam["OsClient"] = identity.OsClient;
            apiParam[ApiEngineRoleAuthorization.BackgroundAuthorizationMarker] = true;

            var title = param["Title"]?.ToString();
            var options = param["Options"] as JObject
                          ?? apiParam["_BackgroundTaskOptions"] as JObject
                          ?? new JObject();
            apiParam.Remove("_BackgroundTaskOptions");
            try
            {
                var item = BackgroundTaskService.StartApiEngine(
                    identity.OsClient,
                    identity.UserKey,
                    title,
                    apiParam,
                    identity.CurrentUser,
                    options);
                return Json(new DosResult(1, item,
                    item.ExecutionCount > 0 || item.Status != "Pending"
                        ? "已返回相同幂等键的后台任务"
                        : "后台任务已持久化并进入队列"));
            }
            catch (System.Exception ex)
            {
                return Json(new DosResult(0, null, "后台任务提交失败：" + ex.Message));
            }
        }

        private static async Task<RequestIdentity> GetIdentity(JObject param)
        {
            dynamic token = await DiyToken.GetCurrentToken().ConfigureAwait(false);
            string osClient = null;
            JObject currentUser = null;
            string userKey = null;

            try { osClient = token?.OsClient; } catch { }
            try
            {
                var tokenUser = token?.CurrentUser;
                if (tokenUser != null)
                {
                    currentUser = tokenUser is JObject currentUserJObject
                        ? (JObject)currentUserJObject.DeepClone()
                        : JObject.FromObject(tokenUser);
                }
            }
            catch { }
            if (currentUser != null)
            {
                userKey = currentUser["Id"]?.Val<string>();
                if (userKey.DosIsNullOrWhiteSpace())
                {
                    userKey = currentUser["Account"]?.Val<string>();
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
            public JObject CurrentUser { get; set; }
        }
    }
}

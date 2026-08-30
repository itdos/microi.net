using System;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        /// <summary>
        /// 接口引擎本身无法并行等待多个 FormEngine 计数，也不应重复实现
        /// WorkflowCopyReadState 的强类型兼容解析。Core 通过桥接契约调用
        /// Microi.WorkFlow，缓存策略仍由接口引擎编排。
        /// </summary>
        public DosResult GetCurrentUserWorkflowStats()
        {
            try
            {
                var trustedUser = V8TrustedExecutionContext.CurrentUser;
                CurrentToken token = null;
                if (trustedUser == null)
                {
                    token = DiyToken.GetCurrentToken().GetAwaiter().GetResult();
                    trustedUser = token?.CurrentUser;
                }
                if (trustedUser == null)
                {
                    return new DosResult(1001, null, "登录身份已过期。");
                }

                var osClient = V8TenantContext.Current?.OsClient;
                if (osClient.DosIsNullOrWhiteSpace()) osClient = token?.OsClient;
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, "当前租户上下文无效。");
                }

                var runtime = WorkFlowApiRuntimeBridge.Create();
                if (runtime == null)
                    return new DosResult(0, null, "Microi.WorkFlow 插件尚未注册。");
                token ??= new CurrentToken
                {
                    OsClient = osClient,
                    CurrentUser = trustedUser as JObject ?? JObject.FromObject(trustedUser)
                };
                var result = runtime.ExecuteAsync(new JObject { ["Action"] = "GetWFStats" }, token)
                    .GetAwaiter().GetResult();
                return new DosResult(result.Code, result.Data, result.Msg, null, result.DataAppend);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "读取当前用户工作流统计失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 仅 platform-workflow 可以进入完整工作流动作分派；租户脚本不能绕过
        /// 当前 DiyToken、流程权限或共享事务边界直接调用实现类。
        /// </summary>
        public DosResult ManageWorkFlow(dynamic dynamicParam)
        {
            var denied = RequireTrustedApiEngine("platform-workflow");
            if (denied != null) return denied;
            try
            {
                var runtime = WorkFlowApiRuntimeBridge.Create();
                if (runtime == null) return new DosResult(0, null, "Microi.WorkFlow 插件尚未注册。");
                var currentToken = DiyToken.GetCurrentToken(false).GetAwaiter().GetResult();
                if (currentToken?.CurrentUser == null)
                    return new DosResult(1001, null, "登录身份已过期，请重新登录。");
                var request = JsonHelper.ToJObject(dynamicParam) ?? new JObject();
                return runtime.ExecuteAsync(request, currentToken).GetAwaiter().GetResult();
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "工作流运行时执行失败：" + ex.Message);
            }
        }
    }
}

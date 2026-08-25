using System;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        /// <summary>
        /// 接口引擎本身无法并行等待多个 FormEngine 计数，也不应重复实现
        /// WorkflowCopyReadState 的强类型兼容解析。这里只暴露现有 WorkFlowLogic
        /// 的最小、当前租户/当前用户原子能力；缓存策略仍由接口引擎编排。
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

                var result = new WorkFlowLogic().GetWFStats(new WFParam
                {
                    OsClient = osClient,
                    _CurrentUser = JObject.FromObject(trustedUser),
                    _InvokeType = InvokeType.Server.ToString()
                }).GetAwaiter().GetResult();
                return new DosResult(result.Code, result.Data, result.Msg, null, result.DataAppend);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "读取当前用户工作流统计失败：" + ex.Message);
            }
        }
    }
}

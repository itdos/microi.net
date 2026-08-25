using Dos.Common;

namespace Microi.net
{
    public partial class V8Method
    {
        /// <summary>
        /// 原子消费宿主可信协议上下文。租户与目标接口引擎均取当前 V8 执行上下文，
        /// 调用方不能通过 V8.Param 指定；同一宿主作用域只能成功一次，阻止 Hook
        /// 或嵌套接口引擎重入后复用授权。
        /// </summary>
        public DosResult RequireManagedProtocolContext()
        {
            var context = V8TenantContext.Current;
            if (context == null
                || string.IsNullOrWhiteSpace(context.OsClient)
                || string.IsNullOrWhiteSpace(context.ApiEngineKey))
            {
                return new DosResult(0, null, "可信协议能力只能在目标接口引擎上下文中调用。");
            }

            return V8TrustedExecutionContext.TryConsumeManagedProtocol(
                    context.ApiEngineKey,
                    context.OsClient)
                ? new DosResult(1)
                : new DosResult(0, null, "宿主可信协议上下文无效、已使用或与当前接口引擎不匹配。");
        }
    }
}

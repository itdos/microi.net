using System;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 工作流 HTTP 兼容入口的类库契约。公开地址由 Managed 接口引擎拥有，
    /// Core 只保留不会形成反向项目引用的桥接接口。
    /// </summary>
    public interface IWorkFlowApiRuntime
    {
        Task<DosResult> ExecuteAsync(JObject request, CurrentToken currentToken);
    }

    /// <summary>
    /// 解耦 Microi.Core 与加密发布的 Microi.WorkFlow 实现。注册工厂而非单例，
    /// 避免一次请求中的事务、计时与用户上下文泄漏到并发请求。
    /// </summary>
    public static class WorkFlowApiRuntimeBridge
    {
        private static Func<IWorkFlowApiRuntime> _factory;

        public static void RegisterFactory(Func<IWorkFlowApiRuntime> factory)
        {
            if (factory == null) throw new ArgumentNullException(nameof(factory));
            Volatile.Write(ref _factory, factory);
        }

        public static IWorkFlowApiRuntime Create() => Volatile.Read(ref _factory)?.Invoke();
    }
}

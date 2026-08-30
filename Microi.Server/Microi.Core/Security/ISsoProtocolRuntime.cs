using System;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// SSO 可信协议原子桥。业务编排、连接配置、身份映射和审计继续由官方 Managed
    /// 接口引擎负责；实现层只处理签名验签、一次性票据与标准协议报文。
    /// </summary>
    public interface ISsoProtocolRuntime
    {
        Task<JObject> ExecuteAsync(string operation, JObject parameters, HttpContext sourceContext);

        /// <summary>
        /// 执行 SSO 专属身份、一次性登录票据与客户端密钥原子。调用权限仍由
        /// Core 中的 V8 门面按精确 ApiEngineKey 校验，实现代码全部位于 Microi.SSO。
        /// </summary>
        DosResult ExecuteTrusted(string operation, JObject parameters);
    }

    public static class SsoProtocolRuntimeBridge
    {
        private static Func<ISsoProtocolRuntime> _runtimeFactory;

        public static void Register(ISsoProtocolRuntime runtime)
        {
            if (runtime == null) throw new ArgumentNullException(nameof(runtime));
            RegisterFactory(() => runtime);
        }

        /// <summary>
        /// 注册每次调用创建独立协议运行时的工厂。协议实现复用 ControllerBase 的结果
        /// 构造能力，其 ControllerContext 属于请求态，禁止跨并发请求共享实例。
        /// </summary>
        public static void RegisterFactory(Func<ISsoProtocolRuntime> runtimeFactory)
        {
            if (runtimeFactory == null) throw new ArgumentNullException(nameof(runtimeFactory));
            Interlocked.Exchange(ref _runtimeFactory, runtimeFactory);
        }

        public static ISsoProtocolRuntime Current => Volatile.Read(ref _runtimeFactory)?.Invoke();
    }
}

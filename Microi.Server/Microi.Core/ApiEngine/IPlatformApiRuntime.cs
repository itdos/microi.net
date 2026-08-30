using System;
using System.Collections.Concurrent;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 接口引擎可信协议/宿主原子的统一桥。官方 Managed 接口引擎负责路由、动作、
    /// Hook 与业务编排；各插件仅注册无法安全下放给租户脚本的协议、密钥或原子实现。
    /// </summary>
    public interface IPlatformApiRuntime
    {
        Task<object> ExecuteAsync(string action, JObject parameters);
    }

    /// <summary>
    /// 运行时注册表只保存插件工厂，不保存请求态对象。插件卸载或未注册时返回明确错误，
    /// 禁止接口引擎静默回退到已删除的 Controller。
    /// </summary>
    public static class PlatformApiRuntimeRegistry
    {
        private static readonly ConcurrentDictionary<string, Func<IPlatformApiRuntime>> Factories =
            new ConcurrentDictionary<string, Func<IPlatformApiRuntime>>(StringComparer.OrdinalIgnoreCase);

        public static void RegisterFactory(string runtimeKey, Func<IPlatformApiRuntime> factory)
        {
            var key = (runtimeKey ?? string.Empty).Trim();
            if (key.Length == 0) throw new ArgumentException("运行时 Key 不能为空。", nameof(runtimeKey));
            if (factory == null) throw new ArgumentNullException(nameof(factory));
            Factories[key] = factory;
        }

        public static bool TryCreate(string runtimeKey, out IPlatformApiRuntime runtime)
        {
            runtime = null;
            var key = (runtimeKey ?? string.Empty).Trim();
            if (key.Length == 0 || !Factories.TryGetValue(key, out var factory)) return false;
            runtime = factory?.Invoke();
            return runtime != null;
        }
    }
}

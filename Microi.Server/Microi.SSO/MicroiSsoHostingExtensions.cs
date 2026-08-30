using System;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    /// <summary>
    /// Microi SSO 可信协议插件注册入口。公开路由由官方 Managed 接口引擎承接，
    /// 此类库不参与 MVC Controller 发现。
    /// </summary>
    public static class MicroiSsoHostingExtensions
    {
        public static IServiceCollection AddMicroiSSO(this IServiceCollection services)
        {
            if (services == null) throw new ArgumentNullException(nameof(services));

            services.AddTransient<ISsoProtocolRuntime, SsoProtocolRuntime>();
            services.AddTransient<ExternalLoginRuntime>();

            // 协议运行时内部持有请求态响应上下文，每次调用必须创建独立实例，
            // 防止并发登录、回调或票据消费之间共享可变状态。
            SsoProtocolRuntimeBridge.RegisterFactory(() => new SsoProtocolRuntime());
            PlatformApiRuntimeRegistry.RegisterFactory(
                "ExternalLogin",
                () => DiyHttpContext.Current?.RequestServices
                    ?.GetRequiredService<ExternalLoginRuntime>());
            Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】注入【SSO身份联邦】插件成功！");
            return services;
        }
    }
}

using System;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using Senparc.CO2NET;
using Senparc.Weixin.AspNet;
using Senparc.Weixin.RegisterServices;

namespace Microi.net
{
    public static class MicroiWeChatExtensions
    {
        public static IServiceCollection AddMicroiWeChat(this IServiceCollection services)
        {
            return AddMicroiWeChat(services, null);
        }

        public static IServiceCollection AddMicroiWeChat(
            this IServiceCollection services,
            IConfiguration configuration)
        {
            try
            {
                if (configuration != null)
                    services.AddSenparcWeixinServices(configuration);
                services.AddSingleton<IMicroiWeChat, MicroiWeChat>();
                services.AddSingleton<WeChatContentSecurityService>();
                services.AddSingleton<ISysUserProfileContentSecurityGateway>(provider =>
                    provider.GetRequiredService<WeChatContentSecurityService>());
                Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】注入【微信公众号平台】插件成功！");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】注入【微信公众号平台】插件失败：" + ex.Message);
                return services;
            }
        }

        /// <summary>
        /// 启用微信插件及其 Redis 缓存。微信 SDK 的具体初始化由插件类库拥有，
        /// API 宿主只提供当前宿主环境与已解析的租户 Redis 连接。
        /// </summary>
        public static IApplicationBuilder UseMicroiWeChat(
            this IApplicationBuilder app,
            IHostEnvironment environment,
            string redisConnection)
        {
            Senparc.CO2NET.Cache.Redis.Register.SetConfigurationOption(redisConnection);
            app.UseSenparcWeixin(
                environment,
                new SenparcSetting
                {
                    IsDebug = false,
                    DefaultCacheNamespace = "MicroiWeChatCache",
                    Cache_Redis_Configuration = redisConnection
                },
                null,
                register => { },
                (register, weixinSetting) => { });
            return app;
        }
    }
}


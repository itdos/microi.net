using System;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{

    public static class MicroiCacheExtensions
    {
        public static IServiceCollection AddMicroiCache(this IServiceCollection services)
        {
            try
            {
                services.AddSingleton<IMicroiCache, MicroiCacheRedis>();
                services.AddSingleton<IMicroiCacheTenant, MicroiCacheTenant>();// 工厂
                Console.WriteLine("Microi：【成功】注入【分布式缓存】插件成功！");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：注入【分布式缓存】插件失败：" + ex.Message);
                return services;
            }
        }
    }
}
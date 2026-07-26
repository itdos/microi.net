using System;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    public static class MicroiSpiderExtensions
    {
        public static IServiceCollection AddMicroiSpider(this IServiceCollection services)
        {
            try
            {
                services.AddSingleton<IMicroiSpider, MicroiSpider>();
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】注入【采集引擎】插件失败：{ex.Message}");
                return services;
            }
        }
    }
}


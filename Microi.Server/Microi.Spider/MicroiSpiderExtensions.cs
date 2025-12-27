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
                Console.WriteLine("Microi：【成功】注入采集引擎插件成功！");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】注入采集引擎插件失败：" + ex.Message);
                return services;
            }
        }
    }
}


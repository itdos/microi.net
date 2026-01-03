using System;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    public static class MicroiMQTTExtensions
    {
        public static IServiceCollection AddMicroiMQTT(this IServiceCollection services)
        {
            try
            {
                services.AddSingleton<IMicroiMQTT, MicroiMQTT>();
                Console.WriteLine("Microi：【成功】注入【MQTT】插件成功！");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】注入【MQTT】插件失败：" + ex.Message);
                return services;
            }
        }
    }
}


using System;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    public static class MicroiAiExtensions
    {
        public static IServiceCollection AddMicroiAI(this IServiceCollection services)
        {
            try
            {
                services.AddSingleton<IMicroiAI, MicroiAI>();
                Console.WriteLine("Microi：【成功】注入【AI引擎】插件成功！");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】注入【AI引擎】插件失败：" + ex.Message);
                return services;
            }
        }
    }
}


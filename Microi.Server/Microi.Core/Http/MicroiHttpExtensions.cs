using System;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    public static class MicroiHttpExtensions
    {
        public static IServiceCollection AddMicroiHttp(this IServiceCollection services)
        {
            try
            {
                services.AddSingleton<IMicroiHttp, DiyHttp>();
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】注入【Http】插件失败：" + ex.Message);
                return services;
            }
        }
    }
}

using System;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    public static class MicroiMongoDBExtensions
    {
        public static IServiceCollection AddMicroiMongoDB(this IServiceCollection services)
        {
            try
            {
                services.AddSingleton<IMongoDB, V8MongoDB>();
                Console.WriteLine("Microi：【成功】注入【MongoDB】插件成功！");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】注入【MongoDB】插件失败：" + ex.Message);
                return services;
            }
        }
    }
}

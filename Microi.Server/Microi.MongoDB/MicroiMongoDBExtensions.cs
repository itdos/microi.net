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
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】注入【MongoDB】插件失败：{ex.Message}");
                return services;
            }
        }
    }
}

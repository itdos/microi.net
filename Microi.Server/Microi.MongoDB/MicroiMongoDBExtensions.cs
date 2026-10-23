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
                // 准入状态保存在 MongoDB，所有 API 节点共享维护租约与在途请求计数。
                services.AddSingleton<IManagedStorageAdmissionStore, MongoManagedStorageAdmissionStore>();
                services.AddSingleton<IMemoryIncidentRepository>(provider => (V8MongoDB)provider.GetRequiredService<IMongoDB>());
                Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】注入【MongoDB】插件成功！");
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

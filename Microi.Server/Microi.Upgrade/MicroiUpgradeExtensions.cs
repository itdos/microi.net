using System;
using Dos.Common;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    public static class MicroiUpgradeExtensions
    {
        public static IServiceCollection AddMicroiUpgrade(this IServiceCollection services)
        {
            try
            {
                services.AddSingleton<IMicroiUpgrade, MicroiUpgrade>();
                services.AddHostedService<MicroiUpgradeHostedService>();
                Console.WriteLine("Microi：【成功】注入【服务器端自动升级】插件成功！");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】注入【服务器端自动升级】插件失败：" + ex.Message);
                return services;
            }
        }
        public static IApplicationBuilder UseMicroiUpgrade(this IApplicationBuilder app)
        {
            // Kept as a source-compatible middleware hook. The actual work is a
            // hosted service so it is observed by the host, cancellation-aware and
            // cannot disappear as an untracked fire-and-forget Task during startup.
            return app;
        }
    }
}


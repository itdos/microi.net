using System;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    public static class MicroiOfficeExtensions
    {
        public static IServiceCollection AddMicroiOffice(this IServiceCollection services)
        {
            try
            {
                services.AddSingleton<IMicroiOffice, MicroiOffice>();
                Console.WriteLine("Microi：【成功】注入Office插件成功！");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】注入Office插件失败：" + ex.Message);
                return services;
            }
        }
    }
}

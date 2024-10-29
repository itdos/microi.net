using System;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    public static class MicroiWeChatExtensions
    {
        public static IServiceCollection AddMicroiWeChat(this IServiceCollection services)
        {
            try
            {
                services.AddSingleton<IMicroiWeChat, MicroiWeChat>();
                Console.WriteLine("Microi：注入微信公众号平台插件成功！");
                return services;
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                Console.WriteLine("Microi：注入微信公众号平台插件失败：" + ex.Message);
                return services;
            }
        }
    }
}


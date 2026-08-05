using System;
using Microsoft.Extensions.DependencyInjection;

namespace Microi.net
{
    public static class MicroiOcrExtensions
    {
        public static IServiceCollection AddMicroiOCR(this IServiceCollection services)
        {
            try
            {
                services.AddHttpClient(MicroiOcr.HttpClientName, client =>
                {
                    // 每次调用使用租户级有界 CancellationToken；禁用 HttpClient 的第二套超时。
                    client.Timeout = System.Threading.Timeout.InfiniteTimeSpan;
                }).ConfigurePrimaryHttpMessageHandler(() => new System.Net.Http.HttpClientHandler
                {
                    // OCR endpoint 是管理员配置的固定目标。禁止上游 3xx 把请求转发到其它地址。
                    AllowAutoRedirect = false
                });
                services.AddSingleton<IMicroiOcr, MicroiOcr>();
                Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】注入【OCR识别】插件成功！");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】注入【OCR识别】插件失败：{ex.Message}");
            }
            return services;
        }
    }
}

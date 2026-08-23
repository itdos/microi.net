using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace Microi.net.Api
{
    /// <summary>
    /// 低开销 API 请求观测。只记录路径、可信连接 IP、状态码、耗时和 TraceId，
    /// 不读取请求体、Cookie、Token 或任意业务参数。
    /// </summary>
    public sealed class SystemObservabilityMiddleware
    {
        private readonly RequestDelegate _next;

        public SystemObservabilityMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var lease = SystemObservabilityService.Begin(context);
            var failed = false;
            try
            {
                await _next(context).ConfigureAwait(false);
            }
            catch
            {
                failed = true;
                throw;
            }
            finally
            {
                lease?.Complete(context, failed);
            }
        }
    }

    public static class SystemObservabilityMiddlewareExtensions
    {
        public static IApplicationBuilder UseSystemObservability(this IApplicationBuilder builder)
        {
            return builder.UseMiddleware<SystemObservabilityMiddleware>();
        }
    }
}

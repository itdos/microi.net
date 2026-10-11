using Microsoft.Extensions.DependencyInjection;

namespace Microi.net.Api;

public static class TcpIngressHostingExtensions
{
    /// <summary>注册 API 进程内的可选原始 TCP 传输层；不开额外进程或镜像。</summary>
    public static IServiceCollection AddMicroiTcpIngress(this IServiceCollection services)
    {
        services.AddSingleton<TcpIngressHostedService>();
        services.AddHostedService(provider => provider.GetRequiredService<TcpIngressHostedService>());
        return services;
    }
}

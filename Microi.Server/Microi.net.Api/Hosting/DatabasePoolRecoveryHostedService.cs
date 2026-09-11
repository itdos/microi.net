using Microsoft.Extensions.Hosting;

namespace Microi.net.Api;

/// <summary>
/// 应急恢复循环属于 API 宿主生命周期。必须等待 SaaS、默认 Redis 和启动升级门禁完成，
/// 否则 CacheTenant 的首次解析会再次请求尚未初始化的默认租户缓存，引起递归。
/// </summary>
public sealed class DatabasePoolRecoveryHostedService(IHostApplicationLifetime lifetime) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var started = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        using var registration = lifetime.ApplicationStarted.Register(() => started.TrySetResult(true));
        try
        {
            await started.Task.WaitAsync(stoppingToken).ConfigureAwait(false);
            await DatabasePoolRecoveryService.RunAsync(stoppingToken).ConfigureAwait(false);
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
    }
}

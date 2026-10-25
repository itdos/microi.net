using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;

namespace Microi.net
{
    /// <summary>
    /// 可信存储任务宿主。每轮由共享租约/状态决定领取；没有有效备用配置时保持原存储。
    /// 任务不创建租户、安装应用、启用SLS或改动OSS别名检查点，关闭时等待当前取消路径收尾。
    /// </summary>
    public sealed class PublicResourceOffloadHostedService : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(45), stoppingToken).ConfigureAwait(false);
                while (!stoppingToken.IsCancellationRequested)
                {
                    try { await PublicResourceOffloadRuntime.TickAsync(stoppingToken).ConfigureAwait(false); }
                    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
                    catch
                    {
                        // 配置缺失/依赖故障只能阻止本轮分流，不能影响其它后台任务或输出签名URL/秘密。
                        // 管理员通过固定运行接口读取实际状态，禁止以空统计证明成功。
                    }
                    await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken).ConfigureAwait(false);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
        }
    }
}

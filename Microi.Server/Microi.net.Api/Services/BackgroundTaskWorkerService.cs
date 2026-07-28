using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;

namespace Microi.net.Api
{
    /// <summary>
    /// Hosts the durable tenant task worker. Claiming, leases, fencing and recovery
    /// live in Microi.Core so every API/Worker node follows the same protocol.
    /// </summary>
    public sealed class BackgroundTaskWorkerService : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            // SaaS clients and automatic schema upgrades initialize during startup.
            // A short delay avoids noisy table-missing scans while preserving recovery.
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(8), stoppingToken).ConfigureAwait(false);
                System.Console.WriteLine(
                    $"Microi：【✅成功】主租户[{OsClientDefault.OsClient}]后台任务Worker已启动；已加载租户数={OsClientExtend.ClientList.Count}。");
                await BackgroundTaskService.RunWorkerLoopAsync(stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Normal host shutdown.
            }
        }
    }
}

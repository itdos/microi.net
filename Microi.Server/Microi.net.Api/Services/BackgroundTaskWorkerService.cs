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
            BackgroundTaskWorkerRuntime.MarkHostStarted();

            // SaaS clients and automatic schema upgrades initialize during startup.
            // A short delay avoids noisy table-missing scans while preserving recovery.
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(8), stoppingToken).ConfigureAwait(false);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }

            var consecutiveFailures = 0;
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    BackgroundTaskWorkerRuntime.MarkLoopStarted();
                    System.Console.WriteLine(
                        $"Microi：【✅成功】主租户[{OsClientDefault.OsClient}]后台任务Worker已启动；已加载租户数={OsClientExtend.ClientList.Count}。");
                    await BackgroundTaskService.RunWorkerLoopAsync(
                            stoppingToken,
                            BackgroundTaskWorkerRuntime.MarkHeartbeat)
                        .ConfigureAwait(false);

                    if (stoppingToken.IsCancellationRequested) break;
                    throw new InvalidOperationException("后台任务Worker循环意外退出。");
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    break;
                }
                catch (Exception ex)
                {
                    consecutiveFailures++;
                    BackgroundTaskWorkerRuntime.MarkFault(ex);
                    System.Console.WriteLine(
                        $"Microi：【Error异常】后台任务Worker循环异常，将自动恢复：{ex.GetBaseException().Message}");

                    var retryDelay = TimeSpan.FromSeconds(Math.Min(30, Math.Max(2, consecutiveFailures * 2)));
                    try
                    {
                        await Task.Delay(retryDelay, stoppingToken).ConfigureAwait(false);
                    }
                    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                    {
                        break;
                    }
                }
            }

            BackgroundTaskWorkerRuntime.MarkStopped();
        }
    }

}

using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;

namespace Microi.net.Api
{
    /// <summary>
    /// Periodically rolls protocol-v3 committed pointers forward to their
    /// durable projection and converges legacy mutable root/latest aliases.
    /// Correctness, tenant isolation, fencing and checkpoints live in Core; this
    /// host only owns process lifetime and bounded retry cadence.
    /// </summary>
    public sealed class ApplicationAssetAliasReconciliationWorkerService : BackgroundService
    {
        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            try
            {
                await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken).ConfigureAwait(false);
                while (!stoppingToken.IsCancellationRequested)
                {
                    try
                    {
                        await V8McpLogic.RecoverApplicationAssetV3ProjectionsOnceAsync(
                            stoppingToken).ConfigureAwait(false);
                    }
                    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                    {
                        break;
                    }
                    catch (Exception ex)
                    {
                        // V3 recovery is independently retryable. A failed tenant
                        // or dependency must not suppress the legacy convergence
                        // pass or terminate this durable worker.
                        Console.WriteLine($"Microi：【⚠️警告】应用资产v3投影恢复扫描异常：{ex.Message}");
                    }

                    try
                    {
                        await V8McpLogic.ReconcilePublishedApplicationAliasesOnceAsync(
                            stoppingToken).ConfigureAwait(false);
                    }
                    catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                    {
                        break;
                    }
                    catch (Exception ex)
                    {
                        // One tenant/object-store failure must not terminate the
                        // durable worker. Core persists per-version retry state.
                        Console.WriteLine($"Microi：【⚠️警告】应用稳定入口后台收敛扫描异常：{ex.Message}");
                    }

                    await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken).ConfigureAwait(false);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                // Normal host shutdown.
            }
        }
    }
}

using System;
using System.Threading;
using System.Threading.Tasks;
using Quartz;
using Quartz.Listener;

namespace Microi.net
{
    /// <summary>将 Quartz 领取、失火和存储异常送入平台观测；只写宿主租户，不向业务租户广播。</summary>
    public sealed class MicroiSchedulerListener : SchedulerListenerSupport
    {
        public override Task SchedulerError(string message, SchedulerException cause, CancellationToken cancellationToken = default)
        {
            MicroiSchedulingDiagnostics.SchedulerFailure(cause);
            try
            {
                MicroiEngine.QueueSysLog(new SysLogParam
                {
                    OsClient = OsClientDefault.OsClient, EventId = Guid.NewGuid().ToString("N"),
                    OccurredAt = DateTime.UtcNow, Source = "Quartz", Type = "Job", Category = "Scheduler",
                    Action = "SchedulerError", Title = "Quartz 调度器异常", Level = 2, Success = false,
                    Content = MicroiSchedulingDiagnostics.SafeError(cause)
                });
            }
            catch { /* 观测故障不能让 Quartz 异常处理再次失败。*/ }
            return Task.CompletedTask;
        }
    }
}

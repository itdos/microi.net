using System;
using System.Threading;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// 高并发系统/用户行为日志队列。调用方只提交不可变快照，不等待MongoDB。
    /// </summary>
    public interface ISysLogQueue
    {
        bool Enqueue(SysLogParam param);
        SysLogQueueHealth GetHealth();
        Task FlushAsync(CancellationToken cancellationToken = default);
    }

    public sealed class SysLogQueueHealth
    {
        public string NodeId { get; set; }
        public long Enqueued { get; set; }
        public long Persisted { get; set; }
        public long Retried { get; set; }
        public long Pending { get; set; }
        public int Capacity { get; set; }
        public int OverflowCapacity { get; set; }
        public long OverflowPending { get; set; }
        public long EmergencySpooled { get; set; }
        public long Dropped { get; set; }
        public long FailedBatches { get; set; }
        public string LastError { get; set; }
        public DateTime? LastPersistedAt { get; set; }
        public string SpoolDirectory { get; set; }
    }
}

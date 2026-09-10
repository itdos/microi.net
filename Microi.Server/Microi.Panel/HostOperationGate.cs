namespace Microi.Panel;

/// <summary>独占数据目录约束一个主机控制器；在此进程内串行原升级队列与面板队列，任务事实仍持久化在 SQLite。</summary>
public sealed class HostOperationGate
{
    private readonly SemaphoreSlim mutex = new(1, 1);
    public async Task<IDisposable> Enter(CancellationToken cancellationToken)
    {
        await mutex.WaitAsync(cancellationToken); return new Lease(mutex);
    }
    private sealed class Lease(SemaphoreSlim mutex) : IDisposable
    {
        private int released;
        public void Dispose() { if (Interlocked.Exchange(ref released, 1) == 0) mutex.Release(); }
    }
}

using System;
using System.Collections.Concurrent;
using System.Threading;
using System.Threading.Tasks;

namespace Microi.net
{
    internal sealed class BackgroundTaskQueueHint
    {
        internal BackgroundTaskQueueHint(string osClient, string apiEngineKey)
        {
            OsClient = (osClient ?? "").Trim();
            ApiEngineKey = (apiEngineKey ?? "").Trim();
        }

        internal string OsClient { get; }

        internal string ApiEngineKey { get; }

        internal bool IsTenantRecovery => ApiEngineKey.Length == 0;

        internal string LaneKey => BackgroundTaskWakeQueue.BuildLaneKey(OsClient, ApiEngineKey);
    }

    /// <summary>
    /// Process-local acceleration hint for the durable background-task table.
    /// Hints are coalesced per tenant and may be lost on restart; correctness still
    /// comes exclusively from database claims, leases and fencing tokens.
    /// </summary>
    internal sealed class BackgroundTaskWakeQueue
    {
        private readonly ConcurrentQueue<BackgroundTaskQueueHint> _hints =
            new ConcurrentQueue<BackgroundTaskQueueHint>();
        private readonly ConcurrentDictionary<string, byte> _pending =
            new ConcurrentDictionary<string, byte>(StringComparer.OrdinalIgnoreCase);
        private readonly SemaphoreSlim _signal = new SemaphoreSlim(0);
        private int _pendingTaskLaneCount;

        internal bool HasPending => !_pending.IsEmpty;

        internal bool HasPendingTaskLane => Volatile.Read(ref _pendingTaskLaneCount) > 0;

        internal int PendingLaneCount => _pending.Count;

        internal void Signal(string osClient, string apiEngineKey)
        {
            osClient = (osClient ?? "").Trim();
            apiEngineKey = (apiEngineKey ?? "").Trim();
            if (osClient.Length == 0) return;
            var laneKey = BuildLaneKey(osClient, apiEngineKey);
            if (!_pending.TryAdd(laneKey, 0)) return;
            if (apiEngineKey.Length > 0) Interlocked.Increment(ref _pendingTaskLaneCount);
            _hints.Enqueue(new BackgroundTaskQueueHint(osClient, apiEngineKey));
            _signal.Release();
        }

        internal void SignalTenantRecovery(string osClient)
        {
            Signal(osClient, "");
        }

        internal bool TryTake(out BackgroundTaskQueueHint hint)
        {
            while (_hints.TryDequeue(out var candidate))
            {
                // Keep the semaphore count aligned when the reader takes a hint
                // without first awaiting it. A concurrent release may arrive just
                // after this non-blocking wait; that only causes one harmless wake.
                _signal.Wait(0);
                if (!_pending.TryRemove(candidate.LaneKey, out _)) continue;
                if (!candidate.IsTenantRecovery)
                    Interlocked.Decrement(ref _pendingTaskLaneCount);
                hint = candidate;
                return true;
            }
            hint = null;
            return false;
        }

        internal static string BuildLaneKey(string osClient, string apiEngineKey)
        {
            var tenant = (osClient ?? "").Trim().ToUpperInvariant();
            var taskType = (apiEngineKey ?? "").Trim().ToUpperInvariant();
            return tenant.Length + ":" + tenant + taskType.Length + ":" + taskType;
        }

        internal async Task WaitAsync(TimeSpan fallbackDelay, CancellationToken cancellationToken)
        {
            if (fallbackDelay <= TimeSpan.Zero)
                throw new ArgumentOutOfRangeException(nameof(fallbackDelay));
            if (HasPending) return;
            await _signal.WaitAsync(fallbackDelay, cancellationToken).ConfigureAwait(false);
        }
    }
}

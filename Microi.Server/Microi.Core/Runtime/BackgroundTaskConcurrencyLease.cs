using System;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// Cross-node serialization lease used by mandatory (tenant, task-type) lanes
    /// and by optional stricter business concurrency groups. Correctness still
    /// depends on the durable task lease, idempotency key and fencing token.
    /// </summary>
    internal sealed class BackgroundTaskConcurrencyLease : IDisposable
    {
        private const int DefaultLeaseMilliseconds = 90000;
        private readonly IDatabase _database;
        private readonly string _lockKey;
        private readonly string _owner;
        private readonly int _leaseMilliseconds;
        private int _releaseConfirmed;

        internal BackgroundTaskConcurrencyLease(
            IDatabase database,
            string lockKey,
            string owner,
            int leaseMilliseconds)
        {
            _database = database;
            _lockKey = lockKey;
            _owner = owner;
            _leaseMilliseconds = leaseMilliseconds;
        }

        public static BackgroundTaskConcurrencyLease TryAcquire(
            string osClient,
            string concurrencyKey,
            string owner)
        {
            return TryAcquire(
                osClient,
                concurrencyKey,
                owner,
                "",
                "",
                DefaultLeaseMilliseconds);
        }

        public static BackgroundTaskConcurrencyLease TryAcquire(
            string osClient,
            string concurrencyKey,
            string owner,
            string runtimeOsClientType,
            string runtimeOsClientNetwork,
            int leaseMilliseconds = DefaultLeaseMilliseconds,
            string lockDomain = "")
        {
            if (string.IsNullOrWhiteSpace(concurrencyKey)) return null;
            leaseMilliseconds = Math.Max(
                DefaultLeaseMilliseconds,
                Math.Min(900000, leaseMilliseconds));
            var database = MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase();
            if (database == null)
                throw new InvalidOperationException("Redis 不可用，已拒绝在无分布式并发租约时执行串行后台任务。");

            var scope = string.IsNullOrWhiteSpace(runtimeOsClientType)
                        && string.IsNullOrWhiteSpace(runtimeOsClientNetwork)
                ? concurrencyKey
                : $"{runtimeOsClientType ?? ""}\n{runtimeOsClientNetwork ?? ""}\n{concurrencyKey}";
            var lockKey = string.IsNullOrWhiteSpace(lockDomain)
                ? $"Microi:{osClient}:BackgroundTask:Concurrency:{Hash(scope)}"
                : $"Microi:{osClient}:BackgroundTask:Concurrency:{Hash(lockDomain)}:{Hash(scope)}";
            const string script = @"
if redis.call('exists', KEYS[1]) == 0 then
  redis.call('psetex', KEYS[1], ARGV[2], ARGV[1])
  return 1
end
return 0";
            var acquired = (long)database.ScriptEvaluate(
                script,
                new RedisKey[] { lockKey },
                new RedisValue[] { owner, leaseMilliseconds });
            return acquired == 1
                ? new BackgroundTaskConcurrencyLease(
                    database,
                    lockKey,
                    owner,
                    leaseMilliseconds)
                : null;
        }

        public bool Renew()
        {
            const string script = @"
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
end
return 0";
            return (long)_database.ScriptEvaluate(
                script,
                new RedisKey[] { _lockKey },
                new RedisValue[] { _owner, _leaseMilliseconds }) == 1;
        }

        public void Dispose()
        {
            if (Volatile.Read(ref _releaseConfirmed) == 1) return;
            const string script = @"
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0";
            try
            {
                _database.ScriptEvaluate(
                    script,
                    new RedisKey[] { _lockKey },
                    new RedisValue[] { _owner },
                    CommandFlags.FireAndForget);
            }
            catch
            {
                // TTL releases the lease after a node/network failure.
            }
        }

        // 只有 Redis 确认旧持有者已释放或锁已不存在，才能省去分片间的保护延迟。
        // 超时仅放弃加速；迟到命令仍按每次领取的唯一 owner 比较，不能删除新租约。
        internal async Task<bool> ReleaseConfirmedAsync(TimeSpan timeout)
        {
            if (timeout <= TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(timeout));
            if (Volatile.Read(ref _releaseConfirmed) == 1) return true;
            const string script = @"
local owner = redis.call('get', KEYS[1])
if not owner then return 2 end
if owner == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0";
            Task<RedisResult> release;
            try
            {
                release = _database.ScriptEvaluateAsync(script,
                    new RedisKey[] { _lockKey }, new RedisValue[] { _owner }, CommandFlags.None);
            }
            catch { return false; }
            using (var timeoutCancellation = new CancellationTokenSource())
            {
                var delay = Task.Delay(timeout, timeoutCancellation.Token);
                if (await Task.WhenAny(release, delay).ConfigureAwait(false) != release)
                {
                    _ = release.ContinueWith(task => { var ignored = task.Exception; },
                        CancellationToken.None, TaskContinuationOptions.OnlyOnFaulted
                        | TaskContinuationOptions.ExecuteSynchronously, TaskScheduler.Default);
                    return false;
                }
                timeoutCancellation.Cancel();
                try
                {
                    var result = (long)await release.ConfigureAwait(false);
                    if (result != 1 && result != 2) return false;
                    Volatile.Write(ref _releaseConfirmed, 1);
                    return true;
                }
                catch { return false; }
            }
        }

        private static string Hash(string value)
        {
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(value ?? ""));
            return BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant();
        }
    }
}

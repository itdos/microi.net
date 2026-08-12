using System;
using System.Security.Cryptography;
using System.Text;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// Optional cross-node serialization lease for tasks that must not overlap
    /// (schema installation, database backup, etc.). Correctness still depends on
    /// the task idempotency key and fencing token; this lease only limits overlap.
    /// </summary>
    internal sealed class BackgroundTaskConcurrencyLease : IDisposable
    {
        private const int DefaultLeaseMilliseconds = 90000;
        private readonly IDatabase _database;
        private readonly string _lockKey;
        private readonly string _owner;
        private readonly int _leaseMilliseconds;

        private BackgroundTaskConcurrencyLease(
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
            int leaseMilliseconds = DefaultLeaseMilliseconds)
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
            var lockKey = $"Microi:{osClient}:BackgroundTask:Concurrency:{Hash(scope)}";
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

        private static string Hash(string value)
        {
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(value ?? ""));
            return BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant();
        }
    }
}

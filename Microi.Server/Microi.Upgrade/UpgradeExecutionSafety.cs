using System;
using System.Diagnostics;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// Builds explicit server-provenance parameters for upgrade-time FormEngine
    /// writes. Upgrade code has no HTTP principal and must not depend on runtime
    /// type heuristics to retain its trusted origin.
    /// </summary>
    internal static class UpgradeTrustedFormEngine
    {
        internal static DiyTableRowParam BuildWriteParam(
            string tableName,
            string osClient,
            object payload)
        {
            var rowModel = JsonHelper.ToJObject(payload) ?? new JObject();
            if (!osClient.DosIsNullOrWhiteSpace())
            {
                rowModel["OsClient"] = osClient;
            }

            return new DiyTableRowParam
            {
                FormEngineKey = tableName,
                Id = rowModel["Id"].Val<string>(),
                OsClient = osClient,
                _InvokeType = InvokeType.Server.ToString(),
                _TrustedServerInvocation = true,
                _RowModel = (JObject)rowModel.DeepClone()
            };
        }

        internal static Task<DosResult> AddAsync(
            string tableName,
            string osClient,
            object payload,
            Dos.ORM.DbTrans trans = null)
        {
            return MicroiEngine.FormEngine.AddFormDataAsync(
                tableName,
                BuildWriteParam(tableName, osClient, payload),
                trans);
        }

        internal static Task<DosResult> UpdateAsync(
            string tableName,
            string osClient,
            object payload)
        {
            return MicroiEngine.FormEngine.UptFormDataAsync(
                tableName,
                BuildWriteParam(tableName, osClient, payload));
        }
    }

    /// <summary>
    /// 平台升级专用的 Redis 分布式租约。
    /// 获取、续租和释放均由 Lua 原子校验 owner；owner 携带单调递增 fencing token。
    /// </summary>
    internal sealed class UpgradeDistributedLease : IDisposable
    {
        private const int LeaseMilliseconds = 120000;
        private const int RenewIntervalMilliseconds = 30000;
        private readonly IDatabase _database;
        private readonly string _lockKey;
        private readonly CancellationTokenSource _renewCancellation = new CancellationTokenSource();
        private readonly Task _renewTask;
        private int _lost;

        private UpgradeDistributedLease(
            IDatabase database,
            string lockKey,
            string owner,
            long fencingToken)
        {
            _database = database;
            _lockKey = lockKey;
            Owner = owner;
            FencingToken = fencingToken;
            _renewTask = Task.Run(RenewLoopAsync);
        }

        public string Owner { get; }

        public long FencingToken { get; }

        public static UpgradeDistributedLease TryAcquire(string osClient, out string reason)
        {
            reason = null;
            if (osClient.DosIsNullOrWhiteSpace())
            {
                reason = "租户标识为空。";
                return null;
            }

            IDatabase database;
            try
            {
                database = MicroiEngine.CacheTenant.Default().GetIDatabase();
            }
            catch (Exception ex)
            {
                reason = "Redis 不可用：" + ex.Message;
                return null;
            }

            if (database == null)
            {
                reason = "Redis 不可用。";
                return null;
            }

            var keyPrefix = "Microi:{" + NormalizeKeySegment(osClient) + "}:ServerUpgrade";
            var lockKey = keyPrefix + ":Lease";
            var fenceKey = keyPrefix + ":FencingToken";
            var nodeId = Environment.MachineName + "-" + Process.GetCurrentProcess().Id;
            var instanceToken = NormalizeKeySegment(nodeId) + ":" + Guid.NewGuid().ToString("N");

            const string acquireScript = @"
if redis.call('exists', KEYS[1]) == 0 then
  local fence = redis.call('incr', KEYS[2])
  local owner = tostring(fence) .. ':' .. ARGV[1]
  redis.call('psetex', KEYS[1], ARGV[2], owner)
  return owner
end
return ''";

            try
            {
                var result = database.ScriptEvaluate(
                    acquireScript,
                    new RedisKey[] { lockKey, fenceKey },
                    new RedisValue[] { instanceToken, LeaseMilliseconds });
                var owner = result.ToString();
                if (owner.DosIsNullOrWhiteSpace())
                {
                    reason = "另一节点正在执行该租户升级。";
                    return null;
                }

                var separatorIndex = owner.IndexOf(':');
                if (separatorIndex <= 0
                    || !long.TryParse(owner.Substring(0, separatorIndex), out var fencingToken))
                {
                    reason = "升级租约返回了无效的 fencing token。";
                    return null;
                }

                return new UpgradeDistributedLease(database, lockKey, owner, fencingToken);
            }
            catch (Exception ex)
            {
                reason = "获取升级租约失败：" + ex.Message;
                return null;
            }
        }

        public void ThrowIfLost()
        {
            var lost = Volatile.Read(ref _lost) != 0;
            if (!lost)
            {
                try
                {
                    lost = !string.Equals(
                        _database.StringGet(_lockKey).ToString(),
                        Owner,
                        StringComparison.Ordinal);
                }
                catch
                {
                    // 无法确认所有权时必须 fail-closed，不能继续推进数据库版本。
                    lost = true;
                }
            }

            if (!lost)
            {
                return;
            }

            Interlocked.Exchange(ref _lost, 1);
            throw new InvalidOperationException("平台升级分布式租约已丢失，已停止继续迁移和推进版本号。");
        }

        private async Task RenewLoopAsync()
        {
            const string renewScript = @"
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
end
return 0";

            while (!_renewCancellation.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(
                        RenewIntervalMilliseconds,
                        _renewCancellation.Token).ConfigureAwait(false);
                    var renewed = (long)await _database.ScriptEvaluateAsync(
                        renewScript,
                        new RedisKey[] { _lockKey },
                        new RedisValue[] { Owner, LeaseMilliseconds }).ConfigureAwait(false);
                    if (renewed != 1)
                    {
                        Interlocked.Exchange(ref _lost, 1);
                        return;
                    }
                }
                catch (OperationCanceledException)
                {
                    return;
                }
                catch
                {
                    Interlocked.Exchange(ref _lost, 1);
                    return;
                }
            }
        }

        public void Dispose()
        {
            _renewCancellation.Cancel();
            try
            {
                _renewTask.Wait(TimeSpan.FromSeconds(3));
            }
            catch
            {
            }

            const string releaseScript = @"
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0";

            try
            {
                _database.ScriptEvaluate(
                    releaseScript,
                    new RedisKey[] { _lockKey },
                    new RedisValue[] { Owner });
            }
            catch
            {
            }
            _renewCancellation.Dispose();
        }

        private static string NormalizeKeySegment(string value)
        {
            if (value.DosIsNullOrWhiteSpace())
            {
                return "unknown";
            }

            var chars = value.Trim().ToCharArray();
            for (var index = 0; index < chars.Length; index++)
            {
                var current = chars[index];
                if (!char.IsLetterOrDigit(current)
                    && current != '-'
                    && current != '_'
                    && current != '.')
                {
                    chars[index] = '_';
                }
            }
            return new string(chars);
        }
    }

    /// <summary>
    /// 让既有 IMicroiUpgrade 接口无需扩参即可在异步迁移链中检查当前租约。
    /// </summary>
    internal static class UpgradeExecutionLeaseContext
    {
        private static readonly AsyncLocal<UpgradeDistributedLease> CurrentLease =
            new AsyncLocal<UpgradeDistributedLease>();

        public static IDisposable Enter(UpgradeDistributedLease lease)
        {
            var previous = CurrentLease.Value;
            CurrentLease.Value = lease;
            return new Scope(() => CurrentLease.Value = previous);
        }

        public static void ThrowIfLost()
        {
            CurrentLease.Value?.ThrowIfLost();
        }

        private sealed class Scope : IDisposable
        {
            private readonly Action _dispose;
            private int _disposed;

            public Scope(Action dispose)
            {
                _dispose = dispose;
            }

            public void Dispose()
            {
                if (Interlocked.Exchange(ref _disposed, 1) == 0)
                {
                    _dispose();
                }
            }
        }
    }
}

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

        internal static Task<DosResult> AddTableAsync(
            string osClient,
            string tableName,
            string description,
            bool onlyCreatePhysicalTable = false)
        {
            return MicroiEngine.FormEngine.AddTableAsync(new DiyTableParam
            {
                OsClient = osClient,
                Name = tableName,
                Description = description ?? "",
                DataBaseId = "",
                DataBaseName = "",
                _OnlyCreateTable = onlyCreatePhysicalTable,
                _InvokeType = InvokeType.Server.ToString(),
                _TrustedServerInvocation = true
            });
        }

        internal static Task<DosResult> AddFieldAsync(
            string osClient,
            DiyFieldParam param)
        {
            param.OsClient = osClient;
            param._InvokeType = InvokeType.Server.ToString();
            param._TrustedServerInvocation = true;
            return MicroiEngine.FormEngine.AddFieldAsync(param);
        }

        internal static Task<DosResult> AddDbFieldAsync(
            string osClient,
            DiyFieldParam param)
        {
            param.OsClient = osClient;
            param._InvokeType = InvokeType.Server.ToString();
            param._TrustedServerInvocation = true;
            return MicroiEngine.FormEngine.AddDbField(param);
        }
    }

    /// <summary>
    /// 平台升级专用的 Redis 分布式租约。
    /// 获取、续租和释放均由 Lua 原子校验 owner；owner 携带单调递增 fencing token。
    /// </summary>
    internal sealed class UpgradeDistributedLease : IDisposable
    {
        internal const int LeaseMilliseconds = 120000;
        internal const int RenewIntervalMilliseconds = 30000;
        internal const int RenewRetryIntervalMilliseconds = 5000;
        internal const int ExpirySafetyMarginMilliseconds = 15000;
        private readonly IDatabase _database;
        private readonly string _lockKey;
        private readonly CancellationTokenSource _renewCancellation = new CancellationTokenSource();
        private readonly Task _renewTask;
        private long _lastSuccessfulExtensionTimestamp;
        private int _consecutiveTransientRenewalFailures;
        private int _lost;

        private const string RenewScript = @"
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
end
return 0";

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
            _lastSuccessfulExtensionTimestamp = Stopwatch.GetTimestamp();
            // 应用包导入会触发大量数据库与缓存工作，生产节点的普通 ThreadPool
            // 可能短时饱和。续租若也排在同一队列中，就会出现业务仍在执行但租约
            // 因调度饥饿过期的假丢失。使用专用后台线程承载单租户续租循环。
            _renewTask = Task.Factory.StartNew(
                    RenewLoopAsync,
                    CancellationToken.None,
                    TaskCreationOptions.LongRunning,
                    TaskScheduler.Default)
                .Unwrap();
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
            if (Volatile.Read(ref _lost) == 0 && HasOwnershipSafetyWindow())
            {
                return;
            }

            Interlocked.Exchange(ref _lost, 1);
            throw new InvalidOperationException("平台升级分布式租约已丢失，已停止继续迁移和推进版本号。");
        }

        /// <summary>
        /// 在推进持久版本号或跨越迁移边界前强制向 Redis 确认 owner，
        /// 并在确认成功时原子续租。普通迁移热路径只读取本地租约状态，
        /// 避免每条数据都向 Redis 发起 StringGet 导致连接风暴。
        /// </summary>
        public void ConfirmOwnership()
        {
            ThrowIfLost();
            Exception lastException = null;
            for (var attempt = 1; attempt <= 3; attempt++)
            {
                try
                {
                    var renewed = (long)_database.ScriptEvaluate(
                        RenewScript,
                        new RedisKey[] { _lockKey },
                        new RedisValue[] { Owner, LeaseMilliseconds });
                    if (renewed == 1)
                    {
                        MarkExtensionSucceeded();
                        return;
                    }

                    MarkLost();
                    ThrowIfLost();
                }
                catch (InvalidOperationException) when (Volatile.Read(ref _lost) != 0)
                {
                    throw;
                }
                catch (Exception ex)
                {
                    lastException = ex;
                    if (attempt < 3 && HasOwnershipSafetyWindow())
                    {
                        Thread.Sleep(250 * attempt);
                        continue;
                    }
                    break;
                }
            }

            MarkLost();
            throw new InvalidOperationException(
                "平台升级无法向 Redis 确认分布式租约所有权，已停止推进版本号。",
                lastException);
        }

        private async Task RenewLoopAsync()
        {
            var delayMilliseconds = RenewIntervalMilliseconds;
            while (!_renewCancellation.IsCancellationRequested)
            {
                try
                {
                    await Task.Delay(
                        delayMilliseconds,
                        _renewCancellation.Token).ConfigureAwait(false);
                    var renewed = (long)await _database.ScriptEvaluateAsync(
                        RenewScript,
                        new RedisKey[] { _lockKey },
                        new RedisValue[] { Owner, LeaseMilliseconds }).ConfigureAwait(false);
                    if (renewed != 1)
                    {
                        MarkLost();
                        return;
                    }

                    MarkExtensionSucceeded();
                    delayMilliseconds = RenewIntervalMilliseconds;
                }
                catch (OperationCanceledException)
                {
                    return;
                }
                catch (Exception ex)
                {
                    var failures = Interlocked.Increment(ref _consecutiveTransientRenewalFailures);
                    if (!HasOwnershipSafetyWindow())
                    {
                        MarkLost();
                        return;
                    }

                    if (failures == 1 || failures % 6 == 0)
                    {
                        Console.WriteLine(
                            $"Microi：【警告】平台升级分布式租约续租暂时失败，第{failures}次，将在"
                            + $"{RenewRetryIntervalMilliseconds / 1000}秒后重试：{ex.Message}");
                    }
                    delayMilliseconds = RenewRetryIntervalMilliseconds;
                }
            }
        }

        private void MarkExtensionSucceeded()
        {
            Interlocked.Exchange(ref _lastSuccessfulExtensionTimestamp, Stopwatch.GetTimestamp());
            Interlocked.Exchange(ref _consecutiveTransientRenewalFailures, 0);
        }

        private void MarkLost()
        {
            Interlocked.Exchange(ref _lost, 1);
        }

        private bool HasOwnershipSafetyWindow()
        {
            var start = Interlocked.Read(ref _lastSuccessfulExtensionTimestamp);
            var elapsedTicks = Math.Max(0L, Stopwatch.GetTimestamp() - start);
            var elapsedMilliseconds = elapsedTicks * 1000d / Stopwatch.Frequency;
            return IsWithinOwnershipSafetyWindow(elapsedMilliseconds);
        }

        internal static bool IsWithinOwnershipSafetyWindow(double elapsedMilliseconds)
        {
            return elapsedMilliseconds
                   < LeaseMilliseconds - ExpirySafetyMarginMilliseconds;
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

        public static void ConfirmOwnership()
        {
            CurrentLease.Value?.ConfirmOwnership();
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

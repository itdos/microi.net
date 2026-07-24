using Dos.Common;
using StackExchange.Redis;

namespace Microi.net.Api;

public partial class HDFSController
{
    private static readonly TimeSpan OfficeSaveLeaseLifetime = TimeSpan.FromMinutes(10);
    private static readonly TimeSpan OfficeSaveLeaseRenewInterval = TimeSpan.FromMinutes(1);
    private const string OfficeSaveLeaseAcquireScript = @"
local acquired = redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2])
if not acquired then return {0, 0} end
local fencingToken = redis.call('INCR', KEYS[2])
redis.call('PEXPIRE', KEYS[2], ARGV[3])
return {1, fencingToken}";
    private const string OfficeSaveLeaseRenewScript = @"
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
return redis.call('PEXPIRE', KEYS[1], ARGV[2])";
    private const string OfficeSaveLeaseReleaseScript = @"
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
return redis.call('DEL', KEYS[1])";
    private const string OfficeSaveLeaseOwnerScript = @"
if redis.call('GET', KEYS[1]) == ARGV[1] then return 1 end
return 0";

    /// <summary>
    /// 同一租户、业务记录和文件字段的在线保存必须串行执行。租约与 fencing
    /// 计数器都位于共享 Redis，Key 使用同一个 hash tag，可用于 Redis Cluster。
    /// 获取、续租、持有校验和释放均按唯一 owner token 原子执行；Redis 不可用时
    /// 失败关闭，禁止回退到进程内锁。
    /// </summary>
    private static async Task<(OfficeSaveLease Lease, DosResult Error)> TryAcquireOfficeSaveLeaseAsync(
        string osClient,
        string tableName,
        string formDataId,
        string fieldName,
        CancellationToken cancellationToken)
    {
        if (osClient.DosIsNullOrWhiteSpace()
            || tableName.DosIsNullOrWhiteSpace()
            || formDataId.DosIsNullOrWhiteSpace()
            || fieldName.DosIsNullOrWhiteSpace())
        {
            return (null, new DosResult(0, null, "无法确定Office保存租约范围！"));
        }

        var scopeHash = Sha256Hex(
            osClient.Trim().ToLowerInvariant()
            + "|" + tableName.Trim().ToLowerInvariant()
            + "|" + formDataId.Trim()
            + "|" + fieldName.Trim().ToLowerInvariant());
        var hashTag = "{OfficeSave:" + scopeHash + "}";
        var lockKey = $"Microi:{osClient}:OfficeSave:{hashTag}:Lock";
        var fenceKey = $"Microi:{osClient}:OfficeSave:{hashTag}:Fence";
        var owner = Ulid.NewUlid().ToString();

        try
        {
            var database = MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase();
            for (var attempt = 0; attempt < 30; attempt++)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var result = await database.ScriptEvaluateAsync(
                    OfficeSaveLeaseAcquireScript,
                    new RedisKey[] { lockKey, fenceKey },
                    new RedisValue[]
                    {
                        owner,
                        (long)OfficeSaveLeaseLifetime.TotalMilliseconds,
                        (long)TimeSpan.FromDays(7).TotalMilliseconds
                    }).ConfigureAwait(false);
                var values = (RedisResult[])result;
                if (values != null && values.Length >= 2 && (long)values[0] == 1)
                {
                    return (
                        new OfficeSaveLease(
                            database,
                            lockKey,
                            owner,
                            (long)values[1]),
                        null);
                }
                await Task.Delay(100, cancellationToken).ConfigureAwait(false);
            }

            return (null, new DosResult(0, null, "同一文件正在保存，请稍后重试！"));
        }
        catch (OperationCanceledException)
        {
            return (null, new DosResult(0, null, "Office保存请求已取消！"));
        }
        catch
        {
            return (null, new DosResult(0, null, "Office保存租约服务暂时不可用，请稍后重试！"));
        }
    }

    private sealed class OfficeSaveLease : IAsyncDisposable
    {
        private readonly IDatabase _database;
        private readonly RedisKey _lockKey;
        private readonly RedisValue _owner;
        private readonly CancellationTokenSource _renewalCancellation = new();
        private readonly Task _renewalTask;
        private volatile bool _lost;
        private int _disposed;

        internal OfficeSaveLease(
            IDatabase database,
            RedisKey lockKey,
            RedisValue owner,
            long fencingToken)
        {
            _database = database;
            _lockKey = lockKey;
            _owner = owner;
            FencingToken = fencingToken;
            _renewalTask = RenewUntilDisposedAsync();
        }

        internal long FencingToken { get; }

        internal async Task<bool> IsOwnerAsync()
        {
            if (_lost || Volatile.Read(ref _disposed) != 0) return false;
            try
            {
                var result = await _database.ScriptEvaluateAsync(
                    OfficeSaveLeaseOwnerScript,
                    new RedisKey[] { _lockKey },
                    new RedisValue[] { _owner }).ConfigureAwait(false);
                var isOwner = (long)result == 1;
                if (!isOwner) _lost = true;
                return isOwner;
            }
            catch
            {
                _lost = true;
                return false;
            }
        }

        private async Task RenewUntilDisposedAsync()
        {
            try
            {
                while (true)
                {
                    await Task.Delay(
                        OfficeSaveLeaseRenewInterval,
                        _renewalCancellation.Token).ConfigureAwait(false);
                    var result = await _database.ScriptEvaluateAsync(
                        OfficeSaveLeaseRenewScript,
                        new RedisKey[] { _lockKey },
                        new RedisValue[]
                        {
                            _owner,
                            (long)OfficeSaveLeaseLifetime.TotalMilliseconds
                        }).ConfigureAwait(false);
                    if ((long)result != 1)
                    {
                        _lost = true;
                        return;
                    }
                }
            }
            catch (OperationCanceledException)
            {
                // 正常释放。
            }
            catch
            {
                _lost = true;
            }
        }

        public async ValueTask DisposeAsync()
        {
            if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
            _renewalCancellation.Cancel();
            try
            {
                await _renewalTask.ConfigureAwait(false);
            }
            catch
            {
                // 续租任务的异常已转换为 lost 状态，释放仍应继续尝试。
            }

            try
            {
                await _database.ScriptEvaluateAsync(
                    OfficeSaveLeaseReleaseScript,
                    new RedisKey[] { _lockKey },
                    new RedisValue[] { _owner }).ConfigureAwait(false);
            }
            catch
            {
                // 租约有有限 TTL，Redis 暂不可用时不执行不安全的本地释放。
            }
            finally
            {
                _renewalCancellation.Dispose();
            }
        }
    }
}

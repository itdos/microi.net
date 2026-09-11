using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Dos.ORM;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// 连接池属于各进程，恢复命令和回执属于共享控制面。每节点只执行自己的池轮换，
    /// Redis 中的幂等记录跨 HTTP 重试和负载均衡有效；旧节点缺少此协议时不能宣称全部恢复。
    /// </summary>
    internal sealed class DatabasePoolCoordinator
    {
        private readonly IDatabase redis;
        private readonly string prefix;
        private readonly Func<string, string, Database[]> resolve;
        private readonly Func<string, Database[], bool> isShared;
        private readonly SemaphoreSlim workGate = new SemaphoreSlim(1, 1);
        internal string NodeId { get; } = Guid.NewGuid().ToString("N");
        internal DatabasePoolCoordinator(IDatabase redis, string partition,
            Func<string, string, Database[]> resolve, Func<string, Database[], bool> isShared)
        {
            this.redis = redis;
            // Hash tag 保证 Redis Cluster 上脚本涉及的 Key 位于同一槽；租户键仍独立。
            prefix = "Microi:{PoolRecovery:" + Hash(partition) + "}:";
            this.resolve = resolve;
            this.isShared = isShared;
        }

        internal static string Hash(string text)
        {
            using (var sha = SHA256.Create())
                return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(text))).Replace("-", "").ToLowerInvariant();
        }
        private static double Now => DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        private string OperationKey(string tenant, string id) => prefix + "op:" + Hash(tenant.ToLowerInvariant()) + ":" + id;
        private static string[] PoolIds(Database[] pools) => pools.Select(p => p.ConnectionPoolId).Distinct().OrderBy(x => x, StringComparer.Ordinal).ToArray();

        internal async Task<JObject> PreviewAsync(string tenant, string target)
        {
            await HeartbeatAsync().ConfigureAwait(false);
            var pools = resolve(tenant, target);
            var nodes = await redis.SortedSetRangeByScoreAsync(prefix + "nodes", Now - 45).ConfigureAwait(false);
            var allowed = pools.Length > 0 && pools.All(p => p.GetConnectionPoolSnapshot().CanReset) && !isShared(tenant, pools);
            var preview = JObject.FromObject(new
            {
                Contract = "database-pools/v1", NodeId, Target = target,
                Pools = pools.Select(p => p.GetConnectionPoolSnapshot()).ToArray(),
                PoolIds = PoolIds(pools), CanReset = allowed,
                KnownNodes = nodes.Select(n => n.ToString()).ToArray(),
                OperationId = Guid.NewGuid().ToString("N"),
                Boundary = "仅覆盖已注册此协议的节点；Opening 非驱动借出数。旧版节点须先升级。共享池或不支持的驱动禁止轮换；扩展库不在本入口范围内。"
            });
            // 短期预览票据把编号绑定到池快照。回执到期后旧编号也不能重新执行，防止迟到重试再次清池。
            if (allowed) await redis.StringSetAsync(OperationKey(tenant, preview.Value<string>("OperationId")) + ":preview",
                preview.ToString(Formatting.None), TimeSpan.FromMinutes(2)).ConfigureAwait(false);
            return preview;
        }

        internal async Task<JObject> SubmitAsync(string tenant, string target, string id, string[] expected, string actor)
        {
            var key = OperationKey(tenant, id);
            // 重试先读取已接受的命令，不因现场配置变化而重复执行。
            var existing = await redis.StringGetAsync(key).ConfigureAwait(false);
            if (existing.HasValue)
            {
                var old = JObject.Parse(existing.ToString());
                if (old.Value<string>("Target") != target || !old["PoolIds"].ToObject<string[]>().SequenceEqual(expected))
                    throw new InvalidOperationException("OperationIdConflict");
                return await StatusAsync(tenant, id).ConfigureAwait(false);
            }
            var ticket = await redis.StringGetAsync(key + ":preview").ConfigureAwait(false);
            if (!ticket.HasValue) throw new InvalidOperationException("PoolRecoveryPreviewExpired");
            var preview = JObject.Parse(ticket.ToString());
            if (preview.Value<string>("Target") != target) throw new InvalidOperationException("PoolConfigurationChanged");
            var currentPools = resolve(tenant, target);
            if (currentPools.Length == 0 || isShared(tenant, currentPools) || currentPools.Any(p => !p.GetConnectionPoolSnapshot().CanReset))
                throw new InvalidOperationException("PoolMissingSharedOrUnsupported");
            if (!preview["PoolIds"].ToObject<string[]>().SequenceEqual(expected)) throw new InvalidOperationException("PoolConfigurationChanged");
            if (!PoolIds(currentPools).SequenceEqual(expected)) throw new InvalidOperationException("PoolConfigurationChanged");
            await HeartbeatAsync().ConfigureAwait(false);
            var nodes = await redis.SortedSetRangeByScoreAsync(prefix + "nodes", Now - 45).ConfigureAwait(false);
            var operation = JObject.FromObject(new
            {
                OperationId = id, Tenant = tenant, Target = target, PoolIds = expected,
                ExpectedNodes = nodes.Select(n => n.ToString()).ToArray(), Actor = actor, CreatedAt = Now, Deadline = Now + 90
            });
            // 接受命令、租户冷却和队列入列必须原子完成；断线后以相同编号读取，不能另造编号重试。
            const string script = @"
if redis.call('exists', KEYS[1]) == 1 then return 2 end
if redis.call('exists', KEYS[4]) == 0 then return -2 end
redis.call('zremrangebyscore', KEYS[3], '-inf', ARGV[2])
if redis.call('exists', KEYS[2]) == 1 then return 0 end
if redis.call('zcard', KEYS[3]) >= 32 then return -1 end
redis.call('set', KEYS[1], ARGV[1], 'EX', 600)
redis.call('set', KEYS[2], ARGV[3], 'EX', 60)
redis.call('zadd', KEYS[3], ARGV[4], KEYS[1])
redis.call('del', KEYS[4])
return 1";
            var result = (long)await redis.ScriptEvaluateAsync(script,
                new RedisKey[] { key, prefix + "cooldown:" + Hash(tenant.ToLowerInvariant()), prefix + "pending", key + ":preview" },
                new RedisValue[] { operation.ToString(Formatting.None), Now, id, Now + 90 }).ConfigureAwait(false);
            if (result <= 0) throw new InvalidOperationException(result == 0 ? "PoolRecoveryCooldown60Seconds" : result == -2 ? "PoolRecoveryPreviewExpired" : "PoolRecoveryQueueFull");
            // 并发相同编号可能先后通过预读，最终仍须比对胜出的不可变请求。
            var accepted = JObject.Parse((await redis.StringGetAsync(key).ConfigureAwait(false)).ToString());
            if (accepted.Value<string>("Target") != target || !accepted["PoolIds"].ToObject<string[]>().SequenceEqual(expected))
                throw new InvalidOperationException("OperationIdConflict");
            return await StatusAsync(tenant, id).ConfigureAwait(false);
        }

        internal async Task<JObject> StatusAsync(string tenant, string id)
        {
            var key = OperationKey(tenant, id);
            var raw = await redis.StringGetAsync(key).ConfigureAwait(false);
            if (!raw.HasValue) throw new InvalidOperationException("PoolRecoveryOperationNotFoundOrExpired");
            var operation = JObject.Parse(raw.ToString());
            var entries = await redis.HashGetAllAsync(key + ":results").ConfigureAwait(false);
            var results = entries.ToDictionary(e => e.Name.ToString(), e => JObject.Parse(e.Value.ToString()));
            var expected = operation["ExpectedNodes"].ToObject<string[]>();
            var missing = expected.Where(n => !results.ContainsKey(n)).ToArray();
            var failed = results.Values.Any(r => r.Value<string>("Status") != "Recovered" && r.Value<string>("Status") != "NoPoolLoaded");
            var state = missing.Length > 0 ? (Now > operation.Value<double>("Deadline") ? "Incomplete" : "Pending")
                : failed ? "PartialFailure" : "CompletedForRegisteredNodes";
            return JObject.FromObject(new
            {
                Contract = "database-pools/v1", OperationId = id, Target = operation["Target"], State = state,
                PoolIds = operation["PoolIds"], ExpectedNodes = expected, MissingNodes = missing,
                Nodes = results, CreatedAt = operation["CreatedAt"], Deadline = operation["Deadline"],
                Boundary = "回执只证明列出的节点和 SELECT 1；请再验证原报错业务接口。未注册的旧节点、持续泄漏、网络或数据库容量故障不由清池解决。"
            });
        }

        private async Task HeartbeatAsync()
        {
            await redis.SortedSetAddAsync(prefix + "nodes", NodeId, Now).ConfigureAwait(false);
            await redis.SortedSetRemoveRangeByScoreAsync(prefix + "nodes", double.NegativeInfinity, Now - 120).ConfigureAwait(false);
            await redis.KeyExpireAsync(prefix + "nodes", TimeSpan.FromMinutes(5)).ConfigureAwait(false);
        }

        /// <summary>可重复轮询的节点工作单元；未收到回执的节点保留 Pending，不能被网关当成成功。</summary>
        internal async Task TickAsync()
        {
            if (!await workGate.WaitAsync(0).ConfigureAwait(false)) return;
            try
            {
                await HeartbeatAsync().ConfigureAwait(false);
                await redis.SortedSetRemoveRangeByScoreAsync(prefix + "pending", double.NegativeInfinity, Now).ConfigureAwait(false);
                var keys = await redis.SortedSetRangeByScoreAsync(prefix + "pending", Now, double.PositiveInfinity, take: 32).ConfigureAwait(false);
                foreach (var item in keys)
                {
                    var key = item.ToString();
                    if (await redis.HashExistsAsync(key + ":results", NodeId).ConfigureAwait(false)) continue;
                    var raw = await redis.StringGetAsync(key).ConfigureAwait(false);
                    if (!raw.HasValue) continue;
                    var op = JObject.Parse(raw.ToString());
                    if (op.Value<double>("Deadline") < Now) continue;
                    var tenant = op.Value<string>("Tenant");
                    var pools = resolve(tenant, op.Value<string>("Target"));
                    var receipts = new List<object>();
                    var status = pools.Length == 0 ? "NoPoolLoaded" : "Recovered";
                    if (pools.Length > 0 && !PoolIds(pools).SequenceEqual(op["PoolIds"].ToObject<string[]>())) status = "PoolConfigurationChanged";
                    else if (isShared(tenant, pools)) status = "SharedPoolRejected";
                    else
                    {
                        foreach (var pool in pools)
                        {
                            string failure = null;
                            try
                            {
                                pool.ResetConnectionPool();
                                using (var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5)))
                                    failure = await pool.ProbeConnectionPoolAsync(timeout.Token).ConfigureAwait(false);
                            }
                            catch (NotSupportedException) { failure = "DatabasePoolRecoveryProviderUnsupported"; }
                            catch { failure = "PoolRotationFailed"; }
                            if (failure != null) status = "ProbeFailed";
                            receipts.Add(new { PoolId = pool.ConnectionPoolId, FailureCode = failure, Verified = failure == null });
                        }
                    }
                    var receipt = JObject.FromObject(new { NodeId, Status = status, Pools = receipts, CheckedAt = Now });
                    // 单进程工作门避免同一节点并发；进程重启后 NodeId 改变，重建的池也独立。
                    // ClearPool 本身无业务写入，极端“轮换后回执前掉线”可安全重做同一命令。
                    await redis.HashSetAsync(key + ":results", NodeId, receipt.ToString(Formatting.None)).ConfigureAwait(false);
                    await redis.KeyExpireAsync(key + ":results", TimeSpan.FromMinutes(10)).ConfigureAwait(false);
                }
            }
            finally { workGate.Release(); }
        }
    }
}

using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>故障池之外的可信应急入口；仍使用现有 DiyToken、主库管理员复核及 mcp:admin。</summary>
    public static class DatabasePoolRecoveryService
    {
        private static readonly SemaphoreSlim Requests = new SemaphoreSlim(2, 2);
        private static readonly object CoordinatorGate = new object();
        private static DatabasePoolCoordinator coordinator;
        private static int started;

        /// <summary>由已完成 SaaS/缓存初始化的宿主启动，随宿主取消；不可在服务定位器初始化阶段抢先解析租户缓存。</summary>
        public static async Task RunAsync(CancellationToken stoppingToken)
        {
            if (Interlocked.Exchange(ref started, 1) != 0) return;
            try
            {
                while (!stoppingToken.IsCancellationRequested)
                {
                    try { await Coordinator().TickAsync().ConfigureAwait(false); }
                    catch { /* Redis 暂时失联时下次重试，状态查询不会伪报已恢复。 */ }
                    await Task.Delay(TimeSpan.FromSeconds(2), stoppingToken).ConfigureAwait(false);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            finally { Interlocked.Exchange(ref started, 0); }
        }

        private static DatabasePoolCoordinator Coordinator()
        {
            lock (CoordinatorGate)
            {
                if (coordinator != null) return coordinator;
                // 使用启动门禁已解析的三参数（包含容器环境覆盖），不能重新从 JSON 读取另一套默认配置。
                var main = OsClientDefault.OsClient;
                if (string.IsNullOrWhiteSpace(main) || !OsClientExtend.TryResolveUniqueLoadedClient(main, out _, out var client, out var ambiguous)
                    || ambiguous || client == null) throw new InvalidOperationException("PoolRecoveryHostNotReady");
                var partition = main + "\n" + OsClientDefault.OsClientType + "\n" + OsClientDefault.OsClientNetwork;
                var redis = MicroiEngine.CacheTenant.Cache(main).GetIDatabase();
                return coordinator = new DatabasePoolCoordinator(redis, partition, Resolve, Shared);
            }
        }
        private static Database[] Resolve(string tenant, string target)
        {
            if (!OsClientExtend.TryResolveUniqueLoadedClient(tenant, out _, out var client, out var ambiguous) || ambiguous || client == null)
                return Array.Empty<Database>();
            return (target == "Write" ? new[] { client.Db?.Db } : target == "Read" ? new[] { client.DbRead?.Db }
                : new[] { client.Db?.Db, client.DbRead?.Db }).Where(p => p != null).GroupBy(p => p.ConnectionPoolId).Select(g => g.First()).ToArray();
        }
        private static bool Shared(string tenant, Database[] pools)
        {
            var ids = pools.Select(p => p.ConnectionPoolId).ToArray();
            // 主/读池与任一已加载租户的主库、读库、扩展库共用时拒绝，不能借应急操作跨租户清池。
            foreach (var entry in OsClientExtend.ClientList)
            {
                if (string.Equals(entry.Value?.OsClient, tenant, StringComparison.OrdinalIgnoreCase)) continue;
                var other = entry.Value;
                if (other == null) continue;
                var all = new[] { other.Db?.Db, other.DbRead?.Db }.Concat(
                    other.DataBases?.SelectMany(d => new[] { d.Db?.Db, d.DbRead?.Db }) ?? Enumerable.Empty<Database>());
                if (all.Any(p => p != null && ids.Contains(p.ConnectionPoolId))) return true;
            }
            return false;
        }

        /// <summary>只接受固定动作与池摘要，禁止连接串、SQL、任意租户及全池清理。</summary>
        public static async Task<DosResult> ExecuteAsync(JObject request)
        {
            if (!await Requests.WaitAsync(0).ConfigureAwait(false)) return new DosResult(0, null, "PoolRecoveryBusy");
            try
            {
                var action = request?.Value<string>("Action");
                if (action != "DatabasePools" && action != "DatabasePoolRecovery" && action != "ResetDatabasePools")
                    return new DosResult(0, null, "UnsupportedPoolAction");
                CurrentToken token;
                using (Database.BeginIsolatedConnections())
                {
                    // 不复用普通 MCP 过滤器的池连接；保留完全相同的会话与主库权限事实源。
                    var permission = await V8McpLogic.CheckPermission().ConfigureAwait(false);
                    token = (object)permission.token as CurrentToken;
                    if (!permission.ok || token?.CurrentUser == null) return new DosResult(0, null, "PoolRecoveryAuthorizationFailed");
                    if (UserAccessKeySecurity.IsSession(token.CurrentUser) && !UserAccessKeySecurity.HasScope(token.CurrentUser, "mcp:admin"))
                        return new DosResult(0, null, "PoolRecoveryRequiresMcpAdmin");
                }
                var suppliedTenant = request.Value<string>("OsClient");
                if (!string.IsNullOrEmpty(suppliedTenant) && !string.Equals(suppliedTenant, token.OsClient, StringComparison.OrdinalIgnoreCase))
                    return new DosResult(0, null, "PoolRecoveryTenantMismatch");
                var target = request.Value<string>("Target") ?? "Both";
                if (target != "Both" && target != "Read" && target != "Write") return new DosResult(0, null, "InvalidPoolTarget");
                var coordinator = Coordinator();
                if (action == "DatabasePools") return new DosResult(1, await coordinator.PreviewAsync(token.OsClient, target).ConfigureAwait(false));
                var id = request.Value<string>("OperationId");
                if (!Guid.TryParseExact(id, "N", out _)) return new DosResult(0, null, "InvalidPoolOperationId");
                if (action == "DatabasePoolRecovery") return new DosResult(1, await coordinator.StatusAsync(token.OsClient, id).ConfigureAwait(false));
                var ids = request["PoolIds"]?.ToObject<string[]>();
                if (ids == null || ids.Length < 1 || ids.Length > 2 || ids.Any(p => p == null || p.Length != 64 || p.Any(c => !Uri.IsHexDigit(c))))
                    return new DosResult(0, null, "InvalidExpectedPoolIds");
                if (request.Value<string>("Confirm") != "ResetDatabasePools:" + id) return new DosResult(0, null, "PoolRecoveryConfirmationRequired");
                var result = await coordinator.SubmitAsync(token.OsClient, target, id, ids, token.CurrentUser.Value<string>("Id")).ConfigureAwait(false);
                MicroiEngine.QueueSystemLog(token.OsClient, "Database", "PoolRecoveryRequested", "管理员申请在线连接池恢复",
                    result.ToString(), 2, true, id);
                return new DosResult(1, result);
            }
            catch (InvalidOperationException ex)
            {
                // 仅放行服务自身固定错误码；外部异常文本可能带连接串/凭据。
                var known = new[] { "OperationIdConflict", "PoolMissingSharedOrUnsupported", "PoolConfigurationChanged", "PoolRecoveryCooldown60Seconds", "PoolRecoveryQueueFull", "PoolRecoveryOperationNotFoundOrExpired", "PoolRecoveryPreviewExpired" };
                return new DosResult(0, null, known.Contains(ex.Message) ? ex.Message : "PoolRecoveryUnavailable");
            }
            catch { return new DosResult(0, null, "PoolRecoveryUnavailable"); }
            finally { Requests.Release(); }
        }
    }
}

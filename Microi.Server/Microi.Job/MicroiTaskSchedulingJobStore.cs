using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Quartz;
using Quartz.Impl.AdoJobStore;
using Quartz.Impl.Matchers;
using Quartz.Spi;

namespace Microi.net
{
    /// <summary>
    /// 停用时不领取、不推进、不 Pause 共享触发器，旧版仍可领取。
    /// 不能使用 Execute/Listener veto：彼时 Quartz 已推进 NextFireTime。
    /// </summary>
    public class MicroiTaskSchedulingJobStore : JobStoreTX
    {
        private readonly SemaphoreSlim legacyCatalogLock = new SemaphoreSlim(1, 1);
        private Dictionary<string, string> legacyOwners = new Dictionary<string, string>();
        private DateTimeOffset legacyCatalogAt = DateTimeOffset.MinValue;
        protected virtual Task<Dictionary<string, bool>> ReadSchedulingSettings() => MicroiTaskSchedulingPolicy.ReadTenantsAsync();
        protected virtual Task<bool> IsSchedulingDisabled(string tenant) => MicroiTaskSchedulingPolicy.IsDisabledAsync(tenant);
        protected virtual Task WriteSchedulingSkip(string tenant, IOperableTrigger trigger) => MicroiDisabledScheduleObserver.WriteSkip(
            tenant, trigger.JobKey, trigger.Key, trigger.GetNextFireTimeUtc() ?? DateTimeOffset.UtcNow, InstanceId);

        private async Task<MicroiTaskSchedulingSelection> ReadSelection(ConnectionAndTransactionHolder conn, CancellationToken cancellationToken)
        {
            var tenants = await ReadSchedulingSettings().ConfigureAwait(false);
            var legacyAllowed = new List<string>();
            // 混合租户按历史 JobDataMap 的实际 OsClient 划分，不能连带停用其它租户。
            // 全开/全关不扫描历史 Job，普通租户无需额外数据库查询。
            if (tenants.Values.Any(x => x) && tenants.Values.Any(x => !x))
            {
                await legacyCatalogLock.WaitAsync(cancellationToken).ConfigureAwait(false);
                try
                {
                    // 只缓存旧任务的归属，不缓存开关；避免混合租户每秒 N+1 回查。
                    // 归属变更仍由 TriggerFired 的真实 JobDataMap 复核，绝不放过被停用租户。
                    if (DateTimeOffset.UtcNow - legacyCatalogAt >= TimeSpan.FromSeconds(5))
                    {
                        var owners = new Dictionary<string, string>();
                        var keys = await Delegate.SelectJobsInGroup(conn, GroupMatcher<JobKey>.GroupEquals("default_group"), cancellationToken).ConfigureAwait(false);
                        foreach (var key in keys)
                        {
                            var job = await RetrieveJob(conn, key, cancellationToken).ConfigureAwait(false);
                            if (job != null) owners[key.Name] = MicroiTaskSchedulingPolicy.GetTenant(job);
                        }
                        legacyOwners = owners;
                        legacyCatalogAt = DateTimeOffset.UtcNow;
                    }
                    foreach (var pair in legacyOwners)
                        if (!string.IsNullOrWhiteSpace(pair.Value) && tenants.TryGetValue(pair.Value, out var disabled) && !disabled)
                            legacyAllowed.Add(pair.Key);
                }
                finally { legacyCatalogLock.Release(); }
            }
            return new MicroiTaskSchedulingSelection(tenants, legacyAllowed);
        }

        protected override async Task<IReadOnlyCollection<IOperableTrigger>> AcquireNextTrigger(
            ConnectionAndTransactionHolder conn, DateTimeOffset noLaterThan, int maxCount, TimeSpan timeWindow,
            Dictionary<string, int?> executionLimits, CancellationToken cancellationToken = default)
        {
            using (MicroiTaskSchedulingPolicy.Enter(await ReadSelection(conn, cancellationToken).ConfigureAwait(false)))
                return await base.AcquireNextTrigger(conn, noLaterThan, maxCount, timeWindow, executionLimits, cancellationToken).ConfigureAwait(false);
        }

        public override async Task<RecoverMisfiredJobsResult> RecoverMisfiredJobs(
            ConnectionAndTransactionHolder conn, bool recovering, CancellationToken cancellationToken = default)
        {
            // Misfire 同样会推进共享执行时间，必须使用同一门禁。
            using (MicroiTaskSchedulingPolicy.Enter(await ReadSelection(conn, cancellationToken).ConfigureAwait(false)))
                return await base.RecoverMisfiredJobs(conn, recovering, cancellationToken).ConfigureAwait(false);
        }

        protected override async Task ClusterRecover(ConnectionAndTransactionHolder conn,
            IReadOnlyList<SchedulerStateRecord> failedInstances, CancellationToken cancellationToken = default)
        {
            var tenants = await ReadSchedulingSettings().ConfigureAwait(false);
            if (tenants.Count == 0 || tenants.Values.All(disabled => disabled)) return;
            if (tenants.Values.All(disabled => !disabled))
            {
                await base.ClusterRecover(conn, failedInstances, cancellationToken).ConfigureAwait(false);
                return;
            }
            var recoverable = new List<SchedulerStateRecord>();
            foreach (var instance in failedInstances)
            {
                var records = await Delegate.SelectInstancesFiredTriggerRecords(conn, instance.SchedulerInstanceId, cancellationToken).ConfigureAwait(false);
                var containsDisabled = false;
                foreach (var record in records)
                {
                    var jobKey = record.JobKey;
                    if (jobKey == null && record.TriggerKey != null)
                        jobKey = (await RetrieveTrigger(conn, record.TriggerKey, cancellationToken).ConfigureAwait(false))?.JobKey;
                    var job = jobKey == null ? null : await RetrieveJob(conn, jobKey, cancellationToken).ConfigureAwait(false);
                    var tenant = MicroiTaskSchedulingPolicy.GetTenant(job);
                    if (job == null || string.IsNullOrWhiteSpace(tenant) || !tenants.TryGetValue(tenant, out var disabled) || disabled)
                    {
                        containsDisabled = true;
                        break;
                    }
                }
                // Quartz 的恢复最后会整节点删除 fired records。不能只过滤列表而让
                // 它清掉停用租户的旧版在途记录；混合故障节点留给允许处理它的旧节点，
                // 或关闭开关后再恢复。其它健康节点的正常领取不受影响。
                if (!containsDisabled) recoverable.Add(instance);
            }
            if (recoverable.Count > 0) await base.ClusterRecover(conn, recoverable, cancellationToken).ConfigureAwait(false);
        }

        protected override async Task<TriggerFiredBundle> TriggerFired(
            ConnectionAndTransactionHolder conn, IOperableTrigger trigger, CancellationToken cancellationToken = default)
        {
            var job = await RetrieveJob(conn, trigger.JobKey, cancellationToken).ConfigureAwait(false);
            var tenant = MicroiTaskSchedulingPolicy.GetTenant(job);
            var allowed = false;
            var manuallyDisabled = false;
            try
            {
                if (job != null && !string.IsNullOrWhiteSpace(tenant) && OsClientExtend.ClientList.Any(x => x.Value != null && string.Equals(x.Key, tenant, StringComparison.OrdinalIgnoreCase)))
                {
                    manuallyDisabled = await IsSchedulingDisabled(tenant).ConfigureAwait(false);
                    allowed = !manuallyDisabled;
                }
            }
            catch
            {
                await ReleaseAcquiredTrigger(conn, trigger, cancellationToken).ConfigureAwait(false);
                throw;
            }
            if (!allowed)
            {
                // 覆盖“领取后才打开开关”窗口：归还领取权，不修改执行时间。
                await ReleaseAcquiredTrigger(conn, trigger, cancellationToken).ConfigureAwait(false);
                if (manuallyDisabled)
                {
                    // 捕获领取后切换及手动触发，使用与观察器相同的确定性日志 Id。
                    // 日志故障不得回滚归还动作，更不得调用任务业务。
                    try { await WriteSchedulingSkip(tenant, trigger).ConfigureAwait(false); }
                    catch (Exception ex) { Console.WriteLine($"Microi：已归还停用任务[{tenant}/{trigger.JobKey}]，记录跳过日志失败：{ex.Message}"); }
                }
                return null;
            }
            // 此点之后视为已开始，保存开关不强制中断已经执行中的业务。
            return await base.TriggerFired(conn, trigger, cancellationToken).ConfigureAwait(false);
        }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Quartz.Impl.AdoJobStore;

namespace Microi.net
{
    /// <summary>
    /// 在数据库抢占前限定节点已加载的租户，避免不同网络/租户集合的节点共享
    /// Quartz 库时抢走无法执行的任务。不得等执行后再 Veto，否则 Cron 已经前移。
    /// </summary>
    internal static class MicroiTenantQuartzFilter
    {
        internal static string Apply(string sql, bool acquisition)
        {
            var selection = MicroiTaskSchedulingPolicy.Current.Value;
            if (selection != null) return AppendPredicate(sql, selection.Predicate(acquisition));
            var groups = OsClientExtend.ClientList
                .Where(pair => pair.Value != null)
                .Select(pair => MicroiQuartzScheduledTask.GetTenantGroup(pair.Key))
                .Distinct(StringComparer.Ordinal)
                .ToList();
            // 历史任务没有租户组，保留兼容；新建/修改任务已由调度管理层统一使用租户组。
            groups.Add("default_group");
            return ApplyGroups(sql, groups, acquisition ? "t.JOB_GROUP" : "JOB_GROUP");
        }

        internal static string ApplyGroups(string sql, IEnumerable<string> groups, string column)
        {
            // SQL 钩子不接收请求参数。仅接受平台生成的 ASCII 分组，拒绝引号或 SQL 片段。
            var safe = groups.Distinct(StringComparer.Ordinal).ToArray();
            if (safe.Any(group => !Regex.IsMatch(group, "^[a-z0-9_.-]{1,100}$")))
                throw new InvalidOperationException("Quartz 租户分组格式不合法。");
            var predicate = safe.Length == 0 ? "1 = 0" : column + " IN (" + string.Join(",", safe.Select(group => "'" + group + "'")) + ")";
            return AppendPredicate(sql, predicate);
        }

        internal static string AppendPredicate(string sql, string predicate)
        {
            var order = sql.IndexOf("ORDER BY", StringComparison.OrdinalIgnoreCase);
            if (order < 0) return sql + " AND (" + predicate + ")";
            return sql.Insert(order, " AND (" + predicate + ") ");
        }
    }

    /// <summary>保留 Quartz MySQL 方言和 LIMIT，只增加节点租户选择范围。</summary>
    public class MicroiTenantMySqlDelegate : MySQLDelegate
    {
        protected override string GetSelectNextTriggerToAcquireSql(int count) => MicroiTenantQuartzFilter.Apply(base.GetSelectNextTriggerToAcquireSql(count), true);
        protected override string GetSelectNextTriggerToAcquireWithExecutionGroupSql(int count) => MicroiTenantQuartzFilter.Apply(base.GetSelectNextTriggerToAcquireWithExecutionGroupSql(count), true);
        protected override string GetSelectNextTriggerToAcquireWithPreferredNodeSql(int count) => MicroiTenantQuartzFilter.Apply(base.GetSelectNextTriggerToAcquireWithPreferredNodeSql(count), true);
        protected override string GetSelectNextTriggerToAcquireWithPreferredNodeOnlySql(int count) => MicroiTenantQuartzFilter.Apply(base.GetSelectNextTriggerToAcquireWithPreferredNodeOnlySql(count), true);
        protected override string GetSelectNextMisfiredTriggersInStateToAcquireSql(int count) => MicroiTenantQuartzFilter.Apply(base.GetSelectNextMisfiredTriggersInStateToAcquireSql(count), false);
        protected override string GetCountMisfiredTriggersInStateSql() => MicroiTenantQuartzFilter.Apply(base.GetCountMisfiredTriggersInStateSql(), false);
    }

    /// <summary>SQL Server 使用相同租户规则，保留 Quartz 自己的 TOP 和参数语义。</summary>
    public class MicroiTenantSqlServerDelegate : SqlServerDelegate
    {
        protected override string GetSelectNextTriggerToAcquireSql(int count) => MicroiTenantQuartzFilter.Apply(base.GetSelectNextTriggerToAcquireSql(count), true);
        protected override string GetSelectNextTriggerToAcquireWithExecutionGroupSql(int count) => MicroiTenantQuartzFilter.Apply(base.GetSelectNextTriggerToAcquireWithExecutionGroupSql(count), true);
        protected override string GetSelectNextTriggerToAcquireWithPreferredNodeSql(int count) => MicroiTenantQuartzFilter.Apply(base.GetSelectNextTriggerToAcquireWithPreferredNodeSql(count), true);
        protected override string GetSelectNextTriggerToAcquireWithPreferredNodeOnlySql(int count) => MicroiTenantQuartzFilter.Apply(base.GetSelectNextTriggerToAcquireWithPreferredNodeOnlySql(count), true);
        protected override string GetSelectNextMisfiredTriggersInStateToAcquireSql(int count) => MicroiTenantQuartzFilter.Apply(base.GetSelectNextMisfiredTriggersInStateToAcquireSql(count), false);
        protected override string GetCountMisfiredTriggersInStateSql() => MicroiTenantQuartzFilter.Apply(base.GetCountMisfiredTriggersInStateSql(), false);
    }
}

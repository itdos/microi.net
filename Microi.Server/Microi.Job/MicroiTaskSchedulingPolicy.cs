using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using Quartz;

namespace Microi.net
{
    /// <summary>新版租户级调度门禁；复用系统设置缓存，不修改共享任务的 Pause 状态。</summary>
    internal static class MicroiTaskSchedulingPolicy
    {
        internal const string FieldName = "DisableTaskScheduling";
        internal const string SkipMessage = "系统设置中已经手动停用了任务调度，本次只做记录，未执行相关的业务。此记录仅代表新版调度器，旧版可能仍正常执行。";
        internal static readonly AsyncLocal<MicroiTaskSchedulingSelection> Current = new AsyncLocal<MicroiTaskSchedulingSelection>();
        private static readonly ConcurrentDictionary<string, DateTimeOffset> Failures = new ConcurrentDictionary<string, DateTimeOffset>(StringComparer.OrdinalIgnoreCase);

        internal static bool ParseDisabled(JToken value)
        {
            var text = value?.ToString().Trim();
            if (string.IsNullOrEmpty(text) || text == "0" || string.Equals(text, "false", StringComparison.OrdinalIgnoreCase)) return false;
            if (text == "1" || string.Equals(text, "true", StringComparison.OrdinalIgnoreCase)) return true;
            throw new InvalidOperationException("停用任务调度配置无效，调度器已拒绝执行，请检查系统设置。");
        }

        internal static async Task<bool> IsDisabledAsync(string osClient)
        {
            // 检查发生在 Quartz 抢占/推进触发器之前，不能调用业务 V8 实现。
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var config = await cache.GetAsync<JObject>($"Microi:{osClient}:SysConfig").ConfigureAwait(false);
            if (config == null)
            {
                var result = await MicroiEngine.FormEngine.GetSysConfig(osClient).ConfigureAwait(false);
                if (result.Code != 1 || result.Data == null)
                    throw new InvalidOperationException("无法读取系统设置，调度器已拒绝执行：" + result.Msg);
                config = JObject.FromObject((object)result.Data);
            }
            return ParseDisabled(config.GetValue(FieldName, StringComparison.OrdinalIgnoreCase));
        }

        internal static string GetTenant(IJobDetail job)
        {
            var tenant = job != null && job.JobDataMap.ContainsKey(MicroiJobConst.OsClient)
                ? job.JobDataMap.GetString(MicroiJobConst.OsClient) : null;
            return string.IsNullOrWhiteSpace(tenant) ? OsClientDefault.OsClient : tenant;
        }

        internal static async Task<Dictionary<string, bool>> ReadTenantsAsync(Func<string, Task<bool>> readSetting = null)
        {
            var result = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
            readSetting = readSetting ?? IsDisabledAsync;
            foreach (var tenant in OsClientExtend.ClientList.Where(x => x.Value != null).Select(x => x.Key).ToArray())
            {
                try
                {
                    result[tenant] = await readSetting(tenant).ConfigureAwait(false);
                    Failures.TryRemove(tenant, out _);
                }
                catch (Exception ex)
                {
                    // 一个租户故障不能放行其任务，也不能停止其它健康租户。
                    result[tenant] = true;
                    var now = DateTimeOffset.UtcNow;
                    if (!Failures.TryGetValue(tenant, out var last) || now - last >= TimeSpan.FromMinutes(1))
                    {
                        Failures[tenant] = now;
                        Console.WriteLine($"Microi：租户[{tenant}]系统设置读取失败，暂不领取其定时任务：{ex.Message}");
                    }
                }
            }
            foreach (var removed in Failures.Keys.Where(x => !result.ContainsKey(x))) Failures.TryRemove(removed, out _);
            return result;
        }

        internal static IDisposable Enter(MicroiTaskSchedulingSelection selection)
        {
            var previous = Current.Value;
            Current.Value = selection;
            return new Scope(() => Current.Value = previous);
        }
        private sealed class Scope : IDisposable
        {
            private readonly Action restore;
            internal Scope(Action restore) { this.restore = restore; }
            public void Dispose() => restore();
        }
    }

    internal sealed class MicroiTaskSchedulingSelection
    {
        internal readonly Dictionary<string, bool> Tenants;
        internal readonly IReadOnlyCollection<string> LegacyEnabledJobs;
        internal bool LegacyUnrestricted => Tenants.Count > 0 && Tenants.Values.All(disabled => !disabled);
        internal MicroiTaskSchedulingSelection(Dictionary<string, bool> tenants, IReadOnlyCollection<string> legacyEnabledJobs)
        {
            Tenants = tenants;
            LegacyEnabledJobs = legacyEnabledJobs ?? Array.Empty<string>();
        }
        internal bool Allows(string tenant) => !string.IsNullOrWhiteSpace(tenant)
            && Tenants.TryGetValue(tenant, out var disabled) && !disabled;
        internal string Predicate(bool acquisition)
        {
            var prefix = acquisition ? "t." : "";
            var groups = Tenants.Where(x => !x.Value).Select(x => MicroiQuartzScheduledTask.GetTenantGroup(x.Key)).Distinct().ToArray();
            var predicates = new List<string>();
            if (groups.Length > 0) predicates.Add(prefix + "JOB_GROUP IN (" + string.Join(",", groups.Select(SqlLiteral)) + ")");
            if (LegacyUnrestricted) predicates.Add(prefix + "JOB_GROUP = 'default_group'");
            else if (LegacyEnabledJobs.Count > 0)
                predicates.Add("(" + prefix + "JOB_GROUP = 'default_group' AND " + prefix + "JOB_NAME IN (" + string.Join(",", LegacyEnabledJobs.Select(SqlLiteral)) + "))");
            return predicates.Count == 0 ? "1 = 0" : string.Join(" OR ", predicates);
        }
        // SQL 模板钩子没有参数集合。只接受真实 Quartz JobKey，转义引号；
        // MySQL/SQL Server 对反斜杠处理不同，所以拒绝它及控制字符。
        internal static string SqlLiteral(string value)
        {
            if (value == null || value.Length > 200 || value.Any(c => char.IsControl(c) || c == '\\'))
                throw new InvalidOperationException("Quartz 任务标识无法安全用于调度过滤。");
            return "'" + value.Replace("'", "''") + "'";
        }
    }
}

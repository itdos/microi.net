using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.Linq;
using System.Threading;

namespace Microi.net
{
    /// <summary>
    /// 升级控制台的调用链诊断上下文，不承担租约、数据库版本或跨节点任务状态。
    /// AsyncLocal 隔离同时进行的租户升级；只有真实完成/版本覆盖的检查点推进百分比。
    /// </summary>
    internal static class UpgradeProgress
    {
        private static readonly AsyncLocal<State> Current = new AsyncLocal<State>();
        internal static int Percent => (int)((Current.Value?.Fraction ?? 0) * 100);
        internal static int CompletedCount => Current.Value?.Completed.Count ?? 0;
        internal static int TotalCount => Current.Value?.Steps.Length ?? 1;

        internal sealed class Batch
        {
            internal readonly Stopwatch Clock = Stopwatch.StartNew();
            internal double CompletedUnits;
            internal int Succeeded;
            internal int Failed;
            internal int CompletedSteps;
            internal int TotalSteps;
        }

        internal sealed class State
        {
            internal string Tenant;
            internal int TenantIndex;
            internal int TenantTotal;
            internal Batch Batch;
            internal string[] Steps = { "启动检查" };
            internal readonly HashSet<string> Completed = new HashSet<string>(StringComparer.Ordinal);
            internal string Active = "启动检查";
            internal readonly Stopwatch Clock = Stopwatch.StartNew();
            internal double Fraction => (double)Completed.Count / Steps.Length;
        }

        internal static IDisposable EnterTenant(string tenant, int index = 1, int total = 1, Batch batch = null)
        {
            var previous = Current.Value;
            Current.Value = new State
            {
                Tenant = tenant ?? "启动阶段", TenantIndex = index, TenantTotal = Math.Max(1, total), Batch = batch
            };
            return new Scope(() => Current.Value = previous);
        }

        internal static IDisposable EnsureTenant(string tenant)
        {
            return Current.Value == null ? EnterTenant(tenant) : new Scope(() => { });
        }

        internal static void Configure(IEnumerable<string> steps)
        {
            var state = Current.Value;
            if (state == null || state.Completed.Count > 0) return;
            state.Steps = steps.Distinct(StringComparer.Ordinal).ToArray();
            if (state.Steps.Length == 0) state.Steps = new[] { "启动检查" };
            state.Active = state.Steps[0];
        }

        internal static void Begin(string step)
        {
            var state = Current.Value;
            if (state == null || !state.Steps.Contains(step)) return;
            state.Active = step;
            WriteLine("Microi：【自动升级状态】开始：" + step);
        }

        internal static void Complete(string step, string message = null)
        {
            var state = Current.Value;
            if (state == null || !state.Steps.Contains(step)) return;
            state.Completed.Add(step);
            state.Active = step;
            if (message != null) WriteLine("Microi：【自动升级状态】" + message);
        }

        internal static void CompleteAll()
        {
            var state = Current.Value;
            if (state == null) return;
            foreach (var step in state.Steps) state.Completed.Add(step);
            state.Active = state.Steps.Last();
        }

        internal static void FinishTenant(bool success)
        {
            var state = Current.Value;
            if (state?.Batch == null) return;
            if (success) state.Batch.Succeeded++; else state.Batch.Failed++;
            state.Batch.CompletedUnits += state.Fraction;
            state.Batch.CompletedSteps += state.Completed.Count;
            state.Batch.TotalSteps += state.Steps.Length;
        }

        internal static string Prefix()
        {
            var state = Current.Value;
            if (state == null) return "【自动升级状态】【总进度0.0%】【租户0/0】【升级点0/0】【阶段：宿主初始化】";
            var fraction = state.Fraction;
            var overall = ((state.Batch?.CompletedUnits ?? 0) + fraction) / state.TenantTotal;
            var elapsed = state.Clock.Elapsed;
            var eta = state.Completed.Count > 0 && fraction > 0 && fraction < 1
                ? "约" + FormatDuration(TimeSpan.FromSeconds(elapsed.TotalSeconds * (1 - fraction) / fraction))
                : fraction >= 1 ? "0秒" : "估算中";
            return string.Format(CultureInfo.InvariantCulture,
                "【自动升级状态】【总进度{0:F1}%】【租户{1}/{2}：{3}】【本租户{4:F1}%】【升级点{5}/{6}，已完成{7}】【当前：{8}】【耗时{9}，本租户预计剩余{10}】",
                Math.Min(100, overall * 100), state.TenantIndex, state.TenantTotal, state.Tenant,
                fraction * 100, Array.IndexOf(state.Steps, state.Active) + 1, state.Steps.Length,
                state.Completed.Count, state.Active, FormatDuration(elapsed), eta);
        }

        internal static void WriteLine(string message)
        {
            // 多行异常的每一行也必须携带进度，禁止全局替换 Console.Out 影响其它业务日志。
            var prefix = Prefix();
            foreach (var line in (message ?? string.Empty).Replace("\r\n", "\n").Split('\n'))
            {
                var detail = line.TrimStart();
                if (detail.StartsWith("Microi：", StringComparison.Ordinal)) detail = detail.Substring("Microi：".Length);
                if (detail.StartsWith("【自动升级状态】", StringComparison.Ordinal)) detail = detail.Substring("【自动升级状态】".Length);
                // 保留控制台关键日志标识；普通“租户数据库升级”会被现有日志路由转存而不输出终端。
                Console.WriteLine("Microi：" + prefix + " " + detail);
            }
        }

        internal static void WriteBatchSummary(Batch batch, int total, int processed, bool cancelled)
        {
            var percent = total == 0 ? 100 : batch.CompletedUnits * 100 / total;
            Console.WriteLine(string.Format(CultureInfo.InvariantCulture,
                "【总进度{0:F1}%】【租户{1}/{2}】【升级点{8}/{9}】【阶段：批次汇总】Microi：平台自动升级{3}；成功/已是最新={4}，失败={5}，未处理={6}，总耗时={7}。",
                percent, processed, total, cancelled ? "已取消" : "已结束", batch.Succeeded, batch.Failed,
                total - processed, FormatDuration(batch.Clock.Elapsed), batch.CompletedSteps, batch.TotalSteps));
        }

        private static string FormatDuration(TimeSpan value)
        {
            if (value.TotalHours >= 1) return $"{(int)value.TotalHours}小时{value.Minutes}分钟";
            if (value.TotalMinutes >= 1) return $"{(int)value.TotalMinutes}分钟{value.Seconds}秒";
            return $"{Math.Max(0, (int)value.TotalSeconds)}秒";
        }

        private sealed class Scope : IDisposable
        {
            private Action _restore;
            internal Scope(Action restore) { _restore = restore; }
            public void Dispose() { Interlocked.Exchange(ref _restore, null)?.Invoke(); }
        }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace Microi.net
{
    /// <summary>当前节点的有界调度诊断；保存启动状态之外的真实领取进展，不作为集群事实源。</summary>
    internal static class MicroiSchedulingDiagnostics
    {
        private static readonly object Sync = new object();
        private static DateTime? started, completed;
        private static int acquired;
        private static string error;
        private static string schedulerError;
        private static DateTime? schedulerErrorAt;
        internal static void SchedulerFailure(Exception failure)
        { lock (Sync) { schedulerError = SafeError(failure); schedulerErrorAt = DateTime.UtcNow; } }
        private static Dictionary<string, bool> tenants = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        internal static void Begin() { lock (Sync) started = DateTime.UtcNow; }
        internal static void Selected(Dictionary<string, bool> selection)
        { lock (Sync) tenants = new Dictionary<string, bool>(selection, StringComparer.OrdinalIgnoreCase); }
        internal static void End(int count, Exception failure = null)
        {
            lock (Sync)
            {
                completed = DateTime.UtcNow; acquired = count;
                error = failure == null ? null : SafeError(failure);
            }
        }
        internal static string SafeError(Exception failure)
        {
            if (failure == null) return "Quartz 未提供异常详情。";
            var text = failure.GetType().Name + ": " + failure.Message;
            if (failure.InnerException != null) text += " | " + failure.InnerException.GetType().Name + ": " + failure.InnerException.Message;
            // 先限制输入再脱敏，避免异常里拼入连接串、Bearer 或带引号的 JSON 秘密。
            text = text.Substring(0, Math.Min(text.Length, 4096));
            try
            {
            text = Regex.Replace(text, @"(?i)\b(?:mongodb(?:\+srv)?|redis|mysql|sqlserver)://[^\s]+", "<connection redacted>", RegexOptions.None, TimeSpan.FromMilliseconds(100));
            text = Regex.Replace(text, @"(?i)Bearer\s+[\w.\-]+", "Bearer <redacted>", RegexOptions.None, TimeSpan.FromMilliseconds(100));
            text = Regex.Replace(text, "(?i)([\\w.-]*(?:password|pwd|token|authorization|secret)[\\w.-]*[\\\"']?\\s*[=:]\\s*)(?:\\\"[^\\\"]*\\\"|'[^']*'|[^;\\s,}]+)", "$1<redacted>", RegexOptions.None, TimeSpan.FromMilliseconds(100));
            return text.Length > 1000 ? text.Substring(0, 1000) : text;
            }
            catch (RegexMatchTimeoutException)
            {
                // 诊断自身不能打断 Quartz 错误通知，脱敏未完成时禁止返回原文。
                return failure.GetType().Name + ": 异常详情脱敏超时。";
            }
        }
        internal static object Read(string tenant)
        {
            lock (Sync) return new
            {
                LastAcquisitionStartedAt = started, LastAcquisitionCompletedAt = completed,
                LastAcquiredCount = acquired, LastAcquisitionError = error,
                LastSchedulerErrorAt = schedulerErrorAt, LastSchedulerError = schedulerError,
                TenantLoaded = OsClientExtend.ClientList.Any(x => x.Value != null && string.Equals(x.Key, tenant, StringComparison.OrdinalIgnoreCase)),
                LastSelectionIncludedTenant = tenants.ContainsKey(tenant ?? ""),
                LastSettingsReadError = MicroiTaskSchedulingPolicy.ReadFailure(tenant),
                LastSelectionDisabled = tenants.TryGetValue(tenant ?? "", out var disabled) ? (bool?)disabled : null
            };
        }
    }
}

using System;
using System.Threading.Tasks;
using System.Text.RegularExpressions;
using Dos.Common;

namespace Microi.net
{
    /// <summary>运行日志必须等待 MongoDB 确认写入，不能把异步队列接收当成持久化成功。</summary>
    public static class OperationalLogStorage
    {
        private static readonly Regex SensitiveJson = new Regex(
            "(?i)(\\\"?(?:password|pwd|token|authorization|apikey|secret|logincode|encodingaeskey|connectionstring)\\\"?\\s*[:=]\\s*\\\"?)[^\\\",}&\\s]+",
            RegexOptions.Compiled | RegexOptions.CultureInvariant,
            TimeSpan.FromMilliseconds(100));

        public static string SanitizeContent(string value)
        {
            if (string.IsNullOrEmpty(value)) return value;
            var bounded = value.Length <= 16384 ? value : value.Substring(0, 16384) + "…";
            try { return SensitiveJson.Replace(bounded, "$1***"); }
            catch (RegexMatchTimeoutException) { return "日志内容因脱敏超时已隐藏。"; }
        }

        public static async Task<bool> WriteAsync(SysLogParam log, Func<Task<DosResult>> writeMySql)
        {
            if (log == null || string.IsNullOrWhiteSpace(log.OsClient) || writeMySql == null) return false;
            if (string.IsNullOrWhiteSpace(log.EventId)) log.EventId = Guid.NewGuid().ToString("N");
            if (!log.OccurredAt.HasValue) log.OccurredAt = DateTime.Now;
            try
            {
                // AddSysLog only enqueues in a Web host. AddSysLogs performs an acknowledged,
                // idempotent MongoDB upsert and returns the actual persistence outcome.
                var mongo = MicroiEngine.TryGetService<IMongoDB>();
                var stored = mongo == null ? null : await mongo.AddSysLogs(new[] { log }).ConfigureAwait(false);
                if (stored?.Code == 1) return true;
            }
            catch { /* MongoDB is unavailable; try the tenant's relational log table. */ }

            try
            {
                var fallback = await writeMySql().ConfigureAwait(false);
                return fallback?.Code == 1;
            }
            catch { return false; }
        }
    }
}

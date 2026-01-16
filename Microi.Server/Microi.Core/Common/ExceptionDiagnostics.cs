using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.Linq;
using System.Threading;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// 异常诊断工具 - 追踪和统计异常信息
    /// </summary>
    public static class ExceptionDiagnostics
    {
        private static readonly ConcurrentDictionary<string, ExceptionStats> _exceptionStats = new ConcurrentDictionary<string, ExceptionStats>();
        private static long _totalExceptions = 0;
        private static DateTime _lastReportTime = DateTime.Now;

        public class ExceptionStats
        {
            public string ExceptionType { get; set; }
            public long Count { get; set; }
            public DateTime FirstOccurrence { get; set; }
            public DateTime LastOccurrence { get; set; }
            public string LastMessage { get; set; }
            public string LastStackTrace { get; set; }
            public ConcurrentBag<string> DistinctMessages { get; set; } = new ConcurrentBag<string>();
        }

        /// <summary>
        /// 记录异常（在 catch 块中调用）
        /// </summary>
        public static void TrackException(Exception ex, string context = null)
        {
            if (ex == null) return;

            Interlocked.Increment(ref _totalExceptions);

            var exType = ex.GetType().FullName;
            var key = string.IsNullOrEmpty(context) ? exType : $"{exType}:{context}";

            _exceptionStats.AddOrUpdate(key,
                // 添加新记录
                _ => new ExceptionStats
                {
                    ExceptionType = exType,
                    Count = 1,
                    FirstOccurrence = DateTime.Now,
                    LastOccurrence = DateTime.Now,
                    LastMessage = ex.Message,
                    LastStackTrace = ex.StackTrace,
                    DistinctMessages = new ConcurrentBag<string> { ex.Message }
                },
                // 更新现有记录
                (_, stats) =>
                {
                    stats.Count++;
                    stats.LastOccurrence = DateTime.Now;
                    stats.LastMessage = ex.Message;
                    stats.LastStackTrace = ex.StackTrace;
                    
                    // 记录不同的错误消息（最多保留10条）
                    if (stats.DistinctMessages.Count < 10 && !stats.DistinctMessages.Contains(ex.Message))
                    {
                        stats.DistinctMessages.Add(ex.Message);
                    }
                    
                    return stats;
                });

            // 每5分钟自动输出一次报告
            if ((DateTime.Now - _lastReportTime).TotalMinutes >= 5)
            {
                PrintReport();
                _lastReportTime = DateTime.Now;
            }
        }

        /// <summary>
        /// 获取异常统计报告
        /// </summary>
        public static string GetReport()
        {
            if (_exceptionStats.IsEmpty)
            {
                return "暂无异常记录";
            }

            var report = $"\n===== 异常诊断报告 =====\n";
            report += $"总异常数: {_totalExceptions}\n";
            report += $"异常类型数: {_exceptionStats.Count}\n";
            report += $"报告时间: {DateTime.Now:yyyy-MM-dd HH:mm:ss}\n\n";

            // 按发生次数降序排列
            var sortedStats = _exceptionStats
                .OrderByDescending(x => x.Value.Count)
                .Take(20); // 只显示前20个

            foreach (var kvp in sortedStats)
            {
                var stats = kvp.Value;
                report += $"【{stats.ExceptionType}】\n";
                report += $"  发生次数: {stats.Count}\n";
                report += $"  首次发生: {stats.FirstOccurrence:yyyy-MM-dd HH:mm:ss}\n";
                report += $"  最后发生: {stats.LastOccurrence:yyyy-MM-dd HH:mm:ss}\n";
                report += $"  最后消息: {stats.LastMessage}\n";
                
                if (stats.DistinctMessages.Count > 1)
                {
                    report += $"  不同消息数: {stats.DistinctMessages.Count}\n";
                }
                
                // 显示部分堆栈跟踪（前3行）
                if (!string.IsNullOrEmpty(stats.LastStackTrace))
                {
                    var stackLines = stats.LastStackTrace.DosSplit('\n').Take(3);
                    report += $"  堆栈跟踪:\n    {string.Join("\n    ", stackLines)}\n";
                }
                
                report += "\n";
            }

            report += "========================\n";
            return report;
        }

        /// <summary>
        /// 打印报告到控制台
        /// </summary>
        public static void PrintReport()
        {
            Console.WriteLine(GetReport());
        }

        /// <summary>
        /// 清除统计数据
        /// </summary>
        public static void Clear()
        {
            _exceptionStats.Clear();
            Interlocked.Exchange(ref _totalExceptions, 0);
            _lastReportTime = DateTime.Now;
        }

        /// <summary>
        /// 获取特定异常类型的统计
        /// </summary>
        public static ExceptionStats GetStats(string exceptionType)
        {
            _exceptionStats.TryGetValue(exceptionType, out var stats);
            return stats;
        }

        /// <summary>
        /// 检查是否有高频异常（需要关注的异常）
        /// </summary>
        public static bool HasHighFrequencyExceptions(int threshold = 100)
        {
            return _exceptionStats.Any(x => x.Value.Count > threshold);
        }
    }
}

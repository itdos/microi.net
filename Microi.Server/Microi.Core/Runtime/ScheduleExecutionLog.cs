using System;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>任务执行记录进入按租户/月分区的系统日志队列，日志故障不能改变业务结果。</summary>
    public static class ScheduleExecutionLog
    {
        public const string TargetType = "ScheduledJob";

        public static bool? Success(object result)
        {
            try
            {
                var token = result == null ? null : JToken.FromObject(result);
                return token is JObject obj && obj["Code"] != null ? obj["Code"].ToString() == "1" : (bool?)null;
            }
            catch { return null; }
        }

        public static bool Write(string tenant, string jobName, string eventId, string action,
            object result, bool? success, double durationMs, DateTime occurredAt)
        {
            try
            {
                var content = result is string text ? text : JsonConvert.SerializeObject(result);
                return MicroiEngine.QueueSysLog(new SysLogParam
                {
                    OsClient = tenant, EventId = eventId, OccurredAt = occurredAt,
                    Category = "JobExecution", Type = "Job", Source = "Quartz",
                    TargetType = TargetType, TargetId = jobName, Action = action,
                    Title = jobName, Content = content, Success = success,
                    Level = success == false ? 2 : 1, DurationMs = Math.Max(0, durationMs)
                });
            }
            catch
            {
                // 队列自行记录丢弃/溢出/落盘健康状态；不能递归记录日志或回写主库。
                return false;
            }
        }
    }
}

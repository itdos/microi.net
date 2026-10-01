using System;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>任务日志优先确认写入 MongoDB，失败时写入租户关系库。</summary>
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

        public static async Task<bool> WriteAsync(string tenant, string jobName, string eventId, string action,
            object result, bool? success, double durationMs, DateTime occurredAt)
        {
            try
            {
                var content = OperationalLogStorage.SanitizeContent(
                    result is string text ? text : JsonConvert.SerializeObject(result));
                var duration = Math.Max(0, durationMs);
                var saved = await OperationalLogStorage.WriteAsync(new SysLogParam
                {
                    OsClient = tenant, EventId = eventId, OccurredAt = occurredAt,
                    Category = "JobExecution", Type = "Job", Source = "Quartz",
                    TargetType = TargetType, TargetId = jobName, Action = action,
                    Title = jobName, Content = content, Success = success,
                    Level = success == false ? 2 : 1, DurationMs = duration
                }, () => MicroiEngine.FormEngine.AddFormDataAsync("diy_schedule_job_log", new
                {
                    OsClient = tenant, Id = eventId, JobName = jobName, Message = content,
                    CreateTime = occurredAt, LogTime = occurredAt.ToString("yyyy-MM-dd HH:mm:ss"),
                    Status = success == false ? 0 : success == true ? 1 : 2,
                    Duration = (int)Math.Min(int.MaxValue, duration), IsDeleted = 0
                })).ConfigureAwait(false);
                if (!saved) Console.Error.WriteLine($"Microi：任务日志写入 MongoDB 与关系库均失败；OsClient={tenant}; JobName={jobName}。");
                return saved;
            }
            catch
            {
                // 日志故障不能改变任务业务结果。
                return false;
            }
        }
    }
}

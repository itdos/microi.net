using System;
using System.Globalization;
using System.Threading.Tasks;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>只持久化 Quartz 已观测的运行时间；配置保存继续走表单引擎的事件、日志及版本链路。</summary>
    internal static class ScheduleRuntimeTimeWriter
    {
        internal static string ReadTime(JToken value)
        {
            if (value == null || value.Type == JTokenType.Null) return null;
            return value.Type == JTokenType.Date
                ? value.Value<DateTime>().ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture)
                : value.Value<string>();
        }

        internal static bool HasChanged(JObject observed, string lastTime, string nextTime)
        {
            return !string.Equals(ReadTime(observed["LastTime"]) ?? "", lastTime ?? "", StringComparison.Ordinal)
                || !string.Equals(ReadTime(observed["NextTime"]) ?? "", nextTime ?? "", StringComparison.Ordinal);
        }

        internal static Task<int> WriteAsync(string osClient, JObject observed, string lastTime, string nextTime)
        {
            if (string.IsNullOrWhiteSpace(osClient)) throw new ArgumentException("运行状态写回必须指定租户。", nameof(osClient));
            // 查询与写回必须解析同一租户的主库，禁止默认租户回退、扩展库或从库写入。
            var client = OsClientExtend.GetClient(osClient);
            if (client?.Db == null || !string.Equals(client.OsClient, osClient, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("定时任务租户主库不可用。");
            return WriteAsync(client.Db, observed, lastTime, nextTime);
        }

        internal static async Task<int> WriteAsync(DbSession database, JObject observed, string lastTime, string nextTime)
        {
            if (database == null) throw new ArgumentNullException(nameof(database));
            if (observed == null || string.IsNullOrWhiteSpace(observed["Id"]?.Value<string>()))
                throw new ArgumentException("运行状态写回必须指定已读取的任务行。", nameof(observed));
            if (!HasChanged(observed, lastTime, nextTime)) return 0;

            // 每分钟的运行态投影不是配置修改。通用 UptFormData 会无条件生成完整版本，
            // 并在每次写入前扫描历史版本号；此处只允许固定表、固定两列的参数化更新。
            // 原时间、任务名、状态与软删除条件组成 CAS：并行节点、暂停、重命名或删除后
            // 的陈旧观测不能覆盖新状态。0 行表示已变化/无需写入，不重放配置或业务执行。
            return await database.FromSql(@"UPDATE {0}diy_schedule_job{1}
SET {0}LastTime{1}=@lastTime,{0}NextTime{1}=@nextTime
WHERE {0}Id{1}=@id AND {0}JobName{1}=@jobName AND {0}Status{1}=@status
AND ({0}IsDeleted{1}=0 OR {0}IsDeleted{1} IS NULL)
AND ({0}LastTime{1}=@oldLastTime OR ({0}LastTime{1} IS NULL AND @oldLastTime IS NULL))
AND ({0}NextTime{1}=@oldNextTime OR ({0}NextTime{1} IS NULL AND @oldNextTime IS NULL))")
                .AddInParameter("lastTime", lastTime ?? "")
                .AddInParameter("nextTime", nextTime ?? "")
                .AddInParameter("id", observed["Id"].Value<string>())
                .AddInParameter("jobName", observed["JobName"]?.Value<string>())
                .AddInParameter("status", "正常")
                .AddInParameter("oldLastTime", (object)ReadTime(observed["LastTime"]) ?? DBNull.Value)
                .AddInParameter("oldNextTime", (object)ReadTime(observed["NextTime"]) ?? DBNull.Value)
                .ExecuteNonQueryAsync().ConfigureAwait(false);
        }
    }
}

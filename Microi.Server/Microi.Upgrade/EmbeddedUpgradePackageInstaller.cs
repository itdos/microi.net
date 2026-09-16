using System;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 旧库内置包的提交边界：资源提交、任务幂等保存及回读、安装版本确认。
    /// 仅 Upgrade13 的已校验程序集资源调用；普通商城继续使用持久队列分片。
    /// 崩溃或任一步失败由已有升级租约和版本门重新执行，不伪造后台任务信封。
    /// </summary>
    internal static class EmbeddedUpgradePackageInstaller
    {
        internal static async Task<object> RunAsync(
            string packageContent,
            Func<string, Task<object>> execute,
            Func<JObject, Task<DosResult<object>>> saveSchedule,
            Action verifyLease)
        {
            var package = JObject.Parse(packageContent);
            var jobsToken = package["ScheduleJobs"];
            if (jobsToken?.Type == JTokenType.String)
                jobsToken = JToken.Parse(string.IsNullOrWhiteSpace(jobsToken.ToString()) ? "[]" : jobsToken.ToString());
            var jobs = jobsToken as JArray;
            // 无任务包和无效声明仍由原导入器校验，保持既有兼容及失败语义。
            if (jobs == null || jobs.Count == 0) return await execute(null).ConfigureAwait(false);

            verifyLease();
            var resources = await execute("Resources").ConfigureAwait(false);
            if (UpgradeAppStore.GetInstallFailureMessage(resources) != null) return resources;
            var result = resources as JObject ?? JObject.FromObject(resources);
            var state = (result["Data"] as JObject)?["EmbeddedUpgrade"] as JObject;
            if (state?["Stage"]?.ToString() != "ScheduleJobs")
                return new DosResult(0, null, "内置应用导入器未确认资源提交阶段，已拒绝注册定时任务。");

            foreach (var token in jobs)
            {
                verifyLease();
                // 只取已由导入器校验的固定任务字段，禁止包传入租户、DLL、类型或 Id。
                var job = new JObject { ["JobType"] = "1" };
                foreach (var name in new[] { "JobName", "ApiEngineKey", "CronExpression", "JobParam", "JobDesc", "Description", "CronDesc", "TimeZoneId" })
                    if (token[name] != null) job[name] = token[name].DeepClone();
                var saved = await saveSchedule(job).ConfigureAwait(false);
                if (saved == null || saved.Code != 1)
                    return new DosResult(0, null, "内置应用任务注册失败：" + job["JobName"] + "，" + (saved?.Msg ?? "无返回"));
            }

            verifyLease();
            // 每次 execute 都是独立的 ApiEngine 调用，上一阶段事务已返回并提交。
            // 只有 Quartz 和元数据都回读成功后，最终调用才写安装版本。
            return await execute("Finalize").ConfigureAwait(false);
        }
    }
}

using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>定时任务保存与运行态回读的通用原子，供 V8 与 MCP 共同调用，保持事务所有权不变。</summary>
    public static class ScheduleJobService
    {
        public static async Task<DosResult<object>> SaveAsync(string osClient, JObject param, bool persistMetadata = true)
        {
            try
            {
                var jobName = param["JobName"].Val<string>();
                var cronExpression = param["CronExpression"].Val<string>();
                var jobType = param["JobType"].Val<string>() ?? "1";
                if (jobName.DosIsNullOrWhiteSpace()) return new DosResult<object>(0, null, "JobName 不能为空");
                if (cronExpression.DosIsNullOrWhiteSpace()) return new DosResult<object>(0, null, "CronExpression 不能为空");

                var id = param["JobId"].Val<string>() ?? param["Id"].Val<string>();
                // 表单提交事件已经持有当前行事务，不能另开连接查询/写回当前表。
                // 普通 MCP/商城调用仍负责元数据持久化，保持原有幂等保存语义。
                if (persistMetadata && id.DosIsNullOrWhiteSpace())
                {
                    var existing = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>("diy_schedule_job", new
                    {
                        OsClient = osClient,
                        _Where = new List<object>() { new List<object>() { "JobName", "=", jobName } }
                    });
                    if (existing.Code == 1 && existing.Data != null) id = (string)existing.Data.Id;
                }
                if (id.DosIsNullOrWhiteSpace()) id = Ulid.NewUlid().ToString();

                var model = new MicroiAddJobModel
                {
                    Id = id,
                    JobName = jobName,
                    DllName = param["DllName"].Val<string>() ?? "",
                    JobPath = param["JobPath"].Val<string>() ?? "",
                    JobDesc = param["JobDesc"].Val<string>() ?? param["Description"].Val<string>() ?? "",
                    JobParam = param["JobParam"].Val<string>() ?? "",
                    CronDesc = param["CronDesc"].Val<string>() ?? "",
                    CronExpression = cronExpression,
                    TimeZoneId = param["TimeZoneId"].Val<string>() ?? "",
                    JobType = jobType,
                    ApiEngineKey = param["ApiEngineKey"].Val<string>() ?? "",
                    OsClient = osClient
                };

                var quartzExisting = await MicroiEngine.Job.GetJobDetail(
                    new MicroiSearchJobModel
                    {
                        Name = jobName,
                        OsClient = osClient
                    });
                var result = quartzExisting.Code == 1
                    ? await MicroiEngine.Job.UpdateJob(model)
                    : await MicroiEngine.Job.AddJob(model);
                // 两个管理节点可能同时判断任务不存在。共享 Quartz JobStore 会
                // 保证只有一个 Add 成功；另一个节点在看到“已存在”后转为更新，
                // 让 MCP 创建/更新保持幂等而不是把竞态暴露为失败。
                if (result.Code != 1
                    && ((result.Msg ?? "").IndexOf("已存在", StringComparison.OrdinalIgnoreCase) >= 0
                        || (result.Msg ?? "").IndexOf("already exists", StringComparison.OrdinalIgnoreCase) >= 0))
                {
                    result = await MicroiEngine.Job.UpdateJob(model);
                }
                if (result.Code != 1) return new DosResult<object>(result.Code, result.Data, result.Msg);

                var quartzReadback = await MicroiEngine.Job.GetJobDetail(
                    new MicroiSearchJobModel
                    {
                        Name = jobName,
                        OsClient = osClient
                    });
                if (quartzReadback.Code != 1 || quartzReadback.Data == null)
                {
                    return new DosResult<object>(
                        0,
                        new { JobId = id, JobName = jobName, QuartzSaved = true },
                        "Quartz 已保存任务，但运行态回读失败；请先回读后再决定是否重试。");
                }

                var runtime = JObject.FromObject(quartzReadback.Data);
                if (!persistMetadata)
                {
                    return new DosResult<object>(1, new
                    {
                        JobId = id,
                        JobName = jobName,
                        QuartzSaved = true,
                        MetadataSaved = false,
                        Status = runtime["Status"]?.ToString() ?? "正常",
                        LastTime = runtime["LastTime"]?.ToString() ?? "",
                        NextTime = runtime["NextTime"]?.ToString() ?? "",
                        Message = "调度运行态已回读；任务元数据由调用方表单事务保存。"
                    });
                }
                var jobData = new JObject
                {
                    ["Id"] = id,
                    ["OsClient"] = osClient,
                    ["_InvokeType"] = "Server",
                    ["JobName"] = jobName,
                    ["DllName"] = model.DllName ?? "",
                    ["JobPath"] = model.JobPath ?? "",
                    ["JobDesc"] = model.JobDesc ?? "",
                    ["Description"] = model.JobDesc ?? "",
                    ["JobParam"] = model.JobParam ?? "",
                    ["CronDesc"] = model.CronDesc ?? "",
                    ["CronExpression"] = model.CronExpression ?? "",
                    ["JobType"] = model.JobType ?? "1",
                    ["ApiEngineKey"] = model.ApiEngineKey ?? "",
                    ["Status"] = runtime["Status"]?.DeepClone() ?? "正常",
                    ["LastTime"] = runtime["LastTime"]?.DeepClone() ?? "",
                    ["NextTime"] = runtime["NextTime"]?.DeepClone() ?? ""
                };
                var persistResult = await PlatformMetadataUpsertService.SaveAsync(
                    osClient,
                    "diy_schedule_job",
                    jobData,
                    "JobName",
                    "定时任务");
                if (persistResult.Code != 1)
                {
                    return new DosResult<object>(
                        0,
                        new
                        {
                            JobId = id,
                            JobName = jobName,
                            QuartzSaved = true,
                            MetadataSaved = false
                        },
                        "Quartz 已保存任务，但 diy_schedule_job 持久化失败：" + persistResult.Msg);
                }
                return new DosResult<object>(1, new
                {
                    JobId = id,
                    JobName = jobName,
                    QuartzSaved = true,
                    MetadataSaved = true,
                    Status = jobData["Status"]?.ToString(),
                    LastTime = jobData["LastTime"]?.ToString(),
                    NextTime = jobData["NextTime"]?.ToString(),
                    Message = "定时任务已保存并完成 Quartz/数据库双回读"
                });
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, "保存定时任务失败：" + ex.Message);
            }
        }
    }
}

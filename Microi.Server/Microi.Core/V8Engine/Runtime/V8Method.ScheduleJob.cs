using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        public DosResult ManageScheduleJob(dynamic dynamicParam)
        {
            var denied = RequireCurrentTenantSuperAdmin(
                out var osClient,
                out _,
                "定时任务治理能力");
            if (denied != null) return denied;

            try
            {
                var request = ToJObject((object)dynamicParam);
                var action = GetJsonString(request, "Action").Trim();
                switch (action.ToLowerInvariant())
                {
                    case "capabilities":
                        // 老节点会对未知动作返回失败，接口引擎据此在产生调度副作用前提示升级。
                        return new DosResult(1, new { RuntimeOnly = true });
                    case "getbynames":
                    {
                        var names = (request["Names"] as JArray ?? new JArray())
                            .Select(item => item?.ToString()?.Trim())
                            .Where(item => !item.DosIsNullOrWhiteSpace())
                            .Distinct(StringComparer.OrdinalIgnoreCase)
                            .Take(500)
                            .ToList();
                        var result = MicroiEngine.Job.GetJobByName(names, osClient)
                            .ConfigureAwait(false).GetAwaiter().GetResult();
                        return ToScheduleJobDosResult(result, "读取任务调度运行态没有返回结果。");
                    }
                    case "getdetail":
                    {
                        var name = GetJsonString(request, "JobName", "Name").Trim();
                        if (name.DosIsNullOrWhiteSpace()) return new DosResult(0, null, "JobName不能为空。");
                        var result = MicroiEngine.Job.GetJobDetail(new MicroiSearchJobModel
                        {
                            Name = name,
                            OsClient = osClient
                        }).ConfigureAwait(false).GetAwaiter().GetResult();
                        return ToScheduleJobDosResult(result, "读取任务调度详情没有返回结果。");
                    }
                    case "pause":
                    case "resume":
                    case "delete":
                    {
                        var name = GetJsonString(request, "JobName", "Name").Trim();
                        if (name.DosIsNullOrWhiteSpace()) return new DosResult(0, null, "JobName不能为空。");
                        var model = new MicroiJobModel
                        {
                            Id = GetJsonString(request, "Id"),
                            JobName = name,
                            OsClient = osClient
                        };
                        MicroiJobResult result;
                        if (string.Equals(action, "pause", StringComparison.OrdinalIgnoreCase))
                            result = MicroiEngine.Job.PauseJob(model).ConfigureAwait(false).GetAwaiter().GetResult();
                        else if (string.Equals(action, "resume", StringComparison.OrdinalIgnoreCase))
                            result = MicroiEngine.Job.ResumeJob(model).ConfigureAwait(false).GetAwaiter().GetResult();
                        else
                            result = MicroiEngine.Job.DeleteJob(model).ConfigureAwait(false).GetAwaiter().GetResult();
                        return ToScheduleJobDosResult(result, "任务调度操作没有返回结果。");
                    }
                    default:
                        return new DosResult(0, null, "不支持的任务调度运行态动作。");
                }
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "任务调度运行态操作失败：" + ex.Message);
            }
        }

        private static DosResult ToScheduleJobDosResult(MicroiJobResult result, string emptyMessage)
        {
            if (result == null) return new DosResult(0, null, emptyMessage);
            return new DosResult(result.Code, result.Data, result.Msg)
            {
                DataAppend = result.DataAppend,
                DataCount = result.DataCount
            };
        }

        /// <summary>
        /// 为应用商城安装器和可信接口引擎提供最小的任务调度原子能力。
        /// 这里只允许当前租户的接口引擎任务，不开放自定义 DLL/类型加载；
        /// 具体资源选择、升级策略和安装编排继续由接口引擎负责。
        /// </summary>
        public DosResult SaveScheduleJob(dynamic dynamicParam)
        {
            var denied = RequireCurrentTenantSuperAdmin(
                out var osClient,
                out _,
                "定时任务治理能力");
            if (denied != null) return denied;

            try
            {
                var request = ToJObject((object)dynamicParam);
                var jobName = GetJsonString(request, "JobName").Trim();
                var apiEngineKey = GetJsonString(request, "ApiEngineKey").Trim();
                var cronExpression = GetJsonString(request, "CronExpression").Trim();
                var jobParam = GetJsonString(request, "JobParam");
                var jobDesc = GetJsonString(request, "JobDesc", "Description");
                var cronDesc = GetJsonString(request, "CronDesc");
                var timeZoneId = GetJsonString(request, "TimeZoneId");

                if (!Regex.IsMatch(jobName, "^[A-Za-z][A-Za-z0-9_.-]{0,99}$"))
                    return new DosResult(0, null, "JobName 只允许 1-100 位英文、数字、点、下划线或短横线，且必须以英文字母开头。");
                if (!Regex.IsMatch(apiEngineKey, "^[A-Za-z][A-Za-z0-9_.-]{0,127}$"))
                    return new DosResult(0, null, "ApiEngineKey 格式不合法。");
                if (cronExpression.DosIsNullOrWhiteSpace() || cronExpression.Length > 200)
                    return new DosResult(0, null, "CronExpression 不能为空且最多 200 个字符。");
                if (jobParam.Length > 16384 || jobDesc.Length > 500 || cronDesc.Length > 500 || timeZoneId.Length > 100)
                    return new DosResult(0, null, "定时任务参数或说明超过安全长度限制。");

                var engine = MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(
                    "sys_apiengine",
                    new
                    {
                        OsClient = osClient,
                        _Where = new System.Collections.Generic.List<object>
                        {
                            new System.Collections.Generic.List<object> { "ApiEngineKey", "=", apiEngineKey }
                        },
                        _SelectFields = new[] { "Id", "ApiEngineKey" }
                    }).ConfigureAwait(false).GetAwaiter().GetResult();
                if (engine == null || engine.Code != 1 || engine.Data == null)
                    return new DosResult(0, null, "定时任务引用的接口引擎不存在于当前租户：" + apiEngineKey);

                // 不信任调用方提供的租户、DLL 或 JobType，固定为当前租户接口引擎任务。
                request["OsClient"] = osClient;
                request["JobName"] = jobName;
                request["ApiEngineKey"] = apiEngineKey;
                request["CronExpression"] = cronExpression;
                request["JobParam"] = jobParam;
                request["JobDesc"] = jobDesc;
                request["CronDesc"] = cronDesc;
                request["TimeZoneId"] = timeZoneId;
                // Microi.net 是调度插件的上游项目，不能反向引用 Microi.Job；
                // 协议值 1 由 MicroiAddJobModel 定义为接口引擎任务。
                request["JobType"] = "1";
                request.Remove("DllName");
                request.Remove("JobPath");

                // RuntimeOnly 仅切换元数据的事务所有者，不放宽管理员/租户/接口类型校验。
                // 表单事件只同步 Quartz，避免在提交前另开事务再次写当前任务行。
                var runtimeOnly = request["RuntimeOnly"]?.Type == JTokenType.Boolean
                    && request["RuntimeOnly"].Value<bool>();
                var result = V8McpLogic.SaveJob(osClient, request, persistMetadata: !runtimeOnly)
                    .ConfigureAwait(false).GetAwaiter().GetResult();
                return result == null
                    ? new DosResult(0, null, "保存定时任务没有返回结果。")
                    : new DosResult(result.Code, result.Data, result.Msg);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "保存定时任务失败：" + ex.Message);
            }
        }
    }
}

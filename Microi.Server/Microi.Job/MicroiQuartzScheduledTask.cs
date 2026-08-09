using Quartz;
using Quartz.Impl.Matchers;
using Quartz.Impl;
using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Reflection;
using static Quartz.Logging.OperationName;
using Quartz.Util;
using Newtonsoft.Json;
using System.Text.RegularExpressions;
using static System.Collections.Specialized.BitVector32;
using System.IO;
using System.Security.Cryptography;
using EnumsNET;
using System.Threading;
using Dos.Common;
using Microi.net;

namespace Microi.net
{
    public class MicroiQuartzScheduledTask : IMicroiJob
    {
        private IScheduler _scheduler;
        private ISchedulerFactory _schedulerFactory;

        // 添加一个标志表示是否已初始化
        private bool _isInitialized = false;
        
        // 使用 SemaphoreSlim 替代 lock，支持异步等待
        private readonly SemaphoreSlim _initLock = new SemaphoreSlim(1, 1);
        
        // 用于优雅关闭后台任务
        private CancellationTokenSource _cts = new CancellationTokenSource();

        private const string LegacyGroup = "default_group";

        private static string NormalizeJobTenant(string osClient)
        {
            return (osClient.IsNullOrWhiteSpace() ? OsClientDefault.OsClient : osClient).Trim().ToLowerInvariant();
        }

        /// <summary>
        /// Quartz 的 Name + Group 是全平台唯一键。历史实现把全部租户放进
        /// default_group，导致不同租户安装同名应用任务时互相覆盖。新组名同时
        /// 包含可读租户片段与稳定摘要，既隔离租户，也避免超长或特殊字符。
        /// </summary>
        private static string GetTenantGroup(string osClient)
        {
            var tenant = NormalizeJobTenant(osClient);
            var readable = Regex.Replace(tenant, "[^a-z0-9_-]", "_");
            if (readable.Length > 32) readable = readable.Substring(0, 32);
            if (readable.IsNullOrWhiteSpace()) readable = "tenant";
            using var sha256 = SHA256.Create();
            var hash = BitConverter.ToString(sha256.ComputeHash(Encoding.UTF8.GetBytes(tenant)))
                .Replace("-", "")
                .Substring(0, 16)
                .ToLowerInvariant();
            return $"{LegacyGroup}.{readable}.{hash}";
        }

        private static bool JobBelongsToTenant(IJobDetail job, string osClient)
        {
            if (job == null) return false;
            var actual = job.JobDataMap.ContainsKey(MicroiJobConst.OsClient)
                ? job.JobDataMap.GetString(MicroiJobConst.OsClient)
                : OsClientDefault.OsClient;
            return string.Equals(
                NormalizeJobTenant(actual),
                NormalizeJobTenant(osClient),
                StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// 优先读取新租户组；仅当历史 default_group 中的 JobDataMap.OsClient
        /// 与当前租户一致时才兼容旧任务，杜绝跨租户同名误命中。
        /// </summary>
        private async Task<JobKey> ResolveJobKey(string jobName, string osClient)
        {
            var tenantKey = new JobKey(jobName, GetTenantGroup(osClient));
            if (await _scheduler.CheckExists(tenantKey)) return tenantKey;

            var legacyKey = new JobKey(jobName, LegacyGroup);
            var legacyJob = await _scheduler.GetJobDetail(legacyKey);
            return JobBelongsToTenant(legacyJob, osClient) ? legacyKey : tenantKey;
        }
        private static void WriteJobLog(string osClient, string action, string title, string content, int level = 2, string targetId = null, bool? success = false)
        {
            MicroiEngine.QueueSystemLog(osClient, "Job", action, title, content, level, success, targetId);
        }

        public MicroiQuartzScheduledTask(ISchedulerFactory schedulerFactory)
        {
            _schedulerFactory = schedulerFactory;
            // 2026-01-03：不在这里立即创建scheduler --延迟启动未实验成功
            _scheduler = schedulerFactory.GetScheduler().GetAwaiter().GetResult();
        }
        /// <summary>
        /// 延迟初始化 Scheduler，在 OsClient 可用后调用
        /// </summary>
        public async Task InitializeAsync(string connectionString)
        {
            if (_isInitialized)
                return;
            
            // 使用 SemaphoreSlim 替代 lock，避免在锁内部使用同步等待
            await _initLock.WaitAsync();
            try
            {
                if (_isInitialized)
                    return;
                try
                {
                    // 获取原始的 Scheduler
                    _scheduler = await _schedulerFactory.GetScheduler();
                    // 停止原始 Scheduler
                    if (_scheduler.IsStarted)
                    {
                        await _scheduler.Shutdown(false);
                    }

                    // 重新配置 SchedulerFactory 使用正确的连接字符串
                    var properties = new NameValueCollection
                    {
                        // 基本配置
                        ["quartz.scheduler.instanceName"] = "MicroiJobScheduler",
                        ["quartz.scheduler.instanceId"] = "AUTO",

                        // 线程池
                        ["quartz.threadPool.type"] = "Quartz.Simpl.SimpleThreadPool, Quartz",
                        ["quartz.threadPool.threadCount"] = "10",

                        // 作业存储 - 必须配置
                        ["quartz.jobStore.type"] = "Quartz.Impl.AdoJobStore.JobStoreTX, Quartz",
                        ["quartz.jobStore.driverDelegateType"] = "Quartz.Impl.AdoJobStore.MySQLDelegate, Quartz",
                        ["quartz.jobStore.tablePrefix"] = "microi_job_",
                        ["quartz.jobStore.dataSource"] = "default",
                        ["quartz.jobStore.useProperties"] = "false", // 改为 false 可能更稳定
                        ["quartz.jobStore.performSchemaValidation"] = "false",

                        // 序列化 - 必须配置！
                        ["quartz.serializer.type"] = "json",

                        // 数据源
                        ["quartz.dataSource.default.connectionString"] = connectionString,
                        ["quartz.dataSource.default.provider"] = "MySql"
                    };

                    // 创建新的 SchedulerFactory
                    var newFactory = new StdSchedulerFactory(properties);
                    _scheduler = await newFactory.GetScheduler();

                    // 添加监听器
                    _scheduler.ListenerManager.AddJobListener(new MicroiJobListener());

                    // 启动新的 Scheduler
                    await _scheduler.Start();
                    _isInitialized = true;
                    WriteJobLog(OsClientDefault.OsClient, "SchedulerStarted", "分布式任务调度 Scheduler 启动成功", null, 1, success: true);
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：【❌Error】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】【分布式任务调度】 Scheduler 启动失败：{ex.Message}");
                }
            }
            finally
            {
                _initLock.Release();
            }
        }

        /// <summary>
        /// 确保 Scheduler 已初始化
        /// </summary>
        private void EnsureInitialized()
        {
            if (!_isInitialized)
            {
                WriteJobLog(OsClientDefault.OsClient, "SchedulerNotInitialized", "任务调度器尚未初始化", "Scheduler 未初始化，请先调用 InitializeAsync 方法。", 2);
            }
        }
        /// <summary>
        /// 获取所有job信息
        /// </summary>
        /// <param name="jobModel"></param>
        public async Task<MicroiJobResult> GetAllJob(MicroiSearchJobModel jobModel)
        {
            try
            {
                List<JobDetailImpl> allJobList = new List<JobDetailImpl>();
                List<MicroiJobModel> jobs = new List<MicroiJobModel>();

                //第一步：获取所有的job信息
                var jobKeySet = await _scheduler.GetJobKeys(GroupMatcher<JobKey>.AnyGroup());
                foreach (var jobKey in jobKeySet)
                {
                    var jobDetail = await _scheduler.GetJobDetail(jobKey);
                    if (jobDetail != null)
                    {
                        allJobList.Add((JobDetailImpl)jobDetail);
                    }
                }
                var tenantJobs = allJobList
                    .Where(x => JobBelongsToTenant(x, jobModel?.OsClient))
                    .ToList();
                List<JobDetailImpl> jobList = null;
                if (!string.IsNullOrEmpty(jobModel._Key))
                {
                    jobList = tenantJobs.Where(x => x.Name.Contains(jobModel._Key))
                                        .OrderBy(c => c.Group)
                                        .Skip((jobModel._PageIndex - 1) * jobModel._PageSize)
                                        .Take(jobModel._PageSize).ToList();
                }
                else
                {
                    jobList = tenantJobs.OrderBy(c => c.Group).Skip((jobModel._PageIndex - 1) * jobModel._PageSize).Take(jobModel._PageSize).ToList();
                }
                foreach (JobDetailImpl job in jobList)
                {
                    var model = await PackageJob(job);
                    jobs.Add(model);
                }
                ;
                return new MicroiJobResult()
                {
                    Code = 1,
                    Data = jobs,
                    DataCount = tenantJobs.Count
                };
            }
            catch (Exception ex)
            {
                WriteJobLog(jobModel?.OsClient, "QueryJobsFailed", "获取全部定时任务失败", ex.ToString(), 2);
                return new MicroiJobResult()
                {
                    Code = 0,
                    DataCount = 0
                };
            }
        }

        public async Task<MicroiJobResult> GetJobByName(List<string> jobNameArr, string osClient = null)
        {
            try
            {
                List<MicroiJobModel> jobs = new List<MicroiJobModel>();
                var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var jobName in jobNameArr ?? new List<string>())
                {
                    if (jobName.IsNullOrWhiteSpace() || !seen.Add(jobName)) continue;
                    var jobKey = await ResolveJobKey(jobName, osClient);
                    var job = await _scheduler.GetJobDetail(jobKey);
                    if (job != null && JobBelongsToTenant(job, osClient))
                        jobs.Add(await PackageJob((JobDetailImpl)job));
                }
                return new MicroiJobResult()
                {
                    Code = 1,
                    Data = jobs,
                    DataCount = jobs.Count
                };
            }
            catch (Exception ex)
            {
                WriteJobLog(osClient, "QueryJobsByNamesFailed", "按名称获取定时任务失败", ex.ToString(), 2);
                return new MicroiJobResult()
                {
                    Code = 0,
                    DataCount = 0
                };
            }
        }

        public async Task<MicroiJobResult> GetJobDetail(MicroiSearchJobModel jobModel)
        {
            try
            {
                var jobKey = await ResolveJobKey(jobModel.Name, jobModel?.OsClient);
                var jobDetail = await _scheduler.GetJobDetail(jobKey);
                if (jobDetail == null)
                {
                    return new MicroiJobResult(0, "job不存在：" + jobModel.Name);
                }
                JobDetailImpl jobDetailImpl = (JobDetailImpl)jobDetail;
                var result = await PackageJob(jobDetailImpl);
                return new MicroiJobResult()
                {
                    Code = 1,
                    Data = result,
                    DataCount = 1
                };
            }
            catch (Exception ex)
            {
                WriteJobLog(jobModel?.OsClient, "QueryJobFailed", "获取定时任务详情失败", ex.ToString(), 2, jobModel?.Name);
                return new MicroiJobResult()
                {
                    Code = 0,
                    DataCount = 0
                };
            }
        }

        /// <summary>
        /// 新增job
        /// </summary>
        /// <param name="addJobModel"></param>
        /// <returns></returns>
        public async Task<MicroiJobResult> AddJob(MicroiAddJobModel addJobModel)
        {
            try
            {
                #region 参数校验

                if (addJobModel.JobType.Equals(MicroiJobConst.JobTypeApiEngineKey))
                {
                    if (addJobModel.ApiEngineKey.IsNullOrWhiteSpace())
                    {
                        return new MicroiJobResult(0, "接口引擎key不能为空");
                    }
                }
                else if ((addJobModel.JobType.Equals(MicroiJobConst.JobTypeDevelopment)))
                {
                    if (addJobModel.DllName.IsNullOrWhiteSpace() || addJobModel.JobPath.IsNullOrWhiteSpace())
                    {
                        return new MicroiJobResult(0, "jobdll、job路径不能为空");
                    }
                }
                else
                {
                    return new MicroiJobResult(0, "任务类型不对");
                }
                if (!CronExpression.IsValidExpression(addJobModel.CronExpression))
                {
                    return new MicroiJobResult(0, "无效的cron表达式");
                }
                var jobKey = await ResolveJobKey(addJobModel.JobName, addJobModel.OsClient);
                if (await _scheduler.CheckExists(jobKey))
                {
                    return new MicroiJobResult(0, "job已存在");
                }

                #endregion 参数校验

                #region 新增job

                Dictionary<string, string> dic = new Dictionary<string, string>();
                dic.Add(MicroiJobConst.Id, addJobModel.JobName);
                dic.Add(MicroiJobConst.JobType, addJobModel.JobType);
                // SaaS多租户：存储OsClient到JobDataMap，任务执行时据此确定租户上下文
                dic.Add(MicroiJobConst.OsClient, addJobModel.OsClient.IsNullOrWhiteSpace() ? OsClientDefault.OsClient : addJobModel.OsClient);
                if (!String.IsNullOrEmpty(addJobModel.JobParam))
                {
                    dic.Add(MicroiJobConst.JobParam, addJobModel.JobParam);
                }
                if (!String.IsNullOrWhiteSpace(addJobModel.TimeZoneId))
                {
                    dic.Add(MicroiJobConst.TimeZoneId, addJobModel.TimeZoneId);
                }
                if (addJobModel.JobType.Equals(MicroiJobConst.JobTypeApiEngineKey))
                {
                    dic.Add(MicroiJobConst.ApiEngineKey, addJobModel.ApiEngineKey);
                }
                JobDataMap jobDataMap = new JobDataMap(dic);
                string dllName = addJobModel.DllName;
                string jobPath = addJobModel.JobPath;
                if (addJobModel.JobType.Equals(MicroiJobConst.JobTypeApiEngineKey))
                {
                    dllName = MicroiJobConst.DLL;
                    jobPath = MicroiJobConst.JobPath;
                }
                //2024-11-11：.net6升级到.net8后，此代码已不可用 --by anderson修改
                // string saveFilePath = $"{Directory.GetCurrentDirectory()}\\{dllName}";
                string saveFilePath2 = $"{Directory.GetCurrentDirectory()}/{(System.Diagnostics.Debugger.IsAttached ? ConfigHelper.GetAppSettings("DebuggerFolder").DosTrimStart('/').DosTrimEnd('/') : "")}/{dllName}";

                var saveFilePath = Path.Combine(AppContext.BaseDirectory, dllName);

                Assembly assembly = Assembly.LoadFrom(saveFilePath);
                var tenantGroup = GetTenantGroup(addJobModel.OsClient);
                var tenantJobKey = new JobKey(addJobModel.JobName, tenantGroup);
                var job = JobBuilder.Create(assembly.GetType(jobPath))
                                  .StoreDurably(true)
                                  .WithIdentity(tenantJobKey)
                                  .WithDescription(addJobModel.JobDesc)
                                  .UsingJobData(jobDataMap)
                                  .Build();
                ITrigger trigger = TriggerBuilder.Create().ForJob(job)
                                            .WithIdentity(addJobModel.JobName, tenantGroup)
                                            .WithCronSchedule(
                                                addJobModel.CronExpression,
                                                schedule => schedule.InTimeZone(ResolveTimeZone(addJobModel.TimeZoneId)))
                                            .WithDescription(addJobModel.CronDesc)
                                            .Build();
                // 单次 Quartz Store 事务同时写 Job 与 Trigger，避免第二步冲突后
                // 留下“Job 已存在但 Trigger 缺失”的半完成运行态。
                await _scheduler.ScheduleJob(job, trigger);

                #endregion 新增触发器

                // 保存job到diy_schedule_job表中，待实现
                return new MicroiJobResult(1, "成功");
            }
            catch (Exception ex)
            {
                return new MicroiJobResult(0, "新增job异常：" + ex.Message);
            }
        }

        /// <summary>
        /// 暂停job
        /// </summary>
        /// <param name="job"></param>
        /// <returns></returns>
        public async Task<MicroiJobResult> PauseJob(MicroiJobModel job)
        {
            try
            {
                var resolvedKey = await ResolveJobKey(job.JobName, job.OsClient);
                var jobDetail = await _scheduler.GetJobDetail(resolvedKey);
                if (jobDetail == null)
                {
                    return new MicroiJobResult(0, "job不存在");
                }
                JobDetailImpl jobDetailImpl = (JobDetailImpl)jobDetail;
                JobKey jobKey = jobDetailImpl.Key;
                await _scheduler.PauseJob(jobKey);
                return new MicroiJobResult(1, "成功");
            }
            catch (Exception ex)
            {
                return new MicroiJobResult(0, "暂停job异常：" + ex.Message);
            }
        }

        /// <summary>
        /// 恢复job
        /// </summary>
        /// <param name="job"></param>
        /// <returns></returns>
        public async Task<MicroiJobResult> ResumeJob(MicroiJobModel job)
        {
            try
            {
                var resolvedKey = await ResolveJobKey(job.JobName, job.OsClient);
                var jobDetail = await _scheduler.GetJobDetail(resolvedKey);
                if (jobDetail == null)
                {
                    return new MicroiJobResult(0, "job不存在");
                }
                JobDetailImpl jobDetailImpl = (JobDetailImpl)jobDetail;
                JobKey jobKey = jobDetailImpl.Key;
                await _scheduler.ResumeJob(jobKey);
                return new MicroiJobResult(1, "成功");
            }
            catch (Exception ex)
            {
                return new MicroiJobResult(0, "恢复job异常：" + ex.Message);
            }
        }

        /// <summary>
        /// 删除job
        /// </summary>
        /// <param name="job"></param>
        /// <returns></returns>
        public async Task<MicroiJobResult> DeleteJob(MicroiJobModel job)
        {
            try
            {
                var resolvedKey = await ResolveJobKey(job.JobName, job.OsClient);
                var jobDetail = await _scheduler.GetJobDetail(resolvedKey);
                if (jobDetail == null)
                {
                    return new MicroiJobResult(0, "job不存在");
                }
                JobDetailImpl jobDetailImpl = (JobDetailImpl)jobDetail;
                JobKey jobKey = jobDetailImpl.Key;
                await _scheduler.DeleteJob(jobKey);
                return new MicroiJobResult(1, "成功");
            }
            catch (Exception ex)
            {
                return new MicroiJobResult(0, "删除job异常：" + ex.Message);
            }
        }

        ///// <summary>
        ///// 启动job
        ///// </summary>
        ///// <param name="job"></param>
        ///// <returns></returns>
        //public async Task<JobResult> StartJob(JobModel job)
        //{
        //    try
        //    {
        //        var jobDetail = await _scheduler.GetJobDetail(new JobKey(job.Id, group));
        //        if (jobDetail == null)
        //        {
        //            return new JobResult(0, "job不存在");
        //        }
        //        JobDetailImpl jobDetailImpl = (JobDetailImpl)jobDetail;
        //        JobKey jobKey = new JobKey(jobDetailImpl.Name, group);
        //        // 依据id去diy_schedule_job表中获取任务名称，待实现
        //        var IsExist = await _scheduler.CheckExists(jobKey);
        //        if (IsExist)
        //        {
        //            await _scheduler.TriggerJob(jobKey);
        //        }
        //        return new JobResult(1, "成功");
        //    }
        //    catch (Exception ex)
        //    {
        //        return new JobResult(0, ex.Message);
        //    }

        //}

        ///// <summary>
        ///// 设置trigger
        ///// </summary>
        ///// <param name="triggerDataModel"></param>
        ///// <returns></returns>
        //public async Task<JobResult> AddTrigger(AddTriggerModel triggerDataModel)
        //{
        //    try
        //    {
        //        if (triggerDataModel.Cron.IsNullOrWhiteSpace() || triggerDataModel.JobName.IsNullOrWhiteSpace())
        //        {
        //            return new JobResult(0, "cron表达式和job名称不能为空");
        //        }
        //        if (!CronExpression.IsValidExpression(triggerDataModel.Cron))
        //        {
        //            return new JobResult(0, "无效的cron表达式");
        //        }
        //        string action = "add";
        //        var job = await _scheduler.GetJobDetail(new JobKey(triggerDataModel.JobName, group));
        //        if(job == null)
        //        {
        //            return new JobResult(0, "job不存在");
        //        }
        //        var triggerModel = await _scheduler.GetTriggersOfJob(new JobKey(triggerDataModel.JobName, group));
        //        if (triggerModel != null)
        //            action = "edit";

        //        ITrigger trigger = TriggerBuilder.Create().ForJob(job)
        //                                      .WithIdentity(triggerDataModel.JobName, group)
        //                                      .WithCronSchedule(triggerDataModel.Cron)
        //                                      .WithDescription(triggerDataModel.CronDesc)
        //                                      .Build();
        //        if (action.Equals("add"))
        //        {
        //            await _scheduler.ScheduleJob(trigger);
        //        }
        //        else
        //        {
        //            await _scheduler.RescheduleJob(new TriggerKey(triggerDataModel.JobName, group), trigger);
        //        }
        //        return new JobResult(1,"成功");

        //    }
        //    catch (Exception ex)
        //    {
        //        return new JobResult(0, ex.Message);
        //    }
        //}

        /// <summary>
        /// 修改job触发器
        /// </summary>
        /// <param name="addJobModel"></param>
        /// <returns></returns>
        public async Task<MicroiJobResult> UpdateJob(MicroiAddJobModel addJobModel)
        {
            try
            {
                if (!CronExpression.IsValidExpression(addJobModel.CronExpression))
                {
                    return new MicroiJobResult(0, "无效的cron表达式");
                }
                var resolvedKey = await ResolveJobKey(addJobModel.JobName, addJobModel.OsClient);
                var job = await _scheduler.GetJobDetail(resolvedKey);
                if (job == null)
                {
                    return new MicroiJobResult(0, "job不存在");
                }

                // UpdateJob historically changed only the trigger. That left the
                // old JobParam/ApiEngineKey/OsClient in the durable Quartz row, so
                // edited backup scope and retention settings never reached the
                // next execution. Replace the durable job data atomically before
                // rescheduling the trigger.
                job.JobDataMap[MicroiJobConst.Id] = addJobModel.JobName;
                job.JobDataMap[MicroiJobConst.JobType] = addJobModel.JobType ?? "";
                job.JobDataMap[MicroiJobConst.OsClient] = addJobModel.OsClient.IsNullOrWhiteSpace()
                    ? OsClientDefault.OsClient
                    : addJobModel.OsClient;
                job.JobDataMap[MicroiJobConst.JobParam] = addJobModel.JobParam ?? "";
                var timeZoneId = addJobModel.TimeZoneId;
                if (timeZoneId.IsNullOrWhiteSpace()
                    && job.JobDataMap.ContainsKey(MicroiJobConst.TimeZoneId))
                {
                    timeZoneId = job.JobDataMap.GetString(MicroiJobConst.TimeZoneId);
                }
                job.JobDataMap[MicroiJobConst.TimeZoneId] = timeZoneId ?? "";
                if (addJobModel.JobType == MicroiJobConst.JobTypeApiEngineKey)
                {
                    job.JobDataMap[MicroiJobConst.ApiEngineKey] = addJobModel.ApiEngineKey ?? "";
                }
                await _scheduler.AddJob(job, true);

                // 获取任务的当前状态
                var jobKey = job.Key;
                var triggers = await _scheduler.GetTriggersOfJob(jobKey);

                // 检查是否有触发器处于暂停状态
                var isPaused = triggers.Any(t =>
                {
                    var triggerState = _scheduler.GetTriggerState(t.Key).GetAwaiter().GetResult(); // 获取触发器状态
                    return triggerState == TriggerState.Paused;
                });

                var existingTrigger = triggers.FirstOrDefault();
                var triggerKey = existingTrigger?.Key
                    ?? new TriggerKey(addJobModel.JobName, jobKey.Group);
                ITrigger trigger = TriggerBuilder.Create().ForJob(job)
                                              .WithIdentity(triggerKey)
                                              .WithCronSchedule(
                                                  addJobModel.CronExpression,
                                                  schedule => schedule.InTimeZone(ResolveTimeZone(timeZoneId)))
                                              .WithDescription(addJobModel.CronDesc)
                                              .Build();

                if (existingTrigger == null)
                    await _scheduler.ScheduleJob(trigger);
                else
                    await _scheduler.RescheduleJob(triggerKey, trigger);

                // 如果任务原本是暂停状态，则手动暂停
                if (isPaused)
                {
                    await _scheduler.PauseJob(jobKey);
                }

                return new MicroiJobResult(1, "成功");
            }
            catch (Exception ex)
            {
                return new MicroiJobResult(0, "修改job异常：" + ex.Message);
            }
        }

        /// <summary>
        /// 获取job当前状态
        /// </summary>
        /// <param name="triggerState"></param>
        /// <returns></returns>
        private string GetTriggerState(TriggerState triggerState)
        {
            switch (triggerState)
            {
                case TriggerState.Normal:
                    return "正常";

                case TriggerState.Complete:
                    return "完成";

                case TriggerState.Blocked:
                    return "阻塞";

                case TriggerState.Error:
                    return "异常";

                case TriggerState.Paused:
                    return "暂停";

                case TriggerState.None:
                    return "不存在";
            }
            return "正常";
        }

        /// <summary>
        /// 组装job数据
        /// </summary>
        /// <param name="job"></param>
        /// <returns></returns>
        private async Task<MicroiJobModel> PackageJob(JobDetailImpl job)
        {
            string jobParamStr = "";

            bool contains = job.JobDataMap.Keys.Contains("JobParam");
            if (contains)
            {
                jobParamStr = job.JobDataMap.GetString(MicroiJobConst.JobParam);
            }
            MicroiJobModel model = new MicroiJobModel()
            {
                JobName = job.Name,
                Group = job.Group,
                JobDesc = job.Description,
                Id = job.JobDataMap.GetString(MicroiJobConst.Id),
                JobParam = jobParamStr,
                Status = "未调度",
                JobType = job.JobDataMap.GetString(MicroiJobConst.JobType),
                TimeZoneId = job.JobDataMap.ContainsKey(MicroiJobConst.TimeZoneId)
                    ? job.JobDataMap.GetString(MicroiJobConst.TimeZoneId)
                    : null,
                OsClient = job.JobDataMap.ContainsKey(MicroiJobConst.OsClient) ? job.JobDataMap.GetString(MicroiJobConst.OsClient) : OsClientDefault.OsClient,
            };
            var triggerModelCollection = await _scheduler.GetTriggersOfJob(new JobKey(job.Name, job.Group));
            if (triggerModelCollection != null && triggerModelCollection.Count > 0)
            {
                var triggerModel = triggerModelCollection.FirstOrDefault();
                TriggerState state = await _scheduler.GetTriggerState(triggerModel.Key);
                Quartz.Impl.Triggers.CronTriggerImpl cronTriggerModel = triggerModel as Quartz.Impl.Triggers.CronTriggerImpl;
                model.TimeZoneId = cronTriggerModel?.TimeZone?.Id ?? model.TimeZoneId;
                model.Status = GetTriggerState(state);
                model.LastTime = triggerModel.GetPreviousFireTimeUtc() == null ? "" : triggerModel.GetPreviousFireTimeUtc().Value.AddHours(8).ToString("yyyy-MM-dd HH:mm:ss");
                model.NextTime = triggerModel.GetNextFireTimeUtc() == null ? "" : triggerModel.GetNextFireTimeUtc().Value.AddHours(8).ToString("yyyy-MM-dd HH:mm:ss");
                model.CronDesc = triggerModel.Description;
                model.CronExpression = cronTriggerModel?.CronExpressionString;
            }
            return model;
        }

        private static TimeZoneInfo ResolveTimeZone(string timeZoneId)
        {
            if (timeZoneId.IsNullOrWhiteSpace()) return TimeZoneInfo.Local;
            var candidates = new List<string> { timeZoneId.Trim() };
            if (string.Equals(timeZoneId, "Asia/Shanghai", StringComparison.OrdinalIgnoreCase))
            {
                candidates.Add("China Standard Time");
            }
            else if (string.Equals(timeZoneId, "China Standard Time", StringComparison.OrdinalIgnoreCase))
            {
                candidates.Add("Asia/Shanghai");
            }
            foreach (var candidate in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
            {
                try { return TimeZoneInfo.FindSystemTimeZoneById(candidate); }
                catch (TimeZoneNotFoundException) { }
                catch (InvalidTimeZoneException) { }
            }
            throw new ArgumentException($"找不到 Quartz 时区：{timeZoneId}");
        }

        public void SyncTaskTime()
        {
            // EnsureInitialized();//--延迟启动未实验成功
            Task.Run(async () =>
            {
                while (!_cts.Token.IsCancellationRequested)
                {
                    try
                    {
                        await Task.Delay(TimeSpan.FromMinutes(1), _cts.Token);
                    }
                    catch (TaskCanceledException)
                    {
                        // 正常取消，退出循环
                        break;
                    }
                    try
                    {
                        // SaaS多租户：遍历所有租户，同步每个租户的定时任务
                        var osClientKeys = OsClientExtend.ClientList.Keys.ToList();
                        foreach (var osClient in osClientKeys)
                        {
                            try
                            {
                                await SyncTenantTaskTime(osClient);
                            }
                            catch (Exception ex)
                            {
                                WriteJobLog(osClient, "TenantScheduleSyncFailed", "租户定时任务同步失败", ex.ToString(), 2);
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        WriteJobLog(OsClientDefault.OsClient, "ScheduleSyncLoopFailed", "任务调度后台同步循环异常", ex.ToString(), 2);
                    }
                }
                WriteJobLog(OsClientDefault.OsClient, "ScheduleSyncStopped", "任务调度后台同步已停止", "后台同步任务已正常停止。", 1, success: true);
            }, _cts.Token);
        }

        /// <summary>
        /// 同步单个租户的定时任务时间
        /// </summary>
        private async Task SyncTenantTaskTime(string osClient)
        {
            // 获取该租户的所有定时任务
            var param = new
            {
                FormEngineKey = MicroiJobConst.dataTable,
                OsClient = osClient,
                _Where = new List<DiyWhere>() {
                    new DiyWhere(){ Name = "Status", Value = "正常", Type = "=" }
                },
            };
            DosResultList<dynamic> result = MicroiEngine.FormEngine.GetTableData(param);
            if (result.Code == 1 && result.Data != null)
            {
                foreach (dynamic data in result.Data)
                {
                    try
                    {
                        MicroiSearchJobModel model = new MicroiSearchJobModel()
                        {
                            Name = data.JobName
                        };
                        var detailResult = GetJobDetail(model).GetAwaiter().GetResult();
                        if (detailResult.Code == 1)
                        {
                            string str = JsonHelper.Serialize(detailResult.Data);
                            MicroiJobModel jobModel = JsonHelper.Deserialize<MicroiJobModel>(str);
                            MicroiEngine.FormEngine.UptFormData(new
                            {
                                FormEngineKey = MicroiJobConst.dataTable,
                                Id = data.Id,
                                _RowModel = new Dictionary<string, string>() {
                                    { "LastTime",jobModel.LastTime},
                                    { "NextTime",jobModel.NextTime}
                                },
                                OsClient = osClient
                            });
                        }
                        else
                        {
                            WriteJobLog(osClient, "ScheduleDetailSyncFailed", "定时任务状态同步失败", detailResult.Msg, 2, Convert.ToString(data.Id));
                        }
                    }
                    catch (Exception ex)
                    {
                        WriteJobLog(osClient, "ScheduleDetailSyncException", "定时任务状态同步异常", ex.ToString(), 2, Convert.ToString(data.Id));
                    }
                }
            }
        }
        
        /// <summary>
        /// 停止后台任务（优雅关闭）
        /// </summary>
        public void Stop()
        {
            try
            {
                _cts.Cancel();
                WriteJobLog(OsClientDefault.OsClient, "SchedulerStopping", "任务调度引擎正在停止", "已发出后台任务取消信号。", 1, success: true);
            }
            catch (Exception ex)
            {
                WriteJobLog(OsClientDefault.OsClient, "SchedulerStopFailed", "任务调度引擎停止失败", ex.ToString(), 3);
            }
        }
    }
}

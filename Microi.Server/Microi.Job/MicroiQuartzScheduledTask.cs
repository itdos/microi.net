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
        private readonly object _lock = new object();

        private const string group = "default_group";
        public MicroiQuartzScheduledTask(ISchedulerFactory schedulerFactory)
        {
            _schedulerFactory = schedulerFactory;
            // 2026-01-03：不在这里立即创建scheduler
            // _scheduler = schedulerFactory.GetScheduler().GetAwaiter().GetResult();
        }
        /// <summary>
        /// 延迟初始化 Scheduler，在 OsClient 可用后调用
        /// </summary>
        public async Task InitializeAsync(string connectionString)
        {
            if (_isInitialized)
                return;
            lock (_lock)
            {
                if (_isInitialized)
                    return;
                try
                {
                    // 获取原始的 Scheduler
                    _scheduler = _schedulerFactory.GetScheduler().GetAwaiter().GetResult();
                    // 停止原始 Scheduler
                    if (_scheduler.IsStarted)
                    {
                        _scheduler.Shutdown(false);
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
                    _scheduler = newFactory.GetScheduler().GetAwaiter().GetResult();

                    // 添加监听器
                    _scheduler.ListenerManager.AddJobListener(new MicroiJobListener());

                    // 启动新的 Scheduler
                    _scheduler.Start().GetAwaiter().GetResult();
                    _isInitialized = true;
                    Console.WriteLine("Microi：【成功】分布式任务调度 Scheduler 初始化成功！");
                }
                catch (Exception ex)
                {
                    Console.WriteLine("Microi：【Error异常】分布式任务调度 Scheduler 初始化失败：" + ex.Message);
                }
            }
        }

        /// <summary>
        /// 确保 Scheduler 已初始化
        /// </summary>
        private void EnsureInitialized()
        {
            if (!_isInitialized)
            {
                Console.WriteLine("Microi：【Error异常】Scheduler 未初始化，请先调用 InitializeAsync 方法");
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
                List<JobDetailImpl> jobList = null;
                if (!string.IsNullOrEmpty(jobModel._Key))
                {
                    jobList = allJobList.Where(x => x.Name.Contains(jobModel._Key))
                                        .OrderBy(c => c.Group)
                                        .Skip((jobModel._PageIndex - 1) * jobModel._PageSize)
                                        .Take(jobModel._PageSize).ToList();
                }
                else
                {
                    jobList = allJobList.OrderBy(c => c.Group).Skip((jobModel._PageIndex - 1) * jobModel._PageSize).Take(jobModel._PageSize).ToList();
                }
                foreach (JobDetailImpl job in jobList)
                {
                    var model = await PackageJob(job);
                    jobs.Add(model);
                };
                return new MicroiJobResult()
                {
                    Code = 1,
                    Data = jobs,
                    DataCount = allJobList.Count
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine("获取所有job异常:" + ex);
                return new MicroiJobResult()
                {
                    Code = 0,
                    DataCount = 0
                };
            }
        }

        public async Task<MicroiJobResult> GetJobByName(List<string> jobNameArr)
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
                List<JobDetailImpl> jobList = new List<JobDetailImpl>();
                foreach (var jobName in jobNameArr)
                {
                    var job = allJobList.Where(x => x.Name.Equals(jobName, StringComparison.OrdinalIgnoreCase)).FirstOrDefault();
                    if (job != null)
                    {
                        jobList.Add(job);
                    }
                }
                foreach (JobDetailImpl job in jobList)
                {
                    var model = await PackageJob(job);
                    jobs.Add(model);
                };
                return new MicroiJobResult()
                {
                    Code = 1,
                    Data = jobs,
                    DataCount = allJobList.Count
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine("依据任务名称列表获取job异常:" + ex);
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
                var jobDetail = await _scheduler.GetJobDetail(new JobKey(jobModel.Name, group));
                if (jobDetail == null)
                {
                    return new MicroiJobResult(0, "job不存在");
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
                Console.WriteLine("依据任务名称获取job异常:" + ex);
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
                if (await _scheduler.CheckExists(new JobKey(addJobModel.JobName)))
                {
                    return new MicroiJobResult(0, "job已存在");
                }

                #endregion 参数校验

                #region 新增job

                Dictionary<string, string> dic = new Dictionary<string, string>();
                dic.Add(MicroiJobConst.Id, addJobModel.JobName);
                dic.Add(MicroiJobConst.JobType, addJobModel.JobType);
                if (!String.IsNullOrEmpty(addJobModel.JobParam))
                {
                    dic.Add(MicroiJobConst.JobParam, addJobModel.JobParam);
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
                var job = JobBuilder.Create(assembly.GetType(jobPath))
                                  .StoreDurably(true)
                                  .WithIdentity(addJobModel.JobName, group)
                                  .WithDescription(addJobModel.JobDesc)
                                  .UsingJobData(jobDataMap)
                                  .Build();
                await _scheduler.AddJob(job, true);

                #endregion 新增job

                #region 新增触发器

                ITrigger trigger = TriggerBuilder.Create().ForJob(job)
                                            .WithIdentity(addJobModel.JobName, group)
                                            .WithCronSchedule(addJobModel.CronExpression)
                                            .WithDescription(addJobModel.CronDesc)
                                            .Build();
                await _scheduler.ScheduleJob(trigger);

                #endregion 新增触发器

                // 保存job到diy_schedule_job表中，待实现
                return new MicroiJobResult(1, "成功");
            }
            catch (Exception ex)
            {
                return new MicroiJobResult(0, "新增job异常：" +ex.Message);
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
                var jobDetail = await _scheduler.GetJobDetail(new JobKey(job.JobName, group));
                if (jobDetail == null)
                {
                    return new MicroiJobResult(0, "job不存在");
                }
                JobDetailImpl jobDetailImpl = (JobDetailImpl)jobDetail;
                JobKey jobKey = new JobKey(jobDetailImpl.Name, group);
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
                var jobDetail = await _scheduler.GetJobDetail(new JobKey(job.JobName, group));
                if (jobDetail == null)
                {
                    return new MicroiJobResult(0, "job不存在");
                }
                JobDetailImpl jobDetailImpl = (JobDetailImpl)jobDetail;
                JobKey jobKey = new JobKey(jobDetailImpl.Name, group);
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
                var jobDetail = await _scheduler.GetJobDetail(new JobKey(job.JobName, group));
                if (jobDetail == null)
                {
                    return new MicroiJobResult(0, "job不存在");
                }
                JobDetailImpl jobDetailImpl = (JobDetailImpl)jobDetail;
                JobKey jobKey = new JobKey(jobDetailImpl.Name, group);
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
                var job = await _scheduler.GetJobDetail(new JobKey(addJobModel.JobName, group));
                if (job == null)
                {
                    return new MicroiJobResult(0, "job不存在");
                }

                // 获取任务的当前状态
                var jobKey = new JobKey(addJobModel.JobName, group);
                var triggers = await _scheduler.GetTriggersOfJob(jobKey);

                // 检查是否有触发器处于暂停状态
                var isPaused = triggers.Any(t =>
                {
                    var triggerState = _scheduler.GetTriggerState(t.Key).Result; // 获取触发器状态
                    return triggerState == TriggerState.Paused;
                });

                ITrigger trigger = TriggerBuilder.Create().ForJob(job)
                                              .WithIdentity(addJobModel.JobName, group)
                                              .WithCronSchedule(addJobModel.CronExpression)
                                              .WithDescription(addJobModel.CronDesc)
                                              .Build();

                await _scheduler.RescheduleJob(new TriggerKey(addJobModel.JobName, group), trigger);

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
            };
            var triggerModelCollection = await _scheduler.GetTriggersOfJob(new JobKey(job.Name, job.Group));
            if (triggerModelCollection != null && triggerModelCollection.Count > 0)
            {
                var triggerModel = triggerModelCollection.FirstOrDefault();
                TriggerState state = await _scheduler.GetTriggerState(triggerModel.Key);
                Quartz.Impl.Triggers.CronTriggerImpl cronTriggerModel = triggerModel as Quartz.Impl.Triggers.CronTriggerImpl;
                model.Status = GetTriggerState(state);
                model.LastTime = triggerModel.GetPreviousFireTimeUtc() == null ? "" : triggerModel.GetPreviousFireTimeUtc().Value.AddHours(8).ToString("yyyy-MM-dd HH:mm:ss");
                model.NextTime = triggerModel.GetNextFireTimeUtc() == null ? "" : triggerModel.GetNextFireTimeUtc().Value.AddHours(8).ToString("yyyy-MM-dd HH:mm:ss");
                model.CronDesc = triggerModel.Description;
                model.CronExpression = cronTriggerModel?.CronExpressionString;
            }
            return model;
        }

        public void SyncTaskTime()
        {
            EnsureInitialized();
            Task.Run(() =>
            {
                while (true)
                {
                    Thread.Sleep(TimeSpan.FromMinutes(1));
                    try
                    {
                        // 获取所有定时任务
                        var param = new
                        {
                            FormEngineKey = MicroiJobConst.dataTable,
                            OsClient = OsClient.OsClientName,
                            _Where = new List<DiyWhere>() {
                                new DiyWhere(){ Name = "Status", Value = "正常", Type = "=" }//2024-10-04新增此条件 --by Anderson
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
                                    var detailResult = GetJobDetail(model).Result;
                                    if (detailResult.Code == 1)
                                    {
                                        string str = JsonConvert.SerializeObject(detailResult.Data);
                                        MicroiJobModel jobModel = JsonConvert.DeserializeObject<MicroiJobModel>(str);
                                        MicroiEngine.FormEngine.UptFormData(new
                                        {
                                            FormEngineKey = MicroiJobConst.dataTable,
                                            Id = data.Id,
                                            _RowModel = new Dictionary<string, string>() {
                                                    { "LastTime",jobModel.LastTime},
                                                    { "NextTime",jobModel.NextTime}
                                            },
                                            OsClient = OsClient.OsClientName
                                        });
                                    }
                                }
                                catch (Exception e)
                                {
                                    Console.WriteLine(e.ToString());
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine(ex.ToString());
                    }
                }
            });
        }
    }
}
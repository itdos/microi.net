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
    public class MicroiQuartzScheduledTask : IMicroiScheduledTask
    {
        private IScheduler scheduler;
        private ISchedulerFactory schedulerFactory;

        private const string group = "default_group";
        private static FormEngine _formEngine = new FormEngine();

        public MicroiQuartzScheduledTask(ISchedulerFactory schedulerFactory)
        {
            this.schedulerFactory = schedulerFactory;
            scheduler = schedulerFactory.GetScheduler().GetAwaiter().GetResult();
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
                var jobKeySet = await scheduler.GetJobKeys(GroupMatcher<JobKey>.AnyGroup());
                foreach (var jobKey in jobKeySet)
                {
                    var jobDetail = await scheduler.GetJobDetail(jobKey);
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
            catch(Exception ex)
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
                var jobKeySet = await scheduler.GetJobKeys(GroupMatcher<JobKey>.AnyGroup());
                foreach (var jobKey in jobKeySet)
                {
                    var jobDetail = await scheduler.GetJobDetail(jobKey);
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
            catch(Exception ex)
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
                var jobDetail = await scheduler.GetJobDetail(new JobKey(jobModel.Name, group));
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
            catch(Exception ex)
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
                else if((addJobModel.JobType.Equals(MicroiJobConst.JobTypeDevelopment)))
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
                if (await scheduler.CheckExists(new JobKey(addJobModel.JobName)))
                {
                    return new MicroiJobResult(0, "job已存在");
                }
                #endregion

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
                string saveFilePath = $"{Directory.GetCurrentDirectory()}\\{dllName}";
                Assembly assembly = Assembly.LoadFrom(saveFilePath);
                var job = JobBuilder.Create(assembly.GetType(jobPath))
                                  .StoreDurably(true)
                                  .WithIdentity(addJobModel.JobName, group)
                                  .WithDescription(addJobModel.JobDesc)
                                  .UsingJobData(jobDataMap)
                                  .Build();
                await scheduler.AddJob(job, true);
                #endregion

                #region 新增触发器
                ITrigger trigger = TriggerBuilder.Create().ForJob(job)
                                            .WithIdentity(addJobModel.JobName, group)
                                            .WithCronSchedule(addJobModel.CronExpression)
                                            .WithDescription(addJobModel.CronDesc)
                                            .Build();
                await scheduler.ScheduleJob(trigger);
                #endregion
                // 保存job到diy_schedule_job表中，待实现
                return new MicroiJobResult(1, "成功");
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                Console.WriteLine("新增job异常:" + ex);
                return new MicroiJobResult(0, ex.Message);
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
                var jobDetail = await scheduler.GetJobDetail(new JobKey(job.JobName,group));
                if(jobDetail == null)
                {
                    return new MicroiJobResult(0, "job不存在");
                }
                JobDetailImpl jobDetailImpl = (JobDetailImpl)jobDetail;
                JobKey jobKey = new JobKey(jobDetailImpl.Name, group);
                await scheduler.PauseJob(jobKey);
                return new MicroiJobResult(1, "成功");
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                Console.WriteLine("暂停job异常:" + ex);
                return new MicroiJobResult(0, ex.Message);
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
                var jobDetail = await scheduler.GetJobDetail(new JobKey(job.JobName, group));
                if (jobDetail == null)
                {
                    return new MicroiJobResult(0, "job不存在");
                }
                JobDetailImpl jobDetailImpl = (JobDetailImpl)jobDetail;
                JobKey jobKey = new JobKey(jobDetailImpl.Name, group);
                await scheduler.ResumeJob(jobKey);
                return new MicroiJobResult(1, "成功");
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                Console.WriteLine("恢复job异常:" + ex);
                return new MicroiJobResult(0, ex.Message);
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
                var jobDetail = await scheduler.GetJobDetail(new JobKey(job.JobName, group));
                if (jobDetail == null)
                {
                    return new MicroiJobResult(0, "job不存在");
                }
                JobDetailImpl jobDetailImpl = (JobDetailImpl)jobDetail;
                JobKey jobKey = new JobKey(jobDetailImpl.Name, group);
                await scheduler.DeleteJob(jobKey);
                return new MicroiJobResult(1, "成功");
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                Console.WriteLine("删除job异常:" + ex);
                return new MicroiJobResult(0, ex.Message);
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
        //        var jobDetail = await scheduler.GetJobDetail(new JobKey(job.Id, group));
        //        if (jobDetail == null)
        //        {
        //            return new JobResult(0, "job不存在");
        //        }
        //        JobDetailImpl jobDetailImpl = (JobDetailImpl)jobDetail;
        //        JobKey jobKey = new JobKey(jobDetailImpl.Name, group);
        //        // 依据id去diy_schedule_job表中获取任务名称，待实现
        //        var IsExist = await scheduler.CheckExists(jobKey);
        //        if (IsExist)
        //        {
        //            await scheduler.TriggerJob(jobKey);
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
        //        var job = await scheduler.GetJobDetail(new JobKey(triggerDataModel.JobName, group));
        //        if(job == null)
        //        {
        //            return new JobResult(0, "job不存在");
        //        }
        //        var triggerModel = await scheduler.GetTriggersOfJob(new JobKey(triggerDataModel.JobName, group));
        //        if (triggerModel != null)
        //            action = "edit";

        //        ITrigger trigger = TriggerBuilder.Create().ForJob(job)
        //                                      .WithIdentity(triggerDataModel.JobName, group)
        //                                      .WithCronSchedule(triggerDataModel.Cron)
        //                                      .WithDescription(triggerDataModel.CronDesc)
        //                                      .Build();
        //        if (action.Equals("add"))
        //        {
        //            await scheduler.ScheduleJob(trigger);
        //        }
        //        else
        //        {
        //            await scheduler.RescheduleJob(new TriggerKey(triggerDataModel.JobName, group), trigger);
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
                var job = await scheduler.GetJobDetail(new JobKey(addJobModel.JobName, group));
                if (job == null)
                {
                    return new MicroiJobResult(0, "job不存在");
                }

                ITrigger trigger = TriggerBuilder.Create().ForJob(job)
                                              .WithIdentity(addJobModel.JobName, group)
                                              .WithCronSchedule(addJobModel.CronExpression)
                                              .WithDescription(addJobModel.CronDesc)
                                              .Build();
                await scheduler.RescheduleJob(new TriggerKey(addJobModel.JobName, group), trigger);
                return new MicroiJobResult(1, "成功");
            }
            catch(Exception ex)
            {
                Console.WriteLine("修改job异常:" + ex);
                return new MicroiJobResult(0, ex.Message);
            }
        }

        /// <summary>
        /// 获取job当前状态
        /// </summary>
        /// <param name="triggerState"></param>
        /// <returns></returns>
        private  string GetTriggerState(TriggerState triggerState)
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
            MicroiJobModel model = new MicroiJobModel()
            {
                JobName = job.Name,
                Group = job.Group,
                JobDesc = job.Description,
                Id = job.JobDataMap.GetString(MicroiJobConst.Id),
                JobParam = job.JobDataMap.GetString(MicroiJobConst.JobParam),
                Status = "未调度",
                JobType = job.JobDataMap.GetString(MicroiJobConst.JobType),
            };
            var triggerModelCollection = await scheduler.GetTriggersOfJob(new JobKey(job.Name, job.Group));
            if (triggerModelCollection != null && triggerModelCollection.Count > 0)
            {
                var triggerModel = triggerModelCollection.FirstOrDefault();
                TriggerState state = await scheduler.GetTriggerState(triggerModel.Key);
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
                        DosResultList<dynamic> result = _formEngine.GetTableData(param);
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
                                        _formEngine.UptFormData(new
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
                                catch(Exception e) 
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

﻿using Amazon.Runtime.Internal.Transform;
using Dos.Common;
using Dos.ORM;
using Microi.net;
using Microsoft.AspNetCore.Mvc;
using Minio.DataModel;
using MySqlX.XDevAPI.Common;
using Nest;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Senparc.CO2NET.Extensions;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using static Aliyun.OSS.Model.CreateSelectObjectMetaInputFormatModel;
using static Nest.MachineLearningUsage;
using static Quartz.Logging.OperationName;

namespace iTdos.Api.Controllers
{
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    [ApiController]
    public class JobController : Controller
    {
        IMicroiScheduledTask scheduledTask;
        IMicroiMQPublish mqCenter;
        string jobTable = "diy_schedule_job";
        private static FormEngine _formEngine = new FormEngine();
        private static FormEngineController formEngineController = new FormEngineController();
        public JobController(IMicroiScheduledTask scheduledTask, IMicroiMQPublish mqCenter)
        {
            this.scheduledTask = scheduledTask;
            this.mqCenter = mqCenter;
        }
        /// <summary>
        /// 获取所有job信息
        /// </summary>
        /// <param name="jobModel"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> GetAllJob([FromForm] MicroiSearchJobModel jobModel)
        {
            try
            {
                // 依据分页参数从数据库获取数据，然后依据job名称从quartz中获取相关job信息，并返回给前端
                var param = new
                {
                    FormEngineKey = jobTable,
                    _PageIndex = jobModel._PageIndex,
                    _PageSize = jobModel._PageSize,
                    OsClient = OsClient.OsClientName
                };
                DosResultList<dynamic> list = await _formEngine.GetTableDataAsync(param);
                List<string> jobNameList = new List<string>();
                if (list.Code == 1 && list.Data != null)
                {
                    foreach (dynamic item in list.Data)
                    {
                        jobNameList.Add(item.JobName);
                    }
                    var jobResult = await scheduledTask.GetJobByName(jobNameList);
                    if (jobResult.Code == 1 && jobResult.Data != null)
                    {
                        var jobs = jobResult.Data as List<MicroiJobModel>;
                        if (jobs != null && jobs.Count > 0)
                        {
                            foreach (dynamic item in list.Data)
                            {
                                var job = jobs.Find(x => x.JobName.Equals(item.JobName, StringComparison.OrdinalIgnoreCase));
                                if (job != null)
                                {
                                    item.Status = job.Status;
                                    item.LastTime = job.LastTime;
                                    item.NextTime = job.NextTime;
                                    item.CronExpression = job.CronExpression;
                                }
                            }
                        }
                    }
                }
                return Json(list);
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                Console.WriteLine("JobController获取所有任务异常:"+ex);
                var result = new DosResult()
                {
                    Code = 0,
                    Msg = ex.Message
                };
                return Json(result);
            }
          
        }

        /// <summary>
        /// 获取单个job明细
        /// </summary>
        /// <param name="jobModel"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> GetJobDetail([FromForm] MicroiSearchJobModel jobModel)
        {
            try
            {
                // 依据ID从数据库获取数据，然后依据job名称从quartz中获取job信息，并返回给前端
                var param = new
                {
                    FormEngineKey = jobTable,
                    Id = jobModel.Id,
                    OsClient = OsClient.OsClientName
                };
                DosResult<dynamic> result = _formEngine.GetFormData(param);
                if (result.Code == 1 && result.Data != null)
                {
                    jobModel.Name = result.Data.JobName;
                    var job = await scheduledTask.GetJobDetail(jobModel);
                    if (job.Code == 1 && job.Data != null)
                    {
                        var obj = job.Data as MicroiJobModel;
                        result.Data.Status = obj.Status;
                        result.Data.LastTime = obj.LastTime;
                        result.Data.NextTime = obj.NextTime;
                        result.Data.CronExpression = obj.CronExpression;
                    }
                }
                //return Json(await scheduledTask.GetJobDetail(jobModel));
                return Json(result);
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                Console.WriteLine("JobController获取所有任务异常:" + ex);
                var result = new DosResult()
                {
                    Code = 0,
                    Msg = ex.Message
                };
                return Json(result);
            }
           
        }

        /// <summary>
        /// 新增job
        /// </summary>
        /// <param name="addJobModel"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> AddJob([FromForm] MicroiAddJobModel addJobModel)
        {
            var jobResult = await scheduledTask.AddJob(addJobModel);
            if (jobResult.Code == 1)
            {
                // 更新上次执行时间以及下次执行时间到数据库
                MicroiSearchJobModel jobModel = new MicroiSearchJobModel()
                {
                    Name = addJobModel.JobName
                };
                var jobDeatilResult = await scheduledTask.GetJobDetail(jobModel);
                if (jobDeatilResult.Code == 1)
                {
                    string str = JsonConvert.SerializeObject(jobDeatilResult.Data);
                    MicroiJobModel job = JsonConvert.DeserializeObject<MicroiJobModel>(str);
                    // 更新数据库任务状态
                    await _formEngine.UptFormDataAsync(new
                    {
                        FormEngineKey = jobTable,
                        Id = addJobModel.Id,
                        _RowModel = new Dictionary<string, string>() {
                                { "LastTime",job.LastTime},
                                { "NextTime",job.NextTime},
                                { "Status","正常"}
                            },
                        OsClient = OsClient.OsClientName
                    });
                }
            }
            else
            {
                // 更新数据库任务状态
                await _formEngine.UptFormDataAsync(new
                {
                    FormEngineKey = jobTable,
                    Id = addJobModel.Id,
                    _RowModel = new Dictionary<string, string>() {
                                { "Status", jobResult.Msg}
                            },
                    OsClient = OsClient.OsClientName
                });
            }
            return Json(jobResult);
        }


        /// <summary>
        /// 修改job
        /// </summary>
        /// <param name="addJobModel"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> UpdateJob([FromForm] MicroiAddJobModel addJobModel)
        {
            var jobResult = await scheduledTask.UpdateJob(addJobModel);
            if (jobResult.Code == 1)
            {
                // 更新上次执行时间以及下次执行时间到数据库
                MicroiSearchJobModel jobModel = new MicroiSearchJobModel()
                {
                    Name = addJobModel.JobName
                };
                var jobDeatilResult = await scheduledTask.GetJobDetail(jobModel);
                if (jobDeatilResult.Code == 1)
                {
                    string str = JsonConvert.SerializeObject(jobDeatilResult.Data);
                    MicroiJobModel job = JsonConvert.DeserializeObject<MicroiJobModel>(str);
                    // 更新数据库任务状态
                    await _formEngine.UptFormDataAsync(new
                    {
                        FormEngineKey = jobTable,
                        Id = addJobModel.Id,
                        _RowModel = new Dictionary<string, string>() {
                                { "LastTime",job.LastTime},
                                { "NextTime",job.NextTime},
                                { "Status","正常"}
                        },
                        OsClient = OsClient.OsClientName
                    });
                }
            }
            else
            {
                // 更新数据库任务状态
                await _formEngine.UptFormDataAsync(new
                {
                    FormEngineKey = jobTable,
                    Id = addJobModel.Id,
                    _RowModel = new Dictionary<string, string>() {
                                { "Status", jobResult.Msg}
                            },
                    OsClient = OsClient.OsClientName
                });
            }
            return Json(jobResult);
        }
        /// <summary>
        /// 暂停job
        /// </summary>
        /// <param name="job"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> PauseJob([FromForm] MicroiJobModel job)
        {
            var result = await scheduledTask.PauseJob(job);
            if(result.Code == 1)
            {
                // 更新数据库任务状态
                 await _formEngine.UptFormDataAsync(new
                {
                    FormEngineKey = jobTable,
                    Id = job.Id,
                    _RowModel = new Dictionary<string, string>() {
                                { "Status", "暂停"}
                            },
                    OsClient = OsClient.OsClientName
                });
            }
            return Json(result);
        }

        /// <summary>
        /// 恢复job
        /// </summary>
        /// <param name="job"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> ResumeJob([FromForm] MicroiJobModel job)
        {
            var result = await scheduledTask.ResumeJob(job);
            if (result.Code == 1)
            {
                // 更新数据库任务状态
                await _formEngine.UptFormDataAsync(new
                {
                    FormEngineKey = jobTable,
                    Id = job.Id,
                    _RowModel = new Dictionary<string, string>() {
                                { "Status", "正常"}
                            },
                    OsClient = OsClient.OsClientName
                });
            }
            return Json(result);
        }

        /// <summary>
        /// 删除job
        /// </summary>
        /// <param name="job"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> DeleteJob([FromForm] MicroiJobModel job)
        {
            return Json(await scheduledTask.DeleteJob(job));
        }
    }
}

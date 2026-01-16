using Microi.net;
using Newtonsoft.Json.Linq;
using Quartz;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Microi.net
{
    public class MicroiJobListener : IJobListener
    {
        public string Name => "JobListener";
        /// <summary>
        /// 任务被拒绝执行的时候
        /// </summary>
        /// <param name="context"></param>
        /// <param name="cancellationToken"></param>
        /// <returns></returns>
        /// <exception cref="NotImplementedException"></exception>
        public async Task JobExecutionVetoed(IJobExecutionContext context, CancellationToken cancellationToken = default)
        {
            Console.WriteLine($"Microi：【{Name}】-【JobExecutionVetoed】-【{context.JobDetail.Key.Name}】-【工作执行被否决】");
            await Task.CompletedTask;
        }

        /// <summary>
        /// 任务执行前触发动作
        /// </summary>
        /// <param name="context"></param>
        /// <param name="cancellationToken"></param>
        /// <returns></returns>
        /// <exception cref="NotImplementedException"></exception>
        public async Task JobToBeExecuted(IJobExecutionContext context, CancellationToken cancellationToken = default)
        {
            string message = $"{context.JobDetail.Key.Name}作业即将被执行";
            // try
            // {
            //     await MicroiEngine.FormEngine.AddFormDataAsync(new
            //     {
            //         FormEngineKey = MicroiJobConst.logTable,
            //         _RowModel = new Dictionary<string, string>()
            //         {
            //             { "JobName", context.JobDetail.Key.Name},
            //             { "Message", message}
            //         },
            //         OsClient = OsClientDefault.OsClient
            //     });
            // }
            // catch (Exception ex)
            // {
            //     Console.WriteLine(ex);
            // }
            await Task.CompletedTask;
        }

        /// <summary>
        /// 任务执行后：作业已执行
        /// </summary>
        /// <param name="context"></param>
        /// <param name="jobException"></param>
        /// <param name="cancellationToken"></param>
        /// <returns></returns>
        /// <exception cref="NotImplementedException"></exception>
        public async Task JobWasExecuted(IJobExecutionContext context, JobExecutionException jobException, CancellationToken cancellationToken = default)
        {
            string message = $"{context.JobDetail.Key.Name}作业执行完毕";
            // try
            // {
            //     await MicroiEngine.FormEngine.AddFormDataAsync(new
            //     {
            //         FormEngineKey = MicroiJobConst.logTable,
            //         _RowModel = new Dictionary<string, string>()
            //         {
            //             { "JobName", context.JobDetail.Key.Name},
            //             { "Message", message}
            //         },
            //         OsClient = OsClientDefault.OsClient
            //     });
            // }
            // catch (Exception ex)
            // {
            //     Console.WriteLine(ex);
            // }
            await Task.CompletedTask;
        }
    }
}

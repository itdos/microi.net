using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public static class MicroiJobConst
    {
        // 定制开发job类型
        public const string JobTypeDevelopment = "2";
        // 接口引擎job类型
        public const string JobTypeApiEngineKey = "1";
        // 任务ID
        public const string Id = "Id";
        // 任务类别
        public const string JobType = "JobType";
        // 接口引擎key
        public const string ApiEngineKey = "ApiEngineKey";
        // 接口引擎默认执行的job dll名称
        public const string DLL = "Microi.Job.dll";
        // 接口引擎默认执行的job路径
        public const string JobPath = "Microi.net.MicroiApiEngineJob";

        // Job参数
        public const string JobParam = "JobParam";
        //log表
        public const string logTable = "diy_schedule_job_log";
        //数据表
        public const string dataTable = "diy_schedule_job";
    }
}

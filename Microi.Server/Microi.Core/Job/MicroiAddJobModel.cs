using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Configuration;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public class MicroiAddJobModel
    {
        //public string FormEngineKey { get; set; }
        //public string Id { get; set; }

        //public FormData FormData { get; set; }
        // job名称
        [Required(ErrorMessage = "任务名称不能为空")]
        [RegularExpression("^[A-Za-z]+$", ErrorMessage = "任务key只能输入英文")]
        public string JobName { get; set; }
        // job所属dll程序集
        public string DllName { get; set; }
        // job所属路径
        public string JobPath { get; set; }
        // job描述
        public string JobDesc { get; set; }
        // job参数，多个以逗号分隔
        public string JobParam { get; set; }
        // Job id
        public string Id { get; set; }
        // cron描述
        public string CronDesc { get; set; }
        // cron表达式
        [Required(ErrorMessage = "cron表达式不能为空")]
        public string CronExpression { get; set; }
        // job类型（1、接口引擎  2、定制开发）
        [Required(ErrorMessage = "任务类型不能为空")]
        public string JobType { get; set; }
        // 接口引擎key
        public string ApiEngineKey { get; set; }
    }
    public class FormData
    {

    }
}



using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public class MicroiAddTriggerModel
    {
        // job名称
        public string JobName { get; set; }
        // cron表达式
        public string Cron { get; set; }
        // cron表达式描述
        public string CronDesc { get; set; }
    }
}

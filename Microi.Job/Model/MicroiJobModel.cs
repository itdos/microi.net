using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public class MicroiJobModel
    {
        // job名称
        public string JobName { get; set; }
        // job所属组
        public string Group { get; set; }
        // job描述
        public string JobDesc { get; set; }
        // job状态
        public string Status { get; set; }
        // 上次执行时间
        public string LastTime { get; set; }
        // 下次执行时间
        public string NextTime { get; set; }
        // 触发器描述
        public string CronDesc { get; set; }
        // 触发器
        public string CronExpression { get; set; }
        // job运行需要的参数
        public string JobParam { get; set; }
        // job id
        public string Id { get; set; }
        // job类型
        public string JobType { get; set; }
    }
}

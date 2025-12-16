
using Quartz;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    // 2025-12-12 注释 by anderson：允许并发执行
    // [DisallowConcurrentExecution]
    public class MicroiMyJob : IJob
    {
        //public FormEngine _formEngine = new FormEngine();
       // public V8Engine _v8Engine = new V8Engine();
        public Task Execute(IJobExecutionContext context)
        {
            // Console.WriteLine(DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") + " 执行了任务");
            return Task.CompletedTask;
        }
    }
}

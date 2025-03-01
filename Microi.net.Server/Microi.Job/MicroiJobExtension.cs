using Microsoft.Extensions.DependencyInjection;
using Quartz.AspNetCore;
using Quartz;
using System;
using System.Collections.Generic;
using System.Text;
using System.Configuration;
using Microsoft.Extensions.Configuration;
using Microi.net;
using System.Collections.Specialized;

namespace Microi.net
{
    public static class MicroiJobExtension
    {
        public static IServiceCollection AddMicroiJob(this IServiceCollection services)
        {
            try
            {
                //var properties = new NameValueCollection();
                var str = OsClient.OsClientDbConn;
                services.AddQuartz(q =>
                {
                    //q.UseInMemoryStore();
                    q.UsePersistentStore(x =>
                    {
                        x.UseClustering();
                        x.UseMySql(OsClient.OsClientDbConn);
                        x.UseNewtonsoftJsonSerializer();
                        x.SetProperty("quartz.jobStore.tablePrefix", "microi_job_");
                        x.SetProperty("quartz.jobStore.performSchemaValidation", "false");//2023-11-03 Anderson新增。否则没有相关表的数据库Program.css app.run()会抛出异常。
                    });
                    //q.AddJobListener<JobListener>();
                });
                services.AddQuartzServer(options =>
                {
                    // when shutting down we want jobs to complete gracefully
                    options.WaitForJobsToComplete = true;
                });
                services.AddSingleton<IMicroiScheduledTask, MicroiQuartzScheduledTask>();
                Console.WriteLine("Microi：注入分布式任务调度插件成功！");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：注入分布式任务调度插件失败：" + ex.Message);
                return services;
            }
            
        }

        public static IServiceCollection MicroiSyncTaskTime(this IServiceCollection services, IServiceProvider serviceProvider)
        {
            try
            {
                var scheduledTask = serviceProvider.GetService<IMicroiScheduledTask>();
                if (scheduledTask != null)
                {
                    scheduledTask.SyncTaskTime();
                }
                return services;
            }
            catch (System.Exception ex)
            {
                Console.WriteLine("Microi：注入分布式任务调度插件失败-2：" + ex.Message);
                return services;
            }
        }
    }
}

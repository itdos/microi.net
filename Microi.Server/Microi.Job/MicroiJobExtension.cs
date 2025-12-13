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
using Quartz.Simpl;

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
                    // 线程池配置
                    // q.UseSimpleTypeLoader();
                    // q.UseInMemoryStore();//使用UseMySql
                    q.UsePersistentStore(x =>
                    {
                        x.UseClustering();
                        x.UseMySql(OsClient.OsClientDbConn);
                        x.UseNewtonsoftJsonSerializer();
                        // x.SetProperty("quartz.jobStore.misfireThreshold", "60000");//检查失火阈值
                        // x.SetProperty("quartz.scheduler.timeZone", "Asia/Shanghai");//或 "China Standard Time"
                        x.SetProperty("quartz.jobStore.tablePrefix", "microi_job_");
                        x.SetProperty("quartz.jobStore.performSchemaValidation", "false");//2023-11-03 Anderson新增。否则没有相关表的数据库Program.css app.run()会抛出异常。
                    });
                    //q.AddJobListener<JobListener>();
                    // 设置线程池（默认是10）
                    // 使用默认线程池
                    q.UseDefaultThreadPool(tp =>
                    {
                        try
                        {
                            var cpuCount = Environment.ProcessorCount;  // 通常8-32核
                            if(cpuCount <= 0)
                            {
                                cpuCount = 4;
                            }
                            tp.MaxConcurrency = cpuCount * 10;           // 16-64个线程
                            Console.WriteLine($"Microi：已成功配置分布式任务调度插件线程最多[{cpuCount * 10}]个！");
                        }
                        catch (System.Exception)
                        {
                            tp.MaxConcurrency = 4 * 10;
                            Console.WriteLine($"Microi：已成功配置分布式任务调度插件线程默认最多[{4 * 10}]个！");
                        }
                        // tp.MaxConcurrency = 20;
                        // ThreadPriority 属性可能不存在于某些版本
                        // 如果需要设置优先级，使用以下方式：
                        // tp.ThreadCount = 20;  // 某些版本用这个属性
                    });
                    
                    // 或者更简单的写法
                    // q.UseThreadPool<DefaultThreadPool>(tp =>
                    // {
                    //     tp.MaxConcurrency = 20;
                    // });
                });
                services.AddQuartzServer(options =>
                {
                    // when shutting down we want jobs to complete gracefully
                    options.WaitForJobsToComplete = true;
                });
                services.AddSingleton<IMicroiScheduledTask, MicroiQuartzScheduledTask>();
                Console.WriteLine("Microi：【成功】注入分布式任务调度插件成功！");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：【异常】注入分布式任务调度插件失败：" + ex.Message);
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
                Console.WriteLine("Microi：【异常】注入分布式任务调度插件失败-2：" + ex.Message);
                return services;
            }
        }
    }
}

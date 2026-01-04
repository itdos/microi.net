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
using Microsoft.AspNetCore.Builder;

namespace Microi.net
{
    public static class MicroiJobExtension
    {
        public static IServiceCollection AddMicroiJob(this IServiceCollection services, string dbConn)
        {
            try
            {
                services.AddQuartz(q =>
                {
                    //-------使用内存存储作为临时配置 --延迟启动未实验成功
                    // q.UseInMemoryStore();
                    // q.UseSimpleTypeLoader();
                    //-------
                    
                    q.UsePersistentStore(x =>
                    {
                        x.UseClustering();
                        x.UseMySql(dbConn);//OsClient.OsClientDbConn
                        x.UseNewtonsoftJsonSerializer();
                        // x.SetProperty("quartz.jobStore.misfireThreshold", "60000");//检查失火阈值
                        // x.SetProperty("quartz.scheduler.timeZone", "Asia/Shanghai");//或 "China Standard Time"
                        x.SetProperty("quartz.jobStore.tablePrefix", "microi_job_");
                        //2023-11-03 Anderson新增。否则没有相关表的数据库Program.css app.run()会抛出异常。
                        x.SetProperty("quartz.jobStore.performSchemaValidation", "false");
                    });
                    q.AddJobListener<MicroiJobListener>();
                    // 设置线程池（默认是10）
                    q.UseDefaultThreadPool(tp =>
                    {
                        var maxConcurrency = Math.Max(4 * 10, Environment.ProcessorCount * 10);
                        tp.MaxConcurrency = maxConcurrency;
                        Console.WriteLine($"Microi：【成功】配置【分布式任务调度】插件线程最多[{maxConcurrency}]个！");
                    });
                });
                
                services.AddQuartzServer(options =>
                {
                    options.WaitForJobsToComplete = true;
                    options.StartDelay = TimeSpan.FromSeconds(10); // 延迟启动
                });
                services.AddSingleton<IMicroiJob, MicroiQuartzScheduledTask>();
                Console.WriteLine("Microi：【成功】注入【分布式任务调度】插件成功！");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】注入【分布式任务调度】插件失败：" + ex.Message);
                return services;
            }
        }
        public static IApplicationBuilder UseMicroiJob(this IApplicationBuilder app)
        {
            try
            {
                // 在应用构建完成后启动
                var scheduledTask = app.ApplicationServices.GetRequiredService<IMicroiJob>();

                //--延迟启动未实验成功
                // var osClientModel = OsClient.GetClient(OsClient.GetConfigOsClient());
                // // 初始化 Scheduler
                // scheduledTask.InitializeAsync(osClientModel.DbConn).GetAwaiter().GetResult();

                scheduledTask.SyncTaskTime();
                Console.WriteLine("Microi：【成功】【分布式任务调度】插件启动成功！");
                return app;
            }
            catch (System.Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】【分布式任务调度】插件启动失败：" + ex.Message);
                return app;
            }
        }
        /// <summary>
        /// 2025-12-18 Anderson：修改为使用UseMicroiJob，此方法已弃用
        /// </summary>
        /// <returns></returns>

        // public static IServiceCollection Init(this IServiceCollection services, IServiceProvider serviceProvider)
        // {
        //     try
        //     {
        //         var scheduledTask = serviceProvider.GetService<IMicroiJob>();
        //         if (scheduledTask != null)
        //         {
        //             scheduledTask.SyncTaskTime();
        //             Console.WriteLine("Microi：【成功】分布式任务调度插件初始化成功！");
        //         }
        //         return services;
        //     }
        //     catch (System.Exception ex)
        //     {
        //         Console.WriteLine("Microi：【Error异常】分布式任务调度插件初始化失败：" + ex.Message);
        //         return services;
        //     }
        // }
    }
}

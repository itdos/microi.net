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
using Dos.ORM;
using Dos.Common;

namespace Microi.net
{
    public static class MicroiJobExtension
    {
        public static IServiceCollection AddMicroiJob(
            this IServiceCollection services,
            string dbConn,
            string databaseTypeName = null)
        {
            try
            {
                var databaseType = ResolveQuartzDatabaseType(databaseTypeName);
                // Quartz 直接把连接串交给具体数据库驱动，不会经过 Dos.ORM 的 DbSession。
                // 因此必须在插件边界按实际数据库类型选择 Provider，并保留 MySQL
                // 历史连接串兼容处理；SQL Server 连接串绝不能再交给 MySql.Data。
                var quartzDbConn = ConnectionStringCompatibility.Normalize(
                    databaseType,
                    dbConn,
                    100,
                    120,
                    600);
                services.AddQuartz(q =>
                {
                    // 集群节点必须拥有不同的 InstanceId；默认 NON_CLUSTERED 会让共享库中的
                    // 多个节点互相覆盖心跳和触发器归属。名称保持原值，以兼容既有持久化任务。
                    q.SchedulerId = "AUTO";
                    // 持久化集群中的新增/解锁不保证唤醒另一节点。限制预取与空闲轮询窗口，
                    // 避免节点提前持有远期触发器时，让已到期的秒级任务等待默认的 30 秒窗口。
                    q.SetProperty("quartz.scheduler.idleWaitTime", "1000");
                    //-------使用内存存储作为临时配置 --延迟启动未实验成功
                    // q.UseInMemoryStore();
                    // q.UseSimpleTypeLoader();
                    //-------

                    q.UsePersistentStore(x =>
                    {
                        x.UseClustering();
                        ConfigurePersistentStore(x, databaseType, quartzDbConn);
                        x.SetProperty("quartz.jobStore.type", typeof(MicroiTaskSchedulingJobStore).AssemblyQualifiedName);
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
                        Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】配置【分布式任务调度】插件线程最多[{maxConcurrency}]个！");
                    });
                });

                services.AddQuartzServer(options =>
                {
                    options.WaitForJobsToComplete = true;
                    options.StartDelay = TimeSpan.FromSeconds(10); // 延迟启动
                });
                services.AddSingleton<IMicroiJob, MicroiQuartzScheduledTask>();
                services.AddHostedService<MicroiDisabledScheduleObserver>();
                Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】注入【分布式任务调度】插件成功！");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】注入【分布式任务调度】插件失败：" + ex.Message);
                return services;
            }
        }

        internal static DatabaseType ResolveQuartzDatabaseType(string databaseTypeName = null)
        {
            var configuredType = databaseTypeName;
            if (string.IsNullOrWhiteSpace(configuredType))
            {
                configuredType = Environment.GetEnvironmentVariable(
                    "OsClientDbType",
                    EnvironmentVariableTarget.Process);
            }
            if (string.IsNullOrWhiteSpace(configuredType))
                configuredType = ConfigHelper.GetAppSettings("OsClientDbType");
            if (string.IsNullOrWhiteSpace(configuredType))
                configuredType = OsClientDefault.OsClientDbType;

            configuredType = DatabaseTypeCompatibility.NormalizeConfigurationName(configuredType);
            if (!Enum.TryParse(configuredType, true, out DatabaseType databaseType))
                throw new NotSupportedException($"Quartz 不支持未知数据库类型：{configuredType}");

            databaseType = DatabaseTypeCompatibility.NormalizeOrmServiceType(databaseType);
            if (databaseType != DatabaseType.MySql && databaseType != DatabaseType.SqlServer)
            {
                throw new NotSupportedException(
                    $"Quartz 持久化当前仅支持 MySql 与 SqlServer，当前类型：{databaseType}");
            }
            return databaseType;
        }

        internal static void ConfigurePersistentStore(
            SchedulerBuilder.PersistentStoreOptions options,
            DatabaseType databaseType,
            string connectionString)
        {
            if (databaseType == DatabaseType.SqlServer)
            {
                options.UseSqlServer(connectionString);
            }
            else
            {
                options.UseMySql(connectionString);
            }
            options.SetProperty("quartz.jobStore.driverDelegateType", GetDriverDelegateType(databaseType));
        }

        internal static string GetDriverDelegateType(DatabaseType databaseType)
        {
            return databaseType == DatabaseType.SqlServer
                ? typeof(MicroiTenantSqlServerDelegate).AssemblyQualifiedName
                : typeof(MicroiTenantMySqlDelegate).AssemblyQualifiedName;
        }

        internal static string GetProviderName(DatabaseType databaseType)
        {
            return databaseType == DatabaseType.SqlServer ? "SqlServer" : "MySql";
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
                Console.WriteLine($"Microi：【✅成功】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】【分布式任务调度】插件启动成功！");
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

using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public static class MicroiMQExtension
    {
        /// <summary>
        /// 初始化MQ相关信息
        /// </summary>
        /// <param name="services"></param>
        /// <returns></returns>
        public static IServiceCollection AddMicroiMQ(this IServiceCollection services)
        {
            try
            {
                // var osClientName = Environment.GetEnvironmentVariable("OsClient", EnvironmentVariableTarget.Process) ?? (ConfigHelper.GetAppSettings("OsClient") ?? "");
                // var clientModel = OsClient.GetClient(osClientName);
                // if (MicroiMQConst.Connection_Cluster.Equals(clientModel.MQType))//如果是集群
                // {
                //     services.AddSingleton<IMicroiMQConnection, MicroiRabbitMQClusterConnection>();
                // }
                // else
                {
                    services.AddSingleton<IMicroiMQConnection, MicroiRabbitMQSingleConnection>();
                }
                services.AddSingleton<IMicroiMQConsumer, MicroiRabbitMQConsumer>();
                services.AddSingleton<IMicroiMQ, MicroiRabbitMQPublish>();
                Console.WriteLine("Microi：【成功】注入【MQ消息队列】插件成功！");
                return services;
            }
            catch (System.Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】注入【MQ消息队列】插件失败：" + ex.Message);
                return services;
            }
        }
        public static IApplicationBuilder UseMicroiMQ(this IApplicationBuilder app)
        {
            try
            {
                // 在应用构建完成后初始化
                var init = app.ApplicationServices.GetRequiredService<IMicroiMQConsumer>();
                if (init != null)
                {
                    init.ConsumerInit();
                    Console.WriteLine("Microi：【成功】MQ消息队列插件初始化成功！");
                }
                return app;
            }
            catch (System.Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】MQ消息队列插件初始化失败：" + ex.Message);
                return app;
            }
        }
        /// <summary>
        /// 2025-12-18 Anderson：修改为使用UseMicroiMQ，此方法已弃用
        /// </summary>
        /// <param name="services"></param>
        /// <param name="serviceProvider"></param>
        /// <returns></returns>
        public static IServiceCollection Init(this IServiceCollection services, IServiceProvider serviceProvider)
        {
            try
            {
                var consumer = serviceProvider.GetService<IMicroiMQConsumer>();
                if(consumer != null)
                {
                    consumer.ConsumerInit();
                    Console.WriteLine("Microi：【成功】消息队列插件初始化成功！");
                }           
                return services;
            }
            catch (System.Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】消息队列插件初始化失败：" + ex.Message);
                return services;
            }
        }
    }
}

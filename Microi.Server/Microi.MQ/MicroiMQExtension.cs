using Dos.Common;
using Microi.net;
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
                var osClientName = Environment.GetEnvironmentVariable("OsClient", EnvironmentVariableTarget.Process) ?? (ConfigHelper.GetAppSettings("OsClient") ?? "");
                var clientModel = OsClient.GetClient(osClientName);
                if (MicroiMQConst.Connection_Cluster.Equals(clientModel.MQType))
                {
                    services.AddSingleton<IMicroiMQConnection, MicroiRabbitMQClusterConnection>();
                }
                else
                {
                    services.AddSingleton<IMicroiMQConnection, MicroiRabbitMQSingleConnection>();
                }
                services.AddSingleton<IMicroiMQConsumer, MicroiRabbitMQConsumer>();
                services.AddSingleton<IMicroiMQPublish, MicroiRabbitMQPublish>();
                Console.WriteLine("Microi：【成功】注入消息队列插件成功！");
                return services;
            }
            catch (System.Exception ex)
            {
                Console.WriteLine("Microi：【异常】注入消息队列插件失败：" + ex.Message);
                return services;
            }
            
        }
        public static IServiceCollection MicroiConsumerInit(this IServiceCollection services, IServiceProvider serviceProvider)
        {
            try
            {
                var consumer = serviceProvider.GetService<IMicroiMQConsumer>();
                if(consumer != null)
                {
                    consumer.ConsumerInit();
                }           
                return services;
            }
            catch (System.Exception ex)
            {
                Console.WriteLine("Microi：注入消息队列插件失败-2：" + ex.Message);
                return services;
            }
        }
    }
}

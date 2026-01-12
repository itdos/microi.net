using Dos.Common;
using Microi.net;
using RabbitMQ.Client;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public class MicroiRabbitMQSingleConnection : IMicroiMQConnection
    {
        private static IConnection publishConnection;
        private static IConnection receiveConnection;
        private static object publishConnectionLock = new object();
        private static object receiveConnectionLock = new object();

        /// <summary>
        /// 获取生产者连接，使用单例
        /// </summary>
        /// <returns></returns>
        public IConnection GetPublishConnection()
        {
            if (publishConnection == null)
            {
                lock (publishConnectionLock)
                {
                    if (publishConnection == null)
                    {
                        //publishConnection = GetConnectionFactory().CreateConnection();
                        publishConnection = GetConnectionFactory().CreateConnectionAsync().GetAwaiter().GetResult();
                    }
                }
            }

            return publishConnection;
        }

        /// <summary>
        /// 获取消费者连接，使用单例
        /// </summary>
        /// <returns></returns>
        public IConnection GetReceiveConnection()
        {
            if (receiveConnection == null)
            {
                lock (receiveConnectionLock)
                {
                    if (receiveConnection == null)
                    {
                        //receiveConnection = GetConnectionFactory().CreateConnection();
                        receiveConnection = GetConnectionFactory().CreateConnectionAsync().GetAwaiter().GetResult();
                    }
                }
            }

            return receiveConnection;
        }

        private ConnectionFactory GetConnectionFactory()
        {
            var osClientName = DiyTokenExtend.GetCurrentOsClient();
            var clientModel = OsClient.GetClient(osClientName);
            // 此处账号密码以及ip和端口都要走配置
            var connectionFactory = new ConnectionFactory()
            {
                HostName = clientModel.MQHost,
                Port = Convert.ToInt32(clientModel.MQPort),
                UserName = clientModel.MQUserName,
                Password = clientModel.MQPassword,
                VirtualHost = clientModel.MQVitrualHost
            };
            return connectionFactory;
        }
    }
}

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
    public class MicroiRabbitMQClusterConnection : IMicroiMQConnection
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
                        //publishConnection = GetConnectionFactory().CreateConnection(GetAmqpTcpEndpoints());
                        publishConnection = GetConnectionFactory().CreateConnectionAsync(GetAmqpTcpEndpoints()).GetAwaiter().GetResult();
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
                        //receiveConnection = GetConnectionFactory().CreateConnection(GetAmqpTcpEndpoints());
                        receiveConnection = GetConnectionFactory().CreateConnectionAsync(GetAmqpTcpEndpoints()).GetAwaiter().GetResult();
                    }
                }
            }

            return receiveConnection;
        }

        private ConnectionFactory GetConnectionFactory()
        {
            var clientModel = GetClientModel();
            var connectionFactory = new ConnectionFactory()
            {
                UserName = clientModel.MQUserName,
                Password = clientModel.MQPassword,
                VirtualHost = clientModel.MQVitrualHost
            };
            return connectionFactory;
        }

        private List<AmqpTcpEndpoint> GetAmqpTcpEndpoints()
        {
            var clientModel = GetClientModel();
            if (String.IsNullOrEmpty(clientModel.MQHost))
            {
                Console.WriteLine("MQ地址信息不存在");
                return null;
            }
            List<AmqpTcpEndpoint> amqpList = new List<AmqpTcpEndpoint>();
            var hostArr = clientModel.MQHost.Split(',');
            foreach (var host in hostArr)
            {
                amqpList.Add(new AmqpTcpEndpoint { HostName = host, Port = Convert.ToInt32(clientModel.MQPort) });
            }
            return amqpList;
        }

        private OsClientSecret GetClientModel()
        {
            var osClientName = DiyTokenExtend.GetCurrentOsClient();
            return OsClient.GetClient(osClientName);
        }
    }
}

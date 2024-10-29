using RabbitMQ.Client;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public class MicroiMQReceiveInfo
    {
        public string DllName {  get; set; }

        public string ClassName { get; set; }

        public string MethodName { get; set; }

        // 1=接口引擎   2=定制开发
        public int Type { get; set; }

        public string ApiEngineKey { get; set; }

        public string QueueName { get; set; }

        public bool FailToReject { get; set; }

        public string Id { get; set; }

        public IModel Channel { get; set; }

        public int Count { get; set; }
    }
}

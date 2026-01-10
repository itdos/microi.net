using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public class MicroiMQConst
    {
        // 单节点
        public const string Connection_Single = "1";
        // 集群
        public const string Connection_Cluster = "2";

        // 定制开发
        public const string MQTypeDevelopment = "2";
        // 接口引擎
        public const string MQTypeApiEngineKey = "1";

        public const string queueTable = "diy_queue_receive";

        public const string queueLogTable = "diy_queue_receive_log";
    }
}

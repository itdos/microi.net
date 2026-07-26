using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public class MicroiMQTest
    {
        public bool GetMessage(object msg)
        {
            MicroiEngine.QueueSystemLog(null, "MQ", "TestMessageReceived", "MQ 测试消费者收到消息", msg?.ToString(), 1, true);
            return true;
        }
    }
}

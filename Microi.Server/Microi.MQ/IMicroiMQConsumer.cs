using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public interface IMicroiMQConsumer
    {
        void ConsumerInit();
        
        /// <summary>
        /// 停止消费者（优雅关闭）
        /// </summary>
        void Stop();
    }
}

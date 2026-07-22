using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    public interface IMicroiMQ
    {
        Task<DosResult> SendMsg(MicroiMQSendInfo sendInfo);

        /// <summary>
        /// 为指定租户注册临时消费者。队列名会在服务端强制转换为租户物理队列名。
        /// </summary>
        Task ReceiveMsgAsync(string osClient, string queueName);

        /// <summary>
        /// 关闭指定租户的队列通道；不能只按队列名关闭，避免跨租户误操作。
        /// </summary>
        Task CloseChannelAsync(string osClient, string queueName);
    }
}

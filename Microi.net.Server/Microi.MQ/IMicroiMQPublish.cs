using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public interface IMicroiMQPublish
    {
        Task<MicroiMqResult> SendMsg(MicroiMQSendInfo sendInfo);

        void ReceiveMsg(string queueName);


        void CloseChannel(string queueName);
    }
}

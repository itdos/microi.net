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

        void ReceiveMsg(string queueName);


        void CloseChannel(string queueName);
    }
}

using RabbitMQ.Client;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Microi.net
{
    public interface IMicroiMQConnection
    {
        IConnection GetPublishConnection();
        IConnection GetReceiveConnection();

    }
}

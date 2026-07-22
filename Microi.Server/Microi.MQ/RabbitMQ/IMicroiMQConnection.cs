using RabbitMQ.Client;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace Microi.net
{
    public interface IMicroiMQConnection : IAsyncDisposable
    {
        Task<IConnection> GetPublishConnectionAsync(string osClient, CancellationToken cancellationToken = default);
        Task<IConnection> GetReceiveConnectionAsync(string osClient, CancellationToken cancellationToken = default);

    }
}

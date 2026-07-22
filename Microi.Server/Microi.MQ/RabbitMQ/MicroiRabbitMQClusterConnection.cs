using RabbitMQ.Client;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Microi.net
{
    internal sealed class MicroiRabbitMQClusterConnection : TenantRabbitMQConnectionBase
    {
        protected override Task<IConnection> CreateConnectionAsync(
            TenantRabbitMQConnectionSettings settings,
            string role,
            CancellationToken cancellationToken)
        {
            var endpoints = settings.Hosts
                .Select(host => new AmqpTcpEndpoint { HostName = host, Port = settings.Port })
                .ToList();
            return CreateFactory(settings, role).CreateConnectionAsync(endpoints, cancellationToken);
        }
    }
}

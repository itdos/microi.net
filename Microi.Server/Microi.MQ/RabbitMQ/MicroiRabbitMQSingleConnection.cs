using RabbitMQ.Client;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Microi.net
{
    internal sealed class MicroiRabbitMQSingleConnection : TenantRabbitMQConnectionBase
    {
        protected override Task<IConnection> CreateConnectionAsync(
            TenantRabbitMQConnectionSettings settings,
            string role,
            CancellationToken cancellationToken)
        {
            var factory = CreateFactory(settings, role);
            if (settings.Hosts.Count == 1)
            {
                return factory.CreateConnectionAsync(cancellationToken);
            }

            var endpoints = settings.Hosts
                .Select(host => new AmqpTcpEndpoint { HostName = host, Port = settings.Port })
                .ToList();
            return factory.CreateConnectionAsync(endpoints, cancellationToken);
        }
    }
}

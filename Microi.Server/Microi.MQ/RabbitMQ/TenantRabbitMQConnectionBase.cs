using Dos.Common;
using Newtonsoft.Json.Linq;
using RabbitMQ.Client;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// RabbitMQ 连接的租户级缓存。连接只能复用同一租户的专用账号和 vhost，
    /// 不能再由第一个请求的租户决定整个进程的全局连接。
    /// </summary>
    internal abstract class TenantRabbitMQConnectionBase : IMicroiMQConnection
    {
        private readonly ConcurrentDictionary<string, Lazy<Task<IConnection>>> _publishConnections =
            new ConcurrentDictionary<string, Lazy<Task<IConnection>>>(StringComparer.OrdinalIgnoreCase);
        private readonly ConcurrentDictionary<string, Lazy<Task<IConnection>>> _receiveConnections =
            new ConcurrentDictionary<string, Lazy<Task<IConnection>>>(StringComparer.OrdinalIgnoreCase);

        public Task<IConnection> GetPublishConnectionAsync(string osClient, CancellationToken cancellationToken = default)
        {
            return GetConnectionAsync(_publishConnections, osClient, "publisher", cancellationToken);
        }

        public Task<IConnection> GetReceiveConnectionAsync(string osClient, CancellationToken cancellationToken = default)
        {
            return GetConnectionAsync(_receiveConnections, osClient, "consumer", cancellationToken);
        }

        protected abstract Task<IConnection> CreateConnectionAsync(
            TenantRabbitMQConnectionSettings settings,
            string role,
            CancellationToken cancellationToken);

        protected static ConnectionFactory CreateFactory(TenantRabbitMQConnectionSettings settings, string role)
        {
            var factory = new ConnectionFactory
            {
                HostName = settings.Hosts[0],
                Port = settings.Port,
                UserName = settings.UserName,
                Password = settings.Password,
                VirtualHost = settings.VirtualHost,
                AutomaticRecoveryEnabled = true,
                TopologyRecoveryEnabled = true,
                ClientProvidedName = $"microi:{role}:{settings.OsClient}"
            };
            if (settings.UseTls)
            {
                factory.Ssl.Enabled = true;
                factory.Ssl.ServerName = string.IsNullOrWhiteSpace(settings.TlsServerName)
                    ? settings.Hosts[0]
                    : settings.TlsServerName;
            }
            return factory;
        }

        private async Task<IConnection> GetConnectionAsync(
            ConcurrentDictionary<string, Lazy<Task<IConnection>>> cache,
            string osClient,
            string role,
            CancellationToken cancellationToken)
        {
            var tenant = TenantRabbitMQConnectionSettings.NormalizeTenant(osClient);
            cancellationToken.ThrowIfCancellationRequested();

            while (true)
            {
                var lazy = cache.GetOrAdd(tenant, key =>
                    new Lazy<Task<IConnection>>(
                        () => CreateConnectionAsync(
                            TenantRabbitMQConnectionSettings.Load(key),
                            role,
                            CancellationToken.None),
                        LazyThreadSafetyMode.ExecutionAndPublication));

                try
                {
                    var connection = await lazy.Value.ConfigureAwait(false);
                    cancellationToken.ThrowIfCancellationRequested();
                    if (connection != null && connection.IsOpen)
                    {
                        return connection;
                    }

                    cache.TryRemove(tenant, out _);
                    if (connection != null)
                    {
                        await connection.DisposeAsync().ConfigureAwait(false);
                    }
                }
                catch
                {
                    cache.TryRemove(tenant, out _);
                    throw;
                }
            }
        }

        public async ValueTask DisposeAsync()
        {
            var connections = _publishConnections.Values
                .Concat(_receiveConnections.Values)
                .Distinct()
                .ToArray();

            _publishConnections.Clear();
            _receiveConnections.Clear();

            foreach (var lazy in connections)
            {
                if (!lazy.IsValueCreated) continue;
                try
                {
                    var connection = await lazy.Value.ConfigureAwait(false);
                    if (connection != null)
                    {
                        await connection.DisposeAsync().ConfigureAwait(false);
                    }
                }
                catch
                {
                    // DI 容器退出时尽力释放；连接创建本身的异常已在调用点记录。
                }
            }
        }
    }

    internal sealed class TenantRabbitMQConfigurationException : InvalidOperationException
    {
        public TenantRabbitMQConfigurationException(string message) : base(message) { }
    }

    internal sealed class TenantRabbitMQConnectionSettings
    {
        // 仅用于抑制单节点重复诊断；配置事实仍来自共享SaaS配置，不能以此字典作为业务状态。
        private static readonly ConcurrentDictionary<string, int> _configurationFailureCounts =
            new ConcurrentDictionary<string, int>(StringComparer.Ordinal);

        public string OsClient { get; private set; }
        public IReadOnlyList<string> Hosts { get; private set; }
        public int Port { get; private set; }
        public string UserName { get; private set; }
        public string Password { get; private set; }
        public string VirtualHost { get; private set; }
        public bool UseTls { get; private set; }
        public string TlsServerName { get; private set; }

        public static TenantRabbitMQConnectionSettings Load(string osClient)
        {
            var tenant = NormalizeTenant(osClient);
            var client = OsClientExtend.GetClient(tenant);
            var model = client?.OsClientModel
                        ?? throw RejectConfiguration(tenant, $"租户[{tenant}]的 SaaS 配置不存在，RabbitMQ 已拒绝连接。");

            var hosts = ReadRequired(model, "MQHost", tenant)
                .Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(value => value.Trim())
                .Where(value => value.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
            if (hosts.Length == 0)
            {
                throw RejectConfiguration(tenant, $"租户[{tenant}]未配置 MQHost，RabbitMQ 已拒绝回退主租户配置。");
            }

            if (!int.TryParse(ReadRequired(model, "MQPort", tenant), out var port)
                || port < 1
                || port > 65535)
            {
                throw RejectConfiguration(tenant, $"租户[{tenant}]的 MQPort 无效，RabbitMQ 已拒绝连接。");
            }

            var settings = new TenantRabbitMQConnectionSettings
            {
                OsClient = tenant,
                Hosts = hosts,
                Port = port,
                UserName = ReadRequired(model, "MQUserName", tenant),
                Password = ReadRequired(model, "MQPassword", tenant),
                VirtualHost = ReadRequired(model, "MQVitrualHost", tenant),
                UseTls = ReadBoolean(model, "MQUseTls"),
                TlsServerName = model["MQTlsServerName"]?.Val<string>()?.Trim()
            };

            EnsureDedicatedIdentity(settings);
            return settings;
        }

        public static string NormalizeTenant(string osClient)
        {
            return TenantConfigurationSecurity.NormalizeTenantId(osClient);
        }

        private static string ReadRequired(JObject model, string field, string tenant)
        {
            var value = model[field]?.Val<string>()?.Trim();
            if (string.IsNullOrWhiteSpace(value))
            {
                throw RejectConfiguration(
                    tenant,
                    $"租户[{tenant}]未配置 {field}，RabbitMQ 已 fail-closed，禁止回退主租户账号。");
            }
            return value;
        }

        private static bool ReadBoolean(JObject model, string field)
        {
            var value = model[field];
            if (value == null || value.Type == JTokenType.Null) return false;
            if (value.Type == JTokenType.Boolean) return value.Value<bool>();
            var text = value.Val<string>()?.Trim();
            return string.Equals(text, "1", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(text, "true", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(text, "yes", StringComparison.OrdinalIgnoreCase);
        }

        private static void EnsureDedicatedIdentity(TenantRabbitMQConnectionSettings settings)
        {
            foreach (var pair in OsClientExtend.ClientList)
            {
                if (string.Equals(pair.Key, settings.OsClient, StringComparison.OrdinalIgnoreCase)) continue;
                var model = pair.Value?.OsClientModel;
                if (model == null) continue;

                var otherUser = model["MQUserName"]?.Val<string>()?.Trim();
                var otherPassword = model["MQPassword"]?.Val<string>()?.Trim();
                var otherVirtualHost = model["MQVitrualHost"]?.Val<string>()?.Trim();

                if (!string.IsNullOrWhiteSpace(otherUser)
                    && string.Equals(settings.UserName, otherUser, StringComparison.Ordinal))
                {
                    throw RejectConfiguration(
                        settings.OsClient,
                        $"租户[{settings.OsClient}]与租户[{pair.Key}]共用了 MQUserName，RabbitMQ 已拒绝连接；请为每个租户创建专用账号。");
                }
                if (!string.IsNullOrWhiteSpace(otherPassword)
                    && string.Equals(settings.Password, otherPassword, StringComparison.Ordinal))
                {
                    throw RejectConfiguration(
                        settings.OsClient,
                        $"租户[{settings.OsClient}]与租户[{pair.Key}]共用了 MQPassword，RabbitMQ 已拒绝连接；请为每个租户生成独立随机密码。");
                }
                if (!string.IsNullOrWhiteSpace(otherVirtualHost)
                    && string.Equals(settings.VirtualHost, otherVirtualHost, StringComparison.Ordinal))
                {
                    throw RejectConfiguration(
                        settings.OsClient,
                        $"租户[{settings.OsClient}]与租户[{pair.Key}]共用了 MQVitrualHost，RabbitMQ 已拒绝连接；请为每个租户创建专用 vhost 和 ACL。");
                }
            }
        }

        private static TenantRabbitMQConfigurationException RejectConfiguration(string tenant, string message)
        {
            var key = tenant + "|" + message;
            var attempt = _configurationFailureCounts.AddOrUpdate(key, 1, (_, previous) => previous + 1);
            if (attempt <= 3 || attempt % 10 == 0)
            {
                MicroiEngine.QueueSystemLog(
                    tenant,
                    "RabbitMQ",
                    "ConfigurationRejected",
                    "RabbitMQ 租户配置不安全或不完整，已拒绝连接",
                    $"第{attempt}次检测失败。{message}",
                    3,
                    false,
                    tenant);
            }
            return new TenantRabbitMQConfigurationException(message);
        }
    }
}

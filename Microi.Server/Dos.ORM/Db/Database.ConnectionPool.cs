using System;
using System.Collections.Concurrent;
using System.Data.Common;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using MySql.Data.MySqlClient;
using System.Data.SqlClient;

namespace Dos.ORM
{
    /// <summary>只公开脱敏的本节点连接池状态，不把驱动内部计数推测成实际占用数。</summary>
    public sealed class ConnectionPoolSnapshot
    {
        public string PoolId { get; set; }
        public string Provider { get; set; }
        public string DriverVersion { get; set; }
        public bool? Pooling { get; set; }
        public long? MaximumPoolSize { get; set; }
        public long? ConnectionTimeoutSeconds { get; set; }
        public bool CanReset { get; set; }
        public int Opening { get; set; }
        public long Generation { get; set; }
        public double BackoffSeconds { get; set; }
        public string FailureCode { get; set; }
    }

    public sealed partial class Database
    {
        private sealed class PoolRuntime
        {
            internal readonly object Gate = new object();
            internal int Opening;
            internal long Generation;
        }
        private static readonly ConcurrentDictionary<string, PoolRuntime> PoolRuntimes = new ConcurrentDictionary<string, PoolRuntime>();
        private static readonly AsyncLocal<bool> IsolatedConnections = new AsyncLocal<bool>();

        /// <summary>
        /// 仅供可信宿主应急鉴权使用。独立连接不参与故障池，调用者必须限制并发并及时释放作用域。
        /// 不降低 DiyToken、主库权限复核或访问密钥范围要求。
        /// </summary>
        public static IDisposable BeginIsolatedConnections()
        {
            var previous = IsolatedConnections.Value;
            IsolatedConnections.Value = true;
            return new ConnectionScope(previous);
        }
        private sealed class ConnectionScope : IDisposable
        {
            private readonly bool previous;
            private bool disposed;
            internal ConnectionScope(bool previous) { this.previous = previous; }
            public void Dispose()
            {
                if (disposed) return;
                disposed = true;
                IsolatedConnections.Value = previous;
            }
        }

        /// <summary>使用稳定摘要标识准确的驱动池；不输出端点、账号或连接串。</summary>
        public string ConnectionPoolId
        {
            get
            {
                using (var sha = SHA256.Create())
                    return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(
                        dbProvider.DbProviderFactory.GetType().FullName + "\0" + ConnectionString))).Replace("-", "").ToLowerInvariant();
            }
        }

        private string EffectiveConnectionString()
        {
            if (!IsolatedConnections.Value) return ConnectionString;
            // 只对已验证的驱动开放无池鉴权；未知驱动拒绝，不能悄悄回落到故障池。
            if (dbProvider.DbProviderFactory is MySqlClientFactory)
                return new MySqlConnectionStringBuilder(ConnectionString) { Pooling = false, ConnectionTimeout = 5, DefaultCommandTimeout = 5 }.ConnectionString;
            if (dbProvider.DbProviderFactory is SqlClientFactory)
                return new SqlConnectionStringBuilder(ConnectionString) { Pooling = false, ConnectTimeout = 5 }.ConnectionString;
            throw new NotSupportedException("DatabasePoolRecoveryProviderUnsupported");
        }

        /// <summary>当前进程的池状态；Opening 是正在申请连接的请求数，并非驱动已借出连接数。</summary>
        public ConnectionPoolSnapshot GetConnectionPoolSnapshot()
        {
            var key = GetConnectionGuardKey();
            var runtime = PoolRuntimes.GetOrAdd(key, _ => new PoolRuntime());
            ConnectionBackoffFailureCodes.TryGetValue(key, out var failure);
            var mysql = dbProvider.DbProviderFactory is MySqlClientFactory ? new MySqlConnectionStringBuilder(ConnectionString) : null;
            var sql = dbProvider.DbProviderFactory is SqlClientFactory ? new SqlConnectionStringBuilder(ConnectionString) : null;
            return new ConnectionPoolSnapshot
            {
                PoolId = key, Provider = dbProvider.DbProviderFactory.GetType().Assembly.GetName().Name,
                DriverVersion = dbProvider.DbProviderFactory.GetType().Assembly.GetName().Version?.ToString(),
                Pooling = mysql?.Pooling ?? sql?.Pooling,
                MaximumPoolSize = mysql != null ? (long?)mysql.MaximumPoolSize : sql?.MaxPoolSize,
                ConnectionTimeoutSeconds = mysql != null ? (long?)mysql.ConnectionTimeout : sql?.ConnectTimeout,
                CanReset = dbProvider.DbProviderFactory is MySqlClientFactory || dbProvider.DbProviderFactory is SqlClientFactory,
                Opening = Volatile.Read(ref runtime.Opening), Generation = Interlocked.Read(ref runtime.Generation),
                BackoffSeconds = Math.Ceiling(GetConnectionBackoffRemaining(key).TotalSeconds), FailureCode = failure
            };
        }

        /// <summary>
        /// 仅轮换本对象准确对应的池，不关闭借出的事务、不重放 SQL。
        /// 旧事务归还后由驱动丢弃；持续泄漏、数据库不可达仍需处理原始原因。
        /// </summary>
        public void ResetConnectionPool()
        {
            if (IsolatedConnections.Value) throw new InvalidOperationException("CannotResetFromIsolatedScope");
            var key = GetConnectionGuardKey();
            var runtime = PoolRuntimes.GetOrAdd(key, _ => new PoolRuntime());
            lock (runtime.Gate)
            {
                using (var connection = dbProvider.DbProviderFactory.CreateConnection())
                {
                    connection.ConnectionString = ConnectionString;
                    if (connection is MySqlConnection mysql) MySqlConnection.ClearPool(mysql);
                    else if (connection is SqlConnection sql) SqlConnection.ClearPool(sql);
                    else throw new NotSupportedException("DatabasePoolRecoveryProviderUnsupported");
                }
                // 在同一门内推进代数，恢复前已在途的 Open 失败不得重新熔断新池。
                Interlocked.Increment(ref runtime.Generation);
                ConnectionBackoffUntil.TryRemove(key, out _);
                ConnectionBackoffFailureCodes.TryRemove(key, out _);
            }
        }

        /// <summary>恢复后通过原连接串借用真实业务池验证；不以无池鉴权成功冒充恢复成功。</summary>
        public async Task<string> ProbeConnectionPoolAsync(CancellationToken cancellationToken)
        {
            if (IsolatedConnections.Value) throw new InvalidOperationException("CannotProbeFromIsolatedScope");
            try
            {
                using (var connection = CreateConnection())
                {
                    await OpenConnectionWithGuardAsync(connection, cancellationToken).ConfigureAwait(false);
                    using (var command = connection.CreateCommand())
                    {
                        command.CommandText = "SELECT 1";
                        command.CommandTimeout = 5;
                        await command.ExecuteScalarAsync(cancellationToken).ConfigureAwait(false);
                    }
                }
                return null;
            }
            catch (OperationCanceledException) { return "DatabaseProbeTimeout"; }
            catch (Exception ex) { return ClassifyConnectionFailure(ex); }
        }
    }
}

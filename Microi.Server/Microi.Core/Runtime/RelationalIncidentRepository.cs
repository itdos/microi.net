using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using Dos.ORM;
using MySql.Data.MySqlClient;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>关键事故的独立 MySQL 持久存储。只使用已加载租户主库；建表由系统日志应用包交付。
    /// 业务池故障时使用有界无池连接，绝不共享业务事务或向普通 V8 开放任意 SQL。</summary>
    public sealed class RelationalIncidentRepository
    {
        public const string TableName = "mci_runtime_incident";
        public const int MaximumPayloadBytes = 256 * 1024;
        private static readonly SemaphoreSlim Connections = new SemaphoreSlim(2, 2);
        private readonly Func<string, DbSession> _resolve;
        public RelationalIncidentRepository() : this(Resolve) { }
        public RelationalIncidentRepository(Func<string, DbSession> resolve) { _resolve = resolve; }
        private static DbSession Resolve(string tenant)
        {
            if (OsClientExtend.ClientList.TryGetValue(tenant, out var client) && string.Equals(client.OsClient, tenant, StringComparison.OrdinalIgnoreCase)) return client.Db;
            throw new InvalidOperationException("IncidentTenantNotLoaded");
        }

        private MySqlConnection Open(string tenant)
        {
            if (string.IsNullOrWhiteSpace(tenant) || tenant.Length > 80) throw new ArgumentException("InvalidIncidentTenant");
            var db = _resolve(tenant)?.Db ?? throw new InvalidOperationException("IncidentDatabaseUnavailable");
            using (var probe = db.DbProviderFactory.CreateConnection())
                if (!(probe is MySqlConnection)) throw new NotSupportedException("IncidentRelationalProviderRequiresMySql");
            var options = new MySqlConnectionStringBuilder(db.ConnectionString) { Pooling = false, ConnectionTimeout = 2, DefaultCommandTimeout = 2 };
            var connection = new MySqlConnection(options.ConnectionString);
            try { connection.Open(); return connection; } catch { connection.Dispose(); throw; }
        }

        /// <summary>幂等键包含租户；原子版本比较防止多节点重放旧记录覆盖新证据。</summary>
        public void Save(string tenant, JObject incident)
        {
            var id = incident.Value<string>("Id");
            if (!Guid.TryParseExact(id, "N", out _) || !string.Equals(tenant, incident.Value<string>("Tenant"), StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("InvalidIncidentIdentity");
            var payload = incident.ToString(Formatting.None);
            if (Encoding.UTF8.GetByteCount(payload) > MaximumPayloadBytes) throw new ArgumentException("IncidentPayloadTooLarge");
            var occurred = incident.Value<DateTime>("OccurredAtUtc").ToUniversalTime();
            var updated = incident.Value<DateTime>("UpdatedAtUtc").ToUniversalTime();
            if (occurred < DateTime.UtcNow.AddDays(-14)) throw new ArgumentOutOfRangeException("OccurredAtUtc", "IncidentOutsideRetentionWindow");
            if (!Connections.Wait(0)) throw new InvalidOperationException("IncidentStorageBusy");
            try
            {
                using var connection = Open(tenant);
                using var command = connection.CreateCommand(); command.CommandTimeout = 2;
                command.CommandText = "INSERT INTO mci_runtime_incident (Id,Tenant,IncidentId,OccurredAtUtc,UpdatedVersion,Payload,Summary) VALUES (@id,@tenant,@incident,@at,@version,@payload,@summary) ON DUPLICATE KEY UPDATE Payload=IF(UpdatedVersion<=VALUES(UpdatedVersion),VALUES(Payload),Payload),Summary=IF(UpdatedVersion<=VALUES(UpdatedVersion),VALUES(Summary),Summary),UpdatedVersion=GREATEST(UpdatedVersion,VALUES(UpdatedVersion))";
                command.Parameters.AddWithValue("@id", Identity(tenant, id)); command.Parameters.AddWithValue("@tenant", tenant.ToLowerInvariant());
                command.Parameters.AddWithValue("@incident", id); command.Parameters.AddWithValue("@at", TimeText(occurred));
                command.Parameters.AddWithValue("@version", updated.Ticks); command.Parameters.AddWithValue("@payload", payload);
                command.Parameters.AddWithValue("@summary", Summary(incident).ToString(Formatting.None)); command.ExecuteNonQuery();
                // 每次最多清理 32 条，最老优先；固定租户索引与期限，避免日志清理长事务。
                using var trim = connection.CreateCommand(); trim.CommandTimeout = 2;
                trim.CommandText = "DELETE FROM mci_runtime_incident WHERE Tenant=@tenant AND OccurredAtUtc<@expired ORDER BY OccurredAtUtc LIMIT 32";
                trim.Parameters.AddWithValue("@tenant", tenant.ToLowerInvariant()); trim.Parameters.AddWithValue("@expired", TimeText(DateTime.UtcNow.AddDays(-14))); trim.ExecuteNonQuery();
                // 硬容量：只保留最新 512 条；新旧节点共用同一租户行，不扫描 Payload。
                using var cutoff = connection.CreateCommand(); cutoff.CommandTimeout = 2;
                cutoff.CommandText = "SELECT OccurredAtUtc,Id FROM mci_runtime_incident WHERE Tenant=@tenant ORDER BY OccurredAtUtc DESC,Id DESC LIMIT 1 OFFSET 511";
                cutoff.Parameters.AddWithValue("@tenant", tenant.ToLowerInvariant());
                string oldest = null, oldestId = null;
                using (var reader = cutoff.ExecuteReader()) if (reader.Read()) { oldest = reader.GetString(0); oldestId = reader.GetString(1); }
                if (oldest != null)
                {
                    trim.CommandText = "DELETE FROM mci_runtime_incident WHERE Tenant=@tenant AND (OccurredAtUtc<@expired OR (OccurredAtUtc=@expired AND Id<@oldestId)) ORDER BY OccurredAtUtc,Id LIMIT 32";
                    trim.Parameters["@expired"].Value = oldest; trim.Parameters.AddWithValue("@oldestId", oldestId); trim.ExecuteNonQuery();
                }
            }
            finally { Connections.Release(); }
        }

        public IReadOnlyList<JObject> Read(string tenant, string incidentId = null)
        {
            if (incidentId != null && !Guid.TryParseExact(incidentId, "N", out _)) throw new ArgumentException("InvalidIncidentIdentity");
            if (!Connections.Wait(0)) throw new InvalidOperationException("IncidentStorageBusy");
            try
            {
                using var connection = Open(tenant);
                using var command = connection.CreateCommand(); command.CommandTimeout = 2;
                command.CommandText = incidentId == null
                    ? "SELECT Summary FROM mci_runtime_incident WHERE Tenant=@tenant AND OccurredAtUtc>=@expired ORDER BY OccurredAtUtc DESC LIMIT 50"
                    : "SELECT Payload FROM mci_runtime_incident WHERE Tenant=@tenant AND Id=@id AND OccurredAtUtc>=@expired LIMIT 1";
                command.Parameters.AddWithValue("@tenant", tenant.ToLowerInvariant()); command.Parameters.AddWithValue("@expired", TimeText(DateTime.UtcNow.AddDays(-14)));
                if (incidentId != null) command.Parameters.AddWithValue("@id", Identity(tenant, incidentId));
                using var reader = command.ExecuteReader(); var result = new List<JObject>();
                while (reader.Read())
                {
                    var text = reader.GetString(0);
                    if (Encoding.UTF8.GetByteCount(text) <= MaximumPayloadBytes)
                    {
                        var value = JObject.Parse(text);
                        if (string.Equals(value.Value<string>("Tenant"), tenant, StringComparison.OrdinalIgnoreCase)) result.Add(value);
                    }
                }
                return result;
            }
            finally { Connections.Release(); }
        }
        public static JObject Summary(JObject value) => new JObject(new[] { "Id", "Tenant", "BootId", "NodeId", "OccurredAtUtc", "UpdatedAtUtc", "Trigger", "Status", "PeakRssBytes", "BuildVersion", "Evidence", "StorageKind" }
            .Where(k => value[k] != null).Select(k => new JProperty(k, value[k].DeepClone())));
        private static string TimeText(DateTime date) => date.ToUniversalTime().ToString("yyyy-MM-dd HH:mm:ss.fff", System.Globalization.CultureInfo.InvariantCulture);
        private static string Identity(string tenant, string id)
        {
            using var sha = SHA256.Create();
            return BitConverter.ToString(sha.ComputeHash(Encoding.UTF8.GetBytes(tenant.ToLowerInvariant() + ":" + id))).Replace("-", "").ToLowerInvariant().Substring(0, 32);
        }
    }
}

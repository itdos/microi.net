using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;

namespace Microi.net
{
    /// <summary>
    /// MQTT 监听和租户 ACL 共用的主库权威开关快照。读取失败时立即清空，
    /// 不让旧的内存 OsClientModel 把已关闭或未完成迁移的租户重新开放。
    /// </summary>
    public sealed class MqttEnableState
    {
        private Dictionary<string, bool> _enabled = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
        private HashSet<string> _enabledBeforeRefresh = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        public bool IsEnabled(string osClient)
        {
            if (string.IsNullOrWhiteSpace(osClient)) return false;
            return Volatile.Read(ref _enabled).TryGetValue(osClient.Trim(), out var enabled) && enabled;
        }

        public void DisableAll()
        {
            CapturePreviousEnabled();
            Volatile.Write(ref _enabled, new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase));
        }

        public bool WasEnabledBeforeRefresh(string osClient)
        {
            if (string.IsNullOrWhiteSpace(osClient)) return false;
            return Volatile.Read(ref _enabledBeforeRefresh).Contains(osClient.Trim());
        }

        private void CapturePreviousEnabled()
        {
            var previous = Volatile.Read(ref _enabled);
            Volatile.Write(ref _enabledBeforeRefresh,
                new HashSet<string>(previous.Where(item => item.Value).Select(item => item.Key),
                    StringComparer.OrdinalIgnoreCase));
        }

        public void Refresh(OsClientSecret mainClient)
        {
            if (mainClient?.Db == null) throw new InvalidOperationException("主租户数据库不可用，MQTT 开关状态无法刷新。");

            var orm = MicroiEngine.ORM(mainClient.Db.Db.DbProvider.DatabaseType);
            var configTable = orm.GetTableName("sys_config");
            var versionField = orm.GetFieldName("ServerVersion");
            var enabledField = orm.GetFieldName("IsEnable");
            var versionRows = mainClient.Db
                .FromSql($"SELECT {orm.GetFieldName("Id")}, {versionField} FROM {configTable} WHERE {enabledField} = @p0")
                .AddInParameter("p0", 1)
                .ToList<ServerVersionRow>();
            if (versionRows.Count != 1 || string.IsNullOrWhiteSpace(versionRows[0]?.Id))
                throw new InvalidOperationException("主库启用的 sys_config 不唯一，MQTT 已拒绝监听。");
            var migrationApplied = MqttEnablePolicy.IsMigrationApplied(versionRows[0].ServerVersion);

            var osClientTable = orm.GetTableName("sys_osclients");
            var tenantField = orm.GetFieldName("OsClient");
            var mqttField = orm.GetFieldName("MqttEnable");
            var deletedField = orm.GetFieldName("IsDeleted");
            var activeField = orm.GetFieldName("IsEnable");
            var typeField = orm.GetFieldName("OsClientType");
            var networkField = orm.GetFieldName("OsClientNetwork");
            var rows = mainClient.Db.FromSql(
                    $"SELECT {tenantField}, {mqttField} FROM {osClientTable} " +
                    $"WHERE {typeField} = @p0 AND {networkField} = @p1 " +
                    $"AND {activeField} = @p2 AND ({deletedField} = 0 OR {deletedField} IS NULL)")
                .AddInParameter("p0", OsClientDefault.OsClientType)
                .AddInParameter("p1", OsClientDefault.OsClientNetwork)
                .AddInParameter("p2", 1)
                .ToList<MqttEnableRow>();

            var next = new Dictionary<string, bool>(StringComparer.OrdinalIgnoreCase);
            var duplicates = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var row in rows)
            {
                if (row?.OsClient == null) continue;
                var tenant = row.OsClient.Trim();
                if (tenant.Length == 0) continue;
                if (next.ContainsKey(tenant))
                {
                    duplicates.Add(tenant);
                    next[tenant] = false;
                    continue;
                }
                next.Add(tenant, MqttEnablePolicy.IsEnabled(row.MqttEnable?.ToString(), migrationApplied));
            }
            foreach (var tenant in duplicates) next[tenant] = false;
            CapturePreviousEnabled();
            Volatile.Write(ref _enabled, next);
        }

        public sealed class MqttEnableRow
        {
            public string OsClient { get; set; }
            public int? MqttEnable { get; set; }
        }

        public sealed class ServerVersionRow
        {
            public string Id { get; set; }
            public string ServerVersion { get; set; }
        }
    }
}

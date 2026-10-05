using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.ORM;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 将历史 sys_datasource 一次性迁移为带 DataSourceType 的 sys_apiengine。
    /// 迁移与旧表软删除处于同一数据库事务；失败时不会留下“新接口半成品、旧
    /// 数据已删除”的状态。后续启动只补迁仍未软删的记录，因此不会覆盖用户在
    /// 新接口引擎中继续维护的 ApiV8Code。
    /// </summary>
    public sealed class Upgrade34
    {
        public static string Version = "6.9.9.0";

        private static readonly string[] CandidateApiEngineColumns =
        {
            "Id", "CreateTime", "UpdateTime", "UserId", "UserName", "IsDeleted",
            "ApiName", "ApiEngineKey", "IsEnable", "ApiRole", "ApiV8Code", "Lock",
            "LockKey", "ApiRemark", "TestParam", "TestResult", "ApiAddress",
            "AllowAnonymous", "Files", "Category", "EnableLog", "StopHttp",
            "ResponseType", "Version", "ChangeHistory", "V8Limit", "DataSourceType"
        };

        public async Task<List<string>> Run(string osClient)
        {
            var messages = new List<string>();
            var cacheKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var client = OsClientExtend.GetClient(osClient);
                if (client?.Db == null)
                {
                    messages.Add("租户数据库连接不存在，无法迁移数据源引擎。");
                    return messages;
                }
                if (!client.Db.TableExists("sys_apiengine"))
                {
                    messages.Add("sys_apiengine 物理表不存在，无法迁移数据源引擎。");
                    return messages;
                }

                EnsureDataSourceTypeColumn(osClient, client);
                if (!client.Db.TableExists("sys_datasource")) return messages;

                var orm = MicroiEngine.ORM(client.Db.Db.DbProvider.DatabaseType);
                var apiColumns = CandidateApiEngineColumns
                    .Where(column => client.Db.ColumnExists("sys_apiengine", column))
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);
                var trans = client.Db.BeginTransaction();
                try
                {
                    var sourceRows = trans.FromSql($@"SELECT *
                            FROM {orm.GetTableName("sys_datasource")}
                            WHERE {orm.GetFieldName("IsDeleted")} IS NULL
                               OR {orm.GetFieldName("IsDeleted")} = @p0")
                        .AddInParameter("p0", 0)
                        .ToList<dynamic>()
                        .Select(item => JObject.FromObject((object)item))
                        .ToList();

                    foreach (var source in sourceRows)
                    {
                        UpgradeExecutionLeaseContext.ThrowIfLost();
                        var sourceId = source["Id"]?.ToString()?.Trim();
                        if (string.IsNullOrWhiteSpace(sourceId))
                            throw new InvalidOperationException("sys_datasource 存在 Id 为空的历史记录。");

                        var target = ResolveTarget(trans, orm, source);
                        var migrated = BuildMigratedApiEngineRow(
                            source,
                            target.Id,
                            target.ApiEngineKey);
                        var values = migrated.Properties()
                            .Where(property => apiColumns.Contains(property.Name))
                            .ToDictionary(
                                property => property.Name,
                                property => ToDbValue(property.Value),
                                StringComparer.OrdinalIgnoreCase);
                        if (target.Exists)
                        {
                            ExecuteUpdate(trans, orm, "sys_apiengine", target.Id, values);
                        }
                        else
                        {
                            ExecuteInsert(trans, orm, "sys_apiengine", values);
                        }

                        cacheKeys.Add(target.Id);
                        cacheKeys.Add(target.ApiEngineKey);
                        cacheKeys.Add(sourceId);
                        cacheKeys.Add(source["DataSourceKey"]?.ToString());
                    }

                    if (sourceRows.Count > 0)
                    {
                        trans.FromSql($@"UPDATE {orm.GetTableName("sys_datasource")}
                                SET {orm.GetFieldName("IsDeleted")} = @p0,
                                    {orm.GetFieldName("UpdateTime")} = @p1
                                WHERE {orm.GetFieldName("IsDeleted")} IS NULL
                                   OR {orm.GetFieldName("IsDeleted")} = @p2")
                            .AddInParameter("p0", 1)
                            .AddInParameter("p1", DateTime.Now)
                            .AddInParameter("p2", 0)
                            .ExecuteNonQuery();
                    }

                    trans.Commit();
                }
                catch
                {
                    if (!trans.IsCommitOrRollback) trans.Rollback();
                    throw;
                }
                finally
                {
                    trans.Close();
                }

                var cache = MicroiEngine.CacheTenant.Cache(osClient);
                foreach (var key in cacheKeys.Where(key => !string.IsNullOrWhiteSpace(key)))
                {
                    await cache.RemoveAsync(
                        $"Microi:{osClient}:FormData:sys_apiengine:{key.ToLowerInvariant()}")
                        .ConfigureAwait(false);
                    await cache.RemoveAsync(
                        $"Microi:{osClient}:FormData:sys_datasource:{key.ToLowerInvariant()}")
                        .ConfigureAwait(false);
                }
                await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_datasource")
                    .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                messages.Add("迁移数据源引擎到接口引擎失败：" + ex.Message);
            }
            return messages;
        }

        public static JObject BuildMigratedApiEngineRow(
            JObject source,
            string targetId,
            string targetApiEngineKey)
        {
            source ??= new JObject();
            var sourceId = source["Id"]?.ToString() ?? string.Empty;
            var sourceKey = source["DataSourceKey"]?.ToString() ?? string.Empty;
            var sourceType = source["DataSourceType"]?.ToString() ?? string.Empty;
            var code = ApiEngineDataSourceRuntime.SelectLegacyCode(
                source,
                out var normalizedType,
                out var sourceField);
            var createTime = source["CreateTime"]?.DeepClone() ?? JToken.FromObject(DateTime.Now);
            return new JObject
            {
                ["Id"] = targetId,
                ["CreateTime"] = createTime,
                ["UpdateTime"] = DateTime.Now,
                ["UserId"] = source["UserId"]?.DeepClone() ?? string.Empty,
                ["UserName"] = source["UserName"]?.DeepClone() ?? string.Empty,
                ["IsDeleted"] = 0,
                ["ApiName"] = ApiEngineDataSourceRuntime.BuildMigratedName(
                    source["DataSourceName"]?.ToString()),
                ["ApiEngineKey"] = targetApiEngineKey,
                ["IsEnable"] = source["IsEnable"]?.DeepClone() ?? 1,
                ["ApiRole"] = source["DataSourceRole"]?.DeepClone() ?? "[]",
                ["ApiV8Code"] = code,
                ["Lock"] = 0,
                ["LockKey"] = string.Empty,
                ["ApiRemark"] = ApiEngineDataSourceRuntime.BuildMigrationRemark(
                    sourceId,
                    sourceKey,
                    sourceType,
                    sourceField,
                    source["Remark"]?.ToString()),
                ["TestParam"] = source["TestParam"]?.DeepClone() ?? string.Empty,
                ["TestResult"] = source["TestResult"]?.DeepClone() ?? string.Empty,
                ["ApiAddress"] = "/apiengine/" + targetApiEngineKey,
                ["AllowAnonymous"] = source["AllowAnonymous"]?.DeepClone() ?? 0,
                ["Files"] = "[]",
                ["Category"] = "数据源引擎迁移",
                ["EnableLog"] = 0,
                ["StopHttp"] = 0,
                ["ResponseType"] = "JSON",
                ["Version"] = "v1.0.0",
                ["ChangeHistory"] = "2026-08-27 v1.0.0 从 sys_datasource 自动迁移；后续统一维护 ApiV8Code。",
                ["V8Limit"] = 0,
                ["DataSourceType"] = normalizedType
            };
        }

        private static void EnsureDataSourceTypeColumn(string osClient, OsClientSecret client)
        {
            if (client.Db.ColumnExists("sys_apiengine", "DataSourceType")) return;
            var result = MicroiEngine.ORM(client.Db.Db.DbProvider.DatabaseType)
                .AddColumn(new DbServiceParam
                {
                    OsClient = osClient,
                    TableName = "sys_apiengine",
                    FieldName = "DataSourceType",
                    FieldType = "varchar(50)",
                    FieldNotNull = false,
                    DbSession = client.Db
                });
            if (result.Code != 1 && !client.Db.ColumnExists("sys_apiengine", "DataSourceType"))
            {
                throw new InvalidOperationException(
                    "新增 sys_apiengine.DataSourceType 物理字段失败：" + result.Msg);
            }
        }

        private static MigrationTarget ResolveTarget(
            DbTrans trans,
            dynamic orm,
            JObject source)
        {
            var sourceId = source["Id"]?.ToString()?.Trim();
            var sourceKey = source["DataSourceKey"]?.ToString()?.Trim();
            var fallbackKey = ApiEngineDataSourceRuntime.BuildFallbackApiEngineKey(sourceId);
            var fallbackId = ApiEngineDataSourceRuntime.BuildFallbackApiEngineId(sourceId);
            var rows = trans.FromSql($@"SELECT * FROM {orm.GetTableName("sys_apiengine")}
                    WHERE {orm.GetFieldName("Id")} = @p0
                       OR {orm.GetFieldName("Id")} = @p1
                       OR {orm.GetFieldName("ApiEngineKey")} = @p2
                       OR {orm.GetFieldName("ApiEngineKey")} = @p3")
                .AddInParameter("p0", sourceId)
                .AddInParameter("p1", fallbackId)
                .AddInParameter("p2", sourceKey ?? string.Empty)
                .AddInParameter("p3", fallbackKey)
                .ToList<dynamic>()
                .Select(item => JObject.FromObject((object)item))
                .ToList();

            var existingMigration = rows.FirstOrDefault(item =>
                ApiEngineDataSourceRuntime.IsMigrationForSource(item, sourceId));
            if (existingMigration != null)
            {
                return new MigrationTarget(
                    existingMigration["Id"]?.ToString(),
                    existingMigration["ApiEngineKey"]?.ToString(),
                    true);
            }

            var idCollision = rows.Any(item => string.Equals(
                item["Id"]?.ToString(), sourceId, StringComparison.OrdinalIgnoreCase));
            var keyCollision = !string.IsNullOrWhiteSpace(sourceKey)
                && rows.Any(item => string.Equals(
                    item["ApiEngineKey"]?.ToString(),
                    sourceKey,
                    StringComparison.OrdinalIgnoreCase));
            var fallbackCollision = rows.FirstOrDefault(item =>
                string.Equals(item["Id"]?.ToString(), fallbackId, StringComparison.OrdinalIgnoreCase)
                || string.Equals(item["ApiEngineKey"]?.ToString(), fallbackKey, StringComparison.OrdinalIgnoreCase));
            if (fallbackCollision != null)
            {
                throw new InvalidOperationException(
                    $"数据源[{sourceKey ?? sourceId}]的稳定迁移 Id/Key 已被其它接口占用。");
            }

            return new MigrationTarget(
                idCollision ? fallbackId : sourceId,
                string.IsNullOrWhiteSpace(sourceKey) || sourceKey.Length > 50 || keyCollision
                    ? fallbackKey
                    : sourceKey,
                false);
        }

        private static void ExecuteInsert(
            DbTrans trans,
            dynamic orm,
            string tableName,
            IReadOnlyDictionary<string, object> values)
        {
            var columns = values.Keys.ToList();
            var command = trans.FromSql(
                $"INSERT INTO {orm.GetTableName(tableName)} "
                + $"({string.Join(",", columns.Select(column => (string)orm.GetFieldName(column)))}) VALUES "
                + $"({string.Join(",", columns.Select((_, index) => "@p" + index))})");
            for (var index = 0; index < columns.Count; index++)
                command.AddInParameter("p" + index, values[columns[index]]);
            command.ExecuteNonQuery();
        }

        private static void ExecuteUpdate(
            DbTrans trans,
            dynamic orm,
            string tableName,
            string id,
            IReadOnlyDictionary<string, object> values)
        {
            var columns = values.Keys
                .Where(column => !column.Equals("Id", StringComparison.OrdinalIgnoreCase)
                                 && !column.Equals("CreateTime", StringComparison.OrdinalIgnoreCase))
                .ToList();
            var command = trans.FromSql(
                $"UPDATE {orm.GetTableName(tableName)} SET "
                + string.Join(",", columns.Select((column, index) =>
                    orm.GetFieldName(column) + " = @p" + index))
                + $" WHERE {orm.GetFieldName("Id")} = @id");
            for (var index = 0; index < columns.Count; index++)
                command.AddInParameter("p" + index, values[columns[index]]);
            command.AddInParameter("id", id).ExecuteNonQuery();
        }

        private static object ToDbValue(JToken value)
        {
            if (value == null || value.Type == JTokenType.Null) return null;
            return value is JValue scalar
                ? scalar.Value
                : value.ToString(Formatting.None);
        }

        private sealed class MigrationTarget
        {
            public MigrationTarget(string id, string apiEngineKey, bool exists)
            {
                Id = id;
                ApiEngineKey = apiEngineKey;
                Exists = exists;
            }

            public string Id { get; }
            public string ApiEngineKey { get; }
            public bool Exists { get; }
        }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 启动协议字段的最小容量检查。只扩展已有 SQL Server 文本列，不覆盖类型、
    /// 排序规则或可空约束；默认值和索引继续由数据库保留，不重建业务表。
    /// </summary>
    internal static class SqlServerStringColumnCapacity
    {
        internal static bool Ready(OsClientSecret client, string tableName,
            IReadOnlyDictionary<string, string> contracts)
        {
            if (!IsSqlServer(client)) return true;
            var columns = ReadColumns(client, tableName);
            // 缺表由既有核心建表/应用包流程负责；不在容量检查中创建表。
            if (columns.Count == 0) return true;
            return contracts.All(contract => MinimumLength(contract.Value) == 0
                || columns.TryGetValue(contract.Key, out var column)
                    && BuildAlterSql(tableName, contract.Key, column, MinimumLength(contract.Value)) == null);
        }

        internal static int EnsureUnderLease(OsClientSecret client, string tableName,
            IReadOnlyDictionary<string, string> contracts)
        {
            if (!IsSqlServer(client)) return 0;
            UpgradeExecutionLeaseContext.ThrowIfLost();
            var columns = ReadColumns(client, tableName);
            if (columns.Count == 0) return 0;
            var changes = new List<KeyValuePair<string, string>>();
            foreach (var contract in contracts)
            {
                var minimumLength = MinimumLength(contract.Value);
                if (minimumLength == 0) continue;
                if (!columns.TryGetValue(contract.Key, out var column))
                    throw new InvalidOperationException($"启动字段容量检查缺少列：{tableName}.{contract.Key}。");
                var sql = BuildAlterSql(tableName, contract.Key, column, minimumLength);
                if (sql == null) continue;
                changes.Add(new KeyValuePair<string, string>(contract.Key, sql));
            }
            if (changes.Count == 0) return 0;
            ApplyChanges(client, tableName, columns.Values.First()["SchemaName"].ToString(), changes);
            foreach (var change in changes)
            {
                var column = columns[change.Key];
                UpgradeProgress.WriteLine($"Microi：【成功】【{client.OsClient}】【启动字段容量兼容】"
                    + $"{tableName}.{change.Key} 已扩容至 {column["TypeName"]}({MinimumLength(contracts[change.Key])})，保留原列属性及数据。");
            }
            UpgradeExecutionLeaseContext.ThrowIfLost();
            if (!Ready(client, tableName, contracts))
                throw new InvalidOperationException($"启动字段容量兼容强回读失败：{tableName}。");
            return changes.Count;
        }

        private static void ApplyChanges(OsClientSecret client, string tableName, string schemaName,
            List<KeyValuePair<string, string>> changes)
        {
            var table = Quote(schemaName) + "." + Quote(tableName);
            // 普通索引允许同类型扩容，筛选索引却会阻止 ALTER COLUMN。先完整读取定义，
            // 再在同一事务中暂存/恢复筛选索引；失败会回滚全部 DDL，不留下缺索引窗口。
            var indexes = client.Db.FromSql(@"SELECT i.*,ds.name AS DataSpaceName,ds.type AS DataSpaceType,
                    p.data_compression_desc AS DataCompression,st.no_recompute AS NoRecompute
                FROM sys.indexes i JOIN sys.data_spaces ds ON ds.data_space_id=i.data_space_id
                JOIN sys.partitions p ON p.object_id=i.object_id AND p.index_id=i.index_id AND p.partition_number=1
                JOIN sys.stats st ON st.object_id=i.object_id AND st.stats_id=i.index_id
                WHERE i.object_id=OBJECT_ID(@tableName,'U') AND i.has_filter=1 ORDER BY i.index_id")
                .AddInParameter("tableName", tableName).ToList<dynamic>()
                .Select(row => JObject.FromObject((object)row)).ToList();
            var restore = new List<string>();
            foreach (var index in indexes)
            {
                if (index.Value<int>("type") != 2 || index.Value<bool>("is_hypothetical")
                    || index.Value<string>("DataSpaceType")?.Trim() != "FG")
                    throw new InvalidOperationException($"启动字段容量兼容无法无损重建索引 {tableName}.{index["name"]} 的存储类型。");
                var fields = client.Db.FromSql(@"SELECT c.name,ic.key_ordinal,ic.is_descending_key,ic.is_included_column
                    FROM sys.index_columns ic JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
                    WHERE ic.object_id=OBJECT_ID(@tableName,'U') AND ic.index_id=@indexId
                    ORDER BY ic.key_ordinal,ic.index_column_id")
                    .AddInParameter("tableName", tableName).AddInParameter("indexId", index.Value<int>("index_id"))
                    .ToList<dynamic>().Select(row => JObject.FromObject((object)row)).ToList();
                var keys = fields.Where(field => field.Value<int>("key_ordinal") > 0)
                    .Select(field => Quote(field.Value<string>("name")) + (field.Value<bool>("is_descending_key") ? " DESC" : " ASC"));
                var included = fields.Where(field => field.Value<bool>("is_included_column"))
                    .Select(field => Quote(field.Value<string>("name"))).ToArray();
                var compression = index.Value<string>("DataCompression");
                if (compression != "NONE" && compression != "ROW" && compression != "PAGE")
                    throw new InvalidOperationException("无法保留筛选索引的数据压缩方式。");
                var options = new List<string>
                {
                    "PAD_INDEX=" + OnOff(index.Value<bool>("is_padded")),
                    "IGNORE_DUP_KEY=" + OnOff(index.Value<bool>("ignore_dup_key")),
                    "STATISTICS_NORECOMPUTE=" + OnOff(index.Value<bool>("NoRecompute")),
                    "ALLOW_ROW_LOCKS=" + OnOff(index.Value<bool>("allow_row_locks")),
                    "ALLOW_PAGE_LOCKS=" + OnOff(index.Value<bool>("allow_page_locks")),
                    "DATA_COMPRESSION=" + compression
                };
                // 目录中的 0 表示默认值；CREATE INDEX 只接受显式的 1..100。
                if (index.Value<int>("fill_factor") > 0)
                    options.Add("FILLFACTOR=" + index.Value<int>("fill_factor"));
                // SQL Server 2019 新增的选项仅在当前服务器返回该列时保留。
                if (index["optimize_for_sequential_key"] != null)
                    options.Add("OPTIMIZE_FOR_SEQUENTIAL_KEY=" + OnOff(index.Value<bool>("optimize_for_sequential_key")));
                restore.Add("CREATE " + (index.Value<bool>("is_unique") ? "UNIQUE " : "")
                    + "NONCLUSTERED INDEX " + Quote(index.Value<string>("name")) + " ON " + table
                    + " (" + string.Join(",", keys) + ")"
                    + (included.Length == 0 ? "" : " INCLUDE (" + string.Join(",", included) + ")")
                    + " WHERE " + index.Value<string>("filter_definition")
                    + " WITH (" + string.Join(",", options) + ") ON " + Quote(index.Value<string>("DataSpaceName")));
                if (index.Value<bool>("is_disabled"))
                    restore.Add("ALTER INDEX " + Quote(index.Value<string>("name")) + " ON " + table + " DISABLE");
            }
            using (var transaction = client.Db.BeginTransaction())
            {
                try
                {
                    var commands = indexes.Select(index => "DROP INDEX " + Quote(index.Value<string>("name")) + " ON " + table)
                        .Concat(changes.Select(change => change.Value)).Concat(restore);
                    foreach (var command in commands)
                    {
                        UpgradeExecutionLeaseContext.ConfirmOwnership();
                        transaction.FromSql(command).ExecuteNonQuery();
                    }
                    UpgradeExecutionLeaseContext.ConfirmOwnership();
                    transaction.Commit();
                }
                catch
                {
                    transaction.Rollback();
                    throw;
                }
            }
        }

        private static string OnOff(bool value) => value ? "ON" : "OFF";

        private static bool IsSqlServer(OsClientSecret client)
        {
            var provider = client?.Db?.Db.DbProvider.DatabaseType;
            return provider == DatabaseType.SqlServer || provider == DatabaseType.SqlServer9;
        }

        private static Dictionary<string, JObject> ReadColumns(OsClientSecret client, string tableName)
        {
            return client.Db.FromSql(@"SELECT SCHEMA_NAME(t.schema_id) AS SchemaName,c.name AS ColumnName,
                    ty.name AS TypeName,c.max_length AS MaxLength,c.is_nullable AS IsNullable,
                    c.collation_name AS CollationName,c.is_computed AS IsComputed,
                    ty.is_user_defined AS IsUserDefined
                FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id
                JOIN sys.types ty ON ty.user_type_id=c.user_type_id
                WHERE t.object_id=OBJECT_ID(@tableName, 'U')")
                .AddInParameter("tableName", tableName)
                .ToList<dynamic>()
                .Select(row => JObject.FromObject((object)row))
                .ToDictionary(row => row["ColumnName"].ToString(), StringComparer.OrdinalIgnoreCase);
        }

        internal static int MinimumLength(string declaredType)
        {
            var match = Regex.Match(declaredType ?? string.Empty,
                @"^\s*n?varchar\s*\(\s*([1-9][0-9]*)\s*\)\s*$", RegexOptions.IgnoreCase);
            return match.Success && int.TryParse(match.Groups[1].Value, out var length) ? length : 0;
        }

        internal static string BuildAlterSql(string tableName, string columnName, JObject column, int minimumLength)
        {
            if (minimumLength <= 0) throw new ArgumentOutOfRangeException(nameof(minimumLength));
            var type = column["TypeName"]?.ToString().ToLowerInvariant();
            var length = column.Value<int>("MaxLength");
            // max_length 是字节数；-1 是 MAX，text/ntext 的长度是内部指针，不能当容量收缩。
            if (type == "text" || type == "ntext") return null;
            if (type != "varchar" && type != "nvarchar")
                throw new InvalidOperationException($"启动字段 {tableName}.{columnName} 的类型 {type} 不能安全自动扩容。");
            if (length == -1) return null;
            var characters = type == "nvarchar" ? length / 2 : length;
            if (characters >= minimumLength) return null;
            if (column.Value<bool>("IsComputed") || column.Value<bool>("IsUserDefined"))
                throw new InvalidOperationException($"启动字段 {tableName}.{columnName} 使用计算列或自定义类型，不能自动改写。");
            if (minimumLength > (type == "nvarchar" ? 4000 : 8000))
                throw new InvalidOperationException($"启动字段 {tableName}.{columnName} 的容量超出固定文本类型上限。");
            var collation = column["CollationName"]?.ToString();
            if (!string.IsNullOrEmpty(collation) && !Regex.IsMatch(collation, @"^[A-Za-z0-9_]+$"))
                throw new InvalidOperationException("无效的 SQL Server 排序规则。");
            var schema = column["SchemaName"]?.ToString()
                ?? throw new InvalidOperationException("启动字段容量检查缺少表所属 Schema。");
            return "ALTER TABLE " + Quote(schema) + "." + Quote(tableName) + " ALTER COLUMN " + Quote(columnName)
                + " " + type + "(" + minimumLength + ")"
                + (string.IsNullOrEmpty(collation) ? "" : " COLLATE " + collation)
                + (column.Value<bool>("IsNullable") ? " NULL" : " NOT NULL");
        }

        private static string Quote(string identifier) => "[" + identifier.Replace("]", "]]") + "]";
    }
}

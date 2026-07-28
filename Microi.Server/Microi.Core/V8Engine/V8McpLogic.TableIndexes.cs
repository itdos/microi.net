using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 数据库索引管理公共逻辑。
    /// MCP 与后台“索引管理”共用本实现，保证校验、幂等与回读语义一致。
    /// 数据库方言差异只由 Dos.ORM 负责。
    /// </summary>
    public static partial class V8McpLogic
    {
        public sealed class TableIndexInfo
        {
            // 保留前端历史字段名，避免旧版索引管理组件失效。
            public string Key_name { get; set; }
            public string Column_name { get; set; }
            public int Non_unique { get; set; }
            public string Index_type { get; set; }
            public int Seq_in_index { get; set; }
            public int Is_primary { get; set; }

            public string Name => Key_name;
            public List<string> Columns { get; set; } = new List<string>();
            public bool IsUnique => Non_unique == 0;
            public bool IsPrimary => Is_primary == 1;
        }

        private static readonly Regex IndexIdentifierRegex =
            new Regex(@"^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.Compiled);

        private static string IndexToken(JObject row, params string[] names)
        {
            foreach (var name in names)
            {
                var token = row?.GetValue(name, StringComparison.OrdinalIgnoreCase);
                if (token != null && token.Type != JTokenType.Null && token.Type != JTokenType.Undefined)
                {
                    var value = token.ToString();
                    if (!value.DosIsNullOrWhiteSpace()) return value;
                }
            }
            return "";
        }

        private static int IndexInt(JObject row, int fallback, params string[] names)
        {
            var value = IndexToken(row, names);
            if (int.TryParse(value, out var number)) return number;
            if (bool.TryParse(value, out var boolean)) return boolean ? 1 : 0;
            return fallback;
        }

        private static string NormalizeIndexName(string tableName, string indexName, IEnumerable<string> columns)
        {
            var value = SafeString(indexName).Trim();
            if (!value.DosIsNullOrWhiteSpace()) return value;

            var raw = "idx_" + tableName + "_" + string.Join("_", columns ?? Array.Empty<string>());
            raw = Regex.Replace(raw, @"[^A-Za-z0-9_]", "_").ToLowerInvariant();
            if (raw.Length <= 60) return raw;

            // 保持跨数据库可用的稳定短名称，且并发重试仍会命中同一名称。
            var hash = Convert.ToBase64String(
                    System.Security.Cryptography.SHA256.Create().ComputeHash(Encoding.UTF8.GetBytes(raw)))
                .Replace("+", "").Replace("/", "").Replace("=", "")
                .Substring(0, 10)
                .ToLowerInvariant();
            return raw.Substring(0, 49).TrimEnd('_') + "_" + hash;
        }

        private static DosResult<object> ValidateIndexRequest(
            string osClient,
            string tableName,
            string indexName,
            IEnumerable<string> columns,
            bool requireColumns,
            out Dos.ORM.IMicroiORM orm,
            out Dos.ORM.DbSession db,
            out List<string> normalizedColumns)
        {
            orm = null;
            db = null;
            normalizedColumns = (columns ?? Array.Empty<string>())
                .Select(value => SafeString(value))
                .Select(value => value.Trim())
                .Where(value => !value.DosIsNullOrWhiteSpace())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (osClient.DosIsNullOrWhiteSpace())
                return new DosResult<object>(0, null, "OsClient 不能为空");
            if (tableName.DosIsNullOrWhiteSpace() || !IndexIdentifierRegex.IsMatch(tableName))
                return new DosResult<object>(0, null, "TableName 不合法，只允许英文字母、数字和下划线，且不能以数字开头");
            if (!indexName.DosIsNullOrWhiteSpace() && !IndexIdentifierRegex.IsMatch(indexName))
                return new DosResult<object>(0, null, "IndexName 不合法，只允许英文字母、数字和下划线，且不能以数字开头");
            if (indexName?.Length > 64)
                return new DosResult<object>(0, null, "IndexName 最长 64 个字符");
            if (requireColumns && normalizedColumns.Count == 0)
                return new DosResult<object>(0, null, "索引至少需要一个字段");
            if (normalizedColumns.Count > 8)
                return new DosResult<object>(0, null, "单个索引最多支持 8 个字段");
            var invalidColumn = normalizedColumns.FirstOrDefault(column => !IndexIdentifierRegex.IsMatch(column));
            if (!invalidColumn.DosIsNullOrWhiteSpace())
                return new DosResult<object>(0, null, $"索引字段名不合法：{invalidColumn}");

            try
            {
                var client = OsClientExtend.GetClient(osClient);
                db = client?.Db;
                if (db == null)
                    return new DosResult<object>(0, null, $"未找到租户 [{osClient}] 的数据库连接");
                orm = MicroiEngine.ORM(db.Db.DbProvider.DatabaseType);

                var columnResult = orm.GetColumns(new DbServiceParam
                {
                    TableName = tableName,
                    DbSession = db,
                    OsClient = osClient
                });
                if (columnResult?.Code != 1 || columnResult.Data == null)
                    return new DosResult<object>(0, null, $"读取表 [{tableName}] 物理字段失败：{columnResult?.Msg}");

                var physicalColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var token in JArray.FromObject(columnResult.Data))
                {
                    var row = token as JObject ?? JObject.FromObject(token);
                    var name = IndexToken(row, "column_name", "ColumnName", "COLUMN_NAME", "Name");
                    if (!name.DosIsNullOrWhiteSpace()) physicalColumns.Add(name);
                }
                if (physicalColumns.Count == 0)
                    return new DosResult<object>(0, null, $"物理表 [{tableName}] 不存在或没有可用字段");

                var missingColumns = normalizedColumns
                    .Where(column => !physicalColumns.Contains(column))
                    .ToList();
                if (missingColumns.Count > 0)
                    return new DosResult<object>(0, null,
                        $"索引字段在物理表 [{tableName}] 中不存在：{string.Join(", ", missingColumns)}");
            }
            catch (Exception ex)
            {
                return new DosResult<object>(0, null, $"校验物理表 [{tableName}] 失败：{ex.Message}");
            }

            return new DosResult<object>(1, null);
        }

        private static DosResult<List<TableIndexInfo>> ReadTableIndexes(
            string osClient,
            string tableName,
            Dos.ORM.IMicroiORM orm,
            Dos.ORM.DbSession db)
        {
            var result = orm.GetTableIndexes(new DbServiceParam
            {
                TableName = tableName,
                DbSession = db,
                OsClient = osClient
            });
            if (result?.Code != 1)
                return new DosResult<List<TableIndexInfo>>(0, null, result?.Msg ?? "读取索引失败");

            var groups = new Dictionary<string, List<(JObject Row, int Position)>>(StringComparer.OrdinalIgnoreCase);
            foreach (var token in result.Data == null ? new JArray() : JArray.FromObject(result.Data))
            {
                var row = token as JObject ?? JObject.FromObject(token);
                var name = IndexToken(row, "Key_name", "INDEX_NAME", "index_name", "Name");
                if (name.DosIsNullOrWhiteSpace()) continue;
                var position = IndexInt(row, 1, "Seq_in_index", "COLUMN_POSITION", "key_ordinal");
                if (!groups.TryGetValue(name, out var rows))
                {
                    rows = new List<(JObject Row, int Position)>();
                    groups[name] = rows;
                }
                rows.Add((row, position));
            }

            var indexes = groups.Select(group =>
            {
                var ordered = group.Value.OrderBy(item => item.Position).ToList();
                var first = ordered[0].Row;
                var uniqueness = IndexToken(first, "UNIQUENESS");
                var nonUnique = uniqueness.Equals("UNIQUE", StringComparison.OrdinalIgnoreCase)
                    ? 0
                    : uniqueness.DosIsNullOrWhiteSpace()
                        ? IndexInt(first, 1, "Non_unique", "NON_UNIQUE")
                        : 1;
                var isPrimary = IndexInt(first, 0, "Is_primary", "IS_PRIMARY", "is_primary_key") == 1
                    || group.Key.Equals("PRIMARY", StringComparison.OrdinalIgnoreCase);
                var columns = ordered
                    .Select(item => IndexToken(item.Row, "Column_name", "COLUMN_NAME", "column_name"))
                    .Where(value => !value.DosIsNullOrWhiteSpace())
                    .ToList();
                return new TableIndexInfo
                {
                    Key_name = group.Key,
                    Column_name = string.Join(", ", columns),
                    Non_unique = nonUnique,
                    Index_type = IndexToken(first, "Index_type", "INDEX_TYPE", "type_desc"),
                    Seq_in_index = ordered.First().Position,
                    Is_primary = isPrimary ? 1 : 0,
                    Columns = columns
                };
            })
            .OrderByDescending(index => index.IsPrimary)
            .ThenBy(index => index.Key_name, StringComparer.OrdinalIgnoreCase)
            .ToList();

            return new DosResult<List<TableIndexInfo>>(1, indexes, $"共 {indexes.Count} 个索引");
        }

        public static DosResult<List<TableIndexInfo>> GetTableIndexes(string osClient, string tableName)
        {
            var validation = ValidateIndexRequest(
                osClient, tableName, "", Array.Empty<string>(), false,
                out var orm, out var db, out _);
            if (validation.Code != 1)
                return new DosResult<List<TableIndexInfo>>(validation.Code ?? 0, null, validation.Msg);
            return ReadTableIndexes(osClient, tableName, orm, db);
        }

        public static DosResult<object> CreateTableIndex(
            string osClient,
            string tableName,
            string indexName,
            IEnumerable<string> columns,
            bool unique = false)
        {
            var normalizedName = NormalizeIndexName(tableName, indexName, columns);
            var validation = ValidateIndexRequest(
                osClient, tableName, normalizedName, columns, true,
                out var orm, out var db, out var normalizedColumns);
            if (validation.Code != 1) return validation;

            var before = ReadTableIndexes(osClient, tableName, orm, db);
            if (before.Code != 1)
                return new DosResult<object>(before.Code ?? 0, null, before.Msg);

            var sameName = before.Data.FirstOrDefault(index =>
                index.Key_name.Equals(normalizedName, StringComparison.OrdinalIgnoreCase));
            if (sameName != null)
            {
                var sameDefinition = sameName.IsUnique == unique
                    && sameName.Columns.SequenceEqual(normalizedColumns, StringComparer.OrdinalIgnoreCase);
                if (!sameDefinition)
                    return new DosResult<object>(0, null,
                        $"索引名 [{normalizedName}] 已存在，但字段或唯一性与本次请求不一致");
                return new DosResult<object>(1, new
                {
                    TableName = tableName,
                    Index = sameName,
                    Skipped = true,
                    Verification = "readback"
                }, $"索引 [{normalizedName}] 已存在，已幂等跳过");
            }

            var sameDefinitionIndex = before.Data.FirstOrDefault(index =>
                index.IsUnique == unique
                && index.Columns.SequenceEqual(normalizedColumns, StringComparer.OrdinalIgnoreCase));
            if (sameDefinitionIndex != null)
            {
                return new DosResult<object>(1, new
                {
                    TableName = tableName,
                    RequestedIndexName = normalizedName,
                    Index = sameDefinitionIndex,
                    Skipped = true,
                    EquivalentIndex = true,
                    Verification = "readback"
                }, $"字段组合已被索引 [{sameDefinitionIndex.Key_name}] 覆盖，已幂等跳过");
            }

            var addResult = orm.AddIndex(new DbServiceParam
            {
                TableName = tableName,
                IndexName = normalizedName,
                IndexColumns = string.Join(",", normalizedColumns),
                IndexUnique = unique,
                DbSession = db,
                OsClient = osClient
            });

            // 多节点可同时命中：数据库索引名是最终幂等边界，任何返回都必须回读确认。
            var after = ReadTableIndexes(osClient, tableName, orm, db);
            var created = after.Code == 1
                ? after.Data.FirstOrDefault(index =>
                    index.Key_name.Equals(normalizedName, StringComparison.OrdinalIgnoreCase)
                    && index.IsUnique == unique
                    && index.Columns.SequenceEqual(normalizedColumns, StringComparer.OrdinalIgnoreCase))
                : null;
            if (created == null)
                return new DosResult<object>(0, new
                {
                    TableName = tableName,
                    IndexName = normalizedName,
                    ProviderResult = addResult?.Msg,
                    ReadbackResult = after.Msg
                }, $"创建索引 [{normalizedName}] 后回读未确认：{addResult?.Msg}");

            return new DosResult<object>(1, new
            {
                TableName = tableName,
                Index = created,
                Skipped = false,
                RecoveredAfterConcurrentCreate = addResult?.Code != 1,
                Verification = "readback"
            }, addResult?.Code == 1
                ? $"索引 [{normalizedName}] 创建成功并已回读确认"
                : $"索引 [{normalizedName}] 的创建响应异常，但已通过回读确认存在");
        }

        public static DosResult<object> DropTableIndex(string osClient, string tableName, string indexName)
        {
            var validation = ValidateIndexRequest(
                osClient, tableName, indexName, Array.Empty<string>(), false,
                out var orm, out var db, out _);
            if (validation.Code != 1) return validation;
            if (indexName.DosIsNullOrWhiteSpace())
                return new DosResult<object>(0, null, "IndexName 不能为空");

            var before = ReadTableIndexes(osClient, tableName, orm, db);
            if (before.Code != 1)
                return new DosResult<object>(before.Code ?? 0, null, before.Msg);
            var existing = before.Data.FirstOrDefault(index =>
                index.Key_name.Equals(indexName, StringComparison.OrdinalIgnoreCase));
            if (existing == null)
                return new DosResult<object>(1, new
                {
                    TableName = tableName,
                    IndexName = indexName,
                    Skipped = true,
                    Verification = "readback"
                }, $"索引 [{indexName}] 不存在，已幂等跳过");
            if (existing.IsPrimary)
                return new DosResult<object>(0, null, $"索引 [{indexName}] 是主键索引，禁止通过索引管理删除");

            var dropResult = orm.DropIndex(new DbServiceParam
            {
                TableName = tableName,
                IndexName = indexName,
                DbSession = db,
                OsClient = osClient
            });
            var after = ReadTableIndexes(osClient, tableName, orm, db);
            var stillExists = after.Code == 1 && after.Data.Any(index =>
                index.Key_name.Equals(indexName, StringComparison.OrdinalIgnoreCase));
            if (after.Code != 1 || stillExists)
                return new DosResult<object>(0, new
                {
                    TableName = tableName,
                    IndexName = indexName,
                    ProviderResult = dropResult?.Msg,
                    ReadbackResult = after.Msg
                }, $"删除索引 [{indexName}] 后回读未确认");

            return new DosResult<object>(1, new
            {
                TableName = tableName,
                IndexName = indexName,
                Skipped = false,
                RecoveredAfterConcurrentDrop = dropResult?.Code != 1,
                Verification = "readback"
            }, dropResult?.Code == 1
                ? $"索引 [{indexName}] 删除成功并已回读确认"
                : $"索引 [{indexName}] 的删除响应异常，但已通过回读确认不存在");
        }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Dos.ORM;
using Newtonsoft.Json.Linq;
using MySql.Data.MySqlClient;

namespace Microi.net
{
    /// <summary>
    /// 登录及商城自举前的最小物理兼容门禁。业务必填由表单校验承担；普通物理列
    /// 允许 NULL，避免新接口遗漏旧字段时使整个宿主无法启动。只放宽约束，不回填业务值。
    /// </summary>
    internal static class RuntimeColumnNullability
    {
        internal static readonly string[] StartupTables =
        {
            "diy_table", "diy_field", "sys_apiengine", "sys_menu", "sys_user",
            "sys_config", "sys_osclients", "sys_role", "sys_microistore",
            "mci_ai_app_version", "mci_ai_app_file", "mci_app_stream_gate_transition"
        };

        internal static bool Ready(OsClientSecret client) => ReadRequiredColumns(client).Count == 0;

        private static List<JObject> ReadRequiredColumns(OsClientSecret client)
        {
            var database = client?.Db ?? throw new InvalidOperationException("可空字段门禁缺少租户数据库。");
            var type = database.Db.DbProvider.DatabaseType;
            var tables = string.Join(",", StartupTables.Select((_, index) => "@t" + index));
            string sql;
            if (type == DatabaseType.MySql)
            {
                sql = "SELECT c.TABLE_NAME AS TableName,c.COLUMN_NAME AS ColumnName,c.IS_NULLABLE AS IsNullable " +
                      "FROM information_schema.COLUMNS c JOIN information_schema.TABLES t " +
                      "ON t.TABLE_SCHEMA=c.TABLE_SCHEMA AND t.TABLE_NAME=c.TABLE_NAME " +
                      "WHERE c.TABLE_SCHEMA=DATABASE() AND t.TABLE_TYPE='BASE TABLE' " +
                      "AND c.TABLE_NAME IN (" + tables + ") AND (c.IS_NULLABLE='NO' OR c.COLUMN_DEFAULT IS NULL) " +
                      "AND LOWER(c.COLUMN_NAME)<>'id' AND c.COLUMN_KEY<>'PRI' " +
                      "AND c.EXTRA NOT LIKE '%auto_increment%' AND c.GENERATION_EXPRESSION=''";
            }
            else if (type == DatabaseType.SqlServer || type == DatabaseType.SqlServer9)
            {
                sql = "SELECT t.name AS TableName,c.name AS ColumnName,ty.name AS TypeName," +
                      "c.max_length AS MaxLength,c.precision AS Precision,c.scale AS Scale," +
                      "c.collation_name AS CollationName " +
                      "FROM sys.columns c JOIN sys.tables t ON c.object_id=t.object_id " +
                      "JOIN sys.types ty ON c.user_type_id=ty.user_type_id " +
                      "WHERE SCHEMA_NAME(t.schema_id)='dbo' AND t.name IN (" + tables + ") " +
                      "AND c.is_nullable=0 AND LOWER(c.name)<>'id' AND c.is_identity=0 AND c.is_computed=0 " +
                      "AND ty.name NOT IN ('timestamp','rowversion') " +
                      "AND NOT EXISTS (SELECT 1 FROM sys.indexes i JOIN sys.index_columns ic " +
                      "ON i.object_id=ic.object_id AND i.index_id=ic.index_id " +
                      "WHERE i.object_id=c.object_id AND i.is_primary_key=1 AND ic.column_id=c.column_id)";
            }
            else
            {
                // 当前启动兼容链只支持 MySQL/SQL Server；其它提供程序继续由自身 DDL 服务处理。
                return new List<JObject>();
            }
            var query = database.FromSql(sql);
            for (var index = 0; index < StartupTables.Length; index++)
                query.AddInParameter("t" + index, StartupTables[index]);
            var candidates = query.ToList<dynamic>().Select(row => JObject.FromObject((object)row)).ToList();
            if (type != DatabaseType.MySql) return candidates;
            var required = candidates.Where(row => row["IsNullable"]?.ToString() == "NO").ToList();
            foreach (var table in candidates.Where(row => row["IsNullable"]?.ToString() == "YES")
                .GroupBy(row => row["TableName"].ToString()))
            {
                var remaining = table.ToList();
                // DROP DEFAULT 会给可空列留下 NO_DEFAULT_VALUE_FLAG。information_schema
                // 将它和 DEFAULT NULL 都表示为 null；TEXT 的 SHOW CREATE 也无法区分。
                // LIMIT 0 只验证 DEFAULT 表达式，不读取业务行。按错误列排除后继续检查。
                while (remaining.Count > 0)
                {
                    try
                    {
                        database.FromSql("SELECT " + string.Join(",", remaining.Select(column =>
                            "DEFAULT(`" + column["ColumnName"].ToString().Replace("`", "``") + "`)")) +
                            " FROM `" + table.Key + "` LIMIT 0").ToScalar();
                        break;
                    }
                    catch (MySqlException ex) when (ex.Number == 1364)
                    {
                        var match = Regex.Match(ex.Message, @"Field '(.+)' doesn't have a default value");
                        var missing = match.Success ? remaining.FirstOrDefault(column =>
                            string.Equals(column["ColumnName"].ToString(), match.Groups[1].Value,
                                StringComparison.OrdinalIgnoreCase)) : null;
                        if (missing == null) throw;
                        required.Add(missing);
                        remaining.Remove(missing);
                    }
                }
            }
            return required;
        }

        internal static int EnsureUnderLease(OsClientSecret client)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            var columns = ReadRequiredColumns(client);
            foreach (var table in columns.GroupBy(row => row["TableName"].ToString()))
            {
                UpgradeExecutionLeaseContext.ConfirmOwnership();
                var tableName = table.Key;
                if (!StartupTables.Contains(tableName, StringComparer.OrdinalIgnoreCase))
                    throw new InvalidOperationException("可空字段门禁读取到未授权表。");
                if (client.Db.Db.DbProvider.DatabaseType == DatabaseType.MySql)
                {
                    // SHOW CREATE 保留每列的默认值、字符集、排序规则、注释、ON UPDATE 及索引。
                    // 合并同表变更，避免按字段重复重建旧大表；不修改连接池或全局 SQL 模式。
                    var raw = client.Db.FromSql("SHOW CREATE TABLE `" + tableName + "`").First<dynamic>();
                    var definition = JObject.FromObject((object)raw)["Create Table"]?.ToString()
                        ?? throw new InvalidOperationException("无法读取表结构：" + tableName);
                    var changes = table.Select(column => "MODIFY COLUMN " +
                        MakeMySqlColumnNullable(definition, column["ColumnName"].ToString())).ToArray();
                    client.Db.FromSql("ALTER TABLE `" + tableName + "` " + string.Join(",", changes)).ExecuteNonQuery();
                }
                else
                {
                    foreach (var column in table)
                    {
                        UpgradeExecutionLeaseContext.ThrowIfLost();
                        var name = column["ColumnName"].ToString().Replace("]", "]]");
                        var collation = column["CollationName"]?.ToString();
                        if (!string.IsNullOrEmpty(collation) && !Regex.IsMatch(collation, @"^[A-Za-z0-9_]+$"))
                            throw new InvalidOperationException("无效的 SQL Server 排序规则。");
                        client.Db.FromSql("ALTER TABLE [dbo].[" + tableName + "] ALTER COLUMN [" + name + "] " +
                            SqlServerType(column) + (string.IsNullOrEmpty(collation) ? "" : " COLLATE " + collation) + " NULL")
                            .ExecuteNonQuery();
                    }
                }
                UpgradeProgress.WriteLine($"Microi：【自动升级状态】【{client.OsClient}】【启动字段可空兼容】{tableName}：已修复{table.Count()}个普通字段的可空约束或缺失默认语义，保留主键、有效默认值及原有数据。");
            }
            UpgradeExecutionLeaseContext.ThrowIfLost();
            if (!Ready(client)) throw new InvalidOperationException("启动字段可空兼容强回读失败。");
            return columns.Count;
        }

        internal static string MakeMySqlColumnNullable(string tableDefinition, string columnName)
        {
            if (string.Equals(columnName, "Id", StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("禁止放宽平台主键 Id。");
            var name = "`" + columnName.Replace("`", "``") + "`";
            var match = Regex.Match(tableDefinition, @"^\s*" + Regex.Escape(name) + @"\s+[^\r\n]+", RegexOptions.Multiline);
            if (!match.Success) throw new InvalidOperationException("列定义缺失：" + columnName);
            var definition = match.Value.Trim().TrimEnd(',');
            // 跳过带引号的默认值/注释/标识符，不能误改字符串里的 NOT NULL。
            var tokens = new Regex("`(?:``|[^`])*`|'(?:\\\\.|''|[^'\\\\])*'|\"(?:\\\\.|\"\"|[^\"\\\\])*\"|(?<constraint>\\bNOT\\s+NULL\\b)", RegexOptions.IgnoreCase);
            var changed = false;
            var result = tokens.Replace(definition, token =>
            {
                if (changed || !token.Groups["constraint"].Success) return token.Value;
                changed = true;
                return "NULL";
            });
            // 已可空但 DROP DEFAULT 的列通过原定义 MODIFY 清除缺失默认标志；
            // 对 TEXT/BLOB 不能用 ALTER COLUMN SET DEFAULT NULL（MySQL 5.7/8 均拒绝）。
            return result;
        }

        private static string SqlServerType(JObject column)
        {
            var type = column["TypeName"].ToString();
            if (!Regex.IsMatch(type, @"^[A-Za-z0-9_]+$")) throw new InvalidOperationException("无效字段类型。");
            if (new[] { "nvarchar", "varchar", "nchar", "char", "varbinary", "binary" }.Contains(type))
            {
                var length = column["MaxLength"].Value<int>();
                return type + "(" + (length == -1 ? "max" : (type.StartsWith("n") ? length / 2 : length).ToString()) + ")";
            }
            if (type == "decimal" || type == "numeric") return type + "(" + column["Precision"] + "," + column["Scale"] + ")";
            if (type == "datetime2" || type == "datetimeoffset" || type == "time") return type + "(" + column["Scale"] + ")";
            return type;
        }
    }
}

using System;
using System.Collections.Generic;
using System.Data;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;

namespace Dos.ORM
{
    public sealed class ExternalDatabaseColumn
    {
        public string Name { get; set; }
        public string DataType { get; set; }
        public string NativeType { get; set; }
        public string Comment { get; set; }
        public string Key { get; set; }
        public string IsNullable { get; set; }
        public long? MaximumLength { get; set; }
    }

    public sealed class ExternalDatabaseTable
    {
        public string Name { get; set; }
        public IReadOnlyList<ExternalDatabaseColumn> Columns { get; set; }
        public string Error { get; set; }
    }

    public sealed class ExternalDatabaseInspectionResult
    {
        public string DatabaseType { get; set; }
        public int TotalTableCount { get; set; }
        public bool Truncated { get; set; }
        public IReadOnlyList<ExternalDatabaseTable> Tables { get; set; }
    }

    public sealed class ExternalDatabaseQueryResult
    {
        public string DatabaseType { get; set; }
        public IReadOnlyList<string> Columns { get; set; }
        public IReadOnlyList<IDictionary<string, object>> Rows { get; set; }
        public bool Truncated { get; set; }
        public int RowCount { get; set; }
    }

    public sealed class ExternalDatabaseExecutionResult
    {
        public string DatabaseType { get; set; }
        public string Mode { get; set; }
        public ExternalDatabaseQueryResult Query { get; set; }
        public object Scalar { get; set; }
        public int? AffectedRows { get; set; }
    }

    /// <summary>
    /// 通过 Dos.ORM 连接任意已认证数据库，读取物理结构或执行受限只读查询。
    /// </summary>
    public static class ExternalDatabaseInspector
    {
        private static readonly Regex ForbiddenReadSql = new Regex(
            @"\b(insert|update|delete|merge|replace|upsert|drop|alter|create|truncate|grant|revoke|execute|exec|call|copy|vacuum|attach|detach|into|outfile|load_file|pg_read_file|openrowset|opendatasource|nextval|setval|pg_advisory_lock|dblink|lo_import|lo_export|benchmark|sleep|dbms_lock|utl_file)\b|\bnext\s+value\s+for\b",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

        public static ExternalDatabaseInspectionResult Inspect(
            string configuredType,
            string connectionString,
            string tableName = null,
            int maxTables = 500,
            bool includeColumns = true,
            int commandTimeoutSeconds = 60)
        {
            var definition = ExternalDatabaseCatalog.Resolve(configuredType);
            maxTables = Math.Max(1, Math.Min(maxTables, 5000));
            commandTimeoutSeconds = Math.Max(1, Math.Min(commandTimeoutSeconds, 600));

            try
            {
                var session = ExternalDatabaseCatalog.CreateSession(
                    definition.Key,
                    connectionString,
                    defaultCommandTimeoutSeconds: commandTimeoutSeconds);
                var service = ExternalDatabaseCatalog.CreateMetadataService(definition.DatabaseType);
                var param = new DbServiceParam { DbSession = session, TableName = tableName };
                var tableResult = service.GetTables(param);
                if (tableResult.Code != 1)
                    throw new InvalidOperationException(tableResult.Msg ?? "读取数据库表失败。");

                var allTables = (tableResult.Data ?? new List<string>())
                    .Where(name => !string.IsNullOrWhiteSpace(name))
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .OrderBy(name => name, StringComparer.OrdinalIgnoreCase)
                    .ToList();
                if (!string.IsNullOrWhiteSpace(tableName))
                {
                    allTables = allTables.Where(name =>
                        name.IndexOf(tableName.Trim(), StringComparison.OrdinalIgnoreCase) >= 0).ToList();
                }

                var selected = allTables.Take(maxTables).ToList();
                var tables = new List<ExternalDatabaseTable>(selected.Count);
                foreach (var name in selected)
                {
                    if (!includeColumns)
                    {
                        tables.Add(new ExternalDatabaseTable
                        {
                            Name = name,
                            Columns = new List<ExternalDatabaseColumn>()
                        });
                        continue;
                    }

                    try
                    {
                        var columnResult = service.GetColumns(new DbServiceParam
                        {
                            DbSession = session,
                            TableName = name
                        });
                        if (columnResult.Code != 1)
                            throw new InvalidOperationException(columnResult.Msg ?? "读取字段失败。");

                        tables.Add(new ExternalDatabaseTable
                        {
                            Name = name,
                            Columns = (columnResult.Data ?? new List<information_schema_columns>())
                                .Select(column => new ExternalDatabaseColumn
                                {
                                    Name = column.column_name,
                                    DataType = column.data_type,
                                    NativeType = column.column_type,
                                    Comment = column.column_comment,
                                    Key = column.column_key,
                                    IsNullable = column.is_nullable,
                                    MaximumLength = column.character_maximum_length
                                }).ToList()
                        });
                    }
                    catch (Exception ex)
                    {
                        tables.Add(new ExternalDatabaseTable
                        {
                            Name = name,
                            Columns = new List<ExternalDatabaseColumn>(),
                            Error = ExternalDatabaseCatalog.SanitizeError(ex.Message, connectionString)
                        });
                    }
                }

                return new ExternalDatabaseInspectionResult
                {
                    DatabaseType = definition.Key,
                    TotalTableCount = allTables.Count,
                    Truncated = allTables.Count > selected.Count,
                    Tables = tables
                };
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException(
                    "外部数据库结构读取失败："
                    + ExternalDatabaseCatalog.SanitizeError(ex.Message, connectionString));
            }
        }

        public static ExternalDatabaseQueryResult Query(
            string configuredType,
            string connectionString,
            string sql,
            IReadOnlyDictionary<string, object> parameters = null,
            int maxRows = 200,
            int commandTimeoutSeconds = 60,
            int maxCellChars = 20000,
            int maxBinaryBytes = 65536)
        {
            ValidateReadOnlySql(sql);
            var definition = ExternalDatabaseCatalog.Resolve(configuredType);
            maxRows = Math.Max(1, Math.Min(maxRows, 5000));
            commandTimeoutSeconds = Math.Max(1, Math.Min(commandTimeoutSeconds, 600));
            maxCellChars = Math.Max(256, Math.Min(maxCellChars, 200000));
            maxBinaryBytes = Math.Max(0, Math.Min(maxBinaryBytes, 1024 * 1024));

            try
            {
                var session = ExternalDatabaseCatalog.CreateSession(
                    definition.Key,
                    connectionString,
                    defaultCommandTimeoutSeconds: commandTimeoutSeconds);
                var section = session.FromSql(sql);
                section.SetCommandTimeout(commandTimeoutSeconds);
                if (parameters != null)
                {
                    foreach (var item in parameters)
                    {
                        var parameterName = (item.Key ?? string.Empty).Trim();
                        if (!Regex.IsMatch(parameterName, @"^[@?:]?[A-Za-z_][A-Za-z0-9_]*$"))
                            throw new ArgumentException("SQL 参数名不合法：" + parameterName);
                        var value = item.Value ?? DBNull.Value;
                        var dbType = InferDbType(value);
                        if (IsSensitiveParameterName(parameterName))
                            section.AddSensitiveInParameter(parameterName, dbType, value);
                        else
                            section.AddInParameter(parameterName, dbType, value);
                    }
                }

                var rows = new List<IDictionary<string, object>>();
                var columns = new List<string>();
                var truncated = false;
                using (var reader = section.ToDataReader())
                {
                    for (var index = 0; index < reader.FieldCount; index++)
                        columns.Add(reader.GetName(index));

                    while (reader.Read())
                    {
                        if (rows.Count >= maxRows)
                        {
                            truncated = true;
                            break;
                        }
                        var row = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                        for (var index = 0; index < reader.FieldCount; index++)
                        {
                            row[columns[index]] = ConvertCell(
                                reader.IsDBNull(index) ? null : reader.GetValue(index),
                                maxCellChars,
                                maxBinaryBytes);
                        }
                        rows.Add(row);
                    }
                }

                return new ExternalDatabaseQueryResult
                {
                    DatabaseType = definition.Key,
                    Columns = columns,
                    Rows = rows,
                    RowCount = rows.Count,
                    Truncated = truncated
                };
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException(
                    "外部数据库查询失败："
                    + ExternalDatabaseCatalog.SanitizeError(ex.Message, connectionString));
            }
        }

        /// <summary>
        /// 执行超级管理员明确确认的原生管理 SQL。此入口不做只读关键字限制，
        /// 可执行 DML、DDL、存储过程和驱动允许的多语句；调用方必须在控制器
        /// 边界完成 Level &gt;= 9999、租户绑定、显式确认和审计。
        /// 查询结果仍限制返回体大小，限制的是 MCP 响应而不是数据库执行权限。
        /// </summary>
        public static ExternalDatabaseExecutionResult ExecuteAdministrativeSql(
            string configuredType,
            string connectionString,
            string sql,
            string mode,
            IReadOnlyDictionary<string, object> parameters = null,
            int maxRows = 1000,
            int commandTimeoutSeconds = 600,
            int maxCellChars = 200000,
            int maxBinaryBytes = 1024 * 1024)
        {
            if (string.IsNullOrWhiteSpace(sql))
                throw new ArgumentException("SQL 不能为空。", nameof(sql));

            var normalizedMode = NormalizeExecutionMode(mode);
            var definition = ExternalDatabaseCatalog.Resolve(configuredType);
            maxRows = Math.Max(1, Math.Min(maxRows, 100000));
            commandTimeoutSeconds = Math.Max(1, Math.Min(commandTimeoutSeconds, 86400));
            maxCellChars = Math.Max(256, Math.Min(maxCellChars, 2 * 1024 * 1024));
            maxBinaryBytes = Math.Max(0, Math.Min(maxBinaryBytes, 16 * 1024 * 1024));

            try
            {
                var session = ExternalDatabaseCatalog.CreateSession(
                    definition.Key,
                    connectionString,
                    defaultCommandTimeoutSeconds: commandTimeoutSeconds);
                var section = session.FromSql(sql);
                section.SetCommandTimeout(commandTimeoutSeconds);
                AddParameters(section, parameters);

                var result = new ExternalDatabaseExecutionResult
                {
                    DatabaseType = definition.Key,
                    Mode = normalizedMode
                };
                if (normalizedMode == "Query")
                {
                    result.Query = ReadQueryResult(
                        definition.Key,
                        section,
                        maxRows,
                        maxCellChars,
                        maxBinaryBytes);
                }
                else if (normalizedMode == "Scalar")
                {
                    result.Scalar = ConvertCell(section.ToScalar(), maxCellChars, maxBinaryBytes);
                }
                else
                {
                    result.AffectedRows = section.ExecuteNonQuery();
                }
                return result;
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException(
                    "外部数据库管理 SQL 执行失败："
                    + ExternalDatabaseCatalog.SanitizeError(ex.Message, connectionString));
            }
        }

        public static void ValidateReadOnlySql(string sql)
        {
            if (string.IsNullOrWhiteSpace(sql)) throw new ArgumentException("SQL 不能为空。", nameof(sql));
            var trimmed = sql.Trim();
            while (trimmed.EndsWith(";", StringComparison.Ordinal))
                trimmed = trimmed.Substring(0, trimmed.Length - 1).TrimEnd();
            if (trimmed.IndexOf(';') >= 0)
                throw new InvalidOperationException("只读查询不允许多语句 SQL。");

            var normalized = StripCommentsAndLiterals(trimmed);
            if (!Regex.IsMatch(normalized, @"^\s*(select|with)\b", RegexOptions.IgnoreCase))
                throw new InvalidOperationException("只读查询仅允许 SELECT 或 WITH ... SELECT。");
            if (ForbiddenReadSql.IsMatch(normalized))
                throw new InvalidOperationException("只读查询包含被禁止的写入、DDL、执行或文件访问关键字。");
        }

        private static string StripCommentsAndLiterals(string sql)
        {
            var withoutBlockComments = Regex.Replace(sql, @"/\*.*?\*/", " ", RegexOptions.Singleline);
            var withoutLineComments = Regex.Replace(withoutBlockComments, @"--[^\r\n]*", " ");
            var withoutStrings = Regex.Replace(withoutLineComments, @"'(?:''|[^'])*'", "''");
            return Regex.Replace(withoutStrings, "\"(?:\"\"|[^\"])*\"", "\"\"");
        }

        private static string NormalizeExecutionMode(string mode)
        {
            var normalized = (mode ?? string.Empty).Trim();
            if (normalized.Equals("Query", StringComparison.OrdinalIgnoreCase)) return "Query";
            if (normalized.Equals("Scalar", StringComparison.OrdinalIgnoreCase)) return "Scalar";
            if (normalized.Equals("NonQuery", StringComparison.OrdinalIgnoreCase)) return "NonQuery";
            throw new ArgumentException("Mode 仅支持 Query、Scalar、NonQuery。", nameof(mode));
        }

        private static void AddParameters(
            SqlSection section,
            IReadOnlyDictionary<string, object> parameters)
        {
            if (parameters == null) return;
            foreach (var item in parameters)
            {
                var parameterName = (item.Key ?? string.Empty).Trim();
                if (!Regex.IsMatch(parameterName, @"^[@?:]?[A-Za-z_][A-Za-z0-9_]*$"))
                    throw new ArgumentException("SQL 参数名不合法：" + parameterName);
                var value = item.Value ?? DBNull.Value;
                var dbType = InferDbType(value);
                if (IsSensitiveParameterName(parameterName))
                    section.AddSensitiveInParameter(parameterName, dbType, value);
                else
                    section.AddInParameter(parameterName, dbType, value);
            }
        }

        private static ExternalDatabaseQueryResult ReadQueryResult(
            string databaseType,
            SqlSection section,
            int maxRows,
            int maxCellChars,
            int maxBinaryBytes)
        {
            var rows = new List<IDictionary<string, object>>();
            var columns = new List<string>();
            var truncated = false;
            using (var reader = section.ToDataReader())
            {
                for (var index = 0; index < reader.FieldCount; index++)
                    columns.Add(reader.GetName(index));

                while (reader.Read())
                {
                    if (rows.Count >= maxRows)
                    {
                        truncated = true;
                        break;
                    }
                    var row = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                    for (var index = 0; index < reader.FieldCount; index++)
                    {
                        row[columns[index]] = ConvertCell(
                            reader.IsDBNull(index) ? null : reader.GetValue(index),
                            maxCellChars,
                            maxBinaryBytes);
                    }
                    rows.Add(row);
                }
            }

            return new ExternalDatabaseQueryResult
            {
                DatabaseType = databaseType,
                Columns = columns,
                Rows = rows,
                RowCount = rows.Count,
                Truncated = truncated
            };
        }

        private static object ConvertCell(object value, int maxCellChars, int maxBinaryBytes)
        {
            if (value == null || value == DBNull.Value) return null;
            if (value is byte[] bytes)
            {
                var take = Math.Min(bytes.Length, maxBinaryBytes);
                var clipped = new byte[take];
                if (take > 0) Buffer.BlockCopy(bytes, 0, clipped, 0, take);
                return new Dictionary<string, object>
                {
                    ["Base64"] = Convert.ToBase64String(clipped),
                    ["ByteLength"] = bytes.Length,
                    ["Truncated"] = bytes.Length > take
                };
            }
            if (value is DateTime dateTime)
                return dateTime.ToString("yyyy-MM-dd HH:mm:ss.fffffff", CultureInfo.InvariantCulture);
            if (value is DateTimeOffset dateTimeOffset)
                return dateTimeOffset.ToString("o", CultureInfo.InvariantCulture);
            if (value is Guid || value is bool || value is byte || value is short || value is int
                || value is long || value is float || value is double || value is decimal)
                return value;

            var text = Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty;
            return text.Length <= maxCellChars ? text : text.Substring(0, maxCellChars) + "...[TRUNCATED]";
        }

        private static DbType InferDbType(object value)
        {
            if (value == null || value == DBNull.Value) return DbType.String;
            if (value is bool) return DbType.Boolean;
            if (value is byte) return DbType.Byte;
            if (value is short) return DbType.Int16;
            if (value is int) return DbType.Int32;
            if (value is long) return DbType.Int64;
            if (value is float) return DbType.Single;
            if (value is double) return DbType.Double;
            if (value is decimal) return DbType.Decimal;
            if (value is DateTime) return DbType.DateTime;
            if (value is DateTimeOffset) return DbType.DateTimeOffset;
            if (value is Guid) return DbType.Guid;
            if (value is byte[]) return DbType.Binary;
            return DbType.String;
        }

        private static bool IsSensitiveParameterName(string parameterName)
        {
            var name = (parameterName ?? string.Empty).TrimStart('@', '?', ':').ToLowerInvariant();
            return name.Contains("password") || name.Contains("pwd") || name.Contains("secret")
                   || name.Contains("token") || name.Contains("apikey") || name.Contains("authorization")
                   || name.Contains("dbconn") || name.Contains("connectionstring");
        }
    }
}

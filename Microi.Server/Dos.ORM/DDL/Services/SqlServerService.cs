using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Threading;
using Dos.Common;

namespace Dos.ORM
{
    public class SqlServerService : IMicroiORM
    {
        private static readonly ConcurrentDictionary<string, SemaphoreSlim> TableDdlGates =
            new ConcurrentDictionary<string, SemaphoreSlim>(StringComparer.OrdinalIgnoreCase);

        private static int DdlLockWaitSeconds =>
            ConfigHelper.GetRuntimeConfigurationInt("OrmLimits:DdlLockWaitSeconds", 8);

        private static int DdlQueueWaitSeconds =>
            ConfigHelper.GetRuntimeConfigurationInt("OrmLimits:DdlQueueWaitSeconds", 600);

        public bool NeedsExplicitSelectAlias => false;
        public bool UsesRowNumberPagination => true;

        public string GetDatetimeFieldValue(string datetime)
        {
            return "'" + datetime + "'";
        }
        public string GetFieldAsName(string fieldName)
        {
            return "[" + fieldName + "]";
        }
        public string GetFieldName(string fieldName)
        {
            return "[" + fieldName + "]";
        }
        public string GetTableName(string tableName, string userName = null)
        {
            return "[" + tableName + "]";
        }
        /// <summary>
        /// 加载非DIY表
        /// </summary>
        /// <param name="param"></param>
        /// <param name="realFieldList"></param>
        /// <param name="_trans"></param>
        /// <returns></returns>
        /// <exception cref="NotImplementedException"></exception>
        public DosResult LoadNotDiyTable(DbServiceParam param, List<information_schema_columns> realFieldList, DbTrans _trans = null)
        {
            throw new Exception("SqlServer暂未实现此功能！");
        }


        /// <summary>
        /// 创建表
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public DosResult AddDiyTable(DbServiceParam param, DbTrans _trans = null)
        {
            if (param.TableName.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

            // SQL注入防护
            if (!IsValidIdentifier(param.TableName))
                return new DosResult(0, null, "表名不合法，只允许字母、数字和下划线");

            var sql = $@"CREATE TABLE [{param.TableName}](
                        [Id] varchar(36) NOT NULL PRIMARY KEY,
                        [CreateTime] datetime NULL,
                        [UpdateTime] datetime NULL,
                        [UserId] varchar(36) NULL,
                        [UserName] varchar(255) NULL,
                        [IsDeleted] int NULL DEFAULT(0)
                    );
                    EXEC sp_addextendedproperty 'MS_Description', N'Id','SCHEMA', N'dbo','TABLE', N'{param.TableName}','COLUMN', N'Id';
                    EXEC sp_addextendedproperty 'MS_Description', N'创建时间','SCHEMA', N'dbo','TABLE', N'{param.TableName}','COLUMN', N'CreateTime';
                    EXEC sp_addextendedproperty 'MS_Description', N'修改时间','SCHEMA', N'dbo','TABLE', N'{param.TableName}','COLUMN', N'UpdateTime';
                    EXEC sp_addextendedproperty 'MS_Description', N'新增人Id','SCHEMA', N'dbo','TABLE', N'{param.TableName}','COLUMN', N'UserId';
                    EXEC sp_addextendedproperty 'MS_Description', N'新增人','SCHEMA', N'dbo','TABLE', N'{param.TableName}','COLUMN', N'UserName';
                    EXEC sp_addextendedproperty 'MS_Description', N'是否删除','SCHEMA', N'dbo','TABLE', N'{param.TableName}','COLUMN', N'IsDeleted'";

            try
            {
                dynamic session = (object)_trans ?? param.DbSession;
                session.FromSql(sql).ExecuteNonQuery();
                return new DosResult(1);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"创建表失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <param name="_trans"></param>
        /// <returns></returns>
        public DosResult AddColumn(DbServiceParam param, DbTrans _trans = null)
        {
            SemaphoreSlim ddlGate = null;
            try
            {
                if (param.TableName.DosIsNullOrWhiteSpace() ||
                    param.FieldName.DosIsNullOrWhiteSpace() ||
                    param.FieldType.DosIsNullOrWhiteSpace() ||
                    (param.DbSession == null && _trans == null))
                    return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

                // SQL注入防护
                if (!IsValidIdentifier(param.TableName) || !IsValidIdentifier(param.FieldName))
                    return new DosResult(0, null, "表名或字段名不合法");

                ddlGate = EnterTableDdlGate(param, out var gateError);
                if (ddlGate == null)
                    return new DosResult(0, null, gateError);

                dynamic session = (object)_trans ?? param.DbSession;
                PrepareDdlSession(session);
                if (ColumnExists(session, param.TableName, param.FieldName))
                {
                    ddlGate.Release();
                    ddlGate = null;
                    return new DosResult(1, null, "字段已存在，已跳过物理列创建。");
                }

                param.FieldType = NormalizeFieldType(param.FieldType);
                var sql = $"ALTER TABLE [{param.TableName}] ADD [{param.FieldName}] {param.FieldType} {(param.FieldNotNull ? "NOT NULL" : "NULL")}";

                if (!param.FieldLabel.DosIsNullOrWhiteSpace())
                {
                    // 转义单引号防止SQL注入
                    var label = param.FieldLabel.Replace("'", "''");
                    sql += $";EXEC sp_addextendedproperty 'MS_Description', N'{label}','SCHEMA', N'dbo','TABLE', N'{param.TableName}','COLUMN', N'{param.FieldName}'";
                }

                session.FromSql(sql).ExecuteNonQuery();
                ddlGate.Release();
                ddlGate = null;
                return new DosResult(1);
            }
            catch (Exception ex)
            {
                ddlGate?.Release();
                ddlGate = null;
                if (IsDuplicateColumnException(ex))
                    return new DosResult(1, null, "字段已存在，已跳过物理列创建。");
                if (IsMetadataLockException(ex))
                    return new DosResult(0, null, $"表结构正在被其它操作占用，请稍后重试。{ex.Message}");
                return new DosResult(0, null, $"添加字段失败: {ex.Message}");
            }
        }

        public DosResult ChangeColumn(DbServiceParam param, DbTrans _trans = null)
        {
            if (param.TableName.DosIsNullOrWhiteSpace()
                || param.FieldName.DosIsNullOrWhiteSpace()
                || param.NewFieldName.DosIsNullOrWhiteSpace()
                || param.FieldType.DosIsNullOrWhiteSpace()
                )
            {
                return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));
            }

            param.FieldType = NormalizeFieldType(param.FieldType);


            //修改列名：EXEC sp_rename ‘表名.[原有列名]’, ‘新列名’ , ‘COLUMN’;
            //exec sp_rename 'People.[PeopleBirthday]','PeopleBirth','column';

            var sql = string.Empty;
            if (!param.FieldName.Equals(param.NewFieldName, StringComparison.OrdinalIgnoreCase))
                sql = $"EXEC sp_rename '[{param.TableName}].[{param.FieldName}]', '{param.NewFieldName}', 'COLUMN';";

            sql += $@"ALTER TABLE [{param.TableName}] ALTER COLUMN [{param.NewFieldName}] {param.FieldType} {(param.FieldNotNull ? "NOT NULL" : "NULL")};";

            if (!param.FieldLabel.DosIsNullOrWhiteSpace())
            {
                sql += $@"EXEC sp_updateextendedproperty 'MS_Description', N'{param.FieldLabel ?? ""}','SCHEMA', N'dbo','TABLE', N'{param.TableName}','COLUMN', N'{param.NewFieldName}';";
            }

            dynamic session = (object)_trans ?? param.DbSession;
            if (session == null)
                return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

            session.FromSql(sql).ExecuteNonQuery();
            return new DosResult(1);
        }

        public DosResultList<string> GetTables(DbServiceParam param)
        {
            if (param.DbSession == null)
                return new DosResultList<string>(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));
            //取所有表
            var sql = @"SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = SCHEMA_NAME()";
            var result = param.DbSession.FromSql(sql).ToList<string>();
            return new DosResultList<string>(1, result);
        }

        public DosResult UptDiyTable(DbServiceParam param, DbTrans _trans = null)
        {
            if (param.TableName.DosIsNullOrWhiteSpace() ||
                param.OldTableName.DosIsNullOrWhiteSpace() ||
                (param.DbSession == null && _trans == null))
                return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

            // SQL注入防护
            if (!IsValidIdentifier(param.TableName) || !IsValidIdentifier(param.OldTableName))
                return new DosResult(0, null, "表名不合法，只允许字母、数字和下划线");

            var sql = $"EXEC sp_rename '[{param.OldTableName}]', '{param.TableName}'";

            try
            {
                dynamic session = (object)_trans ?? param.DbSession;
                session.FromSql(sql).ExecuteNonQuery();
                return new DosResult(1);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"重命名表失败: {ex.Message}");
            }
        }

        public DosResultList<information_schema_columns> GetColumns(DbServiceParam param)
        {
            if (param.TableName.DosIsNullOrWhiteSpace() || param.DbSession == null)
                return new DosResultList<information_schema_columns>(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

            var sql = @"SELECT
                            c.column_name,
                            c.data_type,
                            CAST(ep.value AS nvarchar(4000)) AS column_comment,
                            CASE WHEN pk.column_name IS NULL THEN '' ELSE 'PRI' END AS column_key,
                            '' AS extra,
                            c.is_nullable,
                            c.data_type AS column_type,
                            c.character_maximum_length,
                            c.numeric_precision,
                            c.numeric_scale,
                            c.datetime_precision
                        FROM information_schema.columns c
                        LEFT JOIN sys.columns sc
                          ON sc.object_id = OBJECT_ID(QUOTENAME(c.table_schema) + '.' + QUOTENAME(c.table_name))
                         AND sc.name = c.column_name
                        LEFT JOIN sys.extended_properties ep
                          ON ep.major_id = sc.object_id
                         AND ep.minor_id = sc.column_id
                         AND ep.name = 'MS_Description'
                        LEFT JOIN (
                            SELECT ku.table_schema, ku.table_name, ku.column_name
                            FROM information_schema.table_constraints tc
                            INNER JOIN information_schema.key_column_usage ku
                              ON tc.constraint_name = ku.constraint_name
                             AND tc.table_schema = ku.table_schema
                             AND tc.table_name = ku.table_name
                            WHERE tc.constraint_type = 'PRIMARY KEY'
                        ) pk
                          ON pk.table_schema = c.table_schema
                         AND pk.table_name = c.table_name
                         AND pk.column_name = c.column_name
                        WHERE c.table_schema = SCHEMA_NAME()
                          AND c.table_name = @tableName
                        ORDER BY c.ordinal_position";

            try
            {
                var dosSession = param.DbSession;
                var result = dosSession.FromSql(sql)
                    .AddInParameter("tableName", DbType.String, param.TableName)
                    .ToList<information_schema_columns>();
                foreach (var column in result)
                {
                    column.column_type = BuildPhysicalColumnType(column);
                }
                return new DosResultList<information_schema_columns>(1, result);
            }
            catch (Exception ex)
            {
                return new DosResultList<information_schema_columns>(0, null, $"获取字段列表失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="tableName"></param>
        /// <param name="sql"></param>
        /// <param name="pageIndex"></param>
        /// <param name="pageSize"></param>
        /// <param name="dbVersion"></param>
        /// <returns></returns>
        /// <exception cref="NotImplementedException"></exception>
        public string GetPaginationSql(string tableName, string sql, int pageIndex, int pageSize, string dbVersion = "")
        {
            if (pageIndex != 1)
            {
                var result = "select * from ( " + sql;
                result += $" ) AS {tableName} WHERE _ROW_NUMBER BETWEEN ({(pageIndex - 1) * pageSize + 1}) AND ({pageIndex * pageSize})";
                return result;
            }
            return sql;
        }

        /// <summary>
        /// SQL注入防护：验证标识符（表名/字段名）是否合法
        /// </summary>
        private static bool IsValidIdentifier(string identifier)
        {
            if (string.IsNullOrWhiteSpace(identifier))
                return false;
            return System.Text.RegularExpressions.Regex.IsMatch(identifier, @"^[a-zA-Z_][a-zA-Z0-9_]*$");
        }

        /// <summary>
        /// 吾码字段元数据长期以 MySQL 类型名保存。SQL Server DDL 必须在 ORM
        /// 方言边界统一转换长文本类型，避免启动自愈、表单设计器等不同调用方
        /// 各自维护映射，并使用可保存 Unicode 的现代大字段类型。
        /// </summary>
        internal static string NormalizeFieldType(string fieldType)
        {
            if (string.IsNullOrWhiteSpace(fieldType))
                return fieldType;

            var normalized = fieldType.Trim();
            switch (normalized.ToLowerInvariant())
            {
                case "tinytext":
                case "text":
                case "mediumtext":
                case "longtext":
                case "ntext":
                    return "nvarchar(max)";
                default:
                    return normalized;
            }
        }

        /// <summary>
        /// INFORMATION_SCHEMA.COLUMNS.DATA_TYPE 不包含长度或精度。将它直接回传
        /// ALTER COLUMN 会把 nvarchar(20) 退化为 nvarchar(1)，并在存量值上触发截断。
        /// </summary>
        internal static string BuildPhysicalColumnType(information_schema_columns column)
        {
            var dataType = column?.data_type?.Trim();
            if (string.IsNullOrWhiteSpace(dataType))
                return column?.column_type?.Trim();

            switch (dataType.ToLowerInvariant())
            {
                case "char":
                case "varchar":
                case "nchar":
                case "nvarchar":
                case "binary":
                case "varbinary":
                    if (column.character_maximum_length == -1)
                        return $"{dataType}(max)";
                    if (column.character_maximum_length > 0)
                        return $"{dataType}({column.character_maximum_length.Value})";
                    break;
                case "decimal":
                case "numeric":
                    if (column.numeric_precision.HasValue && column.numeric_scale.HasValue)
                        return $"{dataType}({column.numeric_precision.Value},{column.numeric_scale.Value})";
                    break;
                case "datetime2":
                case "datetimeoffset":
                case "time":
                    if (column.datetime_precision.HasValue)
                        return $"{dataType}({column.datetime_precision.Value})";
                    break;
            }

            return dataType;
        }

        private static SemaphoreSlim EnterTableDdlGate(DbServiceParam param, out string error)
        {
            error = "";
            var waitSeconds = Math.Max(1, DdlQueueWaitSeconds);
            var key = $"{param?.OsClient ?? ""}|{param?.DataBaseId ?? ""}|{param?.TableName ?? ""}";
            var gate = TableDdlGates.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
            if (gate.Wait(TimeSpan.FromSeconds(waitSeconds)))
                return gate;

            error = $"表结构变更正在排队中，已等待 {waitSeconds} 秒，请稍后重试。";
            return null;
        }

        private static void PrepareDdlSession(dynamic session)
        {
            var milliseconds = Math.Max(1, DdlLockWaitSeconds) * 1000;
            session.FromSql($"SET LOCK_TIMEOUT {milliseconds}").ExecuteNonQuery();
        }

        private static bool ColumnExists(dynamic session, string tableName, string fieldName)
        {
            var count = session.FromSql(@"SELECT COUNT(1)
FROM information_schema.columns
WHERE table_schema = SCHEMA_NAME()
AND table_name = @tableName
AND column_name = @fieldName")
                .AddInParameter("@tableName", tableName)
                .AddInParameter("@fieldName", fieldName)
                .ToScalar();
            return Convert.ToInt32(count) > 0;
        }

        private static bool IsDuplicateColumnException(Exception ex)
        {
            var message = GetExceptionMessage(ex);
            return message.IndexOf("specified more than once", StringComparison.OrdinalIgnoreCase) >= 0
                || message.IndexOf("must be unique", StringComparison.OrdinalIgnoreCase) >= 0
                || message.IndexOf("2705", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static bool IsMetadataLockException(Exception ex)
        {
            var message = GetExceptionMessage(ex);
            return message.IndexOf("Lock request time out period exceeded", StringComparison.OrdinalIgnoreCase) >= 0
                || message.IndexOf("1222", StringComparison.OrdinalIgnoreCase) >= 0
                || message.IndexOf("1205", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static string GetExceptionMessage(Exception ex)
        {
            if (ex == null)
                return "";
            var baseException = ex.GetBaseException();
            return $"{ex.Message} {baseException?.Message}";
        }

        public DosResult GetTableIndexes(DbServiceParam param)
        {
            try
            {
                if (param.TableName.DosIsNullOrWhiteSpace() || param.DbSession == null)
                    return new DosResult(0, null, "参数错误");
                if (!IsValidIdentifier(param.TableName))
                    return new DosResult(0, null, "表名不合法");
                var sql = $@"SELECT
                                i.name AS Key_name,
                                c.name AS Column_name,
                                CASE WHEN i.is_unique = 1 THEN 0 ELSE 1 END AS Non_unique,
                                i.type_desc AS Index_type,
                                ic.key_ordinal AS Seq_in_index,
                                CASE WHEN i.is_primary_key = 1 THEN 1 ELSE 0 END AS Is_primary
                            FROM sys.indexes i
                            JOIN sys.index_columns ic
                              ON i.object_id = ic.object_id AND i.index_id = ic.index_id
                            JOIN sys.columns c
                              ON ic.object_id = c.object_id AND ic.column_id = c.column_id
                            WHERE i.object_id = OBJECT_ID('{param.TableName}')
                              AND i.is_hypothetical = 0
                              AND ic.is_included_column = 0
                            ORDER BY i.name, ic.key_ordinal";
                var list = param.DbSession.FromSql(sql).ToArray();
                return new DosResult(1, list);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"获取索引失败: {ex.Message}");
            }
        }

        public DosResult AddIndex(DbServiceParam param)
        {
            try
            {
                if (param.TableName.DosIsNullOrWhiteSpace() || param.IndexName.DosIsNullOrWhiteSpace() || param.IndexColumns.DosIsNullOrWhiteSpace() || param.DbSession == null)
                    return new DosResult(0, null, "参数错误");
                if (!IsValidIdentifier(param.TableName) || !IsValidIdentifier(param.IndexName))
                    return new DosResult(0, null, "表名或索引名不合法");
                var columns = param.IndexColumns.Split(',').Select(c => c.Trim()).ToArray();
                foreach (var col in columns)
                    if (!IsValidIdentifier(col)) return new DosResult(0, null, $"字段名不合法: {col}");
                var columnsSql = string.Join(", ", columns.Select(c => $"[{c}]"));
                var uniqueStr = param.IndexUnique ? "UNIQUE " : "";
                var sql = $"CREATE {uniqueStr}NONCLUSTERED INDEX [{param.IndexName}] ON [{param.TableName}] ({columnsSql})";
                param.DbSession.FromSql(sql).ExecuteNonQuery();
                return new DosResult(1, null, "索引创建成功");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"创建索引失败: {ex.Message}");
            }
        }

        public DosResult DropIndex(DbServiceParam param)
        {
            try
            {
                if (param.TableName.DosIsNullOrWhiteSpace() || param.IndexName.DosIsNullOrWhiteSpace() || param.DbSession == null)
                    return new DosResult(0, null, "参数错误");
                if (!IsValidIdentifier(param.TableName) || !IsValidIdentifier(param.IndexName))
                    return new DosResult(0, null, "表名或索引名不合法");
                var sql = $"DROP INDEX [{param.IndexName}] ON [{param.TableName}]";
                param.DbSession.FromSql(sql).ExecuteNonQuery();
                return new DosResult(1, null, "索引删除成功");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"删除索引失败: {ex.Message}");
            }
        }
    }
}


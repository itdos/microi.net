using System;
using System.Collections.Generic;
using System.Linq;
using Dos.Common;

namespace Dos.ORM
{
    /// <summary>
    /// PostgreSQL数据库实现
    /// </summary>
    public class PostgreSqlService : IMicroiORM
    {
        public bool NeedsExplicitSelectAlias => false;
        public bool UsesRowNumberPagination => false;

        public string GetDatetimeFieldValue(string datetime)
        {
            return "'" + datetime + "'";
        }

        public string GetFieldAsName(string fieldName)
        {
            return "\"" + fieldName + "\"";
        }

        public string GetFieldName(string fieldName)
        {
            return "\"" + fieldName + "\"";
        }

        public string GetTableName(string tableName, string userName = null)
        {
            if (userName.DosIsNullOrWhiteSpace())
            {
                return "\"" + tableName + "\"";
            }
            return "\"" + userName + "\".\"" + tableName + "\"";
        }

        /// <summary>
        /// 修改表名
        /// </summary>
        public DosResult UptDiyTable(DbServiceParam param, DbTrans _trans = null)
        {
            try
            {
                if (param.TableName.DosIsNullOrWhiteSpace() ||
                    param.OldTableName.DosIsNullOrWhiteSpace() ||
                    (param.DbSession == null && _trans == null))
                    return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

                if (!IsValidIdentifier(param.TableName) || !IsValidIdentifier(param.OldTableName))
                    return new DosResult(0, null, "表名不合法，只允许字母、数字和下划线");

                var sql = $"ALTER TABLE \"{param.OldTableName}\" RENAME TO \"{param.TableName}\"";

                dynamic session = (object)_trans ?? param.DbSession;
                session.FromSql(sql).ExecuteNonQuery();
                return new DosResult(1);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"重命名表失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 创建表
        /// </summary>
        public DosResult AddDiyTable(DbServiceParam param, DbTrans _trans = null)
        {
            try
            {
                if (param.TableName.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

                if (!IsValidIdentifier(param.TableName))
                    return new DosResult(0, null, "表名不合法，只允许字母、数字和下划线");

                var sql = $@"CREATE TABLE ""{param.TableName}"" (
                          ""Id"" varchar(36) NOT NULL,
                          ""CreateTime"" timestamp NULL,
                          ""UpdateTime"" timestamp NULL,
                          ""UserId"" varchar(36) NULL,
                          ""UserName"" varchar(255) NULL,
                          ""IsDeleted"" int NULL DEFAULT 0,
                          PRIMARY KEY(""Id"")
                        )";

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
        /// 创建列
        /// </summary>
        public DosResult AddColumn(DbServiceParam param, DbTrans _trans = null)
        {
            try
            {
                if (param.TableName.DosIsNullOrWhiteSpace()
                    || param.FieldName.DosIsNullOrWhiteSpace()
                    || param.FieldType.DosIsNullOrWhiteSpace()
                    || (param.DbSession == null && _trans == null))
                    return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

                if (!IsValidIdentifier(param.TableName) || !IsValidIdentifier(param.FieldName))
                    return new DosResult(0, null, "表名或字段名不合法");

                // PostgreSQL: datetime -> timestamp, bit -> int, mediumtext/longtext -> text
                var fieldType = ConvertFieldType(param.FieldType);

                var sql = $"ALTER TABLE \"{param.TableName}\" ADD COLUMN \"{param.FieldName}\" {fieldType} {(param.FieldNotNull ? "NOT NULL" : "NULL")}";

                dynamic session = (object)_trans ?? param.DbSession;
                session.FromSql(sql).ExecuteNonQuery();

                // 添加注释
                if (!param.FieldLabel.DosIsNullOrWhiteSpace())
                {
                    var comment = param.FieldLabel.Replace("'", "''");
                    try
                    {
                        session.FromSql($"COMMENT ON COLUMN \"{param.TableName}\".\"{param.FieldName}\" IS '{comment}'").ExecuteNonQuery();
                    }
                    catch { }
                }

                return new DosResult(1);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"添加字段失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 修改列
        /// </summary>
        public DosResult ChangeColumn(DbServiceParam param, DbTrans _trans = null)
        {
            try
            {
                if (param.TableName.DosIsNullOrWhiteSpace() ||
                    param.FieldName.DosIsNullOrWhiteSpace() ||
                    param.NewFieldName.DosIsNullOrWhiteSpace() ||
                    param.FieldType.DosIsNullOrWhiteSpace() ||
                    (param.DbSession == null && _trans == null))
                    return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

                if (!IsValidIdentifier(param.TableName) ||
                    !IsValidIdentifier(param.FieldName) ||
                    !IsValidIdentifier(param.NewFieldName))
                    return new DosResult(0, null, "表名或字段名不合法");

                dynamic session = (object)_trans ?? param.DbSession;
                var fieldType = ConvertFieldType(param.FieldType);

                // 重命名列
                if (!param.FieldName.Equals(param.NewFieldName, StringComparison.OrdinalIgnoreCase))
                {
                    session.FromSql($"ALTER TABLE \"{param.TableName}\" RENAME COLUMN \"{param.FieldName}\" TO \"{param.NewFieldName}\"").ExecuteNonQuery();
                }

                // 修改类型
                if (param.FieldType != param.OldFieldType)
                {
                    session.FromSql($"ALTER TABLE \"{param.TableName}\" ALTER COLUMN \"{param.NewFieldName}\" TYPE {fieldType}").ExecuteNonQuery();
                }

                // 添加注释
                if (!param.FieldLabel.DosIsNullOrWhiteSpace())
                {
                    var comment = param.FieldLabel.Replace("'", "''");
                    try
                    {
                        session.FromSql($"COMMENT ON COLUMN \"{param.TableName}\".\"{param.NewFieldName}\" IS '{comment}'").ExecuteNonQuery();
                    }
                    catch { }
                }

                return new DosResult(1);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"修改字段失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 加载非DIY表
        /// </summary>
        public DosResult LoadNotDiyTable(DbServiceParam param, List<information_schema_columns> realFieldList, DbTrans _trans = null)
        {
            if (param.TableName.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

            dynamic session = (object)_trans ?? param.DbSession;

            if (!realFieldList.Any(d => d.column_name.ToLower() == "id"))
                session.FromSql($"ALTER TABLE \"{param.TableName}\" ADD COLUMN \"Id\" varchar(36) NOT NULL; ALTER TABLE \"{param.TableName}\" ADD PRIMARY KEY (\"Id\");").ExecuteNonQuery();
            if (!realFieldList.Any(d => d.column_name.ToLower() == "createtime"))
                session.FromSql($"ALTER TABLE \"{param.TableName}\" ADD COLUMN \"CreateTime\" timestamp NULL;").ExecuteNonQuery();
            if (!realFieldList.Any(d => d.column_name.ToLower() == "updatetime"))
                session.FromSql($"ALTER TABLE \"{param.TableName}\" ADD COLUMN \"UpdateTime\" timestamp NULL;").ExecuteNonQuery();
            if (!realFieldList.Any(d => d.column_name.ToLower() == "userid"))
                session.FromSql($"ALTER TABLE \"{param.TableName}\" ADD COLUMN \"UserId\" varchar(36) NULL;").ExecuteNonQuery();
            if (!realFieldList.Any(d => d.column_name.ToLower() == "username"))
                session.FromSql($"ALTER TABLE \"{param.TableName}\" ADD COLUMN \"UserName\" varchar(255) NULL;").ExecuteNonQuery();
            if (!realFieldList.Any(d => d.column_name.ToLower() == "isdeleted"))
                session.FromSql($"ALTER TABLE \"{param.TableName}\" ADD COLUMN \"IsDeleted\" int NULL DEFAULT 0;").ExecuteNonQuery();

            return new DosResult(1);
        }

        /// <summary>
        /// 获取所有表
        /// </summary>
        public DosResultList<string> GetTables(DbServiceParam param)
        {
            var sql = @"SELECT tablename AS table_name
                        FROM pg_catalog.pg_tables
                        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                        ORDER BY tablename";
            var result = param.DbSession.FromSql(sql).ToList<string>();
            return new DosResultList<string>(1, result);
        }

        /// <summary>
        /// 获取某张表的所有物理字段
        /// </summary>
        public DosResultList<information_schema_columns> GetColumns(DbServiceParam param)
        {
            var sql = $@"SELECT 
                            column_name,
                            data_type,
                            col_description((table_schema||'.'||table_name)::regclass, ordinal_position) AS column_comment,
                            '' AS column_key,
                            '' AS extra,
                            is_nullable,
                            udt_name AS column_type
                        FROM information_schema.columns
                        WHERE table_name = '{param.TableName}'
                        ORDER BY ordinal_position";
            var realFieldList = param.DbSession.FromSql(sql).ToList<information_schema_columns>();
            return new DosResultList<information_schema_columns>(1, realFieldList);
        }

        /// <summary>
        /// 分页SQL
        /// </summary>
        public string GetPaginationSql(string tableName, string sql, int pageIndex, int pageSize, string dbVersion = "")
        {
            return sql + $" LIMIT {pageSize} OFFSET {(pageIndex - 1) * pageSize}";
        }

        /// <summary>
        /// 获取表索引列表
        /// </summary>
        public DosResult GetTableIndexes(DbServiceParam param)
        {
            try
            {
                if (param.TableName.DosIsNullOrWhiteSpace() || param.DbSession == null)
                    return new DosResult(0, null, "参数错误");
                if (!IsValidIdentifier(param.TableName))
                    return new DosResult(0, null, "表名不合法");
                var sql = $@"SELECT indexname AS ""Key_name"", indexdef AS ""Index_type""
                            FROM pg_indexes
                            WHERE tablename = '{param.TableName}'";
                var list = param.DbSession.FromSql(sql).ToArray();
                return new DosResult(1, list);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"获取索引失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 创建索引
        /// </summary>
        public DosResult AddIndex(DbServiceParam param)
        {
            try
            {
                if (param.TableName.DosIsNullOrWhiteSpace() ||
                    param.IndexName.DosIsNullOrWhiteSpace() ||
                    param.IndexColumns.DosIsNullOrWhiteSpace() ||
                    param.DbSession == null)
                    return new DosResult(0, null, "参数错误");
                if (!IsValidIdentifier(param.TableName) || !IsValidIdentifier(param.IndexName))
                    return new DosResult(0, null, "表名或索引名不合法");

                var columns = param.IndexColumns.Split(',').Select(c => c.Trim()).ToArray();
                foreach (var col in columns)
                    if (!IsValidIdentifier(col)) return new DosResult(0, null, $"字段名不合法: {col}");
                var columnsSql = string.Join(", ", columns.Select(c => $"\"{c}\""));
                var uniqueStr = param.IndexUnique ? "UNIQUE " : "";
                var sql = $"CREATE {uniqueStr}INDEX \"{param.IndexName}\" ON \"{param.TableName}\" ({columnsSql})";

                param.DbSession.FromSql(sql).ExecuteNonQuery();
                return new DosResult(1, null, "索引创建成功");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"创建索引失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 删除索引
        /// </summary>
        public DosResult DropIndex(DbServiceParam param)
        {
            try
            {
                if (param.IndexName.DosIsNullOrWhiteSpace() || param.DbSession == null)
                    return new DosResult(0, null, "参数错误");
                if (!IsValidIdentifier(param.IndexName))
                    return new DosResult(0, null, "索引名不合法");

                var sql = $"DROP INDEX \"{param.IndexName}\"";
                param.DbSession.FromSql(sql).ExecuteNonQuery();
                return new DosResult(1, null, "索引删除成功");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"删除索引失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 转换MySQL类型为PostgreSQL类型
        /// </summary>
        private static string ConvertFieldType(string mysqlType)
        {
            if (mysqlType == null) return mysqlType;
            var lower = mysqlType.ToLower().Trim();
            if (lower == "datetime") return "timestamp";
            if (lower.StartsWith("bit")) return "int";
            if (lower == "mediumtext" || lower == "longtext") return "text";
            if (lower == "tinyint") return "smallint";
            return mysqlType;
        }

        private static bool IsValidIdentifier(string identifier)
        {
            if (string.IsNullOrWhiteSpace(identifier))
                return false;
            return System.Text.RegularExpressions.Regex.IsMatch(identifier, @"^[a-zA-Z_][a-zA-Z0-9_]*$");
        }
    }
}

using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using Dos.Common;
using Dos.ORM.Dialects.Dm8;

namespace Dos.ORM
{
    /// <summary>
    /// 达梦数据库实现（兼容Oracle语法）
    /// </summary>
    public class DaMengService : IMicroiORM
    {
        /// <summary>
        /// 达梦和Oracle一样，返回全大写字段名，需要显式别名
        /// </summary>
        public bool NeedsExplicitSelectAlias => true;
        public bool UsesRowNumberPagination => false;

        /// <summary>
        /// 达梦关键词字段名
        /// </summary>
        private static readonly HashSet<string> DefaultFieldNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Unique", "Level", "Column", "Lock"
        };

        public string GetDatetimeFieldValue(string datetime)
        {
            return $"TO_DATE('{datetime}', 'yyyy-mm-dd hh24:mi:ss')";
        }

        /// <summary>
        /// 达梦AS别名需要双引号包裹，否则返回全大写
        /// </summary>
        public string GetFieldAsName(string fieldName)
        {
            return "\"" + fieldName + "\"";
        }

        public string GetFieldName(string fieldName)
        {
            var physicalName =
                Dm8IdentifierCompatibility.ToPhysicalColumn(fieldName);
            if (!string.Equals(
                    physicalName,
                    fieldName,
                    StringComparison.Ordinal) ||
                DefaultFieldNames.Contains(physicalName))
            {
                return $"\"{physicalName}\"";
            }
            return physicalName;
        }

        public string GetTableName(string tableName, string userName = null)
        {
            if (userName.DosIsNullOrWhiteSpace())
            {
                return tableName;
            }
            return userName + "." + tableName;
        }

        /// <summary>
        /// 修改表名
        /// </summary>
        public DosResult UptDiyTable(DbServiceParam param, DbTrans _trans = null)
        {
            if (param.TableName.DosIsNullOrWhiteSpace() || param.OldTableName.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

            if (!IsValidIdentifier(param.TableName) || !IsValidIdentifier(param.OldTableName))
                return new DosResult(0, null, "表名不合法，只允许字母、数字和下划线");

            var sql = $"ALTER TABLE \"{param.OldTableName}\" RENAME TO \"{param.TableName}\"";

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

        /// <summary>
        /// 创建表
        /// </summary>
        public DosResult AddDiyTable(DbServiceParam param, DbTrans _trans = null)
        {
            if (param.TableName.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

            if (_trans == null && param.DbSession == null)
                return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

            if (!IsValidIdentifier(param.TableName))
                return new DosResult(0, null, "表名不合法，只允许字母、数字和下划线");

            var tableName = GetTableName(param.TableName);
            var sql = $@"CREATE TABLE {tableName}(
                        Id varchar(36) NOT NULL primary key,
                        CreateTime DATE NULL,
                        UpdateTime DATE NULL,
                        UserId varchar(36) NULL,
                        UserName varchar(255) NULL,
                        IsDeleted int NULL
                    )";

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
        /// 添加列
        /// </summary>
        public DosResult AddColumn(DbServiceParam param, DbTrans _trans = null)
        {
            if (param.TableName.DosIsNullOrWhiteSpace() ||
                param.FieldName.DosIsNullOrWhiteSpace() ||
                param.FieldType.DosIsNullOrWhiteSpace() ||
                (param.DbSession == null && _trans == null))
                return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

            if (!IsValidIdentifier(param.TableName) || !IsValidIdentifier(param.FieldName))
                return new DosResult(0, null, "表名或字段名不合法");

            param.FieldType = param.FieldType.Contains("text") ? "text" : param.FieldType;
            var physicalFieldName = GetFieldName(param.FieldName);
            var sql = $"ALTER TABLE {param.TableName} ADD {physicalFieldName} {param.FieldType} {(param.FieldNotNull ? "NOT NULL" : "NULL")}";

            try
            {
                dynamic session = (object)_trans ?? param.DbSession;
                session.FromSql(sql).ExecuteNonQuery();

                if (!param.FieldLabel.DosIsNullOrWhiteSpace())
                {
                    var commentSql = $"COMMENT ON COLUMN {param.TableName}.{physicalFieldName} IS '{param.FieldLabel.Replace("'", "''")}' ";
                    try { session.FromSql(commentSql).ExecuteNonQuery(); } catch { }
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
            if (param.TableName.DosIsNullOrWhiteSpace()
                || param.FieldName.DosIsNullOrWhiteSpace()
                || param.NewFieldName.DosIsNullOrWhiteSpace()
                || param.FieldType.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

            var tableName = GetTableName(param.TableName);
            var oldFieldName = GetFieldName(param.FieldName);
            var newFieldName = GetFieldName(param.NewFieldName);

            param.FieldType = param.FieldType.Contains("text") ? "text" : param.FieldType;

            dynamic session = (object)_trans ?? param.DbSession;

            if (oldFieldName.ToLower() != newFieldName.ToLower())
            {
                session.FromSql($"ALTER TABLE {tableName} RENAME COLUMN {oldFieldName} to {newFieldName}").ExecuteNonQuery();
            }

            if (param.FieldType != param.OldFieldType)
            {
                session.FromSql($"ALTER TABLE {tableName} MODIFY ({newFieldName} {param.FieldType})").ExecuteNonQuery();
            }

            if (param.FieldLabel != null)
            {
                session.FromSql($"COMMENT ON COLUMN {tableName}.{newFieldName} IS '{param.FieldLabel ?? ""}'").ExecuteNonQuery();
            }
            return new DosResult(1);
        }

        /// <summary>
        /// 加载非DIY表
        /// </summary>
        public DosResult LoadNotDiyTable(DbServiceParam param, List<information_schema_columns> realFieldList, DbTrans _trans = null)
        {
            if (param.TableName.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

            var fields = new[]
            {
                new { Name = "Id", Type = "varchar(36)", Label = "Id" },
                new { Name = "CreateTime", Type = "DATE", Label = "创建时间" },
                new { Name = "UpdateTime", Type = "DATE", Label = "修改时间" },
                new { Name = "UserId", Type = "varchar(36)", Label = "创建人Id" },
                new { Name = "UserName", Type = "varchar(255)", Label = "创建人" },
                new { Name = "IsDeleted", Type = "NUMBER", Label = "是否删除" },
            };

            foreach (var f in fields)
            {
                if (!realFieldList.Any(d => d.column_name.ToLower() == f.Name.ToLower()))
                {
                    AddColumn(new DbServiceParam()
                    {
                        TableName = param.TableName,
                        FieldName = f.Name,
                        FieldType = f.Type,
                        FieldLabel = f.Label,
                        DbSession = param.DbSession,
                        DbInfo = param.DbInfo
                    }, _trans);
                }
            }

            return new DosResult(1);
        }

        /// <summary>
        /// 获取所有表
        /// </summary>
        public DosResultList<string> GetTables(DbServiceParam param)
        {
            var sql = @"SELECT table_name FROM user_tables";
            var dosSession = param.DbSession;
            var result = dosSession.FromSql(sql).ToList<string>();
            return new DosResultList<string>(1, result);
        }

        /// <summary>
        /// 获取某张表的所有物理字段
        /// </summary>
        public DosResultList<information_schema_columns> GetColumns(DbServiceParam param)
        {
            var getAllFieldSql = @"SELECT
                                            a.COLUMN_NAME as ""column_name"",
                                            a.DATA_TYPE as ""data_type"",
                                            NVL(b.COMMENTS, '') as ""column_comment"",
                                            CASE WHEN pk.COLUMN_NAME IS NULL THEN '' ELSE 'PRI' END as ""column_key"",
                                            CASE WHEN a.NULLABLE = 'Y' THEN 'YES' ELSE 'NO' END as ""is_nullable"",
                                            a.DATA_TYPE as ""column_type"",
                                            a.CHAR_LENGTH as ""character_maximum_length""
                                            FROM USER_TAB_COLUMNS a
                                            LEFT JOIN USER_COL_COMMENTS b
                                                ON a.TABLE_NAME = b.TABLE_NAME AND a.COLUMN_NAME = b.COLUMN_NAME
                                            LEFT JOIN (
                                                SELECT cols.TABLE_NAME, cols.COLUMN_NAME
                                                FROM USER_CONSTRAINTS cons
                                                INNER JOIN USER_CONS_COLUMNS cols
                                                  ON cons.CONSTRAINT_NAME = cols.CONSTRAINT_NAME
                                                WHERE cons.CONSTRAINT_TYPE = 'P'
                                            ) pk
                                                ON pk.TABLE_NAME = a.TABLE_NAME AND pk.COLUMN_NAME = a.COLUMN_NAME
                                            WHERE a.TABLE_NAME = UPPER(:tableName)
                                            ORDER BY a.COLUMN_ID";
            var realFieldList = param.DbSession.FromSql(getAllFieldSql)
                .AddInParameter("tableName", DbType.String, param.TableName)
                .ToList<information_schema_columns>();
            foreach (var column in realFieldList)
            {
                if (column?.column_name != null)
                {
                    column.column_name =
                        Dm8IdentifierCompatibility.ToLogicalColumn(column.column_name);
                }
            }
            return new DosResultList<information_schema_columns>(1, realFieldList);
        }

        /// <summary>
        /// 分页SQL（达梦兼容Oracle）
        /// </summary>
        public string GetPaginationSql(string tableName, string sql, int pageIndex, int pageSize, string dbVersion = "")
        {
            if (!dbVersion.DosIsNullOrWhiteSpace() && dbVersion.ToLower() == "11g")
            {
                var result = " SELECT * FROM ( SELECT PAGETABLE.*, ROWNUM PAGENUMBER FROM ( " + sql;
                result += $" ) PAGETABLE WHERE ROWNUM <= {pageIndex * pageSize} ) WHERE PAGENUMBER >= {(pageIndex - 1) * pageSize + 1} ";
                return result;
            }
            else
            {
                return sql + $" OFFSET {(pageIndex - 1) * pageSize} ROWS FETCH NEXT {pageSize} ROW ONLY ";
            }
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
                var sql = $@"SELECT
                                AIC.INDEX_NAME AS ""Key_name"",
                                AIC.COLUMN_NAME AS ""Column_name"",
                                CASE WHEN AI.UNIQUENESS = 'UNIQUE' THEN 0 ELSE 1 END AS ""Non_unique"",
                                AI.INDEX_TYPE AS ""Index_type"",
                                AIC.COLUMN_POSITION AS ""Seq_in_index"",
                                CASE WHEN AC.CONSTRAINT_TYPE = 'P' THEN 1 ELSE 0 END AS ""Is_primary""
                            FROM ALL_IND_COLUMNS AIC
                            JOIN ALL_INDEXES AI
                              ON AIC.INDEX_NAME = AI.INDEX_NAME
                             AND AIC.TABLE_NAME = AI.TABLE_NAME
                            LEFT JOIN ALL_CONSTRAINTS AC
                              ON AC.INDEX_NAME = AI.INDEX_NAME
                             AND AC.TABLE_NAME = AI.TABLE_NAME
                            WHERE AIC.INDEX_OWNER = USER
                              AND AIC.TABLE_NAME = '{param.TableName.ToUpper()}'
                            ORDER BY AIC.INDEX_NAME, AIC.COLUMN_POSITION";
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
                var columnsSql = string.Join(", ", columns.Select(GetFieldName));
                var uniqueStr = param.IndexUnique ? "UNIQUE " : "";
                var sql = $"CREATE {uniqueStr}INDEX {param.IndexName} ON {param.TableName} ({columnsSql})";

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

                var sql = $"DROP INDEX {param.IndexName}";
                param.DbSession.FromSql(sql).ExecuteNonQuery();
                return new DosResult(1, null, "索引删除成功");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"删除索引失败: {ex.Message}");
            }
        }

        private static bool IsValidIdentifier(string identifier)
        {
            if (string.IsNullOrWhiteSpace(identifier))
                return false;
            return System.Text.RegularExpressions.Regex.IsMatch(identifier, @"^[a-zA-Z_][a-zA-Z0-9_]*$");
        }
    }
}

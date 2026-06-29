using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using Dos.Common;

namespace Dos.ORM
{
    /// <summary>
    /// MySql数据库实现
    /// </summary>
	public class MySqlService : IMicroiORM
    {
        private static readonly ConcurrentDictionary<string, SemaphoreSlim> TableDdlGates = new ConcurrentDictionary<string, SemaphoreSlim>(StringComparer.OrdinalIgnoreCase);

        private static int DdlLockWaitSeconds => ConfigHelper.GetEnvOrConfigurationInt("DOS_ORM_DDL_LOCK_WAIT_SECONDS", "OrmLimits:DdlLockWaitSeconds", 8);

        private static int DdlQueueWaitSeconds => ConfigHelper.GetEnvOrConfigurationInt("DOS_ORM_DDL_QUEUE_WAIT_SECONDS", "OrmLimits:DdlQueueWaitSeconds", 600);

        /// <summary>
        /// 修改表名
        /// </summary>
        /// <param name="param"></param>
        /// <param name="_trans"></param>
        /// <returns></returns>
        public DosResult UptDiyTable(DbServiceParam param, DbTrans _trans = null)
        {
            try
            {
                if (param.TableName.DosIsNullOrWhiteSpace() ||
                    param.OldTableName.DosIsNullOrWhiteSpace() ||
                    (param.DbSession == null && _trans == null))
                    return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

                // SQL注入防护
                if (!IsValidIdentifier(param.TableName) || !IsValidIdentifier(param.OldTableName))
                    return new DosResult(0, null, "表名不合法，只允许字母、数字和下划线");

                var sql = $"ALTER TABLE `{param.OldTableName}` rename `{param.TableName}`";
            
                dynamic session = (object)_trans ?? param.DbSession;
                session.FromSql(sql).ExecuteNonQuery();
                return new DosResult(1);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"重命名表失败: {ex.Message}");
            }
        }

        public bool NeedsExplicitSelectAlias => false;
        public bool UsesRowNumberPagination => false;

        public string GetDatetimeFieldValue(string datetime)
        {
            return "'" + datetime + "'";
        }

        public string GetFieldAsName(string fieldName)
        {
            return "`" + fieldName + "`";
        }

        public string GetFieldName(string fieldName)
        {
            return "`" + fieldName + "`";
        }

        public string GetTableName(string tableName, string userName = null)
        {
            return "`" + tableName + "`";
        }

        /// <summary>
        /// 创建表
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public DosResult AddDiyTable(DbServiceParam param, DbTrans _trans = null)
        {
            try
            {
                if (param.TableName.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

                // SQL注入防护
                if (!IsValidIdentifier(param.TableName))
                    return new DosResult(0, null, "表名不合法，只允许字母、数字和下划线");

                var sql = $@"CREATE TABLE `{param.TableName}` (
                          `Id` varchar(36) NOT NULL COMMENT 'Id',
                          `CreateTime` datetime NULL COMMENT '创建时间',
                          `UpdateTime` datetime NULL COMMENT '修改时间',
                          `UserId` varchar(36) NULL COMMENT '操作人Id',
                          `UserName` varchar(255) NULL COMMENT '操作人',
                          `IsDeleted` int NULL DEFAULT b'0' COMMENT '是否删除',
                          PRIMARY KEY(`Id`)
                        ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4";
            
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
        /// 必传：TableName、Field（必传Name、Type、_NotNull，可选：Label）
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public DosResult AddColumn(DbServiceParam param, DbTrans _trans = null)
        {
            SemaphoreSlim ddlGate = null;
            try
            {
                if (param.TableName.DosIsNullOrWhiteSpace()
                    || param.FieldName.DosIsNullOrWhiteSpace()
                    || param.FieldType.DosIsNullOrWhiteSpace()
                    || (param.DbSession == null && _trans == null)
                    )
                {
                    return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));
                }

                // SQL注入防护
                if (!IsValidIdentifier(param.TableName) || !IsValidIdentifier(param.FieldName))
                    return new DosResult(0, null, "表名或字段名不合法");

                // 转义注释内容防止SQL注入
                ddlGate = EnterTableDdlGate(param, out var gateError);
                if (ddlGate == null)
                {
                    return new DosResult(0, null, gateError);
                }

                dynamic session = (object)_trans ?? param.DbSession;
                PrepareDdlSession(session);
                if (ColumnExists(session, param.TableName, param.FieldName))
                {
                    ddlGate?.Release();
                    ddlGate = null;
                    return new DosResult(1, null, "字段已存在，已跳过物理列创建。");
                }

                var comment = param.FieldLabel?.Replace("'", "\\'") ?? "";
                var sql = $"ALTER TABLE `{param.TableName}` ADD COLUMN `{param.FieldName}` {param.FieldType} {(param.FieldNotNull ? "NOT NULL" : "NULL")} COMMENT '{comment}'";

                session.FromSql(sql).ExecuteNonQuery();
                ddlGate?.Release();
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

        /// <summary>
        /// 必传TableName
        /// </summary>
        /// <param name="param"></param>
        /// <param name="realFieldList"></param>
        /// <param name="_trans"></param>
        /// <returns></returns>
        public DosResult LoadNotDiyTable(DbServiceParam param, List<information_schema_columns> realFieldList, DbTrans _trans = null)
        {
            if (param.TableName.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (_trans != null)
            {
                var dosTrans = _trans;
                if (!realFieldList.Any(d => d.column_name.ToLower() == "id"))
                    dosTrans.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `Id` varchar(36) NOT NULL COMMENT 'Id';ALTER TABLE `" + param.TableName + "` ADD PRIMARY KEY (Id);")).ExecuteNonQuery();
                //if (!realFieldList.Any(d => d.column_name.ToLower() == "ParentId".ToLower()))
                //    trans.FromSql(string.Format("ALTER TABLE `" + addDiyTableResult.Data.Name + "` ADD COLUMN `ParentId` char(36) NULL COMMENT '父级Id';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "createtime".ToLower()))
                    dosTrans.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `CreateTime` datetime NULL COMMENT '创建时间';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "updatetime".ToLower()))
                    dosTrans.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `UpdateTime` datetime NULL COMMENT '修改时间';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "userid".ToLower()))
                    dosTrans.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `UserId` varchar(36) NULL COMMENT '创建人Id';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "username".ToLower()))
                    dosTrans.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `UserName` varchar(255) NULL COMMENT '创建人';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "isdeleted".ToLower()))
                    dosTrans.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `IsDeleted` bit(1) NULL DEFAULT b'0' COMMENT '是否删除';")).ExecuteNonQuery();

            }
            else
            {
                var dosSession = param.DbSession;
                if (!realFieldList.Any(d => d.column_name.ToLower() == "id"))
                    dosSession.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `Id` varchar(36) NOT NULL COMMENT 'Id';ALTER TABLE `" + param.TableName + "` ADD PRIMARY KEY (Id);")).ExecuteNonQuery();
                //if (!realFieldList.Any(d => d.column_name.ToLower() == "ParentId".ToLower()))
                //    trans.FromSql(string.Format("ALTER TABLE `" + addDiyTableResult.Data.Name + "` ADD COLUMN `ParentId` char(36) NULL COMMENT '父级Id';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "createtime".ToLower()))
                    dosSession.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `CreateTime` datetime NULL COMMENT '创建时间';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "updatetime".ToLower()))
                    dosSession.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `UpdateTime` datetime NULL COMMENT '修改时间';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "userid".ToLower()))
                    dosSession.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `UserId` varchar(36) NULL COMMENT '创建人Id';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "username".ToLower()))
                    dosSession.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `UserName` varchar(255) NULL COMMENT '创建人';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "isdeleted".ToLower()))
                    dosSession.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `IsDeleted` bit(1) NULL DEFAULT b'0' COMMENT '是否删除';")).ExecuteNonQuery();
            }

            return new DosResult(1);
        }

        /// <summary>
        /// 修改列
        /// 必传：TableName、Field（必传Name、Type、_NotNull，可选：Label）
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public DosResult ChangeColumn(DbServiceParam param, DbTrans _trans = null)
        {
            SemaphoreSlim ddlGate = null;
            try
            {
                if (param.TableName.DosIsNullOrWhiteSpace() ||
                    param.FieldName.DosIsNullOrWhiteSpace() ||
                    param.NewFieldName.DosIsNullOrWhiteSpace() ||
                    param.FieldType.DosIsNullOrWhiteSpace() ||
                    (param.DbSession == null && _trans == null))
                    return new DosResult(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));

                // SQL注入防护
                if (!IsValidIdentifier(param.TableName) ||
                    !IsValidIdentifier(param.FieldName) ||
                    !IsValidIdentifier(param.NewFieldName))
                    return new DosResult(0, null, "表名或字段名不合法");

                // 转义注释内容
                ddlGate = EnterTableDdlGate(param, out var gateError);
                if (ddlGate == null)
                {
                    return new DosResult(0, null, gateError);
                }

                dynamic session = (object)_trans ?? param.DbSession;
                PrepareDdlSession(session);

                var comment = param.FieldLabel?.Replace("'", "\\'") ?? "";
                var sql = $"ALTER TABLE `{param.TableName}` CHANGE `{param.FieldName}` `{param.NewFieldName}` {param.FieldType} {(param.FieldNotNull ? "NOT NULL" : "NULL")} COMMENT '{comment}'";
            
                session.FromSql(sql).ExecuteNonQuery();
                ddlGate?.Release();
                ddlGate = null;
                return new DosResult(1);
            }
            catch (Exception ex)
            {
                ddlGate?.Release();
                ddlGate = null;
                if (IsMetadataLockException(ex))
                    return new DosResult(0, null, $"表结构正在被其它操作占用，请稍后重试。{ex.Message}");
                return new DosResult(0, null, $"修改字段失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 获取所有表
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public DosResultList<string> GetTables(DbServiceParam param)
        {
            //if (param.OsClient.DosIsNullOrWhiteSpace())
            //{
            //    return new DosResultList<string>(0, null, DDLConfig.GetLang(param.OsClient, "ParamError", param._Lang));
            //}
            //取所有表
            var sql = @"select table_name
                        from information_schema.tables
                        where table_schema = (select database())
                        order by create_time desc";
            //var dbSession = OsClient.GetClient(param.OsClient).DbRead;

            //var clientModel = OsClient.GetClient(param.OsClient);
            //var dbSession = OsClient.GetClientDbSession(clientModel, param.DataBaseId);

            //var result = dbSession.FromSql(sql).ToList<string>();
            var result = param.DbSession.FromSql(sql).ToList<string>();
            return new DosResultList<string>(1, result);
        }

        /// <summary>
        /// 获取某张表的所有物理字段
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public DosResultList<information_schema_columns> GetColumns(DbServiceParam param)
        {
            var getAllFieldSql = @"select column_name, 
                                   data_type,
                                   column_comment,
                                   column_key,
                                   extra,
                                   is_nullable,
                                   column_type 
                                from information_schema.columns
                                where table_name = '{0}' 
                                   and table_schema = (select database()) 
                                order by ordinal_position;";
            var realFieldList = param.DbSession.FromSql(string.Format(getAllFieldSql, param.TableName)).ToList<information_schema_columns>();
            return new DosResultList<information_schema_columns>(1, realFieldList);
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
            var result = sql + string.Format("LIMIT {0},{1}", (pageIndex - 1) * pageSize, pageSize);
            return result;
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

        private static SemaphoreSlim EnterTableDdlGate(DbServiceParam param, out string error)
        {
            error = "";
            var waitSeconds = Math.Max(1, DdlQueueWaitSeconds);
            var key = $"{param?.OsClient ?? ""}|{param?.DataBaseId ?? ""}|{param?.TableName ?? ""}";
            var gate = TableDdlGates.GetOrAdd(key, _ => new SemaphoreSlim(1, 1));
            if (gate.Wait(TimeSpan.FromSeconds(waitSeconds)))
            {
                return gate;
            }

            error = $"表结构变更正在排队中，已等待 {waitSeconds} 秒，请稍后重试。";
            return null;
        }

        private static void PrepareDdlSession(dynamic session)
        {
            var seconds = Math.Max(1, DdlLockWaitSeconds);
            session.FromSql($"SET SESSION lock_wait_timeout = {seconds}").ExecuteNonQuery();
        }

        private static bool ColumnExists(dynamic session, string tableName, string fieldName)
        {
            var count = session.FromSql(@"SELECT COUNT(1)
FROM information_schema.columns
WHERE table_schema = DATABASE()
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
            return message.IndexOf("Duplicate column", StringComparison.OrdinalIgnoreCase) >= 0
                || message.IndexOf("1060", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static bool IsMetadataLockException(Exception ex)
        {
            var message = GetExceptionMessage(ex);
            return message.IndexOf("Lock wait timeout exceeded", StringComparison.OrdinalIgnoreCase) >= 0
                || message.IndexOf("metadata lock", StringComparison.OrdinalIgnoreCase) >= 0
                || message.IndexOf("1205", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static string GetExceptionMessage(Exception ex)
        {
            if (ex == null)
                return "";
            var baseException = ex.GetBaseException();
            return $"{ex.Message} {baseException?.Message}";
        }

        /// <summary>
        /// 获取表的索引列表
        /// </summary>
        public DosResult GetTableIndexes(DbServiceParam param)
        {
            try
            {
                if (param.TableName.DosIsNullOrWhiteSpace() || param.DbSession == null)
                    return new DosResult(0, null, "参数错误");
                if (!IsValidIdentifier(param.TableName))
                    return new DosResult(0, null, "表名不合法");

                var sql = $"SHOW INDEX FROM `{param.TableName}`";
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

                // 验证每个列名
                var columns = param.IndexColumns.Split(',').Select(c => c.Trim()).ToArray();
                foreach (var col in columns)
                {
                    if (!IsValidIdentifier(col))
                        return new DosResult(0, null, $"字段名不合法: {col}");
                }
                var columnsSql = string.Join(", ", columns.Select(c => $"`{c}`"));
                var uniqueStr = param.IndexUnique ? "UNIQUE " : "";
                var sql = $"CREATE {uniqueStr}INDEX `{param.IndexName}` ON `{param.TableName}` ({columnsSql})";

                var session = param.DbSession;
                session.FromSql(sql).ExecuteNonQuery();
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
                if (param.TableName.DosIsNullOrWhiteSpace() ||
                    param.IndexName.DosIsNullOrWhiteSpace() ||
                    param.DbSession == null)
                    return new DosResult(0, null, "参数错误");
                if (!IsValidIdentifier(param.TableName) || !IsValidIdentifier(param.IndexName))
                    return new DosResult(0, null, "表名或索引名不合法");

                var sql = $"DROP INDEX `{param.IndexName}` ON `{param.TableName}`";
                var session = param.DbSession;
                session.FromSql(sql).ExecuteNonQuery();
                return new DosResult(1, null, "索引删除成功");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"删除索引失败: {ex.Message}");
            }
        }
    }
}


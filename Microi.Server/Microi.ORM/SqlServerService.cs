using System;
using System.Collections.Generic;
using Dos.Common;
using Dos.ORM;
using Microi.net;

namespace Microi.net
{
    public class SqlServerService : IMicroiORM
    {
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
        public DosResult LoadNotDiyTable(DbServiceParam param, List<information_schema_columns> realFieldList, IMicroiDbTransaction _trans = null)
        {
            throw new Exception("SqlServer暂未实现此功能！");
        }


        /// <summary>
        /// 创建表
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public DosResult AddDiyTable(DbServiceParam param, IMicroiDbTransaction _trans = null)
        {
            if (param.TableName.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));

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
                var session = ORMAdapterHelper.GetUnderlyingObject(_trans, param.DbSession);
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
        public DosResult AddColumn(DbServiceParam param, IMicroiDbTransaction _trans = null)
        {
            if (param.TableName.DosIsNullOrWhiteSpace() ||
                param.FieldName.DosIsNullOrWhiteSpace() ||
                param.FieldType.DosIsNullOrWhiteSpace() ||
                (param.DbSession == null && _trans == null))
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));

            // SQL注入防护
            if (!IsValidIdentifier(param.TableName) || !IsValidIdentifier(param.FieldName))
                return new DosResult(0, null, "表名或字段名不合法");

            param.FieldType = param.FieldType.Contains("text") ? "text" : param.FieldType;
            var sql = $"ALTER TABLE [{param.TableName}] ADD [{param.FieldName}] {param.FieldType} {(param.FieldNotNull ? "NOT NULL" : "NULL")}";

            if (!param.FieldLabel.DosIsNullOrWhiteSpace())
            {
                // 转义单引号防止SQL注入
                var label = param.FieldLabel.Replace("'", "''");
                sql += $";EXEC sp_addextendedproperty 'MS_Description', N'{label}','SCHEMA', N'dbo','TABLE', N'{param.TableName}','COLUMN', N'{param.FieldName}'";
            }

            try
            {
                var session = ORMAdapterHelper.GetUnderlyingObject(_trans, param.DbSession);
                session.FromSql(sql).ExecuteNonQuery();
                return new DosResult(1);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, $"添加字段失败: {ex.Message}");
            }
        }

        public DosResult ChangeColumn(DbServiceParam param, IMicroiDbTransaction _trans = null)
        {
            if (param.TableName.DosIsNullOrWhiteSpace()
                || param.FieldName.DosIsNullOrWhiteSpace()
                || param.NewFieldName.DosIsNullOrWhiteSpace()
                || param.FieldType.DosIsNullOrWhiteSpace()
                )
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }

            param.FieldType = param.FieldType.Contains("text") ? "text" : param.FieldType;


            //修改列名：EXEC sp_rename ‘表名.[原有列名]’, ‘新列名’ , ‘COLUMN’;
            //exec sp_rename 'People.[PeopleBirthday]','PeopleBirth','column';

            var sql = $"EXEC sp_rename '[{param.TableName}].[{param.FieldName}]', '{param.NewFieldName}', 'COLUMN';";

            sql += $@"ALTER TABLE [{param.TableName}] ALTER COLUMN [{param.NewFieldName}] {param.FieldType} {(param.FieldNotNull ? "NOT NULL" : "NULL")};";

            if (!param.FieldLabel.DosIsNullOrWhiteSpace())
            {
                sql += $@"EXEC sp_updateextendedproperty 'MS_Description', N'{param.FieldLabel ?? ""}','SCHEMA', N'dbo','TABLE', N'{param.TableName}','COLUMN', N'{param.NewFieldName}';";
            }

            if (_trans != null)
            {
                var count = _trans.FromSql(sql).ExecuteNonQuery();
                return new DosResult(1);
            }
            else
            {
                if (param.OsClient.DosIsNullOrWhiteSpace())
                {
                    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
                }
                //DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
                IMicroiDbSession dbSession = param.OsClientModel.Db;
                //在客户数据库中创建表
                var count = dbSession.FromSql(sql).ExecuteNonQuery();
                return new DosResult(1);
            }
        }

        public DosResultList<string> GetTables(DbServiceParam param)
        {
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResultList<string>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            //取所有表
            var sql = @"select TABLE_NAME from information_schema.TABLES";
            //var dbSession = OsClient.GetClient(param.OsClient).DbRead;
            var dbSession = param.OsClientModel.DbRead;
            var result = dbSession.FromSql(sql).ToList<string>();
            return new DosResultList<string>(1, result);
        }

        public DosResult UptDiyTable(DbServiceParam param, IMicroiDbTransaction _trans = null)
        {
            if (param.TableName.DosIsNullOrWhiteSpace() ||
                param.OldTableName.DosIsNullOrWhiteSpace() ||
                (param.DbSession == null && _trans == null))
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));

            // SQL注入防护
            if (!IsValidIdentifier(param.TableName) || !IsValidIdentifier(param.OldTableName))
                return new DosResult(0, null, "表名不合法，只允许字母、数字和下划线");

            var sql = $"EXEC sp_rename '[{param.OldTableName}]', '{param.TableName}'";

            try
            {
                var session = ORMAdapterHelper.GetUnderlyingObject(_trans, param.DbSession);
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
                return new DosResultList<information_schema_columns>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));

            // SQL注入防护
            if (!IsValidIdentifier(param.TableName))
                return new DosResultList<information_schema_columns>(0, null, "表名不合法");

            var sql = $@"SELECT 
                            column_name, 
                            data_type,
                            column_name as column_comment,
                            column_key,
                            '' as extra,
                            is_nullable,
                            data_type as column_type
                        FROM information_schema.columns
                        WHERE table_name = '{param.TableName}'
                        ORDER BY ordinal_position";

            try
            {
                var dosSession = ORMAdapterHelper.GetDosSession(param.DbSession);
                var result = dosSession.FromSql(sql).ToList<information_schema_columns>();
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
    }
}


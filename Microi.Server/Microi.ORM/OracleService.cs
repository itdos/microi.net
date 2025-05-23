using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection.Emit;
using Dos.Common;
using Dos.ORM;

namespace Microi.net
{
    /// <summary>
    /// Oracle数据库实现
    /// </summary>
	public class OracleService : IDbService
    {
        /// <summary>
        /// 目前一些diy内置表用到的关键词字段名
        /// </summary>
        private static List<string> DefaultFieldNames = new List<string>() { "Unique", "Level", "Column", "Lock" };

        /// <summary>
        /// 特殊处理datetime类型的CreateTime字段
        /// </summary>
        /// <param name="datetime"></param>
        /// <returns></returns>
        public string GetDatetimeFieldValue(string datetime)
        {
            return $"TO_DATE('{datetime}', 'yyyy-mm-dd hh24:mi:ss')";
        }

        /// <summary>
        /// Oracle AS别名后返回正确的大驼峰字段名（属性名/对象名），否则会返回全大写。
        /// </summary>
        /// <param name="fieldName"></param>
        /// <returns></returns>
        public string GetFieldAsName(string fieldName)
        {
            return "\"" + fieldName + "\"";
        }

        /// <summary>
        /// 修改表名
        /// </summary>
        /// <param name="param"></param>
        /// <param name="_trans"></param>
        /// <returns></returns>
        public DosResult UptDiyTable(DbServiceParam param, DbTrans _trans = null)
        {
            if (param.TableName.DosIsNullOrWhiteSpace() || param.OldTableName.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }

            //ALTER TABLE table_name RENAME TO new_table_name;
            //RENAME table_name TO new_table_name;
            var sql = $"ALTER TABLE {param.OldTableName} RENAME TO {param.TableName}";

            if (_trans != null)
            {
                var count = _trans.FromSql(sql).ExecuteNonQuery();
                return new DosResult(1);
            }
            else
            {
                //if (param.OsClient.DosIsNullOrWhiteSpace())
                //{
                //    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
                //}
                //DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
                //var clientModel = OsClient.GetClient(param.OsClient);
                //var dbSession = OsClient.GetClientDbSession(clientModel, param.DataBaseId);
                var count = param.DbSession.FromSql(sql).ExecuteNonQuery();
                return new DosResult(1);
            }
        }

        /// <summary>
        /// Oracle字段名一般不加双引号，除非是关键词字段名
        /// </summary>
        /// <param name="fieldName"></param>
        /// <returns></returns>
        public string GetFieldName(string fieldName)
        {
            if (DefaultFieldNames.Any(d => d.ToLower() == fieldName.ToLower()))
            {
                return "\"" + fieldName + "\"";
            }
            return fieldName;
        }

        /// <summary>
        /// 目前暂时用不到userName，以原tableName返回。
        /// </summary>
        /// <param name="tableName"></param>
        /// <param name="userName"></param>
        /// <returns></returns>
        public string GetTableName(string tableName, string userName = null)
        {
            if (userName.DosIsNullOrWhiteSpace())
            {
                return tableName;
            }
            return userName + "." + tableName;
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
            if (param.TableName.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            //if (_trans != null)
            {
                if (!realFieldList.Any(d => d.column_name.ToLower() == "id"))
                {
                    AddColumn(new DbServiceParam() {
                        TableName = param.TableName,
                        Field = new DiyField() {
                            Name = "Id",
                            Type = "varchar(36)",
                            Label = "Id",
                        },
                        DbSession = param.DbSession,
                        DbInfo = param.DbInfo
                    }, _trans);
                }
                    //_trans.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `Id` varchar(36) NOT NULL COMMENT 'Id';ALTER TABLE `" + param.TableName + "` ADD PRIMARY KEY (Id);")).ExecuteNonQuery();
                //if (!realFieldList.Any(d => d.column_name.ToLower() == "ParentId".ToLower()))
                //    trans.FromSql(string.Format("ALTER TABLE `" + addDiyTableResult.Data.Name + "` ADD COLUMN `ParentId` char(36) NULL COMMENT '父级Id';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "createtime".ToLower()))
                    AddColumn(new DbServiceParam()
                    {
                        TableName = param.TableName,
                        Field = new DiyField()
                        {
                            Name = "CreateTime",
                            Type = "DATE",
                            Label = "创建时间"
                        },
                        DbSession = param.DbSession,
                        DbInfo = param.DbInfo
                    }, _trans);
                //_trans.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `CreateTime` datetime NULL COMMENT '创建时间';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "updatetime".ToLower()))
                    AddColumn(new DbServiceParam()
                    {
                        TableName = param.TableName,
                        Field = new DiyField()
                        {
                            Name = "UpdateTime",
                            Type = "DATE",
                            Label = "修改时间"
                        },
                        DbSession = param.DbSession,
                        DbInfo = param.DbInfo
                    }, _trans);
                //_trans.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `UpdateTime` datetime NULL COMMENT '修改时间';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "userid".ToLower()))
                    AddColumn(new DbServiceParam()
                    {
                        TableName = param.TableName,
                        Field = new DiyField()
                        {
                            Name = "UserId",
                            Type = "varchar(36)",
                            Label = "创建人Id"
                        },
                        DbSession = param.DbSession,
                        DbInfo = param.DbInfo
                    }, _trans);
                //_trans.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `UserId` varchar(36) NULL COMMENT '操作人Id';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "username".ToLower()))
                    AddColumn(new DbServiceParam()
                    {
                        TableName = param.TableName,
                        Field = new DiyField()
                        {
                            Name = "UserName",
                            Type = "varchar(255)",
                            Label = "创建人"
                        },
                        DbSession = param.DbSession,
                        DbInfo = param.DbInfo
                    }, _trans);
                //_trans.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `UserName` varchar(255) NULL COMMENT '操作人';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "isdeleted".ToLower()))
                    AddColumn(new DbServiceParam()
                    {
                        TableName = param.TableName,
                        Field = new DiyField()
                        {
                            Name = "IsDeleted",
                            Type = "NUMBER",
                            Label = "是否删除"
                        },
                        DbSession = param.DbSession,
                        DbInfo = param.DbInfo
                    }, _trans);
                //_trans.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `IsDeleted` bit(1) NULL DEFAULT b'0' COMMENT '是否删除';")).ExecuteNonQuery();

            }
            //else
            //{
            //    if (!realFieldList.Any(d => d.column_name.ToLower() == "id"))
            //        param.DbSession.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `Id` varchar(36) NOT NULL COMMENT 'Id';ALTER TABLE `" + param.TableName + "` ADD PRIMARY KEY (Id);")).ExecuteNonQuery();
            //    //if (!realFieldList.Any(d => d.column_name.ToLower() == "ParentId".ToLower()))
            //    //    trans.FromSql(string.Format("ALTER TABLE `" + addDiyTableResult.Data.Name + "` ADD COLUMN `ParentId` char(36) NULL COMMENT '父级Id';")).ExecuteNonQuery();
            //    if (!realFieldList.Any(d => d.column_name.ToLower() == "createtime".ToLower()))
            //        param.DbSession.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `CreateTime` datetime NULL COMMENT '创建时间';")).ExecuteNonQuery();
            //    if (!realFieldList.Any(d => d.column_name.ToLower() == "updatetime".ToLower()))
            //        param.DbSession.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `UpdateTime` datetime NULL COMMENT '修改时间';")).ExecuteNonQuery();
            //    if (!realFieldList.Any(d => d.column_name.ToLower() == "userid".ToLower()))
            //        param.DbSession.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `UserId` varchar(36) NULL COMMENT '操作人Id';")).ExecuteNonQuery();
            //    if (!realFieldList.Any(d => d.column_name.ToLower() == "username".ToLower()))
            //        param.DbSession.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `UserName` varchar(255) NULL COMMENT '操作人';")).ExecuteNonQuery();
            //    if (!realFieldList.Any(d => d.column_name.ToLower() == "isdeleted".ToLower()))
            //        param.DbSession.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `IsDeleted` bit(1) NULL DEFAULT b'0' COMMENT '是否删除';")).ExecuteNonQuery();
            //}

            return new DosResult(1);
        }

        /// <summary>
        /// 创建表
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public DosResult AddDiyTable(DbServiceParam param, DbTrans _trans = null)
        {
            if (param.TableName.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }

            if (_trans == null && param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }

            var tableName = param.DbInfo.DbService.GetTableName(param.TableName);//param.OsClientModel.DbOracleTableSpace

            var sql1 = $@"CREATE TABLE {tableName}(
	                        Id varchar(36) NOT NULL primary key,
	                        CreateTime DATE NULL,
	                        UpdateTime DATE NULL,
	                        UserId varchar(36) NULL,
	                        UserName varchar(255) NULL,
	                        IsDeleted int NULL
                        )
                        ";
            //Id varchar(36) NOT NULL constraint pk_si_sno primary key,
            //COMMENT ON COLUMN { tableName}.Id IS 'Id';
            //COMMENT ON COLUMN { tableName}.CreateTime IS '创建时间';
            //COMMENT ON COLUMN { tableName}.UpdateTime IS '修改时间';
            //COMMENT ON COLUMN { tableName}.UserId IS '新增人Id';
            //COMMENT ON COLUMN { tableName}.UserName IS '新增人';
            //COMMENT ON COLUMN { tableName}.IsDeleted IS '是否删除';
            if (_trans != null)
            {
                var count = _trans.FromSql(sql1).ExecuteNonQuery();
            }
            else
            {
                //var clientModel = OsClient.GetClient(param.OsClient);
                //DbSession dbSession = clientModel.Db;
                //var dbSession = OsClient.GetClientDbSession(clientModel, param.DataBaseId);//clientModel.Db;

                //var count = dbSession.FromSql(sql1).ExecuteNonQuery();
                var count = param.DbSession.FromSql(sql1).ExecuteNonQuery();
            }

            //var sql2 = $"ALTER TABLE {tableName} ADD PRIMARY KEY (Id)";

            //if (_trans != null)
            //{
            //    var count = _trans.FromSql(sql2).ExecuteNonQuery();
            //}
            //else
            //{
            //    DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
            //    var count = dbSession.FromSql(sql2).ExecuteNonQuery();
            //}

            return new DosResult(1);

        }

        /// <summary>
        /// 添加列/字段
        /// </summary>
        /// <param name="param"></param>
        /// <param name="_trans"></param>
        /// <returns></returns>
        public DosResult AddColumn(DbServiceParam param, DbTrans _trans = null)
        {
            if (param.TableName.DosIsNullOrWhiteSpace()
                || param.FieldName.DosIsNullOrWhiteSpace()
                || param.FieldType.DosIsNullOrWhiteSpace()
                || (param.DbSession == null && _trans == null)
                )
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }

            // DbSession dbSession = null;

            // if (param.OsClientModel != null)
            // {
            //     dbSession = param.OsClientModel.Db;
            // }
            // if (_trans == null)
            {
                //if (!param.OsClient.DosIsNullOrWhiteSpace())
                //{
                //    dbSession = OsClient.GetClient(param.OsClient).Db;
                //}
                //if (param.OsClient.DosIsNullOrWhiteSpace() && dbSession == null)
                //{
                //    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
                //}
            }

            //if (!param.DataBaseId.DosIsNullOrWhiteSpace())
            //{
            //    dbSession = OsClient.GetClientDbSession(param.OsClientModel, param.DataBaseId);
            //}

            var count = 0;
            // var tableName = param.DbInfo.DbService.GetTableName(param.TableName);//, param.OsClientModel.DbOracleTableSpace
            // var fieldName = param.DbInfo.DbService.GetFieldName(param.FieldName);

            param.FieldType = param.FieldType.Contains("text") ? "text" : param.FieldType;

            var sql = $@"ALTER TABLE {param.TableName} ADD {param.FieldName} {param.FieldType} {(param.FieldNotNull ? "NOT NULL" : "NULL")} ";

            if (_trans != null)
            {
                try
                {
                    count = _trans.FromSql(sql).ExecuteNonQuery();
                }
                catch (System.Exception ex)
                {
                    return new DosResult(0, null, ex.Message);
                }
            }
            else
            {
                try
                {
                    count = param.DbSession.FromSql(sql).ExecuteNonQuery();
                }
                catch (System.Exception ex)
                {
                    return new DosResult(0, null, ex.Message);
                }
            }
            if (!param.FieldLabel.DosIsNullOrWhiteSpace())
            {
                try
                {
                    var sql2 = $"COMMENT ON COLUMN {param.TableName}.{param.FieldName} IS '{param.FieldLabel ?? ""}' ";
                    if (_trans != null)
                        count = _trans.FromSql(sql2).ExecuteNonQuery();
                    else
                        count = param.DbSession.FromSql(sql2).ExecuteNonQuery();
                }
                catch (System.Exception)
                {
                }
            }
            return new DosResult(1);
        }

        /// <summary>
        /// 修改列/字段
        /// </summary>
        /// <param name="param"></param>
        /// <param name="_trans"></param>
        /// <returns></returns>
        public DosResult ChangeColumn(DbServiceParam param, DbTrans _trans = null)
        {
            if (param.TableName.DosIsNullOrWhiteSpace()
                || param.FieldName.DosIsNullOrWhiteSpace()
                || param.NewFieldName.DosIsNullOrWhiteSpace()
                || param.FieldType.DosIsNullOrWhiteSpace()
                )
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }

            //DbSession dbSession = null;

            //if (param.OsClientModel != null)
            //{
            //    dbSession = param.OsClientModel.Db;
            //}

            //if (_trans == null)
            //{
            //    if (!param.OsClient.DosIsNullOrWhiteSpace())
            //    {
            //        dbSession = OsClient.GetClient(param.OsClient).Db;
            //    }
            //    if (param.OsClient.DosIsNullOrWhiteSpace() && dbSession == null)
            //    {
            //        return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            //    }
            //}

            //if (!param.DataBaseId.DosIsNullOrWhiteSpace())
            //{
            //    dbSession = OsClient.GetClientDbSession(param.OsClientModel, param.DataBaseId);
            //}

            var tableName = param.DbInfo.DbService.GetTableName(param.TableName);//, param.OsClientModel.DbOracleTableSpace
            var oldFieldName = param.DbInfo.DbService.GetFieldName(param.FieldName);
            var newFieldName = param.DbInfo.DbService.GetFieldName(param.NewFieldName);

            param.FieldType = param.FieldType.Contains("text") ? "text" : param.FieldType;

            

            //修改列名：EXEC sp_rename ‘表名.[原有列名]’, ‘新列名’ , ‘COLUMN’;
            //exec sp_rename 'People.[PeopleBirthday]','PeopleBirth','column';

            if (oldFieldName.ToLower() != newFieldName.ToLower())
            {
                //修改名称
                var sql = $@"ALTER TABLE {tableName} RENAME COLUMN {oldFieldName} to {newFieldName}";
                if (_trans != null)
                {
                    var count = _trans.FromSql(sql).ExecuteNonQuery();
                }
                else
                {
                    var count = param.DbSession.FromSql(sql).ExecuteNonQuery();
                }
            }


            if (param.FieldType != param.OldFieldType)
            {
                var upTypeSql = $"alter table {tableName} modify ({newFieldName} {param.FieldType})";
                var count2 = param.DbSession.FromSql(upTypeSql).ExecuteNonQuery();
            }

            if (param.FieldLabel != null)
            {
                var sql = $"COMMENT ON COLUMN {tableName}.{newFieldName} IS '{param.FieldLabel ?? ""}'";
                if (_trans != null)
                {
                    var count = _trans.FromSql(sql).ExecuteNonQuery();
                }
                else
                {
                    var count = param.DbSession.FromSql(sql).ExecuteNonQuery();
                }
            }
            return new DosResult(1);
        }


        /// <summary>
        /// 获取所有表
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        public DosResultList<string> GetTables(DbServiceParam param)
        {
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new DosResultList<string>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            //取所有表
            //var sql = @"select TABLE_NAME from information_schema.TABLES";
            var sql = @"SELECT table_name FROM user_tables";
            
            //var dbSession = OsClient.GetClient(param.OsClient).DbRead;

            //if (!param.DataBaseId.DosIsNullOrWhiteSpace())
            //{
            //    var clientModel = OsClient.GetClient(param.OsClient);
            //    dbSession = OsClient.GetClientDbSession(clientModel, param.DataBaseId);
            //}

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
            var getAllFieldSql = @"SELECT 
                                            COLUMN_NAME as ""column_name"", 
                                            DATA_TYPE as ""data_type"",
                                            COLUMN_NAME as ""column_comment"",
                                            'YES' as ""is_nullable"",
                                            DATA_TYPE as ""column_type""
                                            FROM all_tab_columns
                                            WHERE table_name = '{0}'";
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
        public string GetPaginationSql(string tableName, string sql, int pageIndex, int pageSize, string dbVersion = "")
        {
            //2024-04-09：oracle 11g分页处理（注意：dos.orm也有相关处理）
            if (!dbVersion.DosIsNullOrWhiteSpace() && dbVersion.ToLower() == "11g")
            {
                var result = " SELECT * FROM ( SELECT PAGETABLE.*, ROWNUM PAGENUMBER FROM ( " + sql;
                result += $" ) PAGETABLE WHERE ROWNUM <= {pageIndex * pageSize} ) WHERE PAGENUMBER >= {(pageIndex - 1) * pageSize + 1} ";
                return result;
            }
            else
            {
                //oracle 12c分页
                var result = sql + $" OFFSET {(pageIndex - 1) * pageSize} ROWS FETCH NEXT {pageSize} ROW ONLY ";
                return result;
            }
        }
    }
}


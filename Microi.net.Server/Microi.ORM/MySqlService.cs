﻿using System;
using System.Collections.Generic;
using System.Linq;
using Dos.Common;
using Dos.ORM;

namespace Microi.net
{
    /// <summary>
    /// MySql数据库实现
    /// </summary>
	public class MySqlService : IDbService
	{
        /// <summary>
        /// 修改表名
        /// </summary>
        /// <param name="param"></param>
        /// <param name="_trans"></param>
        /// <returns></returns>
        public DosResult UptDiyTable(DbServiceParam param, DbTrans _trans = null)
        {
            if (param.TableName.DosIsNullOrWhiteSpace() || param.OldTableName.DosIsNullOrWhiteSpace()
                || (param.DbSession == null && _trans == null))
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            var sql = $"ALTER TABLE `{param.OldTableName}` rename `{param.TableName}`";
            if (_trans != null)
            {
                try
                {
                    var count = _trans.FromSql(sql).ExecuteNonQuery();
                    return new DosResult(1);
                }
                catch (System.Exception ex)
                {
                    return new DosResult(0, null, ex.Message);
                }
            }
            else
            {
                //if (param.OsClient.DosIsNullOrWhiteSpace())
                //{
                //    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
                //}

                //var clientModel = OsClient.GetClient(param.OsClient);
                //var dbSession = OsClient.GetClientDbSession(clientModel, param.DataBaseId);

                //DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
                //var count = dbSession.FromSql(sql).ExecuteNonQuery();
                try
                {
                    var count = param.DbSession.FromSql(sql).ExecuteNonQuery();
                    return new DosResult(1);
                }
                catch (System.Exception ex)
                {
                    return new DosResult(0, null, ex.Message);
                }
            }
        }

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
            if (param.TableName.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }

            var sql = $@"CREATE TABLE `{param.TableName}` (
                                      `Id` varchar(36) NOT NULL COMMENT 'Id',
                                      `CreateTime` datetime NULL COMMENT '创建时间',
                                      `UpdateTime` datetime NULL COMMENT '修改时间',
                                      `UserId` varchar(36) NULL COMMENT '操作人Id',
                                      `UserName` varchar(255) NULL COMMENT '操作人',
                                      `IsDeleted` bit(1) NULL DEFAULT b'0' COMMENT '是否删除',
                                      PRIMARY KEY(`Id`)
                                    ) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4; ";


            //foreach (var item in param.FieldList)
            //{
            //    sql += $"{item.Name}";
            //}

            //sql += "";

            if (_trans != null)
            {
                try
                {
                    var count = _trans.FromSql(sql).ExecuteNonQuery();
                    return new DosResult(1);
                }
                catch (System.Exception ex)
                {
                    return new DosResult(0, null, ex.Message);
                }
                
            }
            else
            {
                // if (param.OsClient.DosIsNullOrWhiteSpace())
                // {
                //     return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
                // }
                //DbSession dbSession = OsClient.GetClient(param.OsClient).Db;

                //var clientModel = OsClient.GetClient(param.OsClient);
                //DbSession dbSession = clientModel.Db;
                //var dbSession = OsClient.GetClientDbSession(clientModel, param.DataBaseId);//clientModel.Db;

                //在客户数据库中创建表
                //var count = dbSession.FromSql(sql).ExecuteNonQuery();
                try
                {
                    var count = param.DbSession.FromSql(sql).ExecuteNonQuery();
                    return new DosResult(1);
                }
                catch (System.Exception ex)
                {
                    return new DosResult(0, null, ex.Message);
                }
                
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
            if (param.TableName.DosIsNullOrWhiteSpace()
                || param.FieldName.DosIsNullOrWhiteSpace()
                || param.FieldType.DosIsNullOrWhiteSpace()
                || (param.DbSession == null && _trans == null)
                ) 
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }

            var sql = $"ALTER TABLE `{param.TableName}` ADD COLUMN `{param.FieldName}` {param.FieldType} {(param.FieldNotNull ? "NOT NULL" : "NULL")} COMMENT '{param.FieldLabel ?? ""}';";

            if (_trans != null)
            {
                try
                {
                    var count = _trans.FromSql(sql).ExecuteNonQuery();
                    return new DosResult(1);
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
                    var count = param.DbSession.FromSql(sql).ExecuteNonQuery();
                    return new DosResult(1);
                }
                catch (System.Exception ex)
                {
                    return new DosResult(0, null, ex.Message);
                }
                // DbSession dbSession = OsClient.GetClient(param.OsClient).Db;
                // var clientModel = OsClient.GetClient(param.OsClient);
                // var dbSession = OsClient.GetClientDbSession(clientModel, param.DataBaseId);
                // return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
                //在客户数据库中创建表
                //var count = dbSession.FromSql(sql).ExecuteNonQuery();
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
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }
            if (_trans != null)
            {
                if (!realFieldList.Any(d => d.column_name.ToLower() == "id"))
                    _trans.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `Id` varchar(36) NOT NULL COMMENT 'Id';ALTER TABLE `" + param.TableName + "` ADD PRIMARY KEY (Id);")).ExecuteNonQuery();
                //if (!realFieldList.Any(d => d.column_name.ToLower() == "ParentId".ToLower()))
                //    trans.FromSql(string.Format("ALTER TABLE `" + addDiyTableResult.Data.Name + "` ADD COLUMN `ParentId` char(36) NULL COMMENT '父级Id';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "createtime".ToLower()))
                    _trans.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `CreateTime` datetime NULL COMMENT '创建时间';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "updatetime".ToLower()))
                    _trans.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `UpdateTime` datetime NULL COMMENT '修改时间';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "userid".ToLower()))
                    _trans.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `UserId` varchar(36) NULL COMMENT '创建人Id';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "username".ToLower()))
                    _trans.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `UserName` varchar(255) NULL COMMENT '创建人';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "isdeleted".ToLower()))
                    _trans.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `IsDeleted` bit(1) NULL DEFAULT b'0' COMMENT '是否删除';")).ExecuteNonQuery();

            }
            else
            {
                if (!realFieldList.Any(d => d.column_name.ToLower() == "id"))
                    param.DbSession.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `Id` varchar(36) NOT NULL COMMENT 'Id';ALTER TABLE `" + param.TableName + "` ADD PRIMARY KEY (Id);")).ExecuteNonQuery();
                //if (!realFieldList.Any(d => d.column_name.ToLower() == "ParentId".ToLower()))
                //    trans.FromSql(string.Format("ALTER TABLE `" + addDiyTableResult.Data.Name + "` ADD COLUMN `ParentId` char(36) NULL COMMENT '父级Id';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "createtime".ToLower()))
                    param.DbSession.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `CreateTime` datetime NULL COMMENT '创建时间';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "updatetime".ToLower()))
                    param.DbSession.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `UpdateTime` datetime NULL COMMENT '修改时间';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "userid".ToLower()))
                    param.DbSession.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `UserId` varchar(36) NULL COMMENT '创建人Id';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "username".ToLower()))
                    param.DbSession.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `UserName` varchar(255) NULL COMMENT '创建人';")).ExecuteNonQuery();
                if (!realFieldList.Any(d => d.column_name.ToLower() == "isdeleted".ToLower()))
                    param.DbSession.FromSql(string.Format("ALTER TABLE `" + param.TableName + "` ADD COLUMN `IsDeleted` bit(1) NULL DEFAULT b'0' COMMENT '是否删除';")).ExecuteNonQuery();
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
            if (param.TableName.DosIsNullOrWhiteSpace()
                || param.FieldName.DosIsNullOrWhiteSpace()
                || param.NewFieldName.DosIsNullOrWhiteSpace()
                || param.FieldType.DosIsNullOrWhiteSpace()
                || (param.DbSession == null && _trans == null)
                )
            {
                return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
            }

            //在使用 CHANGE 子句修改列定义时，不支持直接设置字符集和排序规则
            // CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci
            var sql = $"ALTER TABLE `{param.TableName}` CHANGE `{param.FieldName}` `{param.NewFieldName}` {param.FieldType} {(param.FieldNotNull ? "NOT NULL" : "NULL")} COMMENT '{param.FieldLabel ?? ""}';";

            if (_trans != null)
            {
                try
                {
                    var count = _trans.FromSql(sql).ExecuteNonQuery();
                    return new DosResult(1);
                }
                catch (System.Exception ex)
                {
                    return new DosResult(0, null, ex.Message);
                }
            }
            else
            {
                //if (param.OsClient.DosIsNullOrWhiteSpace())
                //{
                //    return new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
                //}
                //DbSession dbSession = OsClient.GetClient(param.OsClient).Db;

                //var clientModel = OsClient.GetClient(param.OsClient);
                //var dbSession = OsClient.GetClientDbSession(clientModel, param.DataBaseId);//clientModel.Db;

                //在客户数据库中创建表
                //var count = dbSession.FromSql(sql).ExecuteNonQuery();
                try
                {
                    var count = param.DbSession.FromSql(sql).ExecuteNonQuery();
                    return new DosResult(1);
                }
                catch (System.Exception ex)
                {
                    return new DosResult(0, null, ex.Message);
                }
                
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
            //    return new DosResultList<string>(0, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang));
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
    }
}


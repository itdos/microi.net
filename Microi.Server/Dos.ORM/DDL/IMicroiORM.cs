using System.Collections.Generic;
using Dos.Common;

namespace Dos.ORM
{
    /// <summary>
    /// 数据库DDL操作接口（建表、改列、索引等）
    /// </summary>
    public interface IMicroiORM
    {
        /// <summary>
        /// 创建表
        /// </summary>
        DosResult AddDiyTable(DbServiceParam param, DbTrans _trans = null);

        /// <summary>
        /// 创建列
        /// 必传：TableName、Field（必传Name、Type、_NotNull，可选：Label）
        /// </summary>
        DosResult AddColumn(DbServiceParam param, DbTrans _trans = null);

        DosResult ChangeColumn(DbServiceParam param, DbTrans _trans = null);
        DosResult LoadNotDiyTable(DbServiceParam param, List<information_schema_columns> realFieldList, DbTrans _trans = null);
        DosResultList<string> GetTables(DbServiceParam param);
        DosResultList<information_schema_columns> GetColumns(DbServiceParam param);

        DosResult UptDiyTable(DbServiceParam param, DbTrans _trans = null);

        string GetTableName(string tableName, string userName = null);
        string GetFieldName(string fieldName);
        string GetFieldAsName(string fieldName);
        string GetDatetimeFieldValue(string datetime);
        string GetPaginationSql(string tableName, string sql, int pageIndex, int pageSize, string dbVersion = "");

        /// <summary>
        /// 是否需要在SELECT中为每个字段添加显式别名（如Oracle/达梦返回全大写字段名，需要AS "FieldName"）
        /// </summary>
        bool NeedsExplicitSelectAlias { get; }

        /// <summary>
        /// 是否使用ROW_NUMBER分页（如SqlServer非首页需要ROW_NUMBER() OVER(...)）
        /// </summary>
        bool UsesRowNumberPagination { get; }

        /// <summary>
        /// 获取表索引列表
        /// </summary>
        DosResult GetTableIndexes(DbServiceParam param);

        /// <summary>
        /// 创建索引
        /// </summary>
        DosResult AddIndex(DbServiceParam param);

        /// <summary>
        /// 删除索引
        /// </summary>
        DosResult DropIndex(DbServiceParam param);
    }
}

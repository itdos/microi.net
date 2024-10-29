#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) Microi.net
* CLR 版本: 
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using System.Collections.Generic;
using Dos.Common;
using Dos.ORM;

namespace Microi.net
{
	public class DbServiceParam
	{
        public string FieldName { get; set; }
        public string NewFieldName { get; set; }
        public string FieldType { get; set; }
        public string OldFieldType { get; set; }
        public bool FieldNotNull { get; set; }
        public string FieldLabel  { get; set; }

		public string DataBaseId { get; set; }
		public string OsClient { get; set; }
        public string TableName { get; set; }
        public string OldTableName { get; set; }
        public DiyField Field { get; set; }
        public List<DiyField> FieldList { get; set; }
		public DbInfo DbInfo { get; set; }
		public OsClientSecret OsClientModel { get; set; }
		public DbSession DbSession { get; set; }
        public string _Lang = DiyMessage.Lang;
    }
	/// <summary>
	/// 
	/// </summary>
	public interface IDbService
	{
		/// <summary>
		/// 创建表
		/// </summary>
		/// <param name="param"></param>
		/// <returns></returns>
		DosResult AddDiyTable(DbServiceParam param, DbTrans _trans = null);
        /// <summary>
        /// 创建列
        /// 必传：TableName、Field（必传Name、Type、_NotNull，可选：Label）
        /// </summary>
        /// <param name="param"></param>
        /// <param name="_trans"></param>
        /// <returns></returns>
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
    }

}


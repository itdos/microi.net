using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;

namespace Microi.net
{
    /// <summary>
	/// 
	/// </summary>
	public interface IMicroiORM
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

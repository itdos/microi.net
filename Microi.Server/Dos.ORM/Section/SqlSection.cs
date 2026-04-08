#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) iTdos
* CLR 版本: 4.0.30319.18408
* 创 建 人：steven hu
* 电子邮箱：
* 官方网站：www.iTdos.com
* 创建日期：2010/2/10
* 文件描述：
******************************************************
* 修 改 人：iTdos
* 修改日期：
* 备注描述：
*******************************************************/
#endregion

using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using Dos.ORM.Common;

namespace Dos.ORM
{
    /// <summary>
    /// 执行sql语句
    /// </summary>
    public class SqlSection : Section
    {

        /// <summary>
        /// 
        /// </summary>
        /// <param name="dbSession"></param>
        /// <param name="sql"></param>
        public SqlSection(DbSession dbSession, string sql)
            : base(dbSession)
        {

            Check.Require(sql, "sql", Check.NotNullOrEmpty);

            this.cmd = dbSession.Db.GetSqlStringCommand(sql);
        }

        /// <summary>
        /// 设置事务
        /// </summary>
        /// <param name="tran"></param>
        /// <returns></returns>
        public SqlSection SetDbTransaction(DbTransaction tran)
        {
            this.tran = tran;
            return this;
        }

        #region 添加参数


        /// <summary>
        /// 添加参数
        /// </summary>
        /// <param name="parameterName"></param>
        /// <param name="value"
        /// <param name="dbType"></param>
        /// <returns></returns>
        public SqlSection AddParameter(params DbParameter[] parameters)
        {
            dbSession.Db.AddParameter(this.cmd, parameters);
            return this;
        }


        /// <summary>
        /// 添加参数（自动推断DbType）
        /// </summary>
        public SqlSection AddInParameter(string parameterName, object value)
        {
            return AddInParameter(parameterName, DbType.String, 0, value);
        }

        /// <summary>
        /// 添加参数
        /// </summary>
        public SqlSection AddInParameter(string parameterName, DbType dbType, object value)
        {
            return AddInParameter(parameterName, dbType, 0, value);
        }

        /// <summary>
        /// 添加参数
        /// </summary>
        /// <param name="parameterName"></param>
        /// <param name="value"
        /// <param name="dbType"></param>
        /// <returns></returns>
        public SqlSection AddInParameter(string parameterName, DbType dbType, int size, object value)
        {
            Check.Require(parameterName, "parameterName", Check.NotNullOrEmpty);
            Check.Require(dbType, "dbType", Check.NotNullOrEmpty);

            dbSession.Db.AddInParameter(this.cmd, parameterName, dbType, size, value);
            return this;
        }

        #endregion

        #region 多结果集

        /// <summary>
        /// 返回两个结果集（多条SELECT语句）
        /// </summary>
        public (List<T1>, List<T2>) ToMultipleResult<T1, T2>()
        {
            using (IDataReader reader = ToDataReader())
            {
                var list1 = EntityUtils.ReaderToEnumerable<T1>(reader).ToList();
                var list2 = reader.NextResult()
                    ? EntityUtils.ReaderToEnumerable<T2>(reader).ToList()
                    : new List<T2>();
                return (list1, list2);
            }
        }

        /// <summary>
        /// 返回三个结果集
        /// </summary>
        public (List<T1>, List<T2>, List<T3>) ToMultipleResult<T1, T2, T3>()
        {
            using (IDataReader reader = ToDataReader())
            {
                var list1 = EntityUtils.ReaderToEnumerable<T1>(reader).ToList();
                var list2 = reader.NextResult()
                    ? EntityUtils.ReaderToEnumerable<T2>(reader).ToList()
                    : new List<T2>();
                var list3 = reader.NextResult()
                    ? EntityUtils.ReaderToEnumerable<T3>(reader).ToList()
                    : new List<T3>();
                return (list1, list2, list3);
            }
        }

        /// <summary>
        /// 异步返回两个结果集
        /// </summary>
        public async Task<(List<T1>, List<T2>)> ToMultipleResultAsync<T1, T2>()
        {
            using (var reader = await ToDataReaderInternalAsync().ConfigureAwait(false))
            {
                var list1 = await EntityUtils.ReaderToListAsync<T1>(reader).ConfigureAwait(false);
                var list2 = await reader.NextResultAsync().ConfigureAwait(false)
                    ? await EntityUtils.ReaderToListAsync<T2>(reader).ConfigureAwait(false)
                    : new List<T2>();
                return (list1, list2);
            }
        }

        /// <summary>
        /// 异步返回三个结果集
        /// </summary>
        public async Task<(List<T1>, List<T2>, List<T3>)> ToMultipleResultAsync<T1, T2, T3>()
        {
            using (var reader = await ToDataReaderInternalAsync().ConfigureAwait(false))
            {
                var list1 = await EntityUtils.ReaderToListAsync<T1>(reader).ConfigureAwait(false);
                var list2 = await reader.NextResultAsync().ConfigureAwait(false)
                    ? await EntityUtils.ReaderToListAsync<T2>(reader).ConfigureAwait(false)
                    : new List<T2>();
                var list3 = await reader.NextResultAsync().ConfigureAwait(false)
                    ? await EntityUtils.ReaderToListAsync<T3>(reader).ConfigureAwait(false)
                    : new List<T3>();
                return (list1, list2, list3);
            }
        }

        #endregion

        #region 分页查询

        /// <summary>
        /// 分页查询，返回(数据列表, 总数)
        /// </summary>
        public (List<T> List, int TotalCount) ToPageList<T>(int pageIndex, int pageSize)
        {
            if (pageIndex < 1) pageIndex = 1;
            if (pageSize < 1) pageSize = 20;

            var countSql = $"SELECT COUNT(*) FROM ({cmd.CommandText}) _t";
            var pageSql = $"SELECT * FROM ({cmd.CommandText}) _t LIMIT {pageSize} OFFSET {(pageIndex - 1) * pageSize}";

            // 合并为一次查询
            var combinedSql = $"{countSql}; {pageSql}";
            var originalSql = cmd.CommandText;
            cmd.CommandText = combinedSql;

            using (IDataReader reader = ToDataReader())
            {
                int totalCount = 0;
                if (reader.Read())
                {
                    totalCount = Convert.ToInt32(reader.GetValue(0));
                }
                var list = reader.NextResult()
                    ? EntityUtils.ReaderToEnumerable<T>(reader).ToList()
                    : new List<T>();
                return (list, totalCount);
            }
        }

        /// <summary>
        /// 异步分页查询
        /// </summary>
        public async Task<(List<T> List, int TotalCount)> ToPageListAsync<T>(int pageIndex, int pageSize)
        {
            if (pageIndex < 1) pageIndex = 1;
            if (pageSize < 1) pageSize = 20;

            var countSql = $"SELECT COUNT(*) FROM ({cmd.CommandText}) _t";
            var pageSql = $"SELECT * FROM ({cmd.CommandText}) _t LIMIT {pageSize} OFFSET {(pageIndex - 1) * pageSize}";

            var combinedSql = $"{countSql}; {pageSql}";
            cmd.CommandText = combinedSql;

            using (var reader = await ToDataReaderInternalAsync().ConfigureAwait(false))
            {
                int totalCount = 0;
                if (await reader.ReadAsync().ConfigureAwait(false))
                {
                    totalCount = Convert.ToInt32(reader.GetValue(0));
                }
                var list = await reader.NextResultAsync().ConfigureAwait(false)
                    ? await EntityUtils.ReaderToListAsync<T>(reader).ConfigureAwait(false)
                    : new List<T>();
                return (list, totalCount);
            }
        }

        #endregion
    }
}

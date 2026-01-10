using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using SqlSugar;

namespace Microi.net
{
    /// <summary>
    /// SqlSugar 原始 SQL 执行器适配器
    /// 用于执行 FromSql 创建的原始 SQL 语句
    /// </summary>
    public class SqlSugarRawSqlExecutorAdapter : ISqlExecutor
    {
        private readonly SqlSugarClient _client;
        private string _sql;
        private readonly List<SugarParameter> _parameters = new List<SugarParameter>();

        public SqlSugarRawSqlExecutorAdapter(SqlSugarClient client, string sql)
        {
            _client = client ?? throw new ArgumentNullException(nameof(client));
            _sql = sql ?? throw new ArgumentNullException(nameof(sql));
        }

        /// <summary>
        /// 执行 SQL，返回受影响的行数
        /// </summary>
        public int ExecuteNonQuery()
        {
            return _client.Ado.ExecuteCommand(_sql, _parameters);
        }

        /// <summary>
        /// 返回第一行数据
        /// </summary>
        public T ToFirst<T>()
        {
            // SqlQuerySingle 已经物化数据，IsAutoCloseConnection = true 会自动关闭连接
            return _client.Ado.SqlQuerySingle<T>(_sql, _parameters);
        }

        /// <summary>
        /// 返回所有数据
        /// </summary>
        public List<T> ToList<T>()
        {
            // SqlQuery 已经物化数据到 List，IsAutoCloseConnection = true 会自动关闭连接
            return _client.Ado.SqlQuery<T>(_sql, _parameters);
        }

        /// <summary>
        /// 返回标量值
        /// </summary>
        public T ToScalar<T>()
        {
            var result = _client.Ado.GetScalar(_sql, _parameters);
            if (result == null || result == DBNull.Value)
                return default(T);

            return (T)Convert.ChangeType(result, typeof(T));
        }

        /// <summary>
        /// 添加输入参数
        /// </summary>
        public ISqlExecutor AddInParameter(string name, object value)
        {
            _parameters.Add(new SugarParameter(name, value));
            return this;
        }

        public ISqlExecutor AddInParameter(string name, object value, System.Data.DbType dbType)
        {
            _parameters.Add(new SugarParameter(name, value) { DbType = dbType });
            return this;
        }

        public ISqlExecutor AddInParameter(string name, System.Data.DbType dbType, object value)
        {
            _parameters.Add(new SugarParameter(name, value) { DbType = dbType });
            return this;
        }

        /// <summary>
        /// 批量添加参数
        /// </summary>
        public ISqlExecutor AddParameters(List<DbParameter> parameters)
        {
            if (parameters != null)
            {
                foreach (var param in parameters)
                {
                    _parameters.Add(new SugarParameter(param.ParameterName, param.Value)
                    {
                        DbType = param.DbType
                    });
                }
            }
            return this;
        }

        public ISqlExecutor AddParameter(string name, object value)
        {
            _parameters.Add(new SugarParameter(name, value));
            return this;
        }

        public ISqlExecutor AddParameter(params DbParameter[] parameters)
        {
            if (parameters != null)
            {
                foreach (var param in parameters)
                {
                    _parameters.Add(new SugarParameter(param.ParameterName, param.Value)
                    {
                        DbType = param.DbType
                    });
                }
            }
            return this;
        }

        /// <summary>
        /// 返回 DataTable
        /// </summary>
        public DataTable ToDataTable()
        {
            // GetDataTable 已经物化数据，IsAutoCloseConnection = true 会自动关闭连接
            return _client.Ado.GetDataTable(_sql, _parameters);
        }
    }
}

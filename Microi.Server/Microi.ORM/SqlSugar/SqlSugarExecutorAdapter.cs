using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using SqlSugar;

namespace Microi.net
{
    /// <summary>
    /// SqlSugar 泛型查询执行器适配器
    /// 将 ISugarQueryable<T> 适配为 ISqlExecutor
    /// </summary>
    public class SqlSugarExecutorAdapter<T> : ISqlExecutor where T : class, new()
    {
        private readonly SqlSugarClient _client;
        private ISugarQueryable<T> _queryable;

        public SqlSugarExecutorAdapter(SqlSugarClient client, ISugarQueryable<T> queryable)
        {
            _client = client ?? throw new ArgumentNullException(nameof(client));
            _queryable = queryable ?? throw new ArgumentNullException(nameof(queryable));
        }

        /// <summary>
        /// 执行 SQL（查询类操作会抛出异常）
        /// </summary>
        public int ExecuteNonQuery()
        {
            throw new NotSupportedException("SqlSugar Queryable does not support ExecuteNonQuery. Use Insertable/Updateable/Deleteable instead.");
        }

        /// <summary>
        /// 返回第一行数据
        /// </summary>
        public TResult ToFirst<TResult>()
        {
            if (typeof(TResult) == typeof(T))
            {
                return (TResult)(object)_queryable.First();
            }
            // 动态查询
            return _queryable.Select<TResult>().First();
        }

        /// <summary>
        /// 返回所有数据
        /// </summary>
        public List<TResult> ToList<TResult>()
        {
            if (typeof(TResult) == typeof(T))
            {
                return (List<TResult>)(object)_queryable.ToList();
            }
            // 动态查询
            return _queryable.Select<TResult>().ToList();
        }

        /// <summary>
        /// 返回标量值
        /// </summary>
        public TResult ToScalar<TResult>()
        {
            // SqlSugar 的 Queryable 不直接支持 Scalar，转换为 First
            var first = _queryable.First();
            if (first == null)
                return default(TResult);

            // 尝试转换
            return (TResult)Convert.ChangeType(first, typeof(TResult));
        }

        /// <summary>
        /// 添加参数（SqlSugar 使用强类型，参数通过 Where 传递）
        /// </summary>
        public ISqlExecutor AddInParameter(string name, object value)
        {
            // SqlSugar 不需要显式添加参数，Where 会自动处理
            return this;
        }

        public ISqlExecutor AddInParameter(string name, object value, System.Data.DbType dbType)
        {
            return this;
        }

        public ISqlExecutor AddInParameter(string name, System.Data.DbType dbType, object value)
        {
            return this;
        }

        public ISqlExecutor AddParameters(List<DbParameter> parameters)
        {
            return this;
        }

        public ISqlExecutor AddParameter(string name, object value)
        {
            return this;
        }

        public ISqlExecutor AddParameter(params DbParameter[] parameters)
        {
            return this;
        }

        /// <summary>
        /// 返回 DataTable
        /// </summary>
        public DataTable ToDataTable()
        {
            return _queryable.ToDataTable();
        }
    }
}

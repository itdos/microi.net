using System;
using System.Data;
using System.Data.Common;
using SqlSugar;

namespace Microi.net
{
    /// <summary>
    /// SqlSugar 数据库会话适配器
    /// 将 SqlSugarClient 适配为 IMicroiDbSession
    /// </summary>
    public class SqlSugarSessionAdapter : IMicroiDbSession
    {
        private readonly SqlSugarClient _client;
        private bool _disposed = false;

        /// <summary>
        /// 构造函数
        /// </summary>
        public SqlSugarSessionAdapter(SqlSugarClient client, string osClient = null)
        {
            _client = client ?? throw new ArgumentNullException(nameof(client));
            OsClient = osClient;
        }

        /// <summary>
        /// OsClient 名称（用于混合 ORM 场景下获取 DosOrmDbRead）
        /// </summary>
        public string OsClient { get; set; }

        /// <summary>
        /// 获取原生 SqlSugarClient 对象
        /// </summary>
        public SqlSugarClient Client => _client;

        /// <summary>
        /// 获取 ADO.NET 连接对象
        /// </summary>
        public DbConnection Connection => _client.Ado.Connection as DbConnection;

        /// <summary>
        /// 数据库类型
        /// </summary>
        public DatabaseType DbType
        {
            get
            {
                return _client.CurrentConnectionConfig.DbType switch
                {
                    SqlSugar.DbType.MySql => DatabaseType.MySql,
                    SqlSugar.DbType.SqlServer => DatabaseType.SqlServer,
                    SqlSugar.DbType.Oracle => DatabaseType.Oracle,
                    _ => DatabaseType.MySql
                };
            }
        }

        /// <summary>
        /// 开启缓存
        /// </summary>
        public void TurnOnCache()
        {
            // SqlSugar 缓存需要单独配置
        }

        /// <summary>
        /// 关闭缓存
        /// </summary>
        public void TurnOffCache()
        {
            // SqlSugar 缓存需要单独配置
        }

        /// <summary>
        /// 关闭连接
        /// </summary>
        public void Close()
        {
            _client?.Dispose();
        }

        /// <summary>
        /// 开始事务（带隔离级别）
        /// </summary>
        public IMicroiDbTransaction BeginTransaction(System.Data.IsolationLevel isolationLevel)
        {
            _client.Ado.BeginTran(isolationLevel);
            return new SqlSugarTransactionAdapter(_client);
        }

        /// <summary>
        /// 创建查询执行器（泛型版本）
        /// </summary>
        public ISqlExecutor From<T>() where T : class, new()
        {
            var queryable = _client.Queryable<T>();
            return new SqlSugarExecutorAdapter<T>(_client, queryable);
        }

        /// <summary>
        /// 创建 SQL 执行器（FromSql）
        /// </summary>
        public ISqlExecutor FromSql(string sql)
        {
            return new SqlSugarRawSqlExecutorAdapter(_client, sql);
        }

        /// <summary>
        /// 开始事务
        /// </summary>
        public IMicroiDbTransaction BeginTransaction()
        {
            _client.Ado.BeginTran();
            return new SqlSugarTransactionAdapter(_client);
        }

        /// <summary>
        /// 插入实体
        /// </summary>
        public int Insert<T>(T entity) where T : class, new()
        {
            return _client.Insertable(entity).ExecuteCommand();
        }

        /// <summary>
        /// 更新实体
        /// </summary>
        public int Update<T>(T entity) where T : class, new()
        {
            return _client.Updateable(entity).ExecuteCommand();
        }

        /// <summary>
        /// 删除实体
        /// </summary>
        public int Delete<T>(T entity) where T : class, new()
        {
            return _client.Deleteable(entity).ExecuteCommand();
        }

        /// <summary>
        /// 根据条件删除
        /// </summary>
        public int Delete<T>(System.Linq.Expressions.Expression<Func<T, bool>> whereExpression) where T : class, new()
        {
            return _client.Deleteable<T>().Where(whereExpression).ExecuteCommand();
        }

        /// <summary>
        /// 根据条件更新
        /// </summary>
        public int Update<T>(System.Linq.Expressions.Expression<Func<T, T>> columns, System.Linq.Expressions.Expression<Func<T, bool>> whereExpression) where T : class, new()
        {
            return _client.Updateable<T>().SetColumns(columns).Where(whereExpression).ExecuteCommand();
        }

        /// <summary>
        /// 释放资源
        /// </summary>
        public void Dispose()
        {
            if (!_disposed)
            {
                _client?.Dispose();
                _disposed = true;
            }
        }
    }
}

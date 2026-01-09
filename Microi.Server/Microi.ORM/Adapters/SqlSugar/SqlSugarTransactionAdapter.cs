using System;
using SqlSugar;

namespace Microi.net
{
    /// <summary>
    /// SqlSugar 事务适配器
    /// 将 SqlSugarClient 的事务操作适配为 IMicroiDbTransaction
    /// </summary>
    public class SqlSugarTransactionAdapter : IMicroiDbTransaction
    {
        private readonly SqlSugarClient _client;
        private bool _disposed = false;
        private bool _completed = false;

        /// <summary>
        /// 构造函数
        /// </summary>
        public SqlSugarTransactionAdapter(SqlSugarClient client)
        {
            _client = client ?? throw new ArgumentNullException(nameof(client));
        }

        /// <summary>
        /// 获取原生事务对象（SqlSugar 通过 Client 管理事务）
        /// </summary>
        public object UnderlyingTransaction => _client;

        /// <summary>
        /// 是否已提交或回滚
        /// </summary>
        public bool IsCommitOrRollback 
        { 
            get => _completed;
            set => _completed = value;
        }

        /// <summary>
        /// 事务隔离级别
        /// </summary>
        public System.Data.IsolationLevel IsolationLevel => System.Data.IsolationLevel.ReadCommitted;

        /// <summary>
        /// 创建 SQL 执行器（事务内）
        /// </summary>
        public ISqlExecutor FromSql(string sql)
        {
            return new SqlSugarRawSqlExecutorAdapter(_client, sql);
        }

        /// <summary>
        /// 关闭事务
        /// </summary>
        public void Close()
        {
            Dispose();
        }

        /// <summary>
        /// 提交事务
        /// </summary>
        public void Commit()
        {
            if (_completed)
                throw new InvalidOperationException("Transaction has already been completed.");

            _client.Ado.CommitTran();
            _completed = true;
        }

        /// <summary>
        /// 回滚事务
        /// </summary>
        public void Rollback()
        {
            if (_completed)
                throw new InvalidOperationException("Transaction has already been completed.");

            _client.Ado.RollbackTran();
            _completed = true;
        }

        /// <summary>
        /// 释放资源
        /// </summary>
        public void Dispose()
        {
            if (!_disposed)
            {
                // 如果事务未完成，自动回滚
                if (!_completed)
                {
                    try
                    {
                        _client.Ado.RollbackTran();
                    }
                    catch
                    {
                        // 忽略回滚异常
                    }
                }
                _disposed = true;
            }
        }
    }
}

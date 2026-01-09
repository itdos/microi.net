using System;
using System.Data;
using Dos.ORM;


namespace Microi.net
{
    /// <summary>
    /// Dos.ORM 事务适配器
    /// 将 Dos.ORM.DbTrans 适配为 IMicroiDbTransaction
    /// </summary>
    public class DosORMTransactionAdapter : IMicroiDbTransaction
    {
        private readonly DbTrans _dosTrans;
        private bool _disposed = false;

        /// <summary>
        /// 构造函数
        /// </summary>
        /// <param name="dosTrans">Dos.ORM原生事务对象</param>
        public DosORMTransactionAdapter(DbTrans dosTrans)
        {
            _dosTrans = dosTrans ?? throw new ArgumentNullException(nameof(dosTrans));
        }

        /// <summary>
        /// 获取底层Dos.ORM事务（用于特殊场景）
        /// </summary>
        public DbTrans UnderlyingTransaction => _dosTrans;

        /// <summary>
        /// 获取底层事务对象（接口实现）
        /// </summary>
        object IMicroiDbTransaction.UnderlyingTransaction => _dosTrans;

        /// <summary>
        /// 事务隔离级别
        /// </summary>
        public IsolationLevel IsolationLevel => _dosTrans.IsolationLevel;

        /// <summary>
        /// 是否已提交或回滚
        /// </summary>
        public bool IsCommitOrRollback
        {
            get => _dosTrans.IsCommitOrRollback;
            set => _dosTrans.IsCommitOrRollback = value;
        }

        /// <summary>
        /// 在事务中执行SQL
        /// </summary>
        public ISqlExecutor FromSql(string sql)
        {
            var dosSection = _dosTrans.FromSql(sql);
            return new DosORMExecutorAdapter(dosSection);
        }

        /// <summary>
        /// 提交事务
        /// </summary>
        public void Commit()
        {
            _dosTrans.Commit();
        }

        /// <summary>
        /// 回滚事务
        /// </summary>
        public void Rollback()
        {
            _dosTrans.Rollback();
        }

        /// <summary>
        /// 关闭事务
        /// </summary>
        public void Close()
        {
            _dosTrans.Close();
        }

        /// <summary>
        /// 释放资源
        /// </summary>
        public void Dispose()
        {
            if (!_disposed)
            {
                _dosTrans?.Dispose();
                _disposed = true;
            }
        }
    }
}

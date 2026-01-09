using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using Dos.ORM;


namespace Microi.net
{
    /// <summary>
    /// Dos.ORM 会话适配器
    /// 将 Dos.ORM.DbSession 适配为 IMicroiDbSession
    /// </summary>
    public class DosORMSessionAdapter : IMicroiDbSession
    {
        private readonly DbSession _dosSession;
        private bool _disposed = false;

        /// <summary>
        /// 构造函数
        /// </summary>
        /// <param name="dosSession">Dos.ORM原生会话对象</param>
        public DosORMSessionAdapter(DbSession dosSession)
        {
            _dosSession = dosSession ?? throw new ArgumentNullException(nameof(dosSession));
        }

        /// <summary>
        /// 获取底层Dos.ORM会话（用于特殊场景）
        /// </summary>
        public DbSession UnderlyingSession => _dosSession;

        /// <summary>
        /// 获取底层数据库对象（用于访问DbProviderFactory等底层功能）
        /// </summary>
        public Database Db => _dosSession.Db;

        /// <summary>
        /// 数据库类型
        /// </summary>
        public DatabaseType DbType
        {
            get
            {
                // 将 Dos.ORM.DatabaseType 转换为 Microi.ORM.DatabaseType
                return (DatabaseType)(int)_dosSession.Db.DbProvider.DatabaseType;
            }
        }

        /// <summary>
        /// 执行原生SQL
        /// </summary>
        public ISqlExecutor FromSql(string sql)
        {
            var dosExecutor = _dosSession.FromSql(sql);
            return new DosORMExecutorAdapter(dosExecutor);
        }

        /// <summary>
        /// 开启事务
        /// </summary>
        public IMicroiDbTransaction BeginTransaction()
        {
            var dosTrans = _dosSession.BeginTransaction();
            return new DosORMTransactionAdapter(dosTrans);
        }

        /// <summary>
        /// 开启指定隔离级别的事务
        /// </summary>
        public IMicroiDbTransaction BeginTransaction(IsolationLevel isolationLevel)
        {
            var dosTrans = _dosSession.BeginTransaction(isolationLevel);
            return new DosORMTransactionAdapter(dosTrans);
        }

        /// <summary>
        /// 开启缓存
        /// </summary>
        public void TurnOnCache()
        {
            _dosSession.TurnOnCache();
        }

        /// <summary>
        /// 关闭缓存
        /// </summary>
        public void TurnOffCache()
        {
            _dosSession.TurnOffCache();
        }

        /// <summary>
        /// 关闭会话（Dos.ORM.DbSession不支持显式Close，此方法为空实现）
        /// </summary>
        public void Close()
        {
            // Dos.ORM.DbSession不支持显式Close
            // 资源释放通过Dispose完成
        }

        /// <summary>
        /// 释放资源
        /// </summary>
        public void Dispose()
        {
            if (!_disposed)
            {
                // Dos.ORM.DbSession不支持显式Dispose
                // GC会自动回收资源
                _disposed = true;
            }
        }
    }
}

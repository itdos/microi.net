using System;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;

namespace Microi.net
{
    /// <summary>
    /// 数据库会话抽象接口（支持Dos.ORM、SqlSugar等多种ORM）
    /// 负责数据库连接、查询、事务管理等核心功能
    /// </summary>
    public interface IMicroiDbSession : IDisposable
    {
        /// <summary>
        /// 执行原生SQL语句，返回SQL执行器
        /// </summary>
        /// <param name="sql">SQL语句</param>
        /// <returns>SQL执行器</returns>
        ISqlExecutor FromSql(string sql);

        /// <summary>
        /// 开启事务
        /// </summary>
        /// <returns>事务对象</returns>
        IMicroiDbTransaction BeginTransaction();

        /// <summary>
        /// 开启指定隔离级别的事务
        /// </summary>
        /// <param name="isolationLevel">事务隔离级别</param>
        /// <returns>事务对象</returns>
        IMicroiDbTransaction BeginTransaction(IsolationLevel isolationLevel);

        /// <summary>
        /// 关闭会话（不要和Dispose混淆，Close可以重复调用）
        /// </summary>
        void Close();

        /// <summary>
        /// 开启缓存
        /// </summary>
        void TurnOnCache();

        /// <summary>
        /// 关闭缓存
        /// </summary>
        void TurnOffCache();

        /// <summary>
        /// 获取底层数据库类型（MySql、Oracle、SqlServer）
        /// </summary>
        DatabaseType DbType { get; }
    }

    /// <summary>
    /// 数据库类型枚举（与Dos.ORM.DatabaseType保持一致）
    /// </summary>
    public enum DatabaseType
    {
        /// <summary>
        /// SQL Server 2000
        /// </summary>
        SqlServer = 0,
        /// <summary>
        /// MsAccess
        /// </summary>
        MsAccess = 1,
        /// <summary>
        /// SQL Server 2005+
        /// </summary>
        SqlServer9 = 2,
        /// <summary>
        /// Oracle
        /// </summary>
        Oracle = 3,
        /// <summary>
        /// Sqlite
        /// </summary>
        Sqlite3 = 4,
        /// <summary>
        /// MySql
        /// </summary>
        MySql = 5
    }
}

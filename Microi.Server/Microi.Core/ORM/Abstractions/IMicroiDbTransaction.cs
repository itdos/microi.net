using System;
using System.Data;

namespace Microi.net
{
    /// <summary>
    /// 数据库事务抽象接口
    /// 支持事务的提交、回滚、嵌套等操作
    /// </summary>
    public interface IMicroiDbTransaction : IDisposable
    {
        /// <summary>
        /// 在事务中执行SQL
        /// </summary>
        /// <param name="sql">SQL语句</param>
        /// <returns>SQL执行器</returns>
        ISqlExecutor FromSql(string sql);

        /// <summary>
        /// 提交事务
        /// 强烈建议在finally中再次执行Close()，防止catch中的代码异常导致连接泄漏
        /// </summary>
        void Commit();

        /// <summary>
        /// 回滚事务
        /// </summary>
        void Rollback();

        /// <summary>
        /// 关闭事务（无论是否提交/回滚，都应该调用Close释放资源）
        /// </summary>
        void Close();

        /// <summary>
        /// 判断事务是否已提交或回滚
        /// </summary>
        bool IsCommitOrRollback { get; set; }

        /// <summary>
        /// 获取事务隔离级别
        /// </summary>
        IsolationLevel IsolationLevel { get; }

        /// <summary>
        /// 获取底层事务对象（用于适配器解包）
        /// </summary>
        object UnderlyingTransaction { get; }
    }
}

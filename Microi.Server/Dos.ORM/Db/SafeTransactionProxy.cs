using System;
using System.Data;
using Dos.ORM;

namespace Dos.ORM
{
    /// <summary>
    /// 安全事务代理：防止V8脚本代码直接调用Commit/Rollback/Close或篡改事务状态
    /// 当事务由框架（FormEngine/ApiEngine）管理时，V8代码不应操控事务生命周期
    /// </summary>
    public class SafeTransactionProxy : DbTrans
    {
        private readonly DbTrans _inner;

        /// <summary>
        /// 事务来源描述（用于日志输出），例如：
        /// "接口引擎[GetUserInfo]" 或 "表单引擎[sys_user].SubmitBeforeServerV8(Insert)"
        /// </summary>
        public string Source { get; set; }

        public SafeTransactionProxy(DbTrans inner, string source = null)
            : base(inner is SafeTransactionProxy existing ? existing._inner : inner)
        {
            _inner = inner is SafeTransactionProxy ex ? ex._inner : (inner ?? throw new ArgumentNullException(nameof(inner)));
            Source = source;
        }

        /// <summary>
        /// 获取内部真实事务（供框架内部使用）
        /// </summary>
        public DbTrans InnerTransaction => _inner;

        public override SqlSection FromSql(string sql) => _inner.FromSql(sql);

        /// <summary>
        /// 拦截Commit：V8代码不允许直接提交框架管理的事务
        /// </summary>
        public override void Commit()
        {
            Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】[SafeTransactionProxy] V8脚本代码调用了Commit()，已拦截忽略。来源: {Source ?? "未知"}。事务生命周期由框架管理，V8代码不应直接调用Commit/Rollback。");
        }

        /// <summary>
        /// 拦截Rollback：V8代码不允许直接回滚框架管理的事务
        /// </summary>
        public override void Rollback()
        {
            Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】[SafeTransactionProxy] V8脚本代码调用了Rollback()，已拦截忽略。来源: {Source ?? "未知"}。事务生命周期由框架管理，V8代码不应直接调用Commit/Rollback。");
        }

        /// <summary>
        /// 拦截Close：V8代码不允许直接关闭框架管理的事务
        /// </summary>
        public override void Close()
        {
            Console.WriteLine($"Microi：【⚠️警告】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】[SafeTransactionProxy] V8脚本代码调用了Close()，已拦截忽略。来源: {Source ?? "未知"}");
        }

        public override void Dispose()
        {
            // 不释放 - 由框架管理
        }
    }
}

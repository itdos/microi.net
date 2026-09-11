using System;
using Dos.Common;
using Dos.ORM;

namespace Microi.net
{
    /// <summary>事务优先释放；日志和引擎归还故障不能留住业务连接，也不能误关调用者的共享事务。</summary>
    internal static class DatabaseExecutionCleanup
    {
        internal static void Release(DbTrans transaction, bool ownsTransaction, Action returnEngine = null)
        {
            if (ownsTransaction)
            {
                try { transaction?.Close(); }
                catch (Exception ex)
                {
                    RuntimeDiagnostics.Write("Database", "TransactionCleanupFailed", "事务资源释放失败", ex.GetType().Name);
                }
            }
            try { returnEngine?.Invoke(); }
            catch (Exception ex)
            {
                RuntimeDiagnostics.Write("V8", "EngineReturnFailed", "引擎归还失败", ex.GetType().Name);
            }
        }

        /// <summary>慢日志只作诊断，失败不能把已提交业务改报失败或覆盖原始业务异常。</summary>
        internal static void Observe(Action diagnostics)
        {
            try { diagnostics(); }
            catch (Exception ex)
            {
                RuntimeDiagnostics.Write("Database", "ExecutionDiagnosticsFailed", "执行诊断记录失败", ex.GetType().Name);
            }
        }
    }
}

using System;
using System.Threading;

namespace Dos.Common
{
    /// <summary>
    /// 底层公共库的运行诊断信息。Dos.Common / Dos.ORM 不依赖 Microi.Core，
    /// 因此由宿主在启动时注入日志接收器，再统一进入平台 MongoDB 日志队列。
    /// </summary>
    public sealed class RuntimeDiagnostic
    {
        public string OsClient { get; set; }
        public string Subsystem { get; set; }
        public string Action { get; set; }
        public string Title { get; set; }
        public string Content { get; set; }
        public int Level { get; set; } = 2;
        public bool? Success { get; set; } = false;
        public string TargetId { get; set; }
        public string OtherInfo { get; set; }
    }

    public static class RuntimeDiagnostics
    {
        private static Action<RuntimeDiagnostic> _sink;

        /// <summary>
        /// 进程内接收器只负责把底层诊断转交给共享日志队列，不承载业务状态。
        /// 每个 API / Worker 节点启动时都会独立配置。
        /// </summary>
        public static void Configure(Action<RuntimeDiagnostic> sink)
        {
            Volatile.Write(ref _sink, sink);
        }

        public static bool Write(
            string subsystem,
            string action,
            string title,
            string content,
            int level = 2,
            bool? success = false,
            string osClient = null,
            string targetId = null,
            string otherInfo = null)
        {
            try
            {
                var sink = Volatile.Read(ref _sink);
                if (sink == null) return false;
                sink(new RuntimeDiagnostic
                {
                    OsClient = osClient,
                    Subsystem = subsystem,
                    Action = action,
                    Title = title,
                    Content = content,
                    Level = level,
                    Success = success,
                    TargetId = targetId,
                    OtherInfo = otherInfo
                });
                return true;
            }
            catch
            {
                // 诊断旁路永不影响数据库事务、脚本执行等主业务流程。
                return false;
            }
        }
    }
}

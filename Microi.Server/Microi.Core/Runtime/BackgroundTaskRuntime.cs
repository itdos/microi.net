using System;

namespace Microi.net
{
    /// <summary>
    /// 后台任务运行时桥接。Microi.Core 不引用 Api 项目，由 Api 启动时注册实际处理器。
    /// </summary>
    public static class BackgroundTaskRuntime
    {
        public static Func<string, int?, string, int?, int?, bool> UpdateProgressHandler { get; set; }
        public static Func<string, string, bool> AppendLogHandler { get; set; }
        public static Func<string, bool> IsCancellationRequestedHandler { get; set; }

        public static bool TryUpdateProgress(string taskId, int? progress, string msg)
        {
            return TryUpdateProgress(taskId, progress, msg, null, null);
        }

        public static bool TryUpdateProgress(string taskId, int? progress, string msg, int? current, int? total)
        {
            var handler = UpdateProgressHandler;
            if (handler == null || string.IsNullOrWhiteSpace(taskId))
            {
                return false;
            }
            return handler(taskId, progress, msg, current, total);
        }

        public static bool IsCancellationRequested(string taskId)
        {
            var handler = IsCancellationRequestedHandler;
            return handler != null && !string.IsNullOrWhiteSpace(taskId) && handler(taskId);
        }

        public static bool TryAppendLog(string taskId, string message)
        {
            var handler = AppendLogHandler;
            return handler != null
                   && !string.IsNullOrWhiteSpace(taskId)
                   && !string.IsNullOrWhiteSpace(message)
                   && handler(taskId, message);
        }
    }
}

using System;
using System.Threading;

namespace Microi.net
{
    /// <summary>
    /// V8 console 的请求级捕获上下文。
    /// 使用 AsyncLocal 隔离并发请求，避免通过 Console.SetOut 修改进程级输出目标。
    /// </summary>
    public static class V8ConsoleContext
    {
        private static readonly AsyncLocal<Action<V8ConsoleEntry>> CurrentSink =
            new AsyncLocal<Action<V8ConsoleEntry>>();

        public static IDisposable Capture(Action<V8ConsoleEntry> sink)
        {
            if (sink == null) throw new ArgumentNullException(nameof(sink));
            var previous = CurrentSink.Value;
            CurrentSink.Value = sink;
            return new CaptureScope(previous);
        }

        public static bool TryWrite(string level, string message)
        {
            var sink = CurrentSink.Value;
            if (sink == null) return false;

            try
            {
                sink(new V8ConsoleEntry
                {
                    Level = string.IsNullOrWhiteSpace(level) ? "Log" : level,
                    Message = message ?? string.Empty
                });
                return true;
            }
            catch
            {
                // 调试输出属于旁路能力；捕获端异常时由调用方降级到平台日志。
                return false;
            }
        }

        private sealed class CaptureScope : IDisposable
        {
            private readonly Action<V8ConsoleEntry> _previous;
            private bool _disposed;

            public CaptureScope(Action<V8ConsoleEntry> previous)
            {
                _previous = previous;
            }

            public void Dispose()
            {
                if (_disposed) return;
                _disposed = true;
                CurrentSink.Value = _previous;
            }
        }
    }

    public sealed class V8ConsoleEntry
    {
        public string Level { get; set; }
        public string Message { get; set; }
    }
}

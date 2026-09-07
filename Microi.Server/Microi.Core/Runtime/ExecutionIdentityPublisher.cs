using System;
using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using System.Threading;

namespace Microi.net
{
    /// <summary>
    /// Bounded node-local diagnostic state. No business object, database I/O, or per-JS-
    /// statement callback. A refresh identifies the original OS thread, not the timer thread.
    /// </summary>
    internal static class ExecutionIdentityPublisher
    {
        private const int Limit = 10000;
        private static readonly ConcurrentDictionary<int, Binding> Threads = new ConcurrentDictionary<int, Binding>();
        private static readonly Thread RefreshThread = StartPublisher();
        [ThreadStatic] private static Binding _binding;
        private static long _revision, _overflow, _unavailable, _failures;
        private static int _count, _refreshing;
        internal static long OverflowCount => Interlocked.Read(ref _overflow);
        internal static long UnavailableCount => Interlocked.Read(ref _unavailable);
        internal static long FailureCount => Interlocked.Read(ref _failures);

        internal static void Set(ExecutionObservation.State state)
        {
            var binding = _binding;
            if (binding == null)
            {
                if (state == null) return;
                _binding = binding = new Binding(Thread.CurrentThread, NativeThreadId());
            }
            lock (binding)
            {
                binding.State = state;
                binding.Revision = Interlocked.Increment(ref _revision);
                if (state != null && binding.NativeId > 0 && !binding.Registered)
                {
                    if (Interlocked.Increment(ref _count) <= Limit)
                    {
                        Threads[binding.Owner.ManagedThreadId] = binding;
                        binding.Registered = true;
                    }
                    else { Interlocked.Decrement(ref _count); Interlocked.Increment(ref _overflow); }
                }
                Emit(binding, false);
                if (state == null) Remove(binding);
            }
        }

        private static Thread StartPublisher()
        {
            // A ThreadPool timer can stop progressing exactly when requests exhaust the pool.
            // One background thread per process also avoids capturing the initializing request.
            var thread = new Thread(() =>
            {
                while (true) { Thread.Sleep(200); Refresh(null); }
            }) { IsBackground = true, Name = "Microi execution identity" };
            if (ExecutionContext.IsFlowSuppressed()) thread.Start();
            else using (ExecutionContext.SuppressFlow()) thread.Start();
            return thread;
        }

        private static void Refresh(object unused)
        {
            if (Interlocked.Exchange(ref _refreshing, 1) != 0) return;
            try
            {
                foreach (var pair in Threads)
                {
                    var binding = pair.Value;
                    // Do not queue behind a business transition or build an unbounded snapshot.
                    if (!Monitor.TryEnter(binding)) continue;
                    try
                    {
                        if (!binding.Owner.IsAlive)
                        {
                            binding.State = null;
                            binding.Revision = Interlocked.Increment(ref _revision);
                            Emit(binding, true);
                            Remove(binding);
                        }
                        else if (binding.State != null) Emit(binding, true);
                    }
                    finally { Monitor.Exit(binding); }
                }
            }
            catch { Interlocked.Increment(ref _failures); }
            finally { Volatile.Write(ref _refreshing, 0); }
        }

        private static void Remove(Binding binding)
        {
            if (!binding.Registered) return;
            Threads.TryRemove(binding.Owner.ManagedThreadId, out _);
            binding.Registered = false;
            Interlocked.Decrement(ref _count);
        }

        private static void Emit(Binding binding, bool refresh)
        {
            var log = MicroiExecutionEventSource.Log;
            if (!log.IsEnabled()) return;
            var s = binding.State;
            if (binding.NativeId <= 0)
            {
                // Unsupported host: only the original thread can emit legacy markers.
                // It is deliberately NOT registered for background refresh.
                if (!refresh) log.Context(s?.Id ?? "", s?.ParentId ?? "", s?.TraceId ?? "", s?.Tenant ?? "",
                    s?.Kind ?? "", s?.Key ?? "", s?.Table ?? "", s?.Event ?? "", s?.ScriptHash ?? "", s?.Stage ?? "");
                return;
            }
            log.ThreadContext(binding.NativeId, binding.Revision, refresh, s?.Id ?? "", s?.ParentId ?? "",
                s?.TraceId ?? "", s?.Tenant ?? "", s?.Kind ?? "", s?.Key ?? "", s?.Table ?? "",
                s?.Event ?? "", s?.ScriptHash ?? "", s?.Stage ?? "");
        }

        private static int NativeThreadId()
        {
            try
            {
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return unchecked((int)GetCurrentThreadId());
                if (RuntimeInformation.IsOSPlatform(OSPlatform.Linux)) return gettid();
                if (RuntimeInformation.IsOSPlatform(OSPlatform.OSX) && pthread_threadid_np(IntPtr.Zero, out var id) == 0)
                    return checked((int)id);
            }
            catch { /* Unsupported native identity is visible, never replaced by a managed Id. */ }
            Interlocked.Increment(ref _unavailable);
            return 0;
        }
        [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
        [DllImport("libc")] private static extern int gettid();
        [DllImport("libSystem.B.dylib")] private static extern int pthread_threadid_np(IntPtr thread, out ulong threadId);

        private sealed class Binding
        {
            public readonly Thread Owner;
            public readonly int NativeId;
            public ExecutionObservation.State State;
            public long Revision;
            public bool Registered;
            public Binding(Thread owner, int nativeId) { Owner = owner; NativeId = nativeId; }
        }
    }
}

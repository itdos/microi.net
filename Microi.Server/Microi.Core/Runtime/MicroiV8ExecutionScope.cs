using System;
using System.Collections.Generic;
using System.Threading;

namespace Microi.net
{
    /// <summary>
    /// Async-flow-local V8 invocation tree. It provides re-entrant concurrency
    /// semantics and lets an engine temporarily exclude child-engine or explicitly
    /// trusted platform-host allocations from its individual Jint budget.
    /// </summary>
    internal static class MicroiV8ExecutionScope
    {
        private static readonly AsyncLocal<Frame> CurrentFrame = new AsyncLocal<Frame>();

        public static bool IsActive => CurrentFrame.Value != null;
        public static int Depth => CurrentFrame.Value?.Depth ?? 0;
        public static string RootExecutionId => CurrentFrame.Value?.RootExecutionId ?? "";
        public static CancellationToken CurrentCancellationToken =>
            CurrentFrame.Value?.CancellationToken ?? CancellationToken.None;

        public static bool ContainsEngineKey(string osClient, string engineKey)
        {
            if (string.IsNullOrWhiteSpace(engineKey)) return false;
            var frame = CurrentFrame.Value;
            while (frame != null)
            {
                if (string.Equals(frame.OsClient, osClient, StringComparison.OrdinalIgnoreCase)
                    && string.Equals(frame.EngineKey, engineKey, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
                frame = frame.Parent;
            }
            return false;
        }

        public static IReadOnlyList<string> GetCallPath(string nextEngineKey = null)
        {
            var keys = new List<string>();
            var frame = CurrentFrame.Value;
            while (frame != null)
            {
                if (!string.IsNullOrWhiteSpace(frame.EngineKey)) keys.Add(frame.EngineKey);
                frame = frame.Parent;
            }
            keys.Reverse();
            if (!string.IsNullOrWhiteSpace(nextEngineKey)) keys.Add(nextEngineKey);
            return keys;
        }

        public static IDisposable PauseCurrentExclusiveMemory()
        {
            return CurrentFrame.Value?.MemoryConstraint?.ExcludeNestedExecution()
                   ?? EmptyScope.Instance;
        }

        public static IDisposable PauseTrustedHostMemory()
        {
            var frame = CurrentFrame.Value;
            if (frame == null) return EmptyScope.Instance;
            return new CompositeScope(
                frame.MemoryConstraint?.ExcludeNestedExecution(),
                frame.CallTreeMemoryConstraint?.ExcludeNestedExecution());
        }

        public static IDisposable Enter(
            string osClient,
            string engineKey,
            MicroiV8MemoryConstraint memoryConstraint,
            CancellationToken cancellationToken)
        {
            return Enter(
                osClient,
                engineKey,
                memoryConstraint,
                null,
                cancellationToken);
        }

        public static IDisposable Enter(
            string osClient,
            string engineKey,
            MicroiV8MemoryConstraint memoryConstraint,
            MicroiV8CallTreeMemoryConstraint callTreeMemoryConstraint,
            CancellationToken cancellationToken)
        {
            var previous = CurrentFrame.Value;
            var rootExecutionId = previous?.RootExecutionId;
            if (string.IsNullOrWhiteSpace(rootExecutionId))
            {
                rootExecutionId = Guid.NewGuid().ToString("N");
            }

            CurrentFrame.Value = new Frame
            {
                Parent = previous,
                Depth = (previous?.Depth ?? 0) + 1,
                RootExecutionId = rootExecutionId,
                OsClient = osClient ?? "",
                EngineKey = engineKey ?? "",
                MemoryConstraint = memoryConstraint,
                CallTreeMemoryConstraint = previous?.CallTreeMemoryConstraint
                                           ?? callTreeMemoryConstraint,
                CancellationToken = cancellationToken.CanBeCanceled
                    ? cancellationToken
                    : (previous?.CancellationToken ?? CancellationToken.None)
            };
            return new Scope(previous);
        }

        private sealed class Frame
        {
            public Frame Parent { get; set; }
            public int Depth { get; set; }
            public string RootExecutionId { get; set; }
            public string OsClient { get; set; }
            public string EngineKey { get; set; }
            public MicroiV8MemoryConstraint MemoryConstraint { get; set; }
            public MicroiV8CallTreeMemoryConstraint CallTreeMemoryConstraint { get; set; }
            public CancellationToken CancellationToken { get; set; }
        }

        private sealed class CompositeScope : IDisposable
        {
            private IDisposable _first;
            private IDisposable _second;

            public CompositeScope(IDisposable first, IDisposable second)
            {
                _first = first;
                _second = second;
            }

            public void Dispose()
            {
                Interlocked.Exchange(ref _second, null)?.Dispose();
                Interlocked.Exchange(ref _first, null)?.Dispose();
            }
        }

        private sealed class Scope : IDisposable
        {
            private Frame _previous;

            public Scope(Frame previous)
            {
                _previous = previous;
            }

            public void Dispose()
            {
                var previous = Interlocked.Exchange(ref _previous, null);
                CurrentFrame.Value = previous;
            }
        }

        private sealed class EmptyScope : IDisposable
        {
            public static readonly EmptyScope Instance = new EmptyScope();
            public void Dispose() { }
        }
    }
}

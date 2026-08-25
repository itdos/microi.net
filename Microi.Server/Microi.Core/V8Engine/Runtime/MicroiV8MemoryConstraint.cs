using System;
using System.Reflection;
using System.Threading;
using Jint;
using Jint.Constraints;

namespace Microi.net
{
    /// <summary>
    /// Raised when one V8 engine exceeds its own cumulative allocation budget.
    /// The value is allocation traffic since the last reset, not live heap usage.
    /// </summary>
    public class MicroiV8MemoryLimitExceededException : Exception
    {
        public MicroiV8MemoryLimitExceededException(long allocatedBytes, long limitBytes)
            : base($"Script has allocated {allocatedBytes} but is limited to {limitBytes}")
        {
            AllocatedBytes = allocatedBytes;
            LimitBytes = limitBytes;
        }

        public long AllocatedBytes { get; }
        public long LimitBytes { get; }
    }

    public sealed class MicroiV8CallTreeMemoryLimitExceededException
        : MicroiV8MemoryLimitExceededException
    {
        public MicroiV8CallTreeMemoryLimitExceededException(
            long allocatedBytes,
            long limitBytes)
            : base(allocatedBytes, limitBytes)
        {
        }
    }

    /// <summary>
    /// Per-engine Jint allocation constraint with explicit exclusion scopes for
    /// nested V8 engines and designated trusted platform host operations. A separate
    /// root call-tree constraint still accounts for the complete logical invocation,
    /// so exclusion cannot remove the outer guard.
    /// </summary>
    public class MicroiV8MemoryConstraint : Constraint
    {
        private static readonly Func<long> GetAllocatedBytes = BuildAllocationReader();
        private readonly long _memoryLimit;
        private long _initialMemoryUsage;
        private long _excludedMemoryUsage;
        private long _pauseStartMemoryUsage;
        private int _initialThreadId;
        private int _pauseThreadId;
        private int _pauseDepth;

        public MicroiV8MemoryConstraint(long memoryLimit)
        {
            _memoryLimit = memoryLimit;
        }

        public long MemoryLimit => _memoryLimit;

        public long AllocatedBytes
        {
            get
            {
                if (_memoryLimit <= 0 || CurrentThreadId() != _initialThreadId) return 0;
                return Math.Max(0, GetAllocatedBytes() - _initialMemoryUsage - _excludedMemoryUsage);
            }
        }

        public override void Check()
        {
            if (_memoryLimit <= 0 || _pauseDepth > 0 || CurrentThreadId() != _initialThreadId)
            {
                return;
            }

            var allocatedBytes = AllocatedBytes;
            if (allocatedBytes > _memoryLimit)
            {
                throw CreateLimitExceededException(allocatedBytes, _memoryLimit);
            }
        }

        protected virtual Exception CreateLimitExceededException(
            long allocatedBytes,
            long limitBytes)
        {
            return new MicroiV8MemoryLimitExceededException(allocatedBytes, limitBytes);
        }

        public override void Reset()
        {
            _initialThreadId = CurrentThreadId();
            _initialMemoryUsage = GetAllocatedBytes();
            _excludedMemoryUsage = 0;
            _pauseStartMemoryUsage = 0;
            _pauseThreadId = 0;
            _pauseDepth = 0;
        }

        /// <summary>
        /// Excludes allocations made while a child V8/API engine or designated trusted
        /// platform host operation is executing from this engine's individual budget.
        /// The root call-tree constraint is not paused and therefore continues to
        /// provide an aggregate safety ceiling.
        /// </summary>
        public IDisposable ExcludeNestedExecution()
        {
            var currentThreadId = CurrentThreadId();
            if (_memoryLimit <= 0 || currentThreadId != _initialThreadId)
            {
                return EmptyScope.Instance;
            }

            if (_pauseDepth == 0)
            {
                _pauseThreadId = currentThreadId;
                _pauseStartMemoryUsage = GetAllocatedBytes();
            }
            _pauseDepth++;
            return new ExclusionScope(this);
        }

        private void EndExclusion()
        {
            if (_pauseDepth <= 0) return;
            _pauseDepth--;
            if (_pauseDepth != 0) return;

            if (CurrentThreadId() == _pauseThreadId)
            {
                var delta = GetAllocatedBytes() - _pauseStartMemoryUsage;
                if (delta > 0)
                {
                    _excludedMemoryUsage += delta;
                }
            }
            _pauseThreadId = 0;
            _pauseStartMemoryUsage = 0;
        }

        private static int CurrentThreadId()
        {
            return Thread.CurrentThread.ManagedThreadId;
        }

        private static Func<long> BuildAllocationReader()
        {
            var method = typeof(GC).GetMethod(
                "GetAllocatedBytesForCurrentThread",
                BindingFlags.Public | BindingFlags.Static,
                null,
                Type.EmptyTypes,
                null);
            if (method == null)
            {
                return () => GC.GetTotalMemory(false);
            }
            return (Func<long>)Delegate.CreateDelegate(typeof(Func<long>), method);
        }

        private sealed class ExclusionScope : IDisposable
        {
            private MicroiV8MemoryConstraint _owner;

            public ExclusionScope(MicroiV8MemoryConstraint owner)
            {
                _owner = owner;
            }

            public void Dispose()
            {
                var owner = Interlocked.Exchange(ref _owner, null);
                owner?.EndExclusion();
            }
        }

        private sealed class EmptyScope : IDisposable
        {
            public static readonly EmptyScope Instance = new EmptyScope();
            public void Dispose() { }
        }
    }

    /// <summary>
    /// Root invocation-tree allocation budget. It remains active across nested V8
    /// engines, but can be explicitly paused for fixed, authenticated platform host
    /// primitives whose native database/file allocations are guarded separately.
    /// </summary>
    public sealed class MicroiV8CallTreeMemoryConstraint : MicroiV8MemoryConstraint
    {
        public MicroiV8CallTreeMemoryConstraint(long memoryLimit)
            : base(memoryLimit)
        {
        }

        protected override Exception CreateLimitExceededException(
            long allocatedBytes,
            long limitBytes)
        {
            return new MicroiV8CallTreeMemoryLimitExceededException(
                allocatedBytes,
                limitBytes);
        }
    }
}

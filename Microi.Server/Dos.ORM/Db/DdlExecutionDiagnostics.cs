using System;
using System.Collections.Generic;

namespace Dos.ORM
{
    /// <summary>Read-only compatibility surface required by the published MCP runtime.</summary>
    public sealed class DdlExecutionDiagnostics : IDisposable
    {
        private readonly DdlExecutionObservation _observation;
        private DdlExecutionDiagnostics() => _observation = DdlExecutionObservation.Begin();
        public static DdlExecutionDiagnostics Begin() => new DdlExecutionDiagnostics();
        public IReadOnlyList<EventSnapshot> Events
        {
            get
            {
                var events = _observation.Events;
                var result = new EventSnapshot[events.Count];
                for (var index = 0; index < events.Count; index++)
                {
                    var item = events[index];
                    result[index] = new EventSnapshot(item.Id, item.Statement, item.State,
                        item.TransactionPending, item.ObservedAtUtc);
                }
                return Array.AsReadOnly(result);
            }
        }
        public int Dropped => _observation.Dropped;
        public void Dispose() => _observation.Dispose();

        public sealed class EventSnapshot
        {
            internal EventSnapshot(int id, string statement, string state, bool transactionPending, string observedAtUtc)
            {
                Id = id; Statement = statement; State = state;
                TransactionPending = transactionPending; ObservedAtUtc = observedAtUtc;
            }
            public int Id { get; }
            public string Statement { get; }
            public string State { get; }
            public bool TransactionPending { get; }
            public string ObservedAtUtc { get; }
        }
    }
}

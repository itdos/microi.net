using System;
using System.Collections.Generic;

namespace Dos.ORM
{
    /// <summary>
    /// Read-only, bounded DDL diagnostics for trusted CLR callers in the current async flow.
    /// This scope cannot execute SQL, change commands or confirm transaction commits.
    /// Microi's V8 sandbox denies this type and its nested snapshot type.
    /// </summary>
    public sealed class DdlExecutionDiagnostics : IDisposable
    {
        private readonly DdlExecutionObservation _observation;

        private DdlExecutionDiagnostics() { _observation = DdlExecutionObservation.Begin(); }

        public static DdlExecutionDiagnostics Begin() => new DdlExecutionDiagnostics();

        /// <summary>A detached, immutable snapshot containing only the observer's sanitized projection.</summary>
        public IReadOnlyList<EventSnapshot> Events
        {
            get
            {
                var events = _observation.Events;
                var snapshots = new EventSnapshot[events.Count];
                for (var index = 0; index < events.Count; index++)
                {
                    var item = events[index];
                    snapshots[index] = new EventSnapshot(item.Id, item.Statement, item.State,
                        item.TransactionPending, item.ObservedAtUtc);
                }
                return Array.AsReadOnly(snapshots);
            }
        }

        public int Dropped => _observation.Dropped;

        public void Dispose() => _observation.Dispose();

        public sealed class EventSnapshot
        {
            internal EventSnapshot(int id, string statement, string state, bool transactionPending, string observedAtUtc)
            {
                Id = id;
                Statement = statement;
                State = state;
                TransactionPending = transactionPending;
                ObservedAtUtc = observedAtUtc;
            }

            public int Id { get; }
            public string Statement { get; }
            public string State { get; }
            public bool TransactionPending { get; }
            public string ObservedAtUtc { get; }
        }
    }
}

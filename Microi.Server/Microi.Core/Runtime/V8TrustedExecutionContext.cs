using System;
using System.Threading;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Server-only identity scope for durable V8 background execution.
    ///
    /// The value is populated exclusively by the server-only background runner from
    /// the authenticated snapshot persisted alongside the task. It is intentionally
    /// not exposed on V8EngineParam, so V8.Param/V8.CurrentUser business input cannot be
    /// used to impersonate a privileged caller.
    /// </summary>
    internal static class V8TrustedExecutionContext
    {
        private static readonly AsyncLocal<JObject> Current = new AsyncLocal<JObject>();
        private static readonly AsyncLocal<JObject> CurrentTask = new AsyncLocal<JObject>();

        internal static JObject CurrentUser => Current.Value;
        internal static JObject CurrentBackgroundTask => CurrentTask.Value;

        internal static IDisposable Enter(JObject trustedCurrentUser)
        {
            var previous = Current.Value;
            Current.Value = trustedCurrentUser == null
                ? null
                : (JObject)trustedCurrentUser.DeepClone();
            return new Scope(previous, CurrentTask.Value);
        }

        internal static IDisposable EnterBackground(JObject trustedCurrentUser, JObject trustedTask)
        {
            var previousUser = Current.Value;
            var previousTask = CurrentTask.Value;
            Current.Value = trustedCurrentUser == null ? null : (JObject)trustedCurrentUser.DeepClone();
            CurrentTask.Value = trustedTask == null ? null : (JObject)trustedTask.DeepClone();
            return new Scope(previousUser, previousTask);
        }

        private sealed class Scope : IDisposable
        {
            private readonly JObject _previous;
            private readonly JObject _previousTask;
            private bool _disposed;

            internal Scope(JObject previous, JObject previousTask)
            {
                _previous = previous;
                _previousTask = previousTask;
            }

            public void Dispose()
            {
                if (_disposed) return;
                Current.Value = _previous;
                CurrentTask.Value = _previousTask;
                _disposed = true;
            }
        }
    }
}

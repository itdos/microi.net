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
        private static readonly AsyncLocal<string> CurrentTenant = new AsyncLocal<string>();
        private static readonly AsyncLocal<ManagedProtocolState> CurrentManagedProtocol =
            new AsyncLocal<ManagedProtocolState>();

        internal static JObject CurrentUser => Current.Value;
        internal static JObject CurrentBackgroundTask => CurrentTask.Value;
        internal static string CurrentOsClient => CurrentTenant.Value;

        /// <summary>
        /// 建立只允许目标 Managed 接口引擎消费一次的宿主协议作用域。授权不进入
        /// V8.Param；即使租户脚本知道目标 Key，也不能伪造、跨租户使用或重放。
        /// </summary>
        internal static IDisposable EnterManagedProtocol(string managedApiEngineKey, string trustedOsClient)
        {
            if (string.IsNullOrWhiteSpace(managedApiEngineKey))
                throw new ArgumentException("Managed ApiEngineKey 不能为空。", nameof(managedApiEngineKey));
            if (string.IsNullOrWhiteSpace(trustedOsClient))
                throw new ArgumentException("可信 OsClient 不能为空。", nameof(trustedOsClient));

            var previous = CurrentManagedProtocol.Value;
            CurrentManagedProtocol.Value = new ManagedProtocolState
            {
                ApiEngineKey = managedApiEngineKey.Trim(),
                OsClient = trustedOsClient.Trim()
            };
            return new ManagedProtocolScope(previous);
        }

        internal static bool TryConsumeManagedProtocol(string apiEngineKey, string osClient)
        {
            var state = CurrentManagedProtocol.Value;
            if (!MatchesManagedProtocol(state, apiEngineKey, osClient)) return false;

            return Interlocked.CompareExchange(ref state.Consumed, 1, 0) == 0;
        }

        internal static bool IsManagedProtocolAuthorized(string apiEngineKey, string osClient)
        {
            var state = CurrentManagedProtocol.Value;
            return MatchesManagedProtocol(state, apiEngineKey, osClient)
                   && Volatile.Read(ref state.Consumed) == 0;
        }

        private static bool MatchesManagedProtocol(
            ManagedProtocolState state,
            string apiEngineKey,
            string osClient)
        {
            return state != null
                   && !string.IsNullOrWhiteSpace(apiEngineKey)
                   && !string.IsNullOrWhiteSpace(osClient)
                   && string.Equals(
                       state.ApiEngineKey,
                       apiEngineKey.Trim(),
                       StringComparison.OrdinalIgnoreCase)
                   && string.Equals(
                       state.OsClient,
                       osClient.Trim(),
                       StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// 兼容既有后台任务与反射调用的一参数入口。嵌套调用继承已经建立的可信
        /// 租户，而不是把租户上下文清空；新建带租户的宿主作用域应调用
        /// <see cref="EnterForTenant"/>。
        /// </summary>
        internal static IDisposable Enter(JObject trustedCurrentUser)
        {
            return EnterForTenant(trustedCurrentUser, CurrentTenant.Value);
        }

        internal static IDisposable EnterForTenant(JObject trustedCurrentUser, string trustedOsClient)
        {
            var previous = Current.Value;
            var previousTenant = CurrentTenant.Value;
            Current.Value = trustedCurrentUser == null
                ? null
                : (JObject)trustedCurrentUser.DeepClone();
            CurrentTenant.Value = trustedOsClient?.Trim();
            return new Scope(previous, CurrentTask.Value, previousTenant);
        }

        internal static IDisposable EnterBackground(
            JObject trustedCurrentUser,
            JObject trustedTask,
            string trustedOsClient = null)
        {
            var previousUser = Current.Value;
            var previousTask = CurrentTask.Value;
            var previousTenant = CurrentTenant.Value;
            Current.Value = trustedCurrentUser == null ? null : (JObject)trustedCurrentUser.DeepClone();
            CurrentTask.Value = trustedTask == null ? null : (JObject)trustedTask.DeepClone();
            CurrentTenant.Value = trustedOsClient?.Trim() ?? previousTenant;
            return new Scope(previousUser, previousTask, previousTenant);
        }

        private sealed class Scope : IDisposable
        {
            private readonly JObject _previous;
            private readonly JObject _previousTask;
            private readonly string _previousTenant;
            private bool _disposed;

            internal Scope(JObject previous, JObject previousTask, string previousTenant)
            {
                _previous = previous;
                _previousTask = previousTask;
                _previousTenant = previousTenant;
            }

            public void Dispose()
            {
                if (_disposed) return;
                Current.Value = _previous;
                CurrentTask.Value = _previousTask;
                CurrentTenant.Value = _previousTenant;
                _disposed = true;
            }
        }

        private sealed class ManagedProtocolState
        {
            internal string ApiEngineKey { get; set; }
            internal string OsClient { get; set; }
            internal int Consumed;
        }

        private sealed class ManagedProtocolScope : IDisposable
        {
            private readonly ManagedProtocolState _previous;
            private bool _disposed;

            internal ManagedProtocolScope(ManagedProtocolState previous)
            {
                _previous = previous;
            }

            public void Dispose()
            {
                if (_disposed) return;
                CurrentManagedProtocol.Value = _previous;
                _disposed = true;
            }
        }
    }
}

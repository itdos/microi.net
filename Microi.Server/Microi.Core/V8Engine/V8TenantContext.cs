using System;
using System.Threading;
using Dos.ORM;

namespace Microi.net
{
    /// <summary>
    /// V8 租户隔离上下文
    ///
    /// 在 V8 引擎执行期间跟踪当前租户 OsClient，防止跨租户数据访问。
    /// 主库 OsClient 可访问所有租户数据，非主库租户只能访问自己的数据。
    ///
    /// 使用方式（在 V8Engine.Run 中）：
    /// using (V8TenantContext.Enter(param.OsClient, param.ApiEngineKey, param.EventName))
    /// {
    ///     // V8 代码执行
    /// }
    ///
    /// 支持嵌套调用（如主库 V8 代码调用其他租户的接口引擎），
    /// 每层 Enter 会保存上一层上下文，Dispose 时自动恢复。
    /// </summary>
    public static class V8TenantContext
    {
        private static readonly AsyncLocal<V8TenantInfo> _current = new AsyncLocal<V8TenantInfo>();

        /// <summary>
        /// 当前 V8 租户上下文（如果不在 V8 执行中则为 null）
        /// </summary>
        public static V8TenantInfo Current => _current.Value;

        public static DbTrans CurrentDbTrans => _current.Value?.DbTrans;

        /// <summary>
        /// 是否处于 V8 执行上下文中
        /// </summary>
        public static bool IsActive => _current.Value != null;

        /// <summary>
        /// 进入 V8 租户上下文（配合 using 使用，退出时自动恢复上一层上下文）
        ///
        /// 嵌套调用安全：每次 Enter 保存当前上下文，Dispose 时恢复。
        /// 例：主库 V8 → 调用租户 B 的接口引擎 → 租户 B 的 V8 代码被限制在 B 的数据范围内
        /// </summary>
        /// <param name="osClient">当前 V8 执行的租户 OsClient</param>
        /// <param name="apiEngineKey">当前正在执行的接口引擎 Key（用于安全告警定位）</param>
        /// <param name="eventName">当前事件名称（接口引擎名/表单事件名，用于安全告警定位）</param>
        /// <returns>IDisposable，退出作用域时自动恢复上一层上下文</returns>
        public static IDisposable Enter(
            string osClient,
            string apiEngineKey = null,
            string eventName = null,
            DbTrans dbTrans = null,
            string aiApplicationUserId = null)
        {
            var previous = _current.Value;
            var masterOsClient = OsClientDefault.OsClient;
            var isMaster = !string.IsNullOrWhiteSpace(masterOsClient)
                           && string.Equals(osClient, masterOsClient, StringComparison.OrdinalIgnoreCase);

            _current.Value = new V8TenantInfo
            {
                OsClient = osClient,
                IsMaster = isMaster,
                ApiEngineKey = apiEngineKey,
                EventName = eventName,
                DbTrans = dbTrans ?? previous?.DbTrans,
                AiApplicationUserId = aiApplicationUserId
            };

            return new V8TenantScope(previous);
        }

        /// <summary>
        /// 强制执行租户隔离：非主库租户的 V8 代码不允许访问其他租户数据。
        ///
        /// 规则：
        /// - 不在 V8 上下文中 → 不限制（C# 内部调用、Controller 调用等）
        /// - 主库 V8 上下文中 → 不限制（主库可跨租户操作）
        /// - 非主库 V8 上下文中 → 强制替换为当前租户的 OsClient
        /// </summary>
        /// <param name="requestedOsClient">请求访问的 OsClient</param>
        /// <returns>实际应使用的 OsClient</returns>
        public static string EnforceOsClient(string requestedOsClient)
        {
            var info = _current.Value;
            if (info == null || info.IsMaster)
            {
                // 不在 V8 上下文中，或者是主库 → 不限制
                return requestedOsClient;
            }

            // 非主库租户：如果尝试访问其他租户，强制替换
            if (!string.IsNullOrWhiteSpace(requestedOsClient)
                && !string.Equals(requestedOsClient, info.OsClient, StringComparison.OrdinalIgnoreCase))
            {
                Console.WriteLine(
                    $"Microi：【⚠️安全】V8租户隔离：租户[{info.OsClient}]的V8代码尝试访问租户[{requestedOsClient}]的数据，已拦截并强制使用[{info.OsClient}]。" +
                    $"来源 ApiEngineKey=[{info.ApiEngineKey ?? "-"}]，EventName=[{info.EventName ?? "-"}]。");
                return info.OsClient;
            }

            return requestedOsClient;
        }

        /// <summary>
        /// V8 租户上下文信息
        /// </summary>
        public class V8TenantInfo
        {
            /// <summary>
            /// 当前 V8 执行的租户 OsClient
            /// </summary>
            public string OsClient { get; set; }

            /// <summary>
            /// 是否为主库租户（主库允许跨租户访问）
            /// </summary>
            public bool IsMaster { get; set; }

            /// <summary>
            /// 当前正在执行的接口引擎 Key（来自 V8EngineParam.ApiEngineKey）
            /// </summary>
            public string ApiEngineKey { get; set; }

            /// <summary>
            /// 当前事件名称（来自 V8EngineParam.EventName，如表单事件名/接口引擎名）
            /// </summary>
            public string EventName { get; set; }

            public DbTrans DbTrans { get; set; }

            /// <summary>
            /// Server-derived owner identity for app_* interface engines. It is
            /// propagated through AsyncLocal so nested V8.FormEngine calls can
            /// enforce row ownership without trusting browser-supplied fields.
            /// </summary>
            public string AiApplicationUserId { get; set; }
        }

        /// <summary>
        /// V8 租户上下文作用域，实现 IDisposable，退出时恢复上一层上下文
        /// </summary>
        private class V8TenantScope : IDisposable
        {
            private readonly V8TenantInfo _previous;
            private bool _disposed;

            public V8TenantScope(V8TenantInfo previous)
            {
                _previous = previous;
            }

            public void Dispose()
            {
                if (!_disposed)
                {
                    _current.Value = _previous;
                    _disposed = true;
                }
            }
        }
    }
}

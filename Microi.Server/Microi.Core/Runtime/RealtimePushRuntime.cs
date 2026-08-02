using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// 实时消息推送桥。插件只描述连接、事件和负载，具体 SignalR 发送由宿主 API 注入。
    /// </summary>
    public static class RealtimePushRuntime
    {
        private const string DefaultGroupTransport = "default";
        private static Func<IReadOnlyCollection<string>, string, object, Task> _sendHandler;
        private static readonly ConcurrentDictionary<string, Func<string, string, object, Task>>
            GroupSendHandlers = new ConcurrentDictionary<string, Func<string, string, object, Task>>(
                StringComparer.Ordinal);

        public static bool IsConfigured => _sendHandler != null;
        public static bool IsGroupConfigured => IsGroupConfiguredFor(DefaultGroupTransport);

        public static void Configure(Func<IReadOnlyCollection<string>, string, object, Task> sendHandler)
        {
            _sendHandler = sendHandler ?? throw new ArgumentNullException(nameof(sendHandler));
        }

        /// <summary>
        /// 注入 SignalR 群组发送能力。群组成员由对应 Hub 在鉴权后维护；业务层只能发送
        /// 面向该群组的安全公开投影。用户私有手牌等个性化数据仍应通过按身份裁剪的 Snapshot 获取。
        /// </summary>
        public static void ConfigureGroups(Func<string, string, object, Task> sendHandler)
        {
            ConfigureGroups(DefaultGroupTransport, sendHandler);
        }

        /// <summary>
        /// 为不同 Hub 类型注册相互隔离的群组发送器。SignalR 的群组隶属于具体 Hub，
        /// 因此不能把一个 Hub 的连接误当成另一个 Hub 的连接来广播。
        /// </summary>
        public static void ConfigureGroups(
            string transportName,
            Func<string, string, object, Task> sendHandler)
        {
            var key = NormalizeTransportName(transportName);
            GroupSendHandlers[key] = sendHandler
                ?? throw new ArgumentNullException(nameof(sendHandler));
        }

        public static bool IsGroupConfiguredFor(string transportName)
        {
            return GroupSendHandlers.ContainsKey(NormalizeTransportName(transportName));
        }

        public static Task SendAsync(IEnumerable<string> connectionIds, string eventName, object payload)
        {
            var handler = _sendHandler;
            if (handler == null || string.IsNullOrWhiteSpace(eventName))
            {
                return Task.CompletedTask;
            }

            var targets = connectionIds?
                .Where(connectionId => !string.IsNullOrWhiteSpace(connectionId))
                .Distinct(StringComparer.Ordinal)
                .ToArray() ?? Array.Empty<string>();
            if (targets.Length == 0)
            {
                return Task.CompletedTask;
            }
            return handler(targets, eventName, payload);
        }

        public static Task SendGroupAsync(string groupName, string eventName, object payload)
        {
            return SendGroupAsync(DefaultGroupTransport, groupName, eventName, payload);
        }

        public static Task SendGroupAsync(
            string transportName,
            string groupName,
            string eventName,
            object payload)
        {
            GroupSendHandlers.TryGetValue(
                NormalizeTransportName(transportName),
                out var handler);
            if (handler == null
                || string.IsNullOrWhiteSpace(groupName)
                || string.IsNullOrWhiteSpace(eventName))
            {
                return Task.CompletedTask;
            }

            return handler(groupName, eventName, payload);
        }

        private static string NormalizeTransportName(string transportName)
        {
            if (string.IsNullOrWhiteSpace(transportName))
                throw new ArgumentException("实时传输名称不能为空。", nameof(transportName));
            return transportName.Trim();
        }
    }
}

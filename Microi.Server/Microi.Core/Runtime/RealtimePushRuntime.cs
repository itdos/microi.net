using System;
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
        private static Func<IReadOnlyCollection<string>, string, object, Task> _sendHandler;
        private static Func<string, string, object, Task> _groupSendHandler;

        public static bool IsConfigured => _sendHandler != null;
        public static bool IsGroupConfigured => _groupSendHandler != null;

        public static void Configure(Func<IReadOnlyCollection<string>, string, object, Task> sendHandler)
        {
            _sendHandler = sendHandler ?? throw new ArgumentNullException(nameof(sendHandler));
        }

        /// <summary>
        /// 注入 SignalR 群组发送能力。群组成员由 Hub 在鉴权后维护，业务层只能发送
        /// 已收敛的非敏感失效通知，不能通过此桥发送手牌或其它私密快照。
        /// </summary>
        public static void ConfigureGroups(Func<string, string, object, Task> sendHandler)
        {
            _groupSendHandler = sendHandler ?? throw new ArgumentNullException(nameof(sendHandler));
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
            var handler = _groupSendHandler;
            if (handler == null
                || string.IsNullOrWhiteSpace(groupName)
                || string.IsNullOrWhiteSpace(eventName))
            {
                return Task.CompletedTask;
            }

            return handler(groupName, eventName, payload);
        }
    }
}

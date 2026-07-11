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

        public static bool IsConfigured => _sendHandler != null;

        public static void Configure(Func<IReadOnlyCollection<string>, string, object, Task> sendHandler)
        {
            _sendHandler = sendHandler ?? throw new ArgumentNullException(nameof(sendHandler));
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
    }
}

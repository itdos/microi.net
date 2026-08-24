using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// V8.Notification 的宿主实现。数据库日志由消息接口引擎在当前事务中写入，
    /// SignalR 只负责提交后的即时提示；离线或推送故障时客户端仍可回读通知列表。
    /// </summary>
    public sealed class V8Notification : IV8Notification
    {
        public const string ClientEventName = "ReceivePlatformNotification";
        public const string ChannelType = "平台内部";
        public const int MaximumReceivers = 200;
        public const int MaximumTitleLength = 200;
        public const int MaximumLinkLength = 500;
        public const int MaximumContentBytes = 32 * 1024;
        public const int MaximumPayloadBytes = 32 * 1024;
        private const int RealtimeTimeoutMilliseconds = 1800;

        private static readonly Regex SafeIdPattern = new Regex(
            "^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);

        private readonly string _osClient;
        private readonly object _pendingSyncRoot = new object();
        private readonly List<PlatformNotificationRequest> _pendingRequests =
            new List<PlatformNotificationRequest>();
        private bool _afterCommitCallbackRegistered;
        private bool _pendingDispatched;

        public V8Notification(string osClient)
        {
            _osClient = (osClient ?? string.Empty).Trim();
        }

        public DosResult Send(dynamic dynamicParam)
        {
            try
            {
                JObject input = ToJObject((object)dynamicParam);
                var osClient = ResolveOsClient();
                PlatformNotificationRequest request;
                var validation = Normalize(input, osClient, out request);
                if (validation != null) return validation;

                var transaction = V8TenantContext.CurrentDbTrans;
                if (transaction != null && !transaction.IsCommitOrRollback)
                {
                    // 数据库已提交后再执行有界推送，既不占用事务锁，也不让异步任务
                    // 逃逸请求作用域后才访问缓存/SignalR；客户端始终可从持久日志回读。
                    var registerCallback = false;
                    lock (_pendingSyncRoot)
                    {
                        _pendingRequests.Add(request);
                        if (!_afterCommitCallbackRegistered)
                        {
                            _afterCommitCallbackRegistered = true;
                            registerCallback = true;
                        }
                    }
                    if (registerCallback)
                    {
                        transaction.RegisterAfterCommit(DispatchPending);
                    }
                    return new DosResult(1, new
                    {
                        request.NotificationId,
                        request.EventId,
                        ReceiverCount = request.ReceiverUserIds.Count,
                        ScheduledAfterCommit = true,
                        RealtimeBudgetMilliseconds = RealtimeTimeoutMilliseconds,
                        RealtimeConfigured = RealtimePushRuntime.IsConfigured
                    }, "平台内部通知已登记，将在事务提交后推送");
                }

                var dispatch = DispatchWithTimeoutAsync(request).GetAwaiter().GetResult();
                return new DosResult(1, dispatch,
                    dispatch.RealtimeDelivered
                        ? "平台内部通知已实时推送"
                        : "当前无在线连接或实时通道不可用，请由通知中心回读");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "平台内部通知推送失败：" + ex.Message);
            }
        }

        /// <summary>
        /// ApiEngine 在其自有事务 Commit 返回后调用。正常 after-commit 回调已消费时
        /// 这里是幂等空操作；宿主/驱动未执行回调时由这里补发，且永远不会在提交前推送。
        /// </summary>
        internal void DispatchAfterCommitFallback()
        {
            DispatchPending();
        }

        private void DispatchPending()
        {
            PlatformNotificationRequest[] requests;
            lock (_pendingSyncRoot)
            {
                if (_pendingDispatched) return;
                _pendingDispatched = true;
                requests = _pendingRequests.ToArray();
                _pendingRequests.Clear();
            }
            foreach (var request in requests)
            {
                DispatchSafelyAsync(request).GetAwaiter().GetResult();
            }
        }

        internal static DosResult Normalize(
            JObject input,
            string osClient,
            out PlatformNotificationRequest request)
        {
            request = null;
            if (input == null)
                return new DosResult(0, null, "通知参数不能为空");
            if (string.IsNullOrWhiteSpace(osClient))
                return new DosResult(0, null, "当前租户不能为空");

            var receiverUserIds = ReadReceiverIds(input, out var invalidReceiverId);
            if (!string.IsNullOrWhiteSpace(invalidReceiverId))
                return new DosResult(0, null, "接收用户 Id 格式无效");
            if (receiverUserIds.Count == 0)
                return new DosResult(0, null, "ReceiverUserId 或 ReceiverUserIds 不能为空");
            if (receiverUserIds.Count > MaximumReceivers)
                return new DosResult(0, null, $"单次平台内部通知最多发送给 {MaximumReceivers} 个用户");

            var notificationId = ReadString(input, "NotificationId", "Id");
            if (string.IsNullOrWhiteSpace(notificationId))
                notificationId = Guid.NewGuid().ToString("N");
            var eventId = ReadString(input, "EventId", "IdempotencyKey");
            if (string.IsNullOrWhiteSpace(eventId)) eventId = notificationId;
            if (!SafeIdPattern.IsMatch(notificationId) || !SafeIdPattern.IsMatch(eventId))
                return new DosResult(0, null, "NotificationId/EventId 格式无效");

            var title = ReadString(input, "Title");
            var content = ReadString(input, "Content", "MsgContent", "Message");
            if (string.IsNullOrWhiteSpace(title))
                return new DosResult(0, null, "Title 不能为空");
            if (title.Length > MaximumTitleLength)
                return new DosResult(0, null, $"Title 不能超过 {MaximumTitleLength} 个字符");
            if (string.IsNullOrWhiteSpace(content))
                return new DosResult(0, null, "Content 不能为空");
            if (Encoding.UTF8.GetByteCount(content) > MaximumContentBytes)
                return new DosResult(0, null, $"Content 不能超过 {MaximumContentBytes} 字节");

            var payload = input["Payload"]?.DeepClone() ?? input["Data"]?.DeepClone();
            if (payload != null
                && payload.Type != JTokenType.Null
                && Encoding.UTF8.GetByteCount(payload.ToString(Formatting.None)) > MaximumPayloadBytes)
            {
                return new DosResult(0, null, $"Payload 不能超过 {MaximumPayloadBytes} 字节");
            }

            var linkUrl = NormalizeLinkUrl(ReadString(input, "LinkUrl", "Url"));
            if (linkUrl == null)
                return new DosResult(0, null, $"LinkUrl 仅支持站内路径、锚点或 http/https 地址，且不能超过 {MaximumLinkLength} 个字符");

            request = new PlatformNotificationRequest
            {
                OsClient = osClient,
                NotificationId = notificationId,
                EventId = eventId,
                ReceiverUserIds = receiverUserIds,
                Title = title,
                Content = content,
                LinkUrl = linkUrl,
                Payload = payload,
                CreateTime = ReadString(input, "CreateTime")
            };
            if (string.IsNullOrWhiteSpace(request.CreateTime))
                request.CreateTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            return null;
        }

        private string ResolveOsClient()
        {
            var contextOsClient = V8TenantContext.Current?.OsClient;
            if (!string.IsNullOrWhiteSpace(contextOsClient))
            {
                if (!string.IsNullOrWhiteSpace(_osClient)
                    && !string.Equals(_osClient, contextOsClient, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException("通知租户与当前 V8 执行租户不一致");
                }
                return contextOsClient.Trim();
            }
            return _osClient;
        }

        private static JObject ToJObject(object value)
        {
            if (value == null) return null;
            if (value is JObject json) return (JObject)json.DeepClone();
            return JObject.FromObject(value);
        }

        private static string ReadString(JObject input, params string[] names)
        {
            foreach (var name in names)
            {
                var value = input[name];
                if (value != null && value.Type != JTokenType.Null)
                {
                    var text = value.Type == JTokenType.String
                        ? value.Value<string>()
                        : value.ToString(Formatting.None);
                    if (!string.IsNullOrWhiteSpace(text)) return text.Trim();
                }
            }
            return string.Empty;
        }

        private static IReadOnlyList<string> ReadReceiverIds(JObject input, out string invalidReceiverId)
        {
            var result = new List<string>();
            AddReceiver(result, input["ReceiverUserId"]);
            AddReceiver(result, input["ToUserId"]);
            AddReceiver(result, input["ReceiverUserIds"]);
            AddReceiver(result, input["ToUserIds"]);
            AddReceiver(result, input["Receivers"]);
            invalidReceiverId = result.FirstOrDefault(item => !SafeIdPattern.IsMatch(item));
            return result
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
        }

        private static string NormalizeLinkUrl(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;
            var link = value.Trim();
            if (link.Length > MaximumLinkLength) return null;
            if (link.StartsWith("#", StringComparison.Ordinal)
                || (link.StartsWith("/", StringComparison.Ordinal)
                    && !link.StartsWith("//", StringComparison.Ordinal)))
            {
                return link;
            }
            return Uri.TryCreate(link, UriKind.Absolute, out var uri)
                   && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps)
                ? uri.AbsoluteUri
                : null;
        }

        private static void AddReceiver(ICollection<string> result, JToken token)
        {
            if (token == null || token.Type == JTokenType.Null) return;
            if (token.Type == JTokenType.Array)
            {
                foreach (var item in token) AddReceiver(result, item);
                return;
            }
            if (token.Type == JTokenType.Object)
            {
                var id = token["Id"]?.ToString()
                         ?? token["UserId"]?.ToString()
                         ?? token["ReceiverUserId"]?.ToString();
                if (!string.IsNullOrWhiteSpace(id)) result.Add(id.Trim());
                return;
            }

            var text = token.ToString().Trim();
            if (string.IsNullOrWhiteSpace(text)) return;
            if (text.StartsWith("[", StringComparison.Ordinal))
            {
                try
                {
                    AddReceiver(result, JArray.Parse(text));
                    return;
                }
                catch
                {
                }
            }
            foreach (var item in text.Split(new[] { ',' }, StringSplitOptions.RemoveEmptyEntries))
            {
                var id = item.Trim();
                if (!string.IsNullOrWhiteSpace(id)) result.Add(id);
            }
        }

        private static async Task DispatchSafelyAsync(PlatformNotificationRequest request)
        {
            try
            {
                await DispatchWithTimeoutAsync(request).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                MicroiEngine.QueueSystemLog(
                    request.OsClient,
                    "PlatformNotification",
                    "RealtimePushFailed",
                    "平台内部通知实时推送失败",
                    ex.ToString(),
                    2,
                    false,
                    request.EventId);
            }
        }

        private static async Task<PlatformNotificationDispatchResult> DispatchWithTimeoutAsync(
            PlatformNotificationRequest request)
        {
            var dispatchTask = DispatchAsync(request);
            var completed = await Task.WhenAny(
                    dispatchTask,
                    Task.Delay(RealtimeTimeoutMilliseconds))
                .ConfigureAwait(false);
            if (completed != dispatchTask)
            {
                MicroiEngine.QueueSystemLog(
                    request.OsClient,
                    "PlatformNotification",
                    "RealtimePushTimeout",
                    "平台内部通知实时推送超时",
                    $"EventId={request.EventId}，超时={RealtimeTimeoutMilliseconds}ms。通知事实可由客户端回读。",
                    2,
                    false,
                    request.EventId);
                return new PlatformNotificationDispatchResult
                {
                    NotificationId = request.NotificationId,
                    EventId = request.EventId,
                    ReceiverCount = request.ReceiverUserIds.Count,
                    RealtimeConfigured = RealtimePushRuntime.IsConfigured,
                    TimedOut = true
                };
            }
            return await dispatchTask.ConfigureAwait(false);
        }

        private static async Task<PlatformNotificationDispatchResult> DispatchAsync(
            PlatformNotificationRequest request)
        {
            var result = new PlatformNotificationDispatchResult
            {
                NotificationId = request.NotificationId,
                EventId = request.EventId,
                ReceiverCount = request.ReceiverUserIds.Count,
                RealtimeConfigured = RealtimePushRuntime.IsConfigured
            };
            if (!RealtimePushRuntime.IsConfigured) return result;

            var cache = MicroiEngine.CacheTenant.Cache(request.OsClient);
            var connectionIds = new HashSet<string>(StringComparer.Ordinal);
            var onlineRecipients = 0;
            foreach (var receiverUserId in request.ReceiverUserIds)
            {
                try
                {
                    var clientInfo = cache.Get<ClientInfo>(
                                         $"Microi:{request.OsClient}:ChatOnline:{receiverUserId}")
                                     ?? cache.HashGet<ClientInfo>(
                                         $"Microi:{request.OsClient}:OnlineUsers",
                                         receiverUserId);
                    var userConnections = clientInfo?.ConnectionIds?
                        .Where(item => !string.IsNullOrWhiteSpace(item))
                        .Where(item => !item.StartsWith("token:", StringComparison.OrdinalIgnoreCase))
                        .Distinct(StringComparer.Ordinal)
                        .ToArray() ?? Array.Empty<string>();
                    if (userConnections.Length == 0) continue;
                    onlineRecipients++;
                    foreach (var connectionId in userConnections) connectionIds.Add(connectionId);
                }
                catch (Exception ex)
                {
                    MicroiEngine.QueueSystemLog(
                        request.OsClient,
                        "PlatformNotification",
                        "ConnectionLookupFailed",
                        "平台内部通知连接查询失败",
                        ex.ToString(),
                        2,
                        false,
                        receiverUserId);
                }
            }

            result.OnlineRecipientCount = onlineRecipients;
            result.ConnectionCount = connectionIds.Count;
            if (connectionIds.Count == 0) return result;

            object signalRPayload = null;
            if (request.Payload != null && request.Payload.Type != JTokenType.Null)
            {
                using var document = System.Text.Json.JsonDocument.Parse(
                    request.Payload.ToString(Formatting.None));
                signalRPayload = document.RootElement.Clone();
            }

            await RealtimePushRuntime.SendAsync(
                    connectionIds,
                    ClientEventName,
                    new
                    {
                        Id = request.NotificationId,
                        request.EventId,
                        request.Title,
                        request.Content,
                        request.LinkUrl,
                        request.CreateTime,
                        ChannelType,
                        IsRead = 0,
                        Payload = signalRPayload
                    })
                .ConfigureAwait(false);
            result.RealtimeDelivered = true;
            return result;
        }
    }

    internal sealed class PlatformNotificationRequest
    {
        public string OsClient { get; set; }
        public string NotificationId { get; set; }
        public string EventId { get; set; }
        public IReadOnlyList<string> ReceiverUserIds { get; set; }
        public string Title { get; set; }
        public string Content { get; set; }
        public string LinkUrl { get; set; }
        public string CreateTime { get; set; }
        public JToken Payload { get; set; }
    }

    public sealed class PlatformNotificationDispatchResult
    {
        public string NotificationId { get; set; }
        public string EventId { get; set; }
        public int ReceiverCount { get; set; }
        public int OnlineRecipientCount { get; set; }
        public int ConnectionCount { get; set; }
        public bool RealtimeConfigured { get; set; }
        public bool RealtimeDelivered { get; set; }
        public bool TimedOut { get; set; }
    }
}

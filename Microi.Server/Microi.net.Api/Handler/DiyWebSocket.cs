#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) Microi.net
* CLR 版本: 
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Primitives;
using Microi.net.Api;
using MongoDB.Bson.Serialization.Attributes;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    [BsonIgnoreExtraElements]//忽略mongodb内部自动产生的一些字段
    public class MessageChatContactListParam : MessageChatContactList
    {
        /// <summary>
        /// 
        /// </summary>
        [BsonIgnore]
        [JsonIgnore()]
        public IHubContext<DiyWebSocket>? _iHubContext { get; set; }
    }
    /// <summary>
    /// 
    /// </summary>
    [BsonIgnoreExtraElements]//忽略mongodb内部自动产生的一些字段
    public class MessageBodyParam : MessageBody
    {
        [BsonIgnore]
        [JsonIgnore()]
        public IHubContext<DiyWebSocket>? _iHubContext { get; set; }
    }
    /// <summary>
    /// 
    /// </summary>
    [EnableCors]
    //internal
    public class DiyWebSocket : Hub<IClient>
    {
        private const string IdentityItemKey = "Microi.DiyWebSocket.Identity";
        private const string ChatRuntimeApiEngineKey = "platform-chat-runtime";
        private readonly IMicroiAI _microiAI;
        private readonly IHubContext<DiyWebSocket, IClient> _backgroundHubContext;

        private static void WriteWebSocketLog(string osClient, string action, string title, string content, int level = 2, string targetId = null)
        {
            MicroiEngine.QueueSystemLog(osClient, "WebSocket", action, title, content, level, false, targetId);
        }

        private static string SafeString(object? value)
        {
            if (value == null)
            {
                return "";
            }

            return value is StringValues stringValues ? stringValues.ToString() : value.ToString() ?? "";
        }

        private static bool IsBlank(object? value)
        {
            return string.IsNullOrWhiteSpace(SafeString(value));
        }

        private static bool IsNotBlank(object? value)
        {
            return !IsBlank(value);
        }

        private async Task<WebSocketIdentity> ResolveIdentityAsync()
        {
            if (Context?.Items != null
                && Context.Items.TryGetValue(IdentityItemKey, out var cached)
                && cached is WebSocketIdentity cachedIdentity)
            {
                return cachedIdentity;
            }

            var httpContext = Context?.GetHttpContext();
            var token = ReadAccessToken(httpContext);
            if (token.DosIsNullOrWhiteSpace()) return null;
            var requestedOsClient = httpContext?.Request.Query["OsClient"].ToString()?.Trim();
            var currentToken = await DiyToken.GetCurrentToken(token, requestedOsClient)
                .ConfigureAwait(false);
            var currentUser = currentToken?.CurrentUser;
            var userId = currentUser?["Id"].Val<string>()?.Trim();
            if (currentUser == null
                || currentToken.OsClient.DosIsNullOrWhiteSpace()
                || userId.DosIsNullOrWhiteSpace())
            {
                return null;
            }
            if (UserAccessKeySecurity.IsSession(currentUser)) return null;

            JwtSecurityToken jwtToken;
            try
            {
                jwtToken = new JwtSecurityTokenHandler().ReadJwtToken(token);
            }
            catch
            {
                return null;
            }
            if (jwtToken.ValidTo != DateTime.MinValue && jwtToken.ValidTo < DateTime.UtcNow)
                return null;
            var activeTokenEntry = DiyToken.GetActiveCachedTokenEntry(currentToken, token);
            if (activeTokenEntry == null) return null;
            var clientType = jwtToken.Claims
                .FirstOrDefault(claim => claim.Type == "ClientType")?.Value;
            var clientModel = OsClient.GetClient(currentToken.OsClient);
            var activeTokenUpdateTime = activeTokenEntry.UpdateTime == default
                ? currentToken.UpdateTime
                : activeTokenEntry.UpdateTime;
            if (activeTokenUpdateTime != default
                && DateTime.Now - activeTokenUpdateTime
                > DiyToken.ResolveClientTokenLifetime(clientModel, clientType))
            {
                return null;
            }

            var name = currentUser["Name"].Val<string>();
            var account = currentUser["Account"].Val<string>();
            var identity = new WebSocketIdentity
            {
                OsClient = currentToken.OsClient,
                UserId = userId,
                UserName = string.IsNullOrWhiteSpace(name) ? account : name,
                UserAccount = account,
                UserAvatar = currentUser["Avatar"].Val<string>(),
                CurrentUser = currentUser,
                Token = token
            };
            Context.Items[IdentityItemKey] = identity;
            return identity;
        }

        private async Task<WebSocketIdentity> RequireIdentityAsync()
        {
            var identity = await ResolveIdentityAsync().ConfigureAwait(false);
            if (identity == null)
            {
                throw new HubException("登录身份已失效，请重新登录。");
            }
            return identity;
        }

        private static string ReadAccessToken(HttpContext httpContext)
        {
            var token = httpContext?.Request.Query["access_token"].ToString();
            if (token.DosIsNullOrWhiteSpace())
            {
                token = httpContext?.Request.Headers["Authorization"].FirstOrDefault();
            }
            if (token.DosIsNullOrWhiteSpace()) return string.Empty;
            token = token.Trim();
            if (token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            {
                token = token.Substring("Bearer ".Length).Trim();
            }
            return token.Length <= 8192 ? token : string.Empty;
        }

        private sealed class WebSocketIdentity
        {
            public string OsClient { get; set; }
            public string UserId { get; set; }
            public string UserName { get; set; }
            public string UserAccount { get; set; }
            public string UserAvatar { get; set; }
            public JObject CurrentUser { get; set; }
            public string Token { get; set; }
        }

        public DiyWebSocket(
            IMicroiAI microiAI,
            IHubContext<DiyWebSocket, IClient> backgroundHubContext = null)
        {
            _microiAI = microiAI;
            _backgroundHubContext = backgroundHubContext;
        }

        private static JObject ToResultObject(object result)
        {
            if (result == null) return null;
            if (result is JObject jobject) return jobject;
            if (result is string json)
            {
                try { return JObject.Parse(json); }
                catch { return null; }
            }
            try { return JObject.FromObject(result); }
            catch { return null; }
        }

        private static async Task<JObject> RunChatRuntimeAsync(
            string action,
            JObject payload,
            JObject trustedCurrentUser,
            string trustedOsClient)
        {
            if (trustedCurrentUser == null || trustedOsClient.DosIsNullOrWhiteSpace())
                throw new HubException("登录身份已失效，请重新登录。");
            var request = payload?.DeepClone() as JObject ?? new JObject();
            request["Action"] = action;
            request["OsClient"] = trustedOsClient;
            var rawResult = await ManagedApiEngineCompatibility.RunTrustedProtocolAsync(
                    ChatRuntimeApiEngineKey,
                    trustedOsClient,
                    request,
                    trustedCurrentUser)
                .ConfigureAwait(false);
            var result = ToResultObject(rawResult);
            if (result?["Code"].Val<int>() != 1)
            {
                throw new HubException(
                    result?["Msg"]?.ToString()
                    ?? "官方聊天运行时不可用，请安装或升级消息通知应用。");
            }
            return result;
        }

        private static MessageBodyDto ReadMessage(JObject result)
        {
            return (result?["Data"] as JObject)?["Message"]?.ToObject<MessageBodyDto>();
        }

        private static List<MessageChatContactListDto> ReadContacts(JObject data, string propertyName)
        {
            return data?[propertyName]?.ToObject<List<MessageChatContactListDto>>()
                ?? new List<MessageChatContactListDto>();
        }

        private async Task PushMessageAsync(
            string osClient,
            MessageBodyDto message,
            IHubContext<DiyWebSocket> externalContext = null)
        {
            if (message == null || message.ToUserId.DosIsNullOrWhiteSpace()) return;
            var client = await GetOnlineUserInfo(osClient, message.ToUserId).ConfigureAwait(false);
            if (client?.ConnectionIds?.Any() != true) return;
            try
            {
                if (externalContext != null)
                    await externalContext.Clients.Clients(client.ConnectionIds)
                        .SendAsync("ReceiveSendToUser", message).ConfigureAwait(false);
                else
                    await base.Clients.Clients(client.ConnectionIds)
                        .ReceiveSendToUser(message).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                WriteWebSocketLog(osClient, "ChatDeliveryFailed", "聊天消息实时投递失败",
                    ex.GetType().Name, 2, message.ToUserId);
            }
        }

        private async Task PushContactsAsync(
            string osClient,
            string userId,
            List<MessageChatContactListDto> contacts,
            IHubContext<DiyWebSocket> externalContext = null)
        {
            if (userId.DosIsNullOrWhiteSpace()) return;
            var client = await GetOnlineUserInfo(osClient, userId).ConfigureAwait(false);
            if (client?.ConnectionIds?.Any() != true) return;
            try
            {
                if (externalContext != null)
                    await externalContext.Clients.Clients(client.ConnectionIds)
                        .SendAsync("ReceiveSendLastContacts", contacts).ConfigureAwait(false);
                else
                    await base.Clients.Clients(client.ConnectionIds)
                        .ReceiveSendLastContacts(contacts).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                WriteWebSocketLog(osClient, "ChatContactsDeliveryFailed", "聊天联系人实时投递失败",
                    ex.GetType().Name, 2, userId);
            }
        }

        private async Task PushUnreadAsync(
            string osClient,
            string userId,
            long unreadCount,
            IHubContext<DiyWebSocket> externalContext = null)
        {
            if (userId.DosIsNullOrWhiteSpace()) return;
            var client = await GetOnlineUserInfo(osClient, userId).ConfigureAwait(false);
            if (client?.ConnectionIds?.Any() != true) return;
            try
            {
                if (externalContext != null)
                    await externalContext.Clients.Clients(client.ConnectionIds)
                        .SendAsync("ReceiveSendUnreadCountToUser", unreadCount).ConfigureAwait(false);
                else
                    await base.Clients.Clients(client.ConnectionIds)
                        .ReceiveSendUnreadCountToUser(unreadCount).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                WriteWebSocketLog(osClient, "ChatUnreadDeliveryFailed", "聊天未读数实时投递失败",
                    ex.GetType().Name, 2, userId);
            }
        }

        private async Task PushHistoryAsync(
            string osClient,
            string userId,
            List<MessageBodyDto> messages)
        {
            var client = await GetOnlineUserInfo(osClient, userId).ConfigureAwait(false);
            if (client?.ConnectionIds?.Any() != true) return;
            try
            {
                await base.Clients.Clients(client.ConnectionIds)
                    .ReceiveSendChatRecordToUser(messages ?? new List<MessageBodyDto>())
                    .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                WriteWebSocketLog(osClient, "ChatHistoryDeliveryFailed", "聊天记录实时投递失败",
                    ex.GetType().Name, 2, userId);
            }
        }

        private async Task DeliverRuntimeResultAsync(
            JObject result,
            string osClient,
            bool includeMessage,
            IHubContext<DiyWebSocket> externalContext = null)
        {
            if (result?["Data"] is not JObject data) return;
            if (includeMessage)
                await PushMessageAsync(osClient, data["Message"]?.ToObject<MessageBodyDto>(), externalContext)
                    .ConfigureAwait(false);

            var actorUserId = data["ActorUserId"].Val<string>();
            var targetUserId = data["TargetUserId"].Val<string>();
            if (data["ActorContacts"] != null)
                await PushContactsAsync(osClient, actorUserId, ReadContacts(data, "ActorContacts"), externalContext)
                    .ConfigureAwait(false);
            if (data["TargetContacts"] != null)
                await PushContactsAsync(osClient, targetUserId, ReadContacts(data, "TargetContacts"), externalContext)
                    .ConfigureAwait(false);
            if (data["Contacts"] != null)
                await PushContactsAsync(osClient, actorUserId, ReadContacts(data, "Contacts"), externalContext)
                    .ConfigureAwait(false);
            if (data["ActorUnreadCount"] != null)
                await PushUnreadAsync(osClient, actorUserId, data["ActorUnreadCount"].Val<long>(), externalContext)
                    .ConfigureAwait(false);
            if (data["TargetUnreadCount"] != null)
                await PushUnreadAsync(osClient, targetUserId, data["TargetUnreadCount"].Val<long>(), externalContext)
                    .ConfigureAwait(false);
            if (data["UnreadCount"] != null)
                await PushUnreadAsync(osClient, actorUserId, data["UnreadCount"].Val<long>(), externalContext)
                    .ConfigureAwait(false);
        }

        /// <summary>
        /// 仅用于已由固定 Managed 接口持久化成功的旧 Controller 兼容投递。
        /// 此方法不接受路由、租户或业务写入，也不会再次持久化。
        /// </summary>
        internal async Task DeliverPreparedMessageAsync(
            JObject managedResult,
            string osClient,
            IHubContext<DiyWebSocket> externalContext)
        {
            await DeliverRuntimeResultAsync(managedResult, osClient, true, externalContext)
                .ConfigureAwait(false);
        }

        //private static IDictionary<string, ClientInfo> _clients;

        //static DiyWebSocket()
        //{
        //    _clients = new Dictionary<string, ClientInfo>();
        //}

        public override async Task OnConnectedAsync()
        {
            string connid = base.Context.ConnectionId;
            var identity = await ResolveIdentityAsync().ConfigureAwait(false);
            if (identity == null)
            {
                var requestedOsClient = Context.GetHttpContext()?.Request.Query["OsClient"].ToString();
                WriteWebSocketLog(
                    requestedOsClient,
                    "UnauthorizedConnectionRejected",
                    "WebSocket 未授权连接已拒绝",
                    "access_token 无法解析为当前租户的有效登录身份。",
                    3);
                Context.Abort();
                return;
            }

            var sysUser = identity.CurrentUser;
            var osClient = identity.OsClient;
            var userId = identity.UserId;
            var userName = identity.UserName;
            var userAccount = identity.UserAccount;
            var userAvatar = identity.UserAvatar;
            var diyCacheBase = MicroiEngine.CacheTenant.Cache(osClient);
            HttpContext httpContext = base.Context.GetHttpContext();
            httpContext.Request.Query.TryGetValue("groupName", out var groupName);
            // httpContext.Request.Query.TryGetValue("UserId", out var userId);
            // httpContext.Request.Query.TryGetValue("UserName", out var userName);
            // httpContext.Request.Query.TryGetValue("UserAvatar", out var userAvatar);
            httpContext.Request.Query.TryGetValue("OtherInfo", out var otherInfo);
            // httpContext.Request.Query.TryGetValue("IP", out var ip);
            // httpContext.Request.Query.TryGetValue("OsClient", out var OsClient);
            httpContext.Request.Query.TryGetValue("DeviceClientId", out var deviceClientId);
            var requestToken = identity.Token;

            if (!string.IsNullOrEmpty(userId))
            {
                ClientInfo clientInfo = await diyCacheBase.GetAsync<ClientInfo>($"Microi:{osClient}:ChatOnline:{userId}");
                if (clientInfo != null)
                {
                    clientInfo.LastConnectionId = connid;
                    clientInfo.ConnectionIds ??= new List<string>();
                    clientInfo.ConnectionIds.Remove(connid);
                    clientInfo.ConnectionIds.Insert(0, connid);
                    clientInfo.ConnectionIds = clientInfo.ConnectionIds.Take(10).ToList();
                    if (IsNotBlank(deviceClientId))
                    {
                        clientInfo.DeviceClientId = deviceClientId;
                    }
                }
                else
                {
                    clientInfo = new ClientInfo
                    {
                        LastConnectionId = connid,
                        GroupName = groupName,
                        UserId = userId,
                        UserName = userName,
                        UserAvatar = userAvatar,
                        OtherInfo = otherInfo,
                        Ip = httpContext.Connection.RemoteIpAddress?.ToString(),
                        ConnectionIds = new List<string> { connid },
                        ConnectedTime = DateTime.Now,
                        DeviceClientId = deviceClientId
                    };
                }
                await diyCacheBase.SetAsync($"Microi:{osClient}:ChatOnline:{userId}", clientInfo);
                // Background-task notifications are runtime-scoped. Keep the
                // historic chat key for ordinary chat compatibility while writing
                // an isolated connection projection for task pushes.
                var scopedChatOnlineKey = BackgroundTaskService.GetScopedChatOnlineKey(
                    osClient, userId, OsClientDefault.OsClientType, OsClientDefault.OsClientNetwork);
                var scopedClientInfo = await diyCacheBase.GetAsync<ClientInfo>(scopedChatOnlineKey)
                    ?? new ClientInfo
                    {
                        GroupName = groupName,
                        UserId = userId,
                        UserName = userName,
                        UserAvatar = userAvatar,
                        OtherInfo = otherInfo,
                        Ip = httpContext.Connection.RemoteIpAddress?.ToString(),
                        ConnectedTime = DateTime.Now
                    };
                scopedClientInfo.LastConnectionId = connid;
                scopedClientInfo.ConnectionIds ??= new List<string>();
                scopedClientInfo.ConnectionIds.Remove(connid);
                scopedClientInfo.ConnectionIds.Insert(0, connid);
                scopedClientInfo.ConnectionIds = scopedClientInfo.ConnectionIds.Take(10).ToList();
                if (IsNotBlank(deviceClientId)) scopedClientInfo.DeviceClientId = deviceClientId;
                await diyCacheBase.SetAsync(scopedChatOnlineKey, scopedClientInfo);
                await OnlineTerminalService.TrackConnectedAsync(
                    osClient,
                    sysUser,
                    connid,
                    httpContext,
                    Context.User?.Claims,
                    groupName.ToString(),
                    otherInfo.ToString(),
                    deviceClientId.ToString(),
                    requestToken).ConfigureAwait(false);
                try
                {
                    var contactsResult = await RunChatRuntimeAsync(
                        "ListContacts",
                        new JObject { ["PageIndex"] = 1, ["PageSize"] = 20 },
                        identity.CurrentUser,
                        identity.OsClient).ConfigureAwait(false);
                    await DeliverRuntimeResultAsync(contactsResult, identity.OsClient, false)
                        .ConfigureAwait(false);
                }
                catch (Exception ex)
                {
                    WriteWebSocketLog(identity.OsClient, "ChatContactsBootstrapFailed",
                        "聊天联系人初始化失败", ex.GetType().Name, 1, identity.UserId);
                }
            }
            await base.OnConnectedAsync().ConfigureAwait(false);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="exception"></param>
        /// <returns></returns>
        public override async Task OnDisconnectedAsync(Exception exception)
        {
            string connid = base.Context.ConnectionId;
            string osClient = null;
            string userId = null;
            try
            {
                var identity = await ResolveIdentityAsync().ConfigureAwait(false);
                osClient = identity?.OsClient;
                userId = identity?.UserId;
                
                if (!string.IsNullOrEmpty(userId) && !string.IsNullOrEmpty(osClient))
                {
                    var diyCacheBase = MicroiEngine.CacheTenant.Cache(osClient);
                    ClientInfo clientInfo = await diyCacheBase.GetAsync<ClientInfo>($"Microi:{osClient}:ChatOnline:{userId}");
                    if (clientInfo != null)
                    {
                        clientInfo.ConnectionIds ??= new List<string>();
                        // 移除当前断开的连接ID
                        clientInfo.ConnectionIds.Remove(connid);
                        if (clientInfo.LastConnectionId == connid)
                        {
                            clientInfo.LastConnectionId = clientInfo.ConnectionIds.FirstOrDefault();
                        }
                        
                        if (clientInfo.ConnectionIds.Count > 0)
                        {
                            // 还有其他连接，更新缓存
                            await diyCacheBase.SetAsync($"Microi:{osClient}:ChatOnline:{userId}", clientInfo);
                        }
                        else
                        {
                            // 没有活跃连接了，移除在线记录
                            await diyCacheBase.RemoveAsync($"Microi:{osClient}:ChatOnline:{userId}");
                        }
                    }
                    var scopedChatOnlineKey = BackgroundTaskService.GetScopedChatOnlineKey(
                        osClient, userId, OsClientDefault.OsClientType, OsClientDefault.OsClientNetwork);
                    var scopedClientInfo = await diyCacheBase.GetAsync<ClientInfo>(scopedChatOnlineKey);
                    if (scopedClientInfo != null)
                    {
                        scopedClientInfo.ConnectionIds ??= new List<string>();
                        scopedClientInfo.ConnectionIds.Remove(connid);
                        if (scopedClientInfo.LastConnectionId == connid)
                            scopedClientInfo.LastConnectionId = scopedClientInfo.ConnectionIds.FirstOrDefault();
                        if (scopedClientInfo.ConnectionIds.Count > 0)
                            await diyCacheBase.SetAsync(scopedChatOnlineKey, scopedClientInfo);
                        else
                            await diyCacheBase.RemoveAsync(scopedChatOnlineKey);
                    }
                }
                await OnlineTerminalService.TrackDisconnectedAsync(osClient, userId, connid).ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                WriteWebSocketLog(osClient, "DisconnectCleanupFailed", "WebSocket 断开清理失败", ex.ToString(), 2, userId);
            }
            
            await base.OnDisconnectedAsync(exception);
        }

        /// <summary>
        /// 推送当前登录用户的后台任务列表。前端在连接成功、打开任务面板时主动调用，服务端任务状态变化时也会主动推送同名事件。
        /// </summary>
        public async Task SendBackgroundTaskList()
        {
            var identity = await RequireIdentityAsync().ConfigureAwait(false);
            await BackgroundTaskService.SendTaskListToUserAsync(identity.OsClient, identity.UserId)
                .ConfigureAwait(false);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        public async Task SendToUser(MessageBodyParam msg)
        {
            var identity = await RequireIdentityAsync().ConfigureAwait(false);
            msg ??= new MessageBodyParam();
            if (IsBlank(msg.ToUserId) || IsBlank(msg.Content))
                throw new HubException("接收用户和消息内容不能为空。");
            if (ChatAssistantIdentity.IsAssistant(msg.ToUserId)
                && (_microiAI == null || _backgroundHubContext == null))
                throw new HubException("AI聊天服务暂不可用，请稍后重试。");

            var requestId = IsNotBlank(msg.RequestId)
                ? msg.RequestId.Trim()
                : (IsNotBlank(msg.MessageId) ? msg.MessageId.Trim() : Ulid.NewUlid().ToString());
            var result = await RunChatRuntimeAsync(
                "PersistMessage",
                new JObject
                {
                    ["RequestId"] = requestId,
                    ["ToUserId"] = msg.ToUserId,
                    ["Content"] = msg.Content,
                    ["OtherInfo"] = msg.OtherInfo,
                    ["Type"] = msg.Type,
                    ["IsRead"] = msg.IsRead
                },
                identity.CurrentUser,
                identity.OsClient).ConfigureAwait(false);
            await DeliverRuntimeResultAsync(result, identity.OsClient, true).ConfigureAwait(false);

            var stored = ReadMessage(result);
            if (stored != null && ChatAssistantIdentity.IsAssistant(stored.ToUserId))
            {
                var originalMessage = new MessageBodyParam
                {
                    MessageId = stored.MessageId,
                    RequestId = stored.RequestId,
                    FromUserId = stored.FromUserId,
                    FromUserName = stored.FromUserName,
                    FromUserAccount = stored.FromUserAccount,
                    FromUserAvatar = stored.FromUserAvatar,
                    ToUserId = stored.ToUserId,
                    ToUserName = stored.ToUserName,
                    ToUserAccount = stored.ToUserAccount,
                    ToUserAvatar = stored.ToUserAvatar,
                    Content = stored.Content,
                    OtherInfo = stored.OtherInfo,
                    Type = stored.Type,
                    IsRead = stored.IsRead,
                    CreateTime = stored.CreateTime,
                    OsClient = identity.OsClient
                };
                _ = RunAiResponseInBackgroundAsync(
                    _microiAI,
                    _backgroundHubContext,
                    originalMessage,
                    identity.CurrentUser,
                    identity.OsClient);
            }
            return;
        }

        /// <summary>
        /// 获取在线用户信息
        /// </summary>
        private static async Task<ClientInfo> GetOnlineUserInfo(string osClient, string userId)
        {
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            return await cache.GetAsync<ClientInfo>($"Microi:{osClient}:ChatOnline:{userId}");
        }

        /// <summary>
        /// 通过可跨 Hub 生命周期使用的强类型 HubContext 发送消息。
        /// </summary>
        private static async Task SendMessageToClient(
            ClientInfo clientInfo,
            MessageBodyDto message,
            IHubContext<DiyWebSocket, IClient> hubContext)
        {
            if (clientInfo == null
                || clientInfo.ConnectionIds == null
                || !clientInfo.ConnectionIds.Any()
                || hubContext == null)
            {
                return;
            }

            try
            {
                await hubContext.Clients
                    .Clients(clientInfo.ConnectionIds)
                    .ReceiveSendToUser(message);
            }
            catch (Exception ex)
            {
                WriteWebSocketLog(OsClientDefault.OsClient, "MessagePushFailed", "WebSocket 消息推送失败", ex.ToString(), 2, message?.ToUserId);
            }
        }

        /// <summary>
        /// 记录 fire-and-forget 异常，同时确保状态机不捕获 DiyWebSocket 实例。
        /// </summary>
        private static async Task RunAiResponseInBackgroundAsync(
            IMicroiAI microiAI,
            IHubContext<DiyWebSocket, IClient> hubContext,
            MessageBodyParam originalMsg,
            JObject trustedCurrentUser,
            string trustedOsClient)
        {
            try
            {
                await HandleAIResponse(
                    microiAI,
                    hubContext,
                    originalMsg,
                    trustedCurrentUser,
                    trustedOsClient);
            }
            catch (Exception ex)
            {
                WriteWebSocketLog(trustedOsClient, "AiBackgroundReplyFailed", "AI 后台自动回复失败", ex.ToString(), 2, originalMsg?.FromUserId);
                try
                {
                    var clientInfoTo = await GetOnlineUserInfo(
                        trustedOsClient,
                        originalMsg?.FromUserId);
                    if (clientInfoTo?.ConnectionIds?.Any() == true)
                    {
                        await hubContext.Clients
                            .Clients(clientInfoTo.ConnectionIds)
                            .ReceiveAIError(
                                "AI助手暂时无法回复，请检查当前租户的AI模型配置后重试。",
                                ChatAssistantIdentity.UserId,
                                originalMsg.FromUserId);
                    }
                }
                catch (Exception notifyEx)
                {
                    WriteWebSocketLog(trustedOsClient, "AiErrorPushFailed", "AI 失败状态推送异常", notifyEx.ToString(), 2, originalMsg?.FromUserId);
                }
            }
            finally
            {
                try
                {
                    var clientInfoTo = await GetOnlineUserInfo(
                        trustedOsClient,
                        originalMsg?.FromUserId);
                    if (clientInfoTo?.ConnectionIds?.Any() == true)
                    {
                        await hubContext.Clients
                            .Clients(clientInfoTo.ConnectionIds)
                            .ReceiveAIChunk(
                                "",
                                ChatAssistantIdentity.UserId,
                                originalMsg.FromUserId,
                                true);
                    }
                }
                catch (Exception completeEx)
                {
                    WriteWebSocketLog(trustedOsClient, "AiCompletePushFailed", "AI 完成状态推送异常", completeEx.ToString(), 2, originalMsg?.FromUserId);
                }
            }
        }

        private static async Task DeliverBackgroundRuntimeProjectionAsync(
            JObject result,
            string osClient,
            IHubContext<DiyWebSocket, IClient> hubContext)
        {
            if (result?["Data"] is not JObject data || hubContext == null) return;
            var targetUserId = data["TargetUserId"].Val<string>();
            if (targetUserId.DosIsNullOrWhiteSpace()) return;
            var client = await GetOnlineUserInfo(osClient, targetUserId).ConfigureAwait(false);
            if (client?.ConnectionIds?.Any() != true) return;
            try
            {
                if (data["TargetContacts"] != null)
                    await hubContext.Clients.Clients(client.ConnectionIds)
                        .ReceiveSendLastContacts(ReadContacts(data, "TargetContacts"))
                        .ConfigureAwait(false);
                if (data["TargetUnreadCount"] != null)
                    await hubContext.Clients.Clients(client.ConnectionIds)
                        .ReceiveSendUnreadCountToUser(data["TargetUnreadCount"].Val<long>())
                        .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                WriteWebSocketLog(osClient, "AiProjectionDeliveryFailed",
                    "AI聊天投影实时投递失败", ex.GetType().Name, 2, targetUserId);
            }
        }

        /// <summary>
        /// 处理AI自动回复
        /// </summary>
        private static async Task HandleAIResponse(
            IMicroiAI microiAI,
            IHubContext<DiyWebSocket, IClient> hubContext,
            MessageBodyParam originalMsg,
            JObject trustedCurrentUser,
            string trustedOsClient)
        {
            try
            {
                var aiUser = new
                {
                    Id = ChatAssistantIdentity.UserId,
                    Name = ChatAssistantIdentity.UserName,
                    Avatar = ChatAssistantIdentity.UserAvatar
                };

                // 优先使用客户端传递的AI模型（通过OtherInfo字段）
                string clientAiModel = null;
                string clientAiModelId = null;
                if (!string.IsNullOrEmpty(originalMsg.OtherInfo))
                {
                    try
                    {
                        var otherInfo = Newtonsoft.Json.JsonConvert.DeserializeObject<Dictionary<string, string>>(originalMsg.OtherInfo);
                        if (otherInfo != null && otherInfo.ContainsKey("AiModel"))
                        {
                            clientAiModel = otherInfo["AiModel"];
                        }
                        if (otherInfo != null
                            && otherInfo.TryGetValue(
                                "AiModelId",
                                out var requestedAiModelId))
                        {
                            clientAiModelId =
                                requestedAiModelId?.Trim();
                        }
                    }
                    catch { }
                }

                // 获取用户连接信息
                var clientInfoTo = await GetOnlineUserInfo(
                    trustedOsClient,
                    originalMsg.FromUserId);
                
                // 立即发送"思考中"信号，让前端马上显示AI正在响应
                if (clientInfoTo != null)
                {
                    await hubContext.Clients.Clients(clientInfoTo.ConnectionIds).ReceiveAIChunk(
                        "[THINKING]", 
                        aiUser.Id, 
                        originalMsg.FromUserId, 
                        false
                    );
                }
                
                // 创建流式输出回调函数
                var fullResponse = new System.Text.StringBuilder();
                var isFirstChunk = true;
                
                Func<string, Task> streamCallback = async (chunk) =>
                {
                    try
                    {
                        // 每次收到数据块就立即发送给前端
                        if (clientInfoTo != null)
                        {
                            await hubContext.Clients.Clients(clientInfoTo.ConnectionIds).ReceiveAIChunk(
                                chunk, 
                                aiUser.Id, 
                                originalMsg.FromUserId, 
                                false  // 还未完成
                            );
                            
                            if (isFirstChunk)
                            {
                                isFirstChunk = false;
                            }
                        }
                        fullResponse.Append(chunk);
                    }
                    catch (Exception ex)
                    {
                        WriteWebSocketLog(trustedOsClient, "AiStreamChunkFailed", "AI 流式数据块发送失败", ex.ToString(), 2, originalMsg.FromUserId);
                    }
                };
                
                // SignalR 只绑定客户端选择与可信身份。租户模型解析、
                // 默认模型、Schema 授权和聊天编排全部由 Microi.AI 完成。
                var chatParam = new ChatMessageParam
                {
                    Question = originalMsg.Content,
                    AiModel = clientAiModel,
                    AiModelId = clientAiModelId,
                    OsClient = trustedOsClient
                };
                var aiResult =
                    await microiAI.HandleTrustedChatMessageAsync(
                        chatParam,
                        trustedCurrentUser,
                        trustedOsClient,
                        streamCallback);

                if (aiResult == null || !aiResult.Success)
                {
                    throw new InvalidOperationException(
                        string.IsNullOrWhiteSpace(aiResult?.Content)
                            ? "AI服务未返回有效结果。"
                            : aiResult.Content);
                }

                // 非流式模型可能只在最终结果返回 Content。此时补推一次，
                // 避免服务成功但聊天窗口仍然没有任何可见回复。
                if (fullResponse.Length == 0
                    && !string.IsNullOrWhiteSpace(aiResult.Content)
                    && clientInfoTo?.ConnectionIds?.Any() == true)
                {
                    await hubContext.Clients
                        .Clients(clientInfoTo.ConnectionIds)
                        .ReceiveAIChunk(
                            aiResult.Content,
                            aiUser.Id,
                            originalMsg.FromUserId,
                            false);
                    fullResponse.Append(aiResult.Content);
                }

                if (fullResponse.Length == 0
                    && string.IsNullOrWhiteSpace(aiResult.Content)
                    && aiResult.QueryResult == null)
                {
                    throw new InvalidOperationException("AI服务返回了空响应。");
                }

                // 如果是NL2SQL查询且有详细数据，额外发送一条包含QueryResult的消息
                if (aiResult.ResponseType == "NL2SQL数据查询" && aiResult.QueryResult != null)
                {
                    try
                    {
                        var queryResultArray = aiResult.QueryResult as dynamic[];
                        if (queryResultArray != null && queryResultArray.Length > 0)
                        {
                            // 将QueryResult序列化为JSON字符串
                            var queryDataJson = System.Text.Json.JsonSerializer.Serialize(queryResultArray, new System.Text.Json.JsonSerializerOptions
                            {
                                WriteIndented = false,
                                Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
                            });
                            
                            var dataPersisted = await RunChatRuntimeAsync(
                                "PersistAssistantMessage",
                                new JObject
                                {
                                    ["RequestId"] = $"{originalMsg.MessageId ?? originalMsg.RequestId}:ai-data",
                                    ["ToUserId"] = originalMsg.FromUserId,
                                    ["Content"] = queryDataJson,
                                    ["Type"] = "data",
                                    ["IsRead"] = false
                                },
                                trustedCurrentUser,
                                trustedOsClient).ConfigureAwait(false);
                            var dataMessageDto = ReadMessage(dataPersisted);
                            await SendMessageToClient(
                                clientInfoTo,
                                dataMessageDto,
                                hubContext).ConfigureAwait(false);
                            await DeliverBackgroundRuntimeProjectionAsync(
                                dataPersisted,
                                trustedOsClient,
                                hubContext).ConfigureAwait(false);
                        }
                    }
                    catch (Exception dataEx)
                    {
                        WriteWebSocketLog(trustedOsClient, "AiDetailPushFailed", "AI 查询明细发送失败", dataEx.ToString(), 2, originalMsg.FromUserId);
                    }
                }

                // AI流式协议仍由宿主负责；最终消息事实统一交由固定 Managed runtime 持久化。
                try
                {
                    var finalPersisted = await RunChatRuntimeAsync(
                        "PersistAssistantMessage",
                        new JObject
                        {
                            ["RequestId"] = $"{originalMsg.MessageId ?? originalMsg.RequestId}:ai-final",
                            ["ToUserId"] = originalMsg.FromUserId,
                            ["Content"] = string.IsNullOrWhiteSpace(aiResult.Content)
                                ? fullResponse.ToString()
                                : aiResult.Content,
                            ["Type"] = "text",
                            ["IsRead"] = false
                        },
                        trustedCurrentUser,
                        trustedOsClient).ConfigureAwait(false);
                    await DeliverBackgroundRuntimeProjectionAsync(
                        finalPersisted,
                        trustedOsClient,
                        hubContext).ConfigureAwait(false);
                }
                catch (Exception ex)
                {
                    WriteWebSocketLog(trustedOsClient, "AiChatPersistenceFailed", "AI 聊天记录保存失败", ex.ToString(), 2, originalMsg.FromUserId);
                    throw;
                }
            }
            catch (Exception ex)
            {
                WriteWebSocketLog(trustedOsClient, "AiReplyFailed", "AI 自动回复异常", ex.ToString(), 2, originalMsg.FromUserId);
                throw;
            }
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        public async Task SendChatRecordToUser(MessageBody msg)
        {
            var identity = await RequireIdentityAsync().ConfigureAwait(false);
            msg ??= new MessageBody();
            if (IsBlank(msg.ToUserId)) throw new HubException("聊天对象不能为空。");
            var result = await RunChatRuntimeAsync(
                "GetHistoryAndMarkRead",
                new JObject
                {
                    ["PeerUserId"] = msg.ToUserId,
                    ["PageIndex"] = msg._PageIndex ?? 1,
                    ["PageSize"] = msg._PageSize ?? 20
                },
                identity.CurrentUser,
                identity.OsClient).ConfigureAwait(false);
            var data = result["Data"] as JObject;
            await PushHistoryAsync(
                identity.OsClient,
                identity.UserId,
                data?["Messages"]?.ToObject<List<MessageBodyDto>>() ?? new List<MessageBodyDto>())
                .ConfigureAwait(false);
            await DeliverRuntimeResultAsync(result, identity.OsClient, false).ConfigureAwait(false);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        public async Task SendUnreadCountToUser(MessageBodyParam msg)
        {
            var identity = await RequireIdentityAsync().ConfigureAwait(false);
            var result = await RunChatRuntimeAsync(
                "GetUnreadCount",
                new JObject(),
                identity.CurrentUser,
                identity.OsClient).ConfigureAwait(false);
            await DeliverRuntimeResultAsync(result, identity.OsClient, false).ConfigureAwait(false);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        public async Task SendConnectToUser(MessageBody msg)
        {
            var identity = await RequireIdentityAsync().ConfigureAwait(false);
            msg ??= new MessageBody();
            if (IsBlank(msg.ToUserId)) throw new HubException("聊天对象不能为空。");
            var result = await RunChatRuntimeAsync(
                "TouchContact",
                new JObject { ["PeerUserId"] = msg.ToUserId },
                identity.CurrentUser,
                identity.OsClient).ConfigureAwait(false);
            await DeliverRuntimeResultAsync(result, identity.OsClient, false).ConfigureAwait(false);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        public async Task SendLastContacts(MessageChatContactListParam msg)
        {
            var identity = await RequireIdentityAsync().ConfigureAwait(false);
            msg ??= new MessageChatContactListParam();
            var result = await RunChatRuntimeAsync(
                "ListContacts",
                new JObject
                {
                    ["PageIndex"] = msg._PageIndex ?? 1,
                    ["PageSize"] = msg._PageSize ?? 20
                },
                identity.CurrentUser,
                identity.OsClient).ConfigureAwait(false);
            await DeliverRuntimeResultAsync(result, identity.OsClient, false).ConfigureAwait(false);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        public async Task SendDelLastContact(MessageChatContactList msg)
        {
            var identity = await RequireIdentityAsync().ConfigureAwait(false);
            msg ??= new MessageChatContactList();
            if (IsBlank(msg.ContactUserId)) throw new HubException("聊天对象不能为空。");
            var result = await RunChatRuntimeAsync(
                "DeleteContact",
                new JObject { ["PeerUserId"] = msg.ContactUserId },
                identity.CurrentUser,
                identity.OsClient).ConfigureAwait(false);
            await DeliverRuntimeResultAsync(result, identity.OsClient, false).ConfigureAwait(false);
        }
    }
}

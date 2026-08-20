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
using MongoDB.Bson.Serialization.Attributes;
using MongoDB.Driver;
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
    public class DiyWebSocket : Hub<IClient>, IConnectionHub, ISuppertToClientInvoke
    {
        private const string IdentityItemKey = "Microi.DiyWebSocket.Identity";
        private readonly IMicroiAI _microiAI;
        private readonly IHubContext<DiyWebSocket, IClient> _backgroundHubContext;
        
        // MongoDB连接配置缓存，避免频繁调用OsClient.GetClient
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, string> _mongoConnectionCache = new();

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
                    await SendLastContactsCore(new MessageChatContactListParam
                    {
                        UserId = userId,
                        UserName = userName,
                        UserAvatar = userAvatar,
                        OtherInfo = otherInfo,
                        ContactUserId = "",
                        OsClient = osClient,
                        _IsUpdateTime = false
                    });
                }
                catch (Exception)
                {
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
        /// <param name="from"></param>
        /// <param name="groupName"></param>
        /// <param name="msg"></param>
        /// <returns></returns>
        public async Task SendMessage(string from, string groupName, string msg)
        {
            await base.Clients.Group(groupName).ReceiveMessage(new UserMessageContent
            {
                Content = msg,
                FromUserId = from
            });
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="groupName"></param>
        /// <param name="msg"></param>
        /// <returns></returns>
        public async Task SendConnection(string groupName, ConnectionMessageContent msg)
        {
            await base.Clients.Group(groupName).ReceiveConnection(msg);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="groupName"></param>
        /// <param name="msg"></param>
        /// <returns></returns>
        public async Task SendDisConnection(string groupName, DisConnectionMessageContent msg)
        {
            await base.Clients.Group(groupName).ReceiveDisConnection(msg);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <param name="groupName"></param>
        /// <returns></returns>
        public async Task SendToGroup(UserMessageContent msg, string groupName)
        {
            await base.Clients.Group(groupName).ReceiveSendToGroup(msg);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <param name="groups"></param>
        /// <returns></returns>
        public async Task SendToGroups(UserMessageContent msg, params string[] groups)
        {
            await base.Clients.Groups(groups.ToList().AsReadOnly()).ReceiveSendToGroups(msg);
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        public async Task SendToUser(MessageBodyParam msg)
        {
            WebSocketIdentity callerIdentity = null;
            if (Context?.GetHttpContext() != null)
            {
                callerIdentity = await RequireIdentityAsync().ConfigureAwait(false);
                msg ??= new MessageBodyParam();
                msg.OsClient = callerIdentity.OsClient;
                msg.FromUserId = callerIdentity.UserId;
                msg.FromUserName = callerIdentity.UserName;
                msg.FromUserAvatar = callerIdentity.UserAvatar;
                if (IsBlank(msg.ToUserId) || IsBlank(msg.Content))
                    throw new HubException("接收用户和消息内容不能为空。");

                if (string.Equals(msg.ToUserId, "AI", StringComparison.OrdinalIgnoreCase))
                {
                    msg.ToUserId = "AI";
                    msg.ToUserName = "AI助手";
                    msg.ToUserAvatar = "";
                    if (_microiAI == null || _backgroundHubContext == null)
                        throw new HubException("AI聊天服务暂不可用，请稍后重试。");
                }
                else
                {
                    var targetUserResult = await MicroiEngine.FormEngine.GetFormDataAsync(
                        "sys_user",
                        new { Id = msg.ToUserId, OsClient = callerIdentity.OsClient });
                    if (targetUserResult == null || targetUserResult.Code != 1 || targetUserResult.Data == null)
                        throw new HubException("接收用户不存在或已停用。");
                    msg.ToUserName = targetUserResult.Data.Name;
                    msg.ToUserAvatar = targetUserResult.Data.Avatar;
                }
            }

            msg.CreateTime = DateTime.Now;
            var DiyCacheBase = MicroiEngine.CacheTenant.Cache(msg.OsClient);

            if (IsBlank(msg.FromUserId) || IsBlank(msg.ToUserId) || IsBlank(msg.Content) || IsBlank(msg.OsClient))
            {

                ClientInfo clientInfoFrom = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.FromUserId}");
                if (clientInfoFrom != null)
                {
                    try
                    {
                        var msg2 = new MessageBody
                        {
                            Content = DiyMessage.GetLang(msg.OsClient, "ParamError", msg._Lang),
                            FromUserId = "系统消息",
                            FromUserName = "系统管理员",
                            CreateTime = DateTime.Now
                        };
                        if (msg._iHubContext != null)
                        {
                            msg._iHubContext.Clients.Clients(clientInfoFrom.ConnectionIds).SendAsync("ReceiveSendToUser", msg2);
                        }
                        else
                        {
                            await base.Clients.Clients(clientInfoFrom.ConnectionIds).ReceiveSendToUser(msg2);
                        }
                    }
                    catch (Exception)
                    {
                    }
                }
                return;
            }
            ClientInfo clientInfoTo = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.ToUserId}");
            if (clientInfoTo != null)
            {
                try
                {
                    // 使用DTO避免ObjectId序列化问题
                    var messageDto = new MessageBodyDto
                    {
                        FromUserId = msg.FromUserId,
                        FromUserName = msg.FromUserName,
                        FromUserAvatar = msg.FromUserAvatar,
                        ToUserId = msg.ToUserId,
                        ToUserName = msg.ToUserName,
                        ToUserAvatar = msg.ToUserAvatar,
                        Content = msg.Content,
                        CreateTime = msg.CreateTime,
                        Type = msg.Type,
                        IsRead = msg.IsRead
                    };
                    
                    if (msg._iHubContext != null)
                    {
                        msg._iHubContext.Clients.Clients(clientInfoTo.ConnectionIds).SendAsync("ReceiveSendToUser", messageDto);
                    }
                    else
                    {
                        await base.Clients.Clients(clientInfoTo.ConnectionIds).ReceiveSendToUser(messageDto);
                    }
                }
                catch (Exception)
                {
                }
            }
            try
            {
                var chatHost = GetChatHost(msg.OsClient);
                await TMongodbHelper<MessageBody>.InsertAsync(chatHost, msg);

                await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.FromUserId}");
                //更新发送者最近联系人列表
                await SendLastContactsCore(new MessageChatContactListParam
                {
                    UserId = msg.FromUserId,
                    UserName = msg.FromUserName,
                    UserAvatar = msg.FromUserAvatar,
                    ContactUserId = msg.ToUserId,
                    ContactUserName = msg.ToUserName,
                    ContactUserAvatar = msg.ToUserAvatar,
                    LastMessage = msg.Content,
                    LastMessageType = msg.Type,
                    OsClient = msg.OsClient,
                    OtherInfo = msg.OtherInfo,
                    _IsUpdateTime = true,
                    _iHubContext = msg._iHubContext
                });
                //更新接收者最近联系人列表
                await SendLastContactsCore(new MessageChatContactListParam
                {
                    UserId = msg.ToUserId,
                    UserName = msg.ToUserName,
                    UserAvatar = msg.ToUserAvatar,
                    ContactUserId = msg.FromUserId,
                    ContactUserName = msg.FromUserName,
                    ContactUserAvatar = msg.FromUserAvatar,
                    LastMessage = msg.Content,
                    LastMessageType = msg.Type,
                    OsClient = msg.OsClient,
                    OtherInfo = msg.OtherInfo,
                    _IsUpdateTime = true,//2021-05-08修改为true，why before is false？
                    _iHubContext = msg._iHubContext
                });
                await SendUnreadCountToUserCore(new MessageBodyParam
                {
                    ToUserId = msg.ToUserId,
                    OsClient = msg.OsClient,
                    _iHubContext = msg._iHubContext
                });

                // 如果接收者是AI用户，自动触发AI回复
                if (msg.ToUserId == "AI")
                {
                    var trustedAiIdentity = callerIdentity
                        ?? await ResolveIdentityAsync().ConfigureAwait(false);
                    var trustedAiUser = trustedAiIdentity?.CurrentUser;
                    var trustedAiOsClient = trustedAiIdentity?.OsClient?.Trim();
                    var trustedAiUserId = trustedAiIdentity?.UserId?.Trim();
                    if (trustedAiUser == null
                        || string.IsNullOrWhiteSpace(trustedAiOsClient)
                        || string.IsNullOrWhiteSpace(trustedAiUserId)
                        || !string.Equals(
                            trustedAiOsClient,
                            msg.OsClient?.Trim(),
                            StringComparison.OrdinalIgnoreCase)
                        || !string.Equals(
                            trustedAiUserId,
                            msg.FromUserId?.Trim(),
                            StringComparison.OrdinalIgnoreCase))
                    {
                        WriteWebSocketLog(msg.OsClient, "AiIdentityRejected", "AI 聊天身份或租户不一致，已拒绝调用", "消息身份与当前登录 Token 不一致。", 3, msg.FromUserId);
                        return;
                    }

                    if (_microiAI == null || _backgroundHubContext == null)
                    {
                        WriteWebSocketLog(msg.OsClient, "AiServiceUnavailable", "AI 自动回复服务不可用", "IMicroiAI 或 HubContext 未注入，已拒绝后台调用。", 3, msg.FromUserId);
                        throw new HubException("AI聊天服务暂不可用，请稍后重试。");
                    }

                    // 不把瞬态 Hub 实例传入后台状态机。AI 服务、可信身份和
                    // 强类型 HubContext 都是独立参数，Hub 方法返回后仍可安全推送。
                    _ = RunAiResponseInBackgroundAsync(
                        _microiAI,
                        _backgroundHubContext,
                        msg,
                        trustedAiUser,
                        trustedAiOsClient);
                }
                else
                {
                    // Console.WriteLine($"[WebSocket] 普通消息: {msg.FromUserName} -> {msg.ToUserName}");
                }
            }
            catch (Exception ex)
            {
                WriteWebSocketLog(msg?.OsClient, "ChatMessageFailed", "聊天消息处理失败", ex.ToString(), 2, msg?.FromUserId);
                if (Context?.GetHttpContext() != null)
                {
                    if (ex is HubException) throw;
                    throw new HubException("消息处理失败，请稍后重试。");
                }
            }
        }

        /// <summary>
        /// 获取MongoDB连接配置（带缓存）
        /// </summary>
        private static string GetMongoConnection(string osClient)
        {
            return _mongoConnectionCache.GetOrAdd(osClient, key =>
            {
                var connection = Microi.net.OsClient.GetClient(key).OsClientModel["DbMongoConnection"].Val<string>();
                // Console.WriteLine($"Microi：【ℹ️信息】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】[MongoDB] 缓存连接配置: {key}");
                return connection;
            });
        }

        /// <summary>
        /// 创建MongoDB聊天记录Host
        /// </summary>
        private static MongodbHost GetChatHost(string osClient)
        {
            return new MongodbHost
            {
                Connection = GetMongoConnection(osClient),
                DataBase = $"diy_chat_{osClient.ToLower()}",
                Table = $"chat_{DateTime.Now:yyyy}"
            };
        }

        /// <summary>
        /// 创建MongoDB最近联系人Host
        /// </summary>
        private MongodbHost GetContactHost(string osClient)
        {
            return new MongodbHost
            {
                Connection = GetMongoConnection(osClient),
                DataBase = $"diy_chat_{osClient.ToLower()}",
                Table = "chat_last_contact"
            };
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
            object trustedCurrentUser,
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
                                "AI",
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
                                "AI",
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

        /// <summary>
        /// 处理AI自动回复
        /// </summary>
        private static async Task HandleAIResponse(
            IMicroiAI microiAI,
            IHubContext<DiyWebSocket, IClient> hubContext,
            MessageBodyParam originalMsg,
            object trustedCurrentUser,
            string trustedOsClient)
        {
            try
            {
                var chatHost = GetChatHost(trustedOsClient);
                var aiUser = new
                {
                    Id = "AI",
                    Name = "AI助手",
                    Avatar = ""
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
                            
                            // 发送包含详细数据的消息
                            var dataMessageDto = new MessageBodyDto
                            {
                                FromUserId = aiUser.Id,
                                FromUserName = aiUser.Name,
                                FromUserAvatar = aiUser.Avatar,
                                ToUserId = originalMsg.FromUserId,
                                ToUserName = originalMsg.FromUserName,
                                ToUserAvatar = originalMsg.FromUserAvatar,
                                Content = queryDataJson,
                                CreateTime = DateTime.Now,
                                Type = "data",  // 标记为数据类型消息
                                IsRead = false
                            };
                            
                            await SendMessageToClient(
                                clientInfoTo,
                                dataMessageDto,
                                hubContext);
                            await TMongodbHelper<MessageBodyDto>.InsertAsync(chatHost, dataMessageDto);
                        }
                    }
                    catch (Exception dataEx)
                    {
                        WriteWebSocketLog(trustedOsClient, "AiDetailPushFailed", "AI 查询明细发送失败", dataEx.ToString(), 2, originalMsg.FromUserId);
                    }
                }

                // 保存AI回复到MongoDB
                try
                {
                    var aiReplyMsg = new MessageBody
                    {
                        FromUserId = aiUser.Id,
                        FromUserName = aiUser.Name,
                        FromUserAvatar = aiUser.Avatar,
                        ToUserId = originalMsg.FromUserId,
                        ToUserName = originalMsg.FromUserName,
                        ToUserAvatar = originalMsg.FromUserAvatar,
                        Content = string.IsNullOrWhiteSpace(aiResult.Content)
                            ? fullResponse.ToString()
                            : aiResult.Content,
                        CreateTime = DateTime.Now,
                        Type = "text",
                        IsRead = false
                    };
                    
                    await TMongodbHelper<MessageBody>.InsertAsync(chatHost, aiReplyMsg);
                }
                catch (Exception ex)
                {
                    WriteWebSocketLog(trustedOsClient, "AiChatPersistenceFailed", "AI 聊天记录保存失败", ex.ToString(), 2, originalMsg.FromUserId);
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
            msg.FromUserId = identity.UserId;
            msg.FromUserName = identity.UserName;
            msg.FromUserAvatar = identity.UserAvatar;
            msg.OsClient = identity.OsClient;
            await SendChatRecordToUserCore(msg).ConfigureAwait(false);
        }

        private async Task SendChatRecordToUserCore(MessageBody msg)
        {
            if (IsBlank(msg.FromUserId) || IsBlank(msg.ToUserId) || IsBlank(msg.OsClient))
            {
                var DiyCacheBase = MicroiEngine.CacheTenant.Cache(msg.OsClient);
                ClientInfo clientInfoFrom = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.FromUserId}");
                if (clientInfoFrom != null)
                {
                    try
                    {
                        await base.Clients.Clients(clientInfoFrom.ConnectionIds).ReceiveSendToUser(new MessageBodyDto
                        {
                            Content = DiyMessage.GetLang(msg.OsClient, "ParamError", msg._Lang),
                            FromUserId = "系统消息",
                            FromUserName = "系统管理员",
                            CreateTime = DateTime.Now,
                            Type = "系统消息",
                            IsRead = false
                        });
                    }
                    catch (Exception)
                    {
                    }
                }
                return;
            }
            try
            {
                var hostChat = GetChatHost(msg.OsClient);
                var hostChatLastContact = GetContactHost(msg.OsClient);

                List<FilterDefinition<MessageBody>> list = new List<FilterDefinition<MessageBody>>
                        {
                                (Builders<MessageBody>.Filter.Eq("FromUserId", msg.FromUserId)
                                & Builders<MessageBody>.Filter.Eq("ToUserId", msg.ToUserId))
                            |
                                (Builders<MessageBody>.Filter.Eq("FromUserId", msg.ToUserId)
                                & Builders<MessageBody>.Filter.Eq("ToUserId", msg.FromUserId))
                        };
                FilterDefinition<MessageBody> filter = Builders<MessageBody>.Filter.And(list);
                string[] field = null;
                SortDefinition<MessageBody> sort = Builders<MessageBody>.Sort.Descending("CreateTime");
                List<MessageBody> result2 = await TMongodbHelper<MessageBody>.FindListByPageAsync(hostChat, filter, msg._PageIndex ?? 1, msg._PageSize ?? 20, field, sort);

                var DiyCacheBase = MicroiEngine.CacheTenant.Cache(msg.OsClient);

                ClientInfo clientInfoFrom2 = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.FromUserId}");
                if (clientInfoFrom2 == null)
                {
                    WriteWebSocketLog(msg.OsClient, "ChatRecipientOffline", "聊天记录接收用户不在线", "本次实时推送已跳过。", 1, msg.FromUserId);
                    return;
                }
                result2 = result2.OrderBy((MessageBody d) => d.CreateTime).ToList();
                // 转换为DTO避免ObjectId序列化问题
                var result2Dto = result2.Select(m => new MessageBodyDto
                {
                    FromUserId = m.FromUserId,
                    FromUserName = m.FromUserName,
                    FromUserAvatar = m.FromUserAvatar,
                    ToUserId = m.ToUserId,
                    ToUserName = m.ToUserName,
                    ToUserAvatar = m.ToUserAvatar,
                    Content = m.Content,
                    CreateTime = m.CreateTime,
                    Type = m.Type,
                    IsRead = m.IsRead
                }).ToList();
                await base.Clients.Clients(clientInfoFrom2.ConnectionIds).ReceiveSendChatRecordToUser(result2Dto);
                await TMongodbHelper<MessageBody>.UpdateManayAsync(hostChat, new Dictionary<string, object> { { "IsRead", true } }, Builders<MessageBody>.Filter.And(Builders<MessageBody>.Filter.Eq("FromUserId", msg.ToUserId) & Builders<MessageBody>.Filter.Eq("ToUserId", msg.FromUserId)));
                await SendLastContactsCore(new MessageChatContactListParam
                {
                    OsClient = msg.OsClient,
                    UserId = msg.FromUserId,
                    ContactUserId = msg.ToUserId,
                    _IsUpdateTime = false
                });
                await SendUnreadCountToUserCore(new MessageBodyParam
                {
                    ToUserId = msg.FromUserId,
                    OsClient = msg.OsClient
                });
            }
            catch (Exception ex)
            {
                WriteWebSocketLog(msg.OsClient, "ChatHistoryFailed", "读取聊天记录失败", ex.ToString(), 2, msg.FromUserId);
                throw new HubException("读取聊天记录失败，请稍后重试。");
            }
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        public async Task SendUnreadCountToUser(MessageBodyParam msg)
        {
            var identity = await RequireIdentityAsync().ConfigureAwait(false);
            msg ??= new MessageBodyParam();
            msg.FromUserId = identity.UserId;
            msg.ToUserId = identity.UserId;
            msg.OsClient = identity.OsClient;
            await SendUnreadCountToUserCore(msg).ConfigureAwait(false);
        }

        private async Task SendUnreadCountToUserCore(MessageBodyParam msg)
        {
            if (IsBlank(msg.ToUserId) || IsBlank(msg.OsClient))
            {
                var DiyCacheBase = MicroiEngine.CacheTenant.Cache(msg.OsClient);
                ClientInfo clientInfoFrom = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.FromUserId}");
                if (clientInfoFrom != null)
                {
                    try
                    {
                        var msg2 = new MessageBodyDto
                        {
                            Content = DiyMessage.GetLang(msg.OsClient, "ParamError", msg._Lang),
                            FromUserId = "系统消息",
                            FromUserName = "系统管理员",
                            CreateTime = DateTime.Now,
                            Type = "系统消息",
                            IsRead = false
                        };
                        if (msg._iHubContext != null)
                        {
                            msg._iHubContext.Clients.Clients(clientInfoFrom.ConnectionIds).SendAsync("ReceiveSendToUser", msg2);
                        }
                        else
                        {
                            await base.Clients.Clients(clientInfoFrom.ConnectionIds).ReceiveSendToUser(msg2);
                        }
                    }
                    catch (Exception)
                    {
                    }
                }
                return;
            }
            try
            {
                var hostChat = GetChatHost(msg.OsClient);
                List<FilterDefinition<MessageBody>> list = new List<FilterDefinition<MessageBody>> { Builders<MessageBody>.Filter.Eq("ToUserId", msg.ToUserId) & Builders<MessageBody>.Filter.Eq("IsRead", false) };//value: 
                FilterDefinition<MessageBody> filter = Builders<MessageBody>.Filter.And(list);
                long result = await TMongodbHelper<MessageBody>.CountAsync(hostChat, filter);

                //List<FilterDefinition<MessageBody>> list2 = new List<FilterDefinition<MessageBody>> { Builders<MessageBody>.Filter.Eq("ToUserId", msg.ToUserId)};
                //FilterDefinition<MessageBody> filter2 = Builders<MessageBody>.Filter.And(list2);
                //var result2 = await TMongodbHelper<MessageBody>.FindListAsync(hostChat, filter2);

                var DiyCacheBase = MicroiEngine.CacheTenant.Cache(msg.OsClient);

                ClientInfo clientInfoTo = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.ToUserId}");
                if (clientInfoTo != null)
                {
                    if (msg._iHubContext != null)
                    {
                        msg._iHubContext.Clients.Clients(clientInfoTo.ConnectionIds).SendAsync("ReceiveSendUnreadCountToUser", result);
                    }
                    else
                    {
                        await base.Clients.Clients(clientInfoTo.ConnectionIds).ReceiveSendUnreadCountToUser(result);
                    }
                }
            }
            catch (Exception ex)
            {
                WriteWebSocketLog(msg.OsClient, "UnreadCountFailed", "读取聊天未读数失败", ex.ToString(), 2, msg.ToUserId);
                throw new HubException("读取聊天未读数失败，请稍后重试。");
            }
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
            msg.FromUserId = identity.UserId;
            msg.FromUserName = identity.UserName;
            msg.FromUserAvatar = identity.UserAvatar;
            msg.OsClient = identity.OsClient;
            var DiyCacheBase = MicroiEngine.CacheTenant.Cache(msg.OsClient);
            ClientInfo clientInfoFrom = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.FromUserId}");
            if (IsBlank(msg.FromUserId) || IsBlank(msg.ToUserId) || IsBlank(msg.OsClient))
            {
                if (clientInfoFrom != null)
                {
                    try
                    {
                        await base.Clients.Clients(clientInfoFrom.ConnectionIds).ReceiveSendToUser(new MessageBodyDto
                        {
                            Content = DiyMessage.GetLang(msg.OsClient, "ParamError", msg._Lang),
                            FromUserId = "系统消息",
                            FromUserName = "系统管理员",
                            CreateTime = DateTime.Now,
                            Type = "系统消息",
                            IsRead = false
                        });
                    }
                    catch (Exception)
                    {
                    }
                }
            }
            else
            {
                await SendLastContactsCore(new MessageChatContactListParam
                {
                    UserId = msg.FromUserId,
                    UserName = msg.FromUserName,
                    UserAvatar = msg.FromUserAvatar,
                    ContactUserId = msg.ToUserId,
                    ContactUserName = msg.ToUserName,
                    ContactUserAvatar = msg.ToUserAvatar,
                    OtherInfo = msg.OtherInfo,
                    OsClient = msg.OsClient,
                    _IsUpdateTime = false
                });
            }
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
            msg.UserId = identity.UserId;
            msg.UserName = identity.UserName;
            msg.UserAvatar = identity.UserAvatar;
            msg.OsClient = identity.OsClient;
            msg.ContactUserId = "";
            msg.LastMessage = "";
            msg.LastMessageType = "";
            msg._IsUpdateTime = false;
            await SendLastContactsCore(msg).ConfigureAwait(false);
        }

        private async Task SendLastContactsCore(MessageChatContactListParam msg)
        {
            var DiyCacheBase = MicroiEngine.CacheTenant.Cache(msg.OsClient);
            ClientInfo clientInfo = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.UserId}");
            if (clientInfo == null)
            {
                return;
            }
            if (IsBlank(msg.UserId) || IsBlank(msg.OsClient))
            {
                if (clientInfo != null)
                {
                    try
                    {
                        List<string> connectIds = clientInfo.ConnectionIds;
                        var msg2 = new MessageBodyDto
                        {
                            Content = DiyMessage.GetLang(msg.OsClient, "ParamError", msg._Lang),
                            FromUserId = "系统消息",
                            FromUserName = "系统管理员",
                            CreateTime = DateTime.Now,
                            Type = "系统消息",
                            IsRead = false
                        };
                        if (msg._iHubContext != null)
                        {
                            msg._iHubContext.Clients.Clients(connectIds).SendAsync("ReceiveSendToUser", msg2);
                        }
                        else
                        {
                            await base.Clients.Clients(connectIds).ReceiveSendToUser(msg2);
                        }
                    }
                    catch (Exception)
                    {
                    }
                }
                return;
            }
            try
            {
                var hostChatLastContact = GetContactHost(msg.OsClient);
                var hostChat = GetChatHost(msg.OsClient);
                string[] field = null;
                SortDefinition<MessageChatContactList> sort = Builders<MessageChatContactList>.Sort.Descending("UpdateTime");
                List<FilterDefinition<MessageChatContactList>> list2 = new List<FilterDefinition<MessageChatContactList>>();
                if (IsNotBlank(msg.ContactUserId))
                {
                    var contactUserClientInfo = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.ContactUserId}");

                    list2.Add(Builders<MessageChatContactList>.Filter.Eq("UserId", msg.UserId));
                    list2.Add(Builders<MessageChatContactList>.Filter.Eq("ContactUserId", msg.ContactUserId));
                    List<MessageChatContactList> contactList = (await TMongodbHelper<MessageChatContactList>.FindListAsync(hostChatLastContact, Builders<MessageChatContactList>.Filter.And(list2), field, sort)).Data;
                    //如果已经存在这个联系人了
                    if (contactList.Any())
                    {
                        if (contactList.Count > 1)
                        {
                            int tIndex = 0;
                            foreach (MessageChatContactList item in contactList)
                            {
                                if (tIndex != 0)
                                {
                                    await TMongodbHelper<MessageChatContactList>.DeleteAsync(hostChatLastContact, item._id.ToString());
                                }
                                tIndex++;
                            }
                        }
                        MessageChatContactList tModel = contactList.First();
                        if (msg._IsUpdateTime)
                            tModel.UpdateTime = DateTime.Now;
                        if (IsNotBlank(msg.LastMessage))
                            tModel.LastMessage = msg.LastMessage;
                        if (IsNotBlank(msg.LastMessageType))
                            tModel.LastMessageType = msg.LastMessageType;
                        if (IsNotBlank(msg.UserName))
                            tModel.UserName = msg.UserName;
                        if (IsNotBlank(msg.UserAvatar))
                            tModel.UserAvatar = msg.UserAvatar;
                        if (IsNotBlank(msg.ContactUserName))
                            tModel.ContactUserName = msg.ContactUserName;
                        if (IsNotBlank(msg.ContactUserAvatar))
                            tModel.ContactUserAvatar = msg.ContactUserAvatar;

                        if (contactUserClientInfo != null)
                        {
                            if (IsNotBlank(contactUserClientInfo.DeviceClientId))
                            {
                                tModel.ContactUserDeviceClientId = contactUserClientInfo.DeviceClientId;
                            }
                            if (IsNotBlank(contactUserClientInfo.OtherInfo))
                            {
                                tModel.OtherInfo = contactUserClientInfo.OtherInfo;
                            }
                        }

                        if (IsNotBlank(msg.OtherInfo))
                            tModel.OtherInfo = msg.OtherInfo;

                        MessageChatContactList messageChatContactList = tModel;
                        messageChatContactList.UnRead = (int)(await TMongodbHelper<MessageBody>.CountAsync(hostChat, Builders<MessageBody>.Filter.And(Builders<MessageBody>.Filter.Eq("FromUserId", msg.ContactUserId), Builders<MessageBody>.Filter.Eq("ToUserId", msg.UserId), Builders<MessageBody>.Filter.Eq("IsRead", value: false))));
                        await TMongodbHelper<MessageChatContactList>.UpdateAsync(hostChatLastContact, tModel, tModel._id.ToString());
                    }
                    else
                    {
                        if (contactUserClientInfo != null)
                        {
                            if (IsNotBlank(contactUserClientInfo.DeviceClientId))
                            {
                                msg.ContactUserDeviceClientId = contactUserClientInfo.DeviceClientId;
                            }
                            if (IsBlank(msg.OtherInfo) && IsNotBlank(contactUserClientInfo.OtherInfo))
                            {
                                msg.OtherInfo = contactUserClientInfo.OtherInfo;
                            }
                        }
                        msg.UpdateTime = DateTime.Now;
                        msg.UnRead = (int)(await TMongodbHelper<MessageBody>.CountAsync(hostChat, Builders<MessageBody>.Filter.And(Builders<MessageBody>.Filter.Eq("FromUserId", msg.ContactUserId), Builders<MessageBody>.Filter.Eq("ToUserId", msg.UserId), Builders<MessageBody>.Filter.Eq("IsRead", value: false))));
                        await TMongodbHelper<MessageChatContactList>.InsertAsync(hostChatLastContact, msg);
                    }
                }
                list2 = new List<FilterDefinition<MessageChatContactList>> { Builders<MessageChatContactList>.Filter.Eq("UserId", msg.UserId) };
                FilterDefinition<MessageChatContactList> filter = Builders<MessageChatContactList>.Filter.And(list2);
                List<MessageChatContactList> lastChatList = await TMongodbHelper<MessageChatContactList>.FindListByPageAsync(hostChatLastContact, filter, msg._PageIndex ?? 1, msg._PageSize ?? 20, field, sort);
                if (lastChatList == null)
                {
                    lastChatList = new List<MessageChatContactList>();
                }
                
                // 转换为DTO避免ObjectId序列化问题
                var lastChatListDto = lastChatList.Select(c => new MessageChatContactListDto
                {
                    UserId = c.UserId,
                    UserName = c.UserName,
                    UserAvatar = c.UserAvatar,
                    ContactUserId = c.ContactUserId,
                    ContactUserName = c.ContactUserName,
                    ContactUserAvatar = c.ContactUserAvatar,
                    ContactUserDeviceClientId = c.ContactUserDeviceClientId,
                    LastMessage = c.LastMessage,
                    LastMessageType = c.LastMessageType,
                    OtherInfo = c.OtherInfo,
                    UnRead = c.UnRead,
                    UpdateTime = c.UpdateTime
                }).ToList();
                
                if (msg._iHubContext != null)
                {
                    msg._iHubContext.Clients.Clients(clientInfo.ConnectionIds).SendAsync("ReceiveSendLastContacts", lastChatListDto);
                }
                else
                {
                    await base.Clients.Clients(clientInfo.ConnectionIds).ReceiveSendLastContacts(lastChatListDto);
                }
            }
            catch (Exception ex)
            {


                try
                {
                    var msg2 = new MessageBodyDto
                    {
                        Content = ex.Message,
                        FromUserId = "系统消息",
                        FromUserName = "系统管理员",
                        CreateTime = DateTime.Now,
                        Type = "系统消息",
                        IsRead = false
                    };
                    if (msg._iHubContext != null)
                    {
                        msg._iHubContext.Clients.Clients(clientInfo.ConnectionIds).SendAsync("ReceiveSendToUser", msg2);
                    }
                    else
                    {
                        await base.Clients.Clients(clientInfo.ConnectionIds).ReceiveSendToUser(msg2);
                    }
                }
                catch (Exception)
                {
                }
            }
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
            msg.UserId = identity.UserId;
            msg.UserName = identity.UserName;
            msg.UserAvatar = identity.UserAvatar;
            msg.OsClient = identity.OsClient;
            if (IsBlank(msg.UserId) || IsBlank(msg.OsClient) || IsBlank(msg.ContactUserId))
            {
                var DiyCacheBase = MicroiEngine.CacheTenant.Cache(msg.OsClient);
                ClientInfo clientInfo2 = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.UserId}");
                if (clientInfo2 != null)
                {
                    try
                    {
                        await base.Clients.Clients(clientInfo2.ConnectionIds).ReceiveSendToUser(new MessageBodyDto
                        {
                            Content = DiyMessage.GetLang(msg.OsClient, "ParamError", msg._Lang),
                            FromUserId = "系统消息",
                            FromUserName = "系统管理员",
                            CreateTime = DateTime.Now,
                            Type = "系统消息",
                            IsRead = false
                        });
                    }
                    catch (Exception)
                    {
                    }
                }
                return;
            }
            try
            {
                var hostChatLastContact = GetContactHost(msg.OsClient);
                string[] field = null;
                SortDefinition<MessageChatContactList> sort = Builders<MessageChatContactList>.Sort.Descending("UpdateTime");
                List<FilterDefinition<MessageChatContactList>> list = new List<FilterDefinition<MessageChatContactList>>
                {
                    Builders<MessageChatContactList>.Filter.Eq("UserId", msg.UserId),
                    Builders<MessageChatContactList>.Filter.Eq("ContactUserId", msg.ContactUserId)
                };
                List<MessageChatContactList> contactList = (await TMongodbHelper<MessageChatContactList>.FindListAsync(hostChatLastContact, Builders<MessageChatContactList>.Filter.And(list), field, sort)).Data;
                if (!contactList.Any())
                {
                    return;
                }
                if (contactList.Count > 1)
                {
                    int tIndex = 0;
                    foreach (MessageChatContactList item in contactList)
                    {
                        if (tIndex != 0)
                        {
                            await TMongodbHelper<MessageChatContactList>.DeleteAsync(hostChatLastContact, item._id.ToString());
                        }
                        tIndex++;
                    }
                }
                MessageChatContactList tModel = contactList.First();
                await TMongodbHelper<MessageChatContactList>.DeleteAsync(hostChatLastContact, tModel._id.ToString());
            }
            catch (Exception ex)
            {


                var DiyCacheBase = MicroiEngine.CacheTenant.Cache(msg.OsClient);
                ClientInfo clientInfo = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.UserId}");
                if (clientInfo != null)
                {
                    try
                    {
                        await base.Clients.Clients(clientInfo.ConnectionIds).ReceiveSendToUser(new MessageBodyDto
                        {
                            Content = ex.Message,
                            FromUserId = "系统消息",
                            FromUserName = "系统管理员",
                            CreateTime = DateTime.Now,
                            Type = "系统消息",
                            IsRead = false
                        });
                    }
                    catch (Exception)
                    {
                    }
                }
            }
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <param name="users"></param>
        /// <returns></returns>
        public async Task SendToUsers(UserMessageContent msg, params string[] users)
        {
            await base.Clients.Users(users.ToList().AsReadOnly()).ReceiveSendToUsers(msg);
        }
    }
}

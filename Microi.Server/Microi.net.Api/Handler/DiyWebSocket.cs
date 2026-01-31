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
        private readonly IMicroiAI _microiAI;
        
        // MongoDB连接配置缓存，避免频繁调用OsClient.GetClient
        private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, string> _mongoConnectionCache = new();

        public DiyWebSocket(IMicroiAI microiAI)
        {
            _microiAI = microiAI;
        }

        //private static IDictionary<string, ClientInfo> _clients;

        //static DiyWebSocket()
        //{
        //    _clients = new Dictionary<string, ClientInfo>();
        //}

        public override async Task OnConnectedAsync()
        {
            string connid = base.Context.ConnectionId;
            var currentToken = await DiyToken.GetCurrentToken();
            var sysUser = currentToken?.CurrentUser;
            var osClient = currentToken?.OsClient;
            var userId = sysUser?["Id"].Val<string>();
            var diyCacheBase = MicroiEngine.CacheTenant.Cache(osClient);
            var userName = sysUser?["Name"].Val<string>().DosIsNullOrWhiteSpace() == null ? sysUser?["Account"].Val<string>() : sysUser?["Name"].Val<string>();
            var userAvatar = sysUser?["Avatar"].Val<string>();
            
            // SignalR 特殊处理：如果 GetCurrentToken 返回空用户，尝试从 Context.User 获取
            if(currentToken.CurrentUser == null && Context.User?.Identity?.IsAuthenticated == true)
            {
                userId = Context.User.Claims.FirstOrDefault(c => c.Type == "UserId")?.Value;
                osClient = Context.User.Claims.FirstOrDefault(c => c.Type == "OsClient")?.Value;
                
                Console.WriteLine($"[WebSocket] 从 Claims 获取用户信息 - UserId: {userId}, OsClient: {osClient}");
                
                if (!string.IsNullOrEmpty(userId) && !string.IsNullOrEmpty(osClient))
                {
                    // 尝试重新从缓存获取完整用户信息
                    diyCacheBase = MicroiEngine.CacheTenant.Cache(osClient);
                    currentToken = await diyCacheBase.GetAsync<CurrentToken>($"Microi:{osClient}:LoginTokenSysUser:{userId}");
                    
                    if (currentToken != null && currentToken.CurrentUser != null)
                    {
                        currentToken.OsClient = osClient;
                        Console.WriteLine($"[WebSocket] 从缓存重新获取用户信息成功");
                    }
                    else
                    {
                        Console.WriteLine($"[WebSocket] 缓存中未找到用户信息: Microi:{osClient}:LoginTokenSysUser:{userId}");
                    }
                }
            }
            
            if(currentToken?.CurrentUser == null)
            {
                Console.WriteLine($"[WebSocket] 身份验证失败 - IsAuthenticated: {Context.User?.Identity?.IsAuthenticated}, Claims Count: {Context.User?.Claims?.Count() ?? 0}");
                throw new HubException("身份验证失败：未提供有效的访问令牌。请在连接时传入 token（查询参数: ?access_token=xxx 或请求头: Authorization: Bearer xxx）");
            }
            HttpContext httpContext = base.Context.GetHttpContext();
            httpContext.Request.Query.TryGetValue("groupName", out var groupName);
            // httpContext.Request.Query.TryGetValue("UserId", out var userId);
            // httpContext.Request.Query.TryGetValue("UserName", out var userName);
            // httpContext.Request.Query.TryGetValue("UserAvatar", out var userAvatar);
            httpContext.Request.Query.TryGetValue("OtherInfo", out var otherInfo);
            // httpContext.Request.Query.TryGetValue("IP", out var ip);
            // httpContext.Request.Query.TryGetValue("OsClient", out var OsClient);
            httpContext.Request.Query.TryGetValue("DeviceClientId", out var deviceClientId);

            if (!userId.Equals(StringValues.Empty))
            {
                ClientInfo clientInfo = await diyCacheBase.GetAsync<ClientInfo>($"Microi:{osClient}:ChatOnline:{userId}");
                if (clientInfo != null)
                {
                    clientInfo.LastConnectionId = connid;
                    clientInfo.ConnectionIds.Remove(connid);
                    clientInfo.ConnectionIds.Insert(0, connid);
                    clientInfo.ConnectionIds = clientInfo.ConnectionIds.Take(10).ToList();
                    if (!deviceClientId.ToString().DosIsNullOrWhiteSpace())
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
                try
                {
                    await SendLastContacts(new MessageChatContactListParam
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
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="exception"></param>
        /// <returns></returns>
        public override async Task OnDisconnectedAsync(Exception exception)
        {
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
            msg.CreateTime = DateTime.Now;
            var DiyCacheBase = MicroiEngine.CacheTenant.Cache(msg.OsClient);

            if (msg.FromUserId.DosIsNullOrWhiteSpace() || msg.ToUserId.DosIsNullOrWhiteSpace() || msg.Content.DosIsNullOrWhiteSpace() || msg.OsClient.DosIsNullOrWhiteSpace())
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
                await SendLastContacts(new MessageChatContactListParam
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
                await SendLastContacts(new MessageChatContactListParam
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
                await SendUnreadCountToUser(new MessageBodyParam
                {
                    ToUserId = msg.ToUserId,
                    OsClient = msg.OsClient,
                    _iHubContext = msg._iHubContext
                });

                // 如果接收者是AI用户，自动触发AI回复
                if (msg.ToUserId == "AI")
                {
                    Console.WriteLine($"[WebSocket] 检测到发送给AI的消息: {msg.Content}");
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            Console.WriteLine($"[WebSocket] 开始处理AI回复...");
                            await HandleAIResponse(msg);
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"AI自动回复失败: {ex.Message}");
                            Console.WriteLine($"堆栈跟踪: {ex.StackTrace}");
                        }
                    });
                }
                else
                {
                    // Console.WriteLine($"[WebSocket] 普通消息: {msg.FromUserName} -> {msg.ToUserName}");
                }
            }
            catch (Exception)
            {
            }
        }

        /// <summary>
        /// 获取MongoDB连接配置（带缓存）
        /// </summary>
        private string GetMongoConnection(string osClient)
        {
            return _mongoConnectionCache.GetOrAdd(osClient, key =>
            {
                var connection = Microi.net.OsClient.GetClient(key).OsClientModel["DbMongoConnection"].Val<string>();
                Console.WriteLine($"[MongoDB] 缓存连接配置: {key}");
                return connection;
            });
        }

        /// <summary>
        /// 创建MongoDB聊天记录Host
        /// </summary>
        private MongodbHost GetChatHost(string osClient)
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
        private async Task<ClientInfo> GetOnlineUserInfo(string osClient, string userId)
        {
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            return await cache.GetAsync<ClientInfo>($"Microi:{osClient}:ChatOnline:{userId}");
        }

        /// <summary>
        /// 发送消息到前端（支持Hub和IHubContext两种方式）
        /// </summary>
        private async Task SendMessageToClient(ClientInfo clientInfo, MessageBodyDto message, IHubContext<DiyWebSocket> hubContext = null)
        {
            if (clientInfo == null || clientInfo.ConnectionIds == null || !clientInfo.ConnectionIds.Any())
            {
                return;
            }

            try
            {
                if (hubContext != null)
                {
                    var typedClients = (IHubClients<IClient>)hubContext.Clients;
                    await typedClients.Clients(clientInfo.ConnectionIds).ReceiveSendToUser(message);
                }
                else
                {
                    await base.Clients.Clients(clientInfo.ConnectionIds).ReceiveSendToUser(message);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[WebSocket] 发送消息失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 处理AI自动回复
        /// </summary>
        private async Task HandleAIResponse(MessageBodyParam originalMsg)
        {
            Console.WriteLine($"========== AI自动回复开始 ==========");
            Console.WriteLine($"[AI] 用户: {originalMsg.FromUserName} (ID: {originalMsg.FromUserId})");
            Console.WriteLine($"[AI] 问题: {originalMsg.Content}");
            Console.WriteLine($"[AI] 时间: {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
            
            try
            {
                var chatHost = GetChatHost(originalMsg.OsClient);
                var aiUser = new
                {
                    Id = "AI",
                    Name = "AI助手",
                    Avatar = ""
                };

                // 获取AI配置
                Console.WriteLine($"[AI] 正在获取AI模型配置...");
                var aiModelConfig = await MicroiEngine.FormEngine.GetFormDataAsync("mic_ai", new
                {
                    _Where = new List<List<object>>()
                    {
                        new List<object> { "IsEnable", "=", "1" },
                    },
                    _OrderBy = "CreateTime DESC",
                    OsClient = originalMsg.OsClient
                });

                string aiModel = "deepseek-r1:1.5b";
                if (aiModelConfig.Code == 1 && aiModelConfig.Data != null)
                {
                    aiModel = aiModelConfig.Data.AiModel ?? aiModel;
                }
                Console.WriteLine($"[AI] 使用模型: {aiModel}");

                // 获取用户连接信息
                var clientInfoTo = await GetOnlineUserInfo(originalMsg.OsClient, originalMsg.FromUserId);
                
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
                            await base.Clients.Clients(clientInfoTo.ConnectionIds).ReceiveAIChunk(
                                chunk, 
                                aiUser.Id, 
                                originalMsg.FromUserId, 
                                false  // 还未完成
                            );
                            
                            if (isFirstChunk)
                            {
                                Console.WriteLine($"[AI流式] ✅ 开始发送流式数据...");
                                isFirstChunk = false;
                            }
                        }
                        fullResponse.Append(chunk);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine($"[AI流式] ❌ 发送数据块失败: {ex.Message}");
                    }
                };
                
                // 调用AI统一入口（包含意图识别）
                var aiResult = await _microiAI.HandleChatMessage(new ChatMessageParam
                {
                    Question = originalMsg.Content,
                    AiModel = aiModel,
                    AllowedTables = null,
                    OsClient = originalMsg.OsClient
                }, streamCallback);

                // 发送完成信号
                if (clientInfoTo != null)
                {
                    await base.Clients.Clients(clientInfoTo.ConnectionIds).ReceiveAIChunk(
                        "", 
                        aiUser.Id, 
                        originalMsg.FromUserId, 
                        true  // 已完成
                    );
                    Console.WriteLine($"[AI流式] ✅ 流式输出完成");
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
                            
                            await SendMessageToClient(clientInfoTo, dataMessageDto, originalMsg._iHubContext);
                            await TMongodbHelper<MessageBodyDto>.InsertAsync(chatHost, dataMessageDto);
                            Console.WriteLine($"[AI] ✅ 详细数据已发送到前端（{queryResultArray.Length}条记录）");
                        }
                    }
                    catch (Exception dataEx)
                    {
                        Console.WriteLine($"[AI] ⚠️ 发送详细数据失败: {dataEx.Message}");
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
                        Content = aiResult.Content,
                        CreateTime = DateTime.Now,
                        Type = "text",
                        IsRead = false
                    };
                    
                    await TMongodbHelper<MessageBody>.InsertAsync(chatHost, aiReplyMsg);
                    Console.WriteLine($"[AI] 数据库: {chatHost.DataBase}, 表: {chatHost.Table}");
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"[AI] ⚠️ 保存聊天记录失败: {ex.Message}");
                }

                Console.WriteLine($"========== AI自动回复完成 ==========");
                Console.WriteLine($"[AI] 📊 回复统计:");
                Console.WriteLine($"[AI]   - 模式: {aiResult.ResponseType}");
                Console.WriteLine($"[AI]   - 用户: {originalMsg.FromUserName}");
                Console.WriteLine($"[AI]   - 回复长度: {aiResult.Content?.Length ?? 0}字符");
                Console.WriteLine($"");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"========== AI自动回复异常 ==========");
                Console.WriteLine($"[AI] ❌ 异常类型: {ex.GetType().Name}");
                Console.WriteLine($"[AI] ❌ 异常消息: {ex.Message}");
                Console.WriteLine($"[AI] ❌ 堆栈跟踪:");
                Console.WriteLine(ex.StackTrace);
                Console.WriteLine($"========================================");
            }
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        public async Task SendChatRecordToUser(MessageBody msg)
        {
            if (msg.FromUserId.DosIsNullOrWhiteSpace() || msg.ToUserId.DosIsNullOrWhiteSpace() || msg.OsClient.DosIsNullOrWhiteSpace())
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
                await SendLastContacts(new MessageChatContactListParam
                {
                    OsClient = msg.OsClient,
                    UserId = msg.FromUserId,
                    ContactUserId = msg.ToUserId,
                    _IsUpdateTime = false
                });
                await SendUnreadCountToUser(new MessageBodyParam
                {
                    ToUserId = msg.FromUserId,
                    OsClient = msg.OsClient
                });
            }
            catch (Exception ex)
            {


                await SendToUser(new MessageBodyParam
                {
                    Content = ex.Message,
                    FromUserId = "446c7239-e0d0-412d-b84c-a9c2f82af44c",
                    ToUserId = msg.FromUserId,
                    OsClient = msg.OsClient,
                    Type = "系统消息",
                    CreateTime = DateTime.Now
                });
            }
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        public async Task SendUnreadCountToUser(MessageBodyParam msg)
        {
            if (msg.ToUserId.DosIsNullOrWhiteSpace() || msg.OsClient.DosIsNullOrWhiteSpace())
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

                ClientInfo clientInfoTo = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}ChatOnline:{msg.ToUserId}");
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


                await SendToUser(new MessageBodyParam
                {
                    Content = ex.Message,
                    FromUserId = "446c7239-e0d0-412d-b84c-a9c2f82af44c",
                    ToUserId = msg.FromUserId,
                    OsClient = msg.OsClient,
                    Type = "系统消息",
                    CreateTime = DateTime.Now,
                    _iHubContext = msg._iHubContext
                });
            }
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        public async Task SendConnectToUser(MessageBody msg)
        {
            var DiyCacheBase = MicroiEngine.CacheTenant.Cache(msg.OsClient);
            ClientInfo clientInfoFrom = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.FromUserId}");
            if (msg.FromUserId.DosIsNullOrWhiteSpace() || msg.ToUserId.DosIsNullOrWhiteSpace() || msg.OsClient.DosIsNullOrWhiteSpace())
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
                await SendLastContacts(new MessageChatContactListParam
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
            var DiyCacheBase = MicroiEngine.CacheTenant.Cache(msg.OsClient);
            ClientInfo clientInfo = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.UserId}");
            if (clientInfo == null)
            {
                return;
            }
            if (msg.UserId.DosIsNullOrWhiteSpace() || msg.OsClient.DosIsNullOrWhiteSpace())
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
                if (!msg.ContactUserId.DosIsNullOrWhiteSpace())
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
                        if (!msg.LastMessage.DosIsNullOrWhiteSpace())
                            tModel.LastMessage = msg.LastMessage;
                        if (!msg.LastMessageType.DosIsNullOrWhiteSpace())
                            tModel.LastMessageType = msg.LastMessageType;
                        if (!msg.UserName.DosIsNullOrWhiteSpace())
                            tModel.UserName = msg.UserName;
                        if (!msg.UserAvatar.DosIsNullOrWhiteSpace())
                            tModel.UserAvatar = msg.UserAvatar;
                        if (!msg.ContactUserName.DosIsNullOrWhiteSpace())
                            tModel.ContactUserName = msg.ContactUserName;
                        if (!msg.ContactUserAvatar.DosIsNullOrWhiteSpace())
                            tModel.ContactUserAvatar = msg.ContactUserAvatar;

                        if (contactUserClientInfo != null)
                        {
                            if (!contactUserClientInfo.DeviceClientId.DosIsNullOrWhiteSpace())
                            {
                                tModel.ContactUserDeviceClientId = contactUserClientInfo.DeviceClientId;
                            }
                            if (!contactUserClientInfo.OtherInfo.DosIsNullOrWhiteSpace())
                            {
                                tModel.OtherInfo = contactUserClientInfo.OtherInfo;
                            }
                        }

                        if (!msg.OtherInfo.DosIsNullOrWhiteSpace())
                            tModel.OtherInfo = msg.OtherInfo;

                        MessageChatContactList messageChatContactList = tModel;
                        messageChatContactList.UnRead = (int)(await TMongodbHelper<MessageBody>.CountAsync(hostChat, Builders<MessageBody>.Filter.And(Builders<MessageBody>.Filter.Eq("FromUserId", msg.ContactUserId), Builders<MessageBody>.Filter.Eq("ToUserId", msg.UserId), Builders<MessageBody>.Filter.Eq("IsRead", value: false))));
                        await TMongodbHelper<MessageChatContactList>.UpdateAsync(hostChatLastContact, tModel, tModel._id.ToString());
                    }
                    else
                    {
                        if (contactUserClientInfo != null)
                        {
                            if (!contactUserClientInfo.DeviceClientId.DosIsNullOrWhiteSpace())
                            {
                                msg.ContactUserDeviceClientId = contactUserClientInfo.DeviceClientId;
                            }
                            if (msg.OtherInfo.DosIsNullOrWhiteSpace() && !contactUserClientInfo.OtherInfo.DosIsNullOrWhiteSpace())
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
            if (msg.UserId.DosIsNullOrWhiteSpace() || msg.OsClient.DosIsNullOrWhiteSpace() || msg.ContactUserId.DosIsNullOrWhiteSpace())
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
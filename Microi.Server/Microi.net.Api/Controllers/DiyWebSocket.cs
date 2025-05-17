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
        //private static IDictionary<string, ClientInfo> _clients;

        //static DiyWebSocket()
        //{
        //    _clients = new Dictionary<string, ClientInfo>();
        //}

        public override async Task OnConnectedAsync()
        {
            string connid = base.Context.ConnectionId;
            HttpContext httpContext = base.Context.GetHttpContext();
            httpContext.Request.Query.TryGetValue("groupName", out var groupName);
            httpContext.Request.Query.TryGetValue("UserId", out var userId);
            httpContext.Request.Query.TryGetValue("UserName", out var userName);
            httpContext.Request.Query.TryGetValue("UserAvatar", out var userAvatar);
            httpContext.Request.Query.TryGetValue("OtherInfo", out var otherInfo);
            httpContext.Request.Query.TryGetValue("IP", out var ip);
            httpContext.Request.Query.TryGetValue("OsClient", out var OsClient);
            httpContext.Request.Query.TryGetValue("DeviceClientId", out var deviceClientId);
            var DiyCacheBase = new MicroiCacheRedis(OsClient);

            if (!userId.Equals(StringValues.Empty))
            {
                ClientInfo clientInfo = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{OsClient}:ChatOnline:{userId}");
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
                        Ip = ip,
                        ConnectionIds = new List<string> { connid },
                        ConnectedTime = DateTime.Now,
                        DeviceClientId = deviceClientId
                    };
                }
                await DiyCacheBase.SetAsync($"Microi:{OsClient}:ChatOnline:{userId}", clientInfo);
                try
                {
                    await SendLastContacts(new MessageChatContactListParam
                    {
                        UserId = userId,
                        UserName = userName,
                        UserAvatar = userAvatar,
                        OtherInfo = otherInfo,
                        ContactUserId = "",
                        OsClient = OsClient,
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
            var DiyCacheBase = new MicroiCacheRedis(msg.OsClient);

            if (msg.FromUserId.DosIsNullOrWhiteSpace() || msg.ToUserId.DosIsNullOrWhiteSpace() || msg.Content.DosIsNullOrWhiteSpace() || msg.OsClient.DosIsNullOrWhiteSpace())
            {

                ClientInfo clientInfoFrom = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.FromUserId}");
                if (clientInfoFrom != null)
                {
                    try
                    {
                        var msg2 = new MessageBody
                        {
                            Content = DiyMessage.GetLang(msg.OsClient,  "ParamError", msg._Lang),
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
                    var messageValue = msg as MessageBody;
                    if (msg._iHubContext != null)
                    {
                        msg._iHubContext.Clients.Clients(clientInfoTo.ConnectionIds).SendAsync("ReceiveSendToUser", messageValue);
                    }
                    else
                    {
                        await base.Clients.Clients(clientInfoTo.ConnectionIds).ReceiveSendToUser(messageValue);
                    }
                }
                catch (Exception)
                {
                }
            }
            try
            {
                MongodbHost val = new MongodbHost();
                val.Connection = Microi.net.OsClient.GetClient(msg.OsClient).DbMongoConnection;
                val.DataBase = "diy_chat_" + msg.OsClient.ToString().ToLower();
                val.Table = "chat_" + DateTime.Now.ToString("yyyyMM");
                MongodbHost host = val;
                await TMongodbHelper<MessageBody>.InsertAsync(host, msg);

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
            }
            catch (Exception)
            {
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
                var DiyCacheBase = new MicroiCacheRedis(msg.OsClient);
                ClientInfo clientInfoFrom = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.FromUserId}");
                if (clientInfoFrom != null)
                {
                    try
                    {
                        await base.Clients.Clients(clientInfoFrom.ConnectionIds).ReceiveSendToUser(new MessageBody
                        {
                            Content = DiyMessage.GetLang(msg.OsClient,  "ParamError", msg._Lang),
                            FromUserId = "系统消息",
                            FromUserName = "系统管理员",
                            CreateTime = DateTime.Now
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
                MongodbHost val = new MongodbHost();
                val.Connection = Microi.net.OsClient.GetClient(msg.OsClient).DbMongoConnection;
                val.DataBase = "diy_chat_" + msg.OsClient.ToString().ToLower();
                val.Table = "chat_" + DateTime.Now.ToString("yyyyMM");

                MongodbHost hostChat = val;
                MongodbHost val2 = new MongodbHost();
                val2.Connection = Microi.net.OsClient.GetClient(msg.OsClient).DbMongoConnection;
                val2.DataBase = "diy_chat_" + msg.OsClient.ToString().ToLower();
                val2.Table = "chat_last_contact";

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

                var DiyCacheBase = new MicroiCacheRedis(msg.OsClient);

                ClientInfo clientInfoFrom2 = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.FromUserId}");
                result2 = result2.OrderBy((MessageBody d) => d.CreateTime).ToList();
                await base.Clients.Clients(clientInfoFrom2.ConnectionIds).ReceiveSendChatRecordToUser(result2);
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
                var DiyCacheBase = new MicroiCacheRedis(msg.OsClient);
                ClientInfo clientInfoFrom = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.FromUserId}");
                if (clientInfoFrom != null)
                {
                    try
                    {
                        var msg2 = new MessageBody
                        {
                            Content = DiyMessage.GetLang(msg.OsClient,  "ParamError", msg._Lang),
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
            try
            {
                MongodbHost val = new MongodbHost();
                val.Connection = Microi.net.OsClient.GetClient(msg.OsClient).DbMongoConnection;
                val.DataBase = "diy_chat_" + msg.OsClient.ToString().ToLower();
                val.Table = "chat_" + DateTime.Now.ToString("yyyyMM");

                MongodbHost hostChat = val;
                List<FilterDefinition<MessageBody>> list = new List<FilterDefinition<MessageBody>> { Builders<MessageBody>.Filter.Eq("ToUserId", msg.ToUserId) & Builders<MessageBody>.Filter.Eq("IsRead", false) };//value: 
                FilterDefinition<MessageBody> filter = Builders<MessageBody>.Filter.And(list);
                long result = await TMongodbHelper<MessageBody>.CountAsync(hostChat, filter);

                //List<FilterDefinition<MessageBody>> list2 = new List<FilterDefinition<MessageBody>> { Builders<MessageBody>.Filter.Eq("ToUserId", msg.ToUserId)};
                //FilterDefinition<MessageBody> filter2 = Builders<MessageBody>.Filter.And(list2);
                //var result2 = await TMongodbHelper<MessageBody>.FindListAsync(hostChat, filter2);

                var DiyCacheBase = new MicroiCacheRedis(msg.OsClient);

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
            var DiyCacheBase = new MicroiCacheRedis(msg.OsClient);
            ClientInfo clientInfoFrom = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.FromUserId}");
            if (msg.FromUserId.DosIsNullOrWhiteSpace() || msg.ToUserId.DosIsNullOrWhiteSpace() || msg.OsClient.DosIsNullOrWhiteSpace())
            {
                if (clientInfoFrom != null)
                {
                    try
                    {
                        await base.Clients.Clients(clientInfoFrom.ConnectionIds).ReceiveSendToUser(new MessageBody
                        {
                            Content = DiyMessage.GetLang(msg.OsClient,  "ParamError", msg._Lang),
                            FromUserId = "系统消息",
                            FromUserName = "系统管理员",
                            CreateTime = DateTime.Now
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
            var DiyCacheBase = new MicroiCacheRedis(msg.OsClient);
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
                        var msg2 = new MessageBody
                        {
                            Content = DiyMessage.GetLang(msg.OsClient,  "ParamError", msg._Lang),
                            FromUserId = "系统消息",
                            FromUserName = "系统管理员",
                            CreateTime = DateTime.Now
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
                MongodbHost val = new MongodbHost();
                val.Connection = Microi.net.OsClient.GetClient(msg.OsClient).DbMongoConnection;
                val.DataBase = "diy_chat_" + msg.OsClient.ToString().ToLower();
                val.Table = "chat_last_contact";

                MongodbHost hostChatLastContact = val;
                MongodbHost val2 = new MongodbHost();
                val2.Connection = Microi.net.OsClient.GetClient(msg.OsClient).DbMongoConnection;
                val2.DataBase = "diy_chat_" + msg.OsClient.ToString().ToLower();
                val2.Table = "chat_" + DateTime.Now.ToString("yyyyMM");

                MongodbHost hostChat = val2;
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
                        
                        if (contactUserClientInfo != null) {
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
                if (msg._iHubContext != null)
                {
                    msg._iHubContext.Clients.Clients(clientInfo.ConnectionIds).SendAsync("ReceiveSendLastContacts", lastChatList);
                }
                else
                {
                    await base.Clients.Clients(clientInfo.ConnectionIds).ReceiveSendLastContacts(lastChatList);
                }
            }
            catch (Exception ex)
            {
                        
                
                try
                {
                    var msg2 = new MessageBody
                    {
                        Content = ex.Message,
                        FromUserId = "系统消息",
                        FromUserName = "系统管理员",
                        CreateTime = DateTime.Now
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
                var DiyCacheBase = new MicroiCacheRedis(msg.OsClient);
                ClientInfo clientInfo2 = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.UserId}");
                if (clientInfo2 != null)
                {
                    try
                    {
                        await base.Clients.Clients(clientInfo2.ConnectionIds).ReceiveSendToUser(new MessageBody
                        {
                            Content = DiyMessage.GetLang(msg.OsClient,  "ParamError", msg._Lang),
                            FromUserId = "系统消息",
                            FromUserName = "系统管理员",
                            CreateTime = DateTime.Now
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
                MongodbHost val = new MongodbHost();
                val.Connection = Microi.net.OsClient.GetClient(msg.OsClient).DbMongoConnection;
                val.DataBase = "diy_chat_" + msg.OsClient.ToString().ToLower();
                val.Table = "chat_last_contact";

                MongodbHost hostChatLastContact = val;
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
                        
                
                var DiyCacheBase = new MicroiCacheRedis(msg.OsClient);
                ClientInfo clientInfo = await DiyCacheBase.GetAsync<ClientInfo>($"Microi:{msg.OsClient}:ChatOnline:{msg.UserId}");
                if (clientInfo != null)
                {
                    try
                    {
                        await base.Clients.Clients(clientInfo.ConnectionIds).ReceiveSendToUser(new MessageBody
                        {
                            Content = ex.Message,
                            FromUserId = "系统消息",
                            FromUserName = "系统管理员",
                            CreateTime = DateTime.Now
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
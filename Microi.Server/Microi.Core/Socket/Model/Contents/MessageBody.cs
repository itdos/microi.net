using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// SignalR消息DTO - 纯POCO，避免ObjectId序列化问题
    /// </summary>
    public class MessageBodyDto
    {
        public string MessageId { get; set; }
        public string RequestId { get; set; }
        public string FromUserId { get; set; }
        public string FromUserName { get; set; }
        public string FromUserAccount { get; set; }
        public string FromUserAvatar { get; set; }
        public string ToUserId { get; set; }
        public string ToUserName { get; set; }
        public string ToUserAccount { get; set; }
        public string ToUserAvatar { get; set; }
        public string Content { get; set; }
        public string OtherInfo { get; set; }
        public DateTime CreateTime { get; set; }
        public string Type { get; set; }
        public bool IsRead { get; set; }
    }

    /// <summary>
    /// 聊天内唯一的内置发送人。AI 回复、平台通知与系统提示统一使用该身份，
    /// 避免再为系统消息创建独立的 admin 联系人。
    /// </summary>
    public static class ChatAssistantIdentity
    {
        public const string UserId = "AI";
        public const string UserName = "AI助手";
        public const string UserAccount = "AI";
        public const string UserAvatar = "";

        public static bool IsAssistant(string userId)
        {
            return string.Equals(userId?.Trim(), UserId, StringComparison.OrdinalIgnoreCase);
        }

        public static MessageBody CreateSystemMessage(string content, string toUserId = null)
        {
            return new MessageBody
            {
                Content = content,
                FromUserId = UserId,
                FromUserName = UserName,
                FromUserAccount = UserAccount,
                FromUserAvatar = UserAvatar,
                ToUserId = toUserId,
                CreateTime = DateTime.Now,
                Type = "系统消息",
                IsRead = false
            };
        }

        public static MessageBodyDto CreateSystemMessageDto(string content, string toUserId = null)
        {
            return new MessageBodyDto
            {
                Content = content,
                FromUserId = UserId,
                FromUserName = UserName,
                FromUserAccount = UserAccount,
                FromUserAvatar = UserAvatar,
                ToUserId = toUserId,
                CreateTime = DateTime.Now,
                Type = "系统消息",
                IsRead = false
            };
        }
    }

    /// <summary>
    /// 聊天联系人列表DTO - 纯POCO，避免ObjectId序列化问题
    /// </summary>
    public class MessageChatContactListDto
    {
        public string UserId { get; set; }
        public string UserName { get; set; }
        public string UserAccount { get; set; }
        public string UserAvatar { get; set; }
        public string ContactUserId { get; set; }
        public string ContactUserName { get; set; }
        public string ContactUserAccount { get; set; }
        public string ContactUserAvatar { get; set; }
        public string ContactUserDeviceClientId { get; set; }
        public string LastMessage { get; set; }
        public string LastMessageType { get; set; }
        public string OtherInfo { get; set; }
        public int UnRead { get; set; }
        public DateTime UpdateTime { get; set; }
    }

    /// <summary>
    /// 聊天联系人最小公开投影。只补充现有登录账号，不扩展手机号、邮箱等用户资料。
    /// </summary>
    public static class ChatContactProjection
    {
        private static string FirstNotBlank(params string[] values)
        {
            return values?
                .Select(value => value?.Trim())
                .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;
        }

        public static string ResolveDisplayName(
            string currentName,
            string storedName,
            string currentAccount,
            string storedAccount,
            string fallback = "未命名用户")
        {
            return FirstNotBlank(
                currentName,
                storedName,
                currentAccount,
                storedAccount,
                fallback,
                "未命名用户");
        }

        /// <summary>
        /// 已鉴权公共用户目录仍只返回 Id/Name/Avatar；Account 仅在服务端参与 Name 回退计算。
        /// </summary>
        public static string ResolvePublicDirectoryName(string name, string account)
        {
            return ResolveDisplayName(name, null, account, null);
        }

        public static string ResolveAccount(string currentAccount, string storedAccount)
        {
            return FirstNotBlank(currentAccount, storedAccount);
        }

        public static string ResolveAvatar(string currentAvatar, string storedAvatar)
        {
            return FirstNotBlank(currentAvatar, storedAvatar);
        }

        public static MessageChatContactListDto Create(
            MessageChatContactList source,
            string currentContactName = null,
            string currentContactAccount = null,
            string currentContactAvatar = null)
        {
            source ??= new MessageChatContactList();
            return new MessageChatContactListDto
            {
                UserId = source.UserId,
                UserName = source.UserName,
                UserAccount = source.UserAccount,
                UserAvatar = source.UserAvatar,
                ContactUserId = source.ContactUserId,
                ContactUserName = ResolveDisplayName(
                    currentContactName,
                    source.ContactUserName,
                    currentContactAccount,
                    source.ContactUserAccount),
                ContactUserAccount = ResolveAccount(
                    currentContactAccount,
                    source.ContactUserAccount),
                ContactUserAvatar = ResolveAvatar(
                    currentContactAvatar,
                    source.ContactUserAvatar),
                ContactUserDeviceClientId = source.ContactUserDeviceClientId,
                LastMessage = source.LastMessage,
                LastMessageType = source.LastMessageType,
                OtherInfo = source.OtherInfo,
                UnRead = source.UnRead,
                UpdateTime = source.UpdateTime
            };
        }
    }

    /// <summary>
    /// 
    /// </summary>
    [BsonIgnoreExtraElements]//忽略mongodb内部自动产生的一些字段
    public class MessageChatContactList //abstract
    {
        /// <summary>
        /// 
        /// </summary>
        public ObjectId _id { get; set; }//mongodb的主键(类似guid)，如果不需要可以删除此行(但是mongodb会自动加上_id)
        /// <summary>
        /// 
        /// </summary>
        public string UserId { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string UserName { get; set; }
        /// <summary>
        /// 当前用户登录账号，仅用于聊天联系人显示名回退。
        /// </summary>
        public string UserAccount { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string UserAvatar { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string ContactUserId { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string ContactUserName { get; set; }
        /// <summary>
        /// 聊天对象登录账号，仅用于聊天联系人显示名回退。
        /// </summary>
        public string ContactUserAccount { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string ContactUserAvatar { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string ContactUserDeviceClientId { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string LastMessage { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string LastMessageType { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string OtherInfo { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public int UnRead { get; set; }
        /// <summary>
        /// 
        /// </summary>
        [BsonIgnore]
        public string OsClient { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public DateTime UpdateTime { get; set; }
        /// <summary>
        /// 
        /// </summary>
        [BsonIgnore]
        public bool _IsUpdateTime { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public int? _PageIndex { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public int? _PageSize { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string _Lang = DiyMessage.Lang;
    }

    /// <summary>
    /// 
    /// </summary>
    [BsonIgnoreExtraElements]//忽略mongodb内部自动产生的一些字段
    public class MessageBody //abstract
    {

        //public MessageBody()
        //{
        //    CreateTime = DateTime.Now;
        //}
        /// <summary>
        /// 
        /// </summary>
        public ObjectId _id { get; set; }//mongodb的主键(类似guid)，如果不需要可以删除此行(但是mongodb会自动加上_id)
        /// <summary>
        /// 由服务端根据 RequestId 生成的稳定消息标识；旧消息可为空。
        /// </summary>
        public string MessageId { get; set; }
        /// <summary>
        /// 客户端重试幂等键；旧客户端未传时由兼容 Hub 生成。
        /// </summary>
        public string RequestId { get; set; }
        /// <summary>
        /// 消息内容
        /// </summary>
        public virtual string Content { get; set; }
        /// <summary>
        /// 消息本体标识
        /// </summary>
        //public virtual string TransferCode { get; set; }
        /// <summary>
        /// 消息服务器标识
        /// </summary>
        //public virtual string LocalServerCode { get; set; }
        /// <summary>
        /// 消息创建时间
        /// </summary>
        public DateTime CreateTime { get; set; }
        /// <summary>
        /// 是否撤回
        /// </summary>
        public bool IsRecall { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public bool IsFromDeleted { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public bool IsToDeleted { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public bool IsRead { get; set; }
        /// <summary>
        /// 消息类型
        /// </summary>
        public string Type { get; set; }
        /// <summary>
        /// 发送者UserId
        /// </summary>

        public virtual string FromUserAvatar { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public virtual string FromUserName { get; set; }
        /// <summary>
        /// 发送者登录账号，仅用于聊天显示名回退。
        /// </summary>
        public virtual string FromUserAccount { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public virtual string FromUserId { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public virtual string ToUserId { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public virtual string ToUserName { get; set; }
        /// <summary>
        /// 接收者登录账号，仅用于聊天显示名回退。
        /// </summary>
        public virtual string ToUserAccount { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public virtual string ToUserAvatar { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public virtual string OtherInfo { get; set; }
        /// <summary>
        /// 
        /// </summary>
        [BsonIgnore]
        public virtual string OsClient { get; set; }
        /// <summary>
        /// 
        /// </summary>
        [BsonIgnore]
        public virtual int? _PageIndex { get; set; }
        /// <summary>
        /// 
        /// </summary>
        [BsonIgnore]
        public virtual int? _PageSize { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string _Lang = DiyMessage.Lang;

    }
}

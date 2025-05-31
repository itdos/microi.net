#if !NETSTANDARD2_0 && !NETCOREAPP2_1 && !NET461
using Microsoft.AspNetCore.SignalR;
#endif
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
    public  class MessageBody //abstract
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

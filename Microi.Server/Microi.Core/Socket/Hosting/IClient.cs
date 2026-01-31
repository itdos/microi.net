using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public interface IClient
    {
        /// <summary>
        /// 
        /// </summary>
        /// <param name="message"></param>
        /// <returns></returns>
        Task ReceiveMessage(MessageBody message);
        /// <summary>
        /// 
        /// </summary>
        /// <param name="message"></param>
        /// <returns></returns>
        Task ReceiveConnection(MessageBody message);
        /// <summary>
        /// 
        /// </summary>
        /// <param name="message"></param>
        /// <returns></returns>
        Task ReceiveDisConnection(MessageBody message);
        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        Task ReceiveSendToGroup(MessageBody msg);
        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        Task ReceiveSendToGroups(MessageBody msg);
        /// <summary>
        /// 发送消息给某个用户（兼容旧版本）
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        Task ReceiveSendToUser(MessageBody msg);
        /// <summary>
        /// 发送消息给某个用户（DTO版本，避免序列化问题）- 推荐使用
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        Task ReceiveSendToUser(MessageBodyDto msg);
        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        Task ReceiveSendToUsers(MessageBody msg);

        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        Task ReceiveSendLastContacts(List<MessageChatContactListDto> msg);
        //Task ReceiveSendLastContacts(MessageChatContactList msg);
        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        Task ReceiveSendChatRecordToUser(List<MessageBodyDto> msg);
        /// <summary>
        /// 
        /// </summary>
        /// <param name="count"></param>
        /// <returns></returns>
        Task ReceiveSendUnreadCountToUser(long count);
        
        /// <summary>
        /// 接收AI流式输出的数据块
        /// </summary>
        /// <param name="chunk">AI生成的文本片段</param>
        /// <param name="fromUserId">发送者ID（AI用户ID）</param>
        /// <param name="toUserId">接收者ID</param>
        /// <param name="isComplete">是否是最后一个数据块</param>
        /// <returns></returns>
        Task ReceiveAIChunk(string chunk, string fromUserId, string toUserId, bool isComplete);
    }
}

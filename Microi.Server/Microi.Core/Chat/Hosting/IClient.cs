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
        /// 发送消息给某个用户
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        Task ReceiveSendToUser(MessageBody msg);
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
        Task ReceiveSendLastContacts(List<MessageChatContactList> msg);
        //Task ReceiveSendLastContacts(MessageChatContactList msg);
        /// <summary>
        /// 
        /// </summary>
        /// <param name="msg"></param>
        /// <returns></returns>
        Task ReceiveSendChatRecordToUser(List<MessageBody> msg);
        /// <summary>
        /// 
        /// </summary>
        /// <param name="count"></param>
        /// <returns></returns>
        Task ReceiveSendUnreadCountToUser(long count);
    }
}

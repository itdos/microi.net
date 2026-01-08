using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public interface IConnectionHub
    {
        /// <summary>
        /// 发送客户端连接到服务器后的信息
        /// </summary>
        /// <param name="groupName">向哪个群组发送</param>
        /// <param name="msg">发送的消息</param>
        /// <returns></returns>
        Task SendConnection(string groupName, ConnectionMessageContent msg);

        /// <summary>
        /// 发送客户端断开连接的信息
        /// </summary>
        /// <param name="groupName">向哪个群组发送</param>
        /// <param name="msg">发送的消息</param>
        /// <returns></returns>
        Task SendDisConnection(string groupName, DisConnectionMessageContent msg);
    }
}

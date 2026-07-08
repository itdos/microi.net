using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public class ClientInfo
    {
        //public ClientInfo()
        //{
        //    ConnectedTime = DateTime.Now;
        //}
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public List<string> ConnectionIds { get; set; } = new List<string>();
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string LastConnectionId { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string GroupName { get; set; }
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string UserId { get; set; }
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string UserName { get; set; }
        /// <summary>
        /// 登录账号。
        /// </summary>
        public string Account { get; set; }
        /// <summary>
        /// 用户级别，Level>=9999 视为超级管理员。
        /// </summary>
        public int Level { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string UserAvatar { get; set; }
        /// <summary>
        /// 
        /// </summary> <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string DeviceClientId { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string OtherInfo { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public string Ip { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public DateTime ConnectedTime { get; set; }
        /// <summary>
        /// 当前在线终端列表。一个账号可能同时存在 PC、App、小程序等多个 SignalR 连接。
        /// </summary>
        public List<ClientTerminalInfo> Terminals { get; set; } = new List<ClientTerminalInfo>();
    }

    /// <summary>
    /// SignalR 在线终端信息。
    /// </summary>
    public class ClientTerminalInfo
    {
        public string ConnectionId { get; set; }
        public string DeviceClientId { get; set; }
        public string ClientType { get; set; }
        public string Did { get; set; }
        public string Ip { get; set; }
        public string UserAgent { get; set; }
        public string OtherInfo { get; set; }
        public string TokenHash { get; set; }
        public DateTime ConnectedTime { get; set; }
        public DateTime LastActiveTime { get; set; }
    }
}

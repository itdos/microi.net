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
    }
}

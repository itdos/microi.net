using System;
using System.Collections.Generic;
using System.Text;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public class UserMessageContent : MessageBody
    {
        /// <summary>
        /// 接收者
        /// </summary>
        public string[] To { get; set; }
    }
}

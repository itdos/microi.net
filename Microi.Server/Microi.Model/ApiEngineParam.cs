using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public class ApiEngineParam
    {
        public string Id { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string _Lang = DiyMessage.Lang;
        /// <summary>
        /// 
        /// </summary>
        public string LockKey { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string ApiAddress { get; set; }
        /// <summary>
        /// 
        /// </summary>
        [Obsolete("请使用ApiEngineKey替代ApiKey。")]
        public string ApiKey { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string ApiEngineKey { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public string OsClient { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public SysUser _CurrentSysUser { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public JObject _CurrentUser { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public Dictionary<string, string> _FilesByteBase64 { get; set; }
    }
}

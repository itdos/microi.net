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
        /// 以英文分号分隔的兼容路由。运行时仍以 ApiAddress 为主路由，
        /// 但模型查询、动态路由和缓存会把这里的每一项作为同一接口引擎的别名。
        /// </summary>
        public string ApiRoutes { get; set; }
        /// <summary>
        /// 请使用ApiEngineKey替代ApiKey
        /// </summary>
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
        public JObject _CurrentUser { get; set; }
        /// <summary>
        /// 
        /// </summary>
        public Dictionary<string, string> _FilesByteBase64 { get; set; } = new Dictionary<string, string>();
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class DiyTokenParam
    {
        /// <summary>
        /// 必须包含：Id
        /// </summary>
        public JObject CurrentUser { get; set; }
        public string OsClient { get; set; }
        public string _ClientType { get; set; }
        public string Did { get; set; }
        /// <summary>
        /// 自动轮换时正在使用的旧 Token。仅供鉴权过滤器传入，用于合并同一终端的并发续签请求。
        /// 登录、手工换号等主动签发场景不要传入。
        /// </summary>
        public string RotateFromToken { get; set; }
    }
}

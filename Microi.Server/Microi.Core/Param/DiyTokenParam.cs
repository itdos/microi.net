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
        /// 浏览器访问密钥 Id。只写入 JWT Claim 和当前终端 Token，不得写入共享 CurrentUser。
        /// 后续每次请求都会从共享数据库/Redis重新取得密钥范围并与帐号实时权限取交集。
        /// </summary>
        public string AccessKeyId { get; set; }
        /// <summary>
        /// 自动轮换时正在使用的旧 Token。仅供鉴权过滤器传入，用于合并同一终端的并发续签请求。
        /// 登录、手工换号等主动签发场景不要传入。
        /// </summary>
        public string RotateFromToken { get; set; }
    }
}

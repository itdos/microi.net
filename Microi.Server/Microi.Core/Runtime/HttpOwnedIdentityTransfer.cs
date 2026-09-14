using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>将可信会话身份放入 HTTP 请求参数，批量行保留独立副本。</summary>
    internal static class HttpOwnedIdentityTransfer
    {
        internal static JToken ToRequestValue(object currentUser, bool transferOwnedUser)
        {
            if (!(currentUser is JToken token)) return JToken.FromObject(currentUser);
            // 只转交 DiyToken 本次验证后产生的独立身份；不得把共享缓存或批量行身份
            // 当作可转移对象。已被其它 JSON 对象拥有时仍复制，避免修改其持有者。
            return transferOwnedUser && token.Parent == null ? token : token.DeepClone();
        }
    }
}

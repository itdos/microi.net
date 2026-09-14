using Dos.Common;
using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>接口引擎日志的参数序列化边界；调用者另行记录已认证用户标识。</summary>
    public static class ApiEngineLogParameters
    {
        /// <summary>序列化业务参数，不修改执行中的请求对象。</summary>
        public static string Serialize(JObject parameters)
        {
            if (parameters == null) return null;
            try
            {
                // _CurrentUser 是平台注入的完整身份，不是业务输入；日志已有 UserId/UserName。
                // 只建立顶层只读引用投影，避免先 DeepClone/序列化数千条权限再脱敏或截断。
                // 嵌套业务字段、空值和 JToken 类型仍交给原 JSON 设置处理，不修改执行参数。
                var business = new Dictionary<string, JToken>(StringComparer.Ordinal);
                foreach (var property in parameters.Properties())
                    if (!string.Equals(property.Name, "_CurrentUser", StringComparison.OrdinalIgnoreCase))
                        business.Add(property.Name, property.Value);
                return JsonHelper.Serialize(business);
            }
            catch { return null; } // 与 JsonHelper.Serialize 的日志失败语义保持一致。
        }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 工作流抄送已读状态的兼容解析器。
    /// 历史 CopyUsers 项没有 IsRead 字段，按已读处理，避免升级后把全部历史抄送误报为未读。
    /// </summary>
    public static class WorkflowCopyReadState
    {
        public static bool ContainsRecipient(string copyUsersJson, string userId)
        {
            return Parse(copyUsersJson).OfType<JObject>().Any(item => IsRecipient(item, userId));
        }

        public static bool IsUnreadForUser(string copyUsersJson, string userId)
        {
            return Parse(copyUsersJson).OfType<JObject>().Any(item =>
                IsRecipient(item, userId) && ReadFlag(item) == false);
        }

        public static int CountUnreadForUser(IEnumerable<WFFlow> flows, string userId)
        {
            return (flows ?? Enumerable.Empty<WFFlow>())
                .Count(flow => IsUnreadForUser(flow?.CopyUsers, userId));
        }

        public static string MarkRead(
            string copyUsersJson,
            string userId,
            DateTime readTime,
            out bool changed)
        {
            var items = Parse(copyUsersJson);
            changed = false;
            foreach (var item in items.OfType<JObject>())
            {
                if (!IsRecipient(item, userId) || ReadFlag(item) != false)
                {
                    continue;
                }

                item["IsRead"] = true;
                item["ReadTime"] = readTime;
                changed = true;
            }
            return items.ToString(Newtonsoft.Json.Formatting.None);
        }

        private static JArray Parse(string copyUsersJson)
        {
            if (string.IsNullOrWhiteSpace(copyUsersJson))
            {
                return new JArray();
            }

            try
            {
                return JArray.Parse(copyUsersJson);
            }
            catch
            {
                return new JArray();
            }
        }

        private static bool IsRecipient(JObject item, string userId)
        {
            if (string.IsNullOrWhiteSpace(userId)) return false;
            var id = item.GetValue("Id", StringComparison.OrdinalIgnoreCase)?.ToString();
            return string.Equals(id, userId, StringComparison.OrdinalIgnoreCase);
        }

        private static bool? ReadFlag(JObject item)
        {
            var token = item.GetValue("IsRead", StringComparison.OrdinalIgnoreCase);
            if (token == null || token.Type == JTokenType.Null) return null;
            if (token.Type == JTokenType.Boolean) return token.Value<bool>();
            if (token.Type == JTokenType.Integer) return token.Value<long>() != 0;
            if (bool.TryParse(token.ToString(), out var value)) return value;
            return null;
        }
    }
}

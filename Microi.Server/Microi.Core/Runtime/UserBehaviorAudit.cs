using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>用户行为审计的统一建模、脱敏和摘要规则。</summary>
    public static class UserBehaviorAudit
    {
        private static readonly string[] SensitiveNames =
        {
            "password", "pwd", "token", "authorization", "secret", "apikey", "connectionstring",
            "身份证", "idcard", "bankcard", "银行卡"
        };
        private static readonly HashSet<string> SystemFields = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "IsDeleted", "CreateTime", "UpdateTime", "CreateUserId", "CreateUserName",
            "UpdateUserId", "UpdateUserName", "TenantId", "OrgId", "Sort", "Version"
        };

        public static bool Track(
            BaseParam context,
            string category,
            string action,
            string type,
            string targetType,
            string targetId,
            string description,
            object content = null,
            bool? success = true,
            long? durationSeconds = null,
            string source = null,
            string sessionId = null,
            string did = null,
            string eventId = null)
        {
            if (context == null || string.IsNullOrWhiteSpace(context.OsClient)) return false;
            try
            {
                var user = context._CurrentUser;
                var userId = user?["Id"].Val<string>();
                var displayUser = FormatUser(user);
                var log = new SysLogParam
                {
                    EventId = eventId,
                    OsClient = context.OsClient,
                    _CurrentUser = user,
                    UserId = userId,
                    UserName = displayUser,
                    Category = category,
                    Action = action,
                    Source = source ?? (string.Equals(context._InvokeType, InvokeType.Client.ToString(), StringComparison.OrdinalIgnoreCase)
                        ? "ServerEndpoint"
                        : "Server"),
                    ClientType = context._ClientType,
                    TargetType = targetType,
                    TargetId = targetId,
                    Type = type,
                    Title = $"用户[{displayUser}]{description}",
                    Content = content == null ? null : JsonConvert.SerializeObject(content),
                    Success = success,
                    DurationSeconds = durationSeconds,
                    SessionId = sessionId,
                    Did = did,
                    OccurredAt = DateTime.Now,
                    Level = success == false ? 2 : 1
                };
                return MicroiEngine.QueueSysLog(log);
            }
            catch
            {
                // 审计摘要或队列异常绝不能阻断登录、表单保存、导入导出等业务主链路。
                return false;
            }
        }

        public static string FormatUser(JObject user)
        {
            if (user == null) return "匿名";
            var name = user["Name"].Val<string>()?.Trim();
            var account = user["Account"].Val<string>()?.Trim();
            if (name.DosIsNullOrWhiteSpace() && account.DosIsNullOrWhiteSpace()) return "匿名";
            if (name.DosIsNullOrWhiteSpace()) return account;
            if (account.DosIsNullOrWhiteSpace() || string.Equals(name, account, StringComparison.OrdinalIgnoreCase)) return name;
            return $"{name}({account})";
        }

        /// <summary>详情页摘要：保留Id和按响应顺序出现的前三个业务字段，空值明确显示为“空”。</summary>
        public static JObject BuildRowPreview(object row, int fieldCount = 3, int valueLength = 20)
        {
            var source = ToJObject(row);
            var preview = new JObject();
            if (source == null) return preview;
            var id = source.GetValue("Id", StringComparison.OrdinalIgnoreCase);
            if (id != null) preview["Id"] = NormalizeValue("Id", id, valueLength);

            var count = 0;
            foreach (var property in source.Properties())
            {
                if (count >= fieldCount) break;
                if (string.Equals(property.Name, "Id", StringComparison.OrdinalIgnoreCase) || IsControlField(property.Name)) continue;
                preview[property.Name] = NormalizeValue(property.Name, property.Value, valueLength);
                count++;
            }
            return preview;
        }

        /// <summary>比较修改前后值，记录实际变化的列；敏感列只记录列名不记录值。</summary>
        public static JObject BuildChangeSummary(object oldRow, object newRow, int maxFields = 100)
        {
            var oldObject = ToJObject(oldRow) ?? new JObject();
            var newObject = ToJObject(newRow) ?? new JObject();
            var changes = new JArray();
            foreach (var property in newObject.Properties())
            {
                if (changes.Count >= maxFields || IsControlField(property.Name)) continue;
                var oldValue = oldObject.GetValue(property.Name, StringComparison.OrdinalIgnoreCase);
                if (JToken.DeepEquals(NormalizeToken(oldValue), NormalizeToken(property.Value))) continue;
                changes.Add(new JObject
                {
                    ["Field"] = property.Name,
                    ["Old"] = NormalizeValue(property.Name, oldValue, 200),
                    ["New"] = NormalizeValue(property.Name, property.Value, 200)
                });
            }
            return new JObject
            {
                ["ChangedCount"] = changes.Count,
                ["ChangedFields"] = new JArray(changes.Select(d => d["Field"])),
                ["Changes"] = changes
            };
        }

        public static string FormatDuration(long seconds)
        {
            if (seconds < 0) seconds = 0;
            var span = TimeSpan.FromSeconds(seconds);
            if (span.TotalDays >= 1) return $"{(int)span.TotalDays}天{span.Hours}小时{span.Minutes}分钟";
            if (span.TotalHours >= 1) return $"{(int)span.TotalHours}小时{span.Minutes}分钟";
            if (span.TotalMinutes >= 1) return $"{(int)span.TotalMinutes}分钟";
            return $"{span.Seconds}秒";
        }

        /// <summary>只保存不可逆短摘要，绝不把Token写入日志。</summary>
        public static string HashIdentifier(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            using (var sha = SHA256.Create())
            {
                var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(value));
                return BitConverter.ToString(hash).Replace("-", "").Substring(0, 24).ToLowerInvariant();
            }
        }

        /// <summary>
        /// 为跨节点可能重复观察到的同一行为生成稳定事件Id。bucket用于短时间窗口去重；
        /// 不传bucket时，调用方的businessKey必须天然代表唯一业务事件。
        /// </summary>
        public static string DeterministicEventId(string businessKey, TimeSpan? bucket = null, DateTime? occurredAt = null)
        {
            if (string.IsNullOrWhiteSpace(businessKey)) return null;
            var material = businessKey;
            if (bucket.HasValue && bucket.Value.Ticks > 0)
            {
                var ticks = (occurredAt ?? DateTime.UtcNow).ToUniversalTime().Ticks;
                material += "|" + (ticks / bucket.Value.Ticks).ToString(CultureInfo.InvariantCulture);
            }
            using (var sha = SHA256.Create())
            {
                var hash = sha.ComputeHash(Encoding.UTF8.GetBytes(material));
                return "audit_" + BitConverter.ToString(hash).Replace("-", "").Substring(0, 40).ToLowerInvariant();
            }
        }

        public static bool IsSensitiveField(string name)
        {
            if (string.IsNullOrWhiteSpace(name)) return false;
            return SensitiveNames.Any(d => name.IndexOf(d, StringComparison.OrdinalIgnoreCase) >= 0);
        }

        private static bool IsControlField(string name)
        {
            return string.IsNullOrWhiteSpace(name)
                || name[0] == '_'
                || string.Equals(name, "authorization", StringComparison.OrdinalIgnoreCase)
                || string.Equals(name, "OsClient", StringComparison.OrdinalIgnoreCase)
                || string.Equals(name, "FormEngineKey", StringComparison.OrdinalIgnoreCase)
                || SystemFields.Contains(name);
        }

        private static JObject ToJObject(object value)
        {
            if (value == null) return null;
            if (value is JObject jObject) return jObject;
            try { return JObject.FromObject(value); } catch { return null; }
        }

        private static JToken NormalizeToken(JToken value)
        {
            return value == null || value.Type == JTokenType.Null || value.Type == JTokenType.Undefined
                ? JValue.CreateNull()
                : value;
        }

        private static string NormalizeValue(string fieldName, JToken value, int maxTextElements)
        {
            if (IsSensitiveField(fieldName)) return "***";
            if (value == null || value.Type == JTokenType.Null || value.Type == JTokenType.Undefined) return "空";
            var text = value.Type == JTokenType.String ? value.Val<string>() : value.ToString(Formatting.None);
            if (string.IsNullOrEmpty(text)) return "空";
            var info = new StringInfo(text);
            return info.LengthInTextElements <= maxTextElements
                ? text
                : info.SubstringByTextElements(0, maxTextElements) + "…";
        }
    }
}

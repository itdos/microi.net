using System;
using System.IO;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 畅捷通 V2 回调的最小协议原子：只负责解密、协议边界校验与安全投影，
    /// 不写表、不发通知、不调业务接口。业务编排始终由 Managed ApiEngine 完成。
    /// </summary>
    internal static class ChanjetV2CallbackProtocol
    {
        internal const int MaxEncryptedTextLength = 384 * 1024;
        internal const int MaxPlainTextBytes = 256 * 1024;
        internal const int MaxBizContentBytes = 128 * 1024;

        private static readonly UTF8Encoding StrictUtf8 = new UTF8Encoding(false, true);
        private static readonly Regex MessageTypePattern = new Regex(
            "^[A-Z0-9_]{2,64}$",
            RegexOptions.CultureInvariant);

        internal static bool TryDecode(
            string encryptedMessage,
            ChanjetV2GatewaySettings settings,
            out JObject safeMessage)
        {
            safeMessage = null;
            if (settings == null
                || string.IsNullOrWhiteSpace(encryptedMessage)
                || encryptedMessage.Length > MaxEncryptedTextLength
                || encryptedMessage.Any(char.IsWhiteSpace))
            {
                return false;
            }

            try
            {
                var encryptedBytes = Convert.FromBase64String(encryptedMessage);
                if (encryptedBytes.Length == 0 || encryptedBytes.Length % 16 != 0)
                    return false;

                byte[] plainBytes;
                using (var aes = Aes.Create())
                {
                    aes.Key = Encoding.UTF8.GetBytes(settings.AesKey);
                    aes.Mode = CipherMode.ECB;
                    aes.Padding = PaddingMode.PKCS7;
                    using (var decryptor = aes.CreateDecryptor())
                    {
                        plainBytes = decryptor.TransformFinalBlock(
                            encryptedBytes,
                            0,
                            encryptedBytes.Length);
                    }
                }

                if (plainBytes.Length == 0 || plainBytes.Length > MaxPlainTextBytes)
                    return false;

                var plainText = StrictUtf8.GetString(plainBytes);
                var message = ParseObject(plainText);
                if (message == null) return false;

                var messageId = RequiredText(message["id"], 128);
                var appKey = RequiredText(message["appKey"], 128);
                var messageType = RequiredText(message["msgType"], 64);
                var messageTime = OptionalText(message["time"], 64);
                if (messageId == null
                    || appKey == null
                    || messageType == null
                    || messageTime == null
                    || !MessageTypePattern.IsMatch(messageType)
                    || !settings.IsAllowedAppKey(appKey))
                {
                    return false;
                }

                var bizContent = message["bizContent"]?.DeepClone() ?? JValue.CreateNull();
                var serializedBizContent = bizContent.ToString(Formatting.None);
                if (StrictUtf8.GetByteCount(serializedBizContent) > MaxBizContentBytes)
                    return false;

                safeMessage = new JObject
                {
                    ["MessageId"] = messageId,
                    ["AppKey"] = appKey,
                    ["MessageType"] = messageType,
                    ["MessageTime"] = messageTime,
                    ["BizContent"] = bizContent
                };
                return true;
            }
            catch
            {
                // 密文、密钥和解密异常均不得进入日志或接口响应。
                safeMessage = null;
                return false;
            }
        }

        private static JObject ParseObject(string json)
        {
            using (var stringReader = new StringReader(json))
            using (var jsonReader = new JsonTextReader(stringReader)
            {
                DateParseHandling = DateParseHandling.None,
                MaxDepth = 64,
                SupportMultipleContent = false
            })
            {
                var token = JToken.ReadFrom(jsonReader, new JsonLoadSettings
                {
                    CommentHandling = CommentHandling.Ignore,
                    DuplicatePropertyNameHandling = DuplicatePropertyNameHandling.Error,
                    LineInfoHandling = LineInfoHandling.Ignore
                });
                if (!(token is JObject result)) return null;
                while (jsonReader.Read())
                {
                    if (jsonReader.TokenType != JsonToken.Comment) return null;
                }
                return result;
            }
        }

        private static string RequiredText(JToken token, int maxLength)
        {
            var value = OptionalText(token, maxLength);
            return string.IsNullOrEmpty(value) ? null : value;
        }

        private static string OptionalText(JToken token, int maxLength)
        {
            if (token == null || token.Type == JTokenType.Null) return string.Empty;
            if (token.Type != JTokenType.String) return null;
            var value = token.Value<string>() ?? string.Empty;
            return value.Length <= maxLength && value.All(character => !char.IsControl(character))
                ? value
                : null;
        }
    }
}

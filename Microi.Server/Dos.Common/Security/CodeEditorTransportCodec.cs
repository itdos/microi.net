using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Newtonsoft.Json.Linq;

namespace Dos.Common
{
    /// <summary>
    /// Decodes the explicit browser transport envelope used for CodeEditor fields.
    /// Base64URL is transport encoding only; database values remain plaintext.
    /// </summary>
    public static class CodeEditorTransportCodec
    {
        public const string Marker = "MICROI_B64URL_V1:";
        private const int MaxFieldCount = 256;
        private const int MaxEncodedLength = 64 * 1024 * 1024;
        private static readonly Regex Base64UrlPattern =
            new Regex("^[A-Za-z0-9_-]*$", RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly UTF8Encoding StrictUtf8 = new UTF8Encoding(false, true);

        public static bool HasEnvelope(JObject request)
        {
            return request?["_CodeEditorTransport"] != null
                && request["_CodeEditorTransport"].Type != JTokenType.Null;
        }

        public static bool TryDecodeInPlace(
            JObject request,
            out string error,
            out int decodedFieldCount)
        {
            error = "";
            decodedFieldCount = 0;
            if (request == null)
            {
                error = "代码编辑器传输参数为空。";
                return false;
            }
            if (!HasEnvelope(request))
            {
                return true;
            }

            var working = (JObject)request.DeepClone();
            if (!TryDecodeCore(working, out error, out decodedFieldCount))
            {
                decodedFieldCount = 0;
                return false;
            }

            request.RemoveAll();
            foreach (var property in working.Properties().ToList())
            {
                property.Remove();
                request.Add(property);
            }
            return true;
        }

        private static bool TryDecodeCore(
            JObject request,
            out string error,
            out int decodedFieldCount)
        {
            error = "";
            decodedFieldCount = 0;
            if (!(request["_CodeEditorTransport"] is JObject metadata))
            {
                error = "代码编辑器传输元数据格式不正确。";
                return false;
            }
            if (metadata["Version"]?.Value<int?>() != 1
                || !string.Equals(metadata["Encoding"]?.Value<string>(), "base64url", StringComparison.OrdinalIgnoreCase))
            {
                error = "不支持的代码编辑器传输协议版本或编码。";
                return false;
            }
            if (!(metadata["Fields"] is JArray fieldArray))
            {
                error = "代码编辑器传输字段列表缺失。";
                return false;
            }

            var fields = fieldArray
                .Where(token => token.Type == JTokenType.String)
                .Select(token => token.Value<string>())
                .Where(field => !string.IsNullOrWhiteSpace(field))
                .Distinct(StringComparer.Ordinal)
                .ToList();
            if (fields.Count == 0 || fields.Count > MaxFieldCount || fields.Count != fieldArray.Count)
            {
                error = "代码编辑器传输字段列表无效。";
                return false;
            }

            var targets = new List<JObject>();
            if (request["_RowModel"] is JObject rowModel) targets.Add(rowModel);
            if (request["_FormData"] is JObject formData) targets.Add(formData);
            if (targets.Count == 0) targets.Add(request);

            foreach (var field in fields)
            {
                var found = false;
                foreach (var target in targets)
                {
                    if (!target.TryGetValue(field, StringComparison.Ordinal, out var token)) continue;
                    found = true;
                    if (token.Type != JTokenType.String
                        || !TryDecodeValue(token.Value<string>(), out var plaintext, out error))
                    {
                        error = string.IsNullOrWhiteSpace(error)
                            ? $"代码编辑器字段[{field}]未使用约定的传输编码。"
                            : $"代码编辑器字段[{field}]解码失败：{error}";
                        return false;
                    }
                    target[field] = plaintext;
                    decodedFieldCount++;
                }
                if (!found)
                {
                    error = $"代码编辑器传输字段[{field}]不存在。";
                    return false;
                }
            }

            request.Remove("_CodeEditorTransport");
            return true;
        }

        private static bool TryDecodeValue(string value, out string plaintext, out string error)
        {
            plaintext = "";
            error = "";
            if (value == null || !value.StartsWith(Marker, StringComparison.Ordinal))
            {
                return false;
            }

            var encoded = value.Substring(Marker.Length);
            if (encoded.Length > MaxEncodedLength || !Base64UrlPattern.IsMatch(encoded))
            {
                error = "Base64URL内容非法或超过64MB限制。";
                return false;
            }
            try
            {
                var base64 = encoded.Replace('-', '+').Replace('_', '/');
                base64 = base64.PadRight(base64.Length + ((4 - base64.Length % 4) % 4), '=');
                plaintext = StrictUtf8.GetString(Convert.FromBase64String(base64));
                return true;
            }
            catch (Exception ex) when (ex is FormatException || ex is DecoderFallbackException)
            {
                error = "Base64URL或UTF-8内容非法。";
                return false;
            }
        }
    }
}

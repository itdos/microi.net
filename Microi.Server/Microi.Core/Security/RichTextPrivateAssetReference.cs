using System;
using System.Net;
using System.Text.RegularExpressions;

namespace Microi.net
{
    /// <summary>
    /// 校验私有对象路径是否被富文本真实媒体属性引用。普通文本、data-* 属性、
    /// 非受支持标签和非引号属性都不能成为文件授权依据。
    /// </summary>
    public static class RichTextPrivateAssetReference
    {
        public const string MarkerPrefix = "/__microi_richtext_private__/";

        private static readonly Regex SupportedTagPattern = new Regex(
            @"<(?<tag>img|video|source|a)\b[^>]*>",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled,
            TimeSpan.FromMilliseconds(100));

        private static readonly Regex AssetAttributePattern = new Regex(
            @"(?:^|\s)(?<attribute>src|href)\s*=\s*(?<quote>[""'])(?<value>.*?)\k<quote>",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled,
            TimeSpan.FromMilliseconds(100));

        public static bool ReferencesPath(string html, string requestedPath)
        {
            var target = NormalizeComparePath(requestedPath);
            if (string.IsNullOrWhiteSpace(html) || string.IsNullOrWhiteSpace(target)) return false;
            if (html.Length > 10 * 1024 * 1024) return false;

            try
            {
                foreach (Match tagMatch in SupportedTagPattern.Matches(html))
                {
                    var tagName = tagMatch.Groups["tag"].Value.ToLowerInvariant();
                    foreach (Match attributeMatch in AssetAttributePattern.Matches(tagMatch.Value))
                    {
                        var attributeName = attributeMatch.Groups["attribute"].Value.ToLowerInvariant();
                        var supported = tagName == "a" ? attributeName == "href" : attributeName == "src";
                        if (!supported) continue;

                        var candidate = NormalizeRichTextAssetPath(attributeMatch.Groups["value"].Value);
                        if (string.Equals(candidate, target, StringComparison.Ordinal)) return true;
                    }
                }
            }
            catch (RegexMatchTimeoutException)
            {
                return false;
            }

            return false;
        }

        private static string NormalizeRichTextAssetPath(string rawValue)
        {
            if (string.IsNullOrWhiteSpace(rawValue)) return string.Empty;
            var value = WebUtility.HtmlDecode(rawValue).Trim();

            if (Uri.TryCreate(value, UriKind.Absolute, out var absolute)
                && (absolute.Scheme == Uri.UriSchemeHttp || absolute.Scheme == Uri.UriSchemeHttps))
                return string.Empty;
            var markerPath = value;
            if (markerPath.StartsWith(MarkerPrefix, StringComparison.Ordinal))
            {
                var encoded = markerPath.Substring(MarkerPrefix.Length);
                if (encoded.Length == 0 || encoded.Length > 16 * 1024) return string.Empty;
                try
                {
                    return NormalizeComparePath(Uri.UnescapeDataString(encoded));
                }
                catch (UriFormatException)
                {
                    return string.Empty;
                }
            }

            // 只接受相对对象 Key；未校验为当前租户 FileServer 的绝对 URL 不能成为
            // 私有对象授权依据，即使其 AbsolutePath 与本地对象 Key 相同。
            return NormalizeComparePath(value);
        }

        private static string NormalizeComparePath(string path)
        {
            return PrivateFileAccessAuthorization.NormalizeComparePath(
                WebUtility.HtmlDecode(path ?? string.Empty));
        }
    }
}

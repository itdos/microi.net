using System.Net;
using System.Text.RegularExpressions;

namespace Microi.net.Api;

/// <summary>
/// Validates that a private object path is referenced by an actual rich-text media attribute.
/// Plain text, data-* attributes and unsupported tags never become an authorization source.
/// </summary>
public static class RichTextPrivateAssetReference
{
    public const string MarkerPrefix = "/__microi_richtext_private__/";

    private static readonly Regex SupportedTagPattern = new(
        @"<(?<tag>img|video|source|a)\b[^>]*>",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled,
        TimeSpan.FromMilliseconds(100));

    private static readonly Regex AssetAttributePattern = new(
        @"(?:^|\s)(?<attribute>src|href)\s*=\s*(?<quote>[""'])(?<value>.*?)\k<quote>",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled,
        TimeSpan.FromMilliseconds(100));

    public static bool ReferencesPath(string? html, string? requestedPath)
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

    private static string NormalizeRichTextAssetPath(string? rawValue)
    {
        if (string.IsNullOrWhiteSpace(rawValue)) return string.Empty;
        var value = WebUtility.HtmlDecode(rawValue).Trim();

        var markerPath = value;
        if (Uri.TryCreate(value, UriKind.Absolute, out var absoluteMarker)
            && (absoluteMarker.Scheme == Uri.UriSchemeHttp || absoluteMarker.Scheme == Uri.UriSchemeHttps))
        {
            markerPath = absoluteMarker.AbsolutePath;
        }
        if (markerPath.StartsWith(MarkerPrefix, StringComparison.Ordinal))
        {
            var encoded = markerPath[MarkerPrefix.Length..];
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

        // Compatibility for historical rich text that persisted the FileServer URL directly.
        return NormalizeComparePath(value);
    }

    private static string NormalizeComparePath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return string.Empty;
        var normalized = WebUtility.HtmlDecode(path).Trim().Replace("\\", "/");
        if (Uri.TryCreate(normalized, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps))
        {
            normalized = uri.AbsolutePath;
        }
        else
        {
            var fragmentIndex = normalized.IndexOf('#');
            if (fragmentIndex >= 0) normalized = normalized[..fragmentIndex];
            var queryIndex = normalized.IndexOf('?');
            if (queryIndex >= 0) normalized = normalized[..queryIndex];
        }

        try
        {
            normalized = Uri.UnescapeDataString(normalized);
        }
        catch (UriFormatException)
        {
            return string.Empty;
        }
        return normalized.Trim('/').ToLowerInvariant();
    }
}

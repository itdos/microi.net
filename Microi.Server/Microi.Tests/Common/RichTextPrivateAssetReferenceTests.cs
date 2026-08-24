using Microi.net.Api;

namespace Dos.Common.Tests;

public class RichTextPrivateAssetReferenceTests
{
    [Fact]
    public void MarkerReference_RoundTripsUnicodePath()
    {
        const string path = "iTdos/editor/2026/公告 图片.png";
        var marker = RichTextPrivateAssetReference.MarkerPrefix + Uri.EscapeDataString(path);
        var html = $"<p><img alt=\"公告\" src=\"{marker}\"></p>";

        Assert.True(RichTextPrivateAssetReference.ReferencesPath(html, path));
        Assert.True(RichTextPrivateAssetReference.ReferencesPath(
            html,
            "https://files.example.com/iTdos/editor/2026/%E5%85%AC%E5%91%8A%20%E5%9B%BE%E7%89%87.png?token=ignored"));
    }

    [Fact]
    public void HistoricalFileServerUrl_IsAcceptedOnlyAsAnExactMediaAttribute()
    {
        const string path = "iTdos/editor/legacy/file.pdf";
        const string html = "<p><a href='https://files.example.com/iTdos/editor/legacy/file.pdf?old=1'>下载</a></p>";

        Assert.True(RichTextPrivateAssetReference.ReferencesPath(html, path));
        Assert.False(RichTextPrivateAssetReference.ReferencesPath(html, path + ".bak"));
    }

    [Fact]
    public void TextAndDataAttributes_DoNotGrantPrivateFileAuthorization()
    {
        const string path = "iTdos/editor/secret.png";
        var marker = RichTextPrivateAssetReference.MarkerPrefix + Uri.EscapeDataString(path);
        var html = string.Join(string.Empty,
            $"<p>{marker}</p>",
            $"<div data-href=\"{marker}\"></div>",
            $"<script src=\"{marker}\"></script>",
            $"<img data-src=\"{marker}\">");

        Assert.False(RichTextPrivateAssetReference.ReferencesPath(html, path));
    }

    [Theory]
    [InlineData("<a src=\"/__microi_richtext_private__/a%2Fb.pdf\">x</a>")]
    [InlineData("<img href=\"/__microi_richtext_private__/a%2Fb.pdf\">")]
    [InlineData("<img src=/__microi_richtext_private__/a%2Fb.pdf>")]
    public void UnsupportedOrUnquotedAttributes_FailClosed(string html)
    {
        Assert.False(RichTextPrivateAssetReference.ReferencesPath(html, "a/b.pdf"));
    }
}

using Microi.net;

namespace Dos.Common.Tests;

public class ApplicationAssetStreamPublishTests
{
    [Theory]
    [InlineData("index.html", "index.html")]
    [InlineData("assets\\app.js", "assets/app.js")]
    [InlineData("css/theme.dark.css", "css/theme.dark.css")]
    public void NormalizeRelativePath_ReturnsPortableSafePath(string input, string expected)
    {
        Assert.Equal(expected, V8McpLogic.NormalizeApplicationAssetRelativePath(input));
    }

    [Theory]
    [InlineData("")]
    [InlineData("../index.html")]
    [InlineData("assets/../index.html")]
    [InlineData("/index.html")]
    [InlineData("assets//app.js")]
    [InlineData("C:/build/index.html")]
    [InlineData("versions/v1.0.0/index.html")]
    [InlineData("latest/index.html")]
    [InlineData(".microi-integrity/a.ok")]
    [InlineData("assets/app?.js")]
    public void NormalizeRelativePath_RejectsTraversalAndPublisherNamespaces(string input)
    {
        Assert.Throws<ArgumentException>(() => V8McpLogic.NormalizeApplicationAssetRelativePath(input));
    }

    [Theory]
    [InlineData("1.2.3", "v1.2.3")]
    [InlineData("V01.002.0003", "v1.2.3")]
    [InlineData("v0.0.0", "v0.0.0")]
    public void NormalizeVersion_ReturnsCanonicalSemanticVersion(string input, string expected)
    {
        Assert.Equal(expected, V8McpLogic.NormalizeApplicationAssetVersion(input));
    }

    [Theory]
    [InlineData("1")]
    [InlineData("v1.2")]
    [InlineData("v1.2.3.4")]
    [InlineData("latest")]
    public void NormalizeVersion_RejectsNonSemanticVersion(string input)
    {
        Assert.Throws<ArgumentException>(() => V8McpLogic.NormalizeApplicationAssetVersion(input));
    }
}

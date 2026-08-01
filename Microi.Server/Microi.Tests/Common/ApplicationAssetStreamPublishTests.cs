using Microi.net;
using Newtonsoft.Json.Linq;
using System.Security.Cryptography;
using System.Text;

namespace Dos.Common.Tests;

public class ApplicationAssetStreamPublishTests
{
    [Theory]
    [InlineData("MinIO", "MinIO")]
    [InlineData("S3", "S3")]
    [InlineData("", "Aliyun")]
    public void NormalizeApplicationAssetHdfsType_HandlesJValueWithoutDynamicBinding(
        string configuredType,
        string expected)
    {
        dynamic rollingUpgradeConfig = new JObject
        {
            ["HDFS"] = new JValue(configuredType)
        };

        var actual = V8McpLogic.NormalizeApplicationAssetHdfsType((object)rollingUpgradeConfig);

        Assert.Equal(expected, actual);
    }

    [Fact]
    public void NormalizeApplicationAssetHdfsType_HandlesObjectShapedLegacyConfig()
    {
        object legacyConfig = new Dictionary<string, object>
        {
            ["HDFS"] = new JValue("MinIO")
        };

        Assert.Equal("MinIO", V8McpLogic.NormalizeApplicationAssetHdfsType(legacyConfig));
    }

    [Fact]
    public void NormalizeApplicationAssetHdfsType_DefaultsToAliyunWhenConfigurationIsMissing()
    {
        Assert.Equal("Aliyun", V8McpLogic.NormalizeApplicationAssetHdfsType(null));
        Assert.Equal("Aliyun", V8McpLogic.NormalizeApplicationAssetHdfsType(new JObject()));
    }

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

    [Fact]
    public void ValidateApplicationAssetContent_AcceptsVerifiedHtmlEntry()
    {
        var bytes = Encoding.UTF8.GetBytes("<!doctype html><html><head></head><body><div id=\"app\"></div></body></html>");
        var sha256 = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

        var error = V8McpLogic.ValidateApplicationAssetContent("index.html", bytes.Length, sha256, bytes, true);

        Assert.Null(error);
    }

    [Theory]
    [InlineData("app.js", "<html><head></head><body></body></html>", "入口必须是 HTML")]
    [InlineData("index.html", "<div id=\"app\"></div>", "不是完整 HTML")]
    public void ValidateApplicationAssetContent_RejectsInvalidEntry(string path, string content, string expected)
    {
        var bytes = Encoding.UTF8.GetBytes(content);

        var error = V8McpLogic.ValidateApplicationAssetContent(path, bytes.Length, "", bytes, true);

        Assert.Contains(expected, error);
    }

    [Fact]
    public void ComputeMicroServiceManifestHash_IsStableAcrossInputOrder()
    {
        var left = JArray.Parse("[{\"Path\":\"index.html\",\"Sha256\":\"aa\",\"Size\":2},{\"Path\":\"assets/app.js\",\"Sha256\":\"bb\",\"Size\":3}]");
        var right = new JArray(left.Reverse());

        Assert.Equal(
            V8McpLogic.ComputeMicroServiceManifestHash(left),
            V8McpLogic.ComputeMicroServiceManifestHash(right));
    }
}

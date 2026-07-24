using System;
using System.Text;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class CodeEditorTransportCodecTests
{
    [Fact]
    public void ExplicitEnvelopeDecodesUnicodeCodeAndRemovesMetadata()
    {
        const string source = "var 名称 = '乐歌';\nreturn { Code: 1, Data: 名称 };";
        var request = new JObject
        {
            ["_FormData"] = new JObject
            {
                ["ApiV8Code"] = CodeEditorTransportCodec.Marker + EncodeBase64Url(source),
                ["Name"] = "接口名称"
            },
            ["_CodeEditorTransport"] = new JObject
            {
                ["Version"] = 1,
                ["Encoding"] = "base64url",
                ["Fields"] = new JArray("ApiV8Code")
            }
        };

        var success = CodeEditorTransportCodec.TryDecodeInPlace(request, out var error, out var count);

        Assert.True(success, error);
        Assert.Equal(1, count);
        Assert.Equal(source, request["_FormData"]?["ApiV8Code"]?.Value<string>());
        Assert.Equal("接口名称", request["_FormData"]?["Name"]?.Value<string>());
        Assert.Null(request["_CodeEditorTransport"]);
    }

    [Fact]
    public void PlaintextRequestsRemainBackwardCompatible()
    {
        var request = new JObject
        {
            ["_FormData"] = new JObject { ["ApiV8Code"] = "return { Code: 1 };" }
        };
        var before = request.ToString();

        var success = CodeEditorTransportCodec.TryDecodeInPlace(request, out var error, out var count);

        Assert.True(success, error);
        Assert.Equal(0, count);
        Assert.Equal(before, request.ToString());
    }

    [Fact]
    public void MalformedEnvelopeFailsWithoutPartiallyMutatingTheRequest()
    {
        var request = new JObject
        {
            ["_FormData"] = new JObject
            {
                ["FirstCode"] = CodeEditorTransportCodec.Marker + EncodeBase64Url("return 1;"),
                ["SecondCode"] = CodeEditorTransportCodec.Marker + "***"
            },
            ["_CodeEditorTransport"] = new JObject
            {
                ["Version"] = 1,
                ["Encoding"] = "base64url",
                ["Fields"] = new JArray("FirstCode", "SecondCode")
            }
        };
        var before = request.ToString();

        var success = CodeEditorTransportCodec.TryDecodeInPlace(request, out var error, out var count);

        Assert.False(success);
        Assert.Contains("SecondCode", error);
        Assert.Equal(0, count);
        Assert.Equal(before, request.ToString());
    }

    private static string EncodeBase64Url(string value)
    {
        return Convert.ToBase64String(Encoding.UTF8.GetBytes(value))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }
}

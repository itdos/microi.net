using System.Reflection;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class FormEngineSearchFieldFormatTests
{
    private static readonly MethodInfo Parser = typeof(FormEngine).GetMethod(
        "ParseSearchFieldIdentifiers", BindingFlags.NonPublic | BindingFlags.Static)
        ?? throw new InvalidOperationException("搜索字段解析方法不存在。");

    private static List<string> Parse(string? json) =>
        (List<string>)Parser.Invoke(null, new object?[] { json })!;

    [Theory]
    [InlineData("[{\"Id\":\"project\",\"Name\":\"ProjectName\"},{\"Id\":\"component\"}]")]
    [InlineData("[\n  {\"Id\":\"project\",\"Name\":\"ProjectName\"},\n  {\"Id\":\"component\"}\n]")]
    [InlineData(" \t[\r\n\t{\"Id\":\"project\"}, {\"Id\":\"component\"}] \r\n")]
    [InlineData("[\"project\", \"component\"]")]
    [InlineData("project,component")]
    [InlineData("\"project\"; component")]
    public void LegacyAndFormattedFields_KeepProjectAndComponentInKeywordSearch(string json)
    {
        Assert.Equal(new[] { "project", "component" }, Parse(json));
        // 用真实解析结果选择查询元数据，防止修复后仍丢失项目名称的搜索列。
        var fields = new[] { new JObject { ["Id"] = "project", ["Name"] = "ProjectName" },
            new JObject { ["Id"] = "component", ["Name"] = "ComponentName" },
            new JObject { ["Id"] = "secret", ["Name"] = "Secret" } };
        Assert.Equal(new[] { "ProjectName", "ComponentName" },
            fields.Where(field => Parse(json).Contains(field.Value<string>("Id")!))
                .Select(field => field.Value<string>("Name")));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" \r\n ")]
    [InlineData("[]")]
    [InlineData("[null,{},\"\",1,true]")]
    public void EmptyOrUnsupportedElements_DoNotInventSearchFields(string? json) => Assert.Empty(Parse(json));

    [Fact]
    public void FieldOptionsRemainUnmodified_AndMixedLegacyIdsAreRecognized()
    {
        const string json = "[\n{\"Id\":\"project\",\"Equal\":false,\"DisplayType\":\"Out\",\"Type\":\"varchar(50)\"},\"component\"]";
        var before = JArray.Parse(json).ToString();
        Assert.Equal(new[] { "project", "component" }, Parse(json));
        Assert.Equal(before, JArray.Parse(json).ToString());
    }

    [Fact]
    public void BrokenJsonFails_WithoutFallingBackToAnUnfilteredSearch()
    {
        var error = Assert.Throws<TargetInvocationException>(() => Parse("[{\"Id\":\"project\"}"));
        Assert.IsAssignableFrom<JsonException>(error.InnerException);
    }
}

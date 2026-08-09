using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Microi.Tests.Common;

public class PageEngineVersioningTests
{
    [Fact]
    public void Snapshot_Hash_Is_Stable_For_Equivalent_Page_Json()
    {
        var left = V8McpLogic.BuildPageEngineSnapshotForTest(new JObject
        {
            ["Id"] = "page-1",
            ["Title"] = "运营看板",
            ["Number"] = "ops",
            ["JsonObj"] = "{\"wrapperList\":[],\"formConfig\":{\"dark\":false}}"
        });
        var right = V8McpLogic.BuildPageEngineSnapshotForTest(new JObject
        {
            ["Number"] = "ops",
            ["Title"] = "运营看板",
            ["Id"] = "page-1",
            ["JsonObj"] = "{\"formConfig\":{\"dark\":false},\"wrapperList\":[]}"
        });

        Assert.Equal(
            V8McpLogic.ComputeBlueprintContentHash(left.ToString(Formatting.None)),
            V8McpLogic.ComputeBlueprintContentHash(right.ToString(Formatting.None)));
    }

    [Fact]
    public void Snapshot_Normalizes_Missing_Page_Collections()
    {
        var snapshot = V8McpLogic.BuildPageEngineSnapshotForTest(new JObject
        {
            ["Id"] = "page-2",
            ["Title"] = "空页面",
            ["JsonObj"] = "{}"
        });

        Assert.Equal("microi.page.v1", snapshot["SchemaVersion"]?.Value<string>());
        Assert.IsType<JObject>(snapshot["Page"]?["JsonObj"]?["formConfig"]);
        Assert.IsType<JArray>(snapshot["Page"]?["JsonObj"]?["wrapperList"]);
    }

    [Fact]
    public void Page_Diff_Uses_Stable_Widget_Identity()
    {
        var left = "{\"wrapperList\":[{\"id\":\"a\",\"value\":1},{\"id\":\"b\",\"value\":2}]}";
        var right = "{\"wrapperList\":[{\"id\":\"b\",\"value\":2},{\"id\":\"a\",\"value\":1}]}";

        var diff = V8McpLogic.BuildBlueprintJsonDiff(left, right);

        Assert.True(diff["Equal"]?.Value<bool>());
        Assert.Equal(0, diff["TotalChanges"]?.Value<int>());
    }

    [Fact]
    public void VersionStoreSql_Uses_Tenant_Selected_DbSession_Without_Nonexistent_OsClient_Column()
    {
        var sourcePath = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..", "..", "..", "..", "Microi.Core", "V8Engine", "V8McpLogic.PageVersioning.cs"));
        var source = File.ReadAllText(sourcePath);

        Assert.Contains("BpDbRead(osClient)", source, StringComparison.Ordinal);
        Assert.Contains("BpDbWrite(osClient)", source, StringComparison.Ordinal);
        Assert.DoesNotContain("`OsClient`", source, StringComparison.Ordinal);
        Assert.Equal(2, source.Split("(`Id`,`ResourceType`", StringSplitOptions.None).Length - 1);
    }
}

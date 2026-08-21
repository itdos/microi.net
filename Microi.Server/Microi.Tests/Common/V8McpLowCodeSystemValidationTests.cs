using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class V8McpLowCodeSystemValidationTests
{
    [Fact]
    public void ValidationRows_ProjectDynamicJValuePropertiesToStronglyTypedJObjects()
    {
        dynamic relationField = new JObject
        {
            ["Id"] = new JValue("field-id"),
            ["TableId"] = new JValue("table-id"),
            ["Name"] = new JValue("Items"),
            ["Component"] = new JValue("TableChild"),
            ["Config"] = new JValue("{\"TableChildTableId\":\"child-id\"}")
        };

        List<JObject> rows = V8McpLogic.NormalizeLowCodeValidationRows(
            (object)new List<dynamic> { relationField });

        JObject row = Assert.Single(rows);
        Assert.IsType<JValue>(row["Component"]);
        Assert.Equal("Items", row["Name"]?.ToString());
        Assert.Equal("TableChild", row["Component"]?.ToString());
    }

    [Fact]
    public void ValidateLowCodeSystem_DoesNotUseDynamicJValueExtensions()
    {
        var sourcePath = Path.Combine(
            FindServerRoot(),
            "Microi.Core/V8Engine/V8McpLogic.cs");
        var source = File.ReadAllText(sourcePath);
        var start = source.IndexOf(
            "public static async Task<DosResult<object>> ValidateLowCodeSystem",
            StringComparison.Ordinal);
        var end = source.IndexOf(
            "public static async Task<DosResult<object>> WriteMcpAuditLog",
            start,
            StringComparison.Ordinal);

        Assert.True(start >= 0, "未找到 ValidateLowCodeSystem 源码");
        Assert.True(end > start, "未找到 ValidateLowCodeSystem 的结束边界");
        var methodSource = source[start..end];

        Assert.Contains("List<JObject> tables", methodSource);
        Assert.Contains("List<JObject> fields", methodSource);
        Assert.Contains("NormalizeLowCodeValidationRows((object)tableResult.Data)", methodSource);
        Assert.Contains("NormalizeLowCodeValidationRows((object)fieldResult.Data)", methodSource);
        Assert.Contains("JObject engineRow = JObject.FromObject((object)engineResult.Data)", methodSource);
        Assert.DoesNotContain(".Val<", methodSource);
        Assert.DoesNotContain("new List<dynamic>()", methodSource);
        Assert.DoesNotContain("JObject.FromObject(relationFieldModel)", methodSource);
    }

    private static string FindServerRoot()
    {
        for (var current = new DirectoryInfo(AppContext.BaseDirectory);
             current != null;
             current = current.Parent)
        {
            var direct = Path.Combine(current.FullName, "Microi.Core", "V8Engine", "V8McpLogic.cs");
            if (File.Exists(direct)) return current.FullName;

            var nested = Path.Combine(current.FullName, "Microi.Server", "Microi.Core", "V8Engine", "V8McpLogic.cs");
            if (File.Exists(nested)) return Path.Combine(current.FullName, "Microi.Server");
        }

        throw new DirectoryNotFoundException("未找到 Microi.Server 源码根目录");
    }
}

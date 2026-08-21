using Microi.net;

namespace Dos.Common.Tests;

public class ApiEngineChangeHistoryTests
{
    [Fact]
    public void EntryKey_IsStableAndSeparatesVersionSummaryAndCode()
    {
        var first = V8McpLogic.BuildApiEngineChangeHistoryEntryKey(
            "engine-1", "v1.2.3", "修复登录校验", "return { Code: 1 }; ");
        var repeated = V8McpLogic.BuildApiEngineChangeHistoryEntryKey(
            "engine-1", "v1.2.3", "修复登录校验", "return { Code: 1 }; ");
        var changed = V8McpLogic.BuildApiEngineChangeHistoryEntryKey(
            "engine-1", "v1.2.4", "修复登录校验", "return { Code: 1 }; ");

        Assert.Equal(first, repeated);
        Assert.NotEqual(first, changed);
        Assert.Equal(64, first.Length);
        Assert.Matches("^[0-9a-f]{64}$", first);
    }

    [Fact]
    public void McpAndController_PreferTableChildSummaryWithLegacyFallback()
    {
        var serverRoot = FindServerRoot();
        var mcpSource = File.ReadAllText(Path.Combine(
            serverRoot, "Microi.Core", "V8Engine", "V8McpLogic.cs"));
        var controllerSource = File.ReadAllText(Path.Combine(
            serverRoot, "Microi.net.Api", "Controllers", "V8EngineController.cs"));

        Assert.Contains("mci_apiengine_change_history", mcpSource, StringComparison.Ordinal);
        Assert.Contains("ChangeHistoryStorage", mcpSource, StringComparison.Ordinal);
        Assert.Contains("AppendLegacyApiEngineChangeHistory", mcpSource, StringComparison.Ordinal);
        Assert.Contains("已取消兼容字段回退写入", mcpSource, StringComparison.Ordinal);
        Assert.Contains("object createdEngineIdValue", mcpSource, StringComparison.Ordinal);
        Assert.Contains("string createdEngineId = SafeString(createdEngineIdValue)", mcpSource, StringComparison.Ordinal);
        Assert.DoesNotContain("var createdEngineId = createdEngine.Code", mcpSource, StringComparison.Ordinal);
        Assert.Contains("ChangeSummary", controllerSource, StringComparison.Ordinal);
        Assert.Contains("ChangeHistory", controllerSource, StringComparison.Ordinal);
    }

    private static string FindServerRoot()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            foreach (var candidate in new[]
                     {
                         current.FullName,
                         Path.Combine(current.FullName, "Microi.Server")
                     })
            {
                if (File.Exists(Path.Combine(
                        candidate, "Microi.Core", "V8Engine", "V8McpLogic.cs"))
                    && File.Exists(Path.Combine(
                        candidate, "Microi.net.Api", "Controllers", "V8EngineController.cs")))
                {
                    return candidate;
                }
            }

            current = current.Parent;
        }

        throw new DirectoryNotFoundException("未找到 Microi.Server 根目录");
    }
}

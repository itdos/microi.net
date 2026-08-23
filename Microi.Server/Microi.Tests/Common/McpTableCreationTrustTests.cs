using Microi.net;

namespace Microi.Tests.Common;

public class McpTableCreationTrustTests
{
    [Fact]
    public void ReservedOsClientField_RequiresTheCompleteTrustedSystemShape()
    {
        Assert.True(FormEngineExtend.CanAddTrustedOsClientField(
            "OsClient", "varchar(50)", "Text", true, 0, 0, 1, 1));

        Assert.False(FormEngineExtend.CanAddTrustedOsClientField(
            "OsClient", "varchar(50)", "Text", false, 0, 0, 1, 1));
        Assert.False(FormEngineExtend.CanAddTrustedOsClientField(
            "OsClient", "varchar(50)", "Text", true, 1, 0, 1, 1));
        Assert.False(FormEngineExtend.CanAddTrustedOsClientField(
            "OsClient", "varchar(50)", "Text", true, 0, 0, 0, 1));
        Assert.False(FormEngineExtend.CanAddTrustedOsClientField(
            "OsClient", "mediumtext", "Text", true, 0, 0, 1, 1));
        Assert.False(FormEngineExtend.CanAddTrustedOsClientField(
            "TableId", "varchar(50)", "Text", true, 0, 0, 1, 1));
    }

    [Fact]
    public void CreateTable_ForwardsTrustedServerProvenanceWithStrongType()
    {
        var sourcePath = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..", "..", "..", "..", "Microi.Core", "V8Engine", "V8McpLogic.cs"));
        var source = File.ReadAllText(sourcePath);
        var createTableStart = source.IndexOf("public static async Task<DosResult<object>> CreateTable", StringComparison.Ordinal);
        Assert.True(createTableStart >= 0);
        var createTableEnd = source.IndexOf("public static async Task<DosResult<object>>", createTableStart + 80, StringComparison.Ordinal);
        var method = createTableEnd > createTableStart
            ? source.Substring(createTableStart, createTableEnd - createTableStart)
            : source.Substring(createTableStart);

        Assert.Contains("new DiyTableParam", method);
        Assert.Contains("_TrustedServerInvocation = true", method);
        Assert.Contains("_InvokeType = InvokeType.Server.ToString()", method);
        Assert.Contains("AddTableAsync(tableData)", method);
        Assert.DoesNotContain("AddTableAsync(JsonHelper.ToJObject", method);
    }
}

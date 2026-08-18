using Microi.net;

namespace Microi.Tests.Common;

public sealed class TableIndexRecommendationTests
{
    [Fact]
    public void TenantDatabaseWithoutOsClient_OnlyUsesPhysicalColumns()
    {
        var result = V8McpLogic.BuildAutoIndexSpecifications(
            new[] { "ApiName", "ApiKey", "MissingMetadataField" },
            "CreateTime",
            new[] { "Id", "ApiName", "ApiKey", "CreateTime" });

        Assert.Equal(new[] { "ApiName", "CreateTime" }, result[0]);
        Assert.Equal(new[] { "ApiKey" }, result[1]);
        Assert.DoesNotContain(result.SelectMany(columns => columns),
            column => column.Equals("OsClient", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(result.SelectMany(columns => columns),
            column => column.Equals("MissingMetadataField", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void SharedTableWithOsClient_KeepsTenantAsLeftmostPrefix()
    {
        var result = V8McpLogic.BuildAutoIndexSpecifications(
            new[] { "ApiName", "ApiKey" },
            "CreateTime",
            new[] { "Id", "OsClient", "ApiName", "ApiKey", "CreateTime" });

        Assert.Equal(new[] { "OsClient", "ApiName", "CreateTime" }, result[0]);
        Assert.Equal(new[] { "OsClient", "ApiKey" }, result[1]);
    }

    [Theory]
    [InlineData("varchar", "varchar(200)", 200L, true)]
    [InlineData("datetime", "datetime", null, true)]
    [InlineData("text", "text", 65535L, false)]
    [InlineData("longtext", "longtext", 4294967295L, false)]
    [InlineData("json", "json", null, false)]
    [InlineData("nvarchar", "nvarchar(max)", -1L, false)]
    [InlineData("varchar", "varchar(1024)", 1024L, false)]
    public void AutoIndexability_RejectsLongOrProviderSpecificTypes(
        string dataType,
        string columnType,
        long? maximumLength,
        bool expected)
    {
        Assert.Equal(expected, V8McpLogic.IsDirectlyIndexableColumn(
            dataType,
            columnType,
            maximumLength));
    }
}

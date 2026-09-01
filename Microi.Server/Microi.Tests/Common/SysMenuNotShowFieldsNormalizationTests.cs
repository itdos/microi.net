using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class SysMenuNotShowFieldsNormalizationTests
{
    [Fact]
    public void NormalizeNotShowFields_RemovesNullBlankAndInvalidEntries()
    {
        var normalized = SysMenuConfigurationNormalizer.NormalizeNotShowFields(
            "[null,\"\",\"  \",1,false,[],{},"
            + "{\"Label\":\"invalid\"},\" FieldA \","
            + "{\"Name\":\" FieldB \",\"Label\":\"字段 B\"},"
            + "{\"Id\":\" field-c \",\"Name\":\"\"}]");

        Assert.Equal(
            "[\"FieldA\",{\"Name\":\"FieldB\",\"Label\":\"字段 B\"},{\"Id\":\"field-c\"}]",
            normalized);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-json")]
    [InlineData("{\"Name\":\"not-an-array\"}")]
    public void NormalizeNotShowFields_FailsClosedForMalformedRoots(string? rawValue)
    {
        Assert.Equal("[]", SysMenuConfigurationNormalizer.NormalizeNotShowFields(rawValue));
    }

    [Fact]
    public void NormalizeNotShowFieldsInRow_RepairsPersistedMenuValueInPlace()
    {
        var row = new JObject
        {
            ["Id"] = "menu-1",
            ["NotShowFields"] = "[null,\"Code\",{\"Name\":\"Name\"},{}]"
        };

        Assert.True(SysMenuConfigurationNormalizer.NormalizeNotShowFieldsInRow(row));
        Assert.Equal("[\"Code\",{\"Name\":\"Name\"}]", row["NotShowFields"]?.ToString());
    }

    [Fact]
    public void RowBoundary_OnlyNormalizesSysMenu()
    {
        var menu = new JObject { ["NotShowFields"] = "[null,\"Code\"]" };
        var other = (JObject)menu.DeepClone();

        SysMenuConfigurationNormalizer.NormalizeRowForReturn(menu, "SYS_MENU");
        SysMenuConfigurationNormalizer.NormalizeRowForReturn(other, "other_table");

        Assert.Equal("[\"Code\"]", menu["NotShowFields"]?.ToString());
        Assert.Equal("[null,\"Code\"]", other["NotShowFields"]?.ToString());
    }
}

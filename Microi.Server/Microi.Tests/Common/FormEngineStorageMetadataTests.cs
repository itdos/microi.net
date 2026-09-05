using System.Dynamic;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class FormEngineStorageMetadataTests
{
    private sealed class Accessor : FormEngineExtend
    {
        public static JObject? Normalize(object? value) => NormalizeDiyTableStorageMetadata(value!);
    }

    [Fact]
    public void ColdGuidRowAndWarmJsonCacheExposeIdenticalStringIdentifiers()
    {
        var id = Guid.NewGuid();
        var extensionId = Guid.NewGuid();
        dynamic cold = new ExpandoObject();
        cold.Id = id;
        cold.DataBaseId = extensionId;
        cold.Name = "diy_table";
        cold.Visible = 1;
        cold.Config = new { Token = "preserved" };
        dynamic normalized = Accessor.Normalize((object)cold)!;
        Assert.Equal(id.ToString("D"), (string)normalized.Id);
        Assert.Equal(extensionId.ToString("D"), (string)normalized.DataBaseId);
        var warm = Accessor.Normalize(JsonConvert.DeserializeObject<JObject>(JsonConvert.SerializeObject(normalized)))!;
        Assert.True(JToken.DeepEquals((JObject)normalized, warm));
        Assert.IsType<Guid>((object)cold.Id);
        Assert.Equal(1, (int)warm["Visible"]!);
        Assert.Equal("preserved", (string?)warm["Config"]?["Token"]);
    }

    [Fact]
    public void StringUlidNullDatabaseAndTenantConfigurationRemainUnchanged()
    {
        var source = JObject.Parse("{\"Id\":\"01M1V9KP1J3Q7V017XM13MH7KK\",\"DataBaseId\":null,\"OsClient\":\"Customer-A\",\"Config\":{\"Enabled\":false}}");
        var result = Accessor.Normalize(source)!;
        Assert.True(JToken.DeepEquals(source, result));
        Assert.NotSame(source, result);
        Assert.Null(Accessor.Normalize(null));
    }
}

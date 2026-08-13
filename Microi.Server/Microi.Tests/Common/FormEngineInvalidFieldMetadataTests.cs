using System.Reflection;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class FormEngineInvalidFieldMetadataTests
{
    [Fact]
    public void FindDiyFieldByName_SkipsRowsWithoutAName()
    {
        var invalid = new JObject
        {
            ["Id"] = "invalid-field",
            ["Name"] = JValue.CreateNull()
        };
        var expected = new JObject
        {
            ["Id"] = "valid-field",
            ["Name"] = "VectorTopK"
        };
        var fields = new List<JObject> { invalid, expected };

        var result = InvokeFind(fields, "vectortopk");

        Assert.Same(expected, result);
    }

    [Fact]
    public void FindDiyFieldByName_ReturnsNullWhenOnlyInvalidRowsExist()
    {
        var fields = new List<JObject>
        {
            new()
            {
                ["Id"] = "invalid-field",
                ["Name"] = ""
            }
        };

        Assert.Null(InvokeFind(fields, "VectorTopK"));
    }

    private static JObject? InvokeFind(IEnumerable<JObject> fields, string name)
    {
        var method = typeof(FormEngine).GetMethod(
            "FindDiyFieldByName",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return method!.Invoke(null, new object[] { fields, name }) as JObject;
    }
}

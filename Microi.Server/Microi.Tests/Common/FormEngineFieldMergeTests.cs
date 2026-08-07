using System.Reflection;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class FormEngineFieldMergeTests
{
    [Fact]
    public void DesignerPatch_IgnoresNullForNonNullableValueTypes()
    {
        var patch = Normalize(new JObject
        {
            ["NotEmpty"] = JValue.CreateNull(),
            ["Visible"] = JValue.CreateNull(),
            ["FormWidth"] = JValue.CreateNull(),
            ["Description"] = JValue.CreateNull()
        });

        Assert.Null(patch.Property("NotEmpty"));
        Assert.Null(patch.Property("Visible"));
        Assert.Equal(JTokenType.Null, patch["FormWidth"]!.Type);
        Assert.Equal(JTokenType.Null, patch["Description"]!.Type);
    }

    private static JObject Normalize(JObject source)
    {
        var method = typeof(FormEngineExtend).GetMethod(
            "NormalizeDiyFieldPatchForMerge",
            BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return Assert.IsType<JObject>(method!.Invoke(null, new object[] { source }));
    }
}

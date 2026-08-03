using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

public class TableChildFieldRelationCompatibilityTests
{
    [Fact]
    public void HistoricalSettingsMergeWithoutTurningEveryBackfillIntoAnImportMatch()
    {
        var config = JsonConvert.DeserializeObject<DiyFieldConfig>("""
            {
              "TableChildCallbackField":"[{\"Father\":\"Code\",\"Child\":\"XiangmuBM\"},{\"Father\":\"Name\",\"Child\":\"XiangmuMC\"}]",
              "TableChild":{
                "ImportRelations":[{"Parent":"Code","Child":"XiangmuBM"}],
                "ImportBackfillFields":[{"Parent":"Code","Child":"XiangmuBM"},{"Parent":"Name","Child":"XiangmuMC"}]
              }
            }
            """)!;

        var relations = DiyTableChildFieldRelationHelper.GetRelations(config);

        Assert.Collection(
            relations,
            code =>
            {
                Assert.Equal("Code", code.ParentField);
                Assert.Equal("XiangmuBM", code.ChildField);
                Assert.True(code.ImportMatch);
            },
            name =>
            {
                Assert.Equal("Name", name.ParentField);
                Assert.Equal("XiangmuMC", name.ChildField);
                Assert.False(name.ImportMatch);
            });
    }

    [Fact]
    public void CompactSettingsAreReadableAndRemainCompactWhenProjected()
    {
        var config = JsonConvert.DeserializeObject<DiyFieldConfig>("""
            {"TableChild":{"FieldRelations":[["Code","XiangmuBM",true],["Name","XiangmuMC"]]}}
            """)!;

        var relations = DiyTableChildFieldRelationHelper.GetRelations(config);
        var compact = DiyTableChildFieldRelationHelper.ToCompactArray(relations);

        Assert.True(JToken.DeepEquals(
            JArray.Parse("[[\"Code\",\"XiangmuBM\",true],[\"Name\",\"XiangmuMC\"]]"),
            compact));
    }
}

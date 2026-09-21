using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class WhereParserMixedFormatTests
{
    [Theory]
    [InlineData("[[\"B.Leixing\",\"=\",\"维修\"],{\"Name\":\"KehuSBID\",\"Type\":\"=\",\"Value\":\"device-1\"}]")]
    [InlineData("[{\"Name\":\"KehuSBID\",\"Type\":\"=\",\"Value\":\"device-1\"},[\"B.Leixing\",\"=\",\"维修\"]]")]
    public void ParseWhere_PreservesEveryConditionInMixedFormat(string json)
    {
        // zhy：无论新旧格式条件的排列顺序如何，关联筛选和父子外键都不能被静默丢弃。
        var result = WhereParser.ParseWhere(JArray.Parse(json));

        Assert.Equal(2, result.Count);
        Assert.Contains(result, item => item.FormEngineKey == "B" && item.Name == "Leixing" && item.Type == "=" && Convert.ToString(item.Value) == "维修");
        Assert.Contains(result, item => item.Name == "KehuSBID" && item.Type == "=" && Convert.ToString(item.Value) == "device-1");
    }
}

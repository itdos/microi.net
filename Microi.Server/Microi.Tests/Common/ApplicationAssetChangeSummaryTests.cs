using System.Reflection;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

/// <summary>发布说明是首次创建版本的普通文本，不能改变状态机、指纹或恢复事实。</summary>
public class ApplicationAssetChangeSummaryTests
{
    private static object? Call(string method, params object?[] args)
        => typeof(V8McpLogic).GetMethod(method, BindingFlags.NonPublic | BindingFlags.Static)!.Invoke(null, args);

    private static JObject Request() => new()
    {
        ["ProtocolVersion"] = 3, ["PublishMode"] = "stage", ["ExpectedGateEpoch"] = "2",
        ["ExpectedPublishRowVersion"] = "0", ["ExpectedVersionRowVersion"] = JValue.CreateNull(),
        ["ExpectedPublishFence"] = "0", ["ExpectedActivePublishVersionId"] = JValue.CreateNull(),
        ["ExpectedCommittedPublishVersionId"] = JValue.CreateNull(), ["ExpectedCurrentVersion"] = 1,
        ["ExpectedAppVersion"] = "v1.0.0", ["RequestId"] = "summary-test-request",
        ["RequestFingerprint"] = new string('a', 64), ["DeliveryBatchId"] = "summary-test-batch",
        ["SourceManifestHash"] = new string('b', 64), ["RuntimeManifestHash"] = new string('c', 64),
        ["RouteSnapshotJson"] = "[]", ["RouteSnapshotHash"] = "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945"
    };

    private static object Parse(JObject param)
    {
        object?[] args = { param, null };
        Assert.Null(Call("ParseApplicationAssetV3ProtocolRequest", args));
        return args[1]!;
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" \t\r\n")]
    public void LegacyOmittedNullAndBlankSummaryRemainCompatible(string? summary)
    {
        var param = Request();
        if (summary != null) param["ChangeSummary"] = summary;
        var request = Parse(param);
        Assert.Equal("二进制流式发布", request.GetType().GetProperty("ChangeSummary")!.GetValue(request));
        param["ChangeSummary"] = JValue.CreateNull();
        Assert.Equal("二进制流式发布", Parse(param).GetType().GetProperty("ChangeSummary")!.GetValue(Parse(param)));
    }

    [Theory]
    [InlineData("true")]
    [InlineData("123")]
    [InlineData("[]")]
    [InlineData("{\"Status\":\"Completed\",\"PublishFence\":99}")]
    public void StructuredValuesCannotBeTreatedAsVersionMetadata(string json)
    {
        var param = Request(); param["ChangeSummary"] = JToken.Parse(json);
        Assert.Contains("ChangeSummary 必须是字符串或 null", V8McpLogic.ValidateApplicationAssetV3ProtocolRequest(param));
    }

    [Theory]
    [InlineData(2000, true)]
    [InlineData(2001, false)]
    public void SummaryLengthIsBoundedBeforePersistence(int length, bool allowed)
    {
        var param = Request(); param["ChangeSummary"] = new string('文', length);
        var error = V8McpLogic.ValidateApplicationAssetV3ProtocolRequest(param);
        if (allowed) Assert.Null(error); else Assert.Contains("ChangeSummary 最多 2000", error);
    }

    [Fact]
    public void ParsedPublisherTextSurvivesVersionSnapshotWithoutChangingStateOrProof()
    {
        const string summary = "新增公开页面。\n保留单引号 ' 与 <示例>；它们只是文本。";
        var param = Request(); param["ChangeSummary"] = summary;
        var request = Parse(param);
        var planType = typeof(V8McpLogic).GetNestedType("ApplicationAssetV3PublishPlan", BindingFlags.NonPublic)!;
        var plan = Activator.CreateInstance(planType, true)!;
        planType.GetProperty("VersionNo")!.SetValue(plan, "v1.0.1");
        var log = (JObject)Call("BuildApplicationAssetV3BuildLog", request, plan)!;
        var snapshot = (JObject)Call("BuildApplicationAssetV3VersionSnapshot", "version-test", "app-test", request,
            plan, log.ToString(), 1L, 1L, V8McpLogic.ApplicationAssetV3PublishState.Verifying)!;
        Assert.Equal(summary, snapshot.Value<string>("ChangeSummary"));
        Assert.Equal("Verifying", snapshot.Value<string>("Status"));
        Assert.Equal(1L, snapshot.Value<long>("FencingToken"));
        // 展示字段不加入不可变证明：滚动升级后旧冻结任务仍能恢复。
        Assert.Null(log["ChangeSummary"]);
        param["ChangeSummary"] = "另一段展示说明";
        Assert.True(JToken.DeepEquals(log, (JObject)Call("BuildApplicationAssetV3BuildLog", Parse(param), plan)!));
        Assert.Equal(summary, snapshot.Value<string>("ChangeSummary"));
    }
}

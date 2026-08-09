using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class BlueprintVersioningTests
{
    [Fact]
    public void ContentHash_IsStableAcrossObjectPropertyOrder()
    {
        const string left = "{\"name\":\"demo\",\"metadata\":{\"b\":2,\"a\":1}}";
        const string right = "{\"metadata\":{\"a\":1,\"b\":2},\"name\":\"demo\"}";

        Assert.Equal(
            V8McpLogic.ComputeBlueprintContentHash(left),
            V8McpLogic.ComputeBlueprintContentHash(right));
    }

    [Fact]
    public void SemanticDiff_MatchesBlueprintNodesByStableIdentity()
    {
        const string left = """
        {
          "diagrams": [
            { "id": "main", "nodes": [
              { "id": "customer", "label": "客户", "refs": { "tables": ["crm_customer"] } },
              { "id": "order", "label": "订单", "refs": { "tables": ["crm_order"] } }
            ] }
          ]
        }
        """;
        const string right = """
        {
          "diagrams": [
            { "id": "main", "nodes": [
              { "id": "order", "label": "销售订单", "refs": { "tables": ["crm_order"] } },
              { "id": "customer", "label": "客户", "refs": { "tables": ["crm_customer"] } }
            ] }
          ]
        }
        """;

        var diff = V8McpLogic.BuildBlueprintJsonDiff(left, right);

        Assert.False(diff.Value<bool>("Equal"));
        Assert.Equal(1, diff.Value<int>("Changed"));
        Assert.Equal(0, diff.Value<int>("Added"));
        Assert.Equal(0, diff.Value<int>("Removed"));
        var change = Assert.IsType<JObject>(Assert.Single(Assert.IsType<JArray>(diff["Changes"])));
        Assert.Equal("/diagrams[id=main]/nodes[id=order]/label", change.Value<string>("Path"));
        Assert.Equal("订单", change["Before"]?.Value<string>());
        Assert.Equal("销售订单", change["After"]?.Value<string>());
    }

    [Fact]
    public void SemanticDiff_DoesNotTreatStableObjectReorderingAsAChange()
    {
        const string left = "{\"nodes\":[{\"id\":\"a\",\"label\":\"A\"},{\"id\":\"b\",\"label\":\"B\"}]}";
        const string right = "{\"nodes\":[{\"id\":\"b\",\"label\":\"B\"},{\"id\":\"a\",\"label\":\"A\"}]}";

        var diff = V8McpLogic.BuildBlueprintJsonDiff(left, right);

        Assert.True(diff.Value<bool>("Equal"));
        Assert.Equal(0, diff.Value<int>("TotalChanges"));
    }

    [Fact]
    public void SemanticDiff_ReportsAddedAndRemovedIdentityItems()
    {
        const string left = "{\"nodes\":[{\"id\":\"a\",\"label\":\"A\"},{\"id\":\"b\",\"label\":\"B\"}]}";
        const string right = "{\"nodes\":[{\"id\":\"b\",\"label\":\"B\"},{\"id\":\"c\",\"label\":\"C\"}]}";

        var diff = V8McpLogic.BuildBlueprintJsonDiff(left, right);

        Assert.Equal(1, diff.Value<int>("Added"));
        Assert.Equal(1, diff.Value<int>("Removed"));
        Assert.Equal(2, diff.Value<int>("TotalChanges"));
        var paths = Assert.IsType<JArray>(diff["Changes"])
            .OfType<JObject>()
            .Select(item => item.Value<string>("Path"))
            .ToArray();
        Assert.Contains("/nodes[id=a]", paths);
        Assert.Contains("/nodes[id=c]", paths);
    }

    [Fact]
    public void SemanticDiff_BoundsReturnedChangesButKeepsFullCounts()
    {
        var left = new JObject
        {
            ["values"] = new JArray(Enumerable.Range(0, 20))
        }.ToString();
        var right = new JObject
        {
            ["values"] = new JArray(Enumerable.Range(100, 20))
        }.ToString();

        var diff = V8McpLogic.BuildBlueprintJsonDiff(left, right, 3);

        Assert.Equal(20, diff.Value<int>("TotalChanges"));
        Assert.Equal(3, diff.Value<int>("ReturnedChanges"));
        Assert.True(diff.Value<bool>("Truncated"));
    }

    [Theory]
    [InlineData(0, 20, "LIMIT 20 OFFSET 0")]
    [InlineData(-1, 0, "LIMIT 1 OFFSET 0")]
    [InlineData(35, 500, "LIMIT 100 OFFSET 35")]
    public void PaginationClause_UsesValidatedNumericLiterals(
        int offset,
        int pageSize,
        string expected)
    {
        var clause = V8McpLogic.BuildSafePaginationClause(offset, pageSize);

        Assert.Equal(expected, clause);
        Assert.DoesNotContain("'", clause);
        Assert.DoesNotContain("?", clause);
    }

    [Fact]
    public void RollbackNoOp_RequiresEquivalentContentAndVersion()
    {
        const string current = "{\"nodes\":[{\"id\":\"a\",\"label\":\"客户\"}],\"meta\":{\"b\":2,\"a\":1}}";
        const string same = "{\"meta\":{\"a\":1,\"b\":2},\"nodes\":[{\"label\":\"客户\",\"id\":\"a\"}]}";
        const string changed = "{\"nodes\":[{\"id\":\"a\",\"label\":\"订单\"}]}";

        Assert.True(V8McpLogic.IsBlueprintRollbackNoOp(current, same, "1.2", "1.2"));
        Assert.False(V8McpLogic.IsBlueprintRollbackNoOp(current, same, "1.2", "1.3"));
        Assert.False(V8McpLogic.IsBlueprintRollbackNoOp(current, changed, "1.2", "1.2"));
    }
}

using System.Diagnostics;
using Microi.net;

namespace Dos.Common.Tests;

public class FieldOptionTreeBuilderTests
{
    private static IDictionary<string, object> Row(string id, string? parent) =>
        new Dictionary<string, object> { ["Id"] = id, ["ParentId"] = parent! };

    [Fact]
    public void LargeTree_PreservesEveryNodeAndCompletesWithoutQuadraticScan()
    {
        var rows = new List<IDictionary<string, object>>();
        var roots = new List<IDictionary<string, object>>();
        for (var i = 0; i < 3000; i++)
        {
            var root = Row($"root-{i}", null);
            rows.Add(root);
            roots.Add(root);
            for (var j = 0; j < 12; j++) rows.Add(Row($"child-{i}-{j}", $"root-{i}"));
        }
        var watch = Stopwatch.StartNew();
        FieldOptionTreeBuilder.Populate(roots, rows, "ParentId", "_Child", "_Leaf");
        Assert.True(watch.Elapsed < TimeSpan.FromSeconds(5), $"构建 39,000 个节点耗时 {watch.Elapsed}");
        Assert.Equal(36000, roots.Sum(row => Assert.IsType<List<IDictionary<string, object>>>(row["_Child"]).Count));
        Assert.Equal("child-2999-11", ((List<IDictionary<string, object>>)roots[^1]["_Child"])[^1]["Id"]);
        Assert.False((bool)roots[0]["_Leaf"]);
        Assert.True((bool)rows[1]["_Leaf"]);
    }

    [Fact]
    public void CustomKeysAndCasing_PreserveHierarchyAndExistingLeafKey()
    {
        var parent = new Dictionary<string, object> { ["id"] = "A", ["pid"] = DBNull.Value, ["leaf"] = true };
        var child = new Dictionary<string, object> { ["id"] = "B", ["pid"] = "A" };
        FieldOptionTreeBuilder.Populate([parent], [parent, child], "PID", "Children", "Leaf");
        Assert.False((bool)parent["leaf"]);
        Assert.False(parent.ContainsKey("Leaf"));
        Assert.Same(child, Assert.IsType<List<IDictionary<string, object>>>(parent["Children"])[0]);
        Assert.True((bool)child["Leaf"]);
    }

    [Fact]
    public void CyclesAndExcessiveDepth_FailWithDiagnosticInsteadOfRecursingForever()
    {
        var cycle = Row("A", "A");
        Assert.Throws<InvalidOperationException>(() =>
            FieldOptionTreeBuilder.Populate([cycle], [cycle], "ParentId", "_Child", "_Leaf"));
        var chain = Enumerable.Range(0, 140).Select(i => Row(i.ToString(), i == 0 ? null : (i - 1).ToString())).ToList();
        Assert.Throws<InvalidOperationException>(() =>
            FieldOptionTreeBuilder.Populate([chain[0]], chain, "ParentId", "_Child", "_Leaf"));
    }

    [Fact]
    public void MissingIdentity_DoesNotAttachAllEmptyParentRootsToItself()
    {
        var root = Row("", "");
        FieldOptionTreeBuilder.Populate([root], [root], "ParentId", "_Child", "_Leaf");
        Assert.True((bool)root["_Leaf"]);
        Assert.False(root.ContainsKey("_Child"));
    }
}

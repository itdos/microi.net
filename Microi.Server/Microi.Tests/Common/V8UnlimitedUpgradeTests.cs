using Microi.net;

namespace Microi.Tests.Common;

public class V8UnlimitedUpgradeTests
{
    [Fact]
    public void Upgrade27_PreservesCustomInFormCodeAndAddsOneManagedVisibilityBlock()
    {
        const string custom = "V8.FieldSet('LockKey', 'Visible', !!V8.Form.Lock);";

        var result = Upgrade27.ReconcileApiEngineInFormV8(custom, out var changed);

        Assert.True(changed);
        Assert.StartsWith(custom, result, StringComparison.Ordinal);
        Assert.Equal(1, Count(result, Upgrade27.BeginMarker));
        Assert.Equal(1, Count(result, Upgrade27.EndMarker));
        Assert.Contains("MaxStatements: 50000000", result, StringComparison.Ordinal);
        Assert.Contains("LimitRecursion: 2000", result, StringComparison.Ordinal);
        Assert.Equal("6.9.8.2", Upgrade27.Version);
    }

    [Fact]
    public void Upgrade27_InFormReconciliationIsIdempotent()
    {
        var once = Upgrade27.ReconcileApiEngineInFormV8("var keep = 1;", out var firstChanged);
        var twice = Upgrade27.ReconcileApiEngineInFormV8(once, out var secondChanged);

        Assert.True(firstChanged);
        Assert.False(secondChanged);
        Assert.Equal(once, twice);
        Assert.Equal(1, Count(twice, Upgrade27.BeginMarker));
    }

    [Fact]
    public void Upgrade27_RejectsAnIncompleteManagedBlockWithoutOverwritingCustomCode()
    {
        Assert.Throws<FormatException>(() =>
            Upgrade27.ReconcileApiEngineInFormV8(
                "var keep = 1;\n" + Upgrade27.BeginMarker,
                out _));
    }

    private static int Count(string value, string needle)
    {
        var count = 0;
        var index = 0;
        while ((index = value.IndexOf(needle, index, StringComparison.Ordinal)) >= 0)
        {
            count++;
            index += needle.Length;
        }
        return count;
    }
}

using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class DiyLangKeyHashPhaseATests
{
    [Fact]
    public void KeyHash_NormalizesKeyAndProducesLowercaseSha256Hex()
    {
        var hash = FormEngineExtend.BuildDiyLangKeyHash("  Sys_Menu:Example  ");

        Assert.Equal(
            "592badf9c668bc0dfc1fe16d6832f11bf967f28c777a6d7649b0dc3899724703",
            hash);
        Assert.Equal(hash, FormEngineExtend.BuildDiyLangKeyHash("sys_menu:example"));
        Assert.Matches("^[0-9a-f]{64}$", hash);
    }

    [Fact]
    public void PhysicalColumnGate_LeavesRowUnchangedWhenSchemaIsUnknownOrColumnIsAbsent()
    {
        var unknownSchemaRow = new JObject
        {
            ["Key"] = "  Sys_Menu:Example  ",
            ["ZhCN"] = "示例"
        };
        var original = unknownSchemaRow.ToString(Formatting.None);

        Assert.False(FormEngineExtend.ApplyDiyLangKeyHashForPhysicalColumns(
            unknownSchemaRow,
            null));
        Assert.Equal(original, unknownSchemaRow.ToString(Formatting.None));

        var legacyColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Id", "Key", "ZhCN"
        };
        Assert.False(FormEngineExtend.ApplyDiyLangKeyHashForPhysicalColumns(
            unknownSchemaRow,
            legacyColumns));
        Assert.Equal(original, unknownSchemaRow.ToString(Formatting.None));
        Assert.Null(unknownSchemaRow.Property("KeyHash"));
    }

    [Fact]
    public void PhysicalColumnGate_WritesHashWhenKeyHashColumnExists()
    {
        var row = new JObject
        {
            ["Key"] = "  Sys_Menu:Example  "
        };
        var expandedColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Id", "Key", "keyhash"
        };

        Assert.True(FormEngineExtend.ApplyDiyLangKeyHashForPhysicalColumns(
            row,
            expandedColumns));
        Assert.Equal(
            "592badf9c668bc0dfc1fe16d6832f11bf967f28c777a6d7649b0dc3899724703",
            row.Value<string>("KeyHash"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   \t\r\n  ")]
    public void PhysicalColumnGate_DoesNotHashMissingOrWhitespaceKey(string? key)
    {
        var row = new JObject
        {
            ["Key"] = key
        };
        var expandedColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "Id", "Key", "KeyHash"
        };

        Assert.False(FormEngineExtend.ApplyDiyLangKeyHashForPhysicalColumns(
            row,
            expandedColumns));
        Assert.Null(row.Property("KeyHash"));
    }

    [Fact]
    public void SavePathContract_GatesWritesAndDuplicateLookupWithoutSchemaMutation()
    {
        var root = FindRepositoryRoot();
        var source = File.ReadAllText(Path.Combine(
            root,
            "Microi.Server",
            "Microi.Core",
            "FormEngine",
            "FormEngineLang.cs"));
        var start = source.IndexOf(
            "private static async Task<DosResult> SaveDiyLangRowDirectAsync",
            StringComparison.Ordinal);
        var end = source.IndexOf(
            "private static bool IsDiyLangDuplicateKeyException",
            start,
            StringComparison.Ordinal);

        Assert.True(start >= 0 && end > start);
        var phaseASource = source.Substring(start, end - start);
        Assert.Contains(
            "var hasKeyHashColumn = ApplyDiyLangKeyHashForPhysicalColumns(row, physicalColumns);",
            phaseASource,
            StringComparison.Ordinal);
        Assert.Contains("allowed.Add(\"KeyHash\");", phaseASource, StringComparison.Ordinal);
        Assert.Contains(
            "WHERE Id = @p0 OR KeyHash = @p1 OR `Key` = @p2",
            phaseASource,
            StringComparison.Ordinal);
        Assert.Contains(
            "WHERE Id = @p0 OR `Key` = @p1",
            phaseASource,
            StringComparison.Ordinal);
        Assert.DoesNotContain("ALTER TABLE", phaseASource, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("CREATE UNIQUE INDEX", phaseASource, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("DELETE FROM diy_lang", phaseASource, StringComparison.OrdinalIgnoreCase);
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "Microi.Server")))
            {
                return directory.FullName;
            }
            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException("Unable to locate the Microi repository root.");
    }
}

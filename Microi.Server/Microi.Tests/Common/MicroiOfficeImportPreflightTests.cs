using Microi.net;

namespace Dos.Common.Tests;

public class MicroiOfficeImportPreflightTests
{
    [Theory]
    [InlineData(null, "")]
    [InlineData("", "")]
    [InlineData("return { Code: 1 };", "")]
    [InlineData("ApiEngine:junchi_project_component_install_import_validate", "junchi_project_component_install_import_validate")]
    [InlineData(" apiengine:import-hook-1 ", "import-hook-1")]
    public void ResolveImportPreflightApiEngineKey_OnlyActivatesExplicitDirective(
        string? source,
        string expected)
    {
        Assert.Equal(expected, MicroiOffice.ResolveImportPreflightApiEngineKeyForTest(source!));
    }

    [Theory]
    [InlineData("ApiEngine:")]
    [InlineData("ApiEngine:bad/key")]
    [InlineData("ApiEngine: bad key")]
    public void ResolveImportPreflightApiEngineKey_RejectsInvalidExplicitDirective(string source)
    {
        var error = Assert.Throws<ArgumentException>(() =>
            MicroiOffice.ResolveImportPreflightApiEngineKeyForTest(source));

        Assert.Contains("ImportV8", error.Message);
    }

    [Fact]
    public void ImportIdempotencyKey_IsStableAndScopedToTenantTableMenuAndUser()
    {
        var normalized = MicroiOffice.NormalizeImportIdempotencyKeyForTest(
            " 8f6c0e30-9d42-4a33-ae77-f95ff953d9f4 ");
        var cacheKey = MicroiOffice.BuildImportIdempotencyCacheKeyForTest(
            "hongdi-dev",
            "table-1",
            "menu-1",
            "user-1",
            normalized);

        Assert.Equal("8f6c0e30-9d42-4a33-ae77-f95ff953d9f4", normalized);
        Assert.Equal(
            "Microi:hongdi-dev:ImportTableDataRequest:table-1:menu-1:user-1:8f6c0e30-9d42-4a33-ae77-f95ff953d9f4",
            cacheKey);
    }

    [Theory]
    [InlineData("bad key")]
    [InlineData("../retry")]
    public void ImportIdempotencyKey_RejectsUnsafeValues(string value)
    {
        Assert.Throws<ArgumentException>(() =>
            MicroiOffice.NormalizeImportIdempotencyKeyForTest(value));
    }
}

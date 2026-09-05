using Microi.net;
using Newtonsoft.Json.Linq;

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

    [Fact]
    public void PreflightFixedValues_AppliesWhitelistedBusinessField()
    {
        var fixedField = new JObject();
        var hookResult = JObject.Parse("""
            { "Code": 1, "Data": { "FixedValues": { "XiangmuID": "project-1" } } }
            """);

        var applied = MicroiOffice.ApplyImportPreflightFixedValuesForTest(
            hookResult,
            fixedField,
            ImportFields());

        Assert.Equal(new[] { "XiangmuID" }, applied);
        Assert.Equal("project-1", fixedField["XiangmuID"]?.ToString());
    }

    [Fact]
    public void PreflightFixedValues_CannotOverrideParentContext()
    {
        var fixedField = JObject.Parse("""{ "XiangmuID": "parent-project" }""");
        var hookResult = JObject.Parse("""
            { "Code": 1, "Data": { "FixedValues": { "XiangmuID": "other-project" } } }
            """);

        var error = Assert.Throws<Exception>(() =>
            MicroiOffice.ApplyImportPreflightFixedValuesForTest(
                hookResult,
                fixedField,
                ImportFields()));

        Assert.Contains("覆盖既有固定上下文", error.Message);
        Assert.Equal("parent-project", fixedField["XiangmuID"]?.ToString());
    }

    [Theory]
    [InlineData("Id")]
    [InlineData("CreateTime")]
    [InlineData("UnknownField")]
    public void PreflightFixedValues_RejectsProtectedOrUnknownFields(string fieldName)
    {
        var hookResult = new JObject
        {
            ["Code"] = 1,
            ["Data"] = new JObject
            {
                ["FixedValues"] = new JObject { [fieldName] = "unsafe" }
            }
        };

        Assert.Throws<Exception>(() =>
            MicroiOffice.ApplyImportPreflightFixedValuesForTest(
                hookResult,
                new JObject(),
                ImportFields()));
    }

    [Fact]
    public void PreflightFixedValues_RejectsObjectValues()
    {
        var hookResult = JObject.Parse("""
            { "Code": 1, "Data": { "FixedValues": { "XiangmuID": { "Id": "project-1" } } } }
            """);

        var error = Assert.Throws<Exception>(() =>
            MicroiOffice.ApplyImportPreflightFixedValuesForTest(
                hookResult,
                new JObject(),
                ImportFields()));

        Assert.Contains("非空标量值", error.Message);
    }

    private static IReadOnlyList<JObject> ImportFields()
    {
        return new[]
        {
            new JObject
            {
                ["Name"] = "XiangmuID",
                ["Label"] = "项目Id",
                ["Type"] = "varchar(36)",
                ["Component"] = "Text"
            },
            new JObject
            {
                ["Name"] = "Id",
                ["Label"] = "Id",
                ["Type"] = "varchar(36)",
                ["Component"] = "Guid"
            },
            new JObject
            {
                ["Name"] = "CreateTime",
                ["Label"] = "创建时间",
                ["Type"] = "datetime",
                ["Component"] = "DateTime"
            }
        };
    }
}

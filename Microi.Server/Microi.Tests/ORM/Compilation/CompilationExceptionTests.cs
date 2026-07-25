using System.Collections;
using System.Reflection;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;
using Dos.ORM.Tests.TestInfrastructure;

namespace Dos.ORM.Tests.Compilation;

public sealed class CompilationExceptionTests
{
    [Fact]
    public void Validation_exception_is_sealed_public_and_has_exact_safe_surface()
    {
        var type = typeof(SqlAstValidationException);

        Assert.True(type.IsPublic);
        Assert.True(type.IsSealed);
        Assert.Equal(typeof(InvalidOperationException), type.BaseType);
        Assert.Empty(type.GetConstructors());
        Assert.Equal(
            new[]
            {
                "CompatibilityMode", "DatabaseType", "Diagnostics",
                "Feature", "NodePath", "ServerVersion"
            },
            type.GetProperties(BindingFlags.Public | BindingFlags.Instance |
                               BindingFlags.DeclaredOnly)
                .Select(property => property.Name)
                .OrderBy(name => name, StringComparer.Ordinal));
    }

    [Fact]
    public void Validation_exception_rebuilds_and_defensively_copies_diagnostics()
    {
        const string sentinel = "DO-NOT-LEAK-diagnostic-921";
        var source = new List<SqlAstDiagnostic>
        {
            new("AST_INVALID_IDENTIFIER", sentinel, "$.Projections[0]")
        };
        var profile = TestProfiles.PostgreSql17;

        var error = new SqlAstValidationException(profile, source);
        source.Clear();

        var diagnostic = Assert.Single(error.Diagnostics);
        Assert.Equal("AST_INVALID_IDENTIFIER", diagnostic.Code);
        Assert.Equal(
            "SQL identifier is not one valid unquoted segment.",
            diagnostic.Message);
        Assert.Equal("$.Projections[0]", diagnostic.Path);
        Assert.Equal(diagnostic.Code, error.Feature);
        Assert.Equal(diagnostic.Path, error.NodePath);
        Assert.Equal(profile.DatabaseType, error.DatabaseType);
        Assert.Equal(profile.ServerVersion, error.ServerVersion);
        Assert.NotSame(profile.ServerVersion, error.ServerVersion);
        Assert.Equal(profile.CompatibilityMode, error.CompatibilityMode);
        Assert.DoesNotContain(sentinel, error.ToString());
        Assert.Empty(error.Data.Keys.Cast<object>());
        Assert.Null(error.InnerException);
    }

    [Fact]
    public void Validation_exception_rejects_empty_or_unknown_diagnostics()
    {
        Assert.Throws<ArgumentNullException>(() =>
            new SqlAstValidationException(TestProfiles.PostgreSql17, null!));
        Assert.Throws<ArgumentException>(() =>
            new SqlAstValidationException(
                TestProfiles.PostgreSql17, Array.Empty<SqlAstDiagnostic>()));
        Assert.Throws<ArgumentException>(() =>
            new SqlAstValidationException(
                TestProfiles.PostgreSql17,
                new[] { new SqlAstDiagnostic("UNKNOWN", "secret", "$") }));
        Assert.Throws<ArgumentException>(() =>
            new SqlAstValidationException(
                TestProfiles.PostgreSql17,
                new[]
                {
                    new SqlAstDiagnostic(
                        "AST_INVALID_IDENTIFIER", "safe", "connection=secret")
                }));
    }

    [Fact]
    public void Capability_exception_is_sealed_public_and_value_safe()
    {
        var profile = TestProfiles.Oracle11g;
        var error = new UnsupportedDatabaseCapabilityException(
            profile, "OffsetFetchPagination", "$.Page");

        Assert.True(error.GetType().IsPublic);
        Assert.True(error.GetType().IsSealed);
        Assert.Equal(typeof(NotSupportedException), error.GetType().BaseType);
        Assert.Empty(error.GetType().GetConstructors());
        Assert.Equal(profile.DatabaseType, error.DatabaseType);
        Assert.Equal(profile.ServerVersion, error.ServerVersion);
        Assert.NotSame(profile.ServerVersion, error.ServerVersion);
        Assert.Equal(profile.CompatibilityMode, error.CompatibilityMode);
        Assert.Equal("OffsetFetchPagination", error.Feature);
        Assert.Equal("$.Page", error.NodePath);
        Assert.Empty(error.Data.Keys.Cast<object>());
        Assert.Null(error.InnerException);
    }

    [Theory]
    [InlineData(null, "Feature", "$.Node")]
    [InlineData("profile", null, "$.Node")]
    [InlineData("profile", " ", "$.Node")]
    [InlineData("profile", "Feature", null)]
    [InlineData("profile", "Feature", " ")]
    public void Capability_exception_rejects_missing_contract_parts(
        string? profileMarker, string? feature, string? nodePath)
    {
        var profile = profileMarker == null ? null : TestProfiles.PostgreSql17;
        Assert.ThrowsAny<ArgumentException>(() =>
            new UnsupportedDatabaseCapabilityException(
                profile!, feature!, nodePath!));
    }

    [Theory]
    [InlineData("Feature-with-value", "$.Node")]
    [InlineData("Feature", "connection=secret")]
    [InlineData("Feature", "$.Rows[secret]")]
    public void Capability_exception_rejects_non_structural_diagnostic_text(
        string feature,
        string nodePath)
    {
        Assert.Throws<ArgumentException>(() =>
            new UnsupportedDatabaseCapabilityException(
                TestProfiles.PostgreSql17, feature, nodePath));
    }
}

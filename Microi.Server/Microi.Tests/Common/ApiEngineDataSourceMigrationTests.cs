using System.Reflection;
using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class ApiEngineDataSourceMigrationTests
{
    [Theory]
    [InlineData(null, "V8")]
    [InlineData("V8数据源", "V8")]
    [InlineData("Sql数据源", "SQL")]
    [InlineData("普通数据源", "JSON")]
    [InlineData("JSON数据源", "JSON")]
    [InlineData("Api数据源", "API")]
    public void NormalizeType_KeepsHistoricalLabelsCompatible(
        string? input,
        string expected)
    {
        Assert.Equal(expected, ApiEngineDataSourceRuntime.NormalizeType(input));
    }

    [Fact]
    public void MigrationRow_UsesOnlyApiV8CodeAndCarriesRuntimeMetadata()
    {
        var source = new JObject
        {
            ["Id"] = "source-id",
            ["DataSourceName"] = "客户选项",
            ["DataSourceKey"] = "customer-options",
            ["DataSourceType"] = "V8数据源",
            ["V8DataSource"] = "return { Code: 1, Data: [] };",
            ["SqlDataSource"] = "select should_not_win",
            ["DataSourceRole"] = "[\"role-a\"]",
            ["AllowAnonymous"] = 1,
            ["IsEnable"] = 1,
            ["TestParam"] = "{\"PageSize\":20}"
        };

        var migrated = Upgrade34.BuildMigratedApiEngineRow(
            source,
            "source-id",
            "customer-options");

        Assert.Equal("【数据源引擎迁移】客户选项", migrated.Value<string>("ApiName"));
        Assert.Equal("customer-options", migrated.Value<string>("ApiEngineKey"));
        Assert.Equal("V8", migrated.Value<string>("DataSourceType"));
        Assert.Equal("return { Code: 1, Data: [] };", migrated.Value<string>("ApiV8Code"));
        Assert.Equal("[\"role-a\"]", migrated.Value<string>("ApiRole"));
        Assert.Equal(1, migrated.Value<int>("AllowAnonymous"));
        Assert.Contains(ApiEngineDataSourceRuntime.MigrationMarker,
            migrated.Value<string>("ApiRemark"), StringComparison.Ordinal);
        Assert.Contains("LegacyDataSourceId: source-id",
            migrated.Value<string>("ApiRemark"), StringComparison.Ordinal);
        Assert.Null(migrated["V8DataSource"]);
        Assert.Null(migrated["SqlDataSource"]);
        Assert.Null(migrated["JsonDataSource"]);
        Assert.Null(migrated["NormalDataSource"]);
        Assert.Null(migrated["ApiDataSource"]);
    }

    [Fact]
    public void JsonRuntime_ParsesApiV8CodeWithoutStartingJint()
    {
        var result = ApiEngineDataSourceRuntime.ExecuteNonV8(
            "JSON",
            "[{\"Key\":\"A\",\"Value\":1}]",
            null!,
            null!);

        Assert.Equal(1, result.Code);
        var data = Assert.IsType<JArray>(result.Data);
        Assert.Equal("A", data[0]?["Key"]?.Value<string>());
        Assert.Equal(1, data[0]?["Value"]?.Value<int>());
    }

    [Fact]
    public void LegacyApiType_IsPreservedButFailsClosedUntilRewrittenAsV8Http()
    {
        var result = ApiEngineDataSourceRuntime.ExecuteNonV8(
            "Api数据源",
            "https://legacy.example.invalid/data",
            null!,
            null!);

        Assert.Equal(0, result.Code);
        Assert.Contains("源码已完整迁移", result.Msg, StringComparison.Ordinal);
        Assert.Contains("V8.Http", result.Msg, StringComparison.Ordinal);
    }

    [Fact]
    public void CurrentUserReplacement_MatchesLegacyScalarContract()
    {
        var currentUser = new JObject
        {
            ["Id"] = "user-1",
            ["Level"] = 999,
            ["RoleIds"] = new JArray("role-a")
        };

        var sql = ApiEngineDataSourceRuntime.ReplaceCurrentUser(
            "select '$CurrentUser.Id$', '$CurrentUser.Level$', '$CurrentUser.RoleIds$'",
            currentUser);

        Assert.Equal("select 'user-1', '999', '$CurrentUser.RoleIds$'", sql);
    }

    [Fact]
    public void ManagedFacade_ReturnTypeNoLongerForcesExpandoObjectToDosResult()
    {
        var interfaceMethod = typeof(IV8Method).GetMethod(
            nameof(IV8Method.RunDataSourceEngine),
            BindingFlags.Public | BindingFlags.Instance);
        var implementationMethod = typeof(V8Method).GetMethod(
            nameof(V8Method.RunDataSourceEngine),
            BindingFlags.Public | BindingFlags.Instance);

        Assert.NotNull(interfaceMethod);
        Assert.NotNull(implementationMethod);
        Assert.Equal(typeof(object), interfaceMethod!.ReturnType);
        Assert.Equal(typeof(object), implementationMethod!.ReturnType);
    }

    [Fact]
    public void Upgrade34_IsVersionGatedTransactionalAndRunsBeforeVersionRead()
    {
        var root = FindRepositoryRoot();
        var migration = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "34-UpgradeDataSourceToApiEngine.cs"));
        var upgrade = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "Upgrade.cs"));
        var coordinator = File.ReadAllText(Path.Combine(
            root, "Microi.Server", "Microi.Upgrade", "TenantUpgradeCoordinator.cs"));

        Assert.Equal("6.9.9.0", Upgrade34.Version);
        Assert.Contains("BeginTransaction()", migration, StringComparison.Ordinal);
        Assert.Contains("trans.Commit()", migration, StringComparison.Ordinal);
        Assert.Contains("trans.Rollback()", migration, StringComparison.Ordinal);
        Assert.Contains("SET {orm.GetFieldName(\"IsDeleted\")} = @p0", migration, StringComparison.Ordinal);
        Assert.Contains("AdvanceSuccessfulVersion(ref uptVersion, Upgrade34.Version)", upgrade, StringComparison.Ordinal);
        var invariantIndex = coordinator.IndexOf("RequiredRuntimeInvariantNames[11]", StringComparison.Ordinal);
        var versionReadIndex = coordinator.IndexOf(
            "beforeVersion = ReadServerVersion(runtimeClient)",
            StringComparison.Ordinal);
        Assert.True(invariantIndex >= 0);
        Assert.True(versionReadIndex > invariantIndex);
    }

    private static string FindRepositoryRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "Microi.Server")))
                return directory.FullName;
            directory = directory.Parent;
        }
        throw new DirectoryNotFoundException("Unable to locate repository root.");
    }
}

using System.Reflection;
using System.Runtime.CompilerServices;
using Dos.ORM.Platform;
using Dos.ORM.SqlCompilation;
using Dos.ORM.Tests.TestInfrastructure;

namespace Dos.ORM.Tests.Platform;

public sealed class DatabaseCapabilitiesTests
{
    [Fact]
    public void Capabilities_public_surface_is_exact_and_get_only()
    {
        Assert.True(typeof(DatabaseCapabilities).IsPublic);
        Assert.True(typeof(DatabaseCapabilities).IsSealed);
        var expected = new[]
        {
            "SupportsLimitOffsetPagination:Boolean",
            "SupportsOffsetFetchPagination:Boolean",
            "SupportsRownumPagination:Boolean",
            "SupportsReturningClause:Boolean",
            "SupportsReturningIntoClause:Boolean",
            "SupportsOutputClause:Boolean",
            "SupportsIdentityColumns:Boolean",
            "SupportsSequences:Boolean",
            "SupportsOnDuplicateKeyUpsert:Boolean",
            "SupportsOnConflictUpsert:Boolean",
            "SupportsMergeUpsert:Boolean",
            "SupportsLockedUpdateThenInsertUpsert:Boolean",
            "SupportsJson:Boolean",
            "SupportsWindowFunctions:Boolean",
            "SupportsCommonTableExpressions:Boolean",
            "SupportsForUpdateLock:Boolean",
            "SupportsUpdateLockHint:Boolean",
            "SupportsSkipLocked:Boolean",
            "SupportsNoWait:Boolean",
            "SupportsMultipleStatements:Boolean",
            "SupportsMultipleResultSets:Boolean",
            "MaxParametersPerCommand:Int32",
            "MaxCommandTextLength:Int32",
            "MaxBulkRowsPerBatch:Int32",
            "DdlTransactionBehavior:PlanTransactionBehavior",
            "SupportsSchemas:Boolean",
            "SupportsCatalogs:Boolean",
            "SupportsCreateDatabase:Boolean",
            "SupportsDropDatabase:Boolean",
            "SupportsNativeBulk:Boolean"
        };
        var properties = typeof(DatabaseCapabilities).GetProperties(
            BindingFlags.Public | BindingFlags.Instance |
            BindingFlags.DeclaredOnly);
        var actual = properties.Select(property =>
                property.Name + ":" + property.PropertyType.Name)
            .OrderBy(value => value, StringComparer.Ordinal)
            .ToArray();
        Assert.Equal(
            expected.OrderBy(value => value, StringComparer.Ordinal),
            actual);
        Assert.All(properties, property => Assert.Null(property.SetMethod));
        Assert.Empty(typeof(DatabaseCapabilities).GetConstructors());

        var constructor = Assert.Single(typeof(DatabaseCapabilities)
            .GetConstructors(BindingFlags.NonPublic | BindingFlags.Instance));
        Assert.True(constructor.IsAssembly);
        Assert.Equal(30, constructor.GetParameters().Length);
        var expectedConstructor = new[]
        {
            "supportsLimitOffsetPagination:Boolean",
            "supportsOffsetFetchPagination:Boolean",
            "supportsRownumPagination:Boolean",
            "supportsReturningClause:Boolean",
            "supportsReturningIntoClause:Boolean",
            "supportsOutputClause:Boolean",
            "supportsIdentityColumns:Boolean",
            "supportsSequences:Boolean",
            "supportsOnDuplicateKeyUpsert:Boolean",
            "supportsOnConflictUpsert:Boolean",
            "supportsMergeUpsert:Boolean",
            "supportsLockedUpdateThenInsertUpsert:Boolean",
            "supportsJson:Boolean",
            "supportsWindowFunctions:Boolean",
            "supportsCommonTableExpressions:Boolean",
            "supportsForUpdateLock:Boolean",
            "supportsUpdateLockHint:Boolean",
            "supportsSkipLocked:Boolean",
            "supportsNoWait:Boolean",
            "supportsMultipleStatements:Boolean",
            "supportsMultipleResultSets:Boolean",
            "maxParametersPerCommand:Int32",
            "maxCommandTextLength:Int32",
            "maxBulkRowsPerBatch:Int32",
            "ddlTransactionBehavior:PlanTransactionBehavior",
            "supportsSchemas:Boolean",
            "supportsCatalogs:Boolean",
            "supportsCreateDatabase:Boolean",
            "supportsDropDatabase:Boolean",
            "supportsNativeBulk:Boolean"
        };
        Assert.Equal(
            expectedConstructor,
            constructor.GetParameters().Select(parameter =>
                parameter.Name + ":" + parameter.ParameterType.Name));

        Assert.Empty(typeof(DatabaseCapabilities).GetFields(
            BindingFlags.Public | BindingFlags.Instance |
            BindingFlags.Static | BindingFlags.DeclaredOnly));
        Assert.Empty(typeof(DatabaseCapabilities).GetEvents(
            BindingFlags.Public | BindingFlags.Instance |
            BindingFlags.Static | BindingFlags.DeclaredOnly));
        Assert.Empty(typeof(DatabaseCapabilities).GetNestedTypes(
            BindingFlags.Public));
        var declaredPublicMethods = typeof(DatabaseCapabilities).GetMethods(
            BindingFlags.Public | BindingFlags.Instance |
            BindingFlags.Static | BindingFlags.DeclaredOnly);
        Assert.Equal(
            properties.Select(property => property.GetMethod)
                .OrderBy(method => method!.Name, StringComparer.Ordinal),
            declaredPublicMethods.OrderBy(
                method => method.Name,
                StringComparer.Ordinal));
    }

    [Theory]
    [InlineData(0, 1, 1)]
    [InlineData(-1, 1, 1)]
    [InlineData(1, 0, 1)]
    [InlineData(1, -1, 1)]
    [InlineData(1, 1, 0)]
    [InlineData(1, 1, -1)]
    public void All_numeric_limits_must_be_positive(
        int maxParameters,
        int maxCommandText,
        int maxBulkRows) =>
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            CapabilitySamples.Create(
                maxParameters,
                maxCommandText,
                maxBulkRows));

    [Fact]
    public void Capability_invariants_fail_closed()
    {
        Assert.Throws<ArgumentException>(
            CapabilitySamples.CreateWithNoPagination);
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            CapabilitySamples.Create(
                ddlTransactionBehavior: (PlanTransactionBehavior)(-1)));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            CapabilitySamples.Create(
                ddlTransactionBehavior: (PlanTransactionBehavior)999));
        Assert.Throws<ArgumentException>(() =>
            CapabilitySamples.Create(
                ddlTransactionBehavior: PlanTransactionBehavior.Opaque));
        Assert.Throws<ArgumentException>(() =>
            CapabilitySamples.Create(
                supportsForUpdateLock: false,
                supportsUpdateLockHint: false,
                supportsSkipLocked: true));
        Assert.Throws<ArgumentException>(() =>
            CapabilitySamples.Create(
                supportsForUpdateLock: false,
                supportsUpdateLockHint: false,
                supportsNoWait: true));

        var updateHint = CapabilitySamples.Create(
            supportsForUpdateLock: false,
            supportsUpdateLockHint: true,
            supportsSkipLocked: true,
            supportsNoWait: true);
        Assert.True(updateHint.SupportsUpdateLockHint);
        Assert.True(updateHint.SupportsSkipLocked);
        Assert.True(updateHint.SupportsNoWait);

        var rownumOnly = CapabilitySamples.CreateWithOnlyRownumPagination();
        Assert.False(rownumOnly.SupportsLimitOffsetPagination);
        Assert.False(rownumOnly.SupportsOffsetFetchPagination);
        Assert.True(rownumOnly.SupportsRownumPagination);
    }

    [Fact]
    public void Constructor_copies_every_one_of_thirty_positions_exactly() =>
        CapabilitySamples.AssertEveryConstructorPositionIsCopied();

    [Fact]
    public void Internal_test_access_and_fresh_profiles_are_exact()
    {
        Assert.Equal(
            new[] { "Dos.ORM.Tests" },
            typeof(DatabaseCapabilities).Assembly
                .GetCustomAttributes<InternalsVisibleToAttribute>()
                .Select(attribute => attribute.AssemblyName)
                .OrderBy(value => value, StringComparer.Ordinal));
        Assert.NotSame(TestProfiles.PostgreSql17, TestProfiles.PostgreSql17);
        Assert.NotSame(
            TestProfiles.For(DatabaseType.PostgreSql),
            TestProfiles.For(DatabaseType.PostgreSql));
        var firstAll = TestProfiles.All;
        var secondAll = TestProfiles.All;
        Assert.NotSame(firstAll, secondAll);
        Assert.Equal(10, firstAll.Count);
        Assert.Equal(10, secondAll.Count);
        for (var index = 0; index < firstAll.Count; index++)
        {
            Assert.NotSame(firstAll[index], secondAll[index]);
            Assert.Equal(firstAll[index], secondAll[index]);
        }
        foreach (var type in new[]
                 {
                     DatabaseType.MySql,
                     DatabaseType.SqlServer,
                     DatabaseType.Oracle,
                     DatabaseType.PostgreSql,
                     DatabaseType.DaMeng,
                     DatabaseType.KingBase
                 })
        {
            Assert.NotSame(TestProfiles.For(type), TestProfiles.For(type));
        }
        Assert.Equal(
            TestProfiles.MySql80,
            TestProfiles.For(DatabaseType.MySql));
        Assert.Equal(
            TestProfiles.SqlServer2022,
            TestProfiles.For(DatabaseType.SqlServer));
        Assert.Equal(
            TestProfiles.Oracle19c,
            TestProfiles.For(DatabaseType.Oracle));
        Assert.Equal(
            TestProfiles.PostgreSql17,
            TestProfiles.For(DatabaseType.PostgreSql));
        Assert.Equal(TestProfiles.Dm8, TestProfiles.For(DatabaseType.DaMeng));
        Assert.Equal(
            TestProfiles.KingbaseEsV9,
            TestProfiles.For(DatabaseType.KingBase));
        Assert.Throws<NotSupportedException>(() =>
            TestProfiles.For(DatabaseType.Sqlite3));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            TestProfiles.For((DatabaseType)(-1)));

        Assert.Equal(new Version(5, 7, 8, 0), TestProfiles.MySql57.ServerVersion);
        Assert.Equal(new Version(8, 0, 11, 0), TestProfiles.MySql80.ServerVersion);
        Assert.Equal(
            new Version(14, 0, 0, 0),
            TestProfiles.SqlServer2017.ServerVersion);
        Assert.Equal(
            new Version(16, 0, 0, 0),
            TestProfiles.SqlServer2022.ServerVersion);
        Assert.Equal(
            new Version(11, 2, 0, 4),
            TestProfiles.Oracle11g.ServerVersion);
        Assert.Equal(new Version(19, 0, 0, 0), TestProfiles.Oracle19c.ServerVersion);
        Assert.Equal(
            new Version(14, 0, 0, 0),
            TestProfiles.PostgreSql14.ServerVersion);
        Assert.Equal(
            new Version(17, 0, 0, 0),
            TestProfiles.PostgreSql17.ServerVersion);
        Assert.Equal(new Version(8, 1, 3, 140), TestProfiles.Dm8.ServerVersion);
        Assert.Equal("Oracle", TestProfiles.Dm8.CompatibilityMode);
        Assert.Equal(
            new Version(9, 4, 12, 0),
            TestProfiles.KingbaseEsV9.ServerVersion);
        Assert.Equal("PostgreSQL", TestProfiles.KingbaseEsV9.CompatibilityMode);
        Assert.Equal(10, TestProfiles.All.Count);
        Assert.All(
            TestProfiles.All.Where(profile =>
                profile.DatabaseType != DatabaseType.DaMeng
                && profile.DatabaseType != DatabaseType.KingBase),
            profile => Assert.Equal(string.Empty, profile.CompatibilityMode));
        Assert.All(
            TestProfiles.All,
            profile => Assert.Equal(
                4,
                profile.ServerVersion.ToString().Split('.').Length));
    }
}

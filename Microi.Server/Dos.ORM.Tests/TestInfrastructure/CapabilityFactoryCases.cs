using Dos.ORM.Dialects.Dm8;
using Dos.ORM.Dialects.KingbaseEs;
using Dos.ORM.Dialects.MySql;
using Dos.ORM.Dialects.Oracle;
using Dos.ORM.Dialects.PostgreSql;
using Dos.ORM.Dialects.SqlServer;
using Dos.ORM.Platform;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Tests.TestInfrastructure;

public sealed class CapabilityFactoryCase
{
    internal CapabilityFactoryCase(
        string name,
        Func<DialectProfile, DatabaseCapabilities> create,
        DatabaseCapabilities expected,
        IReadOnlyList<DialectProfile> validProfiles,
        IReadOnlyList<DialectProfile> invalidProfiles)
    {
        Name = name;
        Create = create;
        Expected = expected;
        ValidProfiles = validProfiles;
        InvalidProfiles = invalidProfiles;
    }

    internal string Name { get; }

    internal Func<DialectProfile, DatabaseCapabilities> Create { get; }

    internal DatabaseCapabilities Expected { get; }

    internal IReadOnlyList<DialectProfile> ValidProfiles { get; }

    internal IReadOnlyList<DialectProfile> InvalidProfiles { get; }

    public override string ToString() => Name;
}

internal static class CapabilityFactoryCases
{
    public static IEnumerable<object[]> All
    {
        get
        {
            yield return Row(
                "MySQL 5.7",
                MySqlCapabilities.For,
                MySqlExpected(false),
                new[]
                {
                    TestProfiles.MySql57,
                    Profile(DatabaseType.MySql, 5, 7, 44, 123)
                },
                StandardInvalid(
                    DatabaseType.MySql,
                    new Version(5, 7, 8),
                    new Version(5, 7, 7, 999),
                    new Version(5, 8, 0, 0)));
            yield return Row(
                "MySQL 8.0",
                MySqlCapabilities.For,
                MySqlExpected(true),
                new[]
                {
                    TestProfiles.MySql80,
                    Profile(DatabaseType.MySql, 8, 0, 36, 123)
                },
                StandardInvalid(
                    DatabaseType.MySql,
                    new Version(8, 0, 11),
                    new Version(8, 0, 10, 999),
                    new Version(8, 1, 0, 0)));
            yield return Row(
                "SQL Server 2017",
                SqlServerCapabilities.For,
                SqlServerExpected(),
                new[]
                {
                    TestProfiles.SqlServer2017,
                    Profile(DatabaseType.SqlServer, 14, 0, 3456, 17)
                },
                StandardInvalid(
                    DatabaseType.SqlServer,
                    new Version(14, 0, 0),
                    new Version(13, 999, 999, 999),
                    new Version(15, 0, 0, 0),
                    new Version(14, 1, 0, 0)));
            yield return Row(
                "SQL Server 2022",
                SqlServerCapabilities.For,
                SqlServerExpected(),
                new[]
                {
                    TestProfiles.SqlServer2022,
                    Profile(DatabaseType.SqlServer, 16, 0, 4100, 17)
                },
                StandardInvalid(
                    DatabaseType.SqlServer,
                    new Version(16, 0, 0),
                    new Version(15, 999, 999, 999),
                    new Version(17, 0, 0, 0),
                    new Version(16, 1, 0, 0)));
            yield return Row(
                "Oracle 11g",
                OracleCapabilities.For,
                OracleExpected(false),
                new[]
                {
                    TestProfiles.Oracle11g,
                    Profile(DatabaseType.Oracle, 11, 2, 0, 5)
                },
                StandardInvalid(
                    DatabaseType.Oracle,
                    new Version(11, 2, 0),
                    new Version(11, 2, 0, 3),
                    new Version(11, 1, 999, 999),
                    new Version(12, 0, 0, 0)));
            yield return Row(
                "Oracle 19c",
                OracleCapabilities.For,
                OracleExpected(true),
                new[]
                {
                    TestProfiles.Oracle19c,
                    Profile(DatabaseType.Oracle, 19, 22, 1, 7)
                },
                StandardInvalid(
                    DatabaseType.Oracle,
                    new Version(19, 0, 0),
                    new Version(18, 999, 999, 999),
                    new Version(20, 0, 0, 0)));
            yield return Row(
                "PostgreSQL 14",
                PostgreSqlCapabilities.For,
                PostgreSqlExpected(false),
                new[]
                {
                    TestProfiles.PostgreSql14,
                    Profile(DatabaseType.PostgreSql, 14, 9, 1, 7)
                },
                StandardInvalid(
                    DatabaseType.PostgreSql,
                    new Version(14, 0, 0),
                    new Version(13, 999, 999, 999),
                    new Version(15, 0, 0, 0)));
            yield return Row(
                "PostgreSQL 17",
                PostgreSqlCapabilities.For,
                PostgreSqlExpected(true),
                new[]
                {
                    TestProfiles.PostgreSql17,
                    Profile(DatabaseType.PostgreSql, 17, 2, 1, 7)
                },
                StandardInvalid(
                    DatabaseType.PostgreSql,
                    new Version(17, 0, 0),
                    new Version(16, 999, 999, 999),
                    new Version(18, 0, 0, 0)));
            yield return Row(
                "DM8",
                Dm8Capabilities.For,
                Dm8Expected(),
                new[]
                {
                    TestProfiles.Dm8,
                    Profile(DatabaseType.DaMeng, 8, 2, 99, 7, "Oracle")
                },
                ModeInvalid(
                    DatabaseType.DaMeng,
                    new Version(8, 1, 3),
                    "Oracle",
                    new Version(7, 999, 999, 999),
                    new Version(9, 0, 0, 0)));
            yield return Row(
                "KingbaseES V9",
                KingbaseEsCapabilities.For,
                KingbaseExpected(),
                new[]
                {
                    TestProfiles.KingbaseEsV9,
                    Profile(
                        DatabaseType.KingBase,
                        9,
                        4,
                        12,
                        1,
                        "PostgreSQL")
                },
                ModeInvalid(
                    DatabaseType.KingBase,
                    new Version(9, 4, 12),
                    "PostgreSQL",
                    new Version(9, 4, 11, 999),
                    new Version(9, 5, 0, 0),
                    new Version(10, 0, 0, 0)));
        }
    }

    private static object[] Row(
        string name,
        Func<DialectProfile, DatabaseCapabilities> create,
        DatabaseCapabilities expected,
        IReadOnlyList<DialectProfile> valid,
        IReadOnlyList<DialectProfile> invalid) =>
        new object[]
        {
            new CapabilityFactoryCase(
                name,
                create,
                expected,
                valid,
                invalid)
        };

    private static IReadOnlyList<DialectProfile> StandardInvalid(
        DatabaseType databaseType,
        Version incomplete,
        params Version[] unsupportedVersions)
    {
        var result = new List<DialectProfile>
        {
            new(DatabaseType.MsAccess, FourPart(incomplete), string.Empty),
            new(databaseType, incomplete, string.Empty),
            new(databaseType, FourPart(incomplete), "wrong-mode"),
            new(databaseType, FourPart(incomplete), "WRONG-MODE")
        };
        result.AddRange(unsupportedVersions.Select(version =>
            new DialectProfile(databaseType, version, string.Empty)));
        return result;
    }

    private static IReadOnlyList<DialectProfile> ModeInvalid(
        DatabaseType databaseType,
        Version incomplete,
        string mode,
        params Version[] unsupportedVersions)
    {
        var result = new List<DialectProfile>
        {
            new(DatabaseType.MsAccess, FourPart(incomplete), mode),
            new(databaseType, incomplete, mode),
            new(databaseType, FourPart(incomplete), string.Empty),
            new(databaseType, FourPart(incomplete), mode.ToLowerInvariant()),
            new(databaseType, FourPart(incomplete), mode + "-wrong")
        };
        result.AddRange(unsupportedVersions.Select(version =>
            new DialectProfile(databaseType, version, mode)));
        return result;
    }

    private static Version FourPart(Version version) => new(
        version.Major,
        version.Minor,
        version.Build < 0 ? 0 : version.Build,
        version.Revision < 0 ? 0 : version.Revision);

    private static DialectProfile Profile(
        DatabaseType databaseType,
        int major,
        int minor,
        int build,
        int revision,
        string mode = "") =>
        new(
            databaseType,
            new Version(major, minor, build, revision),
            mode);

    private static DatabaseCapabilities MySqlExpected(bool modern) =>
        CapabilitySamples.Create(
            maxParameters: 65535,
            maxCommandText: 1048576,
            maxBulkRows: 1000,
            supportsIdentityColumns: true,
            supportsOnDuplicateKeyUpsert: true,
            supportsJson: true,
            supportsWindowFunctions: modern,
            supportsCommonTableExpressions: modern,
            supportsSkipLocked: modern,
            supportsNoWait: modern,
            ddlTransactionBehavior: PlanTransactionBehavior.ImplicitCommit,
            supportsSchemas: true,
            supportsCreateDatabase: true,
            supportsDropDatabase: true);

    private static DatabaseCapabilities SqlServerExpected() =>
        CapabilitySamples.Create(
            maxParameters: 2100,
            maxCommandText: 1048576,
            maxBulkRows: 1000,
            supportsLimitOffsetPagination: false,
            supportsOffsetFetchPagination: true,
            supportsOutputClause: true,
            supportsIdentityColumns: true,
            supportsSequences: true,
            supportsLockedUpdateThenInsertUpsert: true,
            supportsJson: true,
            supportsWindowFunctions: true,
            supportsCommonTableExpressions: true,
            supportsForUpdateLock: false,
            supportsUpdateLockHint: true,
            supportsNoWait: true,
            supportsSchemas: true,
            supportsCatalogs: true,
            supportsCreateDatabase: true,
            supportsDropDatabase: true);

    private static DatabaseCapabilities OracleExpected(bool modern) =>
        CapabilitySamples.Create(
            maxParameters: 1000,
            maxCommandText: 65535,
            maxBulkRows: 1000,
            supportsLimitOffsetPagination: false,
            supportsOffsetFetchPagination: modern,
            supportsRownumPagination: true,
            supportsReturningIntoClause: true,
            supportsIdentityColumns: modern,
            supportsSequences: true,
            supportsMergeUpsert: true,
            supportsJson: modern,
            supportsWindowFunctions: true,
            supportsCommonTableExpressions: true,
            supportsSkipLocked: true,
            supportsNoWait: true,
            ddlTransactionBehavior: PlanTransactionBehavior.ImplicitCommit,
            supportsSchemas: true);

    private static DatabaseCapabilities PostgreSqlExpected(bool merge) =>
        CapabilitySamples.Create(
            maxParameters: 65535,
            maxCommandText: 1048576,
            maxBulkRows: 1000,
            supportsOffsetFetchPagination: true,
            supportsReturningClause: true,
            supportsIdentityColumns: true,
            supportsSequences: true,
            supportsOnConflictUpsert: true,
            supportsMergeUpsert: merge,
            supportsJson: true,
            supportsWindowFunctions: true,
            supportsCommonTableExpressions: true,
            supportsSkipLocked: true,
            supportsNoWait: true,
            supportsSchemas: true,
            supportsCreateDatabase: true,
            supportsDropDatabase: true);

    private static DatabaseCapabilities Dm8Expected() =>
        CapabilitySamples.Create(
            maxParameters: 2048,
            maxCommandText: 65535,
            maxBulkRows: 1000,
            supportsOffsetFetchPagination: true,
            supportsRownumPagination: true,
            supportsReturningIntoClause: true,
            supportsIdentityColumns: true,
            supportsSequences: true,
            supportsMergeUpsert: true,
            supportsJson: false,
            supportsWindowFunctions: true,
            supportsCommonTableExpressions: true,
            supportsSkipLocked: true,
            supportsNoWait: true,
            ddlTransactionBehavior: PlanTransactionBehavior.ImplicitCommit,
            supportsSchemas: true);

    private static DatabaseCapabilities KingbaseExpected() =>
        CapabilitySamples.Create(
            maxParameters: 32767,
            maxCommandText: 1048576,
            maxBulkRows: 1000,
            supportsOffsetFetchPagination: true,
            supportsReturningClause: true,
            supportsIdentityColumns: true,
            supportsSequences: true,
            supportsOnConflictUpsert: true,
            supportsMergeUpsert: true,
            supportsJson: true,
            supportsWindowFunctions: true,
            supportsCommonTableExpressions: true,
            supportsSkipLocked: true,
            supportsNoWait: true,
            supportsSchemas: true,
            supportsCreateDatabase: true,
            supportsDropDatabase: true);
}

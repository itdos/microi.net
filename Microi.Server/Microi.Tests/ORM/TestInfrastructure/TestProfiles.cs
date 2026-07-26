using Dos.ORM.Platform;

namespace Dos.ORM.Tests.TestInfrastructure;

internal static class TestProfiles
{
    internal static DialectProfile MySql57 =>
        Create(DatabaseType.MySql, 5, 7, 8, 0);

    internal static DialectProfile MySql80 =>
        Create(DatabaseType.MySql, 8, 0, 11, 0);

    internal static DialectProfile SqlServer2017 =>
        Create(DatabaseType.SqlServer, 14, 0, 0, 0);

    internal static DialectProfile SqlServer2022 =>
        Create(DatabaseType.SqlServer, 16, 0, 0, 0);

    internal static DialectProfile Oracle11g =>
        Create(DatabaseType.Oracle, 11, 2, 0, 4);

    internal static DialectProfile Oracle19c =>
        Create(DatabaseType.Oracle, 19, 0, 0, 0);

    internal static DialectProfile PostgreSql14 =>
        Create(DatabaseType.PostgreSql, 14, 0, 0, 0);

    internal static DialectProfile PostgreSql17 =>
        Create(DatabaseType.PostgreSql, 17, 0, 0, 0);

    internal static DialectProfile Dm8 =>
        Create(DatabaseType.DaMeng, 8, 1, 3, 140, "Oracle");

    internal static DialectProfile KingbaseEsV9 =>
        Create(DatabaseType.KingBase, 9, 4, 12, 0, "PostgreSQL");

    internal static IReadOnlyList<DialectProfile> All =>
        new[]
        {
            MySql57,
            MySql80,
            SqlServer2017,
            SqlServer2022,
            Oracle11g,
            Oracle19c,
            PostgreSql14,
            PostgreSql17,
            Dm8,
            KingbaseEsV9
        };

    internal static DialectProfile For(DatabaseType databaseType)
    {
        if (!Enum.IsDefined(databaseType))
        {
            throw new ArgumentOutOfRangeException(nameof(databaseType));
        }

        return databaseType switch
        {
            DatabaseType.MySql => MySql80,
            DatabaseType.SqlServer => SqlServer2022,
            DatabaseType.Oracle => Oracle19c,
            DatabaseType.PostgreSql => PostgreSql17,
            DatabaseType.DaMeng => Dm8,
            DatabaseType.KingBase => KingbaseEsV9,
            _ => throw new NotSupportedException(
                "No certified test profile exists for " + databaseType + ".")
        };
    }

    internal static DialectProfile Clone(DialectProfile profile)
    {
        ArgumentNullException.ThrowIfNull(profile);
        return new DialectProfile(
            profile.DatabaseType,
            new Version(
                profile.ServerVersion.Major,
                profile.ServerVersion.Minor,
                profile.ServerVersion.Build,
                profile.ServerVersion.Revision),
            profile.CompatibilityMode);
    }

    private static DialectProfile Create(
        DatabaseType databaseType,
        int major,
        int minor,
        int build,
        int revision,
        string compatibilityMode = "") =>
        new(
            databaseType,
            new Version(major, minor, build, revision),
            compatibilityMode);
}

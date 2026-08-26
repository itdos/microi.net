using Dos.ORM.Platform;

namespace Dos.ORM.Tests.Platform;

public sealed class DatabaseConfigurationResolverTests
{
    [Theory]
    [InlineData("mysql", DatabaseType.MySql, '`', '?')]
    [InlineData("sqlserver", DatabaseType.SqlServer, '[', '@')]
    [InlineData("sqlserver9", DatabaseType.SqlServer9, '[', '@')]
    [InlineData("mssql", DatabaseType.SqlServer, '[', '@')]
    [InlineData("oracle19c", DatabaseType.Oracle, '"', ':')]
    [InlineData("npgsql", DatabaseType.PostgreSql, '"', '@')]
    [InlineData("dm8", DatabaseType.DaMeng, '"', ':')]
    [InlineData("kingbasees-v9", DatabaseType.KingBase, '"', ':')]
    public void Resolve_maps_certified_configuration_names(
        string configuredName,
        DatabaseType expectedType,
        char expectedLeft,
        char expectedParameter)
    {
        var result = DatabaseConfigurationResolver.Resolve(configuredName);

        Assert.Equal(expectedType, result.DbType);
        Assert.Equal(expectedLeft, result.L);
        Assert.Equal(expectedParameter, result.P);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Resolve_rejects_missing_configuration(string configuredName)
    {
        Assert.Throws<ArgumentException>(() =>
            DatabaseConfigurationResolver.Resolve(configuredName));
    }

    [Fact]
    public void Resolve_rejects_null_configuration()
    {
        Assert.Throws<ArgumentException>(() =>
            DatabaseConfigurationResolver.Resolve(null));
    }

    [Fact]
    public void Resolve_rejects_unknown_configuration_without_mysql_fallback()
    {
        Assert.Throws<NotSupportedException>(() =>
            DatabaseConfigurationResolver.Resolve("future-db"));
    }

    [Theory]
    [InlineData(DatabaseType.SqlServer, DatabaseType.SqlServer)]
    [InlineData(DatabaseType.SqlServer9, DatabaseType.SqlServer)]
    [InlineData(DatabaseType.MySql, DatabaseType.MySql)]
    [InlineData(DatabaseType.PostgreSql, DatabaseType.PostgreSql)]
    public void Orm_service_type_normalizes_only_the_sql_server_version_alias(
        DatabaseType configuredType,
        DatabaseType expectedServiceType)
    {
        Assert.Equal(
            expectedServiceType,
            DatabaseTypeCompatibility.NormalizeOrmServiceType(configuredType));
    }

    [Theory]
    [InlineData(DatabaseType.SqlServer, DatabaseType.SqlServer9)]
    [InlineData(DatabaseType.SqlServer9, DatabaseType.SqlServer9)]
    [InlineData(DatabaseType.MySql, DatabaseType.MySql)]
    public void Session_provider_type_uses_the_modern_sql_server_provider(
        DatabaseType configuredType,
        DatabaseType expectedProviderType)
    {
        Assert.Equal(
            expectedProviderType,
            DatabaseTypeCompatibility.NormalizeSessionProviderType(configuredType));
    }

    [Theory]
    [InlineData("SqlServer")]
    [InlineData("sqlserver9")]
    [InlineData("MSSQL")]
    public void Sql_server_configuration_aliases_share_one_runtime_name(string configuredName)
    {
        Assert.Equal(
            nameof(DatabaseType.SqlServer),
            DatabaseTypeCompatibility.NormalizeConfigurationName(configuredName));
    }

    [Theory]
    [InlineData(DatabaseType.PostgreSql, "\"diy_table\".\"IsDeleted\"")]
    [InlineData(DatabaseType.KingBase, "\"diy_table\".\"IsDeleted\"")]
    [InlineData(DatabaseType.Oracle, "diy_table.IsDeleted")]
    public void Legacy_field_placeholders_preserve_case_sensitive_postgresql_family_identifiers(
        DatabaseType databaseType,
        string expected)
    {
        Assert.Equal(
            expected,
            DataUtils.FormatSQL(
                "{0}diy_table{1}.{0}IsDeleted{1}",
                '"',
                '"',
                databaseType));
    }
}

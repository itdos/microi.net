using Dos.ORM.Platform;

namespace Dos.ORM.Tests.Platform;

public sealed class DatabaseConfigurationResolverTests
{
    [Theory]
    [InlineData("mysql", DatabaseType.MySql, '`', '?')]
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
}

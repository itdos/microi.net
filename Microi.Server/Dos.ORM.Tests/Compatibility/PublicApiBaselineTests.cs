using System.Reflection;
using Dos.ORM;

namespace Dos.ORM.Tests.Compatibility;

public sealed class PublicApiBaselineTests
{
    [Fact]
    public void DatabaseType_numeric_values_are_stable()
    {
        Assert.Equal(0, (int)DatabaseType.SqlServer);
        Assert.Equal(1, (int)DatabaseType.MsAccess);
        Assert.Equal(2, (int)DatabaseType.SqlServer9);
        Assert.Equal(3, (int)DatabaseType.Oracle);
        Assert.Equal(4, (int)DatabaseType.Sqlite3);
        Assert.Equal(5, (int)DatabaseType.MySql);
        Assert.Equal(6, (int)DatabaseType.PostgreSql);
        Assert.Equal(7, (int)DatabaseType.DaMeng);
        Assert.Equal(8, (int)DatabaseType.KingBase);
    }

    [Theory]
    [InlineData(typeof(DbSession), "FromSql")]
    [InlineData(typeof(DbTrans), "FromSql")]
    [InlineData(typeof(ProviderFactory), "CreateDbProvider")]
    [InlineData(typeof(DbProvider), "BuildParameterName")]
    [InlineData(typeof(DbProvider), "BuildTableName")]
    public void Legacy_public_members_remain_available(Type type, string member)
    {
        Assert.Contains(
            type.GetMethods(BindingFlags.Instance | BindingFlags.Static |
                            BindingFlags.Public | BindingFlags.NonPublic),
            method => method.Name == member);
    }
}

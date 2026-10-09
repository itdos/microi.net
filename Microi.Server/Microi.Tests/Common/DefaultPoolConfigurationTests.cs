using Dos.ORM;
using Microi.net;
using MySql.Data.MySqlClient;

namespace Microi.Tests.Common;

public sealed class DefaultPoolConfigurationTests
{
    [Fact]
    public void DefaultBusinessPool_IsBoundedAndDoesNotPreallocateConnections()
    {
        var db = MicroiORMExtensions.CreateDbSession(
            "Server=127.0.0.1;Database=pool-budget-test;User ID=test;Password=test", DatabaseType.MySql);
        var settings = new MySqlConnectionStringBuilder(db.Db.ConnectionString);
        Assert.Equal(100u, settings.MaximumPoolSize);
        Assert.Equal(0u, settings.MinimumPoolSize);
        Assert.Equal(300u, settings.ConnectionLifeTime);
        Assert.Equal(10u, settings.ConnectionTimeout);
    }

    [Fact]
    public void ExplicitPoolConfiguration_RemainsTheTenantFactSource()
    {
        var db = MicroiORMExtensions.CreateDbSession(
            "Server=127.0.0.1;Database=pool-budget-test;User ID=test;Password=test;"
            + "MaximumPoolSize=37;MinimumPoolSize=2;Connection Lifetime=120;Connection Timeout=4", DatabaseType.MySql);
        var settings = new MySqlConnectionStringBuilder(db.Db.ConnectionString);
        Assert.Equal(37u, settings.MaximumPoolSize);
        Assert.Equal(2u, settings.MinimumPoolSize);
        Assert.Equal(120u, settings.ConnectionLifeTime);
        Assert.Equal(4u, settings.ConnectionTimeout);
    }
}

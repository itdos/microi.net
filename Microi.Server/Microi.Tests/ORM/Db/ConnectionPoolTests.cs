using System.Data;
using Dos.ORM;
using MySql.Data.MySqlClient;
using System.Data.SqlClient;
using static Dos.ORM.Tests.Db.ConnectionOwnershipTests;

namespace Dos.ORM.Tests.Db;

public sealed class ConnectionPoolTests
{
    [Fact]
    public void FailureClassifier_DistinguishesPoolAndServerCapacity()
    {
        Assert.Equal("DatabasePoolExhausted", Database.ClassifyConnectionFailure(new Exception(
            "Timeout expired prior to obtaining a connection from the pool. all pooled connections were in use")));
        Assert.Equal("DatabaseCapacityExceeded", Database.ClassifyConnectionFailure(new Exception("Too many connections")));
        Assert.Equal("DatabaseEndpointUnreachable", Database.ClassifyConnectionFailure(new Exception("Connection refused")));
        Assert.Contains("DatabasePoolExhausted", Assert.Throws<TimeoutException>(() =>
            Database.ThrowIfConnectionBackoffActive(TimeSpan.FromSeconds(1), "DatabasePoolExhausted")).Message);
    }

    [Theory]
    [InlineData(DatabaseType.MySql)]
    [InlineData(DatabaseType.SqlServer)]
    public async Task IsolatedScope_IsBounded_RestoresNestedAndAsyncContext(DatabaseType provider)
    {
        var db = new DbSession(provider, "Server=127.0.0.1;Database=scope-test;User ID=test;Password=secret;Pooling=true").Db;
        using (Database.BeginIsolatedConnections())
        {
            using (Database.BeginIsolatedConnections()) { await Task.Yield(); }
            using var connection = db.CreateConnection();
            if (provider == DatabaseType.MySql)
            {
                var settings = new MySqlConnectionStringBuilder(connection.ConnectionString);
                Assert.False(settings.Pooling); Assert.Equal(5u, settings.ConnectionTimeout);
            }
            else
            {
                var settings = new SqlConnectionStringBuilder(connection.ConnectionString);
                Assert.False(settings.Pooling); Assert.Equal(5, settings.ConnectTimeout);
            }
            Assert.Throws<InvalidOperationException>(() => db.ResetConnectionPool());
        }
        using var pooled = db.CreateConnection();
        Assert.Contains("pooling=True", pooled.ConnectionString, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Snapshot_UsesStableOpaquePoolIdentity_AndResetRejectsUnknownDriver()
    {
        var a = new DbSession(DatabaseType.MySql, "Server=127.0.0.1;Database=tenant-a;User ID=user;Password=secret").Db;
        var a2 = new DbSession(DatabaseType.MySql, a.ConnectionString).Db;
        var b = new DbSession(DatabaseType.MySql, "Server=127.0.0.1;Database=tenant-b;User ID=user;Password=secret").Db;
        Assert.Equal(a.ConnectionPoolId, a2.ConnectionPoolId);
        Assert.Equal(a.ConnectionPoolId, new Database(new EquivalentMySqlProvider(a.ConnectionString)).ConnectionPoolId);
        Assert.NotEqual(a.ConnectionPoolId, b.ConnectionPoolId);
        var snapshot = System.Text.Json.JsonSerializer.Serialize(a.GetConnectionPoolSnapshot());
        Assert.DoesNotContain("secret", snapshot); Assert.DoesNotContain("tenant-a", snapshot);
        var unsupported = new Database(new FaultProvider(new FaultFactory()));
        Assert.False(unsupported.GetConnectionPoolSnapshot().CanReset);
        Assert.Throws<NotSupportedException>(() => unsupported.ResetConnectionPool());
    }

    private sealed class EquivalentMySqlProvider(string connection) : Dos.ORM.MySql.MySqlProvider(connection) { }

    [Fact]
    public void PoolIdentity_FollowsActualDriverAliasesAndPreservesSeparateDriverPools()
    {
        var a = new DbSession(DatabaseType.MySql, "Server=127.0.0.1;Database=budget-a;User ID=test;Password=test").Db;
        var alias = new DbSession(DatabaseType.MySql, "Server=127.0.0.1;Database=budget-a;Uid=test;Password=test").Db;
        Assert.Equal(new MySqlConnectionStringBuilder(a.ConnectionString).ConnectionString,
            new MySqlConnectionStringBuilder(alias.ConnectionString).ConnectionString);
        Assert.Equal(a.ConnectionPoolId, alias.ConnectionPoolId);
        Assert.Equal(1, Database.GetConnectionPoolBudgetSnapshot(new[] { a, alias }).SelectedPoolCount);
        var different = new DbSession(DatabaseType.MySql, "Server=127.0.0.1;Database=budget-a;Uid=test;Password=test;Max Pool Size=37").Db;
        Assert.NotEqual(a.ConnectionPoolId, different.ConnectionPoolId);
    }

    [Theory]
    [InlineData(DatabaseType.MySql)]
    [InlineData(DatabaseType.SqlServer)]
    public void Snapshot_ReportsExplicitMinimumAndLifetimeWithoutSecrets(DatabaseType provider)
    {
        var db = new DbSession(provider, "Server=127.0.0.1;Database=pool-budget-secret-db;User ID=test;Password=pool-budget-secret;"
            + "Max Pool Size=37;Min Pool Size=2;Connection Lifetime=120").Db;
        var snapshot = db.GetConnectionPoolSnapshot();
        Assert.Equal(37, snapshot.MaximumPoolSize);
        Assert.Equal(2, snapshot.MinimumPoolSize);
        Assert.Equal(120, snapshot.ConnectionLifetimeSeconds);
        var json = System.Text.Json.JsonSerializer.Serialize(snapshot);
        Assert.DoesNotContain("pool-budget-secret", json);
    }

    [Fact]
    public void Budget_DeduplicatesSharedReadWritePool_AndKeepsDistinctPools()
    {
        var a = new DbSession(DatabaseType.MySql, "Server=127.0.0.1;Database=budget-a;Max Pool Size=37;Min Pool Size=2").Db;
        var same = new DbSession(DatabaseType.MySql, a.ConnectionString).Db;
        var b = new DbSession(DatabaseType.MySql, "Server=127.0.0.1;Database=budget-b;Max Pool Size=20;Min Pool Size=1").Db;
        var budget = Database.GetConnectionPoolBudgetSnapshot(new[] { a, same, b });
        Assert.Equal("CurrentNodeSelectedPools", budget.Scope);
        Assert.Equal(2, budget.SelectedPoolCount);
        Assert.Equal(2, budget.PooledPoolCount);
        Assert.Equal(57, budget.ConfiguredMaximumConnections);
        Assert.Equal(3, budget.ConfiguredMinimumConnections);
        Assert.Equal(0, budget.UnknownPoolCount);
        Assert.Contains("Quartz", budget.Boundary);
        var json = System.Text.Json.JsonSerializer.Serialize(budget);
        Assert.DoesNotContain("budget-a", json);
        Assert.DoesNotContain("budget-b", json);
    }

    [Fact]
    public void Budget_UnknownProviderAndNonPooledConnectionsAreNotReportedAsZeroCapacity()
    {
        var noPool = new DbSession(DatabaseType.MySql, "Server=127.0.0.1;Database=budget-a;Pooling=false;Max Pool Size=37").Db;
        var unsupported = new Database(new FaultProvider(new FaultFactory()));
        var budget = Database.GetConnectionPoolBudgetSnapshot(new[] { noPool, unsupported });
        Assert.Equal(1, budget.NonPooledPoolCount);
        Assert.Equal(1, budget.UnknownPoolCount);
        Assert.Null(budget.ConfiguredMaximumConnections);
        Assert.Null(budget.ConfiguredMinimumConnections);
        var onlyNoPool = Database.GetConnectionPoolBudgetSnapshot(new[] { noPool });
        Assert.Equal(0, onlyNoPool.ConfiguredMaximumConnections);
        Assert.Equal(1, onlyNoPool.NonPooledPoolCount);
        Assert.Contains("无池连接未被此上限限制", onlyNoPool.Boundary);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void BatchFailure_ReleasesConnectionAndAllowsNextBatch(bool failureAtCommit)
    {
        var factory = new FaultFactory { FailBegin = !failureAtCommit, FailCompletion = failureAtCommit };
        var db = new Database(new FaultProvider(factory));
        if (failureAtCommit)
        {
            db.BeginBatchConnection(1, IsolationLevel.ReadCommitted);
            Assert.Throws<InvalidOperationException>(() => db.EndBatchConnection());
        }
        else Assert.Throws<InvalidOperationException>(() => db.BeginBatchConnection(1, IsolationLevel.ReadCommitted));
        Assert.True(factory.Last!.Disposed);
        factory.FailBegin = false; factory.FailCompletion = false;
        db.BeginBatchConnection(1);
        db.EndBatchConnection();
        Assert.True(factory.Last.Disposed);
    }
}

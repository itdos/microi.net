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

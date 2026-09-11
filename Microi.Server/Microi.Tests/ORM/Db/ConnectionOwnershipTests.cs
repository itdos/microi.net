using System.Data;
using System.Data.Common;
using Dos.ORM;

namespace Dos.ORM.Tests.Db;

public sealed class ConnectionOwnershipTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void FailedBeginTransaction_ReleasesTheOpenedConnection(bool explicitIsolation)
    {
        var factory = new FaultFactory { FailBegin = true };
        var db = new Database(new FaultProvider(factory));
        Assert.Throws<InvalidOperationException>(() => explicitIsolation
            ? db.BeginTransaction(IsolationLevel.ReadCommitted) : db.BeginTransaction());
        Assert.Equal(ConnectionState.Closed, factory.Last!.State);
        Assert.True(factory.Last.Disposed);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task FailedReaderPreparation_ReleasesTheOpenedConnection(bool async)
    {
        var factory = new FaultFactory();
        var db = new Database(new FaultProvider(factory));
        using var command = new FaultCommand { FailConnectionAssignment = true };
        if (async) await Assert.ThrowsAsync<InvalidOperationException>(() => db.ExecuteReaderAsync(command));
        else Assert.Throws<InvalidOperationException>(() => db.ExecuteReader(command));
        Assert.Equal(ConnectionState.Closed, factory.Last!.State);
        Assert.True(factory.Last.Disposed);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void FailedTransactionCompletion_ReleasesConnectionAndPreservesError(bool commit)
    {
        var connection = new FaultConnection();
        connection.Open();
        var providerTransaction = new FaultTransaction(connection) { FailCompletion = true };
        var transaction = new DbTrans(providerTransaction, null!);
        var called = false;
        transaction.RegisterAfterCommit(() => called = true);
        var error = Assert.Throws<InvalidOperationException>(() =>
        {
            if (commit) transaction.Commit(); else transaction.Rollback();
        });
        Assert.Equal("completion failed", error.Message);
        Assert.Equal(ConnectionState.Closed, connection.State);
        Assert.True(connection.Disposed);
        Assert.False(called);
        transaction.Dispose();
    }

    [Fact]
    public void AfterCommitCallback_DoesNotHoldDatabaseConnection()
    {
        var connection = new FaultConnection();
        connection.Open();
        var transaction = new DbTrans(new FaultTransaction(connection), null!);
        var stateDuringCallback = ConnectionState.Broken;
        transaction.RegisterAfterCommit(() => stateDuringCallback = connection.State);
        transaction.Commit();
        Assert.Equal(ConnectionState.Closed, stateDuringCallback);
    }

    [Fact]
    public void CloseConnection_AlsoDisposesAlreadyClosedConnection()
    {
        var connection = new FaultConnection();
        new Database(new FaultProvider(new FaultFactory())).CloseConnection(connection);
        Assert.True(connection.Disposed);
    }

    internal sealed class FaultFactory : DbProviderFactory
    {
        public FaultConnection? Last;
        public bool FailBegin;
        public bool FailCompletion;
        public override DbConnection CreateConnection() => Last = new FaultConnection { FailBegin = FailBegin, FailCompletion = FailCompletion };
        public override DbCommand CreateCommand() => new FaultCommand();
    }

    internal sealed class FaultProvider : DbProvider
    {
        public FaultProvider(FaultFactory factory) : base("Database=ownership-test", factory, '[', ']', '@') { }
        public override string RowAutoID => "SELECT 1";
        public override bool SupportBatch => false;
    }

    internal sealed class FaultConnection : DbConnection
    {
        private ConnectionState state;
        public bool Disposed;
        public bool FailBegin;
        public bool FailCompletion;
        public override string ConnectionString { get; set; } = "";
        public override string Database => "ownership-test";
        public override string DataSource => "fake";
        public override string ServerVersion => "1";
        public override ConnectionState State => state;
        public override void ChangeDatabase(string databaseName) { }
        public override void Open() => state = ConnectionState.Open;
        public override void Close() => state = ConnectionState.Closed;
        protected override void Dispose(bool disposing) { Disposed = true; Close(); base.Dispose(disposing); }
        protected override DbTransaction BeginDbTransaction(IsolationLevel isolationLevel) =>
            FailBegin ? throw new InvalidOperationException("begin failed") : new FaultTransaction(this) { FailCompletion = FailCompletion };
        protected override DbCommand CreateDbCommand() => new FaultCommand();
    }

    internal sealed class FaultTransaction(FaultConnection connection) : DbTransaction
    {
        public bool FailCompletion;
        protected override DbConnection DbConnection => connection;
        public override IsolationLevel IsolationLevel => IsolationLevel.ReadCommitted;
        public override void Commit() { if (FailCompletion) throw new InvalidOperationException("completion failed"); }
        public override void Rollback() { if (FailCompletion) throw new InvalidOperationException("completion failed"); }
    }

    internal sealed class FaultCommand : DbCommand
    {
        public bool FailConnectionAssignment;
        private DbConnection? connection;
        public override string CommandText { get; set; } = "SELECT 1";
        public override int CommandTimeout { get; set; }
        public override CommandType CommandType { get; set; }
        public override bool DesignTimeVisible { get; set; }
        public override UpdateRowSource UpdatedRowSource { get; set; }
        protected override DbConnection? DbConnection
        {
            get => connection;
            set { if (FailConnectionAssignment) throw new InvalidOperationException("prepare failed"); connection = value; }
        }
        protected override DbTransaction? DbTransaction { get; set; }
        protected override DbParameterCollection DbParameterCollection => throw new NotSupportedException();
        public override void Cancel() { }
        public override int ExecuteNonQuery() => 1;
        public override object ExecuteScalar() => 1;
        public override void Prepare() { }
        protected override DbParameter CreateDbParameter() => throw new NotSupportedException();
        protected override DbDataReader ExecuteDbDataReader(CommandBehavior behavior) => throw new NotSupportedException();
    }
}

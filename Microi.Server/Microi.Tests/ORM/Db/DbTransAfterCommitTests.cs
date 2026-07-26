using System.Data;
using System.Data.Common;
using Dos.ORM;

namespace Dos.ORM.Tests.Db;

public sealed class DbTransAfterCommitTests
{
    [Fact]
    public void Commit_RunsRegisteredCallbacksExactlyOnce()
    {
        var providerTransaction = new FakeDbTransaction();
        var transaction = new DbTrans(providerTransaction, null!);
        var callbackCount = 0;

        transaction.RegisterAfterCommit(() => callbackCount++);
        transaction.Commit();

        Assert.Equal(1, callbackCount);
        Assert.Equal(1, providerTransaction.CommitCount);
        Assert.Equal(ConnectionState.Closed, providerTransaction.FakeConnection.State);
    }

    [Fact]
    public void Rollback_DiscardsRegisteredCallbacks()
    {
        var providerTransaction = new FakeDbTransaction();
        var transaction = new DbTrans(providerTransaction, null!);
        var callbackCount = 0;

        transaction.RegisterAfterCommit(() => callbackCount++);
        transaction.Rollback();

        Assert.Equal(0, callbackCount);
        Assert.Equal(1, providerTransaction.RollbackCount);
    }

    [Fact]
    public void SafeProxy_RegistersOnTheFrameworkOwnedTransaction()
    {
        var providerTransaction = new FakeDbTransaction();
        var inner = new DbTrans(providerTransaction, null!);
        var proxy = new SafeTransactionProxy(inner, "test");
        var callbackCount = 0;

        proxy.RegisterAfterCommit(() => callbackCount++);
        inner.Commit();

        Assert.Equal(1, callbackCount);
    }

    [Fact]
    public void CallbackFailure_DoesNotMisreportAnAlreadyCommittedTransaction()
    {
        var providerTransaction = new FakeDbTransaction();
        var transaction = new DbTrans(providerTransaction, null!);

        transaction.RegisterAfterCommit(() => throw new InvalidOperationException("redis unavailable"));
        var error = Record.Exception(() => transaction.Commit());

        Assert.Null(error);
        Assert.True(transaction.IsCommitOrRollback);
        Assert.Equal(1, providerTransaction.CommitCount);
    }

    private sealed class FakeDbTransaction : DbTransaction
    {
        public FakeDbConnection FakeConnection { get; } = new();
        public int CommitCount { get; private set; }
        public int RollbackCount { get; private set; }
        public override IsolationLevel IsolationLevel => IsolationLevel.ReadCommitted;
        protected override DbConnection DbConnection => FakeConnection;

        public override void Commit() => CommitCount++;
        public override void Rollback() => RollbackCount++;
    }

    private sealed class FakeDbConnection : DbConnection
    {
        private ConnectionState _state = ConnectionState.Open;
        public override string ConnectionString { get; set; } = string.Empty;
        public override string Database => "test";
        public override string DataSource => "test";
        public override string ServerVersion => "1";
        public override ConnectionState State => _state;

        public override void ChangeDatabase(string databaseName) { }
        public override void Close() => _state = ConnectionState.Closed;
        public override void Open() => _state = ConnectionState.Open;
        protected override DbTransaction BeginDbTransaction(IsolationLevel isolationLevel) =>
            throw new NotSupportedException();
        protected override DbCommand CreateDbCommand() => throw new NotSupportedException();
    }
}

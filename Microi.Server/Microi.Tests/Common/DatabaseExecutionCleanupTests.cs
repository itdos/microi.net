using System.Data;
using Dos.ORM;
using Microi.net;
using static Dos.ORM.Tests.Db.ConnectionOwnershipTests;

namespace Microi.Tests.Common;

public sealed class DatabaseExecutionCleanupTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void EngineReturnFailure_DoesNotRetainOwnedTransaction_OrCloseBorrowedTransaction(bool borrowed)
    {
        var connection = new FaultConnection(); connection.Open();
        using var transaction = new DbTrans(new FaultTransaction(connection), null!);
        var stateAtReturn = ConnectionState.Broken;
        DatabaseExecutionCleanup.Release(transaction, !borrowed, () =>
        {
            stateAtReturn = connection.State;
            throw new InvalidOperationException("V8 pool return failed");
        });
        Assert.Equal(borrowed ? ConnectionState.Open : ConnectionState.Closed, stateAtReturn);
        Assert.Equal(borrowed ? ConnectionState.Open : ConnectionState.Closed, connection.State);
    }

    [Fact]
    public void TransactionAcquisitionFailure_StillReturnsPreviouslyBorrowedEngine()
    {
        var returned = false;
        DatabaseExecutionCleanup.Release(null!, true, () => returned = true);
        Assert.True(returned);
    }

    [Fact]
    public void DiagnosticsFailure_PreservesTheOriginalBusinessFailure()
    {
        var original = new InvalidOperationException("business rejected");
        var observed = Assert.Throws<InvalidOperationException>((Action)(() =>
        {
            try { throw original; }
            finally { DatabaseExecutionCleanup.Observe(() => throw new Exception("log storage failed")); }
        }));
        Assert.Same(original, observed);
    }
}

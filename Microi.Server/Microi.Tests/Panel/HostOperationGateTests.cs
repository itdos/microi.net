using Microi.Panel;

namespace Microi.Tests.Panel;

public sealed class HostOperationGateTests
{
    [Fact]
    public async Task PlatformAndPluginOperationsCannotMutateTheHostTogether()
    {
        var cancellation = TestContext.Current.CancellationToken;
        var gate = new HostOperationGate(); var platform = await gate.Enter(cancellation);
        var panel = gate.Enter(cancellation); Assert.False(panel.IsCompleted);
        platform.Dispose(); using var accepted = await panel.WaitAsync(TimeSpan.FromSeconds(2), cancellation);
        var third = gate.Enter(cancellation); platform.Dispose(); Assert.False(third.IsCompleted); // 同一持有者重复释放不能扩大并发。
        accepted.Dispose(); using var next = await third.WaitAsync(TimeSpan.FromSeconds(2), cancellation);
    }

    [Fact]
    public async Task CancelledWaiterDoesNotLoseTheHostLease()
    {
        var token = TestContext.Current.CancellationToken;
        var gate = new HostOperationGate(); using var first = await gate.Enter(token); using var cancellation = new CancellationTokenSource();
        var waiting = gate.Enter(cancellation.Token); cancellation.Cancel(); await Assert.ThrowsAnyAsync<OperationCanceledException>(() => waiting);
        var next = gate.Enter(token); Assert.False(next.IsCompleted); first.Dispose(); using var accepted = await next.WaitAsync(TimeSpan.FromSeconds(2), token);
    }
}

namespace Microi.Tests.Common;

[Trait("Category", "FullStack")]
public sealed class DatabasePoolRecoveryStartupTests
{
    [Fact]
    public async Task ActualHost_WaitsForTenantBootstrap_RegistersAfterReady_AndStopsPolling()
    {
        var tenant = "pool_startup_" + Guid.NewGuid().ToString("N");
        using var process = DatabasePoolRecoveryIntegrationTests.StartNode(
            DatabasePoolRecoveryIntegrationTests.Connection(), tenant, tenant, "startup");
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        using var deadline = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        deadline.CancelAfter(TimeSpan.FromSeconds(45));
        try
        {
            await process.WaitForExitAsync(deadline.Token);
            var output = await stdout;
            var errors = await stderr;
            Assert.True(process.ExitCode == 0, $"Actual host startup failed ({process.ExitCode}): {errors[..Math.Min(errors.Length, 6000)]}");
            Assert.Contains("PoolRecoveryHostStartupVerified", output);
            Assert.DoesNotContain("Stack overflow", errors, StringComparison.OrdinalIgnoreCase);
        }
        finally
        {
            if (!process.HasExited) { process.Kill(entireProcessTree: true); await process.WaitForExitAsync(CancellationToken.None); }
        }
    }
}

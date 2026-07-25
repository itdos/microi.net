using Jint;
using Microi.net;

namespace Microi.Tests.Common;

public class V8MemoryConstraintTests
{
    [Fact]
    public void JintPackage_IsAtLeast414()
    {
        var actual = typeof(Engine).Assembly.GetName().Version;

        Assert.NotNull(actual);
        Assert.True(
            actual >= new Version(4, 14, 0),
            $"Expected Jint >= 4.14.0, actual assembly version was {actual}.");
    }

    [Fact]
    public void ConstraintReset_StartsUserExecutionWithAFreshAllocationBudget()
    {
        using var engine = new Engine(options => options.LimitMemory(2 * 1024 * 1024));

        // Simulate allocations made by platform host-object preparation after the
        // Engine was created but before tenant JavaScript begins.
        var platformPreparation = new byte[3 * 1024 * 1024];
        platformPreparation[0] = 1;

        engine.Constraints.Reset();
        var result = engine.Evaluate("40 + 2");

        Assert.Equal(42D, result.AsNumber());
        GC.KeepAlive(platformPreparation);
    }

    [Fact]
    public void DefaultMemoryBudget_IsRaisedWithoutRemovingTheHardMaximum()
    {
        const string environmentName = "MICROI_V8_DEFAULT_LIMIT_MEMORY_MB";
        var original = Environment.GetEnvironmentVariable(environmentName);
        try
        {
            Environment.SetEnvironmentVariable(environmentName, null);
            var limits = new CreateV8EngineParam();

            Assert.Equal(2048, limits.LimitMemory);
            Assert.Equal(4096, limits.MaxLimitMemoryMB);
        }
        finally
        {
            Environment.SetEnvironmentVariable(environmentName, original);
        }
    }
}

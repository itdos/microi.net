using Jint;
using Microi.net;
using Newtonsoft.Json.Linq;

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
        var limits = new CreateV8EngineParam();

        Assert.Equal(2048, limits.LimitMemory);
        Assert.Equal(8192, limits.MaxLimitMemoryMB);
        Assert.Equal(8192, limits.CallTreeLimitMemory);
        Assert.Equal(32768, limits.MaxCallTreeLimitMemoryMB);
        Assert.Equal(32, limits.NestedApiDepth);
        Assert.Equal(64, limits.MaxNestedApiDepthValue);
        Assert.True(limits.IsolateNestedApiMemory);
    }

    [Fact]
    public void NestedAllocationExclusion_DoesNotChargeTheParentIndividualBudget()
    {
        var constraint = new MicroiV8MemoryConstraint(1024 * 1024);
        constraint.Reset();

        byte[] childAllocation;
        using (constraint.ExcludeNestedExecution())
        {
            childAllocation = new byte[2 * 1024 * 1024];
            childAllocation[0] = 1;
        }

        constraint.Check();
        Assert.True(constraint.AllocatedBytes < constraint.MemoryLimit);
        GC.KeepAlive(childAllocation);
    }

    [Fact]
    public void NestedAllocationExclusion_StillLeavesTheRootCallTreeGuardActive()
    {
        var individual = new MicroiV8MemoryConstraint(8 * 1024 * 1024);
        using var engine = new Engine(options =>
        {
            options.Constraint(individual);
            options.LimitMemory(1024 * 1024);
        });
        engine.Constraints.Reset();

        byte[] childAllocation;
        using (individual.ExcludeNestedExecution())
        {
            childAllocation = new byte[2 * 1024 * 1024];
            childAllocation[0] = 1;
        }

        individual.Check();
        var exception = Assert.ThrowsAny<Exception>(() => engine.Constraints.Check());
        Assert.Contains("MemoryLimit", exception.GetType().Name, StringComparison.OrdinalIgnoreCase);
        GC.KeepAlive(childAllocation);
    }

    [Fact]
    public void CallTreeBudget_CannotBeLowerThanTheIndividualEngineBudget()
    {
        var limits = new CreateV8EngineParam
        {
            LimitMemory = 4096,
            CallTreeLimitMemory = 1024,
            MaxCallTreeLimitMemoryMB = 32768
        };

        limits.Normalize();

        Assert.Equal(4096, limits.CallTreeLimitMemory);
    }

    [Fact]
    public void TenantSettings_ClampCallTreeAndDepthToNodeHardLimits()
    {
        var limits = CreateV8EngineParam.FromSysConfig(new JObject
        {
            ["V8MaxCallTreeLimitMemoryMB"] = 16384,
            ["V8CallTreeLimitMemoryMB"] = 20000,
            ["V8MaxNestedApiDepth"] = 48,
            ["V8NestedApiDepth"] = 60,
            ["V8IsolateNestedApiMemory"] = 0
        });

        Assert.Equal(16384, limits.MaxCallTreeLimitMemoryMB);
        Assert.Equal(16384, limits.CallTreeLimitMemory);
        Assert.Equal(48, limits.MaxNestedApiDepthValue);
        Assert.Equal(48, limits.NestedApiDepth);
        Assert.False(limits.IsolateNestedApiMemory);
    }

    [Fact]
    public void CreateEngine_TwoGigabyteBudget_DoesNotOverflowIntegerBytes()
    {
        var limits = new CreateV8EngineParam
        {
            LimitMemory = 2048,
            MaxLimitMemoryMB = 8192
        };

        using var engine = new V8Engine().CreateEngine(limits);
        Assert.Equal(42D, engine.Evaluate("40 + 2").AsNumber());
    }

    [Fact]
    public void HighMemoryNode_CanExplicitlyUseEightGigabyteCeilingWithoutChangingDefault()
    {
        var limits = CreateV8EngineParam.FromSysConfig(new JObject
        {
            ["V8MaxLimitMemoryMB"] = 8192,
            ["V8DefaultLimitMemoryMB"] = 6144
        });

        Assert.Equal(8192, limits.MaxLimitMemoryMB);
        Assert.Equal(6144, limits.LimitMemory);
        Assert.Equal(2048, CreateV8EngineParam.DefaultLimitMemory);
    }

    [Fact]
    public void CreateEngine_PreservesPre414ClrArraySnapshotSemantics()
    {
        using var engine = new V8Engine().CreateEngine(new CreateV8EngineParam { LimitMemory = 64 });
        var values = new[] { 1, 2, 3 };
        engine.SetValue("values", values);

        Assert.True(engine.Evaluate("Array.isArray(values)").AsBoolean());
        engine.Execute("values[0] = 99; values.push(4);");

        Assert.Equal(new[] { 1, 2, 3 }, values);
        Assert.Equal(4D, engine.Evaluate("values.length").AsNumber());
    }

    [Fact]
    public async Task SetTimeout_IsDrainedOnTheOwningEngineBeforeDisposal()
    {
        using var engine = new V8Engine().CreateEngine(new CreateV8EngineParam
        {
            LimitMemory = 64,
            Timeout = 5
        });
        using var host = new JintHostEnvironment();
        host.InjectTo(engine);

        engine.Execute("var timerResult = 0; setTimeout(function () { timerResult = 42; }, 5);");
        await host.DrainTimersAsync(engine, TestContext.Current.CancellationToken);

        Assert.Equal(42D, engine.Evaluate("timerResult").AsNumber());
    }

    [Fact]
    public async Task ClearTimeout_PreventsTheCallbackFromRunning()
    {
        using var engine = new V8Engine().CreateEngine(new CreateV8EngineParam
        {
            LimitMemory = 64,
            Timeout = 5
        });
        using var host = new JintHostEnvironment();
        host.InjectTo(engine);

        engine.Execute("var timerResult = 0; var timerId = setTimeout(function () { timerResult = 42; }, 5); clearTimeout(timerId);");
        await host.DrainTimersAsync(engine, TestContext.Current.CancellationToken);

        Assert.Equal(0D, engine.Evaluate("timerResult").AsNumber());
    }
}

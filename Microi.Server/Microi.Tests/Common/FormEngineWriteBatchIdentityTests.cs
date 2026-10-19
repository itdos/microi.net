using System.Reflection;
using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class FormEngineWriteBatchIdentityTests
{
    private static Task<List<DiyTableRowParam>> Prepare(FormEngine engine, JArray input) =>
        (Task<List<DiyTableRowParam>>)typeof(FormEngine).GetMethod("PrepareWriteBatchAsync",
            BindingFlags.NonPublic | BindingFlags.Instance)!.Invoke(engine, new object[] { input })!;

    private static Task<DosResult> Run(FormEngine engine, DiyTableRowParam row, Func<Task<DosResult>> body) =>
        (Task<DosResult>)typeof(FormEngine).GetMethod("ExecuteWriteBatchRowAsync",
            BindingFlags.NonPublic | BindingFlags.Instance)!.Invoke(engine, new object[] { row, body })!;

    private static JArray Rows(int count) => new(Enumerable.Range(0, count).Select(i =>
        new JObject { ["FormEngineKey"] = "items", ["Id"] = i.ToString(), ["Name"] = "row" }));

    [Fact]
    public async Task LargeWritePreparationDoesNotMaterializePermissionTreesForEveryRow()
    {
        using var fixture = new FormEngineCountBatchIdentityTests.IdentityFixture();
        var engine = new FormEngine();
        await Prepare(engine, Rows(1));
        var input = Rows(2665);
        var baselineStart = GC.GetAllocatedBytesForCurrentThread();
        var baselineRows = await Prepare(engine, input);
        var baselineAllocated = GC.GetAllocatedBytesForCurrentThread() - baselineStart;
        Assert.Equal(2665, baselineRows.Count);
        fixture.Cache.Model!.CurrentUser["_RoleLimits"] = new JArray(Enumerable.Range(0, 7403)
            .Select(i => new JObject { ["Id"] = i, ["FkId"] = "menu-" + i, ["Permission"] = "write" }));
        fixture.Cache.Reads = 0;
        var before = GC.GetAllocatedBytesForCurrentThread();
        var rows = await Prepare(engine, input);
        var allocated = GC.GetAllocatedBytesForCurrentThread() - before;
        Assert.Equal(2665, rows.Count);
        Assert.Equal(0, fixture.Cache.Reads);
        Assert.All(rows, r => Assert.Null(r._CurrentUser));
        // Row normalization itself allocates. Expanding the account to thousands
        // of permissions must not multiply that cost by the number of rows.
        Assert.True(allocated <= baselineAllocated + 512 * 1024,
            $"Permission tree increased preparation from {baselineAllocated:N0} to {allocated:N0} bytes");
        Assert.True(allocated < 64 * 1024 * 1024, $"Preparation allocated {allocated:N0} bytes");
    }

    [Fact]
    public async Task RowsReloadIdentityAndReleaseItOnSuccessFailureAndException()
    {
        using var fixture = new FormEngineCountBatchIdentityTests.IdentityFixture();
        var engine = new FormEngine();
        var rows = await Prepare(engine, Rows(3));
        JObject? first = null;
        await Run(engine, rows[0], () =>
        {
            first = rows[0]._CurrentUser;
            Assert.NotSame(fixture.Cache.Model!.CurrentUser, first);
            first["RoleIds"]![0] = "local-mutation";
            return Task.FromResult(new DosResult(1));
        });
        Assert.Null(rows[0]._CurrentUser);
        Assert.Equal("role-a", fixture.Cache.Model!.CurrentUser["RoleIds"]![0]!.Value<string>());
        fixture.Cache.Model.CurrentUser["Level"] = 1;
        var failure = await Run(engine, rows[1], () =>
        {
            Assert.NotSame(first, rows[1]._CurrentUser);
            Assert.Equal(1, rows[1]._CurrentUser["Level"]!.Value<int>());
            return Task.FromResult(new DosResult(0));
        });
        Assert.Equal(0, failure.Code);
        Assert.Null(rows[1]._CurrentUser);
        await Assert.ThrowsAsync<InvalidOperationException>(() => Run(engine, rows[2], () =>
            throw new InvalidOperationException("row failed")));
        Assert.Null(rows[2]._CurrentUser);
        Assert.Equal(3, fixture.Cache.Reads);
    }

    [Fact]
    public async Task RevokedSessionIsNotReusedAndExplicitIdentityRemainsDetached()
    {
        using var fixture = new FormEngineCountBatchIdentityTests.IdentityFixture();
        var engine = new FormEngine();
        var input = Rows(2);
        input[1]["_CurrentUser"] = new JObject { ["Id"] = "server-owned", ["Level"] = 3 };
        var rows = await Prepare(engine, input);
        fixture.Cache.Model = null;
        await Run(engine, rows[0], () =>
        {
            Assert.Null(rows[0]._CurrentUser);
            return Task.FromResult(new DosResult(0));
        });
        var explicitUser = rows[1]._CurrentUser;
        Assert.NotSame(input[1]["_CurrentUser"], explicitUser);
        await Run(engine, rows[1], () => Task.FromResult(new DosResult(1)));
        Assert.Same(explicitUser, rows[1]._CurrentUser);
        Assert.Equal("server-owned", rows[1]._CurrentUser["Id"]!.Value<string>());
        Assert.Equal(1, fixture.Cache.Reads);
    }
}

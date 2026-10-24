using System.Diagnostics;
using System.Text.Json;
using System.Text.RegularExpressions;
using MongoDB.Driver;

namespace Microi.Tests.MemoryDiagnostics;

/// <summary>内存诊断断言归入统一门禁；改变线程池或采集 EventPipe 的场景仍在子进程隔离。</summary>
public sealed class MemoryDiagnosticsProcessTests
{
    private static readonly string WorkspaceRoot = Common.TestProjectPaths.WorkspaceRoot();
    private static readonly string Fixture = Path.Combine(AppContext.BaseDirectory, "Fixtures", "MemoryDiagnosticsNode",
        "Microi.MemoryDiagnostics.Fixture.dll");

    [Fact]
    public async Task UnitAndContractRegressions()
    {
        var output = await RunFixtureAsync(TimeSpan.FromSeconds(90), NewEvidenceDirectory());
        Assert.Contains("\"Passed\":", output, StringComparison.Ordinal);
    }

    public static bool IsWindowsPhysicalMemoryProbe => OperatingSystem.IsWindows();

    [Fact(Skip = "Requires Windows native physical memory", SkipUnless = nameof(IsWindowsPhysicalMemoryProbe))]
    public async Task ProcessMemoryCapacity_UsesWindowsPhysicalMemoryDespiteGcHeapHardLimit()
    {
        // 独立CIM读回OS可见物理容量，不用被测provider或GC堆预算充当期望值。
        var start = new ProcessStartInfo("powershell.exe")
        {
            UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true
        };
        foreach (var arg in new[] { "-NoProfile", "-NonInteractive", "-Command",
                     "[Console]::Write(([uint64](Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize * 1024).ToString([Globalization.CultureInfo]::InvariantCulture))" })
            start.ArgumentList.Add(arg);
        using var physical = Process.Start(start) ?? throw new InvalidOperationException("Windows physical memory probe failed to start.");
        var stdout = physical.StandardOutput.ReadToEndAsync();
        var stderr = physical.StandardError.ReadToEndAsync();
        try
        {
            await physical.WaitForExitAsync(TestContext.Current.CancellationToken)
                .WaitAsync(TimeSpan.FromSeconds(20), TestContext.Current.CancellationToken);
        }
        finally
        {
            if (!physical.HasExited) await StopCapacityProbeAsync(physical);
        }
        var physicalText = await stdout;
        await stderr;
        Assert.True(physical.ExitCode == 0, "Windows physical memory probe failed.");
        Assert.True(long.TryParse(physicalText, System.Globalization.NumberStyles.None,
            System.Globalization.CultureInfo.InvariantCulture, out var physicalBytes), "Windows physical capacity is not an integer.");
        Assert.True(physicalBytes >= 128L * 1024 * 1024, "Windows physical capacity is unavailable.");

        var output = await RunFixtureAsync(TimeSpan.FromSeconds(30), "process-memory-capacity");
        using var state = JsonDocument.Parse(output);
        Assert.Equal(256L * 1024 * 1024, state.RootElement.GetProperty("GcAvailableBytes").GetInt64());
        Assert.Equal("WindowsGlobalMemoryStatusEx", state.RootElement.GetProperty("Source").GetString());
        Assert.Equal(physicalBytes, state.RootElement.GetProperty("TotalBytes").GetInt64());
        Assert.True(physicalBytes > state.RootElement.GetProperty("GcAvailableBytes").GetInt64());
    }

    [Fact]
    public async Task ObservationBenchmark_KeepsAllScriptResultsCorrect()
    {
        var output = await RunFixtureAsync(TimeSpan.FromSeconds(90), "benchmark");
        Assert.Contains("\"CorrectResults\":true", output, StringComparison.Ordinal);
    }

    [Fact, Trait("Category", "FullStack")]
    public async Task CriticalIncidentMySql_ReplayIsolationAndExhaustedBusinessPool()
    {
        Assert.True(!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MICROI_INCIDENT_TEST_MYSQL"))
            || !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MICROI_TEST_SCHEDULE_MYSQL")), "Full 事故持久化验收需要隔离 MySQL。");
        var output = await RunFixtureAsync(TimeSpan.FromMinutes(3), "incident-acceptance", NewEvidenceDirectory());
        Assert.Contains("\"Passed\":true", output, StringComparison.Ordinal);
        Assert.Contains("\"NewProcessEmptyFilesystemRead\":true", output, StringComparison.Ordinal);
    }

    [Fact, Trait("Category", "FullStack")]
    public async Task MongoIncidentReplay_UsesCurrentTestServer()
    {
        RequireEnvironment("MICROI_TEST_MONGO_CURRENT");
        var tenant = NewMongoFixtureTenant();
        try
        {
            var output = await RunFixtureAsync(TimeSpan.FromSeconds(90), NewEvidenceDirectory(), "mongo", tenant);
            Assert.Contains("\"Passed\":", output, StringComparison.Ordinal);
        }
        finally { await CleanupMongoFixtureAsync(tenant); }
    }

    [Fact, Trait("Category", "FullStack")]
    public async Task BoundedQuery_UsesDedicatedTestDatabase()
    {
        Assert.True(!string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MICROI_MEMORY_TEST_CONN"))
            || !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MICROI_TEST_SCHEDULE_MYSQL")),
            "Full 内存诊断 SQL 回归需要专用 MySQL 测试库。");
        var output = await RunFixtureAsync(TimeSpan.FromSeconds(90), "sql");
        Assert.Contains("\"Passed\":true", output, StringComparison.Ordinal);
    }

    [Fact, Trait("Category", "FullStack")]
    public async Task IdentityRefresh_RemainsCorrectAcrossEventPipeSessions()
    {
        var output = await RunFixtureAsync(TimeSpan.FromSeconds(90), "identity", NewEvidenceDirectory());
        Assert.Contains("\"Passed\":true", output, StringComparison.Ordinal);
    }

    [Fact, Trait("Category", "FullStack")]
    public async Task SegmentRotation_RetainsSamplesAndStacks()
    {
        var evidence = NewEvidenceDirectory();
        var ready = Path.Combine(evidence, "allocation-ready.txt");
        using var workload = StartFixture("allocation-loop", ready);
        try
        {
            await WaitForFileAsync(ready, workload, TimeSpan.FromSeconds(30));
            var output = await RunFixtureAsync(TimeSpan.FromMinutes(3), "segments", workload.Id.ToString(),
                Path.Combine(evidence, "segments"));
            Assert.Contains("\"Passed\":true", output, StringComparison.Ordinal);
        }
        finally { await StopAsync(workload); }
    }

    [Fact, Trait("Category", "FullStack")]
    public async Task HttpHost_ExposesTraceAndMemoryContracts()
    {
        RequireEnvironment("MICROI_TEST_MONGO_CURRENT");
        var evidence = NewEvidenceDirectory();
        var scope = NewMongoFixtureTenant();
        var tenantA = scope + "_a";
        var tenantB = scope + "_b";
        Process? host = null;
        try
        {
            host = StartFixture("serve", evidence, tenantA, tenantB);
            var ready = Path.Combine(evidence, "ready.json");
            await WaitForFileAsync(ready, host, TimeSpan.FromSeconds(40));
            using var state = JsonDocument.Parse(await File.ReadAllTextAsync(ready, TestContext.Current.CancellationToken));
            var url = state.RootElement.GetProperty("Url").GetString()!;
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };
            using var trace = JsonDocument.Parse(await client.GetStringAsync(url + "/trace", TestContext.Current.CancellationToken));
            Assert.Equal(32, trace.RootElement.GetProperty("traceId").GetString()!.Length);
            using var memory = JsonDocument.Parse(await client.GetStringAsync(url + "/memory", TestContext.Current.CancellationToken));
            Assert.True(memory.RootElement.TryGetProperty("Executions", out _));
        }
        finally
        {
            // 子进程真正退出后才能删库，避免它仍在写 WAL/Mongo；启动失败也只清理父进程已知的两个 nonce。
            if (host != null)
            {
                try { await StopAsync(host); }
                finally { host.Dispose(); }
            }
            await CleanupMongoFixtureAsync(tenantA, tenantB);
        }
    }

    [Fact]
    public void MongoFixtureDatabaseNamesRejectFixedAndForeignTenants()
    {
        var tenant = NewMongoFixtureTenant();
        Assert.NotEqual(tenant, NewMongoFixtureTenant());
        Assert.Equal("sys_log_" + tenant, OwnedMongoDatabaseName(tenant));
        Assert.Equal("sys_log_" + tenant + "_a", OwnedMongoDatabaseName(tenant + "_a"));
        Assert.Equal("sys_log_" + tenant + "_b", OwnedMongoDatabaseName(tenant + "_b"));
        foreach (var invalid in new[] { "memoryrepositorytest", "memorytesta", "iTdos", "mci_mem_", tenant + "_other", tenant + "/foreign", tenant + "\n" })
            Assert.Throws<ArgumentException>(() => OwnedMongoDatabaseName(invalid));
    }

    private static string NewMongoFixtureTenant() => "mci_mem_" + Guid.NewGuid().ToString("N");

    private static string OwnedMongoDatabaseName(string tenant)
    {
        if (!Regex.IsMatch(tenant, @"\Amci_mem_[a-f0-9]{32}(?:_[ab])?\z"))
            throw new ArgumentException("Only a parent-owned random memory fixture tenant can be cleaned.", nameof(tenant));
        return "sys_log_" + tenant;
    }

    private static async Task CleanupMongoFixtureAsync(params string[] tenants)
    {
        // V8MongoDB 的实际仓储为 sys_log_<tenant>。先校验全部已知名称，不枚举、不清理其它共享数据库。
        var databases = tenants.Select(OwnedMongoDatabaseName).ToArray();
        var connection = Environment.GetEnvironmentVariable("MICROI_TEST_MONGO_CURRENT")
            ?? throw new InvalidOperationException("The memory fixture Mongo connection is missing during cleanup.");
        var settings = MongoClientSettings.FromConnectionString(connection);
        settings.ServerSelectionTimeout = TimeSpan.FromSeconds(5);
        using var client = new MongoClient(settings);
        // TestContext 的取消不应取消收尾；独立且有界的 token 防止失败后遗留随机测试数据。
        using var cleanup = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        foreach (var database in databases) await client.DropDatabaseAsync(database, cleanup.Token);
    }

    private static string NewEvidenceDirectory()
    {
        var directory = Path.Combine(WorkspaceRoot, ".tmp", "reports", "memory-diagnostics-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        return directory;
    }

    private static void RequireEnvironment(string key) =>
        Assert.False(string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable(key)), $"Full 测试缺少 {key}。");

    private static Process StartFixture(params string[] args)
    {
        Assert.True(File.Exists(Fixture), $"内存诊断隔离夹具未构建：{Fixture}");
        var start = new ProcessStartInfo("dotnet") { UseShellExecute = false, CreateNoWindow = true };
        start.ArgumentList.Add(Fixture);
        foreach (var arg in args) start.ArgumentList.Add(arg);
        return Process.Start(start) ?? throw new InvalidOperationException("无法启动内存诊断隔离夹具。");
    }

    private static async Task<string> RunFixtureAsync(TimeSpan timeout, params string[] args)
    {
        Assert.True(File.Exists(Fixture), $"内存诊断隔离夹具未构建：{Fixture}");
        var start = new ProcessStartInfo("dotnet") { UseShellExecute = false, CreateNoWindow = true,
            RedirectStandardOutput = true, RedirectStandardError = true };
        // 只有此容量探针使用小GC堆；正式Full/API及其它夹具原预算不变。
        if (args.FirstOrDefault() == "process-memory-capacity")
        {
            start.Environment["DOTNET_GCHeapHardLimit"] = "0x10000000";
            start.Environment["COMPlus_GCHeapHardLimit"] = "0x10000000";
        }
        start.ArgumentList.Add(Fixture);
        foreach (var arg in args) start.ArgumentList.Add(arg);
        using var process = Process.Start(start) ?? throw new InvalidOperationException("无法启动内存诊断隔离夹具。");
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        var capacityProbe = args.FirstOrDefault() == "process-memory-capacity";
        try
        {
            if (capacityProbe)
                await process.WaitForExitAsync(TestContext.Current.CancellationToken)
                    .WaitAsync(timeout, TestContext.Current.CancellationToken);
            else
                await process.WaitForExitAsync().WaitAsync(timeout);
        }
        catch (Exception probeFailure) when (probeFailure is TimeoutException || (capacityProbe && probeFailure is OperationCanceledException))
        {
            if (capacityProbe) await StopCapacityProbeAsync(process);
            else await StopAsync(process);
            throw;
        }
        var output = await stdout;
        var error = await stderr;
        Assert.True(process.ExitCode == 0, $"隔离夹具退出码 {process.ExitCode}。输出：{output[^Math.Min(output.Length, 3000)..]} 错误：{error[^Math.Min(error.Length, 3000)..]}");
        return output;
    }

    private static async Task WaitForFileAsync(string path, Process process, TimeSpan timeout)
    {
        var deadline = DateTime.UtcNow + timeout;
        while (!File.Exists(path) && DateTime.UtcNow < deadline && !process.HasExited)
            await Task.Delay(100);
        Assert.True(File.Exists(path), $"隔离夹具没有就绪：{path}，退出码：{(process.HasExited ? process.ExitCode : -1)}");
    }

    private static async Task StopCapacityProbeAsync(Process process)
    {
        // 只接收本测试刚创建的probe；cleanup不复用已取消的TestContext token。
        try { if (!process.HasExited) process.Kill(entireProcessTree: true); }
        catch (InvalidOperationException) { /* 子进程可能恰好自行退出。 */ }
        await process.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(10));
    }

    private static async Task StopAsync(Process process)
    {
        try { if (!process.HasExited) process.Kill(entireProcessTree: true); }
        catch (InvalidOperationException) { /* 子进程可能恰好在检查后自行退出。 */ }
        await process.WaitForExitAsync();
    }
}

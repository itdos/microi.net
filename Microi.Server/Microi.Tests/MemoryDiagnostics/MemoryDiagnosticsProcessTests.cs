using System.Diagnostics;
using System.Text.Json;

namespace Microi.Tests.MemoryDiagnostics;

/// <summary>内存诊断断言归入统一门禁；改变线程池或采集 EventPipe 的场景仍在子进程隔离。</summary>
public sealed class MemoryDiagnosticsProcessTests
{
    private static readonly string TestRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", ".."));
    private static readonly string WorkspaceRoot = Path.GetFullPath(Path.Combine(TestRoot, "..", ".."));
    private static readonly string Configuration = Path.GetFileName(Path.GetDirectoryName(AppContext.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar))!);
    private static readonly string Fixture = Path.Combine(TestRoot, "Fixtures", "MemoryDiagnosticsNode", "bin", Configuration,
        "net10.0", "Microi.MemoryDiagnostics.Fixture.dll");

    [Fact]
    public async Task UnitAndContractRegressions()
    {
        var output = await RunFixtureAsync(TimeSpan.FromSeconds(90), NewEvidenceDirectory());
        Assert.Contains("\"Passed\":", output, StringComparison.Ordinal);
    }

    [Fact]
    public async Task ObservationBenchmark_KeepsAllScriptResultsCorrect()
    {
        var output = await RunFixtureAsync(TimeSpan.FromSeconds(90), "benchmark");
        Assert.Contains("\"CorrectResults\":true", output, StringComparison.Ordinal);
    }

    [Fact, Trait("Category", "FullStack")]
    public async Task MongoIncidentReplay_UsesCurrentTestServer()
    {
        RequireEnvironment("MICROI_TEST_MONGO_CURRENT");
        var output = await RunFixtureAsync(TimeSpan.FromSeconds(90), NewEvidenceDirectory(), "mongo");
        Assert.Contains("\"Passed\":", output, StringComparison.Ordinal);
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
        using var host = StartFixture("serve", evidence);
        try
        {
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
        finally { await StopAsync(host); }
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
        start.ArgumentList.Add(Fixture);
        foreach (var arg in args) start.ArgumentList.Add(arg);
        using var process = Process.Start(start) ?? throw new InvalidOperationException("无法启动内存诊断隔离夹具。");
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        try { await process.WaitForExitAsync().WaitAsync(timeout); }
        catch (TimeoutException) { await StopAsync(process); throw; }
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

    private static async Task StopAsync(Process process)
    {
        try { if (!process.HasExited) process.Kill(entireProcessTree: true); }
        catch (InvalidOperationException) { /* 子进程可能恰好在检查后自行退出。 */ }
        await process.WaitForExitAsync();
    }
}

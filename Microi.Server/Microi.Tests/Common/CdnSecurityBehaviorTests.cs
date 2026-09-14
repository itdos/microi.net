using System.Diagnostics;

namespace Microi.Tests.Common;

public sealed class CdnSecurityBehaviorTests
{
    [Fact]
    public async Task Cdn_policy_ip_ownership_and_partial_window_behaviors_pass()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null && !Directory.Exists(Path.Combine(directory.FullName, "AI-Project")))
            directory = directory.Parent;
        Assert.NotNull(directory);
        var app = Path.Combine(directory.FullName, "AI-Project", "microi", "AI应用", "microi-platform-service");
        var start = new ProcessStartInfo("node")
        {
            WorkingDirectory = app,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        start.ArgumentList.Add("--test");
        start.ArgumentList.Add("test/cdn-security.test.mjs");
        using var process = Process.Start(start)!;
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(45));
        try { await process.WaitForExitAsync(timeout.Token); }
        catch (OperationCanceledException) { process.Kill(entireProcessTree: true); throw; }
        var output = await stdout + await stderr;
        Assert.True(process.ExitCode == 0, output);
        Assert.Contains("# fail 0", output);
    }
}

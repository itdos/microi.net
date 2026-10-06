namespace Microi.Tests;

/// <summary>把当前测试源码与编译产物分开定位，兼容标准输出和 SDK 隔离输出。</summary>
internal static class TestSourcePaths
{
    internal static string FindServerRoot() => FindServerRoot(
        AppContext.BaseDirectory,
        Environment.GetEnvironmentVariable("MICROI_TEST_REPOSITORY_ROOT"));

    internal static string FindServerRoot(string outputDirectory, string? repositoryRoot = null)
    {
        if (!string.IsNullOrWhiteSpace(repositoryRoot))
        {
            var configured = Path.GetFullPath(Path.Combine(repositoryRoot, "Microi.Server"));
            if (!IsSourceRoot(configured))
                throw new DirectoryNotFoundException("Configured test repository has no server source projects.");
            return configured;
        }

        for (var directory = new DirectoryInfo(Path.GetFullPath(outputDirectory));
             directory != null; directory = directory.Parent)
        {
            // SDK 的 bin 中也有同名项目目录，必须核对源码项目文件，不能只检查目录名。
            foreach (var candidate in new[] { directory.FullName, Path.Combine(directory.FullName, "Microi.Server") })
                if (IsSourceRoot(candidate)) return candidate;
        }
        throw new DirectoryNotFoundException("Could not locate server source projects from the test output.");
    }

    internal static string FindTestsRoot() => Path.Combine(FindServerRoot(), "Microi.Tests");

    private static bool IsSourceRoot(string directory) =>
        File.Exists(Path.Combine(directory, "Microi.Tests", "Microi.Tests.csproj")) &&
        File.Exists(Path.Combine(directory, "Microi.net.Api", "Microi.net.Api.csproj"));

    internal static string MemoryDiagnosticsFixture(string outputDirectory, string testsRoot, string configuration)
    {
        var output = new DirectoryInfo(Path.GetFullPath(outputDirectory));
        if (output.Parent?.Name.Equals(configuration, StringComparison.OrdinalIgnoreCase) == true &&
            output.Parent.Parent?.Name.Equals("bin", StringComparison.OrdinalIgnoreCase) == true)
            return Path.Combine(testsRoot, "Fixtures", "MemoryDiagnosticsNode", "bin", configuration,
                output.Name, "Microi.MemoryDiagnostics.Fixture.dll");

        if (output.Parent?.Name.Equals("Microi.Tests", StringComparison.Ordinal) == true &&
            output.Parent.Parent?.Name.Equals("bin", StringComparison.OrdinalIgnoreCase) == true &&
            output.Name.Equals(configuration, StringComparison.OrdinalIgnoreCase))
            return Path.Combine(output.Parent.Parent.FullName, "Microi.MemoryDiagnostics.Fixture", output.Name,
                "Microi.MemoryDiagnostics.Fixture.dll");

        // 不借用另一配置或旧 Debug 输出；缺失当前布局必须让原来的夹具断言失败。
        throw new InvalidOperationException("Unsupported test output layout for the current memory fixture configuration.");
    }
}

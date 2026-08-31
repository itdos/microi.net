namespace Microi.Tests.Common;

public sealed class SolutionReferenceTopologyTests
{
    private static readonly string[] ClosedSourceProjects =
    [
        @"Microi.net\Microi.net.csproj",
        @"Microi.AI\Microi.AI.csproj",
        @"Microi.WorkFlow\Microi.WorkFlow.csproj"
    ];

    [Fact]
    public void PublicSolution_DoesNotContainClosedSourceProjects()
    {
        var serverRoot = FindServerRoot();
        var solution = File.ReadAllText(Path.Combine(serverRoot, "Microi.net.sln"));

        foreach (var project in ClosedSourceProjects)
        {
            Assert.DoesNotContain(project, solution, StringComparison.OrdinalIgnoreCase);
        }

        Assert.Contains(@"Microi.SSO\Microi.SSO.csproj", solution, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void DirectoryBuildProps_PinsEachSolutionToItsDeliveryTopology()
    {
        var props = File.ReadAllText(Path.Combine(FindServerRoot(), "Directory.Build.props"));

        Assert.Contains("'$(SolutionFileName)' == 'Microi.net.sln'\">NuGet", props, StringComparison.Ordinal);
        Assert.Contains("'$(SolutionFileName)' == 'Microi.Anderson.sln'\">Project", props, StringComparison.Ordinal);
        Assert.Contains("'$(MicroiClosedSourceReferenceMode)' == 'Auto' and Exists('$(MicroiNetProjectPath)')", props, StringComparison.Ordinal);
        Assert.Contains("'$(MicroiClosedSourceReferenceMode)' == 'Auto' and Exists('$(MicroiAIProjectPath)')", props, StringComparison.Ordinal);
        Assert.Contains("'$(MicroiClosedSourceReferenceMode)' == 'Auto' and Exists('$(MicroiWorkFlowProjectPath)')", props, StringComparison.Ordinal);
    }

    [Fact]
    public void TestProject_UsesTheCentralReferenceMode()
    {
        var testProject = File.ReadAllText(Path.Combine(FindServerRoot(), "Microi.Tests", "Microi.Tests.csproj"));

        Assert.Contains("Condition=\"'$(MicroiNetExists)' == 'true'\"", testProject, StringComparison.Ordinal);
        Assert.Contains("Condition=\"'$(MicroiAIExists)' == 'true'\"", testProject, StringComparison.Ordinal);
        Assert.Contains("Condition=\"'$(MicroiNetExists)' != 'true'\"", testProject, StringComparison.Ordinal);
    }

    private static string FindServerRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, "Microi.Server", "Microi.net.sln");
            if (File.Exists(candidate))
            {
                return Path.GetDirectoryName(candidate)!;
            }

            if (File.Exists(Path.Combine(directory.FullName, "Microi.net.sln")) &&
                File.Exists(Path.Combine(directory.FullName, "Directory.Build.props")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("未找到包含 Microi.net.sln 的 Microi.Server 目录。");
    }
}

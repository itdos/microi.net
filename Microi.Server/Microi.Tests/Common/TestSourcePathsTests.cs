namespace Microi.Tests.Common;

public sealed class TestSourcePathsTests : IDisposable
{
    private readonly string root = Path.Combine(Path.GetTempPath(), "microi-test-layout-" + Guid.NewGuid().ToString("N"));

    [Fact]
    public void IsolatedOutputs_WithSameNamedArtifactFolders_StillSelectSourceProjects()
    {
        var server = SourceWorkspace(root);
        var output = Path.Combine(root, ".tmp", "release", ".net-artifacts", "bin", "Microi.Tests", "release");
        Directory.CreateDirectory(output);
        Directory.CreateDirectory(Path.Combine(root, ".tmp", "release", ".net-artifacts", "bin", "Microi.net.Api"));
        Directory.CreateDirectory(Path.Combine(root, ".tmp", "release", ".net-artifacts", "bin", "Microi.Core"));
        Assert.Equal(server, TestSourcePaths.FindServerRoot(output));
    }

    [Fact]
    public void StandardOutputs_SelectTheSameSourceWorkspace()
    {
        var server = SourceWorkspace(root);
        var output = Path.Combine(server, "Microi.Tests", "bin", "Release", "net10.0");
        Directory.CreateDirectory(output);
        Assert.Equal(server, TestSourcePaths.FindServerRoot(output));
    }

    [Fact]
    public void ArtifactDirectoriesAlone_AreNotSourceProjects()
    {
        var output = Path.Combine(root, "bin", "Microi.Tests", "release");
        Directory.CreateDirectory(output);
        Directory.CreateDirectory(Path.Combine(root, "bin", "Microi.net.Api"));
        Directory.CreateDirectory(Path.Combine(root, "bin", "Microi.Core"));
        Assert.Throws<DirectoryNotFoundException>(() => TestSourcePaths.FindServerRoot(output));
    }

    [Fact]
    public void InvalidExplicitRepository_DoesNotSilentlyBorrowAnAncestor()
    {
        var server = SourceWorkspace(root);
        var output = Path.Combine(server, "Microi.Tests", "bin", "Release", "net10.0");
        Directory.CreateDirectory(output);
        Assert.Throws<DirectoryNotFoundException>(() => TestSourcePaths.FindServerRoot(output, Path.Combine(root, "missing")));
        Assert.Equal(server, TestSourcePaths.FindServerRoot(output, root));
    }

    [Fact]
    public void MemoryFixture_UsesOnlyTheMatchingSdkOutputPivot()
    {
        var server = SourceWorkspace(root);
        var bin = Path.Combine(root, ".tmp", "release", ".net-artifacts", "bin");
        var output = Path.Combine(bin, "Microi.Tests", "release");
        var expected = Path.Combine(bin, "Microi.MemoryDiagnostics.Fixture", "release", "Microi.MemoryDiagnostics.Fixture.dll");
        Assert.Equal(expected, TestSourcePaths.MemoryDiagnosticsFixture(output, Path.Combine(server, "Microi.Tests"), "Release"));
        Assert.Throws<InvalidOperationException>(() => TestSourcePaths.MemoryDiagnosticsFixture(output, Path.Combine(server, "Microi.Tests"), "Debug"));
    }

    [Fact]
    public void MemoryFixture_StandardLayoutKeepsItsConfigurationAndFramework()
    {
        var server = SourceWorkspace(root);
        var tests = Path.Combine(server, "Microi.Tests");
        var output = Path.Combine(tests, "bin", "Release", "net10.0");
        Assert.Equal(Path.Combine(tests, "Fixtures", "MemoryDiagnosticsNode", "bin", "Release", "net10.0",
            "Microi.MemoryDiagnostics.Fixture.dll"), TestSourcePaths.MemoryDiagnosticsFixture(output, tests, "Release"));
    }

    private static string SourceWorkspace(string workspace)
    {
        var server = Path.Combine(workspace, "Microi.Server");
        foreach (var project in new[] { "Microi.Tests", "Microi.net.Api" })
        {
            Directory.CreateDirectory(Path.Combine(server, project));
            File.WriteAllText(Path.Combine(server, project, project + ".csproj"), "<Project />");
        }
        return server;
    }

    public void Dispose()
    {
        var full = Path.GetFullPath(root);
        var parent = Path.GetFullPath(Path.GetTempPath()).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!full.StartsWith(parent, StringComparison.OrdinalIgnoreCase) ||
            !Path.GetFileName(full).StartsWith("microi-test-layout-", StringComparison.Ordinal))
            throw new InvalidOperationException("Test fixture cleanup target is outside its owned temporary directory.");
        if (Directory.Exists(full)) Directory.Delete(full, recursive: true);
    }
}

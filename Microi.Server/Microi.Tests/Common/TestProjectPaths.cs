using System.Runtime.CompilerServices;

namespace Microi.Tests.Common;

// Source contracts must resolve the checkout, never SDK bin/obj directories with
// similarly named projects. Full builds deliberately place their outputs elsewhere.
internal static class TestProjectPaths
{
    internal static string ProjectRoot([CallerFilePath] string sourceFile = "")
    {
        foreach (var start in new[] { Path.GetDirectoryName(sourceFile), Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        {
            for (var directory = string.IsNullOrEmpty(start) ? null : new DirectoryInfo(start);
                 directory != null; directory = directory.Parent)
            {
                foreach (var candidate in new[] { directory.FullName, Path.Combine(directory.FullName, "Microi.Server", "Microi.Tests") })
                {
                    if (File.Exists(Path.Combine(candidate, "Microi.Tests.csproj"))
                        && File.Exists(Path.Combine(candidate, "run-tests.ps1")))
                        return candidate;
                }
            }
        }
        throw new DirectoryNotFoundException("Could not locate the Microi.Tests source project.");
    }

    internal static string ServerRoot() => Directory.GetParent(ProjectRoot())!.FullName;
    internal static string WorkspaceRoot() => Directory.GetParent(ServerRoot())!.FullName;
}

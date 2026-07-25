using System.Text.RegularExpressions;

namespace Microi.Tests.Common;

public sealed class RepositorySecretHygieneTests
{
    private static readonly string[] GeneratedDirectoryNames =
    [
        "bin",
        "obj",
        "TestResults"
    ];

    [Fact]
    public void TestProject_DoesNotContainCredentialFilesOrHighConfidenceSecretLiterals()
    {
        var projectRoot = FindProjectRoot();
        var files = Directory.EnumerateFiles(projectRoot, "*", SearchOption.AllDirectories)
            .Where(path => !HasGeneratedDirectory(path))
            .ToArray();

        var forbiddenFiles = files
            .Where(IsCredentialFile)
            .Select(path => Path.GetRelativePath(projectRoot, path))
            .ToArray();
        Assert.Empty(forbiddenFiles);

        var privateKeyMarker = "-----BEGIN " + "PRIVATE KEY-----";
        var highConfidenceSecretPatterns = new[]
        {
            new Regex(Regex.Escape(privateKeyMarker), RegexOptions.CultureInvariant),
            new Regex(@"\bBearer\s+[A-Za-z0-9._-]{32,}\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant),
            new Regex(@"\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b", RegexOptions.CultureInvariant),
            new Regex(@"\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b", RegexOptions.CultureInvariant),
            new Regex(@"\bAKIA[0-9A-Z]{16}\b", RegexOptions.CultureInvariant)
        };

        var findings = new List<string>();
        foreach (var file in files.Where(IsTextFile))
        {
            var content = File.ReadAllText(file);
            if (highConfidenceSecretPatterns.Any(pattern => pattern.IsMatch(content)))
            {
                findings.Add(Path.GetRelativePath(projectRoot, file));
            }
        }

        Assert.Empty(findings);
    }

    [Fact]
    public void TestOutput_DoesNotPublishPrivateTenantSettings()
    {
        var privateSettings = Directory.EnumerateFiles(
                AppContext.BaseDirectory,
                "appsettings.iTdos.json",
                SearchOption.AllDirectories)
            .ToArray();

        Assert.Empty(privateSettings);
    }

    private static string FindProjectRoot()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "Microi.Tests.csproj")))
            {
                return directory.FullName;
            }
            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException("Could not locate the Microi.Tests project root.");
    }

    private static bool HasGeneratedDirectory(string path)
    {
        var segments = Path.GetRelativePath(FindProjectRoot(), path)
            .Split(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        return segments.Any(segment => GeneratedDirectoryNames.Contains(
            segment,
            StringComparer.OrdinalIgnoreCase));
    }

    private static bool IsCredentialFile(string path)
    {
        var fileName = Path.GetFileName(path);
        return fileName.Equals(".env", StringComparison.OrdinalIgnoreCase)
               || fileName.StartsWith(".env.", StringComparison.OrdinalIgnoreCase)
               || fileName.StartsWith("appsettings.", StringComparison.OrdinalIgnoreCase)
               || new[] { ".pfx", ".p12", ".pem", ".key" }.Contains(
                   Path.GetExtension(path),
                   StringComparer.OrdinalIgnoreCase);
    }

    private static bool IsTextFile(string path)
    {
        return new[] { ".cs", ".csproj", ".ps1", ".md", ".json", ".xml", ".yml", ".yaml" }
            .Contains(Path.GetExtension(path), StringComparer.OrdinalIgnoreCase);
    }
}

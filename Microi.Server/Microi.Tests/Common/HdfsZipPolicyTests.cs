using System.Collections.Generic;
using System.Reflection;
using Microi.net.Api;

namespace Microi.Tests.Common;

public class HdfsZipPolicyTests
{
    private static MethodInfo PrivateStatic(string name)
    {
        var method = typeof(HDFSController).GetMethod(name, BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        return method;
    }

    [Theory]
    [InlineData("../../附件下载", "附件下载.zip")]
    [InlineData("bad:name?.zip", "bad_name_.zip")]
    [InlineData("", "files-")]
    public void Archive_names_are_normalized_to_safe_zip_files(string requestedName, string expectedPrefix)
    {
        var normalized = PrivateStatic("NormalizeZipArchiveName")
            .Invoke(null, new object?[] { requestedName })?.ToString() ?? "";

        Assert.EndsWith(".zip", normalized, StringComparison.OrdinalIgnoreCase);
        if (expectedPrefix == "files-") Assert.StartsWith(expectedPrefix, normalized, StringComparison.Ordinal);
        else Assert.Equal(expectedPrefix, normalized);
        Assert.DoesNotContain("/", normalized, StringComparison.Ordinal);
        Assert.DoesNotContain("\\", normalized, StringComparison.Ordinal);
    }

    [Fact]
    public void Zip_entries_strip_directories_and_keep_duplicate_names_distinct()
    {
        var usedNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var first = PrivateStatic("BuildZipEntryName").Invoke(
            null, new object?[] { "tenant/a/report.pdf", 1, usedNames })?.ToString();
        var second = PrivateStatic("BuildZipEntryName").Invoke(
            null, new object?[] { "other/report.pdf", 2, usedNames })?.ToString();

        Assert.Equal("report.pdf", first);
        Assert.Equal("report (1).pdf", second);
        Assert.Equal(2, usedNames.Count);
    }
}

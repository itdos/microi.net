using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using Microi.net;

namespace Microi.Tests.Common;

public sealed class TenantProvisioningProgressContractTests
{
    [Fact]
    public void AdminProvisioningReporter_UsesTheSharedThirteenStepContractForEveryWrite()
    {
        Assert.Equal(13, TenantProvisioningProgressContract.TotalSteps);
        Assert.Equal(
            TenantProvisioningProgressContract.TotalSteps - 2,
            TenantProvisioningProgressContract.HostProvisioningCompletedStep);

        var source = File.ReadAllText(GetTenantProvisioningServicePath());
        var reporterStart = source.IndexOf(
            "private sealed class TenantProvisioningProgressReporter",
            StringComparison.Ordinal);
        var reporterEnd = source.IndexOf(
            "public static DosResult ValidateTenantSqlZipPackage",
            reporterStart,
            StringComparison.Ordinal);
        Assert.True(reporterStart >= 0 && reporterEnd > reporterStart);

        var reporter = source.Substring(reporterStart, reporterEnd - reporterStart);
        var progressWriteCount = Regex.Matches(
            reporter,
            @"BackgroundTaskRuntime\.TryUpdateProgress\(").Count;
        var sharedTotalCount = Regex.Matches(
            reporter,
            @"TenantProvisioningProgressContract\.TotalSteps").Count;

        Assert.Equal(3, progressWriteCount);
        Assert.Equal(progressWriteCount, sharedTotalCount);
        Assert.DoesNotMatch(@"TryUpdateProgress\([\s\S]*?,\s*12\s*\)", reporter);
    }

    private static string GetTenantProvisioningServicePath(
        [CallerFilePath] string sourcePath = "")
    {
        return Path.GetFullPath(Path.Combine(
            Path.GetDirectoryName(sourcePath)!,
            "..",
            "..",
            "Microi.Core",
            "Runtime",
            "TenantProvisioningService.cs"));
    }
}

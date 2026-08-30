using Microi.net;

namespace Microi.Tests.Common;

[Collection(DbConnectionDiagnosticsCollection.Name)]
public sealed class DbConnectionDiagnosticsTests
{
    [Fact]
    public void Enable_RejectsInvalidIntervals()
    {
        DbConnectionDiagnostics.Disable();
        Assert.Throws<ArgumentOutOfRangeException>(() => DbConnectionDiagnostics.Enable(0));
        Assert.Throws<ArgumentOutOfRangeException>(() => DbConnectionDiagnostics.Enable(86401));
    }

    [Fact]
    public void ActivityTracking_NormalizesTenantAndNeverReportsNegativeActiveCount()
    {
        DbConnectionDiagnostics.Disable();
        DbConnectionDiagnostics.Reset();
        try
        {
            DbConnectionDiagnostics.Enable(3600);
            DbConnectionDiagnostics.RecordActivity(null!, success: true);
            DbConnectionDiagnostics.RecordRelease(null!);
            DbConnectionDiagnostics.RecordRelease(null!);

            var report = DbConnectionDiagnostics.GetDiagnosticsReport();
            Assert.Contains("客户端: (unknown)", report, StringComparison.Ordinal);
            Assert.Contains("活跃连接: 0", report, StringComparison.Ordinal);
            Assert.DoesNotContain("活跃连接: -", report, StringComparison.Ordinal);
        }
        finally
        {
            DbConnectionDiagnostics.Disable();
            DbConnectionDiagnostics.Reset();
        }
    }
}

[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class DbConnectionDiagnosticsCollection
{
    public const string Name = "DbConnectionDiagnostics serial tests";
}

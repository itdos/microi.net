using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class OpsEventIngestTests
{
    private static readonly DateTimeOffset Now = new(2026, 9, 6, 12, 0, 0, TimeSpan.Zero);
    private static JObject Entry() => new()
    {
        ["eventId"] = "aabbaa11112222333344445555667788", ["deploymentId"] = "production-a", ["action"] = "UpdateSucceeded",
        ["occurredAt"] = "2026-08-31T23:59:59Z", ["message"] = "password=do-not-store", ["success"] = true,
        ["OsClient"] = "attacker-tenant", ["Source"] = "trusted-server", ["UserId"] = "forged-user"
    };
    [Fact]
    public void ReceiptReplay_UsesOriginalMonthAndTenantBoundDeterministicId()
    {
        var user = new JObject { ["Id"] = "administrator-id", ["Name"] = "平台管理员" };
        var first = V8Method.BuildOpsLog(Entry(), "iTdos", user, Now);
        var repeat = V8Method.BuildOpsLog(Entry(), "iTdos", user, Now.AddDays(1));
        Assert.Equal(first.EventId, repeat.EventId);
        var localOccurred = DateTimeOffset.Parse("2026-08-31T23:59:59Z").LocalDateTime;
        Assert.Equal(localOccurred, first.OccurredAt!.Value);
        Assert.Equal(DateTimeKind.Local, first.OccurredAt.Value.Kind);
        Assert.Equal(localOccurred.ToString("yyyyMM"), first.OccurredAt.Value.ToString("yyyyMM"));
        Assert.Equal(first.OccurredAt, repeat.OccurredAt);
        Assert.Equal("iTdos", first.OsClient); Assert.Equal("Microi.Ops", first.Source);
        Assert.Equal("administrator-id", first.UserId); Assert.DoesNotContain("do-not-store", first.Content);
        Assert.NotEqual(first.EventId, V8Method.BuildOpsLog(Entry(), "other", user, Now).EventId);
    }
    [Theory]
    [InlineData("eventId", "existing-system-log-id")]
    [InlineData("deploymentId", "../foreign")]
    [InlineData("action", "DeleteAll;Run")]
    [InlineData("occurredAt", "2026-09-07T00:00:00Z")]
    [InlineData("occurredAt", "2020-01-01T00:00:00Z")]
    public void UntrustedIdentityAndTime_AreRejected(string field, string value)
    {
        var entry = Entry(); entry[field] = value;
        Assert.Throws<ArgumentException>(() => V8Method.BuildOpsLog(entry, "iTdos", new JObject(), Now));
    }
    [Fact]
    public void OutsideTrustedEngine_CannotIngestEvents()
    {
        Assert.NotEqual(1, new V8Method().IngestOpsEvent(Entry()).Code);
    }
    [Fact]
    public void MongoUtcEvent_UsesLegacyLocalTimeAtDisplayBoundary()
    {
        var utc = Now.UtcDateTime;
        Assert.Equal(utc.ToLocalTime(), V8Method.ObservabilityLocalTime(utc));
        Assert.Equal(DateTimeKind.Local, V8Method.ObservabilityLocalTime(utc).Kind);
        var legacy = DateTime.SpecifyKind(Now.DateTime, DateTimeKind.Unspecified);
        Assert.Equal(legacy, V8Method.ObservabilityLocalTime(legacy));
        Assert.Equal(DateTimeKind.Unspecified, V8Method.ObservabilityLocalTime(legacy).Kind);
    }
}

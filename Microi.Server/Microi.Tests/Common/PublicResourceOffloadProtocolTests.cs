using System;
using Microi.net;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Microi.Tests.Common;

public sealed class PublicResourceOffloadProtocolTests
{
    [Theory]
    [InlineData(1073741823L, false)]
    [InlineData(1073741824L, true)]
    [InlineData(1073741825L, true)]
    [InlineData(-1L, false)]
    [InlineData(null, false)]
    public void ThresholdUsesActualBinaryGiBAndUnknownIsNotZero(long? bytes, bool expected)
        => Assert.Equal(expected, PublicResourceOffloadProtocol.ReachedThreshold(bytes, 1m));

    [Fact]
    public void DisabledOrMissingThresholdNeverEnablesBackup()
    {
        Assert.False(PublicResourceOffloadProtocol.ReachedThreshold(long.MaxValue, null));
        Assert.False(PublicResourceOffloadProtocol.ReachedThreshold(long.MaxValue, 0));
        Assert.False(PublicResourceOffloadProtocol.ReachedThreshold(long.MaxValue, -1));
    }

    [Fact]
    public void CompleteDayMeansFinishedBeijingNaturalDay()
    {
        var start = DateTimeOffset.Parse("2026-10-24T16:00:00Z");
        var end = start.AddDays(1);
        Assert.True(PublicResourceOffloadProtocol.CompleteDay(start, end, end.AddHours(1)));
        Assert.False(PublicResourceOffloadProtocol.CompleteDay(start, end, end.AddSeconds(-1)));
        Assert.False(PublicResourceOffloadProtocol.CompleteDay(start, end.AddSeconds(-1), end));
        Assert.False(PublicResourceOffloadProtocol.CompleteDay(start.AddHours(8), end.AddHours(8), end.AddDays(1)));
    }

    [Fact]
    public void SharedStateTamperingOrCrossTenantUseCannotAuthorizeRouting()
    {
        var secret = new string('k', 48);
        var proof = new JObject { ["State"] = "Ready", ["Version"] = "v1", ["Bytes"] = 1073741824L };
        var wire = PublicResourceOffloadProtocol.Seal(proof, "tenant-a", secret);
        Assert.Equal("Ready", PublicResourceOffloadProtocol.Open(wire, "tenant-a", secret)?.Value<string>("State"));
        Assert.Null(PublicResourceOffloadProtocol.Open(wire, "tenant-b", secret));
        Assert.Null(PublicResourceOffloadProtocol.Open(wire, "tenant-a", new string('z', 48)));
        Assert.Null(PublicResourceOffloadProtocol.Open(wire[..^1] + (wire[^1] == '0' ? '1' : '0'), "tenant-a", secret));
        Assert.Null(PublicResourceOffloadProtocol.Open("Ready", "tenant-a", secret));
    }

    [Theory]
    [InlineData("tenant-a/micro-app/app/assets/model.glb", true)]
    [InlineData("tenant-b/micro-app/app/assets/model.glb", false)]
    [InlineData("tenant-a/private/model.glb", false)]
    [InlineData("tenant-a/private-source/model.glb", false)]
    [InlineData("tenant-a/.env", false)]
    [InlineData("tenant-a/../tenant-b/model.glb", false)]
    [InlineData("tenant-a/assets/%2e%2e/model.glb", false)]
    [InlineData("tenant-a/assets/app.js.map", false)]
    public void PrivateNamespacesAndTraversalCannotBecomePublicReplicas(string path, bool expected)
        => Assert.Equal(expected, PublicResourceOffloadProtocol.PublicObject("tenant-a", path));

    [Theory]
    [InlineData("http://nas.example.test:1120")]
    [InlineData("https://user:password@nas.example.test:1120")]
    [InlineData("https://nas.example.test:1120/path")]
    [InlineData("https://nas.example.test:1120?token=x")]
    [InlineData("https://nas.example.test:1120#fragment")]
    [InlineData("https://nas.example.test:1120/%2e%2e")]
    public void BackupOriginCannotBeAnOpenRedirectOrCarryCredentials(string origin)
        => Assert.Null(PublicResourceOffloadProtocol.HttpsOrigin(origin));

    [Fact]
    public void PublicBackupUrlBindsBucketAndVersionedReplicaNamespace()
    {
        var prefix = PublicResourceOffloadProtocol.Prefix + "tenant-a/app/" + new string('a', 64) + "/" + new string('b', 32) + "/";
        Assert.Equal("https://nas.example.test:1120/public/" + prefix + "assets/model.glb",
            PublicResourceOffloadProtocol.BackupUrl("https://nas.example.test:1120", "public", prefix, "assets/model.glb"));
        Assert.Null(PublicResourceOffloadProtocol.BackupUrl("https://nas.example.test", "public", "private/", "model.glb"));
        Assert.Null(PublicResourceOffloadProtocol.BackupUrl("https://nas.example.test", "public", prefix, "../private/file"));
    }

    [Theory]
    [InlineData("https://files.example.test/tenant-a/micro-app/app/assets/model.glb", "files.example.test", true)]
    [InlineData("https://files.example.test/tenant-a/micro-app/app/assets/model.glb?Signature=secret", "files.example.test", false)]
    [InlineData("https://evil.example.test/tenant-a/micro-app/app/assets/model.glb", "files.example.test", false)]
    [InlineData("https://files.example.test/tenant-a/private/source.zip", "files.example.test", false)]
    [InlineData("https://files.example.test/microi/application-assets/v3/tenants/tenant-a/kinds/runtime/apps/app/releases/v1/assets/index.js", "files.example.test", true)]
    public void CloudRowsMustMatchTheQueriedPublicDomainAndKnownRuntimeNamespace(string url, string host, bool expected)
        => Assert.Equal(expected, PublicResourceOffloadRuntime.TryReportApplication(url, host, out _, out _));
}

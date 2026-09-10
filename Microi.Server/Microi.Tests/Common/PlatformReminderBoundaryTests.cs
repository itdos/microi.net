using System.Reflection;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class PlatformReminderBoundaryTests
{
    [Theory]
    [InlineData("SuperAdmins", true, 2, true)]
    [InlineData("SuperAdmins", false, 2, false)]
    [InlineData("AllAccounts", false, 1, true)]
    [InlineData("Unknown", true, 2, false)]
    [InlineData("AllAccounts", true, 999, false)]
    [InlineData("AllAccounts", true, 0, false)]
    public void ReceiverBoundary_RechecksLocalAccountAfterSharedCache(string scope, bool administrator, int protocol, bool expected)
    {
        var type = Type.GetType("Microi.net.PlatformReminderRuntime, Microi.net")!;
        var method = type.GetMethod("AllowsRecipient", BindingFlags.Static | BindingFlags.NonPublic)!;
        var batch = new JObject { ["SnapshotJson"] = new JObject {
            ["AccountScope"] = scope, ["MinimumReceiverProtocol"] = protocol
        }.ToString() };
        Assert.Equal(expected, method.Invoke(null, new object[] { batch, administrator }));
        batch["SnapshotJson"] = "broken JSON";
        Assert.Equal(false, method.Invoke(null, new object[] { batch, administrator }));
    }

    [Fact]
    public void RestartIdentity_IsServerGeneratedAndStableForThisProcess()
    {
        var type = Type.GetType("Microi.net.PlatformReminderRuntime, Microi.net")!;
        var epoch = type.GetField("ProcessEpoch", BindingFlags.Static | BindingFlags.NonPublic)!;
        var first = Assert.IsType<string>(epoch.GetValue(null));
        Assert.Matches(@"^\d{21}-[a-f0-9]{32}$", first);
        Assert.Equal(first, epoch.GetValue(null));
        Assert.Equal(2, type.GetField("ReceiverProtocolVersion", BindingFlags.Static | BindingFlags.NonPublic)!.GetRawConstantValue());
    }

    [Fact]
    public void RealtimeGroups_NormalizeTenantAndIsolateDifferentTenants()
    {
        Assert.Equal(PlatformReminderTransport.Group(" TENANT-A "), PlatformReminderTransport.Group("tenant-a"));
        Assert.NotEqual(PlatformReminderTransport.Group("tenant-a"), PlatformReminderTransport.Group("tenant-b"));
        Assert.DoesNotContain("tenant-a", PlatformReminderTransport.Group("tenant-a"));
    }

    [Fact]
    public async Task TrustedReminderAtom_RejectsCallsOutsideItsManagedEngine()
    {
        // Reflection keeps public-source test builds compatible with an older private package.
        var type = Type.GetType("Microi.net.PlatformReminderRuntime, Microi.net");
        Assert.NotNull(type);
        var runtime = Assert.IsAssignableFrom<IPlatformApiRuntime>(Activator.CreateInstance(type!)!);
        var result = JObject.FromObject(await runtime.ExecuteAsync("Context", new JObject {
            ["IsOfficialPlatform"] = true, ["Administrator"] = true, ["OsClient"] = "iTdos"
        }));
        Assert.Equal(0, result.Value<int>("Code"));
    }

    [Theory]
    [InlineData("Published", "Editions", "OpenSource", "OpenSource", true)]
    [InlineData("Published", "Editions", "OpenSource", "Enterprise", false)]
    [InlineData("Published", "Users", "OpenSource", "OpenSource", false)]
    [InlineData("Withdrawn", "Editions", "OpenSource", "OpenSource", false)]
    public void OfficialFeed_RequiresPublishedEditionAndExplicitTarget(string state, string scope, string target, string edition, bool expected)
    {
        var type = Type.GetType("Microi.net.PlatformReminderRuntime, Microi.net")!;
        Assert.Equal("https://api.itdos.com/apiengine/platform-reminder-official-feed?OsClient=iTdos", type.GetField("OfficialFeedUrl")!.GetRawConstantValue());
        var method = type.GetMethod("ContainsEdition", BindingFlags.Static | BindingFlags.NonPublic)!;
        var batch = new JObject { ["State"] = state, ["SnapshotJson"] = new JObject {
            ["ScopeType"] = scope, ["AllTargets"] = true, ["TargetKeys"] = new JArray(target)
        }.ToString() };
        Assert.Equal(expected, method.Invoke(null, new object[]{batch,edition}));
        batch["SnapshotJson"] = "broken JSON";
        Assert.Equal(false, method.Invoke(null, new object[]{batch,edition}));
    }
}

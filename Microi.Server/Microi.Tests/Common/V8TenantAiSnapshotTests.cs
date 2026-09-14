using System;
using System.Numerics;
using System.Reflection;
using System.Threading.Tasks;
using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;
using Xunit;

namespace Microi.Tests.Common;

public class V8TenantAiSnapshotTests
{
    [Fact]
    public void UnusedAi_DoesNotAllocateAFullMutablePermissionTree()
    {
        var user = LargeUser();
        var ai = DispatchProxy.Create<IMicroiAI, RecordingProxy>();
        GC.KeepAlive(new V8TenantAI("tenant-a", user, ai));
        var before = GC.GetAllocatedBytesForCurrentThread();
        var facade = new V8TenantAI("tenant-a", user, ai);
        var allocated = GC.GetAllocatedBytesForCurrentThread() - before;
        Console.WriteLine($"Unused AI identity allocation: {allocated} bytes for 7,403 permissions.");
        GC.KeepAlive(facade);
        Assert.True(allocated < 8 * 1024 * 1024,
            $"Unused AI identity allocated {allocated:N0} bytes for 7,403 permissions.");
    }

    [Fact]
    public async Task Snapshot_IsCapturedBeforeScriptMutation_AndRetainsEveryPermission()
    {
        var user = LargeUser();
        var ai = DispatchProxy.Create<IMicroiAI, RecordingProxy>();
        var facade = new V8TenantAI("tenant-a", user, ai);
        user["Id"] = "forged";
        user["Level"] = 9999;
        ((JArray)user["_RoleLimits"]!).Clear();
        Assert.Equal(1, (await facade.NL2SQL(new NL2SQLParam())).Code);
        var actual = ((RecordingProxy)(object)ai).User!;
        Assert.Equal("trusted", actual.Value<string>("Id"));
        Assert.Equal(1, actual.Value<int>("Level"));
        Assert.Equal(7403, ((JArray)actual["_RoleLimits"]!).Count);
        Assert.Equal("permission-7402", actual["_RoleLimits"]![7402]!.Value<string>("Name"));
    }

    [Fact]
    public async Task Snapshot_PreservesJsonTypesValuesAndAnnotations()
    {
        var user = new JObject {
            ["Id"] = "trusted", ["Level"] = 1,
            ["Integer"] = new JValue(BigInteger.Parse("123456789012345678901234567890")),
            ["Decimal"] = new JValue(1.234567890123456789m),
            ["Double"] = new JValue(double.NaN),
            ["Date"] = new JValue(new DateTime(2026, 9, 13, 1, 2, 3, DateTimeKind.Utc)),
            ["DateString"] = "2026-09-13T01:02:03Z",
            ["Offset"] = new JValue(new DateTimeOffset(2026, 9, 13, 1, 2, 3, TimeSpan.FromHours(8))),
            ["Guid"] = new JValue(Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")),
            ["Uri"] = new JValue(new Uri("https://example.invalid/path")),
            ["TimeSpan"] = new JValue(TimeSpan.FromSeconds(42)),
            ["Bytes"] = new JValue(new byte[] { 1, 2, 3 }),
            ["Null"] = JValue.CreateNull(), ["Undefined"] = JValue.CreateUndefined(),
            ["Raw"] = new JRaw("{\"x\":1}"),
            ["Constructor"] = new JConstructor("Example", 7),
            ["Nested"] = new JArray(new JObject { ["Value"] = true })
        };
        user.AddAnnotation("root-note");
        user["Date"]!.AddAnnotation("date-note");
        user["Nested"]!.AddAnnotation("array-note");
        user.Property("Date")!.AddAnnotation("property-note");
        var ai = DispatchProxy.Create<IMicroiAI, RecordingProxy>();
        var facade = new V8TenantAI("tenant-a", user, ai);
        Assert.Equal(1, (await facade.NL2SQL(new NL2SQLParam())).Code);
        var actual = ((RecordingProxy)(object)ai).User!;
        Assert.True(JToken.DeepEquals(user, actual));
        foreach (var property in user.Properties())
            Assert.Equal(property.Value.Type, actual[property.Name]!.Type);
        Assert.Equal("root-note", actual.Annotation<string>());
        Assert.Equal("date-note", actual["Date"]!.Annotation<string>());
        Assert.Equal("array-note", actual["Nested"]!.Annotation<string>());
        Assert.Equal("property-note", actual.Property("Date")!.Annotation<string>());
    }

    [Fact]
    public async Task Snapshot_IsolatesBinaryAndNestedValuesAcrossFacades()
    {
        var bytes = new byte[] { 1, 2, 3 };
        var user = new JObject { ["Id"] = "trusted", ["Level"] = 1,
            ["Bytes"] = new JValue(bytes), ["Nested"] = new JObject { ["Value"] = "original" } };
        var aiA = DispatchProxy.Create<IMicroiAI, RecordingProxy>();
        var aiB = DispatchProxy.Create<IMicroiAI, RecordingProxy>();
        var a = new V8TenantAI("tenant-a", user, aiA);
        var b = new V8TenantAI("tenant-a", user, aiB);
        bytes[0] = 9;
        user["Nested"]!["Value"] = "forged";
        await a.NL2SQL(new NL2SQLParam());
        var aUser = ((RecordingProxy)(object)aiA).User!;
        Assert.Equal(1, aUser["Bytes"]!.Value<byte[]>()![0]);
        aUser["Bytes"]!.Value<byte[]>()![0] = 8;
        aUser["Nested"]!["Value"] = "caller-a";
        await b.NL2SQL(new NL2SQLParam());
        var bUser = ((RecordingProxy)(object)aiB).User!;
        Assert.Equal(1, bUser["Bytes"]!.Value<byte[]>()![0]);
        Assert.Equal("original", bUser["Nested"]!.Value<string>("Value"));
    }

    [Fact]
    public async Task Chat_BindsOriginalIdentityAndClearsCallerSecrets()
    {
        var user = new JObject { ["Id"] = "trusted", ["Name"] = "original", ["Level"] = 1 };
        var ai = DispatchProxy.Create<IMicroiAI, RecordingProxy>();
        var facade = new V8TenantAI("tenant-a", user, ai);
        user["Id"] = "forged";
        var input = new AiParam { OsClient = "tenant-b", CurrentUserId = "forged", ApiKey = "key", Endpoint = "https://example.invalid", ServerInternalCall = true };
        Assert.Equal(1, (await facade.Chat(input)).Code);
        var actual = ((RecordingProxy)(object)ai).Chat!;
        Assert.Equal("tenant-a", actual.OsClient);
        Assert.Equal("trusted", actual.CurrentUserId);
        Assert.Equal("original", actual.CurrentUserName);
        Assert.Null(actual.ApiKey); Assert.Null(actual.Endpoint); Assert.False(actual.ServerInternalCall);
    }

    [Fact]
    public async Task AnonymousAndOrdinaryUsersCannotAcquireAdminRightsAfterConstruction()
    {
        var ai = DispatchProxy.Create<IMicroiAI, RecordingProxy>();
        var anonymous = new JObject();
        var anonFacade = new V8TenantAI("tenant-a", anonymous, ai);
        anonymous["Id"] = "admin"; anonymous["Level"] = 9999;
        Assert.Equal(1001, (await anonFacade.Chat(new AiParam())).Code);
        var ordinary = new JObject { ["Id"] = "user", ["Level"] = 1 };
        var facade = new V8TenantAI("tenant-a", ordinary, ai);
        ordinary["Level"] = 9999;
        Assert.Equal(0, (await facade.NL2V8(new NL2V8Param())).Code);
        Assert.Null(((RecordingProxy)(object)ai).Chat);
    }

    private static JObject LargeUser()
    {
        var items = new JArray();
        for (var i = 0; i < 7403; i++) items.Add(new JObject {
            ["Id"] = "row-" + i, ["RoleId"] = "role", ["FkId"] = "menu-" + i,
            ["Name"] = "permission-" + i, ["Type"] = "Menu", ["CreateTime"] = "2026-09-12 12:00:00",
            ["Customer"] = JValue.CreateNull(), ["Permission"] = "View,Add,Update,Delete" });
        return new JObject { ["Id"] = "trusted", ["Level"] = 1, ["_RoleLimits"] = items };
    }

    public class RecordingProxy : DispatchProxy
    {
        public JObject? User { get; private set; }
        public AiParam? Chat { get; private set; }
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            if (method?.Name == nameof(IMicroiAI.NL2SQLAuthorizedAsync)) User = (JObject)args![1]!;
            else if (method?.Name == nameof(IMicroiAI.ChatWithContextAsync)) Chat = (AiParam)args![0]!;
            else throw new InvalidOperationException("Unexpected AI operation: " + method?.Name);
            return Task.FromResult(new DosResult(1));
        }
    }
}

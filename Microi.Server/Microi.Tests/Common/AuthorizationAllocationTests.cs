using System.Reflection;
using Microi.net.Api;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class AuthorizationAllocationTests
{
    private static readonly Func<JObject, List<string>> ReadBaseLimits =
        typeof(DiyFilter<object>).GetMethod("GetUserBaseLimits", BindingFlags.NonPublic | BindingFlags.Static)!
            .CreateDelegate<Func<JObject, List<string>>>();

    [Fact]
    public void RoleBaseLimitCheck_DoesNotCopyUnrelatedTablePermissionTree()
    {
        var permissions = new JArray(Enumerable.Range(0, 7403).Select(i => new JObject
        {
            ["Id"] = i, ["FkId"] = "menu-" + i, ["Permission"] = "read"
        }));
        var user = new JObject { ["Id"] = "user", ["_RoleLimits"] = permissions,
            ["_Roles"] = new JArray(new JObject { ["BaseLimit"] = "[\"OnlyGet\"]" }) };
        // Warm the JSON deserializer using only one role, not the large
        // permission tree whose accidental copy this regression measures.
        ReadBaseLimits(new JObject { ["_Roles"] = new JArray(
            new JObject { ["BaseLimit"] = "[\"OnlyGet\"]" }) });
        var before = GC.GetAllocatedBytesForCurrentThread();
        var result = ReadBaseLimits(user);
        var bytes = GC.GetAllocatedBytesForCurrentThread() - before;
        Assert.Equal(new[] { "OnlyGet" }, result);
        Assert.True(bytes < 64000, $"Role base-limit read copied unrelated identity data: {bytes:N0} bytes");
        Assert.Same(permissions, user["_RoleLimits"]);
        Assert.Equal(7403, permissions.Count);
        Assert.Equal("read", permissions[7402]["Permission"]!.Value<string>());
    }

    [Fact]
    public void RoleBaseLimits_PreserveEveryRoleAndLeaveTheInputUnmodified()
    {
        var user = new JObject { ["_Roles"] = new JArray(
            new JObject { ["BaseLimit"] = "[\"OnlyGet\",\"Other\"]" },
            new JObject { ["BaseLimit"] = "" },
            new JObject { ["BaseLimit"] = "[\"OnlyGet\"]" }) };
        var before = user.ToString();
        Assert.Equal(new[] { "OnlyGet", "Other", "OnlyGet" }, ReadBaseLimits(user));
        Assert.Equal(before, user.ToString());
        Assert.Empty(ReadBaseLimits(new JObject()));
    }
}

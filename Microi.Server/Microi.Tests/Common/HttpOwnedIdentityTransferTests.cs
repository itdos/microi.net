using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class HttpOwnedIdentityTransferTests
{
    [Fact]
    public void SingleRequest_TransfersDetachedIdentityWithoutCopyingPermissions()
    {
        var user = new JObject { ["Id"] = "user-a", ["_RoleLimits"] = new JArray(
            Enumerable.Range(0, 7403).Select(i => new JObject { ["Id"] = i, ["Select"] = true })) };
        _ = HttpOwnedIdentityTransfer.ToRequestValue(new JObject(), true);
        var before = GC.GetAllocatedBytesForCurrentThread();
        var actual = HttpOwnedIdentityTransfer.ToRequestValue(user, true);
        var allocated = GC.GetAllocatedBytesForCurrentThread() - before;
        Assert.Same(user, actual);
        Assert.True(allocated < 16_384, $"Owned identity transfer allocated {allocated} bytes");
        Assert.Equal(7403, actual["_RoleLimits"]!.Count());
    }

    [Fact]
    public void ParentedIdentity_IsCopiedAndCannotMutateItsOwner()
    {
        var owner = new JObject { ["User"] = new JObject { ["Id"] = "user-a", ["Nested"] = new JObject { ["Name"] = "original" } } };
        var actual = HttpOwnedIdentityTransfer.ToRequestValue(owner["User"]!, true);
        actual["Nested"]!["Name"] = "changed";
        Assert.Equal("original", owner["User"]!["Nested"]!["Name"]!.Value<string>());
        Assert.NotSame(owner["User"], actual);
    }

    [Fact]
    public void BatchRows_AlwaysReceiveIndependentIdentities()
    {
        var user = new JObject { ["Id"] = "user-a", ["Roles"] = new JArray("r1") };
        var first = HttpOwnedIdentityTransfer.ToRequestValue(user, false);
        var second = HttpOwnedIdentityTransfer.ToRequestValue(user, false);
        ((JArray)first["Roles"]!).Clear();
        Assert.Single(user["Roles"]!);
        Assert.Single(second["Roles"]!);
        Assert.NotSame(user, first);
    }

    [Fact]
    public void NonJsonLegacyIdentity_PreservesCustomProperties()
    {
        var actual = HttpOwnedIdentityTransfer.ToRequestValue(new { Id = "user-a", Custom = new { Value = 9 } }, true);
        Assert.Equal("user-a", actual["Id"]!.Value<string>());
        Assert.Equal(9, actual["Custom"]!["Value"]!.Value<int>());
    }
}


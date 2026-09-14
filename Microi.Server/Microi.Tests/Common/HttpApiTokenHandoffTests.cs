using Microi.net;
using Microsoft.AspNetCore.Http;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class HttpApiTokenHandoffTests
{
    [Fact]
    public void ValidatedIdentity_IsTransferredOnce_WithoutCopyingLargePermissions()
    {
        var context = new DefaultHttpContext();
        var user = LargeUser();
        var token = new CurrentToken { OsClient = "tenant-a", CurrentUser = user };
        var request = new JObject { ["OsClient"] = "tenant-a", ["_CurrentUser"] = user.DeepClone() };
        HttpApiTokenHandoff.Bind(request, context, token);
        var before = GC.GetAllocatedBytesForCurrentThread();
        Assert.True(HttpApiTokenHandoff.TryConsume(request, context, out var actual));
        Assert.Same(token, actual);
        Assert.True(GC.GetAllocatedBytesForCurrentThread() - before < 16_384);
        Assert.False(HttpApiTokenHandoff.TryConsume(request, context, out _));
        HttpApiTokenHandoff.Bind(request, context, token);
        Assert.False(HttpApiTokenHandoff.TryConsume(request, context, out _));
    }

    [Theory]
    [InlineData("clone")]
    [InlineData("context")]
    [InlineData("tenant")]
    [InlineData("identity")]
    [InlineData("request-id")]
    public void ChangedBoundary_CannotReuseAuthorization(string change)
    {
        var context = new DefaultHttpContext();
        var user = new JObject { ["Id"] = "user-a", ["Level"] = 1 };
        var request = new JObject { ["OsClient"] = "tenant-a", ["_CurrentUser"] = user };
        HttpApiTokenHandoff.Bind(request, context, new CurrentToken { OsClient = "tenant-a", CurrentUser = user });
        if (change == "clone") request = (JObject)request.DeepClone();
        if (change == "context") context = new DefaultHttpContext();
        if (change == "tenant") request["OsClient"] = "tenant-b";
        if (change == "identity") request["_CurrentUser"] = new JObject { ["Level"] = 9999 };
        if (change == "request-id") context.TraceIdentifier = "pooled-context-next-request";
        Assert.False(HttpApiTokenHandoff.TryConsume(request, context, out var token));
        Assert.Null(token);
    }

    [Fact]
    public void UnboundOrAnonymousRequest_HasNoGrant()
    {
        var context = new DefaultHttpContext();
        var request = new JObject { ["_CurrentUser"] = new JObject { ["Level"] = 9999 } };
        Assert.False(HttpApiTokenHandoff.TryConsume(request, context, out _));
        HttpApiTokenHandoff.Bind(request, context, new CurrentToken());
        Assert.False(HttpApiTokenHandoff.TryConsume(request, context, out _));
    }

    [Fact]
    public void LargeLoginProjection_SanitizationHasBoundedScratchAllocation_AndRemovesAdjacentNestedSecrets()
    {
        var user = LargeUser();
        user["Nested"] = new JArray(new JObject { ["Pwd"] = "a", ["Token"] = "b", ["Name"] = "kept" });
        SysUserLogic.SanitizeLoginProjection(new JObject());
        var before = GC.GetAllocatedBytesForCurrentThread();
        Assert.True(SysUserLogic.SanitizeLoginProjection(user));
        var allocated = GC.GetAllocatedBytesForCurrentThread() - before;
        Assert.Null(user["Nested"]![0]!["Pwd"]);
        Assert.Null(user["Nested"]![0]!["Token"]);
        Assert.Equal("kept", user["Nested"]![0]!["Name"]!.Value<string>());
        Assert.Equal(7403, ((JArray)user["_RoleLimits"]!).Count);
        Assert.True(allocated < 32_768, $"Sanitization allocated {allocated} bytes for a read-only permission walk.");
    }

    private static JObject LargeUser()
    {
        var entries = new JArray();
        for (var i = 0; i < 7403; i++) entries.Add(new JObject { ["Id"] = i, ["MenuId"] = "m" + i, ["Select"] = true });
        return new JObject { ["Id"] = "user-a", ["Level"] = 9999, ["_RoleLimits"] = entries };
    }

    [Fact]
    public void SanitizedProjection_AccessKeyScopePreservesCleaningAndCallerIsolation()
    {
        var user = new JObject { ["Id"] = "user-a", ["Pwd"] = "secret", ["Custom"] = new JObject { ["Token"] = "secret", ["Name"] = "kept" } };
        Assert.True(SysUserLogic.SanitizeLoginProjection(user));
        var result = UserAccessKeyService.ApplyRuntimeScope(user, new UserAccessKeyRuntime
        {
            Id = "key-a", TargetUserId = "user-a", Name = "key", State = 1,
            Scopes = "[\"page:open\",\"form:read\"]", AllowedRoutes = "[\"/home\"]",
            AllowedTableNames = "[\"orders\"]", AllowedApiEngineKeys = "[\"read-orders\"]"
        });
        Assert.Equal(1, result.Code);
        Assert.False(SysUserLogic.SanitizeLoginProjection(result.Data));
        Assert.Null(result.Data["Pwd"]);
        Assert.Null(result.Data["Custom"]!["Token"]);
        result.Data["Custom"]!["Name"] = "changed";
        Assert.Equal("kept", user["Custom"]!["Name"]!.Value<string>());
        Assert.Null(user["_AccessKeyId"]);
    }
}

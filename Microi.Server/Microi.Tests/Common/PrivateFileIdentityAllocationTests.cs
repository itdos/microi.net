using System.Reflection;
using Dos.Common;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class PrivateFileIdentityAllocationTests(ITestOutputHelper output)
{
    private static JObject Request() => new() { ["ResourceKind"] = "UserAvatar", ["ResourceId"] = "u1",
        ["FilePathName"] = "count-test/private/avatar.jpg", ["Limit"] = false };

    [Fact]
    public void RealPrivateFileFacade_TransfersFreshValidatedIdentityAndStillAuthorizesResource()
    {
        var hdfs = DispatchProxy.Create<IMicroiHDFS, HdfsProbe>();
        var files = (HdfsProbe)hdfs;
        var forms = DispatchProxy.Create<IFormEngine, FormProbe>();
        using var fixture = new FormEngineCountBatchIdentityTests.IdentityFixture(services => services
            .AddSingleton(forms).AddSingleton<IHDFSFactory>(new HdfsFactory(hdfs)));
        using var tenant = V8TenantContext.Enter("count-test", "platform-private-file-url");
        var method = new V8Method();
        Assert.Equal(1, method.GetAuthorizedPrivateFileUrl(Request()).Code);
        var user = fixture.Cache.Model!.CurrentUser;
        user["_RoleLimits"] = new JArray(Enumerable.Range(0, 7403).Select(i => new JObject { ["Id"] = i, ["Permission"] = "read" }));
        var before = GC.GetAllocatedBytesForCurrentThread();
        var comparison = user.DeepClone();
        var oneTree = GC.GetAllocatedBytesForCurrentThread() - before;
        fixture.Cache.Reads = 0;
        before = GC.GetAllocatedBytesForCurrentThread();
        var result = method.GetAuthorizedPrivateFileUrl(Request());
        var allocated = GC.GetAllocatedBytesForCurrentThread() - before;
        output.WriteLine($"Private file facade allocation: {allocated}; one identity: {oneTree}");
        GC.KeepAlive(comparison);
        Assert.Equal(1, result.Code);
        Assert.Equal(1, fixture.Cache.Reads);
        Assert.True(allocated < oneTree * 1.5 + 1_000_000, $"Private facade allocated {allocated:N0}; one identity {oneTree:N0}");
        Assert.True(files.Param!.Limit);
        Assert.Equal("Client", files.Param._InvokeType);
        Assert.NotSame(user, files.Param._CurrentUser);
        files.Param._CurrentUser["_RoleLimits"]![0]!["Permission"] = "local";
        Assert.Equal("read", user["_RoleLimits"]![0]!["Permission"]!.Value<string>());
        ((FormProbe)forms).Deny = true;
        var calls = files.Calls;
        Assert.Equal(0, method.GetAuthorizedPrivateFileUrl(Request()).Code);
        Assert.Equal(calls, files.Calls);
    }

    [Fact]
    public void TrustedBackgroundSnapshot_StaysIndependentAndForeignTenantIsRejected()
    {
        var hdfs = DispatchProxy.Create<IMicroiHDFS, HdfsProbe>();
        var forms = DispatchProxy.Create<IFormEngine, FormProbe>();
        using var fixture = new FormEngineCountBatchIdentityTests.IdentityFixture(services => services
            .AddSingleton(forms).AddSingleton<IHDFSFactory>(new HdfsFactory(hdfs)));
        using var tenant = V8TenantContext.Enter("count-test", "platform-private-file-url");
        using (V8TrustedExecutionContext.EnterForTenant(new JObject { ["Id"] = "u1", ["Nested"] = new JObject { ["A"] = 1 } }, "count-test"))
        {
            Assert.Equal(1, new V8Method().GetAuthorizedPrivateFileUrl(Request()).Code);
            ((HdfsProbe)hdfs).Param!._CurrentUser["Nested"]!["A"] = 9;
            Assert.Equal(1, V8TrustedExecutionContext.CurrentUser["Nested"]!["A"]!.Value<int>());
            Assert.Equal(0, fixture.Cache.Reads);
        }
        using (V8TrustedExecutionContext.EnterForTenant(new JObject { ["Id"] = "u1" }, "foreign"))
            Assert.Equal(0, new V8Method().GetAuthorizedPrivateFileUrl(Request()).Code);
    }

    private sealed class HdfsFactory(IMicroiHDFS value) : IHDFSFactory { public IMicroiHDFS Create(HDFSType type) => value; }
    public class HdfsProbe : DispatchProxy
    {
        public DiyUploadParam? Param;
        public int Calls;
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            Assert.Equal("GetPrivateFileUrl", method!.Name);
            Param = Assert.IsType<DiyUploadParam>(args![0]); Calls++;
            return Task.FromResult(new DosResult(1, "authorized"));
        }
    }
    public class FormProbe : DispatchProxy
    {
        public bool Deny;
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            Assert.Equal("GetFormDataAsync", method!.Name);
            Assert.Equal("sys_user", args![0]);
            var query = Assert.IsType<JObject>(args[1]);
            Assert.Equal("u1", query["Id"]!.Value<string>());
            return Task.FromResult(new DosResult<dynamic>(Deny ? 0 : 1,
                new JObject { ["Id"] = "u1", ["Avatar"] = "count-test/private/avatar.jpg" }));
        }
    }
}

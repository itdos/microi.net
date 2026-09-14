using System.IdentityModel.Tokens.Jwt;
using System.Reflection;
using System.Security.Claims;
using Microi.net;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class FormEngineCountBatchIdentityTests
{
    private static async Task<List<DiyTableRowParam>> Prepare(FormEngine engine, JArray input)
    {
        var method = typeof(FormEngine).GetMethod("PrepareReadOnlyCountBatchAsync", BindingFlags.NonPublic | BindingFlags.Instance);
        // Same allocation regression can run against the pre-fix assembly.
        return method == null ? await engine.DynamicToDiyTableRowParamList(input)
            : await (Task<List<DiyTableRowParam>>)method.Invoke(engine, new object[] { input })!;
    }

    private static JArray Input(int count) => new(Enumerable.Range(0, count).Select(i =>
        new JObject { ["OsClient"] = "count-test", ["FormEngineKey"] = "items", ["_Where"] = new JArray() }));

    [Fact]
    public async Task RealCountBatchEntryRejectsOversizedBatchWithoutRepeatedIdentityLoads()
    {
        using var fixture = new IdentityFixture();
        var result = await new FormEngine().GetTableDataCountBatchAsync(Input(65));
        Assert.Equal(0, result.Code);
        Assert.True(fixture.Cache.Reads <= 1, $"Rejected batch resolved identity {fixture.Cache.Reads} times");
    }

    [Fact]
    public async Task CountBatchResolvesOneDetachedIdentityInsteadOfCopyingPermissionsPerItem()
    {
        using var fixture = new IdentityFixture();
        var engine = new FormEngine();
        await Prepare(engine, Input(1));
        fixture.Cache.Model!.CurrentUser["_RoleLimits"] = new JArray(Enumerable.Range(0, 7403).Select(i =>
            new JObject { ["Id"] = i, ["FkId"] = "menu-" + i, ["Permission"] = "read" }));
        var before = GC.GetAllocatedBytesForCurrentThread();
        var comparison = fixture.Cache.Model.CurrentUser.DeepClone();
        var oneTreeBytes = GC.GetAllocatedBytesForCurrentThread() - before;
        fixture.Cache.Reads = 0;
        var input = Input(32);
        before = GC.GetAllocatedBytesForCurrentThread();
        var result = await Prepare(engine, input);
        var allocated = GC.GetAllocatedBytesForCurrentThread() - before;
        GC.KeepAlive(comparison);
        Assert.Equal(32, result.Count);
        Assert.Equal(1, fixture.Cache.Reads);
        Assert.True(allocated < oneTreeBytes * 2.5 + 1_000_000,
            $"Count preparation allocated {allocated:N0}; one permission tree costs {oneTreeBytes:N0} bytes");
        Assert.NotSame(fixture.Cache.Model.CurrentUser, result[0]._CurrentUser);
        Assert.All(result, item => Assert.Same(result[0]._CurrentUser, item._CurrentUser));
        Assert.All(result, item => Assert.False(item._RowModel.ContainsKey("_CurrentUser")));
        result[0]._CurrentUser["_RoleLimits"]![0]!["Permission"] = "local-only";
        Assert.Equal("read", fixture.Cache.Model.CurrentUser["_RoleLimits"]![0]!["Permission"]!.Value<string>());
    }

    [Fact]
    public async Task SeparateBatchesReloadRevokedOrChangedIdentity()
    {
        using var fixture = new IdentityFixture();
        var engine = new FormEngine();
        var first = await Prepare(engine, Input(3));
        fixture.Cache.Model!.CurrentUser["Level"] = 1;
        fixture.Cache.Model.CurrentUser["RoleIds"] = new JArray("new-role");
        var second = await Prepare(engine, Input(3));
        Assert.NotSame(first[0]._CurrentUser, second[0]._CurrentUser);
        Assert.Equal(1, second[0]._CurrentUser["Level"]!.Value<int>());
        Assert.Equal("new-role", second[0]._CurrentUser["RoleIds"]![0]!.Value<string>());
        fixture.Cache.Model = null;
        var revoked = await Prepare(engine, Input(3));
        Assert.All(revoked, item => Assert.Null(item._CurrentUser));
    }

    [Fact]
    public async Task OrdinaryBatchKeepsIndependentIdentityForEachMutableOperation()
    {
        using var fixture = new IdentityFixture();
        var result = await new FormEngine().DynamicToDiyTableRowParamList(Input(3));
        Assert.Equal(3, fixture.Cache.Reads);
        Assert.NotSame(result[0]._CurrentUser, result[1]._CurrentUser);
        result[0]._CurrentUser["RoleIds"]![0] = "mutated";
        Assert.Equal("role-a", result[1]._CurrentUser["RoleIds"]![0]!.Value<string>());
        Assert.Equal("role-a", fixture.Cache.Model!.CurrentUser["RoleIds"]![0]!.Value<string>());
    }

    [Fact]
    public async Task ExplicitIdentityAndForeignTokenKeepExistingIsolationAndRejection()
    {
        using var fixture = new IdentityFixture();
        var input = Input(3);
        input[1]["_CurrentUser"] = new JObject { ["Id"] = "explicit", ["Extra"] = new JObject { ["A"] = 1 } };
        var result = await Prepare(new FormEngine(), input);
        Assert.Equal("explicit", result[1]._CurrentUser["Id"]!.Value<string>());
        Assert.NotSame(input[1]["_CurrentUser"], result[1]._CurrentUser);
        Assert.Same(result[0]._CurrentUser, result[2]._CurrentUser);
        fixture.Context.Request.Headers["OsClient"] = "other-tenant";
        Assert.All(await Prepare(new FormEngine(), Input(3)), item => Assert.Null(item._CurrentUser));
    }

    internal sealed class IdentityFixture : IDisposable
    {
        private readonly FieldInfo accessor = typeof(DiyHttpContext).GetField("_httpContextAccessor", BindingFlags.NonPublic | BindingFlags.Static)!;
        private readonly FieldInfo provider = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.NonPublic | BindingFlags.Static)!;
        private readonly object? oldAccessor, oldProvider;
        private readonly ServiceProvider services;
        public readonly TokenCache Cache;
        public readonly DefaultHttpContext Context = new();
        public IdentityFixture(Action<IServiceCollection>? configure = null)
        {
            oldAccessor = accessor.GetValue(null); oldProvider = provider.GetValue(null);
            var proxy = DispatchProxy.Create<IMicroiCache, TokenCache>(); Cache = (TokenCache)proxy;
            var registrations = new ServiceCollection().AddSingleton<IMicroiCacheTenant>(new TenantCache(proxy));
            configure?.Invoke(registrations);
            services = registrations.BuildServiceProvider();
            var jwt = new JwtSecurityToken(claims: new[] { new Claim("UserId", "u1"), new Claim("OsClient", "count-test"),
                new Claim(DiyToken.AuthVersionClaimType, DiyToken.CurrentAuthVersion) }, expires: DateTime.UtcNow.AddMinutes(5));
            var token = new JwtSecurityTokenHandler().WriteToken(jwt);
            Cache.Model = new CurrentToken { OsClient = "count-test", Token = token, AuthVersion = DiyToken.CurrentAuthVersion,
                CurrentUser = new JObject { ["Id"] = "u1", ["Level"] = 9, ["RoleIds"] = new JArray("role-a") } };
            Context.Request.Headers["OsClient"] = "count-test"; Context.Request.Headers["Authorization"] = "Bearer " + token;
            DiyHttpContext.Configure(new HttpContextAccessor { HttpContext = Context }); provider.SetValue(null, services);
        }
        public void Dispose() { accessor.SetValue(null, oldAccessor); provider.SetValue(null, oldProvider); services.Dispose(); }
    }
    private sealed class TenantCache(IMicroiCache cache) : IMicroiCacheTenant
    {
        public IMicroiCache Cache(string osClient) => cache;
        public IMicroiCache Default() => cache;
    }
    public class TokenCache : DispatchProxy
    {
        public CurrentToken? Model;
        public int Reads;
        protected override object? Invoke(MethodInfo? targetMethod, object?[]? args)
        {
            if (targetMethod!.Name == "GetAsync" && targetMethod.IsGenericMethod && targetMethod.GetGenericArguments()[0] == typeof(CurrentToken))
            { Reads++; return Task.FromResult(Model); }
            throw new InvalidOperationException("Unexpected cache operation " + targetMethod.Name);
        }
    }
}

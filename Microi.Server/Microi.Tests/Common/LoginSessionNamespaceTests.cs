using System.IdentityModel.Tokens.Jwt;
using System.Reflection;
using System.Security.Claims;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

[Collection("TenantContextGlobal")]
public sealed class LoginSessionNamespaceTests
{
    [Fact]
    public async Task LegacyLoginOverwrite_AndNewSessionRevocation_AreIndependent()
    {
        const string tenant = "coexist-test";
        const string userId = "same-user";
        const string legacyKey = "Microi:coexist-test:LoginTokenSysUser:same-user";
        var newKey = SysUserLogic.BuildLoginProjectionCacheKey(tenant, userId);
        Assert.NotEqual(legacyKey, newKey);
        var cache = DispatchProxy.Create<IMicroiCache, MemoryCache>();
        var memory = (MemoryCache)cache;
        var providerField = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.NonPublic | BindingFlags.Static)!;
        var oldProvider = providerField.GetValue(null);
        using var provider = new ServiceCollection().AddSingleton<IMicroiCacheTenant>(new CacheTenant(cache)).BuildServiceProvider();
        try
        {
            providerField.SetValue(null, provider);
            var token = new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(claims: new[] {
                new Claim("UserId", userId), new Claim("OsClient", tenant),
                new Claim(DiyToken.AuthVersionClaimType, DiyToken.CurrentAuthVersion)
            }, expires: DateTime.UtcNow.AddMinutes(5)));
            var current = new CurrentToken { Token = token, OsClient = tenant, AuthVersion = DiyToken.CurrentAuthVersion,
                CurrentUser = new JObject { ["Id"] = userId, ["Name"] = "new-session-user" } };
            memory.Values[newKey] = JsonConvert.SerializeObject(current);
            // 模拟旧节点反复覆盖单帐号缓存；新版身份必须始终从自己的命名空间读取。
            foreach (var legacyLogin in new[] { "legacy-login-1", "legacy-login-2" })
            {
                memory.Values[legacyKey] = legacyLogin;
                var actual = await DiyToken.GetCurrentToken(token, tenant);
                Assert.Equal(userId, actual?.CurrentUser?["Id"]?.ToString());
                Assert.Equal(legacyLogin, memory.Values[legacyKey]);
            }
            Assert.Null(await DiyToken.GetCurrentToken(token, "another-tenant"));
            memory.Values.Remove(newKey);
            Assert.Null(await DiyToken.GetCurrentToken(token, tenant));
            Assert.Equal("legacy-login-2", memory.Values[legacyKey]);
            // 即使旧节点存有相同的有效 JWT，也不能回退旧键，复活新版已撤销的会话。
            memory.Values[legacyKey] = JsonConvert.SerializeObject(current);
            Assert.Null(await DiyToken.GetCurrentToken(token, tenant));
        }
        finally { providerField.SetValue(null, oldProvider); }
    }

    private sealed class CacheTenant(IMicroiCache cache) : IMicroiCacheTenant
    {
        public IMicroiCache Cache(string osClient) => cache;
        public IMicroiCache Default() => cache;
    }

    public class MemoryCache : DispatchProxy
    {
        public Dictionary<string, string> Values { get; } = new();
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            if (method!.Name == "GetAsync" && method.IsGenericMethod)
                return GetType().GetMethod(nameof(Read))!.MakeGenericMethod(method.GetGenericArguments()).Invoke(this, new[] { args![0] });
            throw new NotSupportedException(method.Name);
        }
        public Task<T?> Read<T>(string key) => Task.FromResult(Values.TryGetValue(key, out var raw) ? JsonConvert.DeserializeObject<T>(raw) : default);
    }
}

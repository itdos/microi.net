using System.Collections.Concurrent;
using System.Reflection;
using Dos.Common;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class PasswordResetSessionRevocationTests
{
    [Fact]
    public async Task Revocation_WaitsForAnInFlightRotation_ThenRemovesItsWriteback()
    {
        using var scope = new SessionScope();
        var key = LoginSessionCacheKeys.User(scope.Tenant, scope.UserId);
        var rotationRead = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var releaseRotation = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var rotation = scope.Locks.ActionLockAsync(new MicroiLockParam
        {
            OsClient = scope.Tenant, Key = key + ":Rotate"
        }, async () =>
        {
            var stale = await scope.Cache.GetAsync<CurrentToken>(key);
            rotationRead.SetResult();
            await releaseRotation.Task;
            await scope.Cache.SetAsync(key, stale);
        });
        await rotationRead.Task.WaitAsync(TimeSpan.FromSeconds(5));
        var revocation = OnlineTerminalService.RevokeUserSessionsFromTrustedHostAsync(scope.Tenant, scope.UserId);
        try
        {
            // 旧实现会直接完成删除；修复实现先到达同一把锁并等待正在写回的续签。
            await Task.WhenAny(scope.Locks.SecondRequest.Task, revocation).WaitAsync(TimeSpan.FromSeconds(5));
        }
        finally
        {
            releaseRotation.TrySetResult();
        }
        await rotation.WaitAsync(TimeSpan.FromSeconds(5));
        var result = await revocation.WaitAsync(TimeSpan.FromSeconds(5));
        Assert.Equal(1, result.Code);
        Assert.Null(await scope.Cache.GetAsync<CurrentToken>(key));
        Assert.Equal(new[] { key + ":Rotate", key + ":Rotate" }, scope.Locks.Keys);
    }

    [Fact]
    public async Task Revocation_WhenTheSessionLockIsUnavailable_DoesNotClaimSuccessOrDeleteState()
    {
        using var scope = new SessionScope();
        scope.Locks.Reject = true;
        var result = await OnlineTerminalService.RevokeUserSessionsFromTrustedHostAsync(scope.Tenant, scope.UserId);
        Assert.NotEqual(1, result.Code);
        Assert.NotNull(await scope.Cache.GetAsync<CurrentToken>(LoginSessionCacheKeys.User(scope.Tenant, scope.UserId)));
    }

    private sealed class SessionScope : IDisposable
    {
        private readonly FieldInfo providerField = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.NonPublic | BindingFlags.Static)!;
        private readonly object? previousProvider;
        private readonly ServiceProvider provider;
        internal string Tenant { get; } = "session-revoke-fixture";
        internal string UserId { get; } = "fixture-user";
        internal IMicroiCache Cache { get; } = DispatchProxy.Create<IMicroiCache, MemoryCache>();
        internal BarrierLock Locks { get; } = new();

        internal SessionScope()
        {
            ((MemoryCache)Cache).Values[LoginSessionCacheKeys.User(Tenant, UserId)] = JsonConvert.SerializeObject(new CurrentToken
            {
                OsClient = Tenant, Token = "fixture-token", AuthVersion = DiyToken.CurrentAuthVersion,
                CurrentUser = new JObject { ["Id"] = UserId },
                Tokens = [new TokensModel { Token = "fixture-token", AuthVersion = DiyToken.CurrentAuthVersion }]
            });
            previousProvider = providerField.GetValue(null);
            provider = new ServiceCollection().AddSingleton<IMicroiCacheTenant>(new CacheTenant(Cache))
                .AddSingleton<IMicroiLock>(Locks).BuildServiceProvider();
            providerField.SetValue(null, provider);
        }

        public void Dispose()
        {
            providerField.SetValue(null, previousProvider);
            provider.Dispose();
        }
    }

    private sealed class CacheTenant(IMicroiCache cache) : IMicroiCacheTenant
    {
        public IMicroiCache Cache(string osClient) => cache;
        public IMicroiCache Default() => cache;
    }

    private sealed class BarrierLock : IMicroiLock
    {
        private readonly ConcurrentDictionary<string, SemaphoreSlim> locks = new();
        internal ConcurrentQueue<string> Keys { get; } = new();
        internal TaskCompletionSource SecondRequest { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        internal bool Reject { get; set; }

        public async Task<DosResult> ActionLockAsync(MicroiLockParam param, Func<Task> action)
        {
            Keys.Enqueue(param.Key);
            if (Keys.Count == 2) SecondRequest.TrySetResult();
            if (Reject) return new DosResult(0, null, "fixture lock unavailable");
            var gate = locks.GetOrAdd(param.OsClient + ":" + param.Key, _ => new SemaphoreSlim(1, 1));
            await gate.WaitAsync();
            try { await action(); return new DosResult(1); }
            finally { gate.Release(); }
        }

        public Task<DosResult> ActionLockAsync(MicroiLockParam param, Func<IMicroiLockLease, Task> action) =>
            throw new NotSupportedException("The short session lock does not request a lease.");
    }

    public class MemoryCache : DispatchProxy
    {
        public ConcurrentDictionary<string, string> Values { get; } = new();
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            switch (method!.Name)
            {
                case "GetAsync" when method.IsGenericMethod:
                    return GetType().GetMethod(nameof(Read))!.MakeGenericMethod(method.GetGenericArguments()).Invoke(this, [args![0]]);
                case "SetAsync":
                    Values[(string)args![0]!] = JsonConvert.SerializeObject(args[1]);
                    return Task.FromResult(true);
                case "RemoveAsync":
                    return Task.FromResult(Values.TryRemove((string)args![0]!, out _));
                case "HashGet": return null;
                case "HashDelete": return true;
                case "HashGetAllValues": return new List<ClientInfo>();
                default: throw new NotSupportedException(method.Name);
            }
        }
        public Task<T?> Read<T>(string key) => Task.FromResult(Values.TryGetValue(key, out var raw) ? JsonConvert.DeserializeObject<T>(raw) : default);
    }
}

using System.Collections;
using System.Collections.Concurrent;
using System.Reflection;
using System.Runtime.CompilerServices;
using Microi.net;
using Newtonsoft.Json;

namespace Microi.Tests.Common;

public class ChatOnlineCacheIsolationTests
{
    [Theory]
    [InlineData("ChatOnline:user")]
    [InlineData("ChatOnline:Product:Internet:user")]
    [InlineData("chatonline:product:internal:user")]
    public async Task ConcurrentOnlineReadersNeverShareMutableClientLists(string suffix)
    {
        var key = "Microi:owned-" + Guid.NewGuid().ToString("N") + ":" + suffix;
        var source = new ClientInfo
        {
            UserId = "fixture-user",
            ConnectionIds = ["first", "second"],
            Terminals = [new() { ConnectionId = "first" }, new() { ConnectionId = "second" }]
        };
        var redis = DispatchProxy.Create<IMicroiCache, SerializedRedis>();
        var backing = (SerializedRedis)redis;
        backing.Values[key] = JsonConvert.SerializeObject(source);
        var cache = (MicroiTwoLevelCache)RuntimeHelpers.GetUninitializedObject(typeof(MicroiTwoLevelCache));
        typeof(MicroiTwoLevelCache).GetField("_redisCache", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(cache, redis);
        var local = (IDictionary)typeof(MicroiTwoLevelCache).GetField("_localCache", BindingFlags.Static | BindingFlags.NonPublic)!.GetValue(null)!;
        var add = typeof(MicroiTwoLevelCache).GetMethod("AddToLocalCache", BindingFlags.Instance | BindingFlags.NonPublic)!
            .MakeGenericMethod(typeof(ClientInfo)).CreateDelegate<Action<string, ClientInfo, TimeSpan?>>(cache);
        var enabled = MicroiTwoLevelCacheConfig.Enabled;
        var capacity = MicroiTwoLevelCacheConfig.MaxLocalCacheSize;
        var readerReady = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var mutationFinished = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        try
        {
            MicroiTwoLevelCacheConfig.Enabled = true;
            MicroiTwoLevelCacheConfig.MaxLocalCacheSize = int.MaxValue;
            // An old L1 entry must also be bypassed; this makes the pre-fix failure deterministic.
            add(key, source, TimeSpan.FromMinutes(1));
            ClientInfo? first = null;
            var reader = Task.Run(async () =>
            {
                first = await cache.GetAsync<ClientInfo>(key);
                using var terminals = first.Terminals.GetEnumerator();
                Assert.True(terminals.MoveNext());
                readerReady.SetResult();
                await mutationFinished.Task.WaitAsync(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken);
                // The other operation cannot invalidate this enumeration or mutate its records.
                Assert.True(terminals.MoveNext());
                Assert.Equal("second", terminals.Current.ConnectionId);
                Assert.Equal(["first", "second"], first.ConnectionIds);
            }, TestContext.Current.CancellationToken);
            await readerReady.Task.WaitAsync(TimeSpan.FromSeconds(10), TestContext.Current.CancellationToken);
            var second = await cache.GetAsync<ClientInfo>(key);
            second.Terminals.RemoveAt(0);
            second.Terminals[0].ConnectionId = "changed";
            second.ConnectionIds.Clear();
            mutationFinished.SetResult();
            await reader;
            Assert.NotSame(first, second);
            Assert.NotSame(first!.Terminals, second.Terminals);
            Assert.NotSame(first.ConnectionIds, second.ConnectionIds);
            Assert.Equal(2, backing.Reads);
            Assert.Equal("second", source.Terminals[1].ConnectionId);

            local.Remove(key);
            Assert.True(await cache.SetAsync(key, second));
            Assert.False(local.Contains(key));
            var reread = await cache.GetAsync<ClientInfo>(key);
            Assert.NotSame(second, reread);
            Assert.Equal("changed", Assert.Single(reread.Terminals).ConnectionId);
            Assert.False(local.Contains(key));
        }
        finally
        {
            mutationFinished.TrySetResult();
            local.Remove(key);
            MicroiTwoLevelCacheConfig.Enabled = enabled;
            MicroiTwoLevelCacheConfig.MaxLocalCacheSize = capacity;
        }
    }

    [Fact]
    public async Task OrdinaryMetadataKeepsItsExistingLocalCache()
    {
        var key = "Microi:owned-" + Guid.NewGuid().ToString("N") + ":FormData:sys_menu:sample";
        var source = new ClientInfo { UserId = "metadata-control" };
        var cache = (MicroiTwoLevelCache)RuntimeHelpers.GetUninitializedObject(typeof(MicroiTwoLevelCache));
        var local = (IDictionary)typeof(MicroiTwoLevelCache).GetField("_localCache", BindingFlags.Static | BindingFlags.NonPublic)!.GetValue(null)!;
        var add = typeof(MicroiTwoLevelCache).GetMethod("AddToLocalCache", BindingFlags.Instance | BindingFlags.NonPublic)!
            .MakeGenericMethod(typeof(ClientInfo)).CreateDelegate<Action<string, ClientInfo, TimeSpan?>>(cache);
        var enabled = MicroiTwoLevelCacheConfig.Enabled;
        try
        {
            MicroiTwoLevelCacheConfig.Enabled = true;
            add(key, source, TimeSpan.FromMinutes(1));
            Assert.Same(source, await cache.GetAsync<ClientInfo>(key));
        }
        finally
        {
            local.Remove(key);
            MicroiTwoLevelCacheConfig.Enabled = enabled;
        }
    }

    public class SerializedRedis : DispatchProxy
    {
        public readonly ConcurrentDictionary<string, string> Values = new();
        public int Reads;
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            var key = (string)args![0]!;
            if (method!.Name == "GetAsync" && method.IsGenericMethod && method.GetGenericArguments()[0] == typeof(ClientInfo))
            {
                Interlocked.Increment(ref Reads);
                return Task.FromResult(JsonConvert.DeserializeObject<ClientInfo>(Values[key])!);
            }
            if (method.Name == "SetAsync" && method.IsGenericMethod)
            {
                Values[key] = JsonConvert.SerializeObject(args[1]);
                return Task.FromResult(true);
            }
            throw new NotSupportedException(method.Name);
        }
    }
}

using System.Collections;
using System.Reflection;
using System.Runtime.CompilerServices;
using Microi.net;

namespace Microi.Tests.Common;

public class TwoLevelCacheEvictionConcurrencyTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void EvictionOnlyRemovesTheCapturedEntryAndPreservesConcurrentRefresh(bool refreshed)
    {
        var type = typeof(MicroiTwoLevelCache);
        var dictionary = type.GetField("_localCache", BindingFlags.Static | BindingFlags.NonPublic)!.GetValue(null)!;
        var cache = (IDictionary)dictionary;
        var instance = (MicroiTwoLevelCache)RuntimeHelpers.GetUninitializedObject(type);
        var add = type.GetMethod("AddToLocalCache", BindingFlags.Instance | BindingFlags.NonPublic)!
            .MakeGenericMethod(typeof(string)).CreateDelegate<Action<string, string, TimeSpan?>>(instance);
        var key = "owned-cache-snapshot-" + Guid.NewGuid().ToString("N");
        var capacity = MicroiTwoLevelCacheConfig.MaxLocalCacheSize;
        try
        {
            MicroiTwoLevelCacheConfig.MaxLocalCacheSize = int.MaxValue;
            add(key, "expired", TimeSpan.FromSeconds(-1));
            var oldEntry = cache[key]!;
            var pairType = typeof(KeyValuePair<,>).MakeGenericType(typeof(string), oldEntry.GetType());
            var captured = Activator.CreateInstance(pairType, key, oldEntry)!;
            if (refreshed) add(key, "fresh", TimeSpan.FromMinutes(2));
            var currentEntry = cache[key];
            var remove = type.GetMethod("RemoveLocalCacheEntry", BindingFlags.Static | BindingFlags.NonPublic)!;
            Assert.Equal(!refreshed, Assert.IsType<bool>(remove.Invoke(null, [captured])));
            if (refreshed)
            {
                Assert.Same(currentEntry, cache[key]);
                Assert.Equal("fresh", currentEntry!.GetType().GetProperty("Value")!.GetValue(currentEntry));
            }
            else Assert.False(cache.Contains(key));
        }
        finally
        {
            cache.Remove(key);
            MicroiTwoLevelCacheConfig.MaxLocalCacheSize = capacity;
        }
    }

    [Fact]
    public async Task CapacityEvictionSurvivesConcurrentRemovalAndInsertion()
    {
        // 直接执行生产 L1 方法；不启动 Redis、后台清理器或真实租户。
        // 中央测试禁用并行，finally 恢复共享缓存与配置，避免污染其它用例。
        var type = typeof(MicroiTwoLevelCache);
        var cache = (IDictionary)type.GetField("_localCache", BindingFlags.Static | BindingFlags.NonPublic)!.GetValue(null)!;
        var saved = new List<DictionaryEntry>();
        foreach (DictionaryEntry entry in cache) saved.Add(entry);
        var capacity = MicroiTwoLevelCacheConfig.MaxLocalCacheSize;
        var eviction = MicroiTwoLevelCacheConfig.EvictionPercentage;
        var instance = (MicroiTwoLevelCache)RuntimeHelpers.GetUninitializedObject(type);
        var add = type.GetMethod("AddToLocalCache", BindingFlags.Instance | BindingFlags.NonPublic)!
            .MakeGenericMethod(typeof(string)).CreateDelegate<Action<string, string, TimeSpan?>>(instance);
        try
        {
            cache.Clear();
            MicroiTwoLevelCacheConfig.MaxLocalCacheSize = 32;
            MicroiTwoLevelCacheConfig.EvictionPercentage = .5;
            for (var i = 0; i < 32; i++) add("initial-" + i, "old", TimeSpan.FromMinutes(1));
            using var start = new ManualResetEventSlim(false);
            var workers = Enumerable.Range(0, 8).Select(worker => Task.Factory.StartNew(() =>
            {
                start.Wait(TestContext.Current.CancellationToken);
                for (var i = 0; i < 4000; i++)
                    add("worker-" + worker + "-" + i % 64, "value-" + i, TimeSpan.FromMinutes(1));
            }, TestContext.Current.CancellationToken, TaskCreationOptions.LongRunning, TaskScheduler.Default)).ToArray();
            start.Set();
            await Task.WhenAll(workers);
            Assert.InRange(cache.Count, 1, 64);
            foreach (DictionaryEntry entry in cache) Assert.NotNull(entry.Value);
            add("final-current", "new", TimeSpan.FromMinutes(2));
            Assert.NotNull(cache["final-current"]);
        }
        finally
        {
            cache.Clear();
            foreach (var entry in saved) cache.Add(entry.Key, entry.Value);
            MicroiTwoLevelCacheConfig.MaxLocalCacheSize = capacity;
            MicroiTwoLevelCacheConfig.EvictionPercentage = eviction;
        }
    }
}

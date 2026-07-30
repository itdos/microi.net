#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：MicroiTwoLevelCache.cs
* Copyright(c) Microi.net
* CLR 版本: 
* 创 建 人：Anderson
* 电子邮箱：
* 创建日期：2026-01-10
* 文件描述：二级缓存实现（本地内存 + Redis）
*          - L1: ConcurrentDictionary (微秒级)
*          - L2: Redis (毫秒级)
*          - 通过 Redis Pub/Sub 实现分布式缓存同步
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// 二级缓存实现 - 结合本地内存和Redis，支持分布式环境
    /// </summary>
    public class MicroiTwoLevelCache : IMicroiCache
    {
        #region 字段和属性

        private readonly IMicroiCache _redisCache;
        private readonly string _osClient;
        private readonly IConnectionMultiplexer _redis;

        // 不能只使用进程 PID 标识发布节点：容器内主进程通常都是 PID 1，
        // 多个 API 节点会因此把其它容器发布的失效消息误判为“自己发布”，
        // 从而长期保留旧的权限、接口路由等 L1 缓存。该值只用于区分
        // 当前运行实例，不承载业务事实，因此每个进程生成一次唯一值即可。
        private static readonly string _cacheInstanceId = BuildCacheInstanceId();

        // L1 本地缓存（进程内存）
        private static readonly ConcurrentDictionary<string, CacheEntry> _localCache
            = new ConcurrentDictionary<string, CacheEntry>();

        // 缓存统计
        private static long _localHits = 0;
        private static long _redisHits = 0;
        private static long _misses = 0;

        // 每个租户可能连接不同 Redis，订阅状态不能跨实例共享。
        private int _subscriberInitialized = 0;

        // StackExchange.Redis 本身支持并发，但批量表单导入会在短时间产生数千次
        // 缓存失效。将同一租户的 PUBLISH 串行化，避免命令在连接写队列中无界积压。
        private readonly SemaphoreSlim _publishGate = new SemaphoreSlim(1, 1);
        private long _lastPublishWarningTicks = 0;
        private long _suppressedPublishWarnings = 0;

        private void WriteCacheLog(string action, string title, string content, int level = 2, string targetId = null, bool? success = false)
        {
            MicroiEngine.QueueSystemLog(_osClient, "Cache", action, title, content, level, success, targetId);
        }

        #endregion

        #region 配置（统一从 MicroiTwoLevelCacheConfig 读取）

        // 所有配置项都从 MicroiTwoLevelCacheConfig 静态类读取
        // 如需修改配置，请编辑 MicroiTwoLevelCacheConfig.cs 文件

        #endregion

        #region 构造函数

        public MicroiTwoLevelCache(IMicroiCache redisCache, string osClient)
        {
            _redisCache = redisCache ?? throw new ArgumentNullException(nameof(redisCache));
            _osClient = osClient;

            // 获取 Redis 连接（用于 Pub/Sub）
            try
            {
                _redis = MicroiCacheRedis.GetConnection(osClient);

                // 初始化 Pub/Sub 订阅（全局只初始化一次）
                InitializeSubscriber();

                // 启动后台清理线程（全局只启动一次）
                StartBackgroundCleanup();
            }
            catch (Exception ex)
            {
                WriteCacheLog("PubSubInitializationFailed", "二级缓存 Pub/Sub 初始化失败，已降级为纯 Redis", ex.ToString(), 2);
            }
        }

        #endregion

        #region Pub/Sub 订阅初始化

        /// <summary>
        /// 初始化 Redis Pub/Sub 订阅（全局只执行一次）
        /// </summary>
        private void InitializeSubscriber()
        {
            if (!MicroiTwoLevelCacheConfig.Enabled || _redis == null) return;

            // 使用 Interlocked 确保只初始化一次
            if (Interlocked.CompareExchange(ref _subscriberInitialized, 1, 0) == 0)
            {
                try
                {
                    var subscriber = _redis.GetSubscriber();

                    // 订阅单Key失效通知
                    subscriber.Subscribe(RedisChannel.Literal(MicroiTwoLevelCacheConfig.InvalidateChannel), (channel, message) =>
                    {
                        try
                        {
                            var msg = message.ToString();
                            if (string.IsNullOrEmpty(msg)) return;

                            // 解析消息：格式为 {InstanceId}|{Key}
                            var parts = msg.Split('|', 2);
                            if (parts.Length != 2) return;

                            var publisherInstanceId = parts[0];
                            var key = parts[1];

                            // 如果是自己发布的通知，忽略（因为自己已经更新了缓存）
                            if (publisherInstanceId == _cacheInstanceId)
                            {
                                return;
                            }

                            // 清除其他节点发布的缓存通知
                            InvalidateLocalCache(key);

                        }
                        catch (Exception ex)
                        {
                            WriteCacheLog("InvalidateMessageFailed", "处理缓存失效消息失败", ex.ToString(), 2);
                        }
                    });

                    // 订阅模式失效通知
                    subscriber.Subscribe(RedisChannel.Literal(MicroiTwoLevelCacheConfig.InvalidatePatternChannel), (channel, message) =>
                    {
                        try
                        {
                            var msg = message.ToString();
                            if (string.IsNullOrEmpty(msg)) return;

                            // 解析消息：格式为 {ProcessId}|{Pattern}
                            var parts = msg.Split('|', 2);
                            if (parts.Length != 2) return;

                            var publisherInstanceId = parts[0];
                            var pattern = parts[1];

                            // 忽略自己发布的通知
                            if (publisherInstanceId == _cacheInstanceId)
                            {
                                return;
                            }

                            InvalidateLocalCacheByPattern(pattern);
                        }
                        catch (Exception ex)
                        {
                            WriteCacheLog("PatternInvalidateMessageFailed", "处理缓存模式失效消息失败", ex.ToString(), 2);
                        }
                    });

                    WriteCacheLog("PubSubInitialized", "二级缓存 Pub/Sub 订阅初始化完成", MicroiTwoLevelCacheConfig.GetConfigSummary(), 1, success: true);
                }
                catch (Exception ex)
                {
                    WriteCacheLog("PubSubSubscriptionFailed", "二级缓存 Pub/Sub 订阅失败", ex.ToString(), 2);
                    Interlocked.Exchange(ref _subscriberInitialized, 0); // 重置标记
                }
            }
        }

        #endregion

        #region 核心判断逻辑

        /// <summary>
        /// 判断Key是否应该使用本地缓存
        /// </summary>
        private bool ShouldUseLocalCache(string key)
        {
            if (!MicroiTwoLevelCacheConfig.Enabled || string.IsNullOrEmpty(key))
                return false;

            // 1. 优先检查黑名单（禁用模式）- 不区分大小写
            foreach (var pattern in MicroiTwoLevelCacheConfig.DisabledPatterns)
            {
                if (key.Contains(pattern, StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }
            }

            // 2. 检查白名单（模式匹配）- 不区分大小写
            foreach (var pattern in MicroiTwoLevelCacheConfig.EnabledPatterns)
            {
                if (key.Contains(pattern, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }

            return true; // 默认启用本地缓存
        }

        #endregion

        #region 异步读写方法（核心）

        /// <summary>
        /// 异步获取数据（二级缓存）
        /// </summary>
        public async Task<T> GetAsync<T>(string key)
        {
            // 判断是否启用本地缓存
            if (ShouldUseLocalCache(key))
            {
                // L1: 本地缓存查询
                if (_localCache.TryGetValue(key, out var entry) && entry.ExpireTime > DateTime.UtcNow)
                {
                    try
                    {
                        Interlocked.Increment(ref _localHits);

                        // Json.NET 自动处理所有类型的反序列化
                        // dynamic → T 的转换交给 Json.NET
                        if (entry.Value == null)
                        {
                            return default(T);
                        }

                        // dynamic 的底层类型是 object。字符串重载写入的标准 JSON 在
                        // Redis(L2)命中时会被反序列化，但此前 L1 命中会因为 string 也是
                        // object 而直接返回字符串，导致同一个 Key 在不同节点/命中层级
                        // 得到不同类型。L1 必须与 L2 保持相同的动态 JSON 语义。
                        if (typeof(T) == typeof(object) && entry.Value is string localJsonString)
                        {
                            try
                            {
                                var deserializedValue =
                                    Newtonsoft.Json.JsonConvert.DeserializeObject(localJsonString);
                                if (deserializedValue != null)
                                {
                                    AddToLocalCache(key, deserializedValue);
                                    return (T)(object)deserializedValue;
                                }
                            }
                            catch (Exception ex)
                            {
                                _localCache.TryRemove(key, out _);
                                WriteCacheLog("LocalJsonDeserializationFailed", "本地缓存 JSON 反序列化失败，已清除 L1", ex.ToString(), 2, key);
                            }
                        }

                        // 如果存储的就是目标类型，直接转换
                        if (entry.Value is T result)
                        {
                            return result;
                        }

                        // 否则通过 Json.NET 进行序列化/反序列化转换
                        // 这支持 List<JObject>、JArray、对象等所有情况
                        var json = Newtonsoft.Json.JsonConvert.SerializeObject(entry.Value);
                        return Newtonsoft.Json.JsonConvert.DeserializeObject<T>(json);
                    }
                    catch (Exception ex)
                    {
                        // 类型转换失败（旧数据或格式问题），清除本地缓存
                        _localCache.TryRemove(key, out _);
                        WriteCacheLog("LocalTypeConversionFailed", "本地缓存类型转换失败，已清除 L1", ex.ToString(), 2, key);
                    }
                }
            }

            // L2: Redis 缓存查询
            var value = await _redisCache.GetAsync<T>(key);

            if (value != null)
            {
                Interlocked.Increment(ref _redisHits);

                // 【关键修复】处理 dynamic 类型的特殊情况
                // 当 T 是 dynamic 时，Redis 返回的可能是 JSON 字符串，需要反序列化
                if (typeof(T).Name == "Object" && value is string jsonString)  // dynamic 的底层类型是 Object
                {
                    try
                    {
                        // 将 JSON 字符串反序列化为 JObject（更安全的 dynamic 替代品）
                        dynamic deserializedValue = Newtonsoft.Json.JsonConvert.DeserializeObject(jsonString);

                        // 写入本地缓存
                        if (ShouldUseLocalCache(key))
                        {
                            AddToLocalCache(key, deserializedValue);
                        }

                        return (T)(object)deserializedValue;
                    }
                    catch (Exception ex)
                    {
                        WriteCacheLog("RedisJsonDeserializationFailed", "Redis 动态对象反序列化失败", ex.ToString(), 2, key);
                        // 降级返回原始字符串
                    }
                }

                // 写入本地缓存（如果启用）
                if (ShouldUseLocalCache(key))
                {
                    AddToLocalCache(key, value);
                }
            }
            else
            {
                Interlocked.Increment(ref _misses);
            }

            return value;
        }

        /// <summary>
        /// 异步获取数据（二级缓存，返回原始类型）
        /// </summary>
        public async Task<object> GetAsync(string key)
        {
            var shouldCache = ShouldUseLocalCache(key);

            // 判断是否启用本地缓存
            if (shouldCache)
            {
                // L1: 本地缓存查询
                if (_localCache.TryGetValue(key, out var entry) && entry.ExpireTime > DateTime.UtcNow)
                {
                    Interlocked.Increment(ref _localHits);
                    // 直接返回原始值，不做类型转换
                    return entry.Value;
                }
            }

            // L2: Redis 缓存查询（直接调用底层 Redis 的方法）
            var value = await _redisCache.GetAsync(key);

            if (value != null)
            {
                Interlocked.Increment(ref _redisHits);

                // 写入本地缓存（如果启用）
                if (shouldCache)
                {
                    AddToLocalCache(key, value);
                }
            }
            else
            {
                Interlocked.Increment(ref _misses);
            }

            return value;
        }

        /// <summary>
        /// 异步设置数据（同时更新两级缓存 + 通知其他节点）
        /// </summary>
        public async Task<bool> SetAsync<T>(string key, T value, TimeSpan? expiresIn = null, When when = When.Always)
        {
            // 1. 写入 Redis
            var result = await _redisCache.SetAsync(key, value, expiresIn, when);

            if (result)
            {
                // 2. 更新本地缓存
                if (ShouldUseLocalCache(key))
                {
                    AddToLocalCache(key, value, expiresIn);
                }

                // 3. 发布失效通知（其他节点会清除缓存，自己节点会忽略）
                await PublishInvalidateAsync(key);
            }

            return result;
        }

        /// <summary>
        /// 异步设置字符串（修复：直接调用底层Redis字符串方法，避免序列化）
        /// </summary>
        public async Task<bool> SetAsync(string key, string value, TimeSpan? expiresIn = null, When when = When.Always)
        {
            // 【修复1】直接调用底层Redis的字符串方法，不经过泛型方法（避免序列化）
            var result = await _redisCache.SetAsync(key, value, expiresIn, when);

            if (result)
            {
                // 更新本地缓存
                if (ShouldUseLocalCache(key))
                {
                    AddToLocalCache(key, value, expiresIn);
                }

                // 【修复2】发布失效通知，让其他节点清除缓存（带节点标识）
                await PublishInvalidateAsync(key);
            }

            return result;
        }

        /// <summary>
        /// 异步删除数据（清除两级缓存 + 发布通知）
        /// </summary>
        public async Task<bool> RemoveAsync(string key)
        {
            // 1. 删除 Redis
            var result = await _redisCache.RemoveAsync(key);

            // 2. 发布失效通知
            await PublishInvalidateAsync(key);

            // 3. 删除本地缓存
            InvalidateLocalCache(key);

            return result;
        }

        /// <summary>
        /// 异步删除父键（模式匹配）
        /// </summary>
        public async Task<long> RemoveParentAsync(string parentKey)
        {
            // 1. 删除 Redis（调用原实现）
            var result = await _redisCache.RemoveParentAsync(parentKey);

            // 2. 发布模式失效通知
            await PublishInvalidatePatternAsync(parentKey);

            // 3. 删除本地缓存
            InvalidateLocalCacheByPattern(parentKey);

            return result;
        }

        #endregion

        #region 同步读写方法

        public T Get<T>(string key)
        {
            return GetAsync<T>(key).GetAwaiter().GetResult();
        }

        public object Get(string key)
        {
            return GetAsync(key).GetAwaiter().GetResult();
        }

        public bool Set<T>(string key, T value, TimeSpan expiresIn)
        {
            return SetAsync(key, value, expiresIn).GetAwaiter().GetResult();
        }
        public bool Set<T>(string key, T value, string expiresIn)
        {
            if (TimeSpan.TryParse(expiresIn, out var timeSpan))
            {
                return SetAsync(key, value, timeSpan).GetAwaiter().GetResult();
            }
            return SetAsync(key, value).GetAwaiter().GetResult();
        }

        public bool Set(string key, string value, TimeSpan expiresIn)
        {
            return SetAsync(key, value, expiresIn).GetAwaiter().GetResult();
        }

        /// <summary>
        /// 设置缓存（支持字符串格式的过期时间）
        /// </summary>
        /// <param name="key">缓存键</param>
        /// <param name="value">缓存值</param>
        /// <param name="expiresIn">过期时间，格式如 "0.00:10:00" 表示10分钟</param>
        public bool Set(string key, string value, string expiresIn)
        {
            if (TimeSpan.TryParse(expiresIn, out var timeSpan))
            {
                return SetAsync(key, value, timeSpan).GetAwaiter().GetResult();
            }
            return SetAsync(key, value).GetAwaiter().GetResult();
        }
       
        public bool Set<T>(string key, T value)
        {
            return SetAsync(key, value).GetAwaiter().GetResult();
        }

        public bool Set(string key, string value)
        {
            return SetAsync(key, value).GetAwaiter().GetResult();
        }

        public bool Remove(string key)
        {
            return RemoveAsync(key).GetAwaiter().GetResult();
        }

        public bool Delete(string key)
        {
            return Remove(key);
        }
        public bool Del(string key)
        {
            return Remove(key);
        }

        public async Task<bool> DeleteAsync(string key)
        {
            return await RemoveAsync(key);
        }
        public async Task<bool> DelAsync(string key)
        {
            return await RemoveAsync(key);
        }

        public bool KeyExist(string key)
        {
            return _redisCache.KeyExist(key);
        }

        #endregion

        #region 本地缓存管理

        /// <summary>
        /// 添加到本地缓存（带大小限制）
        /// 使用 Json.NET 的强大序列化能力，无需手动类型转换
        /// </summary>
        private void AddToLocalCache<T>(string key, T value, TimeSpan? expiry = null)
        {
            // 检查缓存大小限制
            if (_localCache.Count >= MicroiTwoLevelCacheConfig.MaxLocalCacheSize)
            {
                // 根据配置的清理比例删除旧缓存
                var countToRemove = (int)(MicroiTwoLevelCacheConfig.MaxLocalCacheSize * MicroiTwoLevelCacheConfig.EvictionPercentage);
                var toRemove = _localCache
                    .OrderBy(kvp => kvp.Value.ExpireTime)
                    .Take(countToRemove)
                    .Select(kvp => kvp.Key)
                    .ToList();

                foreach (var k in toRemove)
                {
                    _localCache.TryRemove(k, out _);
                }
                WriteCacheLog("LocalCapacityEvicted", "本地缓存达到容量上限并已清理", $"已清理 {toRemove.Count} 个旧缓存项。", 1, success: true);
            }

            // 直接存储原值，Json.NET 会在需要时自动处理序列化
            // 支持所有类型：基本类型、对象、列表、JObject、JArray 等
            var entry = new CacheEntry
            {
                Value = value,  // ← 简洁：直接存储原值，无需复杂的类型判断
                ExpireTime = DateTime.UtcNow.Add(expiry ?? MicroiTwoLevelCacheConfig.LocalCacheTTL)
            };

            _localCache.AddOrUpdate(key, entry, (k, old) => entry);

        }

        /// <summary>
        /// 清除单个本地缓存
        /// </summary>
        private void InvalidateLocalCache(string key)
        {
            _localCache.TryRemove(key, out _);
        }

        /// <summary>
        /// 按模式清除本地缓存（支持通配符 *）
        /// </summary>
        private void InvalidateLocalCacheByPattern(string pattern)
        {
            try
            {
                // 将通配符转换为正则表达式
                var regexPattern = "^" + Regex.Escape(pattern).Replace("\\*", ".*") + "$";
                var regex = new Regex(regexPattern, RegexOptions.IgnoreCase | RegexOptions.Compiled);

                var keysToRemove = _localCache.Keys
                    .Where(k => regex.IsMatch(k))
                    .ToList();

                foreach (var key in keysToRemove)
                {
                    _localCache.TryRemove(key, out _);
                }
                if (MicroiTwoLevelCacheConfig.LogStatistics && keysToRemove.Count > 0)
                {
                    WriteCacheLog("PatternInvalidated", "本地缓存按模式清理完成", $"模式 {pattern} 清理 {keysToRemove.Count} 个缓存项。", 1, pattern, true);
                }
            }
            catch (Exception ex)
            {
                WriteCacheLog("PatternInvalidationFailed", "清除本地缓存模式失败", ex.ToString(), 2, pattern);
            }
        }

        #endregion

        #region Pub/Sub 发布

        private static string BuildCacheInstanceId()
        {
            return $"{Environment.MachineName}:{System.Diagnostics.Process.GetCurrentProcess().Id}:{Guid.NewGuid():N}";
        }

        /// <summary>
        /// 发布缓存失效通知（携带节点标识，避免清除自己的缓存）
        /// 消息格式：{InstanceId}|{Key}
        /// </summary>
        private async Task PublishInvalidateAsync(string key)
        {
            if (!MicroiTwoLevelCacheConfig.Enabled || _redis == null) return;

            var message = $"{_cacheInstanceId}|{key}";
            await PublishWithRetryAsync(
                RedisChannel.Literal(MicroiTwoLevelCacheConfig.InvalidateChannel),
                message,
                "缓存失效");
        }

        /// <summary>
        /// 发布模式失效通知（携带节点标识）
        /// 消息格式：{InstanceId}|{Pattern}
        /// </summary>
        private async Task PublishInvalidatePatternAsync(string pattern)
        {
            if (!MicroiTwoLevelCacheConfig.Enabled || _redis == null) return;

            var message = $"{_cacheInstanceId}|{pattern}";
            await PublishWithRetryAsync(
                RedisChannel.Literal(MicroiTwoLevelCacheConfig.InvalidatePatternChannel),
                message,
                "缓存模式失效");
        }

        /// <summary>
        /// 有界发布缓存失效通知。短暂断线时等待 Multiplexer 自动重连后重试一次；
        /// 持续故障按时间窗口汇总日志，避免一次批量导入刷出数千条相同 Warning。
        /// </summary>
        private async Task PublishWithRetryAsync(RedisChannel channel, RedisValue message, string description)
        {
            await _publishGate.WaitAsync().ConfigureAwait(false);
            try
            {
                Exception lastException = null;
                for (var attempt = 1; attempt <= 2; attempt++)
                {
                    try
                    {
                        var subscriber = _redis.GetSubscriber();
                        await subscriber.PublishAsync(channel, message).ConfigureAwait(false);
                        return;
                    }
                    catch (Exception ex)
                    {
                        lastException = ex;
                        if (attempt < 2 && IsTransientRedisPublishFailure(ex))
                        {
                            await Task.Delay(100).ConfigureAwait(false);
                            continue;
                        }
                        break;
                    }
                }

                LogPublishFailure(description, lastException);
            }
            finally
            {
                _publishGate.Release();
            }
        }

        private static bool IsTransientRedisPublishFailure(Exception ex)
        {
            return ex is RedisConnectionException || ex is RedisTimeoutException;
        }

        private void LogPublishFailure(string description, Exception ex)
        {
            var nowTicks = DateTime.UtcNow.Ticks;
            var previousTicks = Interlocked.Read(ref _lastPublishWarningTicks);
            if (previousTicks == 0
                || nowTicks - previousTicks >= TimeSpan.FromSeconds(10).Ticks)
            {
                if (Interlocked.CompareExchange(ref _lastPublishWarningTicks, nowTicks, previousTicks) == previousTicks)
                {
                    var suppressed = Interlocked.Exchange(ref _suppressedPublishWarnings, 0);
                    var suffix = suppressed > 0 ? $"（期间已合并 {suppressed} 条同类告警）" : string.Empty;
                    WriteCacheLog("PublishInvalidationFailed", $"发布{description}通知失败", $"{suffix}{ex}", 2, description);
                    return;
                }
            }

            Interlocked.Increment(ref _suppressedPublishWarnings);
        }

        #endregion

        #region 后台清理

        /// <summary>
        /// 启动后台清理过期缓存（全局只启动一次）
        /// </summary>
        private static int _cleanupStarted = 0;
        private static CancellationTokenSource _cleanupCts = new CancellationTokenSource();

        private void StartBackgroundCleanup()
        {
            if (!MicroiTwoLevelCacheConfig.Enabled) return;

            if (Interlocked.CompareExchange(ref _cleanupStarted, 1, 0) == 0)
            {
                Task.Run(async () =>
                {
                    while (!_cleanupCts.Token.IsCancellationRequested)
                    {
                        try
                        {
                            await Task.Delay(MicroiTwoLevelCacheConfig.CleanupInterval, _cleanupCts.Token);

                            var now = DateTime.UtcNow;
                            var expiredKeys = _localCache
                                .Where(kvp => kvp.Value.ExpireTime < now)
                                .Select(kvp => kvp.Key)
                                .ToList();

                            foreach (var key in expiredKeys)
                            {
                                _localCache.TryRemove(key, out _);
                            }

                            if (expiredKeys.Count > 0)
                            {
                                if (MicroiTwoLevelCacheConfig.LogStatistics)
                                {
                                    WriteCacheLog("ExpiredEntriesRemoved", "本地过期缓存清理完成", $"已清理 {expiredKeys.Count} 个过期缓存项。", 1, success: true);
                                }
                            }

                            // 可选：定期输出统计信息
                            if (MicroiTwoLevelCacheConfig.LogStatistics)
                            {
                                var stats = GetStatistics();
                                WriteCacheLog("Statistics", "二级缓存运行统计", stats.ToString(), 1, success: true);
                            }
                        }
                        catch (TaskCanceledException)
                        {
                            // 正常取消，退出循环
                            break;
                        }
                        catch (Exception ex)
                        {
                            WriteCacheLog("CleanupFailed", "缓存后台清理失败", ex.ToString(), 2);
                        }
                    }
                    MicroiEngine.QueueSystemLog(OsClientDefault.OsClient, "Cache", "CleanupStopped", "缓存后台清理任务已停止", "后台清理任务已正常停止。", 1, true);
                }, _cleanupCts.Token);
            }
        }

        /// <summary>
        /// 停止后台清理任务（优雅关闭）
        /// </summary>
        public static void StopBackgroundCleanup()
        {
            try
            {
                _cleanupCts.Cancel();
                MicroiEngine.QueueSystemLog(OsClientDefault.OsClient, "Cache", "CleanupStopping", "缓存后台清理任务正在停止", "已发出取消信号。", 1, true);
            }
            catch (Exception ex)
            {
                MicroiEngine.QueueSystemLog(OsClientDefault.OsClient, "Cache", "CleanupStopFailed", "停止缓存后台清理任务失败", ex.ToString(), 3, false);
            }
        }

        #endregion

        #region 统计信息

        /// <summary>
        /// 获取缓存统计信息
        /// </summary>
        public static CacheStatistics GetStatistics()
        {
            var total = _localHits + _redisHits + _misses;
            return new CacheStatistics
            {
                LocalHits = _localHits,
                RedisHits = _redisHits,
                Misses = _misses,
                LocalCacheSize = _localCache.Count,
                LocalHitRate = total > 0 ? (double)_localHits / total * 100 : 0,
                TotalHitRate = total > 0 ? (double)(_localHits + _redisHits) / total * 100 : 0
            };
        }

        #endregion

        #region 委托给 Redis 的方法（不涉及本地缓存）

        public IDatabase Db(string osClient)
        {
            return _redisCache.Db(osClient);
        }

        public void AddConnection(string osClient, string connectionString)
        {
            _redisCache.AddConnection(osClient, connectionString);
        }

        public void AddConnection(string osClient, string host, string pwd, int port = 6379, int databaseIndex = 0)
        {
            _redisCache.AddConnection(osClient, host, pwd, port, databaseIndex);
        }

        public IDatabase GetIDatabase()
        {
            return _redisCache.GetIDatabase();
        }

        #endregion

        #region Hash 操作（直接委托给 Redis）

        public void HashSet(string key, List<HashEntry> hashEntrys, CommandFlags flags = CommandFlags.None)
        {
            _redisCache.HashSet(key, hashEntrys, flags);
        }

        public bool HashSet<T>(string key, string field, T val, When when = When.Always, CommandFlags flags = CommandFlags.None)
        {
            return _redisCache.HashSet(key, field, val, when, flags);
        }

        public bool HashSet(string key, string field, string val, When when = When.Always, CommandFlags flags = CommandFlags.None)
        {
            return _redisCache.HashSet(key, field, val, when, flags);
        }

        public T HashGet<T>(string key, string field)
        {
            return _redisCache.HashGet<T>(key, field);
        }

        public string HashGet(string key, string field)
        {
            return _redisCache.HashGet(key, field);
        }

        public HashEntry[] HashGetAll(string key, CommandFlags flags = CommandFlags.None)
        {
            return _redisCache.HashGetAll(key, flags);
        }

        public List<T> HashGetAllValues<T>(string key, CommandFlags flags = CommandFlags.None)
        {
            return _redisCache.HashGetAllValues<T>(key, flags);
        }

        public string[] HashGetAllKeys(string key, CommandFlags flags = CommandFlags.None)
        {
            return _redisCache.HashGetAllKeys(key, flags);
        }

        public bool HashDelete(string key, string hashField, CommandFlags flags = CommandFlags.None)
        {
            return _redisCache.HashDelete(key, hashField, flags);
        }

        public long HashDelete(string key, string[] hashFields, CommandFlags flags = CommandFlags.None)
        {
            return _redisCache.HashDelete(key, hashFields, flags);
        }

        public bool HashExists(string key, string field, CommandFlags flags = CommandFlags.None)
        {
            return _redisCache.HashExists(key, field, flags);
        }

        public long HashLength(string key, CommandFlags flags = CommandFlags.None)
        {
            return _redisCache.HashLength(key, flags);
        }

        public double HashIncrement(string key, string field, double incrVal, CommandFlags flags = CommandFlags.None)
        {
            return _redisCache.HashIncrement(key, field, incrVal, flags);
        }

        public Task<bool> SetAsync<T>(string key, T value)
        {
            return SetAsync<T>(key, value, null);
        }

        public Task<bool> SetAsync(string key, string value)
        {
            return SetAsync(key, value, null);
        }

        #endregion
    }

    #region 辅助类

    /// <summary>
    /// 本地缓存条目（使用 dynamic 存储，支持任意类型）
    /// </summary>
    internal class CacheEntry
    {
        /// <summary>
        /// 缓存值（dynamic 可表示任意类型：基本类型、对象、列表等）
        /// Json.NET 会自动处理序列化和反序列化
        /// </summary>
        public dynamic Value { get; set; }
        public DateTime ExpireTime { get; set; }
    }

    /// <summary>
    /// 缓存统计信息
    /// </summary>
    public class CacheStatistics
    {
        public long LocalHits { get; set; }
        public long RedisHits { get; set; }
        public long Misses { get; set; }
        public int LocalCacheSize { get; set; }
        public double LocalHitRate { get; set; }
        public double TotalHitRate { get; set; }

        public override string ToString()
        {
            return $"本地命中: {LocalHits}, Redis命中: {RedisHits}, 未命中: {Misses}, " +
                   $"本地缓存大小: {LocalCacheSize}, 本地命中率: {LocalHitRate:F2}%, " +
                   $"总命中率: {TotalHitRate:F2}%";
        }
    }

    #endregion
}

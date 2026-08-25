using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// V8 专用 Redis 代理。所有 Key 固定在当前租户命名空间，且不暴露底层连接和 IDatabase。
    /// </summary>
    public sealed class V8TenantCache : IV8Cache
    {
        private readonly string _osClient;
        private readonly IMicroiCache _inner;

        public V8TenantCache(string osClient, IMicroiCache inner)
        {
            _osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
            _inner = inner ?? throw new ArgumentNullException(nameof(inner));
        }

        private string Key(string key) => TenantConfigurationSecurity.NormalizeCacheKey(_osClient, key);

        public bool Delete(string key) => _inner.Delete(Key(key));
        public bool Del(string key) => _inner.Del(Key(key));
        public bool Remove(string key) => _inner.Remove(Key(key));
        public Task<bool> DeleteAsync(string key) => _inner.DeleteAsync(Key(key));
        public Task<bool> DelAsync(string key) => _inner.DelAsync(Key(key));
        public Task<bool> RemoveAsync(string key) => _inner.RemoveAsync(Key(key));
        public Task<long> RemoveParentAsync(string parentKey) => _inner.RemoveParentAsync(Key(parentKey));

        public bool Set<T>(string key, T value) => _inner.Set(Key(key), value);
        public bool Set(string key, string value) => _inner.Set(Key(key), value);
        public bool Set(string key, string value, TimeSpan expiresIn) => _inner.Set(Key(key), value, expiresIn);
        public bool Set<T>(string key, T value, TimeSpan expiresIn) => _inner.Set(Key(key), value, expiresIn);
        public bool Set<T>(string key, T value, string expiresIn) => _inner.Set(Key(key), value, expiresIn);
        public bool Set(string key, string value, string expiresIn) => _inner.Set(Key(key), value, expiresIn);
        public bool Set(string key, string value, double expiresInSeconds)
        {
            if (double.IsNaN(expiresInSeconds) || double.IsInfinity(expiresInSeconds) || expiresInSeconds <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(expiresInSeconds), "缓存过期秒数必须大于0。");
            }
            return _inner.Set(Key(key), value, TimeSpan.FromSeconds(expiresInSeconds));
        }
        public bool SetIfNotExists(string key, string value, double expiresInSeconds)
        {
            if (double.IsNaN(expiresInSeconds) || double.IsInfinity(expiresInSeconds) || expiresInSeconds <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(expiresInSeconds), "缓存过期秒数必须大于0。");
            }
            return _inner.GetIDatabase().StringSet(Key(key), value ?? string.Empty, TimeSpan.FromSeconds(expiresInSeconds), When.NotExists);
        }

        public T Get<T>(string key) => _inner.Get<T>(Key(key));
        public object Get(string key) => _inner.Get(Key(key));
        public bool KeyExist(string key) => _inner.KeyExist(Key(key));
        public bool Exists(string key) => _inner.KeyExist(Key(key));
        public bool Expire(string key, double expiresInSeconds)
        {
            if (double.IsNaN(expiresInSeconds) || double.IsInfinity(expiresInSeconds) || expiresInSeconds <= 0)
            {
                throw new ArgumentOutOfRangeException(nameof(expiresInSeconds), "缓存过期秒数必须大于0。");
            }
            return _inner.GetIDatabase().KeyExpire(Key(key), TimeSpan.FromSeconds(expiresInSeconds));
        }

        public Task<bool> SetAsync<T>(string key, T value) => _inner.SetAsync(Key(key), value);
        public Task<bool> SetAsync(string key, string value) => _inner.SetAsync(Key(key), value);
        public Task<bool> SetAsync(string key, string value, TimeSpan? expiresIn = null, When when = When.Always) =>
            _inner.SetAsync(Key(key), value, expiresIn, when);
        public Task<bool> SetAsync<T>(string key, T value, TimeSpan? expiresIn = null, When when = When.Always) =>
            _inner.SetAsync(Key(key), value, expiresIn, when);
        public Task<T> GetAsync<T>(string key) => _inner.GetAsync<T>(Key(key));
        public Task<object> GetAsync(string key) => _inner.GetAsync(Key(key));

        public void HashSet(string key, List<HashEntry> hashEntries, CommandFlags flags = CommandFlags.None) =>
            _inner.HashSet(Key(key), hashEntries, flags);
        public bool HashSet<T>(string key, string field, T value, When when = When.Always, CommandFlags flags = CommandFlags.None) =>
            _inner.HashSet(Key(key), field, value, when, flags);
        public bool HashSet(string key, string field, string value, When when = When.Always, CommandFlags flags = CommandFlags.None) =>
            _inner.HashSet(Key(key), field, value, when, flags);
        public T HashGet<T>(string key, string field) => _inner.HashGet<T>(Key(key), field);
        public string HashGet(string key, string field) => _inner.HashGet(Key(key), field);
        public HashEntry[] HashGetAll(string key, CommandFlags flags = CommandFlags.None) =>
            _inner.HashGetAll(Key(key), flags);
        public List<T> HashGetAllValues<T>(string key, CommandFlags flags = CommandFlags.None) =>
            _inner.HashGetAllValues<T>(Key(key), flags);
        public string[] HashGetAllKeys(string key, CommandFlags flags = CommandFlags.None) =>
            _inner.HashGetAllKeys(Key(key), flags);
        public bool HashDelete(string key, string hashField, CommandFlags flags = CommandFlags.None) =>
            _inner.HashDelete(Key(key), hashField, flags);
        public long HashDelete(string key, string[] hashFields, CommandFlags flags = CommandFlags.None) =>
            _inner.HashDelete(Key(key), hashFields, flags);
        public bool HashRemove(string key, string hashField, CommandFlags flags = CommandFlags.None) =>
            _inner.HashDelete(Key(key), hashField, flags);
        public bool HashExists(string key, string field, CommandFlags flags = CommandFlags.None) =>
            _inner.HashExists(Key(key), field, flags);
        public long HashLength(string key, CommandFlags flags = CommandFlags.None) =>
            _inner.HashLength(Key(key), flags);
        public double HashIncrement(string key, string field, double incrementValue, CommandFlags flags = CommandFlags.None) =>
            _inner.HashIncrement(Key(key), field, incrementValue, flags);
    }
}

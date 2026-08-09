using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// V8 可见的租户缓存安全接口。
    /// 不得在此接口增加 IDatabase、连接管理或服务器扫描等底层 Redis 能力。
    /// </summary>
    public interface IV8Cache
    {
        bool Delete(string key);
        bool Del(string key);
        bool Remove(string key);
        Task<bool> DeleteAsync(string key);
        Task<bool> DelAsync(string key);
        Task<bool> RemoveAsync(string key);
        Task<long> RemoveParentAsync(string parentKey);

        bool Set<T>(string key, T value);
        bool Set(string key, string value);
        bool Set(string key, string value, TimeSpan expiresIn);
        bool Set<T>(string key, T value, TimeSpan expiresIn);
        bool Set<T>(string key, T value, string expiresIn);
        bool Set(string key, string value, string expiresIn);
        bool Set(string key, string value, double expiresInSeconds);
        /// <summary>仅当当前租户逻辑Key不存在时写入，并设置有界过期时间。</summary>
        bool SetIfNotExists(string key, string value, double expiresInSeconds);

        T Get<T>(string key);
        object Get(string key);
        bool KeyExist(string key);
        bool Exists(string key);
        /// <summary>为当前租户逻辑Key设置过期时间；不暴露底层Redis连接。</summary>
        bool Expire(string key, double expiresInSeconds);

        Task<bool> SetAsync<T>(string key, T value);
        Task<bool> SetAsync(string key, string value);
        Task<bool> SetAsync(string key, string value, TimeSpan? expiresIn = null, When when = When.Always);
        Task<bool> SetAsync<T>(string key, T value, TimeSpan? expiresIn = null, When when = When.Always);
        Task<T> GetAsync<T>(string key);
        Task<object> GetAsync(string key);

        void HashSet(string key, List<HashEntry> hashEntries, CommandFlags flags = CommandFlags.None);
        bool HashSet<T>(string key, string field, T value, When when = When.Always, CommandFlags flags = CommandFlags.None);
        bool HashSet(string key, string field, string value, When when = When.Always, CommandFlags flags = CommandFlags.None);
        T HashGet<T>(string key, string field);
        string HashGet(string key, string field);
        HashEntry[] HashGetAll(string key, CommandFlags flags = CommandFlags.None);
        List<T> HashGetAllValues<T>(string key, CommandFlags flags = CommandFlags.None);
        string[] HashGetAllKeys(string key, CommandFlags flags = CommandFlags.None);
        bool HashDelete(string key, string hashField, CommandFlags flags = CommandFlags.None);
        long HashDelete(string key, string[] hashFields, CommandFlags flags = CommandFlags.None);
        bool HashRemove(string key, string hashField, CommandFlags flags = CommandFlags.None);
        bool HashExists(string key, string field, CommandFlags flags = CommandFlags.None);
        long HashLength(string key, CommandFlags flags = CommandFlags.None);
        double HashIncrement(string key, string field, double incrementValue, CommandFlags flags = CommandFlags.None);
    }
}

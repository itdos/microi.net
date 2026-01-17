using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    public interface IMicroiCache
    {
        bool Delete(string key);
        bool Del(string key);
        IDatabase Db(string osClient);
        Task<bool> DeleteAsync(string key);
        Task<bool> DelAsync(string key);
        void AddConnection(string osClient, string connectionString);
        void AddConnection(string osClient, string host, string pwd, int port = 6379, int databaseIndex = 0);
        IDatabase GetIDatabase();

        #region 同步
        bool Remove(string key);
        bool Set<T>(string key, T value);
        bool Set(string key, string value);
        bool Set(string key, string value, TimeSpan expiresIn);
        bool Set<T>(string key, T value, TimeSpan expiresIn);
        /// <summary>
        /// 设置缓存（支持字符串格式的过期时间）
        /// </summary>
        /// <param name="key">缓存键</param>
        /// <param name="value">缓存值</param>
        /// <param name="expiresIn">过期时间，格式如 "0.00:10:00" 表示10分钟</param>
        bool Set(string key, string value, string expiresIn);
        T Get<T>(string key);
        string Get(string key);
        bool KeyExist(string key);
        #endregion

        #region 异步
        Task<bool> RemoveAsync(string key);
        Task<long> RemoveParentAsync(string parentKey);
        Task<bool> SetAsync<T>(string key, T value);
        Task<bool> SetAsync(string key, string value);
        Task<bool> SetAsync(string key, string value, TimeSpan? expiresIn = null, When when = When.Always);
        Task<bool> SetAsync<T>(string key, T value, TimeSpan? expiresIn = null, When when = When.Always);
        Task<T> GetAsync<T>(string key);
        Task<string> GetAsync(string key);
        #endregion

        #region Redis Hash散列数据类型操作

        /// <summary>
        /// Redis散列数据类型  批量新增
        /// </summary>
        void HashSet(string key, List<HashEntry> hashEntrys, CommandFlags flags = CommandFlags.None);

        /// <summary>
        /// Redis散列数据类型  新增一个
        /// </summary>
        /// <param name="key"></param>
        /// <param name="field"></param>
        /// <param name="val"></param>
        bool HashSet<T>(string key, string field, T val, When when = When.Always, CommandFlags flags = CommandFlags.None);
        bool HashSet(string key, string field, string val, When when = When.Always, CommandFlags flags = CommandFlags.None);

        /// <summary>
        ///  Redis散列数据类型 获取指定key的指定field
        /// </summary>
        /// <param name="key"></param>
        /// <param name="field"></param>
        /// <returns></returns>
        T HashGet<T>(string key, string field);
        /// <summary>
        /// 
        /// </summary>
        /// <param name="key"></param>
        /// <param name="field"></param>
        /// <returns></returns>
        string HashGet(string key, string field);

        /// <summary>
        ///  Redis散列数据类型 获取所有field所有值,以 HashEntry[]形式返回
        /// </summary>
        /// <param name="key"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        HashEntry[] HashGetAll(string key, CommandFlags flags = CommandFlags.None);

        /// <summary>
        /// Redis散列数据类型 获取key中所有field的值。
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="key"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        List<T> HashGetAllValues<T>(string key, CommandFlags flags = CommandFlags.None);

        /// <summary>
        /// Redis散列数据类型 获取所有Key名称
        /// </summary>
        /// <param name="key"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        string[] HashGetAllKeys(string key, CommandFlags flags = CommandFlags.None);

        /// <summary>
        ///  Redis散列数据类型  单个删除field
        /// </summary>
        /// <param name="key"></param>
        /// <param name="hashField"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        bool HashDelete(string key, string hashField, CommandFlags flags = CommandFlags.None);

        /// <summary>
        ///  Redis散列数据类型  批量删除field
        /// </summary>
        /// <param name="key"></param>
        /// <param name="hashFields"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        long HashDelete(string key, string[] hashFields, CommandFlags flags = CommandFlags.None);

        /// <summary>
        ///  Redis散列数据类型 判断指定键中是否存在此field
        /// </summary>
        /// <param name="key"></param>
        /// <param name="field"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        bool HashExists(string key, string field, CommandFlags flags = CommandFlags.None);

        /// <summary>
        /// Redis散列数据类型  获取指定key中field数量
        /// </summary>
        /// <param name="key"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        long HashLength(string key, CommandFlags flags = CommandFlags.None);

        /// <summary>
        /// Redis散列数据类型  为key中指定field增加incrVal值
        /// </summary>
        /// <param name="key"></param>
        /// <param name="field"></param>
        /// <param name="incrVal"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        double HashIncrement(string key, string field, double incrVal, CommandFlags flags = CommandFlags.None);


        #endregion
    }
}

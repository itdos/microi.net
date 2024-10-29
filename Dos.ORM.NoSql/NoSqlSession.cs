    using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM.NoSql;
using StackExchange.Redis;

namespace Dos.ORM.NoSql
{
    /// <summary>
    /// 
    /// </summary>
    public class NoSqlSession
    {
        /// <summary>
        /// NoSql数据库类型
        /// </summary>
        public NoSqlType NoSqlType;
        /// <summary>
        /// 缓存对象
        /// </summary>
        private ICache Cache;
        /// <summary>
        /// 构造函数
        /// </summary>
        public NoSqlSession()
        {
            var type = "";
            type = ConfigHelper.GetAppSettings("NoSqlType");
            if (string.IsNullOrWhiteSpace(type))
            {
                throw new Exception("请在AppSetting中配置<add key=\"NoSqlType\" value=\"IIS/Redis/MongoDB/Memcache\" />");
            }

            switch (type.ToLower())
            {
                case "redis":
                    NoSqlType = NoSqlType.Redis;
                    Cache = new Redis();
                    break;
                case "iis":
                    NoSqlType = NoSqlType.IIS;
                    Cache = new IIS();
                    break;
                default:
                    throw new Exception("暂时不支持的NoSql数据库！");
            }
        }
        /// <summary>
        /// 构造函数
        /// </summary>
        public NoSqlSession(NoSqlType noSqlType,string host = "",string port = "",string pwd = "", int database = 0)
        {
            switch (noSqlType)
            {
                case NoSqlType.Redis:
                    NoSqlType = NoSqlType.Redis;
                    Cache = new Redis(host, port, pwd, database);
                    break;
                case NoSqlType.IIS:
                    NoSqlType = NoSqlType.IIS;
                    Cache = new IIS();
                    break;
                default:
                    throw new Exception("暂时不支持的NoSql数据库！");
            }
        }

        public IDatabase GetRedisIDatabase()
        {
            return Cache.GetIDatabase();
        }

        /// <summary>
        /// 删除缓存
        /// </summary>
        /// <param name="key"></param>
        /// <returns></returns>
        public bool Remove(string key)
        {
            return Cache.Remove(key);
        }
        /// <summary>
        /// 新增/覆盖 缓存
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="key"></param>
        /// <param name="value"></param>
        /// <returns></returns>
        //public bool Set<T>(string key, T value)
        //{
        //    return Cache.Set(key, value);
        //}
        //public bool Set(string key,string  value)
        //{
        //    return Cache.Set(key, value);
        //}
        public bool Set(string key, string value, TimeSpan? expiresIn = null)
        {
            return Cache.Set(key, value, expiresIn);
        }
        /// <summary>
        /// 新增/覆盖 缓存
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="key"></param>
        /// <param name="value"></param>
        /// <param name="expiresIn"></param>
        /// <returns></returns>
        public bool Set<T>(string key, T value, TimeSpan? expiresIn = null)
        {
            return Cache.Set(key, value, expiresIn);
        }
        /// <summary>
        /// 获取缓存
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="key"></param>
        /// <returns></returns>
        public T Get<T>(string key)
        {
            return Cache.Get<T>(key);
        }
        public string Get(string key)
        {
            return Cache.Get(key);
        }

        #region 异步
        public async Task<bool> RemoveAsync(string key)
        {
            return await Cache.RemoveAsync(key);
        }
        public async Task<long> RemoveParentAsync(string parentKey)
        {
            return await Cache.RemoveParentAsync(parentKey);
        }
        /// <summary>
        /// 新增/覆盖 缓存
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="key"></param>
        /// <param name="value"></param>
        /// <returns></returns>
        //public async Task<bool> SetAsync<T>(string key, T value)
        //{
        //    return await Cache.SetAsync(key, value);
        //}
        //public async Task<bool> SetAsync(string key, string value)
        //{
        //    return await Cache.SetAsync(key, value);
        //}
        public async Task<bool> SetAsync(string key, string value, TimeSpan? expiresIn = null)
        {
            return await Cache.SetAsync(key, value, expiresIn);
        }
        /// <summary>
        /// 新增/覆盖 缓存
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="key"></param>
        /// <param name="value"></param>
        /// <param name="expiresIn"></param>
        /// <returns></returns>
        public async Task<bool> SetAsync<T>(string key, T value, TimeSpan? expiresIn = null)
        {
            return await Cache.SetAsync(key, value, expiresIn);
        }
        /// <summary>
        /// 获取缓存
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="key"></param>
        /// <returns></returns>
        public async Task<T> GetAsync<T>(string key)
        {
            return await Cache.GetAsync<T>(key);
        }
        public async Task<string> GetAsync(string key)
        {
            return await Cache.GetAsync(key);
        }
        #endregion


        #region Redis Hash散列数据类型操作

        /// <summary>
        /// Redis散列数据类型  批量新增
        /// </summary>
        public void HashSet(string key, List<HashEntry> hashEntrys, CommandFlags flags = CommandFlags.None)
        {
            Cache.HashSet(key, hashEntrys, flags);
        }

        /// <summary>
        /// Redis散列数据类型  新增一个
        /// </summary>
        /// <param name="key"></param>
        /// <param name="field"></param>
        /// <param name="val"></param>
        public bool HashSet<T>(string key, string field, T val, When when = When.Always,
            CommandFlags flags = CommandFlags.None)
        {
            return Cache.HashSet(key, field, val, when, flags);
        }
        public bool HashSet(string key, string field, string val, When when = When.Always,
            CommandFlags flags = CommandFlags.None)
        {
            return Cache.HashSet(key, field, val, when, flags);
        }

        /// <summary>
        ///  Redis散列数据类型 获取指定key的指定field
        /// </summary>
        /// <param name="key"></param>
        /// <param name="field"></param>
        /// <returns></returns>
        public T HashGet<T>(string key, string field)
        {
            return Cache.HashGet<T>(key, field);
        }
        public string HashGet(string key, string field)
        {
            return Cache.HashGet(key, field);
        }

        /// <summary>
        ///  Redis散列数据类型 获取所有field所有值,以 HashEntry[]形式返回
        /// </summary>
        /// <param name="key"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        public HashEntry[] HashGetAll(string key, CommandFlags flags = CommandFlags.None)
        {
            return Cache.HashGetAll(key, flags);
        }

        /// <summary>
        /// Redis散列数据类型 获取key中所有field的值。
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="key"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        //public List<T> HashGetAllValues<T>(string key, CommandFlags flags = CommandFlags.None);

        /// <summary>
        /// Redis散列数据类型 获取所有Key名称
        /// </summary>
        /// <param name="key"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        //public string[] HashGetAllKeys(string key, CommandFlags flags = CommandFlags.None);

        /// <summary>
        ///  Redis散列数据类型  单个删除field
        /// </summary>
        /// <param name="key"></param>
        /// <param name="hashField"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        public bool HashDelete(string key, string hashField, CommandFlags flags = CommandFlags.None)
        {
            return Cache.HashDelete(key, hashField, flags);
        }

        /// <summary>
        ///  Redis散列数据类型  批量删除field
        /// </summary>
        /// <param name="key"></param>
        /// <param name="hashFields"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        //public long HashDelete(string key, string[] hashFields, CommandFlags flags = CommandFlags.None);

        /// <summary>
        ///  Redis散列数据类型 判断指定键中是否存在此field
        /// </summary>
        /// <param name="key"></param>
        /// <param name="field"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        //public bool HashExists(string key, string field, CommandFlags flags = CommandFlags.None);

        /// <summary>
        /// Redis散列数据类型  获取指定key中field数量
        /// </summary>
        /// <param name="key"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        //public long HashLength(string key, CommandFlags flags = CommandFlags.None);

        /// <summary>
        /// Redis散列数据类型  为key中指定field增加incrVal值
        /// </summary>
        /// <param name="key"></param>
        /// <param name="field"></param>
        /// <param name="incrVal"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        //public double HashIncrement(string key, string field, double incrVal, CommandFlags flags = CommandFlags.None);


        #endregion
    }
}

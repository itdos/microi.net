#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) 道斯软件
* CLR 版本: 4.0.30319.17929
* 创 建 人：IT大师
* 电子邮箱：admin@iTdos.com
* 创建日期：2015/09/10 14:08:52
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
//using System.Web.Caching;
using Dos.Common;
using Newtonsoft.Json;
using StackExchange.Redis;

namespace Dos.ORM.NoSql
{
    /// <summary>
    /// IIS缓存。无需任何配置。
    /// </summary>
    public class IIS : ICache
    {
        public IDatabase GetIDatabase()
        {
            throw new Exception("IIS暂不支持Async");
        }
        public bool Remove(string key)
        {
             CacheHelper.Remove(key);
            return true;
        }
        //public bool Set<T>(string key, T value)
        //{
        //    CacheHelper.Set(key, JsonConvert.SerializeObject(value));
        //    return true;
        //}
        //public bool Set(string key, string value)
        //{
        //    CacheHelper.Set(key,  value);
        //    return true;
        //}

        public bool Set(string key, string value, TimeSpan? expiresIn = null, When when = When.Always)
        {
            if (expiresIn == null)
            {
                CacheHelper.Set(key, value);
            }
            else
            {
                CacheHelper.Set(key, value, expiresIn.Value.Seconds);
            }
            return true;
        }

        public bool Set<T>(string key, T value, TimeSpan? expiresIn = null, When when = When.Always)
        {
            if (expiresIn == null)
            {
                CacheHelper.Set(key, JsonConvert.SerializeObject(value));
            }
            else
            {
                CacheHelper.Set(key, JsonConvert.SerializeObject(value),expiresIn.Value.Seconds);
            }

            return true;
        }
        public T Get<T>(string key)
        {
            var result = CacheHelper.Get(key);
            if (result != null)
            {
                return JsonConvert.DeserializeObject<T>(CacheHelper.Get(key).ToString());
            }
            return default(T);
        }
        public string Get(string key)
        {
            var result = CacheHelper.Get(key);
            if (result != null)
            {
                return result.ToString();
            }
            return null;
        }

        #region async异步。解决core redis timeout
        public async Task<bool> RemoveAsync(string key)
        {
            throw new Exception("IIS暂不支持Async");

        }
        public async Task<long> RemoveParentAsync(string parentKey)
        {
            throw new Exception("IIS暂不支持Async");

        }
        //public async Task<bool> SetAsync<T>(string key, T value)
        //{
        //    throw new Exception("IIS暂不支持Async");

        //}
        //public async Task<bool> SetAsync(string key, string value)
        //{
        //    throw new Exception("IIS暂不支持Async");

        //}

        public async Task<bool> SetAsync(string key, string value, TimeSpan? expiresIn = null, When when = When.Always)
        {
            throw new Exception("IIS暂不支持Async");
        }

        public async Task<bool> SetAsync<T>(string key, T value, TimeSpan? expiresIn = null, When when = When.Always)
        {
            throw new Exception("IIS暂不支持Async");

        }
        public async Task<T> GetAsync<T>(string key)
        {
            throw new Exception("IIS暂不支持Async");
        }
        public async Task<string> GetAsync(string key)
        {
            throw new Exception("IIS暂不支持Async");
        }
        #endregion



        #region Redis Hash散列数据类型操作
        /// <summary>
        /// Redis散列数据类型  批量新增
        /// </summary>
        public void HashSet(string key, List<HashEntry> hashEntrys, CommandFlags flags = CommandFlags.None)
        {
           throw new Exception("IIS暂不支持HashGet");
        }
        /// <summary>
        /// Redis散列数据类型  新增一个
        /// </summary>
        /// <param name="key"></param>
        /// <param name="field"></param>
        /// <param name="val"></param>
        public bool HashSet<T>(string key, string field, T val, When when = When.Always, CommandFlags flags = CommandFlags.None)
        {
           throw new Exception("IIS暂不支持HashGet");
        }
        public bool HashSet(string key, string field, string val, When when = When.Always, CommandFlags flags = CommandFlags.None)
        {
            throw new Exception("IIS暂不支持HashGet");
        }
        /// <summary>
        ///  Redis散列数据类型 获取指定key的指定field
        /// </summary>
        /// <param name="key"></param>
        /// <param name="field"></param>
        /// <returns></returns>
        public T HashGet<T>(string key, string field)
        {

           throw new Exception("IIS暂不支持HashGet");
        }
        public string HashGet(string key, string field)
        {
            throw new Exception("IIS暂不支持HashGet");
        }
        /// <summary>
        ///  Redis散列数据类型 获取所有field所有值,以 HashEntry[]形式返回
        /// </summary>
        /// <param name="key"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        public HashEntry[] HashGetAll(string key, CommandFlags flags = CommandFlags.None)
        {
           throw new Exception("IIS暂不支持HashGet");
        }
        /// <summary>
        /// Redis散列数据类型 获取key中所有field的值。
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="key"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        public List<T> HashGetAllValues<T>(string key, CommandFlags flags = CommandFlags.None)
        {
           throw new Exception("IIS暂不支持HashGet");
        }

        /// <summary>
        /// Redis散列数据类型 获取所有Key名称
        /// </summary>
        /// <param name="key"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        public string[] HashGetAllKeys(string key, CommandFlags flags = CommandFlags.None)
        {
           throw new Exception("IIS暂不支持HashGet");
        }
        /// <summary>
        ///  Redis散列数据类型  单个删除field
        /// </summary>
        /// <param name="key"></param>
        /// <param name="hashField"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        public bool HashDelete(string key, string hashField, CommandFlags flags = CommandFlags.None)
        {
           throw new Exception("IIS暂不支持HashGet");
        }
        /// <summary>
        ///  Redis散列数据类型  批量删除field
        /// </summary>
        /// <param name="key"></param>
        /// <param name="hashFields"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        public long HashDelete(string key, string[] hashFields, CommandFlags flags = CommandFlags.None)
        {
           throw new Exception("IIS暂不支持HashGet");
        }
        /// <summary>
        ///  Redis散列数据类型 判断指定键中是否存在此field
        /// </summary>
        /// <param name="key"></param>
        /// <param name="field"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        public bool HashExists(string key, string field, CommandFlags flags = CommandFlags.None)
        {
           throw new Exception("IIS暂不支持HashGet");
        }
        /// <summary>
        /// Redis散列数据类型  获取指定key中field数量
        /// </summary>
        /// <param name="key"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        public long HashLength(string key, CommandFlags flags = CommandFlags.None)
        {
           throw new Exception("IIS暂不支持HashGet");
        }
        /// <summary>
        /// Redis散列数据类型  为key中指定field增加incrVal值
        /// </summary>
        /// <param name="key"></param>
        /// <param name="field"></param>
        /// <param name="incrVal"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        public double HashIncrement(string key, string field, double incrVal, CommandFlags flags = CommandFlags.None)
        {
           throw new Exception("IIS暂不支持HashGet");
        }
        #endregion
    }
}

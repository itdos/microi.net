#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：Biz_CarsInfoLogic
* Copyright(c) 道斯软件
* CLR 版本: 4.0.30319.17929
* 创 建 人：IT大师
* 电子邮箱：admin@iTdos.com
* 创建日期：2014/10/1 11:00:49
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using StackExchange.Redis;

namespace Dos.ORM.NoSql
{
    /// <summary>
    /// Redis缓存。需要在AppSetting中配置：RedisHost、RedisPort
    /// </summary>
    public class Redis : ICache
    {

        //static Redis()
        //{
        //    Newtonsoft.Json.JsonSerializerSettings setting = new Newtonsoft.Json.JsonSerializerSettings();
        //    JsonConvert.DefaultSettings = new Func<JsonSerializerSettings>(() =>
        //    {
        //        //日期类型默认格式化处理
        //        setting.DateFormatHandling = Newtonsoft.Json.DateFormatHandling.MicrosoftDateFormat;
        //        setting.DateFormatString = "yyyy-MM-dd HH:mm:ss";

        //        //空值处理
        //        //setting.NullValueHandling = NullValueHandling.Ignore;

        //        //高级用法九中的Bool类型转换 设置
        //        //setting.Converters.Add(new BoolConvert("是,否"));

        //        //if (setting.Converters.FirstOrDefault(p => p.GetType() == typeof(JsonCustomDoubleConvert)) == null)
        //        //{
        //        //    setting.Converters.Add(new JsonCustomDoubleConvert(3));
        //        //}

        //        if (setting.Converters.FirstOrDefault(p => p.GetType() == typeof(DateTime)) == null)
        //        {
        //            //setting.Converters.Add(new JsonCustomDoubleConvert(3));
        //        }

        //        return setting;
        //    });
        //}

        private static readonly object obj = new Object();
        private static RedisConfig _conf;
        /// <summary>
        /// 
        /// </summary>
        public static RedisConfig Conf
        {
            get
            {
                if (_conf == null)
                {
                    var config = new RedisConfig()
                    {
                        Hosts = ConfigHelper.GetAppSettings("RedisHost")
                                + ":" +
                                ConfigHelper.GetAppSettings("RedisPort"),
                        Password = ConfigHelper.GetAppSettings("RedisPwd")
                    };
                    var db = ConfigHelper.GetAppSettings("RedisDataBase");
                    if (db != null && !db.ToString().DosIsNullOrWhiteSpace())
                    {
                        config.DataBase = Convert.ToInt32(db);
                    }
                    return config;
                }
                return _conf;
            }
            set { _conf = value; }
        }
        /// <summary>
        /// 
        /// </summary>
        public Redis()
        {

        }

        /// <summary>
        /// 
        /// </summary>
        public Redis(string host, string port, string pwd, int dataBase)
        {
            Conf = new RedisConfig()
            {
                Hosts = host
                + ":" +
                port,
                Password = pwd,
                DataBase = dataBase
            };
        }

        public ConnectionMultiplexer conn
        {
            get
            {
                return GetMultiplexer(Conf);
            }
        }
        //修改为单例对象 -- 2018-07-22
        //static ConcurrentDictionary<string, ConnectionMultiplexer> _multiplexers = new ConcurrentDictionary<string, ConnectionMultiplexer>();
        static ConnectionMultiplexer _multiplexers = null;

        /// <summary>
        /// 获取client
        /// </summary>
        /// <returns></returns>
        private static ConnectionMultiplexer GetMultiplexer(RedisConfig config)
        {
            lock (obj)
            {
                try
                {
                    if (_multiplexers == null || !_multiplexers.IsConnected)
                    {

                        var redisconf = ConfigurationOptions.Parse(config.Hosts);
                        redisconf.AllowAdmin = true;
                        if (!string.IsNullOrWhiteSpace(config.Password))
                        {
                            redisconf.Password = config.Password;
                        }

                        redisconf.AbortOnConnectFail = false;
                        redisconf.ConnectTimeout = 5000;
                        redisconf.SyncTimeout = 5000;
                        _multiplexers = ConnectionMultiplexer.Connect(redisconf);
                    }
                    return _multiplexers;
                }
                catch (Exception e)
                {
                    LogHelper.Error(e.Message, "Dos.ORM.NoSql GetMultiplexer_");
                    LogHelper.Error(e.StackTrace, "Dos.ORM.NoSql GetMultiplexer_");
                    throw;
                }
            }
        }
        public IDatabase GetIDatabase()
        {
            return Cache;
        }
        ///// <summary>
        ///// 获取client
        ///// </summary>
        ///// <returns></returns>
        //private static ConnectionMultiplexer GetMultiplexer(RedisConfig config)
        //{
        //    ConnectionMultiplexer multiplexer = null;
        //    if (!_multiplexers.TryGetValue(config.Hosts, out multiplexer))
        //    {
        //        var redisconf = ConfigurationOptions.Parse(config.Hosts);
        //        redisconf.AllowAdmin = true;
        //        redisconf.ConnectRetry = 2;
        //        if (!string.IsNullOrWhiteSpace(config.Pwd))
        //        {
        //            redisconf.Password = config.Pwd;
        //        }
        //        multiplexer = ConnectionMultiplexer.Connect(redisconf);
        //        _multiplexers.TryAdd(config.Hosts, multiplexer);
        //    }

        //    if (!multiplexer.IsConnected)
        //    {
        //        var redisconf = ConfigurationOptions.Parse(config.Hosts);
        //        redisconf.AllowAdmin = true;
        //        redisconf.ConnectRetry = 2;
        //        if (!string.IsNullOrWhiteSpace(config.Pwd))
        //        {
        //            redisconf.Password = config.Pwd;
        //        }
        //        multiplexer = ConnectionMultiplexer.Connect(redisconf);
        //        _multiplexers.TryAdd(config.Hosts, multiplexer);
        //    }
        //    return multiplexer;
        //}
        /// <summary>
        /// redis连接端
        /// </summary>

        public IDatabase Cache
        {
            get
            {
                try
                {
                    return conn.GetDatabase(Conf.DataBase);
                }
                catch (Exception e)
                {
                    LogHelper.Error(e.Message, "Dos.ORM.NoSql Cache get_");
                    LogHelper.Error(e.StackTrace, "Dos.ORM.NoSql Cache get_");
                    throw;
                }
            }
        }
        public IServer CacheServer
        {
            get
            {
                try
                {
                    return conn.GetServer(Conf.Hosts);
                }
                catch (Exception e)
                {
                    LogHelper.Error(e.Message, "Dos.ORM.NoSql Cache get_");
                    LogHelper.Error(e.StackTrace, "Dos.ORM.NoSql Cache get_");
                    throw;
                }
            }
        }

        #region 同步
        private static RedisKey[] SearchRedisKeys(IServer server, string pattern)
        {
            var keys = server.Keys(Conf.DataBase, pattern: pattern).ToArray();
            return keys;
        }

        public bool Remove(string key)
        {
            return Cache.KeyDelete(key);
        }
        public bool Set<T>(string key, T value)
        {
            return Cache.StringSet(key, JsonConvert.SerializeObject(value));
        }
        public bool Set(string key, string value)
        {
            return Cache.StringSet(key, value);
        }
        public bool Set(string key, string value, TimeSpan? expiresIn = null, When when = When.Always)
        {
            return Cache.StringSet(key, value, expiresIn, when);
        }

        public bool Set<T>(string key, T value, TimeSpan? expiresIn, When when = When.Always)
        {
            return Cache.StringSet(key, JsonConvert.SerializeObject(value), expiresIn, when);
        }
        /// <summary>
        /// 注意：获取string数据，请勿传入.Get<string>("key");，直接使用.Get("key")
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="key"></param>
        /// <returns></returns>
        public T Get<T>(string key)
        {


            var result = Cache.StringGet(key);
            if (result != RedisValue.Null)
            {
                //if (typeof(T).Name == "String")
                //{
                //    return (T)result.ToString();
                //}
                return JsonConvert.DeserializeObject<T>(result);
            }
            return default(T);
        }
        public string Get(string key)
        {
            var result = Cache.StringGet(key);
            if (result != RedisValue.Null)
            {
                return result.ToString();
            }
            return null;
        }
        #endregion

        #region async异步。解决core redis timeout

        //public async RedisKey[] SearchRedisKeysAsync(IServer server, string pattern)
        //{
        //    var keys = server.KeysAsync(Conf.DataBase, pattern: pattern).ConfigureAwait<RedisKey>();
        //    return keys;
        //}
        //public async Task<long> RemoveParentAsync(string parentKey)
        //{
        //    return await Cache.KeyDeleteAsync(await SearchRedisKeysAsync(CacheServer, parentKey));
        //}
        public async Task<bool> RemoveAsync(string key)
        {
            return await Cache.KeyDeleteAsync(key);
        }
        public async Task<bool> SetAsync<T>(string key, T value)
        {
            return await Cache.StringSetAsync(key, JsonConvert.SerializeObject(value));
        }
        public async Task<bool> SetAsync(string key, string value)
        {
            return await Cache.StringSetAsync(key, value);
        }
        public async Task<bool> SetAsync(string key, string value, TimeSpan? expiresIn = null, When when = When.Always)
        {
            return await Cache.StringSetAsync(key, value, expiresIn, when);
        }
        public async Task<bool> SetAsync<T>(string key, T value, TimeSpan? expiresIn = null, When when = When.Always)
        {
            return await Cache.StringSetAsync(key, JsonConvert.SerializeObject(value), expiresIn, when);
        }
        public async Task<T> GetAsync<T>(string key)
        {
            var result = await Cache.StringGetAsync(key);
            if (result != RedisValue.Null)
            {
                return JsonConvert.DeserializeObject<T>(result);
            }
            return default(T);
        }
        public async Task<string> GetAsync(string key)
        {
            var result = await Cache.StringGetAsync(key);
            if (result != RedisValue.Null)
            {
                return result.ToString();
            }
            return null;//INCRBY
        }
        
        #endregion


        #region Redis Hash散列数据类型操作
        /// <summary>
        /// Redis散列数据类型  批量新增
        /// </summary>
        public void HashSet(string key, List<HashEntry> hashEntrys, CommandFlags flags = CommandFlags.None)
        {
            Cache.HashSet(key, hashEntrys.ToArray(), flags);
        }
        /// <summary>
        /// Redis散列数据类型  新增一个
        /// </summary>
        /// <param name="key"></param>
        /// <param name="field"></param>
        /// <param name="val"></param>
        public bool HashSet<T>(string key, string field, T val, When when = When.Always, CommandFlags flags = CommandFlags.None)
        {
            return Cache.HashSet(key, field, JsonConvert.SerializeObject(val), when, flags);
        }
        public bool HashSet(string key, string field, string val, When when = When.Always, CommandFlags flags = CommandFlags.None)
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
            try
            {
                var result = Cache.HashGet(key, field);
                if (result != RedisValue.Null)
                {
                    return JsonConvert.DeserializeObject<T>(result);
                }
                return default(T);
            }
            catch (Exception e)
            {
                LogHelper.Error(e.Message, "Dos.ORM.NoSql HashGet_");
                LogHelper.Error(e.StackTrace, "Dos.ORM.NoSql HashGet_");
                throw;
            }

        }
        public string HashGet(string key, string field)
        {
            try
            {
                var result = Cache.HashGet(key, field);
                if (result != RedisValue.Null)
                {
                    return result.ToString();
                }
                return null;
            }
            catch (Exception e)
            {
                LogHelper.Error(e.Message, "Dos.ORM.NoSql HashGet_");
                LogHelper.Error(e.StackTrace, "Dos.ORM.NoSql HashGet_");
                throw;
            }

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
        public List<T> HashGetAllValues<T>(string key, CommandFlags flags = CommandFlags.None)
        {
            List<T> list = new List<T>();
            var hashVals = Cache.HashValues(key, flags).ToArray();
            foreach (var item in hashVals)
            {
                list.Add(JsonConvert.DeserializeObject<T>(item));
            }
            return list;
        }

        /// <summary>
        /// Redis散列数据类型 获取所有Key名称
        /// </summary>
        /// <param name="key"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        public string[] HashGetAllKeys(string key, CommandFlags flags = CommandFlags.None)
        {
            //throw new Exception("SB版本管理！");
            //return Cache.HashKeys(key, flags).ToStringArray();
            return Cache.HashKeys(key, flags).Select(d => d.ToString()).ToArray();
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
            return Cache.HashDelete(key, hashField, flags);
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
            List<RedisValue> list = new List<RedisValue>();
            for (int i = 0; i < hashFields.Length; i++)
            {
                list.Add(hashFields[i]);
            }
            return Cache.HashDelete(key, list.ToArray(), flags);
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
            return Cache.HashExists(key, field, flags);
        }
        /// <summary>
        /// Redis散列数据类型  获取指定key中field数量
        /// </summary>
        /// <param name="key"></param>
        /// <param name="flags"></param>
        /// <returns></returns>
        public long HashLength(string key, CommandFlags flags = CommandFlags.None)
        {
            return Cache.HashLength(key, flags);
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
            return Cache.HashIncrement(key, field, incrVal, flags);
        }

        public Task<long> RemoveParentAsync(string parentKey)
        {
            throw new NotImplementedException();
        }
        #endregion
    }
}

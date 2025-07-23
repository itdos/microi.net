#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) Microi.net
* CLR 版本: 
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：
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
using System.Diagnostics;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Microi.Cache;
using Newtonsoft.Json;
using StackExchange.Redis;


namespace Microi.net
{
    /// <summary>
    /// Redis访问对象集合，每个OsClient对一个对象，线程安全的MVC全局应用程序共享静态变量。
    /// </summary>
    public class MicroiCacheRedisConnectionManager
    {
        //哨兵连接类型
        private const string sentinelType = "2";
        private static readonly ConcurrentDictionary<string, Lazy<ConnectionMultiplexer>> lazyConnections = new ConcurrentDictionary<string, Lazy<ConnectionMultiplexer>>();

        public static ConnectionMultiplexer GetConnection(string instanceName)
        {
            if (!lazyConnections.ContainsKey(instanceName))
            {
                //2025-07-21优化 --by anderson
                var osClient = Environment.GetEnvironmentVariable("OsClient", EnvironmentVariableTarget.Process) ?? (ConfigHelper.GetAppSettings("OsClient") ?? "");
                return lazyConnections[osClient].Value;
                // throw new ArgumentException($"Redis instance '{instanceName}' is not configured.");
            }

            return lazyConnections[instanceName].Value;
        }

        public static void AddConnection(string instanceName, string connectionString)
        {
            Lazy<ConnectionMultiplexer> lazyConnection = new Lazy<ConnectionMultiplexer>(() =>
            {
                return ConnectionMultiplexer.Connect(connectionString);
            }, LazyThreadSafetyMode.ExecutionAndPublication);

            //2025-07-21优化 --by anderson
            if (lazyConnections.ContainsKey(instanceName))
            {
                lazyConnections[instanceName] = lazyConnection;
                // throw new ArgumentException($"Redis instance '{instanceName}' already exists.");
            }
            else
            {
                lazyConnections.TryAdd(instanceName, lazyConnection);
            }
        }

        public static void AddConnection(string instanceName, string host, string pwd, int? port = 6379, int? databaseIndex = 0)
        {
            if (lazyConnections.ContainsKey(instanceName))
            {
                return;
                // throw new ArgumentException($"Redis instance '{instanceName}' already exists.");
            }
            var connectionString = host + ":" + port
                                    + ",defaultDatabase=" + databaseIndex
                                    + ",password=" + pwd
                                    + ",abortConnect=false,ssl=false,connectTimeout=5000"
                                    ;
            Lazy<ConnectionMultiplexer> lazyConnection = new Lazy<ConnectionMultiplexer>(() =>
            {
                return ConnectionMultiplexer.Connect(connectionString);
            }, LazyThreadSafetyMode.ExecutionAndPublication);

            lazyConnections.TryAdd(instanceName, lazyConnection);
        }

        public static void AddConnection(CacheConnectionParam param)
        {
            if (lazyConnections.ContainsKey(param.InstanceName))
            {
                throw new ArgumentException($"Redis instance '{param.InstanceName}' already exists.");
            }
            if (string.IsNullOrEmpty(param.CacheConnectionType))
            {
                throw new ArgumentException($"缓存连接类型未配置");
            }
            if (param.CacheConnectionType.Equals(sentinelType))
            {
                ConfigurationOptions sentinelOptions = new ConfigurationOptions();
                var ipArr = param.SentinelHost.Split(',');
                foreach (var ip in ipArr)
                {
                    sentinelOptions.EndPoints.Add(ip);
                }
                sentinelOptions.TieBreaker = "";
                sentinelOptions.CommandMap = CommandMap.Sentinel;
                sentinelOptions.AbortOnConnectFail = false;
                ConnectionMultiplexer sentinelConnection = ConnectionMultiplexer.Connect(sentinelOptions);
                ConfigurationOptions redisServiceOptions = new ConfigurationOptions();
                redisServiceOptions.ServiceName = param.SentinelServiceName;
                redisServiceOptions.Password = param.SentinelPwd;
                redisServiceOptions.AbortOnConnectFail = true;
                redisServiceOptions.AllowAdmin = true;
                redisServiceOptions.DefaultDatabase = param.DatabaseIndex;
                Lazy<ConnectionMultiplexer> lazyConnection = new Lazy<ConnectionMultiplexer>(() =>
                {
                    return sentinelConnection.GetSentinelMasterConnection(redisServiceOptions);
                }, LazyThreadSafetyMode.ExecutionAndPublication);
                lazyConnections.TryAdd(param.InstanceName, lazyConnection);
            }
            else
            {
                var connectionString = param.Host + ":" + param.Port
                                   + ",defaultDatabase=" + param.DatabaseIndex
                                   + ",password=" + param.Pwd
                                   + ",abortConnect=false,ssl=false,connectTimeout=5000"
                                   ;
                Lazy<ConnectionMultiplexer> lazyConnection = new Lazy<ConnectionMultiplexer>(() =>
                {
                    return ConnectionMultiplexer.Connect(connectionString);
                }, LazyThreadSafetyMode.ExecutionAndPublication);

                lazyConnections.TryAdd(param.InstanceName, lazyConnection);
            }          
        }
        public static IDatabase GetDatabase(string instanceName)
        {
            ConnectionMultiplexer redisConnection = GetConnection(instanceName);
            return redisConnection.GetDatabase();
        }

        public static IServer GetServer(string instanceName, string host, int? port = 6379)
        {
            ConnectionMultiplexer redisConnection = GetConnection(instanceName);
            return redisConnection.GetServer(host + ":" + port);
        }
    }

    /// <summary>
    /// Cache Key命名规则： CacheName:OsClient:Id
    /// </summary>
    public class MicroiCacheRedis : IMicroiCache
    {
        private readonly IDatabase _redisDb;
        //private readonly IServer _redisServer;

        /// <summary>
        /// Cache Key命名规则： CacheName:OsClient:Id
        /// </summary>
        /// <param name="instanceName"></param>
        public MicroiCacheRedis(string instanceName)
        {
            _redisDb = MicroiCacheRedisConnectionManager.GetDatabase(instanceName);
            //_redisServer = MicroiCacheRedisConnectionManager.GetServer(instanceName);
        }
        public IDatabase Database
        {
            get { return _redisDb; }
        }
        public T Get<T>(string key)
        {
            var result = _redisDb.StringGet(key);
            if (result != RedisValue.Null)
            {
                return JsonConvert.DeserializeObject<T>(result);
            }
            return default(T);
        }
        public string Get(string key)
        {
            var result = _redisDb.StringGet(key);
            if (result != RedisValue.Null)
            {
                return result.ToString();
            }
            return null;
        }
        public bool Remove(string key)
        {
            return _redisDb.KeyDelete(key);
        }
        public bool Delete(string key)
        {
            return _redisDb.KeyDelete(key);
        }

        public bool Set<T>(string key, T value)
        {
            return _redisDb.StringSet(key, JsonConvert.SerializeObject(value));
        }
        public bool Set(string key, string value, TimeSpan? expiresIn = null)
        {
            return _redisDb.StringSet(key, value, expiresIn);
        }
        public bool Set<T>(string key, T value, TimeSpan? expiresIn = null)
        {
            return _redisDb.StringSet(key, JsonConvert.SerializeObject(value), expiresIn);
        }

        public bool KeyExist(string key)
        {
            return _redisDb.KeyExists(key);
        }

        #region 异步
        public async Task<T> GetAsync<T>(string key)
        {
            var result = await _redisDb.StringGetAsync(key);
            if (result != RedisValue.Null)
            {
                return JsonConvert.DeserializeObject<T>(result);
            }
            return default(T);
        }
        public async Task<string> GetAsync(string key)
        {
            var result = await _redisDb.StringGetAsync(key);
            if (result != RedisValue.Null)
            {
                return result.ToString();
            }
            return null;//INCRBY
        }
        public async Task<bool> RemoveAsync(string key)
        {
            var result = await _redisDb.KeyDeleteAsync(key);
            return result;
        }
        public async Task<bool> DeleteAsync(string key)
        {
            return await _redisDb.KeyDeleteAsync(key);
        }


        //public async RedisKey[] SearchRedisKeysAsync(IServer server, string pattern)
        //{
        //    throw new Exception();
        //    //var keys = server.KeysAsync(Conf.DataBase, pattern: pattern).ConfigureAwait<RedisKey>();
        //    //return keys;
        //}
        public async Task<long> RemoveParentAsync(string parentKey)
        {
            throw new Exception();
            //return await _redisDb.KeyDeleteAsync(await SearchRedisKeysAsync(CacheServer, parentKey));
        }

        public async Task<bool> SetAsync<T>(string key, T value)
        {
            return await _redisDb.StringSetAsync(key, JsonConvert.SerializeObject(value));
        }
        public async Task<bool> SetAsync(string key, string value)
        {
            return await _redisDb.StringSetAsync(key, value);
        }
        public async Task<bool> SetAsync(string key, string value, TimeSpan? expiresIn = null)
        {
            return await _redisDb.StringSetAsync(key, value, expiresIn);
        }
        public async Task<bool> SetAsync<T>(string key, T value, TimeSpan? expiresIn = null)
        {
            return await _redisDb.StringSetAsync(key, JsonConvert.SerializeObject(value), expiresIn);
        }
        #endregion

        public bool HashSet<T>(string key, string field, T val, When when = When.Always,
            CommandFlags flags = CommandFlags.None)
        {
            return _redisDb.HashSet(key, field, JsonConvert.SerializeObject(val), when, flags);
        }
        public bool HashSet(string key, string field, string val, When when = When.Always,
           CommandFlags flags = CommandFlags.None)
        {
            return _redisDb.HashSet(key, field, val, when, flags);
        }
        public T HashGet<T>(string key, string field)
        {
            var result = _redisDb.HashGet(key, field);
            if (result != RedisValue.Null)
            {
                return JsonConvert.DeserializeObject<T>(result);
            }
            return default(T);
        }
        public string HashGet(string key, string field)
        {
            var result = _redisDb.HashGet(key, field);
            if (result != RedisValue.Null)
            {
                return result.ToString();
            }
            return null;
        }

        public bool HashDelete(string key, string hashField,CommandFlags flags = CommandFlags.None)
        {
            return _redisDb.HashDelete(key, hashField, flags);
        }
        public long HashDelete(string key, string[] hashFields, CommandFlags flags = CommandFlags.None)
        {
            List<RedisValue> list = new List<RedisValue>();
            for (int i = 0; i < hashFields.Length; i++)
            {
                list.Add(hashFields[i]);
            }
            return _redisDb.HashDelete(key, list.ToArray(), flags);
        }


        public IDatabase GetIDatabase()
        {
            return _redisDb;
        }

        public void HashSet(string key, List<HashEntry> hashEntrys, CommandFlags flags = CommandFlags.None)
        {
            _redisDb.HashSet(key, hashEntrys.ToArray(), flags);
        }

        public HashEntry[] HashGetAll(string key, CommandFlags flags = CommandFlags.None)
        {
            return _redisDb.HashGetAll(key, flags);
        }

        public List<T> HashGetAllValues<T>(string key, CommandFlags flags = CommandFlags.None)
        {
            List<T> list = new List<T>();
            var hashVals = _redisDb.HashValues(key, flags).ToArray();
            foreach (var item in hashVals)
            {
                list.Add(JsonConvert.DeserializeObject<T>(item));
            }
            return list;
        }

        public string[] HashGetAllKeys(string key, CommandFlags flags = CommandFlags.None)
        {
            return _redisDb.HashKeys(key, flags).Select(d => d.ToString()).ToArray();

        }

        public bool HashExists(string key, string field, CommandFlags flags = CommandFlags.None)
        {
            return _redisDb.HashExists(key, field, flags);
        }

        public long HashLength(string key, CommandFlags flags = CommandFlags.None)
        {
            return _redisDb.HashLength(key, flags);
        }

        public double HashIncrement(string key, string field, double incrVal, CommandFlags flags = CommandFlags.None)
        {
            return _redisDb.HashIncrement(key, field, incrVal, flags);
        }
    }
}

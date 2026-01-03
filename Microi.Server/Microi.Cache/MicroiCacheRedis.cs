#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：MicroiCacheRedis.cs
* Copyright(c) Microi.net
* CLR 版本: 
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：
* 文件描述：Redis缓存操作类
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
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Microi.Cache;
using Newtonsoft.Json;
using StackExchange.Redis;

namespace Microi.net
{
    public class MicroiCacheTenant : IMicroiCacheTenant
    {
        private static readonly ConcurrentDictionary<string, IMicroiCache> _caches = new ConcurrentDictionary<string, IMicroiCache>();
        private readonly IServiceProvider _serviceProvider;
        
        // public IMicroiCache DefaultCache => Cache("default");
        
        public MicroiCacheTenant(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
        }
        public IMicroiCache Default()
        {
            string osClient = OsClient.GetConfigOsClient();
            return _caches.GetOrAdd(osClient, client => new MicroiCacheRedis(client));
        }
        
        public IMicroiCache Cache(string osClient)
        {
            return _caches.GetOrAdd(osClient, client => new MicroiCacheRedis(client));
            // if (!_caches.TryGetValue(osClient, out var cache))
            // {
            //     cache = new MicroiCacheRedis(osClient);
            //     _caches[osClient] = cache; // 这里可能有线程安全问题
            // }
            // return cache;
        }
    }
    /// <summary>
    /// Redis缓存操作类
    /// Cache Key命名规则：CacheName:OsClient:Id
    /// </summary>
    public class MicroiCacheRedis : IMicroiCache
    {
        /// <summary>
        /// Redis数据库操作对象
        /// </summary>
        public IDatabase Database => _redisDb;
        private readonly IDatabase _redisDb = default;
        private const string SENTINEL_TYPE = "2";
        /// <summary>
        /// 线程安全的连接字典，使用Lazy保证连接创建的线程安全
        /// </summary>
        private static readonly ConcurrentDictionary<string, Lazy<ConnectionMultiplexer>> _lazyConnections 
            = new ConcurrentDictionary<string, Lazy<ConnectionMultiplexer>>();
        /// <summary>
        /// 构造函数
        /// </summary>
        public MicroiCacheRedis(string osClient)
        {
            if (!_lazyConnections.ContainsKey(osClient))
            {
                var clientModel = OsClient.GetClient(osClient);
                if (clientModel != null 
                    && !string.IsNullOrEmpty(clientModel.RedisHost))
                {
                    // 确保连接已添加
                    AddConnection(osClient, clientModel.RedisHost, 
                                            clientModel.RedisPwd, 
                                            int.Parse(clientModel.RedisPort), 
                                            int.Parse(clientModel.RedisDataBase));
                }
            }
            _redisDb = GetDatabase(osClient);
        }
        public MicroiCacheRedis()
        {
            var osClient = OsClient.GetConfigOsClient();
            if (!_lazyConnections.ContainsKey(osClient))
            {
                var clientModel = OsClient.GetClient(osClient);
                if (clientModel != null 
                    && !string.IsNullOrEmpty(clientModel.RedisHost))
                {
                    // 确保连接已添加
                    AddConnection(osClient, clientModel.RedisHost, 
                                            clientModel.RedisPwd, 
                                            int.Parse(clientModel.RedisPort), 
                                            int.Parse(clientModel.RedisDataBase));
                }
            }
            _redisDb = GetDatabase(osClient);
            // _redisDb = GetDatabase(OsClient.GetConfigOsClient());
        }

        public IDatabase Db(string osClient)
        {
            return GetDatabase(osClient);
        }

        /// <summary>
        /// 获取Redis连接
        /// </summary>
        /// <returns>Redis连接对象</returns>
        public static ConnectionMultiplexer GetConnection(string osClient)
        {
            // if (_lazyConnections.TryGetValue(osClient, out var lazyConnection))
            // {
            //     return lazyConnection.Value;
            // }
            // return _lazyConnections.GetOrAdd(osClient, 
            //     key => CreateLazyConnection(() => 
            //     {
            //         // 从配置创建连接
            //         var connectionString = BuildConnectionString(host, pwd, port, databaseIndex);
            //         // var connectionString = GetConnectionStringFromConfig(key);
            //         return ConnectionMultiplexer.Connect(connectionString);
            //     })).Value;

            // 优先使用指定实例名
            if (_lazyConnections.TryGetValue(osClient, out var lazyConnection))
            {
                return lazyConnection.Value;
            }
            // // 回退到OsClient配置的实例
            // var defaultOsClient = GetOsClient();
            // if (_lazyConnections.TryGetValue(defaultOsClient, out lazyConnection))
            // {
            //     return lazyConnection.Value;
            // }
            throw new ArgumentException($"Redis实例 '{osClient}'未配置。");
            // throw new ArgumentException($"Redis实例 '{osClient}' 和回退实例 '{defaultOsClient}' 均未配置。");
        }

        /// <summary>
        /// 添加Redis连接（连接字符串方式）
        /// </summary>
        public void AddConnection(string instanceName, string connectionString)
        {
            var lazyConnection = CreateLazyConnection(() => ConnectionMultiplexer.Connect(connectionString));
            _lazyConnections.AddOrUpdate(instanceName, lazyConnection, (key, oldValue) => lazyConnection);
        }

        /// <summary>
        /// 添加Redis连接（参数方式）
        /// </summary>
        public void AddConnection(string instanceName, string host, string pwd, 
            int? port = 6379, int? databaseIndex = 0)
        {
            if (_lazyConnections.ContainsKey(instanceName))
                return;

            var connectionString = BuildConnectionString(host, pwd, port, databaseIndex);
            var lazyConnection = CreateLazyConnection(() => ConnectionMultiplexer.Connect(connectionString));
            
            _lazyConnections.TryAdd(instanceName, lazyConnection);
        }

        /// <summary>
        /// 添加Redis连接（配置参数方式）
        /// </summary>
        public static void AddConnection(CacheConnectionParam param)
        {
            if (string.IsNullOrEmpty(param.CacheConnectionType))
                throw new ArgumentException("缓存连接类型未配置");

            if (_lazyConnections.ContainsKey(param.InstanceName))
                throw new ArgumentException($"Redis实例 '{param.InstanceName}' 已存在。");

            var lazyConnection = param.CacheConnectionType.Equals(SENTINEL_TYPE) 
                ? CreateSentinelConnection(param) 
                : CreateNormalConnection(param);

            _lazyConnections.TryAdd(param.InstanceName, lazyConnection);
        }

        /// <summary>
        /// 获取Redis数据库操作对象
        /// </summary>
        public static IDatabase GetDatabase(string instanceName)
        {
            return GetConnection(instanceName).GetDatabase();
        }

        /// <summary>
        /// 获取Redis服务器操作对象
        /// </summary>
        public static IServer GetServer(string instanceName, string host, int? port = 6379)
        {
            return GetConnection(instanceName).GetServer($"{host}:{port}");
        }

        #region 私有方法

        /// <summary>
        /// 获取OsClient配置
        /// </summary>
        private static string GetOsClient()
        {
            return Environment.GetEnvironmentVariable("OsClient", EnvironmentVariableTarget.Process) 
                ?? (ConfigHelper.GetAppSettings("OsClient") ?? "");
        }

        /// <summary>
        /// 创建延迟连接对象
        /// </summary>
        private static Lazy<ConnectionMultiplexer> CreateLazyConnection(Func<ConnectionMultiplexer> connectionFactory)
        {
            return new Lazy<ConnectionMultiplexer>(connectionFactory, LazyThreadSafetyMode.ExecutionAndPublication);
        }

        /// <summary>
        /// 构建连接字符串
        /// </summary>
        private static string BuildConnectionString(string host, string pwd, int? port, int? databaseIndex)
        {
            return $"{host}:{port},defaultDatabase={databaseIndex},password={pwd},abortConnect=false,ssl=false,connectTimeout=5000,syncTimeout=5000,asyncTimeout=5000";
        }

        /// <summary>
        /// 创建哨兵模式连接
        /// </summary>
        private static Lazy<ConnectionMultiplexer> CreateSentinelConnection(CacheConnectionParam param)
        {
            return CreateLazyConnection(() =>
            {
                // 配置哨兵连接
                var sentinelOptions = new ConfigurationOptions
                {
                    TieBreaker = "",
                    CommandMap = CommandMap.Sentinel,
                    AbortOnConnectFail = false
                };

                // 添加哨兵节点
                var ipArr = param.SentinelHost.Split(',');
                foreach (var ip in ipArr)
                {
                    sentinelOptions.EndPoints.Add(ip);
                }

                var sentinelConnection = ConnectionMultiplexer.Connect(sentinelOptions);

                // 配置Redis服务选项
                var redisServiceOptions = new ConfigurationOptions
                {
                    ServiceName = param.SentinelServiceName,
                    Password = param.SentinelPwd,
                    AbortOnConnectFail = true,
                    AllowAdmin = true,
                    DefaultDatabase = param.DatabaseIndex
                };

                return sentinelConnection.GetSentinelMasterConnection(redisServiceOptions);
            });
        }

        /// <summary>
        /// 创建普通模式连接
        /// </summary>
        private static Lazy<ConnectionMultiplexer> CreateNormalConnection(CacheConnectionParam param)
        {
            var connectionString = BuildConnectionString(param.Host, param.Pwd, param.Port, param.DatabaseIndex);
            return CreateLazyConnection(() => ConnectionMultiplexer.Connect(connectionString));
        }

        #endregion

       

        #region 字符串操作 - 同步方法

        /// <summary>
        /// 获取对象
        /// </summary>
        public T Get<T>(string key)
        {
            var result = _redisDb.StringGet(key);
            return result == RedisValue.Null ? default : Deserialize<T>(result);
        }

        /// <summary>
        /// 获取字符串
        /// </summary>
        public string Get(string key)
        {
            var result = _redisDb.StringGet(key);
            return result == RedisValue.Null ? null : result.ToString();
        }

        /// <summary>
        /// 设置对象（无过期时间）
        /// </summary>
        public bool Set<T>(string key, T value)
        {
            return _redisDb.StringSet(key, Serialize(value));
        }

        /// <summary>
        /// 设置字符串
        /// </summary>
        public bool Set(string key, string value, TimeSpan? expiresIn = null)
        {
            if(expiresIn == null)
            {
                return _redisDb.StringSet(key, value);
            }
            return _redisDb.StringSet(key, value, expiresIn.Value);
        }

        /// <summary>
        /// 设置对象（带过期时间）
        /// </summary>
        public bool Set<T>(string key, T value, TimeSpan? expiresIn = null)
        {
            if(expiresIn == null)
            {
                return _redisDb.StringSet(key, Serialize(value));
            }
            return _redisDb.StringSet(key, Serialize(value), expiresIn.Value);
        }

        /// <summary>
        /// 删除键
        /// </summary>
        public bool Remove(string key)
        {
            return _redisDb.KeyDelete(key);
        }

        /// <summary>
        /// 删除键（别名）
        /// </summary>
        public bool Delete(string key)
        {
            return _redisDb.KeyDelete(key);
        }

        /// <summary>
        /// 检查键是否存在
        /// </summary>
        public bool KeyExist(string key)
        {
            return _redisDb.KeyExists(key);
        }

        #endregion

        #region 字符串操作 - 异步方法

        /// <summary>
        /// 异步获取对象
        /// </summary>
        public async Task<T> GetAsync<T>(string key)
        {
            var result = await _redisDb.StringGetAsync(key).ConfigureAwait(false);
            return result == RedisValue.Null ? default : Deserialize<T>(result);
        }

        /// <summary>
        /// 异步获取字符串
        /// </summary>
        public async Task<string> GetAsync(string key)
        {
            var result = await _redisDb.StringGetAsync(key).ConfigureAwait(false);
            return result == RedisValue.Null ? null : result.ToString();
        }

        /// <summary>
        /// 异步设置对象
        /// </summary>
        public async Task<bool> SetAsync<T>(string key, T value)
        {
            return await _redisDb.StringSetAsync(key, Serialize(value)).ConfigureAwait(false);
        }

        /// <summary>
        /// 异步设置字符串
        /// </summary>
        public async Task<bool> SetAsync(string key, string value)
        {
            return await _redisDb.StringSetAsync(key, value).ConfigureAwait(false);
        }

        /// <summary>
        /// 异步设置字符串（带过期时间）
        /// </summary>
        public async Task<bool> SetAsync(string key, string value, TimeSpan? expiresIn = null, When when = When.Always)
        {
            if(expiresIn == null)
            {
                return await _redisDb.StringSetAsync(key, value, null, when).ConfigureAwait(false);
            }
            return await _redisDb.StringSetAsync(key, value, expiresIn.Value, when).ConfigureAwait(false);
        }

        /// <summary>
        /// 异步设置对象（带过期时间）
        /// </summary>
        public async Task<bool> SetAsync<T>(string key, T value, TimeSpan? expiresIn = null, When when = When.Always)
        {
            if(expiresIn == null)
            {
                return await _redisDb.StringSetAsync(key, Serialize(value), null, when).ConfigureAwait(false);
            }
            return await _redisDb.StringSetAsync(key, Serialize(value), expiresIn.Value, when).ConfigureAwait(false);
        }

        /// <summary>
        /// 异步删除键
        /// </summary>
        public async Task<bool> RemoveAsync(string key)
        {
            return await _redisDb.KeyDeleteAsync(key).ConfigureAwait(false);
        }

        /// <summary>
        /// 异步删除键（别名）
        /// </summary>
        public async Task<bool> DeleteAsync(string key)
        {
            return await _redisDb.KeyDeleteAsync(key).ConfigureAwait(false);
        }

        /// <summary>
        /// 异步删除父键（暂未实现）
        /// </summary>
        public Task<long> RemoveParentAsync(string parentKey)
        {
            throw new NotImplementedException("RemoveParentAsync方法暂未实现");
        }

        #endregion

        #region 哈希操作

        /// <summary>
        /// 设置哈希字段对象
        /// </summary>
        public bool HashSet<T>(string key, string field, T val, When when = When.Always, 
            CommandFlags flags = CommandFlags.None)
        {
            return _redisDb.HashSet(key, field, Serialize(val), when, flags);
        }

        /// <summary>
        /// 设置哈希字段字符串
        /// </summary>
        public bool HashSet(string key, string field, string val, When when = When.Always, 
            CommandFlags flags = CommandFlags.None)
        {
            return _redisDb.HashSet(key, field, val, when, flags);
        }

        /// <summary>
        /// 获取哈希字段对象
        /// </summary>
        public T HashGet<T>(string key, string field)
        {
            var result = _redisDb.HashGet(key, field);
            return result == RedisValue.Null ? default : Deserialize<T>(result);
        }

        /// <summary>
        /// 获取哈希字段字符串
        /// </summary>
        public string HashGet(string key, string field)
        {
            var result = _redisDb.HashGet(key, field);
            return result == RedisValue.Null ? null : result.ToString();
        }

        /// <summary>
        /// 删除单个哈希字段
        /// </summary>
        public bool HashDelete(string key, string hashField, CommandFlags flags = CommandFlags.None)
        {
            return _redisDb.HashDelete(key, hashField, flags);
        }

        /// <summary>
        /// 批量删除哈希字段
        /// </summary>
        public long HashDelete(string key, string[] hashFields, CommandFlags flags = CommandFlags.None)
        {
            List<RedisValue> list = new List<RedisValue>();
            for (int i = 0; i < hashFields.Length; i++)
            {
                list.Add(hashFields[i]);
            }
            return _redisDb.HashDelete(key, list.ToArray(), flags);
        }

        /// <summary>
        /// 批量设置哈希字段
        /// </summary>
        public void HashSet(string key, List<HashEntry> hashEntrys, CommandFlags flags = CommandFlags.None)
        {
            _redisDb.HashSet(key, hashEntrys.ToArray(), flags);
        }

        /// <summary>
        /// 获取所有哈希字段和值
        /// </summary>
        public HashEntry[] HashGetAll(string key, CommandFlags flags = CommandFlags.None)
        {
            return _redisDb.HashGetAll(key, flags);
        }

        /// <summary>
        /// 获取所有哈希字段的值（反序列化为对象）
        /// </summary>
        public List<T> HashGetAllValues<T>(string key, CommandFlags flags = CommandFlags.None)
        {
            var hashVals = _redisDb.HashValues(key, flags);
            return hashVals.Select(item => Deserialize<T>(item)).ToList();
        }

        /// <summary>
        /// 获取所有哈希字段的键
        /// </summary>
        public string[] HashGetAllKeys(string key, CommandFlags flags = CommandFlags.None)
        {
            return _redisDb.HashKeys(key, flags).Select(d => d.ToString()).ToArray();
        }

        /// <summary>
        /// 检查哈希字段是否存在
        /// </summary>
        public bool HashExists(string key, string field, CommandFlags flags = CommandFlags.None)
        {
            return _redisDb.HashExists(key, field, flags);
        }

        /// <summary>
        /// 获取哈希字段数量
        /// </summary>
        public long HashLength(string key, CommandFlags flags = CommandFlags.None)
        {
            return _redisDb.HashLength(key, flags);
        }

        /// <summary>
        /// 哈希字段数值递增
        /// </summary>
        public double HashIncrement(string key, string field, double incrVal, CommandFlags flags = CommandFlags.None)
        {
            return _redisDb.HashIncrement(key, field, incrVal, flags);
        }

        #endregion

        #region 其他方法

        /// <summary>
        /// 获取数据库操作对象
        /// </summary>
        public IDatabase GetIDatabase()
        {
            return _redisDb;
        }

        #endregion

        #region 私有辅助方法

        /// <summary>
        /// 序列化对象为JSON字符串
        /// </summary>
        private static string Serialize<T>(T value)
        {
            return JsonConvert.SerializeObject(value);
        }

        /// <summary>
        /// 反序列化JSON字符串为对象
        /// </summary>
        private static T Deserialize<T>(RedisValue value)
        {
            return JsonConvert.DeserializeObject<T>(value);
        }

        #endregion
    }
}
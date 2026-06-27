using MongoDB.Driver;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
    /// <typeparam name="T"></typeparam>
    public static partial class MongodbClient<T> where T : class
    {
        // MongoClient 必须全局单例复用，内部管理连接池。每次 new MongoClient 等于每次重建连接池，性能极差。
        private static readonly ConcurrentDictionary<string, MongoClient> _clientCache = new ConcurrentDictionary<string, MongoClient>();

        #region +MongodbInfoClient 获取mongodb实例
        /// <summary>
        /// 获取mongodb实例（MongoClient 按连接字符串单例缓存，复用连接池）
        /// </summary>
        /// <param name="host">连接字符串，库，表</param>
        /// <returns></returns>
        public static IMongoCollection<T> MongodbInfoClient(MongodbHost host)
        {
            var client = _clientCache.GetOrAdd(host.Connection, CreateClient);
            var dataBase = client.GetDatabase(host.DataBase);
            return dataBase.GetCollection<T>(host.Table);
        }

        private static MongoClient CreateClient(string connection)
        {
            var settings = MongoClientSettings.FromConnectionString(connection);
            settings.ServerSelectionTimeout = TimeSpan.FromSeconds(2);
            settings.ConnectTimeout = TimeSpan.FromSeconds(2);
            settings.SocketTimeout = TimeSpan.FromSeconds(2);
            return new MongoClient(settings);
        }
        #endregion
    }
    /// <summary>
    /// 
    /// </summary>
    public partial class MongodbHost
    {
        /// <summary>
        /// 连接字符串
        /// </summary>
        public string Connection { get; set; }
        /// <summary>
        /// 库
        /// </summary>
        public string DataBase { get; set; }
        /// <summary>
        /// 表
        /// </summary>
        public string Table { get; set; }

    }
}

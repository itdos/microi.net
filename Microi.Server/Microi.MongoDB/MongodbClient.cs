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
            var dataBase = MongodbDatabase(host);
            return dataBase.GetCollection<T>(host.Table);
        }

        /// <summary>
        /// 获取复用连接池的数据库实例。生命周期治理需要先读取集合目录，
        /// 避免为了探测不存在的月份逐个创建集合句柄并触发大量网络往返。
        /// </summary>
        public static IMongoDatabase MongodbDatabase(MongodbHost host)
        {
            if (host == null) throw new ArgumentNullException(nameof(host));
            if (string.IsNullOrWhiteSpace(host.Connection))
            {
                throw new InvalidOperationException(
                    "MongoDB连接字符串为空。请在主租户“系统设置 → SaaS引擎 → MongoDB连接字符串”中完成配置，"
                    + "保存后刷新租户运行时配置；子租户使用共享MongoDB时无需复制连接字符串。"
                );
            }
            if (string.IsNullOrWhiteSpace(host.DataBase))
                throw new InvalidOperationException("MongoDB数据库名称为空，请检查调用方的租户与数据库命名配置。");
            var client = _clientCache.GetOrAdd(host.Connection, CreateClient);
            return client.GetDatabase(host.DataBase);
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

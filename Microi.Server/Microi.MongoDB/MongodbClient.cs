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
            // 连接字符串是租户自己的超时事实源：运维为慢速/老旧 MongoDB 在
            // “SaaS引擎 → MongoDB连接字符串”里显式配置的 socketTimeoutMS 等必须优先，
            // 平台只补齐缺省值，避免 2 秒默认值把已配置的调大值覆盖回小值。
            if (!HasExplicitTimeoutOption(connection, "serverSelectionTimeoutMS"))
                settings.ServerSelectionTimeout = TimeSpan.FromSeconds(2);
            if (!HasExplicitTimeoutOption(connection, "connectTimeoutMS"))
                settings.ConnectTimeout = TimeSpan.FromSeconds(2);
            // MongoDB 3.6/4.0/4.2 等旧版服务端上，索引读取、关键字正则扫描和分页游标
            // 的单次往返经常超过 2 秒；2 秒 socket 超时会直接抛
            // MongoConnectionException/TimeoutException，让日志索引初始化与日志检索永久失败。
            // 默认放宽到 15 秒，仍保留上限；真正的不可用端点仍由 2 秒 ServerSelection 快速失败。
            if (!HasExplicitTimeoutOption(connection, "socketTimeoutMS"))
                settings.SocketTimeout = TimeSpan.FromSeconds(15);
            return new MongoClient(settings);
        }

        /// <summary>连接串查询参数中是否显式配置了指定超时项（MongoDB 选项名不区分大小写）。</summary>
        private static bool HasExplicitTimeoutOption(string connection, string optionName)
        {
            if (string.IsNullOrWhiteSpace(connection)) return false;
            var queryIndex = connection.IndexOf('?');
            if (queryIndex < 0 || queryIndex == connection.Length - 1) return false;
            var query = connection.Substring(queryIndex + 1);
            foreach (var pair in query.Split(new[] { '&' }, StringSplitOptions.RemoveEmptyEntries))
            {
                var separator = pair.IndexOf('=');
                var key = (separator < 0 ? pair : pair.Substring(0, separator)).Trim();
                if (key.Equals(optionName, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
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

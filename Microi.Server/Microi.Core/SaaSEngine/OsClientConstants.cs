namespace Microi.net
{
    /// <summary>
    /// OsClient 配置常量
    /// 集中定义所有 OsClient 相关的配置键和默认值
    /// </summary>
    public static class OsClientDefault
    {
        #region 默认值

        public static string OsClient = "";
        /// <summary>默认连接池大小</summary>
        public static int MaxPoolSize = 500;

        /// <summary>默认连接生命周期（秒）- 防止 MySQL 空闲连接超时</summary>
        public static int ConnectionLifetime = 300;

        /// <summary>默认 Redis 端口</summary>
        public static string OsClientRedisPort = "6379";

        /// <summary>默认 Redis 数据库索引（整数）</summary>
        public static string OsClientRedisDataBase = "5";

        /// <summary>默认 Redis 超时（分钟）</summary>
        public static string OsClientRedisTimeout = "720";

        /// <summary>默认 OsClient 类型</summary>
        public static string OsClientType = "Dev";

        /// <summary>默认 OsClient 网络类型</summary>
        public static string OsClientNetwork = "Internal";

        /// <summary>默认数据库类型</summary>
        public static string OsClientDbType = "MySql";
        public static string OsClientDbConn = "";
        public static string OsClientRedisHost = "";
        public static string OsClientRedisPwd = "";
        public static string OsClientDbMongoConn = "";

        #endregion
    }
}


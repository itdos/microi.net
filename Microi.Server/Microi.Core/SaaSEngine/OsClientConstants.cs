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
        /// <summary>每个节点、每个独立业务池的保守默认上限；连接串显式值优先。</summary>
        // 数据库 max_connections 是全实例总量，不能让每个租户/读写池/节点都默认占用 500。
        // 使用驱动默认的 100；多节点容量由管理员合计规划，不因池满自动扩容。
        public static int MaxPoolSize = 100;

        /// <summary>默认连接生命周期（秒）；归还时淘汰过龄连接，区别于空闲超时。</summary>
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


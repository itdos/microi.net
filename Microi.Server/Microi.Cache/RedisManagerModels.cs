using System;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace Microi.Cache
{
    /// <summary>
    /// Redis 管理器连接参数。仅临时连接模式允许由客户端传入密码，服务端不会持久化该对象。
    /// </summary>
    public class RedisManagerConnectionInput
    {
        public string Name { get; set; }
        public string Host { get; set; }
        public int Port { get; set; } = 6379;
        public string Username { get; set; }
        public string Password { get; set; }
        public int Database { get; set; }
        public bool Ssl { get; set; }
        public int ConnectTimeout { get; set; } = 5000;
        public string KeySeparator { get; set; } = ":";
    }

    /// <summary>
    /// Redis 管理操作上下文。Mode: tenant（当前租户默认连接）、saved（已保存连接）、temporary（匿名临时连接）。
    /// </summary>
    public class RedisManagerContextRequest
    {
        public string Mode { get; set; } = "tenant";
        public string ConnectionId { get; set; }
        public RedisManagerConnectionInput Connection { get; set; }
        public int? Database { get; set; }
    }

    public class RedisManagerKeyListRequest : RedisManagerContextRequest
    {
        public string Pattern { get; set; } = "*";
        public string Cursor { get; set; }
        public int PageSize { get; set; } = 100;
    }

    public class RedisManagerKeyRequest : RedisManagerContextRequest
    {
        public string Key { get; set; }
        public int PageIndex { get; set; } = 1;
        public int PageSize { get; set; } = 200;
    }

    public class RedisManagerDeleteRequest : RedisManagerContextRequest
    {
        public List<string> Keys { get; set; } = new List<string>();
    }

    public class RedisManagerReplaceRequest : RedisManagerContextRequest
    {
        public string Key { get; set; }
        public string DataType { get; set; }
        public string Value { get; set; }
        public long? TtlSeconds { get; set; }
    }

    public class RedisManagerRenameRequest : RedisManagerContextRequest
    {
        public string Key { get; set; }
        public string NewKey { get; set; }
    }

    public class RedisManagerTtlRequest : RedisManagerContextRequest
    {
        public string Key { get; set; }
        /// <summary>-1 表示永久，0 表示立即删除，大于 0 表示秒数。</summary>
        public long TtlSeconds { get; set; }
    }

    public class RedisManagerSavedConnectionInput
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Host { get; set; }
        public int Port { get; set; } = 6379;
        public string Username { get; set; }
        public string Password { get; set; }
        public int Database { get; set; }
        public bool Ssl { get; set; }
        public int ConnectTimeout { get; set; } = 5000;
        public string KeySeparator { get; set; } = ":";
        public int Status { get; set; } = 1;
        public int Sort { get; set; } = 100;
        public string Remark { get; set; }
    }

    public class RedisManagerConnectionSummary
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Mode { get; set; }
        public string Host { get; set; }
        public int Port { get; set; }
        public string Username { get; set; }
        public int Database { get; set; }
        public bool Ssl { get; set; }
        public int ConnectTimeout { get; set; }
        public string KeySeparator { get; set; }
        public int Status { get; set; } = 1;
        public int Sort { get; set; }
        public string Remark { get; set; }
        public bool HasPassword { get; set; }
        public bool IsDefault { get; set; }
    }

    public class RedisManagerKeyItem
    {
        public string Key { get; set; }
        public string Type { get; set; }
        public long? TtlSeconds { get; set; }
        public long? MemoryBytes { get; set; }
    }

    public class RedisManagerKeyPage
    {
        public List<RedisManagerKeyItem> List { get; set; } = new List<RedisManagerKeyItem>();
        public string NextCursor { get; set; }
        public bool HasMore { get; set; }
        public string Pattern { get; set; }
        public int Database { get; set; }
    }

    public class RedisManagerKeyDetail
    {
        public string Key { get; set; }
        public string Type { get; set; }
        public long? TtlSeconds { get; set; }
        public long? MemoryBytes { get; set; }
        public long Length { get; set; }
        public bool Truncated { get; set; }
        public object Value { get; set; }
        public string RawValue { get; set; }
        public JObject Meta { get; set; } = new JObject();
    }

    public class RedisManagerStatistics
    {
        public string ConnectionName { get; set; }
        public string Mode { get; set; }
        public int Database { get; set; }
        public long KeyCount { get; set; }
        public double PingMilliseconds { get; set; }
        public Dictionary<string, long> TypeDistribution { get; set; } = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
        public Dictionary<string, string> Info { get; set; } = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        public List<string> Endpoints { get; set; } = new List<string>();
        public int SampleSize { get; set; }
    }
}

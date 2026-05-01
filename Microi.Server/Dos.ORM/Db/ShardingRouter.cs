/****************************************************
 * 文 件 名：ShardingRouter.cs
 * 创建日期：2026-05-01
 * 文件描述：分库分表路由。
 *
 *   支持两种模式：
 *     1. 分表（同库不同表后缀）：根据 sharding key 计算 _202504 / _0~_15 等后缀
 *     2. 分库（不同 DbSession）：根据 sharding key 选择不同 DbSession
 *
 *   用法：
 *     // 按月分表：sys_order_202401 / sys_order_202402 ...
 *     var t = ShardingRouter.MonthlyTable("sys_order", DateTime.Now);
 *
 *     // 按 hash 取模分表
 *     var t = ShardingRouter.HashModTable("sys_order", userId, 16);
 *
 *     // 分库
 *     var router = new DbShardingRouter()
 *         .AddNode("db0", session0)
 *         .AddNode("db1", session1);
 *     var session = router.RouteByHash(userId);
 ******************************************************/

using System;
using System.Collections.Generic;

namespace Dos.ORM
{
    /// <summary>
    /// 分表名构造器（同库分表）
    /// </summary>
    public static class ShardingRouter
    {
        /// <summary>
        /// 按月分表：tableName_yyyyMM
        /// </summary>
        public static string MonthlyTable(string tableName, DateTime date)
            => $"{tableName}_{date:yyyyMM}";

        /// <summary>
        /// 按年分表：tableName_yyyy
        /// </summary>
        public static string YearlyTable(string tableName, DateTime date)
            => $"{tableName}_{date:yyyy}";

        /// <summary>
        /// 按日分表：tableName_yyyyMMdd
        /// </summary>
        public static string DailyTable(string tableName, DateTime date)
            => $"{tableName}_{date:yyyyMMdd}";

        /// <summary>
        /// 按字符串 hash 取模分表：tableName_0、tableName_1、...
        /// </summary>
        public static string HashModTable(string tableName, string shardingKey, int bucketCount, int padWidth = 0)
        {
            if (bucketCount <= 0) throw new ArgumentOutOfRangeException(nameof(bucketCount));
            int idx = StableHash(shardingKey ?? string.Empty) % bucketCount;
            string suffix = padWidth > 0 ? idx.ToString().PadLeft(padWidth, '0') : idx.ToString();
            return $"{tableName}_{suffix}";
        }

        /// <summary>
        /// 按 long 取模分表
        /// </summary>
        public static string ModTable(string tableName, long shardingKey, int bucketCount, int padWidth = 0)
        {
            if (bucketCount <= 0) throw new ArgumentOutOfRangeException(nameof(bucketCount));
            long idx = (shardingKey % bucketCount + bucketCount) % bucketCount;
            string suffix = padWidth > 0 ? idx.ToString().PadLeft(padWidth, '0') : idx.ToString();
            return $"{tableName}_{suffix}";
        }

        /// <summary>
        /// FNV-1a hash（稳定，与 .NET String.GetHashCode 不同——string.GetHashCode 在不同进程返回值不同）
        /// </summary>
        public static int StableHash(string s)
        {
            unchecked
            {
                const int prime = 16777619;
                int hash = (int)2166136261;
                for (int i = 0; i < s.Length; i++)
                {
                    hash ^= s[i];
                    hash *= prime;
                }
                return hash & int.MaxValue;
            }
        }
    }

    /// <summary>
    /// 分库路由器（不同 DbSession 节点）
    /// </summary>
    public sealed class DbShardingRouter
    {
        private readonly List<NodeEntry> _nodes = new List<NodeEntry>();

        /// <summary>
        /// 添加一个分库节点
        /// </summary>
        public DbShardingRouter AddNode(string nodeName, DbSession session)
        {
            if (string.IsNullOrEmpty(nodeName)) throw new ArgumentNullException(nameof(nodeName));
            if (session == null) throw new ArgumentNullException(nameof(session));
            _nodes.Add(new NodeEntry { Name = nodeName, Session = session });
            return this;
        }

        /// <summary>
        /// 按字符串 hash 选择节点
        /// </summary>
        public DbSession RouteByHash(string shardingKey)
        {
            if (_nodes.Count == 0) throw new InvalidOperationException("无可用分库节点");
            int idx = ShardingRouter.StableHash(shardingKey ?? string.Empty) % _nodes.Count;
            return _nodes[idx].Session;
        }

        /// <summary>
        /// 按 long 取模选择节点
        /// </summary>
        public DbSession RouteByMod(long shardingKey)
        {
            if (_nodes.Count == 0) throw new InvalidOperationException("无可用分库节点");
            int idx = (int)((shardingKey % _nodes.Count + _nodes.Count) % _nodes.Count);
            return _nodes[idx].Session;
        }

        /// <summary>
        /// 按节点名直选
        /// </summary>
        public DbSession RouteByName(string nodeName)
        {
            foreach (var n in _nodes)
                if (string.Equals(n.Name, nodeName, StringComparison.OrdinalIgnoreCase)) return n.Session;
            throw new KeyNotFoundException("分库节点不存在：" + nodeName);
        }

        /// <summary>
        /// 所有节点（用于跨库聚合）
        /// </summary>
        public IReadOnlyList<DbSession> AllNodes()
        {
            var arr = new DbSession[_nodes.Count];
            for (int i = 0; i < _nodes.Count; i++) arr[i] = _nodes[i].Session;
            return arr;
        }

        private sealed class NodeEntry
        {
            public string Name;
            public DbSession Session;
        }
    }
}

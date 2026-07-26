using System;
using System.Collections.Generic;
using Dos.ORM;

namespace Microi.net
{
    /// <summary>
    /// V8 扩展数据库集合。既兼容 V8.Dbs.{DbKey}，也允许可信服务端脚本
    /// 通过 Open 临时创建不落库的 Dos.ORM 会话。
    /// </summary>
    public sealed class V8DatabaseCollection : Dictionary<string, DbSession>
    {
        private static readonly HashSet<string> ReservedKeys = new HashSet<string>(
            new[] { "Open", "Count", "Keys", "Values", "Comparer", "Add", "Remove", "Clear", "ContainsKey", "TryGetValue" },
            StringComparer.OrdinalIgnoreCase);

        public V8DatabaseCollection()
            : base(StringComparer.OrdinalIgnoreCase)
        {
        }

        /// <summary>
        /// 使用已认证数据库类型和连接字符串创建临时会话。该会话不会写入
        /// microi_database，也不会成为跨节点共享状态。
        /// </summary>
        public DbSession Open(string databaseType, string connectionString)
        {
            var resolvedType = ExternalDatabaseCatalog.ResolveType(databaseType);
            return MicroiORMExtensions.CreateDbSession(connectionString, resolvedType);
        }

        public static bool IsReservedKey(string key)
        {
            return !string.IsNullOrWhiteSpace(key) && ReservedKeys.Contains(key.Trim());
        }
    }
}

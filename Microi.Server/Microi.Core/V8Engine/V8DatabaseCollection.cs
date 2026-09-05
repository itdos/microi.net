using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using Dos.ORM;

namespace Microi.net
{
    /// <summary>
    /// V8 扩展数据库集合。既兼容 V8.Dbs.{DbKey}，也允许可信服务端脚本
    /// 通过 Open 临时创建不落库的 Dos.ORM 会话。
    /// </summary>
    public sealed class V8DatabaseCollection : IDictionary<string, DbSession>, IReadOnlyDictionary<string, DbSession>
    {
        // 扩展库目录不是当前表的依赖。仅在访问指定 DbKey 时初始化会话，避免一条
        // 未配置完成的扩展库阻断主库 CRUD、登录和平台升级；错误仍在实际使用时抛出。
        private readonly Dictionary<string, Lazy<DbSession>> sessions = new Dictionary<string, Lazy<DbSession>>(StringComparer.OrdinalIgnoreCase);
        private static readonly HashSet<string> ReservedKeys = new HashSet<string>(
            new[] { "Open", "Count", "Keys", "Values", "Comparer", "Add", "AddLazy", "Remove", "Clear", "ContainsKey", "TryGetValue" },
            StringComparer.OrdinalIgnoreCase);

        public V8DatabaseCollection()
        {
        }

        public DbSession this[string key]
        {
            get => sessions[key].Value;
            set => sessions[key] = new Lazy<DbSession>(() => value);
        }

        public int Count => sessions.Count;
        public bool IsReadOnly => false;
        public IEqualityComparer<string> Comparer => sessions.Comparer;
        public ICollection<string> Keys => sessions.Keys;
        public ICollection<DbSession> Values => sessions.Values.Select(value => value.Value).ToArray();
        IEnumerable<string> IReadOnlyDictionary<string, DbSession>.Keys => Keys;
        IEnumerable<DbSession> IReadOnlyDictionary<string, DbSession>.Values => Values;

        public void Add(string key, DbSession value) => AddLazy(key, () => value);

        public void AddLazy(string key, Func<DbSession> factory)
        {
            if (factory == null) throw new ArgumentNullException(nameof(factory));
            sessions.Add(key, new Lazy<DbSession>(factory, LazyThreadSafetyMode.ExecutionAndPublication));
        }

        public bool ContainsKey(string key) => sessions.ContainsKey(key);
        public bool Remove(string key) => sessions.Remove(key);
        public void Clear() => sessions.Clear();
        public bool TryGetValue(string key, out DbSession value)
        {
            value = null;
            if (!sessions.TryGetValue(key, out var session)) return false;
            value = session.Value;
            return true;
        }
        public void Add(KeyValuePair<string, DbSession> item) => Add(item.Key, item.Value);
        public bool Contains(KeyValuePair<string, DbSession> item) =>
            TryGetValue(item.Key, out var value) && EqualityComparer<DbSession>.Default.Equals(value, item.Value);
        public bool Remove(KeyValuePair<string, DbSession> item) => Contains(item) && Remove(item.Key);
        public void CopyTo(KeyValuePair<string, DbSession>[] array, int arrayIndex) =>
            this.ToArray().CopyTo(array, arrayIndex);
        public IEnumerator<KeyValuePair<string, DbSession>> GetEnumerator() =>
            sessions.Select(pair => new KeyValuePair<string, DbSession>(pair.Key, pair.Value.Value)).GetEnumerator();
        IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

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

/****************************************************
 * 文 件 名：Navigate.cs
 * 创建日期：2026-05-01
 * 文件描述：Navigate 导航属性 + Includes 加载器。
 *
 *   设计：
 *     1. 通过 [Navigate] 特性声明实体之间的关联（一对一/一对多/多对多）
 *     2. 不修改 Entity 基类、不依赖 EF Core，纯运行时反射
 *     3. 用扩展方法 IncludeMany / IncludeOne 触发批量加载，避免 N+1 查询
 *
 *   用法示例：
 *     public class Order : Entity {
 *         public string Id { get; set; }
 *         public string UserId { get; set; }
 *
 *         [Navigate(NavigateType.OneToOne, nameof(UserId))]
 *         public SysUser User { get; set; }
 *
 *         [Navigate(NavigateType.OneToMany, nameof(Id), TargetForeignKey = nameof(OrderItem.OrderId))]
 *         public List<OrderItem> Items { get; set; }
 *     }
 *
 *     var orders = dbSession.From<Order>().ToList();
 *     dbSession.IncludeOne(orders, o => o.User);
 *     dbSession.IncludeMany(orders, o => o.Items);
 ******************************************************/

using Dos.ORM.Common;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Reflection;
using System.Text;

namespace Dos.ORM
{
    /// <summary>
    /// 导航关系类型
    /// </summary>
    public enum NavigateType
    {
        /// <summary>一对一</summary>
        OneToOne,
        /// <summary>一对多</summary>
        OneToMany,
        /// <summary>多对多</summary>
        ManyToMany
    }

    /// <summary>
    /// 导航属性特性
    /// </summary>
    [AttributeUsage(AttributeTargets.Property)]
    public sealed class NavigateAttribute : Attribute
    {
        /// <summary>关系类型</summary>
        public NavigateType Type { get; }
        /// <summary>本端字段名（一般是外键或主键）</summary>
        public string SourceKey { get; }
        /// <summary>对端字段名（OneToMany 时是对端的外键，OneToOne 时是对端的主键）</summary>
        public string TargetForeignKey { get; set; }
        /// <summary>多对多中间表名</summary>
        public string MappingTable { get; set; }
        /// <summary>中间表 → Source 端字段</summary>
        public string MappingSourceField { get; set; }
        /// <summary>中间表 → Target 端字段</summary>
        public string MappingTargetField { get; set; }

        /// <summary>构造</summary>
        public NavigateAttribute(NavigateType type, string sourceKey)
        {
            Type = type;
            SourceKey = sourceKey ?? throw new ArgumentNullException(nameof(sourceKey));
        }
    }

    /// <summary>
    /// Navigate 导航加载扩展
    /// </summary>
    public static class NavigateExtensions
    {
        /// <summary>
        /// 一对一加载：将每个 source 的导航属性填充为单个对象
        /// </summary>
        public static void IncludeOne<TSource, TNav>(this DbSession dbSession,
            IEnumerable<TSource> sources,
            Expression<Func<TSource, TNav>> navProperty)
            where TSource : Entity
            where TNav : Entity, new()
        {
            if (sources == null) return;
            var list = sources as IList<TSource> ?? sources.ToList();
            if (list.Count == 0) return;

            var (sourceProp, attr) = ResolveNavigate(navProperty);
            if (attr.Type != NavigateType.OneToOne)
                throw new InvalidOperationException("IncludeOne 仅支持 OneToOne 关系。");

            var sourceKeyProp = typeof(TSource).GetProperty(attr.SourceKey)
                ?? throw new InvalidOperationException($"源实体未找到字段 {attr.SourceKey}");
            var targetKeyName = attr.TargetForeignKey
                ?? FirstIdentityOrPrimary<TNav>()
                ?? throw new InvalidOperationException("OneToOne 必须指定 TargetForeignKey 或目标实体须有主键");

            var keys = list.Select(x => sourceKeyProp.GetValue(x))
                .Where(v => v != null).Distinct().ToList();
            if (keys.Count == 0) return;

            var targets = LoadByKey<TNav>(dbSession, targetKeyName, keys);
            var targetKeyProp = typeof(TNav).GetProperty(targetKeyName);
            var lookup = new Dictionary<object, TNav>();
            foreach (var t in targets)
            {
                var k = targetKeyProp.GetValue(t);
                if (k != null) lookup[k] = t;
            }
            foreach (var s in list)
            {
                var sk = sourceKeyProp.GetValue(s);
                if (sk != null && lookup.TryGetValue(sk, out var tv))
                    sourceProp.SetValue(s, tv);
            }
        }

        /// <summary>
        /// 一对多加载：将每个 source 的导航属性填充为对端的 List
        /// </summary>
        public static void IncludeMany<TSource, TNav>(this DbSession dbSession,
            IEnumerable<TSource> sources,
            Expression<Func<TSource, List<TNav>>> navProperty)
            where TSource : Entity
            where TNav : Entity, new()
        {
            if (sources == null) return;
            var list = sources as IList<TSource> ?? sources.ToList();
            if (list.Count == 0) return;

            var (sourceProp, attr) = ResolveNavigate(navProperty);
            if (attr.Type != NavigateType.OneToMany)
                throw new InvalidOperationException("IncludeMany 仅支持 OneToMany 关系。");
            if (string.IsNullOrEmpty(attr.TargetForeignKey))
                throw new InvalidOperationException("OneToMany 必须指定 TargetForeignKey");

            var sourceKeyProp = typeof(TSource).GetProperty(attr.SourceKey)
                ?? throw new InvalidOperationException($"源实体未找到字段 {attr.SourceKey}");

            var keys = list.Select(x => sourceKeyProp.GetValue(x))
                .Where(v => v != null).Distinct().ToList();
            if (keys.Count == 0) return;

            var targets = LoadByKey<TNav>(dbSession, attr.TargetForeignKey, keys);
            var targetKeyProp = typeof(TNav).GetProperty(attr.TargetForeignKey);

            var groups = new Dictionary<object, List<TNav>>();
            foreach (var t in targets)
            {
                var fk = targetKeyProp.GetValue(t);
                if (fk == null) continue;
                if (!groups.TryGetValue(fk, out var bucket))
                {
                    bucket = new List<TNav>();
                    groups[fk] = bucket;
                }
                bucket.Add(t);
            }
            foreach (var s in list)
            {
                var sk = sourceKeyProp.GetValue(s);
                if (sk != null && groups.TryGetValue(sk, out var bucket))
                    sourceProp.SetValue(s, bucket);
                else
                    sourceProp.SetValue(s, new List<TNav>());
            }
        }

        /// <summary>
        /// 多对多加载（通过中间表）
        /// </summary>
        public static void IncludeManyToMany<TSource, TNav>(this DbSession dbSession,
            IEnumerable<TSource> sources,
            Expression<Func<TSource, List<TNav>>> navProperty)
            where TSource : Entity
            where TNav : Entity, new()
        {
            if (sources == null) return;
            var list = sources as IList<TSource> ?? sources.ToList();
            if (list.Count == 0) return;

            var (sourceProp, attr) = ResolveNavigate(navProperty);
            if (attr.Type != NavigateType.ManyToMany)
                throw new InvalidOperationException("IncludeManyToMany 仅支持 ManyToMany 关系。");
            if (string.IsNullOrEmpty(attr.MappingTable) ||
                string.IsNullOrEmpty(attr.MappingSourceField) ||
                string.IsNullOrEmpty(attr.MappingTargetField))
                throw new InvalidOperationException("ManyToMany 必须指定 MappingTable/MappingSourceField/MappingTargetField");

            var sourceKeyProp = typeof(TSource).GetProperty(attr.SourceKey)
                ?? throw new InvalidOperationException($"源实体未找到字段 {attr.SourceKey}");
            var targetKeyName = attr.TargetForeignKey ?? FirstIdentityOrPrimary<TNav>()
                ?? throw new InvalidOperationException("ManyToMany 必须指定 TargetForeignKey 或目标实体有主键");

            var sKeys = list.Select(x => sourceKeyProp.GetValue(x))
                .Where(v => v != null).Distinct().ToList();
            if (sKeys.Count == 0) return;

            // 1) 查中间表，得到 Source -> Target 映射
            var provider = dbSession.Db.DbProvider;
            char L = provider.LeftToken, R = provider.RightToken;
            var sb = new StringBuilder();
            sb.Append("SELECT ").Append(L).Append(attr.MappingSourceField).Append(R).Append(',')
              .Append(L).Append(attr.MappingTargetField).Append(R)
              .Append(" FROM ").Append(L).Append(attr.MappingTable).Append(R)
              .Append(" WHERE ").Append(L).Append(attr.MappingSourceField).Append(R).Append(" IN (");
            using (var cmd = provider.DbProviderFactory.CreateCommand())
            {
                for (int i = 0; i < sKeys.Count; i++)
                {
                    if (i > 0) sb.Append(',');
                    string pn = "@s" + i;
                    sb.Append(pn);
                    var p = cmd.CreateParameter();
                    p.ParameterName = pn;
                    p.Value = sKeys[i] ?? DBNull.Value;
                    cmd.Parameters.Add(p);
                }
                sb.Append(')');
                cmd.CommandText = sb.ToString();
                cmd.CommandType = System.Data.CommandType.Text;

                var ds = dbSession.Db.ExecuteDataSet(cmd);
                var dt = ds.Tables.Count > 0 ? ds.Tables[0] : new System.Data.DataTable();
                var s2t = new Dictionary<object, List<object>>();
                var allTargetKeys = new HashSet<object>();
                foreach (System.Data.DataRow row in dt.Rows)
                {
                    var sv = row[0]; var tv = row[1];
                    if (sv == DBNull.Value || tv == DBNull.Value) continue;
                    if (!s2t.TryGetValue(sv, out var bucket))
                    {
                        bucket = new List<object>();
                        s2t[sv] = bucket;
                    }
                    bucket.Add(tv);
                    allTargetKeys.Add(tv);
                }
                if (allTargetKeys.Count == 0)
                {
                    foreach (var s in list) sourceProp.SetValue(s, new List<TNav>());
                    return;
                }
                // 2) 加载目标实体
                var targets = LoadByKey<TNav>(dbSession, targetKeyName, allTargetKeys.ToList());
                var targetKeyProp = typeof(TNav).GetProperty(targetKeyName);
                var byKey = targets.ToDictionary(t => targetKeyProp.GetValue(t));
                foreach (var s in list)
                {
                    var sk = sourceKeyProp.GetValue(s);
                    var bucket = new List<TNav>();
                    if (sk != null && s2t.TryGetValue(sk, out var tks))
                        foreach (var tk in tks)
                            if (byKey.TryGetValue(tk, out var tv)) bucket.Add(tv);
                    sourceProp.SetValue(s, bucket);
                }
            }
        }

        #region helpers

        private static (PropertyInfo prop, NavigateAttribute attr) ResolveNavigate<TSource, TProp>(
            Expression<Func<TSource, TProp>> expr)
        {
            if (!(expr.Body is MemberExpression me) || !(me.Member is PropertyInfo prop))
                throw new ArgumentException("表达式必须是属性访问 e => e.Prop", nameof(expr));
            var attr = prop.GetCustomAttribute<NavigateAttribute>();
            if (attr == null)
                throw new InvalidOperationException($"属性 {prop.Name} 未标注 [Navigate]");
            return (prop, attr);
        }

        private static string FirstIdentityOrPrimary<TEntity>() where TEntity : Entity, new()
        {
            var sample = new TEntity();
            var id = sample.GetIdentityField();
            if (!object.ReferenceEquals(id, null)) return id.PropertyName;
            var pk = sample.GetPrimaryKeyFields();
            if (pk != null && pk.Length > 0) return pk[0].PropertyName;
            return null;
        }

        private static List<TEntity> LoadByKey<TEntity>(DbSession dbSession, string keyField, IList<object> keys)
            where TEntity : Entity, new()
        {
            // 用一个 IN 查询批量加载
            var sample = new TEntity();
            var tableName = sample.GetTableName();
            var provider = dbSession.Db.DbProvider;
            char L = provider.LeftToken, R = provider.RightToken;

            var sb = new StringBuilder();
            sb.Append("SELECT * FROM ").Append(L).Append(tableName).Append(R)
              .Append(" WHERE ").Append(L).Append(keyField).Append(R).Append(" IN (");
            using (var cmd = provider.DbProviderFactory.CreateCommand())
            {
                for (int i = 0; i < keys.Count; i++)
                {
                    if (i > 0) sb.Append(',');
                    string pn = "@k" + i;
                    sb.Append(pn);
                    var p = cmd.CreateParameter();
                    p.ParameterName = pn;
                    p.Value = keys[i] ?? DBNull.Value;
                    cmd.Parameters.Add(p);
                }
                sb.Append(')');
                cmd.CommandText = sb.ToString();
                cmd.CommandType = System.Data.CommandType.Text;

                using (var reader = dbSession.Db.ExecuteReader(cmd))
                {
                    var list = new List<TEntity>();
                    while (reader.Read())
                    {
                        var e = new TEntity();
                        var fields = e.GetFields();
                        var setterMap = BuildSetterMap<TEntity>();
                        for (int i = 0; i < reader.FieldCount; i++)
                        {
                            var name = reader.GetName(i);
                            if (setterMap.TryGetValue(name, out var pi))
                            {
                                var v = reader.GetValue(i);
                                if (v != DBNull.Value)
                                {
                                    try { pi.SetValue(e, ConvertToPropType(v, pi.PropertyType)); } catch { }
                                }
                            }
                        }
                        list.Add(e);
                    }
                    return list;
                }
            }
        }

        private static readonly Dictionary<Type, Dictionary<string, PropertyInfo>> _setterCache
            = new Dictionary<Type, Dictionary<string, PropertyInfo>>();
        private static readonly object _setterLock = new object();
        private static Dictionary<string, PropertyInfo> BuildSetterMap<T>()
        {
            var t = typeof(T);
            if (_setterCache.TryGetValue(t, out var m)) return m;
            lock (_setterLock)
            {
                if (_setterCache.TryGetValue(t, out m)) return m;
                m = new Dictionary<string, PropertyInfo>(StringComparer.OrdinalIgnoreCase);
                foreach (var p in t.GetProperties())
                    if (p.CanWrite) m[p.Name] = p;
                _setterCache[t] = m;
                return m;
            }
        }

        private static object ConvertToPropType(object value, Type targetType)
        {
            if (value == null) return null;
            var t = Nullable.GetUnderlyingType(targetType) ?? targetType;
            if (t.IsInstanceOfType(value)) return value;
            if (t.IsEnum) return Enum.ToObject(t, value);
            return Convert.ChangeType(value, t);
        }

        #endregion
    }
}

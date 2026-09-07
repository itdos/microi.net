using System;
using System.Collections.Generic;

namespace Microi.net
{
    /// <summary>为字段数据源一次建立父级索引，避免每个节点重复扫描全部选项。</summary>
    internal static class FieldOptionTreeBuilder
    {
        internal static void Populate(
            IList<IDictionary<string, object>> roots,
            IList<IDictionary<string, object>> rows,
            string parentField,
            string childrenField,
            string leafField)
        {
            var childrenByParent = new Dictionary<string, List<IDictionary<string, object>>>(StringComparer.Ordinal);
            foreach (var row in rows)
            {
                var parent = Read(row, parentField);
                if (parent == null || parent is DBNull || string.IsNullOrEmpty(parent.ToString())) continue;
                var key = parent.ToString();
                if (!childrenByParent.TryGetValue(key, out var children))
                    childrenByParent[key] = children = new List<IDictionary<string, object>>();
                children.Add(row);
            }

            // 迭代遍历既保留 SQL 顺序，又避免深树消耗调用栈。重复 Id/环和超深数据
            // 返回明确错误，不能在接口线程中永久递归或生成无法序列化的对象图。
            var visited = new HashSet<string>(StringComparer.Ordinal);
            var pending = new Queue<(IDictionary<string, object> Row, int Depth)>();
            foreach (var root in roots) pending.Enqueue((root, 0));
            while (pending.Count > 0)
            {
                var (row, depth) = pending.Dequeue();
                if (depth > 128) throw new InvalidOperationException("树形数据源层级超过 128 层，请检查父级关系。");
                var id = Read(row, "Id")?.ToString();
                if (!string.IsNullOrEmpty(id) && !visited.Add(id))
                    throw new InvalidOperationException("树形数据源存在重复 Id 或循环父级关系。");
                if (!string.IsNullOrEmpty(id) && childrenByParent.TryGetValue(id, out var children))
                {
                    Write(row, childrenField, children);
                    Write(row, leafField, false);
                    foreach (var child in children) pending.Enqueue((child, depth + 1));
                }
                else
                {
                    Write(row, leafField, true);
                }
            }
        }

        private static object Read(IDictionary<string, object> row, string key)
        {
            if (row.TryGetValue(key, out var value)) return value;
            foreach (var entry in row)
                if (string.Equals(entry.Key, key, StringComparison.OrdinalIgnoreCase)) return entry.Value;
            return null;
        }

        private static void Write(IDictionary<string, object> row, string key, object value)
        {
            // 数据源字段名大小写不敏感，避免同时输出 _Leaf 与 _leaf。
            var actualKey = key;
            if (!row.ContainsKey(key))
                foreach (var existing in row.Keys)
                    if (string.Equals(existing, key, StringComparison.OrdinalIgnoreCase)) { actualKey = existing; break; }
            row[actualKey] = value;
        }
    }
}

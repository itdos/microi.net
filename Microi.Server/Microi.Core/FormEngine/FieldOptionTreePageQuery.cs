using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace Microi.net
{

/// <summary>仅用于显式开启分页的 SQL 下拉树。沿用已鉴权、已替换上下文的字段 SQL，不另建数据源。</summary>
public sealed class FieldOptionTreePageQuery
{
    public string Sql { get; private set; }
    public Dictionary<string, object> Parameters { get; } = new Dictionary<string, object>();
    public int PageIndex { get; private set; }
    public int PageSize { get; private set; }
    public bool IsLookup { get; private set; }

    public static FieldOptionTreePageQuery Create(string sourceSql, string dbType,
        string valueField, string labelField, string parentField, int configuredPageSize,
        int? pageIndex, int? pageSize, string parentValue, string keyword, IReadOnlyList<string> values)
    {
        var result = new FieldOptionTreePageQuery
        {
            PageSize = Math.Clamp(pageSize.GetValueOrDefault(configuredPageSize), 1, Math.Clamp(configuredPageSize, 1, 200)),
            PageIndex = Math.Clamp(pageIndex.GetValueOrDefault(1), 1, 1000000),
            IsLookup = values != null && values.Count > 0
        };
        var source = Source(sourceSql);
        var key = "_mci_tree." + Quote(valueField, dbType);
        var parent = "_mci_tree." + Quote(parentField, dbType);
        var label = "_mci_tree." + Quote(labelField, dbType);
        string where;
        if (result.IsLookup)
        {
            if (values.Count > 200) throw new ArgumentException("下拉树每次最多回填 200 个选中值。");
            var names = values.Distinct().Select((value, i) =>
            {
                var name = "@mci_tree_value_" + i;
                result.Parameters.Add(name, value);
                return name;
            });
            where = key + " IN (" + string.Join(",", names) + ")";
            result.PageIndex = 1;
            result.PageSize = values.Count;
        }
        else if (!string.IsNullOrWhiteSpace(keyword))
        {
            // 搜索整个授权数据源，包括尚未加载的分支；用户输入只作为参数。
            where = label + " LIKE @mci_tree_keyword ESCAPE '!'";
            result.Parameters.Add("@mci_tree_keyword", "%" + keyword.Replace("!", "!!").Replace("%", "!%").Replace("_", "!_").Replace("[", "![") + "%");
        }
        else if (!string.IsNullOrEmpty(parentValue))
        {
            where = parent + " = @mci_tree_parent";
            result.Parameters.Add("@mci_tree_parent", parentValue);
        }
        else
        {
            // 与旧树构建器的根节点定义一致。
            where = $"({parent} IS NULL OR {parent} = '' OR {parent} = '00000000-0000-0000-0000-000000000000' OR {parent} = '00000000000000000000000000')";
        }
        var sql = $"SELECT _mci_tree.* FROM ({source}\n) _mci_tree WHERE {where} ORDER BY {key}";
        var offset = (long)(result.PageIndex - 1) * result.PageSize;
        var take = result.PageSize + (result.IsLookup ? 0 : 1);
        result.Sql = dbType.Equals("SqlServer", StringComparison.OrdinalIgnoreCase) || dbType.Equals("Oracle", StringComparison.OrdinalIgnoreCase)
            ? sql + $" OFFSET {offset} ROWS FETCH NEXT {take} ROWS ONLY"
            : sql + $" LIMIT {take} OFFSET {offset}";
        return result;
    }

    public static FieldOptionTreePageQuery Children(string sourceSql, string dbType, string parentField, IReadOnlyList<string> values)
    {
        if (values.Count < 1 || values.Count > 200) throw new ArgumentException("下拉树子级存在性查询必须限制在当前页。");
        var result = new FieldOptionTreePageQuery();
        var names = values.Distinct().Select((value, i) =>
        {
            var name = "@mci_tree_child_" + i;
            result.Parameters.Add(name, value);
            return name;
        });
        var parent = "_mci_tree." + Quote(parentField, dbType);
        result.Sql = $"SELECT DISTINCT {parent} AS {Quote("ParentValue", dbType)} FROM ({Source(sourceSql)}\n) _mci_tree WHERE {parent} IN ({string.Join(",", names)})";
        return result;
    }

    private static string Quote(string name, string dbType)
    {
        if (string.IsNullOrWhiteSpace(name) || !Regex.IsMatch(name, @"^[\p{L}_][\p{L}\p{N}_]*$"))
            throw new ArgumentException("下拉树字段映射必须是数据源返回的列名。");
        if (dbType.Equals("SqlServer", StringComparison.OrdinalIgnoreCase)) return "[" + name + "]";
        if (dbType.Equals("MySql", StringComparison.OrdinalIgnoreCase)) return "`" + name + "`";
        return "\"" + name + "\"";
    }

    private static string Source(string sql) => (sql ?? "").Trim().TrimEnd(';');
}
}

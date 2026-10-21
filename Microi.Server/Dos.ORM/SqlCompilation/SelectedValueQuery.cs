using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace Dos.ORM.SqlCompilation
{
    /// <summary>
    /// 从受信选项 SELECT 中解析最外层候选分页，再按保存键做有界回显查询。
    /// 不改写 WHERE/JOIN/子查询；无法判定的语法拒绝，不退化为全表或 OR 查询。
    /// </summary>
    public sealed class SelectedValueQuery
    {
        public string Sql { get; private set; }
        public Dictionary<string, object> Parameters { get; } = new Dictionary<string, object>();

        public static SelectedValueQuery Create(string sourceSql, string dbType, string valueColumn,
            string labelColumn, IReadOnlyList<string> values)
        {
            if (values == null || values.Count == 0 || values.Count > 200
                || values.Any(v => v == null || v.Length > 512))
                throw new ArgumentException("回显查询每次只允许 1 至 200 个长度不超过 512 的保存值。");
            var mysql = string.Equals(dbType, "MySql", StringComparison.OrdinalIgnoreCase);
            var sqlServer = string.Equals(dbType, "SqlServer", StringComparison.OrdinalIgnoreCase);
            var oracle = string.Equals(dbType, "Oracle", StringComparison.OrdinalIgnoreCase);
            if (!mysql && !sqlServer && !oracle) throw new ArgumentException("当前数据库不支持自动选项回显。");
            string Quote(string column)
            {
                if (string.IsNullOrEmpty(column) || !Regex.IsMatch(column, @"^[\p{L}_][\p{L}\p{N}_]*$"))
                    throw new ArgumentException("回显映射必须是已配置 SQL 输出的列名。");
                return mysql ? "`" + column + "`" : sqlServer ? "[" + column + "]" : "\"" + column + "\"";
            }
            var source = (sourceSql ?? "").Trim();
            if (source.Length == 0 || source.Length > 100000) throw new ArgumentException("无效的选项 SQL。");
            var tokens = Scan(source);
            if (tokens.Count == 0 || tokens[0].Word != "SELECT") throw new ArgumentException("自动回显仅支持单条 SELECT。");
            if (tokens.Any(t => new[] { "UNION", "INTERSECT", "EXCEPT", "INTO", "FOR", "LOCK", "TOP", "FETCH" }.Contains(t.Word)))
                throw new ArgumentException("此 SQL 需要显式的选项解析接口，不能自动移除分页。");
            var limit = tokens.FindIndex(t => t.Word == "LIMIT");
            if (tokens.Any(t => t.Word == "OFFSET" && (limit < 0 || t.Start < tokens[limit].Start)))
                throw new ArgumentException("当前分页语法需要显式选项解析接口。");
            var end = source.Length;
            if (limit >= 0)
            {
                // LIMIT 只接受确定的字面量分页；参数、表达式和未知尾部保持失败关闭。
                if (!mysql || !Regex.IsMatch(source.Substring(tokens[limit].Start), @"\ALIMIT\s+\d+\s*(?:,\s*\d+\s*|OFFSET\s+\d+\s*)?;?\s*\z", RegexOptions.IgnoreCase))
                    throw new ArgumentException("无法安全识别选项 SQL 的最外层 LIMIT。");
                end = tokens[limit].Start;
            }
            var order = tokens.FindIndex(t => t.Word == "ORDER");
            if (order >= 0)
            {
                if (order + 1 >= tokens.Count || tokens[order + 1].Word != "BY") throw new ArgumentException("无效的 ORDER BY。");
                end = Math.Min(end, tokens[order].Start);
            }
            source = source.Substring(0, end).Trim().TrimEnd(';');
            var result = new SelectedValueQuery();
            var names = values.Distinct(StringComparer.Ordinal).Select((v, i) =>
            {
                var name = "@mci_selected_" + i;
                result.Parameters.Add(name, v);
                return name;
            }).ToArray();
            // 普通派生表别名以字母开头，兼容不允许下划线开头标识符的提供商。
            var key = "mci_selected." + Quote(valueColumn);
            var label = "mci_selected." + Quote(labelColumn);
            // 只传回键和标签，额外取一行检测非唯一保存键，避免无界物化。
            var projection = valueColumn == labelColumn ? key : key + ", " + label;
            var take = values.Count + 1;
            result.Sql = "SELECT " + (sqlServer ? "TOP (" + take + ") " : "")
                + projection + " FROM (" + source + "\n) mci_selected WHERE " + key
                + " IN (" + string.Join(",", names) + ")"
                + (mysql ? " LIMIT " + take : oracle ? " FETCH FIRST " + take + " ROWS ONLY" : "");
            return result;
        }

        private sealed class Token { public string Word; public int Start; }

        private static List<Token> Scan(string sql)
        {
            var tokens = new List<Token>();
            var depth = 0;
            for (var i = 0; i < sql.Length;)
            {
                var c = sql[i];
                if (char.IsWhiteSpace(c)) { i++; continue; }
                // 不解释方言相关的注释/反斜杠转义，防止 SQL mode 影响分页边界。
                if (c == '#' || (c == '-' && i + 1 < sql.Length && sql[i + 1] == '-')
                    || (c == '/' && i + 1 < sql.Length && sql[i + 1] == '*'))
                    throw new ArgumentException("含注释的 SQL 请使用显式选项解析接口。");
                if (c == '\'' || c == '"' || c == '`' || c == '[')
                {
                    var close = c == '[' ? ']' : c;
                    var closed = false;
                    for (i++; i < sql.Length; i++)
                    {
                        if (sql[i] == '\\') throw new ArgumentException("不支持有歧义的 SQL 转义。");
                        if (sql[i] != close) continue;
                        if (i + 1 < sql.Length && sql[i + 1] == close) { i++; continue; }
                        i++; closed = true; break;
                    }
                    if (!closed) throw new ArgumentException("SQL 引号未闭合。");
                    continue;
                }
                if (c == '(') { depth++; i++; continue; }
                if (c == ')') { if (--depth < 0) throw new ArgumentException("SQL 括号不匹配。"); i++; continue; }
                if (c == ';')
                {
                    if (depth != 0 || sql.Substring(i + 1).Trim().Length != 0) throw new ArgumentException("禁止多语句选项回显。");
                    i++; continue;
                }
                if (char.IsLetter(c) || c == '_')
                {
                    var start = i++;
                    while (i < sql.Length && (char.IsLetterOrDigit(sql[i]) || sql[i] == '_')) i++;
                    if (depth == 0) tokens.Add(new Token { Word = sql.Substring(start, i - start).ToUpperInvariant(), Start = start });
                    continue;
                }
                i++;
            }
            if (depth != 0) throw new ArgumentException("SQL 括号不匹配。");
            return tokens;
        }
    }
}

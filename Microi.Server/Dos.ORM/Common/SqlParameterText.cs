using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Text;

namespace Dos.ORM
{
    /// <summary>
    /// 单次扫描替换命名参数，不再次扫描替换值；字符串、标识符与注释中的同名文本保持原样。
    /// </summary>
    public static class SqlParameterText
    {
        public static string Rewrite(string sql, IEnumerable<DbParameter> parameters,
            Func<DbParameter, string> replacement, int maxLength = 0)
        {
            if (string.IsNullOrEmpty(sql)) return sql;
            var byName = new Dictionary<string, DbParameter>(StringComparer.Ordinal);
            var mysqlSyntax = false;
            if (parameters != null)
                foreach (var parameter in parameters)
                {
                    // MySql.Data 与 MySqlConnector 都使用 MySqlParameter；按真实提供程序
                    // 识别反斜杠和 # 注释，避免把 SQL Server 临时表或 Oracle 路径字面量吞掉。
                    mysqlSyntax |= parameter?.GetType().Name == "MySqlParameter";
                    var name = parameter?.ParameterName?.TrimStart('@', ':', '?');
                    if (!string.IsNullOrEmpty(name) && !byName.ContainsKey(name)) byName.Add(name, parameter);
                }
            if (byName.Count == 0)
                return maxLength > 0 && sql.Length > maxLength ? sql.Substring(0, maxLength) + "..." : sql;

            var output = new StringBuilder(Math.Min(sql.Length, maxLength > 0 ? maxLength : 4096));
            bool Append(string text, int start, int count)
            {
                if (maxLength > 0 && count > maxLength - output.Length)
                {
                    output.Append(text, start, maxLength - output.Length).Append("...");
                    return false;
                }
                output.Append(text, start, count);
                return true;
            }
            for (var i = 0; i < sql.Length;)
            {
                var start = i;
                var ch = sql[i++];
                if (ch == '\'' || ch == '"' || ch == '`' || ch == '[')
                {
                    var end = ch == '[' ? ']' : ch;
                    while (i < sql.Length)
                    {
                        var current = sql[i++];
                        if (mysqlSyntax && current == '\\' && ch != '[' && i < sql.Length) { i++; continue; }
                        if (current != end) continue;
                        if (i < sql.Length && sql[i] == end) { i++; continue; }
                        break;
                    }
                }
                else if ((ch == '-' && i < sql.Length && sql[i] == '-'
                    && (!mysqlSyntax || i + 1 == sql.Length || char.IsWhiteSpace(sql[i + 1])))
                    || (mysqlSyntax && ch == '#'))
                {
                    while (i < sql.Length && sql[i] != '\n') i++;
                }
                else if (ch == '/' && i < sql.Length && sql[i] == '*')
                {
                    i++;
                    var depth = 1;
                    while (i < sql.Length && depth > 0)
                    {
                        if (i + 1 < sql.Length && sql[i] == '/' && sql[i + 1] == '*') { depth++; i += 2; }
                        else if (i + 1 < sql.Length && sql[i] == '*' && sql[i + 1] == '/') { depth--; i += 2; }
                        else i++;
                    }
                }
                else if (ch == '@' || ch == '?' || ch == ':')
                {
                    // SQL Server 的 @@ 全局变量与 PostgreSQL 的 :: 类型转换不是绑定参数。
                    if (i < sql.Length && sql[i] == ch && ch != '?')
                    {
                        i++;
                        while (i < sql.Length && IsNameCharacter(sql[i])) i++;
                    }
                    else
                    {
                        while (i < sql.Length && IsNameCharacter(sql[i])) i++;
                        if (i > start + 1 && byName.TryGetValue(sql.Substring(start + 1, i - start - 1), out var parameter))
                        {
                            var value = replacement(parameter) ?? string.Empty;
                            if (!Append(value, 0, value.Length)) break;
                            continue;
                        }
                    }
                }
                if (!Append(sql, start, i - start)) break;
            }
            return output.ToString();
        }

        private static bool IsNameCharacter(char ch) => char.IsLetterOrDigit(ch) || ch == '_' || ch == '$';
    }
}

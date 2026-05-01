/****************************************************
 * 文 件 名：SqlFunc.cs
 * 创建日期：2026-05-01
 * 文件描述：SQL 函数辅助类，提供跨数据库 SQL 函数的字符串生成。
 *
 *   设计：
 *     1. 不依赖表达式树（避免重型 ExpressionVisitor），直接返回 SQL 片段字符串
 *     2. 与 FromSql() / Where() 配合使用，传入到字段表达式或 WHERE 条件中
 *     3. 跨库适配：根据当前 DbProvider.DatabaseType 输出正确的方言
 *
 *   常见用法：
 *     dbSession.FromSql($"SELECT {SqlFunc.IfNull(provider, "Name", "''")}, ...")
 *     where.AndCustom(SqlFunc.DateDiff(provider, "day", "CreateTime", "GETDATE()") + " > 30");
 ******************************************************/

using System;

namespace Dos.ORM
{
    /// <summary>
    /// SQL 函数辅助类（生成跨库兼容的 SQL 片段）
    /// </summary>
    public static class SqlFunc
    {
        /// <summary>
        /// COALESCE / IFNULL / NVL：返回 expr 为 NULL 时的默认值
        /// </summary>
        public static string IfNull(DbProvider provider, string expr, string defaultValue)
        {
            switch (provider.DatabaseType)
            {
                case DatabaseType.MySql:
                    return $"IFNULL({expr},{defaultValue})";
                case DatabaseType.Oracle:
                case DatabaseType.DaMeng:
                    return $"NVL({expr},{defaultValue})";
                default:
                    return $"COALESCE({expr},{defaultValue})";
            }
        }

        /// <summary>
        /// IIF / CASE WHEN：条件三元
        /// </summary>
        public static string IIF(DbProvider provider, string condition, string trueExpr, string falseExpr)
        {
            switch (provider.DatabaseType)
            {
                case DatabaseType.SqlServer9:
                    return $"IIF({condition},{trueExpr},{falseExpr})";
                default:
                    return $"CASE WHEN {condition} THEN {trueExpr} ELSE {falseExpr} END";
            }
        }

        /// <summary>
        /// 字符串长度
        /// </summary>
        public static string Length(DbProvider provider, string expr)
        {
            switch (provider.DatabaseType)
            {
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9:
                    return $"LEN({expr})";
                default:
                    return $"LENGTH({expr})";
            }
        }

        /// <summary>
        /// SUBSTRING（参数：1 基索引，长度）
        /// </summary>
        public static string Substring(DbProvider provider, string expr, int startIdx1Based, int length)
        {
            switch (provider.DatabaseType)
            {
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9:
                    return $"SUBSTRING({expr},{startIdx1Based},{length})";
                case DatabaseType.Oracle:
                case DatabaseType.DaMeng:
                    return $"SUBSTR({expr},{startIdx1Based},{length})";
                default:
                    return $"SUBSTRING({expr} FROM {startIdx1Based} FOR {length})";
            }
        }

        /// <summary>
        /// 当前日期时间
        /// </summary>
        public static string Now(DbProvider provider)
        {
            switch (provider.DatabaseType)
            {
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9:
                    return "GETDATE()";
                case DatabaseType.Oracle:
                case DatabaseType.DaMeng:
                    return "SYSDATE";
                case DatabaseType.PostgreSql:
                case DatabaseType.KingBase:
                    return "NOW()";
                case DatabaseType.MySql:
                    return "NOW()";
                case DatabaseType.Sqlite3:
                    return "DATETIME('now')";
                default:
                    return "CURRENT_TIMESTAMP";
            }
        }

        /// <summary>
        /// 日期差（unit 取值：year/month/day/hour/minute/second）
        /// </summary>
        public static string DateDiff(DbProvider provider, string unit, string startExpr, string endExpr)
        {
            unit = unit?.ToLowerInvariant();
            switch (provider.DatabaseType)
            {
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9:
                    return $"DATEDIFF({unit},{startExpr},{endExpr})";
                case DatabaseType.MySql:
                    return unit == "day" ? $"DATEDIFF({endExpr},{startExpr})"
                        : $"TIMESTAMPDIFF({unit},{startExpr},{endExpr})";
                case DatabaseType.PostgreSql:
                case DatabaseType.KingBase:
                    return $"EXTRACT(EPOCH FROM ({endExpr} - {startExpr}))" +
                        (unit == "second" ? "" : unit == "minute" ? "/60" : unit == "hour" ? "/3600" : "/86400");
                case DatabaseType.Oracle:
                case DatabaseType.DaMeng:
                    return $"({endExpr}-{startExpr})" + (unit == "day" ? "" : unit == "hour" ? "*24" : "");
                default:
                    return $"DATEDIFF({unit},{startExpr},{endExpr})";
            }
        }

        /// <summary>
        /// JSON 取值（部分库支持）
        /// </summary>
        public static string JsonValue(DbProvider provider, string jsonExpr, string jsonPath)
        {
            // 统一支持类似 $.a.b 的 JSONPath
            switch (provider.DatabaseType)
            {
                case DatabaseType.SqlServer9:
                    return $"JSON_VALUE({jsonExpr},'{jsonPath}')";
                case DatabaseType.MySql:
                    return $"JSON_UNQUOTE(JSON_EXTRACT({jsonExpr},'{jsonPath}'))";
                case DatabaseType.PostgreSql:
                case DatabaseType.KingBase:
                    // 把 $.a.b 转为 ->'a'->>'b'
                    var path = jsonPath?.TrimStart('$').TrimStart('.').Split('.');
                    if (path == null || path.Length == 0) return jsonExpr;
                    string s = jsonExpr;
                    for (int i = 0; i < path.Length; i++)
                        s += (i == path.Length - 1 ? "->>'" : "->'") + path[i] + "'";
                    return s;
                default:
                    throw new NotSupportedException($"JsonValue 不支持 {provider.DatabaseType}");
            }
        }

        /// <summary>
        /// 拼接字符串
        /// </summary>
        public static string Concat(DbProvider provider, params string[] parts)
        {
            if (parts == null || parts.Length == 0) return "''";
            switch (provider.DatabaseType)
            {
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9:
                case DatabaseType.MySql:
                    return "CONCAT(" + string.Join(",", parts) + ")";
                default:
                    return string.Join(" || ", parts);
            }
        }

        /// <summary>
        /// 转大写
        /// </summary>
        public static string Upper(string expr) => $"UPPER({expr})";

        /// <summary>
        /// 转小写
        /// </summary>
        public static string Lower(string expr) => $"LOWER({expr})";

        /// <summary>
        /// 去空格
        /// </summary>
        public static string Trim(string expr) => $"TRIM({expr})";

        /// <summary>
        /// 取绝对值
        /// </summary>
        public static string Abs(string expr) => $"ABS({expr})";

        /// <summary>
        /// 四舍五入
        /// </summary>
        public static string Round(string expr, int digits) => $"ROUND({expr},{digits})";

        /// <summary>
        /// 基本聚合
        /// </summary>
        public static string Count(string expr = "*") => $"COUNT({expr})";

        /// <summary>Sum 聚合</summary>
        public static string Sum(string expr) => $"SUM({expr})";

        /// <summary>Avg 聚合</summary>
        public static string Avg(string expr) => $"AVG({expr})";

        /// <summary>Min 聚合</summary>
        public static string Min(string expr) => $"MIN({expr})";

        /// <summary>Max 聚合</summary>
        public static string Max(string expr) => $"MAX({expr})";
    }
}

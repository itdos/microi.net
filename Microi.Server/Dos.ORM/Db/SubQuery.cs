/****************************************************
 * 文 件 名：SubQuery.cs
 * 创建日期：2026-05-01
 * 文件描述：子查询辅助。
 *
 *   设计：
 *     - 不进入表达式树体系（避免引入 ExpressionVisitor 重型实现）
 *     - 提供 SqlSubQuery.* 方法生成可嵌入到 WHERE / SELECT 列表的 SQL 片段
 *     - 配合 SqlSection.AddInParameter() 完成参数化
 *
 *   常见用法：
 *     // EXISTS：找有订单的用户
 *     var sub = SqlSubQuery.Exists("sys_order", "UserId", "Status=@p0", provider);
 *     var users = dbSession.FromSql($"SELECT * FROM sys_user u WHERE {sub}").AddInParameter("@p0", 1).ToList();
 *
 *     // IN：找用户 ID 在订单表中的记录
 *     var sub = SqlSubQuery.In("UserId", "sys_order", "UserId", "CreateTime > @t0", provider);
 ******************************************************/

using System;
using System.Text;

namespace Dos.ORM
{
    /// <summary>
    /// 子查询 SQL 片段构造器
    /// </summary>
    public static class SqlSubQuery
    {
        /// <summary>
        /// 构造 EXISTS (SELECT 1 FROM table WHERE correlatedField = outerField AND extraWhere)
        /// </summary>
        /// <param name="provider">DbProvider 用于取标识符引号</param>
        /// <param name="innerTable">子查询表名</param>
        /// <param name="correlatedField">子查询的相关字段</param>
        /// <param name="outerCorrelation">外查询的相关字段（如 outer.UserId）</param>
        /// <param name="extraWhere">附加 WHERE（可空，参数化）</param>
        /// <returns>EXISTS (...) 片段</returns>
        public static string Exists(DbProvider provider, string innerTable, string correlatedField,
            string outerCorrelation, string extraWhere = null)
        {
            char L = provider.LeftToken, R = provider.RightToken;
            var sb = new StringBuilder();
            sb.Append("EXISTS (SELECT 1 FROM ").Append(L).Append(innerTable).Append(R)
              .Append(" WHERE ").Append(L).Append(correlatedField).Append(R).Append('=').Append(outerCorrelation);
            if (!string.IsNullOrEmpty(extraWhere)) sb.Append(" AND ").Append(extraWhere);
            sb.Append(')');
            return sb.ToString();
        }

        /// <summary>
        /// 构造 NOT EXISTS (...)
        /// </summary>
        public static string NotExists(DbProvider provider, string innerTable, string correlatedField,
            string outerCorrelation, string extraWhere = null)
            => "NOT " + Exists(provider, innerTable, correlatedField, outerCorrelation, extraWhere);

        /// <summary>
        /// 构造 outerField IN (SELECT innerField FROM innerTable [WHERE ...])
        /// </summary>
        public static string In(DbProvider provider, string outerField, string innerTable, string innerField,
            string extraWhere = null)
        {
            char L = provider.LeftToken, R = provider.RightToken;
            var sb = new StringBuilder();
            sb.Append(L).Append(outerField).Append(R)
              .Append(" IN (SELECT ").Append(L).Append(innerField).Append(R)
              .Append(" FROM ").Append(L).Append(innerTable).Append(R);
            if (!string.IsNullOrEmpty(extraWhere)) sb.Append(" WHERE ").Append(extraWhere);
            sb.Append(')');
            return sb.ToString();
        }

        /// <summary>
        /// 构造 outerField NOT IN (...)
        /// </summary>
        public static string NotIn(DbProvider provider, string outerField, string innerTable, string innerField,
            string extraWhere = null)
        {
            char L = provider.LeftToken, R = provider.RightToken;
            var sb = new StringBuilder();
            sb.Append(L).Append(outerField).Append(R)
              .Append(" NOT IN (SELECT ").Append(L).Append(innerField).Append(R)
              .Append(" FROM ").Append(L).Append(innerTable).Append(R);
            if (!string.IsNullOrEmpty(extraWhere)) sb.Append(" WHERE ").Append(extraWhere);
            sb.Append(')');
            return sb.ToString();
        }

        /// <summary>
        /// 构造标量子查询：(SELECT agg(field) FROM table [WHERE ...])
        /// </summary>
        public static string Scalar(DbProvider provider, string aggregate, string field, string innerTable,
            string extraWhere = null, string asAlias = null)
        {
            char L = provider.LeftToken, R = provider.RightToken;
            var sb = new StringBuilder();
            sb.Append("(SELECT ").Append(aggregate).Append('(')
              .Append(field == "*" ? "*" : (L + field + R)).Append(')')
              .Append(" FROM ").Append(L).Append(innerTable).Append(R);
            if (!string.IsNullOrEmpty(extraWhere)) sb.Append(" WHERE ").Append(extraWhere);
            sb.Append(')');
            if (!string.IsNullOrEmpty(asAlias)) sb.Append(" AS ").Append(L).Append(asAlias).Append(R);
            return sb.ToString();
        }

        /// <summary>
        /// 构造 COUNT 子查询
        /// </summary>
        public static string Count(DbProvider provider, string innerTable, string extraWhere = null, string asAlias = null)
            => Scalar(provider, "COUNT", "*", innerTable, extraWhere, asAlias);
    }
}

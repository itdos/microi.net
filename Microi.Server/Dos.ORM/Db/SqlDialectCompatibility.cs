using System;

namespace Dos.ORM
{
    /// <summary>
    /// 旧版 FromSql 调用迁移期间使用的受控方言边界。
    /// 新代码应优先使用 SQL AST；尚未迁入 AST 的业务查询只能通过本类处理方言差异。
    /// </summary>
    public static class SqlDialectCompatibility
    {
        /// <summary>
        /// 兼容旧表单引擎把分页表达式写在 SELECT 列表中的查询形态。
        /// 仅 SQL Server 需要 TOP/ROW_NUMBER；其它数据库由查询尾部分页处理。
        /// </summary>
        public static string ApplyLegacySelectPrefix(
            DatabaseType databaseType,
            string selectColumns,
            bool isTree,
            int? pageIndex,
            int? pageSize,
            int? top)
        {
            if (selectColumns == null) throw new ArgumentNullException(nameof(selectColumns));
            if (isTree || !UsesRowNumberPagination(databaseType)) return selectColumns;

            if (pageIndex.HasValue && pageSize.HasValue)
            {
                return pageIndex.Value == 1
                    ? " TOP " + pageSize.Value + " " + selectColumns
                    : "ROW_NUMBER() OVER($ROW_NUMBER_OVER$) AS _ROW_NUMBER, " + selectColumns;
            }

            return top.HasValue
                ? " TOP " + top.Value + " " + selectColumns
                : selectColumns;
        }

        /// <summary>
        /// 为旧表单引擎查询落入排序表达式。SQL Server 的后续页把排序写入
        /// ROW_NUMBER 占位符，其它情况直接追加 ORDER BY。
        /// </summary>
        public static string ApplyLegacyOrderBy(
            DatabaseType databaseType,
            string sql,
            string orderBySql,
            int? pageIndex,
            int? pageSize,
            int? top)
        {
            if (sql == null) throw new ArgumentNullException(nameof(sql));
            if (orderBySql == null) throw new ArgumentNullException(nameof(orderBySql));

            var useRowNumber = UsesRowNumberPagination(databaseType)
                && !(pageIndex.HasValue && pageSize.HasValue && pageIndex.Value == 1)
                && !top.HasValue;
            return useRowNumber
                ? sql.Replace("$ROW_NUMBER_OVER$", orderBySql)
                : sql + orderBySql;
        }

        /// <summary>
        /// 为已包含 SELECT/FROM/WHERE 的查询增加确定性排序和分页。
        /// selectSql 与 orderBySql 必须是服务端生成的结构化片段，动态值仍须使用参数绑定。
        /// </summary>
        public static string ApplyPagination(
            DbProvider provider,
            string selectSql,
            string orderBySql,
            int pageIndex,
            int pageSize)
        {
            if (provider == null) throw new ArgumentNullException(nameof(provider));
            if (string.IsNullOrWhiteSpace(selectSql))
                throw new ArgumentException("查询 SQL 不能为空。", nameof(selectSql));
            if (string.IsNullOrWhiteSpace(orderBySql))
                throw new ArgumentException("分页必须提供确定性排序。", nameof(orderBySql));
            if (pageIndex < 1) throw new ArgumentOutOfRangeException(nameof(pageIndex));
            if (pageSize < 1) throw new ArgumentOutOfRangeException(nameof(pageSize));

            var offset = checked((pageIndex - 1) * pageSize);
            var orderedSql = selectSql.TrimEnd().TrimEnd(';') + " ORDER BY " + orderBySql;
            switch (provider.DatabaseType)
            {
                case DatabaseType.MySql:
                case DatabaseType.PostgreSql:
                case DatabaseType.KingBase:
                case DatabaseType.Sqlite3:
                    return orderedSql + " LIMIT " + pageSize + " OFFSET " + offset;
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9:
                case DatabaseType.Oracle:
                case DatabaseType.DaMeng:
                    return orderedSql + " OFFSET " + offset + " ROWS FETCH NEXT " + pageSize + " ROWS ONLY";
                default:
                    throw new NotSupportedException(
                        "分页不支持数据库类型：" + provider.DatabaseType);
            }
        }

        private static bool UsesRowNumberPagination(DatabaseType databaseType)
        {
            return databaseType == DatabaseType.SqlServer
                || databaseType == DatabaseType.SqlServer9;
        }
    }
}

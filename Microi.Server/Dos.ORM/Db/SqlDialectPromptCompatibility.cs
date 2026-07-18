using System;

namespace Dos.ORM
{
    /// <summary>
    /// 为 NL2SQL 等受控生成场景提供与当前数据库一致的日期查询示例。
    /// 方言文本集中在 Dos.ORM，AI/业务层不维护数据库类型分支。
    /// </summary>
    public static class SqlDialectPromptCompatibility
    {
        public static string GetDatabaseDisplayName(DbProvider provider)
        {
            if (provider == null) throw new ArgumentNullException(nameof(provider));
            switch (provider.DatabaseType)
            {
                case DatabaseType.MySql: return "MySQL";
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9: return "SQL Server";
                case DatabaseType.PostgreSql: return "PostgreSQL";
                case DatabaseType.Oracle: return "Oracle";
                case DatabaseType.DaMeng: return "达梦 DM8";
                case DatabaseType.KingBase: return "人大金仓 KingbaseES";
                default: return provider.DatabaseType.ToString();
            }
        }

        public static string BuildCreateTimeExamples(DbProvider provider)
        {
            if (provider == null) throw new ArgumentNullException(nameof(provider));
            string today;
            string yesterday;
            string tomorrow;
            string monthStart;
            string nextMonth;
            string sevenDaysAgo;
            string dateBucket;
            switch (provider.DatabaseType)
            {
                case DatabaseType.MySql:
                    today = "CURRENT_DATE";
                    yesterday = "CURRENT_DATE - INTERVAL 1 DAY";
                    tomorrow = "CURRENT_DATE + INTERVAL 1 DAY";
                    monthStart = "DATE_FORMAT(CURRENT_DATE, '%Y-%m-01')";
                    nextMonth = "DATE_ADD(DATE_FORMAT(CURRENT_DATE, '%Y-%m-01'), INTERVAL 1 MONTH)";
                    sevenDaysAgo = "CURRENT_DATE - INTERVAL 6 DAY";
                    dateBucket = "DATE(CreateTime)";
                    break;
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9:
                    today = "CAST(GETDATE() AS date)";
                    yesterday = "DATEADD(day, -1, CAST(GETDATE() AS date))";
                    tomorrow = "DATEADD(day, 1, CAST(GETDATE() AS date))";
                    monthStart = "DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1)";
                    nextMonth = "DATEADD(month, 1, DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1))";
                    sevenDaysAgo = "DATEADD(day, -6, CAST(GETDATE() AS date))";
                    dateBucket = "CAST(CreateTime AS date)";
                    break;
                case DatabaseType.PostgreSql:
                case DatabaseType.KingBase:
                    today = "CURRENT_DATE";
                    yesterday = "CURRENT_DATE - INTERVAL '1 day'";
                    tomorrow = "CURRENT_DATE + INTERVAL '1 day'";
                    monthStart = "date_trunc('month', CURRENT_DATE)";
                    nextMonth = "date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'";
                    sevenDaysAgo = "CURRENT_DATE - INTERVAL '6 days'";
                    dateBucket = "CAST(CreateTime AS date)";
                    break;
                case DatabaseType.Oracle:
                case DatabaseType.DaMeng:
                    today = "TRUNC(SYSDATE)";
                    yesterday = "TRUNC(SYSDATE) - 1";
                    tomorrow = "TRUNC(SYSDATE) + 1";
                    monthStart = "TRUNC(SYSDATE, 'MM')";
                    nextMonth = "ADD_MONTHS(TRUNC(SYSDATE, 'MM'), 1)";
                    sevenDaysAgo = "TRUNC(SYSDATE) - 6";
                    dateBucket = "TRUNC(CreateTime)";
                    break;
                default:
                    throw new NotSupportedException("NL2SQL 日期示例不支持数据库类型：" + provider.DatabaseType);
            }

            return "- 今天：WHERE CreateTime >= " + today + " AND CreateTime < " + tomorrow + "\n"
                + "- 昨天：WHERE CreateTime >= " + yesterday + " AND CreateTime < " + today + "\n"
                + "- 本月：WHERE CreateTime >= " + monthStart + " AND CreateTime < " + nextMonth + "\n"
                + "- 今天订单：SELECT COUNT(*) AS ResultCount FROM diy_order WHERE CreateTime >= " + today + " AND CreateTime < " + tomorrow + "\n"
                + "- 近7天每天订单：SELECT " + dateBucket + " AS ResultDate, COUNT(*) AS ResultCount FROM diy_order WHERE CreateTime >= "
                + sevenDaysAgo + " AND CreateTime < " + tomorrow + " GROUP BY " + dateBucket + " ORDER BY ResultDate";
        }
    }
}

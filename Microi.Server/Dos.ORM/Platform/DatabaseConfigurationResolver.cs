using System;

namespace Dos.ORM.Platform
{
    /// <summary>
    /// 将租户配置中的数据库名称严格解析为 Dos.ORM 运行时信息。
    /// 配置缺失或未知时快速失败，禁止静默回退到 MySQL。
    /// </summary>
    public static class DatabaseConfigurationResolver
    {
        public static DbInfo Resolve(string configuredName)
        {
            if (string.IsNullOrWhiteSpace(configuredName))
                throw new ArgumentException("数据库类型配置不能为空。", nameof(configuredName));

            switch (configuredName.Trim().ToLowerInvariant())
            {
                case "mysql":
                case "mysql5.7":
                case "mysql8":
                    return Create('`', '`', '?', DatabaseType.MySql);
                case "sqlserver":
                case "mssql":
                    return Create('[', ']', '@', DatabaseType.SqlServer);
                case "sqlserver9":
                    return Create('[', ']', '@', DatabaseType.SqlServer9);
                case "oracle":
                case "oracle11g":
                case "oracle19c":
                    return Create('"', '"', ':', DatabaseType.Oracle);
                case "postgresql":
                case "postgres":
                case "pgsql":
                case "npgsql":
                    return Create('"', '"', '@', DatabaseType.PostgreSql);
                case "dameng":
                case "dameng8":
                case "dm":
                case "dm8":
                    return Create('"', '"', ':', DatabaseType.DaMeng);
                case "kingbase":
                case "kingbasees":
                case "kingbasees-v9":
                case "kdbndp":
                    return Create('"', '"', ':', DatabaseType.KingBase);
                case "sqlite3":
                case "sqlite":
                    return Create('[', ']', '@', DatabaseType.Sqlite3);
                case "msaccess":
                case "access":
                    return Create('[', ']', '@', DatabaseType.MsAccess);
                default:
                    throw new NotSupportedException(
                        "Dos.ORM 不支持数据库类型配置：" + configuredName.Trim());
            }
        }

        private static DbInfo Create(
            char left,
            char right,
            char parameter,
            DatabaseType databaseType)
        {
            return new DbInfo
            {
                L = left,
                R = right,
                P = parameter,
                DbType = databaseType
            };
        }
    }
}

using System;

namespace Dos.ORM
{
    /// <summary>
    /// 按数据库提供程序补齐连接参数。应用层只传配置值，不维护供应商分支。
    /// </summary>
    public static class ConnectionStringCompatibility
    {
        public static string Normalize(
            DatabaseType databaseType,
            string connectionString,
            int maxPoolSize,
            int connectionLifetime)
        {
            if (string.IsNullOrWhiteSpace(connectionString)) return connectionString;
            if (databaseType != DatabaseType.MySql) return connectionString;

            var normalized = connectionString;
            var lower = normalized.ToLowerInvariant();
            if (!lower.Contains("sslmode"))
                normalized = Append(normalized, "sslmode=None");
            if (!lower.Contains("pool"))
                normalized = Append(normalized, "Max Pool Size=" + maxPoolSize);
            if (!lower.Contains("connection lifetime") && !lower.Contains("connectionlifetime"))
                normalized = Append(normalized, "Connection Lifetime=" + connectionLifetime);
            return normalized;
        }

        private static string Append(string connectionString, string parameter)
        {
            return connectionString.EndsWith(";", StringComparison.Ordinal)
                ? connectionString + parameter + ";"
                : connectionString + ";" + parameter + ";";
        }
    }
}

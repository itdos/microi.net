using System;
using System.Text.RegularExpressions;

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
            return Normalize(
                databaseType,
                connectionString,
                maxPoolSize,
                connectionLifetime,
                600);
        }

        /// <summary>
        /// 统一补齐数据库提供程序所需的兼容参数。所有从配置、V8 动态连接或
        /// MCP 临时连接创建的会话都应经过这里，避免应用层重复维护供应商分支。
        /// </summary>
        public static string Normalize(
            DatabaseType databaseType,
            string connectionString,
            int maxPoolSize,
            int connectionLifetime,
            int defaultCommandTimeoutSeconds)
        {
            if (string.IsNullOrWhiteSpace(connectionString)) return connectionString;
            if (databaseType != DatabaseType.MySql) return connectionString;

            var normalized = NormalizeMySqlSslMode(connectionString);
            if (!Contains(normalized, "sslmode") && !Contains(normalized, "ssl mode"))
                normalized = Append(normalized, "SslMode=Disabled");
            if (!Contains(normalized, "max pool size") && !Contains(normalized, "maxpoolsize"))
                normalized = Append(normalized, "Max Pool Size=" + maxPoolSize);
            if (!Contains(normalized, "connection lifetime") && !Contains(normalized, "connectionlifetime"))
                normalized = Append(normalized, "Connection Lifetime=" + connectionLifetime);
            if (!Contains(normalized, "connectionreset") && !Contains(normalized, "connection reset"))
                normalized = Append(normalized, "Connection Reset=true");
            if (!Contains(normalized, "defaultcommandtimeout") && !Contains(normalized, "default command timeout"))
                normalized = Append(normalized, "Default Command Timeout=" + defaultCommandTimeoutSeconds);
            if (!Contains(normalized, "allowuservariables") && !Contains(normalized, "allow user variables"))
                normalized = Append(normalized, "Allow User Variables=True");
            if (!Contains(normalized, "useaffectedrows") && !Contains(normalized, "use affected rows"))
                normalized = Append(normalized, "Use Affected Rows=False");
            return normalized;
        }

        /// <summary>
        /// MySql.Data 9.7 removed the historical MySqlSslMode.None enum value.
        /// Preserve existing tenant configuration by translating the old spelling
        /// to its current equivalent before the provider parses the connection string.
        /// </summary>
        private static string NormalizeMySqlSslMode(string connectionString)
        {
            return Regex.Replace(
                connectionString,
                @"(?i)(^|;)\s*(ssl\s*mode)\s*=\s*(none|false)\s*(?=;|$)",
                "$1$2=Disabled");
        }

        private static bool Contains(string connectionString, string fragment)
        {
            return connectionString.IndexOf(fragment, StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static string Append(string connectionString, string parameter)
        {
            return connectionString.EndsWith(";", StringComparison.Ordinal)
                ? connectionString + parameter + ";"
                : connectionString + ";" + parameter + ";";
        }
    }
}

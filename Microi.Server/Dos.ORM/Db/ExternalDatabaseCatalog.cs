using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Text.RegularExpressions;

namespace Dos.ORM
{
    /// <summary>
    /// Dos.ORM 已认证数据库类型的公开描述。连接示例只包含占位密码，严禁放入真实密钥。
    /// </summary>
    public sealed class ExternalDatabaseDefinition
    {
        public string Key { get; set; }
        public string DisplayName { get; set; }
        public DatabaseType DatabaseType { get; set; }
        public int DefaultPort { get; set; }
        public IReadOnlyList<string> Aliases { get; set; }
        public string ConnectionStringExample { get; set; }
    }

    /// <summary>
    /// 外部数据库类型、连接创建、DDL 元数据服务的单一事实源。
    /// </summary>
    public static class ExternalDatabaseCatalog
    {
        private static readonly ExternalDatabaseDefinition[] DefinitionsInternal =
        {
            Define("MySql", "MySQL", DatabaseType.MySql, 3306,
                "Server=127.0.0.1;Port=3306;Database=demo;Uid=user;Pwd=***;Charset=utf8mb4;",
                "mysql", "mysql5.7", "mysql8"),
            Define("SqlServer", "SQL Server", DatabaseType.SqlServer, 1433,
                "Server=127.0.0.1,1433;Database=demo;User Id=sa;Password=***;TrustServerCertificate=True;",
                "sqlserver", "sqlserver9", "mssql"),
            Define("Oracle", "Oracle", DatabaseType.Oracle, 1521,
                "User Id=user;Password=***;Data Source=127.0.0.1:1521/ORCL;",
                "oracle", "oracle11g", "oracle19c"),
            Define("PostgreSql", "PostgreSQL", DatabaseType.PostgreSql, 5432,
                "Host=127.0.0.1;Port=5432;Database=demo;Username=user;Password=***;",
                "postgresql", "postgres", "pgsql", "npgsql"),
            Define("DaMeng", "达梦 DM8", DatabaseType.DaMeng, 5236,
                "Server=127.0.0.1;Port=5236;User Id=SYSDBA;Password=***;",
                "dameng", "dameng8", "dm", "dm8"),
            Define("KingBase", "人大金仓 KingbaseES V9", DatabaseType.KingBase, 54321,
                "Host=127.0.0.1;Port=54321;Database=demo;Username=system;Password=***;",
                "kingbase", "kingbasees", "kingbasees-v9", "kdbndp")
        };

        public static IReadOnlyList<ExternalDatabaseDefinition> Definitions => DefinitionsInternal;

        public static ExternalDatabaseDefinition Resolve(string configuredName)
        {
            if (string.IsNullOrWhiteSpace(configuredName))
                throw new ArgumentException("数据库类型不能为空。", nameof(configuredName));

            var value = configuredName.Trim();
            var definition = DefinitionsInternal.FirstOrDefault(item =>
                string.Equals(item.Key, value, StringComparison.OrdinalIgnoreCase)
                || item.Aliases.Any(alias => string.Equals(alias, value, StringComparison.OrdinalIgnoreCase)));
            if (definition == null)
            {
                throw new NotSupportedException(
                    "Dos.ORM 尚未认证数据库类型：" + value
                    + "。当前支持：" + string.Join("、", DefinitionsInternal.Select(item => item.Key)) + "。");
            }
            return definition;
        }

        public static DatabaseType ResolveType(string configuredName)
        {
            return Resolve(configuredName).DatabaseType;
        }

        public static DbSession CreateSession(
            string configuredName,
            string connectionString,
            int maxPoolSize = 100,
            int connectionLifetime = 300,
            int defaultCommandTimeoutSeconds = 600)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
                throw new ArgumentException("数据库连接字符串不能为空。", nameof(connectionString));

            var definition = Resolve(configuredName);
            var normalized = ConnectionStringCompatibility.Normalize(
                definition.DatabaseType,
                connectionString,
                Math.Max(1, maxPoolSize),
                Math.Max(0, connectionLifetime),
                Math.Max(1, defaultCommandTimeoutSeconds));
            return new DbSession(definition.DatabaseType, normalized);
        }

        public static IMicroiORM CreateMetadataService(DatabaseType databaseType)
        {
            switch (databaseType)
            {
                case DatabaseType.MySql: return new MySqlService();
                case DatabaseType.SqlServer: return new SqlServerService();
                case DatabaseType.Oracle: return new OracleService();
                case DatabaseType.PostgreSql: return new PostgreSqlService();
                case DatabaseType.DaMeng: return new DaMengService();
                case DatabaseType.KingBase: return new KingBaseService();
                default:
                    throw new NotSupportedException("尚未认证数据库类型：" + databaseType + "。");
            }
        }

        public static string RedactConnectionString(string connectionString)
        {
            if (string.IsNullOrWhiteSpace(connectionString)) return string.Empty;
            try
            {
                var builder = new DbConnectionStringBuilder { ConnectionString = connectionString };
                foreach (var key in builder.Keys.Cast<object>().Select(item => Convert.ToString(item)).ToArray())
                {
                    if (IsSensitiveKey(key)) builder[key] = "***";
                }
                return builder.ConnectionString;
            }
            catch
            {
                return Regex.Replace(
                    connectionString,
                    @"(?i)(password|pwd|user\s*id|uid|username)\s*=\s*[^;]*",
                    "$1=***");
            }
        }

        public static string SanitizeError(string message, string connectionString = null)
        {
            var result = message ?? "未知数据库错误";
            if (!string.IsNullOrWhiteSpace(connectionString))
            {
                result = Regex.Replace(
                    result,
                    Regex.Escape(connectionString),
                    "[REDACTED_CONNECTION_STRING]",
                    RegexOptions.IgnoreCase);
            }
            return Regex.Replace(
                result,
                @"(?i)(password|pwd|user\s*id|uid|username)\s*=\s*[^;\s,]*",
                "$1=***");
        }

        private static ExternalDatabaseDefinition Define(
            string key,
            string displayName,
            DatabaseType databaseType,
            int defaultPort,
            string example,
            params string[] aliases)
        {
            return new ExternalDatabaseDefinition
            {
                Key = key,
                DisplayName = displayName,
                DatabaseType = databaseType,
                DefaultPort = defaultPort,
                ConnectionStringExample = example,
                Aliases = aliases
            };
        }

        private static bool IsSensitiveKey(string key)
        {
            var value = (key ?? string.Empty).Replace(" ", string.Empty).ToLowerInvariant();
            return value == "password" || value == "pwd" || value == "userid"
                   || value == "uid" || value == "username" || value == "token"
                   || value == "secret" || value == "apikey";
        }
    }
}

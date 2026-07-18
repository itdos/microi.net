using System;
using System.Data.Common;
using System.Text.RegularExpressions;

namespace Dos.ORM
{
    /// <summary>
    /// 数据库级租户开通所需的受控管理语句。数据库名必须先通过标识符校验；
    /// Oracle/达梦采用用户/schema 模型，无法从普通业务连接自动推导 DBA 凭据，故明确阻断。
    /// </summary>
    public static class DatabaseAdministrationCompatibility
    {
        public static string BuildMasterConnectionString(
            DatabaseType databaseType,
            string connectionString)
        {
            var databaseName = databaseType switch
            {
                DatabaseType.MySql => "mysql",
                DatabaseType.SqlServer => "master",
                DatabaseType.SqlServer9 => "master",
                DatabaseType.PostgreSql => "postgres",
                // 金仓安装时默认库名可由 DBA 自定义；使用当前连接所在库执行管理语句。
                DatabaseType.KingBase => null,
                DatabaseType.Oracle => throw SchemaProvisioningRequired(databaseType),
                DatabaseType.DaMeng => throw SchemaProvisioningRequired(databaseType),
                _ => throw new NotSupportedException("不支持数据库级租户开通：" + databaseType)
            };
            return databaseName == null
                ? connectionString
                : ReplaceDatabaseName(connectionString, databaseName);
        }

        public static string BuildDatabaseConnectionString(
            DatabaseType databaseType,
            string connectionString,
            string databaseName)
        {
            EnsureDatabaseName(databaseName);
            if (databaseType == DatabaseType.Oracle || databaseType == DatabaseType.DaMeng)
                throw SchemaProvisioningRequired(databaseType);
            return ReplaceDatabaseName(connectionString, databaseName);
        }

        public static DatabaseAdministrationCommands BuildCommands(
            DatabaseType databaseType,
            string databaseName)
        {
            EnsureDatabaseName(databaseName);
            switch (databaseType)
            {
                case DatabaseType.MySql:
                    return new DatabaseAdministrationCommands(
                        "SELECT COUNT(1) FROM information_schema.schemata WHERE schema_name = @p0",
                        "CREATE DATABASE `" + databaseName + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci",
                        "DROP DATABASE IF EXISTS `" + databaseName + "`");
                case DatabaseType.SqlServer:
                case DatabaseType.SqlServer9:
                    return new DatabaseAdministrationCommands(
                        "SELECT COUNT(1) FROM sys.databases WHERE name = @p0",
                        "CREATE DATABASE [" + databaseName + "]",
                        "IF DB_ID(@p0) IS NOT NULL BEGIN ALTER DATABASE [" + databaseName
                            + "] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE ["
                            + databaseName + "]; END");
                case DatabaseType.PostgreSql:
                case DatabaseType.KingBase:
                    return new DatabaseAdministrationCommands(
                        "SELECT COUNT(1) FROM pg_database WHERE datname = @p0",
                        "CREATE DATABASE \"" + databaseName + "\" ENCODING 'UTF8' TEMPLATE template0",
                        "DROP DATABASE IF EXISTS \"" + databaseName + "\"");
                case DatabaseType.Oracle:
                case DatabaseType.DaMeng:
                    throw SchemaProvisioningRequired(databaseType);
                default:
                    throw new NotSupportedException("不支持数据库级租户开通：" + databaseType);
            }
        }

        private static string ReplaceDatabaseName(string connectionString, string databaseName)
        {
            if (string.IsNullOrWhiteSpace(connectionString))
                throw new ArgumentException("连接字符串不能为空。", nameof(connectionString));

            var builder = new DbConnectionStringBuilder { ConnectionString = connectionString };
            if (builder.ContainsKey("Initial Catalog"))
                builder["Initial Catalog"] = databaseName;
            else if (builder.ContainsKey("Database"))
                builder["Database"] = databaseName;
            else
                builder["Database"] = databaseName;
            return builder.ConnectionString;
        }

        private static void EnsureDatabaseName(string databaseName)
        {
            if (!Regex.IsMatch(databaseName ?? string.Empty, "^[a-zA-Z_][a-zA-Z0-9_]*$"))
                throw new ArgumentException("数据库名称只允许字母、数字和下划线，且不能以数字开头。", nameof(databaseName));
        }

        private static NotSupportedException SchemaProvisioningRequired(DatabaseType databaseType)
        {
            return new NotSupportedException(
                databaseType + " 的租户开通必须由 DBA 提供用户/schema 与表空间配置，"
                + "不能使用普通业务连接执行 CREATE DATABASE。");
        }
    }

    public sealed class DatabaseAdministrationCommands
    {
        internal DatabaseAdministrationCommands(string existsSql, string createSql, string dropSql)
        {
            ExistsSql = existsSql;
            CreateSql = createSql;
            DropSql = dropSql;
        }

        public string ExistsSql { get; }
        public string CreateSql { get; }
        public string DropSql { get; }
    }
}

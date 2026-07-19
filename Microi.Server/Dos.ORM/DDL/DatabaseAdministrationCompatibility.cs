using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
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

        /// <summary>
        /// 为租户数据库生成确定性的、受数据库长度约束的登录账号。
        /// 账号只由已校验的数据库名和稳定哈希组成，不直接使用外部输入。
        /// </summary>
        public static string BuildTenantPrincipalName(
            DatabaseType databaseType,
            string databaseName)
        {
            EnsureDatabaseName(databaseName);
            if (databaseType != DatabaseType.MySql)
                throw PrincipalProvisioningRequired(databaseType);

            var normalized = Regex.Replace(databaseName.ToLowerInvariant(), "[^a-z0-9_]", "_");
            var prefix = normalized.Length > 18 ? normalized.Substring(0, 18) : normalized;
            string hash;
            using (var sha256 = SHA256.Create())
            {
                var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(databaseName));
                hash = BitConverter.ToString(bytes).Replace("-", "").ToLowerInvariant().Substring(0, 8);
            }
            return "mci_" + prefix + "_" + hash;
        }

        /// <summary>
        /// 生成不包含连接字符串分隔符的密码，便于安全写入各数据库驱动连接串。
        /// </summary>
        public static string GenerateSecurePassword(int length = 32)
        {
            if (length < 24 || length > 128)
                throw new ArgumentOutOfRangeException(nameof(length), "密码长度必须在 24 到 128 之间。");

            const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
            const string lower = "abcdefghijkmnopqrstuvwxyz";
            const string digits = "23456789";
            const string special = "!@$%_-";
            const string alphabet = upper + lower + digits + special;
            var output = new char[length];
            using (var rng = RandomNumberGenerator.Create())
            {
                output[0] = upper[NextUniformIndex(rng, upper.Length)];
                output[1] = lower[NextUniformIndex(rng, lower.Length)];
                output[2] = digits[NextUniformIndex(rng, digits.Length)];
                output[3] = special[NextUniformIndex(rng, special.Length)];
                for (var index = 4; index < output.Length; index++)
                    output[index] = alphabet[NextUniformIndex(rng, alphabet.Length)];
                for (var index = output.Length - 1; index > 0; index--)
                {
                    var swapIndex = NextUniformIndex(rng, index + 1);
                    var temp = output[index];
                    output[index] = output[swapIndex];
                    output[swapIndex] = temp;
                }
            }
            return new string(output);
        }

        private static int NextUniformIndex(RandomNumberGenerator rng, int exclusiveUpperBound)
        {
            if (exclusiveUpperBound <= 0 || exclusiveUpperBound > 256)
                throw new ArgumentOutOfRangeException(nameof(exclusiveUpperBound));
            var acceptanceLimit = 256 - (256 % exclusiveUpperBound);
            var random = new byte[1];
            do
            {
                rng.GetBytes(random);
            } while (random[0] >= acceptanceLimit);
            return random[0] % exclusiveUpperBound;
        }

        /// <summary>
        /// 构建数据库内最小授权账号的管理语句。密码始终通过参数传入，
        /// 数据库名和账号名必须先通过严格标识符校验。
        /// </summary>
        public static DatabasePrincipalAdministrationCommands BuildPrincipalCommands(
            DatabaseType databaseType,
            string databaseName,
            string principalName,
            string host = "%")
        {
            EnsureDatabaseName(databaseName);
            EnsurePrincipalName(principalName);
            if (databaseType != DatabaseType.MySql)
                throw PrincipalProvisioningRequired(databaseType);
            if (host != "%" && !Regex.IsMatch(host ?? string.Empty, "^[a-zA-Z0-9._:-]+$"))
                throw new ArgumentException("数据库账号 Host 不合法。", nameof(host));

            var account = "'" + principalName + "'@'" + host + "'";
            return new DatabasePrincipalAdministrationCommands(
                "SELECT COUNT(1) FROM mysql.user WHERE User=@p0 AND Host=@p1",
                "CREATE USER " + account + " IDENTIFIED BY @p0",
                "ALTER USER " + account + " IDENTIFIED BY @p0",
                "GRANT ALL PRIVILEGES ON `" + databaseName + "`.* TO " + account,
                "DROP USER IF EXISTS " + account);
        }

        /// <summary>
        /// 从管理连接串构建只允许访问目标租户库的账号连接串。
        /// 会移除 uid/pwd 等别名，避免同一连接串残留两套凭据。
        /// </summary>
        public static string BuildScopedConnectionString(
            DatabaseType databaseType,
            string connectionString,
            string databaseName,
            string principalName,
            string password)
        {
            EnsureDatabaseName(databaseName);
            EnsurePrincipalName(principalName);
            if (string.IsNullOrWhiteSpace(password))
                throw new ArgumentException("数据库账号密码不能为空。", nameof(password));
            if (databaseType != DatabaseType.MySql)
                throw PrincipalProvisioningRequired(databaseType);

            var builder = new DbConnectionStringBuilder { ConnectionString = connectionString };
            RemoveAliases(builder, new[] { "Database", "Initial Catalog" });
            RemoveAliases(builder, new[] { "User ID", "User Id", "UID", "User", "Username", "User Name" });
            RemoveAliases(builder, new[] { "Password", "PWD" });
            builder["Database"] = databaseName;
            builder["User ID"] = principalName;
            builder["Password"] = password;
            return builder.ConnectionString;
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

        private static void EnsurePrincipalName(string principalName)
        {
            if (!Regex.IsMatch(principalName ?? string.Empty, "^[a-zA-Z_][a-zA-Z0-9_]{0,31}$"))
                throw new ArgumentException("数据库账号只允许字母、数字和下划线，长度不能超过 32。", nameof(principalName));
        }

        private static void RemoveAliases(DbConnectionStringBuilder builder, IEnumerable<string> aliases)
        {
            var aliasSet = new HashSet<string>(aliases, StringComparer.OrdinalIgnoreCase);
            var keys = builder.Keys.Cast<object>().Select(key => key?.ToString()).Where(key => key != null).ToArray();
            foreach (var key in keys)
            {
                if (aliasSet.Contains(key)) builder.Remove(key);
            }
        }

        private static NotSupportedException SchemaProvisioningRequired(DatabaseType databaseType)
        {
            return new NotSupportedException(
                databaseType + " 的租户开通必须由 DBA 提供用户/schema 与表空间配置，"
                + "不能使用普通业务连接执行 CREATE DATABASE。");
        }

        private static NotSupportedException PrincipalProvisioningRequired(DatabaseType databaseType)
        {
            return new NotSupportedException(
                databaseType + " 的租户数据库账号开通尚未配置受控 DBA 契约，已拒绝回退使用主库账号。");
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

    public sealed class DatabasePrincipalAdministrationCommands
    {
        internal DatabasePrincipalAdministrationCommands(
            string existsSql,
            string createSql,
            string alterPasswordSql,
            string grantSql,
            string dropSql)
        {
            ExistsSql = existsSql;
            CreateSql = createSql;
            AlterPasswordSql = alterPasswordSql;
            GrantSql = grantSql;
            DropSql = dropSql;
        }

        public string ExistsSql { get; }
        public string CreateSql { get; }
        public string AlterPasswordSql { get; }
        public string GrantSql { get; }
        public string DropSql { get; }
    }
}

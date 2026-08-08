using System;
using System.Collections.Generic;
using System.Data.Common;
using System.Text;
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

            var normalized = RepairUnquotedMySqlCredentialSemicolons(connectionString);
            normalized = NormalizeMySqlSslMode(normalized);
            if (!ContainsOption(normalized, "sslmode"))
                normalized = Append(normalized, "SslMode=Disabled");
            if (!ContainsOption(normalized, "maxpoolsize", "maximumpoolsize"))
                normalized = Append(normalized, "Max Pool Size=" + maxPoolSize);
            if (!ContainsOption(normalized, "connectionlifetime"))
                normalized = Append(normalized, "Connection Lifetime=" + connectionLifetime);
            if (!ContainsOption(normalized, "connectionreset"))
                normalized = Append(normalized, "Connection Reset=true");
            if (!ContainsOption(normalized, "defaultcommandtimeout"))
                normalized = Append(normalized, "Default Command Timeout=" + defaultCommandTimeoutSeconds);
            if (!ContainsOption(normalized, "allowuservariables"))
                normalized = Append(normalized, "Allow User Variables=True");
            if (!ContainsOption(normalized, "useaffectedrows"))
                normalized = Append(normalized, "Use Affected Rows=False");
            return normalized;
        }

        /// <summary>
        /// 历史配置可能直接拼接用户名或密码。当凭据中包含分号且未按连接字符串语法
        /// 加引号时，提供程序会把分号后的内容误判成参数名，例如抛出
        /// Option not supported (Parameter 'user;sslmode')。只在无等号片段紧跟已明确的
        /// 用户名/密码参数时，将其还原为凭据的一部分；其它未知片段继续失败关闭。
        /// </summary>
        private static string RepairUnquotedMySqlCredentialSemicolons(string connectionString)
        {
            var segments = SplitSegments(connectionString);
            var repaired = false;
            var credentialIndex = -1;
            var credentialKey = string.Empty;
            var credentialValue = string.Empty;

            for (var index = 0; index < segments.Count; index++)
            {
                var segment = segments[index];
                if (string.IsNullOrWhiteSpace(segment))
                {
                    credentialIndex = -1;
                    continue;
                }

                if (TrySplitPair(segment, out var key, out var value))
                {
                    if (IsCredentialKey(key))
                    {
                        credentialIndex = index;
                        credentialKey = key.Trim();
                        credentialValue = ReadPairValue(segment, credentialKey, value);
                    }
                    else
                    {
                        credentialIndex = -1;
                    }
                    continue;
                }

                if (credentialIndex < 0) continue;

                credentialValue += ";" + segment.Trim();
                segments[credentialIndex] = FormatPair(credentialKey, credentialValue);
                segments[index] = string.Empty;
                repaired = true;
            }

            if (!repaired) return connectionString;

            var result = new StringBuilder(connectionString.Length + 8);
            foreach (var segment in segments)
            {
                if (string.IsNullOrWhiteSpace(segment)) continue;
                if (result.Length > 0) result.Append(';');
                result.Append(segment.Trim());
            }
            if (connectionString.EndsWith(";", StringComparison.Ordinal)) result.Append(';');
            return result.ToString();
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

        private static bool ContainsOption(string connectionString, params string[] optionNames)
        {
            foreach (var segment in SplitSegments(connectionString))
            {
                if (!TrySplitPair(segment, out var key, out _)) continue;
                var normalizedKey = NormalizeKey(key);
                foreach (var optionName in optionNames)
                {
                    if (string.Equals(normalizedKey, NormalizeKey(optionName), StringComparison.Ordinal))
                        return true;
                }
            }
            return false;
        }

        private static List<string> SplitSegments(string connectionString)
        {
            var result = new List<string>();
            var current = new StringBuilder();
            var quote = '\0';

            for (var index = 0; index < connectionString.Length; index++)
            {
                var value = connectionString[index];
                if (quote != '\0')
                {
                    current.Append(value);
                    if (value != quote) continue;
                    if (index + 1 < connectionString.Length && connectionString[index + 1] == quote)
                    {
                        current.Append(connectionString[++index]);
                    }
                    else
                    {
                        quote = '\0';
                    }
                    continue;
                }

                if (value == '\'' || value == '"')
                {
                    quote = value;
                    current.Append(value);
                    continue;
                }

                if (value == ';')
                {
                    result.Add(current.ToString());
                    current.Clear();
                    continue;
                }

                current.Append(value);
            }

            result.Add(current.ToString());
            return result;
        }

        private static bool TrySplitPair(string segment, out string key, out string value)
        {
            var separator = segment.IndexOf('=');
            if (separator <= 0)
            {
                key = string.Empty;
                value = string.Empty;
                return false;
            }

            key = segment.Substring(0, separator);
            value = segment.Substring(separator + 1);
            return !string.IsNullOrWhiteSpace(key);
        }

        private static bool IsCredentialKey(string key)
        {
            switch (NormalizeKey(key))
            {
                case "password":
                case "pwd":
                case "userid":
                case "uid":
                case "username":
                case "user":
                    return true;
                default:
                    return false;
            }
        }

        private static string NormalizeKey(string key)
        {
            if (string.IsNullOrWhiteSpace(key)) return string.Empty;
            var result = new StringBuilder(key.Length);
            foreach (var value in key)
            {
                if (char.IsWhiteSpace(value) || value == '-' || value == '_') continue;
                result.Append(char.ToLowerInvariant(value));
            }
            return result.ToString();
        }

        private static string FormatPair(string key, string value)
        {
            var builder = new DbConnectionStringBuilder
            {
                [key] = value
            };
            return builder.ConnectionString.TrimEnd(';');
        }

        private static string ReadPairValue(string segment, string key, string fallback)
        {
            try
            {
                var builder = new DbConnectionStringBuilder
                {
                    ConnectionString = segment
                };
                return builder[key]?.ToString() ?? fallback.Trim();
            }
            catch (ArgumentException)
            {
                return fallback.Trim();
            }
        }

        private static string Append(string connectionString, string parameter)
        {
            return connectionString.EndsWith(";", StringComparison.Ordinal)
                ? connectionString + parameter + ";"
                : connectionString + ";" + parameter + ";";
        }
    }
}

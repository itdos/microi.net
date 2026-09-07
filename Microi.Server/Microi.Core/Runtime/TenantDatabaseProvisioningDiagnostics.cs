using System;
using System.Data.Common;
using System.Linq;
using System.Text.RegularExpressions;

namespace Microi.net
{
    /// <summary>数据库开通失败的用户指引与管理员原始诊断，保留异常链但不暴露连接密码。</summary>
    public sealed class TenantDatabaseProvisioningException : Exception
    {
        public string Stage { get; }
        public string Category { get; }
        public string Resolution { get; }
        public string ConnectionDescription { get; }
        public string OriginalError { get; }

        private TenantDatabaseProvisioningException(string message, Exception inner,
            string stage, string category, string resolution, string connectionDescription, string originalError)
            : base(message, inner)
        {
            Stage = stage;
            Category = category;
            Resolution = resolution;
            ConnectionDescription = connectionDescription;
            OriginalError = originalError;
        }

        public string ToAdministratorMessage() => Message + "\n" + ConnectionDescription
            + "\n处理方法：" + Resolution + "\n\n【原始错误详情】\n" + OriginalError;

        public static TenantDatabaseProvisioningException Create(Exception error, string connectionString, string stage)
        {
            var builder = new DbConnectionStringBuilder();
            try { builder.ConnectionString = connectionString ?? ""; } catch { }
            string Read(params string[] names) => names.Where(builder.ContainsKey)
                .Select(name => Convert.ToString(builder[name])).FirstOrDefault() ?? "未配置";
            var raw = error?.ToString() ?? "未提供数据库异常";
            var denied = Regex.IsMatch(raw, @"access denied|command denied|permission denied|not allowed|privilege", RegexOptions.IgnoreCase);
            var loginDenied = Regex.IsMatch(raw, @"using password:|authentication failed|login failed", RegexOptions.IgnoreCase)
                && !Regex.IsMatch(raw, @"to database|command denied|privilege", RegexOptions.IgnoreCase);
            var category = loginDenied ? "AuthenticationFailed" : denied ? "InsufficientPrivileges" : "DatabaseProvisioningFailed";
            var message = loginDenied
                ? "数据库管理账号登录失败，尚未完成租户数据库创建。"
                : denied ? "数据库账号权限不足，无法创建租户数据库或独立账号。"
                : "数据库开通失败，尚未完成租户创建。";
            var resolution = loginDenied
                ? "检查 microi 编排中的 OsClientDbConn：核对数据库账号、密码、主机、端口以及该账号允许连接的来源，更新编排并重启后端后重试。"
                : denied
                    ? "在 microi 编排的 OsClientDbConn 中配置具有开库、CREATE USER 及目标库授权权限（GRANT OPTION）的管理账号，例如已正确授权的 root；还需允许查询账号是否存在。普通业务库账号通常没有这些权限。更新编排并重启后端后重试，不要直接修改业务表或手工还原数据库。"
                    : "检查下方原始错误，核对数据库连接、管理权限及同名数据库或账号是否已存在；排除原因后重新创建。";
            // 先按真实值删除密码，再兜底处理嵌套异常中不同格式的连接串片段。
            foreach (var name in new[] { "Password", "PWD" })
                if (builder.ContainsKey(name) && !string.IsNullOrEmpty(Convert.ToString(builder[name])))
                    raw = raw.Replace(Convert.ToString(builder[name]), "[REDACTED]");
            raw = Regex.Replace(raw, "(?i)(password|pwd|token|secret)\\s*=\\s*(\"[^\"]*\"|'[^']*'|[^;\\r\\n\\s]*)", "$1=[REDACTED]");
            var description = "当前连接：" + Read("Server", "Host", "Data Source") + ":" + Read("Port")
                + "；账号：" + Read("User ID", "Uid", "User", "Username", "User Name")
                + "；业务库：" + Read("Database", "Initial Catalog") + "；失败阶段：" + stage + "。";
            return new TenantDatabaseProvisioningException(message, error, stage, category, resolution, description, raw);
        }
    }
}

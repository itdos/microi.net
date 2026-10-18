using System;
using System.Text;
using Microi.net;

namespace Microi.Cache
{
    /// <summary>
    /// Redis 管理的可信租户边界。主租户身份来自宿主配置，不能由管理请求或管理员等级推导。
    /// 业务 V8 继续使用 V8TenantCache；这里不改变平台内部跨租户启动/会话缓存的访问方式。
    /// </summary>
    internal sealed class RedisTenantScope
    {
        internal RedisTenantScope(string tenantOsClient, string mainOsClient)
        {
            var tenant = TenantConfigurationSecurity.NormalizeTenantId(tenantOsClient);
            var main = TenantConfigurationSecurity.NormalizeTenantId(mainOsClient);
            IsMainTenant = string.Equals(tenant, main, StringComparison.OrdinalIgnoreCase);
            KeyPrefix = "Microi:" + tenant + ":";
        }

        internal static RedisTenantScope Current(string tenantOsClient) =>
            new RedisTenantScope(tenantOsClient, OsClient.GetConfigOsClient());

        internal bool IsMainTenant { get; }
        internal string KeyPrefix { get; }

        internal bool AllowsKey(string key) => IsMainTenant ||
            (key != null && key.Length > KeyPrefix.Length && key.StartsWith(KeyPrefix, StringComparison.OrdinalIgnoreCase));

        internal void RequireKey(string key)
        {
            if (!AllowsKey(key))
                throw new UnauthorizedAccessException("子租户只能操作自身 Microi:{OsClient}: 命名空间中的 Redis Key。");
        }

        internal int Database(int? requested, int configured)
        {
            if (!IsMainTenant && requested.HasValue && requested.Value != configured)
                throw new UnauthorizedAccessException("子租户只能访问当前连接配置的 Redis 数据库。");
            return requested ?? configured;
        }

        internal string Pattern(string requested, bool containsSearch)
        {
            var value = string.IsNullOrWhiteSpace(requested) ? "*" : requested.Trim();
            if (value.Length > 500) throw new ArgumentException("Key 搜索条件不能超过 500 个字符。");
            if (!IsMainTenant && value.StartsWith("Microi:", StringComparison.OrdinalIgnoreCase))
            {
                if (!value.StartsWith(KeyPrefix, StringComparison.OrdinalIgnoreCase))
                    throw new UnauthorizedAccessException("禁止搜索其它租户的 Redis 命名空间。");
                value = value.Substring(KeyPrefix.Length);
                if (value.Length == 0) value = "*";
            }
            if (containsSearch && value.IndexOfAny(new[] { '*', '?', '[' }) < 0) value = "*" + value + "*";
            if (IsMainTenant) return value;
            // L1 失效协议使用字面前缀加 *，不可把 Redis 字符组写入其正则转义路径。
            if (!containsSearch) return KeyPrefix + value;

            // Redis glob 区分大小写，而平台租户身份不区分。固定前缀逐字生成字符组，
            // 只兼容本租户的历史大小写；用户的 glob 永远位于完整租户前缀之后。
            var prefix = new StringBuilder();
            foreach (var ch in KeyPrefix)
            {
                if (char.IsLetter(ch)) prefix.Append('[').Append(char.ToLowerInvariant(ch)).Append(char.ToUpperInvariant(ch)).Append(']');
                else prefix.Append(ch);
            }
            return prefix + value;
        }
    }
}

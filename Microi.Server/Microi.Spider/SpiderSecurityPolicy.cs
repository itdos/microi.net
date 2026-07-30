using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using Dos.Common;

namespace Microi.net
{
    /// <summary>
    /// Browser egress policy kept intentionally equivalent to DiyHttp's SSRF
    /// compatibility contract. Compatibility mode is the default; strict
    /// validation is activated only by the same explicit platform settings.
    /// </summary>
    internal static class SpiderSecurityPolicy
    {
        internal static bool IsStrictProtectionEnabled()
        {
            return ConfigHelper.GetRuntimeConfigurationBool(
                "SsrfProtection:Enabled",
                false);
        }

        internal static (bool Allowed, string Reason) ValidateUrl(string url)
        {
            if (!IsStrictProtectionEnabled())
            {
                return (true, null);
            }
            if (string.IsNullOrWhiteSpace(url))
            {
                return (false, "URL 为空");
            }
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            {
                return (false, "URL 格式非法");
            }
            if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            {
                return (false, $"不允许的协议: {uri.Scheme}");
            }
            if (!string.IsNullOrEmpty(uri.UserInfo))
            {
                return (false, "URL 不允许包含用户凭据");
            }

            var host = uri.Host?.ToLowerInvariant() ?? "";
            if (GetAllowedHosts().Contains(host))
            {
                return (true, null);
            }

            IPAddress[] addresses;
            if (IPAddress.TryParse(host, out var directIp))
            {
                addresses = new[] { directIp };
            }
            else
            {
                if (host == "localhost" || host.EndsWith(".localhost", StringComparison.Ordinal))
                {
                    return (false, $"禁止访问回环地址: {host}");
                }
                try
                {
                    addresses = Dns.GetHostAddresses(host);
                }
                catch (Exception ex)
                {
                    return (false, $"DNS 解析失败: {ex.Message}");
                }
            }

            foreach (var ip in addresses)
            {
                if (IsBlockedIp(ip))
                {
                    return (false, $"禁止访问内网/特殊地址: {host} -> {ip}");
                }
            }
            return (true, null);
        }

        private static HashSet<string> GetAllowedHosts()
        {
            var configuredHosts = ConfigHelper.GetRuntimeConfigurationValue(
                                      "SsrfProtection:AllowedHosts")
                                  ?? "";

            return new HashSet<string>(
                configuredHosts
                    .Split(new[] { ',', ';' }, StringSplitOptions.RemoveEmptyEntries)
                    .Select(item => item.Trim().ToLowerInvariant())
                    .Where(item => !string.IsNullOrEmpty(item)),
                StringComparer.OrdinalIgnoreCase);
        }

        private static bool IsBlockedIp(IPAddress ip)
        {
            if (ip == null || IPAddress.IsLoopback(ip))
            {
                return ip != null;
            }

            var ipText = ip.ToString();
            if (ipText == "169.254.169.254" || ipText == "100.100.100.200")
            {
                return true;
            }

            if (ip.AddressFamily == AddressFamily.InterNetwork)
            {
                var bytes = ip.GetAddressBytes();
                if (bytes[0] == 0
                    || bytes[0] == 10
                    || (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31)
                    || (bytes[0] == 192 && bytes[1] == 168)
                    || (bytes[0] == 169 && bytes[1] == 254)
                    || (bytes[0] >= 224 && bytes[0] <= 239))
                {
                    return true;
                }
            }
            else if (ip.AddressFamily == AddressFamily.InterNetworkV6)
            {
                if (ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6Multicast)
                {
                    return true;
                }
                var bytes = ip.GetAddressBytes();
                if ((bytes[0] & 0xfe) == 0xfc)
                {
                    return true;
                }
                if (ip.IsIPv4MappedToIPv6)
                {
                    return IsBlockedIp(ip.MapToIPv4());
                }
            }
            return false;
        }

    }
}

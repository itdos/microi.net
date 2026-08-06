using System.Net;
using System.Net.NetworkInformation;

namespace Microi.net.Api;

/// <summary>
/// 为容器内 Kestrel 补充可信的直接 Docker/CNI 网关。这里只信任当前容器路由表中
/// 实际存在的私有默认网关精确 IP；公网地址、宽泛网段和客户端自报 Header 都不会进入
/// 信任边界。运维显式配置的 KnownProxies/KnownNetworks 仍由 Program 单独加载。
/// </summary>
public static class ForwardedProxyTrustPolicy
{
    private static readonly Lazy<IReadOnlyList<IPAddress>> ContainerGatewayProxies =
        new(DiscoverContainerGatewayProxiesCore, true);

    public static IReadOnlyList<IPAddress> DiscoverContainerGatewayProxies()
    {
        return ContainerGatewayProxies.Value;
    }

    public static bool IsContainerGatewayPeer(
        IPAddress? address,
        IEnumerable<IPAddress>? discoveredGateways = null)
    {
        if (address == null)
        {
            return false;
        }

        var normalized = Normalize(address);
        return (discoveredGateways ?? DiscoverContainerGatewayProxies())
            .Where(item => item != null)
            .Select(Normalize)
            .Contains(normalized);
    }

    private static IReadOnlyList<IPAddress> DiscoverContainerGatewayProxiesCore()
    {
        if (!IsContainerRuntime())
        {
            return Array.Empty<IPAddress>();
        }

        try
        {
            var gateways = NetworkInterface.GetAllNetworkInterfaces()
                .Where(network => network.OperationalStatus == OperationalStatus.Up)
                .SelectMany(network => network.GetIPProperties().GatewayAddresses)
                .Select(gateway => gateway.Address);
            return SelectContainerGatewayProxies(true, gateways);
        }
        catch
        {
            // 自动发现失败时保持框架默认的失败关闭行为，绝不退化为信任任意转发头。
            return Array.Empty<IPAddress>();
        }
    }

    public static IReadOnlyList<IPAddress> SelectContainerGatewayProxies(
        bool isContainerRuntime,
        IEnumerable<IPAddress>? gateways)
    {
        if (!isContainerRuntime || gateways == null)
        {
            return Array.Empty<IPAddress>();
        }

        return gateways
            .Where(address => address != null)
            .Select(Normalize)
            .Where(IsPrivateContainerGateway)
            .Distinct()
            .ToArray();
    }

    private static bool IsContainerRuntime()
    {
        if (!OperatingSystem.IsLinux())
        {
            return false;
        }

        if (File.Exists("/.dockerenv"))
        {
            return true;
        }

        try
        {
            var cgroup = File.ReadAllText("/proc/1/cgroup");
            return cgroup.Contains("docker", StringComparison.OrdinalIgnoreCase)
                || cgroup.Contains("containerd", StringComparison.OrdinalIgnoreCase)
                || cgroup.Contains("kubepods", StringComparison.OrdinalIgnoreCase)
                || cgroup.Contains("lxc", StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            return false;
        }
    }

    private static IPAddress Normalize(IPAddress address)
    {
        return address.IsIPv4MappedToIPv6 ? address.MapToIPv4() : address;
    }

    private static bool IsPrivateContainerGateway(IPAddress address)
    {
        if (IPAddress.IsLoopback(address)
            || address.Equals(IPAddress.Any)
            || address.Equals(IPAddress.IPv6Any)
            || address.Equals(IPAddress.None)
            || address.Equals(IPAddress.IPv6None))
        {
            return false;
        }

        var bytes = address.GetAddressBytes();
        if (address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork)
        {
            return bytes[0] == 10
                || (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31)
                || (bytes[0] == 192 && bytes[1] == 168)
                || (bytes[0] == 169 && bytes[1] == 254);
        }

        if (address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetworkV6)
        {
            // fc00::/7（ULA）和 fe80::/10（链路本地）是容器网络常见的精确网关地址。
            return (bytes[0] & 0xfe) == 0xfc
                || (bytes[0] == 0xfe && (bytes[1] & 0xc0) == 0x80);
        }

        return false;
    }
}

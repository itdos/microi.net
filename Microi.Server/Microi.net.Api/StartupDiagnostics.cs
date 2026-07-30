using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace Microi.net.Api;

/// <summary>
/// API 宿主启动诊断。只输出简短、可执行的终端提示；完整异常交给系统日志分流器保存。
/// </summary>
public static class StartupDiagnostics
{
    public static IReadOnlyList<string> GetConfiguredAddresses(WebApplication app)
    {
        var addresses = app.Urls
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        if (addresses.Count > 0)
        {
            return addresses;
        }

        return GetConfiguredAddresses(app.Configuration);
    }

    public static IReadOnlyList<string> GetConfiguredAddresses(IConfiguration configuration)
    {
        var addresses = new List<string>();
        // launchSettings、命令行 --urls 与 ASPNETCORE_URLS 最终都会进入配置键 urls；
        // 在 Kestrel StartAsync 之前 app.Urls 可能仍为空，所以必须先回读配置。
        var configuredUrls = configuration["urls"];
        if (string.IsNullOrWhiteSpace(configuredUrls))
        {
            configuredUrls = Environment.GetEnvironmentVariable("ASPNETCORE_URLS");
        }
        if (!string.IsNullOrWhiteSpace(configuredUrls))
        {
            addresses.AddRange(configuredUrls
                .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase));
        }

        return addresses.Count > 0 ? addresses : ["请查看上方 Now listening on 日志"];
    }

    public static IReadOnlyList<string> FindOccupiedAddresses(IEnumerable<string> configuredAddresses)
    {
        try
        {
            var activePorts = IPGlobalProperties.GetIPGlobalProperties()
                .GetActiveTcpListeners()
                .Select(endpoint => endpoint.Port)
                .ToHashSet();
            return FindOccupiedAddresses(configuredAddresses, activePorts);
        }
        catch
        {
            // 端口快照只是友好预检；无权限或平台不支持时继续交给 Kestrel，并由外层 catch 兜底。
            return [];
        }
    }

    public static IReadOnlyList<string> FindOccupiedAddresses(
        IEnumerable<string> configuredAddresses,
        IReadOnlySet<int> activePorts)
    {
        return configuredAddresses
            .Where(address => TryGetPort(address, out var port) && port > 0 && activePorts.Contains(port))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public static bool IsAddressAlreadyInUse(Exception exception)
    {
        for (var current = exception; current != null; current = current.InnerException)
        {
            if (current is SocketException socketException
                && socketException.SocketErrorCode == SocketError.AddressAlreadyInUse)
            {
                return true;
            }
        }

        return false;
    }

    public static void WriteAddressInUseMessage(IEnumerable<string> addresses)
    {
        var normalizedAddresses = addresses
            .Where(item => !string.IsNullOrWhiteSpace(item))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
        var addressText = normalizedAddresses.Count > 0
            ? string.Join("、", normalizedAddresses)
            : "当前配置的 API 地址";
        var ports = normalizedAddresses
            .Select(address => TryGetPort(address, out var port) ? port : 0)
            .Where(port => port > 0)
            .Distinct()
            .OrderBy(port => port)
            .ToList();
        var portText = ports.Count > 0 ? string.Join(",", ports) : "<端口>";

        Console.Error.WriteLine("------------------------------------------------------------------------------");
        Console.Error.WriteLine($"Microi：【❌启动失败】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】API 监听地址已被其它进程占用：{addressText}。本次 API 未启动。");
        Console.Error.WriteLine("Microi：【原因】常见原因是重复启动了后端，或 Vite 等开发服务自动换端口后占用了 API 端口。");
        Console.Error.WriteLine($"Microi：【解决方案】请先停止占用进程，或修改 Properties/launchSettings.json 的 applicationUrl 后重启。Windows 排查命令：Get-NetTCPConnection -LocalPort {portText} -State Listen");
        Console.Error.WriteLine("------------------------------------------------------------------------------");
    }

    public static void WriteUnexpectedStartupFailure(Exception exception)
    {
        var rootException = exception.GetBaseException();
        // 详情不进入平台关键 stdout 白名单，由 ConsoleLogInterceptor 写入 MongoDB 日志队列。
        Console.WriteLine($"Microi：【启动异常详情】{exception}");
        Console.Error.WriteLine("------------------------------------------------------------------------------");
        Console.Error.WriteLine($"Microi：【❌启动失败】【{DateTime.Now:yyyy-MM-dd HH:mm:ss}】{rootException.GetType().Name}：{rootException.Message}");
        Console.Error.WriteLine("Microi：【解决方案】请根据上面的简要原因检查配置与依赖；完整异常已写入系统日志。");
        Console.Error.WriteLine("------------------------------------------------------------------------------");
    }

    private static bool TryGetPort(string address, out int port)
    {
        port = 0;
        if (string.IsNullOrWhiteSpace(address))
        {
            return false;
        }

        var normalized = address.Trim()
            .Replace("://*:", "://0.0.0.0:", StringComparison.Ordinal)
            .Replace("://+:", "://0.0.0.0:", StringComparison.Ordinal);
        return Uri.TryCreate(normalized, UriKind.Absolute, out var uri)
            && (port = uri.Port) > 0;
    }
}

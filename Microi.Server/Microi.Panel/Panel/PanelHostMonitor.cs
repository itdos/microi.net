using System.Text.Json.Nodes;

namespace Microi.Panel.Panel;

public sealed record PanelContainerMetrics(double? CpuPercent, long? MemoryBytes, long? MemoryLimitBytes, long? ReceivedBytes, long? SentBytes);
public sealed record PanelContainerView(string Id, string Name, string Image, string State, string Status, bool Managed, JsonNode? Ports, PanelContainerMetrics? Metrics = null);
public sealed record PanelHostView(string? Name = null, string? Os = null, string? Architecture = null, int? Cpus = null, long? MemoryBytes = null, string? DockerVersion = null,
    double? CpuPercent = null, long? MemoryUsedBytes = null, long? DataDiskAvailableBytes = null, long? DataDiskTotalBytes = null);
public sealed record PanelHostFrame(bool Available, DateTimeOffset? ObservedAt, string Error, PanelHostView Host, PanelContainerView[] Containers);

/// <summary>仅查询 Docker 和本机只读指标；短期缓存合并浏览器轮询，故障时保留上次观测并明确标记过期。</summary>
public sealed class PanelHostMonitor(DockerEngine docker, PanelRepository repository, OpsOptions options)
{
    private readonly SemaphoreSlim sampling = new(1, 1);
    private PanelHostFrame frame = new(false, null, "尚未读取 Docker 状态。", new(), []);
    private DateTimeOffset attempted;
    private (long Total, long Idle)? previousCpu;
    public async Task<PanelHostFrame> Read(CancellationToken ct)
    {
        await sampling.WaitAsync(ct);
        try
        {
            if (DateTimeOffset.UtcNow - attempted < TimeSpan.FromSeconds(5)) return frame;
            attempted = DateTimeOffset.UtcNow;
            using var deadline = CancellationTokenSource.CreateLinkedTokenSource(ct); deadline.CancelAfter(TimeSpan.FromSeconds(6));
            try
            {
                var info = await docker.Info(deadline.Token) ?? throw new OpsException("Docker 未返回主机状态。");
                var actual = (await docker.Json(HttpMethod.Get, "/containers/json?all=1", ct: deadline.Token))!.AsArray();
                var registered = repository.Resources().Select(x => x.ContainerId).Where(x => x.Length > 0).ToHashSet(StringComparer.Ordinal);
                var containers = actual.Where(x => x != null).Select(x => new PanelContainerView(x!["Id"]?.ToString() ?? "", x["Names"]?[0]?.ToString().TrimStart('/') ?? "",
                    x["Image"]?.ToString() ?? "", x["State"]?.ToString() ?? "", x["Status"]?.ToString() ?? "",
                    x["Labels"]?[PanelDockerConfig.OwnerLabel]?.ToString() == repository.OwnerId && registered.Contains(x["Id"]?.ToString() ?? ""), x["Ports"]?.DeepClone())).ToArray();
                // stats 单次最多读取 32 个受管运行容器，4 个并发；失败的指标留空，不能把未知显示成零。
                using var limit = new SemaphoreSlim(4);
                var samples = await Task.WhenAll(containers.Where(x => x.Managed && x.State == "running").Take(32).Select(async container =>
                {
                    try
                    {
                        await limit.WaitAsync(deadline.Token);
                        try { return (container.Id, Metrics: ParseMetrics(await docker.Json(HttpMethod.Get, "/containers/" + container.Id + "/stats?stream=false", ct: deadline.Token))); }
                        finally { limit.Release(); }
                    }
                    catch (Exception error) when (error is not OutOfMemoryException && !ct.IsCancellationRequested) { return (container.Id, Metrics:(PanelContainerMetrics?)null); }
                }));
                var byId = samples.ToDictionary(x => x.Id, x => x.Metrics);
                var host = ReadLocalMetrics(new(info["Name"]?.ToString(), info["OperatingSystem"]?.ToString(), info["Architecture"]?.ToString(), info["NCPU"]?.GetValue<int>(),
                    info["MemTotal"]?.GetValue<long>(), info["ServerVersion"]?.ToString()));
                frame = new(true, DateTimeOffset.UtcNow, "", host, containers.Select(x => x with { Metrics = byId.GetValueOrDefault(x.Id) }).ToArray());
            }
            catch (Exception error) when (error is not OutOfMemoryException && !ct.IsCancellationRequested)
            {
                frame = frame with { Available = false, Error = "Docker 暂不可用；下方容器与主机指标为上次观测，插件账本和操作记录仍可查看。" };
            }
            return frame;
        }
        finally { sampling.Release(); }
    }
    private PanelHostView ReadLocalMetrics(PanelHostView host)
    {
        try
        {
            if (OperatingSystem.IsLinux())
            {
                var values = File.ReadLines("/proc/stat").First().Split(' ', StringSplitOptions.RemoveEmptyEntries).Skip(1).Take(8).Select(long.Parse).ToArray();
                var current = (Total:values.Sum(), Idle:values[3] + values[4]); double? cpu = null;
                if (previousCpu is { } before && current.Total > before.Total) cpu = Math.Clamp(100d * (1 - (current.Idle - before.Idle) / (double)(current.Total - before.Total)), 0, 100);
                previousCpu = current;
                var memory = File.ReadLines("/proc/meminfo").Select(x => x.Split([' ', ':'], StringSplitOptions.RemoveEmptyEntries)).ToDictionary(x => x[0], x => long.Parse(x[1]) * 1024);
                host = host with { CpuPercent = cpu, MemoryUsedBytes = memory.TryGetValue("MemAvailable", out var available) && memory.TryGetValue("MemTotal", out var total) ? Math.Max(0, total - available) : null };
            }
            var directory = Path.GetFullPath(options.DataDir);
            var drive = DriveInfo.GetDrives().Where(x => directory == x.Name.TrimEnd(Path.DirectorySeparatorChar) || directory.StartsWith(x.Name.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.Ordinal))
                .OrderByDescending(x => x.Name.Length).FirstOrDefault();
            if (drive is { IsReady:true }) host = host with { DataDiskAvailableBytes = drive.AvailableFreeSpace, DataDiskTotalBytes = drive.TotalSize };
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or FormatException or IndexOutOfRangeException) { }
        return host;
    }
    /// <summary>遵循 Docker Engine stats 公式；CPU 为各核累计百分比，内存扣除可回收文件缓存。</summary>
    public static PanelContainerMetrics? ParseMetrics(JsonNode? json)
    {
        if (json == null) return null;
        static double Number(JsonNode? node) => node?.GetValue<double>() ?? 0;
        var cpuDelta = Number(json["cpu_stats"]?["cpu_usage"]?["total_usage"]) - Number(json["precpu_stats"]?["cpu_usage"]?["total_usage"]);
        var systemDelta = Number(json["cpu_stats"]?["system_cpu_usage"]) - Number(json["precpu_stats"]?["system_cpu_usage"]);
        var cores = Number(json["cpu_stats"]?["online_cpus"]); if (cores == 0) cores = json["cpu_stats"]?["cpu_usage"]?["percpu_usage"]?.AsArray().Count ?? 0;
        var memory = json["memory_stats"];
        var cache = memory?["stats"]?["total_inactive_file"] ?? memory?["stats"]?["inactive_file"] ?? memory?["stats"]?["cache"];
        var networks = json["networks"] as JsonObject;
        return new(systemDelta > 0 && cpuDelta >= 0 && cores > 0 ? cpuDelta / systemDelta * cores * 100 : null,
            memory?["usage"] == null ? null : Math.Max(0, (long)(Number(memory["usage"]) - Number(cache))), memory?["limit"]?.GetValue<long>(),
            networks == null ? null : (long)networks.Sum(x => Number(x.Value?["rx_bytes"])), networks == null ? null : (long)networks.Sum(x => Number(x.Value?["tx_bytes"])));
    }
}

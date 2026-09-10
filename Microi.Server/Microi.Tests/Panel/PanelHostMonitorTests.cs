using Microi.Panel.Panel;
using System.Text.Json.Nodes;

namespace Microi.Tests.Panel;
public sealed class PanelHostMonitorTests
{
    [Fact]
    public void MetricsFollowDockerCpuAndCgroupMemoryCalculation()
    {
        var sample = JsonNode.Parse("""{"cpu_stats":{"cpu_usage":{"total_usage":150},"system_cpu_usage":1000,"online_cpus":4},"precpu_stats":{"cpu_usage":{"total_usage":100},"system_cpu_usage":800},"memory_stats":{"usage":1024,"limit":2048,"stats":{"inactive_file":256}},"networks":{"eth0":{"rx_bytes":50,"tx_bytes":60},"eth1":{"rx_bytes":10,"tx_bytes":20}}}""");
        var result = PanelHostMonitor.ParseMetrics(sample)!;
        Assert.Equal(100, result.CpuPercent); Assert.Equal(768, result.MemoryBytes); Assert.Equal(2048, result.MemoryLimitBytes); Assert.Equal(60, result.ReceivedBytes); Assert.Equal(80, result.SentBytes);
    }
    [Fact]
    public void UnknownCountersAreUnavailableAndCacheCannotMakeMemoryNegative()
    {
        var empty = PanelHostMonitor.ParseMetrics(new JsonObject())!; Assert.Null(empty.CpuPercent); Assert.Null(empty.MemoryBytes); Assert.Null(empty.ReceivedBytes);
        var result = PanelHostMonitor.ParseMetrics(JsonNode.Parse("""{"memory_stats":{"usage":1,"stats":{"total_inactive_file":2}}}"""))!; Assert.Equal(0, result.MemoryBytes);
    }
}

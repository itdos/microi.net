using System.Security.Cryptography;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api;

/// <summary>有界节点 WAL；文件名均由可信后端生成，查询请求不接受文件路径。</summary>
public sealed class MemoryDiagnosticsStore(string root)
{
    public string Root { get; } = Path.GetFullPath(root);
    public long DroppedFiles { get; private set; }
    public string LastError { get; private set; } = "";
    public const int MaximumJsonBytes = 3 * 1024 * 1024;

    public string BootDirectory(string bootId)
    {
        if (!Guid.TryParseExact(bootId, "N", out _)) throw new ArgumentException("Invalid boot id.");
        return Path.Combine(Root, bootId);
    }

    public void Write(string path, JObject value)
    {
        var json = value.ToString(Formatting.None);
        if (System.Text.Encoding.UTF8.GetByteCount(json) > MaximumJsonBytes) throw new InvalidOperationException("Diagnostic JSON budget exceeded.");
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
        try
        {
            using (var file = new FileStream(temp, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                using var writer = new StreamWriter(file, new System.Text.UTF8Encoding(false), 16384, leaveOpen: true);
                writer.Write(json); writer.Flush(); file.Flush(true);
            }
            File.Move(temp, path, overwrite: true);
            LastError = "";
        }
        catch (Exception ex) { LastError = ex.GetType().Name; throw; }
        finally { try { if (File.Exists(temp)) File.Delete(temp); } catch { } }
    }

    public static JObject? Read(string path)
    {
        try
        {
            var file = new FileInfo(path);
            if (!file.Exists || file.Length > MaximumJsonBytes) return null;
            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            using var reader = new JsonTextReader(new StreamReader(stream)) { MaxDepth = 64, DateTimeZoneHandling = DateTimeZoneHandling.Utc };
            return JObject.Load(reader);
        }
        catch { return null; }
    }

    public string SaveIncident(string bootId, JObject incident)
    {
        var id = incident.Value<string>("Id")!;
        if (!Guid.TryParseExact(id, "N", out _)) throw new ArgumentException("Invalid incident id.");
        var tenant = incident.Value<string>("Tenant") ?? "";
        var tenantHash = TenantHash(tenant);
        var path = Path.Combine(BootDirectory(bootId), $"{id}-{tenantHash}.incident.json");
        Write(path, incident);
        Write(path + ".summary.json", Summary(incident));
        return path;
    }

    public IEnumerable<string> BootDirectories(bool includeExpired = false)
    {
        if (!Directory.Exists(Root)) return [];
        return Directory.EnumerateDirectories(Root).Where(p => Guid.TryParseExact(Path.GetFileName(p), "N", out _))
            .OrderByDescending(Directory.GetLastWriteTimeUtc).Take(includeExpired ? int.MaxValue : 128).ToArray();
    }
    public IEnumerable<string> IncidentFiles() => BootDirectories()
        .SelectMany(dir => Directory.EnumerateFiles(dir, "*.incident.json").OrderByDescending(File.GetLastWriteTimeUtc).Take(128)).ToArray();

    private static string TenantHash(string tenant) => Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(tenant.ToLowerInvariant())))[..24];

    public IEnumerable<JObject> LocalIncidents(string tenant, string? incidentId = null)
    {
        var suffix = "-" + TenantHash(tenant) + ".incident.json";
        var files = IncidentFiles().Where(p => p.EndsWith(suffix, StringComparison.Ordinal)
            && (incidentId == null || Path.GetFileName(p).StartsWith(incidentId + "-", StringComparison.Ordinal)))
            .OrderByDescending(File.GetLastWriteTimeUtc).Take(incidentId == null ? 50 : 1);
        // List operations read summaries, never dozens of full allocation/stack payloads.
        return files.Select(p => Read(incidentId == null ? p + ".summary.json" : p)).OfType<JObject>()
            .Where(x => string.Equals(x.Value<string>("Tenant"), tenant, StringComparison.OrdinalIgnoreCase)).ToArray();
    }

    public void Trim(string currentBoot)
    {
        try
        {
            var activeBoots = new HashSet<string>();
            var boots = BootDirectories(includeExpired: true).ToArray();
            foreach (var dir in boots)
            {
                if (Path.GetFileName(dir) == currentBoot) continue;
                // API 退出后，采集器或重启解析器仍可能持有片段，不能在历史清理时删掉它。
                foreach (var name in new[] { "host.lock", "collector.lock", "stacks-recovered.json.lock" })
                {
                    var leasePath = Path.Combine(dir, name);
                    if (!File.Exists(leasePath)) continue;
                    try { using var lease = new FileStream(leasePath, FileMode.Open, FileAccess.ReadWrite, FileShare.None); }
                    catch (IOException) { activeBoots.Add(dir); break; }
                }
            }
            // 共享持久卷中，其他存活节点的文件由其自身预算管理。
            var files = boots.Where(dir => !activeBoots.Contains(dir)).SelectMany(dir => Directory.EnumerateFiles(dir))
                .Select(p => new FileInfo(p)).OrderByDescending(f => f.LastWriteTimeUtc).ToArray();
            long total = 0;
            foreach (var file in files)
            {
                total += file.Length;
                // Never interfere with an active collector or its current checkpoint.
                var boot = Path.GetFileName(file.DirectoryName);
                if (file.Name.EndsWith(".lock")) continue;
                if (boot == currentBoot && (file.Name.StartsWith("allocation-") || file.Name.StartsWith("collector") || file.Name == "checkpoint.json")) continue;
                if (file.LastWriteTimeUtc < DateTime.UtcNow.AddDays(-14) || total > 256L * 1024 * 1024)
                {
                    if (file.Name.EndsWith(".incident.json") && !File.Exists(file.FullName + ".ack")) DroppedFiles++;
                    file.Delete();
                }
            }
        }
        catch (Exception ex) { LastError = ex.GetType().Name; }
    }

    public static JObject Summary(JObject value) => new(
        new[] { "Id", "Tenant", "BootId", "NodeId", "OccurredAtUtc", "UpdatedAtUtc", "Trigger", "Status", "PeakRssBytes", "BuildVersion", "Evidence" }
            .Where(k => value[k] != null).Select(k => new JProperty(k, value[k]!.DeepClone())));

    public static JObject ForTenant(JObject incident, string tenant)
    {
        var value = (JObject)incident.DeepClone();
        value["Tenant"] = tenant;
        if (!string.Equals(value.Value<string>("DefaultTenant"), tenant, StringComparison.OrdinalIgnoreCase)
            && value["MongoDB"] is JObject mongo)
            foreach (var name in new[] { "LogDataBytes", "LogStorageBytes", "LogIndexBytes" }) mongo.Remove(name);
        value.Remove("DefaultTenant");
        value["Executions"] = FilterExecutions(value["Executions"] as JArray, tenant);
        value["AllocationTop"] = FilterAllocations(value["AllocationTop"] as JArray, tenant);
        if (value["Stacks"] is JObject stacks)
        {
            stacks["Top"] = FilterAllocations(stacks["Top"] as JArray, tenant);
            var samples = stacks.Value<long>("Samples");
            var missing = stacks.Value<long>("MissingStackSamples");
            var lost = stacks.Value<long>("LostEvents");
            var overflow = stacks.Value<long>("OverflowSamples");
            var quality = new JObject { ["ProcessSamples"] = samples, ["MissingStackSamples"] = missing,
                ["LostEvents"] = lost, ["OverflowSamples"] = overflow,
                ["TenantGroupsWithFrames"] = ((JArray)stacks["Top"]!).OfType<JObject>().Count(row => row["Stack"] is JArray frames && frames.Count > 0) };
            if (value["Evidence"] is not JObject) value["Evidence"] = new JObject();
            value["Evidence"]!["StackQuality"] = quality;
            // 页面已有 Boundary 与采集质量详情；把缺失数直接显示给操作者，不能将有采样等同有方法栈。
            value["Boundary"] = (value.Value<string>("Boundary") ?? "") + $" 进程分配采样 {samples} 条，其中 {missing} 条缺少方法栈，丢事件 {lost}，聚合溢出 {overflow}。";
        }
        return value;
    }
    public static JArray FilterExecutions(JArray? list, string tenant) => new((list ?? new JArray()).OfType<JObject>()
        .Where(x => string.Equals(x.Value<string>("OsClient"), tenant, StringComparison.OrdinalIgnoreCase)).Select(x => x.DeepClone()));
    public static JArray FilterAllocations(JArray? list, string tenant) => new((list ?? new JArray()).OfType<JObject>()
        .Where(x => x["Execution"] is JObject e && string.Equals(e.Value<string>("OsClient"), tenant, StringComparison.OrdinalIgnoreCase)).Select(x => x.DeepClone()));
}

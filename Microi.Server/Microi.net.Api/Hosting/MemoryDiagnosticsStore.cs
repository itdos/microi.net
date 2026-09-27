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
        foreach (var waits in new[] { value["RequestWaits"], value["WaitEvidence"] }.OfType<JObject>())
        {
            foreach (var name in new[] { "Groups", "Samples", "Recent" }) waits[name] = FilterExecutions(waits[name] as JArray, tenant);
            waits["ActiveCount"] = (waits["Groups"] as JArray)!.Sum(row => row.Value<int>("Count"));
            waits["ActiveCountScope"] = "仅已保留的本租户分组；全节点截断/溢出计数表示可见性缺口。";
        }
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

    /// <summary>恢复后的空快照不抹掉阻塞现场。分组保留并发数最高的真实时刻，样本保留最长等待；二者不能相加当线程数。</summary>
    public static void RetainWaitEvidence(JObject incident, JObject checkpoint)
    {
        var evidence = incident["WaitEvidence"] as JObject ?? new JObject { ["FirstSampledAtUtc"] = checkpoint["UpdatedAtUtc"]?.DeepClone() };
        // Newtonsoft 对已有 Parent 的 token 再次赋值会克隆；只在首次建立时挂接，后续必须修改实际挂在事故上的对象。
        if (incident["WaitEvidence"] is not JObject) incident["WaitEvidence"] = evidence;
        evidence["LastSampledAtUtc"] = checkpoint["UpdatedAtUtc"]?.DeepClone();
        foreach (var (name, limit) in new[] { ("Groups", 256), ("Samples", 128) })
        {
            var incoming = (checkpoint["RequestWaits"]?[name] as JArray ?? new JArray()).OfType<JObject>().Select(x => {
                var row = (JObject)x.DeepClone(); row["ObservedAtUtc"] = checkpoint["UpdatedAtUtc"]?.DeepClone(); return row;
            });
            var all = (evidence[name] as JArray ?? new JArray()).OfType<JObject>().Concat(incoming);
            var rows = all.GroupBy(x => name == "Samples" ? x.Value<string>("Id") : new JArray(
                new[] { "OsClient", "Kind", "Stage", "ApiEngineKey", "Target" }.Select(k => x.Value<string>(k) ?? "")).ToString(Formatting.None))
                .Select(g => g.OrderByDescending(x => x.Value<int>("Count")).ThenByDescending(x => x.Value<long>(name == "Samples" ? "ElapsedMs" : "LongestMs")).First())
                .OrderByDescending(x => x.Value<int>("Count")).ThenByDescending(x => x.Value<long>(name == "Samples" ? "ElapsedMs" : "LongestMs")).ToArray();
            evidence[name] = new JArray(rows.Take(limit).Select(x => x.DeepClone()));
            evidence["Discarded" + name] = evidence.Value<long>("Discarded" + name) + Math.Max(0, rows.Length - limit);
        }
        if (checkpoint["Current"] is JObject current && current["ThreadPoolAvailableWorkers"] != null
            && (evidence["WorstThreadPoolFrame"] is not JObject prior || current.Value<int>("ThreadPoolAvailableWorkers") < prior.Value<int>("ThreadPoolAvailableWorkers")))
            evidence["WorstThreadPoolFrame"] = current.DeepClone();
        evidence["Boundary"] = "分组是各自峰值时刻，不代表同时发生；ObservedAtUtc 标明时间。等待数不是线程数，丢弃计数表示取证缺口。";
    }
    public static JArray FilterExecutions(JArray? list, string tenant) => new((list ?? new JArray()).OfType<JObject>()
        .Where(x => string.Equals(x.Value<string>("OsClient"), tenant, StringComparison.OrdinalIgnoreCase)).Select(x => x.DeepClone()));
    public static JArray FilterAllocations(JArray? list, string tenant) => new((list ?? new JArray()).OfType<JObject>()
        .Where(x => x["Execution"] is JObject e && string.Equals(e.Value<string>("OsClient"), tenant, StringComparison.OrdinalIgnoreCase)).Select(x => x.DeepClone()));
}

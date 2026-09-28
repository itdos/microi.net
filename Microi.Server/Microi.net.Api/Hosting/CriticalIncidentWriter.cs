using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api;

/// <summary>关键事故独立写库线程：磁盘/Mongo 失败不阻止入队，慢数据库不阻止采样。
/// 队列有界并合并同事故的新快照；只有 Save 返回后才记为已确认持久化。</summary>
public sealed class CriticalIncidentWriter : IDisposable
{
    private readonly object _gate = new();
    private readonly Dictionary<string, Entry> _pending = new();
    private readonly Dictionary<string, DateTime> _tenantRetry = new(StringComparer.OrdinalIgnoreCase);
    private const int MaximumTenantPending = 8;
    private readonly Action<string, JObject> _save;
    private readonly MemoryDiagnosticsStore? _spool;
    private readonly Thread _thread;
    private bool _stopping;
    private long _writes, _dropped;
    private DateTime? _lastAck;
    private string _error = "NotYetWritten";
    private string _replayError = "";
    private DateTime _nextReplay;
    private int _replayCursor;
    private sealed class Entry { public required JObject Value; public DateTime Retry; public Action? Acknowledged; }
    public CriticalIncidentWriter(Action<string, JObject> save) : this(save, null) { }
    public CriticalIncidentWriter(Action<string, JObject> save, MemoryDiagnosticsStore? spool)
    {
        _save = save; _spool = spool;
        _thread = new Thread(Run) { IsBackground = true, Name = "Microi-CriticalIncidents" };
        using (System.Threading.ExecutionContext.SuppressFlow()) _thread.Start();
    }

    public void Enqueue(JObject value) => Enqueue(value, null);
    private void Enqueue(JObject value, Action? acknowledged)
    {
        var payload = Project(value);
        var key = payload.Value<string>("Tenant")!.ToLowerInvariant() + ":" + payload.Value<string>("Id");
        lock (_gate)
        {
            if (payload.Value<DateTime>("OccurredAtUtc") < DateTime.UtcNow.AddDays(-14)) { _dropped++; return; }
            if (_stopping) { _dropped++; return; }
            if (_pending.TryGetValue(key, out var old) && old.Value.Value<DateTime>("UpdatedAtUtc") > payload.Value<DateTime>("UpdatedAtUtc")) return;
            if (old == null)
            {
                var tenant = payload.Value<string>("Tenant")!;
                var own = _pending.Where(p => SameTenant(p.Value, tenant)).ToArray();
                if (own.Length >= MaximumTenantPending)
                {
                    var oldest = own.OrderBy(p => p.Value.Value.Value<DateTime>("UpdatedAtUtc")).First();
                    // 旧 spool 不能把较新的实时现场挤出；被拒/替换的文件不写确认，恢复后仍可重放。
                    if (oldest.Value.Value.Value<DateTime>("UpdatedAtUtc") >= payload.Value<DateTime>("UpdatedAtUtc")) { _dropped++; return; }
                    Evict(oldest.Key);
                }
                if (_pending.Count >= 64)
                {
                    // 全局队列满时先从占用最多的租户释放一个旧快照，保证新租户有入口。
                    var largest = _pending.GroupBy(p => p.Value.Value.Value<string>("Tenant"), StringComparer.OrdinalIgnoreCase)
                        .OrderByDescending(g => g.Count()).First();
                    Evict(largest.OrderBy(p => p.Value.Value.Value<DateTime>("UpdatedAtUtc")).First().Key);
                }
            }
            _pending[key] = new Entry { Value = payload, Retry = old?.Retry ?? DateTime.MinValue, Acknowledged = acknowledged };
            Monitor.PulseAll(_gate);
        }
    }

    private static bool SameTenant(Entry value, string tenant) => string.Equals(value.Value.Value<string>("Tenant"), tenant, StringComparison.OrdinalIgnoreCase);
    private void Evict(string key)
    {
        var tenant = _pending[key].Value.Value<string>("Tenant")!;
        _pending.Remove(key); _dropped++;
        if (!_pending.Values.Any(value => SameTenant(value, tenant))) _tenantRetry.Remove(tenant);
    }

    public JObject Health()
    {
        lock (_gate) return new JObject { ["Contract"] = "critical-incidents/mysql-v1", ["Table"] = RelationalIncidentRepository.TableName,
            ["Scope"] = "CurrentNodeAllLoadedTenants",
            ["AcknowledgedWrites"] = _writes, ["LastAcknowledgedAtUtc"] = _lastAck, ["Pending"] = _pending.Count,
            ["DroppedSnapshots"] = _dropped, ["Error"] = _error, ["WorkerAlive"] = _thread.IsAlive,
            ["SpoolReplayError"] = _replayError,
            ["MaximumPayloadBytes"] = RelationalIncidentRepository.MaximumPayloadBytes, ["MaximumPending"] = 64,
            ["MaximumTenantPending"] = MaximumTenantPending, ["RetryingTenants"] = _tenantRetry.Count(p => p.Value > DateTime.UtcNow),
            ["RetentionDays"] = 14, ["MaximumTenantRecords"] = 512,
            ["Boundary"] = "仅已确认写入 MySQL 的关键证据不依赖容器文件；未确认队列、数据库同时故障、主机掉电仍可能缺证。原始 EventPipe 栈片段仍需持久卷。" };
    }

    private void Run()
    {
        while (true)
        {
            // 与 Mongo 的 .ack 完全独立；数据库恢复后由专用线程补写跨重启持久卷记录。
            // 文件失败不能阻止实时内存队列写 MySQL，扫描也不依赖业务线程池。
            if (!_stopping && _spool != null && DateTime.UtcNow >= _nextReplay)
            {
                _nextReplay = DateTime.UtcNow.AddSeconds(10);
                try { ReplaySpool(); lock (_gate) _replayError = ""; }
                catch (Exception ex) { lock (_gate) _replayError = ex.GetType().Name; }
            }
            string? key; Entry? entry;
            lock (_gate)
            {
                var now = DateTime.UtcNow;
                var next = _pending.FirstOrDefault(p => p.Value.Retry <= now
                    && (!_tenantRetry.TryGetValue(p.Value.Value.Value<string>("Tenant")!, out var retry) || retry <= now));
                key = next.Key; entry = next.Value;
                if (entry == null) { if (_stopping) return; Monitor.Wait(_gate, 500); continue; }
            }
            try
            {
                _save(entry.Value.Value<string>("Tenant")!, entry.Value);
                try { entry.Acknowledged?.Invoke(); }
                catch (Exception ex) { lock (_gate) _replayError = ex.GetType().Name; }
                lock (_gate)
                {
                    _writes++; _lastAck = DateTime.UtcNow; _error = "";
                    _tenantRetry.Remove(entry.Value.Value<string>("Tenant")!);
                    if (_pending.TryGetValue(key!, out var current) && ReferenceEquals(current, entry)) _pending.Remove(key!);
                }
            }
            catch (Exception ex)
            {
                lock (_gate)
                {
                    // 只输出异常类型，不泄露连接串、SQL 或服务端错误中的凭据。
                    _error = ex is MySql.Data.MySqlClient.MySqlException mysql ? "MySqlError:" + mysql.Number : ex.GetType().Name;
                    var tenant = entry.Value.Value<string>("Tenant")!;
                    var retryAt = DateTime.UtcNow.AddSeconds(10);
                    // 写入中的旧快照可能已被容量治理替换，数据库退避仍覆盖该租户其余待写记录。
                    if (ex is not ArgumentException && _pending.Values.Any(value => SameTenant(value, tenant))) _tenantRetry[tenant] = retryAt;
                    if (_pending.TryGetValue(key!, out var current))
                    {
                        // 非法/已过期证据不能无限重试，也不能记为写库确认；新版本已入队时只移除失败的同一份对象。
                        if (ex is ArgumentException && ReferenceEquals(current, entry)) Evict(key!);
                        else
                        {
                            // 同一数据库的失败按租户退避，不能让其每条事故都独占一次连接超时。
                            current.Retry = retryAt;
                        }
                    }
                    if (_stopping) return;
                }
            }
        }
    }

    private void ReplaySpool()
    {
        var files = _spool!.IncidentFiles().ToArray();
        foreach (var path in files.Skip(_replayCursor).Concat(files.Take(_replayCursor)).Take(4))
        {
            var value = MemoryDiagnosticsStore.Read(path);
            if (value == null || value.Value<DateTime>("OccurredAtUtc") < DateTime.UtcNow.AddDays(-14)) continue;
            var version = value.Value<DateTime>("UpdatedAtUtc").Ticks;
            var ackPath = path + ".mysql-ack.json";
            if (MemoryDiagnosticsStore.Read(ackPath)?.Value<long>("UpdatedVersion") >= version) continue;
            Enqueue(value, () => _spool.Write(ackPath, new JObject { ["UpdatedVersion"] = version, ["AcknowledgedAtUtc"] = DateTime.UtcNow }));
        }
        _replayCursor = files.Length == 0 ? 0 : (_replayCursor + Math.Min(4, files.Length)) % files.Length;
    }

    /// <summary>SQL 保存关键归因记录；内存分配原始栈由 Mongo/持久卷保存，截断必须显式可见。</summary>
    public static JObject Project(JObject value)
    {
        var result = RelationalIncidentRepository.Summary(value);
        result["StorageKind"] = "MySqlCriticalEvidence";
        foreach (var key in new[] { "Current", "RequestWaits", "WaitEvidence", "MongoDB", "Boundary", "ExitEvidence", "RegistryOverflowCount", "ActiveCount" }) result[key] = value[key]?.DeepClone();
        result["Frames"] = new JArray((value["Frames"] as JArray ?? new()).TakeLast(6).Select(x => x.DeepClone()));
        result["Executions"] = new JArray((value["Executions"] as JArray ?? new()).Take(32).Select(x => x.DeepClone()));
        result["EvidenceTruncated"] = (value["Executions"] as JArray)?.Count > 32 || (value["Frames"] as JArray)?.Count > 6;
        result["RawStacksStoredHere"] = false;
        while (System.Text.Encoding.UTF8.GetByteCount(result.ToString(Formatting.None)) > RelationalIncidentRepository.MaximumPayloadBytes)
        {
            var arrays = new[] { result["RequestWaits"]?["Recent"], result["Executions"], result["RequestWaits"]?["Samples"], result["Frames"], result["RequestWaits"]?["Groups"], result["WaitEvidence"]?["Samples"], result["WaitEvidence"]?["Groups"] }.OfType<JArray>();
            var largest = arrays.OrderByDescending(x => x.Count).FirstOrDefault(x => x.Count > 0);
            if (largest == null) throw new InvalidOperationException("CriticalEvidenceBudgetExceeded");
            largest.Last!.Remove(); result["EvidenceTruncated"] = true;
        }
        return result;
    }

    public void Dispose()
    {
        lock (_gate) { _stopping = true; Monitor.PulseAll(_gate); }
        // 存储本身具有期限；宿主停机只给有界排空时间，不等待业务长任务。
        _thread.Join(TimeSpan.FromSeconds(4));
    }
}

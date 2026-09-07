using System.Diagnostics;
using System.Reflection;
using System.Security.Cryptography;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api;

/// <summary>诊断默认运行且独立于 V8 限额；EventPipe 解析交给受限子进程，
/// 采集能力缺失只报告降级，不取消业务执行。</summary>
public sealed class MemoryDiagnosticsService : BackgroundService, IMemoryDiagnosticsRuntime
{
    private readonly MemoryDiagnosticsStore _store;
    private readonly IServiceProvider _services;
    private readonly string _boot = ExecutionObservation.BootId, _directory, _helper;
    private readonly string _node = Environment.MachineName;
    private readonly string _version = typeof(MemoryDiagnosticsService).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion ?? "unknown";
    private readonly int _pid = Environment.ProcessId;
    private readonly long _startedTicks = Microi.MemoryDiagnostics.ProcessStartIdentity.Read(Environment.ProcessId);
    private readonly object _gate = new();
    private readonly Queue<MemoryDiagnosticsMetrics> _history = new();
    private MemoryDiagnosticsMetrics? _current;
    private JObject? _incident;
    private JObject _database = new() { ["Status"] = "NotYetSampled" };
    private Process? _collector;
    private Process? _recoveryAnalyzer;
    private DateTime _recoveryAnalyzerStarted;
    private FileStream? _hostLease;
    private DateTime _lastCollectorAttempt, _lastIncidentWrite, _lastTrigger;
    private int _collectorFailures, _iteration;
    private string _collectorError = "Starting", _storageError = "", _sharedError = "NotYetSynced";
    private int _pending, _replayCursor;
    private long _replayed;

    public MemoryDiagnosticsService(IHostEnvironment environment, IServiceProvider services)
    {
        _services = services;
        _store = new MemoryDiagnosticsStore(Path.Combine(environment.ContentRootPath, "logs", "memory-diagnostics"));
        _directory = _store.BootDirectory(_boot);
        _helper = Path.Combine(AppContext.BaseDirectory, "diagnostics", "Microi.MemoryDiagnostics.dll");
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var replay = ReplayLoopAsync(stoppingToken);
        var dependencies = DatabaseLoopAsync(stoppingToken);
        try
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    Directory.CreateDirectory(_directory);
                    _hostLease ??= new FileStream(Path.Combine(_directory, "host.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
                    EnsureCollector();
                    var metrics = MemoryDiagnosticsMetrics.Read(_directory, _current);
                    MemoryDiagnosticsMetrics[] history;
                    lock (_gate)
                    {
                        _history.Enqueue(metrics);
                        while (_history.Count > 60) _history.Dequeue();
                        history = _history.ToArray(); _current = metrics;
                    }
                    var executions = ExecutionObservation.Snapshot(top: 50);
                    var triggers = MemoryDiagnosticsMetrics.Triggers(metrics, history.LastOrDefault(m => m.AtUtc <= metrics.AtUtc.AddSeconds(-9)));
                    if (triggers.Length > 0) _lastTrigger = metrics.AtUtc;
                    if (_incident == null && triggers.Length > 0)
                    {
                        _incident = NewIncident(Guid.NewGuid().ToString("N"), _boot, metrics.AtUtc, string.Join(",", triggers));
                        _lastIncidentWrite = DateTime.MinValue;
                    }
                    var checkpoint = BuildCheckpoint(metrics, history, executions);
                    _store.Write(Path.Combine(_directory, "checkpoint.json"), checkpoint);
                    if (_incident != null)
                    {
                        MergeIncident(_incident, checkpoint);
                        if ((metrics.AtUtc - _lastIncidentWrite).TotalSeconds >= 10)
                        {
                            var id = _incident.Value<string>("Id")!;
                            _store.Write(Path.Combine(_directory, "incident-state.json"), _incident);
                            PersistTenants(_incident);
                            if (!File.Exists(Path.Combine(_directory, "stacks-" + id + ".json"))) File.WriteAllText(Path.Combine(_directory, "capture.request"), id);
                            _lastIncidentWrite = metrics.AtUtc;
                        }
                        if ((metrics.AtUtc - _lastTrigger).TotalSeconds > 60 || (metrics.AtUtc - _incident.Value<DateTime>("OccurredAtUtc")).TotalMinutes > 5)
                        {
                            _incident["Status"] = "Recorded";
                            PersistTenants(_incident); _incident = null;
                            File.Delete(Path.Combine(_directory, "incident-state.json"));
                        }
                    }
                    if (++_iteration % 15 == 1) { RecoverInterruptedBoots(); _store.Trim(_boot); }
                    _storageError = "";
                }
                catch (Exception ex) { _storageError = ex.GetType().Name; }
                await Task.Delay(2000, stoppingToken).ConfigureAwait(false);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
        finally
        {
            try
            {
                var checkpoint = MemoryDiagnosticsStore.Read(Path.Combine(_directory, "checkpoint.json"));
                if (checkpoint != null) { checkpoint["GracefulStop"] = true; _store.Write(Path.Combine(_directory, "checkpoint.json"), checkpoint); }
                if (_incident != null) { _incident["Status"] = "HostStopping"; PersistTenants(_incident); }
            }
            catch { }
            try { await replay.WaitAsync(TimeSpan.FromSeconds(4)).ConfigureAwait(false); } catch { }
            try { await dependencies.WaitAsync(TimeSpan.FromSeconds(2)).ConfigureAwait(false); } catch { }
            _collector?.Dispose(); // Child flushes when this exact parent's identity exits.
            // 离线解析器有自己的 45 秒硬期限；停机不等待重型解析完成。
            _recoveryAnalyzer?.Dispose();
            _hostLease?.Dispose();
        }
    }

    private JObject BuildCheckpoint(MemoryDiagnosticsMetrics metrics, MemoryDiagnosticsMetrics[] history, ExecutionObservationWindow executions) => new()
    {
        ["BootId"] = _boot, ["NodeId"] = _node, ["ProcessId"] = _pid, ["ParentStartedTicks"] = _startedTicks,
        ["BuildVersion"] = _version, ["UpdatedAtUtc"] = metrics.AtUtc, ["GracefulStop"] = false,
        ["Current"] = JObject.FromObject(metrics), ["Frames"] = JArray.FromObject(history),
        ["ActiveCount"] = executions.ActiveCount, ["RegistryOverflowCount"] = executions.RegistryOverflowCount,
        ["Executions"] = JArray.FromObject(executions.Active.Concat(executions.Recent)),
        ["DefaultTenant"] = OsClient.GetConfigOsClient(), ["Evidence"] = Evidence(), ["MongoDB"] = _database.DeepClone()
    };

    private JObject NewIncident(string id, string boot, DateTime at, string trigger) => new()
    {
        ["Id"] = id, ["BootId"] = boot, ["NodeId"] = _node, ["BuildVersion"] = _version,
        ["OccurredAtUtc"] = at, ["UpdatedAtUtc"] = at, ["Trigger"] = trigger, ["Status"] = "Capturing",
        ["Executions"] = new JArray(), ["PeakRssBytes"] = 0,
        ["Boundary"] = "执行分配量和采样栈不是存活堆/RSS。异常退出不等于已证明 OOM；无归属、溢出、采集降级必须一并判断。"
    };

    private void MergeIncident(JObject incident, JObject checkpoint)
    {
        foreach (var key in new[] { "UpdatedAtUtc", "Frames", "Current", "ActiveCount", "RegistryOverflowCount", "Evidence", "DefaultTenant", "MongoDB" })
            incident[key] = checkpoint[key]?.DeepClone();
        incident["PeakRssBytes"] = Math.Max(incident.Value<long>("PeakRssBytes"), checkpoint["Current"]?.Value<long>("RssBytes") ?? 0);
        var all = (incident["Executions"] as JArray ?? new JArray()).Concat(checkpoint["Executions"] as JArray ?? new JArray()).OfType<JObject>();
        incident["Executions"] = new JArray(all.GroupBy(e => e.Value<string>("ExecutionId"))
            .Select(g => g.OrderByDescending(e => e.Value<long>("InclusiveAllocatedBytes")).First())
            .OrderByDescending(e => e.Value<long>("InclusiveAllocatedBytes")).Take(200).Select(e => e.DeepClone()));
        var bootDirectory = _store.BootDirectory(incident.Value<string>("BootId")!);
        var collector = MemoryDiagnosticsStore.Read(Path.Combine(bootDirectory, "collector.json"));
        if (collector != null)
        {
            incident["AllocationTop"] = AllocationTop(collector);
            incident["Collector"] = CollectorHealth(collector);
        }
        var stacks = MemoryDiagnosticsStore.Read(Path.Combine(bootDirectory, "stacks-" + incident.Value<string>("Id") + ".json"));
        if (stacks != null) incident["Stacks"] = stacks;
    }

    private void PersistTenants(JObject incident)
    {
        var tenants = (incident["Executions"] as JArray ?? new JArray()).OfType<JObject>().Select(e => e.Value<string>("OsClient"))
            .Append(incident.Value<string>("DefaultTenant")).Where(t => !string.IsNullOrWhiteSpace(t)).Distinct(StringComparer.OrdinalIgnoreCase).Take(200);
        foreach (var tenant in tenants) _store.SaveIncident(incident.Value<string>("BootId")!, MemoryDiagnosticsStore.ForTenant(incident, tenant!));
    }

    private void RecoverInterruptedBoots()
    {
        foreach (var directory in _store.BootDirectories().Where(p => Path.GetFileName(p) != _boot))
        {
            if (File.Exists(Path.Combine(directory, "recovered.json"))) continue;
            var checkpoint = MemoryDiagnosticsStore.Read(Path.Combine(directory, "checkpoint.json"));
            if (checkpoint == null || checkpoint.Value<bool>("GracefulStop")) continue;
            // A recreated container can have a different hostname/PID namespace.
            // An exclusive boot lease protects live nodes sharing this volume; use
            // PID identity only for legacy records without that lease.
            FileStream? recoveryLease = null;
            var leasePath = Path.Combine(directory, "host.lock");
            if (File.Exists(leasePath))
            {
                try { recoveryLease = new FileStream(leasePath, FileMode.Open, FileAccess.ReadWrite, FileShare.None); }
                catch (IOException) { continue; }
            }
            else if (checkpoint.Value<string>("NodeId") != _node || IsAlive(checkpoint.Value<int>("ProcessId"), checkpoint.Value<long>("ParentStartedTicks"))) continue;
            using var heldRecoveryLease = recoveryLease;
            // 父进程退出后，独立采集器仍可能正在保存最后一个栈片段；
            // 等待其释放租约再封存，避免提前标记“已恢复”导致最终栈永远不被补传。
            FileStream? collectorLease = null;
            var collectorLeasePath = Path.Combine(directory, "collector.lock");
            if (File.Exists(collectorLeasePath))
            {
                try { collectorLease = new FileStream(collectorLeasePath, FileMode.Open, FileAccess.ReadWrite, FileShare.None); }
                catch (IOException) { continue; }
            }
            using var heldCollectorLease = collectorLease;
            var boot = checkpoint.Value<string>("BootId")!;
            var id = Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(boot + ":unclean")))[..32].ToLowerInvariant();
            var incident = MemoryDiagnosticsStore.Read(Path.Combine(directory, "incident-state.json"))
                ?? NewIncident(id, boot, checkpoint.Value<DateTime>("UpdatedAtUtc"), "UncleanExit");
            incident["BuildVersion"] = checkpoint["BuildVersion"]?.DeepClone();
            incident["NodeId"] = checkpoint["NodeId"]?.DeepClone();
            MergeIncident(incident, checkpoint);
            var exitStacks = MemoryDiagnosticsStore.Read(Path.Combine(directory, "stacks-parent-exit.json"));
            if (exitStacks != null) incident["Stacks"] = exitStacks;
            if (incident["Stacks"] is not JObject || incident["Stacks"]!.Value<long>("Samples") == 0)
            {
                // Docker 停止整个容器时，采集器可能一起结束。后台启动有界解析器，
                // 优先解析最后一个片段，失败再尝试前一个完整片段；主采样循环不等待它。
                if (TryRecoverStackSegment(directory)) continue;
                var recoveredStacks = MemoryDiagnosticsStore.Read(Path.Combine(directory, "stacks-recovered.json"));
                if (recoveredStacks != null) incident["Stacks"] = recoveredStacks;
                else incident["StackRecoveryError"] = "NoUsablePersistedTraceSegment";
            }
            incident["Status"] = "RecoveredAfterUncleanExit";
            incident["UpdatedAtUtc"] = DateTime.UtcNow;
            incident["ExitEvidence"] = "Previous boot no longer holds its runtime lease; exact exit reason not available. Check kernel/cgroup OOM evidence.";
            PersistTenants(incident);
            _store.Write(Path.Combine(directory, "recovered.json"), new JObject { ["Id"] = incident["Id"], ["AtUtc"] = DateTime.UtcNow });
        }
    }

    private bool TryRecoverStackSegment(string directory)
    {
        var output = Path.Combine(directory, "stacks-recovered.json");
        // 仅有 AllocationTick 并不代表有方法栈：强杀片段可能缺少 rundown。
        // 继续尝试前一完整片段，并保留首段的接口身份与缺失计数。
        if ((MemoryDiagnosticsStore.Read(output)?["Top"] as JArray)?.OfType<JObject>()
            .Any(row => row["Execution"] is JObject && row["Stack"] is JArray frames && frames.Count > 0) == true) return false;
        if (!File.Exists(_helper)) return false;
        if (_recoveryAnalyzer != null)
        {
            _recoveryAnalyzer.Refresh();
            if (!_recoveryAnalyzer.HasExited)
            {
                if ((DateTime.UtcNow - _recoveryAnalyzerStarted).TotalSeconds < 45
                    && _recoveryAnalyzer.WorkingSet64 < 768L * 1024 * 1024) return true;
                try { _recoveryAnalyzer.Kill(entireProcessTree: true); } catch { }
            }
            _recoveryAnalyzer.Dispose(); _recoveryAnalyzer = null;
        }
        var markerPath = Path.Combine(directory, "stack-recovery-attempt.json");
        var marker = MemoryDiagnosticsStore.Read(markerPath);
        var attempts = marker?.Value<int>("Attempts") ?? 0;
        if (attempts >= 2) return false;
        if (marker?.Value<DateTime?>("StartedAtUtc") is DateTime at && DateTime.UtcNow - at < TimeSpan.FromSeconds(50)) return true;
        var file = Directory.EnumerateFiles(directory, "allocation-*.nettrace")
            .OrderByDescending(File.GetLastWriteTimeUtc).Skip(attempts).FirstOrDefault();
        if (file == null) return false;
        _store.Write(markerPath, new JObject { ["Attempts"] = attempts + 1, ["StartedAtUtc"] = DateTime.UtcNow });
        var command = new ProcessStartInfo("dotnet") { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = directory };
        command.Environment["DOTNET_GCHeapHardLimit"] = "0x18000000";
        command.ArgumentList.Add(_helper); command.ArgumentList.Add("analyze");
        command.ArgumentList.Add(file); command.ArgumentList.Add(output);
        _recoveryAnalyzerStarted = DateTime.UtcNow;
        _recoveryAnalyzer = Process.Start(command);
        return true;
    }

    private void EnsureCollector()
    {
        if (_collector != null && !_collector.HasExited)
        {
            var state = MemoryDiagnosticsStore.Read(Path.Combine(_directory, "collector.json"));
            var last = state?.Value<DateTime?>("SampledAtUtc") ?? _lastCollectorAttempt;
            _collector.Refresh();
            if ((DateTime.UtcNow - last).TotalSeconds < 30 && _collector.WorkingSet64 < 768L * 1024 * 1024) return;
            _collectorError = "StaleOrOverBudget";
            try { _collector.Kill(entireProcessTree: true); } catch { }
            _collectorFailures++;
        }
        if ((DateTime.UtcNow - _lastCollectorAttempt).TotalSeconds < Math.Min(300, 10 * Math.Max(1, _collectorFailures))) return;
        _lastCollectorAttempt = DateTime.UtcNow;
        if (!File.Exists(_helper)) { _collectorError = "CollectorBinaryMissing"; return; }
        try
        {
            _collector?.Dispose();
            var command = new ProcessStartInfo("dotnet") { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = _directory };
            command.ArgumentList.Add(_helper); command.ArgumentList.Add(_pid.ToString()); command.ArgumentList.Add(_startedTicks.ToString());
            command.ArgumentList.Add(_boot); command.ArgumentList.Add(_directory);
            // .NET host setting scoped only to the helper, not an API business switch.
            command.Environment["DOTNET_GCHeapHardLimit"] = "0x18000000";
            _collector = Process.Start(command); _collectorError = "Starting";
        }
        catch (Exception ex) { _collectorError = ex.GetType().Name; _collectorFailures++; }
    }

    private async Task ReplayLoopAsync(CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            try
            {
                var repository = _services.GetService<IMemoryIncidentRepository>();
                var pending = _store.IncidentFiles().Select(p => new { Path = p, Date = File.GetLastWriteTimeUtc(p) })
                    .Where(f => !File.Exists(f.Path + ".ack") || File.GetLastWriteTimeUtc(f.Path + ".ack") < f.Date).OrderBy(f => f.Date).ToArray();
                _pending = pending.Length;
                if (repository != null)
                {
                    var batch = pending.Skip(_replayCursor).Concat(pending.Take(_replayCursor)).Take(4).ToArray();
                    _replayCursor = pending.Length == 0 ? 0 : (_replayCursor + batch.Length) % pending.Length;
                    _sharedError = "";
                    foreach (var file in batch)
                    {
                        try
                        {
                        var incident = MemoryDiagnosticsStore.Read(file.Path);
                        if (incident == null) continue;
                        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token);
                        timeout.CancelAfter(TimeSpan.FromSeconds(3));
                        await repository.SaveAsync(incident.Value<string>("Tenant")!, incident, timeout.Token).ConfigureAwait(false);
                        if (File.GetLastWriteTimeUtc(file.Path) == file.Date) File.WriteAllText(file.Path + ".ack", incident.Value<string>("Id"));
                        Interlocked.Increment(ref _replayed);
                        }
                        catch (Exception ex) { _sharedError = ex.GetType().Name; }
                    }
                }
                else _sharedError = "MongoIncidentRepositoryUnavailable";
            }
            catch (Exception ex) { _sharedError = ex.GetType().Name; }
            try { await Task.Delay(10000, token).ConfigureAwait(false); } catch (OperationCanceledException) { break; }
        }
    }

    public async Task<JObject> QueryAsync(string action, string tenant, string incidentId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(tenant)) throw new ArgumentException("Tenant required.");
        if (action == "memory")
        {
            var collector = MemoryDiagnosticsStore.Read(Path.Combine(_directory, "collector.json"));
            JObject result;
            lock (_gate) result = new JObject { ["Current"] = _current == null ? null : JObject.FromObject(_current), ["History"] = JArray.FromObject(_history) };
            result["BootId"] = _boot; result["NodeId"] = _node; result["BuildVersion"] = _version; result["CurrentNodeOnly"] = true;
            result["Executions"] = JObject.FromObject(ExecutionObservation.Snapshot(tenant, 100));
            result["Collector"] = CollectorHealth(collector);
            result["AllocationTop"] = MemoryDiagnosticsStore.FilterAllocations(AllocationTop(collector), tenant);
            result["Evidence"] = Evidence();
            result["MongoDB"] = _database.DeepClone();
            if (!string.Equals(tenant, OsClient.GetConfigOsClient(), StringComparison.OrdinalIgnoreCase))
                foreach (var name in new[] { "LogDataBytes", "LogStorageBytes", "LogIndexBytes" }) ((JObject)result["MongoDB"]!).Remove(name);
            return result;
        }
        if (action == "memoryincident" && !Guid.TryParseExact(incidentId, "N", out _)) throw new ArgumentException("IncidentId must be a 32-character identifier.");
        var local = _store.LocalIncidents(tenant, action == "memoryincident" ? incidentId : null).ToList();
        var remote = new List<JObject>();
        var shared = "Available";
        try
        {
            var repository = _services.GetService<IMemoryIncidentRepository>();
            if (repository == null) shared = "Unavailable";
            else if (action == "memoryincident") { var value = await repository.GetAsync(tenant, incidentId, cancellationToken).ConfigureAwait(false); if (value != null) remote.Add(value); }
            else remote.AddRange(await repository.ListAsync(tenant, 50, cancellationToken).ConfigureAwait(false));
        }
        catch (Exception ex) { shared = ex.GetType().Name; }
        var merged = local.Concat(remote).GroupBy(v => v.Value<string>("Id"))
            .Select(g => g.OrderByDescending(v => v.Value<DateTime>("UpdatedAtUtc")).First())
            .OrderByDescending(v => v.Value<DateTime>("OccurredAtUtc")).Take(50).ToList();
        return new JObject
        {
            ["Items"] = new JArray(merged.Select(v => action == "memoryincident" ? v : MemoryDiagnosticsStore.Summary(v))),
            ["SharedStorage"] = shared, ["LocalFallbackAvailable"] = local.Count > 0,
            ["Scope"] = "Tenant shared history plus current node persistent WAL; other nodes' unuploaded WAL is not visible.", ["Evidence"] = Evidence()
        };
    }

    private JObject Evidence() => new()
    {
        ["EnabledByDefault"] = true, ["IndependentOfV8Limits"] = true, ["CheckpointIntervalSeconds"] = 2,
        ["RetentionDays"] = 14, ["LocalBudgetBytes"] = 256L * 1024 * 1024, ["PendingUploads"] = _pending,
        ["SharedWrites"] = Interlocked.Read(ref _replayed), ["SharedStorageError"] = _sharedError,
        ["LocalStorageError"] = _storageError.Length == 0 ? _store.LastError : _storageError, ["DroppedUnuploadedFiles"] = _store.DroppedFiles,
        ["CollectorLauncherError"] = _collectorError, ["PersistedVolumeRequired"] = true,
        ["AllocationBoundary"] = "累计分配、分配采样与存活内存不同；不能把最高分配者自动判为唯一根因。线程累计分配在执行边界结算，长循环实时分配请看独立采样；后台身份刷新不代表业务已取得进展。",
        ["CrashBoundary"] = "正常采样间隔 2 秒，调度阻塞、磁盘满/丢失、进程早期崩溃会扩大缺口；不承诺零丢失。"
    };

    private JObject CollectorHealth(JObject? collector)
    {
        var at = collector?.Value<DateTime?>("SampledAtUtc");
        var fresh = at != null && (DateTime.UtcNow - at.Value).TotalSeconds <= 10;
        var compatible = collector?.Value<int?>("IdentityProtocolVersion") >= 2;
        var mismatch = fresh && !compatible;
        if (fresh && compatible && collector?.Value<string>("Status") == "Collecting") _collectorError = "";
        return new JObject
        {
            ["Status"] = mismatch ? "Degraded" : collector?.Value<string>("Status") ?? "Unavailable", ["Fresh"] = fresh,
            ["SampledAtUtc"] = at, ["Error"] = mismatch ? "IdentityProtocolMismatch: update API and diagnostics helper together" : collector?.Value<string>("Error") ?? _collectorError,
            ["LastCaptureError"] = collector?.Value<string>("LastCaptureError") ?? "",
            ["AllocationSamples"] = collector?.Value<long>("AllocationSamples") ?? 0,
            ["UnattributedEstimatedBytes"] = collector?.Value<long>("UnattributedEstimatedBytes") ?? 0,
            ["OverflowSamples"] = collector?.Value<long>("OverflowSamples") ?? 0,
            ["LostEvents"] = collector?.Value<long>("LostEvents") ?? 0,
            ["IdentityProtocolVersion"] = collector?.Value<int?>("IdentityProtocolVersion"),
            ["ObservedIdentityProtocolVersion"] = collector?.Value<int?>("ObservedIdentityProtocolVersion"),
            ["BackgroundIdentityRefreshes"] = collector?.Value<long?>("BackgroundIdentityRefreshes"),
            ["RejectedStaleIdentityMarkers"] = collector?.Value<long?>("RejectedStaleIdentityMarkers"),
            ["Boundary"] = "GC 分配事件是抽样；会话轮换/非托管/未标记线程产生归属缺口。"
        };
    }

    private static JArray AllocationTop(JObject? collector)
    {
        if (collector?["Windows"] is not JArray windows) return new JArray();
        return new JArray(windows.OfType<JObject>().SelectMany(w => (w["Top"] as JArray ?? new JArray()).OfType<JObject>())
            .GroupBy(r => ((r["Execution"] as JObject)?.Value<string>("ExecutionId") ?? "unknown") + "|" + r.Value<string>("Type"))
            .Select(g => new JObject
            {
                ["Execution"] = g.First()["Execution"]?.DeepClone(), ["Type"] = g.First()["Type"]?.DeepClone(),
                ["EstimatedAllocatedBytes"] = g.Sum(r => r.Value<long>("EstimatedAllocatedBytes")), ["Samples"] = g.Sum(r => r.Value<long>("Samples"))
            }).OrderByDescending(r => r.Value<long>("EstimatedAllocatedBytes")).Take(100));
    }

    private static bool IsAlive(int pid, long ticks)
    {
        try { using var p = Process.GetProcessById(pid); return !p.HasExited && Microi.MemoryDiagnostics.ProcessStartIdentity.Read(pid) == ticks; } catch { return false; }
    }

    private async Task DatabaseLoopAsync(CancellationToken token)
    {
        while (!token.IsCancellationRequested)
        {
            try
            {
                var repository = _services.GetService<IMemoryIncidentRepository>();
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token);
                timeout.CancelAfter(TimeSpan.FromSeconds(3));
                _database = repository == null ? new JObject { ["Status"] = "Unavailable" }
                    : await repository.GetMemoryStatusAsync(OsClient.GetConfigOsClient(), timeout.Token).ConfigureAwait(false);
            }
            catch (Exception ex) { _database = new JObject { ["Status"] = "Unavailable", ["Error"] = ex.GetType().Name, ["SampledAtUtc"] = DateTime.UtcNow }; }
            try { await Task.Delay(30000, token).ConfigureAwait(false); } catch (OperationCanceledException) { break; }
        }
    }
}

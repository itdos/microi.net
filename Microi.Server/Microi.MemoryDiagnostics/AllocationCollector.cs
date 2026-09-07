using System.Diagnostics;
using System.Diagnostics.Tracing;
using System.Text.Json;
using Microsoft.Diagnostics.NETCore.Client;
using Microsoft.Diagnostics.Tracing;

namespace Microi.MemoryDiagnostics;

/// <summary>
/// 在 API 之外采集，每两秒保存分配样本并保留有界原始片段。
/// GC 分配事件表示估计的累计分配，不能当成存活内存或完整归属证据。
/// </summary>
public sealed class AllocationCollector(int pid, long startedTicks, string bootId, string directory)
{
    private readonly object _gate = new();
    private readonly ExecutionMarkerTable _threads = new();
    private readonly Dictionary<string, AllocationTotal> _allocations = new();
    private readonly Queue<AllocationWindow> _windows = new();
    private long _samples, _unattributed, _overflow;
    private long _lostEvents;
    private long _truncatedSegments;
    private string _status = "Starting", _error = "";
    private string _lastCaptureError = "";
    private DateTime _segmentStart = DateTime.UtcNow;
    private int _segment;
    private int _flushing;
    private readonly string _attempt = DateTime.UtcNow.ToString("yyyyMMddHHmmssfff");
    internal const long RawSegmentLimit = 64L * 1024 * 1024;
    // 完整平台已测得约 35 MiB rundown。为收尾留出空间，且仍保持固定硬上限。
    private const long RawSegmentRotationThreshold = RawSegmentLimit / 4;

    public async Task RunAsync()
    {
        Directory.CreateDirectory(directory);
        using var lease = new FileStream(Path.Combine(directory, "collector.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
        using var shutdown = new CancellationTokenSource();
        var heartbeat = Task.Run(async () =>
        {
            while (!shutdown.IsCancellationRequested)
            {
                Flush();
                await Task.Delay(2000, shutdown.Token).ConfigureAwait(false);
            }
        });
        try
        {
            while (ParentAlive())
            {
                try { await CollectSegmentAsync().ConfigureAwait(false); }
                catch (Exception ex)
                {
                    _status = "Degraded";
                    _error = ex.GetType().Name; // 不输出连接细节或任意异常正文。
                    Flush();
                    if (!ParentAlive()) break;
                    await Task.Delay(5000).ConfigureAwait(false);
                }
            }
            _status = "ParentExited";
        }
        finally
        {
            shutdown.Cancel();
            try { await heartbeat.ConfigureAwait(false); } catch (OperationCanceledException) { }
            Flush();
        }
    }

    private bool ParentAlive()
    {
        try
        {
            using var parent = Process.GetProcessById(pid);
            return !parent.HasExited && ProcessStartIdentity.Read(pid) == startedTicks;
        }
        catch { return false; }
    }

    private async Task CollectSegmentAsync()
    {
        var client = new DiagnosticsClient(pid);
        var providers = new[]
        {
            new EventPipeProvider("Microsoft-Windows-DotNETRuntime", EventLevel.Verbose, 0x1),
            new EventPipeProvider("Microi-Execution", EventLevel.Informational)
        };
        // 16/32 MiB 缓冲在完整 API 的 rundown 阶段会丢事件；64 MiB 实测完整收尾。
        using var session = client.StartEventPipeSession(providers, requestRundown: true, circularBufferMB: 64);
        PruneRawSegments();
        var file = Path.Combine(directory, $"allocation-{_attempt}-{Interlocked.Increment(ref _segment):D6}.nettrace");
        // 目标进程卡住时，本机诊断 IPC 也可能阻塞；只结束本采集器，由 API 退避重启。
        using var deadlineGuard = new Timer(_ => Environment.Exit(2), null, 45000, Timeout.Infinite);
        using var raw = new FileStream(file, FileMode.CreateNew, FileAccess.Write, FileShare.Read, 65536);
        using var tee = new BoundedTeeStream(session.EventStream, raw, RawSegmentLimit);
        using var source = new EventPipeEventSource(tee);
        lock (_gate) { _threads.Clear(); _segmentStart = DateTime.UtcNow; }
        _status = "Collecting";
        _error = "";
        source.Dynamic.All += data =>
        {
            lock (_gate) _threads.Accept(data);
        };
        source.Clr.GCAllocationTick += data =>
        {
            var amount = data.AllocationAmount64 != 0 ? data.AllocationAmount64 : data.AllocationAmount;
            if (amount < 0) return;
            lock (_gate)
            {
                _samples++;
                var identity = _threads.Find(data.ThreadID);
                if (identity == null) _unattributed += amount;
                var type = (data.TypeName ?? "unknown");
                if (type.Length > 300) type = type[..300];
                var key = (identity?.ExecutionId ?? "unattributed") + "|" + type;
                if (!_allocations.TryGetValue(key, out var total))
                {
                    if (_allocations.Count >= 4000) { _overflow++; return; }
                    total = new AllocationTotal { Execution = identity, Type = type };
                    _allocations[key] = total;
                }
                total.EstimatedAllocatedBytes += amount;
                total.Samples++;
            }
        };
        var processing = Task.Run(() => source.Process());
        var deadline = DateTime.UtcNow.AddSeconds(15);
        while (!processing.IsCompleted && ParentAlive() && tee.WrittenBytes < RawSegmentRotationThreshold && DateTime.UtcNow < deadline)
            await Task.Delay(100).ConfigureAwait(false);
        try { await Task.Run(() => session.Stop()).WaitAsync(TimeSpan.FromSeconds(5)).ConfigureAwait(false); } catch { }
        if (await Task.WhenAny(processing, Task.Delay(5000)).ConfigureAwait(false) != processing)
        {
            session.Dispose();
            source.StopProcessing();
        }
        await processing.WaitAsync(TimeSpan.FromSeconds(5)).ConfigureAwait(false);
        Interlocked.Add(ref _lostEvents, source.EventsLost);
        raw.Flush(true);
        // Windows 离线解析要求关闭写句柄，单纯 Flush 后仍会产生共享冲突。
        raw.Dispose();
        Flush();
        // 只在事故或父进程退出时解析；重型栈解析始终留在独立进程。
        var requestPath = Path.Combine(directory, "capture.request");
        var captureId = File.Exists(requestPath) ? File.ReadAllText(requestPath).Trim() : "";
        if (Guid.TryParseExact(captureId, "N", out _) || !ParentAlive())
        {
            try
            {
                var name = Guid.TryParseExact(captureId, "N", out _) ? "stacks-" + captureId : "stacks-parent-exit";
                TraceAnalysis.Write(file, Path.Combine(directory, name + ".json"));
                _lastCaptureError = "";
                if (File.Exists(requestPath) && File.ReadAllText(requestPath).Trim() == captureId) File.Delete(requestPath);
            }
            catch (Exception ex) { _lastCaptureError = "StackAnalysis:" + ex.GetType().Name; }
        }
        if (tee.Truncated) Interlocked.Increment(ref _truncatedSegments);
        PruneRawSegments();
        foreach (var old in Directory.EnumerateFiles(directory, "*.etlx")) File.Delete(old);
    }

    private void PruneRawSegments()
    {
        // 保留最近两段用于尾段与完整前段恢复；加上正在写入的一段最多 192 MiB。
        foreach (var old in Directory.EnumerateFiles(directory, "allocation-*.nettrace")
                     .OrderByDescending(p => p, StringComparer.Ordinal).Skip(2))
            File.Delete(old);
    }

    private void Flush()
    {
        if (Interlocked.Exchange(ref _flushing, 1) != 0) return;
        try
        {
            AllocationWindow window;
            AllocationWindow[] windows;
            long samples, unknown, overflow, refreshes, stale;
            int protocol;
            lock (_gate)
            {
                var now = DateTime.UtcNow;
                window = new AllocationWindow
                {
                    AtUtc = now,
                    Top = _allocations.Values.OrderByDescending(x => x.EstimatedAllocatedBytes).Take(50).ToArray()
                };
                _allocations.Clear();
                _windows.Enqueue(window);
                while (_windows.Count > 20) _windows.Dequeue();
                windows = _windows.ToArray(); samples = _samples; unknown = _unattributed; overflow = _overflow + _threads.OverflowCount;
                refreshes = _threads.BackgroundRefreshCount; stale = _threads.RejectedStaleCount; protocol = _threads.ObservedProtocolVersion;
            }
            WriteJson(Path.Combine(directory, "collector.json"), new
            {
                BootId = bootId, ProcessId = pid, ParentStartedTicks = startedTicks,
                SampledAtUtc = DateTime.UtcNow, Status = _status,
                Error = _error.Length > 0 ? _error : Interlocked.Read(ref _truncatedSegments) > 0
                    ? "RawSegmentSizeLimit: truncated raw segments=" + Interlocked.Read(ref _truncatedSegments) + "; live samples retained, stacks may be incomplete" : "",
                RawTruncatedSegments = Interlocked.Read(ref _truncatedSegments),
                LastCaptureError = _lastCaptureError,
                Accounting = "EventPipe sampled allocation traffic; not retained bytes. Unattributed and dropped samples are explicit.",
                AllocationSamples = samples, UnattributedEstimatedBytes = unknown, OverflowSamples = overflow,
                IdentityProtocolVersion = 2, ObservedIdentityProtocolVersion = protocol,
                BackgroundIdentityRefreshes = refreshes, RejectedStaleIdentityMarkers = stale,
                LostEvents = Interlocked.Read(ref _lostEvents),
                SegmentStartedAtUtc = _segmentStart, Windows = windows
            });
        }
        catch { /* parent exposes stale heartbeat; do not flood stdout or retry allocate */ }
        finally { Volatile.Write(ref _flushing, 0); }
    }

    internal static void WriteJson(string path, object value)
    {
        var temp = path + ".tmp";
        using (var stream = new FileStream(temp, FileMode.Create, FileAccess.Write, FileShare.None))
        {
            JsonSerializer.Serialize(stream, value);
            stream.Flush(true);
        }
        File.Move(temp, path, true);
    }
}

public sealed class ExecutionIdentity
{
    public string ExecutionId { get; set; } = "";
    public string ParentExecutionId { get; set; } = "";
    public string TraceId { get; set; } = "";
    public string OsClient { get; set; } = "";
    public string Kind { get; set; } = "";
    public string Key { get; set; } = "";
    public string Table { get; set; } = "";
    public string Event { get; set; } = "";
    public string ScriptHash { get; set; } = "";
    public string Stage { get; set; } = "";
}
public sealed class AllocationTotal
{
    public ExecutionIdentity? Execution { get; set; }
    public string Type { get; set; } = "";
    public long EstimatedAllocatedBytes { get; set; }
    public long Samples { get; set; }
}
public sealed class AllocationWindow
{
    public DateTime AtUtc { get; set; }
    public AllocationTotal[] Top { get; set; } = [];
}

internal sealed class BoundedTeeStream(Stream source, Stream copy, long maxBytes) : Stream
{
    private long _written;
    public long WrittenBytes => Interlocked.Read(ref _written);
    public bool Truncated { get; private set; }
    public override int Read(byte[] buffer, int offset, int count)
    {
        var read = source.Read(buffer, offset, count);
        var write = (int)Math.Min(read, Math.Max(0, maxBytes - _written));
        if (write > 0) { copy.Write(buffer, offset, write); Interlocked.Add(ref _written, write); }
        if (write < read) Truncated = true;
        return read;
    }
    public override bool CanRead => true;
    public override bool CanSeek => false;
    public override bool CanWrite => false;
    public override long Length => throw new NotSupportedException();
    public override long Position { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
    public override void Flush() => copy.Flush();
    public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException();
    public override void SetLength(long value) => throw new NotSupportedException();
    public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
}

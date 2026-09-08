using Microsoft.Diagnostics.Tracing;

namespace Microi.MemoryDiagnostics;

/// <summary>Shared by live and recovered traces; entries (including clears) are bounded per segment.</summary>
public sealed class ExecutionMarkerTable
{
    private readonly Dictionary<int, Marker> _threads = new();
    public long OverflowCount { get; private set; }
    public long RejectedStaleCount { get; private set; }
    public long BackgroundRefreshCount { get; private set; }
    public int ObservedProtocolVersion { get; private set; }
    public void Clear() => _threads.Clear();
    public ExecutionIdentity? Find(int nativeThreadId) => _threads.TryGetValue(nativeThreadId, out var marker) ? marker.Identity : null;

    public void Accept(TraceEvent data)
    {
        if (data.ProviderName != "Microi-Execution") return;
        var version = (int)data.ID;
        if (version != 1 && version != 2) return;
        var thread = version == 2 ? Convert.ToInt32(data.PayloadByName("nativeThreadId")) : data.ThreadID;
        var revision = version == 2 ? Convert.ToInt64(data.PayloadByName("revision")) : 0;
        if (version == 2 && Convert.ToBoolean(data.PayloadByName("refresh"))) BackgroundRefreshCount++;
        ObservedProtocolVersion = Math.Max(version, ObservedProtocolVersion);
        var id = Text(data, "executionId", 32);
        Update(thread, revision, id.Length == 0 ? null : new ExecutionIdentity
        {
            ExecutionId = id, ParentExecutionId = Text(data, "parentId", 32), TraceId = Text(data, "traceId", 32),
            OsClient = Text(data, "tenant", 64), Kind = Text(data, "kind", 32), Key = Text(data, "key", 256),
            Table = Text(data, "table", 128), Event = Text(data, "eventName", 80),
            ScriptHash = Text(data, "scriptHash", 64), Stage = Text(data, "stage", 80)
        });
    }

    public void Update(int nativeThreadId, long revision, ExecutionIdentity? identity)
    {
        if (nativeThreadId <= 0) return;
        if (_threads.TryGetValue(nativeThreadId, out var previous))
        {
            if (revision < previous.Revision) { RejectedStaleCount++; return; }
        }
        else if (_threads.Count >= 10000) { OverflowCount++; return; }
        // Keep a tombstone on clear: a late refresh must not resurrect a completed request.
        _threads[nativeThreadId] = new Marker(revision, identity);
    }

    private static string Text(TraceEvent data, string name, int limit)
    {
        var value = data.PayloadByName(name)?.ToString() ?? "";
        return value.Length > limit ? value[..limit] : value;
    }
    private sealed record Marker(long Revision, ExecutionIdentity? Identity);
}

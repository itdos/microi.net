using Microsoft.Diagnostics.Tracing;
using Microsoft.Diagnostics.Tracing.Etlx;
using System.Text.Json.Nodes;

namespace Microi.MemoryDiagnostics;

public static class TraceAnalysis
{
    /// <summary>两个不重叠片段合并；保留不完整尾段的身份，同时补回完整片段的方法栈。</summary>
    public static void MergeRecovered(string output, string segment)
    {
        JsonObject? Read(string file) => File.Exists(file) && new FileInfo(file).Length <= 3 * 1024 * 1024
            ? JsonNode.Parse(File.ReadAllText(file)) as JsonObject : null;
        var previous = Read(output);
        var current = Read(segment) ?? throw new InvalidDataException("No analyzed trace segment.");
        if (previous != null)
        {
            var rows = (previous["Top"] as JsonArray ?? []).Concat(current["Top"] as JsonArray ?? []).OfType<JsonObject>();
            var merged = rows.GroupBy(row => (row["Execution"]?["ExecutionId"]?.ToString() ?? "unknown") + "|" + row["Type"] + "|" + row["Stack"]?.ToJsonString())
                .Select(group =>
                {
                    var value = (JsonObject)group.First().DeepClone();
                    value["Samples"] = group.Sum(row => row["Samples"]?.GetValue<long>() ?? 0);
                    value["EstimatedAllocatedBytes"] = group.Sum(row => row["EstimatedAllocatedBytes"]?.GetValue<long>() ?? 0);
                    return value;
                }).OrderByDescending(row => row["EstimatedAllocatedBytes"]?.GetValue<long>() ?? 0).Take(50);
            current["Top"] = new JsonArray(merged.Cast<JsonNode>().ToArray());
            foreach (var name in new[] { "Samples", "MissingStackSamples", "OverflowSamples", "LostEvents", "BackgroundIdentityRefreshes", "RejectedStaleIdentityMarkers" })
                current[name] = (previous[name]?.GetValue<long>() ?? 0) + (current[name]?.GetValue<long>() ?? 0);
            current["ObservedIdentityProtocolVersion"] = Math.Max(previous["ObservedIdentityProtocolVersion"]?.GetValue<int>() ?? 0,
                current["ObservedIdentityProtocolVersion"]?.GetValue<int>() ?? 0);
            var starts = new[] { previous["StartedAtUtc"]?.ToString(), current["StartedAtUtc"]?.ToString() }.Where(x => x != null).Order().ToArray();
            var ends = new[] { previous["EndedAtUtc"]?.ToString(), current["EndedAtUtc"]?.ToString() }.Where(x => x != null).Order().ToArray();
            current["StartedAtUtc"] = starts.FirstOrDefault(); current["EndedAtUtc"] = ends.LastOrDefault();
        }
        current["RecoveredSegmentCount"] = (previous?["RecoveredSegmentCount"]?.GetValue<int>() ?? 0) + 1;
        AllocationCollector.WriteJson(output, current);
    }

    public static void Write(string input, string output)
    {
        if (new FileInfo(input).Length > AllocationCollector.RawSegmentLimit) throw new InvalidOperationException("Trace segment exceeds analysis budget.");
        var etlx = TraceLog.CreateFromEventPipeDataFile(input, null, new TraceLogOptions { ContinueOnError = true });
        using var trace = new TraceLog(etlx);
        using var source = trace.Events.GetSource();
        var identities = new ExecutionMarkerTable();
        var totals = new Dictionary<string, StackTotal>();
        long samples = 0, missing = 0, overflow = 0;
        source.Dynamic.All += identities.Accept;
        source.Clr.GCAllocationTick += data =>
        {
            samples++;
            var identity = identities.Find(data.ThreadID);
            var frames = new List<string>();
            for (var frame = data.CallStack(); frame != null && frames.Count < 32; frame = frame.Caller)
            {
                var name = frame.CodeAddress.FullMethodName;
                if (!string.IsNullOrWhiteSpace(name)) frames.Add(name.Length > 400 ? name[..400] : name);
            }
            if (frames.Count == 0) missing++;
            var type = data.TypeName ?? "unknown";
            var key = (identity?.ExecutionId ?? "unknown") + "|" + type + "|" + string.Join("\n", frames);
            if (!totals.TryGetValue(key, out var total))
            {
                if (totals.Count >= 2000) { overflow++; return; }
                totals[key] = total = new StackTotal { Execution = identity, Type = type, Stack = frames.ToArray() };
            }
            total.EstimatedAllocatedBytes += data.AllocationAmount64 != 0 ? data.AllocationAmount64 : data.AllocationAmount;
            total.Samples++;
        };
        source.Process();
        AllocationCollector.WriteJson(output, new
        {
            StartedAtUtc = trace.SessionStartTime.ToUniversalTime(), EndedAtUtc = trace.SessionEndTime.ToUniversalTime(),
            Samples = samples, MissingStackSamples = missing, OverflowSamples = overflow + identities.OverflowCount,
            IdentityProtocolVersion = 2, ObservedIdentityProtocolVersion = identities.ObservedProtocolVersion,
            BackgroundIdentityRefreshes = identities.BackgroundRefreshCount, RejectedStaleIdentityMarkers = identities.RejectedStaleCount,
            LostEvents = trace.EventsLost,
            Accounting = "Sampled cumulative allocation with execution markers; not retained heap or proof of sole cause.",
            Top = totals.Values.OrderByDescending(x => x.EstimatedAllocatedBytes).Take(50).ToArray()
        });
    }
    private sealed class StackTotal
    {
        public ExecutionIdentity? Execution { get; set; }
        public string Type { get; set; } = "";
        public string[] Stack { get; set; } = [];
        public long EstimatedAllocatedBytes { get; set; }
        public long Samples { get; set; }
    }
}

using System.Reflection;
using System.Text.Json;
using Microi.MemoryDiagnostics;

internal static class SegmentRotationRegression
{
    public static async Task RunAsync(int processId, string directory)
    {
        Directory.CreateDirectory(directory);
        var collector = new AllocationCollector(processId, ProcessStartIdentity.Read(processId), Guid.NewGuid().ToString("N"), directory);
        var capture = typeof(AllocationCollector).GetMethod("CollectSegmentAsync", BindingFlags.Instance | BindingFlags.NonPublic)!;
        var truncated = typeof(AllocationCollector).GetField("_truncatedSegments", BindingFlags.Instance | BindingFlags.NonPublic)!;
        var results = new List<object>();
        for (var round = 0; round < 3; round++)
        {
            await (Task)capture.Invoke(collector, null)!;
            var file = Directory.EnumerateFiles(directory, "allocation-*.nettrace").Order(StringComparer.Ordinal).Last();
            var length = new FileInfo(file).Length;
            if (length <= 0 || length > AllocationCollector.RawSegmentLimit) throw new InvalidOperationException("Raw trace exceeded its fixed budget.");
            if ((long)truncated.GetValue(collector)! != 0) throw new InvalidOperationException("Size rotation truncated EventPipe rundown.");
            var output = Path.Combine(directory, "rotation-" + round + ".json");
            TraceAnalysis.Write(file, output);
            using var analysis = JsonDocument.Parse(File.ReadAllText(output));
            var evidence = analysis.RootElement;
            var samples = evidence.GetProperty("Samples").GetInt64();
            var lost = evidence.GetProperty("LostEvents").GetInt64();
            var missing = evidence.GetProperty("MissingStackSamples").GetInt64();
            if (samples <= 0 || lost != 0 || missing != 0) throw new InvalidOperationException($"Trace must retain allocation samples and resolved stacks: samples={samples}, lost={lost}, missing={missing}.");
            if (Directory.EnumerateFiles(directory, "allocation-*.nettrace").Count() > 2) throw new InvalidOperationException("Completed trace retention exceeded two segments.");
            results.Add(new { Round = round, Bytes = length, Samples = samples, LostEvents = lost, MissingStackSamples = missing });
        }
        Console.WriteLine(JsonSerializer.Serialize(new { Passed = true, ProcessId = processId, Segments = results }));
    }
}

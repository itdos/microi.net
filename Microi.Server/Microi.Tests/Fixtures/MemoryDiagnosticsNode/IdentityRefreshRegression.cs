using System.Diagnostics;
using System.Diagnostics.Tracing;
using System.Text.Json;
using Microi.MemoryDiagnostics;
using Microi.net;
using Microsoft.Diagnostics.NETCore.Client;
using Microsoft.Diagnostics.Tracing;

internal static class IdentityRefreshRegression
{
    public static async Task RunAsync(string directory)
    {
        Directory.CreateDirectory(directory);
        void Assert(bool value, string message) { if (!value) throw new InvalidOperationException(message); }
        var table = new ExecutionMarkerTable();
        table.Update(7, 10, new ExecutionIdentity { Key = "child" });
        table.Update(7, 9, new ExecutionIdentity { Key = "parent" });
        Assert(table.Find(7)?.Key == "child", "late refresh changed current execution");
        table.Update(7, 11, null);
        table.Update(7, 10, new ExecutionIdentity { Key = "child" });
        Assert(table.Find(7) == null && table.RejectedStaleCount == 2, "late refresh resurrected completed execution");
        table.Update(7, 12, new ExecutionIdentity { Key = "next-tenant" });
        Assert(table.Find(7)?.Key == "next-tenant", "reused thread did not advance");
        for (var i = 1; i <= 10001; i++) table.Update(i, 20, null);
        Assert(table.OverflowCount > 0, "identity map/tombstones are not bounded");
        table.Clear();
        table.Update(1, 0, new ExecutionIdentity { Key = "legacy" });
        Assert(table.Find(1)?.Key == "legacy", "legacy markers unsupported");

        // Exhaust only THIS isolated test process's pool. Identity refresh must keep working.
        using (var listener = new RefreshListener())
        using (var poolBusy = new ManualResetEventSlim())
        using (var releasePool = new ManualResetEventSlim())
        {
            ThreadPool.GetMinThreads(out var minWorker, out var minIo);
            ThreadPool.GetMaxThreads(out var maxWorker, out var maxIo);
            try
            {
                Assert(ThreadPool.SetMinThreads(1, minIo) && ThreadPool.SetMaxThreads(1, maxIo), "could not constrain isolated pool");
                ThreadPool.QueueUserWorkItem(_ => { poolBusy.Set(); releasePool.Wait(); });
                Assert(poolBusy.Wait(TimeSpan.FromSeconds(3)), "pool blocker did not start");
                using var scope = ExecutionObservation.Enter("V8", "pool-starved-test", "pool-test");
                Assert(listener.Refreshed.Wait(TimeSpan.FromSeconds(3)), "identity publisher depends on exhausted ThreadPool");
            }
            finally
            {
                releasePool.Set();
                ThreadPool.SetMaxThreads(maxWorker, maxIo); ThreadPool.SetMinThreads(minWorker, minIo);
            }
        }

        using var ready = new CountdownEvent(2);
        using var stop = new CancellationTokenSource(TimeSpan.FromSeconds(30));
        var failures = new System.Collections.Concurrent.ConcurrentQueue<Exception>();
        var executionIds = new string[2];
        var workers = Enumerable.Range(0, 2).Select(index => new Thread(() =>
        {
            try
            {
                using var api = ExecutionObservation.Enter("ApiEngine", "busy-api-" + index, "identity-" + index);
                using var v8 = ExecutionObservation.Enter("V8", "busy-script-" + index, "identity-" + index,
                    "test_orders", "DataFilterV8", "bounded test workload");
                executionIds[index] = ExecutionObservation.CurrentExecutionId;
                using var engine = new V8Engine().CreateEngine(new CreateV8EngineParam { UnlimitedRuntime = true });
                // This callback checks only the test shutdown flag: it does not pulse or alter identity.
                engine.SetValue("testStopped", new Func<bool>(() => stop.IsCancellationRequested));
                ready.Signal();
                engine.Evaluate("var s=0; while(!testStopped()){for(var i=0;i<20000;i++)s+=i;}s;");
            }
            catch (Exception ex) { failures.Enqueue(ex); }
        }) { IsBackground = true, Name = "identity-regression-" + index }).ToArray();
        var segments = new List<object>();
        try
        {
            foreach (var worker in workers) worker.Start();
            Assert(ready.Wait(TimeSpan.FromSeconds(10)), "workers did not start");
            await Task.Delay(300); // Both scopes already exist BEFORE the first EventPipe attachment.
            for (var i = 0; i < 2; i++)
            {
                var rawPath = Path.Combine(directory, "identity-" + i + ".nettrace");
                using var session = new DiagnosticsClient(Environment.ProcessId).StartEventPipeSession(new[] {
                    new EventPipeProvider("Microi-Execution", EventLevel.Informational),
                    new EventPipeProvider("Microsoft-Windows-DotNETRuntime", EventLevel.Verbose, 0x1)
                }, requestRundown: true, circularBufferMB: 8);
                using var raw = new FileStream(rawPath, FileMode.CreateNew, FileAccess.Write, FileShare.Read);
                using var tee = new BoundedTeeStream(session.EventStream, raw, 16L * 1024 * 1024);
                using var source = new EventPipeEventSource(tee);
                var markers = new ExecutionMarkerTable();
                var samples = new long[2]; long wrongPublisher = 0, crossTenant = 0;
                source.Dynamic.All += data =>
                {
                    markers.Accept(data);
                    if (data.ProviderName == "Microi-Execution" && (int)data.ID == 2 && Convert.ToBoolean(data.PayloadByName("refresh"))
                        && Convert.ToInt32(data.PayloadByName("nativeThreadId")) == data.ThreadID) wrongPublisher++;
                };
                source.Clr.GCAllocationTick += data =>
                {
                    var identity = markers.Find(data.ThreadID);
                    var index = Array.IndexOf(executionIds, identity?.ExecutionId);
                    if (index < 0) return;
                    samples[index]++;
                    if (identity?.OsClient != "identity-" + index || identity.Key != "busy-script-" + index) crossTenant++;
                };
                var processing = Task.Run(() => source.Process());
                await Task.Delay(2400);
                await Task.Run(() => session.Stop()).WaitAsync(TimeSpan.FromSeconds(8));
                await processing.WaitAsync(TimeSpan.FromSeconds(8));
                raw.Flush(true); raw.Dispose();
                Assert(!tee.Truncated, "raw trace exceeded budget");
                Assert(markers.ObservedProtocolVersion == 2 && markers.BackgroundRefreshCount > 0, "no background refresh after late attachment/rotation");
                Assert(samples.All(n => n > 10), "busy script lost allocation attribution");
                Assert(wrongPublisher == 0 && crossTenant == 0, "refresh attributed to timer thread or another tenant");
                var stackPath = Path.Combine(directory, "stacks-" + i + ".json");
                TraceAnalysis.Write(rawPath, stackPath);
                using var stacks = JsonDocument.Parse(File.ReadAllText(stackPath));
                Assert(stacks.RootElement.GetProperty("ObservedIdentityProtocolVersion").GetInt32() == 2, "offline parser missed new identity protocol");
                foreach (var id in executionIds)
                    Assert(stacks.RootElement.GetProperty("Top").EnumerateArray().Any(row => row.GetProperty("Execution").ValueKind == JsonValueKind.Object
                        && row.GetProperty("Execution").GetProperty("ExecutionId").GetString() == id && row.GetProperty("Stack").GetArrayLength() > 0), "offline stack lost busy script identity");
                segments.Add(new { Segment = i, SamplesByTenant = samples, markers.BackgroundRefreshCount, WrongPublisher = wrongPublisher,
                    CrossTenant = crossTenant, LostEvents = source.EventsLost, RawBytes = new FileInfo(rawPath).Length, OfflineStacks = true });
            }
        }
        finally
        {
            stop.Cancel();
            foreach (var worker in workers) Assert(worker.Join(TimeSpan.FromSeconds(8)), "worker did not stop");
        }
        Assert(failures.IsEmpty, string.Join(";", failures.Select(e => e.ToString())));
        foreach (var id in executionIds)
            Assert(ExecutionObservation.Snapshot().Recent.Any(row => row.ExecutionId == id && row.Outcome == "Completed" && row.ExclusiveAllocatedBytes > 0), "end boundary allocation accounting failed");
        Assert(!ExecutionObservation.Snapshot().Active.Any(row => executionIds.Contains(row.ExecutionId)), "completed scope remained active");
        Console.WriteLine(JsonSerializer.Serialize(new { Passed = true, LateAttach = true, SessionRotation = true, TwoTenants = true,
            StaleMarkersAndThreadReuse = true, LegacyMarkers = true, BoundedRegistry = true, ThreadPoolStarvation = true, V8BudgetsEnabled = false, Segments = segments }));
    }

    private sealed class RefreshListener : EventListener
    {
        public readonly ManualResetEventSlim Refreshed = new();
        protected override void OnEventSourceCreated(EventSource source)
        {
            if (source.Name == "Microi-Execution") EnableEvents(source, EventLevel.Informational);
        }
        protected override void OnEventWritten(EventWrittenEventArgs data)
        {
            if (data.EventId != 2 || data.PayloadNames == null || data.Payload == null) return;
            var key = data.PayloadNames.IndexOf("key");
            var refresh = data.PayloadNames.IndexOf("refresh");
            if (key >= 0 && refresh >= 0 && data.Payload[key]?.ToString() == "pool-starved-test" && Convert.ToBoolean(data.Payload[refresh]))
                Refreshed.Set();
        }
    }
}

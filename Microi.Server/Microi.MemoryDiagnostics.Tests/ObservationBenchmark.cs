using System.Diagnostics;
using Jint;
using Microi.net;

/// <summary>相同 Jint 脚本的交替暖机微基准；不代表生产 P95 或 HTTP 总开销。</summary>
internal static class ObservationBenchmark
{
    public static void Run()
    {
        const string script = "var sum=0;for(var i=0;i<200000;i++){sum+=i;}sum;";
        using var baseline = new Engine();
        using var legacy = new Engine(options => options.Constraint(new LegacyObservationPulse()));
        using var platformBaseline = new V8Engine().CreateEngine(new CreateV8EngineParam { UnlimitedRuntime = true });
        // Use the SAME platform engine for the optimized pair to exclude differences in
        // per-instance global-object/dictionary layout from a sub-millisecond comparison.
        var observed = platformBaseline;
        double Execute(Engine engine, bool observation)
        {
            var timer = Stopwatch.StartNew();
            // Include identity entry/exit and allocation accounting in both diagnostic groups.
            using (observation ? ExecutionObservation.Enter("V8", "benchmark", "isolated-benchmark", script: script) : null)
                if (engine.Evaluate(script).AsNumber() != 19999900000D) throw new InvalidOperationException("Incorrect script result.");
            return timer.Elapsed.TotalMilliseconds;
        }
        for (var i = 0; i < 10; i++) { Execute(baseline, false); Execute(legacy, true); Execute(platformBaseline, false); Execute(observed, true); }
        var measurements = new[] { new List<double>(), new List<double>(), new List<double>(), new List<double>() };
        var engines = new[] { baseline, legacy, platformBaseline, observed };
        var orders = new[] { new[] { 0, 1, 3, 2 }, new[] { 1, 2, 0, 3 }, new[] { 2, 3, 1, 0 }, new[] { 3, 0, 2, 1 } };
        for (var i = 0; i < 60; i++)
        {
            // Balanced positions AND predecessor groups, not just a rotated first position.
            foreach (var n in orders[i % orders.Length]) measurements[n].Add(Execute(engines[n], n % 2 != 0));
        }
        double Median(List<double> values) { var v = values.Order().ToArray(); return (v[(v.Length - 1) / 2] + v[v.Length / 2]) / 2; }
        object Stats(List<double> values) => new { P50Ms = Median(values), P95Ms = values.Order().ElementAt((int)Math.Ceiling(values.Count * .95) - 1), MinMs = values.Min(), MaxMs = values.Max() };
        Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new {
            JintBaseline = Stats(measurements[0]), LegacyPerStatement = Stats(measurements[1]),
            PlatformBaseline = Stats(measurements[2]), BackgroundIdentity = Stats(measurements[3]),
            LegacyOverheadPercent = 100 * (Median(measurements[1]) / Median(measurements[0]) - 1),
            OptimizedOverheadPercent = 100 * (Median(measurements[3]) / Median(measurements[2]) - 1),
            Rounds = 60, Warmups = 10, CorrectResults = true, V8BudgetsEnabled = false,
            Boundary = "Two matched pairs: raw Jint vs historical constraint; SAME platform engine without/with diagnostic scope, balanced execution order. Includes scope boundaries, excludes EventPipe and production HTTP workload. Do not compare absolute times across configurations.",
            Samples = measurements
        }));
    }

    // Historical implementation kept ONLY in the benchmark, never attached to production Jint.
    private sealed class LegacyObservationPulse : Constraint
    {
        private int _statements;
        private long _next;
        public override void Check()
        {
            if ((++_statements & 2047) != 0) return;
            var now = Stopwatch.GetTimestamp();
            if (now < _next) return;
            _next = now + Stopwatch.Frequency / 5;
            ExecutionObservation.Pulse();
        }
        public override void Reset() { _statements = 0; _next = Stopwatch.GetTimestamp() + Stopwatch.Frequency / 5; }
    }
}

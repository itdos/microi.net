using System;

namespace Microi.net
{
    /// <summary>
    /// Pure progress/ETA calculation shared by the durable task runtime and tests.
    /// ETA is based only on committed units reported by the task. It deliberately
    /// stays empty for indeterminate work instead of inventing a percentage.
    /// </summary>
    public static class BackgroundTaskProgress
    {
        public sealed class Estimate
        {
            public int Progress { get; set; }
            public string ProgressMode { get; set; }
            public double? ThroughputPerSecond { get; set; }
            public int SampleCount { get; set; }
            public int? RemainingSeconds { get; set; }
            public DateTime? EstimatedEndTime { get; set; }
            public string EstimateConfidence { get; set; }
        }

        public static Estimate Calculate(
            DateTime now,
            DateTime startedAt,
            int current,
            int total,
            int? explicitProgress,
            DateTime? previousSampleTime,
            int previousSampleCurrent,
            double? previousThroughput,
            int previousSampleCount,
            int minimumProgress = 0)
        {
            var progressFloor = Clamp(minimumProgress, 0, 99);
            var result = new Estimate
            {
                Progress = explicitProgress.HasValue
                    ? Clamp(explicitProgress.Value, 0, 99)
                    : 0,
                ProgressMode = explicitProgress.HasValue ? "Percent" : "Indeterminate",
                ThroughputPerSecond = previousThroughput,
                SampleCount = Math.Max(0, previousSampleCount),
                EstimateConfidence = "None"
            };

            if (total <= 0 || current < 0)
            {
                result.Progress = Math.Max(result.Progress, progressFloor);
                return result;
            }

            result.ProgressMode = "Units";
            var unitProgress = Clamp((int)Math.Floor(current * 100m / total), 0, 99);
            // Explicit progress may represent a hierarchical child phase while
            // Current/Total remain the committed top-level units used for ETA.
            // Never let either representation move the visible percentage back.
            result.Progress = Math.Max(result.Progress, unitProgress);
            result.Progress = Math.Max(result.Progress, progressFloor);
            if (current <= 0 || current >= total)
            {
                return result;
            }

            double? instantaneous = null;
            if (previousSampleTime.HasValue
                && current > previousSampleCurrent
                && now > previousSampleTime.Value)
            {
                var sampleSeconds = (now - previousSampleTime.Value).TotalSeconds;
                if (sampleSeconds >= 0.5)
                {
                    instantaneous = (current - previousSampleCurrent) / sampleSeconds;
                }
            }

            if (instantaneous.HasValue && instantaneous.Value > 0)
            {
                result.ThroughputPerSecond = previousThroughput.HasValue && previousThroughput.Value > 0
                    ? previousThroughput.Value * 0.7d + instantaneous.Value * 0.3d
                    : instantaneous.Value;
                result.SampleCount++;
            }
            else if ((!result.ThroughputPerSecond.HasValue || result.ThroughputPerSecond.Value <= 0)
                     && now > startedAt)
            {
                var elapsed = (now - startedAt).TotalSeconds;
                if (elapsed >= 5)
                {
                    result.ThroughputPerSecond = current / elapsed;
                    result.SampleCount = Math.Max(1, result.SampleCount);
                }
            }

            if (!result.ThroughputPerSecond.HasValue || result.ThroughputPerSecond.Value <= 0)
            {
                return result;
            }

            var remaining = (int)Math.Ceiling((total - current) / result.ThroughputPerSecond.Value);
            // Protect the UI and storage from corrupt counters or unrealistic overflow.
            remaining = Clamp(remaining, 1, 60 * 60 * 24 * 365);
            result.RemainingSeconds = remaining;
            result.EstimatedEndTime = now.AddSeconds(remaining);
            var elapsedSeconds = Math.Max(0, (now - startedAt).TotalSeconds);
            result.EstimateConfidence = result.SampleCount >= 8 && elapsedSeconds >= 120
                ? "High"
                : result.SampleCount >= 3 && elapsedSeconds >= 30
                    ? "Medium"
                    : "Low";
            return result;
        }

        public static int PreserveMonotonicCurrent(
            int previousCurrent,
            int previousTotal,
            int requestedCurrent,
            int requestedTotal)
        {
            var normalized = Math.Max(0, requestedCurrent);
            return previousTotal > 0 && requestedTotal == previousTotal
                ? Math.Max(Math.Max(0, previousCurrent), normalized)
                : normalized;
        }

        private static int Clamp(int value, int min, int max)
        {
            return value < min ? min : value > max ? max : value;
        }
    }
}

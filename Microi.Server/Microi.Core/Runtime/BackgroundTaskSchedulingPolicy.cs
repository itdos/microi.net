using System;
using System.Collections.Generic;
using System.Linq;

namespace Microi.net
{
    internal class BackgroundTaskLaneState
    {
        internal string OsClient { get; set; }

        internal string ApiEngineKey { get; set; }

        internal string LaneKey => BackgroundTaskWakeQueue.BuildLaneKey(OsClient, ApiEngineKey);
    }

    /// <summary>
    /// Pure admission policy for logical background-task queues. A lane is derived
    /// only from trusted persisted fields, never from a caller-provided queue name.
    /// </summary>
    internal static class BackgroundTaskSchedulingPolicy
    {
        internal const int MinimumWorkerParallelism = 4;
        internal const int ReservedBusinessParallelism = 2;
        internal const int MaxConsecutiveLaneHintClaims = 16;
        internal static readonly TimeSpan ForcedRecoveryScanInterval = TimeSpan.FromSeconds(1);
        private static readonly HashSet<string> PlatformMaintenanceApiEngineKeys =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "import-microi-store-package",
                "bulk-import-microi-store-packages",
                DatabaseBackupService.WorkerApiEngineKey,
                DiyLangBackgroundTaskService.WorkerApiEngineKey,
                EmptyDatabaseReleaseService.WorkerApiEngineKey,
                ChildTenantPlatformAppControlService.ChildWorkerApiEngineKey
            };

        internal static bool IsPlatformMaintenance(string apiEngineKey)
        {
            return PlatformMaintenanceApiEngineKeys.Contains((apiEngineKey ?? "").Trim());
        }

        internal static string RequiredApiEngineKeyForWakeHint(string apiEngineKey)
        {
            // Maintenance kinds share one tenant slot. A hot install lane must
            // not filter out an older backup/empty-database task when that slot
            // becomes free; the durable ready-time order chooses the next kind.
            return IsPlatformMaintenance(apiEngineKey) ? null : apiEngineKey;
        }

        internal static bool CanAdmit(
            string osClient,
            string apiEngineKey,
            IEnumerable<BackgroundTaskLaneState> running,
            int workerParallelism)
        {
            var active = (running ?? Array.Empty<BackgroundTaskLaneState>()).ToArray();
            if (IsLaneActive(osClient, apiEngineKey, active))
            {
                return false;
            }
            // 等待中转结果的任务不能占满 Worker，至少给真实供应商执行留一个名额。
            if (IsMediaRelayWorker(apiEngineKey)
                && IsImageRelayAtCapacity(active, workerParallelism)) return false;
            if (!IsPlatformMaintenance(apiEngineKey)) return true;

            // Installation/schema work is serialized only inside its own tenant.
            // Different tenants may progress concurrently, while a fixed business
            // reserve prevents maintenance traffic from occupying every worker.
            return !HasTenantMaintenanceActive(osClient, active)
                   && !IsMaintenanceAtCapacity(active, workerParallelism);
        }

        internal static bool IsLaneActive(
            string osClient,
            string apiEngineKey,
            IEnumerable<BackgroundTaskLaneState> running)
        {
            var laneKey = BackgroundTaskWakeQueue.BuildLaneKey(osClient, apiEngineKey);
            return (running ?? Array.Empty<BackgroundTaskLaneState>()).Any(lane =>
                string.Equals(lane.LaneKey, laneKey, StringComparison.OrdinalIgnoreCase));
        }

        internal static bool HasTenantMaintenanceActive(
            string osClient,
            IEnumerable<BackgroundTaskLaneState> running)
        {
            return (running ?? Array.Empty<BackgroundTaskLaneState>()).Any(lane =>
                string.Equals(lane.OsClient, osClient, StringComparison.OrdinalIgnoreCase)
                && IsPlatformMaintenance(lane.ApiEngineKey));
        }

        internal static int MaxPlatformMaintenanceParallelism(int workerParallelism)
        {
            return Math.Max(
                1,
                Math.Max(MinimumWorkerParallelism, workerParallelism)
                - ReservedBusinessParallelism);
        }

        internal static bool IsMaintenanceAtCapacity(
            IEnumerable<BackgroundTaskLaneState> running,
            int workerParallelism)
        {
            return (running ?? Array.Empty<BackgroundTaskLaneState>())
                   .Count(lane => IsPlatformMaintenance(lane.ApiEngineKey))
                   >= MaxPlatformMaintenanceParallelism(workerParallelism);
        }

        internal static IReadOnlyCollection<string> ExcludedApiEngineKeys(
            string osClient,
            IEnumerable<BackgroundTaskLaneState> running,
            int workerParallelism)
        {
            var active = (running ?? Array.Empty<BackgroundTaskLaneState>()).ToArray();
            var excluded = new HashSet<string>(
                active
                    .Where(lane => string.Equals(
                        lane.OsClient,
                        osClient,
                        StringComparison.OrdinalIgnoreCase))
                    .Select(lane => lane.ApiEngineKey)
                    .Where(key => !string.IsNullOrWhiteSpace(key)),
                StringComparer.OrdinalIgnoreCase);
            if (HasTenantMaintenanceActive(osClient, active)
                || IsMaintenanceAtCapacity(active, workerParallelism))
            {
                excluded.UnionWith(PlatformMaintenanceApiEngineKeys);
            }
            if (IsImageRelayAtCapacity(active, workerParallelism)) { excluded.Add(AiImageBackgroundTaskService.WorkerApiEngineKey); excluded.Add(AiMusicBackgroundTaskService.WorkerApiEngineKey); }
            return excluded.ToArray();
        }

        private static bool IsMediaRelayWorker(string key)
            => string.Equals(key, AiImageBackgroundTaskService.WorkerApiEngineKey, StringComparison.OrdinalIgnoreCase)
                || string.Equals(key, AiMusicBackgroundTaskService.WorkerApiEngineKey, StringComparison.OrdinalIgnoreCase);

        private static bool IsImageRelayAtCapacity(IEnumerable<BackgroundTaskLaneState> active, int workerParallelism)
            => active.Count(x => IsMediaRelayWorker(x.ApiEngineKey))
                >= Math.Max(MinimumWorkerParallelism, workerParallelism) - 1;

        internal static string LaneConcurrencyKey(string apiEngineKey)
        {
            var taskType = (apiEngineKey ?? "").Trim();
            if (taskType.Length == 0) taskType = "BackgroundTask";
            return "__microi_background_lane_v1__:" + taskType.ToUpperInvariant();
        }

        internal static bool ShouldForceRecoveryScan(
            int hintsSinceCompletedRecovery,
            DateTime utcNow,
            DateTime nextForcedRecoveryScanUtc)
        {
            return hintsSinceCompletedRecovery > 0
                   && (hintsSinceCompletedRecovery >= MaxConsecutiveLaneHintClaims
                       || utcNow >= nextForcedRecoveryScanUtc);
        }
    }
}

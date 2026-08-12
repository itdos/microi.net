using System;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Durable control plane for diy_lang initialization. FormEngine remains the
    /// business implementation; this service only supplies tenant-scoped queueing,
    /// leases, fencing, retries and restart recovery through mci_background_task.
    /// </summary>
    public static class DiyLangBackgroundTaskService
    {
        public const string WorkerApiEngineKey = "__microi_native_diy_lang_sync__";
        public const string ClusterConcurrencyKey = "__microi_native_diy_lang_sync_cluster__";
        private static readonly Regex SourceRegex = new Regex(
            @"[^A-Za-z0-9._:-]", RegexOptions.Compiled | RegexOptions.CultureInvariant);

        public static DosResult QueueManualSync(
            JObject currentUser,
            string osClient,
            bool includeClientText,
            string source,
            bool force,
            bool onlyFillMissing)
        {
            var permission = ValidateManualPermission(currentUser, osClient);
            if (permission.Code != 1) return permission;

            try
            {
                var active = BackgroundTaskStore.FindActiveByApiEngineKey(osClient, WorkerApiEngineKey);
                var activeParam = ParseObject(active?.ParamJson);
                if (active != null && CanReuseActiveTask(
                        activeParam,
                        includeClientText,
                        force,
                        onlyFillMissing))
                {
                    return BuildQueuedResult(
                        active,
                        true,
                        "上一项多语言初始化仍未完成，本次操作已复用现有持久任务。",
                        ReadBool(activeParam["OnlyFillMissing"], false));
                }

                var nowBucket = DateTime.UtcNow.ToString("yyyyMMddHHmm", CultureInfo.InvariantCulture);
                var userId = currentUser?["Id"]?.ToString() ?? "";
                var semanticKey = $"{(onlyFillMissing ? "repair" : "full")}:{(force ? 1 : 0)}:{(includeClientText ? 1 : 0)}";
                var task = Queue(
                    currentUser,
                    osClient,
                    includeClientText,
                    SanitizeSource(source, "api"),
                    force,
                    onlyFillMissing,
                    $"diy-lang-sync:{osClient}:manual:{userId}:{semanticKey}:{nowBucket}");
                return BuildQueuedResult(
                    task,
                    false,
                    "多语言初始化已进入持久后台任务队列。",
                    onlyFillMissing);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "多语言初始化入队失败：" + Limit(ex.Message, 500));
            }
        }

        /// <summary>
        /// Wait=true remains compatible without bypassing the durable worker. The
        /// HTTP request waits for a bounded period; long work returns the same TaskId
        /// and continues under the persisted lease after the request ends.
        /// </summary>
        public static async Task<object> WaitForCompletionAsync(
            string osClient,
            string taskId,
            TimeSpan timeout,
            CancellationToken cancellationToken)
        {
            if (osClient.DosIsNullOrWhiteSpace() || taskId.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "等待多语言任务失败：TaskId 或 OsClient 为空。");
            }
            var deadline = DateTime.UtcNow.Add(timeout <= TimeSpan.Zero ? TimeSpan.FromSeconds(30) : timeout);
            while (DateTime.UtcNow < deadline)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var item = BackgroundTaskStore.Get(osClient, taskId);
                if (item == null)
                {
                    return new DosResult(0, null, "等待多语言任务失败：持久任务不存在。");
                }
                if (IsTerminal(item.Status))
                {
                    var result = item.Result == null
                        ? new JObject()
                        : (JObject)item.Result.DeepClone();
                    if (result["Code"] == null)
                    {
                        result["Code"] = string.Equals(item.Status, "Succeeded", StringComparison.OrdinalIgnoreCase) ? 1 : 0;
                    }
                    if (result["Msg"] == null) result["Msg"] = item.Msg ?? item.StatusText ?? "";
                    result["BackgroundTask"] = new JObject
                    {
                        ["TaskId"] = item.Id,
                        ["Status"] = item.Status,
                        ["StatusText"] = item.StatusText ?? ""
                    };
                    return result;
                }
                await Task.Delay(TimeSpan.FromMilliseconds(250), cancellationToken).ConfigureAwait(false);
            }

            var pending = BackgroundTaskStore.Get(osClient, taskId);
            return new DosResult(1, new
            {
                TaskId = taskId,
                Status = pending?.Status ?? "Pending",
                StatusText = pending?.StatusText ?? "排队中",
                WaitTimedOut = true
            }, "多语言任务仍在后台执行，已返回 TaskId，可继续查询进度。");
        }

        /// <summary>
        /// Startup is only a producer. The tenant database remains the completion
        /// fact, and a stable time-bucket idempotency key collapses concurrent nodes.
        /// </summary>
        public static DosResult QueueStartupRepair(string osClient)
        {
            osClient = (osClient ?? "").Trim();
            if (osClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "OsClient is required.");
            }

            try
            {
                if (!BackgroundTaskStore.TryGetAvailability(osClient, out var unavailableReason))
                {
                    return new DosResult(0, null, unavailableReason);
                }
                var active = BackgroundTaskStore.FindActiveByApiEngineKey(osClient, WorkerApiEngineKey);
                if (active != null)
                {
                    var activeParam = ParseObject(active.ParamJson);
                    return BuildQueuedResult(
                        active,
                        true,
                        "已有多语言初始化任务正在执行，启动修复已复用该任务。",
                        ReadBool(activeParam["OnlyFillMissing"], false));
                }

                var startupAdministrator = FindPlatformAdministrator(osClient);
                if (startupAdministrator == null)
                {
                    return new DosResult(0, null, "启动期多语言修复未找到仍具权威权限的平台管理员。");
                }
                // One repair per UTC day is enough for startup self-healing. The
                // previous hourly key caused every rolling restart to rescan every
                // tenant, even when the previous run had already succeeded.
                var dayBucket = DateTime.UtcNow.ToString("yyyyMMdd", CultureInfo.InvariantCulture);
                var startupIdempotencyKey = $"diy-lang-sync:{osClient}:startup:{dayBucket}";
                var completedToday = BackgroundTaskStore.FindByIdempotency(
                    osClient,
                    startupIdempotencyKey);
                if (completedToday != null)
                {
                    return BuildQueuedResult(
                        completedToday,
                        true,
                        "本租户今日已投递过低扰动多语言启动修复，本次启动不重复扫描。",
                        true);
                }
                var task = Queue(
                    startupAdministrator,
                    osClient,
                    true,
                    "startup",
                    false,
                    true,
                    startupIdempotencyKey);
                return BuildQueuedResult(
                    task,
                    false,
                    "启动期多语言缺失译文修复已进入持久后台任务队列。",
                    true);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "启动期多语言修复入队失败：" + Limit(ex.Message, 500));
            }
        }

        internal static async Task<DosResult> RunAsync(
            string taskId,
            long fencingToken,
            JObject param,
            JObject trustedUser,
            CancellationToken cancellationToken)
        {
            param = param ?? new JObject();
            var osClient = param["OsClient"]?.ToString()?.Trim() ?? "";
            if (osClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "OsClient is required.");
            }
            ThrowIfExecutionOwnershipLost(taskId, fencingToken, cancellationToken);
            if (!PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(osClient, trustedUser))
            {
                return new DosResult(
                    0,
                    null,
                    "多语言任务执行前权限复核失败：提交管理员已失效、被降权或不属于目标租户。");
            }
            var lastProgressWriteUtc = DateTime.MinValue;
            using (FormEngineExtend.EnterDiyLangSyncOwnershipGuard(
                       () => !cancellationToken.IsCancellationRequested
                             && BackgroundTaskService.IsCurrentExecutionOwner(taskId, fencingToken)))
            using (FormEngineExtend.EnterDiyLangSyncProgressReporter(
                       (progress, message, current, total) =>
                       {
                           var now = DateTime.UtcNow;
                           var terminalSample = progress.HasValue && progress.Value >= 99
                                                || current.HasValue && total.HasValue
                                                && total.Value > 0 && current.Value >= total.Value;
                           if (!terminalSample
                               && lastProgressWriteUtc != DateTime.MinValue
                               && now - lastProgressWriteUtc < TimeSpan.FromSeconds(1))
                           {
                               return;
                           }
                           if (BackgroundTaskRuntime.TryUpdateProgress(
                                   taskId,
                                   progress,
                                   message,
                                   current,
                                   total))
                           {
                               lastProgressWriteUtc = now;
                           }
                       }))
            {

            var includeClientText = ReadBool(param["IncludeClientText"], true);
            var force = ReadBool(param["Force"], false);
            var onlyFillMissing = ReadBool(param["OnlyFillMissing"], false);
            var source = SanitizeSource(param["Source"]?.ToString(), "background-task");

            ThrowIfExecutionOwnershipLost(taskId, fencingToken, cancellationToken);
            BackgroundTaskRuntime.TryUpdateProgress(taskId, null, "正在重新加载多语言运行配置");
            BackgroundTaskRuntime.TryAppendLog(
                taskId,
                $"开始执行租户[{osClient}]多语言任务；模式={(onlyFillMissing ? "OnlyFillMissing" : "FullSync")}；FencingToken={fencingToken}。");

            if (force)
            {
                MicroiEngine.FormEngine.ResetDiyLangFullSync(osClient, source);
            }
            var reloadResult = MicroiEngine.FormEngine.ReloadDiyLangRuntimeConfig(osClient);
            if (reloadResult.Code != 1)
            {
                return reloadResult;
            }

            ThrowIfExecutionOwnershipLost(taskId, fencingToken, cancellationToken);
            BackgroundTaskRuntime.TryUpdateProgress(
                taskId,
                null,
                onlyFillMissing ? "正在补齐缺失的多语言译文" : "正在同步多语言元数据");
            var result = onlyFillMissing
                ? await MicroiEngine.FormEngine
                    .RepairMissingDiyLangTranslationsAsync(osClient, source)
                    .ConfigureAwait(false)
                : await MicroiEngine.FormEngine
                    .SyncDiyLangFullAsync(osClient, includeClientText, source)
                    .ConfigureAwait(false);

            ThrowIfExecutionOwnershipLost(taskId, fencingToken, cancellationToken);
            BackgroundTaskRuntime.TryUpdateProgress(
                taskId,
                result.Code == 1 ? 99 : (int?)null,
                result.Code == 1 ? "多语言初始化已完成" : "多语言初始化执行失败");
            BackgroundTaskRuntime.TryAppendLog(
                taskId,
                result.Code == 1 ? "多语言初始化已完成。" : "多语言初始化未成功完成。");
            return result;
            }
        }

        internal static string SanitizeSource(string source, string fallback)
        {
            source = (source ?? "").Trim();
            if (source.DosIsNullOrWhiteSpace()) source = fallback ?? "api";
            source = SourceRegex.Replace(source, "-");
            return Limit(source, 80);
        }

        internal static bool CanReuseActiveTask(
            JObject activeParam,
            bool requestedIncludeClientText,
            bool requestedForce,
            bool requestedOnlyFillMissing)
        {
            activeParam = activeParam ?? new JObject();
            var activeForce = ReadBool(activeParam["Force"], false);
            if (requestedForce && !activeForce) return false;

            var activeOnlyFillMissing = ReadBool(activeParam["OnlyFillMissing"], false);
            if (!requestedOnlyFillMissing && activeOnlyFillMissing) return false;

            var activeIncludeClientText = ReadBool(activeParam["IncludeClientText"], true);
            if (!requestedOnlyFillMissing
                && requestedIncludeClientText
                && !activeIncludeClientText) return false;
            return true;
        }

        private static BackgroundTaskItem Queue(
            JObject currentUser,
            string osClient,
            bool includeClientText,
            string source,
            bool force,
            bool onlyFillMissing,
            string idempotencyKey)
        {
            var param = new JObject
            {
                ["ApiEngineKey"] = WorkerApiEngineKey,
                ["OsClient"] = osClient,
                ["IncludeClientText"] = includeClientText,
                ["Source"] = source,
                ["Force"] = force,
                ["OnlyFillMissing"] = onlyFillMissing
            };
            return BackgroundTaskService.StartApiEngine(
                osClient,
                currentUser?["Id"]?.ToString() ?? "",
                onlyFillMissing ? "补齐缺失多语言译文" : "初始化多语言",
                param,
                currentUser,
                new JObject
                {
                    ["IdempotencyKey"] = Limit(idempotencyKey, 200),
                    ["ConcurrencyKey"] = $"diy-lang-sync:{osClient}",
                    ["MaxAttempts"] = 3,
                    ["RetryOnFailure"] = true
                });
        }

        private static DosResult BuildQueuedResult(
            BackgroundTaskItem task,
            bool reused,
            string message,
            bool onlyFillMissing)
        {
            return new DosResult(1, new
            {
                TaskId = task?.Id,
                task?.Status,
                task?.StatusText,
                Reused = reused,
                Mode = onlyFillMissing ? "OnlyFillMissing" : "FullSync"
            }, message);
        }

        private static DosResult ValidateManualPermission(JObject currentUser, string osClient)
        {
            if (osClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "OsClient is required.");
            }
            var hasAdminClaim = currentUser?["_IsAdmin"].Val<bool>() == true;
            var level = currentUser?["Level"].Val<int>() ?? 0;
            var userId = currentUser?["Id"]?.ToString() ?? "";
            if (userId.DosIsNullOrWhiteSpace()
                || (!hasAdminClaim && level < DiyCommon.MaxRoleLevel))
            {
                return new DosResult(0, null, "仅平台管理员可以初始化多语言。");
            }
            if (!PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(osClient, currentUser))
            {
                return new DosResult(0, null, "平台管理员主库复核失败，不能初始化目标租户的多语言。");
            }
            return new DosResult(1);
        }

        private static JObject FindPlatformAdministrator(string osClient)
        {
            try
            {
                var db = OsClientExtend.GetClient(osClient)?.Db;
                if (db == null) return null;
                var candidates = db.From<SysUser>()
                    .Select(new SysUser().GetFields())
                    .Where(user => user.Level >= DiyCommon.MaxRoleLevel
                                   && user.State == 1
                                   && user.IsDeleted != 1)
                    .ToList()
                    .OrderByDescending(user => user.Level)
                    .ThenBy(user => user.CreateTime)
                    .ToList();
                foreach (var user in candidates)
                {
                    var currentUser = JObject.FromObject(user);
                    if (PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(osClient, currentUser))
                    {
                        return currentUser;
                    }
                }
            }
            catch
            {
                // Fail closed. Startup is best effort and will retry on a later node.
            }
            return null;
        }

        private static bool ReadBool(JToken token, bool defaultValue)
        {
            if (token == null || token.Type == JTokenType.Null) return defaultValue;
            var value = token.ToString();
            if (string.Equals(value, "1", StringComparison.OrdinalIgnoreCase)
                || string.Equals(value, "true", StringComparison.OrdinalIgnoreCase)) return true;
            if (string.Equals(value, "0", StringComparison.OrdinalIgnoreCase)
                || string.Equals(value, "false", StringComparison.OrdinalIgnoreCase)) return false;
            return defaultValue;
        }

        private static JObject ParseObject(string json)
        {
            if (json.DosIsNullOrWhiteSpace()) return new JObject();
            try { return JObject.Parse(json); }
            catch { return new JObject(); }
        }

        private static bool IsTerminal(string status)
        {
            return string.Equals(status, "Succeeded", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(status, "Failed", StringComparison.OrdinalIgnoreCase)
                   || string.Equals(status, "Canceled", StringComparison.OrdinalIgnoreCase);
        }

        private static void ThrowIfExecutionOwnershipLost(
            string taskId,
            long fencingToken,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (!BackgroundTaskService.IsCurrentExecutionOwner(taskId, fencingToken))
            {
                throw new OperationCanceledException(
                    "多语言持久任务已失去租约或 fencing 所有权，已停止后续写入。",
                    cancellationToken);
            }
        }

        private static string Limit(string value, int max)
        {
            value = value?.Trim() ?? "";
            return value.Length <= max ? value : value.Substring(0, max);
        }
    }
}

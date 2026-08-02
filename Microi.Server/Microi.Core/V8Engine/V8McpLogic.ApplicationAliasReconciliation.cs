using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// Durable convergence for mutable application root/latest aliases.
    ///
    /// Object-store adapters do not expose a cross-provider destination If-Match
    /// primitive. A copy issued by a former lease owner can therefore land late.
    /// This worker never treats its local process as the source of truth: it uses
    /// the Published application/version rows plus the immutable alias manifest,
    /// takes the same per-AppId distributed lease as finalize, and repairs only
    /// the exact version still referenced by the authoritative application row.
    /// </summary>
    public static partial class V8McpLogic
    {
        private const int ApplicationAliasRecoveryPageSize = 200;
        private const int ApplicationAliasRecoveryMaxPagesPerTenant = 5;
        private const int ApplicationAliasRecoveryRequiredPasses = 3;

        private static JArray BuildApplicationAliasRecoveryManifest(
            IEnumerable<StreamPublishAsset> assets)
        {
            return new JArray((assets ?? Enumerable.Empty<StreamPublishAsset>())
                .OrderBy(asset => asset.RelativePath, StringComparer.Ordinal)
                .Select(asset => new JObject
                {
                    ["RelativePath"] = asset.RelativePath,
                    ["Sha256"] = asset.Sha256,
                    ["Size"] = asset.Size,
                    ["IsEntry"] = asset.IsEntry,
                    ["VersionPath"] = asset.Paths.VersionPath,
                    ["RootPath"] = asset.Paths.RootPath,
                    ["LatestPath"] = asset.Paths.LatestPath
                }));
        }

        private static void ApplyApplicationAliasRecoveryMetadata(
            JObject buildLog,
            JArray aliasManifest,
            string publishStatus)
        {
            if (buildLog == null) throw new ArgumentNullException(nameof(buildLog));
            var published = string.Equals(
                publishStatus,
                "Published",
                StringComparison.OrdinalIgnoreCase);
            buildLog["AliasManifest"] = aliasManifest?.DeepClone() ?? new JArray();
            buildLog["AliasRecoveryProtocol"] = 1;
            buildLog["RecoveryRequired"] = true;
            buildLog["PendingReplayRequired"] = !published;
            buildLog["AliasVerificationPass"] = 0;
            buildLog["NextAliasReconcileAtUtc"] = published
                ? DateTime.UtcNow.AddSeconds(5).ToString("O")
                : null;
            buildLog["AliasCheckpoint"] = new JObject
            {
                ["Status"] = published ? "Scheduled" : "PendingFinalizeReplay",
                ["Attempt"] = 0,
                ["CompletedTargets"] = new JArray(),
                ["UpdatedAtUtc"] = DateTime.UtcNow.ToString("O")
            };
        }

        /// <summary>
        /// Pure authority decision used by focused tests and the worker. Only the
        /// exact Published application pointer may repair mutable aliases.
        /// Verified/Pending versions deliberately require the original finalize
        /// replay because MicroService route/page terminal facts are not stored in
        /// the alias checkpoint.
        /// </summary>
        public static string GetApplicationAliasRecoveryDisposition(
            JObject app,
            JObject versionRow,
            JObject buildLog)
        {
            if (app == null || versionRow == null || buildLog == null) return "Invalid";
            if (!string.Equals(
                    SafeJString(versionRow, "Status"),
                    "Published",
                    StringComparison.OrdinalIgnoreCase))
            {
                return "PendingFinalizeReplay";
            }

            var manifest = buildLog["AliasManifest"] as JArray;
            var entry = manifest?.OfType<JObject>().SingleOrDefault(item =>
                item["IsEntry"]?.Val<bool?>() == true);
            if (entry == null) return "Invalid";
            var versionNo = SafeJString(versionRow, "VersionNo");
            var deliveryBatchId = SafeJString(buildLog, "DeliveryBatchId");
            var current = string.Equals(
                              SafeJString(app, "Id"),
                              SafeJString(versionRow, "AppId"),
                              StringComparison.Ordinal)
                          && string.Equals(
                              SafeJString(app, "Status"),
                              "Published",
                              StringComparison.OrdinalIgnoreCase)
                          && string.Equals(
                              SafeJString(app, "AppVersion"),
                              versionNo,
                              StringComparison.Ordinal)
                          && string.Equals(
                              SafeJString(app, "LastBuildTaskId"),
                              deliveryBatchId,
                              StringComparison.Ordinal)
                          && string.Equals(
                              SafeJString(app, "PublicPublishPath"),
                              SafeJString(entry, "RootPath"),
                              StringComparison.Ordinal);
            return current ? "Current" : "Superseded";
        }

        public static string ValidateApplicationAliasRecoveryManifest(
            JObject app,
            JObject versionRow,
            JObject buildLog)
        {
            return TryBuildApplicationAliasRecoveryAssets(
                app,
                versionRow,
                buildLog,
                out _);
        }

        private static string TryBuildApplicationAliasRecoveryAssets(
            JObject app,
            JObject versionRow,
            JObject buildLog,
            out List<StreamPublishAsset> assets)
        {
            assets = new List<StreamPublishAsset>();
            if (app == null || versionRow == null || buildLog == null)
                return "应用、版本或 BuildLog 为空";
            var aliasManifest = buildLog["AliasManifest"] as JArray;
            if (aliasManifest == null || aliasManifest.Count == 0)
                return "BuildLog.AliasManifest 为空";
            var versionNo = NormalizeApplicationAssetVersion(SafeJString(versionRow, "VersionNo"));
            var appKey = NormalizeMicroServiceKey(
                SafeJString(app, "AppKey", SafeJString(app, "AppId")));
            var applicationType = SafeJString(app, "ApplicationType", "Web");
            var uniquePaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            long totalSize = 0;
            foreach (var token in aliasManifest)
            {
                if (!(token is JObject item)) return "AliasManifest 包含非对象项";
                var relativePath = NormalizeApplicationAssetRelativePath(
                    SafeJString(item, "RelativePath"));
                if (!uniquePaths.Add(relativePath)) return "AliasManifest 路径重复：" + relativePath;
                var sha256 = SafeJString(item, "Sha256").Trim().ToLowerInvariant();
                if (!Regex.IsMatch(sha256, "^[a-f0-9]{64}$", RegexOptions.CultureInvariant))
                    return "AliasManifest SHA-256 不合法：" + relativePath;
                var size = item["Size"]?.Val<long?>() ?? -1L;
                if (size < 0 || size > MaxStreamPublishFileBytes)
                    return "AliasManifest Size 不合法：" + relativePath;
                if (totalSize > long.MaxValue - size) return "AliasManifest 总大小溢出";
                totalSize += size;
                if (totalSize > MaxStreamPublishTotalBytes) return "AliasManifest 总大小超限";
                var paths = BuildApplicationAssetPaths(
                    app["OsClient"]?.Val<string>() ?? versionRow["OsClient"]?.Val<string>(),
                    appKey,
                    applicationType,
                    versionNo,
                    relativePath,
                    sha256);
                if (!string.Equals(SafeJString(item, "VersionPath"), paths.VersionPath, StringComparison.Ordinal)
                    || !string.Equals(SafeJString(item, "RootPath"), paths.RootPath, StringComparison.Ordinal)
                    || !string.Equals(SafeJString(item, "LatestPath"), paths.LatestPath, StringComparison.Ordinal))
                {
                    return "AliasManifest 路径越界或与发布规则不一致：" + relativePath;
                }

                assets.Add(new StreamPublishAsset
                {
                    RelativePath = relativePath,
                    Sha256 = sha256,
                    Size = size,
                    IsEntry = item["IsEntry"]?.Val<bool?>() == true,
                    Paths = paths
                });
            }

            if (assets.Count(asset => asset.IsEntry) != 1) return "AliasManifest 必须且只能包含一个入口";
            if (SafeJInt(versionRow, "FileCount", -1) != assets.Count
                || SafeJInt(buildLog, "AssetCount", -1) != assets.Count)
            {
                return "AliasManifest 文件数与版本元数据不一致";
            }
            if ((versionRow["TotalSize"]?.Val<long?>() ?? -1L) != totalSize
                || (buildLog["TotalSize"]?.Val<long?>() ?? -1L) != totalSize)
            {
                return "AliasManifest 总大小与版本元数据不一致";
            }

            var runtimeManifest = new JArray(assets.Select(asset => new JObject
            {
                ["Path"] = asset.RelativePath,
                ["Sha256"] = asset.Sha256,
                ["Size"] = asset.Size,
                ["IsEntry"] = asset.IsEntry
            }));
            var runtimeManifestHash = ComputeMicroServiceManifestHash(runtimeManifest);
            if (!string.Equals(
                    runtimeManifestHash,
                    SafeJString(buildLog, "RuntimeManifestHash"),
                    StringComparison.OrdinalIgnoreCase))
            {
                return "AliasManifest 运行清单哈希不一致";
            }
            var entry = assets.Single(asset => asset.IsEntry);
            if (!string.Equals(
                    SafeJString(versionRow, "PublishPath"),
                    entry.Paths.VersionPath,
                    StringComparison.Ordinal))
            {
                return "版本 PublishPath 与入口不可变路径不一致";
            }
            return null;
        }

        public static async Task<DosResult<object>> ReconcilePublishedApplicationAliasesOnceAsync(
            CancellationToken cancellationToken = default)
        {
            var tenants = OsClientExtend.ClientList.Keys
                .Where(value => !value.DosIsNullOrWhiteSpace())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(value => value, StringComparer.OrdinalIgnoreCase)
                .ToList();
            var configuredTenant = OsClientExtend.GetConfigOsClient();
            if (configuredTenant.DosIsNullOrWhiteSpace()) configuredTenant = OsClientDefault.OsClient;
            if (!configuredTenant.DosIsNullOrWhiteSpace())
            {
                tenants.RemoveAll(value => string.Equals(
                    value,
                    configuredTenant,
                    StringComparison.OrdinalIgnoreCase));
                tenants.Insert(0, configuredTenant);
            }

            var scanned = 0;
            var reconciled = 0;
            var superseded = 0;
            var failed = 0;
            foreach (var osClient in tenants)
            {
                cancellationToken.ThrowIfCancellationRequested();
                try
                {
                    for (var pageIndex = 1;
                         pageIndex <= ApplicationAliasRecoveryMaxPagesPerTenant;
                         pageIndex++)
                    {
                        var result = await MicroiEngine.FormEngine.GetTableDataAsync<dynamic>(
                            "mci_ai_app_version",
                            new
                            {
                                OsClient = osClient,
                                _Where = new List<object>
                                {
                                    new List<object> { "Status", "In", new[] { "Verified", "Published" } },
                                    new List<object> { "AND", "BuildLog", "Like", "StreamedAssets" }
                                },
                                _SelectFields = new[]
                                {
                                    "Id", "OsClient", "AppId", "VersionNo", "Status", "PublishPath",
                                    "FileCount", "TotalSize", "BuildLog", "UpdateTime"
                                },
                                _OrderBy = "UpdateTime",
                                _OrderByType = "DESC",
                                _PageIndex = pageIndex,
                                _PageSize = ApplicationAliasRecoveryPageSize
                            }).ConfigureAwait(false);
                        if (result.Code != 1) break;
                        var rows = result.Data == null
                            ? new JArray()
                            : JArray.FromObject((object)result.Data);
                        foreach (var token in rows)
                        {
                            cancellationToken.ThrowIfCancellationRequested();
                            var versionRow = token as JObject ?? JObject.FromObject(token);
                            scanned++;
                            JObject buildLog;
                            try { buildLog = JObject.Parse(SafeJString(versionRow, "BuildLog")); }
                            catch { continue; }
                            if (!IsApplicationAliasRecoveryDue(versionRow, buildLog, DateTime.UtcNow))
                                continue;

                            var outcome = await ReconcilePublishedApplicationAliasCandidateAsync(
                                osClient,
                                versionRow,
                                cancellationToken).ConfigureAwait(false);
                            if (outcome == "Reconciled") reconciled++;
                            else if (outcome == "Superseded") superseded++;
                            else if (outcome == "Failed") failed++;
                        }
                        if (rows.Count < ApplicationAliasRecoveryPageSize) break;
                    }
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    throw;
                }
                catch
                {
                    // A legacy or partially upgraded tenant must not block other
                    // tenants on this node. The next bounded sweep retries it.
                    failed++;
                }
            }

            return new DosResult<object>(1, new
            {
                TenantCount = tenants.Count,
                Scanned = scanned,
                Reconciled = reconciled,
                Superseded = superseded,
                Failed = failed
            }, failed == 0 ? "应用稳定入口后台收敛扫描完成" : "应用稳定入口后台收敛扫描完成，存在待重试项");
        }

        private static bool IsApplicationAliasRecoveryDue(
            JObject versionRow,
            JObject buildLog,
            DateTime utcNow)
        {
            if (!string.Equals(
                    SafeJString(buildLog, "Mode"),
                    "StreamedAssets",
                    StringComparison.Ordinal)) return false;
            var manifest = buildLog["AliasManifest"] as JArray;
            if (manifest == null || manifest.Count == 0) return false;
            if (!string.Equals(
                    SafeJString(versionRow, "Status"),
                    "Published",
                    StringComparison.OrdinalIgnoreCase)) return false;
            if (buildLog["RecoveryRequired"]?.Val<bool?>() != true) return false;
            var nextText = SafeJString(buildLog, "NextAliasReconcileAtUtc");
            return nextText.DosIsNullOrWhiteSpace()
                   || !DateTimeOffset.TryParse(nextText, out var next)
                   || next.UtcDateTime <= utcNow;
        }

        private static async Task<string> ReconcilePublishedApplicationAliasCandidateAsync(
            string osClient,
            JObject candidate,
            CancellationToken cancellationToken)
        {
            var appId = SafeJString(candidate, "AppId");
            if (appId.DosIsNullOrWhiteSpace()) return "Failed";
            DosResult reconcileResult = null;
            var lockResult = await MicroiEngine.Lock.ActionLockAsync(new MicroiLockParam
            {
                Key = BuildApplicationAssetPublishLockKey(osClient, appId),
                OsClient = osClient,
                Expiry = TimeSpan.FromMinutes(5),
                AcquireTimeout = TimeSpan.FromSeconds(2),
                CancellationToken = cancellationToken,
                RetryIntervalMs = 100,
                UseExponentialBackoff = true,
                AutoRenew = true,
                MaxLeaseDuration = TimeSpan.FromHours(1)
            }, async lease =>
            {
                reconcileResult = await ReconcilePublishedApplicationAliasCandidateUnderLeaseAsync(
                    osClient,
                    SafeJString(candidate, "Id"),
                    appId,
                    lease,
                    cancellationToken).ConfigureAwait(false);
            }).ConfigureAwait(false);
            if (lockResult.Code != 1) return "Skipped";
            if (reconcileResult?.Code != 1) return "Failed";
            var state = Convert.ToString(reconcileResult.Data);
            return state == "Superseded" ? "Superseded" : "Reconciled";
        }

        private static async Task<DosResult> ReconcilePublishedApplicationAliasCandidateUnderLeaseAsync(
            string osClient,
            string versionId,
            string appId,
            IMicroiLockLease lease,
            CancellationToken cancellationToken)
        {
            await lease.EnsureHeldAsync().ConfigureAwait(false);
            var versionResult = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(
                "mci_ai_app_version",
                new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "Id", "=", versionId },
                        new List<object> { "AND", "AppId", "=", appId }
                    }
                }).ConfigureAwait(false);
            if (versionResult.Code != 1 || versionResult.Data == null)
                return new DosResult(0, null, "待恢复应用版本不存在");
            var versionRow = JObject.FromObject((object)versionResult.Data);
            JObject buildLog;
            try { buildLog = JObject.Parse(SafeJString(versionRow, "BuildLog")); }
            catch { return new DosResult(0, null, "待恢复应用版本 BuildLog 不是有效 JSON"); }
            if (!IsApplicationAliasRecoveryDue(versionRow, buildLog, DateTime.UtcNow))
                return new DosResult(1, "Skipped", "待恢复版本尚未到执行时间或已收敛");

            var app = await FindAiApplication(osClient, appId).ConfigureAwait(false);
            if (app == null) return new DosResult(0, null, "待恢复应用不存在");
            var disposition = GetApplicationAliasRecoveryDisposition(app, versionRow, buildLog);
            if (disposition == "PendingFinalizeReplay")
                return new DosResult(1, "Skipped", "Verified/Pending 版本必须按原 RequestId/DeliveryBatchId 重放 finalize");
            if (disposition == "Superseded")
            {
                buildLog["AliasStatus"] = "Superseded";
                buildLog["RecoveryRequired"] = false;
                buildLog["PendingReplayRequired"] = false;
                buildLog["SupersededAtUtc"] = DateTime.UtcNow.ToString("O");
                buildLog["SupersededByVersion"] = SafeJString(app, "AppVersion");
                buildLog.Remove("NextAliasReconcileAtUtc");
                buildLog["AliasCheckpoint"] = new JObject
                {
                    ["Status"] = "Superseded",
                    ["CompletedTargets"] = new JArray(),
                    ["UpdatedAtUtc"] = DateTime.UtcNow.ToString("O")
                };
                var supersededUpdate = await UpdateApplicationAliasBuildLogCasAsync(
                    osClient,
                    versionRow,
                    buildLog,
                    lease,
                    "标记旧应用稳定入口恢复任务已被替代").ConfigureAwait(false);
                return supersededUpdate.Code == 1
                    ? new DosResult(1, "Superseded", "旧版本恢复任务已安全退出")
                    : supersededUpdate;
            }
            if (disposition != "Current")
                return await MarkApplicationAliasRecoveryFailureAsync(
                    osClient,
                    versionRow,
                    buildLog,
                    "应用稳定入口恢复权威指针无效",
                    lease).ConfigureAwait(false);

            var manifestError = TryBuildApplicationAliasRecoveryAssets(
                app,
                versionRow,
                buildLog,
                out var assets);
            if (manifestError != null)
                return await MarkApplicationAliasRecoveryFailureAsync(
                    osClient,
                    versionRow,
                    buildLog,
                    manifestError,
                    lease).ConfigureAwait(false);

            var hdfs = ResolveApplicationAssetHdfs(osClient, out var clientModel);
            var targets = BuildStreamPublishAliasTargets(assets)
                .OrderBy(target => target.Asset.RelativePath, StringComparer.Ordinal)
                .ThenBy(target => target.Path, StringComparer.Ordinal)
                .ToList();
            var checkpoint = new JObject
            {
                ["Status"] = "Running",
                ["Attempt"] = SafeJInt(buildLog["AliasCheckpoint"] as JObject, "Attempt", 0) + 1,
                ["AttemptId"] = Guid.NewGuid().ToString("N"),
                ["CompletedTargets"] = new JArray(),
                ["StartedAtUtc"] = DateTime.UtcNow.ToString("O"),
                ["UpdatedAtUtc"] = DateTime.UtcNow.ToString("O")
            };
            buildLog["AliasCheckpoint"] = checkpoint;
            buildLog["LastRecoveryError"] = null;
            var checkpointStart = await UpdateApplicationAliasBuildLogCasAsync(
                osClient,
                versionRow,
                buildLog,
                lease,
                "开始应用稳定入口恢复检查点").ConfigureAwait(false);
            if (checkpointStart.Code != 1) return checkpointStart;

            foreach (var target in targets)
            {
                cancellationToken.ThrowIfCancellationRequested();
                await lease.EnsureHeldAsync().ConfigureAwait(false);
                var targetError = await ValidateApplicationAliasObjectAsync(
                    hdfs,
                    clientModel,
                    target,
                    target.Path,
                    cancellationToken).ConfigureAwait(false);
                if (targetError != null)
                {
                    var sourceError = await ValidateApplicationAliasObjectAsync(
                        hdfs,
                        clientModel,
                        target,
                        target.Asset.Paths.VersionPath,
                        cancellationToken).ConfigureAwait(false);
                    if (sourceError != null)
                    {
                        return await MarkApplicationAliasRecoveryFailureAsync(
                            osClient,
                            versionRow,
                            buildLog,
                            "不可变版本资产校验失败：" + sourceError,
                            lease).ConfigureAwait(false);
                    }
                    var copy = await ExecuteApplicationAssetSideEffect(
                        lease,
                        () => CopyApplicationObject(
                            hdfs,
                            clientModel,
                            target.Asset.Paths.VersionPath,
                            target.Path)).ConfigureAwait(false);
                    if (copy.Code != 1)
                    {
                        return await MarkApplicationAliasRecoveryFailureAsync(
                            osClient,
                            versionRow,
                            buildLog,
                            "稳定入口复制失败：" + copy.Msg,
                            lease).ConfigureAwait(false);
                    }
                    targetError = await ValidateApplicationAliasObjectAsync(
                        hdfs,
                        clientModel,
                        target,
                        target.Path,
                        cancellationToken).ConfigureAwait(false);
                    if (targetError != null)
                    {
                        return await MarkApplicationAliasRecoveryFailureAsync(
                            osClient,
                            versionRow,
                            buildLog,
                            "稳定入口复制后回读失败：" + targetError,
                            lease).ConfigureAwait(false);
                    }
                }

                ((JArray)checkpoint["CompletedTargets"]).Add(target.Path);
                checkpoint["LastTarget"] = target.Path;
                checkpoint["UpdatedAtUtc"] = DateTime.UtcNow.ToString("O");
                buildLog["AliasCheckpoint"] = checkpoint;
                var itemCheckpoint = await UpdateApplicationAliasBuildLogCasAsync(
                    osClient,
                    versionRow,
                    buildLog,
                    lease,
                    "保存应用稳定入口逐项恢复检查点").ConfigureAwait(false);
                if (itemCheckpoint.Code != 1) return itemCheckpoint;
            }

            // The per-item checkpoint is not a substitute for a final full read.
            // Re-read every target before committing the recovery terminal fact.
            var finalError = await RunApplicationAssetBoundedParallelAsync(
                targets,
                async (target, batchCancellationToken) =>
                {
                    batchCancellationToken.ThrowIfCancellationRequested();
                    await lease.EnsureHeldAsync().ConfigureAwait(false);
                    var error = await ValidateApplicationAliasObjectWithoutBudgetAsync(
                        hdfs,
                        clientModel,
                        target,
                        target.Path).ConfigureAwait(false);
                    await lease.EnsureHeldAsync().ConfigureAwait(false);
                    return error;
                },
                cancellationToken,
                declaredByteSize: target => target.Asset.Size).ConfigureAwait(false);
            if (finalError != null)
            {
                return await MarkApplicationAliasRecoveryFailureAsync(
                    osClient,
                    versionRow,
                    buildLog,
                    "稳定入口完整清单终检失败：" + finalError,
                    lease).ConfigureAwait(false);
            }

            var currentApp = await FindAiApplication(osClient, appId).ConfigureAwait(false);
            if (GetApplicationAliasRecoveryDisposition(currentApp, versionRow, buildLog) != "Current")
            {
                // Do not write an old success checkpoint after a newer publish.
                buildLog["AliasStatus"] = "Superseded";
                buildLog["RecoveryRequired"] = false;
                buildLog["SupersededAtUtc"] = DateTime.UtcNow.ToString("O");
                buildLog["SupersededByVersion"] = SafeJString(currentApp, "AppVersion");
                buildLog.Remove("NextAliasReconcileAtUtc");
                var superseded = await UpdateApplicationAliasBuildLogCasAsync(
                    osClient,
                    versionRow,
                    buildLog,
                    lease,
                    "恢复终态前标记旧版本已被替代").ConfigureAwait(false);
                return superseded.Code == 1
                    ? new DosResult(1, "Superseded", "恢复终态前检测到新版本，旧任务已退出")
                    : superseded;
            }

            var verificationPass = SafeJInt(buildLog, "AliasVerificationPass", 0) + 1;
            var requiresAnotherPass = verificationPass < ApplicationAliasRecoveryRequiredPasses;
            checkpoint["Status"] = requiresAnotherPass ? "VerifiedAwaitingStability" : "Completed";
            checkpoint["CompletedAtUtc"] = DateTime.UtcNow.ToString("O");
            checkpoint["UpdatedAtUtc"] = DateTime.UtcNow.ToString("O");
            buildLog["AliasCheckpoint"] = checkpoint;
            buildLog["AliasStatus"] = "Published";
            buildLog["StableAliasesVerified"] = true;
            buildLog["PendingReplayRequired"] = false;
            buildLog["RecoveryRequired"] = requiresAnotherPass;
            buildLog["AliasVerificationPass"] = verificationPass;
            buildLog["LastAliasVerifiedAtUtc"] = DateTime.UtcNow.ToString("O");
            buildLog["LastRecoveryError"] = null;
            if (requiresAnotherPass)
            {
                var delay = verificationPass == 1
                    ? TimeSpan.FromSeconds(30)
                    : TimeSpan.FromMinutes(2);
                buildLog["NextAliasReconcileAtUtc"] = DateTime.UtcNow.Add(delay).ToString("O");
            }
            else
            {
                buildLog.Remove("NextAliasReconcileAtUtc");
            }

            var terminal = await UpdateApplicationAliasBuildLogCasAsync(
                osClient,
                versionRow,
                buildLog,
                lease,
                "提交应用稳定入口恢复终态").ConfigureAwait(false);
            return terminal.Code == 1
                ? new DosResult(1, "Reconciled", requiresAnotherPass
                    ? "稳定入口已校验，等待下一次延迟稳定性复核"
                    : "稳定入口已完成持久收敛")
                : terminal;
        }

        private static async Task<string> ValidateApplicationAliasObjectAsync(
            IMicroiHDFS hdfs,
            OsClientSecret clientModel,
            StreamPublishAliasTarget target,
            string path,
            CancellationToken cancellationToken)
        {
            IDisposable budget = null;
            try
            {
                budget = await AcquireApplicationAssetReadBudgetAsync(
                    target.Asset.Size,
                    cancellationToken).ConfigureAwait(false);
                return await ValidateApplicationAliasObjectWithoutBudgetAsync(
                    hdfs,
                    clientModel,
                    target,
                    path).ConfigureAwait(false);
            }
            finally
            {
                budget?.Dispose();
            }
        }

        private static async Task<string> ValidateApplicationAliasObjectWithoutBudgetAsync(
            IMicroiHDFS hdfs,
            OsClientSecret clientModel,
            StreamPublishAliasTarget target,
            string path)
        {
            var bytes = await ReadApplicationObjectBytes(hdfs, clientModel, path).ConfigureAwait(false);
            var error = ValidateApplicationAssetContent(
                target.Asset.RelativePath,
                target.Asset.Size,
                target.Asset.Sha256,
                bytes,
                target.Asset.IsEntry);
            return error == null ? null : error + "：" + path;
        }

        private static async Task<DosResult> MarkApplicationAliasRecoveryFailureAsync(
            string osClient,
            JObject versionRow,
            JObject buildLog,
            string error,
            IMicroiLockLease lease)
        {
            buildLog["RecoveryRequired"] = true;
            buildLog["PendingReplayRequired"] = false;
            buildLog["AliasStatus"] = "Published";
            buildLog["LastRecoveryError"] = error;
            buildLog["NextAliasReconcileAtUtc"] = DateTime.UtcNow.AddSeconds(30).ToString("O");
            var checkpoint = buildLog["AliasCheckpoint"] as JObject ?? new JObject();
            checkpoint["Status"] = "Retrying";
            checkpoint["LastError"] = error;
            checkpoint["UpdatedAtUtc"] = DateTime.UtcNow.ToString("O");
            buildLog["AliasCheckpoint"] = checkpoint;
            var update = await UpdateApplicationAliasBuildLogCasAsync(
                osClient,
                versionRow,
                buildLog,
                lease,
                "保存应用稳定入口恢复失败检查点").ConfigureAwait(false);
            return new DosResult(0, update.Data, error + (update.Code == 1 ? "" : "；失败检查点写入失败：" + update.Msg));
        }

        private static async Task<DosResult> UpdateApplicationAliasBuildLogCasAsync(
            string osClient,
            JObject versionRow,
            JObject desiredBuildLog,
            IMicroiLockLease lease,
            string operationName)
        {
            var oldBuildLog = SafeJString(versionRow, "BuildLog");
            var desiredBuildLogText = desiredBuildLog.ToString(Formatting.None);
            var result = await ExecuteApplicationAssetConditionalUpdate(
                osClient,
                "mci_ai_app_version",
                new JObject { ["BuildLog"] = desiredBuildLogText },
                new List<object>
                {
                    new List<object> { "Id", "=", SafeJString(versionRow, "Id") },
                    new List<object> { "AND", "AppId", "=", SafeJString(versionRow, "AppId") },
                    new List<object> { "AND", "VersionNo", "=", SafeJString(versionRow, "VersionNo") },
                    new List<object> { "AND", "Status", "=", SafeJString(versionRow, "Status") },
                    new List<object> { "AND", "BuildLog", "=", oldBuildLog }
                },
                lease,
                operationName).ConfigureAwait(false);
            if (result.Code == 1)
            {
                versionRow["BuildLog"] = desiredBuildLogText;
                return result;
            }

            // An ambiguous DB response is accepted only when the exact desired
            // BuildLog can be read back. A different writer always wins.
            var readback = await MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(
                "mci_ai_app_version",
                new
                {
                    OsClient = osClient,
                    _Where = new List<object>
                    {
                        new List<object> { "Id", "=", SafeJString(versionRow, "Id") },
                        new List<object> { "AND", "AppId", "=", SafeJString(versionRow, "AppId") },
                        new List<object> { "AND", "VersionNo", "=", SafeJString(versionRow, "VersionNo") }
                    },
                    _SelectFields = new[] { "Id", "BuildLog" }
                }).ConfigureAwait(false);
            if (readback.Code == 1 && readback.Data != null)
            {
                var current = JObject.FromObject((object)readback.Data);
                if (string.Equals(
                        SafeJString(current, "BuildLog"),
                        desiredBuildLogText,
                        StringComparison.Ordinal))
                {
                    versionRow["BuildLog"] = desiredBuildLogText;
                    return new DosResult(1, current, operationName + "已由同一恢复请求幂等提交");
                }
            }
            return result;
        }
    }
}

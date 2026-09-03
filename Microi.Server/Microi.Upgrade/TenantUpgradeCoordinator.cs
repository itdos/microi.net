using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;

namespace Microi.net
{
    public partial class MicroiUpgrade
    {
        private static readonly string[] RequiredRuntimeInvariantNames =
        {
            "平台运行时接口闭包",
            "Upgrade21-持久后台任务",
            "Upgrade23-SaaS运行时结构",
            "Upgrade25-应用发布租户门禁",
            "Upgrade25-应用发布V3结构",
            "Upgrade26-访问密钥菜单",
            "Upgrade28-用户首页与商城事件",
            "Upgrade29-OCR租户配置",
            "Upgrade30-后端运行配置",
            "Upgrade31-翻译引擎配置",
            "Upgrade33-表单V8限额",
            "Upgrade34-数据源迁移接口引擎"
        };

        /// <summary>
        /// 启动、新租户开通和管理员手动补跑共用的单租户升级入口。
        /// 数据库版本只在全部历史迁移成功后前向推进；当前运行时不变量始终幂等复检。
        /// </summary>
        public async Task<DosResult> UpgradeTenantAsync(
            string osClient,
            string backgroundTaskId = null,
            CancellationToken cancellationToken = default)
        {
            osClient = (osClient ?? string.Empty).Trim();
            if (osClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null, "租户标识不能为空，无法执行数据库升级。");
            }

            OsClientSecret runtimeClient;
            try
            {
                Report(backgroundTaskId, 1, "正在解析租户运行配置", 0, 1);
                runtimeClient = OsClient.GetClient(osClient);
            }
            catch (Exception ex)
            {
                return BuildUpgradeFailure(
                    osClient,
                    backgroundTaskId,
                    "无法加载租户运行配置。请在主租户 SaaS 引擎中检查该租户的数据库地址、端口、库名、账号、密码和授权，保存后刷新运行配置再重试。",
                    ex);
            }

            if (runtimeClient?.Db == null)
            {
                return BuildUpgradeFailure(
                    osClient,
                    backgroundTaskId,
                    "租户数据库会话尚未初始化。请检查 SaaS 租户的数据库连接和只读数据库连接，并刷新租户运行配置后重试。",
                    null);
            }

            var beforeVersion = string.Empty;
            var afterVersion = string.Empty;
            var targetVersion = GetVersionedUpgradePrograms()
                .Select(item => item.Value)
                .OrderBy(item => ParseFourPartVersion(item, "升级版本号"))
                .LastOrDefault() ?? string.Empty;
            UpgradeDistributedLease upgradeLease = null;
            var safeReloadPoint = false;

            try
            {
                ThrowIfCancelled(backgroundTaskId, cancellationToken);
                Report(backgroundTaskId, 3, "正在检查升级所需物理字段", 0, 1);
                var prerequisite = await EnsureRuntimePhysicalPrerequisitesAsync(
                        runtimeClient, cancellationToken)
                    .ConfigureAwait(false);
                if (prerequisite.Code != 1)
                {
                    throw new InvalidOperationException(prerequisite.Msg);
                }

                string leaseReason = null;
                const int maxLeaseAttempts = 30;
                for (var attempt = 1; attempt <= maxLeaseAttempts; attempt++)
                {
                    ThrowIfCancelled(backgroundTaskId, cancellationToken);
                    upgradeLease = UpgradeDistributedLease.TryAcquire(
                        runtimeClient.OsClient, out leaseReason);
                    if (upgradeLease != null) break;
                    if (attempt == 1 || attempt % 6 == 0)
                    {
                        AppendLog(backgroundTaskId,
                            $"正在等待租户升级分布式租约（第 {attempt} 次）：{leaseReason ?? "其它节点正在执行"}");
                    }
                    if (attempt < maxLeaseAttempts)
                    {
                        await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken)
                            .ConfigureAwait(false);
                    }
                }

                if (upgradeLease == null)
                {
                    return BuildUpgradeFailure(
                        osClient,
                        backgroundTaskId,
                        "未能取得租户升级分布式租约，可能有其它节点正在升级该租户，请稍后重试。",
                        null,
                        beforeVersion,
                        targetVersion);
                }

                using (upgradeLease)
                using (UpgradeExecutionLeaseContext.Enter(upgradeLease))
                {
                    var total = RequiredRuntimeInvariantNames.Length
                                + GetVersionedUpgradePrograms().Count + 4;
                    var current = 0;
                    upgradeLease.ThrowIfLost();
                    Report(backgroundTaskId, 5, "已取得升级租约", ++current, total);

                    await RunCoordinatorInvariantAsync(
                        runtimeClient,
                        upgradeLease,
                        backgroundTaskId,
                        RequiredRuntimeInvariantNames[0],
                        async () =>
                        {
                            // The official application-source tenant is the authority for
                            // Managed resources.  It must be updated through the signed
                            // application-source workflow, never by replaying the embedded
                            // customer baseline during host startup.  Treat this invariant
                            // as source-managed so a pending source publication cannot form
                            // a bootstrap deadlock (API cannot start -> source cannot sync).
                            if (UpgradeAppStore.IsOfficialSourceTenant(runtimeClient.OsClient))
                            {
                                AppendLog(backgroundTaskId,
                                    "当前租户是官方应用源；平台运行时接口闭包由官方应用源同步维护，本次数据库升级不反向覆盖。");
                                return new List<string>();
                            }
                            var result = await UpgradeAppStore
                                .EnsureStartupDependenciesUnderLeaseAsync(runtimeClient)
                                .ConfigureAwait(false);
                            if (result.Code != 1)
                            {
                                // License recovery can finish while the startup invariant is
                                // reading the database. Re-evaluate after the readback result so
                                // an official source never bricks its own API during that window.
                                if (UpgradeAppStore.IsOfficialSourceResult(result)
                                    || UpgradeAppStore.IsOfficialSourceTenant(runtimeClient.OsClient))
                                {
                                    AppendLog(backgroundTaskId,
                                        "已在校验过程中确认当前租户是官方应用源；接口闭包差异等待官方应用源同步，本次数据库升级继续。");
                                    return new List<string>();
                                }
                                throw new InvalidOperationException(result.Msg);
                            }
                            return new List<string>();
                        }).ConfigureAwait(false);
                    Report(backgroundTaskId, 10, "平台运行时接口闭包已就绪", ++current, total);

                    var invariants = new List<KeyValuePair<string, Func<Task<List<string>>>>>
                    {
                        new KeyValuePair<string, Func<Task<List<string>>>>(
                            RequiredRuntimeInvariantNames[1], () => new Upgrade21().Run(runtimeClient.OsClient)),
                        new KeyValuePair<string, Func<Task<List<string>>>>(
                            RequiredRuntimeInvariantNames[2], () => new Upgrade23().Run(runtimeClient.OsClient)),
                        new KeyValuePair<string, Func<Task<List<string>>>>(
                            RequiredRuntimeInvariantNames[3], () => new Upgrade25().EnsureTenantGateInvariant(runtimeClient.OsClient)),
                        new KeyValuePair<string, Func<Task<List<string>>>>(
                            RequiredRuntimeInvariantNames[4], () => new Upgrade25().EnsureApplicationStreamV3SchemaInvariant(runtimeClient.OsClient)),
                        new KeyValuePair<string, Func<Task<List<string>>>>(
                            RequiredRuntimeInvariantNames[5], () => new Upgrade26().Run(runtimeClient.OsClient)),
                        new KeyValuePair<string, Func<Task<List<string>>>>(
                            RequiredRuntimeInvariantNames[6], () => new Upgrade28().Run(runtimeClient.OsClient)),
                        new KeyValuePair<string, Func<Task<List<string>>>>(
                            RequiredRuntimeInvariantNames[7], () => new Upgrade29().Run(runtimeClient.OsClient)),
                        new KeyValuePair<string, Func<Task<List<string>>>>(
                            RequiredRuntimeInvariantNames[8], () => new Upgrade30().Run(runtimeClient.OsClient)),
                        new KeyValuePair<string, Func<Task<List<string>>>>(
                            RequiredRuntimeInvariantNames[9], () => new Upgrade31().Run(runtimeClient.OsClient)),
                        new KeyValuePair<string, Func<Task<List<string>>>>(
                            RequiredRuntimeInvariantNames[10], () => new Upgrade33().Run(runtimeClient.OsClient, false)),
                        new KeyValuePair<string, Func<Task<List<string>>>>(
                            RequiredRuntimeInvariantNames[11], () => new Upgrade34().Run(runtimeClient.OsClient))
                    };

                    foreach (var invariant in invariants)
                    {
                        ThrowIfCancelled(backgroundTaskId, cancellationToken);
                        await RunCoordinatorInvariantAsync(
                                runtimeClient,
                                upgradeLease,
                                backgroundTaskId,
                                invariant.Key,
                                invariant.Value)
                            .ConfigureAwait(false);
                        current++;
                        Report(backgroundTaskId,
                            10 + (int)Math.Round(current * 35D / total),
                            invariant.Key + "已完成",
                            current,
                            total);
                    }

                    upgradeLease.ThrowIfLost();
                    beforeVersion = ReadServerVersion(runtimeClient);
                    var pendingPrograms = GetVersionedUpgradePrograms()
                        .Where(program => NeedUpgrade(beforeVersion, program.Value))
                        .ToList();
                    var skippedPrograms = GetVersionedUpgradePrograms().Count - pendingPrograms.Count;
                    current += skippedPrograms;
                    AppendLog(backgroundTaskId,
                        $"版本门禁检查完成：当前={FormatVersionForLog(beforeVersion)}，目标={FormatVersionForLog(targetVersion)}，待执行={pendingPrograms.Count}，已覆盖跳过={skippedPrograms}。");
                    Report(backgroundTaskId, 48, "正在执行版本迁移链", current, total);

                    foreach (var program in pendingPrograms)
                    {
                        AppendLog(backgroundTaskId,
                            $"待执行 {program.Key}，门禁版本={program.Value}。");
                    }

                    ThrowIfCancelled(backgroundTaskId, cancellationToken);
                    var result = await Upgrade(beforeVersion, runtimeClient).ConfigureAwait(false);
                    upgradeLease.ThrowIfLost();
                    afterVersion = ReadServerVersion(runtimeClient);
                    safeReloadPoint = result.Code == 1;
                    if (result.Code != 1)
                    {
                        var failureSummary = result.Msg.DosIsNullOrWhiteSpace()
                            ? string.Empty
                            : BuildChineseUpgradeDiagnostic(result.Msg);
                        if (!failureSummary.DosIsNullOrWhiteSpace())
                        {
                            AppendLog(backgroundTaskId, failureSummary);
                        }
                        return BuildUpgradeFailure(
                            osClient,
                            backgroundTaskId,
                            "租户数据库升级未全部完成，ServerVersion 未越过失败步骤。请根据任务日志修复首个失败项后再次执行。" +
                            (failureSummary.DosIsNullOrWhiteSpace() ? string.Empty : " " + failureSummary),
                            null,
                            beforeVersion,
                            targetVersion,
                            afterVersion);
                    }

                    current += pendingPrograms.Count;
                    Report(backgroundTaskId, 94, "版本迁移链执行成功", current, total);
                }

                var cacheReloaded = false;
                string cacheMessage = null;
                try
                {
                    ThrowIfCancelled(backgroundTaskId, cancellationToken);
                    var reload = await MicroiEngine.FormEngine
                        .ReloadDiyLangCacheAsync(runtimeClient.OsClient)
                        .ConfigureAwait(false);
                    cacheReloaded = reload.Code == 1;
                    cacheMessage = reload.Msg;
                }
                catch (Exception ex)
                {
                    cacheMessage = BuildChineseUpgradeDiagnostic(ex.Message);
                }

                var alreadyCurrent = !beforeVersion.DosIsNullOrWhiteSpace()
                                     && ParseFourPartVersion(beforeVersion, "升级前ServerVersion")
                                         .CompareTo(ParseFourPartVersion(targetVersion, "目标ServerVersion")) >= 0;
                var message = alreadyCurrent
                    ? "租户数据库版本已是当前版本；运行时不变量已完成复检。"
                    : "租户数据库升级完成。";
                if (!cacheReloaded)
                {
                    message += " 多语言缓存刷新未成功，但数据库升级结果已保存；可清理该租户缓存后重试。";
                    AppendLog(backgroundTaskId, "多语言缓存刷新未成功：" + (cacheMessage ?? "无返回"));
                }
                Report(backgroundTaskId, 100, message, 1, 1);
                AppendLog(backgroundTaskId,
                    $"升级结果：升级前={FormatVersionForLog(beforeVersion)}，目标={FormatVersionForLog(targetVersion)}，升级后={FormatVersionForLog(afterVersion)}，已是当前版本={alreadyCurrent}。");
                return new DosResult(1, new
                {
                    OsClient = runtimeClient.OsClient,
                    BeforeVersion = beforeVersion,
                    TargetVersion = targetVersion,
                    AfterVersion = afterVersion,
                    AlreadyCurrent = alreadyCurrent,
                    RuntimeInvariantsChecked = RequiredRuntimeInvariantNames,
                    CacheReloaded = cacheReloaded,
                    CacheMessage = cacheReloaded ? null : cacheMessage
                }, message);
            }
            catch (OperationCanceledException)
            {
                return BuildUpgradeFailure(
                    osClient,
                    backgroundTaskId,
                    "租户数据库升级已取消；已完成步骤保持幂等，ServerVersion 只会保留在最后完整成功的版本。",
                    null,
                    beforeVersion,
                    targetVersion,
                    afterVersion);
            }
            catch (Exception ex)
            {
                return BuildUpgradeFailure(
                    osClient,
                    backgroundTaskId,
                    "租户数据库升级失败。请先检查数据库连接、账号权限和任务日志中的首个失败步骤，修复后再次执行升级。",
                    ex,
                    beforeVersion,
                    targetVersion,
                    afterVersion);
            }
            finally
            {
                if (upgradeLease != null && !safeReloadPoint)
                {
                    AppendLog(backgroundTaskId,
                        "升级未到达安全缓存刷新点，已停止后续缓存刷新，避免放大数据库连接故障。");
                }
            }
        }

        private static string ReadServerVersion(OsClientSecret runtimeClient)
        {
            var orm = MicroiEngine.ORM(runtimeClient.Db.Db.DbProvider.DatabaseType);
            return runtimeClient.Db
                       .FromSql($"SELECT {orm.GetFieldName("ServerVersion")} " +
                                $"FROM {orm.GetTableName("sys_config")} " +
                                $"WHERE {orm.GetFieldName("IsEnable")} = @p0")
                       .AddInParameter("p0", 1)
                       .ToScalar<string>() ?? string.Empty;
        }

        private static async Task RunCoordinatorInvariantAsync(
            OsClientSecret runtimeClient,
            UpgradeDistributedLease upgradeLease,
            string backgroundTaskId,
            string step,
            Func<Task<List<string>>> action)
        {
            upgradeLease.ConfirmOwnership();
            AppendLog(backgroundTaskId, step + "：开始。");
            Console.WriteLine(
                $"Microi：【自动升级状态】【{runtimeClient.OsClient}】【{step}】开始。");
            var messages = await action().ConfigureAwait(false);
            upgradeLease.ConfirmOwnership();
            if (messages?.Count > 0)
            {
                throw new InvalidOperationException(string.Join("；", messages));
            }
            AppendLog(backgroundTaskId, step + "：成功。");
            Console.WriteLine(
                $"Microi：【自动升级状态】【{runtimeClient.OsClient}】【{step}】成功。");
        }

        private static void ThrowIfCancelled(
            string backgroundTaskId,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (!backgroundTaskId.DosIsNullOrWhiteSpace()
                && BackgroundTaskRuntime.IsCancellationRequested(backgroundTaskId))
            {
                throw new OperationCanceledException("后台任务已请求取消。");
            }
        }

        private static void Report(
            string backgroundTaskId,
            int progress,
            string message,
            int current,
            int total)
        {
            Console.WriteLine("Microi：【租户数据库升级】" + message);
            BackgroundTaskRuntime.TryUpdateProgress(
                backgroundTaskId,
                Math.Max(0, Math.Min(100, progress)),
                message,
                current,
                total);
        }

        private static void AppendLog(string backgroundTaskId, string message)
        {
            if (!backgroundTaskId.DosIsNullOrWhiteSpace())
            {
                BackgroundTaskRuntime.TryAppendLog(backgroundTaskId, message);
            }
        }

        private static DosResult BuildUpgradeFailure(
            string osClient,
            string backgroundTaskId,
            string message,
            Exception exception,
            string beforeVersion = null,
            string targetVersion = null,
            string afterVersion = null)
        {
            var rootException = exception?.GetBaseException() ?? exception;
            var errorType = rootException?.GetType().Name;
            var diagnostic = rootException == null
                ? string.Empty
                : BuildChineseUpgradeDiagnostic(rootException.Message);
            if (!diagnostic.DosIsNullOrWhiteSpace())
            {
                AppendLog(backgroundTaskId,
                    "失败类型=" + errorType + "；诊断=" + diagnostic);
            }
            var publicMessage = message
                                + (diagnostic.DosIsNullOrWhiteSpace()
                                    ? string.Empty
                                    : " " + diagnostic);
            BackgroundTaskRuntime.TryUpdateProgress(
                backgroundTaskId, null, publicMessage, null, null);
            Console.WriteLine(
                $"Microi：【Error异常】【{osClient}】租户数据库升级失败：{publicMessage}");
            var systemLogContent =
                $"BeforeVersion={beforeVersion ?? string.Empty}; " +
                $"TargetVersion={targetVersion ?? string.Empty}; " +
                $"AfterVersion={afterVersion ?? string.Empty}; " +
                $"ErrorType={errorType ?? "TenantUpgradeFailed"}; " +
                $"Message={publicMessage}";
            if (systemLogContent.Length > 32000)
            {
                systemLogContent = systemLogContent.Substring(0, 32000);
            }
            var queued = MicroiEngine.QueueSystemLog(
                osClient,
                "PlatformUpgrade",
                "TenantUpgradeFailed",
                "租户数据库升级失败",
                systemLogContent,
                3,
                false,
                backgroundTaskId);
            if (!queued)
            {
                Console.WriteLine(
                    $"Microi：【Warning警告】平台自动升级【{osClient}】系统日志队列暂不可用，协调器失败详情已保留在控制台日志。");
            }
            return new DosResult(0, new
            {
                OsClient = osClient,
                BeforeVersion = beforeVersion ?? string.Empty,
                TargetVersion = targetVersion ?? string.Empty,
                AfterVersion = afterVersion ?? string.Empty,
                ErrorType = errorType ?? "TenantUpgradeFailed"
            }, publicMessage);
        }

        private static string BuildChineseUpgradeDiagnostic(string value)
        {
            var safe = SanitizeUpgradeDiagnosticText(value);
            if (safe.DosIsNullOrWhiteSpace() || safe == "未知错误") return string.Empty;
            var lower = safe.ToLowerInvariant();
            if (lower.Contains("unknown mysql server host")
                || lower.Contains("no such host")
                || lower.Contains("name or service not known")
                || lower.Contains("nodename nor servname"))
            {
                return "数据库主机名无法解析。请检查 Data Source/Server 是否为当前后端容器可解析并可访问的地址；原始摘要：" + safe;
            }
            if (lower.Contains("access denied") || lower.Contains("authentication failed"))
            {
                return "数据库拒绝登录。请核对账号、密码及该账号对目标数据库的授权；原始摘要：" + safe;
            }
            if (lower.Contains("unknown database") || lower.Contains("does not exist"))
            {
                return "目标数据库不存在或库名填写错误。请核对 Database/Initial Catalog；原始摘要：" + safe;
            }
            if (lower.Contains("connection refused") || lower.Contains("actively refused"))
            {
                return "数据库地址可以解析，但端口拒绝连接。请检查端口、数据库服务、容器网络及防火墙；原始摘要：" + safe;
            }
            if (lower.Contains("timeout") || lower.Contains("timed out"))
            {
                return "连接或升级步骤执行超时。请检查数据库负载、网络连通性及任务日志中的首个超时步骤；原始摘要：" + safe;
            }
            if (lower.Contains("too many connections") || lower.Contains("max_user_connections"))
            {
                return "数据库连接数已耗尽。请先释放连接或提高数据库连接容量，再重新执行；原始摘要：" + safe;
            }
            return "技术摘要：" + safe;
        }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using Dos.Common;
using Dos.ORM;

namespace Microi.net
{
    /// <summary>
    /// Keeps the official iTdos database's installed platform-application facts
    /// aligned with its marketplace rows. Customer tenants must never run this
    /// repair: official identity requires both OsClient=iTdos and the pinned
    /// official License signing key.
    /// </summary>
    internal static class OfficialMarketplaceInstalledVersionReconciler
    {
        private const string PlatformApplicationType = "Platform";

        internal static OfficialMarketplaceVersionReconcileResult Reconcile(
            OsClientSecret osClientSecret)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            if (osClientSecret?.Db == null
                || !Microi.License.LicenseService.IsOfficialPlatform(osClientSecret.OsClient))
            {
                return OfficialMarketplaceVersionReconcileResult.NotOfficial();
            }

            List<OfficialMarketplaceAppVersionRow> marketplaceRows;
            List<InstalledMarketplaceAppVersionRow> installedRows;
            try
            {
                marketplaceRows = osClientSecret.Db.FromSql(@"SELECT
                        Id, AppId, AppName, Name, AppVersion,
                        ApplicationType, IsApprove, IsDeleted
                    FROM sys_microistore
                    WHERE (IsDeleted=0 OR IsDeleted IS NULL)
                      AND ApplicationType=@p0
                      AND IsApprove=@p1")
                    .AddInParameter("p0", PlatformApplicationType)
                    .AddInParameter("p1", 1)
                    .ToList<OfficialMarketplaceAppVersionRow>();

                installedRows = osClientSecret.Db.FromSql(@"SELECT
                        Id, StoreId, AppId, AppName, AppVersion,
                        AppVersionInstall, PackageVersion, InstallStatus, IsDeleted
                    FROM sys_microistoreversion
                    WHERE (IsDeleted=0 OR IsDeleted IS NULL)")
                    .ToList<InstalledMarketplaceAppVersionRow>();
            }
            catch (Exception ex)
            {
                // If the lease was lost while the query was running, fail closed
                // instead of disguising it as an optional schema compatibility skip.
                UpgradeExecutionLeaseContext.ThrowIfLost();
                return OfficialMarketplaceVersionReconcileResult.Failed(
                    "读取官网应用商城安装版本失败：" + ex.Message);
            }

            UpgradeExecutionLeaseContext.ThrowIfLost();
            var plan = CreatePlan(marketplaceRows, installedRows);
            var updated = 0;
            var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");

            foreach (var item in plan)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var assignments = new List<string>
                {
                    "AppVersion=@appVersion",
                    "AppVersionInstall=@appVersion",
                    "PackageVersion=@appVersion",
                    "LastCheckTime=@now",
                    "UpdateTime=@now"
                };
                var differences = new List<string>
                {
                    "COALESCE(AppVersion, '')<>@appVersion",
                    "COALESCE(AppVersionInstall, '')<>@appVersion",
                    "COALESCE(PackageVersion, '')<>@appVersion"
                };

                if (item.RepairStoreId)
                {
                    assignments.Add("StoreId=@storeId");
                    differences.Add("COALESCE(StoreId, '')<>@storeId");
                }
                if (item.RepairAppId)
                {
                    assignments.Add("AppId=@appId");
                    differences.Add("COALESCE(AppId, '')<>@appId");
                }

                try
                {
                    var command = osClientSecret.Db.FromSql(
                            "UPDATE sys_microistoreversion SET "
                            + string.Join(", ", assignments)
                            + " WHERE Id=@id AND ("
                            + string.Join(" OR ", differences)
                            + ")")
                        .AddInParameter("id", item.InstalledRowId)
                        .AddInParameter("appVersion", item.LatestVersion)
                        .AddInParameter("now", now);
                    if (item.RepairStoreId)
                    {
                        command.AddInParameter("storeId", item.StoreId);
                    }
                    if (item.RepairAppId)
                    {
                        command.AddInParameter("appId", item.AppId);
                    }
                    updated += command.ExecuteNonQuery();
                }
                catch (Exception ex)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    return OfficialMarketplaceVersionReconcileResult.Failed(
                        "对齐官网应用【" + item.AppName + "】安装版本失败：" + ex.Message,
                        plan.Count,
                        updated);
                }
            }

            UpgradeExecutionLeaseContext.ThrowIfLost();
            return OfficialMarketplaceVersionReconcileResult.Succeeded(plan.Count, updated);
        }

        /// <summary>
        /// Pure reconciliation planner shared with regression tests. It does not
        /// create installation facts, rewrite failed installs, or merge duplicate
        /// rows. Stable keys are repaired only when no other installed row owns
        /// the target key.
        /// </summary>
        internal static IReadOnlyList<OfficialMarketplaceVersionUpdate> CreatePlan(
            IEnumerable<OfficialMarketplaceAppVersionRow> marketplaceRows,
            IEnumerable<InstalledMarketplaceAppVersionRow> installedRows)
        {
            var stores = (marketplaceRows ?? Enumerable.Empty<OfficialMarketplaceAppVersionRow>())
                .Where(IsEligibleMarketplaceRow)
                .ToList();
            var installed = (installedRows ?? Enumerable.Empty<InstalledMarketplaceAppVersionRow>())
                .Where(row => row != null && row.IsDeleted != 1)
                .ToList();

            var storeIdIndex = BuildIndex(stores, row => row.Id);
            var appIdIndex = BuildIndex(stores, row => row.AppId);
            var appNameIndex = BuildIndex(stores, row => FirstText(row.AppName, row.Name));
            var claimedStoreIds = CountClaims(installed, row => row.StoreId);
            var claimedAppIds = CountClaims(installed, row => row.AppId);
            var result = new List<OfficialMarketplaceVersionUpdate>();

            foreach (var installedRow in installed)
            {
                if (!IsSuccessfulInstall(installedRow.InstallStatus))
                {
                    continue;
                }

                var candidates = new Dictionary<string, OfficialMarketplaceAppVersionRow>(
                    StringComparer.OrdinalIgnoreCase);
                AddCandidate(candidates, FindUnique(storeIdIndex, installedRow.StoreId));
                AddCandidate(candidates, FindUnique(appIdIndex, installedRow.AppId));
                AddCandidate(candidates, FindUnique(appNameIndex, installedRow.AppName));
                if (candidates.Count != 1)
                {
                    continue;
                }

                var store = candidates.Values.Single();
                var latestVersion = NormalizeText(store.AppVersion);
                var targetStoreId = NormalizeText(store.Id);
                var targetAppId = NormalizeText(store.AppId);
                var currentStoreId = NormalizeText(installedRow.StoreId);
                var currentAppId = NormalizeText(installedRow.AppId);
                var repairStoreId = !Same(currentStoreId, targetStoreId)
                    && CanClaim(claimedStoreIds, targetStoreId);
                var repairAppId = !Same(currentAppId, targetAppId)
                    && CanClaim(claimedAppIds, targetAppId);
                var versionChanged = !ExactVersion(installedRow.AppVersion, latestVersion)
                    || !ExactVersion(installedRow.AppVersionInstall, latestVersion)
                    || !ExactVersion(installedRow.PackageVersion, latestVersion);

                if (!versionChanged && !repairStoreId && !repairAppId)
                {
                    continue;
                }

                result.Add(new OfficialMarketplaceVersionUpdate
                {
                    InstalledRowId = NormalizeText(installedRow.Id),
                    AppName = FirstText(store.AppName, store.Name, installedRow.AppName),
                    StoreId = targetStoreId,
                    AppId = targetAppId,
                    LatestVersion = latestVersion,
                    RepairStoreId = repairStoreId,
                    RepairAppId = repairAppId
                });
            }

            return result;
        }

        private static bool IsEligibleMarketplaceRow(OfficialMarketplaceAppVersionRow row)
        {
            return row != null
                   && row.IsDeleted != 1
                   && row.IsApprove == 1
                   && Same(row.ApplicationType, PlatformApplicationType)
                   && !NormalizeText(row.Id).DosIsNullOrWhiteSpace()
                   && !NormalizeText(row.AppVersion).DosIsNullOrWhiteSpace();
        }

        private static bool IsSuccessfulInstall(string status)
        {
            var normalized = NormalizeText(status);
            return Same(normalized, "Installed")
                   || Same(normalized, "Success")
                   || Same(normalized, "Succeeded")
                   || Same(normalized, "已安装");
        }

        private static Dictionary<string, List<OfficialMarketplaceAppVersionRow>> BuildIndex(
            IEnumerable<OfficialMarketplaceAppVersionRow> rows,
            Func<OfficialMarketplaceAppVersionRow, string> selector)
        {
            var result = new Dictionary<string, List<OfficialMarketplaceAppVersionRow>>(
                StringComparer.OrdinalIgnoreCase);
            foreach (var row in rows)
            {
                var key = NormalizeText(selector(row));
                if (key.DosIsNullOrWhiteSpace()) continue;
                if (!result.TryGetValue(key, out var matches))
                {
                    matches = new List<OfficialMarketplaceAppVersionRow>();
                    result[key] = matches;
                }
                matches.Add(row);
            }
            return result;
        }

        private static Dictionary<string, int> CountClaims(
            IEnumerable<InstalledMarketplaceAppVersionRow> rows,
            Func<InstalledMarketplaceAppVersionRow, string> selector)
        {
            var result = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            foreach (var row in rows)
            {
                var key = NormalizeText(selector(row));
                if (key.DosIsNullOrWhiteSpace()) continue;
                result[key] = result.TryGetValue(key, out var count) ? count + 1 : 1;
            }
            return result;
        }

        private static OfficialMarketplaceAppVersionRow FindUnique(
            IReadOnlyDictionary<string, List<OfficialMarketplaceAppVersionRow>> index,
            string key)
        {
            var normalized = NormalizeText(key);
            return !normalized.DosIsNullOrWhiteSpace()
                   && index.TryGetValue(normalized, out var matches)
                   && matches.Count == 1
                ? matches[0]
                : null;
        }

        private static void AddCandidate(
            IDictionary<string, OfficialMarketplaceAppVersionRow> candidates,
            OfficialMarketplaceAppVersionRow candidate)
        {
            var id = NormalizeText(candidate?.Id);
            if (!id.DosIsNullOrWhiteSpace())
            {
                candidates[id] = candidate;
            }
        }

        private static bool CanClaim(IReadOnlyDictionary<string, int> claims, string key)
        {
            return !key.DosIsNullOrWhiteSpace()
                   && (!claims.TryGetValue(key, out var count) || count == 0);
        }

        private static bool ExactVersion(string current, string latest)
        {
            return string.Equals(
                NormalizeText(current),
                NormalizeText(latest),
                StringComparison.Ordinal);
        }

        private static bool Same(string left, string right)
        {
            return string.Equals(
                NormalizeText(left),
                NormalizeText(right),
                StringComparison.OrdinalIgnoreCase);
        }

        private static string FirstText(params string[] values)
        {
            foreach (var value in values ?? Array.Empty<string>())
            {
                var normalized = NormalizeText(value);
                if (!normalized.DosIsNullOrWhiteSpace()) return normalized;
            }
            return string.Empty;
        }

        private static string NormalizeText(object value)
        {
            return value?.ToString()?.Trim() ?? string.Empty;
        }
    }

    internal sealed class OfficialMarketplaceAppVersionRow
    {
        public string Id { get; set; }
        public string AppId { get; set; }
        public string AppName { get; set; }
        public string Name { get; set; }
        public string AppVersion { get; set; }
        public string ApplicationType { get; set; }
        public int? IsApprove { get; set; }
        public int? IsDeleted { get; set; }
    }

    internal sealed class InstalledMarketplaceAppVersionRow
    {
        public string Id { get; set; }
        public string StoreId { get; set; }
        public string AppId { get; set; }
        public string AppName { get; set; }
        public string AppVersion { get; set; }
        public string AppVersionInstall { get; set; }
        public string PackageVersion { get; set; }
        public string InstallStatus { get; set; }
        public int? IsDeleted { get; set; }
    }

    internal sealed class OfficialMarketplaceVersionUpdate
    {
        public string InstalledRowId { get; set; }
        public string AppName { get; set; }
        public string StoreId { get; set; }
        public string AppId { get; set; }
        public string LatestVersion { get; set; }
        public bool RepairStoreId { get; set; }
        public bool RepairAppId { get; set; }
    }

    internal sealed class OfficialMarketplaceVersionReconcileResult
    {
        public bool IsOfficialPlatform { get; private set; }
        public bool Success { get; private set; }
        public int Planned { get; private set; }
        public int Updated { get; private set; }
        public string Message { get; private set; }

        public static OfficialMarketplaceVersionReconcileResult NotOfficial()
        {
            return new OfficialMarketplaceVersionReconcileResult { Success = true };
        }

        public static OfficialMarketplaceVersionReconcileResult Succeeded(int planned, int updated)
        {
            return new OfficialMarketplaceVersionReconcileResult
            {
                IsOfficialPlatform = true,
                Success = true,
                Planned = planned,
                Updated = updated
            };
        }

        public static OfficialMarketplaceVersionReconcileResult Failed(
            string message,
            int planned = 0,
            int updated = 0)
        {
            return new OfficialMarketplaceVersionReconcileResult
            {
                IsOfficialPlatform = true,
                Success = false,
                Planned = planned,
                Updated = updated,
                Message = message
            };
        }
    }
}

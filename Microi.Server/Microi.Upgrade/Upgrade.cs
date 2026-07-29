using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
	public class MicroiUpgrade : IMicroiUpgrade
    {
        private static readonly string[] OfficialWebsiteAnonymousApiEngineKeys =
        {
            "send_sms_reg"
        };

        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        public async Task<DosResultList<MicroiUpgradeResult>> Upgrade(string CurrentVersion, OsClientSecret osClientSecret)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            if (!CurrentVersion.DosIsNullOrWhiteSpace()
                && (!System.Version.TryParse(CurrentVersion, out var parsedCurrentVersion)
                    || parsedCurrentVersion.Revision < 0))
            {
                Console.WriteLine($"Microi：【Error异常】租户[{osClientSecret?.OsClient}] sys_config.ServerVersion格式错误：{CurrentVersion}");
                return new DosResultList<MicroiUpgradeResult>(0, null, "sys_config.ServerVersion格式错误，应为四段数字版本号。");
            }
            var result = new List<MicroiUpgradeResult>();
            var needUptServerVersion = false;
            var uptVersion = "";
            var migrationFailed = false;
            var migrationErrors = new List<string>();
            var menuAppDisplaySnapshot = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

            try
            {
                // 运行时不变量不能只依赖可能被错误推进的历史版本号。
                EnsureAuthSecretColumns(osClientSecret);
                EnsureMicroServiceColumns(osClientSecret);
                EnsureSecurityLevels(osClientSecret);
                EnsureMobileVisibilityColumns(osClientSecret);
                EnsureModuleViewSchemaColumns(osClientSecret);
                EnsureApiEngineRuntimeColumns(osClientSecret);
                EnsureLegacyFieldMetadataColumns(osClientSecret);
                await EnsureApiEngineFieldMetadataCompatibilityAsync(osClientSecret, "启动前");
                await EnsureApiEngineCacheWriteCompatibilityAsync(osClientSecret, "启动前");
                await EnsureOfficialWebsitePublicApiEngineContractAsync(osClientSecret);
                await EnsureLegacyMenuDiyConfigCompatibilityAsync(osClientSecret);
                menuAppDisplaySnapshot = CaptureMenuAppDisplaySnapshot(osClientSecret);
            }
            catch (Exception ex)
            {
                migrationFailed = true;
                migrationErrors.Add("修复升级运行时不变量失败：" + ex.Message);
                Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【修复升级运行时不变量】失败：{ex.Message}");
            }

            #region 升级AppDisplay、AppVisible  --2024-09-19【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, UpgradeAppDisplay.Version))
            {
                try
                {
                    // 已由启动不变量按“查列、加列、回填”分步执行。这里不再运行不可重入的
                    // 多语句 ALTER + UPDATE，避免某条 ALTER 成功后重启时永远卡在重复列错误。
                    EnsureMobileVisibilityColumns(osClientSecret);
                    Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级AppDisplay、AppVisible】成功！");
                    needUptServerVersion = true;
                    AdvanceSuccessfulVersion(ref uptVersion, UpgradeAppDisplay.Version);
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级AppDisplay、AppVisible失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级AppDisplay、AppVisible】失败：{ex.Message}");//。Sql：{UpgradeAppDisplay.Sql}。
                }
                // result.Add(new MicroiUpgrade()
                // {
                //     Version = UpgradeAppDisplay.Version,
                //     Sql = UpgradeAppDisplay.Sql,
                // });
            }
            #endregion

            #region 升级sys_config --2024-09-22【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, UpgradeSysConfig.Version))
            {
                try
                {
                    var msgs = await new UpgradeSysConfig().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        migrationFailed = true;
                        migrationErrors.AddRange(msgs);
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级sys_config】失败：{msg}");
                        }
                    }
                    else
                    {
                        var count = osClientSecret.Db.FromSql(UpgradeSysConfig.Sql).ExecuteNonQuery();
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级sys_config】成功！");
                        needUptServerVersion = true;
                        AdvanceSuccessfulVersion(ref uptVersion, UpgradeSysConfig.Version);
                    }
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级sys_config失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级sys_config】失败：{ex.Message}");//。Sql：{UpgradeSysConfig.Sql}。
                }
            }
            #endregion

            #region 升级多语言 --2024-09-19【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, UpgradeLang.Version))
            {
                try
                {
                    var count = osClientSecret.Db.FromSql(UpgradeLang.Sql).ExecuteNonQuery();
                    Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级多语言】成功！");
                    needUptServerVersion = true;
                    AdvanceSuccessfulVersion(ref uptVersion, UpgradeLang.Version);
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级多语言失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级多语言】失败：{ex.Message}");//。Sql：{UpgradeLang.Sql}。
                }
            }
            #endregion

            #region 升级ApiEngine --2024-10-02【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, UpgradeApiEngine.Version))
            {
                try
                {
                    var msgs = await new UpgradeApiEngine().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        migrationFailed = true;
                        migrationErrors.AddRange(msgs);
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级ApiEngine】失败：{msg}");
                        }
                    }
                    else
                    {
                        var count = osClientSecret.Db.FromSql(UpgradeApiEngine.Sql).ExecuteNonQuery();
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级ApiEngine】成功！");
                        needUptServerVersion = true;
                        AdvanceSuccessfulVersion(ref uptVersion, UpgradeApiEngine.Version);
                    }
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级ApiEngine失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级ApiEngine】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级7 --2025-08-16【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, Upgrade7.Version))
            {
                try
                {
                    var msgs = await new Upgrade7().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        migrationFailed = true;
                        migrationErrors.AddRange(msgs);
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级7 - 2025-08-16】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级7 - 2025-08-16】成功！");
                        needUptServerVersion = true;
                        AdvanceSuccessfulVersion(ref uptVersion, Upgrade7.Version);
                    }

                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级7失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级7 - 2025-08-16】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级8 --2025-12-19【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, Upgrade8.Version))
            {
                try
                {
                    var msgs = await new Upgrade8().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        migrationFailed = true;
                        migrationErrors.AddRange(msgs);
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级8 - 2025-12-19】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级8 - 2025-12-19】成功！");
                        needUptServerVersion = true;
                        AdvanceSuccessfulVersion(ref uptVersion, Upgrade8.Version);
                    }
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级8失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级8 - 2025-12-19】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级9 --2026-01-09【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, Upgrade9.Version))
            {
                try
                {
                    var msgs = await new Upgrade9().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        migrationFailed = true;
                        migrationErrors.AddRange(msgs);
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级9 - 2026-01-09】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级9 - 2026-01-09】成功！");
                        needUptServerVersion = true;
                        AdvanceSuccessfulVersion(ref uptVersion, Upgrade9.Version);
                    }
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级9失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级9 - 2026-01-09】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级9 --2026-01-10【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, Upgrade10.Version))
            {
                try
                {
                    var msgs = await new Upgrade10().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        migrationFailed = true;
                        migrationErrors.AddRange(msgs);
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级10 - 2026-01-10】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级10 - 2026-01-10】成功！");
                        needUptServerVersion = true;
                        AdvanceSuccessfulVersion(ref uptVersion, Upgrade10.Version);
                    }
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级10失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级10 - 2026-01-10】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级11 --2026-01-13【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, Upgrade11.Version))
            {
                try
                {
                    var msgs = await new Upgrade11().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        migrationFailed = true;
                        migrationErrors.AddRange(msgs);
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级11 - 2026-01-13】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级11 - 2026-01-13】成功！");
                        needUptServerVersion = true;
                        AdvanceSuccessfulVersion(ref uptVersion, Upgrade11.Version);
                    }
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级11失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级11 - 2026-01-13】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级12 --2026-01-13【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, Upgrade12.Version))
            {
                try
                {
                    var msgs = await new Upgrade12().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        migrationFailed = true;
                        migrationErrors.AddRange(msgs);
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级12 - 2026-01-25】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级12 - 2026-01-25】成功！");
                        needUptServerVersion = true;
                        AdvanceSuccessfulVersion(ref uptVersion, Upgrade12.Version);
                    }
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级12失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级12 - 2026-01-25】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级13 --2026-02-03【必须】
            var needAppStoreVersionUpgrade = NeedUpgrade(CurrentVersion, UpgradeAppStore.Version);
            if (!migrationFailed && (needAppStoreVersionUpgrade || await UpgradeAppStore.NeedRefreshAsync(osClientSecret.OsClient)))
            {
                try
                {
                    var msgs = await new UpgradeAppStore().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        migrationFailed = true;
                        migrationErrors.AddRange(msgs);
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级13 - 2026-02-03】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级13 - 2026-02-03】成功！");
                        if (needAppStoreVersionUpgrade)
                        {
                            needUptServerVersion = true;
                            AdvanceSuccessfulVersion(ref uptVersion, UpgradeAppStore.Version);
                        }
                    }
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级13失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级13 - 2026-02-03】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级14 --2026-07-12【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, Upgrade14.Version))
            {
                try
                {
                    var msgs = await new Upgrade14().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        migrationFailed = true;
                        migrationErrors.AddRange(msgs);
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级14 - 2026-07-12】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级14 - 2026-07-12】成功！");
                        needUptServerVersion = true;
                        AdvanceSuccessfulVersion(ref uptVersion, Upgrade14.Version);
                    }
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级14失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级14 - 2026-07-12】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级15 --2026-07-23【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, Upgrade15.Version))
            {
                try
                {
                    var msgs = await new Upgrade15().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        migrationFailed = true;
                        migrationErrors.AddRange(msgs);
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级15 - 2026-07-23】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级15 - 2026-07-23】成功！");
                        needUptServerVersion = true;
                        AdvanceSuccessfulVersion(ref uptVersion, Upgrade15.Version);
                    }
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级15失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级15 - 2026-07-23】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级16 --2026-07-23【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, Upgrade16.Version))
            {
                try
                {
                    var msgs = await new Upgrade16().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        migrationFailed = true;
                        migrationErrors.AddRange(msgs);
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级16 - 2026-07-23】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级16 - 2026-07-23】成功！");
                        needUptServerVersion = true;
                        AdvanceSuccessfulVersion(ref uptVersion, Upgrade16.Version);
                    }
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级16失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级16 - 2026-07-23】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级17 --2026-07-24【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, Upgrade17.Version))
            {
                try
                {
                    var msgs = await new Upgrade17().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        migrationFailed = true;
                        migrationErrors.AddRange(msgs);
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级17 - 2026-07-24】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级17 - 2026-07-24】成功！");
                        needUptServerVersion = true;
                        AdvanceSuccessfulVersion(ref uptVersion, Upgrade17.Version);
                    }
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级17失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级17 - 2026-07-24】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级18 --2026-07-24【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, Upgrade18.Version))
            {
                try
                {
                    var msgs = await new Upgrade18().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        migrationFailed = true;
                        migrationErrors.AddRange(msgs);
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级18 - 2026-07-24】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级18 - 2026-07-24】成功！");
                        needUptServerVersion = true;
                        AdvanceSuccessfulVersion(ref uptVersion, Upgrade18.Version);
                    }
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级18失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级18 - 2026-07-24】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级19 --2026-07-25【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, Upgrade19.Version))
            {
                try
                {
                    var msgs = await new Upgrade19().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        migrationFailed = true;
                        migrationErrors.AddRange(msgs);
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级19 - 2026-07-25】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级19 - 2026-07-25】成功！");
                        needUptServerVersion = true;
                        AdvanceSuccessfulVersion(ref uptVersion, Upgrade19.Version);
                    }
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级19失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级19 - 2026-07-25】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级20 --2026-07-28【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, Upgrade20.Version))
            {
                try
                {
                    var msgs = await new Upgrade20().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        migrationFailed = true;
                        migrationErrors.AddRange(msgs);
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级20 - 2026-07-28】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级20 - 2026-07-28】成功！");
                        needUptServerVersion = true;
                        AdvanceSuccessfulVersion(ref uptVersion, Upgrade20.Version);
                    }
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级20失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级20 - 2026-07-28】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级21 --2026-07-28【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, Upgrade21.Version))
            {
                try
                {
                    var msgs = await new Upgrade21().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        migrationFailed = true;
                        migrationErrors.AddRange(msgs);
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级21 - 2026-07-28】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级21 - 2026-07-28】成功！");
                        needUptServerVersion = true;
                        AdvanceSuccessfulVersion(ref uptVersion, Upgrade21.Version);
                    }
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级21失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级21 - 2026-07-28】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级22 --2026-07-29【必须】
            if (!migrationFailed && NeedUpgrade(CurrentVersion, Upgrade22.Version))
            {
                try
                {
                    var msgs = await new Upgrade22().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        migrationFailed = true;
                        migrationErrors.AddRange(msgs);
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级22 - 2026-07-29】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级22 - 2026-07-29】成功！");
                        needUptServerVersion = true;
                        AdvanceSuccessfulVersion(ref uptVersion, Upgrade22.Version);
                    }
                }
                catch (Exception ex)
                {
                    migrationFailed = true;
                    migrationErrors.Add("升级22失败：" + ex.Message);
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级22 - 2026-07-29】失败：{ex.Message}");
                }
            }
            #endregion

            #region 保持新旧接口引擎字段元数据兼容【必须】
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                // 基础应用导入和其它迁移可能刷新字段元数据；同时即使数据库已经合法，
                // 共享 Redis 中仍可能残留由新版节点写入、旧版节点无法解析的字段列表。
                await EnsureApiEngineFieldMetadataCompatibilityAsync(
                    osClientSecret,
                    "基础应用包及版本迁移后");
                await EnsureApiEngineCacheWriteCompatibilityAsync(
                    osClientSecret,
                    "基础应用包及版本迁移后");
            }
            catch (Exception ex)
            {
                migrationFailed = true;
                migrationErrors.Add("修复接口引擎字段Config失败：" + ex.Message);
                Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【接口引擎字段Config兼容检查】失败：{ex.Message}");
            }
            #endregion

            #region 保持v3 DiyConfig与v6物理菜单字段兼容【必须】
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                // 应用包可能更新 sys_menu 表事件，因此所有包安装结束后再幂等确认一次。
                await EnsureLegacyMenuDiyConfigCompatibilityAsync(osClientSecret);
            }
            catch (Exception ex)
            {
                migrationFailed = true;
                migrationErrors.Add("同步旧版DiyConfig与新版菜单字段失败：" + ex.Message);
                Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【同步sys_menu.DiyConfig】失败：{ex.Message}");
            }
            #endregion

            #region 保护客户已有菜单的移动端显隐配置【必须】
            try
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                await RestoreMenuAppDisplaySnapshotAsync(osClientSecret, menuAppDisplaySnapshot);
            }
            catch (Exception ex)
            {
                migrationFailed = true;
                migrationErrors.Add("恢复菜单移动端显隐配置失败：" + ex.Message);
                Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【恢复菜单AppDisplay快照】失败：{ex.Message}");
            }
            #endregion

            #region 更新版本号【必须】
            try
            {
                if (needUptServerVersion && !migrationFailed)
                {
                    var count = await PersistServerVersionForwardOnlyAsync(osClientSecret, uptVersion);
                    Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【更新系统版本号ServerVersion】成功，共更新 {count} 行！");
                    Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】完成！");
                }
            }
            catch (Exception ex)
            {
                migrationFailed = true;
                migrationErrors.Add("更新ServerVersion失败：" + ex.Message);
                Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【更新系统版本号ServerVersion】失败：{ex.Message}");//Sql：{UpgradeAppDisplay.Sql}。
            }
            #endregion
            if (migrationFailed)
            {
                var message = string.Join("；", migrationErrors);
                Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】已停止，未推进ServerVersion：{message}");
                return new DosResultList<MicroiUpgradeResult>(0, result, message);
            }
            return new DosResultList<MicroiUpgradeResult>(1, result);
        }

        public sealed class MenuAppDisplayRow
        {
            public string Id { get; set; }
            public int? AppDisplay { get; set; }
        }

        private static bool IsOfficialWebsiteTenant(string osClient)
        {
            return string.Equals(osClient, "iTdos", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// 官网注册短信属于固定的匿名入口。iTdos 官方库曾因历史配置保留
        /// AllowAnonymous=0，导致每次发布后官网重新出现 NoAuth。这里把该契约放到
        /// 受分布式升级租约保护的启动不变量中，并同步清理所有接口引擎缓存别名。
        /// 仅作用于官方 iTdos，不改变客户租户对同名接口的自主配置。
        /// </summary>
        private async Task EnsureOfficialWebsitePublicApiEngineContractAsync(
            OsClientSecret osClientSecret)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            if (osClientSecret?.Db == null
                || !IsOfficialWebsiteTenant(osClientSecret.OsClient)
                || !TableExists(osClientSecret, "sys_apiengine")
                || !ColumnExists(osClientSecret, "sys_apiengine", "AllowAnonymous")
                || !ColumnExists(osClientSecret, "sys_apiengine", "StopHttp")
                || !ColumnExists(osClientSecret, "sys_apiengine", "IsEnable"))
            {
                return;
            }

            var dbType = osClientSecret.OsClientModel?["DbType"].Val<string>()
                ?? OsClientDefault.OsClientDbType;
            var quoteOpen = dbType == "SqlServer" ? "[" : "`";
            var quoteClose = dbType == "SqlServer" ? "]" : "`";
            var cache = MicroiEngine.CacheTenant.Cache(osClientSecret.OsClient);
            var repaired = 0;

            foreach (var apiEngineKey in OfficialWebsiteAnonymousApiEngineKeys)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                var row = osClientSecret.Db.FromSql($@"SELECT
                        {quoteOpen}Id{quoteClose},
                        {quoteOpen}ApiEngineKey{quoteClose},
                        {quoteOpen}ApiAddress{quoteClose},
                        {quoteOpen}AllowAnonymous{quoteClose},
                        {quoteOpen}StopHttp{quoteClose},
                        {quoteOpen}IsEnable{quoteClose}
                    FROM {quoteOpen}sys_apiengine{quoteClose}
                    WHERE {quoteOpen}ApiEngineKey{quoteClose}=@p0
                      AND ({quoteOpen}IsDeleted{quoteClose}=0 OR {quoteOpen}IsDeleted{quoteClose} IS NULL)")
                    .AddInParameter("p0", apiEngineKey)
                    .First<OfficialWebsiteApiEngineRow>();
                if (row == null || row.Id.DosIsNullOrWhiteSpace())
                {
                    continue;
                }

                if (row.AllowAnonymous != 1 || row.StopHttp != 0 || row.IsEnable != 1)
                {
                    var affected = osClientSecret.Db.FromSql($@"UPDATE {quoteOpen}sys_apiengine{quoteClose}
                            SET {quoteOpen}AllowAnonymous{quoteClose}=@p0,
                                {quoteOpen}StopHttp{quoteClose}=@p1,
                                {quoteOpen}IsEnable{quoteClose}=@p2
                            WHERE {quoteOpen}Id{quoteClose}=@p3")
                        .AddInParameter("p0", 1)
                        .AddInParameter("p1", 0)
                        .AddInParameter("p2", 1)
                        .AddInParameter("p3", row.Id)
                        .ExecuteNonQuery();
                    if (affected > 0)
                    {
                        repaired++;
                    }
                }

                foreach (var alias in new[] { row.Id, row.ApiEngineKey, row.ApiAddress })
                {
                    if (!alias.DosIsNullOrWhiteSpace())
                    {
                        await cache.RemoveAsync(
                            $"Microi:{osClientSecret.OsClient}:FormData:sys_apiengine:{alias.ToLowerInvariant()}");
                    }
                }
            }

            if (repaired > 0)
            {
                Console.WriteLine(
                    $"Microi：【官网匿名接口修复】【{osClientSecret.OsClient}】已恢复 {repaired} 个注册入口的匿名 HTTP 契约。");
            }
        }

        private sealed class OfficialWebsiteApiEngineRow
        {
            public string Id { get; set; }
            public string ApiEngineKey { get; set; }
            public string ApiAddress { get; set; }
            public int? AllowAnonymous { get; set; }
            public int? StopHttp { get; set; }
            public int? IsEnable { get; set; }
        }

        private async Task EnsureApiEngineCacheWriteCompatibilityAsync(
            OsClientSecret osClientSecret,
            string stage)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            if (osClientSecret?.Db == null
                || !TableExists(osClientSecret, "diy_table")
                || !TableExists(osClientSecret, "sys_apiengine")
                || !ColumnExists(osClientSecret, "diy_table", "Name")
                || !ColumnExists(osClientSecret, "diy_table", "SubmitAfterServerV8"))
            {
                return;
            }

            var dbType = osClientSecret.OsClientModel?["DbType"].Val<string>()
                ?? OsClientDefault.OsClientDbType;
            var quoteOpen = dbType == "SqlServer" ? "[" : "`";
            var quoteClose = dbType == "SqlServer" ? "]" : "`";
            var table = osClientSecret.Db
                .FromSql($@"SELECT {quoteOpen}Id{quoteClose}, {quoteOpen}Name{quoteClose},
                        {quoteOpen}SubmitAfterServerV8{quoteClose}
                    FROM {quoteOpen}diy_table{quoteClose}
                    WHERE LOWER({quoteOpen}Name{quoteClose})=@p0")
                .AddInParameter("p0", "sys_apiengine")
                .First<ApiEngineDiyTableRow>();
            if (table == null || table.Id.DosIsNullOrWhiteSpace()
                || !ApiEngineCacheCompatibility.TryUpgradeEvent(
                    table.SubmitAfterServerV8,
                    out var compatibleCode))
            {
                return;
            }

            var oldCode = table.SubmitAfterServerV8 ?? "";
            var affected = osClientSecret.Db
                .FromSql($@"UPDATE {quoteOpen}diy_table{quoteClose}
                    SET {quoteOpen}SubmitAfterServerV8{quoteClose}=@p0
                    WHERE {quoteOpen}Id{quoteClose}=@p1
                      AND ({quoteOpen}SubmitAfterServerV8{quoteClose}=@p2
                           OR ({quoteOpen}SubmitAfterServerV8{quoteClose} IS NULL AND @p2=''))")
                .AddInParameter("p0", compatibleCode)
                .AddInParameter("p1", table.Id)
                .AddInParameter("p2", oldCode)
                .ExecuteNonQuery();
            if (affected == 0)
            {
                var reread = osClientSecret.Db
                    .FromSql($@"SELECT {quoteOpen}Id{quoteClose}, {quoteOpen}Name{quoteClose},
                            {quoteOpen}SubmitAfterServerV8{quoteClose}
                        FROM {quoteOpen}diy_table{quoteClose}
                        WHERE {quoteOpen}Id{quoteClose}=@p0")
                    .AddInParameter("p0", table.Id)
                    .First<ApiEngineDiyTableRow>();
                if (reread == null
                    || ApiEngineCacheCompatibility.TryUpgradeEvent(
                        reread.SubmitAfterServerV8,
                        out _))
                {
                    throw new InvalidOperationException(
                        "sys_apiengine SubmitAfterServerV8发生并发修改，请合并后重试。");
                }
            }

            var cache = MicroiEngine.CacheTenant.Cache(osClientSecret.OsClient);
            await cache.RemoveAsync(
                $"Microi:{osClientSecret.OsClient}:FormData:diy_table:{table.Id.ToLowerInvariant()}");
            await cache.RemoveAsync(
                $"Microi:{osClientSecret.OsClient}:FormData:diy_table:sys_apiengine");
            var rebuiltAliases = await RebuildLegacyCompatibleApiEngineCacheAsync(
                osClientSecret.OsClient);
            Console.WriteLine(
                $"Microi：【接口引擎缓存兼容修复】【{osClientSecret.OsClient}】【{stage}】" +
                $"已恢复v3/v6共享JSON写入契约，并重建{rebuiltAliases}个缓存别名。");
        }

        private static async Task<int> RebuildLegacyCompatibleApiEngineCacheAsync(
            string osClient)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            var listResult = await MicroiEngine.FormEngine.GetTableDataAsync(new
            {
                FormEngineKey = "sys_apiengine",
                OsClient = osClient,
                _PageIndex = 1,
                _PageSize = 100000
            });
            if (listResult.Code != 1)
            {
                throw new InvalidOperationException(
                    "读取接口引擎以重建兼容缓存失败：" + listResult.Msg);
            }

            var aliases = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            if (listResult.Data != null)
            {
                foreach (var item in listResult.Data)
                {
                    UpgradeExecutionLeaseContext.ThrowIfLost();
                    var model = JObject.FromObject((object)item);
                    var json = JsonConvert.SerializeObject((object)item);
                    foreach (var alias in new[]
                    {
                        model.Value<string>("ApiEngineKey"),
                        model.Value<string>("Id"),
                        model.Value<string>("ApiAddress")
                    })
                    {
                        if (!alias.DosIsNullOrWhiteSpace())
                        {
                            aliases[alias.ToLowerInvariant()] = json;
                        }
                    }
                }
            }

            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            await cache.RemoveParentAsync(
                $"Microi:{osClient}:FormData:sys_apiengine:*");
            var pending = new List<Task<bool>>(64);
            foreach (var alias in aliases)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                pending.Add(cache.SetAsync(
                    $"Microi:{osClient}:FormData:sys_apiengine:{alias.Key}",
                    alias.Value));
                if (pending.Count < 64) continue;

                await Task.WhenAll(pending);
                pending.Clear();
            }
            if (pending.Count > 0)
            {
                await Task.WhenAll(pending);
            }
            return aliases.Count;
        }

        public sealed class ApiEngineDiyTableRow
        {
            public string Id { get; set; }
            public string Name { get; set; }
            public string SubmitAfterServerV8 { get; set; }
        }

        private static readonly IReadOnlyDictionary<string, string> LegacyMenuConfigColumnTypes =
            new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["SelectApi"] = "varchar(255)",
                ["AddBtnText"] = "varchar(25)",
                ["SaveBtnText"] = "varchar(25)",
                ["AddBtnType"] = "varchar(50)",
                ["SaveType"] = "varchar(50)",
                ["HiddenIndex"] = "int",
                ["GeneralSeaarch"] = "int",
                ["ImportApi"] = "varchar(255)",
                ["ImportProgressApi"] = "varchar(255)",
                ["ExportApi"] = "varchar(255)"
            };

        private const string LegacyMenuConfigV8Marker = "MICROI_LEGACY_DIYCONFIG_SYNC_V1";

        private const string LegacyMenuConfigV8 = """

// MICROI_LEGACY_DIYCONFIG_SYNC_V1
// v3 writes sys_menu.DiyConfig while v6 writes physical columns. Keep both
// representations in one shared table event so rolling old/new API nodes agree.
var _microiLegacyMenuFields = [
  "SelectApi", "AddBtnText", "SaveBtnText", "AddBtnType", "SaveType",
  "HiddenIndex", "GeneralSeaarch", "ImportApi", "ImportProgressApi", "ExportApi"
];
var _microiLegacyMenuHasOwn = function (obj, key) {
  return obj && Object.prototype.hasOwnProperty.call(obj, key);
};
var _microiLegacyMenuParse = function (value) {
  if (!value) return {};
  if (typeof value == "object") return value;
  try {
    var parsed = JSON.parse(String(value));
    return parsed && typeof parsed == "object" ? parsed : {};
  } catch (error) {
    return {};
  }
};
var _microiLegacyMenuValue = function (value) {
  return value === null || value === undefined ? "" : String(value);
};
var _microiLegacyMenuConfig = _microiLegacyMenuParse(V8.Form.DiyConfig);
var _microiLegacyMenuOldConfig = _microiLegacyMenuParse(V8.OldForm && V8.OldForm.DiyConfig);
var _microiLegacyMenuConfigChanged = false;
var _microiLegacyMenuConflict = "";
for (var _microiLegacyMenuIndex = 0; _microiLegacyMenuIndex < _microiLegacyMenuFields.length; _microiLegacyMenuIndex++) {
  var _microiLegacyMenuField = _microiLegacyMenuFields[_microiLegacyMenuIndex];
  var _microiLegacyMenuPhysicalPresent = _microiLegacyMenuHasOwn(V8.Form, _microiLegacyMenuField);
  var _microiLegacyMenuConfigPresent = _microiLegacyMenuHasOwn(_microiLegacyMenuConfig, _microiLegacyMenuField);
  var _microiLegacyMenuOldPhysical = V8.OldForm ? V8.OldForm[_microiLegacyMenuField] : undefined;
  var _microiLegacyMenuPhysicalChanged = _microiLegacyMenuPhysicalPresent
    && _microiLegacyMenuValue(V8.Form[_microiLegacyMenuField]) != _microiLegacyMenuValue(_microiLegacyMenuOldPhysical);
  var _microiLegacyMenuConfigChangedOne = _microiLegacyMenuHasOwn(V8.Form, "DiyConfig")
    && _microiLegacyMenuConfigPresent
    && _microiLegacyMenuValue(_microiLegacyMenuConfig[_microiLegacyMenuField])
       != _microiLegacyMenuValue(_microiLegacyMenuOldConfig[_microiLegacyMenuField]);

  if (_microiLegacyMenuPhysicalChanged && _microiLegacyMenuConfigChangedOne
      && _microiLegacyMenuValue(V8.Form[_microiLegacyMenuField])
         != _microiLegacyMenuValue(_microiLegacyMenuConfig[_microiLegacyMenuField])) {
    _microiLegacyMenuConflict = _microiLegacyMenuField;
    break;
  }
  if (_microiLegacyMenuConfigChangedOne && !_microiLegacyMenuPhysicalChanged) {
    V8.Form[_microiLegacyMenuField] = _microiLegacyMenuConfig[_microiLegacyMenuField];
  } else if (_microiLegacyMenuPhysicalChanged) {
    _microiLegacyMenuConfig[_microiLegacyMenuField] = V8.Form[_microiLegacyMenuField];
    _microiLegacyMenuConfigChanged = true;
  } else if (!_microiLegacyMenuPhysicalPresent && _microiLegacyMenuConfigPresent) {
    V8.Form[_microiLegacyMenuField] = _microiLegacyMenuConfig[_microiLegacyMenuField];
  } else if (!_microiLegacyMenuConfigPresent && _microiLegacyMenuPhysicalPresent) {
    _microiLegacyMenuConfig[_microiLegacyMenuField] = V8.Form[_microiLegacyMenuField];
    _microiLegacyMenuConfigChanged = true;
  }
}
if (_microiLegacyMenuConflict) {
  return {
    Code: 0,
    Msg: "菜单兼容配置冲突：" + _microiLegacyMenuConflict
      + " 的DiyConfig与物理字段在同一次提交中被改成不同值，请合并后重试。"
  };
}
if (_microiLegacyMenuConfigChanged) {
  V8.Form.DiyConfig = JSON.stringify(_microiLegacyMenuConfig);
}
""";

        private async Task EnsureLegacyMenuDiyConfigCompatibilityAsync(OsClientSecret osClientSecret)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            if (osClientSecret?.Db == null || !TableExists(osClientSecret, "sys_menu"))
            {
                return;
            }

            var dbType = osClientSecret.OsClientModel?["DbType"].Val<string>() ?? OsClientDefault.OsClientDbType;
            var quoteOpen = dbType == "SqlServer" ? "[" : "`";
            var quoteClose = dbType == "SqlServer" ? "]" : "`";
            EnsureColumn(osClientSecret, "sys_menu", "DiyConfig", dbType == "SqlServer" ? "nvarchar(max)" : "mediumtext");
            foreach (var column in LegacyMenuConfigColumnTypes)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                EnsureColumn(osClientSecret, "sys_menu", column.Key, column.Value);
            }

            var selectColumns = new[] { "Id", "DiyConfig" }
                .Concat(LegacyMenuConfigColumnTypes.Keys)
                .Select(name => $"{quoteOpen}{name}{quoteClose}");
            var rows = osClientSecret.Db
                .FromSql($"SELECT {string.Join(", ", selectColumns)} FROM {quoteOpen}sys_menu{quoteClose}")
                .ToList<LegacyMenuConfigRow>();
            var migratedRows = 0;
            var conflictRows = 0;

            foreach (var row in rows)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                if (row == null || row.Id.DosIsNullOrWhiteSpace()) continue;

                JObject config;
                if (row.DiyConfig.DosIsNullOrWhiteSpace())
                {
                    config = new JObject();
                }
                else
                {
                    try
                    {
                        config = JObject.Parse(row.DiyConfig);
                    }
                    catch
                    {
                        Console.WriteLine($"Microi：【Warning】【{osClientSecret.OsClient}】sys_menu[{row.Id}] DiyConfig不是合法JSON，已保留原文并跳过自动迁移。");
                        continue;
                    }
                }

                var updates = new Dictionary<string, object>(StringComparer.OrdinalIgnoreCase);
                var configChanged = false;
                foreach (var field in LegacyMenuConfigColumnTypes.Keys)
                {
                    var physicalValue = GetLegacyMenuPhysicalValue(row, field);
                    var configValue = config[field];
                    var physicalPresent = IsLegacyMenuValuePresent(physicalValue);
                    var configPresent = IsLegacyMenuValuePresent(configValue);
                    if (!physicalPresent && configPresent)
                    {
                        updates[field] = ConvertLegacyMenuDatabaseValue(field, configValue);
                    }
                    else if (physicalPresent && !configPresent)
                    {
                        config[field] = physicalValue.DeepClone();
                        configChanged = true;
                    }
                    else if (physicalPresent && configPresent
                        && !LegacyMenuValuesEqual(physicalValue, configValue))
                    {
                        // 无字段级更新时间时不能可靠判断谁最后修改。保留双方并告警，
                        // 后续任一端真实修改时由共享V8事件按旧值判定并完成双写。
                        conflictRows++;
                        Console.WriteLine($"Microi：【Warning】【{osClientSecret.OsClient}】sys_menu[{row.Id}].{field} 的DiyConfig与物理列不一致，已保留双方等待显式修改合并。");
                    }
                }
                if (configChanged)
                {
                    updates["DiyConfig"] = config.ToString(Formatting.None);
                }
                if (updates.Count == 0) continue;

                var assignments = new List<string>();
                var parameterIndex = 0;
                foreach (var update in updates)
                {
                    assignments.Add($"{quoteOpen}{update.Key}{quoteClose}=@p{parameterIndex}");
                    parameterIndex++;
                }
                var sql = $@"UPDATE {quoteOpen}sys_menu{quoteClose}
                    SET {string.Join(", ", assignments)}
                    WHERE {quoteOpen}Id{quoteClose}=@p{parameterIndex}";
                var command = osClientSecret.Db.FromSql(sql);
                parameterIndex = 0;
                foreach (var update in updates)
                {
                    command.AddInParameter($"p{parameterIndex}", update.Value);
                    parameterIndex++;
                }
                command.AddInParameter($"p{parameterIndex}", row.Id).ExecuteNonQuery();
                migratedRows++;
            }

            await EnsureLegacyMenuConfigV8EventAsync(osClientSecret, quoteOpen, quoteClose);
            if (migratedRows > 0 || conflictRows > 0)
            {
                Console.WriteLine($"Microi：【成功】【{osClientSecret.OsClient}】sys_menu旧新配置兼容检查完成：迁移{migratedRows}行，保留并报告冲突{conflictRows}项。");
            }
        }

        private async Task EnsureLegacyMenuConfigV8EventAsync(
            OsClientSecret osClientSecret,
            string quoteOpen,
            string quoteClose)
        {
            if (!TableExists(osClientSecret, "diy_table")
                || !ColumnExists(osClientSecret, "diy_table", "SubmitBeforeServerV8")
                || !ColumnExists(osClientSecret, "diy_table", "Name"))
            {
                return;
            }

            var table = osClientSecret.Db
                .FromSql($@"SELECT {quoteOpen}Id{quoteClose}, {quoteOpen}Name{quoteClose},
                        {quoteOpen}SubmitBeforeServerV8{quoteClose}
                    FROM {quoteOpen}diy_table{quoteClose}
                    WHERE LOWER({quoteOpen}Name{quoteClose})=@p0")
                .AddInParameter("p0", "sys_menu")
                .First<LegacyMenuDiyTableRow>();
            if (table == null || table.Id.DosIsNullOrWhiteSpace()
                || (table.SubmitBeforeServerV8 ?? "").Contains(LegacyMenuConfigV8Marker))
            {
                return;
            }

            var oldCode = table.SubmitBeforeServerV8 ?? "";
            var newCode = oldCode.TrimEnd() + LegacyMenuConfigV8;
            var affected = osClientSecret.Db
                .FromSql($@"UPDATE {quoteOpen}diy_table{quoteClose}
                    SET {quoteOpen}SubmitBeforeServerV8{quoteClose}=@p0
                    WHERE {quoteOpen}Id{quoteClose}=@p1
                      AND ({quoteOpen}SubmitBeforeServerV8{quoteClose}=@p2
                           OR ({quoteOpen}SubmitBeforeServerV8{quoteClose} IS NULL AND @p2=''))")
                .AddInParameter("p0", newCode)
                .AddInParameter("p1", table.Id)
                .AddInParameter("p2", oldCode)
                .ExecuteNonQuery();
            if (affected == 0)
            {
                var reread = osClientSecret.Db
                    .FromSql($@"SELECT {quoteOpen}Id{quoteClose}, {quoteOpen}Name{quoteClose},
                            {quoteOpen}SubmitBeforeServerV8{quoteClose}
                        FROM {quoteOpen}diy_table{quoteClose}
                        WHERE {quoteOpen}Id{quoteClose}=@p0")
                    .AddInParameter("p0", table.Id)
                    .First<LegacyMenuDiyTableRow>();
                if (reread == null || !(reread.SubmitBeforeServerV8 ?? "").Contains(LegacyMenuConfigV8Marker))
                {
                    throw new InvalidOperationException("sys_menu SubmitBeforeServerV8发生并发修改，请合并后重试。");
                }
            }

            var cache = MicroiEngine.CacheTenant.Cache(osClientSecret.OsClient);
            await cache.RemoveAsync($"Microi:{osClientSecret.OsClient}:FormData:diy_table:{table.Id.ToLowerInvariant()}");
            await cache.RemoveAsync($"Microi:{osClientSecret.OsClient}:FormData:diy_table:sys_menu");
        }

        private static JToken GetLegacyMenuPhysicalValue(LegacyMenuConfigRow row, string field)
        {
            object value = field switch
            {
                "SelectApi" => row.SelectApi,
                "AddBtnText" => row.AddBtnText,
                "SaveBtnText" => row.SaveBtnText,
                "AddBtnType" => row.AddBtnType,
                "SaveType" => row.SaveType,
                "HiddenIndex" => row.HiddenIndex,
                "GeneralSeaarch" => row.GeneralSeaarch,
                "ImportApi" => row.ImportApi,
                "ImportProgressApi" => row.ImportProgressApi,
                "ExportApi" => row.ExportApi,
                _ => null
            };
            return value == null ? null : JToken.FromObject(value);
        }

        private static bool IsLegacyMenuValuePresent(JToken value)
        {
            return value != null
                && value.Type != JTokenType.Null
                && (value.Type != JTokenType.String || !value.Val<string>().DosIsNullOrWhiteSpace());
        }

        private static bool LegacyMenuValuesEqual(JToken left, JToken right)
        {
            var leftText = left?.Type == JTokenType.String ? left.Val<string>() : left?.ToString(Formatting.None);
            var rightText = right?.Type == JTokenType.String ? right.Val<string>() : right?.ToString(Formatting.None);
            return string.Equals(leftText ?? "", rightText ?? "", StringComparison.Ordinal);
        }

        private static object ConvertLegacyMenuDatabaseValue(string field, JToken value)
        {
            if (field == "HiddenIndex" || field == "GeneralSeaarch")
            {
                return value.Val<int?>();
            }
            return value.Val<string>();
        }

        public sealed class LegacyMenuConfigRow
        {
            public string Id { get; set; }
            public string DiyConfig { get; set; }
            public string SelectApi { get; set; }
            public string AddBtnText { get; set; }
            public string SaveBtnText { get; set; }
            public string AddBtnType { get; set; }
            public string SaveType { get; set; }
            public int? HiddenIndex { get; set; }
            public int? GeneralSeaarch { get; set; }
            public string ImportApi { get; set; }
            public string ImportProgressApi { get; set; }
            public string ExportApi { get; set; }
        }

        public sealed class LegacyMenuDiyTableRow
        {
            public string Id { get; set; }
            public string Name { get; set; }
            public string SubmitBeforeServerV8 { get; set; }
        }

        private void EnsureMobileVisibilityColumns(OsClientSecret osClientSecret)
        {
            if (osClientSecret?.Db == null) throw new InvalidOperationException("租户数据库连接不存在。");
            var dbType = osClientSecret.OsClientModel?["DbType"].Val<string>() ?? OsClientDefault.OsClientDbType;
            var quoteOpen = dbType == "SqlServer" ? "[" : "`";
            var quoteClose = dbType == "SqlServer" ? "]" : "`";

            if (TableExists(osClientSecret, "diy_field"))
            {
                EnsureColumn(osClientSecret, "diy_field", "AppVisible", "int");
                var sourceExpression = ColumnExists(osClientSecret, "diy_field", "Visible")
                    ? $"CASE WHEN {quoteOpen}Visible{quoteClose}=0 THEN 0 ELSE 1 END"
                    : "1";
                osClientSecret.Db.FromSql($@"UPDATE {quoteOpen}diy_field{quoteClose}
                    SET {quoteOpen}AppVisible{quoteClose}={sourceExpression}
                    WHERE {quoteOpen}AppVisible{quoteClose} IS NULL").ExecuteNonQuery();
            }

            if (TableExists(osClientSecret, "sys_menu"))
            {
                EnsureColumn(osClientSecret, "sys_menu", "AppDisplay", "int");
                var sourceExpression = ColumnExists(osClientSecret, "sys_menu", "Display")
                    ? $"CASE WHEN {quoteOpen}Display{quoteClose}=0 THEN 0 ELSE 1 END"
                    : "1";
                osClientSecret.Db.FromSql($@"UPDATE {quoteOpen}sys_menu{quoteClose}
                    SET {quoteOpen}AppDisplay{quoteClose}={sourceExpression}
                    WHERE {quoteOpen}AppDisplay{quoteClose} IS NULL").ExecuteNonQuery();
            }
        }

        private void EnsureModuleViewSchemaColumns(OsClientSecret osClientSecret)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            if (osClientSecret?.Db == null) throw new InvalidOperationException("租户数据库连接不存在。");
            if (!TableExists(osClientSecret, "sys_menu"))
            {
                return;
            }

            var dbType = osClientSecret.OsClientModel?["DbType"].Val<string>() ?? OsClientDefault.OsClientDbType;
            var quoteOpen = dbType == "SqlServer" ? "[" : "`";
            var quoteClose = dbType == "SqlServer" ? "]" : "`";
            var jsonType = dbType == "SqlServer" ? "nvarchar(max)" : "mediumtext";

            EnsureColumn(osClientSecret, "sys_menu", "EnableViewSchema", "int");
            EnsureColumn(osClientSecret, "sys_menu", "ViewSchemaVersion", "varchar(25)");
            EnsureColumn(osClientSecret, "sys_menu", "ViewConfigVersion", "int");
            EnsureColumn(osClientSecret, "sys_menu", "ViewSchema", jsonType);

            osClientSecret.Db.FromSql($@"UPDATE {quoteOpen}sys_menu{quoteClose}
                    SET {quoteOpen}EnableViewSchema{quoteClose}=0
                    WHERE {quoteOpen}EnableViewSchema{quoteClose} IS NULL")
                .ExecuteNonQuery();
            osClientSecret.Db.FromSql($@"UPDATE {quoteOpen}sys_menu{quoteClose}
                    SET {quoteOpen}ViewSchemaVersion{quoteClose}='1.0'
                    WHERE {quoteOpen}ViewSchemaVersion{quoteClose} IS NULL
                       OR {quoteOpen}ViewSchemaVersion{quoteClose}=''")
                .ExecuteNonQuery();
            osClientSecret.Db.FromSql($@"UPDATE {quoteOpen}sys_menu{quoteClose}
                    SET {quoteOpen}ViewConfigVersion{quoteClose}=1
                    WHERE {quoteOpen}ViewConfigVersion{quoteClose} IS NULL
                       OR {quoteOpen}ViewConfigVersion{quoteClose}<1")
                .ExecuteNonQuery();
        }

        private void EnsureApiEngineRuntimeColumns(OsClientSecret osClientSecret)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            if (osClientSecret?.Db == null) throw new InvalidOperationException("租户数据库连接不存在。");
            if (!TableExists(osClientSecret, "sys_apiengine"))
            {
                return;
            }

            // 升级13会先读取并调整这些运行限额，再安装应用商城包。很老的数据库
            // 可能已有对应 diy_field 元数据但物理列尚未创建，FormEngine 会因此在
            // 应用商城菜单落库前直接报 Unknown column。
            var columns = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["StopHttp"] = "int",
                ["Timeout"] = "int",
                ["MaxStatements"] = "int",
                ["LimitMemory"] = "int",
                ["LimitRecursion"] = "int",
                ["Lock"] = "int"
            };

            foreach (var column in columns)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                EnsureColumn(osClientSecret, "sys_apiengine", column.Key, column.Value);
            }
        }

        private void EnsureLegacyFieldMetadataColumns(OsClientSecret osClientSecret)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            if (osClientSecret?.Db == null) throw new InvalidOperationException("租户数据库连接不存在。");
            if (!TableExists(osClientSecret, "diy_field"))
            {
                return;
            }

            EnsureColumn(osClientSecret, "diy_field", "TableName", "varchar(50)");
            if (!TableExists(osClientSecret, "diy_table")
                || !ColumnExists(osClientSecret, "diy_field", "TableId")
                || !ColumnExists(osClientSecret, "diy_table", "Id")
                || !ColumnExists(osClientSecret, "diy_table", "Name"))
            {
                return;
            }

            UpgradeExecutionLeaseContext.ThrowIfLost();
            var dbType = osClientSecret.OsClientModel?["DbType"].Val<string>() ?? OsClientDefault.OsClientDbType;
            var sql = dbType == "SqlServer"
                ? @"UPDATE df
                    SET df.[TableName]=dt.[Name]
                    FROM [diy_field] df
                    INNER JOIN [diy_table] dt ON dt.[Id]=df.[TableId]
                    WHERE df.[TableName] IS NULL OR df.[TableName]=''"
                : @"UPDATE `diy_field` df
                    INNER JOIN `diy_table` dt ON dt.`Id`=df.`TableId`
                    SET df.`TableName`=dt.`Name`
                    WHERE df.`TableName` IS NULL OR df.`TableName`=''";
            osClientSecret.Db.FromSql(sql).ExecuteNonQuery();
        }

        private static readonly string ApiEngineLockFieldConfig = new JObject
        {
            ["V8Code"] = "if(V8.Form.Lock){\n  V8.FieldSet('LockKey', 'Visible', true);\n}else{\n  V8.FieldSet('LockKey', 'Visible', false);\n}"
        }.ToString(Formatting.None);

        /// <summary>
        /// 很老的数据库中 sys_apiengine 的多个字段元数据可能保存了双重 JSON，
        /// 或保存了未正确转义的 V8Code。新版前端会降级容错，但 Vue2 旧前端会
        /// 在遇到第一个损坏字段时直接中断整个接口引擎页面，因此必须一次扫描
        /// 全部字段，在数据库层恢复为新旧前端都能读取的明文 JSON。
        /// </summary>
        private async Task EnsureApiEngineFieldMetadataCompatibilityAsync(
            OsClientSecret osClientSecret,
            string phase)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            if (osClientSecret?.Db == null
                || !TableExists(osClientSecret, "diy_field")
                || !TableExists(osClientSecret, "diy_table")
                || !ColumnExists(osClientSecret, "diy_field", "Id")
                || !ColumnExists(osClientSecret, "diy_field", "TableId")
                || !ColumnExists(osClientSecret, "diy_field", "Name")
                || !ColumnExists(osClientSecret, "diy_field", "Config")
                || !ColumnExists(osClientSecret, "diy_table", "Id")
                || !ColumnExists(osClientSecret, "diy_table", "Name"))
            {
                Console.WriteLine(
                    $"Microi：【接口引擎字段Config兼容检查】【{osClientSecret?.OsClient ?? "unknown"}】【{phase}】已跳过：缺少必要的diy_table/diy_field表或字段。");
                return;
            }

            var dbType = osClientSecret.OsClientModel?["DbType"].Val<string>() ?? OsClientDefault.OsClientDbType;
            var quoteOpen = dbType == "SqlServer" ? "[" : "`";
            var quoteClose = dbType == "SqlServer" ? "]" : "`";
            var rows = osClientSecret.Db.FromSql($@"SELECT
                        df.{quoteOpen}Id{quoteClose} AS {quoteOpen}Id{quoteClose},
                        dt.{quoteOpen}Id{quoteClose} AS {quoteOpen}TableId{quoteClose},
                        df.{quoteOpen}Name{quoteClose} AS {quoteOpen}FieldName{quoteClose},
                        df.{quoteOpen}Config{quoteClose} AS {quoteOpen}Config{quoteClose}
                    FROM {quoteOpen}diy_table{quoteClose} dt
                    INNER JOIN {quoteOpen}diy_field{quoteClose} df
                        ON dt.{quoteOpen}Id{quoteClose}=df.{quoteOpen}TableId{quoteClose}
                    WHERE LOWER(dt.{quoteOpen}Name{quoteClose})=@p0")
                .AddInParameter("p0", "sys_apiengine")
                .ToList<ApiEngineFieldConfigRow>();

            var targetTableIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var matchedFields = 0;
            var repairedFields = 0;
            var fallbackFields = 0;
            var verifiedFields = 0;
            var concurrentFields = 0;
            var blankConfigFields = 0;
            var unrecoverableFields = new List<string>();
            foreach (var row in rows)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                if (!string.IsNullOrWhiteSpace(row.TableId))
                {
                    targetTableIds.Add(row.TableId);
                }
                if (string.IsNullOrWhiteSpace(row.Id))
                {
                    continue;
                }

                matchedFields++;
                var original = row.Config ?? "";
                var fieldName = string.IsNullOrWhiteSpace(row.FieldName) ? row.Id : row.FieldName;
                if (string.IsNullOrWhiteSpace(original))
                {
                    // 历史前端只在 Config 有值时 JSON.parse；空配置本身合法，不能
                    // 为了统一格式擅自写成 {}，否则会改变字段默认行为。
                    blankConfigFields++;
                    continue;
                }
                string compatibleConfig;
                string repairType;
                if (TryNormalizeLegacyFieldConfigCore(
                    original,
                    out var normalized,
                    out repairType))
                {
                    if (string.Equals(original, normalized, StringComparison.Ordinal))
                    {
                        if (!IsBrowserStrictJsonObject(original))
                        {
                            throw new InvalidOperationException(
                                $"sys_apiengine.{fieldName} 字段Config仍不是浏览器可解析的严格JSON，FieldId={row.Id}。");
                        }
                        verifiedFields++;
                        continue;
                    }
                    compatibleConfig = normalized;
                }
                else
                {
                    // Lock 是平台固定字段，有确定的标准配置可安全兜底。其它字段的
                    // Config 可能包含数据源、选项和业务 V8，不能用 {} 或 Lock 配置
                    // 覆盖；记录后继续修复其余字段，最后清缓存并明确停止升级。
                    if (string.Equals(fieldName, "Lock", StringComparison.OrdinalIgnoreCase))
                    {
                        compatibleConfig = ApiEngineLockFieldConfig;
                        repairType = "恢复标准配置";
                        fallbackFields++;
                    }
                    else
                    {
                        unrecoverableFields.Add($"{fieldName}(FieldId={row.Id})");
                        continue;
                    }
                }

                if (!IsBrowserStrictJsonObject(compatibleConfig))
                {
                    throw new InvalidOperationException(
                        $"sys_apiengine.{fieldName} 字段Config修复结果不是浏览器可解析的严格JSON，FieldId={row.Id}。");
                }

                var affected = osClientSecret.Db.FromSql($@"UPDATE {quoteOpen}diy_field{quoteClose}
                        SET {quoteOpen}Config{quoteClose}=@p0
                        WHERE {quoteOpen}Id{quoteClose}=@p1
                          AND ({quoteOpen}Config{quoteClose}=@p2
                               OR ({quoteOpen}Config{quoteClose} IS NULL AND @p2=''))")
                    .AddInParameter("p0", compatibleConfig)
                    .AddInParameter("p1", row.Id)
                    .AddInParameter("p2", original)
                    .ExecuteNonQuery();
                if (affected > 0)
                {
                    repairedFields++;
                    Console.WriteLine(
                        $"Microi：【兼容修复】平台自动升级【{osClientSecret.OsClient}】已{repairType} sys_apiengine.{fieldName} 的字段Config。");
                }
                else
                {
                    concurrentFields++;
                }

                // 不能只相信 ExecuteNonQuery 的返回值。立即从共享数据库回读，并按
                // 浏览器 JSON.parse 的严格语法复验；这样多节点或并发修改时也不会
                // 输出“已检查”却把旧前端仍无法解析的值留在库里。
                var persistedRows = osClientSecret.Db.FromSql($@"SELECT
                            {quoteOpen}Id{quoteClose} AS {quoteOpen}Id{quoteClose},
                            {quoteOpen}Config{quoteClose} AS {quoteOpen}Config{quoteClose}
                        FROM {quoteOpen}diy_field{quoteClose}
                        WHERE {quoteOpen}Id{quoteClose}=@p0")
                    .AddInParameter("p0", row.Id)
                    .ToList<ApiEngineFieldConfigRow>();
                var persisted = persistedRows.FirstOrDefault();
                if (persisted == null || !IsBrowserStrictJsonObject(persisted.Config))
                {
                    throw new InvalidOperationException(
                        $"sys_apiengine.{fieldName} 字段Config写入后回读校验失败，FieldId={row.Id}。已停止升级，避免旧前端继续读取损坏配置。");
                }
                verifiedFields++;
            }

            // 无论数据库是否发生变化，都删除“表名”和“表Id”两种历史 Key。
            // 数据库已修复但 Redis 仍保留旧值时，旧版 API 仍会继续解析失败。
            // 共享 Redis 删除后，新版两级缓存通过失效通知清理其它节点的本机副本；
            // 旧版 API 也会在下一次请求时从数据库重新构建字段列表。
            var cache = MicroiEngine.CacheTenant.Cache(osClientSecret.OsClient);
            await cache.RemoveAsync(
                $"Microi:{osClientSecret.OsClient}:FormData:diy_table_field_list:sys_apiengine");
            foreach (var tableId in targetTableIds)
            {
                await cache.RemoveAsync(
                    $"Microi:{osClientSecret.OsClient}:FormData:diy_table_field_list:{tableId.ToLowerInvariant()}");
            }

            var fieldStatus = matchedFields == 0
                ? "未找到sys_apiengine字段元数据"
                : $"匹配{matchedFields}条，空配置跳过{blankConfigFields}条，修复{repairedFields}条，标准兜底{fallbackFields}条，严格回读通过{verifiedFields}条，并发跳过{concurrentFields}条，无法无损恢复{unrecoverableFields.Count}条";
            Console.WriteLine(
                $"Microi：【接口引擎字段Config兼容检查】【{osClientSecret.OsClient}】【{phase}】{fieldStatus}；已清理字段列表共享缓存{targetTableIds.Count + 1}个。");

            if (unrecoverableFields.Count > 0)
            {
                throw new InvalidOperationException(
                    "以下sys_apiengine字段Config无法无损恢复，已保留原值："
                    + string.Join("、", unrecoverableFields)
                    + "。请修复源配置后重试，升级器不会用空对象覆盖客户配置。");
            }
        }

        private static bool TryNormalizeLegacyFieldConfig(string config, out string normalized)
        {
            return TryNormalizeLegacyFieldConfigCore(config, out normalized, out _);
        }

        private static bool TryNormalizeLegacyFieldConfigCore(
            string config,
            out string normalized,
            out string repairType)
        {
            normalized = "";
            repairType = "";
            if (string.IsNullOrWhiteSpace(config))
            {
                return false;
            }

            // 某些新版本写入老数据库时，Config.V8Code、Config.Sql 等字符串属性中
            // 的换行、制表符被直接写进了 JSON 字符串。浏览器 JSON.parse 会因此报
            // Bad control character。只转义字符串字面量内部的非法控制字符，保留对象其余配置；
            // 对象外的格式化换行属于合法 JSON 空白，不能一并替换。必须在调用
            // Newtonsoft 解析前执行，因为 Newtonsoft 会宽松接受浏览器拒绝的裸换行。
            if (TryEscapeJsonStringControlCharacters(config, out var escapedControlCharacters)
                && TryReadFieldConfigObject(
                    escapedControlCharacters,
                    out var configObject,
                    out _))
            {
                normalized = configObject.ToString(Formatting.None);
                if (IsBrowserStrictJsonObject(normalized))
                {
                    repairType = "转义Config字符串控制字符";
                    return true;
                }
                normalized = "";
            }

            if (TryReadFieldConfigObject(config, out configObject, out var wasWrapped))
            {
                if (!wasWrapped && IsBrowserStrictJsonObject(config))
                {
                    normalized = config;
                    repairType = "无需修复";
                    return true;
                }

                normalized = configObject.ToString(Formatting.None);
                if (IsBrowserStrictJsonObject(normalized))
                {
                    repairType = wasWrapped ? "解包双重序列化" : "规范化非标准JSON";
                    return true;
                }
                normalized = "";
            }

            // 与 Vue2 历史容错保持一致，但只在替换后确实能解析为 JObject 时采用，
            // 避免盲目改变合法 V8Code 中的反斜杠语义。控制字符修复必须优先，
            // 否则同时含路径反斜杠和真实换行的配置会被过度反转义。
            var deescaped = config.Replace("\\\\", "\\");
            if (!string.Equals(deescaped, config, StringComparison.Ordinal)
                && TryReadFieldConfigObject(deescaped, out configObject, out _))
            {
                normalized = configObject.ToString(Formatting.None);
                if (IsBrowserStrictJsonObject(normalized))
                {
                    repairType = "修复多余反斜杠";
                    return true;
                }
                normalized = "";
            }
            return false;
        }

        private static bool IsBrowserStrictJsonObject(string json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return false;
            }

            try
            {
                using var document = System.Text.Json.JsonDocument.Parse(
                    json,
                    new System.Text.Json.JsonDocumentOptions
                    {
                        AllowTrailingCommas = false,
                        CommentHandling = System.Text.Json.JsonCommentHandling.Disallow
                    });
                return document.RootElement.ValueKind == System.Text.Json.JsonValueKind.Object;
            }
            catch (System.Text.Json.JsonException)
            {
                return false;
            }
            catch (ArgumentException)
            {
                return false;
            }
        }

        private static bool TryEscapeJsonStringControlCharacters(
            string json,
            out string escapedJson)
        {
            escapedJson = json;
            var changed = false;
            var inString = false;
            var escaped = false;
            var builder = new System.Text.StringBuilder(json.Length + 16);

            foreach (var character in json)
            {
                if (!inString)
                {
                    builder.Append(character);
                    if (character == '"')
                    {
                        inString = true;
                    }
                    continue;
                }

                if (escaped)
                {
                    builder.Append(character);
                    escaped = false;
                    continue;
                }

                if (character == '\\')
                {
                    builder.Append(character);
                    escaped = true;
                    continue;
                }

                if (character == '"')
                {
                    builder.Append(character);
                    inString = false;
                    continue;
                }

                if (character >= ' ')
                {
                    builder.Append(character);
                    continue;
                }

                changed = true;
                switch (character)
                {
                    case '\b': builder.Append("\\b"); break;
                    case '\f': builder.Append("\\f"); break;
                    case '\n': builder.Append("\\n"); break;
                    case '\r': builder.Append("\\r"); break;
                    case '\t': builder.Append("\\t"); break;
                    default:
                        builder.Append("\\u");
                        builder.Append(((int)character).ToString("x4"));
                        break;
                }
            }

            if (!changed)
            {
                return false;
            }

            escapedJson = builder.ToString();
            return true;
        }

        private static bool TryReadFieldConfigObject(
            string config,
            out JObject configObject,
            out bool wasWrapped)
        {
            configObject = null;
            wasWrapped = false;
            try
            {
                JToken token = JToken.Parse(config);
                for (var depth = 0; depth < 3 && token.Type == JTokenType.String; depth++)
                {
                    var inner = token.Value<string>();
                    if (string.IsNullOrWhiteSpace(inner))
                    {
                        return false;
                    }
                    token = JToken.Parse(inner);
                    wasWrapped = true;
                }

                configObject = token as JObject;
                return configObject != null;
            }
            catch (JsonException)
            {
                return false;
            }
        }

        private sealed class ApiEngineFieldConfigRow
        {
            public string Id { get; set; }
            public string TableId { get; set; }
            public string FieldName { get; set; }
            public string Config { get; set; }
        }

        private Dictionary<string, int> CaptureMenuAppDisplaySnapshot(OsClientSecret osClientSecret)
        {
            if (!TableExists(osClientSecret, "sys_menu") || !ColumnExists(osClientSecret, "sys_menu", "AppDisplay"))
            {
                return new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
            }

            var dbType = osClientSecret.OsClientModel?["DbType"].Val<string>() ?? OsClientDefault.OsClientDbType;
            var quoteOpen = dbType == "SqlServer" ? "[" : "`";
            var quoteClose = dbType == "SqlServer" ? "]" : "`";
            var rows = osClientSecret.Db.FromSql($@"SELECT {quoteOpen}Id{quoteClose}, {quoteOpen}AppDisplay{quoteClose}
                    FROM {quoteOpen}sys_menu{quoteClose}
                    WHERE {quoteOpen}IsDeleted{quoteClose}=0 OR {quoteOpen}IsDeleted{quoteClose} IS NULL")
                .ToList<MenuAppDisplayRow>();

            return rows
                .Where(row => !string.IsNullOrWhiteSpace(row.Id))
                .GroupBy(row => row.Id, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(group => group.Key, group => group.First().AppDisplay ?? 1, StringComparer.OrdinalIgnoreCase);
        }

        private async Task RestoreMenuAppDisplaySnapshotAsync(
            OsClientSecret osClientSecret,
            IReadOnlyDictionary<string, int> snapshot)
        {
            if (snapshot == null || snapshot.Count == 0) return;

            var dbType = osClientSecret.OsClientModel?["DbType"].Val<string>() ?? OsClientDefault.OsClientDbType;
            var quoteOpen = dbType == "SqlServer" ? "[" : "`";
            var quoteClose = dbType == "SqlServer" ? "]" : "`";
            var currentRows = osClientSecret.Db.FromSql($@"SELECT {quoteOpen}Id{quoteClose}, {quoteOpen}AppDisplay{quoteClose}
                    FROM {quoteOpen}sys_menu{quoteClose}
                    WHERE {quoteOpen}IsDeleted{quoteClose}=0 OR {quoteOpen}IsDeleted{quoteClose} IS NULL")
                .ToList<MenuAppDisplayRow>();
            var restoredIds = new List<string>();

            foreach (var row in currentRows)
            {
                if (string.IsNullOrWhiteSpace(row.Id)
                    || !snapshot.TryGetValue(row.Id, out var expectedValue)
                    || row.AppDisplay == expectedValue)
                {
                    continue;
                }

                osClientSecret.Db.FromSql($@"UPDATE {quoteOpen}sys_menu{quoteClose}
                        SET {quoteOpen}AppDisplay{quoteClose}=@p0
                        WHERE {quoteOpen}Id{quoteClose}=@p1")
                    .AddInParameter("p0", expectedValue)
                    .AddInParameter("p1", row.Id)
                    .ExecuteNonQuery();
                restoredIds.Add(row.Id);
            }

            if (restoredIds.Count == 0) return;

            var cache = MicroiEngine.CacheTenant.Cache(osClientSecret.OsClient);
            await cache.RemoveAsync($"Microi:{osClientSecret.OsClient}:FormData:sys_menu");
            foreach (var id in restoredIds)
            {
                await cache.RemoveAsync($"Microi:{osClientSecret.OsClient}:FormData:sys_menu:{id.ToLowerInvariant()}");
            }
            Console.WriteLine($"Microi：【保护】平台自动升级【{osClientSecret.OsClient}】已恢复 {restoredIds.Count} 个既有菜单的AppDisplay，升级包不得覆盖客户移动端显隐配置。");
        }

        private void EnsureSecurityLevels(OsClientSecret osClientSecret)
        {
            if (osClientSecret?.Db == null) throw new InvalidOperationException("租户数据库连接不存在。");
            var dbType = osClientSecret.OsClientModel?["DbType"].Val<string>() ?? OsClientDefault.OsClientDbType;
            var quoteOpen = dbType == "SqlServer" ? "[" : "`";
            var quoteClose = dbType == "SqlServer" ? "]" : "`";

            if (TableExists(osClientSecret, "sys_role"))
            {
                osClientSecret.Db.FromSql($"UPDATE {quoteOpen}sys_role{quoteClose} SET {quoteOpen}Level{quoteClose}=9999 WHERE {quoteOpen}Level{quoteClose}=999").ExecuteNonQuery();
                osClientSecret.Db.FromSql($"UPDATE {quoteOpen}sys_role{quoteClose} SET {quoteOpen}Level{quoteClose}=9998 WHERE {quoteOpen}Level{quoteClose}=998").ExecuteNonQuery();
            }
            if (TableExists(osClientSecret, "sys_user"))
            {
                osClientSecret.Db.FromSql($"UPDATE {quoteOpen}sys_user{quoteClose} SET {quoteOpen}Level{quoteClose}=9999 WHERE {quoteOpen}Level{quoteClose}=999").ExecuteNonQuery();
                osClientSecret.Db.FromSql($"UPDATE {quoteOpen}sys_user{quoteClose} SET {quoteOpen}Level{quoteClose}=9998 WHERE {quoteOpen}Level{quoteClose}=998").ExecuteNonQuery();
            }
            if (TableExists(osClientSecret, "sys_config") && ColumnExists(osClientSecret, "sys_config", "PwdEncode"))
            {
                osClientSecret.Db.FromSql($@"UPDATE {quoteOpen}sys_config{quoteClose}
                    SET {quoteOpen}PwdEncode{quoteClose}='DES'
                    WHERE {quoteOpen}PwdEncode{quoteClose} IS NULL
                       OR {quoteOpen}PwdEncode{quoteClose}=''
                       OR {quoteOpen}PwdEncode{quoteClose}='V8'").ExecuteNonQuery();
            }
        }

        private void EnsureMicroServiceColumns(OsClientSecret osClientSecret)
        {
            try
            {
                if (osClientSecret?.Db == null || !TableExists(osClientSecret, "sys_microiservice"))
                {
                    return;
                }

                var columns = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["StorageMode"] = "varchar(50)",
                    ["Runtime"] = "varchar(50)",
                    ["BuildVersion"] = "varchar(50)",
                    ["EntryPath"] = "varchar(500)",
                    ["AssetManifestJson"] = "longtext",
                    ["AssetsJson"] = "longtext",
                    ["DistHash"] = "varchar(200)",
                    ["AssetCount"] = "int",
                    ["TotalSize"] = "bigint",
                    ["PublishTime"] = "varchar(25)",
                    ["SourceDirName"] = "varchar(200)"
                };

                foreach (var column in columns)
                {
                    EnsureColumn(osClientSecret, "sys_microiservice", column.Key, column.Value);
                }
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("检查微前端服务表字段失败：" + ex.Message, ex);
            }
        }

        private void EnsureAuthSecretColumns(OsClientSecret osClientSecret)
        {
            try
            {
                if (osClientSecret?.Db == null || !TableExists(osClientSecret, "sys_osclients"))
                {
                    return;
                }

                EnsureStringColumnCapacity(osClientSecret, "sys_osclients", "AuthSecret", 100);
                EnsureColumn(osClientSecret, "sys_osclients", "AuthSecretRotateVersion", "varchar(100)");

                var rotateVersion = ConfigHelper
                    .GetEnvOrConfiguration("MICROI_AUTH_SECRET_ROTATE_VERSION", "Security:AuthSecretRotateVersion")
                    .DosIsNullOrWhiteSpace(DiyToken.CurrentAuthVersion)
                    .Trim();
                var dbType = osClientSecret.OsClientModel?["DbType"].Val<string>() ?? OsClientDefault.OsClientDbType;
                var sql = dbType == "MySql"
                    ? @"UPDATE `sys_osclients`
                        SET `AuthSecretRotateVersion` = @p0
                        WHERE (`AuthSecretRotateVersion` IS NULL OR `AuthSecretRotateVersion` = '')
                          AND `AuthSecret` IS NOT NULL
                          AND CHAR_LENGTH(`AuthSecret`) >= 32
                          AND LOWER(`AuthSecret`) <> LOWER(`OsClient`)"
                    : @"UPDATE [sys_osclients]
                        SET [AuthSecretRotateVersion] = @p0
                        WHERE ([AuthSecretRotateVersion] IS NULL OR [AuthSecretRotateVersion] = '')
                          AND [AuthSecret] IS NOT NULL
                          AND LEN([AuthSecret]) >= 32
                          AND LOWER([AuthSecret]) <> LOWER([OsClient])";
                osClientSecret.Db.FromSql(sql)
                    .AddInParameter("p0", rotateVersion)
                    .ExecuteNonQuery();
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException("检查JWT密钥字段失败：" + ex.Message, ex);
            }
        }

        private void EnsureStringColumnCapacity(
            OsClientSecret osClientSecret,
            string tableName,
            string columnName,
            int minimumLength)
        {
            var dbType = osClientSecret.OsClientModel?["DbType"].Val<string>() ?? OsClientDefault.OsClientDbType;
            int currentLength;
            if (dbType == "MySql")
            {
                currentLength = osClientSecret.Db.FromSql(@"SELECT COALESCE(CHARACTER_MAXIMUM_LENGTH, 0)
                        FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @p0 AND COLUMN_NAME = @p1")
                    .AddInParameter("p0", tableName)
                    .AddInParameter("p1", columnName)
                    .ToScalar<int>();
            }
            else if (dbType == "SqlServer")
            {
                currentLength = osClientSecret.Db.FromSql(@"SELECT COALESCE(CHARACTER_MAXIMUM_LENGTH, 0)
                        FROM INFORMATION_SCHEMA.COLUMNS
                        WHERE TABLE_NAME = @p0 AND COLUMN_NAME = @p1")
                    .AddInParameter("p0", tableName)
                    .AddInParameter("p1", columnName)
                    .ToScalar<int>();
            }
            else
            {
                return;
            }

            if (currentLength >= minimumLength)
            {
                return;
            }

            var sql = dbType == "MySql"
                ? $"ALTER TABLE `{tableName}` MODIFY COLUMN `{columnName}` varchar({minimumLength}) NULL"
                : $"ALTER TABLE [{tableName}] ALTER COLUMN [{columnName}] varchar({minimumLength}) NULL";
            osClientSecret.Db.FromSql(sql).ExecuteNonQuery();
            Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【扩容表字段】{tableName}.{columnName} -> varchar({minimumLength})");
        }

        private bool TableExists(OsClientSecret osClientSecret, string tableName)
        {
            var dbType = osClientSecret.OsClientModel?["DbType"].Val<string>() ?? OsClientDefault.OsClientDbType;
            if (dbType == "MySql")
            {
                return osClientSecret.Db.FromSql(@"SELECT COUNT(*) FROM information_schema.TABLES
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @p0")
                    .AddInParameter("p0", tableName)
                    .ToScalar<int>() > 0;
            }

            if (dbType == "SqlServer")
            {
                return osClientSecret.Db.FromSql("SELECT CASE WHEN OBJECT_ID(@p0, 'U') IS NULL THEN 0 ELSE 1 END")
                    .AddInParameter("p0", tableName)
                    .ToScalar<int>() > 0;
            }

            return false;
        }

        private void EnsureColumn(OsClientSecret osClientSecret, string tableName, string columnName, string fieldType)
        {
            if (ColumnExists(osClientSecret, tableName, columnName))
            {
                return;
            }

            var dbType = osClientSecret.OsClientModel?["DbType"].Val<string>() ?? OsClientDefault.OsClientDbType;
            var sql = dbType == "MySql"
                ? $"ALTER TABLE `{tableName}` ADD COLUMN `{columnName}` {fieldType} NULL"
                : $"ALTER TABLE [{tableName}] ADD [{columnName}] {fieldType} NULL";
            try
            {
                osClientSecret.Db.FromSql(sql).ExecuteNonQuery();
                Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【补齐表字段】{tableName}.{columnName}");
            }
            catch (Exception ex)
            {
                if (ex.Message.Contains("Duplicate column", StringComparison.OrdinalIgnoreCase)
                    || ex.Message.Contains("Column names in each table must be unique", StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }
                throw;
            }
        }

        private bool ColumnExists(OsClientSecret osClientSecret, string tableName, string columnName)
        {
            var dbType = osClientSecret.OsClientModel?["DbType"].Val<string>() ?? OsClientDefault.OsClientDbType;
            if (dbType == "MySql")
            {
                return osClientSecret.Db.FromSql(@"SELECT COUNT(*) FROM information_schema.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = @p0 AND COLUMN_NAME = @p1")
                    .AddInParameter("p0", tableName)
                    .AddInParameter("p1", columnName)
                    .ToScalar<int>() > 0;
            }

            if (dbType == "SqlServer")
            {
                return osClientSecret.Db.FromSql("SELECT CASE WHEN COL_LENGTH(@p0, @p1) IS NULL THEN 0 ELSE 1 END")
                    .AddInParameter("p0", tableName)
                    .AddInParameter("p1", columnName)
                    .ToScalar<int>() > 0;
            }

            return true;
        }

        private static void AdvanceSuccessfulVersion(ref string currentVersion, string candidateVersion)
        {
            var candidate = ParseFourPartVersion(candidateVersion, "升级版本号");
            if (currentVersion.DosIsNullOrWhiteSpace()
                || candidate.CompareTo(ParseFourPartVersion(currentVersion, "已完成升级版本号")) > 0)
            {
                currentVersion = candidateVersion;
            }
        }

        private async Task<int> PersistServerVersionForwardOnlyAsync(
            OsClientSecret osClientSecret,
            string targetVersionText)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            if (osClientSecret?.Db == null)
            {
                throw new InvalidOperationException("租户数据库连接不存在。");
            }

            var targetVersion = ParseFourPartVersion(targetVersionText, "目标ServerVersion");
            var rows = osClientSecret.Db
                .FromSql("SELECT Id, ServerVersion FROM sys_config WHERE IsEnable = @p0")
                .AddInParameter("p0", 1)
                .ToList<ServerVersionRow>();
            if (rows.Count == 0)
            {
                throw new InvalidOperationException("未找到启用的 sys_config 配置。");
            }

            var updatedCount = 0;
            foreach (var row in rows)
            {
                UpgradeExecutionLeaseContext.ThrowIfLost();
                if (row == null || row.Id.DosIsNullOrWhiteSpace())
                {
                    throw new InvalidOperationException("启用的 sys_config 配置缺少 Id。");
                }

                var actualText = row.ServerVersion ?? "";
                if (!actualText.DosIsNullOrWhiteSpace()
                    && ParseFourPartVersion(actualText, "数据库当前ServerVersion")
                        .CompareTo(targetVersion) >= 0)
                {
                    continue;
                }

                var affected = osClientSecret.Db
                    .FromSql(@"UPDATE sys_config
                        SET ServerVersion = @p0
                        WHERE Id = @p1
                          AND (ServerVersion = @p2
                               OR (ServerVersion IS NULL AND @p2 = ''))")
                    .AddInParameter("p0", targetVersionText)
                    .AddInParameter("p1", row.Id)
                    .AddInParameter("p2", actualText)
                    .ExecuteNonQuery();
                if (affected > 0)
                {
                    updatedCount += affected;
                    continue;
                }

                UpgradeExecutionLeaseContext.ThrowIfLost();
                var reread = osClientSecret.Db
                    .FromSql("SELECT Id, ServerVersion FROM sys_config WHERE Id = @p0")
                    .AddInParameter("p0", row.Id)
                    .First<ServerVersionRow>();
                if (reread != null
                    && !reread.ServerVersion.DosIsNullOrWhiteSpace()
                    && ParseFourPartVersion(reread.ServerVersion, "并发写入后的ServerVersion")
                        .CompareTo(targetVersion) >= 0)
                {
                    continue;
                }

                throw new InvalidOperationException(
                    $"sys_config[{row.Id}] ServerVersion发生并发变化，且未达到目标版本 {targetVersionText}。");
            }

            await MicroiEngine.CacheTenant.Cache(osClientSecret.OsClient)
                .RemoveAsync($"Microi:{osClientSecret.OsClient}:FormData:sys_config");
            await MicroiEngine.CacheTenant.Cache(osClientSecret.OsClient)
                .RemoveAsync($"Microi:{osClientSecret.OsClient}:FormData:sys_config:sys_config");
            return updatedCount;
        }

        private static System.Version ParseFourPartVersion(string versionText, string fieldName)
        {
            if (!System.Version.TryParse(versionText, out var version)
                || version.Revision < 0)
            {
                throw new FormatException($"{fieldName}格式错误，应为四段数字版本号：{versionText}");
            }
            return version;
        }

        public sealed class ServerVersionRow
        {
            public string Id { get; set; }
            public string ServerVersion { get; set; }
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="CurrentVersion"></param>
        /// <param name="UpgrageVersion"></param>
        /// <returns></returns>
        public bool NeedUpgrade(string CurrentVersion, string UpgrageVersion)
        {
            UpgradeExecutionLeaseContext.ThrowIfLost();
            if (CurrentVersion.DosIsNullOrWhiteSpace())
            {
                return true;
            }
            if (!System.Version.TryParse(CurrentVersion, out var currentVersion)
                || currentVersion.Revision < 0)
            {
                throw new FormatException($"无效的当前版本号：{CurrentVersion}");
            }
            if (!System.Version.TryParse(UpgrageVersion, out var upgradeVersion)
                || upgradeVersion.Revision < 0)
            {
                throw new FormatException($"无效的升级版本号：{UpgrageVersion}");
            }
            return currentVersion.CompareTo(upgradeVersion) < 0;
        }
    }
}


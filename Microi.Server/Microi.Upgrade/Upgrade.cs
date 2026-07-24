using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;

namespace Microi.net
{
    /// <summary>
    /// 
    /// </summary>
	public class MicroiUpgrade : IMicroiUpgrade
    {
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


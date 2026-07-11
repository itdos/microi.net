using System;
using System.Collections.Generic;
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
            if (!CurrentVersion.DosIsNullOrWhiteSpace() && CurrentVersion.DosSplit('.').Length != 4)
            {
                Console.WriteLine($"Microi：【Error异常】microi sys_config verison value is error.");
                return new DosResultList<MicroiUpgradeResult>(0, null, "microi sys_config verison value is error.");
            }
            var result = new List<MicroiUpgradeResult>();
            var needUptServerVersion = false;
            var uptVersion = "";

            EnsureAuthSecretColumns(osClientSecret);
            EnsureMicroServiceColumns(osClientSecret);

            #region 升级AppDisplay、AppVisible  --2024-09-19【必须】
            if (NeedUpgrade(CurrentVersion, UpgradeAppDisplay.Version))
            {
                try
                {
                    var count = osClientSecret.Db.FromSql(UpgradeAppDisplay.Sql).ExecuteNonQuery();
                    Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级AppDisplay、AppVisible】成功！");
                    needUptServerVersion = true;
                    uptVersion = UpgradeAppDisplay.Version;
                }
                catch (Exception ex)
                {
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
            if (NeedUpgrade(CurrentVersion, UpgradeSysConfig.Version))
            {
                try
                {
                    var msgs = await new UpgradeSysConfig().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
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
                        uptVersion = UpgradeSysConfig.Version;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级sys_config】失败：{ex.Message}");//。Sql：{UpgradeSysConfig.Sql}。
                }
            }
            #endregion

            #region 升级多语言 --2024-09-19【必须】
            if (NeedUpgrade(CurrentVersion, UpgradeLang.Version))
            {
                try
                {
                    var count = osClientSecret.Db.FromSql(UpgradeLang.Sql).ExecuteNonQuery();
                    Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级多语言】成功！");
                    needUptServerVersion = true;
                    uptVersion = UpgradeLang.Version;
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级多语言】失败：{ex.Message}");//。Sql：{UpgradeLang.Sql}。
                }
            }
            #endregion

            #region 升级sys_menu --2024-10-02【非必须】
            // if (NeedUpgrade(CurrentVersion, UpgradeSysMenu.Version))
            // {
            //     try
            //     {
            //         var msgs = await UpgradeSysMenu.Run(osClientSecret.OsClient);
            //         if(msgs.Count > 0)
            //         {
            //             foreach (var msg in msgs)
            //             {
            //                 Console.WriteLine($"Microi：【异步】平台自动升级【{osClientSecret.OsClient}】【升级sys_menu】失败：{msg}");
            //             }
            //         } 
            //         var count = osClientSecret.Db.FromSql(UpgradeSysMenu.Sql).ExecuteNonQuery();
            //         Console.WriteLine($"Microi：【异步】平台自动升级【{osClientSecret.OsClient}】【升级sys_menu】成功！");
            //     }
            //     catch (Exception ex)
            //     {
            //         Console.WriteLine($"Microi：【异步】平台自动升级【{osClientSecret.OsClient}】【升级sys_menu】失败：{ex.Message}");//。Sql：{UpgradeSysMenu.Sql}。
            //     }
            //     // result.Add(new MicroiUpgrade()
            //     // {
            //     //     Version = UpgradeSysMenu.Version,
            //     //     Sql = UpgradeSysMenu.Sql,
            //     // });
            // }
            #endregion

            #region 升级ApiEngine --2024-10-02【必须】
            if (NeedUpgrade(CurrentVersion, UpgradeApiEngine.Version))
            {
                try
                {
                    var msgs = await new UpgradeApiEngine().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
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
                        uptVersion = UpgradeApiEngine.Version;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级ApiEngine】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级ApiEngine6 --2024-10-24【必须】 --不再需要
            // if (NeedUpgrade(CurrentVersion, UpgradeApiEngine6.Version))
            // {
            //     try
            //     {
            //         var msgs = await new UpgradeApiEngine6().Run(osClientSecret.OsClient);
            //         if (msgs.Count > 0)
            //         {
            //             foreach (var msg in msgs)
            //             {
            //                 Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级ApiEngine6】失败：{msg}");
            //             }
            //         }
            //         else
            //         {
            //             Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级ApiEngine6】成功！");
            //             needUptServerVersion = true;
            //             uptVersion = UpgradeApiEngine6.Version;
            //         }
            //     }
            //     catch (Exception ex)
            //     {
            //         Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级ApiEngine6】失败：{ex.Message}");
            //     }
            // }
            #endregion

            #region 升级7 --2025-08-16【必须】
            if (NeedUpgrade(CurrentVersion, Upgrade7.Version))
            {
                try
                {
                    var msgs = await new Upgrade7().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级7 - 2025-08-16】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级7 - 2025-08-16】成功！");
                        needUptServerVersion = true;
                        uptVersion = Upgrade7.Version;
                    }

                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级7 - 2025-08-16】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级8 --2025-12-19【必须】
            if (NeedUpgrade(CurrentVersion, Upgrade8.Version))
            {
                try
                {
                    var msgs = await new Upgrade8().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级8 - 2025-12-19】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级8 - 2025-12-19】成功！");
                        needUptServerVersion = true;
                        uptVersion = Upgrade8.Version;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级8 - 2025-12-19】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级9 --2026-01-09【必须】
            if (NeedUpgrade(CurrentVersion, Upgrade9.Version))
            {
                try
                {
                    var msgs = await new Upgrade9().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级9 - 2026-01-09】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级9 - 2026-01-09】成功！");
                        needUptServerVersion = true;
                        uptVersion = Upgrade9.Version;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级9 - 2026-01-09】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级9 --2026-01-10【必须】
            if (NeedUpgrade(CurrentVersion, Upgrade10.Version))
            {
                try
                {
                    var msgs = await new Upgrade10().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级10 - 2026-01-10】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级10 - 2026-01-10】成功！");
                        needUptServerVersion = true;
                        uptVersion = Upgrade10.Version;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级10 - 2026-01-10】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级11 --2026-01-13【必须】
            if (NeedUpgrade(CurrentVersion, Upgrade11.Version))
            {
                try
                {
                    var msgs = await new Upgrade11().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级11 - 2026-01-13】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级11 - 2026-01-13】成功！");
                        needUptServerVersion = true;
                        uptVersion = Upgrade11.Version;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级11 - 2026-01-13】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级12 --2026-01-13【必须】
            if (NeedUpgrade(CurrentVersion, Upgrade12.Version))
            {
                try
                {
                    var msgs = await new Upgrade12().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级12 - 2026-01-25】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级12 - 2026-01-25】成功！");
                        needUptServerVersion = true;
                        uptVersion = Upgrade12.Version;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级12 - 2026-01-25】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级13 --2026-02-03【必须】
            if (NeedUpgrade(CurrentVersion, UpgradeAppStore.Version))
            {
                try
                {
                    var msgs = await new UpgradeAppStore().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级13 - 2026-02-03】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级13 - 2026-02-03】成功！");
                        needUptServerVersion = true;
                        uptVersion = UpgradeAppStore.Version;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级13 - 2026-02-03】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级14 --2026-07-12【必须】
            if (NeedUpgrade(CurrentVersion, Upgrade14.Version))
            {
                try
                {
                    var msgs = await new Upgrade14().Run(osClientSecret.OsClient);
                    if (msgs.Count > 0)
                    {
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级14 - 2026-07-12】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级14 - 2026-07-12】成功！");
                        needUptServerVersion = true;
                        uptVersion = Upgrade14.Version;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级14 - 2026-07-12】失败：{ex.Message}");
                }
            }
            #endregion

            #region 更新版本号【必须】
            try
            {
                if (needUptServerVersion)
                {
                    var count = osClientSecret.Db.FromSql("update sys_config set ServerVersion=@p0")
                        .AddInParameter("p0", uptVersion)
                        .ExecuteNonQuery();
                    await MicroiEngine.CacheTenant.Cache(osClientSecret.OsClient).RemoveAsync($"Microi:{osClientSecret.OsClient}:FormData:sys_config");
                    await MicroiEngine.CacheTenant.Cache(osClientSecret.OsClient).RemoveAsync($"Microi:{osClientSecret.OsClient}:FormData:sys_config:sys_config");
                    Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【更新系统版本号ServerVersion】成功，共更新 {count} 行！");
                    Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】完成！");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【更新系统版本号ServerVersion】失败：{ex.Message}");//Sql：{UpgradeAppDisplay.Sql}。
            }
            #endregion
            return new DosResultList<MicroiUpgradeResult>(1, result);
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
                Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret?.OsClient}】【检查微前端服务表字段】失败：{ex.Message}");
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
                Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret?.OsClient}】【检查JWT密钥字段】失败：{ex.Message}");
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

        /// <summary>
        /// 
        /// </summary>
        /// <param name="CurrentVersion"></param>
        /// <param name="UpgrageVersion"></param>
        /// <returns></returns>
        public bool NeedUpgrade(string CurrentVersion, string UpgrageVersion)
        {
            if (CurrentVersion.DosIsNullOrWhiteSpace())
            {
                return true;
            }
            var currentVersionArr = CurrentVersion.DosSplit('.');
            var upgradeVersionArr = UpgrageVersion.DosSplit('.');
            for (int i = 0; i < currentVersionArr.Length; i++)
            {
                var currentVersionInt = int.Parse(currentVersionArr[i]);
                var upgradeVersionInt = int.Parse(upgradeVersionArr[i]);
                if (currentVersionInt == upgradeVersionInt)
                {
                    continue;
                }
                else if (currentVersionInt < upgradeVersionInt)
                {
                    return true;
                }
                else
                {
                    return false;
                }
            }
            return false;
        }
    }
}


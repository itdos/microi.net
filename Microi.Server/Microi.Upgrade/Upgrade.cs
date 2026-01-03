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
            if (!CurrentVersion.DosIsNullOrWhiteSpace() && CurrentVersion.Split('.').Length != 4)
            {
                Console.WriteLine($"Microi：【Error异常】microi sys_config verison value is error.");
                return new DosResultList<MicroiUpgradeResult>(0, null, "microi sys_config verison value is error.");
            }
            var result = new List<MicroiUpgradeResult>();
            var needUptServerVersion = false;
            var uptVersion = "";

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
                    if(msgs.Count > 0)
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
                    if(msgs.Count > 0)
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

            #region 升级ApiEngine6 --2024-10-24【必须】
            if (NeedUpgrade(CurrentVersion, UpgradeApiEngine6.Version))
            {
                try
                {
                    var msgs = await new UpgradeApiEngine6().Run(osClientSecret.OsClient);
                    if(msgs.Count > 0)
                    {
                        foreach (var msg in msgs)
                        {
                            Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级ApiEngine6】失败：{msg}");
                        }
                    }
                    else
                    {
                        Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【升级ApiEngine6】成功！");
                        needUptServerVersion = true;
                        uptVersion = UpgradeApiEngine6.Version;
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Microi：【Error异常】平台自动升级【{osClientSecret.OsClient}】【升级ApiEngine6】失败：{ex.Message}");
                }
            }
            #endregion

            #region 升级7 --2025-08-16【必须】
            if (NeedUpgrade(CurrentVersion, Upgrade7.Version))
            {
                try
                {
                    var msgs = await new Upgrade7().Run(osClientSecret.OsClient);
                    if(msgs.Count > 0)
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
                    if(msgs.Count > 0)
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

            #region 更新版本号【必须】
            try
            {
                if (needUptServerVersion)
                {
                    var count = osClientSecret.Db.FromSql($"update sys_config set ServerVersion='{uptVersion}'").ExecuteNonQuery();
                    Console.WriteLine($"Microi：【成功】平台自动升级【{osClientSecret.OsClient}】【更新系统版本号ServerVersion】成功！");
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
            var currentVersionArr = CurrentVersion.Split('.');
            var upgradeVersionArr = UpgrageVersion.Split('.');
            for (int i = 0; i < currentVersionArr.Length; i++)
            {
                var currentVersionInt = int.Parse(currentVersionArr[i]);
                var upgradeVersionInt = int.Parse(upgradeVersionArr[i]);
                if (currentVersionInt == upgradeVersionInt)
                {
                    continue;
                }
                else if(currentVersionInt < upgradeVersionInt)
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


using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public static class MicroiUpgradeExtensions
    {
        public static IServiceCollection AddMicroiUpgrade(this IServiceCollection services)
        {
            try
            {
                services.AddSingleton<IMicroiUpgrade, MicroiUpgrade>();
                Console.WriteLine("Microi：【成功】注入【服务器端自动升级】插件成功！");
                return services;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】注入【服务器端自动升级】插件失败：" + ex.Message);
                return services;
            }
        }
        public static IApplicationBuilder UseMicroiUpgrade(this IApplicationBuilder app)
        {
            try
            {
                var disabledText = ConfigHelper.GetEnvOrConfiguration(
                    "MICROI_DISABLE_AUTO_UPGRADE",
                    "MicroiUpgrade:Disabled");
                if (bool.TryParse(disabledText, out var disabled) && disabled)
                {
                    Console.WriteLine("Microi：【信息】服务器端自动升级已通过配置禁用。");
                    return app;
                }

                var scheduledTask = app.ApplicationServices.GetRequiredService<IMicroiUpgrade>();
                if (scheduledTask != null)
                {
                    #region 平台自动升级
                    Task.Run(async () =>
                    {
                        foreach (var clientModelItem in OsClient.ClientList)
                        {
                            // 统一通过 GetClient 重新解析运行时配置。主租户的 sys_osclients.DbConn
                            // 通常为空，此处应使用环境变量/appsettings 中的 OsClientDbConn。
                            OsClientSecret runtimeClient;
                            try
                            {
                                runtimeClient = OsClient.GetClient(clientModelItem.Value.OsClient);
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine($"Microi：【Error异常】【{clientModelItem.Value.OsClient}】平台自动升级解析租户数据库配置失败：{ex.Message}");
                                continue;
                            }
                            var dbConn = runtimeClient.OsClientModel?["DbConn"]?.ToString();
                            if (string.IsNullOrWhiteSpace(dbConn))
                            {
                                Console.WriteLine($"Microi：【⚠️警告】平台自动升级跳过租户【{runtimeClient.OsClient}】：数据库连接（DbConn）未配置。");
                                continue;
                            }
                            try
                            {
                                var upgradeLease = UpgradeDistributedLease.TryAcquire(
                                    runtimeClient.OsClient,
                                    out var leaseReason);
                                if (upgradeLease == null)
                                {
                                    // 其它节点持锁或 Redis 暂不可用时必须 fail-closed，但这不是迁移失败。
                                    Console.WriteLine(
                                        $"Microi：【信息】平台自动升级跳过本节点租户【{runtimeClient.OsClient}】：{leaseReason}");
                                }
                                else
                                {
                                    using (upgradeLease)
                                    using (UpgradeExecutionLeaseContext.Enter(upgradeLease))
                                    {
                                        upgradeLease.ThrowIfLost();
                                        // 必须在取得跨节点租约后读取版本，避免使用等待期间已过期的快照。
                                        var currentVersion = runtimeClient.Db
                                            .FromSql("SELECT ServerVersion FROM sys_config WHERE IsEnable = @p0")
                                            .AddInParameter("p0", 1)
                                            .ToScalar<string>() ?? "";

                                        var upgradeResult = await scheduledTask.Upgrade(
                                            currentVersion,
                                            runtimeClient);
                                        upgradeLease.ThrowIfLost();
                                        if (upgradeResult.Code != 1)
                                        {
                                            Console.WriteLine(
                                                $"Microi：【Error异常】【{runtimeClient.OsClient}】平台自动升级失败：{upgradeResult.Msg}");
                                        }
                                    }
                                }
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine($"Microi：【Error异常】【{clientModelItem.Value.OsClient}】平台自动升级出现异常：{ex.Message}");
                            }
                            // if (DiyMessage.Msg.Count == 0)
                            {
                                #region 加载多语言
                                try
                                {
                                    // var langList = currentClientModel.Db.FromSql("select * from diy_lang").ToList<DiyLang>();
                                    var langList = runtimeClient.Db.FromSql("select * from diy_lang").ToList<dynamic>();
                                    // var langs = new List<string>(){
                                    //     "zh-cn", "zh", "cn", "en", "zh-tw"
                                    // };
                                    var langLevel2 = new Dictionary<string, JObject>(StringComparer.OrdinalIgnoreCase);
                                    foreach (var item in langList)
                                    {
                                        JObject itemObj = JObject.FromObject(item);
                                        var key = itemObj["Key"]?.ToString()?.Trim();
                                        if (key.DosIsNullOrWhiteSpace())
                                        {
                                            continue;
                                        }
                                        // Legacy databases may contain duplicate
                                        // language keys. Cache construction must be
                                        // deterministic and must not prevent the
                                        // tenant from starting.
                                        langLevel2[key] = itemObj;
                                    }
                                    DiyMessage.Msg[runtimeClient.OsClient] = langLevel2;
                                    DiyMessage.ClearSourceTextCache(runtimeClient.OsClient);
                                }
                                catch (Exception ex)
                                {
                                    Console.WriteLine($"Microi：【Error异常】【{clientModelItem.Value.OsClient}】加载多语言出现异常：{ex.Message}");
                                }
                                #endregion
                            }
                        }
                    });
                    #endregion
                }
                return app;
            }
            catch (System.Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】服务器端自动升级失败：" + ex.Message);
                return app;
            }
        }
    }
}


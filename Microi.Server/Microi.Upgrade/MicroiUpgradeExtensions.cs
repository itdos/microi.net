using System;
using System.Collections.Generic;
using System.Threading.Tasks;
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
                var scheduledTask = app.ApplicationServices.GetRequiredService<IMicroiUpgrade>();
                var _formEngine = app.ApplicationServices.GetRequiredService<IFormEngine>();
                if (scheduledTask != null)
                {
                    #region 平台自动升级
                    Task.Run(async () =>
                    {
                        foreach (var clientModelItem in OsClient.ClientList)
                        {
                            try
                            {
                                //获取当前数据库版本号
                                var versionResult = await _formEngine.GetFormDataAsync<SysConfig>(new
                                {
                                    FormEngineKey = "sys_config",
                                    _Where = new List<DiyWhere>() {
                                    new DiyWhere() {
                                        Name = "IsEnable",
                                        Value = "1",
                                        Type = "="
                                    }
                                },
                                    OsClient = clientModelItem.Value.OsClient
                                });
                                var currentVersion = "";
                                if (versionResult.Code == 1)
                                {
                                    currentVersion = versionResult.Data.ServerVersion ?? "";
                                }
                                try
                                {
                                    // var sqlResult = await new MicroiUpgrade().Upgrade(currentVersion, clientModelItem.Value);
                                    await scheduledTask.Upgrade(currentVersion, clientModelItem.Value);

                                    // if (sqlResult.Code == 1)
                                    // {
                                    //     foreach (var upgdareItem in sqlResult.Data)
                                    //     {
                                    //         try
                                    //         {
                                    //             var count = clientModelItem.Value.Db.FromSql(upgdareItem.Sql).ExecuteNonQuery();
                                    //         }
                                    //         catch (Exception ex)
                                    //         {
                                    //             Console.WriteLine($"Microi：平台自动升级升级执行sql失败：Sql：{upgdareItem.Sql}。{OsClient.OsClientName}-{OsClient.OsClientType}-{OsClient.OsClientNetwork}-ClientList[{ClientList.Count}]。-->{ex.Message}");
                                    //         }
                                    //     }
                                    // }
                                    // else
                                    // {
                                    //     Console.WriteLine($"Microi：平台自动升级升级获取sql失败：{OsClient.OsClientName}-{OsClient.OsClientType}-{OsClient.OsClientNetwork}-ClientList[{ClientList.Count}]。-->{sqlResult.Msg}");
                                    // }

                                }
                                catch (Exception ex)
                                {
                                    Console.WriteLine($"Microi：【Error异常】【{clientModelItem.Value.OsClient}】平台自动升级出现异常：{ex.Message}");
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
                                    var langList = clientModelItem.Value.Db.FromSql("select * from diy_lang").ToList<dynamic>();
                                    // var langs = new List<string>(){
                                    //     "zh-cn", "zh", "cn", "en", "zh-tw"
                                    // };
                                    var langLevel2 = new Dictionary<string, JObject>();
                                    foreach (var item in langList)
                                    {
                                        JObject itemObj = JObject.FromObject(item);
                                        var key = itemObj["Key"]?.ToString();
                                        langLevel2.Add(key, itemObj);
                                    }
                                    if (DiyMessage.Msg.ContainsKey(clientModelItem.Value.OsClient))
                                    {
                                        DiyMessage.Msg[clientModelItem.Value.OsClient] = langLevel2;
                                    }
                                    else
                                    {
                                        DiyMessage.Msg.Add(clientModelItem.Value.OsClient, langLevel2);
                                    }
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


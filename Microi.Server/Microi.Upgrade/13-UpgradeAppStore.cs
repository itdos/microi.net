using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
namespace Microi.net
{
    /// <summary>
    /// 必要升级：应用商城
    /// </summary>
    public class UpgradeAppStore
    {
        /// <summary>
        /// 
        /// </summary>
        public static string Version = "6.2.1.0";
        private static readonly HttpClient ResourceHttpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(30)
        };
        private const string OfficialResourceApiUrl = "https://api.itdos.com/apiengine/get-microi-upgrade-resource?OsClient=iTdos";
        private const string ImportPackageResourceName = "import-package.js";
        private const string PublishAiAppResourceName = "ai-app-publish-store.js";
        private const string FormEnginePackageResourceName = "app.microi.form-engine.json";
        private const string ModuleEnginePackageResourceName = "app.microi.module-engine.json";
        private const string AppStorePackageResourceName = "app.microi.store.json";

        private static readonly string[] RequiredResourceNames =
        {
            ImportPackageResourceName,
            PublishAiAppResourceName,
            FormEnginePackageResourceName,
            ModuleEnginePackageResourceName,
            AppStorePackageResourceName
        };

        private static readonly Dictionary<string, string> ExpectedPackageNames = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            { FormEnginePackageResourceName, "表单引擎" },
            { ModuleEnginePackageResourceName, "模块引擎" },
            { AppStorePackageResourceName, "应用商城" }
        };

        private static readonly string[] CoreNullableTables =
        {
            "diy_table",
            "diy_field",
            "sys_user",
            "sys_menu",
            "sys_role",
            "sys_osclients"
        };
        
        private static async Task<Dictionary<string, string>> DownloadRequiredResourcesAsync()
        {
            var resources = new Dictionary<string, string>(StringComparer.Ordinal);
            foreach (var resourceName in RequiredResourceNames)
            {
                resources[resourceName] = await DownloadOfficialResourceAsync(resourceName);
            }

            return resources;
        }

        private static async Task<string> DownloadOfficialResourceAsync(string resourceName)
        {
            var url = OfficialResourceApiUrl + "&Name=" + Uri.EscapeDataString(resourceName);
            using (var response = await ResourceHttpClient.GetAsync(url))
            {
                var body = await response.Content.ReadAsStringAsync();
                if (!response.IsSuccessStatusCode)
                {
                    throw new InvalidOperationException($"从吾码官方数据库获取升级资源[{resourceName}]失败，HTTP状态码：{(int)response.StatusCode}");
                }

                var content = ParseOfficialResourceResponse(resourceName, body);
                ValidateResourceContent(resourceName, content);
                Console.WriteLine($"Microi：【基础应用升级】已从吾码官方数据库获取并校验升级资源：{resourceName}");
                return content;
            }
        }

        private static string ParseOfficialResourceResponse(string resourceName, string body)
        {
            if (body.DosIsNullOrWhiteSpace())
            {
                throw new InvalidOperationException($"吾码官方数据库返回的升级资源[{resourceName}]为空。");
            }

            JObject response;
            try
            {
                response = JObject.Parse(body);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"吾码官方数据库返回的升级资源[{resourceName}]不是标准JSON响应。", ex);
            }

            if (response["Code"]?.Value<int>() != 1)
            {
                throw new InvalidOperationException($"吾码官方数据库返回升级资源[{resourceName}]失败：{response["Msg"]}");
            }

            var returnedResourceName = response["Data"]?["ResourceName"]?.ToString();
            if (!string.Equals(returnedResourceName, resourceName, StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"吾码官方数据库返回的资源名不匹配，期望[{resourceName}]，实际[{returnedResourceName}]。");
            }

            var contentToken = response["Data"]?["Content"];
            if (contentToken == null)
            {
                throw new InvalidOperationException($"吾码官方数据库返回的升级资源[{resourceName}]缺少Data.Content。");
            }

            return contentToken.Type == JTokenType.String
                ? contentToken.ToString()
                : contentToken.ToString(Formatting.None);
        }

        private static void ValidateResourceContent(string resourceName, string content)
        {
            if (content.DosIsNullOrWhiteSpace())
            {
                throw new InvalidOperationException($"吾码官方数据库返回的升级资源[{resourceName}]内容为空。");
            }

            if (string.Equals(resourceName, ImportPackageResourceName, StringComparison.Ordinal))
            {
                if (!content.Contains("import-microi-store-package"))
                {
                    throw new InvalidOperationException($"升级资源[{resourceName}]内容校验失败，未找到目标接口Key。");
                }
                return;
            }

            if (string.Equals(resourceName, PublishAiAppResourceName, StringComparison.Ordinal))
            {
                if (!content.Contains("ai_app_publish_store"))
                {
                    throw new InvalidOperationException($"升级资源[{resourceName}]内容校验失败，未找到目标接口Key。");
                }
                return;
            }

            JObject package;
            try
            {
                package = JObject.Parse(content);
            }
            catch (Exception ex)
            {
                throw new InvalidOperationException($"升级资源[{resourceName}]不是有效的应用数据包JSON。", ex);
            }

            var expectedPackageName = ExpectedPackageNames[resourceName];
            var actualPackageName = package["PackageInfo"]?["Name"]?.ToString();
            if (!string.Equals(actualPackageName, expectedPackageName, StringComparison.Ordinal))
            {
                throw new InvalidOperationException($"升级资源[{resourceName}]数据包名称不匹配，期望[{expectedPackageName}]，实际[{actualPackageName}]。");
            }
        }

        private static async Task InstallUpgradePackage(string osClient, List<string> msgs, string resourceName, string packageName, IReadOnlyDictionary<string, string> resources)
        {
            var packageContent = resources[resourceName];
            Console.WriteLine($"Microi：【基础应用升级】开始导入{packageName}：{resourceName}");
            var installResult = await MicroiEngine.ApiEngine.RunAsync("import-microi-store-package", new
            {
                OsClient = osClient,
                Package = packageContent
            });
            if (installResult.Code != 1)
            {
                msgs.Add($"{packageName}导入失败：{installResult.Msg}");
                return;
            }

            Console.WriteLine($"Microi：【基础应用升级】{packageName}导入完成。");
        }

        /// <summary>
        /// 
        /// </summary>
        public async Task<List<string>> Run(string osClient)
        {
            var msgs = new List<string>();

            // 必须先完整下载并校验全部资源。任意资源不可用时直接终止，避免部分升级，
            // 更不能再使用随安装包发布的旧资源覆盖客户数据库。
            var resources = await DownloadRequiredResourcesAsync();

            var nullableMessages = new List<string>();
            EnsureCoreTableColumnsNullable(osClient, nullableMessages);
            foreach (var nullableMessage in nullableMessages)
            {
                Console.WriteLine($"Microi：【基础应用升级】{nullableMessage}");
            }
            
            #region 导入数据包V8
            //更新应用商城的导入数据包接口引擎
            var importMicroiStorePackageResult = await MicroiEngine.FormEngine.GetFormDataAsync("sys_apiengine", new
            {
                OsClient = osClient,
                _Where = new List<object>()
                {
                    new List<object>()
                    {
                        "ApiEngineKey", "=", "import-microi-store-package"
                    }
                },
            });
            var importV8 = resources[ImportPackageResourceName];
            if (importMicroiStorePackageResult.Code != 1)
            {
                var addImportMicroiStorePackageResult = await MicroiEngine.FormEngine.AddFormDataAsync("sys_apiengine", new
                {
                    ApiName = "[应用商城]导入Microi应用数据包",
                    ApiEngineKey = "import-microi-store-package",
                    ApiAddress = "/apiengine/import-microi-store-package",
                    IsEnable = 1,
                    OsClient = osClient,
                    ApiV8Code = importV8
                });
                if(addImportMicroiStorePackageResult.Code != 1)
                {
                    msgs.Add(addImportMicroiStorePackageResult.Msg);
                }
            }
            else
            {
                var uptImportMicroiStorePackageResult = await MicroiEngine.FormEngine.UptFormDataAsync("sys_apiengine", new
                {
                    Id = (string)importMicroiStorePackageResult.Data.Id,
                    ApiName = "[应用商城]导入Microi应用数据包",
                    ApiEngineKey = "import-microi-store-package",
                    ApiAddress = "/apiengine/import-microi-store-package",
                    IsEnable = 1,
                    OsClient = osClient,
                    ApiV8Code = importV8
                });
                if(uptImportMicroiStorePackageResult.Code != 1)
                {
                    msgs.Add(uptImportMicroiStorePackageResult.Msg);
                }
                else
                {
                    await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:import-microi-store-package");
                    await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{(string)importMicroiStorePackageResult.Data.Id}");
                    await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:/apiengine/import-microi-store-package");
                }
            }
            #endregion

            #region AI应用发布到商城V8
            var publishAiAppV8 = resources[PublishAiAppResourceName];
            var publishAiAppEngine = await MicroiEngine.FormEngine.GetFormDataAsync("sys_apiengine", new
            {
                OsClient = osClient,
                _Where = new List<object>()
                {
                    new List<object>() { "ApiEngineKey", "=", "ai_app_publish_store" }
                }
            });
            DosResult publishAiAppResult;
            if (publishAiAppEngine.Code == 1)
            {
                publishAiAppResult = await MicroiEngine.FormEngine.UptFormDataAsync("sys_apiengine", new
                {
                    Id = (string)publishAiAppEngine.Data.Id,
                    OsClient = osClient,
                    ApiName = "[AI应用]制作离线包并发布应用商城",
                    ApiEngineKey = "ai_app_publish_store",
                    ApiAddress = "/apiengine/ai_app_publish_store",
                    IsEnable = 1,
                    StopHttp = 1,
                    ApiV8Code = publishAiAppV8
                });
            }
            else
            {
                publishAiAppResult = await MicroiEngine.FormEngine.AddFormDataAsync("sys_apiengine", new
                {
                    OsClient = osClient,
                    ApiName = "[AI应用]制作离线包并发布应用商城",
                    ApiEngineKey = "ai_app_publish_store",
                    ApiAddress = "/apiengine/ai_app_publish_store",
                    IsEnable = 1,
                    StopHttp = 1,
                    ApiV8Code = publishAiAppV8
                });
            }
            if (publishAiAppResult.Code != 1)
            {
                msgs.Add("AI应用发布商城接口升级失败：" + publishAiAppResult.Msg);
            }
            else
            {
                await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync("Microi:" + osClient + ":FormData:sys_apiengine:ai_app_publish_store");
                await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync("Microi:" + osClient + ":FormData:sys_apiengine:/apiengine/ai_app_publish_store");
            }
            #endregion
            
            #region 表单引擎 数据包
            await InstallUpgradePackage(osClient, msgs, FormEnginePackageResourceName, "表单引擎数据包", resources);
            #endregion

            #region 模块引擎 数据包
            await InstallUpgradePackage(osClient, msgs, ModuleEnginePackageResourceName, "模块引擎数据包", resources);
            #endregion

            #region 应用商城 数据包
            await InstallUpgradePackage(osClient, msgs, AppStorePackageResourceName, "应用商城数据包", resources);
            #endregion

            #region 修正sys_menu的DiyTableId关联值
            var getStoreTableResult = await MicroiEngine.FormEngine.GetFormDataAsync("diy_table", new {
                OsClient = osClient,
                _Where = new List<object>()
                {
                    new List<object>() { "Name", "=", "sys_microistore" }
                }
            });
            if(getStoreTableResult.Code == 1){
                var getMenuResult = await MicroiEngine.FormEngine.GetFormDataAsync("sys_menu", new {
                    OsClient = osClient,
                    _Where = new List<object>()
                    {
                        new List<object>() { "ModuleEngineKey", "=", "sys_microistore" },
                    }
                });
                if(getMenuResult.Code == 1)
                {
                    var uptMenuResult = await MicroiEngine.FormEngine.UptFormDataAsync("sys_menu", new {
                        Id = (string)getMenuResult.Data.Id,
                        OsClient = osClient,
                        DiyTableId = (string)getStoreTableResult.Data.Id,
                        DiyTableName = (string)getStoreTableResult.Data.Name,
                    });
                    if(uptMenuResult.Code != 1)
                    {
                        msgs.Add(uptMenuResult.Msg);
                    }else
                    {
                        await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_menu:{(string)getMenuResult.Data.Id}");
                        await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_menu:sys_microistore");
                    }
                }
            }
            #endregion

            //更新缓存
            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table:6cf254f1-edd0-4f04-96bc-c9ad08b5a2c");
            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table_field_list:6cf254f1-edd0-4f04-96bc-c9ad08b5a2c");

            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table:39bc4abe-98ee-46a7-b9d1-a7d649691193");
            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table_field_list:39bc4abe-98ee-46a7-b9d1-a7d649691193");

            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table:diy_table");
            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table:diy_field");
            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table:sys_microistore");
            await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table_field_list:sys_microistore");
            
            return msgs;
        }

        private static void EnsureCoreTableColumnsNullable(string osClient, List<string> msgs)
        {
            try
            {
                var osClientModel = OsClient.GetClient(osClient);
                if (osClientModel?.Db == null)
                {
                    msgs.Add($"核心表字段可空升级跳过：未找到租户 {osClient} 的数据库连接。");
                    return;
                }

                var dbType = osClientModel.OsClientModel?["DbType"]?.Val<string>();
                var dbInfo = DiyCommon.GetDbInfo(dbType);
                var orm = MicroiEngine.ORM(dbInfo.DbType);

                foreach (var tableName in CoreNullableTables)
                {
                    var columnsResult = orm.GetColumns(new DbServiceParam
                    {
                        OsClient = osClient,
                        TableName = tableName,
                        DbSession = osClientModel.Db,
                        DbInfo = dbInfo
                    });
                    if (columnsResult.Code != 1 || columnsResult.Data == null)
                    {
                        msgs.Add($"核心表 {tableName} 字段可空升级跳过：{columnsResult.Msg}");
                        continue;
                    }

                    var changedCount = 0;
                    foreach (var column in columnsResult.Data)
                    {
                        var columnName = column.column_name ?? "";
                        if (columnName.Equals("Id", StringComparison.OrdinalIgnoreCase)) continue;
                        if (string.Equals(column.is_nullable, "YES", StringComparison.OrdinalIgnoreCase)) continue;

                        var columnType = column.column_type;
                        if (columnType.DosIsNullOrWhiteSpace())
                        {
                            columnType = column.data_type;
                        }
                        if (columnType.DosIsNullOrWhiteSpace()) continue;

                        var changeResult = orm.ChangeColumn(new DbServiceParam
                        {
                            OsClient = osClient,
                            TableName = tableName,
                            FieldName = columnName,
                            NewFieldName = columnName,
                            FieldType = columnType,
                            FieldLabel = column.column_comment ?? "",
                            FieldNotNull = false,
                            DbSession = osClientModel.Db,
                            DbInfo = dbInfo
                        });
                        if (changeResult.Code == 1)
                        {
                            changedCount++;
                        }
                        else
                        {
                            msgs.Add($"核心表 {tableName}.{columnName} 调整为允许为空失败：{changeResult.Msg}");
                        }
                    }

                    if (changedCount > 0)
                    {
                        msgs.Add($"核心表 {tableName} 已将 {changedCount} 个字段调整为允许为空。");
                    }
                }
            }
            catch (Exception ex)
            {
                msgs.Add($"核心表字段可空升级异常：{ex.Message}");
            }
        }
    }
}


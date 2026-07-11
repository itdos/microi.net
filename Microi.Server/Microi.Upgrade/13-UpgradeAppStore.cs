using System;
using System.Collections.Generic;
using System.IO;
using System.Net.Http;
using System.Reflection;
using System.Text;
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
        public static string Version = "6.2.0.0";
        private static readonly HttpClient ResourceHttpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(8)
        };
        private const string DefaultResourceBaseUrl = "https://api.itdos.com/apiengine/get-microi-upgrade-resource?OsClient=iTdos";

        private static readonly string[] CoreNullableTables =
        {
            "diy_table",
            "diy_field",
            "sys_user",
            "sys_menu",
            "sys_role",
            "sys_osclients"
        };
        
        /// <summary>
        /// 从嵌入资源读取文件内容
        /// </summary>
        private static string ReadEmbeddedResource(string resourceName)
        {
            var assembly = Assembly.GetExecutingAssembly();
            var fullResourceName = $"Microi.Upgrade.Resource.{resourceName}";
            
            using (Stream stream = assembly.GetManifestResourceStream(fullResourceName))
            {
                if (stream == null)
                {
                    throw new Exception($"嵌入资源未找到: {fullResourceName}");
                }
                using (StreamReader reader = new StreamReader(stream))
                {
                    return reader.ReadToEnd();
                }
            }
        }

        private static string ReadUpgradeResource(string resourceName)
        {
            var remoteResource = TryReadRemoteResource(resourceName);
            if (!remoteResource.DosIsNullOrWhiteSpace())
            {
                Console.WriteLine($"Microi：【基础应用升级】已从远端获取升级资源：{resourceName}");
                return remoteResource;
            }

            Console.WriteLine($"Microi：【基础应用升级】远端资源不可用，使用内置资源：{resourceName}");
            return ReadEmbeddedResource(resourceName);
        }

        private static string TryReadRemoteResource(string resourceName)
        {
            try
            {
                var baseUrl = ConfigHelper.GetEnvOrConfiguration("MICROI_UPGRADE_RESOURCE_BASE_URL", "MicroiUpgrade:ResourceBaseUrl");
                if (baseUrl.DosIsNullOrWhiteSpace())
                {
                    baseUrl = DefaultResourceBaseUrl;
                }

                var url = BuildResourceUrl(baseUrl, resourceName);
                var response = ResourceHttpClient.GetAsync(url).GetAwaiter().GetResult();
                if (!response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"Microi：【基础应用升级】远端资源[{resourceName}]获取失败，状态码：{(int)response.StatusCode}");
                    return "";
                }

                var body = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                return NormalizeRemoteResourceContent(resourceName, body);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【基础应用升级】远端资源[{resourceName}]获取异常，将使用内置资源：{ex.Message}");
                return "";
            }
        }

        private static string BuildResourceUrl(string baseUrl, string resourceName)
        {
            var encodedName = Uri.EscapeDataString(resourceName);
            if (baseUrl.Contains("{name}"))
            {
                return baseUrl.Replace("{name}", encodedName);
            }
            if (baseUrl.Contains("{file}"))
            {
                return baseUrl.Replace("{file}", encodedName);
            }
            if (baseUrl.EndsWith("/", StringComparison.Ordinal))
            {
                return baseUrl + encodedName;
            }
            if (baseUrl.Contains("?"))
            {
                var joiner = baseUrl.EndsWith("?", StringComparison.Ordinal) || baseUrl.EndsWith("&", StringComparison.Ordinal) ? "" : "&";
                return baseUrl + joiner + "Name=" + encodedName;
            }
            return baseUrl + "?Name=" + encodedName;
        }

        private static string NormalizeRemoteResourceContent(string resourceName, string body)
        {
            if (body.DosIsNullOrWhiteSpace())
            {
                return "";
            }

            var trimBody = body.TrimStart();
            if (!trimBody.StartsWith("{"))
            {
                return body;
            }

            try
            {
                var json = JObject.Parse(body);
                var code = json["Code"]?.ToString();
                if (!code.DosIsNullOrWhiteSpace() && code != "1")
                {
                    Console.WriteLine($"Microi：【基础应用升级】远端资源[{resourceName}]返回失败：{json["Msg"]}");
                    return "";
                }

                var candidates = new[]
                {
                    json["Data"]?["Content"],
                    json["Data"]?["Package"],
                    json["Data"]?["FileContent"],
                    json["Data"]?["FileByteBase64"],
                    json["Data"],
                    json["Content"],
                    json["Package"],
                    json["FileContent"],
                    json["FileByteBase64"]
                };

                foreach (var token in candidates)
                {
                    if (token == null)
                    {
                        continue;
                    }

                    if (token.Type == JTokenType.String)
                    {
                        var value = token.ToString();
                        if (token.Path.EndsWith("FileByteBase64", StringComparison.OrdinalIgnoreCase))
                        {
                            return Encoding.UTF8.GetString(Convert.FromBase64String(value));
                        }
                        return value;
                    }

                    if (resourceName.EndsWith(".json", StringComparison.OrdinalIgnoreCase)
                        && (token.Type == JTokenType.Object || token.Type == JTokenType.Array))
                    {
                        return token.ToString(Formatting.None);
                    }
                }
            }
            catch
            {
                // 远端也可以直接返回 JSON 文件内容；解析成 DosResult 失败时按原文使用。
            }

            return body;
        }

        private static async Task InstallUpgradePackage(string osClient, List<string> msgs, string resourceName, string packageName)
        {
            var packageContent = ReadUpgradeResource(resourceName);
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
            var importV8 = ReadUpgradeResource("import-package.js");
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
            var publishAiAppV8 = ReadEmbeddedResource("ai-app-publish-store.js");
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
            await InstallUpgradePackage(osClient, msgs, "app.microi.form-engine.json", "表单引擎数据包");
            #endregion

            #region 模块引擎 数据包
            await InstallUpgradePackage(osClient, msgs, "app.microi.module-engine.json", "模块引擎数据包");
            #endregion

            #region 应用商城 数据包
            await InstallUpgradePackage(osClient, msgs, "app.microi.store.json", "应用商城数据包");
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


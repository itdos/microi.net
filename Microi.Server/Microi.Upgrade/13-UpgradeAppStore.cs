using System;
using System.Collections.Generic;
using System.IO;
using System.Reflection;
using System.Threading.Tasks;
using Newtonsoft.Json;
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
        public static string Version = "4.7.2.0";
        
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
        /// <summary>
        /// 
        /// </summary>
        public async Task<List<string>> Run(string osClient)
        {
            var msgs = new List<string>();
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
            #region 导入数据包V8
            var importV8 = ReadEmbeddedResource("import-package.js");
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
                    MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:import-microi-store-package");
                    MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{(string)importMicroiStorePackageResult.Data.Id}");
                    MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:/apiengine/import-microi-store-package");
                }
            }
            #endregion
            
            #region 模块引擎 数据包
            var dataModulePackage = ReadEmbeddedResource("app.microi.module-engine.json");
            //导入数据包
            var installModuleResult = await MicroiEngine.ApiEngine.RunAsync("import-microi-store-package", new
            {
                Package = dataModulePackage
            });
            if(installModuleResult.Code != 1)
            {
                msgs.Add(installModuleResult.Msg);
            }
            #endregion

            #region 应用商城 数据包
            var dataPackage = ReadEmbeddedResource("app.microi.store.json");
            //导入数据包
            var installAppStoreResult = await MicroiEngine.ApiEngine.RunAsync("import-microi-store-package", new
            {
                Package = dataPackage
            });
            if(installAppStoreResult.Code != 1)
            {
                msgs.Add(installAppStoreResult.Msg);
            }
            #endregion
            
            

            //修正sys_menu的DiyTableId关联值
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
                        MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_menu:{(string)getMenuResult.Data.Id}");
                        MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_menu:sys_microistore");
                    }
                }
            }

            //更新缓存
            MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table:6cf254f1-edd0-4f04-96bc-c9ad08b5a2c");
            MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table_field_list:6cf254f1-edd0-4f04-96bc-c9ad08b5a2c");
            MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table:sys_microistore");
            MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:diy_table_field_list:sys_microistore");
            
            return msgs;
        }
    }
}


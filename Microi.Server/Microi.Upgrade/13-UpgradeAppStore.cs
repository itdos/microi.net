using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Reflection;
using System.Text.RegularExpressions;
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
        public static string Version = "6.4.4.0";
        private static readonly HttpClient ResourceHttpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(8)
        };
        private const string OfficialResourceApiUrl = "https://api.itdos.com/apiengine/get-microi-upgrade-resource?OsClient=iTdos";
        private const string ImportPackageResourceName = "import-package.js";
        private const string PublishAiAppResourceName = "ai-app-publish-store.js";
        private const string BuildAiAppResourceName = "ai-app-build.js";
        private const string FormEnginePackageResourceName = "app.microi.form-engine.json";
        private const string ModuleEnginePackageResourceName = "app.microi.module-engine.json";
        private const string SaaSEnginePackageResourceName = "app.microi.saas-engine.json";
        private const string AppStorePackageResourceName = "app.microi.store.json";
        private const string AppStoreMenuId = "61b7faee-35b2-4571-add2-5231a355f368";
        // Jint 4.14 的 MemoryLimitConstraint 统计一次执行的累计分配量，而非实时存活堆。
        // 大型官方应用包在 2GB 限额下会于约 2055MB 被终止；仅提升受信任导入器，
        // 普通接口引擎仍遵守原有默认值与平台硬上限。
        private const int ImporterLimitMemoryMb = 3072;

        private static readonly string[] RequiredResourceNames =
        {
            ImportPackageResourceName,
            PublishAiAppResourceName,
            BuildAiAppResourceName,
            FormEnginePackageResourceName,
            ModuleEnginePackageResourceName,
            SaaSEnginePackageResourceName,
            AppStorePackageResourceName
        };

        private static readonly Dictionary<string, string> ExpectedPackageNames = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            { FormEnginePackageResourceName, "表单引擎" },
            { ModuleEnginePackageResourceName, "模块引擎" },
            { SaaSEnginePackageResourceName, "SaaS引擎" },
            { AppStorePackageResourceName, "应用商城" }
        };

        /// <summary>
        /// 全局数据库版本可能已经高于本升级号，但租户库中的导入器仍可能因历史应用包覆盖而停留在旧版。
        /// 因此必须单独检查导入器能力标记，不能只依赖 SysConfig.Version。
        /// </summary>
        public static Task<bool> NeedRefreshAsync(string osClient)
        {
            if (IsOfficialSourceTenant(osClient))
            {
                Console.WriteLine($"Microi：【基础应用升级】租户[{osClient}]是吾码官方应用源，跳过基础应用包完整性回写检查。");
                return Task.FromResult(false);
            }

            try
            {
                // 老库的物理表与 diy_table/diy_field 元数据经常不同步。启动完整性判断如果继续走
                // FormEngine，会把“物理数据存在但元数据缺失”误判为需要升级并在每次启动重复导入。
                // 这里仅做参数化只读查询，以物理表事实为准；任何缺表/缺列异常仍安全地触发修复。
                var client = OsClient.GetClient(osClient);
                if (client?.Db == null) return RefreshRequired(osClient, "未找到租户数据库连接");

                var code = client.Db.FromSql(@"SELECT ApiV8Code FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "import-microi-store-package")
                    .ToScalar()?.ToString() ?? string.Empty;
                var importerLimitMemoryText = client.Db.FromSql(@"SELECT LimitMemory FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "import-microi-store-package")
                    .ToScalar()?.ToString();
                var importerLimitRecursionText = client.Db.FromSql(@"SELECT LimitRecursion FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "import-microi-store-package")
                    .ToScalar()?.ToString();
                var versionMatch = Regex.Match(code, @"Version\s*:\s*v?(\d+\.\d+\.\d+)", RegexOptions.IgnoreCase);
                var importerVersion = new System.Version(0, 0, 0);
                if (!versionMatch.Success ||
                    !System.Version.TryParse(versionMatch.Groups[1].Value, out importerVersion) ||
                    importerVersion < new System.Version(1, 9, 8) ||
                    !long.TryParse(importerLimitMemoryText, out var importerLimitMemory) ||
                    importerLimitMemory < ImporterLimitMemoryMb ||
                    !long.TryParse(importerLimitRecursionText, out var importerLimitRecursion) ||
                    importerLimitRecursion != PrivilegedEngineLimitRecursion ||
                    !code.Contains("field_primary_recovered_") ||
                    !code.Contains("rename_skipped_target_exists_") ||
                    !code.Contains("preserve_interface_engine_pagetabs_") ||
                    !code.Contains("System.DateTime.Now.ToString") ||
                    !code.Contains("applicationSha256Base64") ||
                    !code.Contains("MicroServiceMenusPreserved") ||
                    !code.Contains("sourceExpected") ||
                    !code.Contains("validationSourceExpected") ||
                    !code.Contains("stableMenuUrl") ||
                    !code.Contains("normalizeRouteMeta") ||
                    !code.Contains("recoverBoundMicroserviceMenus") ||
                    !code.Contains("preservedLegacyUrl") ||
                    !code.Contains("preserve_existing_menu_visibility_") ||
                    !code.Contains("upsertApplicationRow('sys_microistore'") ||
                    !code.Contains("official_marketplace_install_stat") ||
                    !code.Contains("SKIP_MOVE_FOR_REUSED_BUILD_V1") ||
                    !code.Contains("MICRO_APP_PUBLIC_HDFS_PATH_V1") ||
                    !code.Contains("DB_RUNTIME_BUILD_ASSETS_V1") ||
                    !code.Contains("PRUNE_ASSET_IDS_WITH_DELFORM_V1") ||
                    !code.Contains("BACKGROUND_TASK_BOOTSTRAP_READINESS_V1") ||
                    !code.Contains("BACKGROUND_TASK_RUNTIME_SCOPE_V1") ||
                    !code.Contains("APPLICATION_ASSET_BACKGROUND_CHUNKS_V1") ||
                    !code.Contains("ASSET_METADATA_WITHOUT_SECOND_DECODE_V1") ||
                    !code.Contains("DATASET_INSERT_IF_MISSING_V1") ||
                    !code.Contains("PACKAGE_API_ENGINE_READBACK_V1") ||
                    !code.Contains("API_ENGINE_RESOURCE_BASELINE_V1") ||
                    !code.Contains("TENANT_API_ENGINE_POLICY_IMMUTABLE_V1") ||
                    !code.Contains("SKIP_INSTALL_COUNT_WITHOUT_MARKETPLACE_ID_V1") ||
                    !code.Contains("LEGACY_INSTALL_VERSION_IDENTITY_FALLBACK_V1") ||
                    !code.Contains("MYSQL_ROW_SIZE_OFFPAGE_FALLBACK_V1"))
                {
                    return RefreshRequired(osClient, "应用数据包导入器缺失或版本过低");
                }

                // 页面级按钮与依赖接口必须一起存在。历史包曾只更新 PageBtns，却没有
                // 把 bulk-import-microi-store-packages 写入目标租户；ServerVersion 与
                // sys_microistoreversion 都不能证明这个运行时依赖已经落库。
                var bulkEngineRow = client.Db.FromSql(@"SELECT ApiV8Code, IsEnable, StopHttp FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "bulk-import-microi-store-packages")
                    .First<dynamic>();
                var bulkEngine = bulkEngineRow == null ? null : JObject.FromObject(bulkEngineRow);
                var bulkCode = bulkEngine?.Value<string>("ApiV8Code") ?? string.Empty;
                var bulkVersionMatch = Regex.Match(bulkCode, @"Version\s*:\s*v?(\d+\.\d+\.\d+)", RegexOptions.IgnoreCase);
                var bulkVersion = new System.Version(0, 0, 0);
                if (bulkEngine == null
                    || !bulkVersionMatch.Success
                    || !System.Version.TryParse(bulkVersionMatch.Groups[1].Value, out bulkVersion)
                    || bulkVersion < new System.Version(1, 1, 1)
                    || bulkEngine.Value<int?>("IsEnable") != 1
                    || bulkEngine.Value<int?>("StopHttp") != 0
                    || !bulkCode.Contains("BACKGROUND_TASK_CHECKPOINT_PLAN_V2")
                    || !bulkCode.Contains("BACKGROUND_TASK_TRUSTED_BOOTSTRAP_V1"))
                {
                    return RefreshRequired(osClient, "应用商城全部安装/更新接口缺失或版本过低");
                }

                var publisherCode = client.Db.FromSql(@"SELECT ApiV8Code FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "ai_app_publish_store")
                    .ToScalar()?.ToString() ?? string.Empty;
                var dbType = client.OsClientModel?["DbType"]?.Val<string>();
                var publisherSettingsSql = string.Equals(dbType, "SqlServer", StringComparison.OrdinalIgnoreCase)
                    ? @"SELECT [StopHttp], [Timeout], [MaxStatements], [LimitMemory], [LimitRecursion], [Lock]
FROM [sys_apiengine]
WHERE [ApiEngineKey]=@p0 AND ([IsDeleted]=0 OR [IsDeleted] IS NULL)"
                    : @"SELECT `StopHttp`, `Timeout`, `MaxStatements`, `LimitMemory`, `LimitRecursion`, `Lock`
FROM `sys_apiengine`
WHERE `ApiEngineKey`=@p0 AND (`IsDeleted`=0 OR `IsDeleted` IS NULL)";
                var publisherSettingsRow = client.Db.FromSql(publisherSettingsSql)
                    .AddInParameter("p0", "ai_app_publish_store")
                    .First<dynamic>();
                var publisherSettings = publisherSettingsRow == null
                    ? null
                    : JObject.FromObject(publisherSettingsRow);
                var publisherVersionMatch = Regex.Match(publisherCode, @"Version\s*:\s*v?(\d+\.\d+\.\d+)", RegexOptions.IgnoreCase);
                if (!publisherVersionMatch.Success ||
                    !System.Version.TryParse(publisherVersionMatch.Groups[1].Value, out var publisherVersion) ||
                    publisherVersion < new System.Version(1, 6, 0) ||
                    !publisherCode.Contains("OfflineSelfContained") ||
                    !publisherCode.Contains("IncludeSource: includeSource") ||
                    !publisherCode.Contains("action === 'PackageOnly'") ||
                    !publisherCode.Contains("ReturnPackageModel") ||
                    !publisherCode.Contains("buildApiEngineResourcePolicies") ||
                    !publisherCode.Contains("GetFormData('sys_microistore'") ||
                    !publisherCode.Contains("ApplicationType || app.AppType") ||
                    !publisherCode.Contains("SOURCE_BUILD_ARCHIVE_ROOTS_V1") ||
                    !HasExpectedPublisherSettings(publisherSettings))
                {
                    return RefreshRequired(osClient, "AI应用离线发布器缺失、自包含能力过低或运行限额不足");
                }

                var builderCode = client.Db.FromSql(@"SELECT ApiV8Code FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "ai_app_build")
                    .ToScalar()?.ToString() ?? string.Empty;
                var builderVersionMatch = Regex.Match(builderCode, @"Version\s*:\s*v?(\d+\.\d+\.\d+)", RegexOptions.IgnoreCase);
                if (!builderVersionMatch.Success ||
                    !System.Version.TryParse(builderVersionMatch.Groups[1].Value, out var builderVersion) ||
                    builderVersion < new System.Version(1, 4, 5) ||
                    !builderCode.Contains("TENANT_RUNTIME_CONTEXT_V1") ||
                    !builderCode.Contains("UNIFIED_UNIAPP_PREVIEW_SHELL_V1") ||
                    !builderCode.Contains("injectRuntimeContext") ||
                    !builderCode.Contains("V8.SysConfig && V8.SysConfig.ApiBase"))
                {
                    return RefreshRequired(osClient, "AI应用构建器缺少按当前租户注入运行时上下文的能力");
                }

                foreach (var engineKey in new[]
                {
                    "ai_app_prepare_store_assets",
                    "ai_app_download_build_zip",
                    "ai_app_download_source_zip"
                })
                {
                    var engineCode = client.Db.FromSql(@"SELECT ApiV8Code FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                        .AddInParameter("p0", engineKey)
                        .ToScalar()?.ToString() ?? string.Empty;
                    if (!engineCode.DosIsNullOrWhiteSpace()
                        && ((engineCode.Contains("DateNow(") && !engineCode.Contains("var nowText = function"))
                            || engineCode.Contains("new System.IO.MemoryStream")))
                    {
                        return RefreshRequired(osClient, $"AI应用打包接口[{engineKey}]仍依赖客户全局DateNow或System.IO");
                    }
                    if (string.Equals(engineKey, "ai_app_download_build_zip", StringComparison.Ordinal)
                        && (!engineCode.Contains("Version: v1.2.0")
                            || !engineCode.Contains("REAL_BUILD_ZIP_ASSETS_V1")
                            || !engineCode.Contains("buildArchivePath")))
                    {
                        return RefreshRequired(osClient, "AI应用 BuildZip 仍未携带完整真实编译资产");
                    }
                    if (string.Equals(engineKey, "ai_app_download_source_zip", StringComparison.Ordinal)
                        && (!engineCode.Contains("Version: v1.2.0")
                            || !engineCode.Contains("SOURCE_ONLY_ZIP_ROOT_V1")
                            || !engineCode.Contains("sourceArchivePath")))
                    {
                        return RefreshRequired(osClient, "AI应用 SourceZip 仍混入包装根目录或编译资产");
                    }
                }

                // ServerVersion 只能说明某个后续步骤曾成功，不能证明商城安装完整。
                foreach (var tableName in new[] { "sys_microistore", "sys_microistoreversion" })
                {
                    var tableCount = client.Db.FromSql(@"SELECT COUNT(1) FROM diy_table
WHERE LOWER(Name)=LOWER(@p0) AND (IsDeleted=0 OR IsDeleted IS NULL)")
                        .AddInParameter("p0", tableName)
                        .ToScalar();
                    if (!HasRows(tableCount)) return RefreshRequired(osClient, $"缺少表单元数据[{tableName}]");
                }

                var unifiedFieldCount = client.Db.FromSql(@"SELECT COUNT(1) FROM diy_field f
INNER JOIN diy_table t ON t.Id=f.TableId
WHERE LOWER(t.Name)=LOWER(@p0)
  AND f.Name IN ('AppKey','ApplicationType','Category','PublisherType','ViewCount','InstallCount')
  AND (t.IsDeleted=0 OR t.IsDeleted IS NULL)
  AND (f.IsDeleted=0 OR f.IsDeleted IS NULL)")
                    .AddInParameter("p0", "sys_microistore")
                    .ToScalar();
                if (!long.TryParse(unifiedFieldCount?.ToString(), out var unifiedFields) || unifiedFields < 6)
                {
                    return RefreshRequired(osClient, "应用商城缺少统一应用类型、分类或统计字段");
                }

                var menuId = client.Db.FromSql(@"SELECT Id FROM sys_menu
WHERE ModuleEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "sys_microistore")
                    .ToScalar()?.ToString();
                if (menuId.DosIsNullOrWhiteSpace()) return RefreshRequired(osClient, "缺少应用商城菜单");

                var relatedMenuCount = client.Db.FromSql(@"SELECT COUNT(1) FROM sys_menu
WHERE Id IN (@p0,@p1) AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "01KXFSG7MZ40CY8KCWCZZZJH2M")
                    .AddInParameter("p1", "01KXFSG8153B3VZPZ45WNCCFHR")
                    .ToScalar();
                if (!long.TryParse(relatedMenuCount?.ToString(), out var relatedCount) || relatedCount < 2)
                {
                    return RefreshRequired(osClient, "缺少应用商城关联模块");
                }

                // sys_menu 的 diy_table.Id 在部分早期客户库中并非官方固定 Id，
                // 必须按表名关联查找，避免完整性检查永远误判并重复安装应用商城。
                var pageTabsConfig = client.Db.FromSql(@"SELECT f.Config
FROM diy_field f
INNER JOIN diy_table t ON t.Id=f.TableId
WHERE LOWER(t.Name)=LOWER(@p0)
  AND f.Name=@p1
  AND (t.IsDeleted=0 OR t.IsDeleted IS NULL)
  AND (f.IsDeleted=0 OR f.IsDeleted IS NULL)")
                    .AddInParameter("p0", "sys_menu")
                    .AddInParameter("p1", "PageTabs")
                    .ToScalar()?.ToString() ?? string.Empty;
                if (!pageTabsConfig.Contains("TargetSysMenuId"))
                {
                    return RefreshRequired(osClient, "页面多Tab缺少关联模块配置");
                }

                var appStorePageTabs = client.Db.FromSql(@"SELECT PageTabs FROM sys_menu
WHERE Id=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", menuId)
                    .ToScalar()?.ToString() ?? string.Empty;
                if (!appStorePageTabs.Contains("01KXFSG7MZ40CY8KCWCZZZJH2M") ||
                    !appStorePageTabs.Contains("01KXFSG8153B3VZPZ45WNCCFHR") ||
                    !appStorePageTabs.Contains("AI应用") ||
                    appStorePageTabs.Contains("官方应用") ||
                    appStorePageTabs.Contains("社区应用"))
                {
                    return RefreshRequired(osClient, "应用商城页面多Tab尚未合并为AI应用");
                }

                var marketplaceListCode = client.Db.FromSql(@"SELECT ApiV8Code FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)")
                    .AddInParameter("p0", "get-microi-store")
                    .ToScalar()?.ToString() ?? string.Empty;
                if (!marketplaceListCode.Contains("PublisherTypes") ||
                    !marketplaceListCode.Contains("StoreInstallStatus") ||
                    !marketplaceListCode.Contains("ApplicationTypes"))
                {
                    return RefreshRequired(osClient, "应用商城列表缺少统一筛选或安装状态兼容");
                }

                var roleLimitCount = client.Db.FromSql(@"SELECT COUNT(1) FROM sys_rolelimit
WHERE RoleId=@p0 AND FkId=@p1 AND Type=@p2")
                    .AddInParameter("p0", "5db47859-35a3-411a-a1f7-99482e057d24")
                    .AddInParameter("p1", menuId)
                    .AddInParameter("p2", "Menu")
                    .ToScalar();
                if (!HasRows(roleLimitCount)) return RefreshRequired(osClient, "缺少应用商城超级管理员菜单权限");

                return Task.FromResult(false);
            }
            catch (Exception ex)
            {
                return RefreshRequired(osClient, "完整性检查异常：" + ex.Message);
            }
        }

        private static bool HasRows(object value)
        {
            return long.TryParse(value?.ToString(), out var count) && count > 0;
        }

        private static bool HasExpectedPublisherSettings(JObject settings)
        {
            if (settings == null) return false;
            return TryGetLong(settings, "StopHttp", out var stopHttp) && stopHttp == 0
                   && TryGetLong(settings, "Timeout", out var timeout) && timeout >= 3600
                   && TryGetLong(settings, "MaxStatements", out var maxStatements) && maxStatements >= 100000000
                   && TryGetLong(settings, "LimitMemory", out var limitMemory) && limitMemory >= 2048
                   && TryGetLong(settings, "LimitRecursion", out var limitRecursion) && limitRecursion == PrivilegedEngineLimitRecursion
                   && TryGetLong(settings, "Lock", out var lockValue) && lockValue == 1;
        }

        // These official engines historically persisted 10000 although the V8 runtime
        // hard ceiling is 5000 by default. Keep the privileged engines at the effective
        // ceiling without writing a value that the runtime will silently truncate.
        private static int PrivilegedEngineLimitRecursion =>
            Math.Min(5000, CreateV8EngineParam.MaxLimitRecursion);

        private static bool TryGetLong(JObject model, string name, out long value)
        {
            value = 0;
            var token = model.GetValue(name, StringComparison.OrdinalIgnoreCase);
            return token != null && long.TryParse(token.ToString(), out value);
        }

        private static Task<bool> RefreshRequired(string osClient, string reason)
        {
            Console.WriteLine($"Microi：【基础应用升级】租户[{osClient}]需要修复：{reason}。");
            return Task.FromResult(true);
        }

        /// <summary>
        /// 官方应用源数据库不能被随程序集发布的商城基线包反向覆盖。
        /// 客户可以使用同名 iTdos 租户，因此租户名本身绝不能作为判断依据。
        /// 统一调用 Microi.net 的 LicenseService 判断当前服务器是否拥有签发私钥；
        /// 客户 NuGet/发布包不包含私钥，即使租户也叫 iTdos 仍会正常升级。
        /// </summary>
        internal static bool IsOfficialSourceTenant(string osClient)
        {
            return Microi.License.LicenseService.IsOfficialPlatform(osClient);
        }

        private static readonly string[] CoreNullableTables =
        {
            "diy_table",
            "diy_field",
            "sys_user",
            "sys_menu",
            "sys_role",
            "sys_osclients"
        };
        
        private static Dictionary<string, string> LoadBundledResources()
        {
            var resources = new Dictionary<string, string>(StringComparer.Ordinal);
            var assembly = typeof(UpgradeAppStore).GetTypeInfo().Assembly;
            foreach (var resourceName in RequiredResourceNames)
            {
                var manifestName = "Microi.Upgrade.Resource." + resourceName;
                using (var stream = assembly.GetManifestResourceStream(manifestName))
                {
                    if (stream == null)
                    {
                        throw new InvalidOperationException($"程序集缺少基础升级资源[{resourceName}]。请刷新资源后重新构建。");
                    }
                    using (var reader = new StreamReader(stream))
                    {
                        var content = reader.ReadToEnd();
                        ValidateResourceContent(resourceName, content);
                        resources[resourceName] = content;
                    }
                }
            }
            return resources;
        }

        private static async Task<Dictionary<string, string>> LoadUpgradeResourcesAsync()
        {
            var bundledResources = LoadBundledResources();
            try
            {
                var onlineResourceNames = RequiredResourceNames
                    .Where(resourceName => !string.Equals(resourceName, BuildAiAppResourceName, StringComparison.Ordinal));
                var pairs = await Task.WhenAll(onlineResourceNames.Select(async resourceName =>
                    new KeyValuePair<string, string>(resourceName, await DownloadOfficialResourceAsync(resourceName))));
                Console.WriteLine("Microi：【基础应用升级】官方资源整组校验成功，使用在线最新版。");
                var resources = pairs.ToDictionary(item => item.Key, item => item.Value, StringComparer.Ordinal);
                // 构建器随当前服务器版本发布，确保客户即使连接到较旧的官方资源服务，
                // 也不会再次安装缺少租户 ApiBase/OsClient 上下文的旧入口发布逻辑。
                resources[BuildAiAppResourceName] = bundledResources[BuildAiAppResourceName];
                return resources;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Microi：【基础应用升级】官方资源不可用，整组回退到程序集内置资源：{ex.Message}");
                return bundledResources;
            }
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
                var versionMatch = Regex.Match(content, @"Version\s*:\s*v?(\d+\.\d+\.\d+)", RegexOptions.IgnoreCase);
                if (!versionMatch.Success ||
                    !System.Version.TryParse(versionMatch.Groups[1].Value, out var importerVersion) ||
                    importerVersion < new System.Version(1, 9, 8) ||
                    !content.Contains("applicationSha256Base64") ||
                    !content.Contains("field_primary_recovered_") ||
                    !content.Contains("preserve_interface_engine_pagetabs_") ||
                    !content.Contains("System.DateTime.Now.ToString") ||
                    !content.Contains("rename_skipped_target_exists_") ||
                    !content.Contains("MicroServiceMenusPreserved") ||
                    !content.Contains("sourceExpected") ||
                    !content.Contains("validationSourceExpected") ||
                    !content.Contains("stableMenuUrl") ||
                    !content.Contains("normalizeRouteMeta") ||
                    !content.Contains("recoverBoundMicroserviceMenus") ||
                    !content.Contains("preservedLegacyUrl") ||
                    !content.Contains("preserve_existing_menu_visibility_") ||
                    !content.Contains("SKIP_MOVE_FOR_REUSED_BUILD_V1") ||
                    !content.Contains("MICRO_APP_PUBLIC_HDFS_PATH_V1") ||
                    !content.Contains("DB_RUNTIME_BUILD_ASSETS_V1") ||
                    !content.Contains("PRUNE_ASSET_IDS_WITH_DELFORM_V1") ||
                    !content.Contains("BACKGROUND_TASK_BOOTSTRAP_READINESS_V1") ||
                    !content.Contains("BACKGROUND_TASK_RUNTIME_SCOPE_V1") ||
                    !content.Contains("APPLICATION_ASSET_BACKGROUND_CHUNKS_V1") ||
                    !content.Contains("ASSET_METADATA_WITHOUT_SECOND_DECODE_V1") ||
                    !content.Contains("DATASET_INSERT_IF_MISSING_V1") ||
                    !content.Contains("PACKAGE_API_ENGINE_READBACK_V1") ||
                    !content.Contains("API_ENGINE_RESOURCE_BASELINE_V1") ||
                    !content.Contains("TENANT_API_ENGINE_POLICY_IMMUTABLE_V1") ||
                    !content.Contains("SKIP_INSTALL_COUNT_WITHOUT_MARKETPLACE_ID_V1") ||
                    !content.Contains("LEGACY_INSTALL_VERSION_IDENTITY_FALLBACK_V1") ||
                    !content.Contains("MYSQL_ROW_SIZE_OFFPAGE_FALLBACK_V1"))
                {
                    throw new InvalidOperationException($"升级资源[{resourceName}]版本过旧或缺少幂等安装保护，拒绝覆盖客户数据库。");
                }
                return;
            }

            if (string.Equals(resourceName, PublishAiAppResourceName, StringComparison.Ordinal))
            {
                var publisherVersionMatch = Regex.Match(content, @"Version\s*:\s*v?(\d+\.\d+\.\d+)", RegexOptions.IgnoreCase);
                if (!content.Contains("ai_app_publish_store") ||
                    !publisherVersionMatch.Success ||
                    !System.Version.TryParse(publisherVersionMatch.Groups[1].Value, out var publisherVersion) ||
                    publisherVersion < new System.Version(1, 6, 0) ||
                    !content.Contains("OfflineSelfContained") ||
                    !content.Contains("IncludeSource: includeSource") ||
                    !content.Contains("action === 'PackageOnly'") ||
                    !content.Contains("ReturnPackageModel") ||
                    !content.Contains("buildApiEngineResourcePolicies") ||
                    !content.Contains("SOURCE_BUILD_ARCHIVE_ROOTS_V1"))
                {
                    throw new InvalidOperationException($"升级资源[{resourceName}]内容校验失败，未找到目标接口Key。");
                }
                return;
            }

            if (string.Equals(resourceName, BuildAiAppResourceName, StringComparison.Ordinal))
            {
                var builderVersionMatch = Regex.Match(content, @"Version\s*:\s*v?(\d+\.\d+\.\d+)", RegexOptions.IgnoreCase);
                if (!content.Contains("ApiEngineKey: ai_app_build") ||
                    !builderVersionMatch.Success ||
                    !System.Version.TryParse(builderVersionMatch.Groups[1].Value, out var builderVersion) ||
                    builderVersion < new System.Version(1, 4, 5) ||
                    !content.Contains("TENANT_RUNTIME_CONTEXT_V1") ||
                    !content.Contains("UNIFIED_UNIAPP_PREVIEW_SHELL_V1") ||
                    !content.Contains("injectRuntimeContext") ||
                    !content.Contains("V8.SysConfig && V8.SysConfig.ApiBase"))
                {
                    throw new InvalidOperationException($"升级资源[{resourceName}]缺少当前租户运行时上下文注入能力。");
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

            if (string.Equals(resourceName, AppStorePackageResourceName, StringComparison.Ordinal))
            {
                var packageVersionText = package["PackageInfo"]?["Version"]?.ToString()?.TrimStart('v', 'V');
                var packageEngines = package["SysApiEngines"] as JArray;
                var buildZipEngineCode = packageEngines?
                    .FirstOrDefault(item => string.Equals(item?["ApiEngineKey"]?.ToString(), "ai_app_download_build_zip", StringComparison.Ordinal))?
                    ["ApiV8Code"]?.ToString() ?? string.Empty;
                var sourceZipEngineCode = packageEngines?
                    .FirstOrDefault(item => string.Equals(item?["ApiEngineKey"]?.ToString(), "ai_app_download_source_zip", StringComparison.Ordinal))?
                    ["ApiV8Code"]?.ToString() ?? string.Empty;
                var importerEngine = packageEngines?
                    .FirstOrDefault(item => string.Equals(item?["ApiEngineKey"]?.ToString(), "import-microi-store-package", StringComparison.Ordinal));
                var importerEngineCode = importerEngine?["ApiV8Code"]?.ToString() ?? string.Empty;
                var importerEngineVersionText = importerEngine?["Version"]?.ToString()?.TrimStart('v', 'V');
                var bulkEngine = packageEngines?
                    .FirstOrDefault(item => string.Equals(item?["ApiEngineKey"]?.ToString(), "bulk-import-microi-store-packages", StringComparison.Ordinal));
                var bulkEngineCode = bulkEngine?["ApiV8Code"]?.ToString() ?? string.Empty;
                var bulkEngineVersionText = bulkEngine?["Version"]?.ToString()?.TrimStart('v', 'V');
                if (!System.Version.TryParse(packageVersionText, out var packageVersion) ||
                    packageVersion < new System.Version(7, 0, 13) ||
                    !System.Version.TryParse(importerEngineVersionText, out var embeddedImporterVersion) ||
                    embeddedImporterVersion < new System.Version(1, 9, 8) ||
                    !System.Version.TryParse(bulkEngineVersionText, out var embeddedBulkVersion) ||
                    embeddedBulkVersion < new System.Version(1, 1, 1) ||
                    bulkEngine?["IsEnable"]?.Value<int>() != 1 ||
                    bulkEngine?["StopHttp"]?.Value<int>() != 0 ||
                    !content.Contains("TargetSysMenuId") ||
                    !content.Contains("01KXFSG7MZ40CY8KCWCZZZJH2M") ||
                    !content.Contains("01KXFSG8153B3VZPZ45WNCCFHR") ||
                    !content.Contains("RunBackground('bulk-import-microi-store-packages'") ||
                    !buildZipEngineCode.Contains("REAL_BUILD_ZIP_ASSETS_V1") ||
                    !sourceZipEngineCode.Contains("SOURCE_ONLY_ZIP_ROOT_V1") ||
                    !importerEngineCode.Contains("SKIP_MOVE_FOR_REUSED_BUILD_V1") ||
                    !importerEngineCode.Contains("MICRO_APP_PUBLIC_HDFS_PATH_V1") ||
                    !importerEngineCode.Contains("DB_RUNTIME_BUILD_ASSETS_V1") ||
                    !importerEngineCode.Contains("PRUNE_ASSET_IDS_WITH_DELFORM_V1") ||
                    !importerEngineCode.Contains("BACKGROUND_TASK_BOOTSTRAP_READINESS_V1") ||
                    !importerEngineCode.Contains("BACKGROUND_TASK_RUNTIME_SCOPE_V1") ||
                    !importerEngineCode.Contains("APPLICATION_ASSET_BACKGROUND_CHUNKS_V1") ||
                    !importerEngineCode.Contains("ASSET_METADATA_WITHOUT_SECOND_DECODE_V1") ||
                    !importerEngineCode.Contains("DATASET_INSERT_IF_MISSING_V1") ||
                    !importerEngineCode.Contains("PACKAGE_API_ENGINE_READBACK_V1") ||
                    !importerEngineCode.Contains("API_ENGINE_RESOURCE_BASELINE_V1") ||
                    !importerEngineCode.Contains("TENANT_API_ENGINE_POLICY_IMMUTABLE_V1") ||
                    !importerEngineCode.Contains("SKIP_INSTALL_COUNT_WITHOUT_MARKETPLACE_ID_V1") ||
                    !importerEngineCode.Contains("LEGACY_INSTALL_VERSION_IDENTITY_FALLBACK_V1") ||
                    !importerEngineCode.Contains("MYSQL_ROW_SIZE_OFFPAGE_FALLBACK_V1") ||
                    !bulkEngineCode.Contains("BACKGROUND_TASK_CHECKPOINT_PLAN_V2") ||
                    !bulkEngineCode.Contains("BACKGROUND_TASK_TRUSTED_BOOTSTRAP_V1"))
                {
                    throw new InvalidOperationException($"升级资源[{resourceName}]版本过旧或缺少页面Tab关联模块配置，拒绝覆盖客户数据库。");
                }
            }
        }

        private static async Task InstallUpgradePackage(string osClient, List<string> msgs, string resourceName, string packageName, IReadOnlyDictionary<string, string> resources)
        {
            var packageContent = NormalizePackageExecutionLimits(resources[resourceName]);
            Console.WriteLine($"Microi：【基础应用升级】开始导入{packageName}：{resourceName}");
            var installResult = await MicroiEngine.ApiEngine.RunAsync("import-microi-store-package", new
            {
                OsClient = osClient,
                Package = packageContent
            });
            if (installResult.Code != 1)
            {
                msgs.Add($"{packageName}导入失败：{installResult.Msg}{FormatInstallFailureDetails(installResult.Data)}");
                return;
            }

            Console.WriteLine($"Microi：【基础应用升级】{packageName}导入完成。");
        }

        private static string FormatInstallFailureDetails(object data)
        {
            try
            {
                if (data == null) return string.Empty;
                var token = data as JToken ?? JToken.FromObject(data);
                var detail = (token as JObject)?.Properties().FirstOrDefault(property =>
                    property.Name.StartsWith("失败详情", StringComparison.Ordinal));
                if (detail?.Value == null) return string.Empty;

                // 只记录导入器明确返回的失败列表，不把整份应用包或其它统计信息写入日志。
                var detailJson = detail.Value.ToString(Formatting.None);
                const int maxLogLength = 4000;
                if (detailJson.Length > maxLogLength)
                {
                    detailJson = detailJson.Substring(0, maxLogLength) + "...(已截断)";
                }
                return $"；{detail.Name}：{detailJson}";
            }
            catch
            {
                // 诊断信息不得覆盖原始失败，也不能让自动升级因序列化再次异常。
                return string.Empty;
            }
        }

        private static string NormalizePackageExecutionLimits(string packageContent)
        {
            if (string.IsNullOrWhiteSpace(packageContent)) return packageContent;

            var package = JObject.Parse(packageContent);
            var changed = false;
            foreach (var engine in package["SysApiEngines"]?.Children<JObject>() ?? Enumerable.Empty<JObject>())
            {
                var persistedLimit = engine["LimitRecursion"]?.Value<int>() ?? 0;
                if (persistedLimit <= PrivilegedEngineLimitRecursion) continue;
                engine["LimitRecursion"] = PrivilegedEngineLimitRecursion;
                changed = true;
            }
            return changed ? package.ToString(Formatting.None) : packageContent;
        }

        private static void EnsureImporterExecutionLimits(string osClient)
        {
            var client = OsClient.GetClient(osClient);
            if (client?.Db == null) throw new InvalidOperationException($"未找到租户[{osClient}]数据库连接。");
            var dbType = client.OsClientModel?["DbType"]?.Val<string>();
            var sql = string.Equals(dbType, "SqlServer", StringComparison.OrdinalIgnoreCase)
                ? @"UPDATE [sys_apiengine] SET [Timeout]=@p0, [MaxStatements]=@p1, [LimitMemory]=@p2, [LimitRecursion]=@p3, [Lock]=1 WHERE [ApiEngineKey]=@p4"
                : @"UPDATE `sys_apiengine` SET `Timeout`=@p0, `MaxStatements`=@p1, `LimitMemory`=@p2, `LimitRecursion`=@p3, `Lock`=1 WHERE `ApiEngineKey`=@p4";
            client.Db.FromSql(sql)
                .AddInParameter("p0", 3600)
                .AddInParameter("p1", 100000000)
                .AddInParameter("p2", ImporterLimitMemoryMb)
                .AddInParameter("p3", PrivilegedEngineLimitRecursion)
                .AddInParameter("p4", "import-microi-store-package")
                .ExecuteNonQuery();
        }

        private static async Task EnsureImporterExecutionLimitsAndInvalidateAsync(string osClient)
        {
            EnsureImporterExecutionLimits(osClient);
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:import-microi-store-package");
            await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:/apiengine/import-microi-store-package");
        }

        private static void EnsurePublisherExecutionSettings(string osClient)
        {
            var client = OsClient.GetClient(osClient);
            if (client?.Db == null) throw new InvalidOperationException($"未找到租户[{osClient}]数据库连接。");
            var dbType = client.OsClientModel?["DbType"]?.Val<string>();
            var sql = string.Equals(dbType, "SqlServer", StringComparison.OrdinalIgnoreCase)
                ? @"UPDATE [sys_apiengine] SET [StopHttp]=0, [Timeout]=@p0, [MaxStatements]=@p1, [LimitMemory]=@p2, [LimitRecursion]=@p3, [Lock]=1 WHERE [ApiEngineKey]=@p4"
                : @"UPDATE `sys_apiengine` SET `StopHttp`=0, `Timeout`=@p0, `MaxStatements`=@p1, `LimitMemory`=@p2, `LimitRecursion`=@p3, `Lock`=1 WHERE `ApiEngineKey`=@p4";
            client.Db.FromSql(sql)
                .AddInParameter("p0", 3600)
                .AddInParameter("p1", 100000000)
                .AddInParameter("p2", 2048)
                .AddInParameter("p3", PrivilegedEngineLimitRecursion)
                .AddInParameter("p4", "ai_app_publish_store")
                .ExecuteNonQuery();
        }

        private static async Task EnsureAiAppBuilderAsync(
            string osClient,
            List<string> msgs,
            IReadOnlyDictionary<string, string> resources)
        {
            var engineCode = resources[BuildAiAppResourceName];
            var existing = await MicroiEngine.FormEngine.GetFormDataAsync("sys_apiengine", new
            {
                OsClient = osClient,
                _Where = new List<object>
                {
                    new List<object> { "ApiEngineKey", "=", "ai_app_build" }
                },
                _SelectFields = new[] { "Id" }
            });
            var model = new
            {
                OsClient = osClient,
                ApiName = "AI应用构建发布",
                ApiEngineKey = "ai_app_build",
                ApiAddress = "/apiengine/ai_app_build",
                IsEnable = 1,
                StopHttp = 0,
                AllowAnonymous = 0,
                Timeout = 600,
                MaxStatements = 100000000,
                LimitMemory = 2048,
                LimitRecursion = PrivilegedEngineLimitRecursion,
                Lock = 0,
                Version = "v1.4.5",
                ApiV8Code = engineCode
            };
            DosResult result;
            if (existing.Code == 1 && existing.Data != null)
            {
                result = await UpgradeTrustedFormEngine.UpdateAsync("sys_apiengine", osClient, new
                {
                    Id = (string)existing.Data.Id,
                    model.OsClient,
                    model.ApiName,
                    model.ApiEngineKey,
                    model.ApiAddress,
                    model.IsEnable,
                    model.StopHttp,
                    model.AllowAnonymous,
                    model.Timeout,
                    model.MaxStatements,
                    model.LimitMemory,
                    model.LimitRecursion,
                    model.Lock,
                    model.Version,
                    model.ApiV8Code
                });
            }
            else
            {
                result = await UpgradeTrustedFormEngine.AddAsync("sys_apiengine", osClient, model);
            }
            if (result.Code != 1)
            {
                msgs.Add("AI应用构建器升级失败：" + result.Msg);
                return;
            }
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:ai_app_build");
            await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:/apiengine/ai_app_build");
            if (existing.Code == 1 && existing.Data != null)
            {
                await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{(string)existing.Data.Id}");
            }
        }

        private static async Task EnsureAiPackagingTimeFallback(string osClient, List<string> msgs)
        {
            const string helper = @"// 平台接口必须自包含时间能力，不能覆盖或依赖客户系统设置中的全局V8。
var nowText = function (format) {
    var dateFormat = format || 'yyyy-MM-dd HH:mm:ss';
    try { if (typeof DateNow == 'function') return DateNow(dateFormat); } catch (dateNowError) { }
    try { return System.DateTime.Now.ToString(dateFormat); } catch (systemDateError) { }
    return new Date().toISOString().replace('T', ' ').substring(0, 19);
};

";
            const string controlledZipHelper = @"function buildZip(fileName, entries) {
  var zipResult = V8.Method.CreateZip({
    Entries: entries,
    MaxFileCount: 20000,
    MaxEntryBytes: 268435456,
    MaxTotalBytes: 2147483648
  });
  if (!zipResult || zipResult.Code !== 1 || !zipResult.Data) {
    return fail('创建ZIP失败：' + ((zipResult && zipResult.Msg) || '接口无返回'));
  }
  return ok({
    FileName: fileName,
    ContentType: 'application/zip',
    FileByteBase64: zipResult.Data.FileByteBase64,
    Size: zipResult.Data.Size || 0,
    Sha256: zipResult.Data.Sha256 || ''
  });
}

";
            try
            {
                var client = OsClient.GetClient(osClient);
                if (client?.Db == null)
                {
                    msgs.Add($"AI应用打包时间兼容修复失败：未找到租户[{osClient}]数据库连接。");
                    return;
                }

                foreach (var engineKey in new[]
                {
                    "ai_app_prepare_store_assets",
                    "ai_app_download_build_zip",
                    "ai_app_download_source_zip"
                })
                {
                    var dbType = client.OsClientModel?["DbType"]?.Val<string>();
                    var getEngineSql = string.Equals(dbType, "SqlServer", StringComparison.OrdinalIgnoreCase)
                        ? @"SELECT TOP 1 Id, ApiAddress, ApiV8Code FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL)"
                        : @"SELECT Id, ApiAddress, ApiV8Code FROM sys_apiengine
WHERE ApiEngineKey=@p0 AND (IsDeleted=0 OR IsDeleted IS NULL) LIMIT 1";
                    var engine = client.Db.FromSql(getEngineSql)
                        .AddInParameter("p0", engineKey)
                        .First<dynamic>();
                    if (engine == null) continue;

                    string code = Convert.ToString(engine.ApiV8Code) ?? string.Empty;
                    string engineId = Convert.ToString(engine.Id) ?? string.Empty;
                    string engineApiAddress = Convert.ToString(engine.ApiAddress) ?? string.Empty;
                    if (code.DosIsNullOrWhiteSpace()) continue;

                    var patchedCode = code;
                    if (patchedCode.Contains("DateNow(") && !patchedCode.Contains("var nowText = function"))
                    {
                        // 先替换平台脚本中的直接调用，再前置包含 DateNow 探测的局部 helper。
                        patchedCode = helper + Regex.Replace(patchedCode, @"\bDateNow\s*\(", "nowText(");
                    }
                    if (patchedCode.Contains("new System.IO.MemoryStream"))
                    {
                        patchedCode = Regex.Replace(
                            patchedCode,
                            @"function addZipText[\s\S]*?(?=var appId\s*=)",
                            controlledZipHelper,
                            RegexOptions.Multiline);
                    }
                    if (patchedCode == code) continue;
                    client.Db.FromSql(@"UPDATE sys_apiengine SET ApiV8Code=@p0 WHERE Id=@p1")
                        .AddInParameter("p0", patchedCode)
                        .AddInParameter("p1", engineId)
                        .ExecuteNonQuery();

                    var cache = MicroiEngine.CacheTenant.Cache(osClient);
                    await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{engineKey}");
                    if (!string.IsNullOrWhiteSpace(engineId))
                    {
                        await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{engineId}");
                    }
                    if (!string.IsNullOrWhiteSpace(engineApiAddress))
                    {
                        await cache.RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{engineApiAddress}");
                    }
                    Console.WriteLine($"Microi：【基础应用升级】已为[{engineKey}]补充局部时间回退/受控ZIP兼容，客户全局V8保持不变。");
                }
            }
            catch (Exception ex)
            {
                msgs.Add("AI应用打包时间兼容修复异常：" + ex.Message);
            }
        }

        private static async Task EnsureAppStoreAdminPermission(string osClient, string menuId, List<string> msgs)
        {
            var roleId = "5db47859-35a3-411a-a1f7-99482e057d24";
            var existing = await MicroiEngine.FormEngine.GetFormDataAsync("sys_rolelimit", new
            {
                OsClient = osClient,
                _Where = new List<object>
                {
                    new List<object> { "RoleId", "=", roleId },
                    new List<object> { "FkId", "=", menuId },
                    new List<object> { "Type", "=", "Menu" }
                },
                _SelectFields = new[] { "Id" }
            });
            if (existing.Code == 1 && existing.Data != null) return;

            var addResult = await UpgradeTrustedFormEngine.AddAsync("sys_rolelimit", osClient, new
            {
                OsClient = osClient,
                RoleId = roleId,
                FkId = menuId,
                Type = "Menu",
                Permission = "[\"Add\",\"Edit\",\"Del\",\"Export\",\"Import\"]"
            });
            if (addResult.Code != 1)
            {
                msgs.Add("应用商城超级管理员菜单权限补齐失败：" + addResult.Msg);
            }
        }

        /// <summary>
        /// 
        /// </summary>
        public async Task<List<string>> Run(string osClient)
        {
            var msgs = new List<string>();

            if (IsOfficialSourceTenant(osClient))
            {
                Console.WriteLine($"Microi：【基础应用升级】租户[{osClient}]是吾码官方应用源，跳过导入器及基础应用包回写；其它升级步骤不受影响。");
                return msgs;
            }

            // 在线资源必须整组成功才使用；断网、超时或任一资源校验失败时，整组使用
            // 当前程序集随版本发布的基线，确保客户更新后端即可自动获得应用商城。
            var resources = await LoadUpgradeResourcesAsync();

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
            if (importMicroiStorePackageResult.Code != 1
                && importMicroiStorePackageResult.Code != 2)
            {
                msgs.Add("读取应用商城导入器失败：" + importMicroiStorePackageResult.Msg);
            }
            else if (importMicroiStorePackageResult.Code == 2
                     || importMicroiStorePackageResult.Data == null)
            {
                var addImportMicroiStorePackageResult = await UpgradeTrustedFormEngine.AddAsync("sys_apiengine", osClient, new
                {
                    ApiName = "[应用商城]导入Microi应用数据包",
                    ApiEngineKey = "import-microi-store-package",
                    ApiAddress = "/apiengine/import-microi-store-package",
                    IsEnable = 1,
                    Timeout = 3600,
                    MaxStatements = 100000000,
                    LimitMemory = ImporterLimitMemoryMb,
                    LimitRecursion = PrivilegedEngineLimitRecursion,
                    Lock = 1,
                    OsClient = osClient,
                    ApiV8Code = importV8
                });
                if(addImportMicroiStorePackageResult.Code != 1)
                {
                    msgs.Add("新增应用商城导入器失败：" + addImportMicroiStorePackageResult.Msg);
                }
            }
            else
            {
                var uptImportMicroiStorePackageResult = await UpgradeTrustedFormEngine.UpdateAsync("sys_apiengine", osClient, new
                {
                    Id = (string)importMicroiStorePackageResult.Data.Id,
                    ApiName = "[应用商城]导入Microi应用数据包",
                    ApiEngineKey = "import-microi-store-package",
                    ApiAddress = "/apiengine/import-microi-store-package",
                    IsEnable = 1,
                    Timeout = 3600,
                    MaxStatements = 100000000,
                    LimitMemory = ImporterLimitMemoryMb,
                    LimitRecursion = PrivilegedEngineLimitRecursion,
                    Lock = 1,
                    OsClient = osClient,
                    ApiV8Code = importV8
                });
                if(uptImportMicroiStorePackageResult.Code != 1)
                {
                    msgs.Add("更新应用商城导入器失败：" + uptImportMicroiStorePackageResult.Msg);
                }
                else
                {
                    await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:import-microi-store-package");
                    await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:{(string)importMicroiStorePackageResult.Data.Id}");
                    await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_apiengine:/apiengine/import-microi-store-package");
                }
            }
            if (msgs.Count == 0)
            {
                // 老库虽然已有物理字段，但 diy_field 元数据可能缺失，FormEngine 更新会忽略这些值。
                // 这里直接修正导入器运行限额，避免大体量元数据包继续使用默认 1GB 限制。
                await EnsureImporterExecutionLimitsAndInvalidateAsync(osClient);
            }
            if (msgs.Count > 0) return msgs;
            #endregion

            // 应用商城是本升级的核心目标：导入器更新成功后必须优先安装商城包，
            // 表单引擎、模块引擎及可选 AI 发布器均排在其后。
            #region 应用商城 数据包
            await InstallUpgradePackage(osClient, msgs, AppStorePackageResourceName, "应用商城数据包", resources);
            if (msgs.Count > 0) return msgs;
            // 尚未同步的官方在线商城包可能仍内嵌 2048MB 配置，并在导入自身时覆盖
            // 当前导入器。立即恢复受信任导入器限额，保证后续表单/模块大包继续稳定执行。
            await EnsureImporterExecutionLimitsAndInvalidateAsync(osClient);
            await EnsureAiAppBuilderAsync(osClient, msgs, resources);
            if (msgs.Count > 0) return msgs;
            await EnsureAiPackagingTimeFallback(osClient, msgs);
            if (msgs.Count > 0) return msgs;
            #endregion

            #region 表单引擎 数据包
            await InstallUpgradePackage(osClient, msgs, FormEnginePackageResourceName, "表单引擎数据包", resources);
            if (msgs.Count > 0) return msgs;
            #endregion

            #region 模块引擎 数据包
            await InstallUpgradePackage(osClient, msgs, ModuleEnginePackageResourceName, "模块引擎数据包", resources);
            if (msgs.Count > 0) return msgs;
            #endregion

            #region SaaS引擎与强身份验证基础包
            // SaaS 引擎包是官方平台资源，随升级自动安装。它通过统一应用商城导入器
            // 幂等补齐 Passkey/TOTP/严格人脸表、sys_osclients 配置字段和个人中心微服务；
            // 不在 .NET 中复制表/字段迁移逻辑，并保留租户后来显式关闭的 0 值。
            await InstallUpgradePackage(osClient, msgs, SaaSEnginePackageResourceName, "SaaS引擎与身份验证数据包", resources);
            if (msgs.Count > 0) return msgs;
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
                publishAiAppResult = await UpgradeTrustedFormEngine.UpdateAsync("sys_apiengine", osClient, new
                {
                    Id = (string)publishAiAppEngine.Data.Id,
                    OsClient = osClient,
                    ApiName = "[AI应用]制作离线包并发布应用商城",
                    ApiEngineKey = "ai_app_publish_store",
                    ApiAddress = "/apiengine/ai_app_publish_store",
                    IsEnable = 1,
                    StopHttp = 0,
                    Timeout = 3600,
                    MaxStatements = 100000000,
                    LimitMemory = 2048,
                    LimitRecursion = PrivilegedEngineLimitRecursion,
                    Lock = 1,
                    ApiV8Code = publishAiAppV8
                });
            }
            else
            {
                publishAiAppResult = await UpgradeTrustedFormEngine.AddAsync("sys_apiengine", osClient, new
                {
                    OsClient = osClient,
                    ApiName = "[AI应用]制作离线包并发布应用商城",
                    ApiEngineKey = "ai_app_publish_store",
                    ApiAddress = "/apiengine/ai_app_publish_store",
                    IsEnable = 1,
                    StopHttp = 0,
                    Timeout = 3600,
                    MaxStatements = 100000000,
                    LimitMemory = 2048,
                    LimitRecursion = PrivilegedEngineLimitRecursion,
                    Lock = 1,
                    ApiV8Code = publishAiAppV8
                });
            }
            if (publishAiAppResult.Code != 1)
            {
                // AI 发布器不是应用商城启动的前置条件，老库缺少可选字段时不应阻断三套基础包。
                Console.WriteLine("Microi：【基础应用升级】AI应用发布商城接口升级跳过：" + publishAiAppResult.Msg);
            }
            else
            {
                // 老库的运行参数物理列可能缺少 diy_field 元数据，FormEngine 更新会静默忽略；
                // 再以参数化 SQL 强制修正，保证大型自包含源码包可以稳定生成。
                EnsurePublisherExecutionSettings(osClient);
                await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync("Microi:" + osClient + ":FormData:sys_apiengine:ai_app_publish_store");
                await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync("Microi:" + osClient + ":FormData:sys_apiengine:/apiengine/ai_app_publish_store");
            }
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
                        // Stable official id also repairs tenants whose engine key was
                        // cleared by an older sparse-write conversion bug.
                        new List<object>() { "Id", "=", AppStoreMenuId },
                    }
                });
                if(getMenuResult.Code == 1)
                {
                    var appStoreMenuId = (string)getMenuResult.Data.Id;
                    // Data 是 dynamic；若直接作为 dynamic 参数调用 ToJObject，整个调用结果也会
                    // 被编译为 dynamic，随后 JValue.Val<T>() 会被当作实例方法解析并失败。
                    // 显式落到 object/JObject，确保 Dos.Common 的 JToken 扩展方法静态绑定。
                    JObject currentMenu = JsonHelper.ToJObject((object)getMenuResult.Data) ?? new JObject();
                    var menuPatch = new JObject
                    {
                        ["Id"] = appStoreMenuId,
                        ["OsClient"] = osClient,
                        ["DiyTableId"] = (string)getStoreTableResult.Data.Id,
                        ["DiyTableName"] = (string)getStoreTableResult.Data.Name,
                    };
                    if (currentMenu["Name"].Val<string>().DosIsNullOrWhiteSpace())
                    {
                        menuPatch["Name"] = "应用商城";
                    }
                    if (currentMenu["ModuleEngineKey"].Val<string>().DosIsNullOrWhiteSpace())
                    {
                        menuPatch["ModuleEngineKey"] = "sys_microistore";
                    }
                    var uptMenuResult = await UpgradeTrustedFormEngine.UpdateAsync("sys_menu", osClient, menuPatch);
                    if(uptMenuResult.Code != 1)
                    {
                        msgs.Add(uptMenuResult.Msg);
                    }else
                    {
                        await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_menu:{appStoreMenuId}");
                        await MicroiEngine.CacheTenant.Cache(osClient).RemoveAsync($"Microi:{osClient}:FormData:sys_menu:sys_microistore");
                    }
                    await EnsureAppStoreAdminPermission(osClient, appStoreMenuId, msgs);
                    await EnsureAppStoreAdminPermission(osClient, "01KXFSG7MZ40CY8KCWCZZZJH2M", msgs);
                    await EnsureAppStoreAdminPermission(osClient, "01KXFSG8153B3VZPZ45WNCCFHR", msgs);
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


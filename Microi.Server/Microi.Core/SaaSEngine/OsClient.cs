using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Text.RegularExpressions;
using Dos.Common;
using Newtonsoft.Json.Linq;

using Dos.ORM;

namespace Microi.net
{
    public class OsClientExtend
    {
        private static int ExtensionDatabaseCacheSeconds => Math.Max(5,
            ConfigHelper.GetEnvOrConfigurationInt(
                "MICROI_EXTENSION_DATABASE_CACHE_SECONDS",
                "SaaS:ExtensionDatabaseCacheSeconds",
                60));

        private static string ExtensionDatabaseVersionKey(string osClient)
        {
            return $"Microi:{osClient}:ExtensionDatabase:Epoch";
        }

        private static bool TryGetExtensionDatabaseVersion(string osClient, out long version)
        {
            version = 0;
            try
            {
                if (osClient.DosIsNullOrWhiteSpace()) return false;
                var value = MicroiEngine.CacheTenant.Cache(osClient)
                    .GetIDatabase()
                    .StringGet(ExtensionDatabaseVersionKey(osClient));
                if (value.IsNullOrEmpty) return true;
                return long.TryParse(value.ToString(), out version);
            }
            catch
            {
                return false;
            }
        }

        public static bool IsExtensionDatabaseCacheExpired(OsClientSecret clientModel)
        {
            if (clientModel == null
                || !clientModel.DataBasesInitialized
                || clientModel.DataBasesLoadedAtUtc == default(DateTime))
                return true;

            if (TryGetExtensionDatabaseVersion(clientModel.OsClient, out var sharedVersion)
                && sharedVersion != clientModel.DataBasesVersion)
                return true;

            return DateTime.UtcNow - clientModel.DataBasesLoadedAtUtc
                   >= TimeSpan.FromSeconds(ExtensionDatabaseCacheSeconds);
        }

        /// <summary>
        /// 递增租户扩展数据库共享版本并清空当前节点会话列表。
        /// Redis 版本是多节点事实源，本地状态只是可丢失的 L1。
        /// </summary>
        public static DosResult InvalidateExtensionDatabaseCache(string osClient)
        {
            if (osClient.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, "OsClient 不能为空");
            try
            {
                var version = (long)MicroiEngine.CacheTenant.Cache(osClient)
                    .GetIDatabase()
                    .StringIncrement(ExtensionDatabaseVersionKey(osClient));
                if (ClientList.TryGetValue(osClient, out var client) && client != null)
                {
                    lock (client)
                    {
                        client.DataBases = null;
                        client.DataBasesInitialized = false;
                        client.DataBasesLoadedAtUtc = default(DateTime);
                        client.DataBasesVersion = version - 1;
                    }
                }
                return new DosResult(1, new { OsClient = osClient, Version = version }, "扩展数据库缓存版本已刷新");
            }
            catch (Exception ex)
            {
                if (ClientList.TryGetValue(osClient, out var client) && client != null)
                {
                    client.DataBases = null;
                    client.DataBasesInitialized = false;
                    client.DataBasesLoadedAtUtc = default(DateTime);
                }
                return new DosResult(0, null, "扩展数据库共享缓存刷新失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 允许获取内置Client的mac
        /// </summary>

        /// <summary>
        /// 当前内置已有的Client
        /// </summary>
        //private static List<OsClientSecret> ClientList { get; set; }
        public static ConcurrentDictionary<string, OsClientSecret> ClientList = new ConcurrentDictionary<string, OsClientSecret>();

        /// <summary>
        /// 防止缓存初始化时的无限递归标志
        /// </summary>
        public static bool _isCacheInitializing = false;

        /// <summary>
        /// OsClientName
        /// </summary>
        public static string OsClient { get; set; }

        public static string GetConfigOsClient()
        {
            var osClientName = Environment.GetEnvironmentVariable("OsClient", EnvironmentVariableTarget.Process) ?? (ConfigHelper.GetAppSettings("OsClient") ?? "");
            return osClientName;
        }

        /// <summary>
        /// 从 OsClientSecret 中提取可序列化的配置部分
        /// 【设计】直接返回 OsClientModel（完整的 JObject），包含所有数据库字段
        /// 这样缓存的就是完整的配置，不会丢失任何字段
        /// </summary>
        private static JObject ExtractClientConfig(OsClientSecret client)
        {
            if (client == null) return null;

            EnsureMainTenantDatabaseConfig(client.OsClient, client.OsClientModel);

            // 【关键】直接返回完整的 OsClientModel JObject，保留所有数据库字段
            return client.OsClientModel;
        }

        /// <summary>
        /// 合并缓存中的配置与本地 ClientList 中的 DB 对象
        /// 【设计】从缓存恢复 OsClientModel（完整配置），同时保留本地的 DB 对象（Db、DbRead 等）
        /// </summary>
        private static OsClientSecret MergeConfigWithClientObjects(dynamic config, OsClientSecret localClient)
        {
            if (localClient == null) return null;

            // Redis 中保存的是 SaaS 业务配置；数据库连接属于当前进程的本地配置。
            // 主租户在 sys_osclients 中通常不填写 DbConn，不能让缓存中的空值覆盖
            // InitializeDefaultClient 从环境变量/appsettings 加载的连接字符串。
            if (config is JObject jobj)
            {
                var localModel = localClient.OsClientModel;
                var localDbConn = localModel?["DbConn"]?.Val<string>();
                var localDbReadConn = localModel?["DbReadConn"]?.Val<string>();
                var localDbType = localModel?["DbType"]?.Val<string>();
                var localDbReadType = localModel?["DbReadType"]?.Val<string>();

                localClient.OsClientModel = (JObject)jobj.DeepClone();
                RestoreLocalDatabaseValue(localClient.OsClientModel, "DbConn", localDbConn);
                RestoreLocalDatabaseValue(localClient.OsClientModel, "DbReadConn", localDbReadConn);
                RestoreLocalDatabaseValue(localClient.OsClientModel, "DbType", localDbType);
                RestoreLocalDatabaseValue(localClient.OsClientModel, "DbReadType", localDbReadType);
            }

            EnsureMainTenantDatabaseConfig(localClient.OsClient, localClient.OsClientModel);

            return localClient;
        }

        private static void RestoreLocalDatabaseValue(JObject target, string fieldName, string localValue)
        {
            if (target != null && !localValue.DosIsNullOrWhiteSpace())
            {
                target[fieldName] = localValue;
            }
        }

        /// <summary>
        /// 主租户的数据库连接以进程环境变量为第一优先级、appsettings 为第二优先级。
        /// sys_osclients.DbConn 可以留空，且 Redis 中的空值不得覆盖本机配置。
        /// </summary>
        private static void EnsureMainTenantDatabaseConfig(string osClient, JObject osClientModel)
        {
            if (osClientModel == null || !IsConfiguredMainTenant(osClient)) return;

            var dbConn = GetConfiguredValue("OsClientDbConn", OsClientDefault.OsClientDbConn);
            string currentDbConn = osClientModel["DbConn"]?.Val<string>() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(currentDbConn)
                && !string.IsNullOrWhiteSpace(dbConn))
            {
                osClientModel["DbConn"] = dbConn;
                currentDbConn = dbConn;
            }

            var dbType = GetConfiguredValue("OsClientDbType", OsClientDefault.OsClientDbType);
            string currentDbType = osClientModel["DbType"]?.Val<string>() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(currentDbType)
                && !string.IsNullOrWhiteSpace(dbType))
            {
                osClientModel["DbType"] = dbType;
                currentDbType = dbType;
            }

            string currentDbReadConn = osClientModel["DbReadConn"]?.Val<string>() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(currentDbReadConn)
                && !string.IsNullOrWhiteSpace(currentDbConn))
            {
                osClientModel["DbReadConn"] = currentDbConn;
            }
            string currentDbReadType = osClientModel["DbReadType"]?.Val<string>() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(currentDbReadType)
                && !string.IsNullOrWhiteSpace(currentDbType))
            {
                osClientModel["DbReadType"] = currentDbType;
            }
        }

        private static bool IsConfiguredMainTenant(string osClient)
        {
            if (osClient.DosIsNullOrWhiteSpace()) return false;
            var configuredOsClient = GetConfiguredValue("OsClient", OsClientDefault.OsClient);
            return string.Equals(osClient, configuredOsClient, StringComparison.OrdinalIgnoreCase);
        }

        private static string GetConfiguredValue(string key, string fallback)
        {
            var processValue = Environment.GetEnvironmentVariable(key, EnvironmentVariableTarget.Process);
            if (!processValue.DosIsNullOrWhiteSpace()) return processValue;

            var appSettingsValue = ConfigHelper.GetAppSettings(key);
            return appSettingsValue.DosIsNullOrWhiteSpace() ? fallback : appSettingsValue;
        }

        /// <summary>
        /// 获取非空值，如果缓存值为空则使用本地值
        /// </summary>
        private static string GetNonEmptyValue(string cacheValue, string localValue)
        {
            return string.IsNullOrWhiteSpace(cacheValue) ? localValue : cacheValue;
        }

        /// <summary>
        /// 获取缓存实例
        /// </summary>
        private static IMicroiCache GetCacheInstance()
        {
            try
            {
                return MicroiEngine.CacheTenant.Default();
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// 从缓存获取值
        /// </summary>
        private static JObject GetFromCache(IMicroiCache cache, string key)
        {
            try
            {
                if (cache == null) return null;
                var result = cache.Get<JObject>(key);
                return result;
            }
            catch
            {
                return null;
            }
        }

        /// <summary>
        /// 保存值到缓存
        /// </summary>
        private static void SetToCache(IMicroiCache cache, string key, JObject value, TimeSpan? expiration = null)
        {
            try
            {
                if (cache == null) return;
                cache.Set(key, value);
            }
            catch
            {
                // 缓存失败不影响主流程
            }
        }
        public static OsClientSecret GetClient(string osClient = "")
        {
            if (osClient.DosIsNullOrWhiteSpace())
            {
                osClient = DiyToken.GetCurrentOsClient();
            }

            if (osClient.DosIsNullOrWhiteSpace())
            {
                throw new Exception("OsClient.GetClient出现错误：OsClient为空！");
            }
            osClient = osClient.DosTrim();

            // 【分布式缓存优先策略】
            // 第一步：尝试从L2缓存（Redis）获取配置
            // 【递归保护】如果正在初始化缓存，跳过缓存读取以避免无限递归
            var cacheKey = $"Microi:{OsClientExtend.GetConfigOsClient()}:saas-engine:{osClient}";
            JObject cachedConfig = null;
            if (!_isCacheInitializing)
            {
                var cache = GetCacheInstance();
                cachedConfig = GetFromCache(cache, cacheKey);
            }

            // 第二步：从本地ClientList获取完整的OsClientSecret（包含DB对象）
            ClientList.TryGetValue(osClient, out var client);

            // 本机尚未加载该租户时，允许从 Redis 中的 SaaS 配置恢复本机 ClientList。
            // 这样 V8.ReloadOsClient 在多实例部署中写入 Redis 后，其他实例也能立即识别新租户。
            if (client == null && cachedConfig != null)
            {
                var cachedOsClient = cachedConfig["OsClient"]?.Val<string>();
                if (cachedOsClient.DosIsNullOrWhiteSpace())
                {
                    cachedOsClient = osClient;
                }

                client = new OsClientSecret
                {
                    OsClient = cachedOsClient,
                    OsClientModel = cachedConfig
                };
                ClientList.AddOrUpdate(client.OsClient, client, (key, oldValue) => client);
            }

            if (client != null)
            {

                // 如果有缓存配置，合并缓存配置与本地DB对象
                if (cachedConfig != null)
                {
                    client = MergeConfigWithClientObjects(cachedConfig, client);
                }

                EnsureMainTenantDatabaseConfig(osClient, client.OsClientModel);

                //判断数据库对象是否初始化，或已断开？
                if (client.Db == null || client.DbRead == null)
                {
                    // 【防御】检查 DbConn 是否有效，避免创建会话时出现 null 错误
                    if (client.OsClientModel["DbConn"] == null || client.OsClientModel["DbConn"].Val<string>().DosIsNullOrWhiteSpace())
                    {
                        throw new Exception($"OsClient.GetClient出现错误：OsClient=[{osClient}] 的数据库连接字符串（DbConn）为空或未配置！请检查 OsClient 表中该租户的配置。");
                    }

                    // 【防御】检查 DbType 是否有效，为空时使用默认值 MySql
                    var dbTypeString = client.OsClientModel["DbType"]?.Val<string>();
                    if (dbTypeString.DosIsNullOrWhiteSpace())
                    {
                        dbTypeString = "MySql";
                    }

                    try
                    {
                        // 使用工厂创建会话（Dos.ORM）
                        var dbType = (DatabaseType)Enum.Parse(typeof(DatabaseType), dbTypeString);
                        client.Db = MicroiORMExtensions.CreateDbSession(client.OsClientModel["DbConn"].Val<string>(), dbType);

                        // 【防御】检查 DbReadType 是否有效，为空时使用默认值 MySql
                        var dbReadTypeString = client.OsClientModel["DbReadType"]?.Val<string>();
                        if (dbReadTypeString.DosIsNullOrWhiteSpace())
                        {
                            dbReadTypeString = "MySql";
                        }

                        var dbReadType = (DatabaseType)Enum.Parse(typeof(DatabaseType), dbReadTypeString);
                        // 【防御】DbReadConn 为空时回退到 DbConn（读写共用主库连接），避免 ArgumentNullException
                        var dbReadConnStr = client.OsClientModel["DbReadConn"]?.Val<string>();
                        if (dbReadConnStr.DosIsNullOrWhiteSpace())
                        {
                            dbReadConnStr = client.OsClientModel["DbConn"].Val<string>();
                            dbReadType = dbType;
                        }
                        client.DbRead = MicroiORMExtensions.CreateDbSession(dbReadConnStr, dbReadType);
                    }
                    catch (Exception ex)
                    {
                        var safeConnStr = SanitizeConnectionString(client.OsClientModel["DbConn"]?.Val<string>());
                        var safeReadConnStr = SanitizeConnectionString(client.OsClientModel["DbReadConn"]?.Val<string>());
                        throw new Exception(
                            $"OsClient.GetClient数据库连接失败：OsClient=[{osClient}]，" +
                            $"DbType=[{dbTypeString}]，" +
                            $"写库连接字符串=[{safeConnStr}]，" +
                            $"读库连接字符串=[{safeReadConnStr}]，" +
                            $"错误信息：{ex.Message}", ex);
                    }

                    AddOrUptClient(client);
                }
                return client;
            }
            throw new Exception($"Microi：【Error异常】未找到OsClient：{(osClient ?? "")}");
        }
        /// <summary>
        /// 
        /// </summary>
        public static OsClientSecret AddOrUptClient(
            OsClientSecret client,
            bool publishConfiguration = true)
        {
            try
            {
                if (client == null || client.OsClient.DosIsNullOrWhiteSpace())
                {
                    MicroiEngine.QueueSystemLog(OsClientDefault.OsClient, "SaaS", "EmptyTenantRejected", "更新租户运行时配置失败", "OsClient 不能为空。", 2);
                    return client;
                }

                // 第一步：更新本地ClientList
                ClientList.AddOrUpdate(client.OsClient, client, (key, oldValue) => client);
                if (!publishConfiguration)
                {
                    return client;
                }

                MicroiEngine.QueueSystemLog(client.OsClient, "SaaS", "RuntimeConfigurationUpdated", "租户运行时配置已更新", "本节点 ClientList 已刷新。", 1, true, client.OsClient);

                // 第二步：提取可序列化配置并缓存到L2（Redis）
                try
                {
                    var config = ExtractClientConfig(client);
                    var cacheKey = $"Microi:{OsClientExtend.GetConfigOsClient()}:saas-engine:{client.OsClient}";
                    var cache = GetCacheInstance();

                    if (cache != null)
                    {
                        // 缓存配置到Redis（此操作自动触发Pub/Sub通知所有实例）
                        SetToCache(cache, cacheKey, config);
                        MicroiEngine.QueueSystemLog(client.OsClient, "SaaS", "ConfigurationCached", "租户配置已缓存到 Redis", "已发布跨节点缓存失效通知。", 1, true, client.OsClient);
                    }
                }
                catch (Exception cacheEx)
                {
                    MicroiEngine.QueueSystemLog(client.OsClient, "SaaS", "ConfigurationCacheFailed", "租户配置写入 Redis 失败", cacheEx.ToString(), 2, false, client.OsClient);
                }

                return client;
            }
            catch (Exception ex)
            {
                MicroiEngine.QueueSystemLog(client?.OsClient, "SaaS", "RuntimeConfigurationUpdateFailed", "更新租户运行时配置失败", ex.ToString(), 2, false, client?.OsClient);
                return client;
            }
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="clientModel"></param>
        /// <param name="dataBaseId"></param>
        /// <returns></returns>
        public static OsClientDataBase GetClientDataBase(OsClientSecret clientModel, string dataBaseId)
        {
            if (dataBaseId.DosIsNullOrWhiteSpace())
            {
                return null;
            }
            if (IsExtensionDatabaseCacheExpired(clientModel)
                || clientModel.DataBases == null
                || !clientModel.DataBases.Any(d => d.Id == dataBaseId))
            {
                InitOsClientDataBases(clientModel.Db, clientModel);
                // 这里只初始化当前进程的数据库会话，没有修改 SaaS 配置，
                // 禁止向 Redis 再发布一次配置变更。
                AddOrUptClient(clientModel, publishConfiguration: false);
            }
            if (clientModel.DataBases == null || !clientModel.DataBases.Any(d => d.Id == dataBaseId))
            {
                throw new Exception($"未找到OsClient DataBaseId：{(dataBaseId ?? "")}。");
            }
            var dataBaseModel = clientModel.DataBases.First(d => d.Id == dataBaseId);
            if (dataBaseModel.Db == null || dataBaseModel.DbRead == null)
            {
                // 使用工厂创建会话（Dos.ORM）
                var dbType = ExternalDatabaseCatalog.ResolveType(dataBaseModel.DbType);
                dataBaseModel.Db = MicroiORMExtensions.CreateDbSession(dataBaseModel.DbConn, dbType);

                if (dataBaseModel.DbReadConn.DosIsNullOrWhiteSpace())
                {
                    dataBaseModel.DbReadConn = dataBaseModel.DbConn;
                }
                if (dataBaseModel.DbReadType.DosIsNullOrWhiteSpace())
                {
                    dataBaseModel.DbReadType = dataBaseModel.DbType;
                }
                var dbReadType = ExternalDatabaseCatalog.ResolveType(dataBaseModel.DbReadType);
                dataBaseModel.DbRead = MicroiORMExtensions.CreateDbSession(dataBaseModel.DbReadConn, dbReadType);
                AddOrUptClient(clientModel, publishConfiguration: false);
            }
            return dataBaseModel;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="db"></param>
        /// <param name="secret"></param>
        /// <returns></returns>
        public static OsClientSecret InitOsClientDataBases(DbSession db, OsClientSecret secret)
        {

            try
            {
                TryGetExtensionDatabaseVersion(secret.OsClient, out var versionBefore);
                List<OsClientDataBase> microiDatabaseList = null;
                var stableVersion = versionBefore;
                for (var attempt = 0; attempt < 2; attempt++)
                {
                    microiDatabaseList = db.FromSql("select * from microi_database where IsEnable = 1 and IsDeleted=0")
                        .ToList<OsClientDataBase>();
                    if (!TryGetExtensionDatabaseVersion(secret.OsClient, out var versionAfter)
                        || versionAfter == versionBefore)
                    {
                        stableVersion = versionAfter;
                        break;
                    }
                    versionBefore = versionAfter;
                    stableVersion = versionAfter;
                }
                if (microiDatabaseList.Any())
                {
                    secret.DataBases = microiDatabaseList;
                    foreach (var item in secret.DataBases)
                    {

                    }
                }
                else
                {
                    secret.DataBases = new List<OsClientDataBase>();
                }
                secret.DataBasesInitialized = true;
                secret.DataBasesLoadedAtUtc = DateTime.UtcNow;
                secret.DataBasesVersion = stableVersion;
                return secret;
            }
            catch (Exception ex)
            {
                secret.DataBases = new List<OsClientDataBase>();
                secret.DataBasesInitialized = false;
                secret.DataBasesLoadedAtUtc = default(DateTime);
                return null;
            }
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="clientModel"></param>
        /// <param name="dataBaseId"></param>
        /// <returns></returns>
        /// <exception cref="Exception"></exception>
        public static DbSession GetClientDbSession(OsClientSecret clientModel = null, string dataBaseId = "")
        {
            if (!dataBaseId.DosIsNullOrWhiteSpace())
            {
                if (IsExtensionDatabaseCacheExpired(clientModel)
                    || clientModel.DataBases == null
                    || !clientModel.DataBases.Any(d => d.Id == dataBaseId))
                {
                    InitOsClientDataBases(clientModel.Db, clientModel);
                    AddOrUptClient(clientModel, publishConfiguration: false);
                }
                if (clientModel.DataBases == null || !clientModel.DataBases.Any(d => d.Id == dataBaseId))
                {
                    throw new Exception($"未找到OsClient DataBaseId：{(dataBaseId ?? "")}。");
                }
                var dataBaseModel = clientModel.DataBases.First(d => d.Id == dataBaseId);
                if (dataBaseModel.Db == null || dataBaseModel.DbRead == null)
                {
                    // 使用工厂创建会话
                    var dbType = ExternalDatabaseCatalog.ResolveType(dataBaseModel.DbType);
                    dataBaseModel.Db = MicroiORMExtensions.CreateDbSession(dataBaseModel.DbConn, dbType);

                    if (dataBaseModel.DbReadConn.DosIsNullOrWhiteSpace())
                    {
                        dataBaseModel.DbReadConn = dataBaseModel.DbConn;
                    }
                    if (dataBaseModel.DbReadType.DosIsNullOrWhiteSpace())
                    {
                        dataBaseModel.DbReadType = dataBaseModel.DbType;
                    }
                    var dbReadType = ExternalDatabaseCatalog.ResolveType(dataBaseModel.DbReadType);
                    dataBaseModel.DbRead = MicroiORMExtensions.CreateDbSession(dataBaseModel.DbReadConn, dbReadType);
                    AddOrUptClient(clientModel, publishConfiguration: false);
                }
                return dataBaseModel.Db;
            }
            else
            {
                return clientModel.Db;
            }
        }
        /// <summary>
        /// 验证 OsClient 一致性
        /// </summary>
        public void ValidateOsClientConsistency(List<dynamic> dbOsClientsList)
        {
            try
            {
                if (!dbOsClientsList.Any(d => d.OsClient == OsClientDefault.OsClient))
                {
                    Console.WriteLine($"Microi：【警告】环境变量中的OsClient值为{OsClientDefault.OsClient}，但Sys_OsClients表中的并不存在此配置！根据OsClient、OsClientType、OsClientNetwork在sys_osclients中未匹配到数据，这将导致系统设置-开发配置无效！");
                }
            }
            catch { }
        }

        /// <summary>
        /// 加载系统配置
        /// </summary>
        public void LoadSysConfig(OsClientSecret currentClientModel)
        {
            var sysConfig = currentClientModel.Db
                .FromSql("select * from sys_config where IsDeleted<>1 and IsEnable=1")
                .ToFirst<dynamic>();

            if (sysConfig != null)
            {
                bool enableSwagger = DynamicHelper.GetDynamicBoolValue(sysConfig, "EnableSwagger", false);
                if (!enableSwagger)
                {
                    currentClientModel.OsClientModel["EnableSwagger"] = 0;
                }
                string indexCodeApi = DynamicHelper.GetDynamicStringValue(sysConfig, "IndexCodeApi", "");
                if(!indexCodeApi.DosIsNullOrWhiteSpace())
                {
                    currentClientModel.OsClientModel["IndexCodeApi"] = indexCodeApi;
                }
            }
        }

        /// <summary>
        /// 隐藏连接字符串中的密码，用于安全日志输出
        /// </summary>
        public static string SanitizeConnectionString(string connectionString)
        {
            if (string.IsNullOrWhiteSpace(connectionString)) return "(空)";
            // 匹配 password=xxx 或 pwd=xxx，支持带引号和不带引号的值
            return Regex.Replace(connectionString, @"(?i)(password|pwd)\s*=\s*([^;]*)", "$1=***");
        }
    }

}


using System;
using System.Collections.Concurrent;

using Dos.Common;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public class OsClientExtend
    {
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

            // 【关键】如果缓存中有完整的 OsClientModel（JObject），直接恢复
            if (config is JObject jobj)
            {
                // 缓存中的配置是完整的 JObject，包含所有字段
                // 直接作为 OsClientModel 恢复，保留所有数据库字段
                localClient.OsClientModel = jobj;
            }

            // 【重要】不从缓存恢复 DbConn/DbReadConn，这些始终使用本地值
            // 因为本地的 DbConn/DbReadConn 可能被规范化处理过（如 MySQL 连接字符串）
            
            return localClient;
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
            try
            {
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = GetCurrentOsClient();
                }

                if (osClient.DosIsNullOrWhiteSpace())
                {
                    throw new Exception("OsClient.GetClient出现错误：OsClient为空！");
                }

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
                
                if (client != null)
                {
                    
                    // 如果有缓存配置，合并缓存配置与本地DB对象
                    if (cachedConfig != null)
                    {
                        client = MergeConfigWithClientObjects(cachedConfig, client);
                    }

                    //判断数据库对象是否初始化，或已断开？
                    // 【修复】SqlSugar 不缓存 session，每次都重新创建以避免连接状态问题
                    var shouldRecreateSession = false;
                    var isFirstTimeInit = false;  // 是否第一次初始化

                    if (client.Db == null || client.DbRead == null)
                    {
                        shouldRecreateSession = true;
                        isFirstTimeInit = true;
                    }
                    else
                    {
                        // 如果是 SqlSugar 适配器，每次都重新创建
                        if (client.Db.GetType().Name == "SqlSugarSessionAdapter")
                        {
                            shouldRecreateSession = true;
                        }
                    }

                    if (shouldRecreateSession)
                    {
                        // 【防御】检查 DbConn 是否有效，避免创建会话时出现 null 错误
                        if (client.OsClientModel["DbConn"] == null || client.OsClientModel["DbConn"].Val<string>().DosIsNullOrWhiteSpace())
                        {
                            throw new Exception($"OsClient.GetClient出现错误：OsClient=[{osClient}] 的数据库连接字符串（DbConn）为空或未配置！请检查 OsClient 表中该租户的配置。");
                        }

                        // 使用工厂创建会话（支持 Dos.ORM 和 SqlSugar）
                        var dbType = (DatabaseType)Enum.Parse(typeof(DatabaseType), client.OsClientModel["DbType"].Val<string>());
                        client.Db = MicroiDbSessionFactoryProvider.CreateSession(client.OsClientModel["DbConn"].Val<string>(), dbType);
                        // 【修复】设置 OsClient，用于混合 ORM 场景下自动切换到 DosOrmDb
                        if (client.Db != null && client.Db.GetType().Name == "SqlSugarSessionAdapter")
                        {
                            var osClientProp = client.Db.GetType().GetProperty("OsClient");
                            osClientProp?.SetValue(client.Db, osClient);
                        }
                        var dbReadType = (DatabaseType)Enum.Parse(typeof(DatabaseType), client.OsClientModel["DbReadType"].Val<string>());
                        client.DbRead = MicroiDbSessionFactoryProvider.CreateSession(client.OsClientModel["DbReadConn"].Val<string>(), dbReadType);
                        // 【修复】设置 OsClient
                        if (client.DbRead != null && client.DbRead.GetType().Name == "SqlSugarSessionAdapter")
                        {
                            var osClientProp = client.DbRead.GetType().GetProperty("OsClient");
                            osClientProp?.SetValue(client.DbRead, osClient);
                        }

                        // 【核心】同时创建 Dos.ORM 专用 session，用于旧代码的 From<T>() 等扩展方法
                        // 无论配置的是什么 ORM，这两个始终使用 Dos.ORM（只在第一次创建）
                        if (client.DosOrmDb == null || client.DosOrmDbRead == null)
                        {
                            var dosOrmDbType = (Dos.ORM.DatabaseType)Enum.Parse(typeof(Dos.ORM.DatabaseType), client.OsClientModel["DbType"].Val<string>());
                            client.DosOrmDb = new Dos.ORM.DbSession(dosOrmDbType, client.OsClientModel["DbConn"].Val<string>());

                            var dosOrmDbReadType = (Dos.ORM.DatabaseType)Enum.Parse(typeof(Dos.ORM.DatabaseType), client.OsClientModel["DbReadType"].Val<string>());
                            client.DosOrmDbRead = new Dos.ORM.DbSession(dosOrmDbReadType, client.OsClientModel["DbReadConn"].Val<string>());
                        }

                        // 【修复】只在第一次初始化时更新 ClientList，避免频繁调用
                        if (isFirstTimeInit)
                        {
                            AddOrUptClient(client);
                        }
                    }
                    return client;
                }

                throw new Exception($"Microi：【Error异常】未找到OsClient：{(osClient ?? "")}");
            }
            catch (Exception ex)
            {
                throw new Exception($"Microi：【Error异常】OsClient.GetClient出现错误：{ex.Message}");//。{ex.StackTrace}
            }
        }
        /// <summary>
        /// 获取当前 OsClient
        /// </summary>
        /// <returns></returns>
        public static string GetCurrentOsClient(Microsoft.AspNetCore.Http.HttpContext _context = null)
        {
            try
            {
                var context = DiyHttpContext.Current;
                var claims = context.User?.Claims;

                //.NET8
                var token = context.Request.Headers["authorization"].ToString();
                if (!token.DosIsNullOrWhiteSpace())
                {
                    claims = new JwtSecurityTokenHandler().ReadJwtToken(token.Replace("Bearer ", ""))?.Claims;
                }

                var osClient = claims?.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                if (osClient == null)
                {
                    if (_context != null)
                    {
                        claims = _context.User?.Claims;
                        //.NET8
                        token = _context.Request.Headers["authorization"].ToString();
                        if (!token.DosIsNullOrWhiteSpace())
                        {
                            claims = new JwtSecurityTokenHandler().ReadJwtToken(token.Replace("Bearer ", ""))?.Claims;
                        }
                        osClient = claims?.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                        if (osClient == null)
                        {
                            return "";
                        }
                    }
                    return "";
                }
                return osClient;
            }
            catch (Exception ex)
            {
                return "";
            }
        }
        /// <summary>
        /// 
        /// </summary>
        public static OsClientSecret AddOrUptClient(OsClientSecret client)
        {
            try
            {
                if (client == null || client.OsClient.DosIsNullOrWhiteSpace())
                {
                    Console.WriteLine("Microi：【Error异常】AddOrUptClient中OsClient不能为空！");
                    return client;
                }
                
                // 第一步：更新本地ClientList
                ClientList.AddOrUpdate(client.OsClient, client, (key, oldValue) => client);
                Console.WriteLine("Microi：【成功】更新OsClient：" + client.OsClient);

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
                        Console.WriteLine($"Microi：【成功】缓存OsClient配置到Redis：{client.OsClient}");
                    }
                }
                catch (Exception cacheEx)
                {
                    Console.WriteLine($"Microi：【警告】缓存OsClient配置失败（non-critical）：{cacheEx.Message}");
                }

                return client;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：【Error异常】更新OsClient：" + client.OsClient + "失败！" + ex.Message);
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
            if (clientModel.DataBases == null || !clientModel.DataBases.Any(d => d.Id == dataBaseId))
            {
                InitOsClientDataBases(clientModel.Db, clientModel);
                AddOrUptClient(clientModel);
            }
            if (clientModel.DataBases == null || !clientModel.DataBases.Any(d => d.Id == dataBaseId))
            {
                throw new Exception($"未找到OsClient DataBaseId：{(dataBaseId ?? "")}。");
            }
            var dataBaseModel = clientModel.DataBases.First(d => d.Id == dataBaseId);
            if (dataBaseModel.Db == null || dataBaseModel.DbRead == null)
            {
                // 使用工厂创建会话（支持 Dos.ORM 和 SqlSugar）
                var dbType = (DatabaseType)Enum.Parse(typeof(DatabaseType), dataBaseModel.DbType);
                dataBaseModel.Db = MicroiDbSessionFactoryProvider.CreateSession(dataBaseModel.DbConn, dbType);
                // 【修复】设置 OsClient
                if (dataBaseModel.Db != null && dataBaseModel.Db.GetType().Name == "SqlSugarSessionAdapter")
                {
                    var osClientProp = dataBaseModel.Db.GetType().GetProperty("OsClient");
                    osClientProp?.SetValue(dataBaseModel.Db, clientModel.OsClient);
                }

                if (dataBaseModel.DbReadConn.DosIsNullOrWhiteSpace())
                {
                    dataBaseModel.DbReadConn = dataBaseModel.DbConn;
                }
                if (dataBaseModel.DbReadType.DosIsNullOrWhiteSpace())
                {
                    dataBaseModel.DbReadType = dataBaseModel.DbType;
                }
                var dbReadType = (DatabaseType)Enum.Parse(typeof(DatabaseType), dataBaseModel.DbReadType);
                dataBaseModel.DbRead = MicroiDbSessionFactoryProvider.CreateSession(dataBaseModel.DbReadConn, dbReadType);
                // 【修复】设置 OsClient
                if (dataBaseModel.DbRead != null && dataBaseModel.DbRead.GetType().Name == "SqlSugarSessionAdapter")
                {
                    var osClientProp = dataBaseModel.DbRead.GetType().GetProperty("OsClient");
                    osClientProp?.SetValue(dataBaseModel.DbRead, clientModel.OsClient);
                }
                AddOrUptClient(clientModel);
            }
            return dataBaseModel;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="db"></param>
        /// <param name="secret"></param>
        /// <returns></returns>
        public static OsClientSecret InitOsClientDataBases(IMicroiDbSession db, OsClientSecret secret)
        {

            try
            {
                var microiDatabaseList = db.FromSql("select * from microi_database where IsEnable = 1 and IsDeleted=0").ToList<OsClientDataBase>();
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
                return secret;
            }
            catch (Exception ex)
            {
                secret.DataBases = new List<OsClientDataBase>();
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
        public static IMicroiDbSession GetClientDbSession(OsClientSecret clientModel = null, string dataBaseId = "")
        {
            if (!dataBaseId.DosIsNullOrWhiteSpace())
            {
                if (clientModel.DataBases == null || !clientModel.DataBases.Any(d => d.Id == dataBaseId))
                {
                    InitOsClientDataBases(clientModel.Db, clientModel);
                    AddOrUptClient(clientModel);
                }
                if (clientModel.DataBases == null || !clientModel.DataBases.Any(d => d.Id == dataBaseId))
                {
                    throw new Exception($"未找到OsClient DataBaseId：{(dataBaseId ?? "")}。");
                }
                var dataBaseModel = clientModel.DataBases.First(d => d.Id == dataBaseId);
                if (dataBaseModel.Db == null || dataBaseModel.DbRead == null)
                {
                    // 使用工厂创建会话
                    var dbType = (DatabaseType)Enum.Parse(typeof(DatabaseType), dataBaseModel.DbType);
                    dataBaseModel.Db = MicroiDbSessionFactoryProvider.CreateSession(dataBaseModel.DbConn, dbType);
                    // 【修复】设置 OsClient
                    if (dataBaseModel.Db != null && dataBaseModel.Db.GetType().Name == "SqlSugarSessionAdapter")
                    {
                        var osClientProp = dataBaseModel.Db.GetType().GetProperty("OsClient");
                        osClientProp?.SetValue(dataBaseModel.Db, clientModel.OsClient);
                    }

                    if (dataBaseModel.DbReadConn.DosIsNullOrWhiteSpace())
                    {
                        dataBaseModel.DbReadConn = dataBaseModel.DbConn;
                    }
                    dataBaseModel.DbRead = MicroiDbSessionFactoryProvider.CreateSession(dataBaseModel.DbReadConn, dbType);
                    // 【修复】设置 OsClient
                    if (dataBaseModel.DbRead != null && dataBaseModel.DbRead.GetType().Name == "SqlSugarSessionAdapter")
                    {
                        var osClientProp = dataBaseModel.DbRead.GetType().GetProperty("OsClient");
                        osClientProp?.SetValue(dataBaseModel.DbRead, clientModel.OsClient);
                    }
                    AddOrUptClient(clientModel);
                }
                return dataBaseModel.Db;
            }
            else
            {
                return clientModel.Db;
            }
        }
    }

}


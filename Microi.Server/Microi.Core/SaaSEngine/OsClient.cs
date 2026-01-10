using System;
using System.Collections.Concurrent;

using Dos.Common;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Collections.Generic;

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
        /// OsClientName
        /// </summary>
        public static string OsClientName { get; set; }
        /// <summary>
        /// Test、Product、WZ等自定义
        /// </summary>
        public static string OsClientType { get; set; }
        /// <summary>
        /// Internal内网、Internet公网
        /// </summary>
        public static string OsClientNetwork { get; set; }

        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public static string OsClientDbConn { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public static string OsClientDbReadConn { get; set; }
        /// <summary>
        /// 默认值MySql
        /// </summary>
        public static string OsClientDbType { get; set; }
        /// <summary>
        /// 目前暂时仅用于区分oracle 12c、11g（值为空、12c、11g）
        /// </summary>
        public static string OsClientDbVersion { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public static string OsClientDbOracleTableSpace { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>

        public static string OsClientRedisHost { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public static string OsClientRedisPort { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public static string OsClientRedisPwd { get; set; }

        /// <summary>
        /// 默认5
        /// </summary>
        public static string OsClientRedisDataBase { get; set; }
        /// <summary>
        /// 默认720
        /// </summary>
        public static string OsClientRedisTimeout { get; set; }



        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public static string AuthServer { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>
        public static string AuthSecret { get; set; }
        /// <summary>
        /// 
        /// </summary>
        /// <value></value>

        public static string OsClientDbMongoConn { get; set; }

        public static string GetConfigOsClient()
        {
            var osClientName = Environment.GetEnvironmentVariable("OsClient", EnvironmentVariableTarget.Process) ?? (ConfigHelper.GetAppSettings("OsClient") ?? "");
            return osClientName;
        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="osClient"></param>
        /// <returns></returns>
        public static OsClientSecret GetClient(string osClient = "")
        {
            try
            {
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    //osClient = DiyToken.GetCurrentOsClient();
                    osClient = GetCurrentOsClient();
                }

                if (osClient.DosIsNullOrWhiteSpace())
                {
                    throw new Exception("OsClient.GetClient出现错误：OsClient为空！");
                }
                //var client = ClientList.FirstOrDefault(d => d.OsClient.ToLower() == osClient.ToLower());
                // var client = ClientList.FirstOrDefault(d => d.Key.ToLower() == osClient.ToLower());
                ClientList.TryGetValue(osClient, out var client);
                //if (client != null)
                if (client != null)
                {
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
                        // 使用工厂创建会话（支持 Dos.ORM 和 SqlSugar）
                        var dbType = (DatabaseType)Enum.Parse(typeof(DatabaseType), client.DbType);
                        client.Db = MicroiDbSessionFactoryProvider.CreateSession(client.DbConn, dbType);
                        // 【修复】设置 OsClient，用于混合 ORM 场景下自动切换到 DosOrmDb
                        if (client.Db != null && client.Db.GetType().Name == "SqlSugarSessionAdapter")
                        {
                            var osClientProp = client.Db.GetType().GetProperty("OsClient");
                            osClientProp?.SetValue(client.Db, osClient);
                        }

                        if (client.DbReadConn.DosIsNullOrWhiteSpace())
                        {
                            client.DbReadConn = client.DbConn;
                        }
                        if (client.DbReadType.DosIsNullOrWhiteSpace())
                        {
                            client.DbReadType = client.DbType;
                        }
                        var dbReadType = (DatabaseType)Enum.Parse(typeof(DatabaseType), client.DbReadType);
                        client.DbRead = MicroiDbSessionFactoryProvider.CreateSession(client.DbReadConn, dbReadType);
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
                            var dosOrmDbType = (Dos.ORM.DatabaseType)Enum.Parse(typeof(Dos.ORM.DatabaseType), client.DbType);
                            client.DosOrmDb = new Dos.ORM.DbSession(dosOrmDbType, client.DbConn);

                            var dosOrmDbReadType = (Dos.ORM.DatabaseType)Enum.Parse(typeof(Dos.ORM.DatabaseType), client.DbReadType);
                            client.DosOrmDbRead = new Dos.ORM.DbSession(dosOrmDbReadType, client.DbReadConn);
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
                var claims = context.User.Claims;

                //.NET8
                var token = context.Request.Headers["authorization"].ToString();
                if (!token.DosIsNullOrWhiteSpace())
                {
                    claims = new JwtSecurityTokenHandler().ReadJwtToken(token.Replace("Bearer ", "")).Claims;
                }

                var osClient = claims.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                if (osClient == null)
                {
                    if (_context != null)
                    {
                        claims = _context.User.Claims;
                        //.NET8
                        token = _context.Request.Headers["authorization"].ToString();
                        if (!token.DosIsNullOrWhiteSpace())
                        {
                            claims = new JwtSecurityTokenHandler().ReadJwtToken(token.Replace("Bearer ", "")).Claims;
                        }
                        osClient = claims.FirstOrDefault(d => d.Type == "OsClient")?.Value;
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
                ClientList.AddOrUpdate(client.OsClient, client, (key, oldValue) => client);
                Console.WriteLine("Microi：【成功】更新OsClient：" + client.OsClient);
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


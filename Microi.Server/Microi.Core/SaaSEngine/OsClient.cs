using System;
using System.Collections.Concurrent;
using Dos.ORM;
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
                    //if (client.Db == null || client.DbRead == null
                    if (client.Db == null || client.DbRead == null
                        //|| client.DbLog == null
                        )
                    {
                        client.Db = new DbSession((DatabaseType)Enum.Parse(typeof(DatabaseType), client.DbType), client.DbConn);
                        if (client.DbReadConn.DosIsNullOrWhiteSpace())
                        {
                            client.DbReadConn = client.DbConn;
                        }
                        if (client.DbReadType.DosIsNullOrWhiteSpace())
                        {
                            client.DbReadType = client.DbType;
                        }
                        client.DbRead = new DbSession((DatabaseType)Enum.Parse(typeof(DatabaseType), client.DbReadType), client.DbReadConn);
                        //client.DbLog = new DbSession((DatabaseType)Enum.Parse(typeof(DatabaseType), client.DbReadType), client.DbReadConn);
                        AddOrUptClient(client);
                    }
                    return client;
                }

                throw new Exception($"未找到OsClient：{(osClient ?? "")}");
            }
            catch (Exception ex)
            {
                throw new Exception($"OsClient.GetClient出现错误：{ex.Message}");//。{ex.StackTrace}
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
                dataBaseModel.Db = new DbSession((DatabaseType)Enum.Parse(typeof(DatabaseType), dataBaseModel.DbType), dataBaseModel.DbConn);
                if (dataBaseModel.DbReadConn.DosIsNullOrWhiteSpace())
                {
                    dataBaseModel.DbReadConn = dataBaseModel.DbConn;
                }
                dataBaseModel.DbRead = new DbSession((DatabaseType)Enum.Parse(typeof(DatabaseType), dataBaseModel.DbType), dataBaseModel.DbReadConn);
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
        public static OsClientSecret InitOsClientDataBases(DbSession db, OsClientSecret secret)
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
        public static DbSession GetClientDbSession(OsClientSecret clientModel = null, string dataBaseId = "")
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
                    dataBaseModel.Db = new DbSession((DatabaseType)Enum.Parse(typeof(DatabaseType), dataBaseModel.DbType), dataBaseModel.DbConn);
                    if (dataBaseModel.DbReadConn.DosIsNullOrWhiteSpace())
                    {
                        dataBaseModel.DbReadConn = dataBaseModel.DbConn;
                    }
                    dataBaseModel.DbRead = new DbSession((DatabaseType)Enum.Parse(typeof(DatabaseType), dataBaseModel.DbType), dataBaseModel.DbReadConn);
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


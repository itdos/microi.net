
using Dos.Common;
using IdentityServer4;
using IdentityServer4.Models;

namespace Microi.net.Api

{
    /// <summary>
    /// 
    /// </summary>
    public class IS4Config
    {
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        public static IEnumerable<IdentityResource> GetIR()
        {
            return new List<IdentityResource>
            {
                //new IdentityResource("openid", new[] { JwtClaimTypes.Name, JwtClaimTypes.Email }),
                new IdentityResources.OpenId(),
                new IdentityResources.Profile()
            };
        }
        /// <summary>
        /// 
        /// </summary>
        /// <returns></returns>
        public static IEnumerable<ApiScope> GetApis()
        {
            return new List<ApiScope>
            {
                new ApiScope("microi")
            };
        }
        /// <summary>
        /// 定义可以访问该API的客户端
        /// </summary>
        /// <returns></returns>
        public static IEnumerable<IdentityServer4.Models.Client> GetClients()
        {
            try
            {
                var clientModel = OsClient.GetClient(OsClient.OsClientName);
                var dbInfo = DiyCommon.GetDbInfo(clientModel.DbType);

                var tableName_SysOsClients = dbInfo.DbService.GetTableName("Sys_OsClients");//, "MICROI"

                var fieldName_ClientName = dbInfo.DbService.GetFieldName("ClientName");
                var fieldAsName_ClientName = dbInfo.DbService.GetFieldAsName("ClientName");

                var fieldName_OsClient = dbInfo.DbService.GetFieldName("OsClient");
                var fieldAsName_ClientId = dbInfo.DbService.GetFieldAsName("ClientId");

                var fieldName_AuthSecret = dbInfo.DbService.GetFieldName("AuthSecret");
                var fieldAsName_ClientSecrets = dbInfo.DbService.GetFieldAsName("ClientSecrets");

                var fieldName_AccessTokenLifetime = dbInfo.DbService.GetFieldName("AccessTokenLifetime");
                var fieldAsName_AccessTokenLifetime = dbInfo.DbService.GetFieldAsName("AccessTokenLifetime");

                var clients = clientModel.DbRead
                                    .FromSql($@"select {fieldName_ClientName} AS {fieldAsName_ClientName},
                                                    {fieldName_OsClient} AS {fieldAsName_ClientId},
                                                    {fieldName_AuthSecret} AS {fieldAsName_ClientSecrets},
                                                    {fieldName_AccessTokenLifetime} AS {fieldAsName_AccessTokenLifetime}
                                            from {tableName_SysOsClients}
                                            where IsDeleted=0 and IsEnable=1
                                            and OsClientType=@OsClientType
                                            and OsClientNetwork=@OsClientNetwork
                                                        ")
                                    .AddInParameter("OsClientType", System.Data.DbType.String, OsClient.OsClientType)
                                    .AddInParameter("OsClientNetwork", System.Data.DbType.String, OsClient.OsClientNetwork)
                                    .ToList<ClientsJson>();

                //数据库有可能获取到的是空，这时候要从环境变量中取，以保证可以登陆
                if (!clients.Any(d => d.ClientId == OsClient.OsClientName)
                    && !clientModel.AuthSecret.DosIsNullOrWhiteSpace())
                {
                    clients.Insert(0, new ClientsJson()
                    {
                        ClientId = OsClient.OsClientName,
                        ClientName = clientModel.ClientName,
                        ClientSecrets = clientModel.AuthSecret,
                        AccessTokenLifetime = 20 * 60,
                    });
                }
                var result = new List<IdentityServer4.Models.Client>();
                foreach (var item in clients)
                {
                    if (!result.Any(d => d.ClientId == item.ClientId))
                    {
                        var newModel = new IdentityServer4.Models.Client
                        {
                            ClientId = item.ClientId,//就是OsClient值
                            ClientName = item.ClientName.DosIsNullOrWhiteSpace() ? item.ClientId : item.ClientName,

                            AllowedGrantTypes = GrantTypes.ResourceOwnerPassword,//GrantTypes.ResourceOwnerPasswordAndClientCredentials,//GrantTypes.ClientCredentials,//GrantTypes.ResourceOwnerPassword,//
                            AccessTokenLifetime = ((item.AccessTokenLifetime == null || item.AccessTokenLifetime == 0) ? 20 : item.AccessTokenLifetime.Value) * 60,

                            ClientSecrets =
                            {
                                new Secret((item.ClientSecrets.DosIsNullOrWhiteSpace() ? item.ClientId : item.ClientSecrets).Sha256())
                            },
                            AllowedScopes = {
                                "microi",
                                "offline_access",
                                // IdentityServerConstants.StandardScopes.OpenId,
                                // IdentityServerConstants.StandardScopes.Profile,
                            },
                            //4.1.1 新增
                            AllowOfflineAccess = true,
                            AlwaysSendClientClaims = true, // 将客户端声明添加到 ID 令牌中
                            AlwaysIncludeUserClaimsInIdToken = true, // 将用户声明添加到 ID 令牌中
                            AllowedIdentityTokenSigningAlgorithms = { "RS256", "RS512" }, // 指定签名算法
                            //RequireIdentityToken = true, // 需要身份令牌
                        };
                        result.Add(newModel);
                        Console.WriteLine(@$"Microi：添加IS4客户端 --> ClientId：{newModel.ClientId} --> ClientName：{newModel.ClientName} -->  AccessTokenLifetime：{newModel.AccessTokenLifetime} -->  ClientSecrets：{item.ClientSecrets}");
                    }
                }
                Console.WriteLine($"Microi：添加IS4客户端结束：成功：[{result.Count}]。数据库原始：[{clients.Count}]");
                return result;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：添加IS4客户端出现异常："
                                + ex.Message
                                + " --> InnerException.Message： --> " + (ex.InnerException == null ? "" : (ex.InnerException.Message ?? ""))
                                + " --> StackTrace： --> " + (ex.StackTrace ?? "")
                                );
                throw;
            }
        }
    }
}

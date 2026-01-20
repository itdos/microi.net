using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.IdentityModel.Tokens;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class DiyToken
    {
        /// <summary>
        /// 获取当前 OsClient
        /// </summary>
        /// <param name="returnDefaultOsClient">当未从当前上下文获取到OsClient时，是否返回默认的OsClient</param>
        /// <returns></returns>
        public static string GetCurrentOsClient(bool returnDefaultOsClient = true)
        {
            try
            {
                var context = DiyHttpContext.Current;
                if (context == null)
                {
                    return returnDefaultOsClient ? OsClientExtend.GetConfigOsClient() : "";
                }
                var claims = context.User.Claims;
                var token = context.Request?.Headers["Authorization"].ToString();
                if (token.DosIsNullOrWhiteSpace())
                {
                    token = context.Request?.Form["authorization"].ToString();
                }
                if (!token.DosIsNullOrWhiteSpace())
                {
                    try
                    {
                        claims = new JwtSecurityTokenHandler().ReadJwtToken(token.Replace("Bearer ", ""))?.Claims?.ToList();
                    }
                    catch (System.Exception)
                    {

                    }
                }
                var osClient = claims?.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = context.Request?.Headers["osclient"].ToString();
                }
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = context.Request?.Query["osclient"].ToString();
                }
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = context.Request?.Query["OsClient"].ToString();
                }
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = context.Request?.Form["_osclient"].ToString();
                }
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = context.Request?.Query["_osclient"].ToString();
                }
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = context.Request?.Form["osclient"].ToString();
                }
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = context.Request?.Form["OsClient"].ToString();
                }
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    osClient = OsClientExtend.GetConfigOsClient();
                    return returnDefaultOsClient ? OsClientExtend.GetConfigOsClient() : "";
                }
                return osClient;
            }
            catch (Exception ex)
            {
                return returnDefaultOsClient ? OsClientExtend.GetConfigOsClient() : "";
            }
        }
         /// <summary>
        /// 设置用户信息
        /// </summary>
        public JObject SetSysUserRoleInfo(dynamic userModel, string osClient)
        {
            #region GetSysUserOtherInfo
            JObject sysUser = JObject.FromObject(userModel);

            //2022-11-17 从Sys_User表的RoleIds字段中获取所有角色Id
            var roleIds = new List<string>();
            try
            {
                try
                {
                    if (!sysUser["RoleIds"].Val<string>().Contains("{"))
                    {
                        roleIds = JsonHelper.Deserialize<List<string>>(sysUser["RoleIds"].Val<string>());
                    }
                    else
                    {
                        var roles = JsonHelper.Deserialize<List<SysRole>>(sysUser["RoleIds"].Val<string>());
                        roleIds = roles.Select(d => d.Id).ToList();
                    }
                }
                catch (Exception ex)
                {
                    var roles = JsonHelper.Deserialize<List<SysRole>>(sysUser["RoleIds"].Val<string>());
                    roleIds = roles.Select(d => d.Id).ToList();
                }
                if (!roleIds.Any())
                {
                    sysUser["_IsAdmin"] = false;
                    sysUser["_Roles"] = JTokenEx.FromObject(new List<SysRole>());
                    sysUser["_RoleLimits"] = JTokenEx.FromObject(new List<SysRoleLimit>());
                }
                else
                {
                    var roleList = MicroiEngine.FormEngine.GetTableDataAsync<SysRole>(new
                    {
                        FormEngineKey = "sys_role",
                        _Where = new List<DiyWhere>() {
                                            new DiyWhere(){
                                                Name = "Id",
                                                Value = JsonHelper.Serialize(roleIds),
                                                Type = "In"
                                            }
                                        },
                        //Ids = roleIds,
                        OsClient = osClient
                    }).GetAwaiter().GetResult();

                    sysUser["_Roles"] = JTokenEx.FromObject(roleList.Data);


                    //var sysMenuLimits = await new SysRoleLimitLogic().GetSysRoleLimit(new SysRoleLimitParam()
                    //{
                    //    RoleIds = roleList.Data.Select(d => d.Id).ToList(),
                    //    OsClient = osClient
                    //});

                    var sysMenuLimits = MicroiEngine.FormEngine.GetTableDataAsync<SysRoleLimit>(new
                    {
                        FormEngineKey = "sys_rolelimit",
                        _Where = new List<DiyWhere>() {
                                            new DiyWhere(){
                                                Name = "RoleId",
                                                Value = JsonHelper.Serialize(roleList.Data.Select(d => d.Id).ToList()),
                                                Type = "In"
                                            }
                                        },
                        OsClient = osClient
                    }).GetAwaiter().GetResult();
                    if (sysMenuLimits.Code == 1)
                    {
                        sysUser["_RoleLimits"] = JTokenEx.FromObject(sysMenuLimits.Data);
                    }
                    else
                    {
                        sysUser["_RoleLimits"] = JTokenEx.FromObject(new List<SysRoleLimit>());
                        sysUser["_RoleLimitsError1"] = sysMenuLimits.Msg;
                    }
                    sysUser["_IsAdmin"] = sysUser["Level"].Val<int>() >= DiyCommon.MaxRoleLevel;
                }
            }
            catch (Exception ex)
            {

                sysUser["_IsAdmin"] = false;
                sysUser["_Roles"] = JTokenEx.FromObject(new List<SysRole>());
                sysUser["_RoleLimits"] = JTokenEx.FromObject(new List<SysRoleLimit>());
                sysUser["_RoleLimitsError2"] = ex.Message;
            }

            #endregion

            return sysUser;
        }

        /// <summary>
        /// 必传OsClient
        /// 生成全新Token，如登陆成功获取Token、Token过期刷新Token（注：DiyFilter会自动判断即将过期的Token并自动获取、更新Token），
        /// 请勿频繁调用，每次调用均会生成新的Token
        /// 获取当前身份信息请使用GetCurrentUser
        /// </summary>
        /// <returns></returns>
        public async Task<DosResult<CurrentToken>> GetAccessToken(DiyTokenParam param)
        {
            var osClient = "";
            var currentToken = await GetCurrentToken(false);
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                osClient = currentToken.OsClient;
            }
            else
            {
                osClient = param.OsClient;
            }
            if (osClient.DosIsNullOrWhiteSpace())
            {
                return new DosResult<CurrentToken>(0, null, "OsClient不能为空！");
            }
            var clientModel = OsClientExtend.GetClient(osClient);
            var access_token = "";
            var context = DiyHttpContext.Current;
            try
            {
                //客户端设备Id
                var did = currentToken.Token;
                if (context != null)
                {
                    did = context.Request.Headers["did"].ToString();
                }
                did = did.DosIsNullOrWhiteSpace() ? "Empty" : did;
                var ip = IPHelper.GetClientIP(context).Data ?? "";
                {
                    JObject currentUser = param.CurrentUser;
                    List<Claim> claims = new List<Claim>();
                    var userId = currentUser["Id"].ToString();
                    var clientType = param._ClientType.DosIsNullOrWhiteSpace() ? "Empty" : param._ClientType;
                    var dateTimeNow = DateTime.Now;
                    claims.Add(new Claim("UserId", userId));
                    claims.Add(new Claim("OsClient", osClient));
                    claims.Add(new Claim("ClientType", clientType));
                    claims.Add(new Claim("Did", did));
                    claims.Add(new Claim("IP", ip));
                    claims.Add(new Claim("CreateTime", dateTimeNow.ToString("yyyy-MM-dd HH:mm:ss")));
                    #region header返回
                    if (context != null)
                    {
                        if (!context.Response.Headers.Any(d => d.Key.ToLower() == "osclient"))
                        {
                            DiyCommon.TryAction(() =>
                            {
                                context.Response.Headers.Add("osclient", osClient);
                            });
                        }
                    }
                    #endregion
                    var sessionAuthTimeout = 20;
                    var tokenExpires = DateTime.Now;
                    if (clientType == "PC")
                    {
                        if (!clientModel.OsClientModel["SessionAuthTimeout"].Val<string>().DosIsNullOrWhiteSpace())
                        {
                            int.TryParse(clientModel.OsClientModel["SessionAuthTimeout"].Val<string>(), out sessionAuthTimeout);
                        }
                        if (sessionAuthTimeout <= 0)
                        {
                            sessionAuthTimeout = 20;
                        }
                        tokenExpires = tokenExpires.AddMinutes(sessionAuthTimeout);
                    }
                    else
                    {
                        if (!clientModel.OsClientModel["AccessTokenLifetime"].Val<string>().DosIsNullOrWhiteSpace())
                        {
                            int.TryParse(clientModel.OsClientModel["AccessTokenLifetime"].Val<string>(), out sessionAuthTimeout);
                        }
                        if (sessionAuthTimeout <= 0)
                        {
                            sessionAuthTimeout = 30;
                        }
                        tokenExpires = tokenExpires.AddDays(sessionAuthTimeout);
                    }

                    var handler = new JwtSecurityTokenHandler();

                    var jwtKey = clientModel.OsClientModel["AuthSecret"].Val<string>().DosIsNullOrWhiteSpace() ? clientModel.OsClient : clientModel.OsClientModel["AuthSecret"].Val<string>();
                    jwtKey = jwtKey.Length > 32 ? jwtKey.Substring(0, 32) : jwtKey.PadRight(32, '.');

                    var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
                    var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

                    var token = new JwtSecurityToken(
                        issuer: "microi",
                        audience: "microi",
                        claims: claims,
                        expires: tokenExpires,
                        signingCredentials: credentials
                    );
                    var jwtTokenHandler = new JwtSecurityTokenHandler();
                    access_token = jwtTokenHandler.WriteToken(token);


                    //不能用.Result，否则 redis 会超时 timeout 5000
                    var DiyCacheBase = MicroiEngine.CacheTenant.Cache(osClient);
                    var userTokenCacheKey = $"Microi:{osClient}:LoginTokenSysUser:{userId}";

                    CurrentToken tokenModel = null;
                    try
                    {
                        tokenModel = await DiyCacheBase.GetAsync<CurrentToken>(userTokenCacheKey);
                    }
                    catch (Exception ex)
                    {

                    }
                    if (tokenModel == null)
                    {
                        //如果为空，则新建
                        tokenModel = new CurrentToken()
                        {
                            CurrentUser = currentUser,
                            CreateTime = dateTimeNow,
                            UpdateTime = dateTimeNow,
                            Token = access_token,
                            OsClient = osClient,
                            Tokens = new List<TokensModel>()
                            {
                                new TokensModel()
                                {
                                    Token = access_token,
                                    ClientType = clientType,
                                    Did = did,
                                    IP = ip,
                                    CreateTime = dateTimeNow,
                                    UpdateTime = dateTimeNow
                                }
                            }
                        };
                    }
                    else
                    {
                        //如果已经登录过，则更新
                        tokenModel.CurrentUser = currentUser;
                        tokenModel.UpdateTime = dateTimeNow;
                        tokenModel.Token = access_token;
                        tokenModel.OsClient = osClient;
                        if (tokenModel.Tokens == null)
                        {
                            tokenModel.Tokens = new List<TokensModel>();
                        }
                        if (tokenModel.Tokens.Any(d => d.Did == did && d.ClientType == clientType))
                        {
                            var firstToken = tokenModel.Tokens.First(d => d.Did == did && d.ClientType == clientType);
                            firstToken.Token = access_token;
                            firstToken.IP = ip;
                            firstToken.UpdateTime = dateTimeNow;
                        }
                        else
                        {
                            tokenModel.Tokens.Add(new TokensModel()
                            {
                                Token = access_token,
                                ClientType = clientType,
                                Did = did,
                                IP = ip,
                                CreateTime = dateTimeNow,
                                UpdateTime = dateTimeNow
                            });
                        }
                    }

                    // 统一存储为 CurrentToken
                    await DiyCacheBase.SetAsync(userTokenCacheKey, tokenModel);
                    if (context != null && !context.Response.Headers.Any(d => d.Key.ToLower() == "authorization"))
                    {
                        try
                        {
                            context.Response.Headers.Add("authorization", tokenModel.Token);
                        }
                        catch (Exception)
                        {

                        }
                    }
                    return new DosResult<CurrentToken>(1, tokenModel);
                }
            }
            catch (Exception ex)
            {
                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "获取iTdosToken",
                    Title = "获取AccessToken抛出异常",
                    Content = ex.Message,
                    OsClient = osClient
                });
                return new DosResult<CurrentToken>(0, null, ex.Message);
            }
        }
        /// <summary>
        /// 获取当前登录身份信息
        /// </summary>
        /// <returns></returns>
        public static async Task<JObject> GetCurrentUser()
        {
            var currentToken = await GetCurrentToken();
            return currentToken.CurrentUser;
        }
        /// <summary>
        /// 获取当前登录身份信息，包含Token、OsClient
        /// </summary>
        public static async Task<JObject> GetCurrentUser(string token, string osClient = "")
        {
            try
            {
                if (!token.DosIsNullOrWhiteSpace())
                {
                    var jwtHandler = new JwtSecurityTokenHandler();
                    // var jwtToken = jwtHandler.ReadJwtToken(token.Replace("Bearer ", ""));
                    var claims = new List<Claim>();//jwtToken.Claims.ToList();

                    try
                    {
                        claims = new JwtSecurityTokenHandler().ReadJwtToken(token.Replace("Bearer ", "")).Claims.ToList();
                    }
                    catch (System.Exception)
                    {

                    }

                    var userId = claims.FirstOrDefault(d => d.Type == "UserId")?.Value;
                    osClient = claims.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                    var clientType = claims.FirstOrDefault(d => d.Type == "ClientType")?.Value;
                    clientType = clientType.DosIsNullOrWhiteSpace("Empty");

                    if (!userId.DosIsNullOrWhiteSpace() && !osClient.DosIsNullOrWhiteSpace())
                    {
                        var DiyCacheBase = MicroiEngine.CacheTenant.Cache(osClient);

                        var tokenModel = await DiyCacheBase.GetAsync<CurrentToken>($"Microi:{osClient}:LoginTokenSysUser:{userId}");
                        if (tokenModel != null && tokenModel.CurrentUser != null)
                        {
                            return tokenModel.CurrentUser;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "GetCurrentToken",
                    Title = "根据token字符串获取iTdosToken出错",
                    Content = ex.Message,// + "。" + ex.StackTrace,
                    OsClient = osClient //必传
                });
            }
            return null;
        }

        /// <summary>
        /// 从缓存中获取当前登录令牌信息（包含用户信息、Token、OsClient等）
        /// </summary>
        /// <param name="returnDefaultOsClient">当未从当前上下文获取到OsClient时，是否返回默认的OsClient</param>
        /// <returns></returns>
        public static async Task<CurrentToken> GetCurrentToken(bool returnDefaultOsClient = true)
        {
            var osClient = GetCurrentOsClient(returnDefaultOsClient);
            var token  = "";
            try
            {
                var context = DiyHttpContext.Current;
                if (context == null)
                {
                    return new CurrentToken()
                    {
                        OsClient = osClient
                    };
                }
                var claims = context.User.Claims;

                token = context.Request.Headers["Authorization"].ToString();
                if (token.DosIsNullOrWhiteSpace())
                {
                    token = context.Request?.Form["authorization"].ToString();
                }
                if (!token.DosIsNullOrWhiteSpace())
                {
                    try
                    {
                        claims = new JwtSecurityTokenHandler().ReadJwtToken(token.Replace("Bearer ", ""))?.Claims?.ToList();
                    }
                    catch (System.Exception)
                    {

                    }
                }
                var attributeList = new List<object>();
                var userId = claims?.FirstOrDefault(d => d.Type == "UserId")?.Value;//Id
                var clientType = claims?.FirstOrDefault(d => d.Type == "ClientType")?.Value;//Id
                clientType = clientType.DosIsNullOrWhiteSpace("Empty");

                if (osClient.DosIsNullOrWhiteSpace() || userId.DosIsNullOrWhiteSpace())
                {
                    return new CurrentToken()
                    {
                        OsClient = osClient,
                        Token = token
                    };
                }

                var DiyCacheBase = MicroiEngine.CacheTenant.Cache(osClient);

                var tokenModel = await DiyCacheBase.GetAsync<CurrentToken>($"Microi:{osClient}:LoginTokenSysUser:{userId}");
                if (tokenModel == null || tokenModel.CurrentUser == null)
                {
                    return new CurrentToken()
                    {
                        OsClient = osClient,
                        Token = token
                    };
                }
                tokenModel.OsClient = osClient;
                return tokenModel;
            }
            catch (Exception ex)
            {
                return new CurrentToken()
                {
                    OsClient = osClient,
                    Token = token
                };
            }
        }

        /// <summary>
        /// osClient可不传，传的话若获取token信息失败，会正确的写系统日志。
        /// </summary>
        public static async Task<CurrentToken> GetCurrentToken(string token, string osClient = "")
        {
            try
            {
                if (!token.DosIsNullOrWhiteSpace())
                {
                    var jwtHandler = new JwtSecurityTokenHandler();
                    // var jwtToken = jwtHandler.ReadJwtToken(token.Replace("Bearer ", ""));
                    var claims = new List<Claim>();// jwtToken.Claims.ToList();

                    try
                    {
                        claims = new JwtSecurityTokenHandler().ReadJwtToken(token.Replace("Bearer ", "")).Claims.ToList();
                    }
                    catch (System.Exception)
                    {

                    }

                    var userId = claims.FirstOrDefault(d => d.Type == "UserId")?.Value;
                    var thisOsClient = claims.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                    if (!osClient.DosIsNullOrWhiteSpace() && osClient != thisOsClient)
                    {
                        return null;
                    }
                    var clientType = claims.FirstOrDefault(d => d.Type == "ClientType")?.Value;
                    clientType = clientType.DosIsNullOrWhiteSpace("Empty");
                    if (!userId.DosIsNullOrWhiteSpace() && !thisOsClient.DosIsNullOrWhiteSpace())
                    {
                        var DiyCacheBase = MicroiEngine.CacheTenant.Cache(thisOsClient);
                        var tokenModel = await DiyCacheBase.GetAsync<CurrentToken>($"Microi:{thisOsClient}:LoginTokenSysUser:{userId}");
                        if (tokenModel != null && tokenModel.CurrentUser != null)
                        {
                            tokenModel.OsClient = thisOsClient;
                            return tokenModel;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "GetCurrentToken",
                    Title = "根据token字符串获取iTdosToken出错",
                    Content = ex.Message,// + "。" + ex.StackTrace,
                    OsClient = osClient //必传
                });
            }
            return null;
        }

    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using System.Net.Http;
using IdentityModel.Client;
using Newtonsoft.Json.Linq;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Tea.Utils;
using System.Reactive.Subjects;

namespace Microi.net.Api
{
    public class DiyToken
    {
        // static DiyToken()
        // {
        //     _httpClient = new HttpClient();
        // }

        /// <summary>
        /// 生成全新Token，如登陆	成功获取Token、Token过期刷新Token（注：DiyFilter会自动判断即将过期的Token并自动获取、更新Token），
        /// 请勿频繁调用，每次调用均会生成新的Token
        /// 获取当前身份信息请使用GetCurrentUser
        /// 2024-12-23 不再使用IS4
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="param"></param>
        /// <returns></returns>
        public async Task<DosResult<CurrentToken<T>>> GetAccessToken<T>(DiyTokenParam<T> param, HttpContext? context = null)
        {
            if (param.CurrentUser == null)
            {
                return new DosResult<CurrentToken<T>>(0, null, "用户信息不能为空！");
            }
            var access_token = "";
            var osClient = "";
            // var client = _httpClientFactory == null ? _httpClient : _httpClientFactory.CreateClient();
            // if (client == null)
            // {
            //     return new DosResult<CurrentToken<T>>(0, null, "client为null！");
            // }
            // try
            // {
            //     if (client.Timeout == null)
            //     {
            //         client.Timeout = new TimeSpan(0, 0, 10);
            //     }
            // }
            // catch (Exception)
            // {
            // }
            if (context == null)
            {
                context = DiyHttpContext.Current;
            }
            try
            {
                if (context != null)
                {
                    osClient = (context.Request.HasFormContentType && context.Request.Form["OsClient"].Count() > 0 && !context.Request.Form["OsClient"].ToString().DosIsNullOrWhiteSpace())
                               ? context.Request.Form["OsClient"].ToString() : "";
                }
            }
            catch (Exception)
            {
            }

            if (!param.OsClient.DosIsNullOrWhiteSpace())
            {
                osClient = param.OsClient;
            }
            var authServer = "";

            try
            {
                if (osClient.DosIsNullOrWhiteSpace())
                {
                    return new DosResult<CurrentToken<T>>(0, null, "OsClient不能为空！");
                }

                var clientModel = OsClient.GetClient(osClient);

                //客户端设备Id
                var did = "";
                if (context != null)
                {
                    did = context.Request.Headers["did"].ToString();
                }
                did = did.DosIsNullOrWhiteSpace() ? "Empty" : did;
                var ip = IPHelper.GetClientIP(context).Data ?? "";
                dynamic currentUser = param.CurrentUser;
                Type entityType = typeof(T);
                var userId = "";

                var dateTimeNow = DateTime.Now;

                if (entityType.Equals(typeof(JObject)) || entityType.Equals(typeof(object)))
                {
                    userId = JObject.FromObject(param.CurrentUser)["Id"].ToString();
                }
                else
                {
                    userId = entityType.GetProperty("Id").GetValue(param.CurrentUser).ToString();
                }
                var clientType = param._ClientType.DosIsNullOrWhiteSpace() ? "Empty" : param._ClientType;
                var claims = new[]
                {
                        new Claim("UserId", userId),
                        new Claim("OsClient", osClient), // 添加自定义声明
                        new Claim("ClientType", clientType), // 添加自定义声明
                        new Claim("Did", did), // 添加自定义声明
                        new Claim("IP", ip), // 添加自定义声明
                        new Claim("CreateTime", dateTimeNow.ToString("yyyy-MM-dd HH:mm:ss")) // 添加自定义声明
                    };

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
                    if (!clientModel.SessionAuthTimeout.DosIsNullOrWhiteSpace())
                    {
                        int.TryParse(clientModel.SessionAuthTimeout, out sessionAuthTimeout);
                    }
                    if (sessionAuthTimeout <= 0)
                    {
                        sessionAuthTimeout = 20;
                    }
                    tokenExpires = tokenExpires.AddMinutes(sessionAuthTimeout);
                }
                else
                {
                    if (!clientModel.AccessTokenLifetime.DosIsNullOrWhiteSpace())
                    {
                        int.TryParse(clientModel.AccessTokenLifetime, out sessionAuthTimeout);
                    }
                    if (sessionAuthTimeout <= 0)
                    {
                        sessionAuthTimeout = 30;
                    }
                    tokenExpires = tokenExpires.AddDays(sessionAuthTimeout);
                }


                var handler = new JwtSecurityTokenHandler();
                var jwtKey = clientModel.AuthSecret.DosIsNullOrWhiteSpace() ? clientModel.OsClient : clientModel.AuthSecret;
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
                
                // 统一读取为 JObject 类型（缓存中统一存储的类型）
                var tokenModelCache = await DiyCacheBase.GetAsync<CurrentToken<JObject>>(userTokenCacheKey);
                
                // 统一转换为 JObject 用户信息（低代码平台动态字段支持）
                JObject userJObject = null;
                if (!entityType.Equals(typeof(JObject)))
                {
                    // 如果传入的不是 JObject，先尝试从数据库获取完整用户信息
                    var userModelResult = await new SysUserLogic().GetDiySysUserModel(new SysUserParam()
                    {
                        Id = userId,
                        OsClient = osClient
                    });
                    userJObject = userModelResult.Code == 1 ? userModelResult.Data : JObject.FromObject(param.CurrentUser);
                }
                else
                {
                    userJObject = param.CurrentUser as JObject ?? JObject.FromObject(param.CurrentUser);
                }
                
                // 构建或更新 Token 模型
                CurrentToken<JObject> diyTokenModel;
                if (tokenModelCache == null)
                {
                    // 如果为空，则新建
                    diyTokenModel = new CurrentToken<JObject>()
                    {
                        CurrentUser = userJObject,
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
                    // 如果已经登录过，则更新
                    diyTokenModel = tokenModelCache;
                    diyTokenModel.CurrentUser = userJObject;
                    diyTokenModel.UpdateTime = dateTimeNow;
                    diyTokenModel.Token = access_token;
                    diyTokenModel.OsClient = osClient;
                    if (diyTokenModel.Tokens == null)
                    {
                        diyTokenModel.Tokens = new List<TokensModel>();
                    }
                    if (diyTokenModel.Tokens.Any(d => d.Did == did && d.ClientType == clientType))
                    {
                        var firstToken = diyTokenModel.Tokens.First(d => d.Did == did && d.ClientType == clientType);
                        firstToken.Token = access_token;
                        firstToken.IP = ip;
                        firstToken.UpdateTime = dateTimeNow;
                    }
                    else
                    {
                        diyTokenModel.Tokens.Add(new TokensModel()
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
                
                // 统一存储为 JObject 类型
                await DiyCacheBase.SetAsync(userTokenCacheKey, diyTokenModel);
                
                if (context != null && !context.Response.HasStarted)
                {
                    context.Response.Headers["authorization"] = access_token;
                }
                
                // 转换为返回类型 T
                var resultTokenModel = new CurrentToken<T>
                {
                    CurrentUser = typeof(T) == typeof(JObject) 
                        ? (T)(object)diyTokenModel.CurrentUser 
                        : diyTokenModel.CurrentUser.ToObject<T>(),
                    CreateTime = diyTokenModel.CreateTime,
                    UpdateTime = diyTokenModel.UpdateTime,
                    Token = diyTokenModel.Token,
                    OsClient = diyTokenModel.OsClient,
                    Tokens = diyTokenModel.Tokens
                };
                
                return new DosResult<CurrentToken<T>>(1, resultTokenModel);
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
                return new DosResult<CurrentToken<T>>(0, null, "获取AccessToken抛出异常：" + ex.Message);
            }
        }
        /// <summary>
        /// 
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <returns></returns>
        public static async Task<CurrentToken<T>> GetCurrentToken<T>()//HttpContext context
        {
            try
            {
                var context = DiyHttpContext.Current;
                if (context == null)
                {
                    return default(CurrentToken<T>);
                }
                var claims = context.User.Claims;

                //.NET8
                var token = context.Request.Headers["Authorization"].ToString();
                if (token.DosIsNullOrWhiteSpace())
                {
                    token = context.Request.Headers["authorization"].ToString();
                }
                if (!token.DosIsNullOrWhiteSpace())
                {
                    try
                    {
                        claims = new JwtSecurityTokenHandler().ReadJwtToken(token.Replace("Bearer ", "")).Claims.ToList();
                    }
                    catch (System.Exception)
                    {

                    }
                }

                var osClient = claims.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                var attributeList = new List<object>();
                var userId = claims.FirstOrDefault(d => d.Type == "UserId")?.Value;//Id
                var clientType = claims.FirstOrDefault(d => d.Type == "ClientType")?.Value;//Id
                clientType = clientType.DosIsNullOrWhiteSpace("Empty");

                if (osClient.DosIsNullOrWhiteSpace() || userId.DosIsNullOrWhiteSpace())
                {
                    //context.Result = new JsonResult(new DosResult(DiyMessage.Msg["CodeNoLogin"][param._Lang], null, DiyMessage.Msg["NoLogin"][param._Lang]));// "没有统一身份权限！请联系系统管理员。"
                    return default(CurrentToken<T>);
                }

                var DiyCacheBase = MicroiEngine.CacheTenant.Cache(osClient);

                // 缓存中统一存储的是 CurrentToken<JObject>，需要先以 JObject 类型读取
                CurrentToken<JObject> tokenModelCache = null;
                try
                {
                    // 先尝试读取 JObject 类型
                    tokenModelCache = await DiyCacheBase.GetAsync<CurrentToken<JObject>>($"Microi:{osClient}:LoginTokenSysUser:{userId}");
                }
                catch
                {
                    // 如果读取失败，可能是旧数据，尝试清除并返回 null
                    try
                    {
                        await DiyCacheBase.DeleteAsync($"Microi:{osClient}:LoginTokenSysUser:{userId}");
                    }
                    catch { }
                }
                
                if (tokenModelCache == null || tokenModelCache.CurrentUser == null)
                {
                    return default(CurrentToken<T>);
                }
                tokenModelCache.OsClient = osClient;
                
                // 根据泛型 T 转换为目标类型
                var tokenModel = new CurrentToken<T>
                {
                    CurrentUser = typeof(T) == typeof(JObject) 
                        ? (T)(object)tokenModelCache.CurrentUser 
                        : (T)((JObject)tokenModelCache.CurrentUser).ToObject(typeof(T)),
                    CreateTime = tokenModelCache.CreateTime,
                    UpdateTime = tokenModelCache.UpdateTime,
                    Token = tokenModelCache.Token,
                    OsClient = tokenModelCache.OsClient,
                    Tokens = tokenModelCache.Tokens
                };
                return tokenModel;
            }
            catch (Exception ex)
            {
                //MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                //{
                //    Type = "获取iTdosToken",
                //    Title = "GetCurrentToken出错",
                //    Content = ex.Message,// + "。" + ex.StackTrace,
                //    OsClient = osClient.Value
                //});
                Console.WriteLine("Microi：【警告】GetCurrentToken出错：" + ex.Message);
                return default(CurrentToken<T>);
            }

        }

        /// <summary>
        /// osClient可不传，传的话若获取token信息失败，会正确的写系统日志。
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="token"></param>
        /// <param name="osClient"></param>
        /// <returns></returns>
        public static async Task<CurrentToken<T>> GetCurrentToken<T>(string token, string osClient = "")
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
                    osClient = claims.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                    var clientType = claims.FirstOrDefault(d => d.Type == "ClientType")?.Value;
                    clientType = clientType.DosIsNullOrWhiteSpace("Empty");
                    if (!userId.DosIsNullOrWhiteSpace() && !osClient.DosIsNullOrWhiteSpace())
                    {
                        var DiyCacheBase = MicroiEngine.CacheTenant.Cache(osClient);
                        // 缓存中统一存储的是 CurrentToken<JObject>
                        CurrentToken<JObject> tokenModelCache = null;
                        try
                        {
                            tokenModelCache = await DiyCacheBase.GetAsync<CurrentToken<JObject>>($"Microi:{osClient}:LoginTokenSysUser:{userId}");
                        }
                        catch
                        {
                            // 旧数据类型不匹配，清除缓存
                            try { await DiyCacheBase.DelAsync($"Microi:{osClient}:LoginTokenSysUser:{userId}"); } catch { }
                        }
                        
                        if (tokenModelCache != null && tokenModelCache.CurrentUser != null)
                        {
                            tokenModelCache.OsClient = osClient;
                            
                            // 根据泛型 T 转换为目标类型
                            var tokenModel = new CurrentToken<T>
                            {
                                CurrentUser = typeof(T) == typeof(JObject) 
                                    ? (T)(object)tokenModelCache.CurrentUser 
                                    : (T)((JObject)tokenModelCache.CurrentUser).ToObject(typeof(T)),
                                CreateTime = tokenModelCache.CreateTime,
                                UpdateTime = tokenModelCache.UpdateTime,
                                Token = tokenModelCache.Token,
                                OsClient = tokenModelCache.OsClient,
                                Tokens = tokenModelCache.Tokens
                            };
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
        /// <summary>
        /// 获取当前 OsClient
        /// </summary>
        /// <returns></returns>
        public static string GetCurrentOsClient(Microsoft.AspNetCore.Http.HttpContext _context = null)
        {
            try
            {
                var context = DiyHttpContext.Current;
                if (context == null)
                {
                    context = _context;
                }
                if (context == null)
                {
                    return OsClient.GetConfigOsClient();
                    return "";
                }
                var claims = context.User.Claims;
                //.NET8
                var token = context.Request.Headers["authorization"].ToString();
                if (!token.DosIsNullOrWhiteSpace())
                {
                    try
                    {
                        claims = new JwtSecurityTokenHandler().ReadJwtToken(token.Replace("Bearer ", "")).Claims.ToList();
                    }
                    catch (System.Exception)
                    {

                    }
                }

                var osClient = claims.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                if (osClient == null)
                {
                    if (_context != null)
                    {
                        claims = _context.User.Claims;
                        //.NET8
                        token = _context.Request.Headers["Authorization"].ToString();
                        if (token.DosIsNullOrWhiteSpace())
                        {
                            token = _context.Request.Headers["authorization"].ToString();
                        }
                        if (!token.DosIsNullOrWhiteSpace())
                        {
                            try
                            {
                                claims = new JwtSecurityTokenHandler().ReadJwtToken(token.Replace("Bearer ", "")).Claims.ToList();
                            }
                            catch (System.Exception)
                            {

                            }
                        }

                        osClient = claims.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                        if (osClient == null)
                        {
                            return OsClient.GetConfigOsClient();
                            return "";
                        }
                    }
                    return OsClient.GetConfigOsClient();
                    return "";
                }
                return osClient;
            }
            catch (Exception ex)
            {

                return OsClient.GetConfigOsClient();
                return "";
            }
        }
        /// <summary>
        /// 获取当前登录身份信息，包含Token、OsClient
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <returns></returns>
        public static async Task<T> GetCurrentUser<T>()//HttpContext context
        {
            try
            {
                var context = DiyHttpContext.Current;
                //var a =   HttpContext.Session.GetString("");
                T sysUser = default(T);
                var attributeList = new List<object>();
                //var userIdAttr = claims.FirstOrDefault(d => d.Type == "Id");
                //attributeList.AddRange((context.ActionDescriptor as ControllerActionDescriptor).MethodInfo.GetCustomAttributes(true));
                //attributeList.AddRange((context.ActionDescriptor as ControllerActionDescriptor).MethodInfo.DeclaringType.GetCustomAttributes(true));
                //var authorizeAttributes = attributeList.OfType<IS4AuthorizeAttribute>().ToList();
                var claims = context.User.Claims;

                //.NET8
                var token = context.Request.Headers["authorization"].ToString();
                if (!token.DosIsNullOrWhiteSpace())
                {
                    try
                    {
                        claims = new JwtSecurityTokenHandler().ReadJwtToken(token.Replace("Bearer ", "")).Claims;
                    }
                    catch (System.Exception)
                    {

                    }
                }
                var userId = claims.FirstOrDefault(d => d.Type == "UserId")?.Value;
                var osClient = claims.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                var clientType = claims.FirstOrDefault(d => d.Type == "ClientType")?.Value;
                clientType = clientType.DosIsNullOrWhiteSpace("Empty");
                if (osClient.DosIsNullOrWhiteSpace() || userId.DosIsNullOrWhiteSpace())
                {
                    //context.Result = new JsonResult(new DosResult(DiyMessage.Msg["CodeNoLogin"][param._Lang], null, DiyMessage.Msg["NoLogin"][param._Lang]));// "没有统一身份权限！请联系系统管理员。"
                    return default(T);
                }
                var DiyCacheBase = MicroiEngine.CacheTenant.Cache(osClient);

                // 缓存中统一存储的是 CurrentToken<JObject>
                CurrentToken<JObject> tokenModelCache = null;
                try
                {
                    tokenModelCache = await DiyCacheBase.GetAsync<CurrentToken<JObject>>($"Microi:{osClient}:LoginTokenSysUser:{userId}");
                }
                catch
                {
                    // 旧数据类型不匹配，清除缓存
                    try { await DiyCacheBase.DelAsync($"Microi:{osClient}:LoginTokenSysUser:{userId}"); } catch { }
                }
                
                if (tokenModelCache == null || tokenModelCache.CurrentUser == null)
                {
                    return default(T);
                }
                tokenModelCache.OsClient = osClient;
                
                // 根据泛型 T 转换用户信息
                sysUser = typeof(T) == typeof(JObject) 
                    ? (T)(object)tokenModelCache.CurrentUser 
                    : (T)((JObject)tokenModelCache.CurrentUser).ToObject(typeof(T));
                return sysUser;
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：【警告】GetCurrentUser出错：" + ex.Message);
                //MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                //{
                //    Type = "GetCurrentToken",
                //    Title = "根据token字符串获取iTdosToken出错",
                //    Content = ex.Message,// + "。" + ex.StackTrace,
                //    OsClient = osClient //必传
                //});
                return default(T);
            }
        }
        /// <summary>
        /// 获取当前登录身份信息，包含Token、OsClient
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="token"></param>
        /// <param name="osClient"></param>
        /// <returns></returns>
        public static async Task<T> GetCurrentUser<T>(string token, string osClient = "")
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

                        // 缓存中统一存储的是 CurrentToken<JObject>
                        CurrentToken<JObject> tokenModelCache = null;
                        try
                        {
                            tokenModelCache = await DiyCacheBase.GetAsync<CurrentToken<JObject>>($"Microi:{osClient}:LoginTokenSysUser:{userId}");
                        }
                        catch
                        {
                            // 旧数据类型不匹配，清除缓存
                            try { await DiyCacheBase.DelAsync($"Microi:{osClient}:LoginTokenSysUser:{userId}"); } catch { }
                        }
                        
                        if (tokenModelCache != null && tokenModelCache.CurrentUser != null)
                        {
                            // 根据泛型 T 转换用户信息
                            return typeof(T) == typeof(JObject) 
                                ? (T)(object)tokenModelCache.CurrentUser 
                                : (T)((JObject)tokenModelCache.CurrentUser).ToObject(typeof(T));
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
            return default(T);
        }

    }
}


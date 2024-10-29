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

namespace Microi.net.Api.Handler
{
	public class DiyToken
	{
        private static HttpClient? _httpClient;
        private static IHttpClientFactory? _httpClientFactory;

        public DiyToken(IHttpClientFactory httpClientFactory)
        {
            _httpClient = new HttpClient();
            _httpClientFactory = httpClientFactory;
        }

        static DiyToken()
        {
            _httpClient = new HttpClient();
        }

        /// <summary>
        /// 生成全新Token，如登陆	成功获取Token、Token过期刷新Token（注：DiyFilter会自动判断即将过期的Token并自动获取、更新Token），
        /// 请勿频繁调用，每次调用均会生成新的Token
        /// 获取当前身份信息请使用GetCurrentUser
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="param"></param>
        /// <returns></returns>
        public static async Task<DosResult<CurrentToken<T>>> GetAccessToken<T>(DiyTokenParam<T> param, HttpContext? context = null)
        {
            if (param.CurrentUser == null)
            {
                return new DosResult<CurrentToken<T>>(0, null, "用户信息不能为空！");
            }
            var access_token = "";
            var osClient = "";
            var client = _httpClientFactory == null ? _httpClient : _httpClientFactory.CreateClient();
            if (client == null)
            {
                return new DosResult<CurrentToken<T>>(0, null, "client为null！");
            }
            try
            {
                client.Timeout = new TimeSpan(0, 0, 10);
            }
            catch (Exception)
            {
            }
            if (context == null)
            {
                context = DiyHttpContext.Current;
            }
            try
            {
                if (context != null)
                {
                    if (!context.Response.Headers.Any(d => d.Key.ToLower() == "access-control-expose-headers"))
                    {
                        DiyCommon.TryAction(() => {
                            context.Response.Headers.Add("access-control-expose-headers", "set-cookie,token,did,authorization,apiengine,osclient");
                        });
                    }

                    osClient = (context.Request.Form["OsClient"].Count() > 0 && !context.Request.Form["OsClient"].ToString().DosIsNullOrWhiteSpace())
                               ? context.Request.Form["OsClient"].ToString() : "";
                }
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                //暂不处理
                //return new DosResult(0, null, "从Form中获取OsClient失败：" + ex.Message);
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
                if (clientModel.AuthServer.DosIsNullOrWhiteSpace())
                {
                    return new DosResult<CurrentToken<T>>(0, null, $"OsClient【{osClient}】的AuthServer为空");
                }
                authServer = clientModel.AuthServerV2.DosIsNullOrWhiteSpace() ? clientModel.AuthServer : clientModel.AuthServerV2;
                //var apiBaseInternal = Environment.GetEnvironmentVariable("ApiBaseInternal", EnvironmentVariableTarget.Process) ?? ConfigHelper.GetAppSettings("ApiBaseInternal") ?? "";
                //if (!apiBaseInternal.DosIsNullOrWhiteSpace())
                //{
                //    authServer = apiBaseInternal;
                //}
                var policy = new DiscoveryPolicy()
                {
                    ValidateIssuerName = false,
                    ValidateEndpoints = false,
                    RequireHttps = false, //authServer.StartsWith("https://"), //false,
                    Authority = authServer
                };
                var disco = await client.GetDiscoveryDocumentAsync(new DiscoveryDocumentRequest()
                {
                    Address = authServer,
                    Policy = policy
                });

                //客户端设备Id
                var did = "";
                if (context != null)
                {
                    did = (context.Request.Headers["did"].Count() > 0 && !context.Request.Headers["did"].ToString().DosIsNullOrWhiteSpace())
                                ? context.Request.Headers["did"].ToString() : "";
                }
                if (!disco.IsError)
                {
                    dynamic currentUser = param.CurrentUser;
                    var extra = new Parameters();// new Dictionary<string, string>();
                    //extra.Add("UserInfo", JsonConvert.SerializeObject(param.CurrentUser));

                    Type entityType = typeof(T);
                    var userId = "";

                    if (entityType.Equals(typeof(JObject)) || entityType.Equals(typeof(object)))
                    {
                        userId = JObject.FromObject(param.CurrentUser)["Id"].ToString();
                    }
                    else
                    {
                        userId = entityType.GetProperty("Id").GetValue(param.CurrentUser).ToString();
                    }
                    extra.Add("Id", userId);
                    extra.Add("OsClient", osClient);

                    //这个replace至关重要  2021-04-29
                    var tokenEndPoint = disco.TokenEndpoint;
                    if (authServer.StartsWith("https://"))
                    {
                        tokenEndPoint = disco.TokenEndpoint.Replace("http://", "https://");
                    }
                    else if (authServer.StartsWith("http://"))
                    {
                        tokenEndPoint = disco.TokenEndpoint.Replace("https://", "http://");
                    }

                    #region header返回
                    if (context != null)
                    {
                        if (!context.Response.Headers.Any(d => d.Key.ToLower() == "auth"))
                        {
                            DiyCommon.TryAction(() => {
                                context.Response.Headers.Add("auth", tokenEndPoint);
                            });
                        }
                        if (!context.Response.Headers.Any(d => d.Key.ToLower() == "osclient"))
                        {
                            DiyCommon.TryAction(() => {
                                context.Response.Headers.Add("osclient", osClient);
                            });
                        }
                    }

                    #endregion

                    #region Password
                    var ptrParam = new PasswordTokenRequest
                    {
                        Address = tokenEndPoint,
                        ClientId = osClient,
                        ClientSecret = clientModel.AuthSecret,
                        UserName = userId,
                        Password = "microi",
                        Scope = "microi",
                        Parameters = extra,
                        GrantType = "password"
                    };
                    var tokenResponse = await client.RequestPasswordTokenAsync(ptrParam);
                    #endregion

                    #region ClientCredentials
                    // var tokenResponse = await client.RequestClientCredentialsTokenAsync(new ClientCredentialsTokenRequest
                    // {
                    //    Address = tokenEndPoint,
                    //    ClientId = osClient,
                    //    ClientSecret = clientModel.AuthSecret,
                    //    Scope = "microi",
                    //    Parameters = extra,
                    //    GrantType = "client_credentials"
                    // });
                    #endregion

                    if (!tokenResponse.IsError)
                    {
                        access_token = tokenResponse.AccessToken;
                    }
                    else
                    {
                        var ptrParam2 = new
                        {
                            Address = tokenEndPoint,
                            ClientId = osClient,
                            ClientSecret = clientModel.AuthSecret,
                            UserName = userId,
                        };
                        #pragma warning disable CS4014
                        new SysLogLogic().AddSysLog(new SysLogParam()
                        {
                            Type = "获取Token",
                            Title = "获取AccessToken失败",
                            Content = "RequestPasswordTokenAsync。OsClient:" + osClient + "。"
                                        + (tokenResponse.Error ?? "") + "。"
                                        + (tokenResponse.ErrorDescription ?? "") + "。"
                                        + "ptrParam：" + JsonConvert.SerializeObject(ptrParam2),
                            OsClient = osClient
                        });
                        return new DosResult<CurrentToken<T>>(0, null, tokenResponse.Error + " " + tokenResponse.ErrorDescription);
                    }

                    //不能用.Result，否则 redis 会超时 timeout 5000
                    CurrentToken<T> tokenModel = null;
                    var DiyCacheBase = new MicroiCacheRedis(osClient);
                    tokenModel = await DiyCacheBase.GetAsync<CurrentToken<T>>("LoginTokenSysUser:" + osClient + ":" + userId);
                    if (tokenModel == null)
                    {
                        //如果为空，则新建
                        tokenModel = new CurrentToken<T>()
                        {
                            //Token = token,
                            CurrentUser = currentUser,
                            //IP = IPHelper.GetClientIP(context), 
                            Did = did,
                            CreateTime = DateTime.Now,
                            UpdateTime = DateTime.Now,
                            Token = access_token,
                            OsClient = osClient
                        };
                    }
                    else
                    {
                        //如果已经登录过，则更新
                        tokenModel.CurrentUser = currentUser;
                        //tokenModel.IP = IPHelper.GetClientIP(context);
                        tokenModel.Did = did;
                        //tokenModel.Token = token;
                        tokenModel.UpdateTime = DateTime.Now;
                        tokenModel.Token = access_token;
                        tokenModel.OsClient = osClient;
                    }

                    if (!entityType.Equals(typeof(JObject)))
                    {
                        //userId = JObject.FromObject(param.CurrentUser)["Id"].ToString();
                        var userModelResult = await new SysUserLogic().GetDiySysUserModel(new SysUserParam()
                        {
                            Id = userId,
                            OsClient = osClient
                        });
                        if (userModelResult.Code == 1)
                        {
                            var diyTokenModel = new CurrentToken<JObject>();
                            diyTokenModel.CurrentUser = userModelResult.Data;
                            var iddd = userModelResult.Data.Id;
                            diyTokenModel.Did = tokenModel.Did;
                            diyTokenModel.UpdateTime = tokenModel.UpdateTime;
                            diyTokenModel.Token = tokenModel.Token;
                            diyTokenModel.OsClient = tokenModel.OsClient;
                            await DiyCacheBase.SetAsync("LoginTokenSysUser:" + osClient + ":" + userId, diyTokenModel);
                        }
                    }
                    else
                    {
                        await DiyCacheBase.SetAsync("LoginTokenSysUser:" + osClient + ":" + userId, tokenModel);
                    }

                    if (context != null && !context.Response.Headers.Any(d => d.Key.ToLower() == "authorization"))
                    {
                        DiyCommon.TryAction(() => {
                            context.Response.Headers.Add("authorization", tokenModel.Token);
                        });
                    }
                    return new DosResult<CurrentToken<T>>(1, tokenModel);
                }
                else
                {
                    #pragma warning disable CS4014
                    new SysLogLogic().AddSysLog(new SysLogParam()
                    {
                        Type = "获取iTdosToken",
                        Title = "获取AccessToken失败",
                        Content = "GetDiscoveryDocumentAsync。osClient:" + osClient + "。" + disco.Error,
                        OsClient = osClient
                    });
                    return new DosResult<CurrentToken<T>>(0, null, disco.Error);
                }
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                #pragma warning disable CS4014
                new SysLogLogic().AddSysLog(new SysLogParam()
                {
                    Type = "获取iTdosToken",
                    Title = "获取AccessToken抛出异常",
                    Content = ex.Message,
                    OsClient = osClient
                });
                return new DosResult<CurrentToken<T>>(0, null,
                    "获取AccessToken抛出异常："
                    + ex.Message
                    + " --> AuthServer：" + authServer
                    + " --> OsClient：" + osClient
                    + " --> client is null：" + (client == null ? "1" : "0")
                    + " --> InnerException.Message： --> "
                    + (ex.InnerException == null ? "" : (ex.InnerException.Message ?? ""))
                    + " --> StackTrace： --> " + (ex.StackTrace ?? ""));
            }
        }
    }
}


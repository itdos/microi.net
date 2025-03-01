#region << 版 本 注 释 >>
/****************************************************
* 文 件 名：
* Copyright(c) Microi.net
* CLR 版本: 
* 创 建 人：Anderson
* 电子邮箱：973702@qq.com
* 创建日期：
* 文件描述：
******************************************************
* 修 改 人：
* 修改日期：
* 备注描述：
*******************************************************/
#endregion
using Dos.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using MongoDB.Driver;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;

namespace Microi.net.Api
{
    /// <summary>
    /// 验证token和权限
    /// </summary>
    public class DiyFilterCustom<T> : DiyFilter<T>
    {
        /// <summary>
        /// 
        /// </summary>
        /// <typeparam name="T"></typeparam>
        /// <param name="context"></param>
        /// <returns></returns>
        public override async Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            try
            {
                var osClient = Microi.net.DiyToken.GetCurrentOsClient();

                DiyCommon.TryAction(() => {
                    context.HttpContext.Response.Headers.Add("osclient", osClient);
                });
                DiyCommon.TryAction(() => {
                    context.HttpContext.Response.Headers.Add("Access-Control-Max-Age", new Microsoft.Extensions.Primitives.StringValues("24*60*60"));
                });
                DiyCommon.TryAction(() => {
                    //从环境变量或配置文件获取当前是哪台服务器节点
                    context.HttpContext.Response.Headers.Add("server-node", "");
                });

                if (context.Filters.Any(item => item is IAllowAnonymousFilter))
                {
                    return;
                }

                var endpoint = context.HttpContext.GetEndpoint();
                if (endpoint?.Metadata?.GetMetadata<IAllowAnonymous>() != null)
                {
                    return;
                }

                if (!(context.ActionDescriptor is ControllerActionDescriptor))
                {
                    return;
                }

                var Lang = context.HttpContext.Request.Headers["lang"].ToString();
                if (Lang.DosIsNullOrWhiteSpace() || Lang == "null")
                {
                    Lang = DiyMessage.Lang;
                }

                if (!context.Filters.Any(item => item is IAllowAnonymousFilter))
                {
                    T sysUser = default(T);
                    CurrentToken<T> tokenModel = null;

                    #region 从is4中获取身份认证信息
                    var claims = context.HttpContext.User.Claims;
                    var userId = claims.FirstOrDefault(d => d.Type == "UserId")?.Value;
                    var osClientToken = claims.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                    if (userId.DosIsNullOrWhiteSpace()|| osClientToken.DosIsNullOrWhiteSpace()
                        )
                    {
                        // "没有统一身份权限！请联系系统管理员。"  + " - 1"
                        context.Result = new JsonResult(new DosResult(int.Parse(DiyMessage.GetLangCode(osClient, "NoLogin")), null, DiyMessage.GetLang(osClientToken,  "NoLogin", Lang) ));
                        return;
                    }
                    else
                    {
                        //从redis中获取身份信息
                        try
                        {
                            var DiyCacheBase = new MicroiCacheRedis(osClientToken);
                            tokenModel = await DiyCacheBase.GetAsync<CurrentToken<T>>($"Microi:{osClient}:LoginTokenSysUser:{userId}");
                        }
                        catch (Exception ex)
                        {
                            context.Result = new JsonResult(new DosResult(int.Parse(DiyMessage.GetLangCode(osClient, "NoLogin")), null, DiyMessage.GetLang(osClientToken,  "NoLogin", Lang) + ex.Message)); //+ " - 2"
                            return;
                        }
                        //登陆身份已失效，因为redis被清了
                        if (tokenModel == null)
                        {
                            context.Result = new JsonResult(new DosResult(int.Parse(DiyMessage.GetLangCode(osClient, "NoLogin")), null, DiyMessage.GetLang(osClientToken,  "NoLogin", Lang) )); //+ " - 2"
                            return;
                        }
                        else
                        {
                            sysUser = tokenModel.CurrentUser;
                        }
                    }
                    var clientModel = OsClient.GetClient(osClientToken);
                    #endregion

                    if (sysUser == null)
                    {
                        //登陆身份已失效，因为redis被清了
                        context.Result = new JsonResult(new DosResult(int.Parse(DiyMessage.GetLangCode(osClient, "NoLogin")), null, DiyMessage.GetLang(osClientToken,  "NoLogin", Lang) ));//+ " - 3"
                        return;
                    }

                    #region 这里迟早要注释掉。 如果IS4 access_token已过期或快过期，则重新获取
                    if (tokenModel != null)
                    {
                        var sessionAuthTimeout = 20;
                        if(!clientModel.SessionAuthTimeout.DosIsNullOrWhiteSpace()){
                            int.TryParse(clientModel.SessionAuthTimeout, out sessionAuthTimeout);
                        }
                        if (sysUser != null && (tokenModel == null || tokenModel.Token.DosIsNullOrWhiteSpace() || (DateTime.Now - tokenModel.UpdateTime).TotalMinutes > sessionAuthTimeout - 5))
                        {
                            var getTokenResult = await DiyToken.GetAccessToken<T>(new DiyTokenParam<T>()
                            {
                                CurrentUser = sysUser,
                                OsClient = osClientToken
                            });
                            if (getTokenResult.Code != 1)
                            {
                            }
                            else
                            {
                                tokenModel = getTokenResult.Data as CurrentToken<T>;
                                if (tokenModel != null)
                                {
                                    sysUser = tokenModel.CurrentUser;
                                }
                            }
                        }
                    }

                    #region header返回
                    if (tokenModel != null && !tokenModel.Token.DosIsNullOrWhiteSpace())
                    {
                        DiyCommon.TryAction(() => {
                            context.HttpContext.Response.Headers.Add("Access-Control-Expose-Headers", "set-cookie,token,did,authorization");
                        });
                        DiyCommon.TryAction(() => {
                            context.HttpContext.Response.Headers.Add("authorization", tokenModel.Token);
                        });
                    }
                    #endregion

                    #endregion

                    #region 权限判断
                    if (sysUser != null)
                    {
                        try
                        {
                            
                        }
                        catch (Exception e)
                        {

                        }
                    }
                    #endregion
                }
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                throw new Exception("Microi：OnAuthorizationAsync异常：" + ex.Message + ex.InnerException?.ToString() + ex.StackTrace);
            }
        }
    }
}
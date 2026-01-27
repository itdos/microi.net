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
using System.Diagnostics;
using System.IdentityModel.Tokens.Jwt;
using System.Reflection;
using System.Security.Claims;
using System.Text;
using Dos.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    /// <summary>
    /// 验证token和权限、_RowModel处理
    /// </summary>
    public partial class DiyFilter<T> : IAsyncAuthorizationFilter, IExceptionFilter, IActionFilter
    //IAuthorizationFilter|IAsyncAuthorizationFilter, ActionFilterAttribute,  Attribute,   DiyFilter<T> where T : 
    {
        private const string TimerKey = "__DiyFilter_Timer__";
        /// <summary>
        /// 
        /// </summary>
        /// <param name="context"></param>
        public virtual void OnActionExecuted(ActionExecutedContext context)
        {
            var timer = context.HttpContext.Items[TimerKey] as Stopwatch;
            timer?.Stop();
            if (timer != null && timer.ElapsedMilliseconds >= 1000)
            {
                try
                {
                    MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                    {
                        Type = "接口性能监控",
                        Title = "执行时间：" + timer.ElapsedMilliseconds + "ms",
                        Content =
                                    context.HttpContext.Request.Host.Value //注意在正式环境中这里获取到的是负载均衡的地址：apiaijuhomecom
                                    + context.HttpContext.Request.Path.Value //api/Aijuhome/DiyTable/GetMacEnable
                    });
                }
                catch (Exception)
                {

                }
            }
            //统计用户接口请求数、数据量请求数
            // Task.Run(async () =>
            // {

            // });
        }
        /// <summary>
        /// 
        /// </summary>
        private static object GetFormValue(IFormCollection form, string key)
        {
            try
            {
                var result = form[key][0];
                if (result == "true" || result == "false")
                {
                    return result == "true";
                }
                return result;
            }
            catch (Exception ex)
            {
                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "接口异常",
                    Title = "DiyFilter.GetFormValue",
                    Content = ex.Message + "。Key：" + (key ?? "")
                });
                return "";
            }

        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="context"></param>
        public virtual void OnActionExecuting(ActionExecutingContext context)
        {
            try
            {
                var timer = new Stopwatch();
                timer.Start();
                context.HttpContext.Items[TimerKey] = timer;
                //可以直接tostring，即使不存在lang
                var lang = context.HttpContext.Request.Headers["lang"].ToString();
                if (lang.DosIsNullOrWhiteSpace() || lang == "null")
                {
                    lang = DiyMessage.Lang;
                }
                //base.OnActionExecuting(context);

                //多语言 --2024-09-14 by Anderson
                foreach (var item in context.ActionArguments)
                {
                    try
                    {
                        var tempParam = item.Value;
                        var type = tempParam.GetType();
                        // var tempModel = tempParam.GetType().GetProperties().FirstOrDefault(d => d.Name == "_Lang");
                        // 使用 BindingFlags 包括所有基类
                        var tempModel = type.GetProperty("_Lang", BindingFlags.Public | BindingFlags.Instance | BindingFlags.FlattenHierarchy);
                        tempModel?.SetValue(tempParam, lang);
                    }
                    catch (Exception ex)
                    {

                    }
                }

                #region 以下代码注释于2021-10-07，不再使用Dictionary<string, object>，而是Dictionary<strng, string>，所以这里不再需要转换
                //没有使用Dictionary<string, string>的原因是虽然前端可以传入 true、数字等类型，但是后端在使用这个参数的时候就必须要全部string，不符合规范。
                var diyTableParam = context.ActionArguments.FirstOrDefault(d => d.Value != null && d.Value.GetType().Name == "DiyTableParam").Value;
                if (diyTableParam != null)
                {
                    // var rowModel = diyTableParam.GetType().GetProperties().FirstOrDefault(d => d.Name == "_RowModel" || d.Name == "_FormData");
                    // if (rowModel != null)
                    // {
                    //     var dicVal = rowModel.GetValue(diyTableParam) as JObject;
                    //     var newDicVal = new JObject();
                    //     if (dicVal != null)
                    //     {
                    //         foreach (var dic in dicVal)
                    //         {
                    //             if (!context.HttpContext.Request.HasFormContentType)
                    //             {
                    //                 continue;
                    //             }
                    //             var form = context.HttpContext.Request.Form;
                    //             //如果是string/bool/int/decimal
                    //             if (form.ContainsKey("_RowModel[" + dic.Key + "]"))
                    //             {
                    //                 newDicVal[dic.Key] = GetFormValue(form, "_RowModel[" + dic.Key + "]");
                    //             }
                    //             else //如果是string/bool/int/decimal
                    //                 if (form.ContainsKey("_FormData[" + dic.Key + "]"))
                    //                 {
                    //                     newDicVal[dic.Key] = GetFormValue(form, "_FormData[" + dic.Key + "]");
                    //                 }
                    //                 //如果是数组
                    //                 else if (form.ContainsKey("_RowModel[" + dic.Key + "][0]"))
                    //                 {
                    //                     var arrVal = new List<object>();
                    //                     var tempIndex = 0;
                    //                     while (form.ContainsKey("_RowModel[" + dic.Key + "][" + tempIndex + "]"))
                    //                     {
                    //                         arrVal.Add(GetFormValue(form, "_RowModel[" + dic.Key + "][" + tempIndex + "]"));
                    //                         tempIndex++;
                    //                     }
                    //                     newDicVal[dic.Key] = arrVal;
                    //                 }
                    //                 //如果是数组
                    //                 else if (form.ContainsKey("_FormData[" + dic.Key + "][0]"))
                    //                 {
                    //                     var arrVal = new List<object>();
                    //                     var tempIndex = 0;
                    //                     while (form.ContainsKey("_FormData[" + dic.Key + "][" + tempIndex + "]"))
                    //                     {
                    //                         arrVal.Add(GetFormValue(form, "_FormData[" + dic.Key + "][" + tempIndex + "]"));
                    //                         tempIndex++;
                    //                     }
                    //                     newDicVal[dic.Key] = arrVal;
                    //                 }
                    //                 //如果是对象
                    //                 else if (form.Any(d => d.Key.Contains("_RowModel[" + dic.Key + "][")))
                    //                 {
                    //                     var objects = form.Where(d => d.Key.Contains("_RowModel[" + dic.Key + "][")).ToList();
                    //                     //这里其实应该使用object，然后序列化。
                    //                     var objectsStr = "{";
                    //                     foreach (var item in objects)
                    //                     {
                    //                         objectsStr += item.Key + ":" + GetFormValue(form, "_RowModel[" + dic.Key + "][" + item.Key + "]");
                    //                     }
                    //                     objectsStr += "}";
                    //                     newDicVal[dic.Key] = objectsStr;
                    //                 }
                    //                 //如果是对象
                    //                 else if (form.Any(d => d.Key.Contains("_FormData[" + dic.Key + "][")))
                    //                 {
                    //                     var objects = form.Where(d => d.Key.Contains("_FormData[" + dic.Key + "][")).ToList();
                    //                     //这里其实应该使用object，然后序列化。
                    //                     var objectsStr = "{";
                    //                     foreach (var item in objects)
                    //                     {
                    //                         objectsStr += item.Key + ":" + GetFormValue(form, "_FormData[" + dic.Key + "][" + item.Key + "]");
                    //                     }
                    //                     objectsStr += "}";
                    //                     newDicVal[dic.Key] = objectsStr;
                    //                 }
                    //         }
                    //         rowModel.SetValue(diyTableParam, newDicVal);
                    //     }

                    // }
                }
                #endregion
            }
            catch (Exception ex)
            {
                throw new Exception("iTdos.DIY OnActionExecuting异常：" + ex.Message + ex.InnerException?.ToString() + ex.StackTrace);
            }

        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="context"></param>
        public virtual void OnException(ExceptionContext context)
        {
            var osClient = DiyToken.GetCurrentOsClient();

            MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
            {
                Type = "未处理的异常",
                Title = "未处理的异常",
                Content = "OsClient：" + osClient
                        + "Api：" + context.HttpContext.Request.Host.Value //注意在正式环境中这里获取到的是负载均衡的地址：apiaijuhomecom
                                    + context.HttpContext.Request.Path.Value //api/Aijuhome/DiyTable/GetMacEnable
                        + "。Message：" + context.Exception?.Message
                        + "。StackTrace：" + context.Exception?.StackTrace,
                OsClient = osClient
            });

            var json = new DosResult(0, null, "未处理的异常：" + context.Exception?.Message, null, new
            {
                StackTrace = context.Exception?.StackTrace,
                InnerException = context.Exception?.InnerException?.Message,
                OsClient = osClient
            });
            context.Result = new JsonResult(json);
            context.ExceptionHandled = true;
        }
        public virtual async Task OnAuthorizationAsync(AuthorizationFilterContext context)//
        {
            // 【优化】提前验证 OsClient，避免调试时异常中断
            // 步骤1：获取请求中的 OsClient（不使用默认值）
            var requestOsClient = DiyToken.GetCurrentOsClient(false);
            
            // 步骤2：如果请求中传入了 OsClient，验证其是否在 ClientList 中
            if (!requestOsClient.DosIsNullOrWhiteSpace())
            {
                // 检查 ClientList 是否为空（系统未初始化）
                if (OsClientExtend.ClientList.IsEmpty)
                {
                    context.Result = new JsonResult(new DosResult(
                        0, 
                        null, 
                        "系统未初始化完成，请稍后重试", 
                        0,
                        new { Hint = "OsClient 配置尚未加载" }
                    ));
                    return;
                }
                
                // 检查请求的 OsClient 是否存在于 ClientList（是否为合法租户）
                if (!OsClientExtend.ClientList.ContainsKey(requestOsClient))
                {
                    context.Result = new JsonResult(new DosResult(
                        1001, 
                        null, 
                        $"无效的租户标识：{requestOsClient}，请尝试清除浏览器Cookie缓存后重试！", 
                        0,
                        new 
                        { 
                            OsClient = requestOsClient,
                            Hint = "该租户不存在或未启用，请检查 OsClient 参数是否正确" 
                        }
                    ));
                    return;
                }
            }
            
            var currentToken = await DiyToken.GetCurrentToken();
            var osClient = currentToken.OsClient;

            var _Lang = context.HttpContext.Request.Headers["lang"].ToString();
            if (_Lang.DosIsNullOrWhiteSpace() || _Lang == "null")
            {
                _Lang = DiyMessage.Lang;
            }
            var headerOrFormOsClient = context.HttpContext.Request.Headers["osclient"].ToString();
            if (context.Filters.Any(item => item is IAllowAnonymousFilter))
            {
                return;
            }
            var endpoint = context.HttpContext.GetEndpoint();
            if (endpoint?.Metadata?.GetMetadata<IAllowAnonymous>() != null)
            {
                return;
            }
            //--end
            if (!(context.ActionDescriptor is ControllerActionDescriptor))
            {
                return;
            }
            //如果未标记[AllowAnonymous]，则需要身份认证
            if (!context.Filters.Any(item => item is IAllowAnonymousFilter))
            {
                if (!headerOrFormOsClient.DosIsNullOrWhiteSpace() && !osClient.DosIsNullOrWhiteSpace() && headerOrFormOsClient != osClient)
                {
                    var jsonResult = new DosResult(
                        int.Parse(DiyMessage.GetLangCode(osClient, "NoLogin")),
                        null, DiyMessage.GetLang(osClient, "NoLogin", _Lang), 0,
                        new
                        {
                            AppendMsg = $"此请求Header或Form中包含了OsClient值[{headerOrFormOsClient}]，但token对应的OsClient值为[{osClient}]，一般可能是SaaS引擎本地切换导致，请重新登录！"
                        });
                    context.Result = new JsonResult(jsonResult);
                    return;
                }
                JObject sysUser = new JObject();
                CurrentToken tokenModel = null;

                if (currentToken.CurrentUser == null)
                {
                    context.Result = new JsonResult(
                        new DosResult(
                            int.Parse(DiyMessage.GetLangCode(osClient, "NoLogin")),
                            null, DiyMessage.GetLang(osClient, "NoLogin", _Lang), 0, new
                            {

                            }));
                    return;
                }

                #region 从jwt中获取身份认证信息
                var claims = new List<Claim>();
                var token = currentToken.Token;
                token = token.DosTrim().DosReplace("Bearer ", "");
                if (!token.DosIsNullOrWhiteSpace())
                {
                    var defaultClientModel = OsClient.GetClient(osClient);
                    var tokenString = token;
                    
                    // 使用手动解析的方式，避免ValidateToken抛出异常中断调试
                    var tokenHandler = new JwtSecurityTokenHandler();
                    
                    // 先检查token格式是否有效
                    if (!tokenHandler.CanReadToken(tokenString))
                    {
                        context.Result = new JsonResult(new DosResult(
                            int.Parse(DiyMessage.GetLangCode(osClient, "NoLogin")), 
                            null, 
                            DiyMessage.GetLang(osClient, "NoLogin", _Lang),
                            0,
                            new { AppendMsg = "Token格式无效" }
                        ));
                        return;
                    }
                    
                    try
                    {
                        // 直接读取token（不验证签名），获取claims
                        var jwtToken = tokenHandler.ReadJwtToken(tokenString);
                        
                        // 手动验证签名（可选，如果验证失败也不会中断）
                        var jwtKey = defaultClientModel.OsClientModel["AuthSecret"].Val<string>().DosIsNullOrWhiteSpace()
                            ? defaultClientModel.OsClient : defaultClientModel.OsClientModel["AuthSecret"].Val<string>();
                        jwtKey = jwtKey.Length > 32 ? jwtKey.Substring(0, 32) : jwtKey.PadRight(32, '.');
                        
                        // 验证签名（手动方式，不会抛出中断异常）
                        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
                        var signingCredentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);
                        
                        // 重新计算签名进行比对
                        var header = jwtToken.Header.SerializeToJson();
                        var payload = jwtToken.Payload.SerializeToJson();
                        var headerBase64 = Base64UrlEncoder.Encode(header);
                        var payloadBase64 = Base64UrlEncoder.Encode(payload);
                        var signatureInput = $"{headerBase64}.{payloadBase64}";
                        
                        var hmac = new System.Security.Cryptography.HMACSHA256(Encoding.UTF8.GetBytes(jwtKey));
                        var computedSignature = Base64UrlEncoder.Encode(hmac.ComputeHash(Encoding.UTF8.GetBytes(signatureInput)));
                        
                        // 比对签名
                        if (jwtToken.RawSignature != computedSignature)
                        {
                            MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                            {
                                Type = "Token验证警告",
                                Title = "Token签名不匹配",
                                Content = $"OsClient: {osClient}, Token签名验证失败，可能密钥已更换",
                                OsClient = osClient
                            });
                            
                            context.Result = new JsonResult(new DosResult(
                                int.Parse(DiyMessage.GetLangCode(osClient, "NoLogin")), 
                                null, 
                                DiyMessage.GetLang(osClient, "NoLogin", _Lang),
                                0,
                                new { AppendMsg = "Token签名验证失败，请重新登录" }
                            ));
                            return;
                        }
                        
                        // 验证token是否过期
                        if (jwtToken.ValidTo < DateTime.UtcNow)
                        {
                            context.Result = new JsonResult(new DosResult(
                                int.Parse(DiyMessage.GetLangCode(osClient, "NoLogin")), 
                                null, 
                                DiyMessage.GetLang(osClient, "NoLogin", _Lang),
                                0,
                                new { AppendMsg = "Token已过期" }
                            ));
                            return;
                        }
                        
                        // 从token中提取claims
                        claims = jwtToken.Claims?.ToList();
                    }
                    catch (Exception ex)
                    {
                        MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                        {
                            Type = "Token解析异常",
                            Title = "Token解析失败",
                            Content = $"OsClient: {osClient}, Error: {ex.Message}, StackTrace: {ex.StackTrace}",
                            OsClient = osClient
                        });
                        
                        claims = null;
                        context.Result = new JsonResult(new DosResult(
                            int.Parse(DiyMessage.GetLangCode(osClient, "NoLogin")), 
                            null, 
                            DiyMessage.GetLang(osClient, "NoLogin", _Lang),
                            0,
                            new { AppendMsg = "Token解析失败" }
                        ));
                        return;
                    }
                }

                if (claims == null)
                {
                    context.Result = new JsonResult(new DosResult(int.Parse(DiyMessage.GetLangCode(osClient, "NoLogin")), null, DiyMessage.GetLang(osClient, "NoLogin", _Lang), 0, new
                    {
                        AppendMsg = $"claims is null."
                    }));
                    return;
                }

                var userId = claims.FirstOrDefault(d => d.Type == "UserId")?.Value;
                var tokenOsClient = claims.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                var clientType = claims.FirstOrDefault(d => d.Type == "ClientType")?.Value;
                clientType = clientType.DosIsNullOrWhiteSpace("Empty");
                if (userId.DosIsNullOrWhiteSpace() || tokenOsClient.DosIsNullOrWhiteSpace()
                    )
                {
                    context.Result = new JsonResult(new DosResult(int.Parse(DiyMessage.GetLangCode(osClient, "NoLogin")), null, DiyMessage.GetLang(osClient, "NoLogin", _Lang)));// "没有统一身份权限！请联系系统管理员。"  + " - 1"
                    return;
                }
                else
                {
                    //获取身份信息
                    try
                    {
                        var DiyCacheBase = MicroiEngine.CacheTenant.Cache(tokenOsClient);
                        tokenModel = await DiyCacheBase.GetAsync<CurrentToken>($"Microi:{osClient}:LoginTokenSysUser:{userId}");
                    }
                    catch (Exception ex)
                    {

                    }
                    //登陆身份已失效，因为redis被清了
                    if (tokenModel == null)
                    {
                        context.Result = new JsonResult(new DosResult(int.Parse(DiyMessage.GetLangCode(osClient, "NoLogin")), null, DiyMessage.GetLang(osClient, "NoLogin", _Lang) + " - 2")); //
                        return;
                    }
                    else
                    {
                        sysUser = tokenModel.CurrentUser;
                    }
                }
                var clientModel = OsClient.GetClient(tokenOsClient);
                #endregion

                if (sysUser == null)
                {
                    //登陆身份已失效，因为redis被清了
                    context.Result = new JsonResult(new DosResult(int.Parse(DiyMessage.GetLangCode(osClient, "NoLogin")), null, DiyMessage.GetLang(osClient, "NoLogin", _Lang) + " - 3"));//
                    return;
                }

                #region 若token已过期或快过期，则重新获取
                var sessionAuthTimeout = 20;
                if (!clientModel.OsClientModel["SessionAuthTimeout"].Val<string>().DosIsNullOrWhiteSpace())
                {
                    int.TryParse(clientModel.OsClientModel["SessionAuthTimeout"].Val<string>(), out sessionAuthTimeout);
                }
                if (sessionAuthTimeout <= 0)
                {
                    sessionAuthTimeout = 20;
                }

                //如果token已过期，直接返回退出登录
                if ((DateTime.Now - tokenModel.UpdateTime).TotalMinutes > sessionAuthTimeout)
                {
                    context.Result = new JsonResult(new DosResult(int.Parse(DiyMessage.GetLangCode(osClient, "NoLogin")), null, DiyMessage.GetLang(osClient, "NoLogin", _Lang) + " - 3"));//
                    return;
                }
                if (sysUser != null &&
                    (tokenModel.Token.DosIsNullOrWhiteSpace() || (DateTime.Now - tokenModel.UpdateTime).TotalMinutes > sessionAuthTimeout - 5)
                )
                {
                    var getTokenResult = await new DiyToken().GetAccessToken(new DiyTokenParam()
                    {
                        CurrentUser = sysUser,
                        OsClient = tokenOsClient,
                        _ClientType = clientType
                    });
                    if (getTokenResult.Code != 1)
                    {
                        //LogHelper.Error(JsonHelper.Serialize(getTokenResult), "刷新IS4_Token失败_");
                    }
                    else
                    {
                        tokenModel = getTokenResult.Data as CurrentToken;
                        if (tokenModel != null) { sysUser = tokenModel.CurrentUser; }

                        #region 最后设置header返回
                        if (tokenModel != null && !tokenModel.Token.DosIsNullOrWhiteSpace())
                        {
                            context.HttpContext.Response.Headers["authorization"] = tokenModel.Token;
                        }
                        #endregion
                    }
                }
                #endregion

                //判断是否有权限
                if (sysUser != null)
                {
                    try
                    {
                        var sysUserObj = JObject.FromObject(sysUser);
                        //获取该用户的所有角色的所有基础权限
                        var baseLimit = new List<string>();
                        var roles = sysUserObj["_Roles"].Val<JArray>();
                        if (roles != null)
                        {
                            foreach (var sysRole in roles)
                            {
                                if (!sysRole["BaseLimit"].Val<string>().DosIsNullOrWhiteSpace())
                                {
                                    var baseLimits = JsonHelper.Deserialize<List<string>>(sysRole["BaseLimit"].Val<string>());
                                    baseLimit.AddRange(baseLimits);
                                }
                            }
                        }
                        try
                        {
                            if (baseLimit.Any())
                            {
                                var tArr = context.HttpContext.Request.Path.ToString().DosSplit('/');
                                var requestType = tArr[tArr.Length - 1].Substring(0, 3);
                                if (requestType.ToUpper() != "GET" && baseLimit.Any(d => d == "OnlyGet"))
                                {
                                    context.Result = new JsonResult(new DosResult(0, null, "该账户角色拥有【仅查询】权限！"));
                                }
                            }
                        }
                        catch (Exception ex)
                        {
                        }
                    }
                    catch (Exception ex)
                    {
                    }
                }
            }
        }
    }
}
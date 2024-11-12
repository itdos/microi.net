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
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Authorization;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Driver;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Diagnostics;
using System.IdentityModel.Tokens.Jwt;

namespace Microi.net
{
    /// <summary>
    /// 验证token和权限、_RowModel处理
    /// </summary>
    public partial class DiyFilter<T> : IAsyncAuthorizationFilter, IExceptionFilter, IActionFilter
    //IAuthorizationFilter|IAsyncAuthorizationFilter, ActionFilterAttribute,  Attribute,   DiyFilter<T> where T : 
    {
        
        Stopwatch timer = new Stopwatch();
        /// <summary>
        /// 
        /// </summary>
        /// <param name="context"></param>
        public virtual void OnActionExecuted(ActionExecutedContext context)
        {
            timer.Stop();
            if (timer.ElapsedMilliseconds >= 1000)
            {
                try
                {
                    new SysLogLogic().AddSysLog(new SysLogParam()
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
            Task.Run(async () =>
            {
                //2023-03-30注释：需要换一种更高效的方式实现，且以下代码异常没有被正确捕捉，仍然输出到了控制台。
                return;
//                 var osClient = "";
//                 var model = new ApiRequest();
//                 model.ApiUrl = context.HttpContext.Request.Host.Value + context.HttpContext.Request.Path.Value;
//                 try
//                 {
//                     var currentToken = await DiyToken.GetCurrentToken<SysUser>();
//                     //如果有登陆身份
//                     if (currentToken != null)
//                     {
//                         //定义锁内代码执行结果
//                         var actionResult = new DosResult(1);
//                         //Key一般传入该方法操作的唯一值；value随意传；Expiry：锁的过期时间，也是获取锁的等待时间。
//                         var lockResult = await DiyLock.ActionLock("api_report_" + model.UserId, "", TimeSpan.FromSeconds(10), async () =>
//                         {
//                             //-------执行单线程代码、数据库操作等
//                             osClient = currentToken.OsClient;
//                             model.UserId = currentToken.CurrentUser.Id;
//                             model.UserName = currentToken.CurrentUser.Name;
//                             model.Day = DateTime.Now.ToString("yyyyMMdd");

//                             var host = new MongodbHost()
//                             {
//                                 Connection = Microi.net.OsClient.GetClient(osClient).DbMongoConnection,//链接字符串
//                                 DataBase = "sys_log_" + osClient.ToLower(),//库名
//                                 Table = "api_report_" + DateTime.Now.ToString("yyyyMMdd")//表名
//                             };
//                             var list = new List<FilterDefinition<ApiRequest>>();
//                             list.Add(
//                                 Builders<ApiRequest>.Filter.Where(d => d.UserId == model.UserId)
//                                 & Builders<ApiRequest>.Filter.Where(d => d.ApiUrl == model.ApiUrl)
//                                 & Builders<ApiRequest>.Filter.Where(d => d.Day == model.Day)
//                             );
//                             var filter = Builders<ApiRequest>.Filter.And(list);
//                             var sort = Builders<ApiRequest>.Sort.Descending("RequestCount");
//                             var dataResult = await TMongodbHelper<ApiRequest>.FindListAsync(host, filter, null, null);
//                             //先取出来，不存在新增，存在就+1修改
//                             if (dataResult.Any())
//                             {
//                                 var firstModel = dataResult.First();
//                                 firstModel.RequestCount = firstModel.RequestCount++;
//                                 //获取请求的数据量
//                                 firstModel.RequestDataCount = 0;
//                                 var count = await TMongodbHelper<ApiRequest>.UpdateAsync(host, firstModel, firstModel._id.ToString());
//                             }
//                             else
//                             {
//                                 model.RequestCount = 0;
//                                 model.RequestDataCount = 0;
//                                 var count = await TMongodbHelper<ApiRequest>.AddAsync(host, model);
//                             }
//                             //-------END
//                         });
//                         ////判断锁是否获取成功
//                         //if (lockResult.Code != 1)
//                         //    return lockResult;
//                         ////判断锁内代码执行是否失败
//                         //if (actionResult.Code != 1)
//                         //    return actionResult;
//                         //继续解锁之后的业务逻辑...
//                     }
//                     else
//                     {

//                     }

//                 }
//                 catch (Exception ex)
//                 {
// Console.WriteLine("未处理的异常：" + ex.Message);
//                 }

            });
            //throw new NotImplementedException();
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
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                new SysLogLogic().AddSysLog(new SysLogParam()
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
                timer.Reset();
                timer.Start();
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
                        var tempModel = tempParam.GetType().GetProperties().FirstOrDefault(d => d.Name == "_Lang");
                        tempModel?.SetValue(tempParam, lang);
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                    }
                }

                #region 以下代码注释于2021-10-07，不再使用Dictionary<string, object>，而是Dictionary<strng, string>，所以这里不再需要转换
                //没有使用Dictionary<string, string>的原因是虽然前端可以传入 true、数字等类型，但是后端在使用这个参数的时候就必须要全部string，不符合规范。
                var diyTableParam = context.ActionArguments.FirstOrDefault(d => d.Value != null && d.Value.GetType().Name == "DiyTableParam").Value;
                if (diyTableParam != null)
                {
                    var rowModel = diyTableParam.GetType().GetProperties().FirstOrDefault(d => d.Name == "_RowModel" || d.Name == "_FormData");
                    if (rowModel != null)
                    {
                        var dicVal = rowModel.GetValue(diyTableParam) as Dictionary<string, object>;
                        var newDicVal = new Dictionary<string, object>();
                        if (dicVal != null)
                        {
                            foreach (var dic in dicVal)
                            {
                                if(!context.HttpContext.Request.HasFormContentType){
                                    continue;
                                }
                                var form = context.HttpContext.Request.Form;
                                //如果是string/bool/int/decimal
                                if (form.ContainsKey("_RowModel[" + dic.Key + "]"))
                                {
                                    newDicVal.Add(dic.Key, GetFormValue(form, "_RowModel[" + dic.Key + "]"));
                                }
                                else //如果是string/bool/int/decimal
                                if (form.ContainsKey("_FormData[" + dic.Key + "]"))
                                {
                                    newDicVal.Add(dic.Key, GetFormValue(form, "_FormData[" + dic.Key + "]"));
                                }
                                //如果是数组
                                else if (form.ContainsKey("_RowModel[" + dic.Key + "][0]"))
                                {
                                    var arrVal = new List<object>();
                                    var tempIndex = 0;
                                    while (form.ContainsKey("_RowModel[" + dic.Key + "][" + tempIndex + "]"))
                                    {
                                        arrVal.Add(GetFormValue(form, "_RowModel[" + dic.Key + "][" + tempIndex + "]"));
                                        tempIndex++;
                                    }
                                    newDicVal.Add(dic.Key, arrVal);
                                }
                                //如果是数组
                                else if (form.ContainsKey("_FormData[" + dic.Key + "][0]"))
                                {
                                    var arrVal = new List<object>();
                                    var tempIndex = 0;
                                    while (form.ContainsKey("_FormData[" + dic.Key + "][" + tempIndex + "]"))
                                    {
                                        arrVal.Add(GetFormValue(form, "_FormData[" + dic.Key + "][" + tempIndex + "]"));
                                        tempIndex++;
                                    }
                                    newDicVal.Add(dic.Key, arrVal);
                                }
                                //如果是对象
                                else if (form.Any(d => d.Key.Contains("_RowModel[" + dic.Key + "][")))
                                {
                                    var objects = form.Where(d => d.Key.Contains("_RowModel[" + dic.Key + "][")).ToList();
                                    //这里其实应该使用object，然后序列化。
                                    var objectsStr = "{";
                                    foreach (var item in objects)
                                    {
                                        objectsStr += item.Key + ":" + GetFormValue(form, "_RowModel[" + dic.Key + "][" + item.Key + "]");
                                    }
                                    objectsStr += "}";
                                    newDicVal.Add(dic.Key, objectsStr);
                                }
                                //如果是对象
                                else if (form.Any(d => d.Key.Contains("_FormData[" + dic.Key + "][")))
                                {
                                    var objects = form.Where(d => d.Key.Contains("_FormData[" + dic.Key + "][")).ToList();
                                    //这里其实应该使用object，然后序列化。
                                    var objectsStr = "{";
                                    foreach (var item in objects)
                                    {
                                        objectsStr += item.Key + ":" + GetFormValue(form, "_FormData[" + dic.Key + "][" + item.Key + "]");
                                    }
                                    objectsStr += "}";
                                    newDicVal.Add(dic.Key, objectsStr);
                                }
                            }
                            rowModel.SetValue(diyTableParam, newDicVal);
                        }

                    }
                }
                #endregion
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                throw new Exception("iTdos.DIY OnActionExecuting异常：" + ex.Message + ex.InnerException?.ToString() + ex.StackTrace);
            }

        }
        /// <summary>
        /// 
        /// </summary>
        /// <param name="context"></param>
        public virtual void OnException(ExceptionContext context)
        {
            var OsClient = DiyToken.GetCurrentOsClient();
            try
            {
                if (OsClient.DosIsNullOrWhiteSpace())
                {
                    OsClient = DiyToken.GetCurrentOsClient();
                    var claims = context.HttpContext.User.Claims;
                    //.NET8
                    var token = context.HttpContext.Request?.Headers["authorization"].ToString();
                    if (!token.DosIsNullOrWhiteSpace())
                    {
                        claims = new JwtSecurityTokenHandler().ReadJwtToken(token.Replace("Bearer ", "")).Claims;
                    }
                    var osClient = claims.FirstOrDefault(d => d.Type == "UserId");//client_id   OsClient
                    if (osClient != null
                        && !osClient.ToString().DosIsNullOrWhiteSpace())
                    {
                        OsClient = osClient.Value;
                    }
                }
                if (OsClient.DosIsNullOrWhiteSpace() && context.HttpContext.Request.HasFormContentType)
                {
                    if (context.HttpContext.Request.Form["OsClient"].Count() > 0
                            && !context.HttpContext.Request.Form["OsClient"].ToString().DosIsNullOrWhiteSpace())
                    {
                        OsClient = context.HttpContext.Request.Form["OsClient"].ToString();
                    }
                }
            }
            catch (Exception)
            {

            }

            if (!OsClient.DosIsNullOrWhiteSpace())
            {
                new SysLogLogic().AddSysLog(new SysLogParam()
                {
                    Type = "未处理的异常",
                    Title = "未处理的异常",
                    Content = "OsClient：" + (OsClient ?? "")
                            + "Api：" + context.HttpContext.Request.Host.Value //注意在正式环境中这里获取到的是负载均衡的地址：apiaijuhomecom
                                     + context.HttpContext.Request.Path.Value //api/Aijuhome/DiyTable/GetMacEnable
                            + "。Message：" + context.Exception.Message
                            + "。StackTrace：" + context.Exception.StackTrace,
                    OsClient = OsClient
                });
            }

            var json = new DosResult(0, null, "未处理的异常：" + context.Exception.Message);// + context.Exception.StackTrace
            context.Result = new JsonResult(json);
            context.ExceptionHandled = true;
        }
        public virtual async Task OnAuthorizationAsync(AuthorizationFilterContext context)//
        {
            try
            {
                var osClient = DiyToken.GetCurrentOsClient();

                var _Lang = context.HttpContext.Request.Headers["lang"].ToString();
                if (_Lang.DosIsNullOrWhiteSpace() || _Lang == "null")
                {
                    _Lang = DiyMessage.Lang;
                }

                var headerOrFormOsClient = context.HttpContext.Request.Headers["osclient"].ToString();
                if (headerOrFormOsClient.DosIsNullOrWhiteSpace())
                {
                    try
                    {
                        if(context.HttpContext.Request.HasFormContentType){
                            headerOrFormOsClient = context.HttpContext.Request.Form["OsClient"];
                        }
                    }
                    catch (System.Exception)
                    {
                    }
                }

                
                if (!context.HttpContext.Response.Headers.Any(d => d.Key == "osclient"))
                {
                    context.HttpContext.Response.Headers.Add("osclient", osClient);
                }
                if (!context.HttpContext.Response.Headers.Any(d => d.Key == "Access-Control-Max-Age"))
                {
                    context.HttpContext.Response.Headers.Add("Access-Control-Max-Age", new Microsoft.Extensions.Primitives.StringValues("24*60*60"));
                }
                if (!context.HttpContext.Response.Headers.Any(d => d.Key == "diy-server-tag"))
                {
                    try
                    {
                        if (!osClient.DosIsNullOrWhiteSpace())
                        {
                            context.HttpContext.Response.Headers.Add("diy-server-tag", OsClient.GetClient().ServerTag);
                        }
                        else
                        {
                            context.HttpContext.Response.Headers.Add("diy-server-tag", ConfigHelper.GetAppSettings("ServerTag"));
                        }
                    }
                    catch (Exception ex)
                    {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                    }
                }

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

                //var needLogin = false;
                //如果未标记[AllowAnonymous]，则需要身份认证
                if (!context.Filters.Any(item => item is IAllowAnonymousFilter))
                {

                    if(!headerOrFormOsClient.DosIsNullOrWhiteSpace() && !osClient.DosIsNullOrWhiteSpace() && headerOrFormOsClient != osClient)
                    {
                        context.Result = new JsonResult(new DosResult(int.Parse(DiyMessage.Msg["NoLogin"]["Code"]), null, DiyMessage.Msg["NoLogin"][_Lang],0, new {
                            AppendMsg = $"此请求Header或Form中包含了OsClient值[{headerOrFormOsClient}]，但token对应的OsClient值为[{osClient}]，一般可能是SaaS引擎本地切换导致，请重新登录！"
                        }));
                        return;
                    }
                    // if(!headerOrFormOsClient.DosIsNullOrWhiteSpace())
                    // {
                    //     osClient = headerOrFormOsClient;
                    // }

                    //SysUser sysUser = null;
                    T sysUser = default(T);
                    CurrentToken<T> tokenModel = null;
                    #region 从is4中获取身份认证信息

                    //.NET6
                    var claims = context.HttpContext.User.Claims;

                    //.NET8
                    var token = context.HttpContext.Request.Headers["authorization"].ToString();
                    if (!token.DosIsNullOrWhiteSpace())
                    {
                        claims = new JwtSecurityTokenHandler().ReadJwtToken(token.Replace("Bearer ", "")).Claims;
                    }
                    if(claims == null)
                    {
                        context.Result = new JsonResult(new DosResult(int.Parse(DiyMessage.Msg["NoLogin"]["Code"]), null, DiyMessage.Msg["NoLogin"][_Lang],0, new {
                            AppendMsg = $"claims is null."
                        }));
                        return;
                    }

                    var userIdAttr = claims.FirstOrDefault(d => d.Type == "sub");//UserId
                    //var userId = Guid.Empty;
                    var userId = userIdAttr?.Value;
                    // var userNameAttr = claims.FirstOrDefault(d => d.Type == "name");
                    // var userAccountAttr = claims.FirstOrDefault(d => d.Type == "UserAccount");
                    var osClientObj = claims.FirstOrDefault(d => d.Type == "UserId");//client_id   OsClient
                    //|| userNameAttr == null || userNameAttr.Value.DosIsNullOrWhiteSpace()
                    //    || userAccountAttr == null || userAccountAttr.Value.DosIsNullOrWhiteSpace()
                    if (userIdAttr == null || userIdAttr.Value.DosIsNullOrWhiteSpace()
                        //|| !Guid.TryParse(userIdAttr.Value, out userId)
                        || osClientObj == null || osClientObj.Value.DosIsNullOrWhiteSpace()
                        )
                    {
                        context.Result = new JsonResult(new DosResult(int.Parse(DiyMessage.Msg["NoLogin"]["Code"]), null, DiyMessage.Msg["NoLogin"][_Lang] ));// "没有统一身份权限！请联系系统管理员。"  + " - 1"
                        return;
                    }
                    else
                    {
                        //获取身份信息
                        try
                        {
                            var DiyCacheBase = new MicroiCacheRedis(osClientObj.Value);

                            tokenModel = await DiyCacheBase.GetAsync<CurrentToken<T>>("LoginTokenSysUser:" + osClientObj.Value + ":" + userId.ToString());
                        }
                        catch (Exception ex)
                        {
                           Console.WriteLine("未处理的异常：" + ex.Message);
                        }
                        //登陆身份已失效，因为redis被清了
                        if (tokenModel == null)
                        {
                            //登陆身份已失效，因为redis被清了
                            context.Result = new JsonResult(new DosResult(int.Parse(DiyMessage.Msg["NoLogin"]["Code"]), null, DiyMessage.Msg["NoLogin"][_Lang] + " - 2" )); //
                            return;
                        }
                        else
                        {
                            sysUser = tokenModel.CurrentUser;
                        }
                    }
                    var clientModel = OsClient.GetClient(osClientObj.Value);
                    #endregion
                    if (sysUser == null)
                    {
                        //登陆身份已失效，因为redis被清了
                        context.Result = new JsonResult(new DosResult(int.Parse(DiyMessage.Msg["NoLogin"]["Code"]), null, DiyMessage.Msg["NoLogin"][_Lang] + " - 3"));//
                        return;
                    }

                    #region 若IS4 access_token已过期或快过期，则重新获取
                    if (tokenModel != null)
                    {
                        var sessionAuthTimeout = 20;
                        //ConfigHelper.GetAppSettings("SessionAuthTimeout")
                        int.TryParse(clientModel.SessionAuthTimeout, out sessionAuthTimeout);
                        if (sysUser != null && (tokenModel == null || tokenModel.Token.DosIsNullOrWhiteSpace() || (DateTime.Now - tokenModel.UpdateTime).TotalMinutes > sessionAuthTimeout - 5))
                        {
                            var getTokenResult = await DiyToken.GetAccessToken<T>(new DiyTokenParam<T>()
                            {
                                CurrentUser = sysUser,
                                OsClient = osClientObj.Value
                            });
                            if (getTokenResult.Code != 1)
                            {
                                //LogHelper.Error(JsonConvert.SerializeObject(getTokenResult), "刷新IS4_Token失败_");
                            }
                            else
                            {
                                tokenModel = getTokenResult.Data as CurrentToken<T>;
                                if (tokenModel != null) { sysUser = tokenModel.CurrentUser; }

                                #region 最后设置header返回
                                if (tokenModel != null && !tokenModel.Token.DosIsNullOrWhiteSpace())
                                {
                                    if (!context.HttpContext.Response.Headers.Any(d => d.Key == "Access-Control-Expose-Headers"))
                                    {
                                        try
                                        {
                                            context.HttpContext.Response.Headers.Add("Access-Control-Expose-Headers", "set-cookie,token,did,authorization");
                                        }
                                        catch (Exception)
                                        {
                                        }
                                    }
                                    if (!context.HttpContext.Response.Headers.Any(d => d.Key == "authorization"))
                                    {
                                        try
                                        {
                                            context.HttpContext.Response.Headers["authorization"] = tokenModel.Token;
                                        }
                                        catch (Exception)
                                        {
                                        }
                                    }
                                }
                                #endregion
                            }
                        }
                    }
                    


                    //foreach (var item in context.HttpContext.Request.Form)
                    //{
                    //    //context.HttpContext.Request.Form.
                    //    if (item.Value.GetType().Name == "")
                    //    {
                    //    }
                    //}
                    #endregion


                    //判断是否有权限
                    if (sysUser != null)
                    {
                        try
                        {
                            var sysUserObj = JObject.FromObject(sysUser);
                            //获取该用户的所有角色的所有基础权限
                            var baseLimit = new List<string>();
                            var roles = sysUserObj["_Roles"]?.Value<JArray>();
                            if (roles != null)
                            {
                                foreach (var sysRole in roles)
                                {
                                    if (!sysRole["BaseLimit"].Value<string>().DosIsNullOrWhiteSpace())
                                    {
                                        var baseLimits = JsonConvert.DeserializeObject<List<string>>(sysRole["BaseLimit"].Value<string>());
                                        baseLimit.AddRange(baseLimits);
                                    }
                                }
                            }
                            try
                            {
                                if (baseLimit.Any())
                                {
                                    var tArr = context.HttpContext.Request.Path.ToString().Split('/');
                                    var requestType = tArr[tArr.Length - 1].Substring(0, 3);
                                    if (requestType.ToUpper() != "GET" && baseLimit.Any(d => d == "OnlyGet"))
                                    {
                                        context.Result = new JsonResult(new DosResult(0, null, "该账户角色拥有【仅查询】权限！"));
                                    }
                                    //if (requestType.ToUpper() == "ADD")
                                    //{
                                    //    if (!baseLimit.Any(d => d == "增加"))
                                    //    {
                                    //        context.Result = new JsonResult(new DosResult(0, null, "无法发起[增加]请求！请联系系统管理员。"));
                                    //    }
                                    //}
                                    //else if (requestType.ToUpper() == "DEL")
                                    //{
                                    //    if (!baseLimit.Any(d => d == "删除"))
                                    //    {
                                    //        context.Result = new JsonResult(new DosResult(0, null, "无法发起[删除]请求！请联系系统管理员。"));
                                    //    }
                                    //}
                                    //else if (requestType.ToUpper() == "UPT")
                                    //{
                                    //    if (!baseLimit.Any(d => d == "修改"))
                                    //    {
                                    //        context.Result = new JsonResult(new DosResult(0, null, "无法发起[修改]请求！请联系系统管理员。"));
                                    //    }

                                    //}
                                    //else if (requestType.ToUpper() == "GET")
                                    //{
                                    //    if (!baseLimit.Any(d => d == "查询"))
                                    //    {
                                    //        context.Result = new JsonResult(new DosResult(0, null, "无法发起[查询]请求！请联系系统管理员。"));
                                    //    }
                                    //}
                                    //else
                                    //{
                                    //    if (!baseLimit.Any(d => d == "特殊"))
                                    //    {
                                    //        context.Result = new JsonResult(new DosResult(0, null, "无法发起[特殊]请求！请联系系统管理员。"));
                                    //    }
                                    //}
                                }
                            }
                            catch (Exception ex)
                            {
                                Console.WriteLine("未处理的异常：" + ex.Message);
                                //LogHelper.Error(ex.Message, "基础权限验证出错_");
                            }

                            //if (sysUser.Account.ToLower() != "admin")
                            //{
                            //    //获取该用户的所有角色的所有基础权限
                            //    var baseLimit = new List<string>();
                            //    if (sysUser._Roles != null && sysUser._Roles.Any())
                            //    {
                            //        foreach (var sysRole in sysUser._Roles)
                            //        {
                            //            if (!sysRole.BaseLimit.DosIsNullOrWhiteSpace())
                            //            {
                            //                var baseLimits = JsonConvert.DeserializeObject<List<string>>(sysRole.BaseLimit);
                            //                baseLimit.AddRange(baseLimits);
                            //            }
                            //        }
                            //    }
                            //    try
                            //    {
                            //        if (1 == 2 && baseLimit.Any())
                            //        {
                            //            var tArr = context.HttpContext.Request.Path.ToString().Split('/');
                            //            var requestType = tArr[tArr.Length - 1].Substring(0, 3);
                            //            if (requestType.ToUpper() == "ADD")
                            //            {
                            //                if (!baseLimit.Any(d => d == "增加"))
                            //                {
                            //                    context.Result = new JsonResult(new DosResult(0, null, "无法发起[增加]请求！请联系系统管理员。"));
                            //                }
                            //            }
                            //            else if (requestType.ToUpper() == "DEL")
                            //            {
                            //                if (!baseLimit.Any(d => d == "删除"))
                            //                {
                            //                    context.Result = new JsonResult(new DosResult(0, null, "无法发起[删除]请求！请联系系统管理员。"));
                            //                }
                            //            }
                            //            else if (requestType.ToUpper() == "UPT")
                            //            {
                            //                if (!baseLimit.Any(d => d == "修改"))
                            //                {
                            //                    context.Result = new JsonResult(new DosResult(0, null, "无法发起[修改]请求！请联系系统管理员。"));
                            //                }

                            //            }
                            //            else if (requestType.ToUpper() == "GET")
                            //            {
                            //                if (!baseLimit.Any(d => d == "查询"))
                            //                {
                            //                    context.Result = new JsonResult(new DosResult(0, null, "无法发起[查询]请求！请联系系统管理员。"));
                            //                }
                            //            }
                            //            else
                            //            {
                            //                if (!baseLimit.Any(d => d == "特殊"))
                            //                {
                            //                    context.Result = new JsonResult(new DosResult(0, null, "无法发起[特殊]请求！请联系系统管理员。"));
                            //                }
                            //            }
                            //        }
                            //    }
                            //    catch (Exception ex)
                            //    {
                            //        LogHelper.Error(ex.Message, "基础权限验证出错_");
                            //    }

                            //}
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine("未处理的异常：" + ex.Message);
                            //LogHelper.Error(e.Message, "帐户权限验证异常_");
                        }

                    }
                }
            }
            catch (Exception ex)
            {
                throw new Exception("Microi：OnAuthorizationAsync异常：" + ex.Message + ex.InnerException?.ToString() + ex.StackTrace);
            }

        }
    }
}
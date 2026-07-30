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
            if (timer != null && timer.ElapsedMilliseconds >= DiyCommon.SlowExecutionThresholdMs)
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

        private static string GetRequestAuthorizationToken(HttpContext context)
        {
            var token = context?.Request?.Headers["Authorization"].ToString();
            if (token.DosIsNullOrWhiteSpace() && context?.Request?.HasFormContentType == true)
            {
                token = context.Request.Form["authorization"].ToString();
            }
            return token.DosTrim().DosReplace("Bearer ", "");
        }

        private static IEnumerable<string> GetAccessKeyTableReferences(
            object value,
            bool includeIdAsTableReference)
        {
            if (value == null) yield break;

            if (value is JObject json)
            {
                var scalarNames = new List<string>
                {
                    "FormEngineKey", "_FormEngineKey", "TableName", "_TableName",
                    "TableId", "_TableId"
                };
                if (includeIdAsTableReference)
                {
                    scalarNames.Add("Id");
                    scalarNames.Add("Name");
                }
                foreach (var propertyName in scalarNames)
                {
                    var reference = json[propertyName]?.ToString()?.Trim();
                    if (!reference.DosIsNullOrWhiteSpace()) yield return reference;
                }
                foreach (var propertyName in new[] { "TableIds", "TableNames" })
                {
                    foreach (var reference in UserAccessKeySecurity.ParseStringList(json[propertyName]))
                    {
                        yield return reference;
                    }
                }
                yield break;
            }

            if (value is JArray jsonArray)
            {
                foreach (var item in jsonArray)
                {
                    foreach (var reference in GetAccessKeyTableReferences(
                                 item,
                                 includeIdAsTableReference))
                    {
                        yield return reference;
                    }
                }
                yield break;
            }

            if (value is System.Collections.IEnumerable values && !(value is string))
            {
                foreach (var item in values)
                {
                    foreach (var reference in GetAccessKeyTableReferences(
                                 item,
                                 includeIdAsTableReference))
                    {
                        yield return reference;
                    }
                }
                yield break;
            }

            var type = value.GetType();
            var scalarProperties = new List<string>
            {
                "FormEngineKey", "_FormEngineKey", "TableName", "_TableName",
                "TableId", "_TableId"
            };
            if (includeIdAsTableReference)
            {
                scalarProperties.Add("Id");
                scalarProperties.Add("Name");
            }
            foreach (var propertyName in scalarProperties)
            {
                var property = type.GetProperty(
                    propertyName,
                    BindingFlags.Public | BindingFlags.Instance | BindingFlags.FlattenHierarchy);
                var reference = property?.GetValue(value)?.ToString()?.Trim();
                if (!reference.DosIsNullOrWhiteSpace()) yield return reference;
            }
            foreach (var propertyName in new[] { "TableIds", "TableNames" })
            {
                var property = type.GetProperty(
                    propertyName,
                    BindingFlags.Public | BindingFlags.Instance | BindingFlags.FlattenHierarchy);
                var propertyValue = property?.GetValue(value);
                if (!(propertyValue is System.Collections.IEnumerable references)
                    || propertyValue is string)
                {
                    continue;
                }
                foreach (var referenceValue in references)
                {
                    var reference = referenceValue?.ToString()?.Trim();
                    if (!reference.DosIsNullOrWhiteSpace()) yield return reference;
                }
            }
        }

        private static IEnumerable<string> GetAccessKeyFieldReferences(object? value)
        {
            if (value == null) yield break;

            if (value is JObject json)
            {
                foreach (var propertyName in new[] { "_FieldId", "FormEngineFieldKey" })
                {
                    var reference = json[propertyName]?.ToString()?.Trim();
                    if (!reference.DosIsNullOrWhiteSpace()) yield return reference;
                }
                foreach (var propertyName in new[] { "FieldIds", "FormEngineFieldKeys" })
                {
                    foreach (var reference in UserAccessKeySecurity.ParseStringList(json[propertyName]))
                    {
                        yield return reference;
                    }
                }
                yield break;
            }

            if (value is JArray jsonArray)
            {
                foreach (var item in jsonArray)
                {
                    foreach (var reference in GetAccessKeyFieldReferences(item))
                    {
                        yield return reference;
                    }
                }
                yield break;
            }

            if (value is System.Collections.IEnumerable values && !(value is string))
            {
                foreach (var item in values)
                {
                    foreach (var reference in GetAccessKeyFieldReferences(item))
                    {
                        yield return reference;
                    }
                }
                yield break;
            }

            var type = value.GetType();
            foreach (var propertyName in new[] { "_FieldId", "FormEngineFieldKey" })
            {
                var property = type.GetProperty(
                    propertyName,
                    BindingFlags.Public | BindingFlags.Instance | BindingFlags.FlattenHierarchy);
                var reference = property?.GetValue(value)?.ToString()?.Trim();
                if (!reference.DosIsNullOrWhiteSpace()) yield return reference;
            }
            foreach (var propertyName in new[] { "FieldIds", "FormEngineFieldKeys" })
            {
                var property = type.GetProperty(
                    propertyName,
                    BindingFlags.Public | BindingFlags.Instance | BindingFlags.FlattenHierarchy);
                var propertyValue = property?.GetValue(value);
                if (!(propertyValue is System.Collections.IEnumerable references)
                    || propertyValue is string)
                {
                    continue;
                }
                foreach (var referenceValue in references)
                {
                    var reference = referenceValue?.ToString()?.Trim();
                    if (!reference.DosIsNullOrWhiteSpace()) yield return reference;
                }
            }
        }

        private static IEnumerable<string> GetAccessKeyMenuReferences(object? value)
        {
            if (value == null) yield break;

            var propertyNames = new[]
            {
                "ModuleEngineKey", "_ModuleEngineKey", "_SysMenuId", "SysMenuId"
            };
            if (value is JObject json)
            {
                foreach (var propertyName in propertyNames)
                {
                    var reference = json[propertyName]?.ToString()?.Trim();
                    if (!reference.DosIsNullOrWhiteSpace()) yield return reference;
                }
                yield break;
            }

            if (value is JArray jsonArray)
            {
                foreach (var item in jsonArray)
                {
                    foreach (var reference in GetAccessKeyMenuReferences(item))
                    {
                        yield return reference;
                    }
                }
                yield break;
            }

            if (value is System.Collections.IEnumerable values && !(value is string))
            {
                foreach (var item in values)
                {
                    foreach (var reference in GetAccessKeyMenuReferences(item))
                    {
                        yield return reference;
                    }
                }
                yield break;
            }

            var type = value.GetType();
            foreach (var propertyName in propertyNames)
            {
                var property = type.GetProperty(
                    propertyName,
                    BindingFlags.Public | BindingFlags.Instance | BindingFlags.FlattenHierarchy);
                var reference = property?.GetValue(value)?.ToString()?.Trim();
                if (!reference.DosIsNullOrWhiteSpace()) yield return reference;
            }
        }

        private static bool AuthorizeAccessKeyTableOperation(ActionExecutingContext context)
        {
            var currentUser = context.HttpContext.Items[
                UserAccessKeySecurity.ScopedUserHttpContextItemKey] as JObject;
            if (!UserAccessKeySecurity.IsSession(currentUser)) return true;

            var requestPath = context.HttpContext.Request.Path.ToString();
            if (!UserAccessKeySecurity.TryGetTableOperation(
                    requestPath,
                    out var isRead,
                    out var isExport))
            {
                return true;
            }

            var includeIdAsTableReference =
                UserAccessKeySecurity.IsTableModelLookupPath(requestPath);
            var tableReferences = context.ActionArguments.Values
                .SelectMany(value => GetAccessKeyTableReferences(
                    value,
                    includeIdAsTableReference))
                .Where(reference => !reference.DosIsNullOrWhiteSpace())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
            var menuReferences = context.ActionArguments.Values
                .SelectMany(GetAccessKeyMenuReferences)
                .Where(reference => !reference.DosIsNullOrWhiteSpace())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToArray();
            var isFieldDataLookup = UserAccessKeySecurity.IsFieldDataLookupPath(requestPath);
            var fieldReferences = isFieldDataLookup
                ? context.ActionArguments.Values
                    .SelectMany(GetAccessKeyFieldReferences)
                    .Where(reference => !reference.DosIsNullOrWhiteSpace())
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray()
                : Array.Empty<string>();
            if (UserAccessKeySecurity.AreFormEngineRequestReferencesAllowed(
                    currentUser,
                    requestPath,
                    tableReferences,
                    menuReferences,
                    fieldReferences))
            {
                return true;
            }

            context.Result = new JsonResult(new DosResult(
                0,
                null,
                "当前访问密钥未授权访问请求中的表。"));
            return false;
        }

        private static async Task<DosResult> BuildTokenAuthFailureAsync(
            string osClient,
            string lang,
            string token,
            string appendMsg)
        {
            var diagnostic = await DiyToken.DiagnoseInactiveTokenDetail(token, osClient);
            if (diagnostic != null)
            {
                diagnostic.AppendMsg = appendMsg ?? "";
            }
            var baseMessage = DiyMessage.GetLang(osClient, "NoLogin", lang);
            var message = diagnostic?.UserMessage;
            if (message.DosIsNullOrWhiteSpace()
                || string.Equals(diagnostic?.ReasonCode, "Unknown", StringComparison.OrdinalIgnoreCase))
            {
                message = appendMsg.DosIsNullOrWhiteSpace()
                    ? baseMessage
                    : $"{baseMessage}：{appendMsg}";
            }
            return new DosResult(
                int.Parse(DiyMessage.GetLangCode(osClient, "NoLogin")),
                null,
                message,
                null,
                diagnostic);
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
                if (!AuthorizeAccessKeyTableOperation(context))
                {
                    return;
                }
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

            var isDevelopment = string.Equals(
                Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT"),
                "Development",
                StringComparison.OrdinalIgnoreCase);
            var json = new DosResult(0, null,
                isDevelopment
                    ? "未处理的异常：" + context.Exception?.Message
                    : "服务器内部错误，请稍后重试。",
                null,
                new
            {
                TraceId = context.HttpContext.TraceIdentifier,
                StackTrace = isDevelopment ? context.Exception?.StackTrace : null,
                InnerException = isDevelopment ? context.Exception?.InnerException?.Message : null,
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
            
            var _Lang = context.HttpContext.Request.Headers["lang"].ToString();
            if (_Lang.DosIsNullOrWhiteSpace() || _Lang == "null")
            {
                _Lang = DiyMessage.Lang;
            }
            var headerOrFormOsClient = context.HttpContext.Request.Headers["osclient"].ToString();
            var requestToken = GetRequestAuthorizationToken(context.HttpContext);
            var endpoint = context.HttpContext.GetEndpoint();
            var allowsAnonymous = context.Filters.Any(item => item is IAllowAnonymousFilter)
                                  || endpoint?.Metadata?.GetMetadata<IAllowAnonymous>() != null;
            if (allowsAnonymous)
            {
                // Anonymous actions must be decided before resolving an optional
                // bearer token. Access-key exchange and tenant bootstrap can carry
                // a stale browser token; resolving it here re-enters access-key
                // runtime loading and previously amplified one request into an OOM.
                return;
            }

            var currentToken = await DiyToken.GetCurrentToken();
            var osClient = currentToken.OsClient;
            //--end
            if (!(context.ActionDescriptor is ControllerActionDescriptor))
            {
                return;
            }
            //如果未标记[AllowAnonymous]，则需要身份认证
            if (!context.Filters.Any(item => item is IAllowAnonymousFilter))
            {
                if (!headerOrFormOsClient.DosIsNullOrWhiteSpace()
                    && !osClient.DosIsNullOrWhiteSpace()
                    && !string.Equals(headerOrFormOsClient, osClient, StringComparison.OrdinalIgnoreCase))
                {
                    var jsonResult = await BuildTokenAuthFailureAsync(
                        headerOrFormOsClient,
                        _Lang,
                        requestToken,
                        $"请求租户为[{headerOrFormOsClient}]，Token租户为[{osClient}]，请重新登录");
                    context.Result = new JsonResult(jsonResult);
                    return;
                }
                JObject sysUser = new JObject();
                CurrentToken tokenModel = null;

                if (currentToken.CurrentUser == null)
                {
                    context.Result = new JsonResult(await BuildTokenAuthFailureAsync(
                        requestOsClient.DosIsNullOrWhiteSpace() ? osClient : requestOsClient,
                        _Lang,
                        requestToken,
                        $"Token中未找到有效用户信息。OsClient：{osClient}"));
                    return;
                }

                #region 从jwt中获取身份认证信息
                var claims = new List<Claim>();
                var token = requestToken;
                if (token.DosIsNullOrWhiteSpace())
                {
                    token = currentToken.Token;
                }
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
                        context.Result = new JsonResult(await BuildTokenAuthFailureAsync(
                            osClient,
                            _Lang,
                            token,
                            "Token格式无效"));
                        return;
                    }
                    
                    try
                    {
                        // 直接读取token（不验证签名），获取claims
                        var jwtToken = tokenHandler.ReadJwtToken(tokenString);
                        
                        // 手动验证签名（可选，如果验证失败也不会中断）
                        var jwtKey = DiyToken.ResolveJwtSigningKey(defaultClientModel);
                        
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
                            
                            context.Result = new JsonResult(await BuildTokenAuthFailureAsync(
                                osClient,
                                _Lang,
                                token,
                                "Token签名验证失败，请重新登录"));
                            return;
                        }
                        
                        // 验证token是否过期
                        if (jwtToken.ValidTo < DateTime.UtcNow)
                        {
                            context.Result = new JsonResult(await BuildTokenAuthFailureAsync(
                                osClient,
                                _Lang,
                                token,
                                "Token已过期"));
                            return;
                        }
                        
                        // 从token中提取claims
                        claims = jwtToken.Claims?.ToList();
                        if (!DiyToken.IsCurrentAuthVersion(claims))
                        {
                            context.Result = new JsonResult(await BuildTokenAuthFailureAsync(
                                osClient,
                                _Lang,
                                token,
                                "Token安全版本已失效，请重新登录"));
                            return;
                        }
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
                        context.Result = new JsonResult(await BuildTokenAuthFailureAsync(
                            osClient,
                            _Lang,
                            token,
                            "Token解析失败"));
                        return;
                    }
                }

                if (claims == null)
                {
                    context.Result = new JsonResult(await BuildTokenAuthFailureAsync(
                        osClient,
                        _Lang,
                        token,
                        "Token中不存在有效Claims"));
                    return;
                }

                var userId = claims.FirstOrDefault(d => d.Type == "UserId")?.Value;
                var tokenOsClient = claims.FirstOrDefault(d => d.Type == "OsClient")?.Value;
                var clientType = claims.FirstOrDefault(d => d.Type == "ClientType")?.Value;
                var accessKeyId = claims.FirstOrDefault(
                    d => d.Type == UserAccessKeySecurity.ClaimType)?.Value;
                clientType = clientType.DosIsNullOrWhiteSpace("Empty");
                if (userId.DosIsNullOrWhiteSpace() || tokenOsClient.DosIsNullOrWhiteSpace()
                    )
                {
                    context.Result = new JsonResult(await BuildTokenAuthFailureAsync(
                        osClient,
                        _Lang,
                        token,
                        "从Token的Claims中未找到有效的用户或租户信息"));
                    return;
                }
                TokensModel activeTokenEntry = null;
                if (!string.Equals(tokenOsClient, osClient, StringComparison.OrdinalIgnoreCase))
                {
                    context.Result = new JsonResult(await BuildTokenAuthFailureAsync(
                        osClient,
                        _Lang,
                        token,
                        $"Token租户[{tokenOsClient}]与当前请求租户[{osClient}]不一致"));
                    return;
                }
                else
                {
                    //获取身份信息
                    try
                    {
                        var DiyCacheBase = MicroiEngine.CacheTenant.Cache(tokenOsClient);
                        tokenModel = await DiyCacheBase.GetAsync<CurrentToken>($"Microi:{tokenOsClient}:LoginTokenSysUser:{userId}");
                    }
                    catch (Exception ex)
                    {

                    }
                    //登陆身份已失效，因为redis被清了
                    if (tokenModel == null)
                    {
                        context.Result = new JsonResult(await BuildTokenAuthFailureAsync(
                            osClient,
                            _Lang,
                            token,
                            "Token对应的服务端登录身份未找到，可能已退出、被管理员清除或登录缓存已重建"));
                        return;
                    }
                    activeTokenEntry = DiyToken.GetActiveCachedTokenEntry(tokenModel, token);
                    if (activeTokenEntry == null)
                    {
                        try
                        {
                            await OnlineTerminalService.PruneExpiredLoginTokensAsync(
                                tokenOsClient,
                                userId,
                                tokenModel,
                                OsClient.GetClient(tokenOsClient)).ConfigureAwait(false);
                        }
                        catch (Exception)
                        {
                        }
                        context.Result = new JsonResult(await BuildTokenAuthFailureAsync(
                            osClient,
                            _Lang,
                            token,
                            "Token不在当前有效登录列表中，请重新登录"));
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
                    context.Result = new JsonResult(await BuildTokenAuthFailureAsync(
                        osClient,
                        _Lang,
                        token,
                        "Token对应的用户信息未找到，可能已退出、被管理员清除或登录缓存已重建"));
                    return;
                }

                // Access-key sessions are detached views of the shared user identity.
                // The key record is checked on every request (shared Redis cache with
                // database fallback), so revoke/expiry/account changes work across
                // all API nodes without sticky sessions.
                if (!accessKeyId.DosIsNullOrWhiteSpace())
                {
                    var scopedUserResult = await UserAccessKeyService.ApplySessionScopeAsync(
                            JObject.FromObject(sysUser),
                            accessKeyId,
                            tokenOsClient)
                        .ConfigureAwait(false);
                    if (scopedUserResult.Code != 1)
                    {
                        context.Result = new JsonResult(new DosResult(
                            1001,
                            null,
                            scopedUserResult.Msg ?? "访问密钥已失效。"));
                        return;
                    }
                    sysUser = scopedUserResult.Data;
                    context.HttpContext.Items[
                        UserAccessKeySecurity.ScopedUserHttpContextItemKey] = scopedUserResult.Data;
                    if (!UserAccessKeySecurity.IsApiPathAllowed(
                            scopedUserResult.Data,
                            context.HttpContext.Request.Path.ToString()))
                    {
                        context.Result = new JsonResult(new DosResult(
                            0,
                            null,
                            "当前访问密钥未授权调用此接口。"));
                        return;
                    }
                }

                #region 若token已过期或快过期，则重新获取
                var tokenLifetime = DiyToken.ResolveClientTokenLifetime(clientModel, clientType);
                var tokenLifetimeText = DiyToken.DescribeClientTokenLifetime(clientModel, clientType);
                var activeTokenUpdateTime = activeTokenEntry?.UpdateTime == default ? tokenModel.UpdateTime : activeTokenEntry.UpdateTime;
                var activeTokenAge = DateTime.Now - activeTokenUpdateTime;

                //如果token已过期，直接返回退出登录
                if (activeTokenAge > tokenLifetime)
                {
                    try
                    {
                        await OnlineTerminalService.PruneExpiredLoginTokensAsync(
                            tokenOsClient,
                            userId,
                            tokenModel,
                            clientModel).ConfigureAwait(false);
                    }
                    catch (Exception)
                    {
                    }
                    context.Result = new JsonResult(await BuildTokenAuthFailureAsync(
                        osClient,
                        _Lang,
                        token,
                        $"Token终端会话已过期，ClientType：{clientType}，有效期：{tokenLifetimeText}"));
                    return;
                }
                try
                {
                    await OnlineTerminalService.TrackTokenActiveAsync(
                        tokenOsClient,
                        tokenModel,
                        activeTokenEntry,
                        context.HttpContext,
                        claims,
                        token).ConfigureAwait(false);
                }
                catch (Exception ex)
                {
                    MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                    {
                        Type = "在线终端",
                        Title = "同步Token终端失败",
                        Content = ex.Message,
                        OsClient = tokenOsClient
                    });
                }
                var shouldRotateToken = DiyToken.ShouldRotateClientToken(
                    token,
                    clientModel,
                    clientType,
                    activeTokenUpdateTime);
                if (sysUser != null &&
                    (tokenModel.Token.DosIsNullOrWhiteSpace() || shouldRotateToken)
                )
                {
                    var getTokenResult = await new DiyToken().GetAccessToken(new DiyTokenParam()
                    {
                        CurrentUser = sysUser,
                        OsClient = tokenOsClient,
                        _ClientType = clientType,
                        RotateFromToken = token,
                        AccessKeyId = accessKeyId
                    });
                    if (getTokenResult.Code != 1)
                    {
                        //LogHelper.Error(JsonHelper.Serialize(getTokenResult), "刷新IS4_Token失败_");
                    }
                    else
                    {
                        tokenModel = getTokenResult.Data as CurrentToken;
                        if (tokenModel != null)
                        {
                            if (!accessKeyId.DosIsNullOrWhiteSpace())
                            {
                                var scopedUserResult = await UserAccessKeyService.ApplySessionScopeAsync(
                                        tokenModel.CurrentUser,
                                        accessKeyId,
                                        tokenOsClient)
                                    .ConfigureAwait(false);
                                if (scopedUserResult.Code != 1)
                                {
                                    context.Result = new JsonResult(new DosResult(
                                        1001,
                                        null,
                                        scopedUserResult.Msg ?? "访问密钥已失效。"));
                                    return;
                                }
                                sysUser = scopedUserResult.Data;
                            }
                            else
                            {
                                sysUser = tokenModel.CurrentUser;
                            }
                        }

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

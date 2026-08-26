using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using Senparc.Weixin;
using Senparc.Weixin.Exceptions;
using Senparc.Weixin.MP;
using Senparc.Weixin.MP.AdvancedAPIs;
using Senparc.Weixin.MP.AdvancedAPIs.OAuth;
using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Http;
using Senparc.Weixin.MP.Containers;
using StackExchange.Redis;

// For more information on enabling MVC for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

// ASP.NET Core 微信 OAuth/回调协议适配器；业务编排由官方 Managed ApiEngine 承载。
namespace Microi.net.Api.Controllers
{
    /// <summary>
    /// 
    /// </summary>
    [EnableCors("any")]
    [Route("api/[controller]/[action]")]
    public class WeChatController : Controller
    {
        private const int OAuthStateLifetimeMinutes = 10;
        private const string UserBindingApiEngineKey = "platform-wechat-user-binding";

        private static string OAuthStateCacheKey(string osClient, string state)
        {
            return $"Microi:{osClient}:OAuth:WeChat:{state}";
        }

        private static async Task<string> CreateOAuthStateAsync(
            string osClient,
            string userId,
            string wxMpId,
            string returnUrl)
        {
            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            var database = cache.GetIDatabase();
            if (database == null) return null;

            var ticket = new JObject
            {
                ["OsClient"] = osClient,
                ["UserId"] = userId,
                ["WxMpId"] = wxMpId,
                ["ReturnUrl"] = returnUrl ?? "",
                ["ExpiresAt"] = DateTimeOffset.UtcNow.AddMinutes(OAuthStateLifetimeMinutes).ToUnixTimeSeconds()
            }.ToString(Newtonsoft.Json.Formatting.None);

            for (var attempt = 0; attempt < 3; attempt++)
            {
                var state = Guid.NewGuid().ToString("N");
                if (await database.StringSetAsync(
                        OAuthStateCacheKey(osClient, state),
                        ticket,
                        TimeSpan.FromMinutes(OAuthStateLifetimeMinutes),
                        When.NotExists).ConfigureAwait(false))
                {
                    return state;
                }
            }
            return null;
        }

        private static async Task<JObject> ConsumeOAuthStateAsync(string osClient, string state)
        {
            if (osClient.DosIsNullOrWhiteSpace()
                || state.DosIsNullOrWhiteSpace()
                || state.Length != 32
                || state.Any(character => !Uri.IsHexDigit(character)))
            {
                return null;
            }

            try
            {
                osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
                var database = MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase();
                if (database == null) return null;
                const string consumeScript = @"
local value = redis.call('get', KEYS[1])
if value then
  redis.call('del', KEYS[1])
  return value
end
return ''";
                var result = await database.ScriptEvaluateAsync(
                    consumeScript,
                    new RedisKey[] { OAuthStateCacheKey(osClient, state) },
                    Array.Empty<RedisValue>()).ConfigureAwait(false);
                var raw = result.ToString();
                if (raw.DosIsNullOrWhiteSpace()) return null;
                var ticket = JObject.Parse(raw);
                if (!string.Equals(ticket["OsClient"].Val<string>(), osClient, StringComparison.OrdinalIgnoreCase)
                    || ticket["ExpiresAt"].Val<long>() < DateTimeOffset.UtcNow.ToUnixTimeSeconds())
                {
                    return null;
                }
                return ticket;
            }
            catch
            {
                // OAuth身份绑定依赖共享Redis。无法原子消费票据时必须失败关闭。
                return null;
            }
        }

        /// <summary>
        /// 必传 Authorization 请求头（兼容 POST 表单 authorization）、OsClient，可选 ReturnUrl。
        /// 禁止通过 GET/query 传 Token，避免访问日志、浏览器历史和 Referer 泄露。
        /// </summary>
        /// <param name="authorization"></param>
        /// <param name="OsClient"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<IActionResult> BindSysUser(string authorization, string OsClient, string ReturnUrl)
        {
            authorization = Request.Headers["Authorization"].ToString();
            if (authorization.DosIsNullOrWhiteSpace() && Request.HasFormContentType)
            {
                authorization = (await Request.ReadFormAsync()).TryGetValue("authorization", out var formToken)
                    ? formToken.ToString()
                    : "";
            }
            if (authorization.DosIsNullOrWhiteSpace())
            {
                return Unauthorized();
            }
            if (ReturnUrl == null)
            {
                ReturnUrl = "";
            }
            //解析authorization
            var tokenModelJobj = await DiyToken.GetCurrentToken(authorization, OsClient);
            if (tokenModelJobj == null)
            {
                return Content("无效的token！");
            }
            string trustedOsClient;
            try
            {
                trustedOsClient = TenantConfigurationSecurity.NormalizeTenantId(tokenModelJobj.OsClient);
                if (!OsClient.DosIsNullOrWhiteSpace()
                    && !string.Equals(
                        TenantConfigurationSecurity.NormalizeTenantId(OsClient),
                        trustedOsClient,
                        StringComparison.OrdinalIgnoreCase))
                {
                    return Content("Token 与 OsClient 不一致！");
                }
            }
            catch
            {
                return Content("OsClient 无效！");
            }
            if (!TenantProtocolGatewaySettings.TryLoadOAuthReturnUrlPolicy(
                    trustedOsClient,
                    out var returnUrlPolicy)
                || !returnUrlPolicy.IsAllowed(ReturnUrl))
            {
                return Content("返回URL验证失败：仅允许站内路径或当前租户配置的可信HTTPS Origin");
            }
            var sysUserDynamic = tokenModelJobj.CurrentUser;
            if (sysUserDynamic["WxMpId"] == null || sysUserDynamic["WxMpId"].Val<string>().DosIsNullOrWhiteSpace())
            {
                return Content("用户信息未绑定所属公众号，无法获取OpenId！");
            }
            var wxmpModelResult = await MicroiEngine.FormEngine.GetFormDataAsync(new
            {
                FormEngineKey = "wx_mp",
                Id = sysUserDynamic["WxMpId"].Val<string>(),
                OsClient = trustedOsClient
            });
            if (wxmpModelResult.Code != 1)
            {
                return Content("获取微信公众号信息失败：" + wxmpModelResult.Msg);
            }
            var appId = (string)wxmpModelResult.Data.AppId;
            var appSecret = (string)wxmpModelResult.Data.AppSecret;
            if (appId.DosIsNullOrWhiteSpace() || appSecret.DosIsNullOrWhiteSpace())
            {
                return Content("微信公众号AppId、AppSecret配置为空！");
            }
            if (!AccessTokenContainer.CheckRegistered(appId))
            {
                await AccessTokenContainer.RegisterAsync(appId, appSecret);
            }
            var sysConfigResult = await MicroiEngine.FormEngine.GetFormDataAsync(new
            {
                FormEngineKey = "sys_config",
                _Where = new List<DiyWhere>() {
                    new DiyWhere(){
                        Name = "IsEnable",
                        Value = "1",
                        Type = "="
                    }
                },
                OsClient = trustedOsClient
            });
            if (sysConfigResult.Code != 1)
            {
                return Content("获取系统设置失败：" + sysConfigResult.Msg);
            }

            var apiBase = (string)sysConfigResult.Data.ApiBase;
            if (apiBase.DosIsNullOrWhiteSpace())
            {
                return Content("系统设置ApiBase不能为空！");
            }

            var oauthState = await CreateOAuthStateAsync(
                trustedOsClient,
                sysUserDynamic["Id"].Val<string>(),
                sysUserDynamic["WxMpId"].Val<string>(),
                ReturnUrl);
            if (oauthState.DosIsNullOrWhiteSpace())
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable);
            }

            var urlBase = OAuthApi.GetAuthorizeUrl(
                                appId,
                                $"{apiBase}/WeChat/UserInfoCallback?OsClient={Uri.EscapeDataString(trustedOsClient)}",
                                oauthState, OAuthScope.snsapi_userinfo);
            return Redirect(urlBase);
        }
        /// <summary>
        /// OAuthScope.snsapi_userinfo方式回调
        /// </summary>
        /// <param name="code"></param>
        /// <param name="returnUrl">用户最初尝试进入的页面</param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<ActionResult> UserInfoCallback(string code, string state, string OsClient, string o)
        {
            if (string.IsNullOrEmpty(code))
            {
                return Content("您拒绝了授权！");
            }

            // 新生成的第三方回调固定使用 ?OsClient=。短期兼容旧版已发出的 ?o= 链接，
            // 但两者同时出现时必须一致，避免租户选择歧义。
            if (!OsClient.DosIsNullOrWhiteSpace()
                && !o.DosIsNullOrWhiteSpace()
                && !string.Equals(OsClient.Trim(), o.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return Content("授权票据租户参数不一致！");
            }
            var callbackOsClient = OsClient.DosIsNullOrWhiteSpace() ? o : OsClient;
            var oauthTicket = await ConsumeOAuthStateAsync(callbackOsClient, state);
            if (oauthTicket == null)
            {
                return Content("授权票据无效或已过期！");
            }
            var osClient = oauthTicket["OsClient"].Val<string>();
            var userId = oauthTicket["UserId"].Val<string>();
            var wxMpId = oauthTicket["WxMpId"].Val<string>();
            var returnUrl = oauthTicket["ReturnUrl"].Val<string>() ?? "";
            if (osClient.DosIsNullOrWhiteSpace()
                || userId.DosIsNullOrWhiteSpace()
                || wxMpId.DosIsNullOrWhiteSpace())
            {
                return Content("授权票据内容无效！");
            }
            if (!TenantProtocolGatewaySettings.TryLoadOAuthReturnUrlPolicy(
                    osClient,
                    out var returnUrlPolicy))
            {
                return Content("租户配置无效或已停用！");
            }

            var wxmpModelResult = await MicroiEngine.FormEngine.GetFormDataAsync(new
            {
                FormEngineKey = "wx_mp",
                Id = wxMpId,
                OsClient = osClient
            });
            if (wxmpModelResult.Code != 1)
            {
                return Content("获取微信公众号信息失败：" + wxmpModelResult.Msg);
            }
            var appId = (string)wxmpModelResult.Data.AppId;
            var appSecret = (string)wxmpModelResult.Data.AppSecret;
            if (appId.DosIsNullOrWhiteSpace() || appSecret.DosIsNullOrWhiteSpace())
            {
                return Content("微信公众号AppId、AppSecret配置为空！");
            }

            OAuthAccessTokenResult result = null;

            //通过，用code换取access_token
            try
            {
                result = OAuthApi.GetAccessToken(appId, appSecret, code);
            }
            catch (Exception ex)
            {
                return Content("微信授权服务暂时不可用，请稍后重试！");
            }
            if (result.errcode != ReturnCode.请求成功)
            {
                return Content("错误：" + result.errmsg);
            }

            //下面2个数据也可以自己封装成一个类，储存在数据库中（建议结合缓存）
            //如果可以确保安全，可以将access_token存入用户的cookie中，每一个人的access_token是不一样的
            //HttpContext.Session.SetString("OAuthAccessTokenStartTime", SystemTime.Now.ToString());
            //HttpContext.Session.SetString("OAuthAccessToken", result.ToJson());

            //因为第一步选择的是OAuthScope.snsapi_userinfo，这里可以进一步获取用户详细信息
            try
            {
                OAuthUserInfo userInfo = OAuthApi.GetUserInfo(result.access_token, result.openid);
                var bindingRequest = new JObject
                {
                    ["Action"] = "Bind",
                    ["TrustedUserId"] = userId,
                    ["WxMpId"] = wxMpId,
                    ["WxOpenId"] = result.openid,
                    ["WxAvatar"] = userInfo?.headimgurl ?? string.Empty,
                    ["WxNickName"] = userInfo?.nickname ?? string.Empty
                };
                var rawBindingResult = await ManagedApiEngineCompatibility.RunTrustedProtocolAsync(
                    UserBindingApiEngineKey,
                    osClient,
                    bindingRequest).ConfigureAwait(false);
                var bindingResult = ToResultObject(rawBindingResult);
                if (bindingResult?["Code"].Val<int>() != 1)
                {
                    return Content("绑定失败：" + (bindingResult?["Msg"]?.ToString() ?? "官方微信绑定接口不可用。"));
                }

                if (!string.IsNullOrEmpty(returnUrl))
                {
                    if (!returnUrlPolicy.IsAllowed(returnUrl))
                    {
                        return Content("返回URL验证失败：仅允许站内路径或当前租户配置的可信HTTPS Origin");
                    }
                    return Redirect(returnUrl);
                }
                return Content("绑定成功！");
                //return View(userInfo);
            }
            catch (ErrorJsonResultException ex)
            {
                return Content(ex.Message);
            }
        }

        private static JObject ToResultObject(object result)
        {
            if (result == null) return null;
            if (result is JObject jobject) return jobject;
            if (result is string json)
            {
                try { return JObject.Parse(json); }
                catch { return null; }
            }
            try { return JObject.FromObject(result); }
            catch { return null; }
        }
        ///// <summary>
        ///// OAuthScope.snsapi_base方式回调
        ///// </summary>
        ///// <param name="code"></param>
        ///// <param name="returnUrl">用户最初尝试进入的页面</param>
        ///// <returns></returns>
        //public ActionResult BaseCallback(string code, string returnUrl)
        //{
        //    try
        //    {
        //        if (string.IsNullOrEmpty(code))
        //        {
        //            return Content("您拒绝了授权！");
        //        }

        //        //通过，用code换取access_token
        //        var result = OAuthApi.GetAccessToken(appId, appSecret, code);
        //        if (result.errcode != ReturnCode.请求成功)
        //        {
        //            return Content("错误：" + result.errmsg);
        //        }

        //        //下面2个数据也可以自己封装成一个类，储存在数据库中（建议结合缓存）
        //        //如果可以确保安全，可以将access_token存入用户的cookie中，每一个人的access_token是不一样的
        //        HttpContext.Session.SetString("OAuthAccessTokenStartTime", SystemTime.Now.ToString());
        //        HttpContext.Session.SetString("OAuthAccessToken", result.ToJson());

        //        //因为这里还不确定用户是否关注本微信，所以只能试探性地获取一下
        //        OAuthUserInfo userInfo = null;
        //        try
        //        {
        //            //已关注，可以得到详细信息
        //            userInfo = OAuthApi.GetUserInfo(result.access_token, result.openid);

        //            if (!string.IsNullOrEmpty(returnUrl))
        //            {
        //                return Redirect(returnUrl);
        //            }


        //            ViewData["ByBase"] = true;
        //            return View("UserInfoCallback", userInfo);
        //        }
        //        catch (ErrorJsonResultException ex)
        //        {
        //            //未关注，只能授权，无法得到详细信息
        //            //这里的 ex.JsonResult 可能为："{\"errcode\":40003,\"errmsg\":\"invalid openid\"}"
        //            return Content("用户已授权，授权Token：" + result, "text/html", Encoding.UTF8);
        //        }
        //    }
        //    catch (Exception ex)
        //    {
        //        WeixinTrace.SendCustomLog("BaseCallback 发生错误", ex.ToString());
        //        return Content("发生错误：" + ex.ToString());
        //    }
        //}
    }
}


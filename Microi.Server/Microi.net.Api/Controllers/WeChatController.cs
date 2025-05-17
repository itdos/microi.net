using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Google.Protobuf.WellKnownTypes;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json.Linq;
using Senparc.Weixin;
using Senparc.Weixin.Exceptions;
using Senparc.Weixin.MP;
using Senparc.Weixin.MP.AdvancedAPIs;
using Senparc.Weixin.MP.AdvancedAPIs.OAuth;
using Dos.Common;
using System.Net;
using Senparc.CO2NET.Extensions;
using Microsoft.AspNetCore.Cors;
using Senparc.Weixin.MP.AdvancedAPIs.TemplateMessage;
using Senparc.Weixin.MP.Containers;

// For more information on enabling MVC for empty projects, visit https://go.microsoft.com/fwlink/?LinkID=397860

namespace Microi.net.Api.Controllers
{
    /// <summary>
    /// 
    /// </summary>
    [EnableCors("any")]
    [Route("api/[controller]/[action]")]
    public class WeChatController : Controller
    {
        private static FormEngine _formEngine = new FormEngine();

        /// <summary>
        /// 根据公众号用户openid推送模板消息给特定用户
        /// </summary>
        private bool SendTemplateMessage(string openId)
        {
            try
            {
                string templateId = "fxrtUb0v1sVmo_y-M9Wyz489PSAJlkSw5YabKfjMLFU";   //模版id  
                string linkUrl = "";    //点击详情后跳转后的链接地址，为空则不跳转  
                                        //根据appId判断获取    
                if (!AccessTokenContainer.CheckRegistered("wxb3fb0a1b44902df3\n"))    //检查是否已经注册    
                {
                    AccessTokenContainer.RegisterAsync("wxb3fb0a1b44902df3", "a4e9c22e3474a9ff73c07d6e7003531e");    //如果没有注册则进行注册    
                }
                string accessToken = Senparc.Weixin.MP.CommonAPIs.CommonApi.GetToken("wxb3fb0a1b44902df3", "a4e9c22e3474a9ff73c07d6e7003531e").access_token;  //获取AccessToken值

                //传入UserId、模板Key、Dictionary<string,string>
                var data = new Dictionary<string, string>() {
                        { "first", "这是first" },
                        { "keyword1", "这是keyword1" },
                        { "keyword2", "这是keyword2" },
                        { "keyword3", "这是keyword3" },
                        { "keyword4", "这是keyword3" },
                        { "keyword5", "这是keyword3" },
                        { "remark", "这是remark" },
                    };
                var templateData = new ProductTemplateData();
                var type = templateData.GetType();
                foreach (var item in data)
                {
                    var pi = type.GetProperty(item.Key);
                    pi?.SetValue(templateData, new TemplateDataItem(item.Value));
                }

                SendTemplateMessageResult sendResult = null;
                sendResult = TemplateApi.SendTemplateMessage(accessToken, openId, templateId, linkUrl, templateData, new TemplateModel_MiniProgram()
                {
                    appid = "wxe82f5569f39caea0",
                    pagepath = ""
                });

                //发送成功  
                if (sendResult.errcode.ToString() == "请求成功")
                {
                    return true;
                }
                else
                {
                    return false;
                }
            }
            catch (Exception ex)
            {
                        
                
                return false;

            }

        }
        /// <summary>  
        /// 定义模版中的字段属性（需与微信模版中的一致）  
        /// </summary>  
        public class ProductTemplateData
        {
            /// <summary>
            /// 
            /// </summary>
            public TemplateDataItem first { get; set; }
            /// <summary>
            /// 
            /// </summary>
            public TemplateDataItem keyword1 { get; set; }
            /// <summary>
            /// 
            /// </summary>
            public TemplateDataItem keyword2 { get; set; }
            /// <summary>
            /// 
            /// </summary>
            public TemplateDataItem keyword3 { get; set; }
            /// <summary>
            /// 
            /// </summary>
            public TemplateDataItem keyword4 { get; set; }
            /// <summary>
            /// 
            /// </summary>
            public TemplateDataItem keyword5 { get; set; }
            /// <summary>
            /// 
            /// </summary>
            public TemplateDataItem keyword6 { get; set; }
            /// <summary>
            /// 
            /// </summary>
            public TemplateDataItem remark { get; set; }
        }

        /// <summary>
        /// 必传authorization、OsClient，可选 ReturnUrl
        /// </summary>
        /// <param name="authorization"></param>
        /// <param name="OsClient"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<IActionResult> BindSysUser(string authorization, string OsClient, string ReturnUrl)
        {
            if (ReturnUrl == null)
            {
                ReturnUrl = "";
            }
            //解析authorization
            var tokenModelJobj = await DiyToken.GetCurrentToken<JObject>(authorization, OsClient);
            if (tokenModelJobj == null)
            {
                return Content("无效的token！");
            }
            var sysUserDynamic = tokenModelJobj.CurrentUser;
            if (sysUserDynamic["WxMpId"] == null || sysUserDynamic["WxMpId"].Value<string>().DosIsNullOrWhiteSpace())
            {
                return Content("用户信息未绑定所属公众号，无法获取OpenId！");
            }
            var wxmpModelResult = await _formEngine.GetFormDataAsync(new {
                FormEngineKey = "wx_mp",
                Id = sysUserDynamic["WxMpId"]?.Value<string>(),
                OsClient = OsClient
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
            var sysConfigResult = await _formEngine.GetFormDataAsync(new {
                FormEngineKey = "Sys_Config",
                _Where = new List<DiyWhere>() {
                    new DiyWhere(){
                        Name = "IsEnable",
                        Value = "1",
                        Type = "="
                    }
                },
                OsClient = OsClient
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

            var urlBase = OAuthApi.GetAuthorizeUrl(
                                appId,
                                $"{apiBase}/WeChat/UserInfoCallback?OsClient={OsClient}&ReturnUrl={ReturnUrl.UrlEncode()}&authorization={authorization}",
                                null, OAuthScope.snsapi_userinfo);
            return Redirect(urlBase);
        }
        /// <summary>
        /// OAuthScope.snsapi_userinfo方式回调
        /// </summary>
        /// <param name="code"></param>
        /// <param name="returnUrl">用户最初尝试进入的页面</param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<ActionResult> UserInfoCallback(string code, string ReturnUrl, string authorization, string OsClient)
        {
            if (string.IsNullOrEmpty(code))
            {
                return Content("您拒绝了授权！");
            }

            //解析authorization
            var tokenModelJobj = await DiyToken.GetCurrentToken<JObject>(authorization, OsClient);
            if (tokenModelJobj == null)
            {
                return Content("无效的token！");
            }
            var sysUserDynamic = tokenModelJobj.CurrentUser;
            if (sysUserDynamic["WxMpId"] == null || sysUserDynamic["WxMpId"].Value<string>().DosIsNullOrWhiteSpace())
            {
                return Content("用户信息未绑定所属公众号，无法获取OpenId！");
            }
            var wxmpModelResult = await _formEngine.GetFormDataAsync(new
            {
                FormEngineKey = "wx_mp",
                Id = sysUserDynamic["WxMpId"]?.Value<string>(),
                OsClient = OsClient
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
                
                return Content(ex.Message);
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
                var _formData = new Dictionary<string, string>() {
                    { "WxOpenId", result.openid},
                };
                OAuthUserInfo userInfo = OAuthApi.GetUserInfo(result.access_token, result.openid);
                if (userInfo != null)
                {
                    _formData.Add("WxAvatar", userInfo.headimgurl);
                    try
                    {
                        _formData.Add("WxNickName", userInfo.nickname);
                    }
                    catch (Exception ex)
                    {

                    }
                }

                var uptSysUserResult = await _formEngine.UptFormDataAsync(new
                {
                    FormEngineKey = "Sys_User",
                    Id = sysUserDynamic["Id"]?.Value<string>(),
                    _RowModel = _formData,
                    CurrentUser = sysUserDynamic,
                    OsClient = OsClient
                });

                if (!string.IsNullOrEmpty(ReturnUrl))
                {
                    return Redirect(ReturnUrl);
                }
                if (uptSysUserResult.Code == 1)
                {
                    return Content("绑定成功！");
                }
                return Content("绑定失败：" + uptSysUserResult.Msg);
                //return View(userInfo);
            }
            catch (ErrorJsonResultException ex)
            {
                return Content(ex.Message);
            }
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


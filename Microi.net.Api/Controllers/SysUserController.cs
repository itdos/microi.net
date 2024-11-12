using Dos.Common;
using Dos.ORM;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using System;
using System.Linq;
using System.Net.Http;
using System.Threading.Tasks;
using System.Collections.Generic;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Microi.net.Model;
using NPOI.SS.Formula.Functions;
using System.Security.Cryptography;
using Lazy.Captcha.Core;
using System.Text;

namespace iTdos.Api.Controllers
{
    /// <summary>
    /// 
    /// </summary>
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [Route("api/[controller]/[action]")]
    //注意：core2.2->3.1后，继续使用IS4Authorize会导致接口直接报401
    //[IS4Authorize("Auth_SysUserController")]
    public class SysUserController : Controller
    {
        private static SysUserLogic? _sysUserLogic;// = new SysUserLogic();
        private static FormEngine? _formEngine;// = new FormEngine();

        private readonly IMicroiWeChat _templateMessageInterface;
        private readonly ICaptcha _captcha;

        public SysUserController(IMicroiWeChat templateMessageInterface, ICaptcha captcha)
        {
            _templateMessageInterface = templateMessageInterface;
            _captcha = captcha;
            _formEngine = new FormEngine(templateMessageInterface);
            _sysUserLogic = new SysUserLogic(templateMessageInterface);
        }

        private static async Task DefaultParam(SysUserParam param)
        {
            var currentToken = await DiyToken.GetCurrentToken<SysUser>();
            var currentTokenDynamic = await DiyToken.GetCurrentToken<JObject>();
            param._CurrentSysUser = currentToken.CurrentUser;
            param._CurrentUser = currentTokenDynamic.CurrentUser;
            param.OsClient = currentToken.OsClient;
        }

        /// <summary>
        /// 用户登陆。必传：Account、Pwd
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> Login(SysUserParam param)
        {
            try
            {
                param.LastLoginIP = IPHelper.GetClientIP(HttpContext).Data;
            }
            catch (Exception)
            {

            }
            //2022-06-27 新增可以提前加密密码
            //if (!param.Pwd.DosIsNullOrWhiteSpace())
            //{
            //    param._EncodePwd = EncryptHelper.DESEncode(param.Pwd);
            //}

            //2023-11-03 pwd base64
            try
            {
                //2023-11-30 不再使用base64  //TODO


                var pwdOld = param.Pwd.ToString();
                if(DiyCommon.IsBase64String(pwdOld)){
                    param.Pwd = Encoding.Default.GetString(Convert.FromBase64String(param.Pwd));
                }
                if (param.Pwd.Contains("�"))
                {
                    param.Pwd = pwdOld;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine("未处理的异常：" + ex.Message);
            }

            //获取系统设置
            dynamic sysConfig = new { };
            var sysConfigResult = await _formEngine.GetFormDataAsync(new
            {
                FormEngineKey = "Sys_Config",
                _Where = new List<DiyWhere>() {
                            new DiyWhere(){
                                Name = "IsEnable",
                                Value = "1",
                                Type = "="
                            }
                        },
                OsClient = param.OsClient,
            });
            if (sysConfigResult.Code == 1)//&& !((string)sysUser.TenantId).DosIsNullOrWhiteSpace()
            {
                try
                {
                    if ((int)sysConfigResult.Data.EnableCaptcha == 1)
                    {
                        if (param._CaptchaId.DosIsNullOrWhiteSpace())
                        {
                            return Json(new DosResult(1003, null, DiyMessage.Msg["NoGetCaptcha"][param._Lang]));
                        }
                        if (param._CaptchaValue.DosIsNullOrWhiteSpace())
                        {
                            return Json(new DosResult(1003, null, DiyMessage.Msg["NoInputCaptcha"][param._Lang]));
                        }
                        if (!_captcha.Validate(param._CaptchaId, param._CaptchaValue))
                        {
                            return Json(new DosResult(1004, null, DiyMessage.Msg["CaptchaError"][param._Lang]));
                        }
                    }
                }
                catch (Exception ex)
                {
Console.WriteLine("未处理的异常：" + ex.Message);
                }

            }

            var result = await _sysUserLogic.Login(param);
            if (result.Code == 1)
            {
                var sysUser = result.Data;

                #region 获取该用户access_token。--2019-07-17 若获取失败则登录失败。
                var getTokenResult = await Microi.net.Api.Handler.DiyToken.GetAccessToken<JObject>(new DiyTokenParam<JObject>()
                {
                    CurrentUser = sysUser,
                    OsClient = param.OsClient
                });
                if (getTokenResult.Code != 1)
                {
                    return Json(getTokenResult);
                }
                #endregion

                #region 过滤掉不该返回的字段，也可以map ViewModel
                sysUser.Pwd = "";
                #endregion

                #region 取配置信息

                if (sysConfigResult.Code == 1 && !((string)sysUser.TenantId).DosIsNullOrWhiteSpace())
                {
                    var sysConfigTenantResult = await _formEngine.GetFormDataAsync(new
                    {
                        FormEngineKey = "Sys_ConfigTenant",
                        _Where = new List<DiyWhere>() {
                            new DiyWhere(){
                                Name = "IsEnable",
                                Value = "1",
                                Type = "="
                            },
                            new DiyWhere(){
                                Name = "TenantId",
                                Value = (string)sysUser.TenantId,
                                Type = "="
                            }
                        },
                        OsClient = param.OsClient,
                    });
                    if (sysConfigTenantResult.Code == 1)
                    {
                        sysConfigResult.Data.SysShortTitle = sysConfigTenantResult.Data.SysShortTitle;
                        sysConfigResult.Data.SysLogo = sysConfigTenantResult.Data.SysLogo;
                        sysConfigResult.Data.SysLogoHeight = sysConfigTenantResult.Data.SysLogoHeight;
                    }
                }
                sysConfig = sysConfigResult.Data;
                #endregion

                result.Data = sysUser;
                dynamic SysMenuHomePage = null;
                try
                {
                    SysMenuHomePage = (await new SysMenuLogic().GetSysMenuHomePage(new SysMenuParam() { OsClient = param.OsClient })).Data;
                }
                catch (Exception ex)
                {
Console.WriteLine("未处理的异常：" + ex.Message);
                }
                result.DataAppend = new
                {
                    SysMenuHomePage = SysMenuHomePage,
                    SysConfig = sysConfig
                };
            }

            return Json(result);
        }

        /// <summary>
        /// Token以旧换新，传入authorization、OsClient
        /// </summary>
        /// <returns></returns>
        [AllowAnonymous]
        [HttpPost]
        public async Task<JsonResult> RefreshToken(SysUserParam param)
        {
            if (param.authorization.DosIsNullOrWhiteSpace())
            {
                param.authorization = HttpContext.Request.Headers["authorization"];
            }
            var tokenModelJobj = await DiyToken.GetCurrentToken<JObject>(param.authorization, param.OsClient);
            if (tokenModelJobj == null)
            {
                return Json(new DosResult(0, null, "无效的Token."));
            }
            var getTokenResult = await Microi.net.Api.Handler.DiyToken.GetAccessToken<JObject>(new DiyTokenParam<JObject>()
            {
                CurrentUser = tokenModelJobj.CurrentUser,
                OsClient = tokenModelJobj.OsClient
            });
            if (getTokenResult.Code != 1)
            {
                return Json(getTokenResult);
            }

            var osClient = tokenModelJobj.OsClient;

            #region GetSysUserOtherInfo
            JObject sysUser = tokenModelJobj.CurrentUser;// JObject.FromObject(userModelResult.Data);

            //2022-11-17 从Sys_User表的RoleIds字段中获取所有角色Id
            var roleIds = new List<string>();
            var errorMsg = "";
            try
            {
                try
                {
                    if(!sysUser["RoleIds"].Value<string>().Contains("{")){
                        roleIds = JsonConvert.DeserializeObject<List<string>>(sysUser["RoleIds"].Value<string>());
                    }else{
                        var roles = JsonConvert.DeserializeObject<List<SysRole>>(sysUser["RoleIds"].Value<string>());
                        roleIds = roles.Select(d => d.Id).ToList();
                    }
                }
                catch (Exception ex)
                {
                    var roles = JsonConvert.DeserializeObject<List<SysRole>>(sysUser["RoleIds"].Value<string>());
                    roleIds = roles.Select(d => d.Id).ToList();
                }
                if (!roleIds.Any())
                {
                    if (sysUser.ContainsKey("_IsAdmin"))
                        sysUser["_IsAdmin"] = false;
                    else
                        sysUser.Add("_IsAdmin", false);

                    if (sysUser.ContainsKey("_Roles"))
                        sysUser["_Roles"] = JToken.FromObject(new List<SysRole>());
                    else
                        sysUser.Add("_Roles", JToken.FromObject(new List<SysRole>()));

                    if (sysUser.ContainsKey("_RoleLimits"))
                        sysUser["_RoleLimits"] = JToken.FromObject(new List<SysRoleLimit>());
                    else
                        sysUser.Add("_RoleLimits", JToken.FromObject(new List<SysRoleLimit>()));
                }
                else
                {
                    var roleList = await _formEngine.GetTableDataAsync<SysRole>(new
                    {
                        FormEngineKey = "sys_role",
                        _Where = new List<DiyWhere>() {
                                            new DiyWhere(){
                                                Name = "Id",
                                                Value = JsonConvert.SerializeObject(roleIds),
                                                Type = "In"
                                            }
                                        },
                        //Ids = roleIds,
                        OsClient = osClient
                    });

                    if (sysUser.ContainsKey("_RoleLimits"))
                        sysUser["_Roles"] = JToken.FromObject(roleList.Data);
                    else
                        sysUser.Add("_Roles", JToken.FromObject(roleList.Data));


                    //var sysMenuLimits = await new SysRoleLimitLogic().GetSysRoleLimit(new SysRoleLimitParam()
                    //{
                    //    RoleIds = roleList.Data.Select(d => d.Id).ToList(),
                    //    OsClient = osClient
                    //});

                    var sysMenuLimits = await _formEngine.GetTableDataAsync<SysRoleLimit>(new
                    {
                        FormEngineKey = "sys_rolelimit",
                        _Where = new List<DiyWhere>() {
                                            new DiyWhere(){
                                                Name = "RoleId",
                                                Value = JsonConvert.SerializeObject(roleList.Data.Select(d => d.Id).ToList()),
                                                Type = "In"
                                            }
                                        },
                        OsClient = osClient
                    });

                    if (sysMenuLimits.Code == 1)
                    {
                        if (sysUser.ContainsKey("_RoleLimits"))
                            sysUser["_RoleLimits"] = JToken.FromObject(sysMenuLimits.Data);
                        else
                            sysUser.Add("_RoleLimits", JToken.FromObject(sysMenuLimits.Data));
                    }
                    else
                    {
                        if (sysUser.ContainsKey("_RoleLimits"))
                            sysUser["_RoleLimits"] = JToken.FromObject(new List<SysRoleLimit>());
                        else
                            sysUser.Add("_RoleLimits", JToken.FromObject(new List<SysRoleLimit>()));
                    }

                    if (sysUser.ContainsKey("_IsAdmin"))
                        sysUser["_IsAdmin"] = sysUser["Level"].Value<int>() >= 999;
                    else
                        sysUser.Add("_IsAdmin", sysUser["Level"].Value<int>() >= 999);
                }
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                errorMsg = ex.Message;
                if (sysUser.ContainsKey("_IsAdmin"))
                    sysUser["_IsAdmin"] = false;
                else
                    sysUser.Add("_IsAdmin", false);

                if (sysUser.ContainsKey("_Roles"))
                    sysUser["_Roles"] = JToken.FromObject(new List<SysRole>());
                else
                    sysUser.Add("_Roles", JToken.FromObject(new List<SysRole>()));

                if (sysUser.ContainsKey("_RoleLimits"))
                    sysUser["_RoleLimits"] = JToken.FromObject(new List<SysRoleLimit>());
                else
                    sysUser.Add("_RoleLimits", JToken.FromObject(new List<SysRoleLimit>()));
            }

            #endregion

            var DiyCacheBase = new MicroiCacheRedis(osClient);
            await DiyCacheBase.SetAsync<CurrentToken<JObject>>("LoginTokenSysUser:" + osClient + ":" + tokenModelJobj.CurrentUser["Id"].Value<string>(), tokenModelJobj);

            return Json(new DosResult(1, tokenModelJobj.CurrentUser, "", 0, new {
                ErrorMsg = errorMsg
            }));
        }

        /// <summary>
        /// 传入headers token、OsClient
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpGet, HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> SsoPengrui(SysUserParam param)
        {
            try
            {
                var token = param._token;
                if (token.DosIsNullOrWhiteSpace())
                {
                    token = param.Token;
                }
                if (token.DosIsNullOrWhiteSpace())
                {
                    return Json(new DosResult(0, null, "Token为空！"));
                }
                var httpParam = new DiyHttpParam();
                httpParam.Url = "http://airiot.wiz.top:3062/core/auth/user";

                //如果传入了TokenName
                if (!param.TokenName.DosIsNullOrWhiteSpace())
                {
                    var diySsoResult = await _formEngine.GetFormDataAsync<DiySso>(new {
                        FormEngineKey = "Diy_Sso",
                        _SearchEqual = new Dictionary<string, string>() {
                            { "TokenName", param.TokenName },
                            { "IsEnable", "1" },
                        },
                        OsClient = param.OsClient
                    });
                    if (diySsoResult.Code != 1 || diySsoResult.Data == null)
                    {
                        return Json(new DosResult(0, diySsoResult, diySsoResult.Msg));
                    }
                    if (diySsoResult.Data.ServerSsoApi.DosIsNullOrWhiteSpace())
                    {
                        return Json(new DosResult(0, null, "ServerSsoApi为空！"));
                    }
                    httpParam.Url = diySsoResult.Data.ServerSsoApi;
                }

                httpParam.Headers = new { Authorization = "Bearer " + token };
                var getResultString = await DiyHttp.Get(httpParam);
                new SysLogLogic().AddSysLog(new SysLogParam()
                {
                    Type = "SSO登录日志",
                    Title = "尝试登录系统",
                    Content = getResultString,
                    Param = token,
                    IP = IPHelper.GetClientIP(HttpContext).Data,
                    OsClient = param.OsClient
                });
                var resultModel = JsonConvert.DeserializeObject<SsoPengruiModel>(getResultString);
                if (resultModel != null && !resultModel.username.DosIsNullOrWhiteSpace())
                {
                    //判断是否存在用户，存在则直接登陆，不存在则创建，再登陆
                    var userModel = (await _sysUserLogic.GetSysUserModel(new SysUserParam()
                    {
                        Account = resultModel.username,
                        OsClient = param.OsClient
                    })).Data;
                    if (userModel == null)
                    {
                        //创建用户
                        var addUSerresult = await _sysUserLogic.AddSysUser(new SysUserParam() {
                            Account = resultModel.username,
                            Name = resultModel.username,
                            RoleIds = new List<string>() { "5db47859-35a3-411a-a1f7-99482e057d24" },
                            Pwd = "1234567",
                            OsClient = param.OsClient
                        });
                        if (addUSerresult.Code != 1)
                        {
                            return Json(addUSerresult);
                        }
                    }
                    //登陆用户
                    var result = await _sysUserLogic.LoginByAccount(new SysUserParam() {
                        Account = resultModel.username,
                        OsClient = param.OsClient,
                    });
                    if (result.Code == 1)
                    {
                        var sysUser = result.Data;

                        #region 获取该用户access_token。--2019-07-17 若获取失败则登录失败。
                        var getTokenResult = await DiyToken.GetAccessToken<SysUser>(new DiyTokenParam<SysUser>()
                        {
                            CurrentUser = sysUser,
                            OsClient = param.OsClient
                        });
                        if (getTokenResult.Code != 1)
                        {
                            return Json(getTokenResult);
                        }
                        #endregion

                        //屏蔽掉不该返回的字段，也可以map ViewModel
                        sysUser.Pwd = "";
                        result.Data = sysUser;
                        result.DataAppend = new
                        {
                            SysMenuHomePage = (await new SysMenuLogic().GetSysMenuHomePage(new SysMenuParam() { OsClient = param.OsClient })).Data
                        };
                    }

                    return Json(result);
                }
                return Json(new DosResult(0, null, getResultString));
            }
            catch (Exception ex)
            {
                        Console.WriteLine("未处理的异常：" + ex.Message);
                
                return Json(new DosResult(0, null, ex.Message));
            }
        }

        [HttpGet, HttpPost]
        public async Task<JsonResult> TokenLogin(SysUserParam param)
        {
            var token = await DiyToken.GetCurrentToken<SysUser>();
            if (!HttpContext.Response.Headers.Any(d => d.Key.ToLower() == "access-control-expose-headers".ToLower()))
            {
                HttpContext.Response.Headers.Add("access-control-expose-headers", ("set-cookie,token,did,authorization").DosTrimEnd(','));
            }

            if (!HttpContext.Response.Headers.Any(d => d.Key.ToLower() == "authorization"))
            {
                HttpContext.Response.Headers.Add("authorization", token.Token);
            }
            return Json(new DosResult(1, token.CurrentUser));
        }
        
        [HttpPost]
        [AllowAnonymous]
        [Obsolete("Please use Login")]
        public async Task<JsonResult> DiyLogin(SysUserParam param)
        {
            try
            {
                param.LastLoginIP = IPHelper.GetClientIP(HttpContext).Data;
            }
            catch (Exception)
            {

            }

            var result = await _sysUserLogic.DiyLogin(param);

            if (result.Code == 1)
            {
                var sysUser = result.Data;

                #region 获取该用户access_token。--2019-07-17 若获取失败则登录失败。
                var getTokenResult = await DiyToken.GetAccessToken<JObject>(new DiyTokenParam<JObject>()
                {
                    CurrentUser = sysUser,
                    OsClient = param.OsClient
                });
                if (getTokenResult.Code != 1)
                {
                    return Json(getTokenResult);
                }
                #endregion

                #region 过滤掉不该返回的字段，也可以map ViewModel
                sysUser["Pwd"] = "";
                #endregion

                result.Data = sysUser;
                result.DataAppend = new
                {
                    SysMenuHomePage = (await new SysMenuLogic().GetSysMenuHomePage(new SysMenuParam() { OsClient = param.OsClient })).Data
                };
            }

            return Json(result);
        }

       

        /// <summary>
        /// 退出登录
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]  
        [AllowAnonymous]
        public async Task<JsonResult> Logout(SysUserParam param)
        {
            #region 取did、token
            var did = HttpContext.Request.Headers["did"].ToString();
            var token = HttpContext.Request.Headers["token"].ToString();

            #endregion
            try
            {
                HttpContext.Session.Remove("SysUserSession");
            }
            catch (Exception)
            {
            }
            try
            {
                //if (!did.DosIsNullOrWhiteSpace())
                //{
                //    await DiyCacheBase.DeleteAsync("LoginTokenSysUser:" + did);
                //}
            }
            catch (Exception)
            {
            }
            return Json(new DosResult(1));
        }

        /// <summary>
        /// 
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]  
        //注意：core2.2->3.1后，继续使用IS4Authorize会导致接口直接报401
        //[IS4Authorize("Auth_GetCurrentUser")]
        public async Task<JsonResult> GetCurrentUser(SysUserParam param)
        {
            //不包含扩展信息
            //var sysUser = await DiyToken.GetCurrentUser<SysUser>();

            //包含扩展信息
            //var sysUser = await DiyToken.GetCurrentUser<dynamic>();
            try
            {
                //包含扩展信息
                var sysUser = await DiyToken.GetCurrentUser<JObject>();
                return Json(new DosResult(1, sysUser));
            }
            catch (Exception ex)
            {
                //不包含扩展信息
                var sysUser = await DiyToken.GetCurrentUser<SysUser>();
                return Json(new DosResult(1, sysUser));
            }
        }

        /// <summary>
        /// 刷新登陆用户redis缓存信息
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> RefreshLoginUser(string userId = null, string osClient = null)
        {
            if (userId.DosIsNullOrWhiteSpace())
            {
                try
                {
                    //包含扩展信息
                    var sysUser = await DiyToken.GetCurrentToken<JObject>();
                    userId = sysUser.CurrentUser["Id"].ToString();
                    osClient = sysUser.OsClient;
                }
                catch (Exception ex)
                {
                    //不包含扩展信息
                    var sysUser = await DiyToken.GetCurrentToken<SysUser>();
                    userId = sysUser.CurrentUser.Id;
                    osClient = sysUser.OsClient;
                }
            }
            var result = await _sysUserLogic.RefreshLoginUser(userId, osClient);
            return Json(result);
        }

        /// <summary>
        /// 修改用户。必传：Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]  
        public async Task<JsonResult> UptSysUser(SysUserParam param)
        {
            await DefaultParam(param);

            //2022-06-27 新增密码提前加密，也可以不使用
            //if (!param.Pwd.DosIsNullOrWhiteSpace())
            //{
            //    param._EncodePwd = EncryptHelper.DESEncode(param.Pwd);
            //}
            //2022-06-27 新增密码提前加密，也可以不使用
            //if (!param.NewPwd.DosIsNullOrWhiteSpace())
            //{
            //    param._EncodeNewPwd = EncryptHelper.DESEncode(param.NewPwd);
            //}

            var result = await _sysUserLogic.UptSysUser(param);
            return Json(result);
        }

        /// <summary>
        /// 新增登陆账号。必传：Account、Pwd
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]  
        public async Task<JsonResult> AddSysUser(SysUserParam param)
        {
            await DefaultParam(param);

            //2022-06-27 新增密码提前加密，也可以不使用
            //if (!param.Pwd.DosIsNullOrWhiteSpace())
            //{
            //    param._EncodePwd = EncryptHelper.DESEncode(param.Pwd);
            //}

            var result = await _sysUserLogic.AddSysUser(param);

            return Json(result);
        }

        /// <summary>
        /// 删除用户。必传：Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]  
        public async Task<JsonResult> DelSysUser(SysUserParam param)
        {
            await DefaultParam(param);

            var result = await _sysUserLogic.DelSysUser(param);
            return Json(result);
        }

        /// <summary>
        /// 获取用户。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]  
        public async Task<JsonResult> GetSysUser(SysUserParam param)
        {
            await DefaultParam(param);

            param.IsDeleted = 0;
            var result = await _sysUserLogic.GetSysUser(param);
            if (result.Code == 1)
            {
                //去掉密码
                foreach (var item in result.Data)
                {
                    item.Pwd = "";
                }
            }
            return Json(result);
        }
        /// <summary>
        /// 获取所有系统用户公开信息。可传入Ids。
        /// 建议使用接口引擎重新实现。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]  
        public async Task<JsonResult> GetSysUserPublicInfo(SysUserParam param)
        {
            await DefaultParam(param);
            param.IsDeleted = 0;
            param._LevelLimit = false;
            var result = await _sysUserLogic.GetSysUser(param);
            if (result.Code == 1)
            {
                var newResult = new DosResult(1);
                newResult.Data = result.Data.Select(d => new { d.Id, d.Name, d.Avatar, d.Phone }).ToList();
                return Json(newResult);
            }
            return Json(result);
        }

        /// <summary>
        /// 获取用户。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]  
        public async Task<JsonResult> GetSysUserModel(SysUserParam param)
        {
            await DefaultParam(param);

            param.IsDeleted = 0;
            var result = await _sysUserLogic.GetSysUserModel(param);
            return Json(result);
        }
        /// <summary>
        /// 获取用户密码，必传Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]  
        public async Task<JsonResult> GetSysUserPassword(SysUserParam param)
        {

            #region 取当前登录会员信息
            var currentToken = await DiyToken.GetCurrentToken<SysUser>();
            #endregion

            if (currentToken.CurrentUser.Level >= 999)
            {
                param.OsClient = currentToken.OsClient;
                param._CurrentSysUser = currentToken.CurrentUser;

                param.IsDeleted = 0;
                var sysUserModelResult = await _sysUserLogic.GetSysUserModel(param);
                if (sysUserModelResult.Data != null)
                {
                    if (currentToken.CurrentUser.Level <= sysUserModelResult.Data.Level
                        && currentToken.CurrentUser.Account.ToLower() != sysUserModelResult.Data.Account.ToLower()
                        && currentToken.CurrentUser.Account.ToLower() != "admin")
                    {
                        return Json(new DosResult(0, null, "只能查看等级比自己低的角色！"));
                    }
                    //解密密码
                    var pwd = EncryptHelper.DESDecode(sysUserModelResult.Data.Pwd);
                    return Json(new DosResult(1, pwd));
                }
                return Json(sysUserModelResult);
            }
            return Json(new DosResult(0, null, DiyMessage.Msg["NoAuth"][param._Lang]));
        }
    }
}

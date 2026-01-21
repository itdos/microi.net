using Dos.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Lazy.Captcha.Core;
using System.Text;
using Microi.net;
namespace Microi.net.Api
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
        private static SysUserLogic _sysUserLogic = new SysUserLogic();
        private readonly ICaptcha _captcha;

        public SysUserController(ICaptcha captcha)
        {
            _captcha = captcha;
        }

        private static async Task DefaultParam(SysUserParam param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            param._CurrentUser = currentTokenDynamic?.CurrentUser;
            param.OsClient = currentTokenDynamic?.OsClient;
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
            if (param.OsClient.DosIsNullOrWhiteSpace())
            {
                return new JsonResult(new DosResult(1003, null, "OsClient不能为空！"));
            }
            param.LastLoginIP = IPHelper.GetClientIP(HttpContext).Data;

            //2022-06-27 新增可以提前加密密码
            //if (!param.Pwd.DosIsNullOrWhiteSpace())
            //{
            //    param._EncodePwd = EncryptHelper.DESEncode(param.Pwd);
            //}
            var sysConfigResult = await MicroiEngine.FormEngine.GetSysConfig(param.OsClient, param._Lang);
            if (sysConfigResult.Code != 1)
            {
                return Json(new DosResult<dynamic>(0, null, $"获取系统配置失败：{sysConfigResult.Msg}"));
            }
            var sysConfig = sysConfigResult.Data;
            try
            {
                var enableCaptcha = DynamicHelper.GetDynamicBoolValue(sysConfigResult.Data, "EnableCaptcha");
                if (enableCaptcha)
                {
                    if (param._CaptchaId.DosIsNullOrWhiteSpace())
                    {
                        return Json(new DosResult<dynamic>(1003, null, DiyMessage.GetLang(param.OsClient, "NoGetCaptcha", param._Lang)));
                    }
                    if (param._CaptchaValue.DosIsNullOrWhiteSpace())
                    {
                        return Json(new DosResult<dynamic>(1003, null, DiyMessage.GetLang(param.OsClient, "NoInputCaptcha", param._Lang)));
                    }
                    if (!_captcha.Validate(param._CaptchaId, param._CaptchaValue, true, true))
                    {
                        return Json(new DosResult<dynamic>(1004, null, DiyMessage.GetLang(param.OsClient, "CaptchaError", param._Lang)));
                    }
                }
            }
            catch (Exception ex)
            {

            }

            var result = await _sysUserLogic.Login(param);
            if (result.Code == 1)
            {
                JObject sysUser = JObject.FromObject(result.Data);

                #region 获取该用户access_token。--2019-07-17 若获取失败则登录失败。
                var getTokenResult = await new DiyToken().GetAccessToken(new DiyTokenParam()
                {
                    CurrentUser = sysUser,
                    OsClient = param.OsClient,
                    _ClientType = param._ClientType
                });
                if (getTokenResult.Code != 1)
                {
                    return Json(getTokenResult);
                }
                #endregion

                #region 过滤掉不该返回的字段，也可以map ViewModel
                sysUser["Pwd"] = "";
                #endregion

                

                #region 取租户信息
                if (sysConfigResult.Code == 1 && !sysUser["TenantId"].Val<string>().DosIsNullOrWhiteSpace())
                {
                    var sysConfigTenantResult = await MicroiEngine.FormEngine.GetFormDataAsync(new
                    {
                        FormEngineKey = "sys_configtenant",
                        _Where = new List<DiyWhere>() {
                            new DiyWhere(){
                                Name = "IsEnable",
                                Value = "1",
                                Type = "="
                            },
                            new DiyWhere(){
                                Name = "TenantId",
                                Value = sysUser["TenantId"].Val<string>(),
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
            var tokenModelJobj = await DiyToken.GetCurrentToken(param.authorization, param.OsClient);
            if (tokenModelJobj == null)
            {
                return Json(new DosResult(0, null, "无效的Token."));
            }
            var getTokenResult = await new DiyToken().GetAccessToken(new DiyTokenParam()
            {
                CurrentUser = tokenModelJobj.CurrentUser,
                OsClient = tokenModelJobj.OsClient,
                // _ClientType = tokenModelJobj._ClientType
            });
            if (getTokenResult.Code != 1)
            {
                return Json(getTokenResult);
            }

            tokenModelJobj = getTokenResult.Data;

            var osClient = tokenModelJobj.OsClient;

            #region GetSysUserOtherInfo
            JObject sysUser = tokenModelJobj.CurrentUser;
            // Microi.net.DiyToken.SetSysUserRoleInfo(sysUser, osClient);
            //2022-11-17 从sys_user表的RoleIds字段中获取所有角色Id
            var roleIds = new List<string>();
            var errorMsg = "";
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
                    sysUser["_RoleLimitsError4"] = "!roleIds.Any()";
                }
                else
                {
                    var roleList = await MicroiEngine.FormEngine.GetTableDataAsync<SysRole>(new
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
                    });

                    sysUser["_Roles"] = JTokenEx.FromObject(roleList.Data);

                    //var sysMenuLimits = await new SysRoleLimitLogic().GetSysRoleLimit(new SysRoleLimitParam()
                    //{
                    //    RoleIds = roleList.Data.Select(d => d.Id).ToList(),
                    //    OsClient = osClient
                    //});

                    var sysMenuLimits = await MicroiEngine.FormEngine.GetTableDataAsync<SysRoleLimit>(new
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
                    });

                    if (sysMenuLimits.Code == 1)
                    {
                        sysUser["_RoleLimits"] = JTokenEx.FromObject(sysMenuLimits.Data);
                    }
                    else
                    {
                        sysUser["_RoleLimits"] = JTokenEx.FromObject(new List<SysRoleLimit>());
                        sysUser["_RoleLimitsError3"] = sysMenuLimits.Msg;
                    }

                    sysUser["_IsAdmin"] = sysUser["Level"].Val<int>() >= DiyCommon.MaxRoleLevel;
                }
            }
            catch (Exception ex)
            {
                errorMsg = ex.Message;
                sysUser["_IsAdmin"] = false;
                sysUser["_Roles"] = JTokenEx.FromObject(new List<SysRole>());
                sysUser["_RoleLimits"] = JTokenEx.FromObject(new List<SysRoleLimit>());
                sysUser["_RoleLimitsError5"] = ex.Message;
            }

            #endregion

            var DiyCacheBase = MicroiEngine.CacheTenant.Cache(osClient);
            // 先获取 userId，再更新 CurrentUser，避免 JArray 类型转换异常
            var userId = sysUser["Id"]?.ToString() ?? tokenModelJobj.CurrentUser["Id"]?.ToString();
            tokenModelJobj.CurrentUser = sysUser;
            await DiyCacheBase.SetAsync<CurrentToken>($"Microi:{osClient}:LoginTokenSysUser:{userId}", tokenModelJobj);

            return Json(new DosResult(1, tokenModelJobj.CurrentUser, "", 0, new
            {
                ErrorMsg = errorMsg
            }));
        }


        [HttpGet, HttpPost]
        public async Task<JsonResult> TokenLogin(SysUserParam param)
        {
            var token = await DiyToken.GetCurrentToken();
            HttpContext.Response.Headers["authorization"] = token.Token;
            return Json(new DosResult(1, token.CurrentUser));
        }
        /// <summary>
        /// 退出登录
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> Logout(SysUserParam param)
        {
            //吊销token：将redis LoginTokenSysUser中相关的数据删除，注意多设备登录
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
            try
            {
                //包含扩展信息
                var sysUser = (await DiyToken.GetCurrentToken(false))?.CurrentUser;
                return Json(new DosResult(1, sysUser));
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, ex.Message));
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
                    var sysUser = await DiyToken.GetCurrentToken();
                    if (sysUser != null)
                    { 
                        userId = sysUser.CurrentUser["Id"].Val<string>();
                        osClient = sysUser.OsClient;
                    }
                   
                }
                catch (Exception ex)
                {
                    
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
            if(param._PageIndex == null)
            {
                param._PageIndex = 1;
            }
            if(param._PageSize == null)
            {
                param._PageSize = 15;
            }
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
        // [HttpPost, HttpGet]
        // public async Task<JsonResult> GetSysUserModel(SysUserParam param)
        // {
        //     await DefaultParam(param);

        //     param.IsDeleted = 0;
        //     var result = await _sysUserLogic.GetSysUserModel(param);
        //     return Json(result);
        // }
        /// <summary>
        /// 获取用户密码，必传Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetSysUserPassword(SysUserParam param)
        {
            if (param.Id.DosIsNullOrWhiteSpace() && param.Account.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(1004, null, DiyMessage.GetLang(param.OsClient, "ParamError", param._Lang)));
            }
            #region 取当前登录会员信息
            var currentToken = await DiyToken.GetCurrentToken();
            #endregion

            if (currentToken?.CurrentUser["Level"].Val<int>() >= DiyCommon.MaxRoleLevel)
            {
                // param.OsClient = currentToken.OsClient;
                // param._CurrentSysUser = currentToken.CurrentUser;
                // param.IsDeleted = 0;
                // var sysUserModelResult = await _sysUserLogic.GetSysUserModel(param);
                var _Where = new List<List<object>>();
                if (!param.Id.DosIsNullOrWhiteSpace())
                {
                    _Where.Add(new List<object> { "Id", "=", param.Id });
                }
                else
                {
                    _Where.Add(new List<object> { "Account", "=", param.Account });
                }
                var sysUserModelResult = await MicroiEngine.FormEngine.GetFormDataAsync("sys_user", new
                {
                    _Where = _Where,
                    OsClient = currentToken.OsClient
                });
                if (sysUserModelResult.Data != null)
                {
                    if (currentToken.CurrentUser["Level"].Val<int>() <= sysUserModelResult.Data.Level
                        && currentToken.CurrentUser["Account"].Val<string>()?.ToLower() != sysUserModelResult.Data.Account.ToLower()
                        && currentToken.CurrentUser["Account"].Val<string>()?.ToLower() != "admin")
                    {
                        return Json(new DosResult(0, null, "只能查看等级比自己低的角色！"));
                    }
                    //解密密码
                    var pwd = EncryptHelper.DESDecode(sysUserModelResult.Data.Pwd);
                    return Json(new DosResult(1, pwd));
                }
                return Json(sysUserModelResult);
            }
            return Json(new DosResult(0, null, DiyMessage.GetLang(param.OsClient, "NoAuth", param._Lang)));
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
                    var diySsoResult = await MicroiEngine.FormEngine.GetFormDataAsync<DiySso>(new
                    {
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
                var getResultString = await MicroiEngine.Http.Get(httpParam);
                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "SSO登录日志",
                    Title = "尝试登录系统",
                    Content = getResultString,
                    Param = token,
                    IP = IPHelper.GetClientIP(HttpContext).Data,
                    OsClient = param.OsClient
                });
                var resultModel = JsonHelper.Deserialize<SsoPengruiModel>(getResultString);
                if (resultModel != null && !resultModel.username.DosIsNullOrWhiteSpace())
                {
                    //判断是否存在用户，存在则直接登陆，不存在则创建，再登陆
                    // var userModel = (await _sysUserLogic.GetSysUserModel(new SysUserParam()
                    // {
                    //     Account = resultModel.username,
                    //     OsClient = param.OsClient
                    // })).Data;
                    var userModel = await MicroiEngine.FormEngine.GetFormDataAsync("sys_user", new
                    {
                        _Where = new List<List<object>>()
                        {
                            new List<object> { "Account", "=", resultModel.username },
                        },
                        OsClient = param.OsClient
                    });
                    if (userModel == null)
                    {
                        //创建用户
                        var addUSerresult = await _sysUserLogic.AddSysUser(new SysUserParam()
                        {
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
                    var result = await _sysUserLogic.LoginByAccount(new SysUserParam()
                    {
                        Account = resultModel.username,
                        OsClient = param.OsClient,
                    });
                    var newResult = new DosResult<JObject>();
                    if (result.Code == 1)
                    {
                        var sysUser = JObject.FromObject(result.Data);

                        #region 获取该用户access_token。--2019-07-17 若获取失败则登录失败。
                        var getTokenResult = await new DiyToken().GetAccessToken(new DiyTokenParam()
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
                        sysUser["Pwd"] = "";
                        newResult.Code = 1;
                        newResult.Data = sysUser;
                        newResult.DataAppend = new
                        {
                            SysMenuHomePage = (await new SysMenuLogic().GetSysMenuHomePage(new SysMenuParam() { OsClient = param.OsClient })).Data
                        };
                        return Json(newResult);
                    }

                    return Json(result);
                }
                return Json(new DosResult(0, null, getResultString));
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, ex.Message));
            }
        }

    }
}

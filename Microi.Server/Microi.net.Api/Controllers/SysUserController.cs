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

        private Microsoft.Extensions.Configuration.IConfiguration GetConfiguration()
        {
            return HttpContext.RequestServices.GetService(typeof(Microsoft.Extensions.Configuration.IConfiguration))
                as Microsoft.Extensions.Configuration.IConfiguration;
        }

        private Microsoft.AspNetCore.Hosting.IWebHostEnvironment GetHostEnvironment()
        {
            return HttpContext.RequestServices.GetService(typeof(Microsoft.AspNetCore.Hosting.IWebHostEnvironment))
                as Microsoft.AspNetCore.Hosting.IWebHostEnvironment;
        }

        private bool IsDevTestKeyMatched()
        {
            var devKey = Environment.GetEnvironmentVariable("MICROI_DEV_TEST_KEY");
            return !string.IsNullOrWhiteSpace(devKey)
                && string.Equals(HttpContext.Request.Headers["X-Microi-Dev-Key"].ToString(), devKey, StringComparison.Ordinal);
        }

        private bool IsLoopbackRequest()
        {
            var remoteIp = HttpContext.Connection.RemoteIpAddress;
            return remoteIp != null && System.Net.IPAddress.IsLoopback(remoteIp);
        }

        private bool IsLocalDevelopmentLoginBypassAllowed()
        {
            var cfg = GetConfiguration();
            if (cfg == null || !cfg.GetValue<bool>("DevLoginBypass:Enabled"))
            {
                return false;
            }

            var env = GetHostEnvironment();
            if (env == null || !env.IsDevelopment())
            {
                return false;
            }

            // 配置驱动旁路只允许本机回环，避免生产反代、容器网关、内网IP误判后开放默认账号密码。
            return IsLoopbackRequest();
        }

        private bool IsDevLoginBypassEnabled(string configKey, bool defaultValue = false)
        {
            if (!IsLocalDevelopmentLoginBypassAllowed())
            {
                return false;
            }

            var cfg = GetConfiguration();
            return cfg.GetValue<bool>(configKey, defaultValue);
        }

        private static bool IsAutomationCaptchaBypassRequested(SysUserParam param)
        {
            return param != null && (param._AutomationTestLogin || param._SkipCaptchaForAutomation);
        }

        private static bool IsAutomationCaptchaBypassAllowed(dynamic sysConfig)
        {
            var shortFieldValue = DynamicHelper.GetDynamicBoolValue(sysConfig, "AutoTestSkipCaptcha", true);
            return DynamicHelper.GetDynamicBoolValue(sysConfig, "AllowAutomationLoginSkipCaptcha", shortFieldValue);
        }

        public class CreateTenantRequest
        {
            public string TenantKey { get; set; }
            public string SystemName { get; set; }
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
            if (param == null)
            {
                return new JsonResult(new DosResult(0, null, "登录参数不能为空！"));
            }
            // 历史兼容字段不再允许跳过密码校验，避免外部请求通过模型绑定伪造。
            param._DevBypassPwd = false;

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
                // ===== 自动化测试旁路：只跳过验证码，账号密码永远走真实校验 =====
                // 远端自动化：请求传 _AutomationTestLogin=true，且 sys_config.AutoTestSkipCaptcha=true。
                // 本地/CI 兼容：MICROI_DEV_TEST_KEY + X-Microi-Dev-Key 仅用于跳验证码，不再跳过密码。
                if ((IsAutomationCaptchaBypassRequested(param) && IsAutomationCaptchaBypassAllowed(sysConfigResult.Data))
                    || IsDevTestKeyMatched())
                {
                    enableCaptcha = false;
                }
                // ===== 本地开发旁路（配置驱动）=====
                // 仅本机 Development 环境允许配置驱动的开发登录旁路。
                // 即使误把 DevLoginBypass.Enabled=true 发布到生产，非 Development 环境也不会生效。
                if (IsLocalDevelopmentLoginBypassAllowed())
                {
                    var cfg = GetConfiguration();
                    if (cfg != null)
                    {
                        if (cfg.GetValue<bool>("DevLoginBypass:SkipCaptcha", true))
                        {
                            enableCaptcha = false;
                        }
                        var defaultAccount = cfg.GetValue<string>("DevLoginBypass:DefaultAccount");
                        var defaultPassword = cfg.GetValue<string>("DevLoginBypass:DefaultPassword");
                        var accounts = cfg.GetSection("DevLoginBypass:Accounts").GetChildren();
                        foreach (var accountCfg in accounts)
                        {
                            var osClient = accountCfg.GetValue<string>("OsClient");
                            if (!osClient.DosIsNullOrWhiteSpace()
                                && string.Equals(osClient, param.OsClient, StringComparison.OrdinalIgnoreCase))
                            {
                                defaultAccount = accountCfg.GetValue<string>("Account") ?? defaultAccount;
                                defaultPassword = accountCfg.GetValue<string>("Password")
                                    ?? accountCfg.GetValue<string>("Pwd")
                                    ?? defaultPassword;
                                break;
                            }
                        }
                        // 自动填充缺省账号密码（仅当请求未带）；_DEV_BYPASS_ 会替换为配置密码，但仍走真实密码校验。
                        if (param.Account.DosIsNullOrWhiteSpace())
                        {
                            param.Account = defaultAccount;
                        }
                        if (param.Pwd.DosIsNullOrWhiteSpace()
                            || string.Equals(param.Pwd, "_DEV_BYPASS_", StringComparison.Ordinal))
                        {
                            param.Pwd = defaultPassword;
                        }
                    }
                }
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
                //异步更新用户登录Id、最后登录时间
                _= MicroiEngine.FormEngine.UptFormDataAsync("sys_user", new
                {
                    Id = sysUser["Id"].Val<string>(),
                    LastLoginIP = param.LastLoginIP,
                    LastLoginTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    OsClient = param.OsClient
                });
            }
            return Json(result);
        }

        /// <summary>
        /// 短信验证码登录（自动注册）。
        /// 必传：Phone、_CaptchaValue（短信验证码）、OsClient
        /// 流程：验证短信验证码 → 查询/创建用户 → 自动开通SaaS租户 → 返回Token
        /// </summary>
        [HttpPost]
        [AllowAnonymous]
        public async Task<JsonResult> SmsLogin([FromBody] SysUserParam param)
        {
            try
            {
                param = await EnsureSmsLoginParam(param);
                #region 参数校验
                if (param.OsClient.DosIsNullOrWhiteSpace())
                {
                    return Json(new DosResult(1003, null, "OsClient不能为空！"));
                }
                if (param.Phone.DosIsNullOrWhiteSpace() || param.Phone.Trim().Length != 11)
                {
                    return Json(new DosResult(0, null, "请输入正确的11位手机号！"));
                }
                var skipSmsCaptcha = IsDevLoginBypassEnabled("DevLoginBypass:SkipSmsCaptcha");
                if (!skipSmsCaptcha && param._CaptchaValue.DosIsNullOrWhiteSpace())
                {
                    return Json(new DosResult(0, null, "请输入短信验证码！"));
                }
                var phone = param.Phone.Trim();
                #endregion

                #region 验证短信验证码（从Redis缓存中获取）
                var cacheKey = $"Microi:{param.OsClient}:SmsCaptcha:{phone}";
                var DiyCacheBase = MicroiEngine.CacheTenant.Cache(param.OsClient);
                if (!skipSmsCaptcha)
                {
                    var cachedCode = await DiyCacheBase.GetAsync<string>(cacheKey);

                    if (cachedCode.DosIsNullOrWhiteSpace())
                    {
                        return Json(new DosResult(0, null, "未获取短信验证码或验证码已过期！"));
                    }
                    if (cachedCode != "Allow" && cachedCode != param._CaptchaValue)
                    {
                        return Json(new DosResult(0, null, "短信验证码错误！"));
                    }
                }
                #endregion

                #region 查询用户是否已存在
                var userResult = await MicroiEngine.FormEngine.GetFormDataAsync("sys_user", new
                {
                    _Where = new System.Collections.Generic.List<System.Collections.Generic.List<object>>()
                    {
                        new System.Collections.Generic.List<object> { "Phone", "=", phone }
                    },
                    OsClient = param.OsClient
                });
                #endregion

                bool isNewUser = false;
                string userId = null;
                string loginAccount = phone;

                if (userResult.Code == 2 || (userResult.Code == 1 && userResult.Data == null))
                {
                    #region 用户不存在，自动注册
                    isNewUser = true;
                    var registerPwd = param.Pwd.DosIsNullOrWhiteSpace()
                        ? phone.Substring(phone.Length - 6)
                        : param.Pwd.Trim();
                    if (!param.Pwd.DosIsNullOrWhiteSpace())
                    {
                        if (registerPwd.Length < 6)
                        {
                            return Json(new DosResult(0, null, "密码长度不能少于6位！"));
                        }
                        var checkPwdResult = await _sysUserLogic.CheckPwd(registerPwd, param._Lang);
                        if (!checkPwdResult.DosIsNullOrWhiteSpace())
                        {
                            return Json(new DosResult(0, null, checkPwdResult));
                        }
                    }
                    var encryptedPwd = EncryptHelper.DESEncode(registerPwd);

                    var addResult = await MicroiEngine.FormEngine.AddFormDataAsync("sys_user", new
                    {
                        Account = phone,
                        Phone = phone,
                        Pwd = encryptedPwd,
                        Name = phone,
                        Level = 1,
                        State = 1,
                        IsDeleted = 0,
                        RoleIds = "[]",
                        OsClient = param.OsClient
                    });

                    if (addResult.Code != 1)
                    {
                        return Json(new DosResult(0, null, $"注册失败：{addResult.Msg}"));
                    }

                    userId = DynamicHelper.GetDynamicStringValue(addResult.Data, "Id", "");
                    if (userId.DosIsNullOrWhiteSpace())
                    {
                        userId = addResult.Data?.ToString();
                    }
                    loginAccount = phone;
                    #endregion
                }
                else if (userResult.Code == 1)
                {
                    #region 用户已存在，验证状态
                    var state = DynamicHelper.GetDynamicIntValue(userResult.Data, "State", 0);
                    userId = DynamicHelper.GetDynamicStringValue(userResult.Data, "Id", "");
                    if (userId.DosIsNullOrWhiteSpace())
                    {
                        return Json(new DosResult(0, null, "账号数据异常：Id为空！"));
                    }
                    var existingAccount = DynamicHelper.GetDynamicStringValue(userResult.Data, "Account", "");
                    var existingName = DynamicHelper.GetDynamicStringValue(userResult.Data, "Name", "");
                    var accountToSave = string.IsNullOrWhiteSpace(existingAccount) ? phone : existingAccount;
                    if (state != 1 || string.IsNullOrWhiteSpace(existingAccount) || string.IsNullOrWhiteSpace(existingName))
                    {
                        var restoreResult = await MicroiEngine.FormEngine.UptFormDataAsync("sys_user", new
                        {
                            Id = userId,
                            Account = accountToSave,
                            Phone = phone,
                            Name = string.IsNullOrWhiteSpace(existingName) ? phone : existingName,
                            State = 1,
                            IsDeleted = 0,
                            OsClient = param.OsClient
                        });
                        if (restoreResult.Code != 1)
                        {
                            return Json(new DosResult(0, null, $"恢复账号失败：{restoreResult.Msg}"));
                        }
                    }
                    if (!param.Pwd.DosIsNullOrWhiteSpace())
                    {
                        var resetPwd = param.Pwd.Trim();
                        if (resetPwd.Length < 6)
                        {
                            return Json(new DosResult(0, null, "密码长度不能少于6位！"));
                        }
                        var checkPwdResult = await _sysUserLogic.CheckPwd(resetPwd, param._Lang);
                        if (!checkPwdResult.DosIsNullOrWhiteSpace())
                        {
                            return Json(new DosResult(0, null, checkPwdResult));
                        }
                        var resetPwdResult = await MicroiEngine.FormEngine.UptFormDataAsync("sys_user", new
                        {
                            Id = userId,
                            Pwd = EncryptHelper.DESEncode(resetPwd),
                            OsClient = param.OsClient
                        });
                        if (resetPwdResult.Code != 1)
                        {
                            return Json(new DosResult(0, null, $"更新登录密码失败：{resetPwdResult.Msg}"));
                        }
                    }
                    if (string.IsNullOrWhiteSpace(existingAccount))
                    {
                        loginAccount = phone;
                    }
                    else
                    {
                        loginAccount = existingAccount;
                    }
                    #endregion
                }
                else
                {
                    return Json(new DosResult(0, null, $"查询用户失败：{userResult.Msg}"));
                }

                #region 销毁验证码缓存
                if (!skipSmsCaptcha)
                {
                    try { await DiyCacheBase.RemoveAsync(cacheKey); } catch { }
                }
                #endregion

                #region 获取完整用户信息用于登录
                var loginResult = await _sysUserLogic.LoginByAccount(new SysUserParam()
                {
                    Account = loginAccount,
                    OsClient = param.OsClient,
                });
                if (loginResult.Code != 1 && isNewUser)
                {
                    for (var retryIndex = 0; retryIndex < 3 && loginResult.Code != 1; retryIndex++)
                    {
                        await Task.Delay(300);
                        loginResult = await _sysUserLogic.LoginByAccount(new SysUserParam()
                        {
                            Account = loginAccount,
                            OsClient = param.OsClient,
                        });
                    }
                }

                if (loginResult.Code != 1)
                {
                    return Json(new DosResult(0, null, $"登录失败：{loginResult.Msg}"));
                }

                JObject sysUser = JObject.FromObject(loginResult.Data);

                // 获取Token
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

                var accessToken = getTokenResult.Data?.Token ?? "";
                sysUser["Authorization"] = accessToken;
                sysUser["Pwd"] = "";
                #endregion

                var tenantResult = new TenantProvisioningService().GetUserTenant(userId);
                dynamic tenantData = tenantResult.Code == 1 ? tenantResult.Data : null;

                #region 获取系统配置
                var sysConfigResult = await MicroiEngine.FormEngine.GetSysConfig(param.OsClient, param._Lang);
                dynamic sysConfig = sysConfigResult.Code == 1 ? sysConfigResult.Data : null;

                dynamic SysMenuHomePage = null;
                try
                {
                    SysMenuHomePage = (await new SysMenuLogic().GetSysMenuHomePage(new SysMenuParam() { OsClient = param.OsClient })).Data;
                }
                catch { }
                #endregion

                // 异步更新最后登录时间
                _ = MicroiEngine.FormEngine.UptFormDataAsync("sys_user", new
                {
                    Id = sysUser["Id"].Val<string>(),
                    LastLoginIP = IPHelper.GetClientIP(HttpContext).Data,
                    LastLoginTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    OsClient = param.OsClient
                });

                var smsLoginResult = new DosResult(1, sysUser, isNewUser ? "注册并登录成功" : "登录成功");
                smsLoginResult.DataAppend = new
                {
                    SysMenuHomePage = SysMenuHomePage,
                    SysConfig = sysConfig,
                    IsNewUser = isNewUser,
                    Token = accessToken,
                    TenantOsClient = tenantData == null ? null : DynamicHelper.GetDynamicStringValue(tenantData, "OsClient", ""),
                    TenantName = tenantData == null ? null : DynamicHelper.GetDynamicStringValue(tenantData, "ClientName", "")
                };

                MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                {
                    Type = "短信登录日志",
                    Title = $"{phone}{(isNewUser ? "注册并登录" : "登录")}了系统",
                    OsClient = param.OsClient
                });

                return Json(smsLoginResult);
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, $"登录异常：{ex.Message}"));
            }
        }

        private async Task<SysUserParam> EnsureSmsLoginParam(SysUserParam param)
        {
            param ??= new SysUserParam();
            if (Request?.HasFormContentType == true)
            {
                if (param.OsClient.DosIsNullOrWhiteSpace()) param.OsClient = Request.Form["OsClient"].ToString();
                if (param.Phone.DosIsNullOrWhiteSpace()) param.Phone = Request.Form["Phone"].ToString();
                if (param.Pwd.DosIsNullOrWhiteSpace()) param.Pwd = Request.Form["Pwd"].ToString();
                if (param._CaptchaValue.DosIsNullOrWhiteSpace()) param._CaptchaValue = Request.Form["_CaptchaValue"].ToString();
                if (param._CaptchaId.DosIsNullOrWhiteSpace()) param._CaptchaId = Request.Form["_CaptchaId"].ToString();
                if (param._Lang.DosIsNullOrWhiteSpace()) param._Lang = Request.Form["_Lang"].ToString();
                if (param._ClientType.DosIsNullOrWhiteSpace()) param._ClientType = Request.Form["_ClientType"].ToString();
            }
            if (Request?.Query != null)
            {
                if (param.OsClient.DosIsNullOrWhiteSpace()) param.OsClient = Request.Query["OsClient"].ToString();
                if (param.Phone.DosIsNullOrWhiteSpace()) param.Phone = Request.Query["Phone"].ToString();
                if (param.Pwd.DosIsNullOrWhiteSpace()) param.Pwd = Request.Query["Pwd"].ToString();
                if (param._CaptchaValue.DosIsNullOrWhiteSpace()) param._CaptchaValue = Request.Query["_CaptchaValue"].ToString();
                if (param._CaptchaId.DosIsNullOrWhiteSpace()) param._CaptchaId = Request.Query["_CaptchaId"].ToString();
                if (param._Lang.DosIsNullOrWhiteSpace()) param._Lang = Request.Query["_Lang"].ToString();
                if (param._ClientType.DosIsNullOrWhiteSpace()) param._ClientType = Request.Query["_ClientType"].ToString();
            }
            var contentType = Request?.ContentType ?? "";
            if (!contentType.Contains("application/json", StringComparison.OrdinalIgnoreCase))
            {
                return param;
            }

            try
            {
                Request.EnableBuffering();
                if (Request.Body.CanSeek)
                {
                    Request.Body.Position = 0;
                }
                using var reader = new StreamReader(Request.Body, Encoding.UTF8, false, 1024, true);
                var body = await reader.ReadToEndAsync();
                if (body.DosIsNullOrWhiteSpace())
                {
                    return param;
                }
                var json = JObject.Parse(body);
                if (param.OsClient.DosIsNullOrWhiteSpace()) param.OsClient = json["OsClient"].Val<string>();
                if (param.Phone.DosIsNullOrWhiteSpace()) param.Phone = json["Phone"].Val<string>();
                if (param.Pwd.DosIsNullOrWhiteSpace()) param.Pwd = json["Pwd"].Val<string>();
                if (param._CaptchaValue.DosIsNullOrWhiteSpace()) param._CaptchaValue = json["_CaptchaValue"].Val<string>();
                if (param._CaptchaId.DosIsNullOrWhiteSpace()) param._CaptchaId = json["_CaptchaId"].Val<string>();
                if (param._Lang.DosIsNullOrWhiteSpace()) param._Lang = json["_Lang"].Val<string>();
                if (param._ClientType.DosIsNullOrWhiteSpace()) param._ClientType = json["_ClientType"].Val<string>();
            }
            catch
            {
                // Fall back to the model-bound values so malformed JSON still returns the normal parameter errors.
            }
            return param;
        }

        /// <summary>
        /// 设置登录密码（手机号验证码登录的用户可设置密码）
        /// 必传：Pwd（新密码）、OsClient
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> SetPassword(SysUserParam param)
        {
            try
            {
                var currentToken = await DiyToken.GetCurrentToken();
                if (currentToken == null)
                {
                    return Json(new DosResult(1001, null, "请先登录！"));
                }

                if (param.Pwd.DosIsNullOrWhiteSpace())
                {
                    return Json(new DosResult(0, null, "新密码不能为空！"));
                }
                if (param.Pwd.Length < 6)
                {
                    return Json(new DosResult(0, null, "密码长度不能少于6位！"));
                }

                var userId = currentToken.CurrentUser["Id"]?.ToString();
                var osClient = currentToken.OsClient;
                var encryptedPwd = EncryptHelper.DESEncode(param.Pwd);

                var uptResult = await MicroiEngine.FormEngine.UptFormDataAsync("sys_user", new
                {
                    Id = userId,
                    Pwd = encryptedPwd,
                    OsClient = osClient
                });

                if (uptResult.Code == 1)
                {
                    return Json(new DosResult(1, null, "密码设置成功！"));
                }
                return Json(new DosResult(0, null, $"密码设置失败：{uptResult.Msg}"));
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, $"设置密码异常：{ex.Message}"));
            }
        }

        /// <summary>
        /// Create one SaaS tenant for the current website user.
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> CreateTenant(CreateTenantRequest param)
        {
            try
            {
                var currentToken = await DiyToken.GetCurrentToken();
                if (currentToken == null)
                {
                    return Json(new DosResult(1001, null, "请先登录！"));
                }

                var currentUser = currentToken.CurrentUser;
                var userId = currentUser?["Id"]?.ToString();
                if (userId.DosIsNullOrWhiteSpace())
                {
                    return Json(new DosResult(1002, null, "登录用户无效！"));
                }

                var phone = currentUser?["Phone"]?.ToString();
                var userName = currentUser?["Name"]?.ToString();
                string encryptedPwd = null;
                try
                {
                    var userResult = await MicroiEngine.FormEngine.GetFormDataAsync("sys_user", new
                    {
                        Id = userId,
                        OsClient = currentToken.OsClient
                    });
                    if (userResult.Code == 1 && userResult.Data != null)
                    {
                        var userObj = JObject.FromObject(userResult.Data);
                        encryptedPwd = userObj["Pwd"]?.ToString();
                        if (phone.DosIsNullOrWhiteSpace())
                        {
                            phone = userObj["Phone"]?.ToString();
                        }
                        if (userName.DosIsNullOrWhiteSpace())
                        {
                            userName = userObj["Name"]?.ToString();
                        }
                    }
                }
                catch { }

                if (encryptedPwd.DosIsNullOrWhiteSpace())
                {
                    var seed = !phone.DosIsNullOrWhiteSpace() && phone.Length >= 6
                        ? phone.Substring(phone.Length - 6)
                        : Guid.NewGuid().ToString("N").Substring(0, 8);
                    encryptedPwd = EncryptHelper.DESEncode(seed);
                }

                var service = new TenantProvisioningService();
                var result = await service.ProvisionTenantAsync(
                    param?.TenantKey,
                    param?.SystemName,
                    userId,
                    phone,
                    userName,
                    encryptedPwd);

                return Json(result);
            }
            catch (Exception ex)
            {
                return Json(new DosResult(0, null, $"创建租户异常：{ex.Message}"));
            }
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

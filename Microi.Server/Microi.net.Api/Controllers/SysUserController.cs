using Dos.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Lazy.Captcha.Core;
using System.Text;
using System.Security.Cryptography;
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

        private static string ReadTokenClaim(string authorization, string claimType)
        {
            try
            {
                var token = authorization.DosTrim().DosReplace("Bearer ", "");
                if (token.DosIsNullOrWhiteSpace())
                {
                    return "";
                }
                var jwtToken = new System.IdentityModel.Tokens.Jwt.JwtSecurityTokenHandler().ReadJwtToken(token);
                return jwtToken?.Claims?.FirstOrDefault(d => d.Type == claimType)?.Value ?? "";
            }
            catch
            {
                return "";
            }
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

        private static string HashAccessToken(string authorization)
        {
            var token = authorization.DosTrim().DosReplace("Bearer ", "");
            if (token.DosIsNullOrWhiteSpace())
            {
                return "";
            }
            return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
        }

        private static bool FixedTimeTokenHashEquals(string left, string right)
        {
            if (left.DosIsNullOrWhiteSpace() || right.DosIsNullOrWhiteSpace())
            {
                return false;
            }
            var leftBytes = Encoding.UTF8.GetBytes(left);
            var rightBytes = Encoding.UTF8.GetBytes(right);
            return leftBytes.Length == rightBytes.Length
                && CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes);
        }

        public class CreateTenantRequest
        {
            public string TenantKey { get; set; }
            public string SystemName { get; set; }
        }

        public class UpdateCurrentProfileRequest
        {
            public string Name { get; set; }
            public string Avatar { get; set; }
        }

        public class UpdateMyDefaultIndexUrlRequest
        {
            public string DefaultIndexUrl { get; set; }
        }

        private static bool TryNormalizeDefaultIndexUrl(
            string value,
            out string normalized,
            out string error)
        {
            normalized = (value ?? string.Empty).Trim();
            error = null;
            if (normalized.Length == 0)
            {
                return true;
            }
            if (normalized.Length > 500 || normalized.Any(char.IsControl))
            {
                error = "登录后首页路由长度不能超过500个字符。";
                return false;
            }
            if (normalized.StartsWith("/#/", StringComparison.Ordinal))
            {
                normalized = normalized.Substring(2);
            }
            else if (normalized.StartsWith("#/", StringComparison.Ordinal))
            {
                normalized = normalized.Substring(1);
            }
            if (!normalized.StartsWith("/", StringComparison.Ordinal))
            {
                normalized = "/" + normalized;
            }
            var routePath = normalized.Split('?', '#')[0];
            if (normalized.StartsWith("//", StringComparison.Ordinal)
                || normalized.Contains("\\", StringComparison.Ordinal)
                || normalized.Contains("://", StringComparison.OrdinalIgnoreCase)
                || routePath.Contains(":", StringComparison.Ordinal)
                || routePath.Equals("/login", StringComparison.OrdinalIgnoreCase)
                || routePath.StartsWith("/login/", StringComparison.OrdinalIgnoreCase)
                || routePath.Equals("/access-login", StringComparison.OrdinalIgnoreCase)
                || routePath.StartsWith("/access-login/", StringComparison.OrdinalIgnoreCase))
            {
                error = "登录后首页只能使用当前系统内的业务路由。";
                return false;
            }
            return true;
        }

        private static async Task DefaultParam(SysUserParam param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            param._CurrentUser = currentTokenDynamic?.CurrentUser;
            param.OsClient = currentTokenDynamic?.OsClient;
        }

        private static bool IsPlatformAdmin(JObject currentUser)
        {
            return currentUser?["_IsAdmin"]?.Val<bool>() == true
                || currentUser?["Level"]?.Val<int>() >= DiyCommon.MaxRoleLevel;
        }

        /// <summary>
        /// Self-service profile updates must never reuse the administrator DTO
        /// unchecked.  SysUserParam also contains roles, departments, account
        /// state and server-side encoded-password fields; accepting those from a
        /// normal user would be a direct privilege-escalation path.
        /// </summary>
        private static void RestrictSelfServiceUpdate(SysUserParam param, string currentUserId)
        {
            param.Id = currentUserId;
            param.Account = null;
            param.OldAccount = null;
            param.Level = null;
            // Phone is an authentication factor for SmsLogin and therefore
            // cannot be changed through the generic profile endpoint.
            param.Phone = null;
            param.RoleIds = null;
            param._RoleIds = null;
            param.RoleId = null;
            param.DeptId = null;
            param.DeptIds = null;
            param.DeptName = null;
            param.GroupId = null;
            param.GroupIds = null;
            param.PostId = null;
            param.PostIds = null;
            param.State = null;
            param.IsDeleted = null;
            param.LastLoginIP = null;
            param.PwdErrorCount = null;
            param._EncodePwd = null;
            param._EncodeNewPwd = null;
            param._DevBypassPwd = false;
            param.Token = null;
            param._token = null;
            param.TokenName = null;
            param._LevelLimit = null;
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
                // 自动化测试只能由当前租户 sys_config 显式授权，并且仅跳过图形验证码；
                // 账号和密码仍走真实校验。API 进程不接受环境变量、Header 或本地配置旁路。
                if (IsAutomationCaptchaBypassRequested(param)
                    && IsAutomationCaptchaBypassAllowed(sysConfigResult.Data))
                {
                    enableCaptcha = false;
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
                // Login responses are public client configuration surfaces.
                // Work on a detached allow-listed projection so credentials,
                // executable server code and the cached raw model are never
                // returned or mutated for tenant-specific branding.
                sysConfig = sysConfigResult.Code == 1
                    ? TenantConfigurationSecurity.CreatePublicSysConfigProjection(sysConfigResult.Data)
                    : null;
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
                        sysConfig.SysShortTitle = sysConfigTenantResult.Data.SysShortTitle;
                        sysConfig.SysLogo = sysConfigTenantResult.Data.SysLogo;
                        sysConfig.SysLogoHeight = sysConfigTenantResult.Data.SysLogoHeight;
                    }
                }
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
            if (result.Code != 1)
            {
                QueueLoginFailed(param, result.Msg);
            }
            return Json(result);
        }

        private void QueueLoginFailed(SysUserParam param, string reason)
        {
            if (param?.OsClient.DosIsNullOrWhiteSpace() != false) return;
            var account = (param.Account ?? "").Trim();
            if (account.Length > 128) account = account.Substring(0, 128);
            var actor = account.DosIsNullOrWhiteSpace() ? "匿名" : $"匿名({account})";
            MicroiEngine.QueueSysLog(new SysLogParam
            {
                OsClient = param.OsClient,
                UserName = actor,
                Category = "Security",
                Action = "LoginFailed",
                Source = "ServerEndpoint",
                ClientType = param._ClientType,
                TargetType = "Session",
                TargetId = UserBehaviorAudit.HashIdentifier(account),
                Type = "登录失败",
                Title = $"用户[{actor}]登录失败",
                Content = Newtonsoft.Json.JsonConvert.SerializeObject(new
                {
                    Account = account,
                    IP = param.LastLoginIP,
                    ClientType = param._ClientType,
                    Reason = reason
                }),
                IP = param.LastLoginIP,
                Success = false,
                OccurredAt = DateTime.Now,
                Level = 2
            });
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
                if (param._CaptchaValue.DosIsNullOrWhiteSpace())
                {
                    return Json(new DosResult(0, null, "请输入短信验证码！"));
                }
                var phone = param.Phone.Trim();
                #endregion

                #region 验证短信验证码（从Redis缓存中获取）
                var cacheKey = $"Microi:{param.OsClient}:SmsCaptcha:{phone}";
                var DiyCacheBase = MicroiEngine.CacheTenant.Cache(param.OsClient);
                var cachedCode = await DiyCacheBase.GetAsync<string>(cacheKey);

                if (cachedCode.DosIsNullOrWhiteSpace())
                {
                    return Json(new DosResult(0, null, "未获取短信验证码或验证码已过期！"));
                }
                if (cachedCode != "Allow" && cachedCode != param._CaptchaValue)
                {
                    return Json(new DosResult(0, null, "短信验证码错误！"));
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
                    // A phone number is public data and must never be used as a
                    // predictable default password.  Passwordless SMS users get
                    // a random server-side password and a short-lived grant to
                    // choose their own password after login.
                    var registerPwd = param.Pwd.DosIsNullOrWhiteSpace()
                        ? Convert.ToHexString(RandomNumberGenerator.GetBytes(32))
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
                    var isDeleted = DynamicHelper.GetDynamicIntValue(userResult.Data, "IsDeleted", 0);
                    userId = DynamicHelper.GetDynamicStringValue(userResult.Data, "Id", "");
                    if (userId.DosIsNullOrWhiteSpace())
                    {
                        return Json(new DosResult(0, null, "账号数据异常：Id为空！"));
                    }
                    var existingAccount = DynamicHelper.GetDynamicStringValue(userResult.Data, "Account", "");
                    var existingName = DynamicHelper.GetDynamicStringValue(userResult.Data, "Name", "");
                    var accountToSave = string.IsNullOrWhiteSpace(existingAccount) ? phone : existingAccount;
                    if (isDeleted == 1 || state != 1)
                    {
                        return Json(new DosResult(0, null, "帐号已停用，请联系管理员。"));
                    }
                    if (string.IsNullOrWhiteSpace(existingAccount) || string.IsNullOrWhiteSpace(existingName))
                    {
                        var restoreResult = await MicroiEngine.FormEngine.UptFormDataAsync("sys_user", new
                        {
                            Id = userId,
                            Account = accountToSave,
                            Phone = phone,
                            Name = string.IsNullOrWhiteSpace(existingName) ? phone : existingName,
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
                try { await DiyCacheBase.RemoveAsync(cacheKey); } catch { }
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
                    QueueLoginFailed(param, getTokenResult.Msg ?? "登录令牌生成失败");
                    return Json(getTokenResult);
                }

                var accessToken = getTokenResult.Data?.Token ?? "";
                sysUser["Authorization"] = accessToken;
                sysUser["Pwd"] = "";
                if (param.Pwd.DosIsNullOrWhiteSpace())
                {
                    var passwordGrantKey = $"Microi:{param.OsClient}:SmsPasswordGrant:{userId}";
                    await DiyCacheBase.SetAsync(
                        passwordGrantKey,
                        HashAccessToken(accessToken),
                        TimeSpan.FromMinutes(10));
                }
                #endregion

                var tenantResult = new TenantProvisioningService().GetUserTenant(userId);
                dynamic tenantData = tenantResult.Code == 1 ? tenantResult.Data : null;

                #region 获取系统配置
                var sysConfigResult = await MicroiEngine.FormEngine.GetSysConfig(param.OsClient, param._Lang);
                dynamic sysConfig = sysConfigResult.Code == 1
                    ? TenantConfigurationSecurity.CreatePublicSysConfigProjection(sysConfigResult.Data)
                    : null;

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
            catch
            {
                return Json(new DosResult(0, null, "登录失败，请稍后重试。"));
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
                var currentToken = await DiyToken.GetCurrentToken(false);
                if (currentToken?.CurrentUser == null)
                {
                    return Json(new DosResult(1001, null, "请先登录！"));
                }

                if (param == null || param.Pwd.DosIsNullOrWhiteSpace())
                {
                    return Json(new DosResult(0, null, "新密码不能为空！"));
                }
                var checkPwdResult = await _sysUserLogic.CheckPwd(param.Pwd, param._Lang);
                if (!checkPwdResult.DosIsNullOrWhiteSpace())
                {
                    return Json(new DosResult(0, null, checkPwdResult));
                }

                var userId = currentToken.CurrentUser["Id"]?.ToString();
                var osClient = currentToken.OsClient;
                var requestToken = Request.Headers["Authorization"].ToString();
                if (requestToken.DosIsNullOrWhiteSpace())
                {
                    requestToken = currentToken.Token;
                }

                var passwordGrantKey = $"Microi:{osClient}:SmsPasswordGrant:{userId}";
                var tenantCache = MicroiEngine.CacheTenant.Cache(osClient);
                var expectedTokenHash = await tenantCache.GetAsync<string>(passwordGrantKey);
                if (!FixedTimeTokenHashEquals(expectedTokenHash, HashAccessToken(requestToken)))
                {
                    Response.StatusCode = 403;
                    return Json(new DosResult(0, null, "设置密码授权已失效，请重新通过短信验证码登录。"));
                }

                var encryptedPwd = EncryptHelper.DESEncode(param.Pwd);

                var uptResult = await MicroiEngine.FormEngine.UptFormDataAsync("sys_user", new
                {
                    Id = userId,
                    Pwd = encryptedPwd,
                    OsClient = osClient
                });

                if (uptResult.Code == 1)
                {
                    await tenantCache.RemoveAsync(passwordGrantKey);
                    return Json(new DosResult(1, null, "密码设置成功！"));
                }
                return Json(new DosResult(0, null, $"密码设置失败：{uptResult.Msg}"));
            }
            catch
            {
                return Json(new DosResult(0, null, "设置密码失败，请稍后重试。"));
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
                if (!string.Equals(currentToken.OsClient, OsClientDefault.OsClient,
                        StringComparison.OrdinalIgnoreCase))
                {
                    return Json(new DosResult(1002, null, "仅主租户允许创建SaaS租户。"));
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
                    var seed = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
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
                var diagnostic = await DiyToken.DiagnoseInactiveTokenDetail(param.authorization, param.OsClient);
                return Json(new DosResult(
                    1001,
                    null,
                    diagnostic?.UserMessage ?? "当前Token无效，请重新登录。",
                    0,
                    diagnostic));
            }

            var tokenClientType = ReadTokenClaim(param.authorization, "ClientType");
            var requestedClientType = param._ClientType;
            var clientTypeNeedsMigration = (tokenClientType.DosIsNullOrWhiteSpace()
                    || tokenClientType.Equals("Empty", StringComparison.OrdinalIgnoreCase))
                && !requestedClientType.DosIsNullOrWhiteSpace()
                && !requestedClientType.Equals("Empty", StringComparison.OrdinalIgnoreCase);
            var clientType = clientTypeNeedsMigration ? requestedClientType : tokenClientType;
            clientType = clientType.DosIsNullOrWhiteSpace("Empty");

            var tokenDid = ReadTokenClaim(param.authorization, "Did");
            var requestDid = HttpContext.Request.Headers["did"].ToString();
            var didNeedsMigration = !requestDid.DosIsNullOrWhiteSpace()
                && !requestDid.Equals("Empty", StringComparison.OrdinalIgnoreCase)
                && !string.Equals(tokenDid, requestDid, StringComparison.OrdinalIgnoreCase);
            var activeTokenEntry = DiyToken.GetActiveCachedTokenEntry(tokenModelJobj, param.authorization);
            var activeTokenUpdateTime = activeTokenEntry?.UpdateTime == default
                ? tokenModelJobj.UpdateTime
                : activeTokenEntry.UpdateTime;
            var clientModel = OsClient.GetClient(tokenModelJobj.OsClient);
            var shouldRotateToken = clientTypeNeedsMigration
                || didNeedsMigration
                || DiyToken.ShouldRotateClientToken(
                    param.authorization,
                    clientModel,
                    clientType,
                    activeTokenUpdateTime);

            if (shouldRotateToken)
            {
                var previousToken = param.authorization.DosTrim().DosReplace("Bearer ", "");
                var getTokenResult = await new DiyToken().GetAccessToken(new DiyTokenParam()
                {
                    CurrentUser = tokenModelJobj.CurrentUser,
                    OsClient = tokenModelJobj.OsClient,
                    _ClientType = clientType,
                    Did = didNeedsMigration ? requestDid : tokenDid,
                    RotateFromToken = previousToken
                });
                if (getTokenResult.Code != 1)
                {
                    return Json(getTokenResult);
                }

                tokenModelJobj = getTokenResult.Data;
                // GetAccessToken 已将旧 Token 标记为 Retired，并统一保留短暂轮换宽限期。
                // DID/ClientType 迁移也必须遵守该窗口，否则续签响应尚未写回浏览器时，
                // 同页详情初始化的其它并发请求会立刻收到 TokenReplaced。
            }
            else
            {
                HttpContext.Response.Headers["authorization"] = param.authorization
                    .DosTrim()
                    .DosReplace("Bearer ", "");
            }

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
            var currentToken = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
            var requestToken = Request.Headers["Authorization"].ToString();
            if (requestToken.DosIsNullOrWhiteSpace() && Request.HasFormContentType)
                requestToken = Request.Form["authorization"].ToString();
            var result = await OnlineTerminalService.LogoutCurrentTokenAsync(currentToken, requestToken).ConfigureAwait(false);
            return Json(result);
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
            catch
            {
                return Json(new DosResult(0, null, "获取当前用户失败，请重新登录。"));
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
            var currentToken = await DiyToken.GetCurrentToken(false);
            var currentUser = currentToken?.CurrentUser;
            if (currentUser == null)
            {
                Response.StatusCode = 401;
                return Json(new DosResult(1001, null, "登录身份已过期，请重新登录。"));
            }

            var currentUserId = currentUser["Id"].Val<string>();
            if (!IsPlatformAdmin(currentUser))
            {
                // Ordinary users may only refresh their own cached identity.
                userId = currentUserId;
            }
            else if (userId.DosIsNullOrWhiteSpace())
            {
                userId = currentUserId;
            }
            // Tenant identity is never accepted from request parameters.
            osClient = currentToken.OsClient;

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
            var currentToken = await DiyToken.GetCurrentToken(false);
            var currentUser = currentToken?.CurrentUser;
            if (currentUser == null)
            {
                Response.StatusCode = 401;
                return Json(new DosResult(1001, null, "登录身份已过期，请重新登录。"));
            }

            param ??= new SysUserParam();
            param._CurrentUser = currentUser;
            param.OsClient = currentToken.OsClient;

            if (!IsPlatformAdmin(currentUser))
            {
                var currentUserId = currentUser["Id"].Val<string>();
                if (currentUserId.DosIsNullOrWhiteSpace()
                    || (!param.Id.DosIsNullOrWhiteSpace()
                        && !string.Equals(param.Id, currentUserId, StringComparison.Ordinal)))
                {
                    Response.StatusCode = 403;
                    return Json(new DosResult(0, null, DiyMessage.GetLang(currentToken.OsClient, "NoAuth", param._Lang)));
                }
                RestrictSelfServiceUpdate(param, currentUserId);
            }

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
        [PlatformAdminOnly]
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
        [PlatformAdminOnly]
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
        [PlatformAdminOnly]
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
            if(param._PageSize == null || param._PageSize < 1)
            {
                param._PageSize = 15;
            }
            else if (param._PageSize > 100)
            {
                param._PageSize = 100;
            }
            if (param.Ids != null && param.Ids.Count > 100)
            {
                param.Ids = param.Ids.Take(100).ToList();
            }
            var result = await _sysUserLogic.GetSysUser(param);
            if (result.Code == 1)
            {
                var newResult = new DosResult(1);
                // Public directory data must not expose phone numbers or other
                // account-management fields to every authenticated user.
                newResult.Data = result.Data.Select(d => new { d.Id, d.Name, d.Avatar }).ToList();
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
        [PlatformAdminOnly]
        public async Task<JsonResult> GetSysUserPassword(SysUserParam param)
        {
            param ??= new SysUserParam();
            await DefaultParam(param);
            if (param.Id.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(0, null, "用户Id不能为空。"));
            }

            var currentToken = await DiyToken.GetCurrentToken(false);
            if (currentToken?.CurrentUser == null
                || UserAccessKeySecurity.IsSession(currentToken.CurrentUser))
            {
                Response.StatusCode = 403;
                return Json(new DosResult(0, null, "访问密钥会话不能读取系统用户密码。"));
            }

            var client = OsClientExtend.GetClient(param.OsClient);
            if (client?.Db == null)
            {
                return Json(new DosResult(0, null, "租户数据库连接不存在。"));
            }

            var targetUser = client.Db.From<SysUser>()
                .Select(new SysUser().GetFields())
                .Where(d => d.Id == param.Id && d.IsDeleted != 1)
                .First<dynamic>();
            if (targetUser == null)
            {
                return Json(new DosResult(0, null, "系统用户不存在。"));
            }

            // Dynamic database values can expose NULL as DBNull. Convert through
            // JObject so legacy rows with an empty PwdEncode still follow DES.
            JObject targetUserObject = JObject.FromObject((object)targetUser);
            var decodeResult = SysUserLogic.DecodeStoredPassword(
                targetUserObject["Pwd"]?.ToString(),
                targetUserObject["PwdEncode"]?.Type == JTokenType.Null
                    ? ""
                    : targetUserObject["PwdEncode"]?.ToString());
            if (decodeResult.Code != 1)
            {
                return Json(decodeResult);
            }

            Response.Headers.CacheControl = "no-store, no-cache, max-age=0";
            Response.Headers.Pragma = "no-cache";
            Response.Headers["Referrer-Policy"] = "no-referrer";
            MicroiEngine.QueueSysLog(new SysLogParam
            {
                OsClient = param.OsClient,
                UserId = currentToken.CurrentUser["Id"]?.ToString(),
                UserName = currentToken.CurrentUser["Name"]?.ToString(),
                Category = "Security",
                Action = "RevealSysUserPassword",
                Source = "ServerEndpoint",
                TargetType = "SysUser",
                TargetId = param.Id,
                Type = "安全审计",
                Title = "管理员查看系统用户密码",
                Content = JsonConvert.SerializeObject(new
                {
                    TargetUserId = param.Id,
                    TargetAccount = targetUserObject["Account"]?.ToString()
                }),
                IP = IPHelper.GetClientIP(HttpContext).Data ?? "",
                Success = true,
                OccurredAt = DateTime.Now,
                Level = 2
            });
            return Json(new DosResult(1, decodeResult.Data));
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
                if (param == null
                    || param.OsClient.DosIsNullOrWhiteSpace()
                    || param.TokenName.DosIsNullOrWhiteSpace())
                {
                    return Json(new DosResult(0, null, "OsClient和TokenName不能为空！"));
                }

                var token = param._token;
                if (token.DosIsNullOrWhiteSpace())
                {
                    token = param.Token;
                }
                if (token.DosIsNullOrWhiteSpace())
                {
                    return Json(new DosResult(0, null, "Token为空！"));
                }
                if (token.Length > 8192 || param.TokenName.Length > 100 || param.OsClient.Length > 100)
                {
                    return Json(new DosResult(0, null, "SSO参数长度超出限制！"));
                }

                // The enabled tenant-side SSO record is the only trusted source
                // of the upstream URL.  There is no hard-coded fallback and the
                // caller cannot submit an arbitrary URL.
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
                    return Json(new DosResult(0, null, "SSO配置不存在或未启用！"));
                }
                if (!Uri.TryCreate(diySsoResult.Data.ServerSsoApi, UriKind.Absolute, out var ssoUri)
                    || !string.Equals(ssoUri.Scheme, Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase)
                    || !string.IsNullOrEmpty(ssoUri.UserInfo))
                {
                    return Json(new DosResult(0, null, "SSO服务地址必须使用HTTPS且不能包含用户凭据！"));
                }

                var httpParam = new DiyHttpParam { Url = ssoUri.AbsoluteUri };
                httpParam.Headers = new { Authorization = "Bearer " + token };
                var getResultString = await MicroiEngine.Http.Get(httpParam);
                var resultModel = JsonHelper.Deserialize<SsoPengruiModel>(getResultString);
                if (resultModel != null && !resultModel.username.DosIsNullOrWhiteSpace())
                {
                    var account = resultModel.username.Trim();
                    if (account.Length < 2 || account.Length > 20)
                    {
                        return Json(new DosResult(0, null, "SSO返回的帐号格式无效！"));
                    }

                    // Never persist the bearer token or raw upstream response.
                    MicroiEngine.MongoDB.AddSysLog(new SysLogParam()
                    {
                        Type = "SSO登录日志",
                        Title = "SSO身份验证成功",
                        Content = "Account=" + account,
                        IP = IPHelper.GetClientIP(HttpContext).Data,
                        OsClient = param.OsClient
                    });

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
                    if (userModel.Code == 2 || (userModel.Code == 1 && userModel.Data == null))
                    {
                        // Create a least-privilege account.  Roles must be
                        // explicitly assigned by a platform administrator.
                        var addUSerresult = await _sysUserLogic.AddSysUser(new SysUserParam()
                        {
                            Account = account,
                            Name = account,
                            Pwd = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)),
                            OsClient = param.OsClient
                        });
                        if (addUSerresult.Code != 1)
                        {
                            return Json(addUSerresult);
                        }
                    }
                    else if (userModel.Code != 1)
                    {
                        return Json(new DosResult(0, null, "SSO用户查询失败，请稍后重试。"));
                    }
                    //登陆用户
                    var result = await _sysUserLogic.LoginByAccount(new SysUserParam()
                    {
                        Account = account,
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
                return Json(new DosResult(0, null, "SSO身份验证失败！"));
            }
            catch
            {
                return Json(new DosResult(0, null, "SSO登录失败，请联系管理员检查服务配置。"));
            }
        }

        /// <summary>
        /// 当前用户自助设置登录后首页。目标用户和租户只取登录 Token，且只允许
        /// 保存站内路由；真正导航时客户端还会按当前动态菜单权限再次校验。
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> UpdateMyDefaultIndexUrl([FromBody] UpdateMyDefaultIndexUrlRequest param)
        {
            var currentToken = await DiyToken.GetCurrentToken(false);
            var currentUser = currentToken?.CurrentUser;
            if (currentUser == null)
            {
                Response.StatusCode = 401;
                return Json(new DosResult(1001, null, "登录身份已过期，请重新登录。"));
            }

            if (!TryNormalizeDefaultIndexUrl(param?.DefaultIndexUrl, out var defaultIndexUrl, out var error))
            {
                return Json(new DosResult(0, null, error));
            }

            var userId = currentUser["Id"].Val<string>();
            var osClient = currentToken.OsClient;
            var updateResult = await MicroiEngine.FormEngine.UptFormDataAsync("sys_user", new
            {
                Id = userId,
                DefaultIndexUrl = defaultIndexUrl,
                OsClient = osClient
            });
            if (updateResult.Code != 1)
            {
                return Json(new DosResult(0, null, updateResult.Msg ?? "登录后首页保存失败。"));
            }

            var refreshResult = await _sysUserLogic.RefreshLoginUser(userId, osClient);
            if (refreshResult.Code != 1)
            {
                return Json(new DosResult(0, null, refreshResult.Msg ?? "设置已保存，但登录信息刷新失败。"));
            }
            return Json(new DosResult(1, refreshResult.Data, "登录后首页已保存。"));
        }

        /// <summary>
        /// 官网账户资料自助修改。字段白名单固定为显示名称和头像，目标用户、租户
        /// 均来自登录 Token，头像只能保存到当前租户的 member/avatar 目录。
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> UpdateCurrentProfile([FromBody] UpdateCurrentProfileRequest param)
        {
            var currentToken = await DiyToken.GetCurrentToken(false);
            var currentUser = currentToken?.CurrentUser;
            if (currentUser == null)
            {
                Response.StatusCode = 401;
                return Json(new DosResult(1001, null, "登录身份已过期，请重新登录。"));
            }

            var userId = currentUser["Id"].Val<string>();
            var osClient = currentToken.OsClient;
            var name = (param?.Name ?? string.Empty).Trim();
            if (name.Length < 1 || name.Length > 50)
            {
                return Json(new DosResult(0, null, "昵称需为 1 到 50 个字符。"));
            }

            var avatar = (param?.Avatar ?? string.Empty).Trim();
            var currentAvatar = currentUser["Avatar"]?.ToString()?.Trim() ?? string.Empty;
            if (!avatar.DosIsNullOrWhiteSpace()
                && !string.Equals(avatar, currentAvatar, StringComparison.Ordinal))
            {
                try
                {
                    avatar = TenantConfigurationSecurity.NormalizeStoragePath(osClient, avatar);
                    var requiredPrefix = "/" + osClient.ToLowerInvariant() + "/member/avatar/";
                    if (!avatar.StartsWith(requiredPrefix, StringComparison.OrdinalIgnoreCase))
                    {
                        return Json(new DosResult(0, null, "头像文件必须来自账户头像上传目录。"));
                    }
                }
                catch (Exception ex)
                {
                    return Json(new DosResult(0, null, "头像路径不合法：" + ex.Message));
                }
            }

            var updateResult = await MicroiEngine.FormEngine.UptFormDataAsync("sys_user", new
            {
                Id = userId,
                Name = name,
                Avatar = avatar,
                OsClient = osClient
            });
            if (updateResult.Code != 1)
            {
                return Json(new DosResult(0, null, updateResult.Msg ?? "账户资料保存失败。"));
            }

            var refreshResult = await _sysUserLogic.RefreshLoginUser(userId, osClient);
            if (refreshResult.Code != 1)
            {
                return Json(new DosResult(0, null, refreshResult.Msg ?? "账户资料已保存，但登录信息刷新失败。"));
            }
            return Json(new DosResult(1, refreshResult.Data, "账户资料已保存。"));
        }

    }
}

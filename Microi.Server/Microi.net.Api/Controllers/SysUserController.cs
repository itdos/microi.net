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
        private const string CurrentUserApiEngineKey = "platform-current-user";
        private const string SysUserPublicInfoApiEngineKey = "platform-sys-user-public-info";
        private const string CreateTenantApiEngineKey = "platform-create-tenant";
        private const string UpdateCurrentProfileApiEngineKey = "platform-user-update-profile";
        private const string UpdateUserPreferencesApiEngineKey = "platform-user-update-preferences";
        private const string SysUserAdminApiEngineKey = "platform-sys-user-admin";
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

        public class OwnedTenantAdminCredentialRequest
        {
            public string TenantKey { get; set; }
            public bool ConfirmReset { get; set; }
        }

        public class UpdateCurrentProfileRequest
        {
            public string Name { get; set; }
            public string Email { get; set; }
            public string Sex { get; set; }
            public string Lang { get; set; }
            public string Avatar { get; set; }
            public string PublicAvatar { get; set; }
        }

        public class UpdateMyDefaultIndexUrlRequest
        {
            public string DefaultIndexUrl { get; set; }
        }

        private static async Task DefaultParam(SysUserParam param)
        {
            var currentTokenDynamic = await DiyToken.GetCurrentToken();
            param._CurrentUser = currentTokenDynamic?.CurrentUser;
            param.OsClient = currentTokenDynamic?.OsClient;
        }

        private async Task<JsonResult> RunSysUserAdminCompatibilityAsync(
            string action,
            JObject request)
        {
            var currentToken = await DiyToken.GetCurrentToken(false);
            if (currentToken?.CurrentUser == null)
            {
                Response.StatusCode = 401;
                return Json(new DosResult(1001, null, "登录身份已过期，请重新登录。"));
            }

            request ??= new JObject();
            request["Action"] = action;
            request["OsClient"] = currentToken.OsClient;
            return Json(await ManagedApiEngineCompatibility.RunAsync(
                SysUserAdminApiEngineKey,
                request,
                currentToken.CurrentUser));
        }

        private void SetSensitiveCredentialResponseHeaders()
        {
            Response.Headers.CacheControl = "no-store, no-cache, max-age=0";
            Response.Headers.Pragma = "no-cache";
            Response.Headers["Referrer-Policy"] = "no-referrer";
            Response.Headers["X-Content-Type-Options"] = "nosniff";
        }

        private static DosResult AuthorizeOwnedTenantAdminCredential(
            CurrentToken currentToken,
            OwnedTenantAdminCredentialRequest request,
            out string ownerUserId)
        {
            ownerUserId = "";
            if (currentToken?.CurrentUser == null)
            {
                return new DosResult(1001, null, "登录身份已过期，请重新登录。");
            }
            if (UserAccessKeySecurity.IsSession(currentToken.CurrentUser))
            {
                return new DosResult(1002, null, "访问密钥会话不能查看或重置租户管理员密码。");
            }
            if (!string.Equals(currentToken.OsClient, OsClientDefault.OsClient,
                    StringComparison.OrdinalIgnoreCase))
            {
                return new DosResult(1002, null, "仅主租户官网账号可管理名下 SaaS 租户密码。");
            }
            ownerUserId = currentToken.CurrentUser["Id"]?.ToString() ?? "";
            if (ownerUserId.DosIsNullOrWhiteSpace())
            {
                return new DosResult(1002, null, "登录用户无效，请重新登录。");
            }
            if (request?.TenantKey.DosIsNullOrWhiteSpace() != false)
            {
                return new DosResult(0, null, "租户标识不能为空。");
            }
            return null;
        }

        private void QueueOwnedTenantAdminCredentialAudit(
            CurrentToken currentToken,
            string tenantKey,
            string action,
            bool success,
            string message)
        {
            try
            {
                MicroiEngine.QueueSysLog(new SysLogParam
                {
                    OsClient = currentToken?.OsClient ?? OsClientDefault.OsClient,
                    UserId = currentToken?.CurrentUser?["Id"]?.ToString(),
                    UserName = currentToken?.CurrentUser?["Name"]?.ToString(),
                    Category = "Security",
                    Action = action,
                    Source = "ServerEndpoint",
                    TargetType = "OwnedSaasTenantAdmin",
                    TargetId = (tenantKey ?? "").Trim(),
                    Type = "安全审计",
                    Title = action == "ResetOwnedTenantAdminPassword"
                        ? "租户所有者重置管理员密码"
                        : "租户所有者查看管理员密码",
                    Content = JsonConvert.SerializeObject(new
                    {
                        TenantKey = (tenantKey ?? "").Trim(),
                        Account = "admin",
                        Result = success ? "Success" : "Rejected",
                        Message = message ?? ""
                    }),
                    IP = IPHelper.GetClientIP(HttpContext).Data ?? "",
                    Success = success,
                    OccurredAt = DateTime.Now,
                    Level = success ? 2 : 3
                });
            }
            catch
            {
                // 审计队列异常不能把密码或内部异常写回客户端；正式日志仍不得包含明文。
            }
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
                    await TryRunPlatformLoginEventAsync(
                        param,
                        false,
                        "PasswordLoginTokenFailed",
                        sysUser["Id"].Val<string>(),
                        getTokenResult.Msg);
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
                    ? TenantConfigurationSecurity.CreatePublicSysConfigProjection(sysConfigResult.Data, param.OsClient)
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
                await TryRunPlatformLoginEventAsync(
                    param,
                    true,
                    "PasswordLogin",
                    sysUser["Id"].Val<string>(),
                    "");
            }
            if (result.Code != 1)
            {
                if (!await TryRunPlatformLoginEventAsync(
                        param,
                        false,
                        "PasswordLoginFailed",
                        "",
                        result.Msg))
                {
                    QueueLoginFailed(param, result.Msg);
                }
            }
            return Json(result);
        }

        private static async Task<bool> TryRunPlatformLoginEventAsync(
            SysUserParam param,
            bool success,
            string action,
            string userId,
            string reason)
        {
            if (param?.OsClient.DosIsNullOrWhiteSpace() != false) return false;
            try
            {
                var account = (param.Account ?? "").Trim();
                object engineResult = await MicroiEngine.ApiEngine.RunAsync(
                    "platform_auth_login_event",
                    new JObject
                    {
                        ["OsClient"] = param.OsClient,
                        ["_TrustedPlatformAuthProtocol"] = true,
                        ["Action"] = action ?? "",
                        ["UserId"] = userId ?? "",
                        ["SubjectHash"] = UserBehaviorAudit.HashIdentifier(account),
                        ["LoginMethod"] = "PASSWORD",
                        ["Success"] = success,
                        ["Reason"] = (reason ?? "").Length > 200
                            ? (reason ?? "").Substring(0, 200)
                            : reason ?? "",
                        ["OccurredAt"] = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
                    });
                return engineResult != null
                       && JObject.FromObject(engineResult)["Code"].Val<int>() == 1;
            }
            catch
            {
                // 身份应用尚未安装或租户 Hook 异常时，启动登录仍必须可用。
                return false;
            }
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
            param = await EnsureSmsLoginParam(param);
            if (param == null || param.OsClient.DosIsNullOrWhiteSpace())
                return Json(new DosResult(1003, null, "OsClient不能为空！"));

            try
            {
                // 兼容旧客户端路由；短信验证码、注册和登录编排由随 SaaS 基础包
                // 自动安装的 Managed 接口引擎负责。应用尚未安装时普通密码登录仍可用。
                var request = JObject.FromObject(param);
                request["OsClient"] = param.OsClient;
                request["Did"] = Request.Headers["did"].ToString();
                object result = await MicroiEngine.ApiEngine.RunAsync(
                    "platform_auth_sms_login",
                    request);
                return Json(result ?? new DosResult(0, null,
                    "短信登录应用未返回结果，请安装或升级官方 SaaS 引擎应用。"));
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：短信登录接口引擎调用失败：" + ex.Message);
                return Json(new DosResult(0, null,
                    "短信登录应用不可用；请先使用账号密码登录并升级官方 SaaS 引擎应用。"));
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

                var uptResult = await MicroiEngine.FormEngine.UptFormDataAsync("sys_user", new
                {
                    Id = userId,
                    Pwd = PasswordHashSecurity.HashPassword(param.Pwd),
                    PwdEncode = PasswordHashSecurity.EncodingName,
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
            var currentToken = await DiyToken.GetCurrentToken(false);
            if (currentToken?.CurrentUser == null)
                return Json(new DosResult(1001, null, "请先登录！"));

            var request = param == null ? new JObject() : JObject.FromObject(param);
            request["OsClient"] = currentToken.OsClient;
            return Json(await ManagedApiEngineCompatibility.RunAsync(
                CreateTenantApiEngineKey,
                request,
                currentToken.CurrentUser));
        }

        /// <summary>
        /// 查看当前官网账号名下 SaaS 租户的默认 admin 密码。
        /// 密码不会进入接口引擎、FormEngine、URL、缓存或审计日志。
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> GetOwnedTenantAdminPassword(
            OwnedTenantAdminCredentialRequest param)
        {
            SetSensitiveCredentialResponseHeaders();
            var currentToken = await DiyToken.GetCurrentToken(false);
            var authorization = AuthorizeOwnedTenantAdminCredential(
                currentToken,
                param,
                out var ownerUserId);
            if (authorization != null)
            {
                Response.StatusCode = authorization.Code == 1001
                    ? 401
                    : authorization.Code == 1002 ? 403 : 400;
                QueueOwnedTenantAdminCredentialAudit(
                    currentToken,
                    param?.TenantKey,
                    "RevealOwnedTenantAdminPassword",
                    false,
                    authorization.Msg);
                return Json(authorization);
            }

            var result = new TenantProvisioningService()
                .GetOwnedTenantAdminCredential(ownerUserId, param.TenantKey);
            QueueOwnedTenantAdminCredentialAudit(
                currentToken,
                param.TenantKey,
                "RevealOwnedTenantAdminPassword",
                result.Code == 1,
                result.Msg);
            return Json(result);
        }

        /// <summary>
        /// 为当前官网账号名下 SaaS 租户生成新的高强度随机 admin 密码，
        /// 并立即吊销该 admin 的全部旧登录态。
        /// </summary>
        [HttpPost]
        public async Task<JsonResult> ResetOwnedTenantAdminPassword(
            OwnedTenantAdminCredentialRequest param)
        {
            SetSensitiveCredentialResponseHeaders();
            var currentToken = await DiyToken.GetCurrentToken(false);
            var authorization = AuthorizeOwnedTenantAdminCredential(
                currentToken,
                param,
                out var ownerUserId);
            if (authorization != null)
            {
                Response.StatusCode = authorization.Code == 1001
                    ? 401
                    : authorization.Code == 1002 ? 403 : 400;
                QueueOwnedTenantAdminCredentialAudit(
                    currentToken,
                    param?.TenantKey,
                    "ResetOwnedTenantAdminPassword",
                    false,
                    authorization.Msg);
                return Json(authorization);
            }
            if (param?.ConfirmReset != true)
            {
                Response.StatusCode = 400;
                var confirmResult = new DosResult(0, null, "请确认后再重置租户管理员密码。");
                QueueOwnedTenantAdminCredentialAudit(
                    currentToken,
                    param?.TenantKey,
                    "ResetOwnedTenantAdminPassword",
                    false,
                    confirmResult.Msg);
                return Json(confirmResult);
            }

            var result = await new TenantProvisioningService()
                .ResetOwnedTenantAdminCredentialAsync(ownerUserId, param.TenantKey);
            QueueOwnedTenantAdminCredentialAudit(
                currentToken,
                param.TenantKey,
                "ResetOwnedTenantAdminPassword",
                result.Code == 1,
                result.Msg);
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
            var currentToken = await DiyToken.GetCurrentToken(false);
            if (currentToken?.CurrentUser == null)
                return Json(new DosResult(1001, null, "登录身份已过期，请重新登录。"));

            var request = param == null ? new JObject() : JObject.FromObject(param);
            request["OsClient"] = currentToken.OsClient;
            return Json(await ManagedApiEngineCompatibility.RunAsync(
                CurrentUserApiEngineKey,
                request,
                currentToken.CurrentUser));
        }

        /// <summary>
        /// 刷新登陆用户redis缓存信息
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> RefreshLoginUser(string userId = null, string osClient = null)
        {
            return await RunSysUserAdminCompatibilityAsync(
                "RefreshLoginUser",
                new JObject { ["UserId"] = userId });
        }

        /// <summary>
        /// 修改用户。必传：Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> UptSysUser(SysUserParam param)
        {
            return await RunSysUserAdminCompatibilityAsync(
                "UptSysUser",
                param == null ? new JObject() : JObject.FromObject(param));
        }

        /// <summary>
        /// 新增登陆账号。必传：Account、Pwd
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> AddSysUser(SysUserParam param)
        {
            return await RunSysUserAdminCompatibilityAsync(
                "AddSysUser",
                param == null ? new JObject() : JObject.FromObject(param));
        }

        /// <summary>
        /// 删除用户。必传：Id
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost]
        public async Task<JsonResult> DelSysUser(SysUserParam param)
        {
            return await RunSysUserAdminCompatibilityAsync(
                "DelSysUser",
                param == null ? new JObject() : JObject.FromObject(param));
        }

        /// <summary>
        /// 获取用户。
        /// </summary>
        /// <param name="param"></param>
        /// <returns></returns>
        [HttpPost, HttpGet]
        public async Task<JsonResult> GetSysUser(SysUserParam param)
        {
            return await RunSysUserAdminCompatibilityAsync(
                "GetSysUser",
                param == null ? new JObject() : JObject.FromObject(param));
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
            var currentToken = await DiyToken.GetCurrentToken(false);
            if (currentToken?.CurrentUser == null)
                return Json(new DosResult(1001, null, "登录身份已过期，请重新登录。"));

            var request = param == null ? new JObject() : JObject.FromObject(param);
            request["OsClient"] = currentToken.OsClient;
            return Json(await ManagedApiEngineCompatibility.RunAsync(
                SysUserPublicInfoApiEngineKey,
                request,
                currentToken.CurrentUser));
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

            var request = param == null ? new JObject() : JObject.FromObject(param);
            request["OsClient"] = currentToken.OsClient;
            return Json(await ManagedApiEngineCompatibility.RunAsync(
                UpdateUserPreferencesApiEngineKey,
                request,
                currentUser));
        }

        /// <summary>
        /// 账户资料自助修改。字段白名单固定为显示名称、邮箱、性别、语言、私有头像和公开头像，目标用户、租户
        /// 均来自登录 Token。私有头像只能来自 member/avatar，公开头像只能来自
        /// member/public-avatar；未提交的头像字段保持原值，兼容尚未安装公开头像字段的租户。
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

            var request = param == null ? new JObject() : JObject.FromObject(param);
            request["OsClient"] = currentToken.OsClient;
            return Json(await ManagedApiEngineCompatibility.RunAsync(
                UpdateCurrentProfileApiEngineKey,
                request,
                currentUser));
        }

    }
}

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Microi.net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    /*
     * ================================================================================
     * 【极重要：仅用于兼容旧版吾码 PC / UniApp / 定制移动端，禁止新增业务接口】
     *
     * 本 Controller 统一保留已经迁移到官方 Managed V8 接口引擎的历史 /api/* 地址。
     * 新前端、新 UniApp 和新项目必须直接调用 /apiengine/*；这里仅归一化旧请求、
     * 恢复旧 Token 形态并转发到官方接口引擎。待连续版本确认无旧客户端流量后，
     * 本 Controller 及全部历史地址可能整体删除。
     *
     * 唯一例外是 GetSysConfig 的安全启动回退：当应用包升级尚未补齐接口引擎时，
     * 它直接调用 Microi.Core 的固定公开投影原子，绝不依赖 platform-sys-config，
     * 从而避免“新接口缺失 -> 旧接口又调用新接口”的循环故障。
     * ================================================================================
     */
    [Route("api/legacy-mobile-compatibility")]
    [EnableCors("any")]
    [ServiceFilter(typeof(DiyFilter<dynamic>))]
    [ApiExplorerSettings(IgnoreApi = true)]
    public sealed class LegacyMobileCompatibilityController : Controller
    {
        private const string OsClientByDomainApiEngineKey = "platform-os-client-by-domain";
        private const string LangBundleApiEngineKey = "platform-lang-bundle";
        private const string LoginWallpapersApiEngineKey = "platform-login-wallpapers";
        private const string CurrentUserApiEngineKey = "platform-current-user";
        private const string SysUserPublicInfoApiEngineKey = "platform-sys-user-public-info";
        private const string SysUserAdminApiEngineKey = "platform-sys-user-admin";
        private const string PlatformPrivateFileUrlEngineKey = "platform-private-file-url";
        private const string CreateTenantApiEngineKey = "platform-create-tenant";
        private const string UpdateCurrentProfileApiEngineKey = "platform-user-update-profile";
        private const string UpdateUserPreferencesApiEngineKey = "platform-user-update-preferences";

        public sealed class CreateTenantRequest
        {
            public string TenantKey { get; set; }
            public string SystemName { get; set; }
        }

        public sealed class UpdateCurrentProfileRequest
        {
            public string Name { get; set; }
            public string Email { get; set; }
            public string Sex { get; set; }
            public string Lang { get; set; }
            public string Avatar { get; set; }
            public string PublicAvatar { get; set; }
        }

        public sealed class UpdateMyDefaultIndexUrlRequest
        {
            public string DefaultIndexUrl { get; set; }
        }

        /// <summary>
        /// 兼容最早期前端的 POST /api/Upload。实际鉴权、租户绑定、路径校验、
        /// HDFS 上传和微信内容安全均复用当前 HDFSController.Upload，不保留第二份业务实现。
        /// </summary>
        [HttpPost("~/api/Upload")]
        [Consumes("application/json", "multipart/form-data")]
        public Task<JsonResult> Upload(DiyUploadParam param)
        {
            var hdfsController = new HDFSController
            {
                ControllerContext = ControllerContext
            };
            return hdfsController.Upload(param);
        }

        /// <summary>
        /// 兼容旧短信登录地址；验证码、注册、租户开通和登录响应均由官方 SaaS
        /// 应用的 Managed 接口引擎编排，宿主只清洗匿名请求并固定引擎 Key。
        /// </summary>
        [HttpPost("~/api/SysUser/SmsLogin")]
        [AllowAnonymous]
        public async Task<JsonResult> SmsLogin([FromBody] JObject param)
        {
            param = await MergeRequestParam(param);
            var osClient = param?["OsClient"].Val<string>();
            if (osClient.DosIsNullOrWhiteSpace())
                return Json(new DosResult(1003, null, "OsClient不能为空！"));

            param["OsClient"] = TenantConfigurationSecurity.NormalizeTenantId(osClient);
            param["Did"] = Request.Headers["did"].ToString();
            return Json(await ManagedApiEngineCompatibility.RunAsync(
                "platform_auth_sms_login",
                param));
        }

        /// <summary>
        /// 兼容旧系统消息地址。Managed 接口引擎先完成持久化和读模型更新，
        /// 宿主只在事务完成后尽力投递 SignalR 实时通知。
        /// </summary>
        [HttpGet("~/api/DiyChat/SendSystemMessage")]
        [HttpPost("~/api/DiyChat/SendSystemMessage")]
        [PlatformAdminOnly]
        public async Task<DosResult> SendSystemMessage(MessageBodyParam msgParam)
        {
            if (msgParam == null
                || msgParam.Content.DosIsNullOrWhiteSpace()
                || msgParam.ToUserId.DosIsNullOrWhiteSpace())
            {
                return new DosResult(0, null,
                    DiyMessage.GetLang(msgParam?.OsClient, "ParamError", msgParam?._Lang));
            }

            var currentToken = await DiyToken.GetCurrentToken(false).ConfigureAwait(false);
            if (currentToken?.CurrentUser == null)
                return new DosResult(1001, null, "登录身份已过期，请重新登录。");
            if (UserAccessKeySecurity.IsSession(currentToken.CurrentUser))
                return new DosResult(1002, null, "访问密钥会话不允许发送实时聊天消息。");

            var rawResult = await ManagedApiEngineCompatibility.RunAsync(
                "platform-chat-system-message",
                new JObject
                {
                    ["Action"] = "PersistSystemMessage",
                    ["RequestId"] = msgParam.RequestId.DosIsNullOrWhiteSpace()
                        ? Ulid.NewUlid().ToString()
                        : msgParam.RequestId.Trim(),
                    ["OsClient"] = currentToken.OsClient,
                    ["ToUserId"] = msgParam.ToUserId,
                    ["Content"] = msgParam.Content,
                    ["OtherInfo"] = msgParam.OtherInfo,
                    ["IsRead"] = msgParam.IsRead
                },
                JObject.FromObject(currentToken.CurrentUser)).ConfigureAwait(false);
            var result = ToResultObject(rawResult);
            if (result?["Code"].Val<int>() != 1
                || result["Data"] is not JObject data
                || data["Message"] is not JObject)
            {
                return new DosResult(
                    result?["Code"].Val<int>() ?? 0,
                    null,
                    result?["Msg"]?.ToString() ?? "官方系统消息接口不可用。");
            }

            var hubContext = HttpContext.RequestServices
                .GetRequiredService<IHubContext<DiyWebSocket>>();
            await new DiyWebSocket(null).DeliverPreparedMessageAsync(
                result,
                currentToken.OsClient,
                hubContext).ConfigureAwait(false);
            return new DosResult(1, data["Message"]);
        }

        [HttpPost("~/api/Os/GetOsClientByDomain")]
        [HttpGet("~/api/Os/GetOsClientByDomain")]
        [AllowAnonymous]
        public async Task<JsonResult> GetOsClientByDomain(string Domain, string Lang = "")
        {
            var request = new JObject
            {
                ["Domain"] = Domain ?? string.Empty,
                ["_Lang"] = Lang.DosIsNullOrWhiteSpace() ? DiyMessage.Lang : Lang,
                ["OsClient"] = OsClient.GetConfigOsClient()
            };
            return Json(await ManagedApiEngineCompatibility.RunAsync(
                OsClientByDomainApiEngineKey,
                request));
        }

        [HttpPost("~/api/FormEngine/GetSysConfig")]
        [HttpGet("~/api/FormEngine/GetSysConfig")]
        [HttpPost("~/api/DiyTable/GetSysConfig")]
        [HttpGet("~/api/DiyTable/GetSysConfig")]
        [AllowAnonymous]
        public async Task<JsonResult> GetSysConfig(
            [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] DiyTableRowParam param = null)
        {
            var request = await MergeRequestParam(
                param == null ? new JObject() : JObject.FromObject(param));
            EnsureLang(request);
            var osClient = request["OsClient"].Val<string>();
            var lang = request["_Lang"].Val<string>();
            if (osClient.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(
                    0,
                    null,
                    DiyMessage.GetLang(osClient, "ParamError", lang)));
            }

            // This route must be independent of the engine it is intended to
            // replace when a historical tenant missed the package upgrade.
            return Json(await PlatformBootstrapCompatibilityService
                .GetPublicSysConfigAsync(osClient, lang));
        }

        [HttpPost("~/api/FormEngine/GetLangBundle")]
        [HttpGet("~/api/FormEngine/GetLangBundle")]
        [AllowAnonymous]
        public async Task<JsonResult> GetLangBundle(
            [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] JObject param = null)
        {
            param = await MergeRequestParam(param);
            if (param["OsClient"].Val<string>().DosIsNullOrWhiteSpace())
            {
                param["OsClient"] = OsClient.GetConfigOsClient();
            }
            EnsureLang(param);
            return Json(await ManagedApiEngineCompatibility.RunAsync(
                LangBundleApiEngineKey,
                param));
        }

        [HttpPost("~/api/FormEngine/GetLoginWallpapers")]
        [HttpGet("~/api/FormEngine/GetLoginWallpapers")]
        [AllowAnonymous]
        public async Task<JsonResult> GetLoginWallpapers(
            [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] JObject param = null)
        {
            param = await MergeRequestParam(param);
            EnsureLang(param);
            var osClient = param["OsClient"].Val<string>();
            if (osClient.DosIsNullOrWhiteSpace())
            {
                return Json(new DosResult(
                    0,
                    null,
                    DiyMessage.GetLang(osClient, "ParamError", param["_Lang"].Val<string>())));
            }
            return Json(await ManagedApiEngineCompatibility.RunAsync(
                LoginWallpapersApiEngineKey,
                param));
        }

        [HttpPost("~/api/SysUser/GetCurrentUser")]
        [HttpGet("~/api/SysUser/GetCurrentUser")]
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

        [HttpPost("~/api/SysUser/GetSysUserPublicInfo")]
        [HttpGet("~/api/SysUser/GetSysUserPublicInfo")]
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

        [HttpPost("~/api/SysUser/RefreshLoginUser")]
        public Task<JsonResult> RefreshLoginUser(string userId = null, string osClient = null)
        {
            return RunSysUserAdminCompatibilityAsync(
                "RefreshLoginUser",
                new JObject { ["UserId"] = userId });
        }

        [HttpPost("~/api/SysUser/UptSysUser")]
        public Task<JsonResult> UptSysUser(SysUserParam param)
        {
            return RunSysUserAdminCompatibilityAsync(
                "UptSysUser",
                param == null ? new JObject() : JObject.FromObject(param));
        }

        [HttpPost("~/api/SysUser/AddSysUser")]
        public Task<JsonResult> AddSysUser(SysUserParam param)
        {
            return RunSysUserAdminCompatibilityAsync(
                "AddSysUser",
                param == null ? new JObject() : JObject.FromObject(param));
        }

        [HttpPost("~/api/SysUser/DelSysUser")]
        public Task<JsonResult> DelSysUser(SysUserParam param)
        {
            return RunSysUserAdminCompatibilityAsync(
                "DelSysUser",
                param == null ? new JObject() : JObject.FromObject(param));
        }

        [HttpPost("~/api/SysUser/GetSysUser")]
        [HttpGet("~/api/SysUser/GetSysUser")]
        public Task<JsonResult> GetSysUser(SysUserParam param)
        {
            return RunSysUserAdminCompatibilityAsync(
                "GetSysUser",
                param == null ? new JObject() : JObject.FromObject(param));
        }

        [HttpPost("~/api/SysUser/CreateTenant")]
        public Task<JsonResult> CreateTenant(CreateTenantRequest param)
        {
            return RunAuthenticatedManagedCompatibilityAsync(
                CreateTenantApiEngineKey,
                param == null ? new JObject() : JObject.FromObject(param),
                "请先登录！",
                false);
        }

        [HttpPost("~/api/SysUser/UpdateMyDefaultIndexUrl")]
        public Task<JsonResult> UpdateMyDefaultIndexUrl(
            [FromBody] UpdateMyDefaultIndexUrlRequest param)
        {
            return RunAuthenticatedManagedCompatibilityAsync(
                UpdateUserPreferencesApiEngineKey,
                param == null ? new JObject() : JObject.FromObject(param),
                "登录身份已过期，请重新登录。",
                true);
        }

        [HttpPost("~/api/SysUser/UpdateCurrentProfile")]
        public Task<JsonResult> UpdateCurrentProfile(
            [FromBody] UpdateCurrentProfileRequest param)
        {
            return RunAuthenticatedManagedCompatibilityAsync(
                UpdateCurrentProfileApiEngineKey,
                param == null ? new JObject() : JObject.FromObject(param),
                "登录身份已过期，请重新登录。",
                true);
        }

        [HttpPost("~/api/HDFS/GetPrivateFileUrl")]
        [HttpGet("~/api/HDFS/GetPrivateFileUrl")]
        [HttpPost("~/api/HDFS/MallFileUrl")]
        [HttpGet("~/api/HDFS/MallFileUrl")]
        [AllowAnonymous]
        public async Task<JsonResult> GetPrivateFileUrl(DiyUploadParam param)
        {
            param ??= new DiyUploadParam();
            await LoadJsonBody(param);
            param.FilePathName = ResolveFilePathName(param);

            var currentToken = await DiyToken.GetCurrentToken();
            if (currentToken?.CurrentUser != null)
            {
                var accessError = await SetAuthenticatedFileParam(param, currentToken);
                if (accessError != null) return Json(accessError);
                return Json(await ManagedApiEngineCompatibility.RunAsync(
                    PlatformPrivateFileUrlEngineKey,
                    JObject.FromObject(param),
                    param._CurrentUser));
            }

            if (!TryResolveRequestedOsClient(param, out var osClient, out var osClientError))
                return Json(osClientError);

            var clientUser = await GetLegacyClientUserFromToken(osClient);
            if (clientUser == null)
                return Json(new DosResult(1001, null, "登录身份已过期！"));

            param.OsClient = osClient;
            param._CurrentUser = clientUser;
            param._InvokeType = InvokeType.Client.ToString();
            param.Limit = true;
            return Json(await ManagedApiEngineCompatibility.RunAsync(
                PlatformPrivateFileUrlEngineKey,
                JObject.FromObject(param),
                clientUser));
        }

        private async Task<JsonResult> RunSysUserAdminCompatibilityAsync(
            string action,
            JObject request)
        {
            var currentToken = await DiyToken.GetCurrentToken(false);
            if (currentToken?.CurrentUser == null)
            {
                Response.StatusCode = StatusCodes.Status401Unauthorized;
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

        private async Task<JsonResult> RunAuthenticatedManagedCompatibilityAsync(
            string apiEngineKey,
            JObject request,
            string unauthenticatedMessage,
            bool setUnauthorizedStatus)
        {
            var currentToken = await DiyToken.GetCurrentToken(false);
            if (currentToken?.CurrentUser == null)
            {
                if (setUnauthorizedStatus)
                    Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Json(new DosResult(1001, null, unauthenticatedMessage));
            }

            request ??= new JObject();
            request["OsClient"] = currentToken.OsClient;
            return Json(await ManagedApiEngineCompatibility.RunAsync(
                apiEngineKey,
                request,
                currentToken.CurrentUser));
        }

        private async Task<DosResult> SetAuthenticatedFileParam(
            DiyUploadParam param,
            CurrentToken currentToken)
        {
            var tokenOsClient = Convert.ToString(currentToken?.OsClient);
            if (currentToken?.CurrentUser == null || tokenOsClient.DosIsNullOrWhiteSpace())
                return new DosResult(1001, null, "登录身份已过期，请重新登录！");

            if (!TryResolveRequestedOsClient(param, out var requestedOsClient, out var resolveError))
                return resolveError;
            if (!requestedOsClient.DosIsNullOrWhiteSpace()
                && !string.Equals(requestedOsClient, tokenOsClient, StringComparison.OrdinalIgnoreCase))
                return new DosResult(0, null, "请求租户与当前登录租户不一致！");

            param._CurrentUser = currentToken.CurrentUser;
            param.OsClient = tokenOsClient.Trim();
            param._InvokeType = InvokeType.Client.ToString();
            param._ClientType = DiyToken
                .GetActiveCachedTokenEntry(currentToken, currentToken.Token)
                ?.ClientType;
            return null;
        }

        private bool TryResolveRequestedOsClient(
            DiyUploadParam param,
            out string osClient,
            out DosResult error)
        {
            osClient = string.Empty;
            error = null;
            var values = new List<string>();
            AddRequestedOsClient(values, param?.OsClient);
            AddRequestedOsClient(values, Request.Query["OsClient"].ToString());
            AddRequestedOsClient(values, Request.Headers["OsClient"].ToString());
            AddRequestedOsClient(values, Request.Headers["osclient"].ToString());
            try
            {
                if (Request.HasFormContentType)
                    AddRequestedOsClient(values, Request.Form["OsClient"].ToString());
            }
            catch (InvalidOperationException)
            {
            }

            var distinct = values.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            if (distinct.Count > 1)
            {
                error = new DosResult(0, null, "请求中存在互相冲突的OsClient参数！");
                return false;
            }
            if (distinct.Count == 0) return true;

            try
            {
                osClient = TenantConfigurationSecurity.NormalizeTenantId(distinct[0]);
                return true;
            }
            catch (Exception ex)
            {
                error = new DosResult(0, null, "OsClient不合法：" + ex.Message);
                return false;
            }
        }

        private static void AddRequestedOsClient(ICollection<string> values, string value)
        {
            if (!value.DosIsNullOrWhiteSpace()) values.Add(value.Trim());
        }

        private string ResolveRequestToken()
        {
            var token = Request.Headers["Token"].ToString();
            if (token.DosIsNullOrWhiteSpace()) token = Request.Headers["Authorization"].ToString();
            try
            {
                if (token.DosIsNullOrWhiteSpace() && Request.HasFormContentType)
                    token = Request.Form["Token"].ToString();
                if (token.DosIsNullOrWhiteSpace() && Request.HasFormContentType)
                    token = Request.Form["authorization"].ToString();
            }
            catch (InvalidOperationException)
            {
            }
            return token.DosTrim().DosReplace("Bearer ", string.Empty);
        }

        private string ResolveFilePathName(DiyUploadParam param)
        {
            var filePathName = param.FilePathName;
            if (filePathName.DosIsNullOrWhiteSpace())
                filePathName = Request.Query["FilePathName"].ToString();
            try
            {
                if (filePathName.DosIsNullOrWhiteSpace() && Request.HasFormContentType)
                    filePathName = Request.Form["FilePathName"].ToString();
            }
            catch (InvalidOperationException)
            {
            }
            return filePathName;
        }

        private async Task<JObject> GetLegacyClientUserFromToken(string osClient)
        {
            var token = ResolveRequestToken();
            if (osClient.DosIsNullOrWhiteSpace() || token.DosIsNullOrWhiteSpace()) return null;

            var cache = MicroiEngine.CacheTenant.Cache(osClient);
            foreach (var cacheKey in new[]
            {
                $"Microi:{osClient}:ClientUserToken:{token}",
                $"Microi:{osClient}:MobileMemberToken:{token}",
                $"Microi:{osClient}:MallMemberToken:{token}"
            })
            {
                var cached = await cache.GetAsync(cacheKey);
                if (cached == null) continue;
                try
                {
                    return JObject.Parse(cached.ToString());
                }
                catch
                {
                    try
                    {
                        return await cache.GetAsync<JObject>(cacheKey);
                    }
                    catch
                    {
                    }
                }
            }
            return null;
        }

        private async Task LoadJsonBody(DiyUploadParam param)
        {
            if (Request.HasFormContentType
                || Request.ContentType?.Contains("application/json") != true)
                return;

            Request.EnableBuffering();
            Request.Body.Position = 0;
            using var reader = new StreamReader(Request.Body, Encoding.UTF8, false, 1024, true);
            var body = await reader.ReadToEndAsync();
            Request.Body.Position = 0;
            if (body.DosIsNullOrWhiteSpace()) return;
            try
            {
                var json = JObject.Parse(body);
                if (param.OsClient.DosIsNullOrWhiteSpace())
                    param.OsClient = json["OsClient"].Val<string>();
                if (param.FilePathName.DosIsNullOrWhiteSpace())
                    param.FilePathName = json["FilePathName"].Val<string>();
            }
            catch
            {
                // Model binding remains authoritative for malformed legacy bodies.
            }
        }

        private string GetRequestLang()
        {
            try
            {
                var lang = Request?.Headers?["lang"].ToString();
                return lang.DosIsNullOrWhiteSpace() ? DiyMessage.Lang : lang;
            }
            catch
            {
                return DiyMessage.Lang;
            }
        }

        private void EnsureLang(JObject param)
        {
            if (param != null
                && (param["_Lang"] == null
                    || param["_Lang"].Val<string>().DosIsNullOrWhiteSpace()))
                param["_Lang"] = GetRequestLang();
        }

        private async Task<JObject> MergeRequestParam(JObject param)
        {
            var requestParam = await BuildRequestParam();
            if (param == null || !param.HasValues) return requestParam;
            foreach (var property in requestParam.Properties())
            {
                if (param[property.Name] == null) param[property.Name] = property.Value;
            }
            return param;
        }

        private async Task<JObject> BuildRequestParam()
        {
            var result = new JObject();
            try
            {
                if (Request?.Body != null && (Request.ContentLength ?? 0) > 0)
                {
                    Request.EnableBuffering();
                    Request.Body.Position = 0;
                    using var reader = new StreamReader(Request.Body, Encoding.UTF8, false, 1024, true);
                    var body = await reader.ReadToEndAsync();
                    Request.Body.Position = 0;
                    if (!body.DosIsNullOrWhiteSpace())
                    {
                        foreach (var property in JObject.Parse(body).Properties())
                            result[property.Name] = property.Value;
                    }
                }
                if (Request?.HasFormContentType == true)
                {
                    foreach (var item in Request.Form) result[item.Key] = item.Value.ToString();
                }
                if (Request?.Query != null)
                {
                    foreach (var item in Request.Query)
                    {
                        if (result[item.Key] == null) result[item.Key] = item.Value.ToString();
                    }
                }
            }
            catch
            {
                // Preserve legacy model-binding behavior; validation happens in actions.
            }
            return result;
        }

        private static JObject ToResultObject(object result)
        {
            if (result == null) return null;
            if (result is JObject model) return model;
            if (result is string json)
            {
                try { return JObject.Parse(json); }
                catch { return null; }
            }
            try { return JObject.FromObject(result); }
            catch { return null; }
        }
    }
}

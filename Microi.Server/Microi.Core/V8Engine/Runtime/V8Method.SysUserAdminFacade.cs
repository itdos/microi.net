using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// platform-sys-user-admin 的窄可信原子。Managed V8 负责编排与租户 Hook；
    /// 此处只保留不能交给可编辑脚本的身份、租户、表权限、角色层级、step-up、
    /// 内容安全、密码写入以及登录投影/会话安全边界。
    /// </summary>
    public partial class V8Method
    {
        private const string PlatformSysUserAdminEngineKey = "platform-sys-user-admin";
        private static readonly HashSet<string> SysUserAdminActions =
            new HashSet<string>(StringComparer.Ordinal)
            {
                "AddSysUser",
                "UptSysUser",
                "DelSysUser",
                "GetSysUser",
                "RefreshLoginUser"
            };

        /// <summary>
        /// 仅允许固定官方 Managed 引擎调用；请求里的 OsClient、_CurrentUser、
        /// 编码密码和服务端字段都不能覆盖宿主解析出的可信值。
        /// </summary>
        public dynamic ManageSysUserAdmin(dynamic dynamicParam)
        {
            var denied = ResolveTrustedManagedCurrentUser(
                PlatformSysUserAdminEngineKey,
                true,
                0,
                out var osClient,
                out var currentUser);
            if (denied != null) return denied;

            try
            {
                var request = JsonHelper.ToJObject((object)dynamicParam) ?? new JObject();
                var action = ReadText(request, "Action").Trim();
                if (!SysUserAdminActions.Contains(action))
                    return new DosResult(0, null, "不支持的系统账号操作。");
                var authorizeOnly = request["AuthorizeOnly"]?.Val<bool>() == true;

                var payload = ReadObject(request, "Param") ?? request;
                var param = payload.ToObject<SysUserParam>() ?? new SysUserParam();
                param.OsClient = osClient;
                param._CurrentUser = currentUser.DeepClone() as JObject;
                param._InvokeType = InvokeType.Client.ToString();
                // 客户端永远不能提交预编码密码或宿主信任标志。
                param._EncodePwd = null;
                param._EncodeNewPwd = null;
                param._DevBypassPwd = false;
                param.Token = null;
                param._token = null;
                param.TokenName = null;

                object operationResult;
                switch (action)
                {
                    case "AddSysUser":
                        operationResult = AddSysUserTrusted(param, currentUser, osClient, authorizeOnly);
                        break;
                    case "UptSysUser":
                        operationResult = UpdateSysUserTrusted(param, currentUser, osClient, authorizeOnly);
                        break;
                    case "DelSysUser":
                        operationResult = DeleteSysUserTrusted(param, currentUser, osClient, authorizeOnly);
                        break;
                    case "GetSysUser":
                        operationResult = GetSysUserTrusted(param, currentUser, osClient, authorizeOnly);
                        break;
                    default:
                        operationResult = RefreshLoginUserTrusted(
                            ReadFirstText(payload, "Id", "UserId", "userId"),
                            currentUser,
                            osClient,
                            authorizeOnly);
                        break;
                }

                return RedactSysUserAdminResult(operationResult);
            }
            catch (Exception ex)
            {
                Console.WriteLine(
                    $"Microi：[platform-sys-user-admin] 可信原子执行失败：{ex.GetType().Name}");
                return new DosResult(0, null, "系统账号操作失败，请稍后重试。");
            }
        }

        private static object AddSysUserTrusted(
            SysUserParam param,
            JObject currentUser,
            string osClient,
            bool authorizeOnly)
        {
            var tableAuthorization = AuthorizeSysUserTableOperation(
                param,
                currentUser,
                osClient,
                "Add");
            if (tableAuthorization.Code != 1) return tableAuthorization;

            if (!IsAuthoritativePlatformAdmin(osClient, currentUser))
            {
                RestrictDelegatedSysUserFields(param);
                var decision = AuthorizeDelegatedSysUserMutation(
                    param,
                    currentUser,
                    SysUserManagementOperation.Add);
                if (!decision.Allowed) return NoSysUserAuthorization(osClient, param._Lang);
            }

            if (authorizeOnly) return new DosResult(1);
            return new SysUserLogic().AddSysUser(param).GetAwaiter().GetResult();
        }

        private static object UpdateSysUserTrusted(
            SysUserParam param,
            JObject currentUser,
            string osClient,
            bool authorizeOnly)
        {
            var currentUserId = currentUser["Id"].Val<string>();
            if (currentUserId.DosIsNullOrWhiteSpace())
                return NoSysUserAuthorization(osClient, param._Lang);

            // 历史管理端在管理员修改自己密码时只提交 Pwd。统一转换为
            // NewPwd，确保同样经过本人密码变更的 step-up 票据校验；他人
            // 密码重置仍只允许权威平台管理员走后续受信分支。
            var targetsCurrentUser = param.Id.DosIsNullOrWhiteSpace()
                || string.Equals(param.Id, currentUserId, StringComparison.OrdinalIgnoreCase);
            if (targetsCurrentUser
                && param.NewPwd.DosIsNullOrWhiteSpace()
                && !param.Pwd.DosIsNullOrWhiteSpace()
                && IsAuthoritativePlatformAdmin(osClient, currentUser))
            {
                param.NewPwd = param.Pwd;
                param.Pwd = null;
            }

            if (!IsAuthoritativePlatformAdmin(osClient, currentUser))
            {
                var isSelfUpdate = param.Id.DosIsNullOrWhiteSpace()
                    || string.Equals(param.Id, currentUserId, StringComparison.OrdinalIgnoreCase);
                if (isSelfUpdate)
                {
                    RestrictSelfServiceSysUserUpdate(param, currentUserId);
                    var hasOldPassword = !param.Pwd.DosIsNullOrWhiteSpace();
                    var hasNewPassword = !param.NewPwd.DosIsNullOrWhiteSpace();
                    if (hasOldPassword != hasNewPassword)
                    {
                        // SysUserLogic 的历史兼容分支曾仅凭 Account=admin 把 Pwd
                        // 解释为新密码。非权威管理员的本人改密必须同时提交旧、
                        // 新密码，不能借账号名称或伪造投影进入管理员重置分支。
                        return new DosResult(0, null, "本人修改密码必须同时提交旧密码和新密码。");
                    }
                }
                else
                {
                    RestrictDelegatedSysUserFields(param);
                    // 普通账号管理员可以维护档案、组织与其可分配角色，但不能通过
                    // SysUserLogic 的历史 admin-account 分支重置他人密码。
                    param.Pwd = null;
                    param.NewPwd = null;
                    param._IdentityVerificationTicket = null;
                    param._IdentityVerificationActionHash = null;

                    var tableAuthorization = AuthorizeSysUserTableOperation(
                        param,
                        currentUser,
                        osClient,
                        "Edit");
                    if (tableAuthorization.Code != 1) return tableAuthorization;
                    var decision = AuthorizeDelegatedSysUserMutation(
                        param,
                        currentUser,
                        SysUserManagementOperation.Edit);
                    if (!decision.Allowed) return NoSysUserAuthorization(osClient, param._Lang);
                }
            }

            // 租户 Hook 只能在可信表/行/角色授权通过后运行。预检不消费
            // step-up 票据、不调用内容审核，也不写数据库；正式执行会再次授权，
            // 防止预检与写入之间的权限变化形成 TOCTOU 绕过。
            if (authorizeOnly)
            {
                // V8 must not duplicate case-insensitive password-field parsing.
                // Newtonsoft has already normalized every casing variant into the
                // strongly typed model, so this trusted result is the sole signal
                // used to decide whether a tenant Before Hook may run.
                return new DosResult(1)
                {
                    DataAppend = new
                    {
                        ChangesPassword = !param.Pwd.DosIsNullOrWhiteSpace()
                            || !param.NewPwd.DosIsNullOrWhiteSpace()
                    }
                };
            }

            var stepUp = AuthorizeSelfPasswordChange(param, currentUser, osClient);
            if (stepUp.Code != 1) return stepUp;

            var contentSecurity = MicroiEngine.TryGetService<ISysUserProfileContentSecurityGateway>();
            if (contentSecurity == null)
                return new DosResult(0, null, "用户资料内容安全网关不可用，请稍后重试。");
            var contentResult = contentSecurity.ValidateProfileUpdateAsync(
                    osClient,
                    currentUser,
                    param,
                    CancellationToken.None)
                .GetAwaiter()
                .GetResult();
            param.ContentSecurityLoginCode = null;
            if (contentResult?.Code != 1) return contentResult ?? new DosResult(0);

            return new SysUserLogic().UptSysUser(param).GetAwaiter().GetResult();
        }

        private static object DeleteSysUserTrusted(
            SysUserParam param,
            JObject currentUser,
            string osClient,
            bool authorizeOnly)
        {
            var tableAuthorization = AuthorizeSysUserTableOperation(
                param,
                currentUser,
                osClient,
                "Delete");
            if (tableAuthorization.Code != 1) return tableAuthorization;

            if (!IsAuthoritativePlatformAdmin(osClient, currentUser))
            {
                var decision = AuthorizeDelegatedSysUserMutation(
                    param,
                    currentUser,
                    SysUserManagementOperation.Delete);
                if (!decision.Allowed) return NoSysUserAuthorization(osClient, param._Lang);
            }
            if (authorizeOnly) return new DosResult(1);
            return new SysUserLogic().DelSysUser(param).GetAwaiter().GetResult();
        }

        private static object GetSysUserTrusted(
            SysUserParam param,
            JObject currentUser,
            string osClient,
            bool authorizeOnly)
        {
            var tableAuthorization = AuthorizeSysUserTableOperation(
                param,
                currentUser,
                osClient,
                "List");
            if (tableAuthorization.Code != 1) return tableAuthorization;
            if (authorizeOnly) return new DosResult(1);
            param.IsDeleted = 0;
            return new SysUserLogic().GetSysUser(param).GetAwaiter().GetResult();
        }

        private static object RefreshLoginUserTrusted(
            string requestedUserId,
            JObject currentUser,
            string osClient,
            bool authorizeOnly)
        {
            var currentUserId = currentUser["Id"].Val<string>();
            var userId = requestedUserId.DosTrim();
            if (!IsAuthoritativePlatformAdmin(osClient, currentUser)) userId = currentUserId;
            if (userId.DosIsNullOrWhiteSpace()) userId = currentUserId;
            if (userId.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, "刷新用户信息参数错误！");
            if (authorizeOnly) return new DosResult(1);
            return new SysUserLogic().RefreshLoginUser(userId, osClient).GetAwaiter().GetResult();
        }

        private static DosResult AuthorizeSysUserTableOperation(
            SysUserParam source,
            JObject currentUser,
            string osClient,
            string operation)
        {
            return MicroiEngine.FormEngine.AuthorizeClientTableOperationAsync(
                    new DiyTableRowParam
                    {
                        FormEngineKey = "sys_user",
                        Id = source?.Id,
                        _TableRowId = source?.Id,
                        OsClient = osClient,
                        _CurrentUser = currentUser,
                        _InvokeType = InvokeType.Client.ToString(),
                        _Lang = source?._Lang,
                        _RowModel = string.Equals(operation, "Add", StringComparison.OrdinalIgnoreCase)
                                    || string.Equals(operation, "Edit", StringComparison.OrdinalIgnoreCase)
                            ? new JObject { ["Id"] = source?.Id }
                            : null
                    },
                    operation)
                .GetAwaiter()
                .GetResult();
        }

        private static SysUserManagementDecision AuthorizeDelegatedSysUserMutation(
            SysUserParam param,
            JObject currentUser,
            SysUserManagementOperation operation)
        {
            var roleIdsSupplied = param?.RoleIds != null;
            var requestedRoleIds = roleIdsSupplied ? JArray.FromObject(param.RoleIds) : null;
            var decision = SysUserManagementSecurity.Authorize(
                OsClientExtend.GetClient(param?.OsClient)?.Db,
                currentUser,
                operation,
                param?.Id,
                requestedRoleIds,
                roleIdsSupplied);
            if (!decision.Allowed) return decision;
            param.Level = roleIdsSupplied ? (int?)decision.AssignedLevel : null;
            if (roleIdsSupplied) param.RoleIds = decision.RoleIds.ToList();
            return decision;
        }

        private static DosResult AuthorizeSelfPasswordChange(
            SysUserParam param,
            JObject currentUser,
            string osClient)
        {
            var actorUserId = currentUser["Id"].Val<string>();
            var isSelfPasswordChange = !param.NewPwd.DosIsNullOrWhiteSpace()
                && (param.Id.DosIsNullOrWhiteSpace()
                    || string.Equals(param.Id, actorUserId, StringComparison.OrdinalIgnoreCase));
            if (!isSelfPasswordChange) return new DosResult(1);

            var options = IdentityVerificationOptions.Resolve(osClient);
            if (!options.Enabled || !options.RequirePasswordChangeStepUp)
                return new DosResult(1);
            var hasFactor = IdentityVerificationSecurity.UserHasStepUpFactorAsync(
                    osClient,
                    actorUserId,
                    options.PasskeyEnabled,
                    options.TotpEnabled,
                    options.FaceEnabled && !options.FaceApiBase.DosIsNullOrWhiteSpace())
                .GetAwaiter()
                .GetResult();
            if (!hasFactor) return new DosResult(1);

            var expectedActionHash = IdentityVerificationSecurity.ComputePasswordChangeActionHash(
                actorUserId,
                param.NewPwd);
            var ticketResult = IdentityVerificationSecurity.ConsumeTicketAsync(
                    osClient,
                    actorUserId,
                    param._IdentityVerificationTicket,
                    "ChangePassword",
                    expectedActionHash)
                .GetAwaiter()
                .GetResult();
            return ticketResult.Code == 1
                ? new DosResult(1)
                : new DosResult(0, null, ticketResult.Msg);
        }

        private static bool IsAuthoritativePlatformAdmin(string osClient, JObject currentUser)
        {
            var projectedAdmin = currentUser?["_IsAdmin"].Val<bool>() == true
                || currentUser?["Level"].Val<int>() >= DiyCommon.MaxRoleLevel;
            return projectedAdmin
                && PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(osClient, currentUser);
        }

        private static void RestrictDelegatedSysUserFields(SysUserParam param)
        {
            param.IsDeleted = null;
            param.LastLoginIP = null;
            param.PwdErrorCount = null;
            param.Token = null;
            param._token = null;
            param.TokenName = null;
            param._LevelLimit = null;
            param._DevBypassPwd = false;
        }

        private static void RestrictSelfServiceSysUserUpdate(SysUserParam param, string currentUserId)
        {
            param.Id = currentUserId;
            param.Account = null;
            param.OldAccount = null;
            param.Level = null;
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

        private static DosResult NoSysUserAuthorization(string osClient, string lang)
        {
            return new DosResult(0, null, DiyMessage.GetLang(osClient, "NoAuth", lang));
        }

        private static dynamic RedactSysUserAdminResult(object value)
        {
            if (value == null) return new DosResult(0, null, "系统账号可信原子未返回结果。");
            var result = JObject.FromObject(value);
            RedactSensitiveProperties(result);
            return result;
        }

        private static void RedactSensitiveProperties(JToken token)
        {
            if (token is JObject obj)
            {
                var sensitive = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    "Pwd", "PwdEncode", "NewPwd", "_EncodePwd", "_EncodeNewPwd",
                    "_IdentityVerificationTicket", "_IdentityVerificationActionHash",
                    "ContentSecurityLoginCode", "Token", "_token", "AiApiKey"
                };
                foreach (var property in obj.Properties().ToList())
                {
                    if (sensitive.Contains(property.Name)) property.Remove();
                    else RedactSensitiveProperties(property.Value);
                }
            }
            else if (token is JArray array)
            {
                foreach (var item in array) RedactSensitiveProperties(item);
            }
        }

        private static JObject ReadObject(JObject source, string name)
        {
            return source?.Properties()
                .FirstOrDefault(item => string.Equals(item.Name, name, StringComparison.OrdinalIgnoreCase))
                ?.Value as JObject;
        }

        private static string ReadText(JObject source, string name)
        {
            return source?.Properties()
                .FirstOrDefault(item => string.Equals(item.Name, name, StringComparison.OrdinalIgnoreCase))
                ?.Value?.Val<string>() ?? string.Empty;
        }

        private static string ReadFirstText(JObject source, params string[] names)
        {
            foreach (var name in names)
            {
                var value = ReadText(source, name);
                if (!value.DosIsNullOrWhiteSpace()) return value;
            }
            return string.Empty;
        }
    }
}

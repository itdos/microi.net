using System;
using System.Collections.Generic;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        private const string UserAccessKeyEngineKey = "platform-user-access-key";

        /// <summary>
        /// 访问密钥的可信原子。接口引擎负责旧路由兼容和动作编排；这里仅保留
        /// 普通 V8 不能安全承担的会话重验、一次性明文签发、哈希与匿名兑换边界。
        /// </summary>
        public DosResult ManageUserAccessKey(dynamic dynamicParam)
        {
            var denied = RequireTrustedApiEngine(UserAccessKeyEngineKey);
            if (denied != null) return denied;

            try
            {
                var request = JsonHelper.ToJObject(dynamicParam) ?? new JObject();
                var action = request["Action"]?.ToString()?.Trim();
                if (string.Equals(action, "Exchange", StringComparison.OrdinalIgnoreCase))
                    return ExchangeUserAccessKey(request);
                var currentToken = DiyToken.GetCurrentToken(false).GetAwaiter().GetResult();

                switch (action?.ToLowerInvariant())
                {
                    case "create":
                        return CreateUserAccessKey(request, currentToken);
                    case "list":
                        return ListUserAccessKeys(request, currentToken);
                    case "revoke":
                        return RevokeUserAccessKey(request, currentToken);
                    default:
                        return new DosResult(0, null, "不支持的访问密钥动作。");
                }
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "访问密钥操作失败：" + ex.Message);
            }
        }

        private static DosResult CreateUserAccessKey(JObject request, CurrentToken currentToken)
        {
            var validation = ValidateUserAccessKeyManagementTarget(
                currentToken,
                request["TargetUserId"]?.ToString(),
                out var targetUserId);
            if (validation.Code != 1) return validation;

            var targetResult = MicroiEngine.FormEngine.GetFormDataAsync<dynamic>(
                "sys_user",
                new
                {
                    OsClient = currentToken.OsClient,
                    _Where = new List<object>
                    {
                        new List<object> { "Id", "=", targetUserId },
                        new List<object> { "State", "=", 1 },
                        new List<object> { "IsDeleted", "<>", 1 }
                    },
                    _SelectFields = new[] { "Id", "Account", "Name", "State", "Level" }
                }).GetAwaiter().GetResult();
            if (targetResult.Code != 1 || targetResult.Data == null)
                return new DosResult(0, null, "目标帐号不存在或已停用。");

            var targetUser = JObject.FromObject((object)targetResult.Data);
            return UserAccessKeyService.CreateAsync(
                    currentToken.OsClient,
                    targetUser,
                    currentToken.CurrentUser,
                    request["Name"]?.ToString(),
                    UserAccessKeySecurity.ParseStringList(request["Scopes"]),
                    UserAccessKeySecurity.ParseStringList(request["AllowedRoutes"]),
                    request["RedirectPath"]?.ToString(),
                    UserAccessKeySecurity.ParseStringList(request["AllowedTableNames"]),
                    UserAccessKeySecurity.ParseStringList(request["AllowedApiEngineKeys"]),
                    UserAccessKeySecurity.ParseStringList(request["AllowedDataSourceKeys"]),
                    request["Permanent"]?.Val<bool>() == true,
                    request["ExpiresAt"]?.ToString(),
                    request["Remark"]?.ToString())
                .GetAwaiter().GetResult();
        }

        private static DosResult ListUserAccessKeys(JObject request, CurrentToken currentToken)
        {
            var validation = ValidateUserAccessKeyManagementTarget(
                currentToken,
                request["TargetUserId"]?.ToString(),
                out var targetUserId);
            if (validation.Code != 1) return validation;
            return UserAccessKeyService.ListAsync(currentToken.OsClient, targetUserId)
                .GetAwaiter().GetResult();
        }

        private static DosResult RevokeUserAccessKey(JObject request, CurrentToken currentToken)
        {
            var validation = ValidateUserAccessKeyManagementTarget(currentToken, null, out _);
            if (validation.Code != 1) return validation;
            var id = request["Id"]?.ToString()?.Trim();
            if (id.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, "访问密钥Id不能为空。");
            return UserAccessKeyService.RevokeAsync(
                    currentToken.OsClient,
                    id,
                    currentToken.CurrentUser["Id"]?.ToString(),
                    IsPlatformAdministrator(currentToken.CurrentUser))
                .GetAwaiter().GetResult();
        }

        private static DosResult ExchangeUserAccessKey(JObject request)
        {
            var osClient = request["OsClient"]?.ToString()?.Trim();
            if (osClient.DosIsNullOrWhiteSpace()) osClient = DiyToken.GetCurrentOsClient(false);
            var did = request["Did"]?.ToString()?.Trim();
            if (did.DosIsNullOrWhiteSpace())
                did = DiyHttpContext.Current?.Request?.Headers["did"].ToString();
            var ip = IPHelper.GetClientIP(DiyHttpContext.Current).Data ?? string.Empty;
            return UserAccessKeyService.ExchangeAsync(
                    osClient,
                    request["AccessKey"]?.ToString(),
                    did,
                    ip)
                .GetAwaiter().GetResult();
        }

        private static DosResult ValidateUserAccessKeyManagementTarget(
            CurrentToken currentToken,
            string requestedTargetUserId,
            out string targetUserId)
        {
            targetUserId = requestedTargetUserId?.Trim();
            var currentUser = currentToken?.CurrentUser;
            var currentUserId = currentUser?["Id"]?.ToString();
            if (currentUser == null || currentUserId.DosIsNullOrWhiteSpace())
                return new DosResult(1001, null, "请先登录。");
            if (UserAccessKeySecurity.IsSession(currentUser))
                return new DosResult(0, null, "访问密钥会话不能管理访问密钥。");
            if (targetUserId.DosIsNullOrWhiteSpace()) targetUserId = currentUserId;
            if (!IsPlatformAdministrator(currentUser)
                && !string.Equals(targetUserId, currentUserId, StringComparison.OrdinalIgnoreCase))
                return new DosResult(0, null, "无权管理其他帐号的访问密钥。");
            return new DosResult(1);
        }

        private static bool IsPlatformAdministrator(JObject currentUser)
        {
            return currentUser?["_IsAdmin"]?.Val<bool>() == true
                   || currentUser?["Level"]?.Val<int>() >= DiyCommon.MaxRoleLevel;
        }
    }
}

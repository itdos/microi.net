using System;
using System.Linq;
using System.Security.Cryptography;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    /// <summary>
    /// SysUser 与租户私有设置的最小可信原子。
    /// 业务字段校验、CRUD 和 Hook 仍由固定 Managed ApiEngine 编排；这里只保留
    /// DiyToken/租户绑定、访问密钥隔离、密码与 Secret 元数据隔离、文件路径边界。
    /// </summary>
    public partial class V8Method
    {
        private const string PlatformCreateTenantEngineKey = "platform-create-tenant";
        private const string PlatformUserUpdateProfileEngineKey = "platform-user-update-profile";
        private const string PlatformTenantSystemSettingsEngineKey = "platform-tenant-system-settings";

        /// <summary>
        /// 在执行租户个性化 Before Hook 前校验当前请求确属主租户普通登录会话。
        /// </summary>
        public DosResult AuthorizeCurrentUserTenantProvisioning()
        {
            var denied = ResolveTrustedManagedCurrentUser(
                PlatformCreateTenantEngineKey,
                true,
                0,
                out var osClient,
                out _);
            if (denied != null) return denied;
            if (!string.Equals(osClient, OsClientDefault.OsClient, StringComparison.OrdinalIgnoreCase))
                return new DosResult(1002, null, "仅主租户允许创建SaaS租户。");
            return new DosResult(1, new { OsClient = osClient });
        }

        /// <summary>
        /// 仅供 platform-create-tenant 使用。所有者、手机号、姓名和存量密码均从
        /// 当前可信登录态及当前租户 sys_user 派生，V8.Param 不能替换这些字段。
        /// </summary>
        public DosResult ProvisionCurrentUserTenant(dynamic dynamicParam)
        {
            var denied = ResolveTrustedManagedCurrentUser(
                PlatformCreateTenantEngineKey,
                true,
                0,
                out var osClient,
                out var currentUser);
            if (denied != null) return denied;
            if (!string.Equals(osClient, OsClientDefault.OsClient, StringComparison.OrdinalIgnoreCase))
                return new DosResult(1002, null, "仅主租户允许创建SaaS租户。");

            try
            {
                JObject request = JsonHelper.ToJObject((object)dynamicParam) ?? new JObject();
                var userId = currentUser["Id"].Val<string>();
                var phone = currentUser["Phone"].Val<string>();
                var userName = currentUser["Name"].Val<string>();
                string encryptedPwd = null;

                try
                {
                    var userResult = MicroiEngine.FormEngine.GetFormDataAsync("sys_user", new
                    {
                        Id = userId,
                        OsClient = osClient,
                        _SelectFields = new[] { "Id", "Pwd", "Phone", "Name" }
                    }).GetAwaiter().GetResult();
                    if (userResult.Code == 1 && userResult.Data != null)
                    {
                        var user = JObject.FromObject(userResult.Data);
                        encryptedPwd = user["Pwd"].Val<string>();
                        if (phone.DosIsNullOrWhiteSpace()) phone = user["Phone"].Val<string>();
                        if (userName.DosIsNullOrWhiteSpace()) userName = user["Name"].Val<string>();
                    }
                }
                catch
                {
                    // 与旧兼容路由保持一致：用户投影暂时不可读时使用随机不可知密码，
                    // 不把数据库异常或密码材料暴露给 V8。
                }

                if (encryptedPwd.DosIsNullOrWhiteSpace())
                {
                    var seedBytes = new byte[32];
                    using (var random = RandomNumberGenerator.Create()) random.GetBytes(seedBytes);
                    var seed = BitConverter.ToString(seedBytes).Replace("-", string.Empty);
                    encryptedPwd = EncryptHelper.DESEncode(seed);
                }

                using var allocationScope = BeginTrustedHostAllocationScope();
                return new TenantProvisioningService()
                    .ProvisionTenantAsync(
                        request["TenantKey"].Val<string>(),
                        request["SystemName"].Val<string>(),
                        userId,
                        phone,
                        userName,
                        encryptedPwd)
                    .GetAwaiter()
                    .GetResult();
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "创建租户失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 为 platform-user-update-profile 返回可信目标用户以及经租户存储边界规范化的
        /// 头像路径。昵称、邮箱、语言等普通业务校验留在接口引擎。
        /// </summary>
        public DosResult PrepareCurrentUserProfileUpdate(dynamic dynamicParam)
        {
            var denied = ResolveTrustedManagedCurrentUser(
                PlatformUserUpdateProfileEngineKey,
                true,
                0,
                out var osClient,
                out var currentUser);
            if (denied != null) return denied;

            try
            {
                JObject request = JsonHelper.ToJObject((object)dynamicParam) ?? new JObject();
                var data = new JObject
                {
                    ["UserId"] = currentUser["Id"].Val<string>(),
                    ["OsClient"] = osClient,
                    ["HasAvatar"] = HasJsonProperty(request, "Avatar"),
                    ["HasPublicAvatar"] = HasJsonProperty(request, "PublicAvatar"),
                    ["CurrentProfile"] = new JObject
                    {
                        ["Name"] = currentUser["Name"]?.DeepClone(),
                        ["Email"] = currentUser["Email"]?.DeepClone(),
                        ["Sex"] = currentUser["Sex"]?.DeepClone(),
                        ["Lang"] = currentUser["Lang"]?.DeepClone(),
                        ["Avatar"] = currentUser["Avatar"]?.DeepClone(),
                        ["PublicAvatar"] = currentUser["PublicAvatar"]?.DeepClone()
                    }
                };

                if (data["HasAvatar"].Val<bool>())
                {
                    var pathResult = NormalizeCurrentProfilePath(
                        osClient,
                        request["Avatar"].Val<string>(),
                        currentUser["Avatar"].Val<string>(),
                        "member/avatar",
                        "私有头像");
                    if (pathResult.Code != 1) return pathResult;
                    data["Avatar"] = pathResult.Data == null ? string.Empty : pathResult.Data.ToString();
                }

                if (data["HasPublicAvatar"].Val<bool>())
                {
                    var pathResult = NormalizeCurrentProfilePath(
                        osClient,
                        request["PublicAvatar"].Val<string>(),
                        currentUser["PublicAvatar"].Val<string>(),
                        "member/public-avatar",
                        "公开头像");
                    if (pathResult.Code != 1) return pathResult;
                    data["PublicAvatar"] = pathResult.Data == null ? string.Empty : pathResult.Data.ToString();
                }

                return new DosResult(1, data);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "账户资料安全校验失败：" + ex.Message);
            }
        }

        /// <summary>
        /// 校验 platform-tenant-system-settings 的管理员身份和操作边界。
        /// Secret/Sensitive Key 永远不允许进入接口引擎保存流程。
        /// </summary>
        public DosResult ValidateTenantSystemSettingsOperation(dynamic dynamicParam)
        {
            var denied = ResolveTrustedManagedCurrentUser(
                PlatformTenantSystemSettingsEngineKey,
                true,
                999,
                out var osClient,
                out var currentUser);
            if (denied != null) return denied;

            try
            {
                JObject request = JsonHelper.ToJObject((object)dynamicParam) ?? new JObject();
                var action = (request["Action"].Val<string>() ?? string.Empty).Trim();
                if (!new[] { "List", "SaveNonSecret", "Delete" }.Any(item =>
                        string.Equals(item, action, StringComparison.OrdinalIgnoreCase)))
                    return new DosResult(0, null, "不支持的租户系统设置操作。");

                var data = new JObject
                {
                    ["Action"] = action,
                    ["OsClient"] = osClient,
                    ["UserId"] = currentUser["Id"].Val<string>()
                };
                if (!string.Equals(action, "List", StringComparison.OrdinalIgnoreCase))
                {
                    var key = TenantSystemSettingsSecurity.NormalizeKey(request["ConfigKey"].Val<string>());
                    if (TenantSystemSettingsSecurity.IsMigratedPublicSettingKey(key))
                        return new DosResult(0, null,
                            "此公开开关已迁移到“系统设置 → 登录界面与入口”，不能通过私有设置管理。");
                    if (string.Equals(action, "SaveNonSecret", StringComparison.OrdinalIgnoreCase)
                        && (request["IsSecret"].Val<bool>()
                            || TenantSystemSettingsSecurity.IsSensitiveKey(key)))
                    {
                        return new DosResult(0, null,
                            "Secret 或敏感 Key 必须通过可信 TenantSystemSettings/Save 端点保存。");
                    }
                    data["ConfigKey"] = key;
                }
                return new DosResult(1, data);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, ex.Message);
            }
        }

        /// <summary>
        /// 只向固定设置引擎暴露“某行是否已保存 Secret”和迁移 Key 列表，绝不返回
        /// SecretCipher、明文或任意私有配置值。
        /// </summary>
        public DosResult GetTenantSystemSettingsSecurityProjection()
        {
            var denied = ResolveTrustedManagedCurrentUser(
                PlatformTenantSystemSettingsEngineKey,
                true,
                999,
                out var osClient,
                out _);
            if (denied != null) return denied;

            try
            {
                var secretStateById = new JObject();
                foreach (var item in TenantSystemSettingsSecurity.LoadSnapshot(osClient).Values)
                {
                    if (item?.Id.DosIsNullOrWhiteSpace() != false) continue;
                    secretStateById[item.Id] = item.IsSecret && !item.SecretCipher.DosIsNullOrWhiteSpace();
                }
                return new DosResult(1, new JObject
                {
                    ["SecretStateById"] = secretStateById,
                    ["MigratedKeys"] = new JArray(TenantSystemSettingsSecurity.MigratedPublicSettingKeys)
                });
            }
            catch
            {
                return new DosResult(0, null, "租户系统设置安全投影读取失败。");
            }
        }

        private static DosResult ResolveTrustedManagedCurrentUser(
            string apiEngineKey,
            bool rejectAccessKey,
            int minimumLevel,
            out string osClient,
            out JObject currentUser)
        {
            osClient = null;
            currentUser = null;
            var denied = RequireTrustedApiEngine(apiEngineKey);
            if (denied != null) return denied;

            try
            {
                osClient = TenantConfigurationSecurity.NormalizeTenantId(V8TenantContext.Current.OsClient);
                currentUser = V8TrustedExecutionContext.CurrentUser;
                if (currentUser != null)
                {
                    var trustedOsClient = V8TrustedExecutionContext.CurrentOsClient;
                    if (trustedOsClient.DosIsNullOrWhiteSpace()
                        || !string.Equals(trustedOsClient, osClient, StringComparison.OrdinalIgnoreCase))
                    {
                        currentUser = null;
                        return new DosResult(0, null, "请求租户与可信登录租户不一致。");
                    }
                    currentUser = currentUser.DeepClone() as JObject;
                }
                else
                {
                    var token = DiyToken.GetCurrentToken(false).GetAwaiter().GetResult();
                    if (token?.CurrentUser == null)
                        return new DosResult(1001, null, "登录身份已过期，请重新登录。");
                    if (!string.Equals(token.OsClient, osClient, StringComparison.OrdinalIgnoreCase))
                        return new DosResult(0, null, "请求租户与当前登录租户不一致。");
                    currentUser = token.CurrentUser.DeepClone() as JObject;
                }

                if (currentUser == null || currentUser["Id"].Val<string>().DosIsNullOrWhiteSpace())
                    return new DosResult(1001, null, "登录身份已过期，请重新登录。");
                if (rejectAccessKey && UserAccessKeySecurity.IsSession(currentUser))
                    return new DosResult(0, null, "访问密钥会话不能执行此操作。");
                if (minimumLevel > 0 && currentUser["Level"].Val<int>() < minimumLevel)
                    return new DosResult(0, null, "只有超级管理员可以管理租户系统设置。");
                return null;
            }
            catch (Exception ex)
            {
                currentUser = null;
                return new DosResult(0, null, "校验可信登录身份失败：" + ex.Message);
            }
        }

        private static DosResult NormalizeCurrentProfilePath(
            string osClient,
            string candidate,
            string current,
            string relativeDirectory,
            string label)
        {
            candidate = (candidate ?? string.Empty).Trim();
            current = (current ?? string.Empty).Trim();
            if (candidate.Length == 0 || string.Equals(candidate, current, StringComparison.Ordinal))
                return new DosResult(1, candidate);

            try
            {
                var normalized = TenantConfigurationSecurity.NormalizeStoragePath(osClient, candidate);
                var requiredPrefix = "/" + osClient.ToLowerInvariant() + "/" + relativeDirectory + "/";
                if (!normalized.StartsWith(requiredPrefix, StringComparison.OrdinalIgnoreCase))
                    return new DosResult(0, null, label + "文件必须来自账户头像上传目录。");
                return new DosResult(1, normalized);
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, label + "路径不合法：" + ex.Message);
            }
        }

        private static bool HasJsonProperty(JObject value, string name)
        {
            return value?.Properties().Any(property =>
                string.Equals(property.Name, name, StringComparison.OrdinalIgnoreCase)) == true;
        }
    }
}

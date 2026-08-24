using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    public partial class V8Method
    {
        private const string SsoResolveIdentityEngineKey = "sso_resolve_federated_identity";
        private const string SsoCompleteLoginEngineKey = "sso_complete_login";
        private const string SsoLegacyLoginEngineKey = "sso_legacy_token_login";
        private const string SsoRotateSecretEngineKey = "sso_rotate_client_secret";
        private static readonly TimeSpan SsoLoginTicketLifetime = TimeSpan.FromSeconds(90);

        private static DosResult RequireTrustedApiEngine(params string[] allowedKeys)
        {
            var context = V8TenantContext.Current;
            if (context == null || context.OsClient.DosIsNullOrWhiteSpace())
                return new DosResult(0, null, "可信原子能力只能在租户接口引擎上下文中调用。");
            if (!(allowedKeys ?? Array.Empty<string>()).Any(key =>
                    string.Equals(key, context.ApiEngineKey, StringComparison.OrdinalIgnoreCase)))
            {
                Console.WriteLine(
                    $"Microi：【安全】拒绝接口引擎[{context.ApiEngineKey ?? "-"}]调用可信原子能力，" +
                    $"OsClient=[{context.OsClient}]。");
                return new DosResult(0, null, "当前接口引擎无权调用该可信原子能力。");
            }
            return null;
        }

        private static string SsoAtomText(JToken token, int maxLength = 0)
        {
            var value = token == null || token.Type == JTokenType.Null
                ? string.Empty
                : (token.ToString() ?? string.Empty).Trim();
            return maxLength > 0 && value.Length > maxLength ? value.Substring(0, maxLength) : value;
        }

        private static List<string> SsoStringList(JToken token)
        {
            return SsoSecurity.ParseStringList(token)
                .Where(value => !value.DosIsNullOrWhiteSpace())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        public DosResult CreateFederatedUser(dynamic dynamicParam)
        {
            var denied = RequireTrustedApiEngine(SsoResolveIdentityEngineKey);
            if (denied != null) return denied;
            try
            {
                var request = JsonHelper.ToJObject(dynamicParam) ?? new JObject();
                var osClient = V8TenantContext.Current.OsClient;
                var account = SsoAtomText(request["Account"], 80);
                var name = SsoAtomText(request["Name"], 100);
                var email = SsoAtomText(request["Email"], 300);
                if (!Regex.IsMatch(account, "^[A-Za-z0-9][A-Za-z0-9_.@-]{1,49}$"))
                    return new DosResult(0, null, "JIT 用户帐号格式无效。");

                var existing = MicroiEngine.FormEngine.GetFormDataAsync("sys_user", new
                {
                    OsClient = osClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "Account", Type = "=", Value = account },
                        new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 }
                    }
                }).GetAwaiter().GetResult();
                if (existing.Code == 1 && existing.Data != null)
                    return new DosResult(0, null, "JIT 用户帐号已存在，请重新解析绑定关系。");

                var roleIds = SsoStringList(request["RoleIds"]);
                foreach (var roleId in roleIds)
                {
                    var roleResult = MicroiEngine.FormEngine.GetFormDataAsync("sys_role", new
                    {
                        Id = roleId,
                        OsClient = osClient,
                        _SelectFields = new[] { "Id", "Name", "Level", "IsDeleted" }
                    }).GetAwaiter().GetResult();
                    if (roleResult.Code != 1 || roleResult.Data == null)
                        return new DosResult(0, null, $"JIT 默认角色不存在：{roleId}");
                    var role = JObject.FromObject(roleResult.Data);
                    if (role["IsDeleted"].Val<int>() == 1)
                        return new DosResult(0, null, $"JIT 默认角色已删除：{roleId}");
                    if (role["Level"].Val<int>() >= DiyCommon.MaxRoleLevel)
                        return new DosResult(0, null, "SSO JIT 禁止创建平台管理员账号。");
                }

                var initialPassword = "Mi!" + SsoSecurity.NewOpaqueValue(24).Substring(0, 16) + "A7#";
                var addResult = MicroiEngine.FormEngine.AddFormDataAsync("sys_user", new JObject
                {
                    ["Account"] = account,
                    ["Name"] = name.DosIsNullOrWhiteSpace() ? account : name,
                    ["Email"] = email,
                    ["Pwd"] = PasswordHashSecurity.HashPassword(initialPassword),
                    ["PwdEncode"] = PasswordHashSecurity.EncodingName,
                    ["RoleIds"] = JsonConvert.SerializeObject(roleIds),
                    ["Level"] = 1,
                    ["State"] = 1,
                    ["IsDeleted"] = 0,
                    ["OsClient"] = osClient
                }).GetAwaiter().GetResult();
                if (addResult.Code != 1)
                    return new DosResult(addResult.Code, null, addResult.Msg ?? "JIT 用户创建失败。");

                var created = MicroiEngine.FormEngine.GetFormDataAsync("sys_user", new
                {
                    OsClient = osClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "Account", Type = "=", Value = account },
                        new DiyWhere { Name = "State", Type = "=", Value = 1 },
                        new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 }
                    }
                }).GetAwaiter().GetResult();
                if (created.Code != 1 || created.Data == null)
                    return new DosResult(0, null, "JIT 用户已创建，但安全回读失败。");
                var user = SetSysUserRoleInfo(created.Data, osClient);
                user["Pwd"] = string.Empty;
                return new DosResult(1, user);
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：SSO JIT 用户创建失败：" + ex.Message);
                return new DosResult(0, null, "SSO JIT 用户创建失败。");
            }
        }

        public DosResult CreateSsoLoginTicket(dynamic dynamicParam)
        {
            var denied = RequireTrustedApiEngine(SsoLegacyLoginEngineKey);
            if (denied != null) return denied;
            try
            {
                var request = JsonHelper.ToJObject(dynamicParam) ?? new JObject();
                var osClient = V8TenantContext.Current.OsClient;
                var userId = SsoAtomText(request["UserId"], 80);
                var connectionKey = SsoAtomText(request["ConnectionKey"], 100);
                var protocol = SsoAtomText(request["Protocol"], 20).ToUpperInvariant();
                if (userId.DosIsNullOrWhiteSpace() || connectionKey.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, "SSO 登录票据参数无效。");

                var ticket = SsoSecurity.NewOpaqueValue();
                var payload = new JObject
                {
                    ["OsClient"] = osClient,
                    ["UserId"] = userId,
                    ["ConnectionKey"] = connectionKey,
                    ["Protocol"] = protocol,
                    ["ExpiresAt"] = DateTimeOffset.UtcNow.Add(SsoLoginTicketLifetime).ToString("O")
                };
                var key = $"Microi:{osClient}:SSO:LoginTicket:{ticket}";
                var saved = MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase().StringSet(
                    key, payload.ToString(Formatting.None), SsoLoginTicketLifetime, When.NotExists);
                return saved
                    ? new DosResult(1, ticket)
                    : new DosResult(0, null, "SSO 登录票据创建失败，请重试。");
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：SSO 登录票据创建失败：" + ex.Message);
                return new DosResult(0, null, "SSO 登录票据创建失败。");
            }
        }

        public DosResult CompleteSsoLogin(dynamic dynamicParam)
        {
            var denied = RequireTrustedApiEngine(SsoCompleteLoginEngineKey, SsoLegacyLoginEngineKey);
            if (denied != null) return denied;
            try
            {
                var request = JsonHelper.ToJObject(dynamicParam) ?? new JObject();
                var osClient = V8TenantContext.Current.OsClient;
                var ticket = SsoAtomText(request["Ticket"], 512);
                if (!Regex.IsMatch(ticket, "^[A-Za-z0-9_-]{32,512}$"))
                    return new DosResult(0, null, "SSO 登录票据无效。");

                var key = $"Microi:{osClient}:SSO:LoginTicket:{ticket}";
                var raw = MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase().StringGetDelete(key);
                if (!raw.HasValue)
                    return new DosResult(0, null, "SSO 登录票据不存在、已过期或已使用。");
                var payload = JObject.Parse(raw.ToString());
                if (!SsoSecurity.FixedEquals(SsoAtomText(payload["OsClient"]), osClient)
                    || !DateTimeOffset.TryParse(SsoAtomText(payload["ExpiresAt"]), out var expiresAt)
                    || expiresAt <= DateTimeOffset.UtcNow)
                    return new DosResult(0, null, "SSO 登录票据不存在、已过期或已使用。");

                var userId = SsoAtomText(payload["UserId"], 80);
                var userResult = MicroiEngine.FormEngine.GetFormDataAsync("sys_user", new
                {
                    Id = userId,
                    OsClient = osClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "State", Type = "=", Value = 1 },
                        new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 }
                    }
                }).GetAwaiter().GetResult();
                if (userResult.Code != 1 || userResult.Data == null)
                    return new DosResult(0, null, "系统用户不存在或已停用。");
                var user = SetSysUserRoleInfo(userResult.Data, osClient);
                user["Pwd"] = string.Empty;

                var clientType = SsoAtomText(request["ClientType"], 32);
                if (clientType.DosIsNullOrWhiteSpace()) clientType = "PC";
                var did = SsoAtomText(request["Did"], 200);
                var tokenResult = new DiyToken().GetAccessToken(new DiyTokenParam
                {
                    CurrentUser = user,
                    OsClient = osClient,
                    _ClientType = clientType,
                    Did = did
                }).GetAwaiter().GetResult();
                if (tokenResult.Code != 1)
                    return new DosResult(tokenResult.Code, null, tokenResult.Msg);

                var sysConfig = MicroiEngine.FormEngine.GetSysConfig(osClient).GetAwaiter().GetResult();
                dynamic homePage = null;
                try
                {
                    homePage = new SysMenuLogic().GetSysMenuHomePage(new SysMenuParam { OsClient = osClient })
                        .GetAwaiter().GetResult().Data;
                }
                catch { }
                _ = MicroiEngine.FormEngine.UptFormDataAsync("sys_user", new
                {
                    Id = userId,
                    LastLoginIP = GetClientIP().Data,
                    LastLoginTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    OsClient = osClient
                });

                var connectionKey = SsoAtomText(payload["ConnectionKey"], 100);
                var protocol = SsoAtomText(payload["Protocol"], 20).ToUpperInvariant();
                return new DosResult(1, user)
                {
                    DataAppend = new
                    {
                        SysMenuHomePage = homePage,
                        SysConfig = sysConfig.Code == 1
                            ? TenantConfigurationSecurity.CreatePublicSysConfigProjection(sysConfig.Data, osClient)
                            : null,
                        LoginMethod = $"SSO:{protocol}:{connectionKey}",
                        ConnectionKey = connectionKey,
                        Protocol = protocol
                    }
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：SSO 登录票据消费失败：" + ex.Message);
                return new DosResult(0, null, "SSO 登录失败，请重新发起。");
            }
        }

        public DosResult RotateSsoClientSecret(dynamic dynamicParam)
        {
            var denied = RequireTrustedApiEngine(SsoRotateSecretEngineKey);
            if (denied != null) return denied;
            try
            {
                var currentToken = DiyToken.GetCurrentToken(false).GetAwaiter().GetResult();
                if (currentToken?.CurrentUser == null)
                    return new DosResult(1001, null, "登录身份已过期。");
                if (UserAccessKeySecurity.IsSession(currentToken.CurrentUser))
                    return new DosResult(0, null, "访问密钥会话不能轮换 SSO 客户端密钥。");
                if (!PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(
                        currentToken.OsClient, currentToken.CurrentUser))
                    return new DosResult(0, null, "仅平台管理员可以管理 SSO 密钥。");

                var request = JsonHelper.ToJObject(dynamicParam) ?? new JObject();
                var connectionKey = SsoAtomText(request["ConnectionKey"], 100).ToLowerInvariant();
                var connectionResult = MicroiEngine.FormEngine.GetFormDataAsync("diy_sso", new
                {
                    OsClient = currentToken.OsClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "SsoKey", Type = "=", Value = connectionKey },
                        new DiyWhere { Name = "Direction", Type = "=", Value = SsoSecurity.OutboundDirection },
                        new DiyWhere { Name = "IsEnable", Type = "=", Value = 1 }
                    }
                }).GetAwaiter().GetResult();
                if (connectionResult.Code != 1 || connectionResult.Data == null)
                    return new DosResult(0, null, "OIDC 客户端不存在。");
                var connection = SsoConnectionOptions.FromRow(JObject.FromObject(connectionResult.Data));
                if (connection == null || connection.Protocol != "OIDC" || connection.ClientSecretSettingKey.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, "OIDC 客户端或 ClientSecretSettingKey 配置无效。");

                var secret = SsoSecurity.NewOpaqueValue(48);
                var secretHash = SsoSecurity.HashClientSecret(secret);
                var settingKey = TenantSystemSettingsSecurity.NormalizeKey(connection.ClientSecretSettingKey);
                var existing = MicroiEngine.FormEngine.GetFormDataAsync(TenantSystemSettingsSecurity.TableName, new
                {
                    OsClient = currentToken.OsClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "ConfigKey", Type = "=", Value = settingKey }
                    }
                }).GetAwaiter().GetResult();
                var form = new JObject
                {
                    ["Id"] = existing.Code == 1 && existing.Data != null
                        ? JObject.FromObject(existing.Data)["Id"]?.ToString()
                        : Guid.NewGuid().ToString(),
                    ["ConfigKey"] = settingKey,
                    ["ConfigValue"] = string.Empty,
                    ["SecretCipher"] = TenantSystemSettingsSecurity.ProtectSecret(
                        currentToken.OsClient, settingKey, secretHash),
                    ["ValueType"] = "String",
                    ["Category"] = "SSO",
                    ["Description"] = $"OIDC 客户端 {connection.ClientId} 的 PBKDF2 密钥哈希",
                    ["IsPublic"] = 0,
                    ["IsSecret"] = 1,
                    ["IsEnabled"] = 1,
                    ["ValueSource"] = "RuntimeGenerated",
                    ["OsClient"] = currentToken.OsClient
                };
                var save = existing.Code == 1 && existing.Data != null
                    ? MicroiEngine.FormEngine.UptFormDataAsync(TenantSystemSettingsSecurity.TableName, form).GetAwaiter().GetResult()
                    : MicroiEngine.FormEngine.AddFormDataAsync(TenantSystemSettingsSecurity.TableName, form).GetAwaiter().GetResult();
                if (save.Code != 1) return new DosResult(save.Code, null, save.Msg ?? "租户系统设置密钥保存失败。");
                return new DosResult(1, new
                {
                    connection.ClientId,
                    ClientSecret = secret,
                    Last4 = secret.Substring(secret.Length - 4),
                    Notice = "此密钥仅显示一次，请立即保存到第三方系统的密钥管理器。"
                });
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：OIDC 客户端密钥轮换失败：" + ex.Message);
                return new DosResult(0, null, "OIDC 客户端密钥轮换失败。");
            }
        }
    }
}

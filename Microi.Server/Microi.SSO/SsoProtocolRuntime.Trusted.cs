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
    public sealed partial class SsoProtocolRuntime
    {
        /// <summary>
        /// SSO 专属可信动作实现。ApiEngineKey 白名单由 Core 的 V8Method 门面固定，
        /// 本实现不自行扩大可调用面，也不创建独立于 DiyToken 的权限体系。
        /// </summary>
        public DosResult ExecuteTrusted(string operation, JObject parameters)
        {
            switch ((operation ?? string.Empty).Trim())
            {
                case "CreateFederatedUser": return CreateFederatedUser(parameters);
                case "CreateLoginTicket": return CreateLoginTicket(parameters);
                case "CompleteLogin": return CompleteLogin(parameters);
                case "RotateClientSecret": return RotateClientSecret(parameters);
                default: return new DosResult(0, null, "不支持的 SSO 可信动作。");
            }
        }

        private static string AtomText(JToken token, int maxLength = 0)
        {
            var value = token == null || token.Type == JTokenType.Null
                ? string.Empty
                : (token.ToString() ?? string.Empty).Trim();
            return maxLength > 0 && value.Length > maxLength ? value.Substring(0, maxLength) : value;
        }

        private static List<string> StringList(JToken token) => SsoSecurity.ParseStringList(token)
            .Where(value => !value.DosIsNullOrWhiteSpace())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        private static DosResult CreateFederatedUser(JObject request)
        {
            try
            {
                request ??= new JObject();
                var osClient = V8TenantContext.Current?.OsClient;
                var account = AtomText(request["Account"], 80);
                var name = AtomText(request["Name"], 100);
                var email = AtomText(request["Email"], 300);
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

                var roleIds = StringList(request["RoleIds"]);
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
                var user = new V8Method().SetSysUserRoleInfo(created.Data, osClient);
                user["Pwd"] = string.Empty;
                return new DosResult(1, user);
            }
            catch (Exception ex)
            {
                MicroiEngine.QueueSystemLog(V8TenantContext.Current?.OsClient, "SSO", "JitUserFailed",
                    "SSO JIT 用户创建失败", ex.ToString(), 3);
                return new DosResult(0, null, "SSO JIT 用户创建失败。");
            }
        }

        private static DosResult CreateLoginTicket(JObject request)
        {
            try
            {
                request ??= new JObject();
                var osClient = V8TenantContext.Current?.OsClient;
                var userId = AtomText(request["UserId"], 80);
                var connectionKey = AtomText(request["ConnectionKey"], 100);
                var protocol = AtomText(request["Protocol"], 20).ToUpperInvariant();
                if (userId.DosIsNullOrWhiteSpace() || connectionKey.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, "SSO 登录票据参数无效。");
                var ticket = SsoSecurity.NewOpaqueValue();
                var payload = new JObject
                {
                    ["OsClient"] = osClient,
                    ["UserId"] = userId,
                    ["ConnectionKey"] = connectionKey,
                    ["Protocol"] = protocol,
                    ["ExpiresAt"] = DateTimeOffset.UtcNow.Add(LoginTicketLifetime).ToString("O")
                };
                var saved = MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase().StringSet(
                    $"Microi:{osClient}:SSO:LoginTicket:{ticket}", payload.ToString(Formatting.None),
                    LoginTicketLifetime, When.NotExists);
                return saved ? new DosResult(1, ticket) : new DosResult(0, null, "SSO 登录票据创建失败，请重试。");
            }
            catch { return new DosResult(0, null, "SSO 登录票据创建失败。"); }
        }

        private static DosResult CompleteLogin(JObject request)
        {
            try
            {
                request ??= new JObject();
                var osClient = V8TenantContext.Current?.OsClient;
                var ticket = AtomText(request["Ticket"], 512);
                if (!Regex.IsMatch(ticket, "^[A-Za-z0-9_-]{32,512}$"))
                    return new DosResult(0, null, "SSO 登录票据无效。");
                var raw = MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase()
                    .StringGetDelete($"Microi:{osClient}:SSO:LoginTicket:{ticket}");
                if (!raw.HasValue) return new DosResult(0, null, "SSO 登录票据不存在、已过期或已使用。");
                var payload = JObject.Parse(raw.ToString());
                if (!SsoSecurity.FixedEquals(AtomText(payload["OsClient"]), osClient)
                    || !DateTimeOffset.TryParse(AtomText(payload["ExpiresAt"]), out var expiresAt)
                    || expiresAt <= DateTimeOffset.UtcNow)
                    return new DosResult(0, null, "SSO 登录票据不存在、已过期或已使用。");

                var userId = AtomText(payload["UserId"], 80);
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
                var user = new V8Method().SetSysUserRoleInfo(userResult.Data, osClient);
                user["Pwd"] = string.Empty;
                var clientType = AtomText(request["ClientType"], 32).DosIsNullOrWhiteSpace("PC");
                var tokenResult = new DiyToken().GetAccessToken(new DiyTokenParam
                {
                    CurrentUser = user,
                    OsClient = osClient,
                    _ClientType = clientType,
                    Did = AtomText(request["Did"], 200)
                }).GetAwaiter().GetResult();
                if (tokenResult.Code != 1) return new DosResult(tokenResult.Code, null, tokenResult.Msg);

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
                    LastLoginIP = IPHelper.GetClientIP(DiyHttpContext.Current).Data,
                    LastLoginTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    OsClient = osClient
                });
                var connectionKey = AtomText(payload["ConnectionKey"], 100);
                var protocol = AtomText(payload["Protocol"], 20).ToUpperInvariant();
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
            catch { return new DosResult(0, null, "SSO 登录失败，请重新发起。"); }
        }

        private static DosResult RotateClientSecret(JObject request)
        {
            try
            {
                var currentToken = DiyToken.GetCurrentToken(false).GetAwaiter().GetResult();
                if (currentToken?.CurrentUser == null) return new DosResult(1001, null, "登录身份已过期。");
                if (UserAccessKeySecurity.IsSession(currentToken.CurrentUser))
                    return new DosResult(0, null, "访问密钥会话不能轮换 SSO 客户端密钥。");
                if (!PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(currentToken.OsClient, currentToken.CurrentUser))
                    return new DosResult(0, null, "仅平台管理员可以管理 SSO 密钥。");

                var connectionKey = AtomText(request?["ConnectionKey"], 100).ToLowerInvariant();
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
                var settingKey = TenantSystemSettingsSecurity.NormalizeKey(connection.ClientSecretSettingKey);
                var existing = MicroiEngine.FormEngine.GetFormDataAsync(TenantSystemSettingsSecurity.TableName, new
                {
                    OsClient = currentToken.OsClient,
                    _Where = new List<DiyWhere> { new DiyWhere { Name = "ConfigKey", Type = "=", Value = settingKey } }
                }).GetAwaiter().GetResult();
                var form = new JObject
                {
                    ["Id"] = existing.Code == 1 && existing.Data != null
                        ? JObject.FromObject(existing.Data)["Id"]?.ToString()
                        : Guid.NewGuid().ToString(),
                    ["ConfigKey"] = settingKey,
                    ["ConfigValue"] = string.Empty,
                    ["SecretCipher"] = TenantSystemSettingsSecurity.ProtectSecret(
                        currentToken.OsClient, settingKey, SsoSecurity.HashClientSecret(secret)),
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
            catch { return new DosResult(0, null, "OIDC 客户端密钥轮换失败。"); }
        }
    }
}

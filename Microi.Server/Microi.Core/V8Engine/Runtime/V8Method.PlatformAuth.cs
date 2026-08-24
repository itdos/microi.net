using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    public partial class V8Method
    {
        private const string PlatformSmsLoginEngineKey = "platform_auth_sms_login";
        private static readonly TimeSpan PlatformSmsProofLifetime = TimeSpan.FromMinutes(2);

        public DosResult CreatePlatformSmsProof(dynamic dynamicParam)
        {
            var denied = RequireTrustedApiEngine(PlatformSmsLoginEngineKey);
            if (denied != null) return denied;
            try
            {
                var request = JsonHelper.ToJObject(dynamicParam) ?? new JObject();
                var osClient = V8TenantContext.Current.OsClient;
                var phone = SsoAtomText(request["Phone"], 32);
                var code = SsoAtomText(request["Code"], 32);
                if (!Regex.IsMatch(phone, "^1[0-9]{10}$") || code.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, "手机号或短信验证码无效。");

                var database = MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase();
                var attemptKey = $"Microi:{osClient}:PlatformAuth:SmsAttempt:{phone}";
                var attempts = database.StringIncrement(attemptKey);
                if (attempts == 1) database.KeyExpire(attemptKey, TimeSpan.FromMinutes(5));
                if (attempts > 10)
                    return new DosResult(0, null, "短信验证码尝试过于频繁，请稍后再试。");

                const string script = @"
local value = redis.call('get', KEYS[1])
if not value then return 0 end
if value ~= ARGV[1] and value ~= 'Allow' then return -1 end
redis.call('del', KEYS[1])
return 1";
                var status = (long)database.ScriptEvaluate(
                    script,
                    new RedisKey[] { $"Microi:{osClient}:SmsCaptcha:{phone}" },
                    new RedisValue[] { code });
                if (status == 0) return new DosResult(0, null, "未获取短信验证码或验证码已过期！");
                if (status != 1) return new DosResult(0, null, "短信验证码错误！");

                var proof = SsoSecurity.NewOpaqueValue(32);
                var payload = new JObject
                {
                    ["OsClient"] = osClient,
                    ["Phone"] = phone,
                    ["ExpiresAt"] = DateTimeOffset.UtcNow.Add(PlatformSmsProofLifetime).ToString("O")
                };
                var saved = database.StringSet(
                    PlatformSmsProofKey(osClient, proof),
                    payload.ToString(Formatting.None),
                    PlatformSmsProofLifetime,
                    When.NotExists);
                return saved
                    ? new DosResult(1, proof)
                    : new DosResult(0, null, "短信登录证明创建失败，请重试。");
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：短信登录证明创建失败：" + ex.Message);
                return new DosResult(0, null, "短信验证码验证失败，请稍后重试。");
            }
        }

        public DosResult CreatePlatformSmsUser(dynamic dynamicParam)
        {
            var denied = RequireTrustedApiEngine(PlatformSmsLoginEngineKey);
            if (denied != null) return denied;
            try
            {
                var request = JsonHelper.ToJObject(dynamicParam) ?? new JObject();
                var osClient = V8TenantContext.Current.OsClient;
                var proof = SsoAtomText(request["Proof"], 256);
                var phone = SsoAtomText(request["Phone"], 32);
                var proofPayload = ReadPlatformSmsProof(osClient, proof);
                if (proofPayload == null || !SsoSecurity.FixedEquals(
                        SsoAtomText(proofPayload["Phone"]), phone))
                    return new DosResult(0, null, "短信登录证明不存在或已过期。");
                if (!Regex.IsMatch(phone, "^1[0-9]{10}$"))
                    return new DosResult(0, null, "手机号格式无效。");

                var existing = MicroiEngine.FormEngine.GetFormDataAsync("sys_user", new
                {
                    OsClient = osClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "Phone", Type = "=", Value = phone }
                    }
                }).GetAwaiter().GetResult();
                if (existing.Code == 1 && existing.Data != null)
                    return new DosResult(0, null, "手机号已注册，请直接登录。");
                if (existing.Code != 1 && existing.Code != 2)
                    return new DosResult(0, null, existing.Msg ?? "注册前用户查询失败。");

                var passwordProvided = !SsoAtomText(request["Password"]).DosIsNullOrWhiteSpace();
                var password = passwordProvided
                    ? SsoAtomText(request["Password"], 200)
                    : "Mi!" + SsoSecurity.NewOpaqueValue(16).Substring(0, 10) + "A7#";
                var passwordError = new SysUserLogic().CheckPwd(password).GetAwaiter().GetResult();
                if (!passwordError.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, passwordError);

                var add = MicroiEngine.FormEngine.AddFormDataAsync("sys_user", new JObject
                {
                    ["Account"] = phone,
                    ["Phone"] = phone,
                    ["Pwd"] = PasswordHashSecurity.HashPassword(password),
                    ["PwdEncode"] = PasswordHashSecurity.EncodingName,
                    ["Name"] = phone,
                    ["Level"] = 1,
                    ["State"] = 1,
                    ["IsDeleted"] = 0,
                    ["RoleIds"] = "[]",
                    ["OsClient"] = osClient
                }).GetAwaiter().GetResult();
                if (add.Code != 1)
                    return new DosResult(0, null, add.Msg ?? "注册失败。");

                var created = MicroiEngine.FormEngine.GetFormDataAsync("sys_user", new
                {
                    OsClient = osClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "Phone", Type = "=", Value = phone },
                        new DiyWhere { Name = "State", Type = "=", Value = 1 },
                        new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 }
                    }
                }).GetAwaiter().GetResult();
                if (created.Code != 1 || created.Data == null)
                    return new DosResult(0, null, "用户已注册，但安全回读失败。");
                var user = SetSysUserRoleInfo(created.Data, osClient);
                user["Pwd"] = string.Empty;
                user["PwdEncode"] = string.Empty;
                return new DosResult(1, user);
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：短信用户注册失败：" + ex.Message);
                return new DosResult(0, null, "注册失败，请稍后重试。");
            }
        }

        public DosResult CompletePlatformSmsLogin(dynamic dynamicParam)
        {
            var denied = RequireTrustedApiEngine(PlatformSmsLoginEngineKey);
            if (denied != null) return denied;
            try
            {
                var request = JsonHelper.ToJObject(dynamicParam) ?? new JObject();
                var osClient = V8TenantContext.Current.OsClient;
                var proof = SsoAtomText(request["Proof"], 256);
                var userId = SsoAtomText(request["UserId"], 80);
                var phone = SsoAtomText(request["Phone"], 32);
                var database = MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase();
                var rawProof = database.StringGetDelete(PlatformSmsProofKey(osClient, proof));
                if (!rawProof.HasValue)
                    return new DosResult(0, null, "短信登录证明不存在、已过期或已使用。");
                var proofPayload = JObject.Parse(rawProof.ToString());
                if (!DateTimeOffset.TryParse(
                        SsoAtomText(proofPayload["ExpiresAt"]),
                        out DateTimeOffset expiresAt)
                    || expiresAt <= DateTimeOffset.UtcNow)
                    return new DosResult(0, null, "短信登录证明不存在、已过期或已使用。");
                if (!SsoSecurity.FixedEquals(SsoAtomText(proofPayload["OsClient"]), osClient)
                    || !SsoSecurity.FixedEquals(SsoAtomText(proofPayload["Phone"]), phone))
                    return new DosResult(0, null, "短信登录证明不存在、已过期或已使用。");

                var userResult = MicroiEngine.FormEngine.GetFormDataAsync("sys_user", new
                {
                    Id = userId,
                    OsClient = osClient,
                    _Where = new List<DiyWhere>
                    {
                        new DiyWhere { Name = "Phone", Type = "=", Value = phone },
                        new DiyWhere { Name = "State", Type = "=", Value = 1 },
                        new DiyWhere { Name = "IsDeleted", Type = "=", Value = 0 }
                    }
                }).GetAwaiter().GetResult();
                if (userResult.Code != 1 || userResult.Data == null)
                    return new DosResult(0, null, "系统用户不存在或已停用。");
                var user = SetSysUserRoleInfo(userResult.Data, osClient);
                user["Pwd"] = string.Empty;
                user["PwdEncode"] = string.Empty;

                var clientType = SsoAtomText(request["ClientType"], 32);
                if (clientType.DosIsNullOrWhiteSpace()) clientType = "PC";
                var tokenResult = new DiyToken().GetAccessToken(new DiyTokenParam
                {
                    CurrentUser = user,
                    OsClient = osClient,
                    _ClientType = clientType,
                    Did = SsoAtomText(request["Did"], 200)
                }).GetAwaiter().GetResult();
                if (tokenResult.Code != 1 || tokenResult.Data == null)
                    return new DosResult(tokenResult.Code, null, tokenResult.Msg ?? "登录令牌生成失败。");
                var accessToken = tokenResult.Data.Token ?? string.Empty;
                user["Authorization"] = accessToken;

                var passwordProvided = request.Value<bool?>("PasswordProvided") == true;
                if (!passwordProvided && !accessToken.DosIsNullOrWhiteSpace())
                {
                    database.StringSet(
                        $"Microi:{osClient}:SmsPasswordGrant:{userId}",
                        PlatformAccessTokenHash(accessToken),
                        TimeSpan.FromMinutes(10));
                }

                var sysConfig = MicroiEngine.FormEngine.GetSysConfig(osClient).GetAwaiter().GetResult();
                dynamic homePage = null;
                try
                {
                    homePage = new SysMenuLogic().GetSysMenuHomePage(new SysMenuParam { OsClient = osClient })
                        .GetAwaiter().GetResult().Data;
                }
                catch { }
                var tenantResult = new TenantProvisioningService().GetUserTenant(userId);
                var tenant = tenantResult.Code == 1 && tenantResult.Data != null
                    ? JObject.FromObject(tenantResult.Data)
                    : null;
                _ = MicroiEngine.FormEngine.UptFormDataAsync("sys_user", new
                {
                    Id = userId,
                    LastLoginIP = GetClientIP().Data,
                    LastLoginTime = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss"),
                    OsClient = osClient
                });

                var isNewUser = request.Value<bool?>("IsNewUser") == true;
                return new DosResult(1, user, isNewUser ? "注册并登录成功" : "登录成功")
                {
                    DataAppend = new
                    {
                        SysMenuHomePage = homePage,
                        SysConfig = sysConfig.Code == 1
                            ? TenantConfigurationSecurity.CreatePublicSysConfigProjection(sysConfig.Data, osClient)
                            : null,
                        IsNewUser = isNewUser,
                        Token = accessToken,
                        TenantOsClient = tenant?["OsClient"]?.ToString(),
                        TenantName = tenant?["ClientName"]?.ToString()
                    }
                };
            }
            catch (Exception ex)
            {
                Console.WriteLine("Microi：短信登录完成失败：" + ex.Message);
                return new DosResult(0, null, "短信登录失败，请稍后重试。");
            }
        }

        private static JObject ReadPlatformSmsProof(string osClient, string proof)
        {
            if (proof.DosIsNullOrWhiteSpace()) return null;
            try
            {
                var raw = MicroiEngine.CacheTenant.Cache(osClient).GetIDatabase()
                    .StringGet(PlatformSmsProofKey(osClient, proof));
                if (!raw.HasValue) return null;
                var payload = JObject.Parse(raw.ToString());
                return SsoSecurity.FixedEquals(SsoAtomText(payload["OsClient"]), osClient)
                       && DateTimeOffset.TryParse(SsoAtomText(payload["ExpiresAt"]), out var expiresAt)
                       && expiresAt > DateTimeOffset.UtcNow
                    ? payload
                    : null;
            }
            catch { return null; }
        }

        private static string PlatformAccessTokenHash(string token)
        {
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes((token ?? string.Empty).Trim()));
            return BitConverter.ToString(bytes).Replace("-", string.Empty);
        }

        private static string PlatformSmsProofKey(string osClient, string proof) =>
            $"Microi:{osClient}:PlatformAuth:SmsProof:{SsoSecurity.HashOpaqueToken(proof ?? string.Empty)}";
    }
}

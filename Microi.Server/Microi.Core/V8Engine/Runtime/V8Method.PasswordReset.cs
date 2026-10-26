using System;
using System.Collections.Generic;
using System.Linq;
using Dos.Common;
using Dos.ORM;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    public partial class V8Method
    {
        private const string PasswordResetEngineKey = "official_password_reset";

        // 比较、限次和消费在共享 Redis 一次完成，多 API 节点不能重复使用同一验证码。
        // 不接受旧的 Allow 魔法值；重置登录密码必须持有实际短信验证码。
        internal const string PasswordResetSmsConsumeScript = @"
local attempts = tonumber(redis.call('get', KEYS[2]) or '0') or 0
if attempts >= 6 then return -2 end
local value = redis.call('get', KEYS[1])
if not value then return 0 end
if value ~= ARGV[1] then
  redis.call('set', KEYS[2], attempts + 1, 'EX', 600)
  return -1
end
redis.call('del', KEYS[1], KEYS[2], KEYS[3])
return 1";

        /// <summary>固定官网 Managed 入口的可信短信重置能力，密码与编码必须一起更新。</summary>
        public DosResult ResetPlatformSmsPassword(dynamic dynamicParam)
        {
            var denied = RequireTrustedApiEngine(PasswordResetEngineKey);
            if (denied != null) return denied;
            var tenant = V8TenantContext.Current.OsClient;
            var request = JsonHelper.ToJObject((object)dynamicParam) ?? new JObject();
            var lang = request["_Lang"]?.ToString();
            DosResult Fail(string key) => new DosResult(0, null, DiyMessage.GetLang(tenant, key, lang));
            try
            {
                var error = PasswordResetSecurity.Validate(request);
                if (error != null) return Fail(error);
                var transaction = V8TenantContext.CurrentDbTrans;
                if (transaction == null || transaction.IsCommitOrRollback) return Fail("PasswordResetFailed");
                var phone = request["Phone"].ToString().Trim();
                var password = request["NewPassword"].ToString();
                var passwordError = new SysUserLogic().CheckPwd(password, lang).GetAwaiter().GetResult();
                if (!passwordError.DosIsNullOrWhiteSpace()) return new DosResult(0, null, passwordError);

                var users = transaction.FromSql("SELECT Id,Phone,State,IsDeleted,Pwd,PwdEncode FROM sys_user WHERE Phone=@Phone AND (IsDeleted IS NULL OR IsDeleted=0)")
                    .AddInParameter("Phone", phone).ToList<dynamic>();
                if (users.Count != 1) return Fail("PasswordResetUserUnavailable");
                var user = JObject.FromObject((object)users[0]);
                if (!PasswordResetSecurity.IsResettable(user)) return Fail("PasswordResetUserUnavailable");
                var key = $"Microi:{tenant}:SmsCaptcha:{phone}";
                var status = (long)MicroiEngine.CacheTenant.Cache(tenant).GetIDatabase().ScriptEvaluate(
                    PasswordResetSmsConsumeScript,
                    new RedisKey[] { key, $"Microi:{tenant}:OfficialPwdReset:SmsFail:{phone}", key + "_time" },
                    new RedisValue[] { request["SmsCode"].ToString().Trim() });
                if (status == -2) return Fail("PasswordResetSmsLimited");
                if (status != 1) return Fail("PasswordResetInvalidSms");
                var hash = PasswordResetSecurity.HashVerifiedPassword(status, password);

                // 验证码已消费时失败要求重新获取；不能恢复验证码造成并发重放窗口。
                if (!WritePasswordCredential(transaction, tenant, user, hash)) return Fail("PasswordResetConflict");
                QueuePasswordResetAudit(tenant, user["Id"].ToString(), "SmsPasswordReset");
                return new DosResult(1, null, DiyMessage.GetLang(tenant, "PasswordResetSuccess", lang));
            }
            catch (Exception error)
            {
                // 请求含密码及短信码，异常仅记录类型，不记录参数、SQL或异常正文。
                Console.WriteLine($"Microi：[SmsPasswordReset] {error.GetType().Name}");
                return Fail("PasswordResetFailed");
            }
        }

        /// <summary>管理员显式选择用户后，诊断/修复被旧短信入口破坏的编码；不接受新密码。</summary>
        public DosResult RepairPlatformPasswordEncoding(dynamic dynamicParam)
        {
            var denied = ResolveTrustedManagedCurrentUser(PlatformSysUserAdminEngineKey, true, 0,
                out var tenant, out var actor);
            if (denied != null) return denied;
            if (!IsAuthoritativePlatformAdmin(tenant, actor)) return new DosResult(0, null, "仅平台管理员可修复登录密码编码。");
            try
            {
                var request = JsonHelper.ToJObject((object)dynamicParam) ?? new JObject();
                var ids = PasswordResetSecurity.ReadRepairUserIds(request);
                if (ids == null) return new DosResult(0, null, "请明确提供 1 至 20 个用户 Id。");
                var dryRun = request["DryRun"]?.Value<bool>() != false;
                if (!dryRun && request["ConfirmExecution"]?.ToString() != "REPAIR_PASSWORD_ENCODING")
                    return new DosResult(0, null, "请确认修复选定用户的登录密码编码。");
                var transaction = V8TenantContext.CurrentDbTrans;
                if (transaction == null || transaction.IsCommitOrRollback) return new DosResult(0, null, "密码编码修复缺少共享事务。");
                var results = new JArray();
                foreach (var id in ids)
                {
                    var data = transaction.FromSql("SELECT Id,Phone,State,IsDeleted,Pwd,PwdEncode FROM sys_user WHERE Id=@Id")
                        .AddInParameter("Id", id).First<dynamic>();
                    var user = data == null ? null : JObject.FromObject((object)data);
                    var classification = PasswordResetSecurity.Classify(user);
                    var repairable = classification == "LegacyCipherWithHashEncoding";
                    if (!dryRun && repairable)
                    {
                        var hash = PasswordResetSecurity.CreateRepairedHash(user);
                        if (hash == null || !WritePasswordCredential(transaction, tenant, user, hash))
                            return new DosResult(0, null, "用户资料已变化或会话撤销失败，本次修复未提交，请重新预览。");
                        QueuePasswordResetAudit(tenant, id, "RepairPasswordEncoding");
                    }
                    results.Add(new JObject { ["Id"] = id, ["Classification"] = classification,
                        ["WillRepair"] = dryRun && repairable, ["Repaired"] = !dryRun && repairable });
                }
                return new DosResult(1, new JObject { ["DryRun"] = dryRun, ["Users"] = results });
            }
            catch (Exception error)
            {
                Console.WriteLine($"Microi：[RepairPasswordEncoding] {error.GetType().Name}");
                return new DosResult(0, null, "密码编码修复失败，本次事务未提交。");
            }
        }

        private static bool WritePasswordCredential(DbTrans transaction, string tenant, JObject user, string hash)
        {
            var id = user["Id"].ToString();
            var revoked = OnlineTerminalService.RevokeUserSessionsFromTrustedHostAsync(tenant, id,
                "登录密码已更新，请重新登录。").GetAwaiter().GetResult();
            if (revoked.Code != 1) return false;
            // 以读到的密码材料和状态做 CAS，避免覆盖同时发生的改密、封禁或删除。
            var affected = transaction.FromSql(@"UPDATE sys_user SET Pwd=@Pwd,PwdEncode=@Encoding,UpdateTime=@Now
WHERE Id=@Id AND Pwd=@ExpectedPwd AND State=@State AND (IsDeleted IS NULL OR IsDeleted=0)
AND (Phone=@ExpectedPhone OR (Phone IS NULL AND @ExpectedPhone IS NULL))
AND (PwdEncode=@ExpectedEncoding OR (PwdEncode IS NULL AND @ExpectedEncoding IS NULL))")
                .AddInParameter("Pwd", hash).AddInParameter("Encoding", PasswordHashSecurity.EncodingName)
                .AddInParameter("Now", DateTime.Now).AddInParameter("Id", id)
                .AddInParameter("ExpectedPwd", user["Pwd"]?.ToString())
                .AddInParameter("ExpectedPhone", user["Phone"]?.Type == JTokenType.Null ? null : user["Phone"]?.ToString())
                .AddInParameter("ExpectedEncoding", user["PwdEncode"]?.Type == JTokenType.Null ? null : user["PwdEncode"]?.ToString())
                .AddInParameter("State", user["State"].Value<int>()).ExecuteNonQuery();
            if (affected != 1) return false;
            // 提交前先撤销以便失败关闭，提交后再撤销消除改密事务期间旧密码登录的会话。
            transaction.RegisterAfterCommit(() =>
            {
                CompletePasswordResetSessionRevocation(
                    () => OnlineTerminalService.RevokeUserSessionsFromTrustedHostAsync(
                        tenant, id, "登录密码已更新，请重新登录。").GetAwaiter().GetResult(),
                    () => MicroiEngine.QueueSysLog(new SysLogParam
                    {
                        OsClient = tenant, Category = "Security", Action = "PasswordResetSessionRevocationFailed",
                        TargetType = "SysUser", TargetId = id, Type = "账号安全",
                        Title = "密码已更新但提交后会话撤销失败", Content = "UserId:" + id,
                        Success = false, OccurredAt = DateTime.Now, Level = 3
                    }));
            });
            // 独立登记，缓存失效失败不能阻止前面的会话撤销回调。
            transaction.RegisterAfterCommit(() => FormEngineAuthorizationCache.InvalidateAsync(tenant).GetAwaiter().GetResult());
            return true;
        }

        internal static void CompletePasswordResetSessionRevocation(Func<DosResult> revoke, Action failureAudit)
        {
            // 共享锁已包含短暂竞争重试；提交后仅额外尝试一次，不把已提交密码声称为回滚。
            for (var attempt = 0; attempt < 2; attempt++)
            {
                try { if (revoke()?.Code == 1) return; }
                catch { /* 不保留可能含敏感缓存数据的异常正文。 */ }
            }
            try { failureAudit(); }
            finally
            {
                // DbTrans 会独立记录此诊断，并继续后续缓存失效与凭据更新审计。
                throw new InvalidOperationException("PasswordResetSessionRevocationFailed");
            }
        }

        private static void QueuePasswordResetAudit(string tenant, string id, string action)
        {
            V8TenantContext.CurrentDbTrans.RegisterAfterCommit(() => MicroiEngine.QueueSysLog(new SysLogParam
            {
                OsClient = tenant, Category = "Security", Action = action, TargetType = "SysUser", TargetId = id,
                Type = "账号安全", Title = "登录密码已安全更新", Content = "UserId:" + id,
                Success = true, OccurredAt = DateTime.Now, Level = 1
            }));
        }
    }
}

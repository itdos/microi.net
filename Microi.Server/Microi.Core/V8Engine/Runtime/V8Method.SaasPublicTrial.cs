using System;
using System.Linq;
using System.Globalization;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    public partial class V8Method
    {
        /// <summary>固定公开接口的能力票据、验证码、有界任务队列及最小进度投影。</summary>
        public DosResult SaasPublicTrialAtom(object parameters)
        {
            var denied = RequireTrustedApiEngine(SaasPromotionSecurity.PublicEngine);
            if (denied != null) return denied;
            if (!V8TenantContext.Current.IsMaster) return new DosResult(1002, null, "此部署仅允许主租户提供公开试用入口。");
            var phase = "ValidateLink";
            try
            {
                var request = ToJObject(parameters);
                var action = request["Action"]?.ToString();
                if (SaasPromotionSecurity.ValidRequestId(request["RequestId"]?.ToString()))
                    request["RequestId"] = Guid.Parse(request["RequestId"].ToString()).ToString("D");
                if (action == "Progress") { phase = "Progress"; return ReadPublicTrialProgress(request); }
                var link = ValidateSaasPublicLink(request, out var config);
                if (action == "Bootstrap") return new DosResult(1, new
                {
                    Title = config["ClientName"]?.ToString(), Campaign = link["Title"]?.ToString(),
                    TrialDays = PublicTrialDays(link, config), RequiresCaptcha = true,
                    ReferralUserId = link["ReferralUserId"]?.ToString()
                });
                if (action != "Queue") return new DosResult(0, null, "不支持的公开试用动作。");
                phase = "Queue";
                return QueuePublicTrial(request, link, config);
            }
            catch (Exception error)
            {
                // 控制台只记录阶段和调用栈，不记录密码、能力票据、连接或请求正文。
                Console.WriteLine($"Microi：[SaasPublicTrial] Phase={phase}; ErrorType={error.GetType().FullName}; Stack={error.StackTrace}");
                return phase == "ValidateLink"
                    ? new DosResult(0, null, "推广链接已失效、公开开通未启用或配置尚未就绪，请联系推荐人。")
                    : new DosResult(0, new { ReasonCode = "PUBLIC_TRIAL_" + phase.ToUpperInvariant() + "_FAILED" },
                        phase == "Queue" ? "开通申请暂未完成登记，请保留相同申请编号稍后重试。" : "申请状态暂不可读，请稍后重试。");
            }
        }

        private static JObject ValidateSaasPublicLink(JObject request, out JObject config)
        {
            config = ReadSaasPromotionMainConfiguration();
            if (!SaasPromotionSecurity.Flag(config["SaasPublicTrialEnabled"])) throw new InvalidOperationException();
            var token = request["LinkToken"]?.ToString() ?? "";
            if (token.Length < 32 || token.Length > 4096) throw new InvalidOperationException();
            var proof = SaasPromotionSecurity.ParseCapabilityPayload(TenantSystemSettingsSecurity.UnprotectSecret(OsClientDefault.OsClient, "Saas.ReferralCapability", token));
            if (!string.Equals(proof["Type"]?.ToString(), OsClientDefault.OsClientType, StringComparison.OrdinalIgnoreCase)
                || !string.Equals(proof["Network"]?.ToString(), OsClientDefault.OsClientNetwork, StringComparison.OrdinalIgnoreCase)
                || !DateTimeOffset.TryParse(proof["Expires"]?.ToString(), out var expires) || expires <= DateTimeOffset.UtcNow)
                throw new InvalidOperationException();
            var link = ReadSaasReferralLink(proof["LinkId"]?.ToString());
            if (link == null || !SaasPromotionSecurity.Flag(link["IsEnable"])
                || !OpaqueTokenSecurity.FixedEquals(proof["Revision"]?.ToString(), link["CapabilityRevision"]?.ToString())
                || !OpaqueTokenSecurity.FixedEquals(proof["ReferralUserId"]?.ToString(), link["ReferralUserId"]?.ToString())
                || !OpaqueTokenSecurity.FixedEquals(request["ReferralUserId"]?.ToString(), link["ReferralUserId"]?.ToString()))
                throw new InvalidOperationException();
            if (!string.IsNullOrWhiteSpace(link["ExpiresAt"]?.ToString())
                && (!DateTimeOffset.TryParse(link["ExpiresAt"]?.ToString(), out var deadline) || deadline <= DateTimeOffset.UtcNow))
                throw new InvalidOperationException();
            var owner = OsClientExtend.GetClient(OsClientDefault.OsClient).Db.FromSql("SELECT State,IsDeleted FROM sys_user WHERE Id=@id")
                .AddInParameter("id", link["ReferralUserId"]?.ToString()).First<dynamic>();
            var user = owner == null ? null : JObject.FromObject((object)owner);
            if (user == null || user["State"].Val<int>() != 1 || user["IsDeleted"].Val<int>() == 1) throw new InvalidOperationException();
            return link;
        }

        private static int PublicTrialDays(JObject link, JObject config) =>
            Math.Max(1, Math.Min(90, link["TrialDays"].Val<int?>() ?? config["SaasPublicTrialDays"].Val<int?>() ?? 14));

        private static bool IsSafePublicTrialBase(string value)
        {
            return Uri.TryCreate(value, UriKind.Absolute, out var uri) && string.IsNullOrEmpty(uri.UserInfo)
                && string.IsNullOrEmpty(uri.Query) && string.IsNullOrEmpty(uri.Fragment)
                && (uri.Scheme == "https" || uri.Scheme == "http" && uri.IsLoopback);
        }

        private static DosResult QueuePublicTrial(JObject request, JObject link, JObject config)
        {
            if (!string.Equals(OsClientDefault.OsClientDbType, "MySql", StringComparison.OrdinalIgnoreCase))
                return new DosResult(0, null, "当前公开标准空库开通仅支持 MySQL/MariaDB 部署。");
            var id = request["RequestId"]?.ToString(); var key = request["TenantKey"]?.ToString();
            var password = request["AdminPassword"]?.ToString() ?? "";
            if (!SaasPromotionSecurity.ValidRequestId(id) || !SaasPromotionSecurity.ValidTenantKey(key)
                || password.Length < 10 || password.Length > 128
                || string.IsNullOrWhiteSpace(request["SystemName"]?.ToString()) || request["SystemName"].ToString().Length > 100
                || string.IsNullOrWhiteSpace(request["ContactName"]?.ToString()) || request["ContactName"].ToString().Length > 60
                || !SaasPromotionSecurity.ValidContactPhone(request["ContactPhone"]?.ToString()))
                return new DosResult(0, null, "租户标识、系统名称、联系人、联系电话或密码格式不正确。");
            var web = (config["SaasPublicTrialWebBase"]?.ToString() ?? "").Trim().TrimEnd('/');
            var sys = OsClientExtend.GetClient(OsClientDefault.OsClient).Db.FromSql(
                "SELECT ApiBase FROM sys_config WHERE IsEnable=1 AND (IsDeleted IS NULL OR IsDeleted=0)").First<dynamic>();
            var api = sys == null ? "" : JObject.FromObject((object)sys)["ApiBase"]?.ToString()?.Trim().TrimEnd('/');
            if (!IsSafePublicTrialBase(web) || !IsSafePublicTrialBase(api))
                return new DosResult(0, null, "主租户管理员需先配置可信的 Web 开通地址和系统 ApiBase。");
            var principalId = SaasPromotionSecurity.PublicTrialPrincipalId(id);
            var idem = "public-trial:" + OsClientDefault.OsClientType + ":" + OsClientDefault.OsClientNetwork + ":" + id.ToLowerInvariant();
            var existing = BackgroundTaskStore.FindByIdempotency(OsClientDefault.OsClient, idem);
            if (existing != null) return PublicTrialSubmission(existing, request, link, password);
            if (MicroiEngine.TryGetService<ISaasTrialCaptcha>()?.Validate(OsClientDefault.OsClient,
                    request["CaptchaId"]?.ToString(), request["CaptchaValue"]?.ToString()) != true)
                return new DosResult(0, new { ReasonCode = "CAPTCHA_INVALID" }, "验证码不正确或已过期，请重新输入。");
            var redis = MicroiEngine.CacheTenant.Cache(OsClientDefault.OsClient).GetIDatabase();
            var scope = $"Microi:{OsClientDefault.OsClient}:PublicTrial:{OsClientDefault.OsClientType}:{OsClientDefault.OsClientNetwork}";
            var lease = OpaqueTokenSecurity.NewOpaqueValue();
            if (!redis.StringSet(scope + ":queue", lease, TimeSpan.FromSeconds(30), When.NotExists))
                return new DosResult(0, new { ReasonCode = "QUEUE_BUSY" }, "其它开通请求正在登记，请用相同请求稍后重试。");
            try
            {
                existing = BackgroundTaskStore.FindByIdempotency(OsClientDefault.OsClient, idem);
                if (existing != null) return PublicTrialSubmission(existing, request, link, password);
                var db = OsClientExtend.GetClient(OsClientDefault.OsClient).Db;
                // 主库行锁串行登记持久额度；节点暂停导致 Redis 租约过期时，仍须先持久入队才释放行锁。
                using var queueTransaction = db.BeginTransaction(System.Data.IsolationLevel.ReadCommitted);
                var enabled = queueTransaction.FromSql("SELECT SaasPublicTrialEnabled FROM sys_osclients WHERE Id=@id FOR UPDATE")
                    .AddInParameter("id", config["Id"]?.ToString()).SetCommandTimeout(5).ToScalar<int>();
                if (enabled != 1) return new DosResult(0, null, "公开开通已停用。");
                existing = BackgroundTaskStore.FindByIdempotency(OsClientDefault.OsClient, idem);
                if (existing != null) return PublicTrialSubmission(existing, request, link, password);
                var occupied = queueTransaction.FromSql("SELECT COUNT(*) FROM sys_osclients WHERE OsClient=@key AND IsDeleted=0")
                    .AddInParameter("key", key).ToScalar<int>();
                if (occupied > 0) return new DosResult(0, new { ReasonCode = "TENANT_KEY_USED" }, "租户标识已被使用，请更换。");
                var daily = Math.Max(1, Math.Min(10000, config["SaasPublicTrialDailyLimit"].Val<int?>() ?? 20));
                var linkLimit = Math.Max(1, Math.Min(10000, link["MaxTenants"].Val<int?>() ?? config["SaasPublicTrialLinkLimit"].Val<int?>() ?? 50));
                // 额度计入已持久化的待执行任务，不能仅靠瞬时队列租约决定。
                var usedToday = queueTransaction.FromSql(@"SELECT COUNT(*) FROM mci_background_task WHERE ApiEngineKey=@worker
                    AND RuntimeOsClientType=@type AND RuntimeOsClientNetwork=@network AND CreateTime>=@since")
                    .AddInParameter("worker", SaasPromotionSecurity.WorkerEngine).AddInParameter("type", OsClientDefault.OsClientType)
                    .AddInParameter("network", OsClientDefault.OsClientNetwork).AddInParameter("since", DateTime.UtcNow.Date).ToScalar<int>();
                var usedLink = queueTransaction.FromSql(@"SELECT COUNT(*) FROM mci_background_task WHERE ApiEngineKey=@worker
                    AND BusinessId=@link AND RuntimeOsClientType=@type AND RuntimeOsClientNetwork=@network")
                    .AddInParameter("worker", SaasPromotionSecurity.WorkerEngine).AddInParameter("link", link["Id"]?.ToString())
                    .AddInParameter("type", OsClientDefault.OsClientType).AddInParameter("network", OsClientDefault.OsClientNetwork).ToScalar<int>();
                if (usedToday >= daily || usedLink >= linkLimit)
                    return new DosResult(0, new { ReasonCode = "QUOTA_EXCEEDED" }, "当前公开开通额度已用完，请联系推荐人。");
                var ip = DiyHttpContext.Current?.Connection?.RemoteIpAddress?.ToString() ?? "unknown";
                var ipKey = scope + ":ip:" + DateTime.UtcNow.ToString("yyyyMMdd") + ":" + OpaqueTokenSecurity.HashOpaqueToken(ip);
                var ipCount = (long)redis.ScriptEvaluate("local n=redis.call('INCR',KEYS[1]);if n==1 then redis.call('EXPIRE',KEYS[1],86400) end return n", new RedisKey[] { ipKey });
                if (ipCount > 5) return new DosResult(0, new { ReasonCode = "IP_QUOTA_EXCEEDED" }, "此网络今天的试用开通次数已达上限。");
                var grant = new JObject
                {
                    ["RequestId"] = id.ToLowerInvariant(), ["TenantKey"] = key, ["SystemName"] = request["SystemName"],
                    ["ContactName"] = request["ContactName"], ["ContactPhone"] = request["ContactPhone"],
                    ["PasswordHash"] = PasswordHashSecurity.HashPassword(password), ["LinkToken"] = request["LinkToken"],
                    ["ReferralUserId"] = link["ReferralUserId"], ["ReferralLinkId"] = link["Id"],
                    ["TrialDays"] = PublicTrialDays(link, config), ["WebBase"] = web, ["ApiBase"] = api,
                    ["CreatedUtc"] = DateTime.UtcNow.ToString("o"), ["ExpiresUtc"] = DateTime.UtcNow.AddDays(7).ToString("o"),
                    ["Type"] = OsClientDefault.OsClientType, ["Network"] = OsClientDefault.OsClientNetwork
                };
                var cipher = TenantSystemSettingsSecurity.ProtectSecret(OsClientDefault.OsClient, "Saas.PublicTrialTask", grant.ToString(Formatting.None));
                var param = new JObject { ["ApiEngineKey"] = SaasPromotionSecurity.WorkerEngine, ["GrantCipher"] = cipher };
                // 能力任务主体不携带人类角色、菜单、Token 或管理员级别。
                var principal = new JObject { ["Id"] = principalId, ["Account"] = "PublicTrialCapability", ["Level"] = 0 };
                var task = BackgroundTaskService.StartApiEngine(OsClientDefault.OsClient, principalId, "公开空库开通：" + key,
                    param, principal, new JObject { ["IdempotencyKey"] = idem, ["ConcurrencyKey"] = "saas-public-trial-provision",
                        ["MaxAttempts"] = 3, ["RetryOnFailure"] = false, ["BusinessTable"] = "mci_saas_referral_link", ["BusinessId"] = link["Id"] });
                queueTransaction.Commit();
                return PublicTrialSubmission(BackgroundTaskStore.Get(OsClientDefault.OsClient, task.Id), request, link, password);
            }
            finally { redis.ScriptEvaluate("if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0", new RedisKey[] { scope + ":queue" }, new RedisValue[] { lease }); }
        }

        private static DosResult PublicTrialSubmission(BackgroundTaskRecord task, JObject request, JObject link, string password)
        {
            if (task == null || task.ApiEngineKey != SaasPromotionSecurity.WorkerEngine) throw new InvalidOperationException();
            var grant = ReadPublicTrialGrant(JObject.Parse(task.ParamJson)["GrantCipher"]?.ToString());
            if (grant["ReferralLinkId"]?.ToString() != link["Id"]?.ToString()
                || new[] { "TenantKey", "SystemName", "ContactName", "ContactPhone" }.Any(name => grant[name]?.ToString() != request[name]?.ToString())
                || !PasswordHashSecurity.VerifyPassword(password, grant["PasswordHash"]?.ToString()))
                return new DosResult(0, new { ReasonCode = "IDEMPOTENCY_CONFLICT" }, "此请求编号已绑定另一组开通信息，未重复开库。");
            var proof = new JObject { ["TaskId"] = task.Id, ["RequestId"] = grant["RequestId"], ["ExpiresUtc"] = grant["ExpiresUtc"],
                ["Type"] = grant["Type"], ["Network"] = grant["Network"] };
            return new DosResult(1, new { TaskId = task.Id, RequestId = grant["RequestId"], Status = task.Status,
                ProgressToken = TenantSystemSettingsSecurity.ProtectSecret(OsClientDefault.OsClient, "Saas.PublicTrialProgress", proof.ToString()) });
        }

        private static JObject ReadPublicTrialGrant(string cipher) => SaasPromotionSecurity.ParseCapabilityPayload(TenantSystemSettingsSecurity.UnprotectSecret(
            OsClientDefault.OsClient, "Saas.PublicTrialTask", cipher));

        /// <summary>有推广管理权限的原推荐人或管理者可恢复失败任务，原申请与检查点始终保留。</summary>
        public DosResult ResumeSaasPublicTrialTask(string taskId)
        {
            var denied = ResolveSaasPromotionActor(out var actor, out var all, out _);
            if (denied != null) return denied;
            try
            {
                var task = BackgroundTaskStore.Get(OsClientDefault.OsClient, taskId);
                if (!SaasPromotionSecurity.CanResumePublicTrialTask(task))
                    return new DosResult(0, null, "此申请不可恢复，或已达到三次执行上限。");
                var grant = ReadPublicTrialGrant(JObject.Parse(task.ParamJson)["GrantCipher"]?.ToString());
                var link = ValidateSaasPublicLink(new JObject { ["LinkToken"] = grant["LinkToken"],
                    ["ReferralUserId"] = grant["ReferralUserId"] }, out _);
                if ((!all && actor["Id"]?.ToString() != link["ReferralUserId"]?.ToString())
                    || task.BusinessId != link["Id"]?.ToString()
                    || task.UserKey != SaasPromotionSecurity.PublicTrialPrincipalId(grant["RequestId"]?.ToString())
                    || !DateTimeOffset.TryParse(grant["ExpiresUtc"]?.ToString(), out var expiry) || expiry < DateTimeOffset.UtcNow)
                    return new DosResult(1002, null, "申请不在当前推广授权范围内或已过期。");
                return BackgroundTaskStore.ResumeSaasPublicTrial(task)
                    ? new DosResult(1, new { TaskId = task.Id }, "原开通申请已恢复，请等待后台处理。")
                    : new DosResult(0, null, "任务状态已变化，请刷新后重试。");
            }
            catch { return new DosResult(0, null, "申请归属或持久检查点暂不可读，未重新开库。"); }
        }

        private static DosResult ReadPublicTrialProgress(JObject request)
        {
            var proof = SaasPromotionSecurity.ParseCapabilityPayload(TenantSystemSettingsSecurity.UnprotectSecret(OsClientDefault.OsClient, "Saas.PublicTrialProgress", request["ProgressToken"]?.ToString()));
            if (proof["RequestId"]?.ToString() != request["RequestId"]?.ToString()
                || proof["Type"]?.ToString() != OsClientDefault.OsClientType || proof["Network"]?.ToString() != OsClientDefault.OsClientNetwork
                || !DateTimeOffset.TryParse(proof["ExpiresUtc"]?.ToString(), out var expiry) || expiry < DateTimeOffset.UtcNow) throw new InvalidOperationException();
            var task = BackgroundTaskStore.GetForUser(OsClientDefault.OsClient, SaasPromotionSecurity.PublicTrialPrincipalId(proof["RequestId"]?.ToString()), proof["TaskId"]?.ToString());
            if (task == null || task.ApiEngineKey != SaasPromotionSecurity.WorkerEngine) throw new InvalidOperationException();
            return new DosResult(1, new { TaskId = task.Id, task.Status, task.Progress, task.Current, task.Total, task.HeartbeatTime,
                Message = task.Status == "Failed" ? "开通未完成，请联系推荐人查看脱敏任务诊断。" : task.Msg,
                Result = task.Status == "Succeeded" ? SaasPromotionSecurity.SafeTrialProgress(task.Result) : null });
        }

        /// <summary>仅当前持久任务的有效栅栏令牌可消费其加密空库开通授权。</summary>
        public DosResult ProvisionPublicSaasTrial(object parameters)
        {
            var denied = RequireTrustedApiEngine(SaasPromotionSecurity.WorkerEngine);
            if (denied != null) return denied;
            var request = ToJObject(parameters);
            denied = ResolveCurrentManagedBackgroundTask(request, SaasPromotionSecurity.WorkerEngine, out var task);
            if (denied != null) return denied;
            try
            {
                var stored = BackgroundTaskStore.Get(OsClientDefault.OsClient, task.TaskId);
                var cipher = request["GrantCipher"]?.ToString();
                if (!OpaqueTokenSecurity.FixedEquals(cipher, JObject.Parse(stored.ParamJson)["GrantCipher"]?.ToString())) throw new InvalidOperationException();
                var grant = ReadPublicTrialGrant(cipher);
                if (stored.UserKey != SaasPromotionSecurity.PublicTrialPrincipalId(grant["RequestId"]?.ToString()) || grant["Type"]?.ToString() != OsClientDefault.OsClientType
                    || grant["Network"]?.ToString() != OsClientDefault.OsClientNetwork
                    || !DateTimeOffset.TryParse(grant["ExpiresUtc"]?.ToString(), out var expiry) || expiry < DateTimeOffset.UtcNow) throw new InvalidOperationException();
                ValidateSaasPublicLink(new JObject { ["LinkToken"] = grant["LinkToken"], ["ReferralUserId"] = grant["ReferralUserId"] }, out _);
                var metadata = new JObject { ["ReferralUserId"] = grant["ReferralUserId"], ["ReferralLinkId"] = grant["ReferralLinkId"],
                    ["PublicTrialRequestId"] = grant["RequestId"], ["TrialStartTime"] = DateTimeOffset.Parse(grant["CreatedUtc"].ToString()).UtcDateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    ["TrialEndTime"] = DateTimeOffset.Parse(grant["CreatedUtc"].ToString()).AddDays(grant["TrialDays"].Val<int>()).UtcDateTime.ToString("yyyy-MM-dd HH:mm:ss"),
                    ["PromotionStage"] = "Trial", ["PromotionContact"] = grant["ContactName"], ["PromotionPhone"] = grant["ContactPhone"], ["SignupSource"] = "PublicReferral" };
                using var allocation = BeginTrustedHostAllocationScope();
                var result = new TenantProvisioningService().ProvisionAdminTenantAsync(new AdminTenantProvisioningRequest
                { TenantKey = grant["TenantKey"]?.ToString(), SystemName = grant["SystemName"]?.ToString(),
                    OwnerPhone = grant["ContactPhone"]?.ToString(), UserName = grant["ContactName"]?.ToString(),
                    EncryptedPwd = grant["PasswordHash"]?.ToString(), OsClientType = OsClientDefault.OsClientType,
                    OsClientNetwork = OsClientDefault.OsClientNetwork, BackgroundTaskId = task.TaskId,
                    RegistrationMetadata = metadata, PublicTrialTaskRecord = stored })
                    .GetAwaiter().GetResult();
                if (result.Code != 1) return result;
                var data = JObject.FromObject(result.Data); data["AdminAccount"] = "admin";
                data["LaunchUrl"] = grant["WebBase"] + "/?ApiBase=" + Uri.EscapeDataString(grant["ApiBase"]?.ToString())
                    + "&OsClient=" + Uri.EscapeDataString(grant["TenantKey"]?.ToString());
                data["DomainBindingStatus"] = "PendingExternalBinding";
                return new DosResult(1, data, "空库已开通，请通过启动地址登录；独立域名需另行绑定。");
            }
            catch { return new DosResult(0, null, "公开开通能力票据、推广归属或持久任务身份校验失败。"); }
        }
    }
}

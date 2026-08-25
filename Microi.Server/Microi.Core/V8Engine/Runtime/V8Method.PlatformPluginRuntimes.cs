using System;
using System.Collections.Generic;
using System.IO;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Linq;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        public dynamic ManageSystemDirectory(dynamic dynamicParam)
        {
            try
            {
                var request = ToJObject((object)dynamicParam);
                var domain = GetJsonString(request, "Domain").Trim();
                var action = GetJsonString(request, "Action").Trim();
                if (domain.DosIsNullOrWhiteSpace() || action.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, "Domain 和 Action 不能为空。");

                var mutation = action.StartsWith("Add", StringComparison.OrdinalIgnoreCase)
                    || action.StartsWith("Upt", StringComparison.OrdinalIgnoreCase)
                    || action.StartsWith("Del", StringComparison.OrdinalIgnoreCase)
                    || action.StartsWith("Update", StringComparison.OrdinalIgnoreCase);
                var requiresAdministrator = mutation
                    || (string.Equals(domain, "SysRole", StringComparison.OrdinalIgnoreCase)
                        && !string.Equals(action, "GetSysRole", StringComparison.OrdinalIgnoreCase));
                DosResult denied;
                string osClient;
                JObject currentUser;
                var anonymousBaseData = string.Equals(domain, "SysBaseData", StringComparison.OrdinalIgnoreCase)
                    && string.Equals(action, "GetSysBaseData_Biz", StringComparison.OrdinalIgnoreCase);
                if (requiresAdministrator)
                {
                    denied = RequireCurrentTenantSuperAdmin(
                        out osClient,
                        out currentUser,
                        "系统目录管理能力");
                }
                else
                {
                    denied = ResolveSystemDirectoryIdentity(
                        anonymousBaseData,
                        out osClient,
                        out currentUser);
                }
                if (denied != null) return denied;

                var payload = request["Param"] is JObject nested
                    ? (JObject)nested.DeepClone()
                    : (JObject)request.DeepClone();
                payload.Remove("Domain");
                payload.Remove("Action");
                payload.Remove("OsClient");
                payload.Remove("_OsClient");
                payload.Remove("_CurrentUser");

                if (string.Equals(domain, "SysBaseData", StringComparison.OrdinalIgnoreCase))
                    return ExecuteSysBaseDataDirectory(action, payload, osClient, currentUser);
                if (string.Equals(domain, "SysDept", StringComparison.OrdinalIgnoreCase))
                    return ExecuteSysDeptDirectory(action, payload, osClient, currentUser);
                if (string.Equals(domain, "SysMenu", StringComparison.OrdinalIgnoreCase))
                    return ExecuteSysMenuDirectory(action, payload, osClient, currentUser);
                if (string.Equals(domain, "SysRole", StringComparison.OrdinalIgnoreCase))
                    return ExecuteSysRoleDirectory(action, payload, osClient, currentUser);
                return new DosResult(0, null, "不支持的系统目录域。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "系统目录操作失败：" + ex.Message);
            }
        }

        private static DosResult ResolveSystemDirectoryIdentity(
            bool allowAnonymous,
            out string osClient,
            out JObject currentUser)
        {
            osClient = V8TenantContext.IsActive
                ? V8TenantContext.Current.OsClient
                : DiyToken.GetCurrentOsClient();
            currentUser = V8TrustedExecutionContext.CurrentUser;
            try
            {
                if (currentUser == null && !allowAnonymous)
                {
                    var token = DiyToken.GetCurrentToken().ConfigureAwait(false).GetAwaiter().GetResult();
                    currentUser = token?.CurrentUser;
                    if (osClient.DosIsNullOrWhiteSpace()) osClient = token?.OsClient;
                }
                if (osClient.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, "当前租户上下文不存在。");
                osClient = TenantConfigurationSecurity.NormalizeTenantId(osClient);
                if (!allowAnonymous
                    && (currentUser == null || currentUser["Id"].Val<string>().DosIsNullOrWhiteSpace()))
                    return new DosResult(1001, null, "登录身份已过期。");
                return null;
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "校验系统目录访问身份失败：" + ex.Message);
            }
        }

        private static dynamic ExecuteSysBaseDataDirectory(
            string action,
            JObject payload,
            string osClient,
            JObject currentUser)
        {
            var param = payload.ToObject<SysBaseDataParam>() ?? new SysBaseDataParam();
            param.OsClient = osClient;
            param._CurrentUser = currentUser;
            var logic = new SysBaseDataLogic();
            switch (action.ToLowerInvariant())
            {
                case "addsysbasedata":
                    return logic.AddSysBaseData(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "delsysbasedata":
                    return logic.DelSysBaseData(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "uptsysbasedata":
                    return logic.UptSysBaseData(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "getsysbasedata":
                case "getsysbasedata_biz":
                    param.IsDeleted = 0;
                    return logic.GetSysBaseData(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "getsysbasedatastep":
                    param.IsDeleted = 0;
                    return logic.GetSysBaseDataStep(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "getsysbasedatapa":
                    param.IsDeleted = 0;
                    return logic.GetPa(param).ConfigureAwait(false).GetAwaiter().GetResult();
                default:
                    return new DosResult(0, null, "不支持的基础数据动作。");
            }
        }

        private static dynamic ExecuteSysDeptDirectory(
            string action,
            JObject payload,
            string osClient,
            JObject currentUser)
        {
            var param = payload.ToObject<SysDeptParam>() ?? new SysDeptParam();
            param.OsClient = osClient;
            param._CurrentUser = currentUser;
            var logic = new SysDeptLogic();
            switch (action.ToLowerInvariant())
            {
                case "addsysdept":
                    return logic.AddSysDept(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "delsysdept":
                    return logic.DelSysDept(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "uptsysdept":
                    return logic.UptSysDept(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "getsysdept":
                    return logic.GetSysDept(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "getsysdeptmodel":
                    return logic.GetSysDeptModel(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "getsysdeptstep":
                    param.IsDeleted = 0;
                    return logic.GetSysDeptStep(param).ConfigureAwait(false).GetAwaiter().GetResult();
                default:
                    return new DosResult(0, null, "不支持的组织机构动作。");
            }
        }

        private static dynamic ExecuteSysMenuDirectory(
            string action,
            JObject payload,
            string osClient,
            JObject currentUser)
        {
            if (string.Equals(action, "GetSysRoleLimitByMenuId", StringComparison.OrdinalIgnoreCase))
            {
                var roleLimit = payload.ToObject<SysRoleLimitParam>() ?? new SysRoleLimitParam();
                roleLimit.OsClient = osClient;
                roleLimit._CurrentUser = currentUser;
                return new SysRoleLimitLogic().GetSysRoleLimitByMenuId(roleLimit)
                    .ConfigureAwait(false).GetAwaiter().GetResult();
            }
            if (string.Equals(action, "UpdateSysRoleLimitByMenuId", StringComparison.OrdinalIgnoreCase))
            {
                var roleLimit = payload.ToObject<SysRoleLimitParam>() ?? new SysRoleLimitParam();
                roleLimit.OsClient = osClient;
                roleLimit._CurrentUser = currentUser;
                if (roleLimit.Type.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, "参数错误：Type 为空。");
                var rows = JArray.Parse(roleLimit.Type);
                var logic = new SysRoleLimitLogic();
                foreach (var row in rows.OfType<JObject>())
                {
                    var fkId = row["FkId"].Val<string>();
                    if (fkId.DosIsNullOrWhiteSpace()) fkId = roleLimit.FkId;
                    logic.UpdateSysRoleLimitByMenuId(
                            osClient,
                            row["Id"].Val<string>(),
                            row["RoleId"].Val<string>(),
                            fkId,
                            row["Permission"]?.ToString())
                        .ConfigureAwait(false).GetAwaiter().GetResult();
                }
                return new DosResult(1, null, "成功");
            }

            var param = payload.ToObject<SysMenuParam>() ?? new SysMenuParam();
            param.OsClient = osClient;
            param._CurrentUser = currentUser;
            var menuLogic = new SysMenuLogic();
            switch (action.ToLowerInvariant())
            {
                case "addsysmenu":
                    return menuLogic.AddSysMenu(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "delsysmenu":
                    return menuLogic.DelSysMenu(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "uptsysmenu":
                    return menuLogic.UptSysMenu(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "getsysmenu":
                    return menuLogic.GetSysMenu(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "getsysmenumodel":
                    return menuLogic.GetSysMenuModel(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "getsysmenustep":
                    return menuLogic.GetSysMenuStep(param).ConfigureAwait(false).GetAwaiter().GetResult();
                default:
                    return new DosResult(0, null, "不支持的菜单动作。");
            }
        }

        private static dynamic ExecuteSysRoleDirectory(
            string action,
            JObject payload,
            string osClient,
            JObject currentUser)
        {
            if (string.Equals(action, "GetDirectTableGrantPolicies", StringComparison.OrdinalIgnoreCase))
                return new DosResult(1, PlatformResourceSecurity.DirectTableGrantPolicies);

            var param = payload.ToObject<SysRoleParam>() ?? new SysRoleParam();
            param.OsClient = osClient;
            param._CurrentUser = currentUser;
            var roleLogic = new SysRoleLogic();
            switch (action.ToLowerInvariant())
            {
                case "addsysrole":
                    return roleLogic.AddSysRole(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "delsysrole":
                    return roleLogic.DelSysRole(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "uptsysrole":
                    return roleLogic.UptSysRole(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "getsysrolemodel":
                    return roleLogic.GetSysRoleModel(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "getsysrolestep":
                    param.IsDeleted = 0;
                    return roleLogic.GetSysRoleStep(param).ConfigureAwait(false).GetAwaiter().GetResult();
                case "getsysrole":
                    if (PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(osClient, currentUser))
                    {
                        param.IsDeleted = 0;
                        return roleLogic.GetSysRole(param).ConfigureAwait(false).GetAwaiter().GetResult();
                    }
                    var authorization = MicroiEngine.FormEngine.AuthorizeClientTableOperationAsync(
                            new DiyTableRowParam
                            {
                                FormEngineKey = "sys_user",
                                OsClient = osClient,
                                _CurrentUser = currentUser,
                                _InvokeType = InvokeType.Client.ToString(),
                                _Lang = param._Lang
                            },
                            "List")
                        .ConfigureAwait(false).GetAwaiter().GetResult();
                    if (authorization.Code != 1) return authorization;
                    var dbSession = OsClientExtend.GetClient(osClient)?.Db;
                    var catalog = SysUserManagementSecurity.GetAssignableRoleCatalog(dbSession, currentUser);
                    return new DosResult(
                        1,
                        catalog.Select(role => new { role.Id, role.Name, role.Level }).ToList())
                    {
                        DataCount = catalog.Count
                    };
                default:
                    return new DosResult(0, null, "不支持的角色动作。");
            }
        }

        public DosResult ManageMq(dynamic dynamicParam)
        {
            var denied = RequireCurrentTenantSuperAdmin(
                out var osClient,
                out _,
                "RabbitMQ 管理能力");
            if (denied != null) return denied;
            try
            {
                var request = ToJObject((object)dynamicParam);
                var action = GetJsonString(request, "Action").Trim();
                if (!string.Equals(action, "Send", StringComparison.OrdinalIgnoreCase))
                    return new DosResult(0, null, "不支持的 RabbitMQ 动作。");
                var queueName = GetJsonString(request, "QueueName").Trim();
                if (!System.Text.RegularExpressions.Regex.IsMatch(
                        queueName,
                        "^[A-Za-z0-9_.-]{1,128}$"))
                    return new DosResult(0, null, "QueueName 格式不合法。");
                var message = request["Message"];
                var payloadBytes = Encoding.UTF8.GetByteCount(
                    message?.ToString(Formatting.None) ?? "null");
                if (payloadBytes > 1024 * 1024)
                    return new DosResult(0, null, "RabbitMQ 单条消息不能超过 1 MB。");
                var result = MicroiEngine.MQ.SendMsg(new MicroiMQSendInfo
                    {
                        OsClient = osClient,
                        QueueName = queueName,
                        Message = message?.DeepClone(),
                        EventId = GetJsonString(request, "EventId")
                    })
                    .ConfigureAwait(false).GetAwaiter().GetResult();
                MicroiEngine.QueueSystemLog(
                    osClient,
                    "RabbitMQ",
                    "PublishByApiEngine",
                    result?.Code == 1 ? "接口引擎发布 RabbitMQ 消息" : "接口引擎发布 RabbitMQ 消息失败",
                    $"Queue={queueName}; Bytes={payloadBytes}; EventId={GetJsonString(request, "EventId")}",
                    result?.Code == 1 ? 1 : 3,
                    result?.Code == 1,
                    queueName);
                return result ?? new DosResult(0, null, "RabbitMQ 插件没有返回结果。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "RabbitMQ 管理操作失败：" + ex.Message);
            }
        }

        public DosResult ManageMqtt(dynamic dynamicParam)
        {
            var denied = RequireCurrentTenantSuperAdmin(
                out var osClient,
                out _,
                "MQTT 管理能力");
            if (denied != null) return denied;

            try
            {
                var request = ToJObject((object)dynamicParam);
                var action = GetJsonString(request, "Action").Trim();
                var runtime = MicroiEngine.TryGetService<IMicroiMQTT>();
                if (runtime == null) return new DosResult(0, null, "MQTT 插件尚未安装或未启动。");
                switch (action.ToLowerInvariant())
                {
                    case "status":
                        return new DosResult(1, new
                        {
                            runtime.IsRunning,
                            OsClient = osClient,
                            StatusScope = "CurrentNode",
                            ConnectedClients = runtime.GetConnectedClients(osClient)
                        });
                    case "publish":
                    {
                        var topic = GetJsonString(request, "Topic").Trim();
                        var payload = GetJsonString(request, "Payload", "Message");
                        var qos = request["Qos"].Val<int>();
                        var retain = request["Retain"].Val<bool>();
                        if (topic.DosIsNullOrWhiteSpace() || topic.Length > 512)
                            return new DosResult(0, null, "MQTT Topic 不能为空且最多 512 个字符。");
                        if (payload != null && Encoding.UTF8.GetByteCount(payload) > 1024 * 1024)
                            return new DosResult(0, null, "MQTT 单条消息不能超过 1 MB。");
                        if (qos < 0 || qos > 2) return new DosResult(0, null, "MQTT QoS 只能为 0、1 或 2。");
                        runtime.PublishAsync(osClient, topic, payload ?? "", qos, retain)
                            .ConfigureAwait(false).GetAwaiter().GetResult();
                        MicroiEngine.QueueSystemLog(
                            osClient,
                            "MQTT",
                            "PublishByApiEngine",
                            "接口引擎发布 MQTT 消息",
                            $"Topic={topic}; Qos={qos}; Retain={retain}; Bytes={Encoding.UTF8.GetByteCount(payload ?? "")}",
                            1,
                            true,
                            topic);
                        return new DosResult(1, null, "MQTT 消息已发布。");
                    }
                    default:
                        return new DosResult(0, null, "不支持的 MQTT 管理动作。");
                }
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "MQTT 管理操作失败：" + ex.Message);
            }
        }

        public DosResult ManageSearchEngine(dynamic dynamicParam)
        {
            var denied = RequireCurrentTenantSuperAdmin(
                out var osClient,
                out _,
                "搜索引擎管理能力");
            if (denied != null) return denied;
            try
            {
                var request = ToJObject((object)dynamicParam);
                var action = GetJsonString(request, "Action").Trim();
                var runtime = MicroiEngine.TryGetService<IMicroiSearchManagementRuntime>();
                if (runtime == null) return new DosResult(0, null, "搜索引擎插件尚未安装或未启动。");
                request = (JObject)request.DeepClone();
                request.Remove("OsClient");
                request.Remove("_OsClient");
                request.Remove("_CurrentUser");
                return runtime.ExecuteAsync(osClient, action, request)
                    .ConfigureAwait(false).GetAwaiter().GetResult()
                    ?? new DosResult(0, null, "搜索引擎插件没有返回结果。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "搜索引擎操作失败：" + ex.Message);
            }
        }

        public DosResult ManageAiWorkflow(dynamic dynamicParam)
        {
            var identityDenied = RequireCurrentTenantSuperAdmin(
                out var osClient,
                out var currentUser,
                "AI 工作流管理能力");
            if (identityDenied != null) return identityDenied;
            try
            {
                var request = ToJObject((object)dynamicParam);
                var action = GetJsonString(request, "Action").Trim();
                var allowed = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                {
                    "Overview", "GenerateFromPrompt", "NodeDetail", "List", "Get", "Save", "Delete"
                };
                if (!allowed.Contains(action)) return new DosResult(0, null, "不支持的 AI 工作流动作。");
                request = (JObject)request.DeepClone();
                request.Remove("OsClient");
                request.Remove("_OsClient");
                request.Remove("_CurrentUser");
                var runtime = MicroiEngine.TryGetService<IAiWorkflowRuntime>();
                if (runtime == null) return new DosResult(0, null, "AI 工作流插件尚未安装或未启动。");
                return runtime.ExecuteAsync(osClient, action, request, currentUser)
                    .ConfigureAwait(false).GetAwaiter().GetResult()
                    ?? new DosResult(0, null, "AI 工作流插件没有返回结果。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "AI 工作流操作失败：" + ex.Message);
            }
        }

        public DosResult GenerateTencentImUserSig(dynamic dynamicParam)
        {
            var denied = RequireCurrentTenantSuperAdmin(
                out var osClient,
                out _,
                "腾讯 IM 管理能力");
            if (denied != null) return denied;
            try
            {
                var request = ToJObject((object)dynamicParam);
                var userId = GetJsonString(request, "UserId", "Identifier").Trim();
                var expire = request["Expire"].Val<int>();
                if (expire <= 0) expire = 86400;
                if (!System.Text.RegularExpressions.Regex.IsMatch(userId, "^[A-Za-z0-9_.@-]{1,64}$"))
                    return new DosResult(0, null, "腾讯 IM UserId 格式不合法。");
                if (expire < 60 || expire > 604800)
                    return new DosResult(0, null, "腾讯 IM UserSig 有效期只能为 60 至 604800 秒。");

                var settings = TenantSystemSettingsSecurity.LoadSnapshot(osClient);
                var client = OsClientExtend.GetClient(osClient);
                var sdkText = TenantSystemSettingsSecurity.GetText(
                    settings,
                    "TencentImSdkAppId",
                    client?.OsClientModel?["IMSdkAppid"]?.ToString() ?? "",
                    true);
                var secret = TenantSystemSettingsSecurity.GetText(
                    settings,
                    "TencentImSecretKey",
                    client?.OsClientModel?["IMSecretKey"]?.ToString() ?? "",
                    true);
                var administrator = TenantSystemSettingsSecurity.GetText(
                    settings,
                    "TencentImIdentifier",
                    client?.OsClientModel?["Identifier"]?.ToString() ?? "",
                    true);
                if (!uint.TryParse(sdkText, out var sdkAppId) || sdkAppId == 0 || secret.DosIsNullOrWhiteSpace())
                    return new DosResult(0, null, "当前租户尚未配置 TencentImSdkAppId/TencentImSecretKey。");

                var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                var raw = "TLS.identifier:" + userId + "\n"
                          + "TLS.sdkappid:" + sdkAppId + "\n"
                          + "TLS.time:" + timestamp + "\n"
                          + "TLS.expire:" + expire + "\n";
                string signature;
                using (var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret)))
                    signature = Convert.ToBase64String(hmac.ComputeHash(Encoding.UTF8.GetBytes(raw)));
                var json = new JObject
                {
                    ["TLS.ver"] = "2.0",
                    ["TLS.identifier"] = userId,
                    ["TLS.sdkappid"] = sdkAppId,
                    ["TLS.expire"] = expire,
                    ["TLS.time"] = timestamp,
                    ["TLS.sig"] = signature
                }.ToString(Formatting.None);
                var compressed = CompressTencentImPayload(Encoding.UTF8.GetBytes(json));
                var userSig = Convert.ToBase64String(compressed)
                    .Replace('+', '*').Replace('/', '-').Replace('=', '_');
                return new DosResult(1, new
                {
                    UserId = userId,
                    SdkAppId = sdkAppId,
                    Identifier = administrator,
                    Expire = expire,
                    UserSig = userSig
                });
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "生成腾讯 IM UserSig 失败：" + ex.Message);
            }
        }

        private static byte[] CompressTencentImPayload(byte[] payload)
        {
            using (var output = new MemoryStream())
            {
                output.WriteByte(0x78);
                output.WriteByte(0x9c);
                using (var deflate = new DeflateStream(output, CompressionLevel.Optimal, true))
                    deflate.Write(payload, 0, payload.Length);
                var adler = Adler32(payload);
                output.WriteByte((byte)(adler >> 24));
                output.WriteByte((byte)(adler >> 16));
                output.WriteByte((byte)(adler >> 8));
                output.WriteByte((byte)adler);
                return output.ToArray();
            }
        }

        private static uint Adler32(byte[] payload)
        {
            const uint modulo = 65521;
            uint a = 1;
            uint b = 0;
            foreach (var value in payload)
            {
                a = (a + value) % modulo;
                b = (b + a) % modulo;
            }
            return (b << 16) | a;
        }
    }
}

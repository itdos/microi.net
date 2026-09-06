using System;
using System.Globalization;
using System.Text.RegularExpressions;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        /// <summary>Ops outbox 的持久化回执；不经过返回后才写入的日志队列。</summary>
        public DosResult IngestOpsEvent(dynamic dynamicParam)
        {
            var denied = RequireTrustedApiEngine("platform-ops-event-ingest");
            if (denied != null) return denied;
            denied = RequirePlatformObservabilityAdministrator(out var osClient, out var user, "运维事件投递");
            if (denied != null) return denied;
            try
            {
                var request = ToJObject((object)dynamicParam);
                var entry = BuildOpsLog(request, osClient, user, DateTimeOffset.UtcNow);
                if (MicroiEngine.MongoDB == null) return new DosResult(0, null, "MongoDB 系统日志未配置，运维中心应保留待投递事件。");
                var result = MicroiEngine.MongoDB.AddSysLogs(new[] { entry }).GetAwaiter().GetResult();
                if (result.Code != 1) return new DosResult(0, null, "MongoDB 尚未确认运维日志持久化，请稍后重试。");
                return new DosResult(1, new { EventId = GetJsonString(request, "eventId", "EventId"), Persisted = true });
            }
            catch (ArgumentException error) { return new DosResult(0, null, error.Message); }
            catch { return new DosResult(0, null, "运维日志投递失败，请保留事件并稍后重试。"); }
        }

        internal static SysLogParam BuildOpsLog(JObject request, string osClient, JObject user, DateTimeOffset now)
        {
            var eventId = GetJsonString(request, "eventId", "EventId");
            var deployment = GetJsonString(request, "deploymentId", "DeploymentId");
            var action = GetJsonString(request, "action", "Action");
            if (!Guid.TryParseExact(eventId, "N", out _) || !Regex.IsMatch(deployment, "^[a-zA-Z0-9_-]{1,64}$")
                || !Regex.IsMatch(action, "^[a-zA-Z][a-zA-Z0-9]{0,63}$"))
                throw new ArgumentException("运维事件 Id、部署标识或动作无效。");
            if (!DateTimeOffset.TryParse(GetJsonString(request, "occurredAt", "OccurredAt"), CultureInfo.InvariantCulture,
                    DateTimeStyles.AssumeUniversal, out var occurred) || occurred > now.AddMinutes(5) || occurred < now.AddDays(-365))
                throw new ArgumentException("运维事件时间无效或超过一年补投范围。");
            // 固定命名空间隔离普通系统日志 Id；同事件按发生月份补投，跨月重启也不会新增记录。
            var id = UserBehaviorAudit.DeterministicEventId("Microi.Ops|" + osClient.ToLowerInvariant() + "|" + deployment + "|" + eventId);
            var success = request.GetValue("success", StringComparison.OrdinalIgnoreCase)?.Value<bool?>() == true;
            return new SysLogParam
            {
                // 系统日志现有展示和分月契约使用服务器本地时间；Ops 的 UTC 时间只转换一次。
                OsClient = osClient, EventId = id, OccurredAt = occurred.LocalDateTime, Category = "Operations", Source = "Microi.Ops",
                Type = "Microi.Ops", ServiceName = "Microi.Ops", AppId = "microi-ops", Action = action, Success = success,
                Level = success ? 1 : 3, Title = "平台运维：" + action, Content = SanitizeLogPayload(GetJsonString(request, "message", "Message"), 4000),
                UserId = user?["Id"]?.ToString(), UserName = user?["Name"]?.ToString() ?? user?["Account"]?.ToString(),
                ClientType = "Ops", NodeId = deployment, TargetType = "OpsTask", TargetId = LimitLogText(GetJsonString(request, "taskId", "TaskId"), 64),
                Remark = "Ops 操作者：" + LimitLogText(GetJsonString(request, "actor", "Actor"), 100),
                OtherInfo = "OpsEventId=" + eventId
            };
        }
    }
}

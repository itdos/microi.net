using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text.RegularExpressions;
using Dos.Common;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8Method
    {
        private static readonly Regex ObservabilitySecretPattern = new Regex(
            @"(?i)(authorization|cookie|token|password|pwd|secret|api[-_]?key|client[-_]?secret|credential)\s*[\""']?\s*[:=]\s*[\""']?([^\""'\s,;&}]+)",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex ObservabilitySecretKeyPattern = new Regex(
            @"(?i)(authorization|cookie|token|password|pwd|secret|api[-_]?key|client[-_]?secret|credential)",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);

        public DosResult GetSystemObservability(dynamic dynamicParam)
        {
            try
            {
                var request = ToJObject((object)dynamicParam);
                var denied = RequirePlatformObservabilityAdministrator(
                    out var osClient,
                    out _,
                    "系统日志/监控");
                if (denied != null) return denied;

                var action = GetJsonString(request, "Action");
                if (action.DosIsNullOrWhiteSpace()) action = "Snapshot";
                switch (action.Trim().ToLowerInvariant())
                {
                    case "snapshot":
                        return GetObservabilitySnapshot(request, osClient);
                    case "logs":
                        return GetObservabilityLogs(request, osClient);
                    case "logtypes":
                        return GetObservabilityLogTypes(request, osClient);
                    case "logstats":
                        return GetObservabilityLogStats(request, osClient);
                    case "trafficdetails":
                        return GetObservabilityTrafficDetails(request, osClient);
                    case "signal":
                        return QuerySystemLogSignal(request);
                    case "trace":
                        return GetTraceTimeline(request);
                    case "apirank":
                        return GetObservabilityApiRank(request, osClient);
                    case "applogs":
                        return GetObservabilityAppLogs(request);
                    default:
                        return new DosResult(0, null, "不支持的系统观测动作。");
                }
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "读取系统日志/监控失败：" + ex.Message);
            }
        }

        public DosResult ManageSystemObservability(dynamic dynamicParam)
        {
            try
            {
                var request = ToJObject((object)dynamicParam);
                var denied = RequirePlatformObservabilityAdministrator(
                    out var osClient,
                    out var currentUser,
                    "系统日志/监控安全操作");
                if (denied != null) return denied;

                var action = GetJsonString(request, "Action").Trim();
                var ip = NormalizeManagedIp(GetJsonString(request, "Ip", "IP"));
                if (ip == null) return new DosResult(0, null, "IP 地址无效，且不允许封禁本机、未指定或组播地址。");
                var userId = currentUser["Id"].Val<string>();
                var userName = currentUser["Name"].Val<string>();
                if (userName.DosIsNullOrWhiteSpace()) userName = currentUser["Account"].Val<string>();

                if (string.Equals(action, "BlockIp", StringComparison.OrdinalIgnoreCase))
                {
                    var minutes = Math.Max(1, Math.Min(10080, request["BlockMinutes"].Val<int>()));
                    if (minutes == 1 && request["BlockMinutes"].Val<int>() == 0) minutes = 30;
                    var reason = LimitLogText(GetJsonString(request, "Reason"), 300);
                    if (reason.DosIsNullOrWhiteSpace()) reason = "系统日志/监控中由管理员手动封禁。";
                    var state = SecurityGuardService.BlockIp(
                        ip,
                        reason,
                        minutes,
                        true,
                        0,
                        0,
                        osClient,
                        "ObservabilityManualBlock",
                        userId,
                        userName);
                    TrackObservabilitySecurityAction(
                        osClient,
                        currentUser,
                        "IpBlock",
                        ip,
                        "手动封禁 IP",
                        new { BlockMinutes = minutes, Reason = reason },
                        true);
                    return new DosResult(1, state, "已封禁。");
                }

                if (string.Equals(action, "UnblockIp", StringComparison.OrdinalIgnoreCase))
                {
                    var ok = SecurityGuardService.UnblockIp(ip, osClient, userId, userName);
                    TrackObservabilitySecurityAction(
                        osClient,
                        currentUser,
                        "IpUnblock",
                        ip,
                        "手动解封 IP",
                        null,
                        ok);
                    return new DosResult(ok ? 1 : 0, null, ok ? "已解封。" : "未找到该 IP 的活动封禁记录。");
                }

                return new DosResult(0, null, "只允许 BlockIp 或 UnblockIp。");
            }
            catch (Exception ex)
            {
                return new DosResult(0, null, "执行系统日志/监控安全操作失败：" + ex.Message);
            }
        }

        private static DosResult GetObservabilitySnapshot(JObject request, string osClient)
        {
            var window = Math.Max(1, Math.Min(15, request["WindowMinutes"].Val<int>()));
            if (request["WindowMinutes"].Val<int>() == 0) window = 5;
            var top = Math.Max(5, Math.Min(50, request["Top"].Val<int>()));
            if (request["Top"].Val<int>() == 0) top = 15;
            var includeHost = request["IncludeHost"].Val<bool?>() != false;
            var includeDocker = request["IncludeDocker"].Val<bool>() == true;
            SystemMonitorLogic.EnsureMonitorActive();
            JObject host = null;
            if (includeHost)
            {
                host = SystemMonitorLogic.GetSystemOverview();
                host["ProductEdition"] = MicroiEngine
                    .TryGetService<IPlatformProductEditionProvider>()?
                    .GetProductEdition() ?? "开源版";
            }
            var queue = MicroiEngine.SysLogQueue?.GetHealth();
            var recentAccess = SecurityGuardService.GetRecentAccess(200)
                .Where(item => item != null && string.Equals(item.OsClient ?? "", osClient, StringComparison.OrdinalIgnoreCase))
                .Take(100)
                .Select(item => new
                {
                    item.TimeUtc,
                    item.Ip,
                    item.Method,
                    item.Path,
                    item.StatusCode,
                    item.ElapsedMilliseconds,
                    item.UserAgent,
                    item.TraceId
                }).ToList();
            return new DosResult(1, new
            {
                Scope = new
                {
                    CurrentNodeOnly = true,
                    Tenant = osClient,
                    RequestCpuBoundary = "请求耗时和并发用于归因，不代表逐请求 CPU 采样；多节点需分别查看。"
                },
                RequestRuntime = SystemObservabilityService.GetSnapshot(window, top),
                Host = host,
                Docker = includeDocker ? SystemMonitorLogic.GetDockerStats() : null,
                Queue = queue == null ? null : new
                {
                    queue.NodeId,
                    queue.Enqueued,
                    queue.Persisted,
                    queue.Retried,
                    queue.Pending,
                    queue.Capacity,
                    queue.OverflowCapacity,
                    queue.OverflowPending,
                    queue.EmergencySpooled,
                    queue.Dropped,
                    queue.SkippedUnconfigured,
                    queue.FailedBatches,
                    queue.LastError,
                    queue.LastPersistedAt
                },
                ActiveBlocks = SecurityGuardService.GetBlockedIps(osClient),
                RecentSecurityAccess = recentAccess,
                GeneratedAtUtc = DateTime.UtcNow
            });
        }

        private static DosResult GetObservabilityLogs(JObject request, string osClient)
        {
            var param = BuildObservabilityLogQuery(request, osClient);
            var result = MicroiEngine.MongoDB.GetSysLog(param).GetAwaiter().GetResult();
            if (result == null) return new DosResult(0, null, "系统日志查询失败。");
            var rows = (result.Data ?? new List<SysLog>()).Select(SanitizeSystemLogRow).ToList();
            return new DosResult(result.Code, rows, result.Msg, result.DataCount);
        }

        /// <summary>
        /// Maps only the public log-query fields. The observability command itself also
        /// uses a property named Action (for example Action=Logs); binding the whole
        /// request to SysLogParam would silently turn that command into a business-log
        /// filter and make the list empty while the aggregate counters remain non-zero.
        /// A business Action filter therefore has the unambiguous name LogAction.
        /// </summary>
        internal static SysLogParam BuildObservabilityLogQuery(JObject request, string osClient)
        {
            request ??= new JObject();
            var levelToken = request["Level"];
            var level = levelToken == null
                        || levelToken.Type == JTokenType.Null
                        || levelToken.Type == JTokenType.Undefined
                        || levelToken.Val<string>().DosIsNullOrWhiteSpace()
                ? (int?)null
                : levelToken.Val<int?>();
            var pageIndex = request["_PageIndex"].Val<int?>()
                            ?? request["PageIndex"].Val<int?>()
                            ?? 1;
            var pageSize = request["_PageSize"].Val<int?>()
                           ?? request["PageSize"].Val<int?>()
                           ?? 15;
            return new SysLogParam
            {
                OsClient = osClient,
                _PageIndex = Math.Max(1, pageIndex),
                _PageSize = Math.Max(1, Math.Min(200, pageSize)),
                _Keyword = LimitLogText(GetJsonString(request, "_Keyword", "Keyword"), 100),
                _SearchMonth = LimitLogText(GetJsonString(request, "_SearchMonth", "SearchMonth"), 20),
                Level = level,
                Type = LimitLogText(GetJsonString(request, "Type"), 100),
                Category = LimitLogText(GetJsonString(request, "Category"), 100),
                Action = LimitLogText(GetJsonString(request, "LogAction"), 100),
                Source = LimitLogText(GetJsonString(request, "Source"), 100),
                IP = LimitLogText(GetJsonString(request, "Ip", "IP"), 100),
                UserId = LimitLogText(GetJsonString(request, "UserId"), 100),
                TraceId = LimitLogText(GetJsonString(request, "TraceId"), 100)
            };
        }

        private static DosResult GetObservabilityLogTypes(JObject request, string osClient)
        {
            var param = new SysLogParam
            {
                OsClient = osClient,
                _Keyword = LimitLogText(GetJsonString(request, "_Keyword", "Keyword"), 100),
                _SearchMonth = LimitLogText(GetJsonString(request, "_SearchMonth", "SearchMonth"), 20)
            };
            var result = MicroiEngine.MongoDB.GetSysLogTypes(param).GetAwaiter().GetResult();
            return result == null
                ? new DosResult(0, null, "日志类型查询失败。")
                : new DosResult(result.Code, result.Data, result.Msg, result.DataCount);
        }

        private static DosResult GetObservabilityLogStats(JObject request, string osClient)
        {
            var param = new SysLogParam
            {
                OsClient = osClient,
                _Keyword = LimitLogText(GetJsonString(request, "_Keyword", "Keyword"), 100),
                _SearchMonth = LimitLogText(GetJsonString(request, "_SearchMonth", "SearchMonth"), 20)
            };
            var result = MicroiEngine.MongoDB.GetSysLogStats(param).GetAwaiter().GetResult();
            return result == null ? new DosResult(0, null, "日志统计查询失败。") : result;
        }

        private static DosResult GetObservabilityApiRank(JObject request, string osClient)
        {
            var param = new ApiCallCountParam
            {
                OsClient = osClient,
                ApiEngineKey = LimitLogText(GetJsonString(request, "ApiEngineKey"), 100),
                Name = LimitLogText(GetJsonString(request, "Name"), 100),
                _PageIndex = 1,
                _PageSize = Math.Max(5, Math.Min(100, request["Top"].Val<int>() == 0 ? 20 : request["Top"].Val<int>()))
            };
            var result = MicroiEngine.MongoDB.GetApiCallCountRank(param).GetAwaiter().GetResult();
            return result == null
                ? new DosResult(0, null, "接口调用排行查询失败。")
                : new DosResult(result.Code, result.Data, result.Msg, result.DataCount);
        }

        private static DosResult GetObservabilityTrafficDetails(JObject request, string osClient)
        {
            if (!TryReadUtcDateTime(request, "WindowStartUtc", out var startUtc)
                || !TryReadUtcDateTime(request, "WindowEndUtc", out var endUtc))
                return new DosResult(0, null, "WindowStartUtc 与 WindowEndUtc 必须是有效的 ISO 8601 时间。");

            var param = new SysLogRangeQueryParam
            {
                OsClient = osClient,
                WindowStart = startUtc,
                WindowEnd = endUtc,
                Category = "Network",
                Source = "SystemObservability",
                Action = LimitLogText(GetJsonString(request, "TransferAction", "Direction"), 50),
                IP = LimitLogText(GetJsonString(request, "Ip", "IP"), 100),
                UserId = LimitLogText(GetJsonString(request, "UserId"), 100),
                Api = LimitLogText(GetJsonString(request, "Api", "Endpoint"), 500),
                Keyword = LimitLogText(GetJsonString(request, "Keyword", "_Keyword"), 100),
                PageIndex = Math.Max(1, request["PageIndex"].Val<int>()),
                PageSize = Math.Max(1, Math.Min(100, request["PageSize"].Val<int>() == 0 ? 15 : request["PageSize"].Val<int>())),
                MaxMonths = 14
            };
            var result = MicroiEngine.MongoDB.QuerySystemLogRange(param).GetAwaiter().GetResult();
            if (result == null) return new DosResult(0, null, "网络流量明细查询失败。");
            var rows = (result.Data ?? new List<SysLog>()).Select(SanitizeTrafficDetail).ToList();
            return new DosResult(result.Code, rows, result.Msg, result.DataCount);
        }

        private static object SanitizeTrafficDetail(SysLog row)
        {
            JObject details;
            try { details = JObject.Parse(row.OtherInfo ?? "{}"); }
            catch { details = new JObject(); }
            RedactSensitiveLogJson(details);
            var received = Math.Max(0L, details["ReceivedBytes"].Val<long>());
            var sent = Math.Max(0L, details["SentBytes"].Val<long>());
            var occurred = row.OccurredAt ?? row.CreateTime;
            if (occurred.Kind == DateTimeKind.Unspecified) occurred = DateTime.SpecifyKind(occurred, DateTimeKind.Local);
            var completedAtUtc = occurred.Kind == DateTimeKind.Utc ? occurred : occurred.ToUniversalTime();
            return new
            {
                row.Id,
                row.EventId,
                row.TraceId,
                CompletedAtUtc = completedAtUtc,
                Method = LimitLogText(row.RequestMethod, 20),
                Route = LimitLogText(row.Api, 500),
                EndpointKind = LimitLogText(details["EndpointKind"].Val<string>(), 50),
                ApiEngineKey = LimitLogText(details["ApiEngineKey"].Val<string>(), 100),
                Ip = LimitLogText(row.IP, 100),
                OsClient = LimitLogText(details["OsClient"].Val<string>(), 100),
                row.UserId,
                Account = LimitLogText(details["Account"].Val<string>(), 100),
                Actor = LimitLogText(row.UserName, 200),
                ClientType = LimitLogText(row.ClientType ?? details["ClientType"].Val<string>(), 100),
                StatusCode = row.HttpStatusCode,
                ElapsedMs = row.DurationMs,
                ReceivedBytes = received,
                SentBytes = sent,
                TotalBytes = received > long.MaxValue - sent ? long.MaxValue : received + sent,
                RequestContentType = LimitLogText(details["RequestContentType"].Val<string>(), 200),
                ResponseContentType = LimitLogText(details["ResponseContentType"].Val<string>(), 200),
                IsAnonymous = details["IsAnonymous"].Val<bool>(),
                IsUpload = details["IsUpload"].Val<bool>(),
                IsDownload = details["IsDownload"].Val<bool>(),
                IsSuspicious = string.Equals(row.Action, "SuspiciousTransfer", StringComparison.OrdinalIgnoreCase),
                RiskLevel = LimitLogText(details["RiskLevel"].Val<string>(), 20),
                RiskReason = LimitLogText(details["RiskReason"].Val<string>(), 500),
                Solution = LimitLogText(details["Solution"].Val<string>(), 1000),
                FileCount = Math.Max(0, details["FileCount"].Val<int>()),
                FileNames = ReadLimitedStringArray(details["FileNames"], 20, 260),
                FileExtensions = ReadLimitedStringArray(details["FileExtensions"], 20, 30),
                PrivacyNotice = "仅记录净化后的文件名、扩展名、内容类型与字节数；不保存请求正文、文件内容、QueryString、Cookie、Token 或凭据。"
            };
        }

        private static List<string> ReadLimitedStringArray(JToken token, int maxItems, int maxLength)
        {
            if (!(token is JArray values)) return new List<string>();
            return values.Take(Math.Max(0, maxItems))
                .Select(value => LimitLogText(value.Val<string>(), maxLength))
                .Where(value => !value.DosIsNullOrWhiteSpace())
                .ToList();
        }

        private static bool TryReadUtcDateTime(JObject request, string name, out DateTime value)
        {
            value = default(DateTime);
            var raw = GetJsonString(request, name);
            if (!DateTime.TryParse(raw, System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.RoundtripKind, out var parsed)) return false;
            value = parsed.Kind == DateTimeKind.Utc ? parsed : parsed.ToUniversalTime();
            return true;
        }

        private static DosResult GetObservabilityAppLogs(JObject request)
        {
            var lines = Math.Max(20, Math.Min(1000, request["Lines"].Val<int>() == 0 ? 200 : request["Lines"].Val<int>()));
            var data = SystemMonitorLogic.GetAppLogs(lines)
                .Select(SanitizeRuntimeLog)
                .ToArray();
            return new DosResult(1, data);
        }

        private static object SanitizeSystemLogRow(SysLog row)
        {
            return new
            {
                row.Id,
                row.EventId,
                row.TraceId,
                row.SpanId,
                row.ParentSpanId,
                row.ServiceName,
                row.ServiceVersion,
                row.NodeId,
                row.Environment,
                row.Category,
                row.Action,
                row.Source,
                row.Type,
                row.Title,
                Content = LimitLogText(row.Content, 4000),
                row.UserId,
                row.UserName,
                row.IP,
                row.Success,
                row.Level,
                row.DurationMs,
                row.HttpStatusCode,
                row.Api,
                row.AppId,
                Param = SanitizeLogPayload(row.Param, 12000),
                OtherInfo = SanitizeLogPayload(row.OtherInfo, 24000),
                Remark = SanitizeLogPayload(row.Remark, 8000),
                row.Mac,
                row.Browser,
                row.OS,
                row.RequestMethod,
                row.Timer,
                CreateTime = ObservabilityLocalTime(row.CreateTime),
                OccurredAt = row.OccurredAt.HasValue ? ObservabilityLocalTime(row.OccurredAt.Value) : (DateTime?)null
            };
        }

        // MongoDB 返回 UTC，旧平台 JSON 日期协议输出无时区的本地时间文本；在输出边界转换，
        // 避免 Ops 补投等带 UTC 事件在页面少显示 8 小时，不改变数据库里的真实时间点。
        internal static DateTime ObservabilityLocalTime(DateTime value)
        {
            return value.Kind == DateTimeKind.Utc ? value.ToLocalTime() : value;
        }

        private static string SanitizeLogPayload(string value, int max)
        {
            var limited = LimitLogText(value, max);
            if (limited.DosIsNullOrWhiteSpace()) return limited;
            try
            {
                var token = JToken.Parse(limited);
                RedactSensitiveLogJson(token);
                return token.ToString(Newtonsoft.Json.Formatting.Indented);
            }
            catch
            {
                return ObservabilitySecretPattern.Replace(limited, "$1=[REDACTED]");
            }
        }

        private static void RedactSensitiveLogJson(JToken token)
        {
            if (token is JObject obj)
            {
                foreach (var property in obj.Properties().ToList())
                {
                    if (ObservabilitySecretKeyPattern.IsMatch(property.Name ?? ""))
                    {
                        property.Value = "[REDACTED]";
                    }
                    else
                    {
                        RedactSensitiveLogJson(property.Value);
                    }
                }
                return;
            }
            if (token is JArray array)
            {
                foreach (var item in array) RedactSensitiveLogJson(item);
            }
        }

        private static string SanitizeRuntimeLog(string value)
        {
            var limited = LimitLogText(value, 4000);
            return ObservabilitySecretPattern.Replace(limited ?? "", "$1=[REDACTED]");
        }

        private static string NormalizeManagedIp(string raw)
        {
            if (!IPAddress.TryParse((raw ?? "").Trim(), out var address)) return null;
            if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
            if (IPAddress.IsLoopback(address) || address.Equals(IPAddress.Any)
                || address.Equals(IPAddress.IPv6Any) || address.Equals(IPAddress.None)
                || address.Equals(IPAddress.IPv6None) || address.IsIPv6Multicast)
                return null;
            return address.ToString();
        }

        private static void TrackObservabilitySecurityAction(
            string osClient,
            JObject currentUser,
            string action,
            string ip,
            string description,
            object content,
            bool success)
        {
            UserBehaviorAudit.Track(
                new BaseParam
                {
                    OsClient = osClient,
                    _CurrentUser = currentUser,
                    _InvokeType = InvokeType.Server.ToString()
                },
                "Security",
                action,
                "系统日志/监控",
                "Ip",
                ip,
                description,
                content,
                success,
                source: "V8.SystemObservability",
                eventId: UserBehaviorAudit.DeterministicEventId($"observability|{action}|{osClient}|{ip}|{DateTime.UtcNow.Ticks}"));
        }

        private static DosResult RequirePlatformObservabilityAdministrator(
            out string osClient,
            out JObject currentUser,
            string capabilityName)
        {
            var denied = RequireCurrentTenantSuperAdmin(out osClient, out currentUser, capabilityName);
            if (denied != null) return denied;
            if (!PlatformAdministratorSecurity.IsCurrentPlatformAdministrator(osClient, currentUser))
                return new DosResult(0, null, "当前账号没有平台管理员权限。");
            return null;
        }
    }
}

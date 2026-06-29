using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Dos.Common;
using Microsoft.AspNetCore.Http;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net.Api
{
    public static class SecurityGuardService
    {
        private static readonly ConcurrentDictionary<string, IpWindowState> IpWindows = new ConcurrentDictionary<string, IpWindowState>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, BlockedIpState> BlockedIps = new ConcurrentDictionary<string, BlockedIpState>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, DateTime> LastLogTimes = new ConcurrentDictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentDictionary<string, DateTime> LastAccessPersistTimes = new ConcurrentDictionary<string, DateTime>(StringComparer.OrdinalIgnoreCase);
        private static readonly ConcurrentQueue<AccessRecord> RecentAccess = new ConcurrentQueue<AccessRecord>();
        private static readonly ConcurrentQueue<SecurityPersistItem> PersistQueue = new ConcurrentQueue<SecurityPersistItem>();
        private static int RecentAccessCount;
        private static int PersistQueueCount;
        private static int PersistWorkerRunning;

        public static SecurityGuardDecision CheckBeforeRequest(HttpContext context, SecurityGuardOptions options)
        {
            var ip = GetRequestIp(context, options);
            if (string.IsNullOrWhiteSpace(ip) || IsWhitelisted(ip, options))
            {
                return SecurityGuardDecision.Allow(ip);
            }

            if (TryGetActiveBlock(ip, out var blocked))
            {
                AddRecentAccess(context, ip, "Blocked", 0, options);
                TryLogSecurityEvent(context, options, ip, "恶意攻击拦截", blocked.Reason, blocked.RequestCount, blocked.ErrorCount);
                return SecurityGuardDecision.Block(ip, blocked);
            }

            var state = IpWindows.GetOrAdd(ip, _ => new IpWindowState());
            var now = DateTime.UtcNow;
            int requestCount;
            int errorCount;
            lock (state.SyncRoot)
            {
                ResetWindowIfNeeded(state, now, options.WindowSeconds);
                state.RequestCount++;
                state.LastSeenUtc = now;
                requestCount = state.RequestCount;
                errorCount = state.ErrorCount;
            }

            if (options.PerIpMaxRequests > 0 && requestCount > options.PerIpMaxRequests)
            {
                var reason = $"IP在{options.WindowSeconds}秒内请求{requestCount}次，超过阈值{options.PerIpMaxRequests}。";
                blocked = BlockIp(ip, reason, options.BlockMinutes, false, requestCount, errorCount, ExtractOsClient(context), "HighFrequency");
                TryLogSecurityEvent(context, options, ip, "恶意攻击自动封禁", reason, requestCount, errorCount);
                return SecurityGuardDecision.Block(ip, blocked);
            }

            return SecurityGuardDecision.Allow(ip);
        }

        public static void RecordAfterRequest(HttpContext context, SecurityGuardOptions options, string ip, long elapsedMilliseconds)
        {
            if (string.IsNullOrWhiteSpace(ip) || IsWhitelisted(ip, options))
            {
                return;
            }

            AddRecentAccess(context, ip, context.Response.StatusCode.ToString(), elapsedMilliseconds, options);

            if (context.Response.StatusCode < 400)
            {
                return;
            }

            var state = IpWindows.GetOrAdd(ip, _ => new IpWindowState());
            var now = DateTime.UtcNow;
            int requestCount;
            int errorCount;
            lock (state.SyncRoot)
            {
                ResetWindowIfNeeded(state, now, options.WindowSeconds);
                state.ErrorCount++;
                state.LastSeenUtc = now;
                requestCount = state.RequestCount;
                errorCount = state.ErrorCount;
            }

            if (options.PerIpMaxErrors > 0 && errorCount > options.PerIpMaxErrors)
            {
                var reason = $"IP在{options.WindowSeconds}秒内产生{errorCount}次异常状态码，超过阈值{options.PerIpMaxErrors}。";
                BlockIp(ip, reason, options.BlockMinutes, false, requestCount, errorCount, ExtractOsClient(context), "HighError");
                TryLogSecurityEvent(context, options, ip, "恶意攻击自动封禁", reason, requestCount, errorCount);
            }
        }

        public static BlockedIpState BlockIp(
            string ip,
            string reason,
            int blockMinutes,
            bool manual,
            int requestCount = 0,
            int errorCount = 0,
            string osClient = "",
            string reasonKey = "",
            string operatorUserId = "",
            string operatorUserName = "")
        {
            var now = DateTime.UtcNow;
            var state = new BlockedIpState
            {
                Ip = ip?.Trim(),
                Reason = string.IsNullOrWhiteSpace(reason) ? (manual ? "手动封禁" : "安全防护自动封禁") : reason,
                Manual = manual,
                BlockedAtUtc = now,
                ExpiresAtUtc = now.AddMinutes(Math.Max(1, blockMinutes)),
                RequestCount = requestCount,
                ErrorCount = errorCount
            };

            if (!string.IsNullOrWhiteSpace(state.Ip))
            {
                BlockedIps[state.Ip] = state;
                EnqueueIpBlockRecord(state, osClient, manual ? "Manual" : "Auto", reasonKey, "Active", operatorUserId, operatorUserName, "");
            }

            return state;
        }

        public static bool UnblockIp(string ip, string osClient = "", string operatorUserId = "", string operatorUserName = "")
        {
            if (string.IsNullOrWhiteSpace(ip))
            {
                return false;
            }

            var ok = BlockedIps.TryRemove(ip.Trim(), out var state);
            if (ok)
            {
                EnqueueIpBlockRecord(state, osClient, state.Manual ? "Manual" : "Auto", "ManualUnblock", "Unblocked", operatorUserId, operatorUserName, "管理员手动解封。");
            }

            return ok;
        }

        public static List<BlockedIpState> GetBlockedIps()
        {
            CleanupExpiredBlocks();
            return BlockedIps.Values
                .OrderByDescending(item => item.BlockedAtUtc)
                .ToList();
        }

        public static List<AccessRecord> GetRecentAccess(int top)
        {
            if (top <= 0)
            {
                top = 200;
            }
            if (top > 5000)
            {
                top = 5000;
            }
            return RecentAccess
                .Reverse()
                .Take(top)
                .ToList();
        }

        private static void ResetWindowIfNeeded(IpWindowState state, DateTime now, int windowSeconds)
        {
            var seconds = Math.Max(1, windowSeconds);
            if (state.WindowStartUtc == default || (now - state.WindowStartUtc).TotalSeconds >= seconds)
            {
                state.WindowStartUtc = now;
                state.RequestCount = 0;
                state.ErrorCount = 0;
            }
        }

        private static bool TryGetActiveBlock(string ip, out BlockedIpState blocked)
        {
            blocked = null;
            if (string.IsNullOrWhiteSpace(ip) || !BlockedIps.TryGetValue(ip, out var state))
            {
                return false;
            }

            if (state.ExpiresAtUtc > DateTime.UtcNow)
            {
                blocked = state;
                return true;
            }

            if (BlockedIps.TryRemove(ip, out var removed))
            {
                EnqueueIpBlockRecord(removed, "", removed.Manual ? "Manual" : "Auto", "AutoExpired", "Expired", "", "", "封禁到期自动解封。");
            }
            return false;
        }

        private static void CleanupExpiredBlocks()
        {
            var now = DateTime.UtcNow;
            foreach (var item in BlockedIps)
            {
                if (item.Value.ExpiresAtUtc <= now && BlockedIps.TryRemove(item.Key, out var state))
                {
                    EnqueueIpBlockRecord(state, "", state.Manual ? "Manual" : "Auto", "AutoExpired", "Expired", "", "", "封禁到期自动解封。");
                }
            }
        }

        private static void AddRecentAccess(HttpContext context, string ip, string statusCode, long elapsedMilliseconds, SecurityGuardOptions options)
        {
            if (options.RecentAccessMaxCount <= 0)
            {
                return;
            }

            var record = new AccessRecord
            {
                TimeUtc = DateTime.UtcNow,
                Ip = ip,
                Method = context.Request.Method,
                Path = context.Request.Path.Value ?? "",
                Query = context.Request.QueryString.Value ?? "",
                StatusCode = statusCode,
                ElapsedMilliseconds = elapsedMilliseconds,
                OsClient = ExtractOsClient(context),
                UserAgent = context.Request.Headers["User-Agent"].FirstOrDefault() ?? "",
                TraceId = context.TraceIdentifier ?? ""
            };
            RecentAccess.Enqueue(record);
            Interlocked.Increment(ref RecentAccessCount);
            while (RecentAccessCount > options.RecentAccessMaxCount && RecentAccess.TryDequeue(out _))
            {
                Interlocked.Decrement(ref RecentAccessCount);
            }

            if (ShouldPersistAccessRecord(record, statusCode, options))
            {
                EnqueueAccessRecord(record, statusCode == "Blocked" ? "Blocked" : "Warn", statusCode == "Blocked" ? "封禁后访问" : "异常状态码访问");
            }
        }

        private static string GetRequestIp(HttpContext context, SecurityGuardOptions options)
        {
            var result = IPHelper.GetClientIP(context, options.RespectForwardedHeaders);
            var ip = result.Code == 1 ? result.Data : "";
            if (string.IsNullOrWhiteSpace(ip) && context?.Connection?.RemoteIpAddress != null)
            {
                ip = context.Connection.RemoteIpAddress.ToString();
            }
            if (string.IsNullOrWhiteSpace(ip))
            {
                return "";
            }
            ip = ip.Split(',').FirstOrDefault()?.Trim() ?? ip.Trim();
            if (ip.StartsWith("::ffff:", StringComparison.OrdinalIgnoreCase))
            {
                ip = ip.Substring("::ffff:".Length);
            }
            return ip;
        }

        private static bool IsWhitelisted(string ip, SecurityGuardOptions options)
        {
            if (string.IsNullOrWhiteSpace(ip))
            {
                return true;
            }
            if (ip == "::1" || ip.StartsWith("127.", StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
            foreach (var item in options.WhitelistIps)
            {
                if (string.Equals(item, ip, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
            return false;
        }

        private static string ExtractOsClient(HttpContext context)
        {
            return FirstNonBlank(
                context.Request.Query["OsClient"].FirstOrDefault(),
                context.Request.Query["osclient"].FirstOrDefault(),
                context.Request.Headers["OsClient"].FirstOrDefault(),
                context.Request.Headers["osclient"].FirstOrDefault(),
                context.Request.Headers["X-OsClient"].FirstOrDefault());
        }

        private static string FirstNonBlank(params string[] values)
        {
            return values.FirstOrDefault(item => !string.IsNullOrWhiteSpace(item))?.Trim() ?? "";
        }

        private static void TryLogSecurityEvent(HttpContext context, SecurityGuardOptions options, string ip, string title, string reason, int requestCount, int errorCount)
        {
            if (!options.LogBlockedToSysLog || string.IsNullOrWhiteSpace(ip))
            {
                return;
            }

            var logKey = $"{ip}:{title}";
            var now = DateTime.UtcNow;
            if (LastLogTimes.TryGetValue(logKey, out var last) && (now - last).TotalSeconds < options.LogIntervalSeconds)
            {
                return;
            }
            LastLogTimes[logKey] = now;

            var osClient = ExtractOsClient(context);
            var method = context.Request.Method;
            var path = context.Request.Path.Value ?? "";
            var query = context.Request.QueryString.Value;
            var statusCode = context.Response?.StatusCode;
            var userAgent = context.Request.Headers["User-Agent"].FirstOrDefault();

            EnqueueAttackEvent(osClient, ip, ToAttackType(title), title, reason, requestCount, errorCount, options.WindowSeconds, path, userAgent);

            _ = Task.Run(async () =>
            {
                try
                {
                    await MicroiEngine.MongoDB.AddSysLog(new SysLogParam
                    {
                        OsClient = osClient,
                        Type = "恶意攻击",
                        Title = title,
                        Content = reason,
                        IP = ip,
                        Api = path,
                        OtherInfo = JsonConvert.SerializeObject(new
                        {
                            Method = method,
                            Query = query,
                            StatusCode = statusCode,
                            RequestCount = requestCount,
                            ErrorCount = errorCount,
                            UserAgent = userAgent
                        }),
                        Level = 3
                    }).ConfigureAwait(false);
                }
                catch
                {
                }
            });
        }

        private static bool ShouldPersistAccessRecord(AccessRecord record, string statusCode, SecurityGuardOptions options)
        {
            if (!options.PersistSecurityTables)
            {
                return false;
            }
            if (options.PersistAllAccess)
            {
                return true;
            }

            var shouldPersist = string.Equals(statusCode, "Blocked", StringComparison.OrdinalIgnoreCase)
                || (int.TryParse(statusCode, out var code) && code >= 400);
            if (!shouldPersist)
            {
                return false;
            }

            var key = $"{record.OsClient}:{record.Ip}:{statusCode}:{record.Method}:{record.Path}";
            var now = DateTime.UtcNow;
            var interval = Math.Max(1, options.AccessPersistIntervalSeconds);
            if (LastAccessPersistTimes.TryGetValue(key, out var last) && (now - last).TotalSeconds < interval)
            {
                return false;
            }
            LastAccessPersistTimes[key] = now;

            if (LastAccessPersistTimes.Count > 20000)
            {
                var expireBefore = now.AddMinutes(-10);
                foreach (var item in LastAccessPersistTimes)
                {
                    if (item.Value < expireBefore)
                    {
                        LastAccessPersistTimes.TryRemove(item.Key, out _);
                    }
                }
            }

            return true;
        }

        private static void EnqueueAttackEvent(string osClient, string ip, string attackType, string reasonKey, string reason, int requestCount, int errorCount, int windowSeconds, string samplePath, string userAgent)
        {
            var now = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss");
            var dedupKey = $"{osClient}:{ip}:{attackType}:{DateTime.Now:yyyyMMddHHmm}";
            EnqueuePersist("mci_security_attack_event", new JObject
            {
                ["OsClient"] = osClient,
                ["OsClientKey"] = osClient,
                ["Ip"] = ip,
                ["AttackType"] = attackType,
                ["ReasonKey"] = reasonKey,
                ["ReasonText"] = reason,
                ["RequestCount"] = requestCount,
                ["ErrorCount"] = errorCount,
                ["WindowSeconds"] = windowSeconds,
                ["SamplePath"] = samplePath ?? "",
                ["SampleUserAgent"] = userAgent ?? "",
                ["FirstTime"] = now,
                ["LastTime"] = now,
                ["Status"] = "Blocked",
                ["DedupKey"] = dedupKey
            });
        }

        private static void EnqueueIpBlockRecord(BlockedIpState state, string osClient, string blockType, string reasonKey, string status, string operatorUserId, string operatorUserName, string remark)
        {
            if (state == null || string.IsNullOrWhiteSpace(state.Ip))
            {
                return;
            }

            EnqueuePersist("mci_security_ip_block", new JObject
            {
                ["OsClient"] = osClient,
                ["OsClientKey"] = osClient,
                ["Ip"] = state.Ip,
                ["BlockType"] = blockType,
                ["ReasonKey"] = reasonKey,
                ["ReasonText"] = state.Reason ?? "",
                ["Status"] = status,
                ["BlockStartTime"] = ToLocalTime(state.BlockedAtUtc),
                ["BlockEndTime"] = ToLocalTime(state.ExpiresAtUtc),
                ["UnblockTime"] = status == "Unblocked" || status == "Expired" ? DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss") : "",
                ["UnblockUserId"] = operatorUserId ?? "",
                ["UnblockUserName"] = operatorUserName ?? "",
                ["RequestCount"] = state.RequestCount,
                ["ErrorCount"] = state.ErrorCount,
                ["Remark"] = remark ?? ""
            });
        }

        private static void EnqueueAccessRecord(AccessRecord record, string riskLevel, string riskReason)
        {
            if (record == null || string.IsNullOrWhiteSpace(record.Ip))
            {
                return;
            }

            EnqueuePersist("mci_security_access_log", new JObject
            {
                ["OsClient"] = record.OsClient,
                ["OsClientKey"] = record.OsClient,
                ["Ip"] = record.Ip,
                ["AccessUserId"] = "",
                ["AccessUserName"] = "",
                ["Method"] = record.Method ?? "",
                ["Path"] = record.Path ?? "",
                ["Query"] = record.Query ?? "",
                ["StatusCode"] = record.StatusCode ?? "",
                ["ElapsedMs"] = record.ElapsedMilliseconds,
                ["RiskLevel"] = riskLevel,
                ["RiskReason"] = riskReason,
                ["UserAgent"] = record.UserAgent ?? "",
                ["RequestTime"] = ToLocalTime(record.TimeUtc),
                ["TraceId"] = record.TraceId ?? ""
            });
        }

        private static void EnqueuePersist(string tableName, JObject row)
        {
            var options = SecurityGuardOptions.From();
            if (!options.PersistSecurityTables || string.IsNullOrWhiteSpace(tableName) || row == null)
            {
                return;
            }
            if (PersistQueueCount >= options.PersistQueueMaxCount)
            {
                return;
            }

            PersistQueue.Enqueue(new SecurityPersistItem { TableName = tableName, Row = row });
            Interlocked.Increment(ref PersistQueueCount);
            EnsurePersistWorker();
        }

        private static void EnsurePersistWorker()
        {
            if (Interlocked.CompareExchange(ref PersistWorkerRunning, 1, 0) != 0)
            {
                return;
            }

            _ = Task.Run(async () =>
            {
                try
                {
                    while (PersistQueue.TryDequeue(out var item))
                    {
                        Interlocked.Decrement(ref PersistQueueCount);
                        try
                        {
                            await MicroiEngine.FormEngine.AddFormDataAsync(item.TableName, item.Row).ConfigureAwait(false);
                        }
                        catch
                        {
                        }
                    }
                }
                finally
                {
                    Interlocked.Exchange(ref PersistWorkerRunning, 0);
                    if (!PersistQueue.IsEmpty)
                    {
                        EnsurePersistWorker();
                    }
                }
            });
        }

        private static string ToAttackType(string title)
        {
            if (title?.Contains("异常") == true)
            {
                return "HighError";
            }
            if (title?.Contains("拦截") == true)
            {
                return "BlockedAccess";
            }
            return "HighFrequency";
        }

        private static string ToLocalTime(DateTime utc)
        {
            if (utc == default)
            {
                return "";
            }
            return utc.Kind == DateTimeKind.Utc
                ? utc.ToLocalTime().ToString("yyyy-MM-dd HH:mm:ss")
                : utc.ToString("yyyy-MM-dd HH:mm:ss");
        }
    }

    public sealed class SecurityGuardOptions
    {
        public bool Enabled { get; private set; } = true;
        public int WindowSeconds { get; private set; } = 10;
        public int PerIpMaxRequests { get; private set; } = 600;
        public int PerIpMaxErrors { get; private set; } = 120;
        public int BlockMinutes { get; private set; } = 30;
        public int RecentAccessMaxCount { get; private set; } = 5000;
        public int LogIntervalSeconds { get; private set; } = 60;
        public int AccessPersistIntervalSeconds { get; private set; } = 10;
        public bool RespectForwardedHeaders { get; private set; } = true;
        public bool LogBlockedToSysLog { get; private set; } = true;
        public bool PersistSecurityTables { get; private set; } = true;
        public bool PersistAllAccess { get; private set; }
        public int PersistQueueMaxCount { get; private set; } = 10000;
        public HashSet<string> WhitelistIps { get; private set; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        public static SecurityGuardOptions From()
        {
            var options = new SecurityGuardOptions
            {
                Enabled = ConfigHelper.GetEnvOrConfigurationBool("MICROI_SECURITY_GUARD_ENABLED", "SecurityGuard:Enabled", true),
                WindowSeconds = ConfigHelper.GetEnvOrConfigurationInt("MICROI_SECURITY_WINDOW_SECONDS", "SecurityGuard:WindowSeconds", 10),
                PerIpMaxRequests = ConfigHelper.GetEnvOrConfigurationInt("MICROI_SECURITY_PER_IP_MAX_REQUESTS", "SecurityGuard:PerIpMaxRequests", 600),
                PerIpMaxErrors = ConfigHelper.GetEnvOrConfigurationInt("MICROI_SECURITY_PER_IP_MAX_ERRORS", "SecurityGuard:PerIpMaxErrors", 120),
                BlockMinutes = ConfigHelper.GetEnvOrConfigurationInt("MICROI_SECURITY_BLOCK_MINUTES", "SecurityGuard:BlockMinutes", 30),
                RecentAccessMaxCount = ConfigHelper.GetEnvOrConfigurationInt("MICROI_SECURITY_RECENT_ACCESS_MAX_COUNT", "SecurityGuard:RecentAccessMaxCount", 5000),
                LogIntervalSeconds = ConfigHelper.GetEnvOrConfigurationInt("MICROI_SECURITY_LOG_INTERVAL_SECONDS", "SecurityGuard:LogIntervalSeconds", 60),
                AccessPersistIntervalSeconds = ConfigHelper.GetEnvOrConfigurationInt("MICROI_SECURITY_ACCESS_PERSIST_INTERVAL_SECONDS", "SecurityGuard:AccessPersistIntervalSeconds", 10),
                RespectForwardedHeaders = ConfigHelper.GetEnvOrConfigurationBool("MICROI_SECURITY_RESPECT_FORWARDED_HEADERS", "SecurityGuard:RespectForwardedHeaders", true),
                LogBlockedToSysLog = ConfigHelper.GetEnvOrConfigurationBool("MICROI_SECURITY_LOG_BLOCKED_TO_SYSLOG", "SecurityGuard:LogBlockedToSysLog", true),
                PersistSecurityTables = ConfigHelper.GetEnvOrConfigurationBool("MICROI_SECURITY_PERSIST_TABLES", "SecurityGuard:PersistSecurityTables", true),
                PersistAllAccess = ConfigHelper.GetEnvOrConfigurationBool("MICROI_SECURITY_PERSIST_ALL_ACCESS", "SecurityGuard:PersistAllAccess", false),
                PersistQueueMaxCount = ConfigHelper.GetEnvOrConfigurationInt("MICROI_SECURITY_PERSIST_QUEUE_MAX", "SecurityGuard:PersistQueueMaxCount", 10000)
            };

            var whitelist = ConfigHelper.GetEnvOrConfiguration("MICROI_SECURITY_WHITELIST_IPS", "SecurityGuard:WhitelistIps")
                            ?? "127.0.0.1,::1";
            options.WhitelistIps = whitelist
                .Split(new[] { ',', ';', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(item => item.Trim())
                .Where(item => !string.IsNullOrWhiteSpace(item))
                .ToHashSet(StringComparer.OrdinalIgnoreCase);
            return options;
        }
    }

    public sealed class SecurityGuardDecision
    {
        public bool IsBlocked { get; private set; }
        public string Ip { get; private set; }
        public BlockedIpState BlockedIp { get; private set; }

        public static SecurityGuardDecision Allow(string ip)
        {
            return new SecurityGuardDecision { Ip = ip };
        }

        public static SecurityGuardDecision Block(string ip, BlockedIpState blockedIp)
        {
            return new SecurityGuardDecision { Ip = ip, IsBlocked = true, BlockedIp = blockedIp };
        }
    }

    public sealed class BlockedIpState
    {
        public string Ip { get; set; }
        public string Reason { get; set; }
        public bool Manual { get; set; }
        public DateTime BlockedAtUtc { get; set; }
        public DateTime ExpiresAtUtc { get; set; }
        public int RequestCount { get; set; }
        public int ErrorCount { get; set; }
    }

    public sealed class AccessRecord
    {
        public DateTime TimeUtc { get; set; }
        public string Ip { get; set; }
        public string Method { get; set; }
        public string Path { get; set; }
        public string Query { get; set; }
        public string StatusCode { get; set; }
        public long ElapsedMilliseconds { get; set; }
        public string OsClient { get; set; }
        public string UserAgent { get; set; }
        public string TraceId { get; set; }
    }

    internal sealed class SecurityPersistItem
    {
        public string TableName { get; set; }
        public JObject Row { get; set; }
    }

    internal sealed class IpWindowState
    {
        public object SyncRoot { get; } = new object();
        public DateTime WindowStartUtc { get; set; }
        public int RequestCount { get; set; }
        public int ErrorCount { get; set; }
        public DateTime LastSeenUtc { get; set; }
    }
}

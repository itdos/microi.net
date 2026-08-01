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
using StackExchange.Redis;

namespace Microi.net
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

        public static SecurityGuardDecision CheckBeforeRequest(
            HttpContext context,
            SecurityGuardOptions options,
            SecurityGuardRequestProfile profile = null)
        {
            profile ??= SecurityGuardRequestProfile.Normal;
            var ip = GetRequestIp(context);
            var securityScope = ResolveSecurityScope(context, profile);
            if (string.IsNullOrWhiteSpace(ip) || IsWhitelisted(ip, options))
            {
                return SecurityGuardDecision.Allow(
                    ip,
                    BuildWindowKey(securityScope, ip, profile),
                    profile.IsTrustedVsCode,
                    securityScope,
                    "Bypassed");
            }

            if (TryGetActiveBlock(securityScope, ip, out var blocked, out var blockBackend))
            {
                // 已通过活动 Token、超级管理员级别、Token 绑定 did 与只读路由四重
                // 校验的 VS Code 拉取，不继承普通浏览器流量造成的 HighFrequency
                // 自动封禁；手动封禁、高错误率封禁和 VS Code 自身超限仍然有效。
                var canBypassOrdinaryFrequencyBlock = profile.IsTrustedVsCode
                    && !blocked.Manual
                    && string.Equals(blocked.ReasonKey, "HighFrequency", StringComparison.Ordinal);
                if (!canBypassOrdinaryFrequencyBlock)
                {
                    AddRecentAccess(context, ip, "Blocked", 0, options);
                    TryLogSecurityEvent(context, options, ip, "恶意攻击拦截", blocked.Reason, blocked.RequestCount, blocked.ErrorCount);
                    return SecurityGuardDecision.Block(
                        ip,
                        blocked,
                        BuildWindowKey(securityScope, ip, profile),
                        profile.IsTrustedVsCode,
                        securityScope,
                        blockBackend);
                }
            }

            var windowKey = BuildWindowKey(securityScope, ip, profile);
            int requestCount;
            int errorCount;
            string stateBackend;
            if (TryIncrementSharedWindow(
                    securityScope,
                    ip,
                    profile.IsTrustedVsCode,
                    "requests",
                    options.WindowSeconds,
                    out requestCount))
            {
                stateBackend = "SharedRedis";
                TryReadSharedWindow(
                    securityScope,
                    ip,
                    profile.IsTrustedVsCode,
                    "errors",
                    options.WindowSeconds,
                    out errorCount);
            }
            else
            {
                // Redis 短暂不可用时明确降级到本节点保护，不能停用安全防护；
                // BlockedIpState/响应会标记 ProcessFallback，禁止宣称跨节点一致。
                stateBackend = "ProcessFallback";
                var state = IpWindows.GetOrAdd(windowKey, _ => new IpWindowState());
                var now = DateTime.UtcNow;
                lock (state.SyncRoot)
                {
                    ResetWindowIfNeeded(state, now, options.WindowSeconds);
                    state.RequestCount++;
                    state.LastSeenUtc = now;
                    requestCount = state.RequestCount;
                    errorCount = state.ErrorCount;
                }
            }

            var maxRequests = profile.IsTrustedVsCode
                ? options.TrustedVsCodePerIpMaxRequests
                : options.PerIpMaxRequests;
            if (maxRequests > 0 && requestCount > maxRequests)
            {
                var clientLabel = profile.IsTrustedVsCode ? "受信 VS Code 只读拉取" : "IP";
                var reason = $"{clientLabel}在{options.WindowSeconds}秒内请求{requestCount}次，超过阈值{maxRequests}。";
                var reasonKey = profile.IsTrustedVsCode
                    ? "TrustedVsCodeHighFrequency"
                    : "HighFrequency";
                blocked = BlockIp(ip, reason, options.BlockMinutes, false, requestCount, errorCount, securityScope, reasonKey);
                TryLogSecurityEvent(context, options, ip, "恶意攻击自动封禁", reason, requestCount, errorCount);
                return SecurityGuardDecision.Block(
                    ip,
                    blocked,
                    windowKey,
                    profile.IsTrustedVsCode,
                    securityScope,
                    blocked.StateBackend);
            }

            return SecurityGuardDecision.Allow(
                ip,
                windowKey,
                profile.IsTrustedVsCode,
                securityScope,
                stateBackend);
        }

        public static void RecordAfterRequest(HttpContext context, SecurityGuardOptions options, string ip, long elapsedMilliseconds)
        {
            RecordAfterRequest(
                context,
                options,
                SecurityGuardDecision.Allow(
                    ip,
                    ip,
                    false,
                    ResolveSecurityScope(context, SecurityGuardRequestProfile.Normal),
                    "ProcessFallback"),
                elapsedMilliseconds);
        }

        public static void RecordAfterRequest(
            HttpContext context,
            SecurityGuardOptions options,
            SecurityGuardDecision decision,
            long elapsedMilliseconds)
        {
            var ip = decision?.Ip;
            if (string.IsNullOrWhiteSpace(ip) || IsWhitelisted(ip, options))
            {
                return;
            }

            AddRecentAccess(context, ip, context.Response.StatusCode.ToString(), elapsedMilliseconds, options);

            if (context.Response.StatusCode < 400)
            {
                return;
            }

            var windowKey = !string.IsNullOrWhiteSpace(decision?.WindowKey)
                ? decision.WindowKey
                : ip;
            var securityScope = !string.IsNullOrWhiteSpace(decision?.SecurityScope)
                ? decision.SecurityScope
                : ResolveSecurityScope(context, SecurityGuardRequestProfile.Normal);
            int requestCount;
            int errorCount;
            if (string.Equals(decision?.StateBackend, "SharedRedis", StringComparison.Ordinal)
                && TryIncrementSharedWindow(
                    securityScope,
                    ip,
                    decision?.IsTrustedVsCode == true,
                    "errors",
                    options.WindowSeconds,
                    out errorCount))
            {
                TryReadSharedWindow(
                    securityScope,
                    ip,
                    decision?.IsTrustedVsCode == true,
                    "requests",
                    options.WindowSeconds,
                    out requestCount);
            }
            else
            {
                var state = IpWindows.GetOrAdd(windowKey, _ => new IpWindowState());
                var now = DateTime.UtcNow;
                lock (state.SyncRoot)
                {
                    ResetWindowIfNeeded(state, now, options.WindowSeconds);
                    state.ErrorCount++;
                    state.LastSeenUtc = now;
                    requestCount = state.RequestCount;
                    errorCount = state.ErrorCount;
                }
            }

            var maxErrors = decision?.IsTrustedVsCode == true
                ? options.TrustedVsCodePerIpMaxErrors
                : options.PerIpMaxErrors;
            if (maxErrors > 0 && errorCount > maxErrors)
            {
                var clientLabel = decision?.IsTrustedVsCode == true ? "受信 VS Code 只读拉取" : "IP";
                var reason = $"{clientLabel}在{options.WindowSeconds}秒内产生{errorCount}次异常状态码，超过阈值{maxErrors}。";
                var reasonKey = decision?.IsTrustedVsCode == true
                    ? "TrustedVsCodeHighError"
                    : "HighError";
                BlockIp(ip, reason, options.BlockMinutes, false, requestCount, errorCount, securityScope, reasonKey);
                TryLogSecurityEvent(context, options, ip, "恶意攻击自动封禁", reason, requestCount, errorCount);
            }
        }

        private static string BuildWindowKey(
            string securityScope,
            string ip,
            SecurityGuardRequestProfile profile)
        {
            return profile?.IsTrustedVsCode == true
                ? $"{securityScope}|{ip}|trusted-vscode-read"
                : $"{securityScope}|{ip}|ordinary";
        }

        private static string ResolveSecurityScope(
            HttpContext context,
            SecurityGuardRequestProfile profile)
        {
            // 普通请求必须共用当前 API 运行实例的计数域。请求方可控的 Query/Header
            // 不能选择 Redis 计数桶，否则匿名请求可以轮换已存在的 OsClient 绕过阈值。
            // 只有已由活动 Token + did + Level + 只读路由联合确认的 VS Code profile
            // 才允许使用该 Token 服务端绑定的租户域。
            return SecurityGuardRuntimePolicy.ResolveSecurityScope(
                context,
                profile,
                OsClientExtend.GetConfigOsClient());
        }

        private static string NormalizeSecurityScope(string osClient)
        {
            var value = (osClient ?? "").Trim();
            if (value.Length == 0) value = "default";
            return value.Length <= 100 ? value : value.Substring(0, 100);
        }

        private static bool TryIncrementSharedWindow(
            string securityScope,
            string ip,
            bool trustedVsCode,
            string counterType,
            int windowSeconds,
            out int count)
        {
            count = 0;
            try
            {
                var database = MicroiEngine.CacheTenant.Default().GetIDatabase();
                if (database == null) return false;
                var seconds = Math.Max(1, windowSeconds);
                var bucket = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / seconds;
                var key = SecurityGuardDistributedKeys.BuildWindowKey(
                    securityScope,
                    ip,
                    trustedVsCode,
                    counterType,
                    bucket);
                var result = database.ScriptEvaluate(
                    SecurityGuardDistributedKeys.AtomicWindowCounterScript,
                    new RedisKey[] { key },
                    new RedisValue[] { Math.Max(2, seconds * 3) });
                count = (int)Math.Min(int.MaxValue, (long)result);
                return true;
            }
            catch
            {
                count = 0;
                return false;
            }
        }

        private static bool TryReadSharedWindow(
            string securityScope,
            string ip,
            bool trustedVsCode,
            string counterType,
            int windowSeconds,
            out int count)
        {
            count = 0;
            try
            {
                var database = MicroiEngine.CacheTenant.Default().GetIDatabase();
                if (database == null) return false;
                var seconds = Math.Max(1, windowSeconds);
                var bucket = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / seconds;
                var key = SecurityGuardDistributedKeys.BuildWindowKey(
                    securityScope,
                    ip,
                    trustedVsCode,
                    counterType,
                    bucket);
                var value = database.StringGet(key);
                if (value.IsNullOrEmpty) return true;
                count = int.TryParse(value.ToString(), out var parsed)
                    ? Math.Max(0, parsed)
                    : 0;
                return true;
            }
            catch
            {
                count = 0;
                return false;
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
            var securityScope = NormalizeSecurityScope(
                string.IsNullOrWhiteSpace(osClient) ? OsClientExtend.GetConfigOsClient() : osClient);
            var state = new BlockedIpState
            {
                Ip = ip?.Trim(),
                SecurityScope = securityScope,
                Reason = string.IsNullOrWhiteSpace(reason) ? (manual ? "手动封禁" : "安全防护自动封禁") : reason,
                ReasonKey = reasonKey ?? "",
                Manual = manual,
                BlockedAtUtc = now,
                ExpiresAtUtc = now.AddMinutes(Math.Max(1, blockMinutes)),
                RequestCount = requestCount,
                ErrorCount = errorCount
            };

            if (!string.IsNullOrWhiteSpace(state.Ip))
            {
                state.StateBackend = TryWriteSharedBlock(securityScope, state)
                    ? "SharedRedis"
                    : "ProcessFallback";
                BlockedIps[BuildLocalBlockKey(securityScope, state.Ip)] = state;
                EnqueueIpBlockRecord(state, securityScope, manual ? "Manual" : "Auto", reasonKey, "Active", operatorUserId, operatorUserName, "");
            }

            return state;
        }

        public static bool UnblockIp(string ip, string osClient = "", string operatorUserId = "", string operatorUserName = "")
        {
            if (string.IsNullOrWhiteSpace(ip))
            {
                return false;
            }

            var securityScope = NormalizeSecurityScope(
                string.IsNullOrWhiteSpace(osClient) ? OsClientExtend.GetConfigOsClient() : osClient);
            var localOk = BlockedIps.TryRemove(
                BuildLocalBlockKey(securityScope, ip.Trim()),
                out var state);
            TryReadSharedBlock(securityScope, ip.Trim(), out var sharedState, out _);
            var sharedOk = TryDeleteSharedBlock(securityScope, ip.Trim());
            state ??= sharedState;
            var ok = localOk || sharedOk || sharedState != null;
            if (ok && state != null)
            {
                EnqueueIpBlockRecord(state, osClient, state.Manual ? "Manual" : "Auto", "ManualUnblock", "Unblocked", operatorUserId, operatorUserName, "管理员手动解封。");
            }

            return ok;
        }

        public static List<BlockedIpState> GetBlockedIps(string osClient = "")
        {
            var securityScope = NormalizeSecurityScope(
                string.IsNullOrWhiteSpace(osClient) ? OsClientExtend.GetConfigOsClient() : osClient);
            CleanupExpiredBlocks(securityScope);
            var local = BlockedIps.Values
                .Where(item => string.Equals(
                    item.SecurityScope,
                    securityScope,
                    StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (TryGetAllSharedBlocks(securityScope, out var shared))
            {
                var sharedIps = shared
                    .Select(item => item.Ip)
                    .Where(item => !string.IsNullOrWhiteSpace(item))
                    .ToHashSet(StringComparer.OrdinalIgnoreCase);
                foreach (var item in local)
                {
                    if (!sharedIps.Contains(item.Ip))
                    {
                        BlockedIps.TryRemove(
                            BuildLocalBlockKey(securityScope, item.Ip),
                            out _);
                    }
                }

                // Redis 可用时列表也以共享状态为准，不能把旧节点缓存继续展示成
                // 活动封禁；Redis 不可用时才返回本节点降级状态。
                return shared
                    .OrderByDescending(item => item.BlockedAtUtc)
                    .ToList();
            }
            return local
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

        private static bool TryGetActiveBlock(
            string securityScope,
            string ip,
            out BlockedIpState blocked,
            out string stateBackend)
        {
            blocked = null;
            stateBackend = "ProcessFallback";
            if (string.IsNullOrWhiteSpace(ip))
            {
                return false;
            }

            var localKey = BuildLocalBlockKey(securityScope, ip);
            BlockedIps.TryGetValue(localKey, out var localState);
            TryReadSharedBlock(
                securityScope,
                ip,
                out var sharedState,
                out var sharedAvailable);
            var source = SecurityGuardRuntimePolicy.ResolveActiveBlockSource(
                sharedAvailable,
                sharedState,
                localState,
                DateTime.UtcNow);

            if (source == SecurityGuardBlockSource.SharedRedis)
            {
                sharedState.StateBackend = "SharedRedis";
                BlockedIps[localKey] = sharedState;
                blocked = sharedState;
                stateBackend = "SharedRedis";
                return true;
            }

            if (sharedAvailable)
            {
                // Redis 可访问且字段不存在就是全局权威的“已解封”。节点内旧缓存只能
                // 被删除，绝不能回写 Redis，否则其它节点执行的手动解封会被复活。
                BlockedIps.TryRemove(localKey, out _);
                stateBackend = "SharedRedis";
                return false;
            }

            if (source == SecurityGuardBlockSource.ProcessFallback)
            {
                localState.StateBackend = "ProcessFallback";
                blocked = localState;
                return true;
            }

            if (BlockedIps.TryRemove(localKey, out var removed))
            {
                // 只有 Redis 不可用时才会走本地降级。此处不得在 Redis 恢复竞态中
                // 删除共享字段；共享字段自己的到期清理由共享读取路径负责。
                EnqueueIpBlockRecord(removed, securityScope, removed.Manual ? "Manual" : "Auto", "AutoExpired", "Expired", "", "", "封禁到期自动解封。");
            }
            return false;
        }

        private static void CleanupExpiredBlocks(string securityScope)
        {
            var now = DateTime.UtcNow;
            foreach (var item in BlockedIps)
            {
                if (string.Equals(item.Value.SecurityScope, securityScope, StringComparison.OrdinalIgnoreCase)
                    && item.Value.ExpiresAtUtc <= now
                    && BlockedIps.TryRemove(item.Key, out var state))
                {
                    // 本机缓存不是事实源，不能凭旧到期时间删除可能已被其它节点续期的
                    // Redis 封禁。共享过期字段由 TryRead/GetAllSharedBlocks 自行清理。
                    EnqueueIpBlockRecord(state, securityScope, state.Manual ? "Manual" : "Auto", "AutoExpired", "Expired", "", "", "封禁到期自动解封。");
                }
            }
        }

        private static string BuildLocalBlockKey(string securityScope, string ip)
        {
            return $"{NormalizeSecurityScope(securityScope)}|{(ip ?? "").Trim()}";
        }

        private static bool TryWriteSharedBlock(string securityScope, BlockedIpState state)
        {
            if (state == null || string.IsNullOrWhiteSpace(state.Ip)) return false;
            try
            {
                var database = MicroiEngine.CacheTenant.Default().GetIDatabase();
                if (database == null) return false;
                state.SecurityScope = NormalizeSecurityScope(securityScope);
                state.StateBackend = "SharedRedis";
                var hashKey = SecurityGuardDistributedKeys.BuildBlockHashKey(state.SecurityScope);
                database.HashSet(hashKey, state.Ip, JsonConvert.SerializeObject(state));
                var retention = state.ExpiresAtUtc - DateTime.UtcNow + TimeSpan.FromDays(1);
                database.KeyExpire(hashKey, retention > TimeSpan.FromDays(1)
                    ? retention
                    : TimeSpan.FromDays(1));
                return true;
            }
            catch
            {
                state.StateBackend = "ProcessFallback";
                return false;
            }
        }

        private static bool TryReadSharedBlock(
            string securityScope,
            string ip,
            out BlockedIpState state,
            out bool backendAvailable)
        {
            state = null;
            backendAvailable = false;
            try
            {
                var database = MicroiEngine.CacheTenant.Default().GetIDatabase();
                if (database == null) return false;
                backendAvailable = true;
                var hashKey = SecurityGuardDistributedKeys.BuildBlockHashKey(securityScope);
                var value = database.HashGet(hashKey, ip);
                if (value.IsNullOrEmpty) return true;
                state = JsonConvert.DeserializeObject<BlockedIpState>(value.ToString());
                if (state == null || state.ExpiresAtUtc <= DateTime.UtcNow)
                {
                    database.HashDelete(hashKey, ip);
                    state = null;
                    return true;
                }
                state.SecurityScope = NormalizeSecurityScope(securityScope);
                state.StateBackend = "SharedRedis";
                return true;
            }
            catch
            {
                state = null;
                backendAvailable = false;
                return false;
            }
        }

        private static bool TryDeleteSharedBlock(string securityScope, string ip)
        {
            try
            {
                var database = MicroiEngine.CacheTenant.Default().GetIDatabase();
                if (database == null) return false;
                return database.HashDelete(
                    SecurityGuardDistributedKeys.BuildBlockHashKey(securityScope),
                    ip);
            }
            catch
            {
                return false;
            }
        }

        private static bool TryGetAllSharedBlocks(
            string securityScope,
            out List<BlockedIpState> states)
        {
            states = new List<BlockedIpState>();
            try
            {
                var database = MicroiEngine.CacheTenant.Default().GetIDatabase();
                if (database == null) return false;
                var hashKey = SecurityGuardDistributedKeys.BuildBlockHashKey(securityScope);
                var now = DateTime.UtcNow;
                foreach (var entry in database.HashGetAll(hashKey))
                {
                    BlockedIpState state = null;
                    try
                    {
                        state = JsonConvert.DeserializeObject<BlockedIpState>(entry.Value.ToString());
                    }
                    catch
                    {
                    }
                    if (state == null || state.ExpiresAtUtc <= now)
                    {
                        database.HashDelete(hashKey, entry.Name);
                        continue;
                    }
                    state.SecurityScope = NormalizeSecurityScope(securityScope);
                    state.StateBackend = "SharedRedis";
                    states.Add(state);
                    BlockedIps[BuildLocalBlockKey(securityScope, state.Ip)] = state;
                }
                return true;
            }
            catch
            {
                states = new List<BlockedIpState>();
                return false;
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

        private static string GetRequestIp(HttpContext context)
        {
            // X-Forwarded-For 只允许由 Program 中 ForwardedHeadersMiddleware 在
            // KnownProxies/KnownNetworks 校验通过后写入 RemoteIpAddress。这里永远不
            // 直接读取请求 Header，避免伪造 127.0.0.1 绕过白名单。
            return SecurityGuardRuntimePolicy.GetConnectionIp(context);
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

    public enum SecurityGuardBlockSource
    {
        None = 0,
        SharedRedis = 1,
        ProcessFallback = 2
    }

    /// <summary>
    /// 安全防护中不依赖 Redis/数据库的判定规则。公开为纯函数，便于部署前对代理、
    /// 计数域与多节点解封权威性做定向回归；真实请求仍由 SecurityGuardService 执行。
    /// </summary>
    public static class SecurityGuardRuntimePolicy
    {
        public static string GetConnectionIp(HttpContext context)
        {
            var address = context?.Connection?.RemoteIpAddress;
            if (address == null)
            {
                return "";
            }

            if (address.IsIPv4MappedToIPv6)
            {
                address = address.MapToIPv4();
            }
            return address.ToString();
        }

        public static string ResolveSecurityScope(
            HttpContext context,
            SecurityGuardRequestProfile profile,
            string configuredOsClient)
        {
            // context 故意不参与普通计数域选择。保留参数是为了让调用点和回归测试
            // 明确验证：Query/Header 中任意 OsClient 都不能创建新计数桶。
            _ = context;
            var scope = profile?.IsTrustedVsCode == true
                        && !string.IsNullOrWhiteSpace(profile.OsClient)
                ? profile.OsClient
                : configuredOsClient;
            var value = (scope ?? "").Trim();
            if (value.Length == 0) value = "default";
            return value.Length <= 100 ? value : value.Substring(0, 100);
        }

        public static SecurityGuardBlockSource ResolveActiveBlockSource(
            bool sharedBackendAvailable,
            BlockedIpState sharedState,
            BlockedIpState localState,
            DateTime utcNow)
        {
            if (sharedBackendAvailable)
            {
                return sharedState != null && sharedState.ExpiresAtUtc > utcNow
                    ? SecurityGuardBlockSource.SharedRedis
                    : SecurityGuardBlockSource.None;
            }

            return localState != null && localState.ExpiresAtUtc > utcNow
                ? SecurityGuardBlockSource.ProcessFallback
                : SecurityGuardBlockSource.None;
        }
    }

    public static class SecurityGuardDistributedKeys
    {
        public const string AtomicWindowCounterScript = @"
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count";

        public static string BuildWindowKey(
            string osClient,
            string ip,
            bool trustedVsCode,
            string counterType,
            long windowBucket)
        {
            var scope = EscapeSegment(osClient, "default");
            var address = EscapeSegment(ip, "unknown");
            var profile = trustedVsCode ? "trusted-vscode-read" : "ordinary";
            var counter = string.Equals(counterType, "errors", StringComparison.OrdinalIgnoreCase)
                ? "errors"
                : "requests";
            return $"Microi:{{{scope}}}:SecurityGuard:Window:{profile}:{counter}:{windowBucket}:{address}";
        }

        public static string BuildBlockHashKey(string osClient)
        {
            var scope = EscapeSegment(osClient, "default");
            return $"Microi:{{{scope}}}:SecurityGuard:BlockedIps";
        }

        private static string EscapeSegment(string value, string fallback)
        {
            var normalized = string.IsNullOrWhiteSpace(value)
                ? fallback
                : value.Trim().ToLowerInvariant();
            return Uri.EscapeDataString(normalized);
        }
    }

    /// <summary>
    /// 识别受信 VS Code 只读拉取。任何单独的 User-Agent、did、ClientType
    /// 或自定义 Header 都不能建立信任；必须由后端活动登录态完成联合校验。
    /// </summary>
    public static class SecurityGuardTrustResolver
    {
        public static async Task<SecurityGuardRequestProfile> ResolveAsync(HttpContext context)
        {
            if (!IsReadOnlyVsCodePath(context?.Request?.Path.Value))
            {
                return SecurityGuardRequestProfile.Normal;
            }

            try
            {
                var requestToken = NormalizeBearerToken(
                    context.Request.Headers["Authorization"].FirstOrDefault());
                var osClient = context.Request.Headers["OsClient"].FirstOrDefault()
                    ?? context.Request.Query["OsClient"].FirstOrDefault()
                    ?? "";
                var currentToken = await DiyToken
                    .GetCurrentToken(requestToken, osClient)
                    .ConfigureAwait(false);
                return IsTrustedVsCodeRequest(context, currentToken)
                    ? SecurityGuardRequestProfile.CreateTrustedVsCode(currentToken?.OsClient)
                    : SecurityGuardRequestProfile.Normal;
            }
            catch
            {
                return SecurityGuardRequestProfile.Normal;
            }
        }

        public static bool IsTrustedVsCodeRequest(HttpContext context, CurrentToken currentToken)
        {
            if (context == null
                || currentToken?.CurrentUser == null
                || currentToken.CurrentUser["Level"].Val<int>() < DiyCommon.MaxRoleLevel
                || !IsReadOnlyVsCodePath(context.Request.Path.Value))
            {
                return false;
            }

            var requestToken = NormalizeBearerToken(
                context.Request.Headers["Authorization"].FirstOrDefault());
            var did = context.Request.Headers["did"].FirstOrDefault()?.Trim() ?? "";
            if (string.IsNullOrWhiteSpace(requestToken)
                || !did.StartsWith("VSCode:", StringComparison.Ordinal)
                || did.Length > 256)
            {
                return false;
            }

            var activeEntry = DiyToken.GetActiveCachedTokenEntry(currentToken, requestToken);
            return activeEntry != null
                && string.Equals(activeEntry.ClientType, "VSCode", StringComparison.Ordinal)
                && string.Equals(activeEntry.Did, did, StringComparison.Ordinal);
        }

        public static bool IsReadOnlyVsCodePath(string path)
        {
            if (string.IsNullOrWhiteSpace(path)) return false;
            return path.StartsWith("/api/V8Debug/Get", StringComparison.OrdinalIgnoreCase)
                || path.StartsWith("/api/V8Debug/List", StringComparison.OrdinalIgnoreCase);
        }

        private static string NormalizeBearerToken(string value)
        {
            var token = value?.Trim() ?? "";
            return token.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
                ? token.Substring("Bearer ".Length).Trim()
                : token;
        }
    }

    public sealed class SecurityGuardRequestProfile
    {
        public static SecurityGuardRequestProfile Normal { get; } = new SecurityGuardRequestProfile(false, "");

        private SecurityGuardRequestProfile(bool isTrustedVsCode, string osClient)
        {
            IsTrustedVsCode = isTrustedVsCode;
            OsClient = osClient ?? "";
        }

        public static SecurityGuardRequestProfile CreateTrustedVsCode(string osClient)
        {
            return new SecurityGuardRequestProfile(true, osClient);
        }

        public bool IsTrustedVsCode { get; }
        public string OsClient { get; }
    }

    public sealed class SecurityGuardOptions
    {
        public bool Enabled { get; private set; } = true;
        public int WindowSeconds { get; private set; } = 10;
        public int PerIpMaxRequests { get; private set; } = 600;
        public int PerIpMaxErrors { get; private set; } = 120;
        public int TrustedVsCodePerIpMaxRequests { get; private set; } = 6000;
        public int TrustedVsCodePerIpMaxErrors { get; private set; } = 1200;
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
                Enabled = ConfigHelper.GetRuntimeConfigurationBool("SecurityGuard:Enabled", true),
                WindowSeconds = ConfigHelper.GetRuntimeConfigurationInt("SecurityGuard:WindowSeconds", 10),
                PerIpMaxRequests = ConfigHelper.GetRuntimeConfigurationInt("SecurityGuard:PerIpMaxRequests", 600),
                PerIpMaxErrors = ConfigHelper.GetRuntimeConfigurationInt("SecurityGuard:PerIpMaxErrors", 120),
                TrustedVsCodePerIpMaxRequests = ConfigHelper.GetRuntimeConfigurationInt("SecurityGuard:TrustedVsCodePerIpMaxRequests", 6000),
                TrustedVsCodePerIpMaxErrors = ConfigHelper.GetRuntimeConfigurationInt("SecurityGuard:TrustedVsCodePerIpMaxErrors", 1200),
                BlockMinutes = ConfigHelper.GetRuntimeConfigurationInt("SecurityGuard:BlockMinutes", 30),
                RecentAccessMaxCount = ConfigHelper.GetRuntimeConfigurationInt("SecurityGuard:RecentAccessMaxCount", 5000),
                LogIntervalSeconds = ConfigHelper.GetRuntimeConfigurationInt("SecurityGuard:LogIntervalSeconds", 60),
                AccessPersistIntervalSeconds = ConfigHelper.GetRuntimeConfigurationInt("SecurityGuard:AccessPersistIntervalSeconds", 10),
                RespectForwardedHeaders = ConfigHelper.GetRuntimeConfigurationBool("SecurityGuard:RespectForwardedHeaders", true),
                LogBlockedToSysLog = ConfigHelper.GetRuntimeConfigurationBool("SecurityGuard:LogBlockedToSysLog", true),
                PersistSecurityTables = ConfigHelper.GetRuntimeConfigurationBool("SecurityGuard:PersistSecurityTables", true),
                PersistAllAccess = ConfigHelper.GetRuntimeConfigurationBool("SecurityGuard:PersistAllAccess", false),
                PersistQueueMaxCount = ConfigHelper.GetRuntimeConfigurationInt("SecurityGuard:PersistQueueMaxCount", 10000)
            };

            var whitelist = ConfigHelper.GetRuntimeConfigurationValue("SecurityGuard:WhitelistIps")
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
        public string WindowKey { get; private set; }
        public bool IsTrustedVsCode { get; private set; }
        public string SecurityScope { get; private set; }
        public string StateBackend { get; private set; }
        public BlockedIpState BlockedIp { get; private set; }

        public static SecurityGuardDecision Allow(
            string ip,
            string windowKey = null,
            bool isTrustedVsCode = false,
            string securityScope = "",
            string stateBackend = "ProcessFallback")
        {
            return new SecurityGuardDecision
            {
                Ip = ip,
                WindowKey = windowKey ?? ip,
                IsTrustedVsCode = isTrustedVsCode,
                SecurityScope = securityScope ?? "",
                StateBackend = stateBackend ?? "ProcessFallback"
            };
        }

        public static SecurityGuardDecision Block(
            string ip,
            BlockedIpState blockedIp,
            string windowKey = null,
            bool isTrustedVsCode = false,
            string securityScope = "",
            string stateBackend = "ProcessFallback")
        {
            return new SecurityGuardDecision
            {
                Ip = ip,
                WindowKey = windowKey ?? ip,
                IsTrustedVsCode = isTrustedVsCode,
                SecurityScope = securityScope ?? "",
                StateBackend = stateBackend ?? "ProcessFallback",
                IsBlocked = true,
                BlockedIp = blockedIp
            };
        }
    }

    public sealed class BlockedIpState
    {
        public string Ip { get; set; }
        public string SecurityScope { get; set; }
        public string StateBackend { get; set; }
        public string Reason { get; set; }
        public string ReasonKey { get; set; }
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

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// 接口引擎通用实时事件协议。接口引擎仍负责授权、业务状态和事务；SignalR
    /// 负责提交后的低延迟事件、公开增量或快照投影，客户端按 Version 检测缺口并回读权威 Snapshot。
    /// </summary>
    public static class ApiEngineRealtimeRuntime
    {
        public const int ProtocolVersion = 2;
        public const string HubPath = "/api-engine-realtime";
        public const string TransportName = "api-engine-realtime";
        public const string ClientEventName = "RealtimeEvent";
        public const string SubscribeMethodName = "SubscribeChannel";
        public const string UnsubscribeMethodName = "UnsubscribeChannel";
        public const string AuthorizeCommandName = "AuthorizeRealtime";
        public const string DataAppendPropertyName = "RealtimeEvent";
        public const int PostCommitBudgetMilliseconds = 1800;
        public const int MaximumDataBytes = 32 * 1024;
        public const int SubscriptionLeaseSeconds = 30;
        public const int SubscriptionRenewAfterMilliseconds = 10 * 1000;
        public const int SubscriptionAuthorizationRateLimitWindowSeconds = 10;
        public const int SubscriptionAuthorizationRateLimitMaximum = 96;

        private static readonly TimeSpan EventDeduplicationTtl = TimeSpan.FromHours(24);
        private static readonly TimeSpan EventClaimTtl = TimeSpan.FromSeconds(15);
        private static readonly TimeSpan LatestEventTtl = TimeSpan.FromHours(2);
        private static readonly Regex TenantPattern = new Regex(
            "^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex ChannelKeyPattern = new Regex(
            "^[a-z][a-z0-9_]{0,63}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex EventIdPattern = new Regex(
            "^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex EventTypePattern = new Regex(
            "^[A-Za-z][A-Za-z0-9._-]{0,63}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);

        public static bool TryNormalizeSubscription(
            ApiEngineRealtimeSubscriptionRequest request,
            out ApiEngineRealtimeSubscriptionRequest normalized,
            out string error)
        {
            normalized = null;
            error = null;
            if (request == null)
            {
                error = "订阅参数不能为空。";
                return false;
            }

            var channelKey = (request.ChannelKey ?? string.Empty).Trim();
            var subjectId = (request.SubjectId ?? string.Empty).Trim();
            if (!ChannelKeyPattern.IsMatch(channelKey))
            {
                error = "ChannelKey 只能使用小写字母、数字和下划线，且必须以字母开头。";
                return false;
            }
            if (!IsSafeSubjectId(subjectId))
            {
                error = "SubjectId 格式无效。";
                return false;
            }

            normalized = new ApiEngineRealtimeSubscriptionRequest
            {
                ChannelKey = channelKey,
                SubjectId = subjectId
            };
            return true;
        }

        /// <summary>
        /// ChannelKey 到授权接口引擎使用不可由客户端覆盖的固定约定：
        /// realtime_{channel_key}_authorize。这样不需要新增数据库字段，也不会接受任意 GatewayKey。
        /// </summary>
        public static string ResolveAuthorizationApiEngineKey(string channelKey)
        {
            var normalized = (channelKey ?? string.Empty).Trim();
            if (!ChannelKeyPattern.IsMatch(normalized))
                throw new ArgumentException("ChannelKey 格式无效。", nameof(channelKey));
            return "realtime_" + normalized + "_authorize";
        }

        /// <summary>
        /// 只读取成功 DosResult 的 DataAppend.RealtimeEvent。业务返回 Data 中的其它字段
        /// 不会进入实时通道；显式 Data 还受 32KB 上限约束。
        /// </summary>
        public static bool TryReadEvent(
            object result,
            string osClient,
            out ApiEngineRealtimeEvent realtimeEvent,
            out string error)
        {
            realtimeEvent = null;
            error = null;
            if (result == null) return false;

            JObject root;
            try
            {
                root = result as JObject ?? JObject.FromObject(result);
            }
            catch
            {
                return false;
            }

            if (!TryReadInt64(root["Code"], out var code) || code != 1) return false;
            var dataAppend = AsObject(root["DataAppend"]);
            if (dataAppend == null) return false;
            var source = AsObject(dataAppend[DataAppendPropertyName]);
            if (source == null) return false;

            var tenant = (osClient ?? string.Empty).Trim();
            var eventId = (source["EventId"]?.ToString() ?? string.Empty).Trim();
            var channelKey = (source["ChannelKey"]?.ToString() ?? string.Empty).Trim();
            var subjectId = (source["SubjectId"]?.ToString() ?? string.Empty).Trim();
            var eventType = (source["EventType"]?.ToString() ?? string.Empty).Trim();
            if (!TenantPattern.IsMatch(tenant))
            {
                error = "RealtimeEvent 的 OsClient 格式无效。";
                return false;
            }
            if (!EventIdPattern.IsMatch(eventId))
            {
                error = "RealtimeEvent.EventId 缺失或格式无效。";
                return false;
            }
            if (!ChannelKeyPattern.IsMatch(channelKey))
            {
                error = "RealtimeEvent.ChannelKey 缺失或格式无效。";
                return false;
            }
            if (!IsSafeSubjectId(subjectId))
            {
                error = "RealtimeEvent.SubjectId 缺失或格式无效。";
                return false;
            }
            if (!EventTypePattern.IsMatch(eventType))
            {
                error = "RealtimeEvent.EventType 缺失或格式无效。";
                return false;
            }
            if (!TryReadInt64(source["Version"], out var version) || version < 0)
            {
                error = "RealtimeEvent.Version 必须是非负整数。";
                return false;
            }

            var data = source["Data"]?.DeepClone();
            if (data != null && data.Type != JTokenType.Null)
            {
                var dataJson = data.ToString(Formatting.None);
                if (Encoding.UTF8.GetByteCount(dataJson) > MaximumDataBytes)
                {
                    error = $"RealtimeEvent.Data 不能超过 {MaximumDataBytes} 字节。";
                    return false;
                }
            }

            realtimeEvent = new ApiEngineRealtimeEvent
            {
                EventId = eventId,
                ChannelKey = channelKey,
                SubjectId = subjectId,
                Version = version,
                EventType = eventType,
                Data = data,
                // 使用事务提交后的宿主时间，拒绝接口参数伪造发生时间。
                OccurredAt = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture)
            };
            return true;
        }

        public static string BuildGroupName(string osClient, string channelKey, string subjectId)
        {
            var tenant = (osClient ?? string.Empty).Trim();
            var channel = (channelKey ?? string.Empty).Trim();
            var subject = (subjectId ?? string.Empty).Trim();
            if (!TenantPattern.IsMatch(tenant))
                throw new ArgumentException("OsClient 格式无效。", nameof(osClient));
            if (!ChannelKeyPattern.IsMatch(channel))
                throw new ArgumentException("ChannelKey 格式无效。", nameof(channelKey));
            if (!IsSafeSubjectId(subject))
                throw new ArgumentException("SubjectId 格式无效。", nameof(subjectId));

            return "Microi:ApiEngineRealtime:v2:"
                   + Base64Url(tenant.ToLowerInvariant()) + ":"
                   + Base64Url(channel) + ":"
                   + Base64Url(subject);
        }

        /// <summary>
        /// SignalR 群组使用短周期租约。订阅端每次重新授权后加入当前和下一时隙，
        /// 发布端只向当前时隙广播；即使 Token 或房间资格在连接期间被撤销，未续租
        /// 的连接也会在最多两个时隙后自然停止收到事件，且不依赖进程内全局定时器。
        /// </summary>
        public static IReadOnlyList<string> BuildSubscriptionLeaseGroups(
            string baseGroupName,
            DateTimeOffset now)
        {
            var currentSlot = GetLeaseSlot(now);
            return new[]
            {
                BuildLeaseGroupName(baseGroupName, currentSlot),
                BuildLeaseGroupName(baseGroupName, currentSlot + 1)
            };
        }

        public static string BuildBroadcastGroupName(string baseGroupName, DateTimeOffset now)
        {
            return BuildLeaseGroupName(baseGroupName, GetLeaseSlot(now));
        }

        public static DateTimeOffset GetSubscriptionLeaseExpiry(DateTimeOffset now)
        {
            var currentSlot = GetLeaseSlot(now);
            return DateTimeOffset.FromUnixTimeSeconds(
                checked((currentSlot + 2) * SubscriptionLeaseSeconds));
        }

        private static long GetLeaseSlot(DateTimeOffset value)
        {
            return value.ToUnixTimeSeconds() / SubscriptionLeaseSeconds;
        }

        private static string BuildLeaseGroupName(string baseGroupName, long leaseSlot)
        {
            if (string.IsNullOrWhiteSpace(baseGroupName))
                throw new ArgumentException("基础实时群组不能为空。", nameof(baseGroupName));
            if (leaseSlot < 0)
                throw new ArgumentOutOfRangeException(nameof(leaseSlot));
            return baseGroupName + ":lease:" + leaseSlot.ToString(CultureInfo.InvariantCulture);
        }

        public static string BuildEventFingerprint(ApiEngineRealtimeEvent realtimeEvent)
        {
            if (realtimeEvent == null) throw new ArgumentNullException(nameof(realtimeEvent));
            var canonical = string.Join("\n", new[]
            {
                realtimeEvent.EventId ?? string.Empty,
                realtimeEvent.ChannelKey ?? string.Empty,
                realtimeEvent.SubjectId ?? string.Empty,
                realtimeEvent.Version.ToString(CultureInfo.InvariantCulture),
                realtimeEvent.EventType ?? string.Empty,
                realtimeEvent.Data?.ToString(Formatting.None) ?? string.Empty
            });
            return Hash(canonical);
        }

        /// <summary>
        /// 在调用授权接口引擎前使用共享 Redis 做租户+用户级限流。限制不放在进程内，
        /// 因而扩容、滚动发布或切换负载均衡节点都不会重置计数；Redis 不可用时由
        /// Hub 失败关闭实时订阅，业务仍可通过原有 HTTP Snapshot 降级读取。
        /// </summary>
        public static async Task<bool> TryAcquireSubscriptionAuthorizationSlotAsync(
            string osClient,
            string userId)
        {
            var tenant = (osClient ?? string.Empty).Trim();
            var user = (userId ?? string.Empty).Trim();
            if (!TenantPattern.IsMatch(tenant))
                throw new ArgumentException("OsClient 格式无效。", nameof(osClient));
            if (!IsSafeSubjectId(user))
                throw new ArgumentException("UserId 格式无效。", nameof(userId));

            const string script =
                "local count = redis.call('INCR', KEYS[1]); " +
                "if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]); end; " +
                "return count;";
            var database = MicroiEngine.CacheTenant.Cache(tenant).Db(tenant);
            var key = $"Microi:{tenant}:ApiEngineRealtime:v{ProtocolVersion}:AuthorizeRate:"
                      + Hash(user);
            var result = await database.ScriptEvaluateAsync(
                    script,
                    new RedisKey[] { key },
                    new RedisValue[] { SubscriptionAuthorizationRateLimitWindowSeconds })
                .ConfigureAwait(false);
            var count = (long)result;
            return count <= SubscriptionAuthorizationRateLimitMaximum;
        }

        /// <summary>
        /// 事务成功提交后调用。Redis 提供跨节点 EventId 去重与 latest 恢复；
        /// SignalR 使用共享 backplane 广播。两者故障都不改变已提交的业务 DosResult。
        /// </summary>
        public static async Task<ApiEngineRealtimePublishResult> PublishAfterCommitAsync(
            string osClient,
            ApiEngineRealtimeEvent realtimeEvent)
        {
            if (realtimeEvent == null) throw new ArgumentNullException(nameof(realtimeEvent));
            var groupName = BuildGroupName(
                osClient,
                realtimeEvent.ChannelKey,
                realtimeEvent.SubjectId);
            var broadcastGroupName = BuildBroadcastGroupName(groupName, DateTimeOffset.UtcNow);
            var fingerprint = BuildEventFingerprint(realtimeEvent);
            var deduplicationAvailable = false;
            var duplicate = false;
            var conflict = false;
            var inProgress = false;
            var stale = false;
            var versionConflict = false;
            string redisError = null;
            IDatabase database = null;
            RedisKey eventKey = default;
            RedisKey claimKey = default;
            RedisValue claimValue = default;
            var claimAcquired = false;

            try
            {
                database = MicroiEngine.CacheTenant.Cache(osClient).Db(osClient);
                eventKey = $"Microi:{osClient}:ApiEngineRealtime:v{ProtocolVersion}:Event:{realtimeEvent.EventId}";
                claimKey = $"Microi:{osClient}:ApiEngineRealtime:v{ProtocolVersion}:Claim:{realtimeEvent.EventId}";
                deduplicationAvailable = true;
                var completedFingerprint = await database.StringGetAsync(eventKey)
                    .ConfigureAwait(false);
                if (!completedFingerprint.IsNullOrEmpty)
                {
                    duplicate = string.Equals(
                        completedFingerprint.ToString(),
                        fingerprint,
                        StringComparison.Ordinal);
                    conflict = !duplicate;
                }

                if (!duplicate && !conflict)
                {
                    claimValue = fingerprint + ":" + Guid.NewGuid().ToString("N");
                    claimAcquired = await database.LockTakeAsync(
                            claimKey,
                            claimValue,
                            EventClaimTtl)
                        .ConfigureAwait(false);
                    if (!claimAcquired)
                    {
                        var activeClaim = await database.StringGetAsync(claimKey)
                            .ConfigureAwait(false);
                        conflict = !activeClaim.IsNullOrEmpty
                                   && !activeClaim.ToString().StartsWith(
                                       fingerprint + ":",
                                       StringComparison.Ordinal);
                        inProgress = !conflict;
                    }
                    else
                    {
                        // 锁等待期间可能已经由其它节点完成；锁内二次确认后才写 latest。
                        completedFingerprint = await database.StringGetAsync(eventKey)
                            .ConfigureAwait(false);
                        if (!completedFingerprint.IsNullOrEmpty)
                        {
                            duplicate = string.Equals(
                                completedFingerprint.ToString(),
                                fingerprint,
                                StringComparison.Ordinal);
                            conflict = !duplicate;
                        }
                        else
                        {
                            var latestOutcome = await StoreLatestAsync(
                                    database,
                                    osClient,
                                    groupName,
                                    realtimeEvent,
                                    fingerprint)
                                .ConfigureAwait(false);
                            stale = latestOutcome == LatestWriteOutcome.Stale;
                            versionConflict = latestOutcome == LatestWriteOutcome.Conflict;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                // Redis 故障时仍尝试 best-effort 广播；客户端按 EventId/Version 去重并回读。
                redisError = AppendError(redisError, ex.Message);
            }

            if (duplicate || conflict || inProgress || stale || versionConflict)
            {
                if (claimAcquired && database != null)
                {
                    try
                    {
                        await database.LockReleaseAsync(claimKey, claimValue).ConfigureAwait(false);
                    }
                    catch (Exception ex)
                    {
                        redisError = AppendError(redisError, ex.Message);
                    }
                }
                return new ApiEngineRealtimePublishResult
                {
                    EventId = realtimeEvent.EventId,
                    GroupName = groupName,
                    BroadcastGroupName = broadcastGroupName,
                    Duplicate = duplicate,
                    Conflict = conflict,
                    InProgress = inProgress,
                    Stale = stale,
                    VersionConflict = versionConflict,
                    DeduplicationAvailable = deduplicationAvailable,
                    RedisError = redisError
                };
            }

            string broadcastError = null;
            var broadcastAttempted = RealtimePushRuntime.IsGroupConfiguredFor(TransportName);
            try
            {
                await RealtimePushRuntime.SendGroupAsync(
                        TransportName,
                        broadcastGroupName,
                        ClientEventName,
                        realtimeEvent)
                    .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                broadcastError = ex.Message;
            }

            var broadcastSucceeded = broadcastAttempted
                                     && string.IsNullOrWhiteSpace(broadcastError);
            if (claimAcquired && database != null)
            {
                try
                {
                    // 只有真实广播成功后才写 24 小时完成标记。若节点在 NX/广播之间
                    // 崩溃，短租约 Claim 会自动过期，后续重试可再次发送；最多产生客户端
                    // 可按 EventId 去重的重复通知，不会留下永久“已去重但未广播”窗口。
                    if (broadcastSucceeded)
                    {
                        await database.StringSetAsync(
                                eventKey,
                                fingerprint,
                                EventDeduplicationTtl,
                                When.Always)
                            .ConfigureAwait(false);
                    }
                }
                catch (Exception ex)
                {
                    redisError = AppendError(redisError, ex.Message);
                }
                finally
                {
                    try
                    {
                        await database.LockReleaseAsync(claimKey, claimValue)
                            .ConfigureAwait(false);
                    }
                    catch (Exception ex)
                    {
                        redisError = AppendError(redisError, ex.Message);
                    }
                }
            }

            return new ApiEngineRealtimePublishResult
            {
                EventId = realtimeEvent.EventId,
                GroupName = groupName,
                BroadcastGroupName = broadcastGroupName,
                DeduplicationAvailable = deduplicationAvailable,
                BroadcastAttempted = broadcastAttempted,
                BroadcastSucceeded = broadcastSucceeded,
                RedisError = redisError,
                BroadcastError = broadcastError
            };
        }

        public static Task<ApiEngineRealtimePublishResult> PublishAfterCommitWithinBudgetAsync(
            string osClient,
            ApiEngineRealtimeEvent realtimeEvent)
        {
            if (realtimeEvent == null) throw new ArgumentNullException(nameof(realtimeEvent));
            var groupName = BuildGroupName(
                osClient,
                realtimeEvent.ChannelKey,
                realtimeEvent.SubjectId);
            return ExecuteWithinBudgetAsync(
                () => PublishAfterCommitAsync(osClient, realtimeEvent),
                TimeSpan.FromMilliseconds(PostCommitBudgetMilliseconds),
                realtimeEvent.EventId,
                groupName);
        }

        public static async Task<ApiEngineRealtimePublishResult> ExecuteWithinBudgetAsync(
            Func<Task<ApiEngineRealtimePublishResult>> publisher,
            TimeSpan budget,
            string eventId,
            string groupName)
        {
            if (publisher == null) throw new ArgumentNullException(nameof(publisher));
            if (budget <= TimeSpan.Zero || budget > TimeSpan.FromSeconds(5))
                throw new ArgumentOutOfRangeException(nameof(budget));

            Task<ApiEngineRealtimePublishResult> publishTask;
            try
            {
                publishTask = publisher();
            }
            catch (Exception ex)
            {
                return Failed(eventId, groupName, ex.Message);
            }
            if (publishTask == null)
            {
                return Failed(eventId, groupName, "POST_COMMIT_PUBLISHER_RETURNED_NULL");
            }

            var completed = await Task.WhenAny(publishTask, Task.Delay(budget)).ConfigureAwait(false);
            if (ReferenceEquals(completed, publishTask))
            {
                try
                {
                    return await publishTask.ConfigureAwait(false);
                }
                catch (Exception ex)
                {
                    return Failed(eventId, groupName, ex.Message);
                }
            }

            _ = publishTask.ContinueWith(
                task =>
                {
                    var ignored = task.Exception;
                },
                System.Threading.CancellationToken.None,
                TaskContinuationOptions.OnlyOnFaulted | TaskContinuationOptions.ExecuteSynchronously,
                TaskScheduler.Default);
            return new ApiEngineRealtimePublishResult
            {
                EventId = eventId,
                GroupName = groupName,
                TimedOut = true,
                BroadcastError = $"POST_COMMIT_TIMEOUT_{Convert.ToInt32(budget.TotalMilliseconds)}MS"
            };
        }

        public static async Task<ApiEngineRealtimeEvent> GetLatestAsync(
            string osClient,
            string channelKey,
            string subjectId)
        {
            try
            {
                var groupName = BuildGroupName(osClient, channelKey, subjectId);
                var database = MicroiEngine.CacheTenant.Cache(osClient).Db(osClient);
                var payload = await database.StringGetAsync(LatestPayloadKey(osClient, groupName))
                    .ConfigureAwait(false);
                return payload.IsNullOrEmpty
                    ? null
                    : JsonConvert.DeserializeObject<ApiEngineRealtimeEvent>(payload.ToString());
            }
            catch
            {
                return null;
            }
        }

        public static bool TryValidateAuthorizationResponse(
            object result,
            ApiEngineRealtimeSubscriptionRequest request,
            out long version)
        {
            version = 0;
            if (result == null || request == null) return false;
            try
            {
                var root = result as JObject ?? JObject.FromObject(result);
                if (!TryReadInt64(root["Code"], out var code) || code != 1) return false;
                var data = AsObject(root["Data"]);
                if (data == null || data["Authorized"]?.Value<bool>() != true) return false;
                if (!string.Equals(
                        data["ChannelKey"]?.ToString(),
                        request.ChannelKey,
                        StringComparison.Ordinal)) return false;
                if (!string.Equals(
                        data["SubjectId"]?.ToString(),
                        request.SubjectId,
                        StringComparison.Ordinal)) return false;
                if (!TryReadInt64(data["Version"], out version) || version < 0) return false;
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static ApiEngineRealtimePublishResult Failed(
            string eventId,
            string groupName,
            string error)
        {
            return new ApiEngineRealtimePublishResult
            {
                EventId = eventId,
                GroupName = groupName,
                BroadcastError = error
            };
        }

        private static string AppendError(string current, string next)
        {
            if (string.IsNullOrWhiteSpace(next)) return current;
            return string.IsNullOrWhiteSpace(current) ? next : current + " | " + next;
        }

        private static async Task<LatestWriteOutcome> StoreLatestAsync(
            IDatabase database,
            string osClient,
            string groupName,
            ApiEngineRealtimeEvent realtimeEvent,
            string fingerprint)
        {
            const string script =
                "local current = redis.call('GET', KEYS[1]); " +
                "if not current then " +
                "redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[4]); " +
                "redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[4]); " +
                "redis.call('SET', KEYS[3], ARGV[3], 'EX', ARGV[4]); return 1; end; " +
                "local incoming = tonumber(ARGV[1]); local existing = tonumber(current); " +
                "if incoming < existing then return -1; end; " +
                "if incoming == existing then " +
                "local currentFingerprint = redis.call('GET', KEYS[3]); " +
                "if currentFingerprint == ARGV[3] then " +
                "redis.call('EXPIRE', KEYS[1], ARGV[4]); redis.call('EXPIRE', KEYS[2], ARGV[4]); " +
                "redis.call('EXPIRE', KEYS[3], ARGV[4]); return 0; end; return -2; end; " +
                "redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[4]); " +
                "redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[4]); " +
                "redis.call('SET', KEYS[3], ARGV[3], 'EX', ARGV[4]); return 1;";
            var ttlSeconds = Convert.ToInt64(LatestEventTtl.TotalSeconds);
            var result = await database.ScriptEvaluateAsync(
                    script,
                    new RedisKey[]
                    {
                        LatestVersionKey(osClient, groupName),
                        LatestPayloadKey(osClient, groupName),
                        LatestFingerprintKey(osClient, groupName)
                    },
                    new RedisValue[]
                    {
                        realtimeEvent.Version,
                        JsonConvert.SerializeObject(realtimeEvent),
                        fingerprint,
                        ttlSeconds
                    })
                .ConfigureAwait(false);
            var value = (long)result;
            if (value == -2) return LatestWriteOutcome.Conflict;
            if (value == -1) return LatestWriteOutcome.Stale;
            return value == 0 ? LatestWriteOutcome.Replay : LatestWriteOutcome.Advanced;
        }

        private static string LatestVersionKey(string osClient, string groupName)
        {
            return $"Microi:{osClient}:ApiEngineRealtime:LatestVersion:" + Hash(groupName);
        }

        private static string LatestPayloadKey(string osClient, string groupName)
        {
            return $"Microi:{osClient}:ApiEngineRealtime:LatestPayload:" + Hash(groupName);
        }

        private static string LatestFingerprintKey(string osClient, string groupName)
        {
            return $"Microi:{osClient}:ApiEngineRealtime:LatestFingerprint:" + Hash(groupName);
        }

        private enum LatestWriteOutcome
        {
            Advanced,
            Replay,
            Stale,
            Conflict
        }

        private static bool IsSafeSubjectId(string value)
        {
            if (string.IsNullOrWhiteSpace(value) || value.Length > 128) return false;
            foreach (var character in value)
            {
                if (char.IsControl(character)) return false;
            }
            return true;
        }

        private static JObject AsObject(JToken token)
        {
            if (token is JObject obj) return obj;
            if (token?.Type != JTokenType.String) return null;
            try { return JObject.Parse(token.ToString()); }
            catch { return null; }
        }

        private static bool TryReadInt64(JToken token, out long value)
        {
            value = 0;
            if (token == null) return false;
            return long.TryParse(
                token.ToString(),
                NumberStyles.Integer,
                CultureInfo.InvariantCulture,
                out value);
        }

        private static string Base64Url(string value)
        {
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(value))
                .TrimEnd('=')
                .Replace('+', '-')
                .Replace('/', '_');
        }

        private static string Hash(string value)
        {
            using var sha = SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(value ?? string.Empty));
            var builder = new StringBuilder(bytes.Length * 2);
            foreach (var item in bytes)
            {
                builder.Append(item.ToString("x2", CultureInfo.InvariantCulture));
            }
            return builder.ToString();
        }
    }

    public sealed class ApiEngineRealtimeEvent
    {
        public string EventId { get; set; }
        public string ChannelKey { get; set; }
        public string SubjectId { get; set; }
        public long Version { get; set; }
        public string EventType { get; set; }
        public JToken Data { get; set; }
        public string OccurredAt { get; set; }
    }

    public sealed class ApiEngineRealtimeSubscriptionRequest
    {
        public string ChannelKey { get; set; }
        public string SubjectId { get; set; }
    }

    public sealed class ApiEngineRealtimeSubscriptionResult
    {
        public int ProtocolVersion { get; set; } = ApiEngineRealtimeRuntime.ProtocolVersion;
        public string ChannelKey { get; set; }
        public string SubjectId { get; set; }
        public long Version { get; set; }
        public ApiEngineRealtimeEvent Latest { get; set; }
        public int RenewAfterMilliseconds { get; set; } =
            ApiEngineRealtimeRuntime.SubscriptionRenewAfterMilliseconds;
        public string LeaseExpiresAt { get; set; }
    }

    public sealed class ApiEngineRealtimePublishResult
    {
        public string EventId { get; set; }
        public string GroupName { get; set; }
        public string BroadcastGroupName { get; set; }
        public bool DeduplicationAvailable { get; set; }
        public bool Duplicate { get; set; }
        public bool Conflict { get; set; }
        public bool InProgress { get; set; }
        public bool Stale { get; set; }
        public bool VersionConflict { get; set; }
        public bool TimedOut { get; set; }
        public bool BroadcastAttempted { get; set; }
        public bool BroadcastSucceeded { get; set; }
        public string RedisError { get; set; }
        public string BroadcastError { get; set; }
    }
}

using System;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Dos.Common;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.net
{
    /// <summary>
    /// 游戏房间实时协议。业务状态仍以接口引擎 Snapshot 为唯一事实源；该协议只发送
    /// 不含私密牌面的版本失效通知，允许 SignalR 消息丢失、重复或乱序。
    /// </summary>
    public static class GameRealtimeRuntime
    {
        public const int ProtocolVersion = 1;
        public const string HubPath = "/game-realtime";
        public const string ClientEventName = "GameRoomChanged";
        public const string SubscribeMethodName = "SubscribeGameRoom";
        public const string UnsubscribeMethodName = "UnsubscribeGameRoom";
        public const string AuthorizeCommandName = "AuthorizeRealtime";
        public const string DataAppendPropertyName = "RealtimeInvalidation";
        public const int PostCommitBudgetMilliseconds = 1800;

        private static readonly TimeSpan EventDeduplicationTtl = TimeSpan.FromHours(24);
        private static readonly TimeSpan LatestEventTtl = TimeSpan.FromHours(2);
        private static readonly Regex TenantPattern = new Regex(
            "^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex AppKeyPattern = new Regex(
            "^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex GatewayKeyPattern = new Regex(
            "^app_[A-Za-z0-9_]{1,64}_gateway$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);
        private static readonly Regex EventIdPattern = new Regex(
            "^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);
        private static readonly Regex CommandPattern = new Regex(
            "^[A-Za-z][A-Za-z0-9._-]{0,63}$",
            RegexOptions.Compiled | RegexOptions.CultureInvariant);

        public static bool TryNormalizeSubscription(
            GameRealtimeSubscriptionRequest request,
            out GameRealtimeSubscriptionRequest normalized,
            out string error)
        {
            normalized = null;
            error = null;
            if (request == null)
            {
                error = "订阅参数不能为空。";
                return false;
            }

            var appKey = (request.AppKey ?? string.Empty).Trim();
            var gatewayKey = (request.GatewayKey ?? string.Empty).Trim();
            var roomId = (request.RoomId ?? string.Empty).Trim();
            if (!AppKeyPattern.IsMatch(appKey))
            {
                error = "AppKey 格式无效。";
                return false;
            }
            if (!GatewayKeyPattern.IsMatch(gatewayKey))
            {
                error = "GatewayKey 必须是 app_*_gateway。";
                return false;
            }
            if (!IsSafeRoomId(roomId))
            {
                error = "RoomId 格式无效。";
                return false;
            }

            normalized = new GameRealtimeSubscriptionRequest
            {
                AppKey = appKey,
                GatewayKey = gatewayKey,
                RoomId = roomId
            };
            return true;
        }

        /// <summary>
        /// 只读取成功 DosResult 的 DataAppend.RealtimeInvalidation，并复制六个允许字段。
        /// 其它字段（包括手牌、座位私有状态）即使被接口引擎误放入对象也不会广播。
        /// </summary>
        public static bool TryReadInvalidation(
            object result,
            string osClient,
            out GameRealtimeInvalidation invalidation,
            out string error)
        {
            invalidation = null;
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
            var appKey = (source["AppKey"]?.ToString() ?? string.Empty).Trim();
            var roomId = (source["RoomId"]?.ToString() ?? string.Empty).Trim();
            var command = (source["Command"]?.ToString() ?? string.Empty).Trim();
            if (!TenantPattern.IsMatch(tenant))
            {
                error = "RealtimeInvalidation 的 OsClient 格式无效。";
                return false;
            }
            if (!EventIdPattern.IsMatch(eventId))
            {
                error = "RealtimeInvalidation.EventId 缺失或格式无效。";
                return false;
            }
            if (!AppKeyPattern.IsMatch(appKey))
            {
                error = "RealtimeInvalidation.AppKey 缺失或格式无效。";
                return false;
            }
            if (!IsSafeRoomId(roomId))
            {
                error = "RealtimeInvalidation.RoomId 缺失或格式无效。";
                return false;
            }
            if (!CommandPattern.IsMatch(command))
            {
                error = "RealtimeInvalidation.Command 缺失或格式无效。";
                return false;
            }
            if (!TryReadInt64(source["Version"], out var version) || version < 0)
            {
                error = "RealtimeInvalidation.Version 必须是非负整数。";
                return false;
            }

            invalidation = new GameRealtimeInvalidation
            {
                EventId = eventId,
                AppKey = appKey,
                RoomId = roomId,
                Version = version,
                Command = command,
                // 发生时间由提交完成后的宿主生成，避免客户端或 V8 伪造时间。
                OccurredAt = DateTime.UtcNow.ToString("O", CultureInfo.InvariantCulture)
            };
            return true;
        }

        public static string BuildGroupName(string osClient, string appKey, string roomId)
        {
            if (!TenantPattern.IsMatch((osClient ?? string.Empty).Trim()))
                throw new ArgumentException("OsClient 格式无效。", nameof(osClient));
            if (!AppKeyPattern.IsMatch((appKey ?? string.Empty).Trim()))
                throw new ArgumentException("AppKey 格式无效。", nameof(appKey));
            if (!IsSafeRoomId((roomId ?? string.Empty).Trim()))
                throw new ArgumentException("RoomId 格式无效。", nameof(roomId));

            return "Microi:GameRoom:v1:"
                   + Base64Url(osClient.Trim().ToLowerInvariant()) + ":"
                   + Base64Url(appKey.Trim().ToLowerInvariant()) + ":"
                   + Base64Url(roomId.Trim());
        }

        public static string BuildEventFingerprint(GameRealtimeInvalidation invalidation)
        {
            if (invalidation == null) throw new ArgumentNullException(nameof(invalidation));
            var canonical = string.Join("\n", new[]
            {
                invalidation.EventId ?? string.Empty,
                invalidation.AppKey ?? string.Empty,
                invalidation.RoomId ?? string.Empty,
                invalidation.Version.ToString(CultureInfo.InvariantCulture),
                invalidation.Command ?? string.Empty
            });
            using var sha = SHA256.Create();
            return ToHex(sha.ComputeHash(Encoding.UTF8.GetBytes(canonical)));
        }

        /// <summary>
        /// 接口引擎事务已提交后调用。Redis 提供跨节点 EventId 去重和 latest 恢复；
        /// SignalR 仍是 best-effort，客户端必须在收到通知后重新请求 Snapshot，并保留轮询兜底。
        /// </summary>
        public static async Task<GameRealtimePublishResult> PublishAfterCommitAsync(
            string osClient,
            GameRealtimeInvalidation invalidation)
        {
            if (invalidation == null) throw new ArgumentNullException(nameof(invalidation));
            var groupName = BuildGroupName(osClient, invalidation.AppKey, invalidation.RoomId);
            var fingerprint = BuildEventFingerprint(invalidation);
            var deduplicationAvailable = false;
            var duplicate = false;
            var conflict = false;
            string redisError = null;

            try
            {
                var database = MicroiEngine.CacheTenant.Cache(osClient).Db(osClient);
                var eventKey = $"Microi:{osClient}:GameRealtime:Event:{invalidation.EventId}";
                var first = await database.StringSetAsync(
                        eventKey,
                        fingerprint,
                        EventDeduplicationTtl,
                        When.NotExists)
                    .ConfigureAwait(false);
                deduplicationAvailable = true;
                if (!first)
                {
                    var previous = await database.StringGetAsync(eventKey).ConfigureAwait(false);
                    duplicate = string.Equals(previous.ToString(), fingerprint, StringComparison.Ordinal);
                    conflict = !duplicate;
                }

                if (!duplicate && !conflict)
                {
                    await StoreLatestAsync(database, groupName, invalidation).ConfigureAwait(false);
                }
            }
            catch (Exception ex)
            {
                // Redis 故障时仍尝试广播。客户端按 EventId/Version 去重并轮询 Snapshot，
                // 所以重复通知不会改变权威业务状态。
                redisError = ex.Message;
            }

            if (duplicate || conflict)
            {
                return new GameRealtimePublishResult
                {
                    EventId = invalidation.EventId,
                    GroupName = groupName,
                    Duplicate = duplicate,
                    Conflict = conflict,
                    DeduplicationAvailable = deduplicationAvailable,
                    BroadcastAttempted = false,
                    RedisError = redisError
                };
            }

            string broadcastError = null;
            var broadcastAttempted = RealtimePushRuntime.IsGroupConfigured;
            try
            {
                await RealtimePushRuntime.SendGroupAsync(
                        groupName,
                        ClientEventName,
                        invalidation)
                    .ConfigureAwait(false);
            }
            catch (Exception ex)
            {
                broadcastError = ex.Message;
            }

            return new GameRealtimePublishResult
            {
                EventId = invalidation.EventId,
                GroupName = groupName,
                DeduplicationAvailable = deduplicationAvailable,
                BroadcastAttempted = broadcastAttempted,
                BroadcastSucceeded = broadcastAttempted && string.IsNullOrWhiteSpace(broadcastError),
                RedisError = redisError,
                BroadcastError = broadcastError
            };
        }

        /// <summary>
        /// 为提交后 Redis + SignalR 旁路设置总等待预算。超时只返回降级状态；
        /// 已提交的接口引擎 DosResult 不会被替换，底层旁路任务也会被观察以避免未观察异常。
        /// </summary>
        public static Task<GameRealtimePublishResult> PublishAfterCommitWithinBudgetAsync(
            string osClient,
            GameRealtimeInvalidation invalidation)
        {
            if (invalidation == null) throw new ArgumentNullException(nameof(invalidation));
            var groupName = BuildGroupName(osClient, invalidation.AppKey, invalidation.RoomId);
            return ExecuteWithinBudgetAsync(
                () => PublishAfterCommitAsync(osClient, invalidation),
                TimeSpan.FromMilliseconds(PostCommitBudgetMilliseconds),
                invalidation.EventId,
                groupName);
        }

        /// <summary>
        /// 可测试的预算执行原语。业务调用应使用 PublishAfterCommitWithinBudgetAsync。
        /// </summary>
        public static async Task<GameRealtimePublishResult> ExecuteWithinBudgetAsync(
            Func<Task<GameRealtimePublishResult>> publisher,
            TimeSpan budget,
            string eventId,
            string groupName)
        {
            if (publisher == null) throw new ArgumentNullException(nameof(publisher));
            if (budget <= TimeSpan.Zero || budget > TimeSpan.FromSeconds(5))
                throw new ArgumentOutOfRangeException(nameof(budget));

            Task<GameRealtimePublishResult> publishTask;
            try
            {
                publishTask = publisher();
            }
            catch (Exception ex)
            {
                return new GameRealtimePublishResult
                {
                    EventId = eventId,
                    GroupName = groupName,
                    BroadcastError = ex.Message
                };
            }
            if (publishTask == null)
            {
                return new GameRealtimePublishResult
                {
                    EventId = eventId,
                    GroupName = groupName,
                    BroadcastError = "POST_COMMIT_PUBLISHER_RETURNED_NULL"
                };
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
                    return new GameRealtimePublishResult
                    {
                        EventId = eventId,
                        GroupName = groupName,
                        BroadcastError = ex.Message
                    };
                }
            }

            _ = publishTask.ContinueWith(
                task =>
                {
                    // 读取 Exception 即视为已观察；提交后旁路失败不得影响业务响应。
                    var ignored = task.Exception;
                },
                System.Threading.CancellationToken.None,
                TaskContinuationOptions.OnlyOnFaulted | TaskContinuationOptions.ExecuteSynchronously,
                TaskScheduler.Default);
            return new GameRealtimePublishResult
            {
                EventId = eventId,
                GroupName = groupName,
                TimedOut = true,
                BroadcastError = $"POST_COMMIT_TIMEOUT_{Convert.ToInt32(budget.TotalMilliseconds)}MS"
            };
        }

        public static async Task<GameRealtimeInvalidation> GetLatestAsync(
            string osClient,
            string appKey,
            string roomId)
        {
            try
            {
                var groupName = BuildGroupName(osClient, appKey, roomId);
                var database = MicroiEngine.CacheTenant.Cache(osClient).Db(osClient);
                var payload = await database.StringGetAsync(LatestPayloadKey(groupName)).ConfigureAwait(false);
                return payload.IsNullOrEmpty
                    ? null
                    : JsonConvert.DeserializeObject<GameRealtimeInvalidation>(payload.ToString());
            }
            catch
            {
                return null;
            }
        }

        public static bool TryValidateAuthorizationResponse(
            object result,
            GameRealtimeSubscriptionRequest request,
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
                if (!string.Equals(data["AppKey"]?.ToString(), request.AppKey, StringComparison.Ordinal)) return false;
                if (!string.Equals(data["RoomId"]?.ToString(), request.RoomId, StringComparison.Ordinal)) return false;
                if (!TryReadInt64(data["Version"], out version) || version < 0) return false;
                return true;
            }
            catch
            {
                return false;
            }
        }

        private static async Task StoreLatestAsync(
            IDatabase database,
            string groupName,
            GameRealtimeInvalidation invalidation)
        {
            const string script =
                "local current = redis.call('GET', KEYS[1]); " +
                "if (not current) or (tonumber(ARGV[1]) >= tonumber(current)) then " +
                "redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[3]); " +
                "redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3]); return 1; end; return 0;";
            var ttlSeconds = Convert.ToInt64(LatestEventTtl.TotalSeconds);
            await database.ScriptEvaluateAsync(
                    script,
                    new RedisKey[] { LatestVersionKey(groupName), LatestPayloadKey(groupName) },
                    new RedisValue[]
                    {
                        invalidation.Version,
                        JsonConvert.SerializeObject(invalidation),
                        ttlSeconds
                    })
                .ConfigureAwait(false);
        }

        private static string LatestVersionKey(string groupName)
        {
            return "Microi:GameRealtime:LatestVersion:" + Hash(groupName);
        }

        private static string LatestPayloadKey(string groupName)
        {
            return "Microi:GameRealtime:LatestPayload:" + Hash(groupName);
        }

        private static bool IsSafeRoomId(string value)
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
            return ToHex(sha.ComputeHash(Encoding.UTF8.GetBytes(value ?? string.Empty)));
        }

        private static string ToHex(byte[] bytes)
        {
            var builder = new StringBuilder(bytes.Length * 2);
            foreach (var value in bytes) builder.Append(value.ToString("x2", CultureInfo.InvariantCulture));
            return builder.ToString();
        }
    }

    public sealed class GameRealtimeInvalidation
    {
        public string EventId { get; set; }
        public string AppKey { get; set; }
        public string RoomId { get; set; }
        public long Version { get; set; }
        public string Command { get; set; }
        public string OccurredAt { get; set; }
    }

    public sealed class GameRealtimeSubscriptionRequest
    {
        public string AppKey { get; set; }
        public string GatewayKey { get; set; }
        public string RoomId { get; set; }
    }

    public sealed class GameRealtimeSubscriptionResult
    {
        public int ProtocolVersion { get; set; } = GameRealtimeRuntime.ProtocolVersion;
        public string AppKey { get; set; }
        public string RoomId { get; set; }
        public long Version { get; set; }
        public GameRealtimeInvalidation Latest { get; set; }
    }

    public sealed class GameRealtimePublishResult
    {
        public string EventId { get; set; }
        public string GroupName { get; set; }
        public bool DeduplicationAvailable { get; set; }
        public bool Duplicate { get; set; }
        public bool Conflict { get; set; }
        public bool TimedOut { get; set; }
        public bool BroadcastAttempted { get; set; }
        public bool BroadcastSucceeded { get; set; }
        public string RedisError { get; set; }
        public string BroadcastError { get; set; }
    }
}

using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using System.Threading.Tasks;
using Dos.Common;
using Microi.net;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using StackExchange.Redis;

namespace Microi.Cache
{
    public interface IMicroiRedisManager
    {
        Task<List<RedisManagerConnectionSummary>> GetConnectionsAsync(string tenantOsClient);
        Task<RedisManagerConnectionSummary> SaveConnectionAsync(string tenantOsClient, RedisManagerSavedConnectionInput input);
        Task DeleteConnectionAsync(string tenantOsClient, string id);
        Task<object> TestConnectionAsync(string tenantOsClient, RedisManagerContextRequest request);
        Task<RedisManagerStatistics> GetStatisticsAsync(string tenantOsClient, RedisManagerContextRequest request);
        Task<RedisManagerKeyPage> GetKeysAsync(string tenantOsClient, RedisManagerKeyListRequest request);
        Task<RedisManagerKeyDetail> GetKeyAsync(string tenantOsClient, RedisManagerKeyRequest request);
        Task<long> DeleteKeysAsync(string tenantOsClient, RedisManagerDeleteRequest request);
        Task ReplaceValueAsync(string tenantOsClient, RedisManagerReplaceRequest request);
        Task RenameKeyAsync(string tenantOsClient, RedisManagerRenameRequest request);
        Task SetTtlAsync(string tenantOsClient, RedisManagerTtlRequest request);
    }

    /// <summary>
    /// Redis 管理器核心实现。这里只开放明确的 Redis 白名单操作，不接受任意命令字符串。
    /// </summary>
    public class MicroiRedisManager : IMicroiRedisManager
    {
        private const string ConnectionTable = "mci_redis_connection";
        private const int MaxCachedConnections = 64;
        private static readonly TimeSpan CachedConnectionIdleTime = TimeSpan.FromMinutes(15);
        private static readonly ConcurrentDictionary<string, CachedConnection> CachedConnections =
            new ConcurrentDictionary<string, CachedConnection>(StringComparer.Ordinal);

        private sealed class CachedConnection
        {
            public Lazy<Task<ConnectionMultiplexer>> Multiplexer { get; set; }
            public DateTime LastUsedUtc { get; set; }
        }

        private sealed class ResolvedConnection
        {
            public ConnectionMultiplexer Multiplexer { get; set; }
            public int Database { get; set; }
            public string Name { get; set; }
            public string Mode { get; set; }
        }

        private sealed class ScanCursorState
        {
            public Dictionary<string, string> Cursors { get; set; } = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            public HashSet<string> Completed { get; set; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }

        public async Task<List<RedisManagerConnectionSummary>> GetConnectionsAsync(string tenantOsClient)
        {
            EnsureTenant(tenantOsClient);
            var result = new List<RedisManagerConnectionSummary>();
            var tenantClient = OsClient.GetClient(tenantOsClient);
            var model = tenantClient?.OsClientModel;
            if (model != null)
            {
                result.Add(new RedisManagerConnectionSummary
                {
                    Id = "tenant-default",
                    Name = "当前租户 Redis",
                    Mode = "tenant",
                    Host = TokenString(model["RedisHost"]),
                    Port = SafeInt(model["RedisPort"], 6379),
                    Database = SafeInt(model["RedisDataBase"], 0),
                    Ssl = SafeBool(model["RedisSsl"]),
                    ConnectTimeout = 5000,
                    KeySeparator = ":",
                    Status = 1,
                    Sort = 0,
                    HasPassword = !string.IsNullOrEmpty(TokenString(model["RedisPwd"])),
                    IsDefault = true
                });
            }

            try
            {
                var rows = await GetSavedRowsAsync(tenantOsClient, null).ConfigureAwait(false);
                foreach (var row in rows)
                {
                    result.Add(ToSummary(row));
                }
            }
            catch (Exception ex)
            {
                // 兼容尚未通过 MCP 安装 mci_redis_connection 表的旧租户环境：默认连接仍然可用。
                result.Add(new RedisManagerConnectionSummary
                {
                    Id = "storage-warning",
                    Name = "保存连接表尚未安装",
                    Mode = "notice",
                    Host = "",
                    Port = 0,
                    Database = 0,
                    Status = 0,
                    Sort = int.MaxValue,
                    Remark = SanitizeExceptionMessage(ex.Message)
                });
            }

            return result.OrderBy(item => item.Sort).ThenBy(item => item.Name).ToList();
        }

        public async Task<RedisManagerConnectionSummary> SaveConnectionAsync(string tenantOsClient, RedisManagerSavedConnectionInput input)
        {
            EnsureTenant(tenantOsClient);
            if (input == null) throw new ArgumentException("连接参数不能为空。");
            ValidateConnection(new RedisManagerConnectionInput
            {
                Name = input.Name,
                Host = input.Host,
                Port = input.Port,
                Username = input.Username,
                Password = input.Password,
                Database = input.Database,
                Ssl = input.Ssl,
                ConnectTimeout = input.ConnectTimeout,
                KeySeparator = input.KeySeparator
            }, allowEmptyPassword: true);
            if (string.IsNullOrWhiteSpace(input.Name)) throw new ArgumentException("连接名称不能为空。");

            var configOsClient = GetStorageOsClient();
            JObject existing = null;
            if (!string.IsNullOrWhiteSpace(input.Id))
            {
                existing = (await GetSavedRowsAsync(tenantOsClient, input.Id).ConfigureAwait(false)).FirstOrDefault();
                if (existing == null) throw new InvalidOperationException("未找到要修改的 Redis 连接，或该连接不属于当前租户。");
            }

            var passwordCipher = TokenString(existing?["Password"]);
            if (!string.IsNullOrEmpty(input.Password))
            {
                passwordCipher = EncryptPassword(input.Password, tenantOsClient);
            }

            var id = TokenString(existing?["Id"]);
            if (string.IsNullOrEmpty(id)) id = Ulid.NewUlid().ToString();
            var form = new JObject
            {
                ["Id"] = id,
                ["OsClient"] = configOsClient,
                ["TenantOsClient"] = tenantOsClient,
                ["Name"] = input.Name.Trim(),
                ["Host"] = input.Host.Trim(),
                ["Port"] = input.Port,
                ["Username"] = (input.Username ?? "").Trim(),
                ["Password"] = passwordCipher ?? "",
                ["Database"] = input.Database,
                ["Ssl"] = input.Ssl ? 1 : 0,
                ["ConnectTimeout"] = Clamp(input.ConnectTimeout, 1000, 15000),
                ["KeySeparator"] = string.IsNullOrEmpty(input.KeySeparator) ? ":" : input.KeySeparator,
                ["Status"] = input.Status == 0 ? 0 : 1,
                ["Sort"] = input.Sort,
                ["Remark"] = input.Remark ?? ""
            };

            DosResult saveResult;
            if (existing == null)
            {
                saveResult = await MicroiEngine.FormEngine.AddFormDataAsync(ConnectionTable, form).ConfigureAwait(false);
            }
            else
            {
                saveResult = await MicroiEngine.FormEngine.UptFormDataAsync(ConnectionTable, form).ConfigureAwait(false);
            }
            if (saveResult.Code != 1)
            {
                throw new InvalidOperationException(saveResult.Msg ?? "保存 Redis 连接失败。");
            }

            var row = (await GetSavedRowsAsync(tenantOsClient, id).ConfigureAwait(false)).FirstOrDefault();
            return row == null ? ToSummary(form) : ToSummary(row);
        }

        public async Task DeleteConnectionAsync(string tenantOsClient, string id)
        {
            EnsureTenant(tenantOsClient);
            if (string.IsNullOrWhiteSpace(id)) throw new ArgumentException("连接 Id 不能为空。");
            var row = (await GetSavedRowsAsync(tenantOsClient, id).ConfigureAwait(false)).FirstOrDefault();
            if (row == null) throw new InvalidOperationException("未找到要删除的 Redis 连接，或该连接不属于当前租户。");
            var result = await MicroiEngine.FormEngine.DelFormDataAsync(ConnectionTable, new JObject
            {
                ["Id"] = id,
                ["OsClient"] = GetStorageOsClient()
            }).ConfigureAwait(false);
            if (result.Code != 1) throw new InvalidOperationException(result.Msg ?? "删除 Redis 连接失败。");
        }

        public async Task<object> TestConnectionAsync(string tenantOsClient, RedisManagerContextRequest request)
        {
            var resolved = await ResolveConnectionAsync(tenantOsClient, request).ConfigureAwait(false);
            var database = resolved.Multiplexer.GetDatabase(resolved.Database);
            var timer = Stopwatch.StartNew();
            var ping = await database.PingAsync().ConfigureAwait(false);
            timer.Stop();
            var endpoints = GetPrimaryServers(resolved.Multiplexer).Select(item => item.EndPoint.ToString()).ToList();
            return new
            {
                resolved.Name,
                resolved.Mode,
                resolved.Database,
                PingMilliseconds = Math.Round(ping.TotalMilliseconds, 2),
                RoundTripMilliseconds = timer.Elapsed.TotalMilliseconds,
                Endpoints = endpoints
            };
        }

        public async Task<RedisManagerStatistics> GetStatisticsAsync(string tenantOsClient, RedisManagerContextRequest request)
        {
            var resolved = await ResolveConnectionAsync(tenantOsClient, request).ConfigureAwait(false);
            var database = resolved.Multiplexer.GetDatabase(resolved.Database);
            var ping = await database.PingAsync().ConfigureAwait(false);
            var servers = GetPrimaryServers(resolved.Multiplexer);
            var statistics = new RedisManagerStatistics
            {
                ConnectionName = resolved.Name,
                Mode = resolved.Mode,
                Database = resolved.Database,
                PingMilliseconds = Math.Round(ping.TotalMilliseconds, 2),
                Endpoints = servers.Select(server => server.EndPoint.ToString()).ToList()
            };

            foreach (var server in servers)
            {
                try
                {
                    statistics.KeyCount += await server.DatabaseSizeAsync(resolved.Database).ConfigureAwait(false);
                }
                catch { }

                try
                {
                    var info = await server.InfoAsync().ConfigureAwait(false);
                    foreach (var section in info)
                    {
                        foreach (var pair in section)
                        {
                            if (!IsUsefulInfoKey(pair.Key)) continue;
                            statistics.Info[pair.Key] = pair.Value;
                        }
                    }
                }
                catch { }
            }

            var sampleRequest = new RedisManagerKeyListRequest
            {
                Mode = request.Mode,
                ConnectionId = request.ConnectionId,
                Connection = request.Connection,
                Database = resolved.Database,
                Pattern = "*",
                PageSize = 200
            };
            var sample = await GetKeysAsync(tenantOsClient, sampleRequest).ConfigureAwait(false);
            statistics.SampleSize = sample.List.Count;
            foreach (var item in sample.List)
            {
                var type = string.IsNullOrWhiteSpace(item.Type) ? "unknown" : item.Type;
                statistics.TypeDistribution[type] = statistics.TypeDistribution.TryGetValue(type, out var count) ? count + 1 : 1;
            }
            return statistics;
        }

        public async Task<RedisManagerKeyPage> GetKeysAsync(string tenantOsClient, RedisManagerKeyListRequest request)
        {
            var resolved = await ResolveConnectionAsync(tenantOsClient, request).ConfigureAwait(false);
            var pageSize = Clamp(request.PageSize, 10, 500);
            var pattern = NormalizePattern(request.Pattern);
            var servers = GetPrimaryServers(resolved.Multiplexer);
            var state = DecodeCursor(request.Cursor);
            var keys = new List<string>();

            foreach (var server in servers)
            {
                if (keys.Count >= pageSize) break;
                var endpoint = server.EndPoint.ToString();
                if (state.Completed.Contains(endpoint)) continue;
                var cursor = state.Cursors.TryGetValue(endpoint, out var value) ? value : "0";
                var scan = await ExecuteScanAsync(server, resolved.Database, cursor, pattern, pageSize - keys.Count).ConfigureAwait(false);
                foreach (var key in scan.Keys)
                {
                    if (keys.Count >= pageSize) break;
                    if (!keys.Contains(key, StringComparer.Ordinal)) keys.Add(key);
                }
                state.Cursors[endpoint] = scan.NextCursor;
                if (scan.NextCursor == "0") state.Completed.Add(endpoint);
            }

            var database = resolved.Multiplexer.GetDatabase(resolved.Database);
            var itemTasks = keys.Select(key => GetKeyItemAsync(database, key)).ToArray();
            var items = itemTasks.Length == 0
                ? Array.Empty<RedisManagerKeyItem>()
                : await Task.WhenAll(itemTasks).ConfigureAwait(false);
            var hasMore = servers.Any(server => !state.Completed.Contains(server.EndPoint.ToString()));
            return new RedisManagerKeyPage
            {
                List = items.OrderBy(item => item.Key, StringComparer.Ordinal).ToList(),
                NextCursor = hasMore ? EncodeCursor(state) : "",
                HasMore = hasMore,
                Pattern = pattern,
                Database = resolved.Database
            };
        }

        public async Task<RedisManagerKeyDetail> GetKeyAsync(string tenantOsClient, RedisManagerKeyRequest request)
        {
            EnsureKey(request?.Key);
            var resolved = await ResolveConnectionAsync(tenantOsClient, request).ConfigureAwait(false);
            var database = resolved.Multiplexer.GetDatabase(resolved.Database);
            var key = request.Key;
            var type = await database.KeyTypeAsync(key).ConfigureAwait(false);
            if (type == RedisType.None) throw new InvalidOperationException("Redis Key 不存在或已过期。");
            var ttl = await database.KeyTimeToLiveAsync(key).ConfigureAwait(false);
            var detail = new RedisManagerKeyDetail
            {
                Key = key,
                Type = type.ToString().ToLowerInvariant(),
                TtlSeconds = ttl.HasValue ? (long?)Math.Floor(ttl.Value.TotalSeconds) : null,
                MemoryBytes = await TryGetMemoryUsageAsync(database, key).ConfigureAwait(false)
            };
            detail.Meta["Database"] = resolved.Database;
            detail.Meta["Connection"] = resolved.Name;

            var pageSize = Clamp(request.PageSize, 10, 1000);
            var pageIndex = Math.Max(1, request.PageIndex);
            var start = (long)(pageIndex - 1) * pageSize;
            var stop = start + pageSize - 1;
            switch (type)
            {
                case RedisType.String:
                    var value = await database.StringGetAsync(key).ConfigureAwait(false);
                    var stringValue = value.IsNull ? "" : value.ToString();
                    detail.Length = await database.StringLengthAsync(key).ConfigureAwait(false);
                    detail.Value = TryParseJson(stringValue) ?? (object)stringValue;
                    detail.RawValue = FormatRawValue(stringValue);
                    break;
                case RedisType.Hash:
                    var hashLength = await database.HashLengthAsync(key).ConfigureAwait(false);
                    var hashEntries = (await CollectAsync(
                        database.HashScanAsync(key, "*", pageSize, 0, (int)Math.Min(int.MaxValue, start)),
                        pageSize).ConfigureAwait(false)).ToArray();
                    var hashObject = new JObject();
                    foreach (var entry in hashEntries) hashObject[entry.Name.ToString()] = entry.Value.ToString();
                    detail.Length = hashLength;
                    detail.Truncated = start + hashEntries.Length < hashLength;
                    detail.Value = hashObject;
                    detail.RawValue = hashObject.ToString(Formatting.Indented);
                    break;
                case RedisType.List:
                    var listLength = await database.ListLengthAsync(key).ConfigureAwait(false);
                    var listValues = await database.ListRangeAsync(key, start, stop).ConfigureAwait(false);
                    var listArray = new JArray(listValues.Select(item => item.ToString()));
                    detail.Length = listLength;
                    detail.Truncated = start + listValues.Length < listLength;
                    detail.Value = listArray;
                    detail.RawValue = listArray.ToString(Formatting.Indented);
                    break;
                case RedisType.Set:
                    var setLength = await database.SetLengthAsync(key).ConfigureAwait(false);
                    var setValues = (await CollectAsync(
                        database.SetScanAsync(key, "*", pageSize, 0, (int)Math.Min(int.MaxValue, start)),
                        pageSize).ConfigureAwait(false)).ToArray();
                    var setArray = new JArray(setValues.Select(item => item.ToString()));
                    detail.Length = setLength;
                    detail.Truncated = start + setValues.Length < setLength;
                    detail.Value = setArray;
                    detail.RawValue = setArray.ToString(Formatting.Indented);
                    break;
                case RedisType.SortedSet:
                    var sortedLength = await database.SortedSetLengthAsync(key).ConfigureAwait(false);
                    var sortedValues = await database.SortedSetRangeByRankWithScoresAsync(key, start, stop, Order.Ascending).ConfigureAwait(false);
                    var sortedArray = new JArray(sortedValues.Select(item => new JObject
                    {
                        ["member"] = item.Element.ToString(),
                        ["score"] = item.Score
                    }));
                    detail.Length = sortedLength;
                    detail.Truncated = start + sortedValues.Length < sortedLength;
                    detail.Value = sortedArray;
                    detail.RawValue = sortedArray.ToString(Formatting.Indented);
                    break;
                case RedisType.Stream:
                    var streamLength = await database.StreamLengthAsync(key).ConfigureAwait(false);
                    var streamValues = await database.StreamRangeAsync(key, "-", "+", pageSize, Order.Ascending).ConfigureAwait(false);
                    var streamArray = new JArray(streamValues.Select(item => new JObject
                    {
                        ["id"] = item.Id.ToString(),
                        ["values"] = new JObject(item.Values.Select(pair => new JProperty(pair.Name.ToString(), pair.Value.ToString())))
                    }));
                    detail.Length = streamLength;
                    detail.Truncated = streamValues.Length < streamLength;
                    detail.Value = streamArray;
                    detail.RawValue = streamArray.ToString(Formatting.Indented);
                    break;
                default:
                    detail.RawValue = "该 Redis 数据类型暂不支持预览。";
                    detail.Value = detail.RawValue;
                    break;
            }
            return detail;
        }

        public async Task<long> DeleteKeysAsync(string tenantOsClient, RedisManagerDeleteRequest request)
        {
            if (request?.Keys == null || request.Keys.Count == 0) throw new ArgumentException("请选择要删除的 Redis Key。");
            var keys = request.Keys.Where(key => !string.IsNullOrWhiteSpace(key)).Distinct(StringComparer.Ordinal).Take(500).ToArray();
            if (keys.Length == 0) throw new ArgumentException("请选择要删除的 Redis Key。");
            foreach (var key in keys) EnsureKey(key);
            var resolved = await ResolveConnectionAsync(tenantOsClient, request).ConfigureAwait(false);
            var database = resolved.Multiplexer.GetDatabase(resolved.Database);
            return await database.KeyDeleteAsync(keys.Select(key => (RedisKey)key).ToArray()).ConfigureAwait(false);
        }

        public async Task ReplaceValueAsync(string tenantOsClient, RedisManagerReplaceRequest request)
        {
            EnsureKey(request?.Key);
            if ((request.Value ?? "").Length > 5 * 1024 * 1024) throw new ArgumentException("单次写入内容不能超过 5MB。");
            var dataType = (request.DataType ?? "string").Trim().ToLowerInvariant();
            var hashEntries = Array.Empty<HashEntry>();
            var listEntries = Array.Empty<RedisValue>();
            var setEntries = Array.Empty<RedisValue>();
            var sortedSetEntries = Array.Empty<SortedSetEntry>();

            // 先完整校验并转换输入，再删除旧 Key，避免 JSON 格式错误导致原数据丢失。
            switch (dataType)
            {
                case "string":
                    break;
                case "hash":
                    var hash = ParseObject(request.Value, "Hash 内容必须是 JSON 对象。");
                    if (!hash.Properties().Any()) throw new ArgumentException("Redis 不支持空 Hash，请至少保留一个字段。");
                    hashEntries = hash.Properties().Select(item =>
                        new HashEntry(item.Name, JsonTokenToRedisString(item.Value))).ToArray();
                    break;
                case "list":
                    var list = ParseArray(request.Value, "List 内容必须是 JSON 数组。");
                    if (list.Count == 0) throw new ArgumentException("Redis 不支持空 List，请至少保留一个元素。");
                    listEntries = list.Select(item => (RedisValue)JsonTokenToRedisString(item)).ToArray();
                    break;
                case "set":
                    var set = ParseArray(request.Value, "Set 内容必须是 JSON 数组。");
                    if (set.Count == 0) throw new ArgumentException("Redis 不支持空 Set，请至少保留一个元素。");
                    setEntries = set.Select(item => (RedisValue)JsonTokenToRedisString(item)).ToArray();
                    break;
                case "sortedset":
                case "zset":
                    var sorted = ParseArray(request.Value, "Sorted Set 内容必须是 [{member,score}] JSON 数组。");
                    var entries = new List<SortedSetEntry>();
                    foreach (var token in sorted)
                    {
                        var item = token as JObject ?? throw new ArgumentException("Sorted Set 每个元素必须包含 member 和 score。");
                        var member = TokenString(item["member"]);
                        if (string.IsNullOrEmpty(member) || !double.TryParse(TokenString(item["score"]), out var score))
                            throw new ArgumentException("Sorted Set 每个元素必须包含有效的 member 和 score。");
                        entries.Add(new SortedSetEntry(member, score));
                    }
                    if (entries.Count == 0) throw new ArgumentException("Redis 不支持空 Sorted Set，请至少保留一个元素。");
                    sortedSetEntries = entries.ToArray();
                    break;
                default:
                    throw new ArgumentException("仅支持写入 String、Hash、List、Set、Sorted Set。");
            }

            var resolved = await ResolveConnectionAsync(tenantOsClient, request).ConfigureAwait(false);
            var database = resolved.Multiplexer.GetDatabase(resolved.Database);
            var existingTtl = await database.KeyTimeToLiveAsync(request.Key).ConfigureAwait(false);
            await database.KeyDeleteAsync(request.Key).ConfigureAwait(false);

            switch (dataType)
            {
                case "string":
                    await database.StringSetAsync(request.Key, request.Value ?? "").ConfigureAwait(false);
                    break;
                case "hash":
                    await database.HashSetAsync(request.Key, hashEntries).ConfigureAwait(false);
                    break;
                case "list":
                    await database.ListRightPushAsync(request.Key, listEntries).ConfigureAwait(false);
                    break;
                case "set":
                    await database.SetAddAsync(request.Key, setEntries).ConfigureAwait(false);
                    break;
                case "sortedset":
                case "zset":
                    await database.SortedSetAddAsync(request.Key, sortedSetEntries).ConfigureAwait(false);
                    break;
            }

            if (request.TtlSeconds.HasValue)
            {
                await ApplyTtlAsync(database, request.Key, request.TtlSeconds.Value).ConfigureAwait(false);
            }
            else if (existingTtl.HasValue)
            {
                await database.KeyExpireAsync(request.Key, existingTtl).ConfigureAwait(false);
            }
        }

        public async Task RenameKeyAsync(string tenantOsClient, RedisManagerRenameRequest request)
        {
            EnsureKey(request?.Key);
            EnsureKey(request?.NewKey);
            if (request.Key == request.NewKey) return;
            var resolved = await ResolveConnectionAsync(tenantOsClient, request).ConfigureAwait(false);
            var database = resolved.Multiplexer.GetDatabase(resolved.Database);
            if (await database.KeyExistsAsync(request.NewKey).ConfigureAwait(false))
                throw new InvalidOperationException("目标 Key 已存在，请更换名称。");
            if (!await database.KeyRenameAsync(request.Key, request.NewKey, When.NotExists).ConfigureAwait(false))
                throw new InvalidOperationException("重命名失败，原 Key 可能已不存在。");
        }

        public async Task SetTtlAsync(string tenantOsClient, RedisManagerTtlRequest request)
        {
            EnsureKey(request?.Key);
            var resolved = await ResolveConnectionAsync(tenantOsClient, request).ConfigureAwait(false);
            var database = resolved.Multiplexer.GetDatabase(resolved.Database);
            await ApplyTtlAsync(database, request.Key, request.TtlSeconds).ConfigureAwait(false);
        }

        private sealed class ScanResultPage
        {
            public string NextCursor { get; set; }
            public List<string> Keys { get; set; } = new List<string>();
        }

        private static Task<ScanResultPage> ExecuteScanAsync(IServer server, int database, string cursor, string pattern, int count)
        {
            if (!long.TryParse(cursor ?? "0", out var cursorValue) || cursorValue < 0) cursorValue = 0;
            var enumerable = server.Keys(
                database,
                pattern,
                Math.Max(10, count),
                cursorValue,
                0,
                CommandFlags.None);
            var scanningCursor = enumerable as IScanningCursor;
            var page = new ScanResultPage();
            foreach (var key in enumerable.Take(count))
            {
                var value = key.ToString();
                if (!string.IsNullOrEmpty(value)) page.Keys.Add(value);
            }
            page.NextCursor = (scanningCursor?.Cursor ?? 0).ToString();
            return Task.FromResult(page);
        }

        private static async Task<RedisManagerKeyItem> GetKeyItemAsync(IDatabase database, string key)
        {
            var typeTask = database.KeyTypeAsync(key);
            var ttlTask = database.KeyTimeToLiveAsync(key);
            await Task.WhenAll(typeTask, ttlTask).ConfigureAwait(false);
            var ttl = ttlTask.Result;
            return new RedisManagerKeyItem
            {
                Key = key,
                Type = typeTask.Result.ToString().ToLowerInvariant(),
                TtlSeconds = ttl.HasValue ? (long?)Math.Floor(ttl.Value.TotalSeconds) : null,
                MemoryBytes = await TryGetMemoryUsageAsync(database, key).ConfigureAwait(false)
            };
        }

        private static async Task<long?> TryGetMemoryUsageAsync(IDatabase database, string key)
        {
            try
            {
                var result = await database.ExecuteAsync("MEMORY", "USAGE", key).ConfigureAwait(false);
                if (result.IsNull) return null;
                if (long.TryParse(result.ToString(), out var bytes)) return bytes;
            }
            catch
            {
                // Redis 4.0 以下或托管服务禁用 MEMORY 时不影响正常查看。
            }
            return null;
        }

        private static async Task<List<T>> CollectAsync<T>(IAsyncEnumerable<T> source, int limit)
        {
            var result = new List<T>();
            await foreach (var item in source.ConfigureAwait(false))
            {
                result.Add(item);
                if (result.Count >= limit) break;
            }
            return result;
        }

        private static bool IsUsefulInfoKey(string key)
        {
            switch ((key ?? "").ToLowerInvariant())
            {
                case "redis_version":
                case "redis_mode":
                case "os":
                case "arch_bits":
                case "uptime_in_seconds":
                case "uptime_in_days":
                case "connected_clients":
                case "blocked_clients":
                case "used_memory":
                case "used_memory_human":
                case "used_memory_peak":
                case "used_memory_peak_human":
                case "maxmemory":
                case "maxmemory_human":
                case "mem_fragmentation_ratio":
                case "total_connections_received":
                case "total_commands_processed":
                case "instantaneous_ops_per_sec":
                case "keyspace_hits":
                case "keyspace_misses":
                case "expired_keys":
                case "evicted_keys":
                case "role":
                case "rdb_last_save_time":
                case "rdb_last_bgsave_status":
                    return true;
                default:
                    return false;
            }
        }

        private static string NormalizePattern(string pattern)
        {
            var value = string.IsNullOrWhiteSpace(pattern) ? "*" : pattern.Trim();
            if (value.Length > 500) throw new ArgumentException("Key 搜索条件不能超过 500 个字符。");
            if (!value.Contains("*") && !value.Contains("?") && !value.Contains("[")) value = "*" + value + "*";
            return value;
        }

        private static string EncodeCursor(ScanCursorState state)
        {
            var json = new JObject
            {
                ["cursors"] = JObject.FromObject(state.Cursors),
                ["completed"] = new JArray(state.Completed)
            }.ToString(Formatting.None);
            return Convert.ToBase64String(Encoding.UTF8.GetBytes(json));
        }

        private static ScanCursorState DecodeCursor(string cursor)
        {
            var state = new ScanCursorState();
            if (string.IsNullOrWhiteSpace(cursor)) return state;
            try
            {
                var json = JObject.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(cursor)));
                var cursors = json["cursors"] as JObject;
                if (cursors != null)
                {
                    foreach (var property in cursors.Properties()) state.Cursors[property.Name] = property.Value.ToString();
                }
                var completed = json["completed"] as JArray;
                if (completed != null)
                {
                    foreach (var item in completed) state.Completed.Add(item.ToString());
                }
            }
            catch
            {
                throw new ArgumentException("分页游标无效，请重新刷新 Key 列表。");
            }
            return state;
        }

        private static JToken TryParseJson(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return null;
            var trimmed = value.Trim();
            if (!(trimmed.StartsWith("{") && trimmed.EndsWith("}"))
                && !(trimmed.StartsWith("[") && trimmed.EndsWith("]"))) return null;
            try { return JToken.Parse(trimmed); }
            catch { return null; }
        }

        private static string FormatRawValue(string value)
        {
            var json = TryParseJson(value);
            return json == null ? value ?? "" : json.ToString(Formatting.Indented);
        }

        private static JObject ParseObject(string value, string message)
        {
            try { return JObject.Parse(value ?? "{}"); }
            catch { throw new ArgumentException(message); }
        }

        private static JArray ParseArray(string value, string message)
        {
            try { return JArray.Parse(value ?? "[]"); }
            catch { throw new ArgumentException(message); }
        }

        private static string JsonTokenToRedisString(JToken token)
        {
            if (token == null || token.Type == JTokenType.Null) return "";
            if (token.Type == JTokenType.Object || token.Type == JTokenType.Array)
                return token.ToString(Formatting.None);
            return token.ToString();
        }

        private static async Task ApplyTtlAsync(IDatabase database, string key, long ttlSeconds)
        {
            if (ttlSeconds < -1) throw new ArgumentException("TTL 必须为 -1、0 或大于 0 的秒数。");
            bool ok;
            if (ttlSeconds == -1)
                ok = await database.KeyPersistAsync(key).ConfigureAwait(false);
            else if (ttlSeconds == 0)
                ok = await database.KeyDeleteAsync(key).ConfigureAwait(false);
            else
                ok = await database.KeyExpireAsync(key, TimeSpan.FromSeconds(ttlSeconds)).ConfigureAwait(false);
            if (!ok && ttlSeconds != 0) throw new InvalidOperationException("TTL 更新失败，Key 可能已不存在。");
        }

        private static void EnsureKey(string key)
        {
            if (string.IsNullOrWhiteSpace(key)) throw new ArgumentException("Redis Key 不能为空。");
            if (Encoding.UTF8.GetByteCount(key) > 1024) throw new ArgumentException("Redis Key 不能超过 1024 字节。");
        }

        private async Task<List<JObject>> GetSavedRowsAsync(string tenantOsClient, string id)
        {
            var where = new List<object>
            {
                new object[] { "TenantOsClient", "=", tenantOsClient }
            };
            if (!string.IsNullOrWhiteSpace(id))
            {
                where.Add(new object[] { "Id", "=", id });
            }
            else
            {
                where.Add(new object[] { "Status", "=", 1 });
            }
            var query = new
            {
                OsClient = GetStorageOsClient(),
                _Where = where,
                _SelectFields = new[]
                {
                    "Id", "TenantOsClient", "Name", "Host", "Port", "Username", "Password", "Database",
                    "Ssl", "ConnectTimeout", "KeySeparator", "Status", "Sort", "Remark", "CreateTime", "UpdateTime"
                },
                _OrderBy = "Sort",
                _OrderByType = "ASC",
                _PageIndex = 1,
                _PageSize = 500
            };
            var result = await MicroiEngine.FormEngine.GetTableDataAsync<JObject>(ConnectionTable, query).ConfigureAwait(false);
            if (result.Code != 1 && result.Code != 2)
            {
                throw new InvalidOperationException(result.Msg ?? "读取 Redis 连接失败。");
            }
            return result.Data ?? new List<JObject>();
        }

        private async Task<ResolvedConnection> ResolveConnectionAsync(string tenantOsClient, RedisManagerContextRequest request)
        {
            if (request == null) throw new ArgumentException("Redis 请求参数不能为空。");
            var mode = (request.Mode ?? "tenant").Trim().ToLowerInvariant();
            if (mode == "tenant")
            {
                EnsureTenant(tenantOsClient);
                var tenantClient = OsClient.GetClient(tenantOsClient);
                var configuredDb = SafeInt(tenantClient.OsClientModel["RedisDataBase"], 0);
                try
                {
                    // 确保租户连接已注册；随后复用平台已有 ConnectionMultiplexer，避免额外连接风暴。
                    _ = new MicroiCacheRedis(tenantOsClient);
                    return new ResolvedConnection
                    {
                        Multiplexer = MicroiCacheRedis.GetConnection(tenantOsClient),
                        Database = ValidateDatabase(request.Database ?? configuredDb),
                        Name = "当前租户 Redis",
                        Mode = mode
                    };
                }
                catch (Exception ex)
                {
                    throw new InvalidOperationException("当前租户 Redis 连接不可用：" + SanitizeExceptionMessage(ex.Message));
                }
            }

            RedisManagerConnectionInput input;
            string name;
            if (mode == "saved")
            {
                EnsureTenant(tenantOsClient);
                if (string.IsNullOrWhiteSpace(request.ConnectionId)) throw new ArgumentException("ConnectionId 不能为空。");
                var row = (await GetSavedRowsAsync(tenantOsClient, request.ConnectionId).ConfigureAwait(false)).FirstOrDefault();
                if (row == null) throw new InvalidOperationException("未找到已保存的 Redis 连接，或该连接不属于当前租户。");
                input = new RedisManagerConnectionInput
                {
                    Name = TokenString(row["Name"]),
                    Host = TokenString(row["Host"]),
                    Port = SafeInt(row["Port"], 6379),
                    Username = TokenString(row["Username"]),
                    Password = DecryptPassword(TokenString(row["Password"]), tenantOsClient),
                    Database = SafeInt(row["Database"], 0),
                    Ssl = SafeBool(row["Ssl"]),
                    ConnectTimeout = SafeInt(row["ConnectTimeout"], 5000),
                    KeySeparator = TokenString(row["KeySeparator"], ":")
                };
                name = input.Name;
            }
            else if (mode == "temporary")
            {
                input = request.Connection ?? throw new ArgumentException("临时连接参数不能为空。");
                name = string.IsNullOrWhiteSpace(input.Name) ? "临时 Redis" : input.Name.Trim();
            }
            else
            {
                throw new ArgumentException("不支持的 Redis 连接模式。");
            }

            ValidateConnection(input, allowEmptyPassword: true);
            var multiplexer = await GetOrCreateConnectionAsync(input).ConfigureAwait(false);
            return new ResolvedConnection
            {
                Multiplexer = multiplexer,
                Database = ValidateDatabase(request.Database ?? input.Database),
                Name = name,
                Mode = mode
            };
        }

        private static async Task<ConnectionMultiplexer> GetOrCreateConnectionAsync(RedisManagerConnectionInput input)
        {
            CleanupConnectionCache();
            var cacheKey = BuildConnectionCacheKey(input);
            var entry = CachedConnections.GetOrAdd(cacheKey, _ => new CachedConnection
            {
                LastUsedUtc = DateTime.UtcNow,
                Multiplexer = new Lazy<Task<ConnectionMultiplexer>>(
                    () => ConnectionMultiplexer.ConnectAsync(BuildConfiguration(input)),
                    true)
            });
            entry.LastUsedUtc = DateTime.UtcNow;
            try
            {
                var connection = await entry.Multiplexer.Value.ConfigureAwait(false);
                if (!connection.IsConnected)
                {
                    CachedConnections.TryRemove(cacheKey, out _);
                    connection.Dispose();
                    throw new InvalidOperationException("Redis 服务器未建立可用连接。");
                }
                return connection;
            }
            catch
            {
                CachedConnections.TryRemove(cacheKey, out _);
                throw;
            }
        }

        private static ConfigurationOptions BuildConfiguration(RedisManagerConnectionInput input)
        {
            var options = new ConfigurationOptions
            {
                AbortOnConnectFail = false,
                AllowAdmin = true,
                ConnectRetry = 1,
                ConnectTimeout = Clamp(input.ConnectTimeout, 1000, 15000),
                SyncTimeout = Clamp(input.ConnectTimeout, 1000, 15000),
                AsyncTimeout = Clamp(input.ConnectTimeout, 1000, 15000),
                DefaultDatabase = ValidateDatabase(input.Database),
                Ssl = input.Ssl,
                ResolveDns = true,
                ClientName = "Microi-Redis-Manager"
            };
            options.EndPoints.Add(input.Host.Trim(), input.Port);
            if (!string.IsNullOrWhiteSpace(input.Username)) options.User = input.Username.Trim();
            if (!string.IsNullOrEmpty(input.Password)) options.Password = input.Password;
            return options;
        }

        private static void CleanupConnectionCache()
        {
            var now = DateTime.UtcNow;
            foreach (var pair in CachedConnections.ToArray())
            {
                if (now - pair.Value.LastUsedUtc <= CachedConnectionIdleTime && CachedConnections.Count <= MaxCachedConnections) continue;
                if (CachedConnections.TryRemove(pair.Key, out var removed)
                    && removed.Multiplexer.IsValueCreated
                    && removed.Multiplexer.Value.IsCompletedSuccessfully)
                {
                    removed.Multiplexer.Value.Result.Dispose();
                }
            }
        }

        private static string BuildConnectionCacheKey(RedisManagerConnectionInput input)
        {
            var raw = string.Join("\n", input.Host, input.Port, input.Username, input.Password, input.Database, input.Ssl, input.ConnectTimeout);
            using (var sha = SHA256.Create())
            {
                return Convert.ToBase64String(sha.ComputeHash(Encoding.UTF8.GetBytes(raw)));
            }
        }

        private static List<IServer> GetPrimaryServers(ConnectionMultiplexer connection)
        {
            var servers = new List<IServer>();
            foreach (var endpoint in connection.GetEndPoints())
            {
                try
                {
                    var server = connection.GetServer(endpoint);
                    if (server.IsConnected && !server.IsReplica) servers.Add(server);
                }
                catch
                {
                    // 忽略集群中不可用或无法识别的端点。
                }
            }
            if (servers.Count == 0)
            {
                foreach (var endpoint in connection.GetEndPoints())
                {
                    try
                    {
                        var server = connection.GetServer(endpoint);
                        if (server.IsConnected) servers.Add(server);
                    }
                    catch { }
                }
            }
            if (servers.Count == 0) throw new InvalidOperationException("Redis 没有可用节点。");
            return servers;
        }

        private static RedisManagerConnectionSummary ToSummary(JObject row)
        {
            return new RedisManagerConnectionSummary
            {
                Id = TokenString(row?["Id"]),
                Name = TokenString(row?["Name"]),
                Mode = "saved",
                Host = TokenString(row?["Host"]),
                Port = SafeInt(row?["Port"], 6379),
                Username = TokenString(row?["Username"]),
                Database = SafeInt(row?["Database"], 0),
                Ssl = SafeBool(row?["Ssl"]),
                ConnectTimeout = SafeInt(row?["ConnectTimeout"], 5000),
                KeySeparator = TokenString(row?["KeySeparator"], ":"),
                Status = SafeInt(row?["Status"], 1),
                Sort = SafeInt(row?["Sort"], 100),
                Remark = TokenString(row?["Remark"]),
                HasPassword = !string.IsNullOrEmpty(TokenString(row?["Password"])),
                IsDefault = false
            };
        }

        private static void ValidateConnection(RedisManagerConnectionInput input, bool allowEmptyPassword)
        {
            if (input == null) throw new ArgumentException("Redis 连接参数不能为空。");
            var host = (input.Host ?? "").Trim();
            if (host.Length == 0 || host.Length > 253) throw new ArgumentException("Redis 主机地址不能为空且不能超过 253 个字符。");
            if (host.Any(ch => char.IsWhiteSpace(ch) || ch == ',' || ch == '/' || ch == '\\' || ch == '@' || ch == ';'))
                throw new ArgumentException("Redis 主机地址格式不合法。");
            if (input.Port < 1 || input.Port > 65535) throw new ArgumentException("Redis 端口必须在 1-65535 之间。");
            ValidateDatabase(input.Database);
            input.ConnectTimeout = Clamp(input.ConnectTimeout, 1000, 15000);
            if (!allowEmptyPassword && string.IsNullOrEmpty(input.Password)) throw new ArgumentException("Redis 密码不能为空。");
            if ((input.Username ?? "").Length > 200) throw new ArgumentException("Redis 用户名过长。");
            if ((input.Password ?? "").Length > 2000) throw new ArgumentException("Redis 密码过长。");
            if ((input.KeySeparator ?? ":").Length > 10) throw new ArgumentException("键分隔符不能超过 10 个字符。");
        }

        private static string GetStorageOsClient()
        {
            var osClient = OsClient.GetConfigOsClient();
            if (string.IsNullOrWhiteSpace(osClient)) throw new InvalidOperationException("主租户 OsClient 未配置，无法读取 Redis 连接表。");
            return osClient;
        }

        private static string ResolveEncryptionKey(string tenantOsClient)
        {
            var explicitKey = ConfigHelper.GetEnvOrConfiguration("MICROI_REDIS_MANAGER_SECRET_KEY", "Security:RedisManagerSecretKey");
            if (!string.IsNullOrWhiteSpace(explicitKey)) return explicitKey;
            var client = OsClient.GetClient(tenantOsClient);
            return "Microi.RedisManager:" + DiyToken.ResolveJwtSigningKey(client);
        }

        private static string EncryptPassword(string password, string tenantOsClient)
        {
            return string.IsNullOrEmpty(password) ? "" : EncryptHelper.AESEncrypt(password, ResolveEncryptionKey(tenantOsClient));
        }

        private static string DecryptPassword(string passwordCipher, string tenantOsClient)
        {
            if (string.IsNullOrEmpty(passwordCipher)) return "";
            try
            {
                return EncryptHelper.AESDecrypt(passwordCipher, ResolveEncryptionKey(tenantOsClient));
            }
            catch
            {
                throw new InvalidOperationException("该 Redis 连接的密码无法解密，请重新编辑连接并填写密码。");
            }
        }

        private static void EnsureTenant(string tenantOsClient)
        {
            if (string.IsNullOrWhiteSpace(tenantOsClient)) throw new InvalidOperationException("当前租户不能为空。");
        }

        private static int ValidateDatabase(int database)
        {
            if (database < 0 || database > 1023) throw new ArgumentException("Redis 数据库索引必须在 0-1023 之间。");
            return database;
        }

        private static int Clamp(int value, int min, int max)
        {
            if (value < min) return min;
            return value > max ? max : value;
        }

        private static int SafeInt(JToken token, int fallback)
        {
            if (token == null) return fallback;
            return int.TryParse(token.ToString(), out var value) ? value : fallback;
        }

        private static bool SafeBool(JToken token)
        {
            if (token == null) return false;
            var value = token.ToString();
            return value == "1" || value.Equals("true", StringComparison.OrdinalIgnoreCase);
        }

        private static string TokenString(JToken token, string fallback = "")
        {
            if (token == null || token.Type == JTokenType.Null) return fallback;
            return token.ToString();
        }

        private static string SanitizeExceptionMessage(string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return "未知错误";
            var result = message;
            var markers = new[] { "password=", "pwd=" };
            foreach (var marker in markers)
            {
                var index = result.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
                if (index < 0) continue;
                var end = result.IndexOf(',', index);
                if (end < 0) end = result.Length;
                result = result.Substring(0, index + marker.Length) + "***" + result.Substring(end);
            }
            return result.Length > 500 ? result.Substring(0, 500) : result;
        }
    }
}

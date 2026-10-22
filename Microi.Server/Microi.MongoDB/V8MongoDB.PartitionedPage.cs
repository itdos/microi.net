using System;
using System.Collections.Generic;
using System.Collections.Concurrent;
using System.Threading;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
using Dos.Common;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8MongoDB
    {
        // 分区目录只在当前可信租户下解析；V8 编排业务权限，本原子仅负责有界、稳定的存储读取。
        private static readonly ConcurrentDictionary<string, bool> PartitionPageIndexes = new ConcurrentDictionary<string, bool>();

        private sealed class PartitionedPageLocation
        {
            public string Database { get; set; }
            public string Table { get; set; }
            public DateTime StartInclusive { get; set; }
            public DateTime EndExclusive { get; set; }
        }

        private static bool IsPartitionPrefix(string value) =>
            value != null && Regex.IsMatch(value, "^[a-z][a-z0-9_]{0,47}$", RegexOptions.CultureInvariant);

        private static PartitionedPageLocation ParsePageLocation(string database, string table, string baseDatabase, string prefix)
        {
            if (database != baseDatabase && !Regex.IsMatch(database, "^" + Regex.Escape(baseDatabase) + "_[0-9]{4}$")) return null;
            var match = Regex.Match(table, "^" + Regex.Escape(prefix) + "_([0-9]{4})(?:_?([0-9]{2}))?$");
            if (!match.Success) return null;
            var year = int.Parse(match.Groups[1].Value, CultureInfo.InvariantCulture);
            var month = match.Groups[2].Success ? int.Parse(match.Groups[2].Value, CultureInfo.InvariantCulture) : 12;
            if (year < 1900 || year > 9998 || month < 1 || month > 12) return null;
            if (database != baseDatabase && database != baseDatabase + "_" + year) return null;
            return new PartitionedPageLocation { Database = database, Table = table, StartInclusive = new DateTime(year, match.Groups[2].Success ? month : 1, 1, 0, 0, 0, DateTimeKind.Local).ToUniversalTime(), EndExclusive = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Local).AddMonths(1).ToUniversalTime() };
        }

        /// <summary>
        /// 年库/月集合与旧年度集合的按页合并。严格限定当前租户命名空间，不接受客户端给出的库名列表。
        /// 每个集合只取 pageSize+1，按时间和原生 _id 排序；空月份继续，目录/扫描超限不会冒充历史结束。
        /// </summary>
        public DosResult GetPartitionedTableData(dynamic dynamicParam)
        {
            try
            {
                using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(20));
                JObject input = JsonHelper.ToJObject(dynamicParam);
                var tenant = ResolveV8MongoTenant(input.Value<string>("OsClient"));
                var databasePrefix = input.Value<string>("DatabasePrefix");
                var tablePrefix = input.Value<string>("TablePrefix");
                var size = input.Value<int?>("PageSize") ?? 30;
                var budget = input.Value<int?>("MaxPartitions") ?? 64;
                if (string.IsNullOrWhiteSpace(tenant) || !Regex.IsMatch(tenant, "^[A-Za-z0-9_-]{1,80}$")
                    || !IsPartitionPrefix(databasePrefix) || !IsPartitionPrefix(tablePrefix)
                    || size < 1 || size > 100 || budget < 1 || budget > 128)
                    return new DosResult(0, null, "MongoDB 分区分页参数无效。");
                var branches = input["_WhereAny"] as JArray;
                var whereIdentity = (JToken)branches ?? input["_Where"];
                if (branches != null ? branches.Count < 1 || branches.Count > 4 || branches.Any(branch => !IsSafeMutationWhere(branch, out _)) : !IsSafeMutationWhere(whereIdentity, out _))
                    return new DosResult(0, null, "MongoDB 分区分页必须提供有效、非空的 _Where。");

                var indexFields = (input["IndexFields"] as JArray)?.Select(field => field.Value<string>() ?? "").ToArray() ?? Array.Empty<string>();
                if (indexFields.Length > 3 || indexFields.Any(field => string.IsNullOrEmpty(field) || !Regex.IsMatch(field, "^[A-Za-z][A-Za-z0-9_]{0,63}$"))
                    || indexFields.Distinct().Count() != indexFields.Length)
                    return new DosResult(0, null, "MongoDB 分区索引参数无效。");
                var baseDatabase = databasePrefix + "_" + tenant.ToLowerInvariant();
                var scope = EncryptHelper.SHA256(tenant + "|" + databasePrefix + "|" + tablePrefix + "|" + whereIdentity.ToString(Formatting.None));
                DateTime? beforeTime = null;
                ObjectId beforeId = ObjectId.Empty;
                var cursorText = input.Value<string>("Cursor");
                if (!string.IsNullOrEmpty(cursorText))
                {
                    if (!TryParsePageCursor(cursorText, scope, out var parsed, out beforeId))
                        return new DosResult(0, null, "MongoDB 分页游标不属于当前查询。");
                    beforeTime = parsed;
                }

                var filters = new List<FilterDefinition<dynamic>>();
                if (branches != null)
                    foreach (var branch in branches)
                    {
                        var branchFilters = new List<FilterDefinition<dynamic>>();
                        GetWhereSql(branch, branchFilters);
                        filters.Add(Builders<dynamic>.Filter.And(branchFilters));
                    }
                else GetWhereSql(whereIdentity, filters);
                var registry = BsonSerializer.SerializerRegistry;
                var filterDocument = (branches != null ? Builders<dynamic>.Filter.Or(filters) : Builders<dynamic>.Filter.And(filters)).Render(new RenderArgs<dynamic>(registry.GetSerializer<dynamic>(), registry));
                FilterDefinition<BsonDocument> filter = filterDocument;
                if (beforeTime.HasValue)
                    filter &= Builders<BsonDocument>.Filter.Or(
                        Builders<BsonDocument>.Filter.Lt("CreateTime", beforeTime.Value),
                        Builders<BsonDocument>.Filter.And(Builders<BsonDocument>.Filter.Eq("CreateTime", beforeTime.Value), Builders<BsonDocument>.Filter.Lt("_id", beforeId)));
                var host = new MongodbHost { Connection = OsClient.GetClient(tenant).OsClientModel["DbMongoConnection"].Val<string>(), DataBase = baseDatabase };
                var database = MongodbClient<BsonDocument>.MongodbDatabase(host);
                // 目录查询仅返回本租户匹配名称，不向调用者暴露服务器上其它数据库。
                var databaseNames = database.Client.ListDatabaseNames(new ListDatabaseNamesOptions
                {
                    Filter = new BsonDocument("name", new BsonRegularExpression("^" + Regex.Escape(baseDatabase) + "(?:_[0-9]{4})?$"))
                }, deadline.Token).ToList(deadline.Token);
                if (databaseNames.Count > 200) return new DosResult(0, null, "MongoDB 历史数据库目录超过单次安全上限。");
                var locations = new List<PartitionedPageLocation>();
                foreach (var name in databaseNames)
                {
                    var names = database.Client.GetDatabase(name).ListCollectionNames(new ListCollectionNamesOptions
                    {
                        Filter = new BsonDocument("name", new BsonRegularExpression("^" + Regex.Escape(tablePrefix) + "_[0-9]{4}(?:_?[0-9]{2})?$"))
                    }, deadline.Token).ToList(deadline.Token);
                    foreach (var table in names)
                    {
                        var location = ParsePageLocation(name, table, baseDatabase, tablePrefix);
                        if (location != null) locations.Add(location);
                    }
                    if (locations.Count > 2400) return new DosResult(0, null, "MongoDB 历史集合目录超过单次安全上限。");
                }
                locations = locations.OrderByDescending(item => item.EndExclusive).ThenBy(item => item.Database).ThenBy(item => item.Table).ToList();
                if (beforeTime.HasValue) locations = locations.Where(item => item.StartInclusive <= beforeTime.Value).ToList();
                if (input.Value<bool?>("CountOnly") == true)
                {
                    if (locations.Count > budget) return new DosResult(0, null, "MongoDB 分区计数超过安全上限，未返回不完整数量。");
                    long total = 0;
                    foreach (var location in locations)
                    {
                        var collection = database.Client.GetDatabase(location.Database).GetCollection<BsonDocument>(location.Table);
                        EnsurePartitionPageIndex(collection, indexFields, deadline.Token);
                        total += collection.CountDocuments(filter, new CountOptions { MaxTime = TimeSpan.FromSeconds(10) }, deadline.Token);
                    }
                    return new DosResult(1, new { Count = total });
                }
                var rows = new List<BsonDocument>();
                var scanned = 0;
                var remaining = false;
                DateTime? continuation = null;
                foreach (var location in locations)
                {
                    // 旧年度集合可能与月表时间范围重叠，不能在当前集合耗尽后直接宣告全局结束。
                    if (rows.Count > size && PageTime(rows[size - 1]) >= location.EndExclusive) { remaining = true; break; }
                    if (scanned >= budget)
                    {
                        // 只输出晚于全部未扫描分区的数据，否则续页可能跳过
                        // 与当前月份时间范围重叠的旧年度集合中的消息。
                        rows = rows.Where(row => PageTime(row) >= location.EndExclusive).ToList();
                        remaining = true;
                        continuation = location.EndExclusive;
                        if (rows.Count == 0 && beforeTime.HasValue && continuation >= beforeTime)
                            return new DosResult(0, null, "MongoDB 重叠历史分区超过扫描上限，请缩小查询范围。");
                        break;
                    }
                    var collection = database.Client.GetDatabase(location.Database).GetCollection<BsonDocument>(location.Table);
                    EnsurePartitionPageIndex(collection, indexFields, deadline.Token);
                    var page = collection.Find(filter, new FindOptions { MaxTime = TimeSpan.FromSeconds(10) })
                        .Sort(Builders<BsonDocument>.Sort.Descending("CreateTime").Descending("_id")).Limit(size + 1)
                        .Project<BsonDocument>(Builders<BsonDocument>.Projection.Exclude("_t")).ToList(deadline.Token);
                    foreach (var row in page)
                    {
                        row["_PartitionDb"] = location.Database;
                        row["_PartitionTable"] = location.Table;
                        rows.Add(row);
                    }
                    rows = rows.GroupBy(item => item["_id"].ToString()).Select(group => group.First())
                        .OrderByDescending(PageTime).ThenByDescending(item => item["_id"].AsObjectId).Take(size + 1).ToList();
                    scanned++;
                }
                var hasMore = rows.Count > size || remaining;
                var selected = rows.Take(size).ToList();
                var last = selected.LastOrDefault();
                var next = last != null ? PageCursor(scope, PageTime(last), last["_id"].AsObjectId)
                    : continuation.HasValue ? PageCursor(scope, continuation.Value, ObjectId.Parse("ffffffffffffffffffffffff")) : "";
                // Mongo BSON 转为普通值，避免内部 _t/CLR 判别器与 ObjectId 泄入 Jint 序列化。
                var result = selected.Select(row => row.Elements.ToDictionary(field => field.Name, field => field.Value.IsObjectId
                    ? (object)field.Value.AsObjectId.ToString() : BsonTypeMapper.MapToDotNetValue(field.Value))).ToList();
                return new DosResult(1, new { Rows = result, HasMore = hasMore, NextCursor = next, ScannedPartitions = scanned });
            }
            catch (Exception error)
            {
                // 存储错误不能伪装成历史为空；不把连接串或服务器明细发送给浏览器。
                return new DosResult(0, null, "MongoDB 分区历史读取失败（" + error.GetType().Name + "）。");
            }
        }

        private static void EnsurePartitionPageIndex(IMongoCollection<BsonDocument> collection, string[] fields, CancellationToken cancellationToken)
        {
            if (fields.Length == 0) return;
            var name = "microi_page_" + string.Join("_", fields) + "_time_id";
            var key = collection.Database.Client.Settings.GetHashCode() + "|" + collection.CollectionNamespace + "|" + name;
            if (PartitionPageIndexes.ContainsKey(key)) return;
            var keys = fields.Select(field => Builders<BsonDocument>.IndexKeys.Ascending(field)).ToList();
            keys.Add(Builders<BsonDocument>.IndexKeys.Descending("CreateTime"));
            keys.Add(Builders<BsonDocument>.IndexKeys.Descending("_id"));
            collection.Indexes.CreateOne(new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Combine(keys), new CreateIndexOptions { Name = name }), cancellationToken: cancellationToken);
            if (PartitionPageIndexes.Count >= 4096) PartitionPageIndexes.Clear();
            PartitionPageIndexes[key] = true;
        }

        private static DateTime PageTime(BsonDocument row) => row["CreateTime"].IsValidDateTime
            ? row["CreateTime"].ToUniversalTime() : DateTime.Parse(row["CreateTime"].AsString, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal).ToUniversalTime();

        private static bool TryParsePageCursor(string text, string scope, out DateTime utc, out ObjectId id)
        {
            utc = default;
            id = ObjectId.Empty;
            if (string.IsNullOrEmpty(text) || text.Length > 2048) return false;
            try
            {
                // 保留 JSON 中原始 ISO 时间。默认自动 Date 转换后再 Value<string>
                // 会丢失 Z/偏移，非 UTC 服务器随后转换时会错移游标、漏掉同时间消息。
                var cursor = JsonConvert.DeserializeObject<JObject>(text, new JsonSerializerSettings
                {
                    DateParseHandling = DateParseHandling.None,
                    MaxDepth = 4
                });
                if (cursor == null || cursor.Value<int?>("v") != 1 || cursor.Value<string>("scope") != scope
                    || cursor["time"]?.Type != JTokenType.String
                    || !DateTime.TryParse(cursor.Value<string>("time"), CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var parsed)
                    || parsed.Kind == DateTimeKind.Unspecified
                    || !ObjectId.TryParse(cursor.Value<string>("id"), out id)) return false;
                utc = parsed.ToUniversalTime();
                return true;
            }
            catch (Exception error) when (error is JsonException || error is ArgumentException || error is FormatException || error is InvalidCastException)
            {
                return false;
            }
        }

        private static string PageCursor(string scope, DateTime time, ObjectId id) => JsonConvert.SerializeObject(new { v = 1, scope, time = time.ToString("O", CultureInfo.InvariantCulture), id = id.ToString() });
    }
}

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading;
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
        // 离线候选：业务迁移状态、权限和切换写入者的凭据仍由 Managed 引擎负责。
        // 此模式只保留物理记录；不能让普通历史页的 _id 去重掩盖迁移冲突。
        private sealed class PhysicalPageLocation
        {
            public string Database { get; set; }
            public string Table { get; set; }
            public string Identity { get; set; }
        }

        private static List<PhysicalPageLocation> ReadPhysicalPageDirectory(
            IMongoClient client, string baseDatabase, string tablePrefix, CancellationToken cancellation)
        {
            var databaseNames = client.ListDatabaseNames(new ListDatabaseNamesOptions
            {
                Filter = new BsonDocument("name", new BsonRegularExpression("^" + Regex.Escape(baseDatabase) + "(?:_[0-9]{4})?$"))
            }, cancellation).ToList(cancellation);
            if (databaseNames.Count > 200) throw new InvalidOperationException("PhysicalDirectoryDatabaseLimit");
            var result = new List<PhysicalPageLocation>();
            foreach (var name in databaseNames.OrderBy(value => value, StringComparer.Ordinal))
            {
                // 使用 UUID 纳入目录身份，避免删掉集合后按同名重建仍复用旧游标。
                using var catalog = client.GetDatabase(name).ListCollections(new ListCollectionsOptions
                {
                    Filter = new BsonDocument("name", new BsonRegularExpression("^" + Regex.Escape(tablePrefix) + "_[0-9]{4}(?:_?[0-9]{2})?$"))
                }, cancellation);
                while (catalog.MoveNext(cancellation))
                foreach (var entry in catalog.Current)
                {
                    var table = entry.GetValue("name", "").AsString;
                    if (ParsePageLocation(name, table, baseDatabase, tablePrefix) == null)
                        throw new InvalidOperationException("PhysicalDirectoryInvalidPeriod");
                    if (entry.GetValue("type", "").AsString != "collection"
                        || !entry.TryGetValue("info", out var info) || !info.IsBsonDocument
                        || !info.AsBsonDocument.TryGetValue("uuid", out var uuid) || !uuid.IsBsonBinaryData)
                        throw new InvalidOperationException("PhysicalDirectoryIdentityUnavailable");
                    result.Add(new PhysicalPageLocation
                    {
                        Database = name, Table = table,
                        Identity = Convert.ToBase64String(uuid.AsBsonBinaryData.Bytes)
                    });
                    if (result.Count > 2400) throw new InvalidOperationException("PhysicalDirectoryCollectionLimit");
                }
            }
            return result.OrderBy(item => item.Database, StringComparer.Ordinal)
                .ThenBy(item => item.Table, StringComparer.Ordinal).ToList();
        }

        private static string PhysicalPageDirectoryHash(List<PhysicalPageLocation> directory) =>
            EncryptHelper.SHA256(string.Join("\n", directory.Select(item => item.Database + "|" + item.Table + "|" + item.Identity)));

        private static object MapIndexedPageValue(BsonValue value)
        {
            if (value.IsObjectId) return value.AsObjectId.ToString();
            // BSON 日期是 UTC 时间事实；在存储边界输出明确偏移，避免 Jint/宿主区域格式丢失时区。
            if (value.IsBsonDateTime) return value.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture);
            return BsonTypeMapper.MapToDotNetValue(value);
        }

        private static string PhysicalPageCursor(string scope, string directory, int partition, ObjectId? after) =>
            JsonConvert.SerializeObject(new { v = 1, mode = "physical", scope, directory, partition, after = after?.ToString() ?? "" });

        private static bool ParsePhysicalPageCursor(string value, string scope, string directory, int count,
            out int partition, out ObjectId? after)
        {
            partition = 0;
            after = null;
            if (string.IsNullOrEmpty(value) || value.Length > 2048) return false;
            try
            {
                var cursor = JsonConvert.DeserializeObject<JObject>(value, new JsonSerializerSettings
                { DateParseHandling = DateParseHandling.None, MaxDepth = 4 });
                if (cursor == null || cursor.Value<int?>("v") != 1 || cursor.Value<string>("mode") != "physical"
                    || cursor.Value<string>("scope") != scope || cursor.Value<string>("directory") != directory
                    || cursor["partition"]?.Type != JTokenType.Integer) return false;
                partition = cursor.Value<int>("partition");
                if (partition < 0 || partition >= count || cursor["after"]?.Type != JTokenType.String) return false;
                var last = cursor.Value<string>("after");
                if (last.Length > 0)
                {
                    if (!ObjectId.TryParse(last, out var id)) return false;
                    after = id;
                }
                return true;
            }
            catch (Exception error) when (error is JsonException || error is ArgumentException || error is FormatException || error is OverflowException)
            { return false; }
        }

        /// <summary>
        /// 当前租户的完整物理分区扫描。单次最多返回 100 行、访问 8 个数据集合，
        /// 不 Count、不创建索引、不合并重复 _id；总限时继承调用入口的 20 秒。
        /// </summary>
        private DosResult GetPartitionedPhysicalRows(JObject input, CancellationToken cancellation)
        {
            var tenant = ResolveV8MongoTenant(input.Value<string>("OsClient"));
            var databasePrefix = input.Value<string>("DatabasePrefix");
            var tablePrefix = input.Value<string>("TablePrefix");
            var size = input.Value<int?>("PageSize") ?? 100;
            var budget = input.Value<int?>("MaxPartitions") ?? 8;
            if (string.IsNullOrWhiteSpace(tenant) || !Regex.IsMatch(tenant, "^[A-Za-z0-9_-]{1,80}$")
                || !IsPartitionPrefix(databasePrefix) || !IsPartitionPrefix(tablePrefix)
                || size < 1 || size > 100 || budget < 1 || budget > 8
                || input.Value<bool?>("CountOnly") == true || input["_WhereAny"] != null)
                return new DosResult(0, null, "MongoDB 物理扫描参数无效。");
            // 不带条件才是完整物理扫描；带条件只证明对应子集，不能作租户迁移完成凭据。
            var where = input["_Where"];
            if (where != null && !IsSafeMutationWhere(where, out _))
                return new DosResult(0, null, "MongoDB 物理扫描条件无效。");
            var filters = new List<FilterDefinition<dynamic>>();
            if (where != null) GetWhereSql(where, filters);
            var registry = BsonSerializer.SerializerRegistry;
            FilterDefinition<BsonDocument> sourceFilter = filters.Count == 0 ? new BsonDocument()
                : Builders<dynamic>.Filter.And(filters).Render(new RenderArgs<dynamic>(registry.GetSerializer<dynamic>(), registry));
            var baseDatabase = databasePrefix + "_" + tenant.ToLowerInvariant();
            var scope = EncryptHelper.SHA256(tenant + "|physical|" + databasePrefix + "|" + tablePrefix + "|" + (where?.ToString(Formatting.None) ?? "ALL"));
            var host = new MongodbHost
            {
                Connection = OsClient.GetClient(tenant).OsClientModel["DbMongoConnection"].Val<string>(), DataBase = baseDatabase
            };
            var client = MongodbClient<BsonDocument>.MongodbDatabase(host).Client;
            var directory = ReadPhysicalPageDirectory(client, baseDatabase, tablePrefix, cancellation);
            var directoryHash = PhysicalPageDirectoryHash(directory);
            var expectedHash = input.Value<string>("DirectoryHash");
            if (!string.IsNullOrEmpty(expectedHash) && expectedHash != directoryHash)
                return new DosResult(0, null, "MongoDB 物理目录已改变，不能继续旧扫描。");
            var partition = 0;
            ObjectId? after = null;
            var cursorText = input.Value<string>("Cursor");
            if (!string.IsNullOrEmpty(cursorText) && !ParsePhysicalPageCursor(cursorText, scope, directoryHash, directory.Count, out partition, out after))
                return new DosResult(0, null, "MongoDB 物理游标不属于当前查询或目录已改变。");
            var rows = new List<BsonDocument>();
            var scanned = 0;
            while (partition < directory.Count && scanned < budget && rows.Count < size)
            {
                cancellation.ThrowIfCancellationRequested();
                var location = directory[partition];
                var collection = client.GetDatabase(location.Database).GetCollection<BsonDocument>(location.Table);
                // Min 是 _id 索引的 BSON 总序下界；不能只用 ObjectId 的 $gt 类型括号，
                // 否则分页后可能永久漏过较高 BSON 类型的非法 _id，错误宣告全量扫描完成。
                var options = new FindOptions { MaxTime = TimeSpan.FromSeconds(10), Hint = "_id_" };
                var filter = sourceFilter;
                if (after.HasValue)
                {
                    options.Min = new BsonDocument("_id", after.Value);
                    filter &= Builders<BsonDocument>.Filter.Ne("_id", after.Value);
                }
                var capacity = size - rows.Count;
                var page = collection.Find(filter, options).Sort(Builders<BsonDocument>.Sort.Ascending("_id"))
                    .Limit(capacity + 1).Project<BsonDocument>(Builders<BsonDocument>.Projection.Exclude("_t")).ToList(cancellation);
                scanned++;
                foreach (var row in page)
                    if (!row.TryGetValue("_id", out var id) || !id.IsObjectId)
                        return new DosResult(0, null, "MongoDB 物理分区包含不支持的 _id，扫描未完成。");
                foreach (var row in page.Take(capacity))
                {
                    row["_PartitionDb"] = location.Database;
                    row["_PartitionTable"] = location.Table;
                    rows.Add(row);
                    after = row["_id"].AsObjectId;
                }
                if (page.Count > capacity) break;
                partition++;
                after = null;
            }
            // 一次调用中发生目录变化也拒绝整批；没有发出部分成功游标。
            if (directoryHash != PhysicalPageDirectoryHash(ReadPhysicalPageDirectory(client, baseDatabase, tablePrefix, cancellation)))
                return new DosResult(0, null, "MongoDB 物理目录在扫描期间改变，扫描未确认。");
            var hasMore = partition < directory.Count;
            var result = rows.Select(row => row.Elements.ToDictionary(field => field.Name, field => MapIndexedPageValue(field.Value))).ToList();
            return new DosResult(1, new
            {
                Rows = result, HasMore = hasMore,
                NextCursor = hasMore ? PhysicalPageCursor(scope, directoryHash, partition, after) : "",
                DirectoryHash = directoryHash, ScannedPartitions = scanned,
                TotalPartitions = directory.Count, FullPhysicalScope = where == null
            });
        }
    }
}

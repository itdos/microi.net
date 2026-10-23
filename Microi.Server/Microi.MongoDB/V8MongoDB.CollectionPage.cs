using System;
using System.Collections.Generic;
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
        // 通用元数据索引页：固定当前租户基础库，业务表名/索引字段由可信 V8 代码选择。
        // 只接受完整的索引等值前缀，避免有百万行时退回每页 Count 或无界残余条件扫描。
        private static bool ParseCollectionPageWhere(JToken where, string[] fields)
        {
            if (!(where is JArray conditions) || conditions.Count != fields.Length) return false;
            var seen = new HashSet<string>(StringComparer.Ordinal);
            foreach (var token in conditions)
            {
                if (!(token is JArray item) || item.Count != 3 || item[0].Type != JTokenType.String
                    || item[1].Type != JTokenType.String || item.Value<string>(1) != "="
                    || !fields.Contains(item.Value<string>(0)) || !seen.Add(item.Value<string>(0))) return false;
                var kind = item[2].Type;
                if (kind != JTokenType.String && kind != JTokenType.Integer && kind != JTokenType.Boolean) return false;
                if (kind == JTokenType.String && item[2].Value<string>().Length > 1024) return false;
            }
            return seen.Count == fields.Length;
        }

        private static string CollectionPageIndexName(string[] fields, string sortField, bool countOnly)
        {
            var signature = string.Join("|", fields) + "|" + (countOnly ? "count" : sortField + "|_id");
            return "microi_collection_" + EncryptHelper.SHA256(signature).Substring(0, 24).ToLowerInvariant();
        }

        private static string EnsureCollectionPageIndex(IMongoCollection<BsonDocument> collection, string[] fields,
            string sortField, bool countOnly, CancellationToken cancellation)
        {
            var name = CollectionPageIndexName(fields, sortField, countOnly);
            var keys = fields.Select(field => Builders<BsonDocument>.IndexKeys.Ascending(field)).ToList();
            if (!countOnly)
            {
                keys.Add(Builders<BsonDocument>.IndexKeys.Descending(sortField));
                keys.Add(Builders<BsonDocument>.IndexKeys.Descending("_id"));
            }
            collection.Indexes.CreateOne(new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Combine(keys),
                new CreateIndexOptions { Name = name }), cancellationToken: cancellation);
            return name;
        }

        /// <summary>
        /// 可信当前租户元数据集合的索引游标分页。文本排序键加 _id 倒序，普通页不计数；
        /// CountOnly 单独执行索引计数。业务鉴权、目录状态和双存储一致性仍由接口引擎保证。
        /// </summary>
        private DosResult GetIndexedCollectionPage(JObject input, CancellationToken cancellation)
        {
            var tenant = ResolveV8MongoTenant(input.Value<string>("OsClient"));
            var databasePrefix = input.Value<string>("DatabasePrefix");
            var table = input.Value<string>("TableName");
            var size = input.Value<int?>("PageSize") ?? 30;
            var countOnly = input.Value<bool?>("CountOnly") == true;
            var ensureIndex = input.Value<bool?>("EnsureIndex") == true;
            using var managedIndexMutation = ensureIndex ? ManagedStorageAdmissionRuntime.BeginMutation() : null;
            var sortField = input.Value<string>("SortField") ?? "";
            var fields = (input["IndexFields"] as JArray)?.Select(value => value.Type == JTokenType.String ? value.Value<string>() : "").ToArray() ?? Array.Empty<string>();
            bool SafeField(string value) => value != null && Regex.IsMatch(value, "^[A-Za-z][A-Za-z0-9_]{0,63}$");
            if (string.IsNullOrWhiteSpace(tenant) || !Regex.IsMatch(tenant, "^[A-Za-z0-9_-]{1,80}$")
                || !IsPartitionPrefix(databasePrefix) || !IsPartitionPrefix(table)
                || size < 1 || size > 100 || fields.Length < 1 || fields.Length > 4
                || fields.Any(value => !SafeField(value)) || fields.Distinct().Count() != fields.Length
                || (!countOnly && (!SafeField(sortField) || fields.Contains(sortField)))
                || input["_WhereAny"] != null || !ParseCollectionPageWhere(input["_Where"], fields)
                || ((countOnly || ensureIndex) && !string.IsNullOrEmpty(input.Value<string>("Cursor"))))
                return new DosResult(0, null, "MongoDB 索引集合页必须使用完整等值索引前缀和有效分页参数。");

            var where = input["_Where"];
            var scope = EncryptHelper.SHA256(tenant + "|collection|" + databasePrefix + "|" + table + "|"
                + sortField + "|" + string.Join("|", fields) + "|" + where.ToString(Formatting.None));
            string lastKey = null;
            ObjectId lastId = ObjectId.Empty;
            var cursorText = input.Value<string>("Cursor");
            if (!string.IsNullOrEmpty(cursorText))
            {
                if (cursorText.Length > 4096) return new DosResult(0, null, "MongoDB 索引集合游标过长。");
                JObject cursor;
                try
                {
                    cursor = JsonConvert.DeserializeObject<JObject>(cursorText, new JsonSerializerSettings
                    { DateParseHandling = DateParseHandling.None, MaxDepth = 4 });
                    if (cursor == null || cursor.Value<int?>("v") != 1 || cursor.Value<string>("mode") != "collection"
                        || cursor.Value<string>("scope") != scope || cursor["key"]?.Type != JTokenType.String
                        || cursor.Value<string>("key").Length > 1024
                        || !ObjectId.TryParse(cursor.Value<string>("id"), out lastId))
                        return new DosResult(0, null, "MongoDB 索引集合游标不属于当前查询。");
                    lastKey = cursor.Value<string>("key");
                }
                catch (Exception error) when (error is JsonException || error is ArgumentException || error is FormatException || error is OverflowException)
                { return new DosResult(0, null, "MongoDB 索引集合游标无效。"); }
            }
            var filters = new List<FilterDefinition<dynamic>>();
            GetWhereSql(where, filters);
            var registry = BsonSerializer.SerializerRegistry;
            FilterDefinition<BsonDocument> filter = Builders<dynamic>.Filter.And(filters)
                .Render(new RenderArgs<dynamic>(registry.GetSerializer<dynamic>(), registry));
            var host = new MongodbHost
            {
                Connection = OsClient.GetClient(tenant).OsClientModel["DbMongoConnection"].Val<string>(),
                DataBase = databasePrefix + "_" + tenant.ToLowerInvariant(), Table = table
            };
            var collection = MongodbClient<BsonDocument>.MongodbDatabase(host).GetCollection<BsonDocument>(table);
            // 迁移准备阶段显式预建索引；普通读只 Hint 已存在索引，缺失即失败。
            // 不把首次页面访问变成百万行索引构建，也不以节点内缓存作为索引存在证明。
            if (ensureIndex)
            {
                var prepared = EnsureCollectionPageIndex(collection, fields, sortField, countOnly, cancellation);
                return new DosResult(1, new { IndexReady = true, IndexName = prepared, PageKind = "Collection" });
            }
            var indexName = CollectionPageIndexName(fields, sortField, countOnly);
            if (countOnly)
            {
                var count = collection.CountDocuments(filter,
                    new CountOptions { Hint = indexName, MaxTime = TimeSpan.FromSeconds(10) }, cancellation);
                return new DosResult(1, new { Count = count, PageKind = "Collection" });
            }
            if (lastKey != null)
                filter &= Builders<BsonDocument>.Filter.Or(Builders<BsonDocument>.Filter.Lt(sortField, lastKey),
                    Builders<BsonDocument>.Filter.And(Builders<BsonDocument>.Filter.Eq(sortField, lastKey), Builders<BsonDocument>.Filter.Lt("_id", lastId)));
            var page = collection.Find(filter, new FindOptions { Hint = indexName, MaxTime = TimeSpan.FromSeconds(10) })
                .Sort(Builders<BsonDocument>.Sort.Descending(sortField).Descending("_id"))
                .Limit(size + 1).Project<BsonDocument>(Builders<BsonDocument>.Projection.Exclude("_t")).ToList(cancellation);
            if (page.Any(row => !row.TryGetValue("_id", out var id) || !id.IsObjectId
                || !row.TryGetValue(sortField, out var key) || !key.IsString || key.AsString.Length > 1024))
                return new DosResult(0, null, "MongoDB 索引集合含无效排序键，分页未确认。");
            var selected = page.Take(size).ToList();
            var last = selected.LastOrDefault();
            var hasMore = page.Count > size;
            var result = selected.Select(row => row.Elements.ToDictionary(field => field.Name, field => MapIndexedPageValue(field.Value))).ToList();
            return new DosResult(1, new
            {
                Rows = result, HasMore = hasMore, PageKind = "Collection",
                NextCursor = hasMore && last != null ? JsonConvert.SerializeObject(new
                { v = 1, mode = "collection", scope, key = last[sortField].AsString, id = last["_id"].AsObjectId.ToString() }) : ""
            });
        }
    }
}

using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MongoDB.Bson;
using MongoDB.Driver;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace Microi.net
{
    public partial class V8MongoDB : IMemoryIncidentRepository
    {
        private static IMongoCollection<BsonDocument> MemoryCollection(string tenant)
        {
            var host = CreateTenantMongoHost(tenant, "memory_incidents");
            return MongodbClient<SysLog>.MongodbDatabase(host).GetCollection<BsonDocument>("memory_incidents");
        }

        public async Task SaveAsync(string tenant, JObject incident, CancellationToken cancellationToken)
        {
            var id = incident.Value<string>("Id");
            if (!Guid.TryParseExact(id, "N", out _) || !string.Equals(incident.Value<string>("Tenant"), tenant, StringComparison.OrdinalIgnoreCase))
                throw new ArgumentException("Invalid incident identity or tenant.");
            var json = incident.ToString(Formatting.None);
            if (json.Length > 2 * 1024 * 1024) throw new ArgumentException("Incident exceeds diagnostic storage budget.");
            var collection = MemoryCollection(tenant);
            // MongoDB's _id is the idempotency key across nodes and local-WAL replay.
            // Repeating identical index creation is safe after restart/concurrent startup.
            await collection.Indexes.CreateManyAsync(new[]
            {
                new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Ascending("ExpiresAtUtc"),
                    new CreateIndexOptions { Name = "memory_incident_ttl", ExpireAfter = TimeSpan.Zero }),
                new CreateIndexModel<BsonDocument>(Builders<BsonDocument>.IndexKeys.Descending("OccurredAtUtc"),
                    new CreateIndexOptions { Name = "memory_incident_time" })
            }, cancellationToken: cancellationToken).ConfigureAwait(false);
            var date = incident.Value<DateTime>("OccurredAtUtc").ToUniversalTime();
            var updated = incident.Value<DateTime>("UpdatedAtUtc").ToUniversalTime();
            var document = new BsonDocument
            {
                ["_id"] = id, ["Tenant"] = tenant.ToLowerInvariant(), ["OccurredAtUtc"] = date,
                ["UpdatedAtUtc"] = updated,
                ["ExpiresAtUtc"] = date.AddDays(14), ["Payload"] = json,
                ["Summary"] = MemoryIncidentSummary(incident).ToString(Formatting.None)
            };
            // 多节点可能重放同一 WAL；旧快照只能被忽略，不能覆盖较新的栈和恢复状态。
            var filter = Builders<BsonDocument>.Filter.Eq("_id", id)
                & (Builders<BsonDocument>.Filter.Lte("UpdatedAtUtc", updated)
                    | Builders<BsonDocument>.Filter.Exists("UpdatedAtUtc", false));
            try
            {
                await collection.ReplaceOneAsync(filter, document, new ReplaceOptions { IsUpsert = true }, cancellationToken).ConfigureAwait(false);
            }
            catch (MongoWriteException ex) when (ex.WriteError?.Category == ServerErrorCategory.DuplicateKey)
            {
                // _id 已存在且版本更新：旧重放视为幂等成功。
            }
        }

        public async Task<IReadOnlyList<JObject>> ListAsync(string tenant, int take, CancellationToken cancellationToken)
        {
            var rows = await MemoryCollection(tenant).Find(Builders<BsonDocument>.Filter.Eq("Tenant", tenant.ToLowerInvariant()))
                .Sort(Builders<BsonDocument>.Sort.Descending("OccurredAtUtc")).Limit(Math.Max(1, Math.Min(50, take)))
                .Project(Builders<BsonDocument>.Projection.Include("Summary")).ToListAsync(cancellationToken).ConfigureAwait(false);
            return rows.Select(row => JObject.Parse(row["Summary"].AsString)).ToList();
        }

        public async Task<JObject> GetAsync(string tenant, string incidentId, CancellationToken cancellationToken)
        {
            if (!Guid.TryParseExact(incidentId, "N", out _)) return null;
            var filter = Builders<BsonDocument>.Filter.Eq("_id", incidentId)
                & Builders<BsonDocument>.Filter.Eq("Tenant", tenant.ToLowerInvariant());
            var row = await MemoryCollection(tenant).Find(filter).FirstOrDefaultAsync(cancellationToken).ConfigureAwait(false);
            return row == null ? null : JObject.Parse(row["Payload"].AsString);
        }

        public async Task<JObject> GetMemoryStatusAsync(string tenant, CancellationToken cancellationToken)
        {
            var host = CreateTenantMongoHost(tenant, "memory_incidents");
            var database = MongodbClient<SysLog>.MongodbDatabase(host);
            var result = new JObject { ["SampledAtUtc"] = DateTime.UtcNow, ["Scope"] = "Mongo server process plus current tenant log database; disk sizes are not RAM." };
            try
            {
                var status = await database.RunCommandAsync<BsonDocument>(new BsonDocument
                {
                    // MongoDB 5.x 的 metrics:0 同时隐藏 mem，必须保留默认指标才能读取真实驻留内存。
                    ["serverStatus"] = 1, ["tcmalloc"] = 0, ["locks"] = 0,
                    ["opcounters"] = 0, ["network"] = 0, ["maxTimeMS"] = 1000
                }, cancellationToken: cancellationToken).ConfigureAwait(false);
                result["ResidentBytes"] = MongoNumber(status, "mem", "resident") * 1024 * 1024;
                result["VirtualBytes"] = MongoNumber(status, "mem", "virtual") * 1024 * 1024;
                result["WiredTigerCacheBytes"] = MongoNumber(status, "wiredTiger", "cache", "bytes currently in the cache");
                result["WiredTigerCacheLimitBytes"] = MongoNumber(status, "wiredTiger", "cache", "maximum bytes configured");
                result["ConnectionsCurrent"] = MongoNumber(status, "connections", "current");
                result["ServerStatusAvailable"] = true;
            }
            catch (Exception ex) { result["ServerStatusAvailable"] = false; result["ServerStatusError"] = ex.GetType().Name; }
            try
            {
                var stats = await database.RunCommandAsync<BsonDocument>(new BsonDocument { ["dbStats"] = 1, ["scale"] = 1, ["maxTimeMS"] = 1000 }, cancellationToken: cancellationToken).ConfigureAwait(false);
                result["LogDataBytes"] = MongoNumber(stats, "dataSize");
                result["LogStorageBytes"] = MongoNumber(stats, "storageSize");
                result["LogIndexBytes"] = MongoNumber(stats, "indexSize");
            }
            catch (Exception ex) { result["DatabaseStatsError"] = ex.GetType().Name; }
            return result;
        }
        private static long? MongoNumber(BsonDocument document, params string[] path)
        {
            BsonValue value = document;
            foreach (var key in path)
            {
                if (!value.IsBsonDocument || !value.AsBsonDocument.TryGetValue(key, out var next)) return null;
                value = next;
            }
            return value.IsNumeric ? (long)value.ToDouble() : (long?)null;
        }

        private static JObject MemoryIncidentSummary(JObject incident) => new JObject(
            new[] { "Id", "Tenant", "BootId", "NodeId", "OccurredAtUtc", "UpdatedAtUtc", "Trigger", "Status", "PeakRssBytes", "BuildVersion", "Evidence" }
                .Where(key => incident[key] != null).Select(key => new JProperty(key, incident[key].DeepClone())));
    }
}

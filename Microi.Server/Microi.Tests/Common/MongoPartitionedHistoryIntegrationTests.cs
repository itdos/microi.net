using Dos.ORM;
using Microi.net;
using MongoDB.Bson;
using MongoDB.Driver;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

/// <summary>真实存储回归：复用测试 Mongo 服务，每次只拥有随机租户和显式创建的数据库。</summary>
public sealed class MongoPartitionedHistoryIntegrationTests
{
    [Fact, Trait("Category", "FullStack")]
    public async Task RealMongo_CrossYearMonthOverlapEmptyMonthAndStableCursor()
    {
        var connection = Environment.GetEnvironmentVariable("MICROI_TEST_MONGO_CURRENT");
        Assert.False(string.IsNullOrWhiteSpace(connection), "真实历史分页验收需要 MICROI_TEST_MONGO_CURRENT 测试服务。");
        using var deadline = new CancellationTokenSource(TimeSpan.FromSeconds(90));
        var settings = MongoClientSettings.FromConnectionString(connection);
        settings.ServerSelectionTimeout = TimeSpan.FromSeconds(5);
        using var client = new MongoClient(settings);
        var nonce = Guid.NewGuid().ToString("N");
        var tenant = "mci_hist_" + nonce;
        var foreign = "mci_hist_" + Guid.NewGuid().ToString("N");
        var baseDb = "diy_chat_" + tenant;
        var databases = new[] { baseDb, baseDb + "_2025", baseDb + "_2026", "diy_chat_" + foreign + "_2026" };
        var owned = new List<string>();
        var registered = new List<(string Tenant, OsClientSecret Client)>();
        try
        {
            foreach (var name in databases)
            {
                // 不使用已有同名库；仅在明确创建成功后登记所有权，失败不猜测删除目标。
                using var existing = await client.ListDatabaseNamesAsync(new ListDatabaseNamesOptions { Filter = new BsonDocument("name", name) }, deadline.Token);
                Assert.Empty(await existing.ToListAsync(deadline.Token));
                var database = client.GetDatabase(name);
                await database.CreateCollectionAsync("_mci_history_test_owner", cancellationToken: deadline.Token);
                owned.Add(name);
                await database.GetCollection<BsonDocument>("_mci_history_test_owner").InsertOneAsync(new BsonDocument("_id", nonce), cancellationToken: deadline.Token);
            }
            foreach (var name in new[] { tenant, foreign })
            {
                var unusedSql = new DbSession(DatabaseType.MySql, "Server=127.0.0.1;Port=1;Database=unused;User ID=unused;");
                var config = new OsClientSecret { OsClient = name, Db = unusedSql, DbRead = unusedSql,
                    OsClientModel = new JObject { ["Id"] = name, ["DbMongoConnection"] = connection } };
                Assert.True(OsClient.ClientList.TryAdd(name, config));
                registered.Add((name, config));
            }

            var expected = new List<BsonDocument>();
            BsonDocument Message(int id, int year, int month, int day) => new() {
                ["_id"] = ObjectId.Parse(id.ToString("x24")), ["CreateTime"] = new DateTime(year, month, day, 12, 0, 0, DateTimeKind.Utc),
                ["GroupId"] = "allowed-group", ["Text"] = "fixture-" + id
            };
            async Task Put(string database, string table, IEnumerable<BsonDocument> documents, bool authoritative = true)
            {
                var list = documents.Select(doc => doc.DeepClone().AsBsonDocument).ToList();
                await client.GetDatabase(database).GetCollection<BsonDocument>(table).InsertManyAsync(list, cancellationToken: deadline.Token);
                if (authoritative) expected.AddRange(list);
            }
            await Put(baseDb + "_2026", "chat_202603", Enumerable.Range(1, 6).Select(id => Message(id, 2026, 3, 12)));
            await client.GetDatabase(baseDb + "_2026").CreateCollectionAsync("chat_202602", cancellationToken: deadline.Token);
            await Put(baseDb + "_2026", "chat_202601", new[] { Message(7, 2026, 1, 31), Message(8, 2026, 1, 1) });
            var duplicate = Message(9, 2025, 12, 31);
            await Put(baseDb + "_2025", "chat_202512", new[] { duplicate, Message(10, 2025, 12, 12) });
            await Put(baseDb, "chat_2025", new[] { duplicate }, false);
            await Put(baseDb, "chat_2025", new[] { Message(11, 2025, 12, 1) });
            await Put("diy_chat_" + foreign + "_2026", "chat_202603", new[] { Message(12, 2026, 3, 13) }, false);
            var denied = Message(13, 2026, 3, 13); denied["GroupId"] = "another-group";
            await Put(baseDb + "_2026", "chat_202603", new[] { denied }, false);
            var expectedIds = expected.OrderByDescending(doc => doc["CreateTime"].ToUniversalTime()).ThenByDescending(doc => doc["_id"].AsObjectId).Select(doc => doc["_id"].ToString()).ToArray();
            var mongo = new V8MongoDB();
            JObject Query(int size, string cursor = "") => new() {
                ["DatabasePrefix"] = "diy_chat", ["TablePrefix"] = "chat", ["PageSize"] = size, ["MaxPartitions"] = 64,
                ["IndexFields"] = new JArray("GroupId"), ["_Where"] = new JArray { new JArray("GroupId", "=", "allowed-group") }, ["Cursor"] = cursor
            };
            JObject Read(JObject query)
            {
                var response = mongo.GetPartitionedTableData(query);
                Assert.True(response.Code == 1, response.Msg);
                return JObject.FromObject(response.Data);
            }
            using (V8TenantContext.Enter(tenant, "history-real-test", "test"))
            {
                foreach (var pageSize in new[] { 1, 2, 3, 4 })
                {
                    var cursor = "";
                    var seen = new List<string>();
                    var cursors = new HashSet<string>();
                    for (var page = 0; page < 30; page++)
                    {
                        var data = Read(Query(pageSize, cursor));
                        var rows = (JArray)data["Rows"]!;
                        Assert.InRange(rows.Count, 0, pageSize);
                        Assert.All(rows, row => Assert.Equal("allowed-group", row.Value<string>("GroupId")));
                        var ids = rows.Select(row => row.Value<string>("_id")!).ToArray();
                        Assert.Equal(ids, ((JArray)Read(Query(pageSize, cursor))["Rows"]!).Select(row => row.Value<string>("_id")!).ToArray());
                        seen.AddRange(ids);
                        if (!data.Value<bool>("HasMore")) break;
                        cursor = data.Value<string>("NextCursor")!;
                        Assert.False(string.IsNullOrEmpty(cursor)); Assert.True(cursors.Add(cursor), "历史游标未前进。");
                        Assert.True(page < 29, "历史分页未结束。");
                    }
                    Assert.Equal(expectedIds, seen);
                    Assert.Equal(seen.Count, seen.Distinct().Count());
                }

                var first = Read(Query(2));
                var firstCursor = first.Value<string>("NextCursor")!;
                var anotherGroup = Query(2, firstCursor); anotherGroup["_Where"] = new JArray { new JArray("GroupId", "=", "another-group") };
                Assert.Equal(0, mongo.GetPartitionedTableData(anotherGroup).Code);
                var forged = JObject.Parse(firstCursor); forged["id"] = "not-an-objectid";
                Assert.Equal(0, mongo.GetPartitionedTableData(Query(2, forged.ToString())).Code);
                Assert.Equal(0, mongo.GetPartitionedTableData(Query(101)).Code);
                var deniedScope = Query(2, firstCursor); deniedScope["OsClient"] = foreign;
                // 既有 V8 隔离契约是强制替换回当前租户，不把客户端 OsClient 当作授权。
                Assert.Equal(Read(Query(2, firstCursor)).ToString(), Read(deniedScope).ToString());
                using (V8TenantContext.Enter(foreign, "history-other-test", "test"))
                {
                    Assert.Equal(0, mongo.GetPartitionedTableData(Query(2, firstCursor)).Code);
                    var otherRows = (JArray)Read(Query(2))["Rows"]!;
                    Assert.Single(otherRows); Assert.Equal("fixture-12", otherRows[0].Value<string>("Text"));
                }
            }
        }
        finally
        {
            foreach (var item in registered)
            {
                Assert.True(OsClient.ClientList.TryRemove(item.Tenant, out var removed));
                Assert.Same(item.Client, removed);
            }
            using var cleanup = new CancellationTokenSource(TimeSpan.FromSeconds(20));
            foreach (var name in owned)
            {
                Assert.Contains(name, databases);
                var marker = await client.GetDatabase(name).GetCollection<BsonDocument>("_mci_history_test_owner")
                    .Find(new BsonDocument("_id", nonce)).FirstOrDefaultAsync(cleanup.Token);
                Assert.NotNull(marker); // 所有权回读失败保留库供排查，不删除未知目标。
                await client.DropDatabaseAsync(name, cleanup.Token);
            }
        }
    }
}

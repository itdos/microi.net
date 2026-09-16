using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;
using Microi.net;
using MongoDB.Bson;
using MongoDB.Driver;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public class MongoCompatibilitySourceTests
{
    [Fact]
    public void CompatibilityBuild_RetainsPatchedUpstreamAndOnlyChangesTheMinimumProtocol()
    {
        var root = new DirectoryInfo(AppContext.BaseDirectory);
        while (root != null && !Directory.Exists(Path.Combine(root.FullName, "Microi.Server", "ThirdParty"))) root = root.Parent;
        Assert.NotNull(root);
        var directory = Path.Combine(root.FullName, "Microi.Server", "ThirdParty", "MongoDB.Driver");
        var manifest = JObject.Parse(File.ReadAllText(Path.Combine(directory, "provenance.json")));
        var archive = Path.Combine(directory, "upstream-3.11.2.source.zip");
        Assert.Equal(manifest["sourceArchiveSha256"]!.ToString(), Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(archive))).ToLowerInvariant());
        using var zip = ZipFile.OpenRead(archive);
        using var reader = new StreamReader(zip.GetEntry("MongoDB.Driver/Core/Misc/WireVersion.cs")!.Open());
        var original = reader.ReadToEnd().Replace("\r\n", "\n");
        var patched = File.ReadAllText(Path.Combine(directory, "WireVersion.Compatibility.cs")).Replace("\r\n", "\n");
        patched = string.Join("\n", patched.Split('\n').Where(line => !line.TrimStart().StartsWith("// Microi 兼容补丁：")));
        Assert.Equal(original.Replace("minWireVersion: Server44", "minWireVersion: Server36"), patched);
        Assert.Equal(new Version(3, 11, 2, 0), typeof(MongoClient).Assembly.GetName().Version);
        Assert.Contains("microi-legacy1", typeof(MongoClient).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()!.InformationalVersion);
        Assert.Equal(3, typeof(BsonDocument).Assembly.GetName().Version!.Major);
    }
}

[Collection("TenantContextGlobal")]
[Trait("Category", "FullStack")]
public class MongoLegacyCompatibilityTests
{
    [Theory]
    [InlineData("MICROI_TEST_MONGO_LEGACY", "3.6.")]
    [InlineData("MICROI_TEST_MONGO_CURRENT", "7.")]
    public async Task RealServers_Authenticate_PersistLogsOnce_PageWithoutDuplicates_AndIsolateTenants(string variable, string expectedVersion)
    {
        var connection = Environment.GetEnvironmentVariable(variable);
        Assert.False(string.IsNullOrWhiteSpace(connection), $"缺少隔离 MongoDB 兼容矩阵夹具 {variable}");
        var url = new MongoUrl(connection);
        Assert.All(url.Servers, server => Assert.Contains(server.Host, new[] { "127.0.0.1", "localhost" }));
        var settings = MongoClientSettings.FromUrl(url);
        settings.ServerSelectionTimeout = TimeSpan.FromSeconds(3);
        using var client = new MongoClient(settings);
        var version = await client.GetDatabase("admin").RunCommandAsync<BsonDocument>(new BsonDocument("buildInfo", 1), cancellationToken: TestContext.Current.CancellationToken);
        Assert.StartsWith(expectedVersion, version["version"].AsString);
        var firstTenant = "compat_" + Guid.NewGuid().ToString("N");
        var otherTenant = "compat_" + Guid.NewGuid().ToString("N");
        // GetClient 要求租户的两个 ORM 对象已初始化。本夹具不访问关系库，端口 1 确保误走 SQL 会失败。
        var unusedSql = new Dos.ORM.DbSession(Dos.ORM.DatabaseType.MySql, "Server=127.0.0.1;Port=1;Database=unopened;Uid=unused;Pwd=unused;SslMode=Disabled");
        foreach (var tenant in new[] { firstTenant, otherTenant })
            OsClientExtend.ClientList[tenant] = new OsClientSecret { OsClient = tenant, Db = unusedSql, DbRead = unusedSql, OsClientModel = new JObject { ["DbMongoConnection"] = connection } };
        var mongo = new V8MongoDB();
        var date = new DateTime(2026, 9, 15, 1, 2, 3, DateTimeKind.Utc);
        SysLogParam Entry(string tenant, string id, string job) => new()
        {
            OsClient = tenant, EventId = id, OccurredAt = date, TargetType = ScheduleExecutionLog.TargetType,
            TargetId = job, Source = "Quartz", Category = "JobExecution", Content = "中文日志", Success = true
        };
        try
        {
            var entries = Enumerable.Range(0, 45).Select(i => Entry(firstTenant, i.ToString("D4"), "job-a")).ToArray();
            for (var retry = 0; retry < 2; retry++)
            {
                var saved = await mongo.AddSysLogs(entries);
                Assert.True(saved.Code == 1, saved.Msg);
            }
            Assert.Equal(1, (await mongo.AddSysLogs(new[] { Entry(firstTenant, "unrelated", "job-b"), Entry(otherTenant, "foreign", "job-a") })).Code);
            var collection = client.GetDatabase("sys_log_" + firstTenant).GetCollection<BsonDocument>("log_202609");
            Assert.Equal(46, await collection.CountDocumentsAsync(FilterDefinition<BsonDocument>.Empty, cancellationToken: TestContext.Current.CancellationToken));
            var seen = new List<string>();
            DateTime? before = null; string? beforeId = null;
            for (var page = 0; page < 4; page++)
            {
                var result = await mongo.GetSysLog(new SysLogParam { OsClient = firstTenant, TargetType = ScheduleExecutionLog.TargetType, TargetId = "job-a", _SearchMonth = "202609", _PageSize = 20, BeforeLogTime = before, BeforeLogId = beforeId });
                Assert.True(result.Code == 1, result.Msg);
                var rows = Assert.IsAssignableFrom<IEnumerable<SysLog>>(result.Data).ToList();
                seen.AddRange(rows.Select(row => row.EventId));
                var append = JObject.FromObject((object)result.DataAppend);
                Assert.False(append["ExactTotal"]!.Value<bool>());
                if (!append["HasMore"]!.Value<bool>()) break;
                before = rows.Last().CreateTime; beforeId = rows.Last().EventId;
            }
            Assert.Equal(45, seen.Count); Assert.Equal(45, seen.Distinct().Count());
            Assert.DoesNotContain("foreign", seen); Assert.DoesNotContain("unrelated", seen);
            var oldMonth = await mongo.GetSysLog(new SysLogParam { OsClient = firstTenant, TargetType = ScheduleExecutionLog.TargetType, TargetId = "job-a", _SearchMonth = "202608", _PageSize = 20 });
            Assert.Equal(1, oldMonth.Code); Assert.Empty(oldMonth.Data);
            // 同时覆盖通用驱动 update/delete/list 路径，不能只验证 ping。
            await collection.UpdateOneAsync(new BsonDocument("_id", "0000"), Builders<BsonDocument>.Update.Set("Content", "已更新"), cancellationToken: TestContext.Current.CancellationToken);
            Assert.Equal("已更新", (await collection.Find(new BsonDocument("_id", "0000")).SingleAsync(TestContext.Current.CancellationToken))["Content"].AsString);
            Assert.Equal(1, (await collection.DeleteOneAsync(new BsonDocument("_id", "unrelated"), TestContext.Current.CancellationToken)).DeletedCount);
            Assert.Contains("log_202609", await (await client.GetDatabase("sys_log_" + firstTenant).ListCollectionNamesAsync(cancellationToken: TestContext.Current.CancellationToken)).ToListAsync(TestContext.Current.CancellationToken));
        }
        finally
        {
            foreach (var tenant in new[] { firstTenant, otherTenant })
            {
                OsClientExtend.ClientList.TryRemove(tenant, out _);
                await client.DropDatabaseAsync("sys_log_" + tenant, TestContext.Current.CancellationToken);
            }
        }
    }
}

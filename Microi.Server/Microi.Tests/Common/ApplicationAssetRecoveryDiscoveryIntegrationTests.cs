using System.Data.Common;
using System.Reflection;
using Dos.ORM;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Dos.Common.Tests;

[Collection("TenantContextGlobal")]
[Trait("Category", "FullStack")]
public class ApplicationAssetRecoveryDiscoveryIntegrationTests
{
    private static string? Connection => Environment.GetEnvironmentVariable("MICROI_UPGRADE_TEST_CONN")
        ?? Environment.GetEnvironmentVariable("XQC_TEST_MYSQL_CONN");
    public static bool HasConnection => !string.IsNullOrWhiteSpace(Connection);

    [Fact(Skip = "Requires an isolated local MySQL upgrade_fixture or xqc_verify connection", SkipUnless = nameof(HasConnection))]
    public async Task LegacyMetadataCannotHidePendingReleasesBehindHistoricalVersions()
    {
        var connection = Connection!;
        var parts = new DbConnectionStringBuilder { ConnectionString = connection };
        Assert.Equal("127.0.0.1", parts["Server"]);
        var databaseName = Convert.ToString(parts["Database"]);
        Assert.InRange(Convert.ToInt32(parts["Port"]), 1, 65535);
        Assert.True(databaseName == "upgrade_fixture" || databaseName == "xqc_verify", "Refusing a non-isolated database");
        databaseName = "microi_asset_fixture_" + Guid.NewGuid().ToString("N");
        parts["Database"] = "mysql";
        var master = new DbSession(DatabaseType.MySql, parts.ConnectionString);
        master.FromSql($"CREATE DATABASE `{databaseName}` CHARACTER SET utf8mb4").ExecuteNonQuery();
        parts["Database"] = databaseName;
        var db = new DbSession(DatabaseType.MySql, parts.ConnectionString);
        // 故意指向不存在的从库：候选发现若退回 DbRead，测试必须失败。
        parts["Database"] = databaseName + "_no_read";
        var replica = new DbSession(DatabaseType.MySql, parts.ConnectionString);
        var tenant = "assetfixture" + Guid.NewGuid().ToString("N");
        Assert.False(OsClientExtend.ClientList.ContainsKey(tenant));
        OsClientExtend.ClientList[tenant] = new OsClientSecret { OsClient = tenant, Db = db, DbRead = replica };
        try
        {
            db.FromSql("CREATE TABLE mci_ai_app_version (Id char(36) PRIMARY KEY, AppId varchar(50), VersionNo varchar(50), PublishProtocolVersion int, PublishState varchar(50), IsDeleted int NULL, CreateTime datetime, UpdateTime datetime NULL)").ExecuteNonQuery();
            db.FromSql("CREATE TABLE diy_field (Id varchar(36) PRIMARY KEY, TableName varchar(100), Name varchar(100))").ExecuteNonQuery();
            db.FromSql("INSERT INTO diy_field VALUES ('legacy-field','mci_ai_app_version','VersionNo')").ExecuteNonQuery();
            using (var transaction = db.BeginTransaction())
            {
                for (var offset = 0; offset < 4350; offset += 150)
                {
                    var ids = Enumerable.Range(offset, Math.Min(150, 4350 - offset)).ToArray();
                    var values = string.Join(",", ids.Select((_, i) => $"(@id{i},'old-app','v1.0.0',1,'Verifying',0,'2020-01-01',NULL)"));
                    var insert = transaction.FromSql("INSERT INTO mci_ai_app_version VALUES " + values);
                    for (var i = 0; i < ids.Length; i++) insert.AddInParameter("@id" + i, "legacy-" + ids[i]);
                    insert.ExecuteNonQuery();
                }
                transaction.Commit();
            }
            void Seed(string id, string state, int? deleted, string updated = "2026-09-07 01:23:22") => db.FromSql(
                    "INSERT INTO mci_ai_app_version VALUES (@id,'current-app','v3.0.1',3,@state,@deleted,'2026-09-07',@updated)")
                .AddInParameter("@id", id).AddInParameter("@state", state).AddInParameter("@deleted", deleted)
                .AddInParameter("@updated", DateTime.Parse(updated)).ExecuteNonQuery();
            Seed("candidate-00", "Verifying", 0);
            Seed("candidate-01", "PointerCommitted", null);
            Seed("candidate-02", "ProjectionPending", 0);
            Seed("candidate-03", "RepairRequired", 0);
            Seed("excluded-deleted", "Verifying", 1);
            foreach (var state in new[] { "Completed", "ReleaseVerified", "FailedBeforeCommit", "Archived", "VerifyingUnknown" })
                Seed("excluded-" + state, state, 0);

            async Task<List<JObject>> Read(string? currentTenant = null) => await (Task<List<JObject>>)typeof(V8McpLogic)
                .GetMethod("ReadApplicationAssetV3RecoveryCandidatesStrongAsync", BindingFlags.Static | BindingFlags.NonPublic)!
                .Invoke(null, new object[] { currentTenant ?? tenant, 50, CancellationToken.None })!;
            Assert.Equal(4350, Convert.ToInt32(db.FromSql("SELECT COUNT(*) FROM mci_ai_app_version WHERE PublishProtocolVersion=1").ToScalar()));
            Assert.Equal(0, Convert.ToInt32(db.FromSql("SELECT COUNT(*) FROM diy_field WHERE Name IN ('PublishProtocolVersion','PublishState')").ToScalar()));
            var first = await Read();
            Assert.Equal(new[] { "candidate-00", "candidate-01", "candidate-02", "candidate-03" }, first.Select(row => row.Value<string>("Id")));
            Assert.All(first, row => Assert.Equal("current-app", row.Value<string>("AppId")));
            Assert.Equal("Verifying", first[0].Value<string>("PublishState"));
            for (var i = 4; i < 80; i++) Seed($"candidate-{i:D2}", "Verifying", 0);
            var bounded = await Read();
            Assert.Equal(50, bounded.Count);
            Assert.Equal("candidate-49", bounded[^1].Value<string>("Id"));
            db.FromSql("UPDATE mci_ai_app_version SET UpdateTime='2026-09-08' WHERE Id='candidate-00'").ExecuteNonQuery();
            Assert.DoesNotContain(await Read(), row => row.Value<string>("Id") == "candidate-00");
            db.FromSql("UPDATE mci_ai_app_version SET PublishState='Completed' WHERE Id='candidate-01'").ExecuteNonQuery();
            Assert.DoesNotContain(await Read(), row => row.Value<string>("Id") == "candidate-01");
            await Assert.ThrowsAnyAsync<Exception>(() => Read("xqc-missing-tenant-must-not-use-default"));
        }
        finally
        {
            OsClientExtend.ClientList.TryRemove(tenant, out _);
            // Only the unique database created above belongs to this test.
            master.FromSql($"DROP DATABASE `{databaseName}`").ExecuteNonQuery();
        }
    }
}

using System.Data.SqlClient;
using Dos.ORM;
using Jint;
using Microi.net;
using Newtonsoft.Json;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
[Trait("Category", "FullStack")]
[Trait("DatabaseProvider", "SqlServer")]
public sealed class MarketplaceSqlServerNullIndexIntegrationTests
{
    public static bool HasSqlServerTestConnection => !string.IsNullOrWhiteSpace(
        Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN"));

    [Theory(Skip = "Requires an isolated SQL Server fixture", SkipUnless = nameof(HasSqlServerTestConnection))]
    [InlineData("single")]
    [InlineData("composite")]
    [InlineData("legacy")]
    [InlineData("conflict")]
    public void PackageUniqueIndex_UsesRealNullableSemantics_AndReplaysWithoutDdl(string scenario)
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN")!);
        SqlServerFixtureGuard.Verify(connection);
        // 仅复用已登记的专项连接；每个用例创建自身随机库，不对传入库或真实租户建表/清表。
        var databaseName = "microi_nullable_index_fixture_" + Guid.NewGuid().ToString("N");
        connection.InitialCatalog = "master";
        var master = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.SqlServer);
        master.FromSql($"CREATE DATABASE [{databaseName}]").ExecuteNonQuery();
        try
        {
            connection.InitialCatalog = databaseName;
            var database = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.SqlServer);
            database.FromSql("CREATE TABLE history (Id int NOT NULL PRIMARY KEY, Tenant varchar(40) NULL, RequestId varchar(40) NULL)").ExecuteNonQuery();
            var composite = scenario == "composite";
            var indexColumns = composite ? "Tenant,RequestId" : "RequestId";
            if (scenario == "legacy")
            {
                database.FromSql("INSERT INTO history VALUES (1,'a',NULL),(2,'a','retained'); CREATE UNIQUE INDEX ux_history ON history(RequestId)").ExecuteNonQuery();
                // 真实旧索引先证明会拒绝第二个 NULL；修复只重建索引，原业务行完整保留。
                Assert.ThrowsAny<Exception>(() => database.FromSql("INSERT INTO history VALUES (3,'a',NULL)").ExecuteNonQuery());
            }
            else if (scenario == "conflict")
            {
                database.FromSql("INSERT INTO history VALUES (1,'a','duplicate'),(2,'b','duplicate')").ExecuteNonQuery();
            }
            else
            {
                database.FromSql("INSERT INTO history VALUES (1,'a',NULL),(2,'a',NULL),(3,NULL,'key'),(4,NULL,'key')").ExecuteNonQuery();
                if (!composite)
                    database.FromSql("UPDATE history SET RequestId=NULL WHERE Id IN (3,4)").ExecuteNonQuery();
                Assert.ThrowsAny<Exception>(() => database.FromSql($"CREATE UNIQUE INDEX ux_history ON history({indexColumns})").ExecuteNonQuery());
            }
            var originalCount = database.FromSql("SELECT COUNT(*) FROM history").ToScalar<int>();
            using var engine = CreateImporter(database, composite);
            if (scenario == "conflict")
            {
                Assert.ThrowsAny<Exception>(() => engine.Invoke("installIndex"));
                Assert.Equal(originalCount, database.FromSql("SELECT COUNT(*) FROM history").ToScalar<int>());
                Assert.Equal(0, database.FromSql("SELECT COUNT(*) FROM sys.indexes WHERE object_id=OBJECT_ID('history') AND name='ux_history'").ToScalar<int>());
                return;
            }
            engine.Invoke("installIndex");
            Assert.Equal(originalCount, database.FromSql("SELECT COUNT(*) FROM history").ToScalar<int>());
            Assert.Equal(1, engine.GetValue("indexWrites").AsNumber());
            var filter = database.FromSql("SELECT filter_definition FROM sys.indexes WHERE object_id=OBJECT_ID('history') AND name='ux_history'").ToScalar<string>();
            Assert.Contains("[RequestId] IS NOT NULL", filter);
            if (composite) Assert.Contains("[Tenant] IS NOT NULL", filter);
            database.FromSql("INSERT INTO history VALUES (10,'a',NULL),(11,'a',NULL),(12,'a','non-null')").ExecuteNonQuery();
            Assert.ThrowsAny<Exception>(() => database.FromSql("INSERT INTO history VALUES (13,'a','non-null')").ExecuteNonQuery());
            if (composite)
                database.FromSql("INSERT INTO history VALUES (14,NULL,'same'),(15,NULL,'same'),(16,'b','non-null')").ExecuteNonQuery();
            engine.Invoke("installIndex");
            Assert.Equal(1, engine.GetValue("indexWrites").AsNumber());
            Assert.Equal(1, database.FromSql("SELECT COUNT(*) FROM sys.indexes WHERE object_id=OBJECT_ID('history') AND name='ux_history'").ToScalar<int>());
        }
        finally
        {
            // 名称仅由本用例固定前缀 + Guid 创建；异常路径也回收，绝不删除传入 fixture/租户库。
            master.FromSql($"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]").ExecuteNonQuery();
        }
    }

    private static Engine CreateImporter(DbSession database, bool composite)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        string? path = null;
        while (directory != null)
        {
            var candidate = Path.Combine(directory.FullName, "Microi.Server", "OfficialApplications", "Resource", "import-package.js");
            if (File.Exists(candidate)) { path = candidate; break; }
            directory = directory.Parent;
        }
        Assert.NotNull(path);
        var source = File.ReadAllText(path);
        string Extract(string start, string end)
        {
            var first = source.IndexOf(start, StringComparison.Ordinal);
            var last = source.IndexOf(end, first, StringComparison.Ordinal);
            Assert.True(first >= 0 && last > first, "Importer helper boundaries must exist");
            return source[first..last];
        }
        var item = new
        {
            TableName = "history",
            DDL = "CREATE UNIQUE INDEX `ux_history` ON `history` (" + (composite ? "`Tenant`," : "") + "`RequestId`);"
        };
        var engine = new Engine().SetValue("database", database).SetValue("declarations", JsonConvert.SerializeObject(new[] { item }));
        engine.Execute("""
            var runtimeIsSqlServer = true, indexWrites = 0;
            var allDdlStatements = JSON.parse(declarations);
            var isSafeIdentifier = function(name) { return /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(name)); };
            var quotePhysicalIdentifier = function(name) { return '[' + name + ']'; };
            var getScalarCount = function(row, keys) {
                for (var i=0;i<keys.length;i++) if (row[keys[i]] !== undefined) return Number(row[keys[i]]);
                throw Error('Catalog scalar missing');
            };
            var V8 = { Db: { FromSql: function(sql) {
                if (/^CREATE UNIQUE INDEX/.test(sql)) indexWrites++;
                return database.FromSql(sql);
            } } };
            """);
        engine.Execute(Extract("function readDeclarativePackageDdl(", "/* SPARSE_TABLE_IMPORT_PREFLIGHT_V2"));
        engine.Execute(Extract("    var readTargetPhysicalColumns =", "    var mysqlCurrentTimestampDefault ="));
        engine.Execute(Extract("    // PACKAGE_DECLARED_INDEX_DEFINITION_V1", "    // MySQL 严格模式不允许"));
        engine.Execute(Extract("    var executePackageDdl =", "    // PACKAGE_DECLARED_IDENTIFIER_STORAGE_V1"));
        engine.Execute("""
            var classifyDdlStatement = readDeclarativePackageDdl;
            function installIndex() {
                var item = allDdlStatements[0], info = classifyDdlStatement(item.DDL, item.TableName);
                if (!ddlIndexExists(info.TableName, info.IndexName)) executePackageDdl(item, info);
                if (!ddlIndexExists(info.TableName, info.IndexName)) throw Error('Physical index readback missing');
            }
            """);
        return engine;
    }
}

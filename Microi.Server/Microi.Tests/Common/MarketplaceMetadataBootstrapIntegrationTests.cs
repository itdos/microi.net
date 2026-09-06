using System.Reflection;
using Dos.ORM;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using System.Data.Common;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
[Trait("Category", "FullStack")]
public class MarketplaceMetadataBootstrapIntegrationTests
{
    public static bool HasMySqlTestConnection => !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MICROI_UPGRADE_TEST_CONN"));

    [Fact(Skip = "Requires the isolated upgrade_fixture database on localhost:62606", SkipUnless = nameof(HasMySqlTestConnection))]
    public async Task MissingSelfMetadata_UsesPackageSchemaRemapsOccupiedIdsAndReplaysWithoutChanges()
    {
        var connection = Environment.GetEnvironmentVariable("MICROI_UPGRADE_TEST_CONN")!;
        var connectionParts = new DbConnectionStringBuilder { ConnectionString = connection };
        Assert.Equal("upgrade_fixture", connectionParts["Database"]);
        Assert.Equal("127.0.0.1", connectionParts["Server"]);
        Assert.Equal("62606", Convert.ToString(connectionParts["Port"]));
        var database = MicroiORMExtensions.CreateDbSession(connection, DatabaseType.MySql);
        var services = new ServiceCollection();
        services.AddMicroiORM();
        var cache = new CacheTenant();
        services.AddSingleton<IMicroiCacheTenant>(cache);
        using var provider = services.BuildServiceProvider();
        var serviceField = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.Static | BindingFlags.NonPublic)!;
        var previous = serviceField.GetValue(null);
        MicroiEngine.Init(provider);
        try
        {
            database.FromSql("CREATE TABLE diy_table (Id char(36) PRIMARY KEY COMMENT 'keep identifier',Name varchar(100),Description varchar(255),IsDeleted int,DataBaseId char(36) DEFAULT '',DataBaseName varchar(100))").ExecuteNonQuery();
            database.FromSql("CREATE TABLE diy_field (Id char(36) PRIMARY KEY,TableId char(36),TableName varchar(100),Name varchar(100),Label varchar(255),Type varchar(100),Component varchar(100),IsDeleted int,CONSTRAINT fk_metadata_table FOREIGN KEY(TableId) REFERENCES diy_table(Id))").ExecuteNonQuery();
            database.FromSql("CREATE TABLE customer_orders (Id char(36) PRIMARY KEY)").ExecuteNonQuery();
            database.FromSql("INSERT INTO customer_orders VALUES ('01M1V9KP1J3Q7V017XM13MH7KK')").ExecuteNonQuery();
            // 目标租户已经占用了官方稳定 Id；自举不得覆盖该业务表。
            database.FromSql("INSERT INTO diy_table (Id,Name,Description,IsDeleted) VALUES ('39bc4abe-98ee-46a7-b9d1-a7d649691193','customer_orders','保留客户表',0)").ExecuteNonQuery();
            dynamic oldId = database.FromSql("SELECT Id FROM diy_table").First<dynamic>();
            Assert.IsType<Guid>((object)oldId.Id);
            database.FromSql("INSERT INTO diy_field (Id,TableId,Name,Label,IsDeleted) VALUES ('01M1V9KP1J3Q7V017XM13MH7KK','39bc4abe-98ee-46a7-b9d1-a7d649691193','legacy_custom','保留旧字段',0)").ExecuteNonQuery();
            database.FromSql("INSERT INTO diy_field (Id,TableId,Name,Label,IsDeleted) VALUES ('5915c03f-6a76-40c6-b408-6f6536dd86d0','39bc4abe-98ee-46a7-b9d1-a7d649691193','a_uuid','保留UUID字段',0)").ExecuteNonQuery();
            Assert.Equal("char(36)", Convert.ToString(database.FromSql("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='diy_field' AND COLUMN_NAME='Id'").ToScalar()));
            var originalCollation = Convert.ToString(database.FromSql("SELECT COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='diy_field' AND COLUMN_NAME='Id'").ToScalar());
            var client = new OsClientSecret { OsClient = "bootstrap_fixture", Db = database, DbRead = database };
            database.FromSql("ALTER TABLE diy_field ADD CONSTRAINT reject_partial_bootstrap CHECK (Name <> 'Name')").ExecuteNonQuery();
            await Assert.ThrowsAnyAsync<Exception>(() => UpgradeAppStore.EnsureMarketplaceMetadataBootstrapUnderLeaseAsync(client));
            Assert.Equal(1, Convert.ToInt32(database.FromSql("SELECT COUNT(1) FROM diy_table").ToScalar()));
            Assert.Equal(2, Convert.ToInt32(database.FromSql("SELECT COUNT(1) FROM diy_field").ToScalar()));
            Assert.Equal("01M1V9KP1J3Q7V017XM13MH7KK", Convert.ToString(database.FromSql("SELECT Id FROM diy_field WHERE Name='legacy_custom'").ToScalar()));
            Assert.Equal("keep identifier", Convert.ToString(database.FromSql("SELECT COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='diy_table' AND COLUMN_NAME='Id'").ToScalar()));
            Assert.Equal("PRI", Convert.ToString(database.FromSql("SELECT COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='diy_table' AND COLUMN_NAME='Id'").ToScalar()));
            Assert.Equal(originalCollation, Convert.ToString(database.FromSql("SELECT COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='diy_field' AND COLUMN_NAME='Id'").ToScalar()));
            Assert.Equal("", Convert.ToString(database.FromSql("SELECT COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='diy_table' AND COLUMN_NAME='DataBaseId'").ToScalar()));
            Assert.Equal("char(36)", Convert.ToString(database.FromSql("SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='customer_orders' AND COLUMN_NAME='Id'").ToScalar()));
            Assert.Empty(cache.Cleared);
            database.FromSql("ALTER TABLE diy_field DROP CHECK reject_partial_bootstrap").ExecuteNonQuery();
            await UpgradeAppStore.EnsureMarketplaceMetadataBootstrapUnderLeaseAsync(client);
            Assert.Equal(3, Convert.ToInt32(database.FromSql("SELECT COUNT(1) FROM diy_table").ToScalar()));
            Assert.Equal("保留客户表", Convert.ToString(database.FromSql("SELECT Description FROM diy_table WHERE Name='customer_orders'").ToScalar()));
            var tableId = Convert.ToString(database.FromSql("SELECT Id FROM diy_table WHERE Name='diy_table'").ToScalar());
            Assert.NotEqual("39bc4abe-98ee-46a7-b9d1-a7d649691193", tableId);
            // Reproduce the old-tenant provider shape that previously broke cold GetFormData.
            dynamic coldRow = database.FromSql("SELECT * FROM diy_table WHERE Name='diy_table'").First<dynamic>();
            Assert.IsType<string>((object)coldRow.Id);
            var normalize = typeof(FormEngineExtend).GetMethod("NormalizeDiyTableStorageMetadata", BindingFlags.NonPublic | BindingFlags.Static)!;
            dynamic metadata = normalize.Invoke(null, new object[] { coldRow })!;
            Assert.Equal(tableId, (string)metadata.Id);
            Assert.True(Convert.ToInt32(database.FromSql("SELECT COUNT(1) FROM diy_field WHERE TableId=@p0").AddInParameter("p0", tableId).ToScalar()) > 60);
            var count = Convert.ToInt32(database.FromSql("SELECT COUNT(1) FROM diy_field").ToScalar());
            Assert.True(count > 100);
            database.FromSql("UPDATE diy_field SET Label='客户自定义名称' WHERE TableId=@p0 AND Name='Name'").AddInParameter("p0", tableId).ExecuteNonQuery();
            var clears = cache.Cleared.Count;
            await UpgradeAppStore.EnsureMarketplaceMetadataBootstrapUnderLeaseAsync(client);
            Assert.Equal(count, Convert.ToInt32(database.FromSql("SELECT COUNT(1) FROM diy_field").ToScalar()));
            Assert.Equal("客户自定义名称", Convert.ToString(database.FromSql("SELECT Label FROM diy_field WHERE TableId=@p0 AND Name='Name'").AddInParameter("p0", tableId).ToScalar()));
            Assert.Equal(clears, cache.Cleared.Count);
            Assert.Equal(0, UpgradeAppStore.EnsureLegacyMetadataIdentifierStorage(client));
            Assert.Equal(1, Convert.ToInt32(database.FromSql("SELECT COUNT(*) FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND CONSTRAINT_NAME='fk_metadata_table'").ToScalar()));
            Assert.ThrowsAny<Exception>(() => database.FromSql("INSERT INTO diy_field(Id,TableId,Name) VALUES('should-not-write','missing','bad')").ExecuteNonQuery());
            Assert.All(cache.Cleared, key => Assert.StartsWith("Microi:bootstrap_fixture:", key));

            database.FromSql("CREATE TABLE sys_menu (Id varchar(36) PRIMARY KEY,Name varchar(100),DiyTableName varchar(100))").ExecuteNonQuery();
            database.FromSql("INSERT INTO diy_table (Id,Name,Description,IsDeleted) VALUES ('legacy-menu-table','sys_menu','保留旧菜单配置',0)").ExecuteNonQuery();
            database.FromSql("INSERT INTO diy_field (Id,TableId,Name,Label,IsDeleted) VALUES ('legacy-menu-name','legacy-menu-table','Name','客户自定义菜单名称',0)").ExecuteNonQuery();
            await UpgradeAppStore.EnsureMarketplaceMetadataBootstrapUnderLeaseAsync(client, menuOnly: true);
            Assert.Equal(1, Convert.ToInt32(database.FromSql("SELECT COUNT(*) FROM diy_field WHERE TableId='legacy-menu-table' AND Name='DiyTableName'").ToScalar()));
            Assert.Equal("客户自定义菜单名称", Convert.ToString(database.FromSql("SELECT Label FROM diy_field WHERE Id='legacy-menu-name'").ToScalar()));
            Assert.Equal("保留旧菜单配置", Convert.ToString(database.FromSql("SELECT Description FROM diy_table WHERE Id='legacy-menu-table'").ToScalar()));
            Assert.Equal(0, Convert.ToInt32(database.FromSql("SELECT COUNT(*) FROM diy_field WHERE TableId='legacy-menu-table' AND Name='ModuleEngineKey'").ToScalar()));
            var menuFieldCount = Convert.ToInt32(database.FromSql("SELECT COUNT(*) FROM diy_field WHERE TableId='legacy-menu-table'").ToScalar());
            var menuClears = cache.Cleared.Count;
            await UpgradeAppStore.EnsureMarketplaceMetadataBootstrapUnderLeaseAsync(client, menuOnly: true);
            Assert.Equal(menuFieldCount, Convert.ToInt32(database.FromSql("SELECT COUNT(*) FROM diy_field WHERE TableId='legacy-menu-table'").ToScalar()));
            Assert.Equal(menuClears, cache.Cleared.Count);
        }
        finally
        {
            database.FromSql("DROP TABLE IF EXISTS diy_field").ExecuteNonQuery();
            database.FromSql("DROP TABLE IF EXISTS diy_table").ExecuteNonQuery();
            database.FromSql("DROP TABLE IF EXISTS customer_orders").ExecuteNonQuery();
            database.FromSql("DROP TABLE IF EXISTS sys_menu").ExecuteNonQuery();
            serviceField.SetValue(null, previous);
        }
    }

    private sealed class CacheTenant : IMicroiCacheTenant
    {
        public List<string> Cleared { get; } = new();
        public IMicroiCache Cache(string osClient)
        {
            var proxy = DispatchProxy.Create<IMicroiCache, CacheProxy>();
            ((CacheProxy)(object)proxy).Cleared = Cleared;
            return proxy;
        }
        public IMicroiCache Default() => Cache("bootstrap_fixture");
    }
    public class CacheProxy : DispatchProxy
    {
        public List<string> Cleared { get; set; } = new();
        protected override object? Invoke(MethodInfo? method, object?[]? args)
        {
            if (method!.Name == "RemoveAsync")
            {
                Cleared.Add((string)args![0]!);
                return Task.FromResult(true);
            }
            throw new NotSupportedException(method.Name);
        }
    }
}

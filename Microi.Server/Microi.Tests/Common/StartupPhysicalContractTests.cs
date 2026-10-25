using System.Reflection;
using Dos.ORM;
using Microi.net;
using System.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class StartupPhysicalContractTests
{
    public static bool HasSqlServerTestConnection => !string.IsNullOrWhiteSpace(
        Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN"));

    [Fact(Skip = "Requires an isolated local SQL Server fixture", SkipUnless = nameof(HasSqlServerTestConnection))]
    [Trait("Category", "FullStack")]
    [Trait("DatabaseProvider", "SqlServer")]
    public void LegacyLoginSchema_IsRepairedRegardlessOfRecordedVersion_AndPreservesRows()
    {
        var connection = new SqlConnectionStringBuilder(Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN")!);
        SqlServerFixtureGuard.Verify(connection);
        var databaseName = "microi_login_fixture_" + Guid.NewGuid().ToString("N");
        connection.InitialCatalog = "master";
        var master = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.SqlServer);
        master.FromSql($"CREATE DATABASE [{databaseName}]").ExecuteNonQuery();
        connection.InitialCatalog = databaseName;
        var database = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.SqlServer);
        var services = new ServiceCollection();
        services.AddMicroiORM();
        using var provider = services.BuildServiceProvider();
        var providerField = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.Static | BindingFlags.NonPublic)!;
        var previous = providerField.GetValue(null);
        MicroiEngine.Init(provider);
        try
        {
            database.FromSql("CREATE TABLE sys_menu (Id varchar(36) PRIMARY KEY, Name nvarchar(100)); CREATE TABLE sys_user (Id varchar(36) PRIMARY KEY, Account varchar(100)); CREATE TABLE sys_config (Id varchar(36) PRIMARY KEY, ServerVersion varchar(50)); INSERT INTO sys_menu VALUES ('menu-keep',N'保留客户菜单'); INSERT INTO sys_user VALUES ('user-keep','keep-account'); INSERT INTO sys_config VALUES ('config-keep','99.0.0')").ExecuteNonQuery();
            var client = new OsClientSecret { OsClient = "login_fixture", Db = database, DbRead = database,
                OsClientModel = new JObject { ["DbType"] = "SqlServer" } };
            var upgrade = new MicroiUpgrade();
            var ready = typeof(MicroiUpgrade).GetMethod("RuntimePhysicalPrerequisitesReady", BindingFlags.NonPublic | BindingFlags.Instance)!;
            var repair = typeof(MicroiUpgrade).GetMethod("EnsureApiEngineRuntimeColumns", BindingFlags.NonPublic | BindingFlags.Instance)!;
            Assert.False((bool)ready.Invoke(upgrade, new object[] { client })!);
            repair.Invoke(upgrade, new object[] { client });
            Assert.True((bool)ready.Invoke(upgrade, new object[] { client })!);
            // 运行真实生成实体投影，防止仅校验声明、实际 SELECT 仍缺列。
            Assert.Equal("保留客户菜单", database.From<SysMenu>().First<SysMenu>().Name);
            Assert.Equal("keep-account", database.From<SysUser>().First<SysUser>().Account);
            database.FromSql("ALTER TABLE sys_menu DROP COLUMN MenuBadgeEnabled").ExecuteNonQuery();
            Assert.False((bool)ready.Invoke(upgrade, new object[] { client })!);
            repair.Invoke(upgrade, new object[] { client });
            var columnCount = database.FromSql("SELECT COUNT(*) FROM sys.columns").ToScalar<int>();
            repair.Invoke(upgrade, new object[] { client });
            Assert.Equal(columnCount, database.FromSql("SELECT COUNT(*) FROM sys.columns").ToScalar<int>());
            Assert.Equal("99.0.0", database.FromSql("SELECT ServerVersion FROM sys_config").ToScalar<string>());
            Assert.Equal(1, database.FromSql("SELECT COUNT(*) FROM sys_menu").ToScalar<int>());
        }
        finally
        {
            providerField.SetValue(null, previous);
            master.FromSql($"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]").ExecuteNonQuery();
        }
    }

    [Theory]
    [InlineData("sys_menu", typeof(SysMenu))]
    [InlineData("sys_user", typeof(SysUser))]
    public void StartupContract_CoversEveryGeneratedLoginProjection(string tableName, Type entityType)
    {
        // 生成实体会一次性 SELECT 全部字段。即使应用包声明了字段，只要启动物理门禁
        // 没有消费它，旧库仍会在登录和菜单加载时暴露“列名无效”。
        var contracts = ReadContracts();
        Assert.True(contracts.TryGetValue(tableName, out var columns),
            $"启动物理门禁遗漏登录所需表 {tableName}。");
        var entity = Assert.IsAssignableFrom<Entity>(Activator.CreateInstance(entityType));
        foreach (var field in entity.GetFields())
        {
            var columnName = field.FieldName.Replace("{0}", "").Replace("{1}", "");
            Assert.True(columns!.ContainsKey(columnName),
                $"启动物理门禁遗漏生成实体字段 {tableName}.{columnName}。");
        }
    }

    [Fact]
    public void StartupContract_CoversAnonymousConfigurationAndMenuRuntimeColumns()
    {
        var contracts = ReadContracts();
        foreach (var (table, fields) in new[]
        {
            ("sys_config", new[] { "ServerVersion", "AutoTestSkipCaptcha", "V8DefaultTimeoutSeconds", "GlobalFunctions" }),
            ("sys_menu", new[] { "MenuBadgeEnabled", "MenuBadgeApiEngineKey", "MenuBadgeTooltip", "FlowDesignId", "MicroServiceId", "MicroServicePageId", "MicroServiceRoutePath" })
        })
        {
            Assert.True(contracts.TryGetValue(table, out var columns), $"启动物理门禁遗漏 {table}。");
            foreach (var field in fields)
                Assert.True(columns!.ContainsKey(field), $"启动物理门禁遗漏 {table}.{field}。");
        }
    }

    [Theory]
    [InlineData("MySql")]
    [InlineData("SqlServer")]
    public void StartupContract_PreservesPackagedDecimalThresholdForBothProviders(string dbType)
    {
        var columnType = ReadContracts()["sys_config"]["FileServerBakThresholdGiB"];
        Assert.Equal("decimal(18,6)", columnType);
        var normalize = typeof(MicroiUpgrade).GetMethod("NormalizeRuntimePhysicalColumnType",
            BindingFlags.NonPublic | BindingFlags.Static)!;
        var client = new OsClientSecret { OsClientModel = new JObject { ["DbType"] = dbType } };
        Assert.Equal(columnType, normalize.Invoke(null, new object[] { client, columnType }));
    }

    [Theory]
    [InlineData("decimal(1,0)")]
    [InlineData("decimal(1,1)")]
    [InlineData("decimal(18,6)")]
    [InlineData("DECIMAL(18,6)")]
    [InlineData("decimal(30,30)")]
    [InlineData("decimal(38,0)")]
    [InlineData("decimal(38,30)")]
    [InlineData("bit")]
    [InlineData("bit(1)")]
    [InlineData("int")]
    [InlineData("int(11)")]
    [InlineData("datetime")]
    [InlineData("mediumtext")]
    [InlineData("varchar(255)")]
    public void StartupContract_AcceptsPortableDecimalAndExistingTypes(string columnType)
    {
        Assert.True(IsSafeColumnType(columnType));
    }

    [Theory]
    [InlineData("")]
    [InlineData("decimal")]
    [InlineData("decimal(18)")]
    [InlineData("decimal(18,)")]
    [InlineData("decimal(,6)")]
    [InlineData("decimal(0,0)")]
    [InlineData("decimal(39,6)")]
    [InlineData("decimal(65,30)")]
    [InlineData("decimal(38,31)")]
    [InlineData("decimal(18,19)")]
    [InlineData("decimal(-18,6)")]
    [InlineData("decimal(18,-6)")]
    [InlineData("decimal(+18,6)")]
    [InlineData("decimal(99999999999999999999,6)")]
    [InlineData("decimal(18,99999999999999999999)")]
    [InlineData("decimal(１８,６)")]
    [InlineData("decimal(18,6); DROP TABLE sys_config")]
    [InlineData("decimal(18,6)--")]
    [InlineData("decimal(18,6)/*comment*/")]
    [InlineData("decimal(18,6) NOT NULL")]
    [InlineData("decimal(18,6) unsigned")]
    [InlineData("decimal(18,6) ")]
    [InlineData(" decimal(18,6)")]
    [InlineData("decimal(18,6)\n")]
    [InlineData("decimal(18,6)\r\n")]
    [InlineData("decimal(18,6)\0")]
    [InlineData("decimal(18, 6)")]
    [InlineData("decimal(1e1,6)")]
    [InlineData("varchar(255)\n")]
    [InlineData("varchar(255); DROP TABLE sys_config")]
    public void StartupContract_RejectsUnsafeOrNonPortableColumnTypes(string columnType)
    {
        Assert.False(IsSafeColumnType(columnType));
    }

    private static bool IsSafeColumnType(string columnType)
    {
        var validator = typeof(MicroiUpgrade).GetMethod("IsSafeRuntimePhysicalColumnType",
            BindingFlags.NonPublic | BindingFlags.Static)!;
        return (bool)validator.Invoke(null, new object[] { columnType })!;
    }

    private static IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> ReadContracts()
    {
        var loader = typeof(MicroiUpgrade).GetMethod("LoadRuntimePhysicalColumnContracts",
            BindingFlags.NonPublic | BindingFlags.Static)!;
        return Assert.IsAssignableFrom<IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>>>(
            loader.Invoke(null, null));
    }

    [Theory]
    [InlineData("valid", true)]
    [InlineData("missingTable", false)]
    [InlineData("missingColumn", false)]
    [InlineData("missingPublishColumn", false)]
    [InlineData("duplicateField", false)]
    [InlineData("overwriteLanguage", false)]
    [InlineData("ansiLanguage", false)]
    [InlineData("licenseRows", false)]
    public void FoundationPackage_RequiresCompleteSchemaAndPreservesTenantData(string corruption, bool expected)
    {
        var loader = typeof(OfficialApplicationPackageValidation).GetMethod("LoadBundledResources", BindingFlags.NonPublic | BindingFlags.Static)!;
        var resources = (Dictionary<string, string>)loader.Invoke(null, null)!;
        var package = JObject.Parse(resources["app.microi.saas-engine.json"]);
        switch (corruption)
        {
            case "ansiLanguage":
                package["PhysicalColumns"]!.First(t => t["TABLE_NAME"]?.ToString() == "diy_lang" && t["COLUMN_NAME"]?.ToString() == "ZhCN")["SQLSERVER_UNICODE"] = false;
                break;
            case "missingTable":
                package["DiyTables"]!.First(t => t["Name"]?.ToString() == "mci_license_server").Remove();
                break;
            case "missingColumn":
                package["PhysicalColumns"]!.First(t => t["TABLE_NAME"]?.ToString() == "diy_lang" && t["COLUMN_NAME"]?.ToString() == "Key").Remove();
                break;
            case "missingPublishColumn":
                package["PhysicalColumns"]!.First(t => t["TABLE_NAME"]?.ToString() == "sys_microistore" && t["COLUMN_NAME"]?.ToString() == "PublishProtocolVersion").Remove();
                break;
            case "duplicateField":
                ((JArray)package["DiyFields"]!).Add(package["DiyFields"]!.First(t => t["TableName"]?.ToString() == "diy_lang").DeepClone());
                break;
            case "overwriteLanguage":
                package["DataSets"]!.First(t => t["TableName"]?.ToString() == "diy_lang")["ConflictPolicy"] = "Overwrite";
                break;
            case "licenseRows":
                ((JArray)package["DataSets"]!).Add(new JObject { ["TableName"] = "mci_license_server", ["Rows"] = new JArray(new JObject { ["LicenseContent"] = "must never ship" }) });
                break;
        }
        var validator = typeof(OfficialApplicationPackageValidation).GetMethod("HasPackagedFoundationSchema", BindingFlags.NonPublic | BindingFlags.Static)!;
        Assert.Equal(expected, (bool)validator.Invoke(null, new object[] { package })!);
    }
}

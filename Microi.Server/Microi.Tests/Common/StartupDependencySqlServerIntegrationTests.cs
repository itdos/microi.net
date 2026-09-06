using System.Data.SqlClient;
using System.Reflection;
using Dos.ORM;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
[Trait("Category", "FullStack")]
public class StartupDependencySqlServerIntegrationTests
{
    public static bool HasSqlServerTestConnection => !string.IsNullOrWhiteSpace(
        Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN"));

    [Theory(Skip = "Requires an isolated SQL Server fixture on 127.0.0.1,62616", SkipUnless = nameof(HasSqlServerTestConnection))]
    [InlineData("nchar(50)")]
    [InlineData("char(50)")]
    [InlineData("nvarchar(50)")]
    [InlineData("nvarchar(1)")]
    [InlineData("varchar(3)")]
    [InlineData("nchar(3)")]
    [InlineData("char(3)")]
    [InlineData("nvarchar(1) NOT NULL")]
    [InlineData("nvarchar(1) COLLATE Latin1_General_100_BIN2 NOT NULL")]
    [InlineData(null)]
    [InlineData("int")]
    [InlineData("AS CONVERT(nvarchar(50), 'v0.0.0')")]
    public async Task ManagedStartupClosure_RepairsLegacyVersionStorageAndReplaysWithoutWrites(string? versionType)
    {
        var connection = new SqlConnectionStringBuilder(
            Environment.GetEnvironmentVariable("MICROI_UPGRADE_SQLSERVER_TEST_CONN")!);
        // 独立任务可使用不同本机端口，避免共享夹具在其它对话重启时打断发布回归。
        Assert.Matches(@"^127\.0\.0\.1,\d{1,5}$", connection.DataSource);
        Assert.Equal("upgrade_fixture", connection.InitialCatalog);

        // 每个用例创建独立库，决不清空传入连接中的数据库或复用其它对话的测试表。
        var databaseName = "microi_upgrade_fixture_" + Guid.NewGuid().ToString("N");
        connection.InitialCatalog = "master";
        var master = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.SqlServer);
        master.FromSql($"CREATE DATABASE [{databaseName}]").ExecuteNonQuery();
        connection.InitialCatalog = databaseName;
        var database = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.SqlServer);
        var serviceField = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.Static | BindingFlags.NonPublic)!;
        var previous = serviceField.GetValue(null);
        var services = new ServiceCollection();
        services.AddMicroiORM();
        var cache = new CacheTenant();
        services.AddSingleton<IMicroiCacheTenant>(cache);
        using var provider = services.BuildServiceProvider();
        MicroiEngine.Init(provider);
        try
        {
            var versionColumn = versionType == null ? "" : $"Version {versionType},";
            database.FromSql($@"CREATE TABLE sys_apiengine (
                Id nvarchar(36) NOT NULL PRIMARY KEY, ApiEngineKey nvarchar(100),
                ApiAddress nvarchar(500), ApiRoutes nvarchar(max), ApiV8Code nvarchar(max),
                IsDeleted bit, IsEnable bit, StopHttp bit, AllowAnonymous bit,
                {versionColumn} CreateTime datetime2, UpdateTime datetime2)").ExecuteNonQuery();
            var originalCollation = database.FromSql("SELECT collation_name FROM sys.columns WHERE object_id=OBJECT_ID('sys_apiengine') AND name='Version'").ToScalar<string>();
            var client = new OsClientSecret { OsClient = "startup_sqlserver_fixture", Db = database, DbRead = database };
            Assert.False(UpgradeAppStore.StartupDependenciesReady(client, out _));

            var installed = await UpgradeAppStore.EnsureStartupDependenciesUnderLeaseAsync(client);
            if (versionType == "int" || versionType?.StartsWith("AS ") == true)
            {
                Assert.Equal(0, installed.Code);
                Assert.Contains("Version 必须是可写文本列", installed.Msg);
                Assert.Equal(0, database.FromSql("SELECT COUNT(*) FROM sys_apiengine").ToScalar<int>());
                return;
            }
            Assert.True(installed.Code == 1, installed.Msg);
            Assert.True(UpgradeAppStore.StartupDependenciesReady(client, out var reason), reason);
            var count = database.FromSql("SELECT COUNT(*) FROM sys_apiengine").ToScalar<int>();
            Assert.Equal(UpgradeAppStore.RequiredStartupDependencyEngineKeys.Length, count);
            Assert.True(count > 100);

            var version = database.FromSql("SELECT Version FROM sys_apiengine WHERE ApiEngineKey=@p0")
                .AddInParameter("p0", "database-backup-download").ToScalar<string>();
            if (versionType?.StartsWith("nchar(") == true || versionType?.StartsWith("char(") == true)
                Assert.Equal(50, version.Length);
            if (versionType?.EndsWith("NOT NULL") == true)
                Assert.Equal(0, database.FromSql("SELECT is_nullable FROM sys.columns WHERE object_id=OBJECT_ID('sys_apiengine') AND name='Version'").ToScalar<int>());
            if (originalCollation != null)
                Assert.Equal(originalCollation, database.FromSql("SELECT collation_name FROM sys.columns WHERE object_id=OBJECT_ID('sys_apiengine') AND name='Version'").ToScalar<string>());

            // 数据库触发器统计实际写入；二次检查和新 DbSession 重放都必须零 INSERT/UPDATE/DELETE。
            database.FromSql("CREATE TABLE write_audit (Writes int NOT NULL)").ExecuteNonQuery();
            database.FromSql("INSERT INTO write_audit VALUES (0)").ExecuteNonQuery();
            database.FromSql(@"CREATE TRIGGER startup_write_audit ON sys_apiengine AFTER INSERT, UPDATE, DELETE AS
                SET NOCOUNT ON; UPDATE write_audit SET Writes=Writes+1").ExecuteNonQuery();
            var cleared = cache.Cleared.Count;
            var reopened = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.SqlServer);
            var restartedClient = new OsClientSecret { OsClient = client.OsClient, Db = reopened, DbRead = reopened };
            Assert.True(UpgradeAppStore.StartupDependenciesReady(restartedClient, out reason), reason);
            var replay = await UpgradeAppStore.EnsureStartupDependenciesUnderLeaseAsync(restartedClient);
            Assert.True(replay.Code == 1, replay.Msg);
            Assert.Equal(count, database.FromSql("SELECT COUNT(*) FROM sys_apiengine").ToScalar<int>());
            Assert.Equal(0, database.FromSql("SELECT Writes FROM write_audit").ToScalar<int>());
            Assert.Equal(cleared, cache.Cleared.Count);

            // 真正的版本差异依然由 Managed 包纠正，不得把 Trim 变成跳过版本检查。
            database.FromSql("UPDATE sys_apiengine SET Version='v0.0.0' WHERE ApiEngineKey='database-backup-download'").ExecuteNonQuery();
            Assert.False(UpgradeAppStore.StartupDependenciesReady(restartedClient, out _));
            var repaired = await UpgradeAppStore.EnsureStartupDependenciesUnderLeaseAsync(restartedClient);
            Assert.True(repaired.Code == 1, repaired.Msg);
            Assert.True(UpgradeAppStore.StartupDependenciesReady(restartedClient, out reason), reason);
            Assert.Equal(count, database.FromSql("SELECT COUNT(*) FROM sys_apiengine").ToScalar<int>());
        }
        finally
        {
            serviceField.SetValue(null, previous);
            // databaseName 仅由固定前缀和本用例 Guid 生成，清理范围不接受外部输入。
            master.FromSql($"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]").ExecuteNonQuery();
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
        public IMicroiCache Default() => Cache("startup_sqlserver_fixture");
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

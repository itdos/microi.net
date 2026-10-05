using System.Data.Common;
using System.Reflection;
using Dos.ORM;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
[Trait("Category", "FullStack")]
public sealed class UpgradeColdApiEngineCacheIntegrationTests
{
    public static bool HasFixture => !string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("MICROI_UPGRADE_TEST_CONN"));

    [Fact(Skip = "Requires an isolated local MySQL fixture", SkipUnless = nameof(HasFixture))]
    public async Task ColdLegacyDatabase_RebuildsEnabledRoutesWithoutFormMetadataOrFormEngine()
    {
        var connection = new DbConnectionStringBuilder { ConnectionString = Environment.GetEnvironmentVariable("MICROI_UPGRADE_TEST_CONN")! };
        Assert.Equal("upgrade_fixture", connection["Database"]);
        Assert.Equal("127.0.0.1", connection["Server"]);
        var databaseName = "microi_cache_rebuild_" + Guid.NewGuid().ToString("N");
        connection["Database"] = "mysql";
        var master = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.MySql);
        master.FromSql($"CREATE DATABASE `{databaseName}`").ExecuteNonQuery();
        connection["Database"] = databaseName;
        var db = MicroiORMExtensions.CreateDbSession(connection.ConnectionString, DatabaseType.MySql);
        var cache = new CapturedCacheTenant();
        var services = new ServiceCollection();
        services.AddSingleton<IMicroiCacheTenant>(cache);
        using var provider = services.BuildServiceProvider();
        var serviceField = typeof(MicroiEngine).GetField("_serviceProvider", BindingFlags.Static | BindingFlags.NonPublic)!;
        var previous = serviceField.GetValue(null);
        MicroiEngine.Init(provider);
        try
        {
            // 启动阶段仅有物理接口表；不提供 diy_table/diy_field、FormEngine 或 V8。
            db.FromSql("CREATE TABLE sys_apiengine (Id varchar(36) PRIMARY KEY,ApiEngineKey varchar(100),ApiAddress varchar(255),ApiRoutes text,ApiV8Code text,IsEnable int,IsDeleted int)").ExecuteNonQuery();
            db.FromSql(@"INSERT INTO sys_apiengine VALUES
                ('engine-a','enabled-a','/api/a','/api/shared','return 1;',1,0),
                ('engine-b','enabled-b','/api/b','/api/shared','return 2;',1,NULL),
                ('disabled','disabled','/api/disabled',NULL,'return 3;',0,0),
                ('deleted','deleted','/api/deleted',NULL,'return 4;',1,1)").ExecuteNonQuery();
            var client = new OsClientSecret { OsClient = databaseName, Db = db, DbRead = null };
            cache.Values[$"Microi:{databaseName}:FormData:sys_apiengine:stale"] = "old";
            var method = typeof(MicroiUpgrade).GetMethod("RebuildLegacyCompatibleApiEngineCacheAsync", BindingFlags.Static | BindingFlags.NonPublic)!;
            var count = await (Task<int>)method.Invoke(null, new object[] { client })!;
            Assert.Equal(6, count);
            Assert.Equal($"Microi:{databaseName}:FormData:sys_apiengine:*", cache.RemovedPattern);
            Assert.Equal(6, cache.Values.Count);
            foreach (var alias in new[] { "engine-a", "enabled-a", "/api/a", "engine-b", "enabled-b", "/api/b" })
                Assert.Contains($"Microi:{databaseName}:FormData:sys_apiengine:{alias}", cache.Values.Keys);
            Assert.DoesNotContain(cache.Values.Keys, key => key.EndsWith(":/api/shared") || key.EndsWith(":disabled") || key.EndsWith(":deleted") || key.EndsWith(":stale"));
            var payload = JObject.Parse(cache.Values[$"Microi:{databaseName}:FormData:sys_apiengine:enabled-a"]);
            Assert.Equal("return 1;", payload.Value<string>("ApiV8Code"));
            db.FromSql("UPDATE sys_apiengine SET ApiV8Code='changed' WHERE Id='engine-a'").ExecuteNonQuery();
            Assert.Equal("return 1;", JObject.Parse(cache.Values[$"Microi:{databaseName}:FormData:sys_apiengine:enabled-a"]).Value<string>("ApiV8Code"));
            Assert.Equal(4, db.FromSql("SELECT COUNT(*) FROM sys_apiengine").ToScalar<int>());
        }
        finally
        {
            serviceField.SetValue(null, previous);
            master.FromSql($"DROP DATABASE IF EXISTS `{databaseName}`").ExecuteNonQuery();
        }
    }

    public sealed class CapturedCacheTenant : IMicroiCacheTenant
    {
        public Dictionary<string, string> Values { get; } = new();
        public string? RemovedPattern { get; set; }
        public IMicroiCache Default() => Cache("");
        public IMicroiCache Cache(string osClient)
        {
            var proxy = DispatchProxy.Create<IMicroiCache, CapturedCache>();
            ((CapturedCache)(object)proxy).Owner = this;
            return proxy;
        }
        public class CapturedCache : DispatchProxy
        {
            internal CapturedCacheTenant Owner { get; set; } = null!;
            protected override object? Invoke(MethodInfo? method, object?[]? args)
            {
                if (method!.Name == "RemoveParentAsync")
                {
                    Owner.RemovedPattern = (string)args![0]!;
                    var count = Owner.Values.Count;
                    Owner.Values.Clear();
                    return Task.FromResult((long)count);
                }
                if (method.Name == "SetAsync")
                {
                    Owner.Values[(string)args![0]!] = (string)args[1]!;
                    return Task.FromResult(true);
                }
                throw new NotSupportedException(method.Name);
            }
        }
    }
}

using System.Reflection;
using Dos.Common;
using Dos.ORM;
using Microi.net;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

[Collection("TenantContextGlobal")]
public sealed class SaaSDatabaseAliasTests
{
    [Theory]
    [InlineData("SqlServer9", false)]
    [InlineData("SqlServer9", true)]
    [InlineData("sqlserver", false)]
    [InlineData("SQLSERVER9", true)]
    [InlineData("mssql", false)]
    public void MainTenant_ReprojectionKeepsSqlServerDialect_ForFileAndProcessConfiguration(
        string configuredType, bool fromProcess)
    {
        WithConfiguration(configuredType, fromProcess, tenant =>
        {
            // 主租户曾从旧 SaaS 行或 Redis 读到其它 Provider；宿主连接应继续优先。
            var model = new JObject { ["DbType"] = "MySql", ["DbConn"] = "old-main",
                ["DbReadType"] = "SqlServer9", ["DbReadConn"] = "read-replica" };
            var project = typeof(OsClientExtend).GetMethod("EnsureMainTenantDatabaseConfig",
                BindingFlags.Static | BindingFlags.NonPublic)!;
            for (var attempt = 0; attempt < 3; attempt++)
            {
                project.Invoke(null, new object[] { tenant, model });
                Assert.Equal("SqlServer", model.Value<string>("DbType"));
                Assert.Equal("SqlServer", model.Value<string>("DbReadType"));
                Assert.Equal(DatabaseType.SqlServer, DiyCommon.GetDbInfo(model.Value<string>("DbType")).DbType);
                Assert.Equal("host-connection", model.Value<string>("DbConn"));
                Assert.Equal("read-replica", model.Value<string>("DbReadConn"));
            }
        });
    }

    [Theory]
    [InlineData("SqlServer9", "SQLSERVER9", "SqlServer", "SqlServer")]
    [InlineData("mssql", "sqlserver", "SqlServer", "SqlServer")]
    [InlineData("MySql", "MySql", "MySql", "MySql")]
    [InlineData("Oracle", "Oracle", "Oracle", "Oracle")]
    public void ChildTenant_PublicationAndCacheSnapshotNormalizeAliases_WithoutHostConnectionInheritance(
        string writeType, string readType, string expectedWrite, string expectedRead)
    {
        WithConfiguration("SqlServer9", true, mainTenant =>
        {
            var tenant = "alias-child-" + Guid.NewGuid().ToString("N");
            var client = new OsClientSecret { OsClient = tenant, OsClientModel = new JObject
            {
                ["DbType"] = writeType, ["DbReadType"] = readType,
                ["DbConn"] = "child-writer", ["DbReadConn"] = "child-reader"
            } };
            try
            {
                OsClientExtend.AddOrUptClient(client, publishConfiguration: false);
                var stored = OsClientExtend.ClientList[tenant].OsClientModel;
                Assert.Equal(expectedWrite, stored.Value<string>("DbType"));
                Assert.Equal(expectedRead, stored.Value<string>("DbReadType"));
                var extract = typeof(OsClientExtend).GetMethod("ExtractClientConfig",
                    BindingFlags.Static | BindingFlags.NonPublic)!;
                var snapshot = Assert.IsType<JObject>(extract.Invoke(null, new object[] { client }));
                Assert.Equal(expectedWrite, snapshot.Value<string>("DbType"));
                Assert.Equal(expectedRead, snapshot.Value<string>("DbReadType"));
                Assert.Equal("child-writer", snapshot.Value<string>("DbConn"));
                Assert.Equal("child-reader", snapshot.Value<string>("DbReadConn"));
                Assert.NotSame(stored, snapshot);
            }
            finally { OsClientExtend.ClientList.TryRemove(tenant, out _); }
        });
    }

    private static void WithConfiguration(string databaseType, bool fromProcess, Action<string> action)
    {
        var originalConfiguration = ConfigHelper.Configuration;
        var keys = new[] { "OsClient", "OsClientDbConn", "OsClientDbType" };
        var processValues = keys.ToDictionary(key => key, Environment.GetEnvironmentVariable);
        var tenant = "alias-main-" + Guid.NewGuid().ToString("N");
        try
        {
            foreach (var key in keys) Environment.SetEnvironmentVariable(key, null);
            ConfigHelper.Configuration = new ConfigurationBuilder().AddInMemoryCollection(
                new Dictionary<string, string?>
                {
                    ["AppSettings:OsClient"] = tenant,
                    ["AppSettings:OsClientDbConn"] = "host-connection",
                    ["AppSettings:OsClientDbType"] = fromProcess ? "MySql" : databaseType
                }).Build();
            if (fromProcess) Environment.SetEnvironmentVariable("OsClientDbType", databaseType);
            action(tenant);
        }
        finally
        {
            ConfigHelper.Configuration = originalConfiguration;
            foreach (var key in keys) Environment.SetEnvironmentVariable(key, processValues[key]);
        }
    }
}

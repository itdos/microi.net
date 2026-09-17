using Microi.net;
using MongoDB.Driver;
using System.Reflection;

namespace Microi.Tests.Common;

public sealed class MongoSystemLogConfigurationTests
{
    private static MongoClientSettings BuildSettings(string connection)
    {
        var method = typeof(MongodbClient<SysLog>).GetMethod("CreateClient", BindingFlags.NonPublic | BindingFlags.Static);
        Assert.NotNull(method);
        var client = (MongoClient)method.Invoke(null, new object[] { connection })!;
        return client.Settings;
    }

    [Fact]
    public void Legacy_mongo_timeouts_default_to_a_bounded_socket_window_that_tolerates_slow_operations()
    {
        var settings = BuildSettings("mongodb://127.0.0.1:27017/sys_log_demo");

        // 不可用端点继续快速失败，避免请求被不可达的 MongoDB 拖死。
        Assert.Equal(TimeSpan.FromSeconds(2), settings.ServerSelectionTimeout);
        Assert.Equal(TimeSpan.FromSeconds(2), settings.ConnectTimeout);
        // 旧版服务端的索引读取/正则扫描单次往返可能超过 2 秒，默认必须有更大上限。
        Assert.Equal(TimeSpan.FromSeconds(15), settings.SocketTimeout);
    }

    [Theory]
    [InlineData("socketTimeoutMS=45000", 45)]
    [InlineData("socketTimeoutMS=8000", 8)]
    [InlineData("SOCKETTIMEOUTMS=60000", 60)]
    public void Explicit_socket_timeout_from_the_tenant_connection_string_is_never_overridden(string option, int seconds)
    {
        var settings = BuildSettings($"mongodb://127.0.0.1:27017/sys_log_demo?{option}");

        Assert.Equal(TimeSpan.FromSeconds(seconds), settings.SocketTimeout);
    }

    [Fact]
    public void Explicit_server_selection_and_connect_timeouts_are_respected()
    {
        var settings = BuildSettings("mongodb://127.0.0.1:27017/sys_log_demo?serverSelectionTimeoutMS=9000&connectTimeoutMS=11000");

        Assert.Equal(TimeSpan.FromSeconds(9), settings.ServerSelectionTimeout);
        Assert.Equal(TimeSpan.FromSeconds(11), settings.ConnectTimeout);
        Assert.Equal(TimeSpan.FromSeconds(15), settings.SocketTimeout);
    }

    [Fact]
    public void MongodbClient_MissingConnectionExplainsMainTenantConfigurationAndRefresh()
    {
        var exception = Assert.Throws<InvalidOperationException>(() =>
            MongodbClient<SysLog>.MongodbDatabase(new MongodbHost
            {
                DataBase = "sys_log_junchi",
                Table = "log_202608"
            }));

        Assert.Contains("MongoDB连接字符串为空", exception.Message);
        Assert.Contains("主租户", exception.Message);
        Assert.Contains("刷新租户运行时配置", exception.Message);
    }

    [Fact]
    public void MongodbClient_MissingDatabaseNameReturnsActionableErrorBeforeOpeningAConnection()
    {
        var exception = Assert.Throws<InvalidOperationException>(() =>
            MongodbClient<SysLog>.MongodbDatabase(new MongodbHost
            {
                Connection = "mongodb://127.0.0.1:27017"
            }));

        Assert.Contains("MongoDB数据库名称为空", exception.Message);
    }
}

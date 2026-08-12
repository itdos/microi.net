using Microi.net;

namespace Microi.Tests.Common;

public sealed class MongoSystemLogConfigurationTests
{
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

using Dos.Common;
using Microi.net;
using Newtonsoft.Json.Linq;

namespace Microi.Tests.Common;

public sealed class PlatformBootstrapDatabaseDiagnosticsTests
{
    [Fact]
    public void PublicSysConfigFailure_ReportsInvalidHostInChineseWithoutLeakingSecrets()
    {
        var source = new DosResult(
            0,
            null,
            "Database connection is temporarily unavailable. Retry after 85 seconds.[GetTableData]",
            null,
            new
            {
                InnerException = "The host name or IP address is invalid. Server=wrong-host;Password=top-secret"
            });

        var result = PlatformBootstrapCompatibilityService.CreatePublicSysConfigFailure(source);
        var append = JObject.FromObject(result.DataAppend!);
        var serialized = JObject.FromObject(result).ToString();

        Assert.Equal(0, result.Code);
        Assert.Contains("数据库连接失败", result.Msg);
        Assert.Contains("数据库服务器地址无效", result.Msg);
        Assert.Contains("Data Source/Server", result.Msg);
        Assert.Contains("85秒", result.Msg);
        Assert.Equal("TenantDatabaseConnection", append.Value<string>("ErrorType"));
        Assert.Equal("DatabaseHostInvalid", append.Value<string>("ErrorCode"));
        Assert.Equal(85, append.Value<int>("RetryAfterSeconds"));
        Assert.DoesNotContain("wrong-host", serialized);
        Assert.DoesNotContain("top-secret", serialized);
    }

    [Fact]
    public void PublicSysConfigFailure_MapsGenericBackoffToActionableDatabaseGuide()
    {
        var source = new DosResult(
            0,
            null,
            "Database connection is temporarily unavailable. Retry after 47 seconds.[GetTableData]");

        var result = PlatformBootstrapCompatibilityService.CreatePublicSysConfigFailure(source);
        var append = JObject.FromObject(result.DataAppend!);

        Assert.Contains("数据库连接失败", result.Msg);
        Assert.Contains("数据库连接", result.Msg);
        Assert.Contains("只读数据库连接", result.Msg);
        Assert.Equal("DatabaseConnectionUnavailable", append.Value<string>("ErrorCode"));
        Assert.Equal(47, append.Value<int>("RetryAfterSeconds"));
    }
}

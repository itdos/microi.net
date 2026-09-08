using Microi.net;

namespace Dos.Common.Tests;

public sealed class TenantDatabaseProvisioningDiagnosticsTests
{
    private const string Connection = "Server=172.27.221.216;Port=1306;Database=microi_demo;Uid=microi_demo;Password=fixture-secret";

    [Fact]
    public void DeniedSystemDatabase_ExplainsPermissionsAndRetainsOriginalException()
    {
        var original = new InvalidOperationException("Authentication to host '172.27.221.216' for user 'microi_demo' using method 'mysql_native_password' failed with message: Access denied for user 'microi_demo'@'%' to database 'mysql'");
        var result = TenantDatabaseProvisioningException.Create(original, Connection, "检查数据库与账号是否已存在");
        Assert.Equal("InsufficientPrivileges", result.Category);
        Assert.Contains("数据库账号权限不足", result.Message);
        Assert.Contains("OsClientDbConn", result.Resolution);
        Assert.Contains("CREATE USER", result.Resolution);
        Assert.Contains("GRANT OPTION", result.Resolution);
        Assert.Contains("root", result.Resolution);
        Assert.Contains("microi_demo", result.ConnectionDescription);
        Assert.Contains("1306", result.ConnectionDescription);
        Assert.Contains(original.Message, result.OriginalError);
        Assert.Contains(original.GetType().FullName!, result.OriginalError);
        Assert.Same(original, result.InnerException);
        Assert.Contains("【原始错误详情】", result.ToAdministratorMessage());
    }

    [Theory]
    [InlineData("Access denied for user 'root'@'host' (using password: YES)", "AuthenticationFailed")]
    [InlineData("CREATE command denied to user 'business' for table 'x'", "InsufficientPrivileges")]
    [InlineData("Access denied; you need the CREATE USER privilege", "InsufficientPrivileges")]
    [InlineData("Unable to connect to any of the specified MySQL hosts", "DatabaseProvisioningFailed")]
    [InlineData("同名数据库或专属账号已存在", "DatabaseProvisioningFailed")]
    public void Diagnosis_DistinguishesAuthenticationPermissionsAndOtherFailures(string message, string category)
    {
        var result = TenantDatabaseProvisioningException.Create(new Exception(message), Connection, "创建数据库");
        Assert.Equal(category, result.Category);
        Assert.Contains(message, result.OriginalError);
    }

    [Fact]
    public void Details_RedactConnectionSecretsWithoutDiscardingInnerException()
    {
        var inner = new Exception("Access denied. Pwd=another-secret; host=database");
        var original = new Exception("Failure: "+Connection, inner);
        var result = TenantDatabaseProvisioningException.Create(original, Connection, "连接管理数据库");
        Assert.DoesNotContain("fixture-secret", result.ToAdministratorMessage());
        Assert.DoesNotContain("another-secret", result.ToAdministratorMessage());
        Assert.Contains("[REDACTED]", result.OriginalError);
        Assert.Contains("Access denied", result.OriginalError);
        Assert.DoesNotContain("【原始错误详情】", result.Message);
    }

    [Fact]
    public void QuotedPasswordWithSemicolon_IsNeverReturned()
    {
        const string connection = "Server=host;Database=main;User ID=manager;Password=\"secret;with=delimiter\"";
        var result = TenantDatabaseProvisioningException.Create(new Exception(connection), connection, "验证连接");
        Assert.DoesNotContain("secret;with=delimiter", result.ToAdministratorMessage());
        Assert.Contains("manager", result.ConnectionDescription);
    }
}

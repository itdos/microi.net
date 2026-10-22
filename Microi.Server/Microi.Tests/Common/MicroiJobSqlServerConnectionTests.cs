using Dos.ORM;
using Microi.net;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Quartz;
using SqlBuilder = Microsoft.Data.SqlClient.SqlConnectionStringBuilder;
using SqlEncrypt = Microsoft.Data.SqlClient.SqlConnectionEncryptOption;

namespace Microi.Tests.Common;

public sealed class MicroiJobSqlServerConnectionTests
{
    private const string Connection = "Server=localhost;Database=unused;User Id=unused;Password=unused";

    [Fact]
    public void Registration_PreservesTheEffectiveOrmEncryptionDefault()
    {
        // 相同旧连接串必须有相同 TLS 语义；仅检查真实注册选项，不连接示例数据库。
        var orm = new System.Data.SqlClient.SqlConnectionStringBuilder(Connection);
        var quartz = ReadRegisteredSqlConnection(Connection);

        Assert.False(orm.Encrypt);
        Assert.Equal(SqlEncrypt.Optional, quartz.Encrypt);
        Assert.False(quartz.TrustServerCertificate);
    }

    [Theory]
    [InlineData("Encrypt=true;TrustServerCertificate=false", "Mandatory", false)]
    [InlineData("Encrypt=true;TrustServerCertificate=true", "Mandatory", true)]
    [InlineData("Encrypt=false;TrustServerCertificate=false", "Optional", false)]
    [InlineData("Encrypt=false;TrustServerCertificate=true", "Optional", true)]
    [InlineData("Encrypt=Strict;TrustServerCertificate=false", "Strict", false)]
    [InlineData("Encrypt=Mandatory", "Mandatory", false)]
    [InlineData("Trust Server Certificate=true", "Optional", true)]
    [InlineData("eNcRyPt = False;Trust Server Certificate = False", "Optional", false)]
    public void Registration_PreservesExplicitTlsPolicy(string options, string encrypt, bool trust)
    {
        var quartz = ReadRegisteredSqlConnection(Connection + ";" + options);
        Assert.Equal(SqlEncrypt.Parse(encrypt), quartz.Encrypt);
        Assert.Equal(trust, quartz.TrustServerCertificate);
    }

    [Fact]
    public void Registration_DoesNotReadEncryptionOptionsFromQuotedCredentials()
    {
        var quartz = ReadRegisteredSqlConnection(
            "Server=localhost;Database=unused;User Id=unused;Password=\"test;Encrypt=true;TrustServerCertificate=true\"");
        Assert.Equal("test;Encrypt=true;TrustServerCertificate=true", quartz.Password);
        Assert.Equal(SqlEncrypt.Optional, quartz.Encrypt);
        Assert.False(quartz.TrustServerCertificate);
    }

    [Theory]
    [InlineData("")]
    [InlineData(";Encrypt=True;TrustServerCertificate=False")]
    [InlineData(";Encrypt=Strict;Host Name In Certificate=sql.example.invalid")]
    public void RebuildingTheScheduler_PreservesTheSameConnectionPolicy(string options)
    {
        var first = MicroiJobExtension.NormalizeQuartzConnectionString(DatabaseType.SqlServer, Connection + options);
        var second = MicroiJobExtension.NormalizeQuartzConnectionString(DatabaseType.SqlServer, first);
        Assert.Equal(first, second);
        Assert.Equal(ReadRegisteredSqlConnection(Connection + options).ConnectionString, second);
    }

    [Fact]
    public void SharedNormalization_KeepsTheExistingMySqlContract()
    {
        var input = "Server=localhost;Database=unused;User Id=unused;Password=unused;SslMode=None";
        Assert.Equal(ConnectionStringCompatibility.Normalize(DatabaseType.MySql, input, 100, 120, 600),
            MicroiJobExtension.NormalizeQuartzConnectionString(DatabaseType.MySql, input));
    }

    [Fact]
    public void InvalidExplicitEncryptionPolicyFailsInsteadOfFallingBack()
    {
        Assert.Throws<ArgumentException>(() => MicroiJobExtension.NormalizeQuartzConnectionString(
            DatabaseType.SqlServer, Connection + ";Encrypt=invalid"));
    }

    private static SqlBuilder ReadRegisteredSqlConnection(string connection)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddMicroiJob(connection, nameof(DatabaseType.SqlServer));
        using var provider = services.BuildServiceProvider();
        var options = provider.GetRequiredService<IOptions<QuartzOptions>>().Value;
        Assert.Equal("SqlServer", options["quartz.dataSource.default.provider"]);
        Assert.Contains(nameof(MicroiTenantSqlServerDelegate), options["quartz.jobStore.driverDelegateType"]);
        return new SqlBuilder(options["quartz.dataSource.default.connectionString"]);
    }
}

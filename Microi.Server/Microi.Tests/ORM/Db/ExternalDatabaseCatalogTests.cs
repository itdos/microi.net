using Dos.ORM;

namespace Dos.ORM.Tests.Db;

public class ExternalDatabaseCatalogTests
{
    [Fact]
    public void CertifiedCatalog_ContainsExactlySixRuntimePlatforms()
    {
        Assert.Equal(
            new[] { "MySql", "SqlServer", "Oracle", "PostgreSql", "DaMeng", "KingBase" },
            ExternalDatabaseCatalog.Definitions.Select(item => item.Key).ToArray());
        Assert.All(ExternalDatabaseCatalog.Definitions, item =>
        {
            Assert.DoesNotContain("Password=;", item.ConnectionStringExample, StringComparison.OrdinalIgnoreCase);
            Assert.Contains("***", item.ConnectionStringExample);
        });
    }

    [Theory]
    [InlineData("mysql8", DatabaseType.MySql)]
    [InlineData("mssql", DatabaseType.SqlServer)]
    [InlineData("sqlserver9", DatabaseType.SqlServer)]
    [InlineData("oracle11g", DatabaseType.Oracle)]
    [InlineData("npgsql", DatabaseType.PostgreSql)]
    [InlineData("dm8", DatabaseType.DaMeng)]
    [InlineData("kingbasees-v9", DatabaseType.KingBase)]
    public void ResolveType_NormalizesSupportedAliases(string configuredName, DatabaseType expected)
    {
        Assert.Equal(expected, ExternalDatabaseCatalog.ResolveType(configuredName));
    }

    [Theory]
    [InlineData("Sqlite")]
    [InlineData("MsAccess")]
    [InlineData("future-db")]
    public void ResolveType_RejectsNonCertifiedProviders(string configuredName)
    {
        Assert.Throws<NotSupportedException>(() => ExternalDatabaseCatalog.ResolveType(configuredName));
    }

    [Fact]
    public void Redaction_RemovesPasswordsAndUserNames()
    {
        var redacted = ExternalDatabaseCatalog.RedactConnectionString(
            "Server=127.0.0.1;User Id=admin;Password=secret-value;Database=demo;");

        Assert.DoesNotContain("admin", redacted, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("secret-value", redacted, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("***", redacted);
    }

    [Theory]
    [InlineData("SELECT * FROM users")]
    [InlineData("WITH x AS (SELECT 1 AS id) SELECT * FROM x;")]
    [InlineData("SELECT 'delete from users' AS harmless_text")]
    public void ReadOnlySqlValidator_AcceptsSingleSelect(string sql)
    {
        ExternalDatabaseInspector.ValidateReadOnlySql(sql);
    }

    [Theory]
    [InlineData("UPDATE users SET status = 1")]
    [InlineData("SELECT * FROM users; DELETE FROM users")]
    [InlineData("WITH x AS (DELETE FROM users RETURNING *) SELECT * FROM x")]
    [InlineData("SELECT pg_read_file('/etc/passwd')")]
    [InlineData("SELECT * INTO copied_users FROM users")]
    [InlineData("SELECT NEXT VALUE FOR invoice_seq")]
    [InlineData("SELECT nextval('invoice_seq')")]
    public void ReadOnlySqlValidator_RejectsWritesAndFileAccess(string sql)
    {
        Assert.ThrowsAny<Exception>(() => ExternalDatabaseInspector.ValidateReadOnlySql(sql));
    }

    [Theory]
    [InlineData("")]
    [InlineData("Auto")]
    [InlineData("Execute")]
    public void AdministrativeSql_RequiresAnExplicitResultMode(string mode)
    {
        var error = Assert.Throws<ArgumentException>(() =>
            ExternalDatabaseInspector.ExecuteAdministrativeSql(
                "MySql",
                "Server=127.0.0.1;Database=unused;Uid=unused;Pwd=unused;",
                "DROP TABLE IF EXISTS audit_example",
                mode));

        Assert.Contains("Query、Scalar、NonQuery", error.Message);
    }
}

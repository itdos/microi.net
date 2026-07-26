using Dos.ORM;
using MySql.Data.MySqlClient;

namespace Microi.Tests.ORM.Compatibility;

public sealed class ConnectionStringCompatibilityTests
{
    [Theory]
    [InlineData("SslMode=None")]
    [InlineData("sslmode=false")]
    [InlineData("SSL Mode = None")]
    public void Normalize_TranslatesLegacyMySqlSslMode(string legacySetting)
    {
        var normalized = ConnectionStringCompatibility.Normalize(
            DatabaseType.MySql,
            $"Server=localhost;Database=microi;{legacySetting};",
            100,
            30);

        var builder = new MySqlConnectionStringBuilder(normalized);

        Assert.Equal(MySqlSslMode.Disabled, builder.SslMode);
        Assert.DoesNotContain("None", normalized, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Normalize_DefaultsMySqlSslModeToDisabled()
    {
        var normalized = ConnectionStringCompatibility.Normalize(
            DatabaseType.MySql,
            "Server=localhost;Database=microi;",
            100,
            30);

        var builder = new MySqlConnectionStringBuilder(normalized);

        Assert.Equal(MySqlSslMode.Disabled, builder.SslMode);
    }

    [Fact]
    public void Normalize_PreservesSupportedExplicitMySqlSslMode()
    {
        var normalized = ConnectionStringCompatibility.Normalize(
            DatabaseType.MySql,
            "Server=localhost;Database=microi;SslMode=Required;",
            100,
            30);

        var builder = new MySqlConnectionStringBuilder(normalized);

        Assert.Equal(MySqlSslMode.Required, builder.SslMode);
    }

    [Fact]
    public void Normalize_DoesNotRewriteOtherDatabaseConnectionStrings()
    {
        const string original = "Data Source=localhost;Database=microi;SslMode=None;";

        var normalized = ConnectionStringCompatibility.Normalize(
            DatabaseType.PostgreSql,
            original,
            100,
            30);

        Assert.Equal(original, normalized);
    }
}

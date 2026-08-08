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
    public void Normalize_RepairsUnquotedSemicolonInMySqlPassword()
    {
        const string original =
            "Server=localhost;Database=microi;User Id=root;Password=secret;User;SslMode=None;";
        var parseError = Assert.Throws<ArgumentException>(
            () => new MySqlConnectionStringBuilder(original));
        Assert.Contains("user;sslmode", parseError.Message, StringComparison.OrdinalIgnoreCase);

        var normalized = ConnectionStringCompatibility.Normalize(
            DatabaseType.MySql,
            original,
            100,
            30);

        var builder = new MySqlConnectionStringBuilder(normalized);
        Assert.Equal("root", builder.UserID);
        Assert.Equal("secret;User", builder.Password);
        Assert.Equal(MySqlSslMode.Disabled, builder.SslMode);
    }

    [Fact]
    public void DbSession_CreateConnection_RepairsUnquotedCredentialSemicolonAtProviderBoundary()
    {
        const string original =
            "Server=localhost;Database=microi;User Id=root;Password=secret;User;SslMode=None;";
        var session = new DbSession(DatabaseType.MySql, original);

        using var connection = session.Db.CreateConnection();
        var builder = new MySqlConnectionStringBuilder(connection.ConnectionString);

        Assert.Equal("root", builder.UserID);
        Assert.Equal("secret;User", builder.Password);
        Assert.Equal(MySqlSslMode.Disabled, builder.SslMode);
    }

    [Fact]
    public void Normalize_RepairsUnquotedSemicolonInMySqlUserId()
    {
        const string original =
            "Server=localhost;Database=microi;User Id=operator;User;SslMode=None;";

        var normalized = ConnectionStringCompatibility.Normalize(
            DatabaseType.MySql,
            original,
            100,
            30);

        var builder = new MySqlConnectionStringBuilder(normalized);
        Assert.Equal("operator;User", builder.UserID);
        Assert.Equal(MySqlSslMode.Disabled, builder.SslMode);
    }

    [Fact]
    public void Normalize_PreservesQuotedCredentialSemicolons()
    {
        const string original =
            "Server=localhost;Database=microi;User Id=root;Password=\"secret;User\";SslMode=None;";

        var normalized = ConnectionStringCompatibility.Normalize(
            DatabaseType.MySql,
            original,
            100,
            30);

        var builder = new MySqlConnectionStringBuilder(normalized);
        Assert.Equal("secret;User", builder.Password);
        Assert.Equal(MySqlSslMode.Disabled, builder.SslMode);
    }

    [Fact]
    public void Normalize_RepairsContinuationAfterAnInitiallyQuotedCredential()
    {
        const string original =
            "Server=localhost;Database=microi;User Id=root;Password=\"secret\";User;SslMode=None;";

        var normalized = ConnectionStringCompatibility.Normalize(
            DatabaseType.MySql,
            original,
            100,
            30);

        var builder = new MySqlConnectionStringBuilder(normalized);
        Assert.Equal("secret;User", builder.Password);
        Assert.Equal(MySqlSslMode.Disabled, builder.SslMode);
    }

    [Fact]
    public void Normalize_DoesNotGuessAStandaloneCredentialOption()
    {
        const string original =
            "Server=localhost;Database=microi;User;SslMode=None;";

        var normalized = ConnectionStringCompatibility.Normalize(
            DatabaseType.MySql,
            original,
            100,
            30);

        var parseError = Assert.Throws<ArgumentException>(
            () => new MySqlConnectionStringBuilder(normalized));
        Assert.Contains("user;sslmode", parseError.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Normalize_DoesNotConfuseOptionNamesInsideCredentialValues()
    {
        const string original =
            "Server=localhost;Database=microi;User Id=root;Password=\"secret;SslMode;Max Pool Size\";";

        var normalized = ConnectionStringCompatibility.Normalize(
            DatabaseType.MySql,
            original,
            100,
            30);

        var builder = new MySqlConnectionStringBuilder(normalized);
        Assert.Equal("secret;SslMode;Max Pool Size", builder.Password);
        Assert.Equal(MySqlSslMode.Disabled, builder.SslMode);
        Assert.Equal((uint)100, builder.MaximumPoolSize);
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

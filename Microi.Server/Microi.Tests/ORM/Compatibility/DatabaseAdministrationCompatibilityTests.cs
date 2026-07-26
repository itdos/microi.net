using System.Data.Common;
using System.Reflection;

namespace Dos.ORM.Tests.Compatibility;

public sealed class DatabaseAdministrationCompatibilityTests
{
    [Fact]
    public void MySqlTenantPrincipal_IsStableValidatedAndWithinMySqlLimit()
    {
        var first = DatabaseAdministrationCompatibility.BuildTenantPrincipalName(
            DatabaseType.MySql, "microi_customer_with_a_long_tenant_key");
        var second = DatabaseAdministrationCompatibility.BuildTenantPrincipalName(
            DatabaseType.MySql, "microi_customer_with_a_long_tenant_key");

        Assert.Equal(first, second);
        Assert.Matches("^[a-zA-Z_][a-zA-Z0-9_]{0,31}$", first);
        Assert.True(first.Length <= 32);
    }

    [Fact]
    public void MySqlPrincipalCommands_GrantOnlyTheRequestedDatabase_AndParameterizePassword()
    {
        var commands = DatabaseAdministrationCompatibility.BuildPrincipalCommands(
            DatabaseType.MySql, "microi_tenant_a", "mci_tenant_a_fixture8");

        Assert.Contains("mysql.user", commands.ExistsSql, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("IDENTIFIED BY @p0", commands.CreateSql, StringComparison.Ordinal);
        Assert.Contains("IDENTIFIED BY @p0", commands.AlterPasswordSql, StringComparison.Ordinal);
        Assert.Equal(
            "GRANT ALL PRIVILEGES ON `microi_tenant_a`.* TO 'mci_tenant_a_fixture8'@'%'",
            commands.GrantSql);
        Assert.DoesNotContain("GRANT OPTION", commands.GrantSql, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ScopedMySqlConnection_RemovesEveryRootCredentialAlias()
    {
        var password = DatabaseAdministrationCompatibility.GenerateSecurePassword();
        var connection = DatabaseAdministrationCompatibility.BuildScopedConnectionString(
            DatabaseType.MySql,
            "Server=127.0.0.1;Database=itdos;Uid=root;Pwd=root-secret;Allow User Variables=True",
            "microi_tenant_a",
            "mci_tenant_a_fixture8",
            password);
        var builder = new DbConnectionStringBuilder { ConnectionString = connection };

        Assert.Equal("microi_tenant_a", builder["database"]?.ToString());
        Assert.Equal("mci_tenant_a_fixture8", builder["user id"]?.ToString());
        Assert.Equal(password, builder["password"]?.ToString());
        Assert.DoesNotContain("root", connection, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("root-secret", connection, StringComparison.Ordinal);
    }

    [Fact]
    public void NonMySqlPrincipalProvisioning_FailsClosed()
    {
        var error = Assert.Throws<NotSupportedException>(() =>
            DatabaseAdministrationCompatibility.BuildTenantPrincipalName(
                DatabaseType.SqlServer, "microi_tenant_a"));

        Assert.Contains("拒绝回退使用主库账号", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void GeneratedPasswords_AreLongAndDifferent()
    {
        var first = DatabaseAdministrationCompatibility.GenerateSecurePassword();
        var second = DatabaseAdministrationCompatibility.GenerateSecurePassword();

        Assert.Equal(32, first.Length);
        Assert.Equal(32, second.Length);
        Assert.NotEqual(first, second);
        Assert.DoesNotContain(';', first);
        Assert.DoesNotContain('=', first);
        Assert.Contains(first, char.IsUpper);
        Assert.Contains(first, char.IsLower);
        Assert.Contains(first, char.IsDigit);
        Assert.Contains(first, ch => "!@$%_-".Contains(ch));
    }

    [Fact]
    public void SensitiveParameters_AreMarkedForEveryLoggingBoundary()
    {
        var session = new DbSession(
            DatabaseType.MySql,
            "Server=127.0.0.1;Database=test;Uid=test;Pwd=test");
        var section = session.FromSql("SELECT @secret")
            .AddSensitiveInParameter("secret", "must-not-be-logged");
        var commandField = typeof(Section).GetField(
            "cmd",
            BindingFlags.Instance | BindingFlags.NonPublic);
        var command = Assert.IsAssignableFrom<DbCommand>(commandField!.GetValue(section));

        Assert.True(Section.IsSensitiveParameter(command, "secret"));
        Assert.True(Section.IsSensitiveParameter(command, "@secret"));
        Assert.False(Section.IsSensitiveParameter(command, "other"));
    }
}

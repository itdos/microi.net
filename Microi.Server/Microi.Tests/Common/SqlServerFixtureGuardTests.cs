namespace Microi.Tests.Common;

public sealed class SqlServerFixtureGuardTests
{
    [Fact]
    public void Target_AllowsLegacyOrExactRegisteredFixture()
    {
        Assert.Null(SqlServerFixtureGuard.ValidateTarget("upgrade_fixture", null, null));
        Assert.Equal("sqlserver-fixture-20261022", SqlServerFixtureGuard.ValidateTarget(
            "microi_test_sqlserver_20261022", "microi_test_sqlserver_20261022", "sqlserver-fixture-20261022"));
    }

    [Theory]
    [InlineData("business", null, null)]
    [InlineData("upgrade_fixture", null, "sqlserver-fixture-20261022")]
    [InlineData("microi_test_sqlserver_20261022", "microi_test_sqlserver_20261022", null)]
    [InlineData("microi_test_sqlserver_20261022", "microi_test_sqlserver_20261022", "short")]
    [InlineData("microi_test_sqlserver_20261023", "microi_test_sqlserver_20261022", "sqlserver-fixture-20261022")]
    [InlineData("business", "business", "sqlserver-fixture-20261022")]
    public void Target_RejectsUnregisteredOrMismatchedDatabase(string database, string? configuredDatabase, string? owner)
    {
        Assert.ThrowsAny<Exception>(() => SqlServerFixtureGuard.ValidateTarget(database, configuredDatabase, owner));
    }
}

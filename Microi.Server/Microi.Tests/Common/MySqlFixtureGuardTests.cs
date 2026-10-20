using MySql.Data.MySqlClient;

namespace Microi.Tests.Common;

public class MySqlFixtureGuardTests
{
    private const string Owner = "shared-services-test-20261019";
    private static MySqlConnectionStringBuilder Target(string database, uint port = 63960) =>
        new() { Server = "127.0.0.1", Port = port, Database = database };

    [Theory]
    [InlineData("upgrade", "microi_test_upgrade_task_a_20261019")]
    [InlineData("upgrade", "microi_test_upgrade_task_b_20261019")]
    [InlineData("schedule", "microi_test_schedule_task_a_20261019")]
    public void ParallelFixturesAcceptDistinctExplicitNamesWithMatchingOwner(string scope, string name)
    {
        Assert.Equal(Owner, MySqlFixtureGuard.ValidateTarget(Target(name), scope, name, Owner));
        MySqlFixtureGuard.VerifyOwner(Owner, () => Owner);
    }

    [Theory]
    [InlineData("customer_production", "customer_production", Owner)]
    [InlineData("microi_test_upgrade_task_b_20261019", "microi_test_upgrade_task_a_20261019", Owner)]
    [InlineData("microi_test_upgrade_task_a_20261019", null, null)]
    [InlineData("microi_test_upgrade_task_a_20261019", "microi_test_upgrade_task_a_20261019", null)]
    [InlineData("microi_test_upgrade_task_a_20261019", "microi_test_upgrade_task_a_20261019", "short")]
    [InlineData("mysql", "mysql", Owner)]
    [InlineData("upgrade_fixture", null, Owner)]
    public void RejectsBusinessDatabaseUnregisteredNameOrIncompleteOwnership(string actual, string? expected, string? owner) =>
        Assert.NotNull(Record.Exception(() => MySqlFixtureGuard.ValidateTarget(Target(actual), "upgrade", expected, owner)));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("another-task-20261019")]
    public void MissingOrForeignPersistentOwnerFailsClosed(string? actual) =>
        Assert.NotNull(Record.Exception(() => MySqlFixtureGuard.VerifyOwner(Owner, () => actual)));

    [Fact]
    public void PersistentOwnerReadFailureCannotAuthorizeWrites() =>
        Assert.Throws<InvalidOperationException>(() => MySqlFixtureGuard.VerifyOwner(Owner, () => throw new InvalidOperationException("unavailable")));

    [Fact]
    public void DefaultPortDoesNotExemptNamedFixtureFromOwnerValidation() =>
        Assert.NotNull(Record.Exception(() => MySqlFixtureGuard.ValidateTarget(
            Target("microi_test_schedule_task_a_20261019", 62680), "schedule", "microi_test_schedule_task_a_20261019", null)));

    [Fact]
    public void LegacyDedicatedFixturesKeepTheirExistingNames()
    {
        Assert.Null(MySqlFixtureGuard.ValidateTarget(Target("upgrade_fixture"), "upgrade", null, null));
        Assert.Null(MySqlFixtureGuard.ValidateTarget(Target("schedule_gate"), "schedule", null, null));
        Assert.Null(MySqlFixtureGuard.ValidateTarget(Target("xqc_verify"), "upgrade", null, null, true));
        Assert.NotNull(Record.Exception(() => MySqlFixtureGuard.ValidateTarget(Target("xqc_verify"), "upgrade", null, null)));
    }
}

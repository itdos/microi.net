using System.Globalization;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Tests.TestInfrastructure;

internal static class PlanAssert
{
    internal static SqlCommandStep SingleSql(DatabaseExecutionPlan plan)
    {
        Assert.NotNull(plan);
        return Assert.IsType<SqlCommandStep>(Assert.Single(plan.Steps));
    }

    internal static SqlCommandStep PaginationDataStep(
        DatabaseExecutionPlan plan)
    {
        Assert.NotNull(plan);
        return Assert.Single(
            plan.Steps.OfType<SqlCommandStep>(),
            step => step.ResultShape == SqlResultShape.RowSet
                && step.ResultRole == PlanResultRole.Final);
    }

    internal static void IsCountThenData(DatabaseExecutionPlan plan)
    {
        Assert.NotNull(plan);
        var commands = plan.Steps.OfType<SqlCommandStep>().ToArray();
        Assert.Equal(2, commands.Length);
        Assert.Equal(SqlResultShape.Scalar, commands[0].ResultShape);
        Assert.Equal(PlanResultRole.Aggregate, commands[0].ResultRole);
        Assert.Equal(SqlResultShape.RowSet, commands[1].ResultShape);
        Assert.Equal(PlanResultRole.Final, commands[1].ResultRole);
    }

    internal static string Snapshot(DatabaseExecutionPlan plan)
    {
        Assert.NotNull(plan);
        return string.Join("\n", new[]
        {
            plan.Fingerprint.Value,
            plan.ResultShape.ToString(),
            plan.Atomicity.ToString(),
            plan.Steps.Count.ToString(CultureInfo.InvariantCulture)
        }.Concat(plan.Steps.Select(SnapshotStep)));
    }

    private static string SnapshotStep(DatabasePlanStep step)
    {
        var command = step as SqlCommandStep;
        if (command != null)
        {
            return string.Join("|", new[]
            {
                command.CommandText,
                command.ResultShape.ToString(),
                command.ResultRole.ToString(),
                command.ConnectionRole.ToString(),
                command.TransactionBehavior.ToString(),
                command.SourceMigrationStepId == null
                    ? "-"
                    : command.SourceMigrationStepId.Value,
                string.Join(",", command.Parameters.Select(x => x.Name))
            });
        }

        return step.GetType().FullName ?? step.GetType().Name;
    }
}

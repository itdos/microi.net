using System.Reflection;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;
using Dos.ORM.Tests.TestInfrastructure;

namespace Dos.ORM.Tests.Compilation;

public sealed partial class CompilationCoreTests
{
    [Fact]
    public void Alter_column_equal_impact_candidate_is_adopted()
    {
        var operation = SafetyEqualImpactAlter();
        var beforeComparison = Assert.IsType<BinaryExpression>(
            Assert.IsType<ComputedGenerationDefinition>(
                operation.Before.Generation).Expression);
        var afterComparison = Assert.IsType<BinaryExpression>(
            Assert.IsType<ComputedGenerationDefinition>(
                operation.After.Generation).Expression);
        var beforeOperand = Assert.IsType<ColumnExpression>(
            beforeComparison.Left);
        var afterOperand = Assert.IsType<ColumnExpression>(
            afterComparison.Left);
        Assert.NotSame(beforeOperand, afterOperand);
        var step = SafetyStep("equal-impact", operation);
        var plan = new MigrationPlan(
            new MigrationPlanId("equal-impact-plan"), new[] { step });

        var normalized = new SqlAstNormalizer().Normalize(plan);

        Assert.NotSame(plan, normalized);
        Assert.Same(plan.Id, normalized.Id);
        var normalizedStep = Assert.Single(normalized.Steps);
        Assert.NotSame(step, normalizedStep);
        Assert.Same(step.Id, normalizedStep.Id);
        Assert.Equal(step.Idempotency, normalizedStep.Idempotency);
        var normalizedOperation =
            Assert.IsType<AlterColumnOperation>(normalizedStep.Operation);
        Assert.NotSame(operation, normalizedOperation);
        Assert.Same(operation.Table, normalizedOperation.Table);
        Assert.Equal(DestructiveImpact.None, operation.Impact);
        Assert.Equal(operation.Impact, normalizedOperation.Impact);
        Assert.NotSame(operation.Before, normalizedOperation.Before);
        Assert.NotSame(operation.After, normalizedOperation.After);
        var normalizedBefore = SafetyAssertIsNull(normalizedOperation.Before);
        var normalizedAfter = SafetyAssertIsNull(normalizedOperation.After);
        Assert.Same(beforeOperand, normalizedBefore.Operand);
        Assert.Same(afterOperand, normalizedAfter.Operand);
    }

    [Fact]
    public void Alter_column_never_lowers_impact()
    {
        var operation = SafetyLowerImpactAlter();
        var step = SafetyStep("lower-impact", operation);
        var plan = new MigrationPlan(
            new MigrationPlanId("lower-impact-plan"), new[] { step });
        var wouldBeLowerImpact = new AlterColumnOperation(
            operation.Table,
            SafetyComputedColumn(SafetyIsNullCheck()),
            SafetyComputedColumn(SafetyIsNullCheck()));

        var normalized = new SqlAstNormalizer().Normalize(plan);

        Assert.Equal(DestructiveImpact.PotentialDataLoss, operation.Impact);
        Assert.Equal(DestructiveImpact.None, wouldBeLowerImpact.Impact);
        Assert.Same(plan, normalized);
        Assert.Same(plan.Fingerprint, normalized.Fingerprint);
        Assert.Same(step, normalized.Steps[0]);
        Assert.Same(operation, normalized.Steps[0].Operation);
        Assert.Same(operation.Before, SafetyAlter(normalized).Before);
        Assert.Same(operation.After, SafetyAlter(normalized).After);
    }

    [Fact]
    public void Unchanged_approved_migration_plan_retains_exact_gate()
    {
        var operation = new DropColumnOperation(
            AstSamples.ObjectName("T"),
            AstSamples.Id("Obsolete"),
            DropObjectBehavior.FailIfMissing);
        var step = SafetyStep("drop", operation);
        var plan = new MigrationPlan(
            new MigrationPlanId("unchanged-approved-plan"), new[] { step });
        var approved = SafetyApprove(plan);
        var approval = SafetyApproval(approved);

        var normalized = new SqlAstNormalizer().Normalize(approved);

        Assert.NotNull(approval);
        Assert.True(approved.ContainsDestructiveSteps);
        Assert.True(approved.CanApplyNeutralDestructiveSteps);
        Assert.Same(approved, normalized);
        Assert.Same(approved.Fingerprint, normalized.Fingerprint);
        Assert.Same(approval, SafetyApproval(normalized));
        Assert.True(normalized.CanApplyNeutralDestructiveSteps);
    }

    [Fact]
    public void Approved_plan_with_only_lower_impact_alter_retains_exact_gate()
    {
        var operation = SafetyLowerImpactAlter();
        var step = SafetyStep("lower-impact", operation);
        var plan = new MigrationPlan(
            new MigrationPlanId("approved-lower-impact-plan"), new[] { step });
        var approved = SafetyApprove(plan);
        var approval = SafetyApproval(approved);

        var normalized = new SqlAstNormalizer().Normalize(approved);

        Assert.NotNull(approval);
        Assert.True(approved.CanApplyNeutralDestructiveSteps);
        Assert.Same(approved, normalized);
        Assert.Same(step, normalized.Steps[0]);
        Assert.Same(operation, normalized.Steps[0].Operation);
        Assert.Same(approved.Fingerprint, normalized.Fingerprint);
        Assert.Same(approval, SafetyApproval(normalized));
        Assert.True(normalized.CanApplyNeutralDestructiveSteps);
    }

    [Fact]
    public void Changed_migration_plan_recomputes_fingerprint_and_drops_approval()
    {
        var retainedOperation = SafetyLowerImpactAlter();
        var retainedStep = SafetyStep("retained-lower-impact", retainedOperation);
        var rewrittenColumn = SafetyComputedColumn(
            SafetyNullComparison(reverseOperands: false));
        var rewrittenOperation = new AddColumnOperation(
            AstSamples.ObjectName("T"), rewrittenColumn);
        var rewrittenStep = SafetyStep("rewritten-sibling", rewrittenOperation);
        var plan = new MigrationPlan(
            new MigrationPlanId("changed-approved-plan"),
            new[] { retainedStep, rewrittenStep });
        var approved = SafetyApprove(plan);
        var approval = SafetyApproval(approved);

        var normalized = new SqlAstNormalizer().Normalize(approved);

        Assert.NotNull(approval);
        Assert.True(approved.CanApplyNeutralDestructiveSteps);
        Assert.NotSame(approved, normalized);
        Assert.Same(approved.Id, normalized.Id);
        Assert.NotEqual(approved.Fingerprint.Value, normalized.Fingerprint.Value);
        Assert.True(normalized.ContainsDestructiveSteps);
        Assert.False(normalized.CanApplyNeutralDestructiveSteps);
        Assert.Null(SafetyApproval(normalized));

        Assert.Same(retainedStep, normalized.Steps[0]);
        Assert.Same(retainedOperation, normalized.Steps[0].Operation);

        var normalizedStep = normalized.Steps[1];
        Assert.NotSame(rewrittenStep, normalizedStep);
        Assert.Same(rewrittenStep.Id, normalizedStep.Id);
        Assert.Equal(rewrittenStep.Idempotency, normalizedStep.Idempotency);
        var normalizedOperation =
            Assert.IsType<AddColumnOperation>(normalizedStep.Operation);
        Assert.NotSame(rewrittenOperation, normalizedOperation);
        Assert.Same(rewrittenOperation.Table, normalizedOperation.Table);
        Assert.NotSame(rewrittenColumn, normalizedOperation.Column);
        SafetyAssertIsNull(normalizedOperation.Column);
    }

    private static AlterColumnOperation SafetyEqualImpactAlter()
    {
        return new AlterColumnOperation(
            AstSamples.ObjectName("T"),
            SafetyComputedColumn(SafetyNullComparison(reverseOperands: false)),
            SafetyComputedColumn(SafetyNullComparison(reverseOperands: false)));
    }

    private static AlterColumnOperation SafetyLowerImpactAlter()
    {
        return new AlterColumnOperation(
            AstSamples.ObjectName("T"),
            SafetyComputedColumn(SafetyNullComparison(reverseOperands: false)),
            SafetyComputedColumn(SafetyNullComparison(reverseOperands: true)));
    }

    private static ColumnDefinition SafetyComputedColumn(SqlExpression expression)
    {
        return new ColumnDefinition(
            AstSamples.Id("Computed"),
            new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.Nullable,
            generation: new ComputedGenerationDefinition(
                expression, ComputedStorageKind.Stored));
    }

    private static SqlExpression SafetyNullComparison(bool reverseOperands)
    {
        var column = new ColumnExpression(AstSamples.Id("Source"));
        return reverseOperands
            ? new BinaryExpression(
                NullExpression.Instance, SqlBinaryOperator.Equal, column)
            : new BinaryExpression(
                column, SqlBinaryOperator.Equal, NullExpression.Instance);
    }

    private static SqlExpression SafetyIsNullCheck()
    {
        return new UnaryExpression(
            SqlUnaryOperator.IsNull,
            new ColumnExpression(AstSamples.Id("Source")));
    }

    private static MigrationStep SafetyStep(
        string id,
        SchemaOperation operation)
    {
        return new MigrationStep(
            new MigrationStepId(id),
            operation,
            MigrationIdempotencyMode.RequireChange);
    }

    private static MigrationPlan SafetyApprove(MigrationPlan plan)
    {
        var approval = plan.CreateDestructiveApproval(
            plan.DestructiveStepIds,
            new ApprovalReference("approval:" + plan.Id.Value));
        return plan.WithDestructiveApproval(approval);
    }

    private static DestructiveMigrationApproval? SafetyApproval(MigrationPlan plan)
    {
        var field = typeof(MigrationPlan).GetField(
            "_approval",
            BindingFlags.Instance | BindingFlags.NonPublic);
        if (field == null)
        {
            throw new InvalidOperationException(
                "MigrationPlan approval field was not found.");
        }
        return (DestructiveMigrationApproval?)field.GetValue(plan);
    }

    private static AlterColumnOperation SafetyAlter(MigrationPlan plan)
    {
        return Assert.IsType<AlterColumnOperation>(plan.Steps[0].Operation);
    }

    private static UnaryExpression SafetyAssertIsNull(ColumnDefinition column)
    {
        var generation =
            Assert.IsType<ComputedGenerationDefinition>(column.Generation);
        var unary = Assert.IsType<UnaryExpression>(generation.Expression);
        Assert.Equal(SqlUnaryOperator.IsNull, unary.Operator);
        Assert.IsType<ColumnExpression>(unary.Operand);
        return unary;
    }
}

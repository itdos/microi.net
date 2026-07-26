using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;
using Dos.ORM.Tests.TestInfrastructure;

namespace Dos.ORM.Tests.Compilation;

public sealed partial class CompilationCoreTests
{
    [Fact]
    public void Normalize_then_validate_preserves_dual_source_insert()
    {
        var root = AstSamples.DualSourceInsertWithNormalizableDescendant();
        var rows = root.Rows;
        var source = Assert.IsType<SelectStatement>(root.Source);
        var row = Assert.Single(rows);
        var comparison = PreservationAssertNormalizableNullComparison(
            Assert.Single(row.Values));

        var normalized = new SqlAstNormalizer().Normalize((SqlStatement)root);

        Assert.Same(root, normalized);
        Assert.Same(rows, root.Rows);
        Assert.Same(source, root.Source);
        Assert.Same(row, Assert.Single(root.Rows));
        Assert.Same(comparison, Assert.Single(root.Rows[0].Values));
        Assert.Equal(
            new[]
            {
                "AST_INSERT_SOURCE_SHAPE_INVALID\u001fInsert must contain exactly one values or select source.\u001f$.Source"
            },
            Snapshot(new SqlAstValidator().Validate(normalized)));
    }

    [Fact]
    public void Normalize_then_validate_preserves_bad_insert_row_arity()
    {
        var root = AstSamples.BadRowArityInsertWithNormalizableDescendant();
        var rows = root.Rows;
        var row = Assert.Single(rows);
        var values = row.Values;
        var comparison = PreservationAssertNormalizableNullComparison(values[0]);
        Assert.Single(root.Columns);
        Assert.Equal(2, values.Count);

        var normalized = new SqlAstNormalizer().Normalize((SqlStatement)root);

        Assert.Same(root, normalized);
        Assert.Same(rows, root.Rows);
        Assert.Same(row, Assert.Single(root.Rows));
        Assert.Same(values, root.Rows[0].Values);
        Assert.Same(comparison, root.Rows[0].Values[0]);
        Assert.Single(root.Columns);
        Assert.Equal(2, root.Rows[0].Values.Count);
        Assert.Equal(
            new[]
            {
                "AST_DML_ROW_ARITY_MISMATCH\u001fDML row value count must match target column count.\u001f$.Rows[0].Values"
            },
            Snapshot(new SqlAstValidator().Validate(normalized)));
    }

    [Fact]
    public void Normalize_then_validate_preserves_generation_plus_default()
    {
        var column = AstSamples.GenerationAndDefaultColumnWithNormalizableDescendant();
        var generation = Assert.IsType<ComputedGenerationDefinition>(column.Generation);
        var comparison = PreservationAssertNormalizableNullComparison(generation.Expression);
        var defaultValue = Assert.IsType<Int64DefaultDefinition>(column.DefaultValue);
        var root = new AddColumnOperation(AstSamples.ObjectName("T"), column);

        var normalized = new SqlAstNormalizer().Normalize((SqlStatement)root);

        Assert.Same(root, normalized);
        Assert.Same(column, root.Column);
        Assert.Same(generation, root.Column.Generation);
        Assert.Same(defaultValue, root.Column.DefaultValue);
        Assert.Same(
            comparison,
            Assert.IsType<ComputedGenerationDefinition>(root.Column.Generation).Expression);
        Assert.Equal(
            new[]
            {
                "AST_STRUCTURAL_SHAPE_INVALID\u001fSQL AST structural shape is invalid.\u001f$.Column.DefaultValue"
            },
            Snapshot(new SqlAstValidator().Validate(normalized)));
    }

    [Fact]
    public void Normalize_then_validate_preserves_invalid_fingerprint()
    {
        var root = AstSamples.MigrationPlanWithMalformedFingerprintAndNormalizableDescendant();
        var fingerprint = root.Fingerprint;
        var generation = PreservationGetComputedGeneration(root);
        var comparison = PreservationNormalizableNullComparison();
        SetAutoProperty(
            generation,
            nameof(ComputedGenerationDefinition.Expression),
            comparison);
        PreservationAssertNormalizableNullComparison(generation.Expression);
        Assert.Equal("invalid", fingerprint.Value);

        var normalized = new SqlAstNormalizer().Normalize(root);

        Assert.Same(root, normalized);
        Assert.Same(fingerprint, root.Fingerprint);
        Assert.Equal("invalid", root.Fingerprint.Value);
        Assert.Same(generation, PreservationGetComputedGeneration(root));
        Assert.Same(comparison, PreservationGetComputedGeneration(root).Expression);
        Assert.Equal(
            new[]
            {
                "AST_SCALAR_INVALID\u001fSQL AST scalar value is invalid.\u001f$.Fingerprint.Value"
            },
            Snapshot(new SqlAstValidator().Validate(normalized)));
    }

    [Fact]
    public void Normalize_unknown_subtype_within_budget_returns_exact_identity()
    {
        SqlExpression root = new UnknownSqlExpression();

        var normalized = new SqlAstNormalizer().Normalize(root);

        Assert.Same(root, normalized);
        Assert.Equal(
            new[]
            {
                "AST_UNKNOWN_NODE\u001fSQL AST contains an unknown node subtype.\u001f$"
            },
            Snapshot(new SqlAstValidator().Validate(normalized)));
    }

    [Fact]
    public void Normalize_missing_child_within_budget_returns_exact_identity()
    {
        var root = new BinaryExpression(
            BooleanExpression.True,
            SqlBinaryOperator.And,
            BooleanExpression.False);
        SetAutoProperty(root, nameof(BinaryExpression.Left), null);

        var normalized = new SqlAstNormalizer().Normalize(root);

        Assert.Same(root, normalized);
        Assert.Null(root.Left);
        Assert.Equal(
            new[]
            {
                "AST_REQUIRED_CHILD_MISSING\u001fSQL AST contains a missing required child.\u001f$.Left"
            },
            Snapshot(new SqlAstValidator().Validate(normalized)));
    }

    [Fact]
    public void Normalize_null_expression_uses_expression_parameter_name()
    {
        var exception = Assert.Throws<ArgumentNullException>(() =>
            new SqlAstNormalizer().Normalize((SqlExpression)null!));

        Assert.Equal("expression", exception.ParamName);
    }

    [Fact]
    public void Normalize_null_statement_uses_statement_parameter_name()
    {
        var exception = Assert.Throws<ArgumentNullException>(() =>
            new SqlAstNormalizer().Normalize((SqlStatement)null!));

        Assert.Equal("statement", exception.ParamName);
    }

    [Fact]
    public void Normalize_null_plan_uses_plan_parameter_name()
    {
        var exception = Assert.Throws<ArgumentNullException>(() =>
            new SqlAstNormalizer().Normalize((MigrationPlan)null!));

        Assert.Equal("plan", exception.ParamName);
    }

    [Fact]
    public void Normalize_depth_129_throws_fixed_expression_budget_exception()
    {
        var exception = Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SqlAstNormalizer().Normalize(UnaryChain(129)));

        PreservationAssertBudgetException(
            exception,
            "expression",
            "SQL AST traversal exceeds maximum depth 128.");
    }

    [Fact]
    public void Normalize_node_4097_throws_fixed_expression_budget_exception()
    {
        var exception = Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SqlAstNormalizer().Normalize(WideIn(4095)));

        PreservationAssertBudgetException(
            exception,
            "expression",
            "SQL AST traversal exceeds maximum node occurrence count 4096.");
    }

    [Fact]
    public void Normalize_collection_slot_16385_uses_expression_parameter_name()
    {
        var fixture = PreservationOversizedNullValueList(poisonIndex: 16384);

        var exception = Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SqlAstNormalizer().Normalize(fixture.Root));

        PreservationAssertBudgetException(
            exception,
            "expression",
            "SQL AST traversal exceeds maximum collection slot inspection count 16384.");
        Assert.Equal(16384, fixture.Values.TotalReads);
        Assert.Equal(16383, fixture.Values.HighestReadIndex);
        Assert.False(fixture.Values.PoisonIndexWasRead);
    }

    [Fact]
    public void Normalize_collection_slot_16385_uses_statement_parameter_name()
    {
        var fixture = PreservationOversizedNullValueList(poisonIndex: 16383);
        var root = new SelectStatement(new[]
        {
            new SelectProjection(fixture.Root)
        });

        var exception = Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SqlAstNormalizer().Normalize((SqlStatement)root));

        PreservationAssertBudgetException(
            exception,
            "statement",
            "SQL AST traversal exceeds maximum collection slot inspection count 16384.");
        Assert.Equal(16383, fixture.Values.TotalReads);
        Assert.Equal(16382, fixture.Values.HighestReadIndex);
        Assert.False(fixture.Values.PoisonIndexWasRead);
    }

    [Fact]
    public void Normalize_collection_slot_16385_uses_plan_parameter_name()
    {
        var fixture = PreservationOversizedNullValueList(poisonIndex: 16382);
        var root = PreservationPlanContaining(fixture.Root);

        var exception = Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SqlAstNormalizer().Normalize(root));

        PreservationAssertBudgetException(
            exception,
            "plan",
            "SQL AST traversal exceeds maximum collection slot inspection count 16384.");
        Assert.Equal(16382, fixture.Values.TotalReads);
        Assert.Equal(16381, fixture.Values.HighestReadIndex);
        Assert.False(fixture.Values.PoisonIndexWasRead);
    }

    [Fact]
    public void Empty_in_still_preflights_oversized_operand()
    {
        var root = new InExpression(
            UnaryChain(128),
            Array.Empty<SqlExpression>());

        var exception = Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SqlAstNormalizer().Normalize(root));

        PreservationAssertBudgetException(
            exception,
            "expression",
            "SQL AST traversal exceeds maximum depth 128.");
    }

    [Fact]
    public void Normalize_forged_cycle_stops_at_deterministic_budget()
    {
        var root = new UnaryExpression(
            SqlUnaryOperator.Not,
            BooleanExpression.True);
        SetAutoProperty(root, nameof(UnaryExpression.Operand), root);
        var normalizer = new SqlAstNormalizer();

        var first = Assert.Throws<ArgumentOutOfRangeException>(() =>
            normalizer.Normalize(root));
        var second = Assert.Throws<ArgumentOutOfRangeException>(() =>
            normalizer.Normalize(root));

        PreservationAssertBudgetException(
            first,
            "expression",
            "SQL AST traversal exceeds maximum depth 128.");
        PreservationAssertBudgetException(
            second,
            "expression",
            "SQL AST traversal exceeds maximum depth 128.");
        Assert.Equal(first.Message, second.Message);
    }

    private static BinaryExpression PreservationAssertNormalizableNullComparison(
        SqlExpression expression)
    {
        var comparison = Assert.IsType<BinaryExpression>(expression);
        Assert.Equal(SqlBinaryOperator.Equal, comparison.Operator);
        Assert.Same(NullExpression.Instance, comparison.Right);
        return comparison;
    }

    private static SqlExpression PreservationNormalizableNullComparison() =>
        new BinaryExpression(
            new ColumnExpression(AstSamples.Id("Value")),
            SqlBinaryOperator.Equal,
            NullExpression.Instance);

    private static ComputedGenerationDefinition PreservationGetComputedGeneration(
        MigrationPlan plan)
    {
        var step = Assert.Single(plan.Steps);
        var operation = Assert.IsType<CreateTableOperation>(step.Operation);
        var column = Assert.Single(operation.Table.Columns);
        return Assert.IsType<ComputedGenerationDefinition>(column.Generation);
    }

    private static void PreservationAssertBudgetException(
        ArgumentOutOfRangeException exception,
        string parameterName,
        string fixedMessage)
    {
        Assert.Equal(parameterName, exception.ParamName);
        Assert.Equal(
            new ArgumentOutOfRangeException(parameterName, fixedMessage).Message,
            exception.Message);
    }

    private static (InExpression Root, IndexedSlotList<SqlExpression> Values)
        PreservationOversizedNullValueList(int poisonIndex)
    {
        var values = new IndexedSlotList<SqlExpression>(
            count: 16385,
            valueFactory: _ => null!,
            poisonIndex: poisonIndex,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var root = new InExpression(
            BooleanExpression.True,
            Array.Empty<SqlExpression>());
        SetAutoProperty(root, nameof(InExpression.Values), values);
        return (root, values);
    }

    private static MigrationPlan PreservationPlanContaining(SqlExpression expression)
    {
        var generation = new ComputedGenerationDefinition(
            BooleanExpression.True,
            ComputedStorageKind.Virtual);
        var column = new ColumnDefinition(
            AstSamples.Id("Computed"),
            new SqlTypeDescriptor(LogicalDbType.Int32),
            ColumnNullability.Nullable,
            generation: generation);
        var operation = new CreateTableOperation(
            new TableDefinition(
                AstSamples.ObjectName("T"),
                new[] { column }),
            CreateObjectBehavior.FailIfExists);
        var plan = new MigrationPlan(
            new MigrationPlanId("preservation-budget"),
            new[]
            {
                new MigrationStep(
                    new MigrationStepId("create"),
                    operation,
                    MigrationIdempotencyMode.RequireChange)
            });
        SetAutoProperty(
            generation,
            nameof(ComputedGenerationDefinition.Expression),
            expression);
        return plan;
    }
}

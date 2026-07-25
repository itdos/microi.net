using System.Data;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;
using Dos.ORM.Tests.TestInfrastructure;

namespace Dos.ORM.Tests.Compilation;

public sealed partial class CompilationCoreTests
{
    [Fact]
    public void Null_equal_normalizes_to_is_null_in_both_orientations()
    {
        var column = new ColumnExpression(AstSamples.Id("Value"));
        var normalizer = new SqlAstNormalizer();

        var nullOnRight = normalizer.Normalize(new BinaryExpression(
            column, SqlBinaryOperator.Equal, NullExpression.Instance));
        var nullOnLeft = normalizer.Normalize(new BinaryExpression(
            NullExpression.Instance, SqlBinaryOperator.Equal, column));

        RewriteAssertUnary(nullOnRight, SqlUnaryOperator.IsNull, column);
        RewriteAssertUnary(nullOnLeft, SqlUnaryOperator.IsNull, column);
    }

    [Fact]
    public void Null_not_equal_normalizes_to_is_not_null_in_both_orientations()
    {
        var column = new ColumnExpression(AstSamples.Id("Value"));
        var normalizer = new SqlAstNormalizer();

        var nullOnRight = normalizer.Normalize(new BinaryExpression(
            column, SqlBinaryOperator.NotEqual, NullExpression.Instance));
        var nullOnLeft = normalizer.Normalize(new BinaryExpression(
            NullExpression.Instance, SqlBinaryOperator.NotEqual, column));

        RewriteAssertUnary(nullOnRight, SqlUnaryOperator.IsNotNull, column);
        RewriteAssertUnary(nullOnLeft, SqlUnaryOperator.IsNotNull, column);
    }

    [Fact]
    public void Null_to_null_comparisons_keep_the_null_singleton_operand()
    {
        var normalizer = new SqlAstNormalizer();

        var equal = normalizer.Normalize(new BinaryExpression(
            NullExpression.Instance,
            SqlBinaryOperator.Equal,
            NullExpression.Instance));
        var notEqual = normalizer.Normalize(new BinaryExpression(
            NullExpression.Instance,
            SqlBinaryOperator.NotEqual,
            NullExpression.Instance));

        RewriteAssertUnary(
            equal, SqlUnaryOperator.IsNull, NullExpression.Instance);
        RewriteAssertUnary(
            notEqual, SqlUnaryOperator.IsNotNull, NullExpression.Instance);
    }

    [Fact]
    public void Empty_in_normalizes_to_false_singleton()
    {
        var expression = new InExpression(
            new ColumnExpression(AstSamples.Id("Value")),
            Array.Empty<SqlExpression>());

        var normalized = new SqlAstNormalizer().Normalize(expression);

        Assert.Same(BooleanExpression.False, normalized);
    }

    [Theory]
    [InlineData(SqlBinaryOperator.GreaterThan)]
    [InlineData(SqlBinaryOperator.GreaterThanOrEqual)]
    [InlineData(SqlBinaryOperator.LessThan)]
    [InlineData(SqlBinaryOperator.LessThanOrEqual)]
    [InlineData(SqlBinaryOperator.Add)]
    [InlineData(SqlBinaryOperator.Subtract)]
    [InlineData(SqlBinaryOperator.Multiply)]
    [InlineData(SqlBinaryOperator.Divide)]
    [InlineData(SqlBinaryOperator.And)]
    [InlineData(SqlBinaryOperator.Or)]
    [InlineData(SqlBinaryOperator.Like)]
    public void Non_equality_null_comparisons_are_unchanged(
        SqlBinaryOperator @operator)
    {
        var column = new ColumnExpression(AstSamples.Id("Value"));
        var nullOnRight = new BinaryExpression(
            column, @operator, NullExpression.Instance);
        var nullOnLeft = new BinaryExpression(
            NullExpression.Instance, @operator, column);
        var normalizer = new SqlAstNormalizer();

        Assert.Same(nullOnRight, normalizer.Normalize(nullOnRight));
        Assert.Same(nullOnLeft, normalizer.Normalize(nullOnLeft));
    }

    [Theory]
    [InlineData(SqlBinaryOperator.Equal)]
    [InlineData(SqlBinaryOperator.NotEqual)]
    public void Equality_operators_without_null_keep_exact_identity(
        SqlBinaryOperator @operator)
    {
        var left = RewriteParameter("non_null_left");
        var right = new ColumnExpression(AstSamples.Id("NonNullRight"));
        var expression = new BinaryExpression(left, @operator, right);

        var normalized = new SqlAstNormalizer().Normalize(expression);

        Assert.Same(expression, normalized);
        Assert.Same(left, expression.Left);
        Assert.Same(right, expression.Right);
    }

    [Fact]
    public void Nonempty_in_keeps_shape_and_normalizes_descendants()
    {
        var unchanged = RewriteParameter("keep_parameter");
        var expression = new InExpression(
            RewriteNullComparison("Operand"),
            new SqlExpression[]
            {
                RewriteNullComparison("First"),
                unchanged
            });

        var normalized = Assert.IsType<InExpression>(
            new SqlAstNormalizer().Normalize(expression));

        Assert.NotSame(expression, normalized);
        Assert.Equal(2, normalized.Values.Count);
        Assert.Equal(
            SqlUnaryOperator.IsNull,
            Assert.IsType<UnaryExpression>(normalized.Operand).Operator);
        Assert.Equal(
            SqlUnaryOperator.IsNull,
            Assert.IsType<UnaryExpression>(normalized.Values[0]).Operator);
        Assert.Same(unchanged, normalized.Values[1]);
    }

    [Fact]
    public void Normalization_reuses_read_once_case_clause_observation()
    {
        var when = BooleanExpression.True;
        var then = RewriteNullComparison("ReadOnceCaseThen");
        var clause = new CaseWhenClause(when, then);
        var expression = new CaseExpression(new[] { clause });
        var clauses = new IndexedSlotList<CaseWhenClause>(
            1,
            _ => clause,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        SetAutoProperty(
            expression,
            nameof(CaseExpression.WhenClauses),
            clauses);

        var normalized = Assert.IsType<CaseExpression>(
            new SqlAstNormalizer().Normalize(expression));

        Assert.NotSame(expression, normalized);
        var normalizedClause = Assert.Single(normalized.WhenClauses);
        Assert.NotSame(clause, normalizedClause);
        Assert.Same(when, normalizedClause.When);
        RewriteAssertIsNull(normalizedClause.Then);
        Assert.Equal(1, clauses.CountReads);
        Assert.Equal(1, clauses.TotalReads);
        Assert.Equal(1, clauses.ReadsAt(0));
    }

    [Fact]
    public void Unchanged_root_and_subtree_keep_reference_identity()
    {
        var unchangedLeaf = new ColumnExpression(
            AstSamples.Id("Stable"), new SqlAlias("s"));
        var unchangedSubtree = new FunctionExpression(
            SemanticFunctions.Length,
            new[] { unchangedLeaf });
        var changedChild = RewriteNullComparison("Value");
        var root = new BinaryExpression(
            unchangedSubtree, SqlBinaryOperator.And, changedChild);
        var normalizer = new SqlAstNormalizer();

        Assert.Same(unchangedSubtree, normalizer.Normalize(unchangedSubtree));

        var normalized = Assert.IsType<BinaryExpression>(
            normalizer.Normalize(root));

        Assert.NotSame(root, normalized);
        Assert.Equal(SqlBinaryOperator.And, normalized.Operator);
        Assert.Same(unchangedSubtree, normalized.Left);
        Assert.NotSame(changedChild, normalized.Right);
        Assert.Equal(
            SqlUnaryOperator.IsNull,
            Assert.IsType<UnaryExpression>(normalized.Right).Operator);
    }

    [Fact]
    public void Changed_spine_rebuilds_only_necessary_ancestors()
    {
        var stableOperand = RewriteParameter("stable_operand");
        var stableUpper = new ColumnExpression(AstSamples.Id("Upper"));
        var changedLower = RewriteNullComparison("Lower");
        var between = new BetweenExpression(
            stableOperand, changedLower, stableUpper);
        var root = new UnaryExpression(SqlUnaryOperator.Not, between);

        var normalizedRoot = Assert.IsType<UnaryExpression>(
            new SqlAstNormalizer().Normalize(root));
        var normalizedBetween = Assert.IsType<BetweenExpression>(
            normalizedRoot.Operand);

        Assert.NotSame(root, normalizedRoot);
        Assert.Equal(SqlUnaryOperator.Not, normalizedRoot.Operator);
        Assert.NotSame(between, normalizedBetween);
        Assert.Same(stableOperand, normalizedBetween.Operand);
        Assert.Same(stableUpper, normalizedBetween.Upper);
        RewriteAssertUnary(
            normalizedBetween.Lower,
            SqlUnaryOperator.IsNull,
            Assert.IsType<ColumnExpression>(changedLower.Left));
    }

    [Fact]
    public void Second_normalization_returns_exact_first_reference()
    {
        var expression = new UnaryExpression(
            SqlUnaryOperator.Not,
            RewriteNullComparison("Value"));
        var normalizer = new SqlAstNormalizer();

        var first = normalizer.Normalize(expression);
        var second = normalizer.Normalize(first);

        Assert.NotSame(expression, first);
        Assert.Same(first, second);
        var outer = Assert.IsType<UnaryExpression>(first);
        Assert.Equal(SqlUnaryOperator.Not, outer.Operator);
        Assert.Equal(
            SqlUnaryOperator.IsNull,
            Assert.IsType<UnaryExpression>(outer.Operand).Operator);
    }

    [Fact]
    public void Returning_projection_is_normalized()
    {
        var table = AstSamples.ObjectName("AuditLog");
        var alias = new SqlAlias("returned_value");
        var where = BooleanExpression.False;
        var returning = new ReturningClause(new[]
        {
            new SelectProjection(
                RewriteNullComparison("Value"), alias)
        });
        var statement = new DeleteStatement(
            table, where, allowAllRows: false, returning: returning);

        var normalized = Assert.IsType<DeleteStatement>(
            new SqlAstNormalizer().Normalize(statement));

        Assert.NotSame(statement, normalized);
        Assert.Same(table, normalized.Table);
        Assert.Same(where, normalized.Where);
        Assert.False(normalized.AllowAllRows);
        Assert.NotSame(returning, normalized.Returning);
        Assert.Single(normalized.Returning.Projections);
        Assert.Same(alias, normalized.Returning.Projections[0].Alias);
        Assert.Equal(
            SqlUnaryOperator.IsNull,
            Assert.IsType<UnaryExpression>(
                normalized.Returning.Projections[0].Expression).Operator);
    }

    [Fact]
    public void Computed_generation_expression_is_normalized()
    {
        var table = AstSamples.ObjectName("Metrics");
        var name = AstSamples.Id("ComputedValue");
        var type = new SqlTypeDescriptor(LogicalDbType.Int32);
        var comment = new SchemaComment("computed metric");
        var generation = new ComputedGenerationDefinition(
            RewriteNullComparison("SourceValue"),
            ComputedStorageKind.Stored);
        var column = new ColumnDefinition(
            name,
            type,
            ColumnNullability.Nullable,
            generation: generation,
            comment: comment);
        var operation = new AddColumnOperation(table, column);

        var normalized = Assert.IsType<AddColumnOperation>(
            new SqlAstNormalizer().Normalize(operation));
        var normalizedGeneration = Assert.IsType<ComputedGenerationDefinition>(
            normalized.Column.Generation);

        Assert.NotSame(operation, normalized);
        Assert.Same(table, normalized.Table);
        Assert.Equal(DestructiveImpact.None, normalized.Impact);
        Assert.NotSame(column, normalized.Column);
        Assert.Same(name, normalized.Column.Name);
        Assert.Same(type, normalized.Column.Type);
        Assert.Equal(ColumnNullability.Nullable, normalized.Column.Nullability);
        Assert.Same(comment, normalized.Column.Comment);
        Assert.NotSame(generation, normalizedGeneration);
        Assert.Equal(ComputedStorageKind.Stored, normalizedGeneration.Storage);
        Assert.Equal(
            SqlUnaryOperator.IsNull,
            Assert.IsType<UnaryExpression>(
                normalizedGeneration.Expression).Operator);
    }

    [Fact]
    public void Expression_composites_normalize_every_child_path_and_preserve_shape()
    {
        var stable = RewriteParameter("stable");
        var castType = new SqlTypeDescriptor(LogicalDbType.Boolean);
        var searchedCase = new CaseExpression(
            new[]
            {
                new CaseWhenClause(
                    RewriteNullComparison("SearchedWhen"),
                    RewriteNullComparison("SearchedThen"))
            },
            RewriteNullComparison("SearchedElse"));
        var simpleCase = new CaseExpression(
            RewriteNullComparison("SimpleInput"),
            new[]
            {
                new CaseWhenClause(
                    stable,
                    RewriteNullComparison("SimpleThen"))
            },
            RewriteNullComparison("SimpleElse"));
        var root = new FunctionExpression(
            SemanticFunctions.Coalesce,
            new SqlExpression[]
            {
                new UnaryExpression(
                    SqlUnaryOperator.Not,
                    RewriteNullComparison("UnaryOperand")),
                new BetweenExpression(
                    RewriteNullComparison("BetweenOperand"),
                    RewriteNullComparison("BetweenLower"),
                    RewriteNullComparison("BetweenUpper")),
                searchedCase,
                simpleCase,
                new CastExpression(
                    RewriteNullComparison("CastValue"), castType),
                new AggregateExpression(
                    SemanticFunctions.Sum,
                    RewriteNullComparison("AggregateArgument"),
                    distinct: true)
            });

        var normalized = Assert.IsType<FunctionExpression>(
            new SqlAstNormalizer().Normalize(root));

        Assert.NotSame(root, normalized);
        Assert.Same(SemanticFunctions.Coalesce, normalized.Function);
        Assert.Equal(6, normalized.Arguments.Count);

        var unary = Assert.IsType<UnaryExpression>(normalized.Arguments[0]);
        Assert.Equal(SqlUnaryOperator.Not, unary.Operator);
        Assert.Equal(
            SqlUnaryOperator.IsNull,
            Assert.IsType<UnaryExpression>(unary.Operand).Operator);

        var between = Assert.IsType<BetweenExpression>(normalized.Arguments[1]);
        RewriteAssertIsNull(between.Operand);
        RewriteAssertIsNull(between.Lower);
        RewriteAssertIsNull(between.Upper);

        var normalizedSearched = Assert.IsType<CaseExpression>(
            normalized.Arguments[2]);
        Assert.Null(normalizedSearched.InputExpression);
        Assert.Single(normalizedSearched.WhenClauses);
        RewriteAssertIsNull(normalizedSearched.WhenClauses[0].When);
        RewriteAssertIsNull(normalizedSearched.WhenClauses[0].Then);
        RewriteAssertIsNull(normalizedSearched.ElseExpression);

        var normalizedSimple = Assert.IsType<CaseExpression>(
            normalized.Arguments[3]);
        RewriteAssertIsNull(normalizedSimple.InputExpression);
        Assert.Single(normalizedSimple.WhenClauses);
        Assert.Same(stable, normalizedSimple.WhenClauses[0].When);
        RewriteAssertIsNull(normalizedSimple.WhenClauses[0].Then);
        RewriteAssertIsNull(normalizedSimple.ElseExpression);

        var cast = Assert.IsType<CastExpression>(normalized.Arguments[4]);
        Assert.Same(castType, cast.Type);
        RewriteAssertIsNull(cast.Expression);

        var aggregate = Assert.IsType<AggregateExpression>(
            normalized.Arguments[5]);
        Assert.Same(SemanticFunctions.Sum, aggregate.Function);
        Assert.True(aggregate.Distinct);
        RewriteAssertIsNull(aggregate.Argument);
    }

    [Fact]
    public void Subquery_and_exists_query_paths_are_normalized()
    {
        var subqueryAlias = new SqlAlias("sub_value");
        var subquery = new SubqueryExpression(RewriteSelectOf(
            RewriteNullComparison("SubqueryValue"), subqueryAlias));
        var exists = new ExistsExpression(new SubqueryExpression(
            RewriteSelectOf(RewriteNullComparison("ExistsValue"))));
        var normalizer = new SqlAstNormalizer();

        var normalizedSubquery = Assert.IsType<SubqueryExpression>(
            normalizer.Normalize(subquery));
        var normalizedExists = Assert.IsType<ExistsExpression>(
            normalizer.Normalize(exists));

        Assert.NotSame(subquery, normalizedSubquery);
        var subquerySelect = Assert.IsType<SelectStatement>(
            normalizedSubquery.Query);
        Assert.Same(subqueryAlias, subquerySelect.Projections[0].Alias);
        RewriteAssertIsNull(subquerySelect.Projections[0].Expression);

        Assert.NotSame(exists, normalizedExists);
        Assert.NotSame(exists.Subquery, normalizedExists.Subquery);
        var existsSelect = Assert.IsType<SelectStatement>(
            normalizedExists.Subquery.Query);
        RewriteAssertIsNull(existsSelect.Projections[0].Expression);
    }

    [Fact]
    public void Select_expression_paths_preserve_aliases_flags_order_page_and_lock()
    {
        var tableAlias = new SqlAlias("source_alias");
        var projectionAlias = new SqlAlias("projection_alias");
        var stableProjection = new SelectProjection(
            new ColumnExpression(AstSamples.Id("StableProjection"), tableAlias),
            new SqlAlias("stable_projection"));
        var stableGroup = RewriteParameter("stable_group");
        var stableOrder = new OrderByExpression(
            new ColumnExpression(AstSamples.Id("StableOrder"), tableAlias),
            SqlSortDirection.Ascending,
            SqlNullSortOrder.First);
        var stableBoundary = RewriteParameter("stable_boundary");
        var lockSpec = new LockSpec(SqlLockMode.Share, SqlLockWait.SkipLocked);
        var statement = new SelectStatement(
            new NamedTableSource(AstSamples.ObjectName("Source"), tableAlias),
            new[]
            {
                new SelectProjection(
                    RewriteNullComparison("Projection"), projectionAlias),
                stableProjection
            },
            distinct: true,
            whereExpression: RewriteNullComparison("Where"),
            groupBy: new SqlExpression[]
            {
                RewriteNullComparison("Group"), stableGroup
            },
            havingExpression: RewriteNullComparison("Having"),
            orderBy: new[]
            {
                new OrderByExpression(
                    RewriteNullComparison("Order"),
                    SqlSortDirection.Descending,
                    SqlNullSortOrder.Last),
                stableOrder
            },
            page: new KeysetPageSpec(
                new SqlExpression[]
                {
                    RewriteNullComparison("Boundary"), stableBoundary
                },
                limit: 37),
            lockSpec: lockSpec);

        var normalized = Assert.IsType<SelectStatement>(
            new SqlAstNormalizer().Normalize(statement));

        Assert.NotSame(statement, normalized);
        Assert.True(normalized.Distinct);
        Assert.IsType<NamedTableSource>(normalized.From);
        Assert.Same(statement.From, normalized.From);

        Assert.Equal(2, normalized.Projections.Count);
        Assert.Same(projectionAlias, normalized.Projections[0].Alias);
        RewriteAssertIsNull(normalized.Projections[0].Expression);
        Assert.Same(stableProjection, normalized.Projections[1]);
        RewriteAssertIsNull(normalized.Where);

        Assert.Equal(2, normalized.GroupBy.Count);
        RewriteAssertIsNull(normalized.GroupBy[0]);
        Assert.Same(stableGroup, normalized.GroupBy[1]);
        RewriteAssertIsNull(normalized.Having);

        Assert.Equal(2, normalized.OrderBy.Count);
        Assert.Equal(SqlSortDirection.Descending, normalized.OrderBy[0].Direction);
        Assert.Equal(SqlNullSortOrder.Last, normalized.OrderBy[0].NullSortOrder);
        RewriteAssertIsNull(normalized.OrderBy[0].Expression);
        Assert.Same(stableOrder, normalized.OrderBy[1]);

        var page = Assert.IsType<KeysetPageSpec>(normalized.Page);
        Assert.Equal(37, page.Limit);
        Assert.Equal(2, page.Boundaries.Count);
        RewriteAssertIsNull(page.Boundaries[0]);
        Assert.Same(stableBoundary, page.Boundaries[1]);
        Assert.Same(lockSpec, normalized.Lock);
        Assert.Equal(SqlLockMode.Share, normalized.Lock.Mode);
        Assert.Equal(SqlLockWait.SkipLocked, normalized.Lock.Wait);
    }

    [Fact]
    public void From_join_and_derived_query_paths_are_normalized()
    {
        var leftAlias = new SqlAlias("left_source");
        var rightAlias = new SqlAlias("right_source");
        var left = new DerivedTableSource(
            RewriteSelectOf(RewriteNullComparison("LeftProjection")),
            leftAlias);
        var right = new DerivedTableSource(
            RewriteSelectOf(RewriteNullComparison("RightProjection")),
            rightAlias);
        var join = new JoinSource(
            left,
            SqlJoinType.Left,
            right,
            RewriteNullComparison("JoinCondition"));
        var stableProjection = new SelectProjection(
            new ColumnExpression(AstSamples.Id("Stable"), leftAlias));
        var statement = new SelectStatement(join, new[] { stableProjection });

        var normalized = Assert.IsType<SelectStatement>(
            new SqlAstNormalizer().Normalize(statement));
        var normalizedJoin = Assert.IsType<JoinSource>(normalized.From);
        var normalizedLeft = Assert.IsType<DerivedTableSource>(
            normalizedJoin.Left);
        var normalizedRight = Assert.IsType<DerivedTableSource>(
            normalizedJoin.Right);

        Assert.NotSame(statement, normalized);
        Assert.Same(stableProjection, normalized.Projections[0]);
        Assert.NotSame(join, normalizedJoin);
        Assert.Equal(SqlJoinType.Left, normalizedJoin.JoinType);
        RewriteAssertIsNull(normalizedJoin.Condition);

        Assert.NotSame(left, normalizedLeft);
        Assert.Same(leftAlias, normalizedLeft.Alias);
        RewriteAssertIsNull(normalizedLeft.Query.Projections[0].Expression);
        Assert.NotSame(right, normalizedRight);
        Assert.Same(rightAlias, normalizedRight.Alias);
        RewriteAssertIsNull(normalizedRight.Query.Projections[0].Expression);
    }

    [Fact]
    public void Cte_set_and_keyset_paths_preserve_order_and_metadata()
    {
        var stableProjection = new SelectProjection(
            new ColumnExpression(AstSamples.Id("Stable")));
        var changedCte = new CommonTableExpression(
            AstSamples.Id("ChangedCte"),
            new SelectStatement(new[]
            {
                new SelectProjection(RewriteNullComparison("CteChanged")),
                stableProjection
            }),
            new[] { AstSamples.Id("A"), AstSamples.Id("B") },
            recursive: true);
        var stableCte = new CommonTableExpression(
            AstSamples.Id("StableCte"),
            new SelectStatement(new[]
            {
                stableProjection,
                new SelectProjection(BooleanExpression.True)
            }),
            new[] { AstSamples.Id("A"), AstSamples.Id("B") });
        var changedSet = new SetOperationClause(
            SqlSetOperator.Except,
            new SelectStatement(new[]
            {
                new SelectProjection(RewriteNullComparison("SetChanged")),
                stableProjection
            }));
        var stableSet = new SetOperationClause(
            SqlSetOperator.UnionAll,
            new SelectStatement(new[]
            {
                stableProjection,
                new SelectProjection(BooleanExpression.False)
            }));
        var statement = new SelectStatement(
            new[]
            {
                stableProjection,
                new SelectProjection(BooleanExpression.True)
            },
            commonTableExpressions: new[] { changedCte, stableCte },
            setOperations: new[] { changedSet, stableSet });

        var normalized = Assert.IsType<SelectStatement>(
            new SqlAstNormalizer().Normalize(statement));

        Assert.NotSame(statement, normalized);
        Assert.Equal(2, normalized.CommonTableExpressions.Count);
        var normalizedCte = normalized.CommonTableExpressions[0];
        Assert.NotSame(changedCte, normalizedCte);
        Assert.Same(changedCte.Name, normalizedCte.Name);
        Assert.True(normalizedCte.Recursive);
        Assert.Equal(2, normalizedCte.Columns.Count);
        Assert.Same(changedCte.Columns[0], normalizedCte.Columns[0]);
        Assert.Same(changedCte.Columns[1], normalizedCte.Columns[1]);
        RewriteAssertIsNull(normalizedCte.Query.Projections[0].Expression);
        Assert.Same(stableProjection, normalizedCte.Query.Projections[1]);
        Assert.Same(stableCte, normalized.CommonTableExpressions[1]);

        Assert.Equal(2, normalized.SetOperations.Count);
        var normalizedSet = normalized.SetOperations[0];
        Assert.NotSame(changedSet, normalizedSet);
        Assert.Equal(SqlSetOperator.Except, normalizedSet.Operator);
        RewriteAssertIsNull(normalizedSet.RightQuery.Projections[0].Expression);
        Assert.Same(stableProjection, normalizedSet.RightQuery.Projections[1]);
        Assert.Same(stableSet, normalized.SetOperations[1]);
    }

    [Fact]
    public void Insert_values_source_and_returning_paths_are_normalized()
    {
        var table = AstSamples.ObjectName("Target");
        var firstColumn = AstSamples.Id("A");
        var secondColumn = AstSamples.Id("B");
        var stableValue = RewriteParameter("stable_value");
        var stableRow = new SqlInsertRow(new SqlExpression[]
        {
            stableValue, BooleanExpression.True
        });
        var returningAlias = new SqlAlias("insert_returning");
        var values = InsertStatement.Values(
            table,
            new[] { firstColumn, secondColumn },
            new[]
            {
                new SqlInsertRow(new SqlExpression[]
                {
                    RewriteNullComparison("Row1A"), stableValue
                }),
                new SqlInsertRow(new SqlExpression[]
                {
                    BooleanExpression.False, RewriteNullComparison("Row2B")
                }),
                stableRow
            },
            new ReturningClause(new[]
            {
                new SelectProjection(
                    RewriteNullComparison("Returning"), returningAlias)
            }));
        var sourceStableProjection = new SelectProjection(stableValue);
        var source = InsertStatement.FromSelect(
            table,
            new[] { firstColumn, secondColumn },
            new SelectStatement(new[]
            {
                new SelectProjection(RewriteNullComparison("SourceA")),
                sourceStableProjection
            }));
        var normalizer = new SqlAstNormalizer();

        var normalizedValues = Assert.IsType<InsertStatement>(
            normalizer.Normalize(values));
        var normalizedSource = Assert.IsType<InsertStatement>(
            normalizer.Normalize(source));

        Assert.NotSame(values, normalizedValues);
        Assert.Same(table, normalizedValues.Table);
        Assert.Equal(2, normalizedValues.Columns.Count);
        Assert.Same(firstColumn, normalizedValues.Columns[0]);
        Assert.Same(secondColumn, normalizedValues.Columns[1]);
        Assert.Null(normalizedValues.Source);
        Assert.Equal(3, normalizedValues.Rows.Count);
        RewriteAssertIsNull(normalizedValues.Rows[0].Values[0]);
        Assert.Same(stableValue, normalizedValues.Rows[0].Values[1]);
        Assert.Same(BooleanExpression.False, normalizedValues.Rows[1].Values[0]);
        RewriteAssertIsNull(normalizedValues.Rows[1].Values[1]);
        Assert.Same(stableRow, normalizedValues.Rows[2]);
        Assert.Same(returningAlias,
            normalizedValues.Returning.Projections[0].Alias);
        RewriteAssertIsNull(
            normalizedValues.Returning.Projections[0].Expression);

        Assert.NotSame(source, normalizedSource);
        Assert.Empty(normalizedSource.Rows);
        Assert.NotNull(normalizedSource.Source);
        RewriteAssertIsNull(normalizedSource.Source.Projections[0].Expression);
        Assert.Same(sourceStableProjection,
            normalizedSource.Source.Projections[1]);
        Assert.Null(normalizedSource.Returning);
    }

    [Fact]
    public void Normalization_reuses_read_once_collections_during_path_copy()
    {
        var table = AstSamples.ObjectName("ReadOnceTarget");
        var firstColumn = AstSamples.Id("A");
        var secondColumn = AstSamples.Id("B");
        var comparison = RewriteNullComparison("ReadOnceValue");
        var stable = RewriteParameter("read_once_stable");
        var row = new SqlInsertRow(new SqlExpression[]
        {
            comparison, stable
        });
        var rowValues = new IndexedSlotList<SqlExpression>(
            2,
            index => index == 0 ? comparison : stable,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);

        var columns = new IndexedSlotList<SqlIdentifier>(
            2,
            index => index == 0 ? firstColumn : secondColumn,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var rows = new IndexedSlotList<SqlInsertRow>(
            1,
            _ => row,
            throwOnSecondRead: true,
            throwOnSecondCountRead: true);
        var statement = InsertStatement.Values(
            table,
            new[] { firstColumn, secondColumn },
            new[] { row });
        SetAutoProperty(row, nameof(SqlInsertRow.Values), rowValues);
        SetAutoProperty(statement, nameof(InsertStatement.Columns), columns);
        SetAutoProperty(statement, nameof(InsertStatement.Rows), rows);

        var normalized = Assert.IsType<InsertStatement>(
            new SqlAstNormalizer().Normalize((SqlStatement)statement));

        Assert.NotSame(statement, normalized);
        Assert.Same(table, normalized.Table);
        Assert.Same(firstColumn, normalized.Columns[0]);
        Assert.Same(secondColumn, normalized.Columns[1]);
        var normalizedRow = Assert.Single(normalized.Rows);
        Assert.NotSame(row, normalizedRow);
        RewriteAssertIsNull(normalizedRow.Values[0]);
        Assert.Same(stable, normalizedRow.Values[1]);

        Assert.Equal(1, columns.CountReads);
        Assert.Equal(2, columns.TotalReads);
        Assert.Equal(1, rows.CountReads);
        Assert.Equal(1, rows.TotalReads);
        Assert.Equal(1, rowValues.CountReads);
        Assert.Equal(2, rowValues.TotalReads);
    }

    [Fact]
    public void Update_delete_and_upsert_paths_are_normalized()
    {
        var table = AstSamples.ObjectName("Target");
        var id = AstSamples.Id("Id");
        var value = AstSamples.Id("Value");
        var stable = RewriteParameter("stable_assignment");
        var update = new UpdateStatement(
            table,
            new[]
            {
                new SqlAssignment(value, RewriteNullComparison("UpdateValue")),
                new SqlAssignment(id, stable)
            },
            RewriteNullComparison("UpdateWhere"),
            allowAllRows: false,
            returning: RewriteReturning("UpdateReturning"));
        var delete = new DeleteStatement(
            table,
            RewriteNullComparison("DeleteWhere"),
            allowAllRows: true,
            returning: RewriteReturning("DeleteReturning"));
        var upsert = new UpsertStatement(
            table,
            new[] { id },
            new[]
            {
                new SqlAssignment(id, stable),
                new SqlAssignment(value, RewriteNullComparison("UpsertInsert"))
            },
            new[]
            {
                new SqlAssignment(value, RewriteNullComparison("UpsertUpdate"))
            },
            ConflictPolicy.UpdateExisting,
            RewriteReturning("UpsertReturning"));
        var doNothingUpsert = new UpsertStatement(
            table,
            new[] { id },
            new[]
            {
                new SqlAssignment(id, stable),
                new SqlAssignment(value, BooleanExpression.False)
            },
            Array.Empty<SqlAssignment>(),
            ConflictPolicy.DoNothing,
            RewriteReturning("DoNothingReturning"));
        var normalizer = new SqlAstNormalizer();

        var normalizedUpdate = Assert.IsType<UpdateStatement>(
            normalizer.Normalize(update));
        var normalizedDelete = Assert.IsType<DeleteStatement>(
            normalizer.Normalize(delete));
        var normalizedUpsert = Assert.IsType<UpsertStatement>(
            normalizer.Normalize(upsert));
        var normalizedDoNothing = Assert.IsType<UpsertStatement>(
            normalizer.Normalize(doNothingUpsert));

        Assert.NotSame(update, normalizedUpdate);
        Assert.Same(table, normalizedUpdate.Table);
        Assert.False(normalizedUpdate.AllowAllRows);
        Assert.Equal(2, normalizedUpdate.Assignments.Count);
        Assert.Same(value, normalizedUpdate.Assignments[0].Column);
        RewriteAssertIsNull(normalizedUpdate.Assignments[0].Value);
        Assert.Same(update.Assignments[1], normalizedUpdate.Assignments[1]);
        RewriteAssertIsNull(normalizedUpdate.Where);
        RewriteAssertIsNull(
            normalizedUpdate.Returning.Projections[0].Expression);

        Assert.NotSame(delete, normalizedDelete);
        Assert.Same(table, normalizedDelete.Table);
        Assert.True(normalizedDelete.AllowAllRows);
        RewriteAssertIsNull(normalizedDelete.Where);
        RewriteAssertIsNull(
            normalizedDelete.Returning.Projections[0].Expression);

        Assert.NotSame(upsert, normalizedUpsert);
        Assert.Same(table, normalizedUpsert.Table);
        Assert.Equal(ConflictPolicy.UpdateExisting, normalizedUpsert.Policy);
        Assert.Single(normalizedUpsert.ConflictKeys);
        Assert.Same(id, normalizedUpsert.ConflictKeys[0]);
        Assert.Equal(2, normalizedUpsert.InsertAssignments.Count);
        Assert.Same(upsert.InsertAssignments[0],
            normalizedUpsert.InsertAssignments[0]);
        RewriteAssertIsNull(normalizedUpsert.InsertAssignments[1].Value);
        Assert.Single(normalizedUpsert.UpdateAssignments);
        RewriteAssertIsNull(normalizedUpsert.UpdateAssignments[0].Value);
        RewriteAssertIsNull(
            normalizedUpsert.Returning.Projections[0].Expression);

        Assert.NotSame(doNothingUpsert, normalizedDoNothing);
        Assert.Equal(ConflictPolicy.DoNothing, normalizedDoNothing.Policy);
        Assert.Empty(normalizedDoNothing.UpdateAssignments);
        Assert.Same(doNothingUpsert.InsertAssignments[0],
            normalizedDoNothing.InsertAssignments[0]);
        Assert.Same(doNothingUpsert.InsertAssignments[1],
            normalizedDoNothing.InsertAssignments[1]);
        RewriteAssertIsNull(
            normalizedDoNothing.Returning.Projections[0].Expression);
    }

    [Fact]
    public void Bulk_insert_rows_preserve_batch_columns_and_order()
    {
        var table = AstSamples.ObjectName("Target");
        var firstColumn = AstSamples.Id("A");
        var secondColumn = AstSamples.Id("B");
        var stableRow = new SqlInsertRow(new SqlExpression[]
        {
            BooleanExpression.True, BooleanExpression.False
        });
        var operation = new BulkInsertOperation(
            table,
            new[] { firstColumn, secondColumn },
            new[]
            {
                new SqlInsertRow(new SqlExpression[]
                {
                    RewriteNullComparison("BulkA"), BooleanExpression.True
                }),
                stableRow
            },
            batchSize: 23);

        var normalized = Assert.IsType<BulkInsertOperation>(
            new SqlAstNormalizer().Normalize(operation));

        Assert.NotSame(operation, normalized);
        Assert.Same(table, normalized.Table);
        Assert.Equal(23, normalized.BatchSize);
        Assert.Equal(2, normalized.Columns.Count);
        Assert.Same(firstColumn, normalized.Columns[0]);
        Assert.Same(secondColumn, normalized.Columns[1]);
        Assert.Equal(2, normalized.Rows.Count);
        RewriteAssertIsNull(normalized.Rows[0].Values[0]);
        Assert.Same(BooleanExpression.True, normalized.Rows[0].Values[1]);
        Assert.Same(stableRow, normalized.Rows[1]);
    }

    [Fact]
    public void Create_table_schema_lists_preserve_order_and_nonexpression_metadata()
    {
        var tableName = AstSamples.ObjectName("GeneratedTable");
        var id = AstSamples.Id("Id");
        var computedName = AstSamples.Id("Computed");
        var stableName = AstSamples.Id("Stable");
        var computed = new ColumnDefinition(
            computedName,
            new SqlTypeDescriptor(LogicalDbType.Boolean),
            ColumnNullability.Nullable,
            generation: new ComputedGenerationDefinition(
                RewriteNullComparison("Id"),
                ComputedStorageKind.Virtual));
        var stableColumn = new ColumnDefinition(
            stableName,
            new SqlTypeDescriptor(LogicalDbType.String, length: 80),
            ColumnNullability.NotNullable,
            defaultValue: new StringDefaultDefinition("stable"));
        var idColumn = new ColumnDefinition(
            id,
            new SqlTypeDescriptor(LogicalDbType.Int64),
            ColumnNullability.NotNullable);
        var primaryKey = new PrimaryKeyDefinition(
            AstSamples.Id("PK_GeneratedTable"), new[] { id });
        var unique = new UniqueConstraintDefinition(
            AstSamples.Id("UQ_GeneratedTable_Stable"),
            new[] { stableName });
        var firstIndex = new IndexDefinition(
            AstSamples.Id("IX_GeneratedTable_Stable"),
            new[]
            {
                new IndexColumnDefinition(
                    stableName, SqlSortDirection.Descending)
            },
            IndexUniqueness.NonUnique);
        var secondIndex = new IndexDefinition(
            AstSamples.Id("IX_GeneratedTable_Computed"),
            new[]
            {
                new IndexColumnDefinition(
                    computedName, SqlSortDirection.Ascending)
            },
            IndexUniqueness.Unique);
        var tableComment = new SchemaComment("ordered schema metadata");
        var table = new TableDefinition(
            tableName,
            new[] { idColumn, computed, stableColumn },
            new ConstraintDefinition[] { primaryKey, unique },
            new[] { firstIndex, secondIndex },
            tableComment);
        var operation = new CreateTableOperation(
            table, CreateObjectBehavior.AlreadySatisfiedIfExists);

        var normalized = Assert.IsType<CreateTableOperation>(
            new SqlAstNormalizer().Normalize(operation));

        Assert.NotSame(operation, normalized);
        Assert.Equal(CreateObjectBehavior.AlreadySatisfiedIfExists,
            normalized.Behavior);
        Assert.Equal(DestructiveImpact.None, normalized.Impact);
        Assert.NotSame(table, normalized.Table);
        Assert.Same(tableName, normalized.Table.Name);
        Assert.Same(tableComment, normalized.Table.Comment);
        Assert.Equal(3, normalized.Table.Columns.Count);
        Assert.Same(idColumn, normalized.Table.Columns[0]);
        Assert.NotSame(computed, normalized.Table.Columns[1]);
        Assert.Same(stableColumn, normalized.Table.Columns[2]);
        var normalizedGeneration =
            Assert.IsType<ComputedGenerationDefinition>(
                normalized.Table.Columns[1].Generation);
        Assert.Equal(ComputedStorageKind.Virtual, normalizedGeneration.Storage);
        RewriteAssertIsNull(normalizedGeneration.Expression);

        Assert.Equal(2, normalized.Table.Constraints.Count);
        Assert.Same(primaryKey, normalized.Table.Constraints[0]);
        Assert.Same(unique, normalized.Table.Constraints[1]);
        Assert.Equal(2, normalized.Table.Indexes.Count);
        Assert.Same(firstIndex, normalized.Table.Indexes[0]);
        Assert.Same(secondIndex, normalized.Table.Indexes[1]);
    }

    [Fact]
    public void Migration_step_and_plan_paths_are_normalized()
    {
        var table = AstSamples.ObjectName("Target");
        var changedOperation = new AddColumnOperation(
            table,
            new ColumnDefinition(
                AstSamples.Id("Computed"),
                new SqlTypeDescriptor(LogicalDbType.Boolean),
                ColumnNullability.Nullable,
                generation: new ComputedGenerationDefinition(
                    RewriteNullComparison("Source"),
                    ComputedStorageKind.Stored)));
        var changedStep = new MigrationStep(
            new MigrationStepId("add-computed"),
            changedOperation,
            MigrationIdempotencyMode.RequireChange);
        var stableOperation = new CreateTableOperation(
            new TableDefinition(
                AstSamples.ObjectName("StableTable"),
                new[]
                {
                    new ColumnDefinition(
                        AstSamples.Id("Id"),
                        new SqlTypeDescriptor(LogicalDbType.Int64),
                        ColumnNullability.NotNullable)
                }),
            CreateObjectBehavior.AlreadySatisfiedIfExists);
        var stableStep = new MigrationStep(
            new MigrationStepId("create-stable"),
            stableOperation,
            MigrationIdempotencyMode.AcceptAlreadySatisfied);
        var planId = new MigrationPlanId("normalization-plan");
        var plan = new MigrationPlan(
            planId, new[] { changedStep, stableStep });

        var normalized = new SqlAstNormalizer().Normalize(plan);

        Assert.NotSame(plan, normalized);
        Assert.Same(planId, normalized.Id);
        Assert.NotEqual(plan.Fingerprint.Value, normalized.Fingerprint.Value);
        Assert.Equal(2, normalized.Steps.Count);
        Assert.NotSame(changedStep, normalized.Steps[0]);
        Assert.Same(changedStep.Id, normalized.Steps[0].Id);
        Assert.Equal(MigrationIdempotencyMode.RequireChange,
            normalized.Steps[0].Idempotency);
        var normalizedOperation = Assert.IsType<AddColumnOperation>(
            normalized.Steps[0].Operation);
        Assert.NotSame(changedOperation, normalizedOperation);
        var generation = Assert.IsType<ComputedGenerationDefinition>(
            normalizedOperation.Column.Generation);
        RewriteAssertIsNull(generation.Expression);
        Assert.Same(stableStep, normalized.Steps[1]);
        Assert.Equal(MigrationIdempotencyMode.AcceptAlreadySatisfied,
            normalized.Steps[1].Idempotency);
        Assert.Equal(CreateObjectBehavior.AlreadySatisfiedIfExists,
            Assert.IsType<CreateTableOperation>(
                normalized.Steps[1].Operation).Behavior);
        Assert.False(normalized.ContainsDestructiveSteps);
        Assert.True(normalized.CanApplyNeutralDestructiveSteps);
    }

    [Fact]
    public void Nonrewrite_expression_families_keep_exact_identity_and_parameter_metadata()
    {
        var definition = new ParameterDefinition(
            "KeepCase_Parameter_01",
            new SqlTypeDescriptor(
                LogicalDbType.Decimal, precision: 19, scale: 4),
            ParameterDirection.InputOutput,
            isNullable: false);
        var parameter = new ParameterExpression(definition);
        var column = new ColumnExpression(
            AstSamples.Id("KeepCaseColumn"), new SqlAlias("KeepCaseAlias"));
        var expressions = new SqlExpression[]
        {
            BooleanExpression.True,
            new UnaryExpression(SqlUnaryOperator.Not, BooleanExpression.False),
            new BinaryExpression(
                parameter, SqlBinaryOperator.Add, column),
            new BinaryExpression(
                BooleanExpression.True,
                SqlBinaryOperator.And,
                BooleanExpression.False),
            new BetweenExpression(parameter, BooleanExpression.False,
                BooleanExpression.True),
            new CaseExpression(new[]
            {
                new CaseWhenClause(BooleanExpression.True, parameter)
            }, column),
            new CastExpression(parameter,
                new SqlTypeDescriptor(LogicalDbType.Int64)),
            new AggregateExpression(
                SemanticFunctions.Sum, parameter, distinct: true),
            new FunctionExpression(
                SemanticFunctions.Coalesce,
                new SqlExpression[] { parameter, column }),
            new ExistsExpression(new SubqueryExpression(
                RewriteSelectOf(parameter)))
        };
        var normalizer = new SqlAstNormalizer();

        foreach (var expression in expressions)
        {
            Assert.Same(expression, normalizer.Normalize(expression));
        }

        Assert.Equal("KeepCase_Parameter_01", definition.Name);
        Assert.Same(definition, parameter.Definition);
        Assert.Equal(LogicalDbType.Decimal, definition.Type.LogicalType);
        Assert.Equal(19, definition.Type.Precision);
        Assert.Equal(4, definition.Type.Scale);
        Assert.Equal(ParameterDirection.InputOutput, definition.Direction);
        Assert.False(definition.IsNullable);
        Assert.Equal("KeepCaseColumn", column.Name.Value);
        Assert.Equal("KeepCaseAlias", column.Source.Identifier.Value);
    }

    [Fact]
    public void Unchanged_statement_schema_and_migration_roots_keep_exact_identity()
    {
        var stableOrder = new OrderByExpression(
            new ColumnExpression(AstSamples.Id("Sort")),
            SqlSortDirection.Descending,
            SqlNullSortOrder.First);
        var page = new OffsetPageSpec(offset: 4, limit: 20);
        var lockSpec = new LockSpec(SqlLockMode.Update, SqlLockWait.NoWait);
        var select = new SelectStatement(
            new[] { new SelectProjection(RewriteParameter("projection")) },
            distinct: true,
            orderBy: new[] { stableOrder },
            page: page,
            lockSpec: lockSpec);
        var operation = new AddColumnOperation(
            AstSamples.ObjectName("Target"),
            new ColumnDefinition(
                AstSamples.Id("Stable"),
                new SqlTypeDescriptor(LogicalDbType.Int32),
                ColumnNullability.NotNullable,
                defaultValue: new Int64DefaultDefinition(7)));
        var step = new MigrationStep(
            new MigrationStepId("stable-step"),
            operation,
            MigrationIdempotencyMode.RequireChange);
        var plan = new MigrationPlan(
            new MigrationPlanId("stable-plan"), new[] { step });
        var fingerprint = plan.Fingerprint;
        var normalizer = new SqlAstNormalizer();

        Assert.Same(select, normalizer.Normalize(select));
        Assert.Same(plan, normalizer.Normalize(plan));
        Assert.Same(page, select.Page);
        Assert.Same(lockSpec, select.Lock);
        Assert.Same(stableOrder, select.OrderBy[0]);
        Assert.Equal(4, ((OffsetPageSpec)select.Page).Offset);
        Assert.Equal(20, ((OffsetPageSpec)select.Page).Limit);
        Assert.Same(fingerprint, plan.Fingerprint);
        Assert.Same(step, plan.Steps[0]);
        Assert.Same(operation, plan.Steps[0].Operation);
    }

    private static BinaryExpression RewriteNullComparison(
        string columnName,
        SqlBinaryOperator @operator = SqlBinaryOperator.Equal,
        bool nullOnLeft = false)
    {
        var column = new ColumnExpression(AstSamples.Id(columnName));
        return nullOnLeft
            ? new BinaryExpression(
                NullExpression.Instance, @operator, column)
            : new BinaryExpression(
                column, @operator, NullExpression.Instance);
    }

    private static ParameterExpression RewriteParameter(string name) =>
        new(new ParameterDefinition(
            name,
            new SqlTypeDescriptor(LogicalDbType.Int32),
            ParameterDirection.Input,
            isNullable: true));

    private static SelectStatement RewriteSelectOf(
        SqlExpression expression,
        SqlAlias? alias = null) =>
        new(new[] { new SelectProjection(expression, alias) });

    private static ReturningClause RewriteReturning(string columnName) =>
        new(new[]
        {
            new SelectProjection(RewriteNullComparison(columnName))
        });

    private static UnaryExpression RewriteAssertUnary(
        SqlExpression actual,
        SqlUnaryOperator expectedOperator,
        SqlExpression expectedOperand)
    {
        var unary = Assert.IsType<UnaryExpression>(actual);
        Assert.Equal(expectedOperator, unary.Operator);
        Assert.Same(expectedOperand, unary.Operand);
        return unary;
    }

    private static UnaryExpression RewriteAssertIsNull(SqlExpression actual)
    {
        var unary = Assert.IsType<UnaryExpression>(actual);
        Assert.Equal(SqlUnaryOperator.IsNull, unary.Operator);
        return unary;
    }

}

using System.Collections;
using System.Reflection;
using Dos.ORM.SqlAst;

namespace Dos.ORM.Tests.SqlAst;

public sealed class SelectStatementTests
{
    [Fact]
    public void Query_bases_are_abstract_sql_nodes()
    {
        Assert.True(typeof(SqlStatement).IsAbstract);
        Assert.True(typeof(SqlNode).IsAssignableFrom(typeof(SqlStatement)));
        Assert.True(typeof(SqlTableSource).IsAbstract);
        Assert.True(typeof(SqlNode).IsAssignableFrom(typeof(SqlTableSource)));
        Assert.True(typeof(PageSpec).IsAbstract);
        Assert.True(typeof(SqlNode).IsAssignableFrom(typeof(PageSpec)));
    }

    [Fact]
    public void Named_table_source_requires_a_structured_name_and_preserves_optional_alias()
    {
        var name = new SqlObjectName(new SqlIdentifier("Users"));
        var alias = new SqlAlias("u");

        var aliased = new NamedTableSource(name, alias);
        var unaliased = new NamedTableSource(name);

        Assert.Same(name, aliased.Name);
        Assert.Same(alias, aliased.Alias);
        Assert.Null(unaliased.Alias);
        Assert.Throws<ArgumentNullException>(() => new NamedTableSource(null!));
        Assert.DoesNotContain(typeof(NamedTableSource).GetConstructors(), constructor =>
            constructor.GetParameters().Any(parameter =>
                parameter.ParameterType == typeof(string)));
    }

    [Fact]
    public void Derived_table_source_requires_a_query_and_alias()
    {
        var query = SelectWithoutFrom();
        var alias = new SqlAlias("d");

        var source = new DerivedTableSource(query, alias);

        Assert.Same(query, source.Query);
        Assert.Same(alias, source.Alias);
        Assert.Throws<ArgumentNullException>(() =>
            new DerivedTableSource(null!, alias));
        Assert.Throws<ArgumentNullException>(() =>
            new DerivedTableSource(query, null!));
    }

    [Theory]
    [InlineData(SqlJoinType.Inner)]
    [InlineData(SqlJoinType.Left)]
    [InlineData(SqlJoinType.Right)]
    [InlineData(SqlJoinType.Full)]
    public void Non_cross_joins_require_a_condition(SqlJoinType joinType)
    {
        var left = Table("Users", "u");
        var right = Table("Departments", "d");
        var condition = new BinaryExpression(
            Column("DepartmentId", "u"),
            SqlBinaryOperator.Equal,
            Column("Id", "d"));

        var join = new JoinSource(left, joinType, right, condition);

        Assert.Same(left, join.Left);
        Assert.Equal(joinType, join.JoinType);
        Assert.Same(right, join.Right);
        Assert.Same(condition, join.Condition);
        Assert.Throws<ArgumentException>(() =>
            new JoinSource(left, joinType, right));
    }

    [Fact]
    public void Cross_join_requires_no_condition()
    {
        var left = Table("Users", "u");
        var right = Table("Departments", "d");

        var join = new JoinSource(left, SqlJoinType.Cross, right);

        Assert.Null(join.Condition);
        Assert.Throws<ArgumentException>(() =>
            new JoinSource(left, SqlJoinType.Cross, right, BooleanExpression.True));
    }

    [Fact]
    public void Join_source_rejects_null_sides_and_undefined_type()
    {
        var left = Table("Users", "u");
        var right = Table("Departments", "d");

        Assert.Throws<ArgumentNullException>(() =>
            new JoinSource(null!, SqlJoinType.Cross, right));
        Assert.Throws<ArgumentNullException>(() =>
            new JoinSource(left, SqlJoinType.Cross, null!));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new JoinSource(left, (SqlJoinType)int.MaxValue, right));
    }

    [Fact]
    public void Wildcard_expression_is_the_only_star_shape()
    {
        var source = new SqlAlias("u");

        var all = new WildcardExpression();
        var qualified = new WildcardExpression(source);

        Assert.Null(all.Source);
        Assert.Same(source, qualified.Source);
        Assert.IsAssignableFrom<SqlExpression>(all);
        Assert.DoesNotContain(typeof(WildcardExpression).GetConstructors(), constructor =>
            constructor.GetParameters().Any(parameter =>
                parameter.ParameterType == typeof(string) ||
                parameter.ParameterType == typeof(SqlIdentifier)));
    }

    [Fact]
    public void Projection_requires_an_expression_and_preserves_optional_output_alias()
    {
        var expression = Column("Name");
        var alias = new SqlAlias("DisplayName");

        var projection = new SelectProjection(expression, alias);

        Assert.Same(expression, projection.Expression);
        Assert.Same(alias, projection.Alias);
        Assert.Null(new SelectProjection(expression).Alias);
        Assert.Throws<ArgumentNullException>(() => new SelectProjection(null!));
    }

    [Fact]
    public void Order_by_requires_an_expression_and_defined_semantics()
    {
        var expression = Column("Name");

        var defaults = new OrderByExpression(expression);
        var explicitOrder = new OrderByExpression(
            expression, SqlSortDirection.Descending, SqlNullSortOrder.Last);

        Assert.Same(expression, defaults.Expression);
        Assert.Equal(SqlSortDirection.Ascending, defaults.Direction);
        Assert.Equal(SqlNullSortOrder.Default, defaults.NullSortOrder);
        Assert.Equal(SqlSortDirection.Descending, explicitOrder.Direction);
        Assert.Equal(SqlNullSortOrder.Last, explicitOrder.NullSortOrder);
        Assert.Throws<ArgumentNullException>(() => new OrderByExpression(null!));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new OrderByExpression(expression, (SqlSortDirection)int.MaxValue));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new OrderByExpression(
                expression, SqlSortDirection.Ascending,
                (SqlNullSortOrder)int.MaxValue));
    }

    [Theory]
    [InlineData(-1, 10)]
    [InlineData(0, 0)]
    [InlineData(0, -1)]
    public void Offset_page_rejects_invalid_sizes(int offset, int limit)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new OffsetPageSpec(offset, limit));
    }

    [Fact]
    public void Offset_page_preserves_non_negative_offset_and_positive_limit()
    {
        var page = new OffsetPageSpec(0, 20);

        Assert.Equal(0, page.Offset);
        Assert.Equal(20, page.Limit);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Keyset_page_rejects_non_positive_limit(int limit)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new KeysetPageSpec(Array.Empty<SqlExpression>(), limit));
    }

    [Fact]
    public void Keyset_page_copies_boundaries_and_keeps_parameter_references()
    {
        var boundary = new ParameterExpression(Parameter("afterId", LogicalDbType.Int64));
        var supplied = new List<SqlExpression> { boundary };

        var page = new KeysetPageSpec(supplied, 25);
        supplied.Clear();

        Assert.Single(page.Boundaries);
        Assert.Same(boundary, page.Boundaries[0]);
        Assert.Equal(25, page.Limit);
        AssertReadOnly(page.Boundaries, NullExpression.Instance);
        Assert.Throws<ArgumentNullException>(() =>
            new KeysetPageSpec(null!, 25));
        Assert.Throws<ArgumentException>(() =>
            new KeysetPageSpec(new SqlExpression[] { null! }, 25));
    }

    [Fact]
    public void Keyset_page_allows_empty_boundaries_for_later_shape_validation()
    {
        var page = new KeysetPageSpec(Array.Empty<SqlExpression>(), 25);

        Assert.Empty(page.Boundaries);
    }

    [Fact]
    public void Lock_spec_requires_defined_mode_and_wait_semantics()
    {
        var defaults = new LockSpec(SqlLockMode.Update);
        var shareSkip = new LockSpec(SqlLockMode.Share, SqlLockWait.SkipLocked);

        Assert.Equal(SqlLockMode.Update, defaults.Mode);
        Assert.Equal(SqlLockWait.Wait, defaults.Wait);
        Assert.Equal(SqlLockMode.Share, shareSkip.Mode);
        Assert.Equal(SqlLockWait.SkipLocked, shareSkip.Wait);
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new LockSpec((SqlLockMode)int.MaxValue));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new LockSpec(SqlLockMode.Update, (SqlLockWait)int.MaxValue));
    }

    [Fact]
    public void Common_table_expression_requires_structured_inputs_and_copies_columns()
    {
        var name = new SqlIdentifier("recent_users");
        var query = SelectWithoutFrom();
        var column = new SqlIdentifier("Id");
        var supplied = new List<SqlIdentifier> { column };

        var cte = new CommonTableExpression(
            name, query, supplied, recursive: true);
        supplied.Clear();

        Assert.Same(name, cte.Name);
        Assert.Same(query, cte.Query);
        Assert.True(cte.Recursive);
        Assert.Single(cte.Columns);
        Assert.Same(column, cte.Columns[0]);
        AssertReadOnly(cte.Columns, new SqlIdentifier("Other"));
        Assert.Throws<ArgumentNullException>(() =>
            new CommonTableExpression(null!, query));
        Assert.Throws<ArgumentNullException>(() =>
            new CommonTableExpression(name, null!));
        Assert.Throws<ArgumentException>(() =>
            new CommonTableExpression(
                name, query, new SqlIdentifier[] { null! }));
        Assert.DoesNotContain(typeof(CommonTableExpression).GetConstructors(), constructor =>
            constructor.GetParameters().Any(parameter =>
                parameter.ParameterType == typeof(string)));
    }

    [Fact]
    public void Common_table_expression_allows_an_omitted_column_list()
    {
        var cte = new CommonTableExpression(
            new SqlIdentifier("one"), SelectWithoutFrom());

        Assert.Empty(cte.Columns);
        Assert.False(cte.Recursive);
    }

    [Theory]
    [InlineData(SqlSetOperator.Union)]
    [InlineData(SqlSetOperator.UnionAll)]
    [InlineData(SqlSetOperator.Intersect)]
    [InlineData(SqlSetOperator.Except)]
    public void Set_operation_requires_a_defined_operator_and_right_query(
        SqlSetOperator setOperator)
    {
        var right = SelectWithoutFrom();

        var operation = new SetOperationClause(setOperator, right);

        Assert.Equal(setOperator, operation.Operator);
        Assert.Same(right, operation.RightQuery);
        Assert.Throws<ArgumentNullException>(() =>
            new SetOperationClause(setOperator, null!));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SetOperationClause((SqlSetOperator)int.MaxValue, right));
    }

    [Fact]
    public void Select_supports_table_first_construction_with_all_neutral_clauses()
    {
        var from = Table("Users", "u");
        var projection = new SelectProjection(Column("DepartmentId", "u"));
        var whereExpression = BooleanExpression.True;
        var groupExpression = Column("DepartmentId", "u");
        var havingExpression = BooleanExpression.True;
        var order = new OrderByExpression(groupExpression);
        var page = new OffsetPageSpec(0, 20);
        var lockSpec = new LockSpec(SqlLockMode.Share, SqlLockWait.NoWait);
        var cte = new CommonTableExpression(
            new SqlIdentifier("seed"), SelectWithoutFrom());
        var operation = new SetOperationClause(
            SqlSetOperator.UnionAll, SelectWithoutFrom());

        var statement = new SelectStatement(
            from,
            new[] { projection },
            distinct: true,
            whereExpression: whereExpression,
            groupBy: new[] { groupExpression },
            havingExpression: havingExpression,
            orderBy: new[] { order },
            page: page,
            lockSpec: lockSpec,
            commonTableExpressions: new[] { cte },
            setOperations: new[] { operation });

        Assert.Same(from, statement.From);
        Assert.Same(projection, statement.Projections[0]);
        Assert.True(statement.Distinct);
        Assert.Same(whereExpression, statement.Where);
        Assert.Same(groupExpression, statement.GroupBy[0]);
        Assert.Same(havingExpression, statement.Having);
        Assert.Same(order, statement.OrderBy[0]);
        Assert.Same(page, statement.Page);
        Assert.Same(lockSpec, statement.Lock);
        Assert.Same(cte, statement.CommonTableExpressions[0]);
        Assert.Same(operation, statement.SetOperations[0]);
    }

    [Fact]
    public void Select_without_from_uses_an_unambiguous_projections_first_shape()
    {
        var projection = new SelectProjection(BooleanExpression.True);

        var statement = new SelectStatement(new[] { projection });
        var constructors = typeof(SelectStatement).GetConstructors();

        Assert.Null(statement.From);
        Assert.Same(projection, statement.Projections[0]);
        Assert.Contains(constructors, constructor =>
        {
            var parameters = constructor.GetParameters();
            return parameters.Length >= 1 &&
                   parameters[0].ParameterType ==
                       typeof(IEnumerable<SelectProjection>);
        });
        Assert.Contains(constructors, constructor =>
        {
            var parameters = constructor.GetParameters();
            return parameters.Length >= 2 &&
                   parameters[0].ParameterType == typeof(SqlTableSource) &&
                   parameters[1].ParameterType ==
                       typeof(IEnumerable<SelectProjection>);
        });
        Assert.DoesNotContain(constructors, constructor =>
        {
            var parameters = constructor.GetParameters();
            return parameters.Length > 0 &&
                   parameters[0].ParameterType == typeof(SqlTableSource) &&
                   parameters[0].IsOptional;
        });
    }

    [Fact]
    public void Table_first_select_requires_a_real_from_source()
    {
        Assert.Throws<ArgumentNullException>(() =>
            new SelectStatement(
                null!, new[] { new SelectProjection(BooleanExpression.True) }));
    }

    [Fact]
    public void Select_requires_non_empty_projections_and_rejects_null_items()
    {
        var from = Table("Users", "u");

        Assert.Throws<ArgumentNullException>(() =>
            new SelectStatement((IEnumerable<SelectProjection>)null!));
        Assert.Throws<ArgumentNullException>(() =>
            new SelectStatement(from, null!));
        Assert.Throws<ArgumentException>(() =>
            new SelectStatement(Array.Empty<SelectProjection>()));
        Assert.Throws<ArgumentException>(() =>
            new SelectStatement(
                new SelectProjection[] { null! }));
    }

    [Fact]
    public void Select_defensively_copies_every_collection()
    {
        var projection = new SelectProjection(Column("Id"));
        var group = Column("DepartmentId");
        var order = new OrderByExpression(group);
        var cte = new CommonTableExpression(
            new SqlIdentifier("seed"), SelectWithoutFrom());
        var operation = new SetOperationClause(
            SqlSetOperator.Union, SelectWithoutFrom());
        var projections = new List<SelectProjection> { projection };
        var groups = new List<SqlExpression> { group };
        var orders = new List<OrderByExpression> { order };
        var ctes = new List<CommonTableExpression> { cte };
        var operations = new List<SetOperationClause> { operation };

        var statement = new SelectStatement(
            projections,
            groupBy: groups,
            orderBy: orders,
            commonTableExpressions: ctes,
            setOperations: operations);
        projections.Clear();
        groups.Clear();
        orders.Clear();
        ctes.Clear();
        operations.Clear();

        Assert.Single(statement.Projections);
        Assert.Single(statement.GroupBy);
        Assert.Single(statement.OrderBy);
        Assert.Single(statement.CommonTableExpressions);
        Assert.Single(statement.SetOperations);
        AssertReadOnly(statement.Projections, projection);
        AssertReadOnly(statement.GroupBy, group);
        AssertReadOnly(statement.OrderBy, order);
        AssertReadOnly(statement.CommonTableExpressions, cte);
        AssertReadOnly(statement.SetOperations, operation);
    }

    [Fact]
    public void Select_optional_collections_reject_null_items()
    {
        var projections = new[] { new SelectProjection(BooleanExpression.True) };

        Assert.Throws<ArgumentException>(() =>
            new SelectStatement(
                projections, groupBy: new SqlExpression[] { null! }));
        Assert.Throws<ArgumentException>(() =>
            new SelectStatement(
                projections, orderBy: new OrderByExpression[] { null! }));
        Assert.Throws<ArgumentException>(() =>
            new SelectStatement(
                projections,
                commonTableExpressions:
                    new CommonTableExpression[] { null! }));
        Assert.Throws<ArgumentException>(() =>
            new SelectStatement(
                projections,
                setOperations: new SetOperationClause[] { null! }));
    }

    [Fact]
    public void Select_optional_collections_default_to_empty_read_only_views()
    {
        var statement = SelectWithoutFrom();

        Assert.Empty(statement.GroupBy);
        Assert.Empty(statement.OrderBy);
        Assert.Empty(statement.CommonTableExpressions);
        Assert.Empty(statement.SetOperations);
    }

    [Fact]
    public void Set_order_and_pagination_belong_to_the_owning_select()
    {
        var order = new OrderByExpression(BooleanExpression.True);
        var page = new OffsetPageSpec(0, 10);
        var operation = new SetOperationClause(
            SqlSetOperator.Union, SelectWithoutFrom());

        var statement = new SelectStatement(
            new[] { new SelectProjection(BooleanExpression.True) },
            orderBy: new[] { order },
            page: page,
            setOperations: new[] { operation });

        Assert.Same(order, statement.OrderBy[0]);
        Assert.Same(page, statement.Page);
        Assert.DoesNotContain(
            typeof(SetOperationClause).GetProperties(),
            property => property.Name == nameof(SelectStatement.OrderBy) ||
                        property.Name == nameof(SelectStatement.Page));
    }

    [Fact]
    public void Offset_pagination_requires_order_by_as_a_shape_diagnostic()
    {
        var statement = SelectWithoutFrom(page: new OffsetPageSpec(20, 20));

        var diagnostics = SqlAstRules.ValidateShape(statement);

        var diagnostic = Assert.Single(diagnostics);
        Assert.Equal("AST_PAGE_ORDER_REQUIRED", diagnostic.Code);
        Assert.Equal("$.Page", diagnostic.Path);
        Assert.False(string.IsNullOrWhiteSpace(diagnostic.Message));
    }

    [Fact]
    public void Ordered_offset_pagination_has_no_shape_diagnostic()
    {
        var statement = SelectWithoutFrom(
            orderBy: new[] { new OrderByExpression(BooleanExpression.True) },
            page: new OffsetPageSpec(20, 20));

        Assert.Empty(SqlAstRules.ValidateShape(statement));
    }

    [Fact]
    public void Empty_keyset_requires_order_and_boundary_diagnostics()
    {
        var statement = SelectWithoutFrom(
            page: new KeysetPageSpec(Array.Empty<SqlExpression>(), 20));

        var diagnostics = SqlAstRules.ValidateShape(statement);

        Assert.Equal(
            new[]
            {
                "AST_KEYSET_ORDER_REQUIRED",
                "AST_KEYSET_BOUNDARY_REQUIRED"
            },
            diagnostics.Select(diagnostic => diagnostic.Code));
        Assert.All(diagnostics, diagnostic =>
            Assert.Equal("$.Page", diagnostic.Path));
    }

    [Fact]
    public void Keyset_order_and_boundary_counts_must_match()
    {
        var oneOrderNoBoundary = SelectWithoutFrom(
            orderBy: new[] { new OrderByExpression(Column("Id")) },
            page: new KeysetPageSpec(Array.Empty<SqlExpression>(), 20));
        var noOrderOneBoundary = SelectWithoutFrom(
            page: new KeysetPageSpec(
                new[] { new ParameterExpression(Parameter("afterId")) }, 20));
        var twoOrdersOneBoundary = SelectWithoutFrom(
            orderBy: new[]
            {
                new OrderByExpression(Column("Id")),
                new OrderByExpression(Column("CreatedAt"))
            },
            page: new KeysetPageSpec(
                new[] { new ParameterExpression(Parameter("afterId")) }, 20));

        Assert.Contains(
            SqlAstRules.ValidateShape(oneOrderNoBoundary),
            diagnostic => diagnostic.Code == "AST_KEYSET_ARITY_MISMATCH");
        Assert.Contains(
            SqlAstRules.ValidateShape(noOrderOneBoundary),
            diagnostic => diagnostic.Code == "AST_KEYSET_ARITY_MISMATCH");
        Assert.Contains(
            SqlAstRules.ValidateShape(twoOrdersOneBoundary),
            diagnostic => diagnostic.Code == "AST_KEYSET_ARITY_MISMATCH");
    }

    [Fact]
    public void Matching_ordered_keyset_has_no_shape_diagnostic()
    {
        var statement = SelectWithoutFrom(
            orderBy: new[] { new OrderByExpression(Column("Id")) },
            page: new KeysetPageSpec(
                new[] { new ParameterExpression(Parameter("afterId")) }, 20));

        Assert.Empty(SqlAstRules.ValidateShape(statement));
    }

    [Fact]
    public void Shape_validation_recurses_with_stable_preorder_paths()
    {
        var cteQuery = InvalidOffsetQuery();
        var leftQuery = InvalidOffsetQuery();
        var rightQuery = InvalidOffsetQuery();
        var setRightQuery = InvalidOffsetQuery();
        var join = new JoinSource(
            new DerivedTableSource(leftQuery, new SqlAlias("l")),
            SqlJoinType.Inner,
            new DerivedTableSource(rightQuery, new SqlAlias("r")),
            BooleanExpression.True);
        var root = new SelectStatement(
            join,
            new[] { new SelectProjection(new WildcardExpression()) },
            page: new OffsetPageSpec(0, 10),
            commonTableExpressions: new[]
            {
                new CommonTableExpression(
                    new SqlIdentifier("recursive_source"),
                    cteQuery,
                    recursive: true)
            },
            setOperations: new[]
            {
                new SetOperationClause(SqlSetOperator.UnionAll, setRightQuery)
            });

        var diagnostics = SqlAstRules.ValidateShape(root);

        Assert.Equal(
            new[]
            {
                ("AST_PAGE_ORDER_REQUIRED", "$.Page"),
                ("AST_PAGE_ORDER_REQUIRED",
                    "$.CommonTableExpressions[0].Query.Page"),
                ("AST_PAGE_ORDER_REQUIRED", "$.From.Left.Query.Page"),
                ("AST_PAGE_ORDER_REQUIRED", "$.From.Right.Query.Page"),
                ("AST_PAGE_ORDER_REQUIRED",
                    "$.SetOperations[0].RightQuery.Page")
            },
            diagnostics.Select(diagnostic => (diagnostic.Code, diagnostic.Path)));
    }

    [Fact]
    public void Shape_validation_returns_a_read_only_list_and_guards_null_root()
    {
        var diagnostics = SqlAstRules.ValidateShape(InvalidOffsetQuery());

        AssertReadOnly(diagnostics, diagnostics[0]);
        Assert.Throws<ArgumentNullException>(() =>
            SqlAstRules.ValidateShape(null!));
    }

    [Fact]
    public void Query_model_is_immutable_and_provider_neutral()
    {
        var concreteTypes = new[]
        {
            typeof(NamedTableSource),
            typeof(DerivedTableSource),
            typeof(JoinSource),
            typeof(WildcardExpression),
            typeof(SelectProjection),
            typeof(OrderByExpression),
            typeof(OffsetPageSpec),
            typeof(KeysetPageSpec),
            typeof(LockSpec),
            typeof(CommonTableExpression),
            typeof(SetOperationClause),
            typeof(SelectStatement),
            typeof(SqlAstDiagnostic)
        };

        Assert.All(concreteTypes, type =>
        {
            Assert.True(type.IsSealed, type.FullName);
            Assert.All(
                type.GetProperties(BindingFlags.Instance | BindingFlags.Public),
                property => Assert.Null(property.SetMethod));
        });

        var queryNodeTypes = concreteTypes
            .Where(type => type != typeof(SqlAstDiagnostic))
            .ToArray();
        Assert.All(queryNodeTypes, type =>
            Assert.True(typeof(SqlNode).IsAssignableFrom(type), type.FullName));
        Assert.DoesNotContain(
            queryNodeTypes.SelectMany(type => type.GetConstructors())
                .SelectMany(constructor => constructor.GetParameters()),
            parameter => parameter.ParameterType == typeof(string) ||
                         parameter.ParameterType == typeof(object));
        Assert.DoesNotContain(
            queryNodeTypes.SelectMany(type => type.GetProperties()),
            property => property.Name.Contains(
                "DatabaseType", StringComparison.OrdinalIgnoreCase) ||
                        property.PropertyType.Name.Contains(
                            "DatabaseType", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Query_enum_catalogs_are_stable()
    {
        Assert.Equal(
            new[] { "Inner", "Left", "Right", "Full", "Cross" },
            Enum.GetNames(typeof(SqlJoinType)));
        Assert.Equal(
            new[] { "Ascending", "Descending" },
            Enum.GetNames(typeof(SqlSortDirection)));
        Assert.Equal(
            new[] { "Default", "First", "Last" },
            Enum.GetNames(typeof(SqlNullSortOrder)));
        Assert.Equal(
            new[] { "Update", "Share" },
            Enum.GetNames(typeof(SqlLockMode)));
        Assert.Equal(
            new[] { "Wait", "NoWait", "SkipLocked" },
            Enum.GetNames(typeof(SqlLockWait)));
        Assert.Equal(
            new[] { "Union", "UnionAll", "Intersect", "Except" },
            Enum.GetNames(typeof(SqlSetOperator)));
    }

    private static SelectStatement InvalidOffsetQuery() =>
        SelectWithoutFrom(page: new OffsetPageSpec(0, 10));

    private static SelectStatement SelectWithoutFrom(
        IEnumerable<OrderByExpression>? orderBy = null,
        PageSpec? page = null) =>
        new(
            new[] { new SelectProjection(BooleanExpression.True) },
            orderBy: orderBy,
            page: page);

    private static NamedTableSource Table(string name, string alias) =>
        new(
            new SqlObjectName(new SqlIdentifier(name)),
            new SqlAlias(alias));

    private static ColumnExpression Column(string name, string? source = null) =>
        new(
            new SqlIdentifier(name),
            source == null ? null : new SqlAlias(source));

    private static ParameterDefinition Parameter(
        string name, LogicalDbType logicalType = LogicalDbType.Int64) =>
        new(name, new SqlTypeDescriptor(logicalType));

    private static void AssertReadOnly<T>(
        IReadOnlyList<T> values, T additionalValue)
    {
        if (values is ICollection<T> collection)
        {
            Assert.True(collection.IsReadOnly);
            Assert.Throws<NotSupportedException>(() =>
                collection.Add(additionalValue));
        }

        if (values is IList<T> genericList && genericList.Count > 0)
        {
            Assert.True(genericList.IsReadOnly);
            Assert.Throws<NotSupportedException>(() =>
                genericList[0] = additionalValue);
        }

        if (values is IList list)
        {
            Assert.True(list.IsReadOnly);
            Assert.Throws<NotSupportedException>(() =>
                list.Add(additionalValue));
            if (list.Count > 0)
            {
                Assert.Throws<NotSupportedException>(() =>
                    list[0] = additionalValue);
            }
        }
    }
}

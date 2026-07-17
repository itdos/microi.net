using System.Collections;
using System.Reflection;
using Dos.ORM.SqlAst;

namespace Dos.ORM.Tests.SqlAst;

public sealed class ExpressionAndFunctionTests
{
    [Fact]
    public void Sql_expression_is_an_abstract_sql_node()
    {
        Assert.True(typeof(SqlExpression).IsAbstract);
        Assert.True(typeof(SqlNode).IsAssignableFrom(typeof(SqlExpression)));
    }

    [Fact]
    public void Operator_catalogs_are_stable()
    {
        Assert.Equal(new[]
        {
            nameof(SqlBinaryOperator.Equal),
            nameof(SqlBinaryOperator.NotEqual),
            nameof(SqlBinaryOperator.GreaterThan),
            nameof(SqlBinaryOperator.GreaterThanOrEqual),
            nameof(SqlBinaryOperator.LessThan),
            nameof(SqlBinaryOperator.LessThanOrEqual),
            nameof(SqlBinaryOperator.Add),
            nameof(SqlBinaryOperator.Subtract),
            nameof(SqlBinaryOperator.Multiply),
            nameof(SqlBinaryOperator.Divide),
            nameof(SqlBinaryOperator.And),
            nameof(SqlBinaryOperator.Or),
            nameof(SqlBinaryOperator.Like)
        }, Enum.GetNames(typeof(SqlBinaryOperator)));

        Assert.Equal(new[]
        {
            nameof(SqlUnaryOperator.Not),
            nameof(SqlUnaryOperator.Negate),
            nameof(SqlUnaryOperator.IsNull),
            nameof(SqlUnaryOperator.IsNotNull)
        }, Enum.GetNames(typeof(SqlUnaryOperator)));
    }

    [Fact]
    public void Column_expression_requires_a_segment_and_preserves_optional_source()
    {
        var name = new SqlIdentifier("Name");
        var source = new SqlAlias("u");

        var qualified = new ColumnExpression(name, source);
        var unqualified = new ColumnExpression(name);

        Assert.Same(name, qualified.Name);
        Assert.Same(source, qualified.Source);
        Assert.Same(name, unqualified.Name);
        Assert.Null(unqualified.Source);
        Assert.Throws<ArgumentNullException>(() => new ColumnExpression(null!));
        Assert.DoesNotContain(typeof(ColumnExpression).GetConstructors(), constructor =>
            constructor.GetParameters().Any(parameter => parameter.ParameterType == typeof(string)));
    }

    [Fact]
    public void Parameter_expression_requires_value_free_definition_metadata()
    {
        var definition = Parameter("account");

        var expression = new ParameterExpression(definition);

        Assert.Same(definition, expression.Definition);
        Assert.DoesNotContain(expression.GetType().GetProperties(),
            property => property.Name == "Value");
        Assert.Throws<ArgumentNullException>(() => new ParameterExpression(null!));
    }

    [Fact]
    public void Null_expression_is_a_closed_singleton()
    {
        Assert.Same(NullExpression.Instance, NullExpression.Instance);
        Assert.IsAssignableFrom<SqlExpression>(NullExpression.Instance);
        Assert.Empty(typeof(NullExpression).GetConstructors());
    }

    [Fact]
    public void Boolean_expression_exposes_only_immutable_true_and_false_semantics()
    {
        Assert.Same(BooleanExpression.True, BooleanExpression.True);
        Assert.Same(BooleanExpression.False, BooleanExpression.False);
        Assert.True(BooleanExpression.True.Value);
        Assert.False(BooleanExpression.False.Value);
        Assert.NotSame(BooleanExpression.True, BooleanExpression.False);
        Assert.Empty(typeof(BooleanExpression).GetConstructors());
    }

    [Fact]
    public void Binary_expression_preserves_required_operands_and_operator()
    {
        var left = Column("Age");
        var right = new ParameterExpression(Parameter("minimumAge", LogicalDbType.Int32));

        var expression = new BinaryExpression(left, SqlBinaryOperator.GreaterThanOrEqual, right);

        Assert.Same(left, expression.Left);
        Assert.Equal(SqlBinaryOperator.GreaterThanOrEqual, expression.Operator);
        Assert.Same(right, expression.Right);
        Assert.Throws<ArgumentNullException>(() =>
            new BinaryExpression(null!, SqlBinaryOperator.Equal, right));
        Assert.Throws<ArgumentNullException>(() =>
            new BinaryExpression(left, SqlBinaryOperator.Equal, null!));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new BinaryExpression(left, (SqlBinaryOperator)int.MaxValue, right));
    }

    [Fact]
    public void Unary_expression_preserves_required_operand_and_operator()
    {
        var operand = Column("DeletedAt");

        var expression = new UnaryExpression(SqlUnaryOperator.IsNull, operand);

        Assert.Equal(SqlUnaryOperator.IsNull, expression.Operator);
        Assert.Same(operand, expression.Operand);
        Assert.Throws<ArgumentNullException>(() =>
            new UnaryExpression(SqlUnaryOperator.Not, null!));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new UnaryExpression((SqlUnaryOperator)int.MaxValue, operand));
    }

    [Fact]
    public void In_expression_accepts_an_empty_list_for_later_normalization()
    {
        var operand = Column("Id");

        var expression = new InExpression(operand, Array.Empty<SqlExpression>());

        Assert.Same(operand, expression.Operand);
        Assert.Empty(expression.Values);
    }

    [Fact]
    public void In_expression_defensively_copies_values_and_rejects_nulls()
    {
        var operand = Column("Id");
        var value = new ParameterExpression(Parameter("id"));
        var supplied = new List<SqlExpression> { value };

        var expression = new InExpression(operand, supplied);
        supplied.Clear();

        Assert.Single(expression.Values);
        Assert.Same(value, expression.Values[0]);
        AssertReadOnly(expression.Values, NullExpression.Instance);
        Assert.Throws<ArgumentNullException>(() =>
            new InExpression(null!, Array.Empty<SqlExpression>()));
        Assert.Throws<ArgumentNullException>(() => new InExpression(operand, null!));
        Assert.Throws<ArgumentException>(() =>
            new InExpression(operand, new SqlExpression[] { null! }));
    }

    [Fact]
    public void Between_expression_requires_and_preserves_all_operands()
    {
        var operand = Column("CreatedAt");
        var lower = new ParameterExpression(Parameter("from", LogicalDbType.DateTime));
        var upper = new ParameterExpression(Parameter("to", LogicalDbType.DateTime));

        var expression = new BetweenExpression(operand, lower, upper);

        Assert.Same(operand, expression.Operand);
        Assert.Same(lower, expression.Lower);
        Assert.Same(upper, expression.Upper);
        Assert.Throws<ArgumentNullException>(() => new BetweenExpression(null!, lower, upper));
        Assert.Throws<ArgumentNullException>(() => new BetweenExpression(operand, null!, upper));
        Assert.Throws<ArgumentNullException>(() => new BetweenExpression(operand, lower, null!));
    }

    [Fact]
    public void Case_when_clause_requires_and_preserves_when_then_expressions()
    {
        var when = new BinaryExpression(Column("Status"), SqlBinaryOperator.Equal,
            new ParameterExpression(Parameter("activeStatus", LogicalDbType.Int32)));
        var then = BooleanExpression.True;

        var clause = new CaseWhenClause(when, then);

        Assert.Same(when, clause.When);
        Assert.Same(then, clause.Then);
        Assert.Throws<ArgumentNullException>(() => new CaseWhenClause(null!, then));
        Assert.Throws<ArgumentNullException>(() => new CaseWhenClause(when, null!));
    }

    [Fact]
    public void Case_expression_supports_searched_and_simple_forms()
    {
        var clause = new CaseWhenClause(BooleanExpression.True, BooleanExpression.False);
        var elseExpression = NullExpression.Instance;
        var inputExpression = Column("Status");

        var searched = new CaseExpression(new[] { clause }, elseExpression: elseExpression);
        var simple = new CaseExpression(
            new[] { clause }, elseExpression: elseExpression, inputExpression: inputExpression);

        Assert.Null(searched.InputExpression);
        Assert.Same(elseExpression, searched.ElseExpression);
        Assert.Same(inputExpression, simple.InputExpression);
        Assert.Same(elseExpression, simple.ElseExpression);
        Assert.Same(clause, simple.WhenClauses[0]);
    }

    [Fact]
    public void Case_expression_requires_non_empty_clauses_and_defensively_copies_them()
    {
        var clause = new CaseWhenClause(BooleanExpression.True, BooleanExpression.False);
        var supplied = new List<CaseWhenClause> { clause };

        var expression = new CaseExpression(supplied);
        supplied.Clear();

        Assert.Single(expression.WhenClauses);
        AssertReadOnly(expression.WhenClauses, clause);
        Assert.Throws<ArgumentNullException>(() => new CaseExpression(null!));
        Assert.Throws<ArgumentException>(() =>
            new CaseExpression(Array.Empty<CaseWhenClause>()));
        Assert.Throws<ArgumentException>(() =>
            new CaseExpression(new CaseWhenClause[] { null! }));
    }

    [Fact]
    public void Cast_expression_requires_expression_and_portable_type_metadata()
    {
        var operand = Column("Amount");
        var type = new SqlTypeDescriptor(LogicalDbType.Decimal, precision: 18, scale: 2);

        var expression = new CastExpression(operand, type);

        Assert.Same(operand, expression.Expression);
        Assert.Same(type, expression.Type);
        Assert.Throws<ArgumentNullException>(() => new CastExpression(null!, type));
        Assert.Throws<ArgumentNullException>(() => new CastExpression(operand, null!));
    }

    [Fact]
    public void Subquery_expression_accepts_a_required_sql_node_placeholder()
    {
        var query = new PlaceholderQueryNode();

        var expression = new SubqueryExpression(query);

        Assert.Same(query, expression.Query);
        Assert.Throws<ArgumentNullException>(() => new SubqueryExpression(null!));
    }

    [Fact]
    public void Exists_expression_requires_a_subquery_without_a_negation_flag()
    {
        var subquery = new SubqueryExpression(new PlaceholderQueryNode());

        var expression = new ExistsExpression(subquery);

        Assert.Same(subquery, expression.Subquery);
        Assert.DoesNotContain(expression.GetType().GetProperties(),
            property => property.Name.Contains("Negat", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(expression.GetType().GetConstructors().Single().GetParameters(),
            parameter => parameter.ParameterType == typeof(bool));
        Assert.Throws<ArgumentNullException>(() => new ExistsExpression(null!));
    }

    [Fact]
    public void Function_expression_requires_a_registered_semantic_id()
    {
        var column = new ColumnExpression(new SqlIdentifier("Name"), new SqlAlias("u"));

        var function = new FunctionExpression(SemanticFunctions.Length, new[] { column });

        Assert.Same(SemanticFunctions.Length, function.Function);
        Assert.Single(function.Arguments);
        Assert.Throws<ArgumentNullException>(() =>
            new FunctionExpression(null!, Array.Empty<SqlExpression>()));
        Assert.Throws<ArgumentException>(() =>
            new FunctionExpression(CreateSemanticFunction("Unregistered", 0, null, false),
                Array.Empty<SqlExpression>()));
    }

    [Fact]
    public void Function_nodes_reject_equal_key_ids_not_owned_by_the_catalog()
    {
        var scalarClone = CreateSemanticFunction("Length", 1, 1, false);
        var aggregateClone = CreateSemanticFunction("Count", 0, 1, true);

        Assert.Equal(SemanticFunctions.Length, scalarClone);
        Assert.Equal(SemanticFunctions.Count, aggregateClone);
        Assert.Throws<ArgumentException>(() =>
            new FunctionExpression(scalarClone, Array.Empty<SqlExpression>()));
        Assert.Throws<ArgumentException>(() =>
            new AggregateExpression(aggregateClone));
    }

    [Fact]
    public void Function_expression_defensively_copies_arguments_and_rejects_nulls()
    {
        var argument = new ParameterExpression(Parameter("p0"));
        var supplied = new List<SqlExpression> { argument };

        var function = new FunctionExpression(SemanticFunctions.Coalesce, supplied);
        supplied.Clear();

        Assert.Single(function.Arguments);
        Assert.Same(argument, function.Arguments[0]);
        AssertReadOnly(function.Arguments, NullExpression.Instance);
        Assert.Throws<ArgumentNullException>(() =>
            new FunctionExpression(SemanticFunctions.Length, null!));
        Assert.Throws<ArgumentException>(() =>
            new FunctionExpression(SemanticFunctions.Length,
                new SqlExpression[] { null! }));
    }

    [Fact]
    public void Function_expression_defers_zero_and_invalid_arity_to_validation()
    {
        var zeroLength = new FunctionExpression(
            SemanticFunctions.Length, Array.Empty<SqlExpression>());
        var excessiveLength = new FunctionExpression(
            SemanticFunctions.Length,
            new SqlExpression[] { Column("A"), Column("B") });
        var currentDateTime = new FunctionExpression(
            SemanticFunctions.CurrentDateTime, Array.Empty<SqlExpression>());

        Assert.Empty(zeroLength.Arguments);
        Assert.Equal(2, excessiveLength.Arguments.Count);
        Assert.Empty(currentDateTime.Arguments);
    }

    [Fact]
    public void Aggregate_expression_requires_a_registered_aggregate_id()
    {
        var argument = Column("Amount");

        var aggregate = new AggregateExpression(SemanticFunctions.Sum, argument, distinct: true);
        var countAll = new AggregateExpression(SemanticFunctions.Count);

        Assert.Same(SemanticFunctions.Sum, aggregate.Function);
        Assert.Same(argument, aggregate.Argument);
        Assert.True(aggregate.Distinct);
        Assert.Same(SemanticFunctions.Count, countAll.Function);
        Assert.Null(countAll.Argument);
        Assert.False(countAll.Distinct);
        Assert.Throws<ArgumentNullException>(() => new AggregateExpression(null!));
        Assert.Throws<ArgumentException>(() =>
            new AggregateExpression(SemanticFunctions.Length, argument));
        Assert.Throws<ArgumentException>(() =>
            new AggregateExpression(CreateSemanticFunction("UnregisteredAggregate", 0, 1, true)));
    }

    [Fact]
    public void Aggregate_expression_defers_argument_arity_to_validation()
    {
        var missingSumArgument = new AggregateExpression(SemanticFunctions.Sum);

        Assert.Null(missingSumArgument.Argument);
    }

    [Fact]
    public void Semantic_function_catalog_has_stable_unique_provider_neutral_keys()
    {
        var expected = new[]
        {
            ("Concat", 1, (int?)null, false),
            ("Substring", 2, (int?)3, false),
            ("Length", 1, (int?)1, false),
            ("CurrentDateTime", 0, (int?)0, false),
            ("DateAdd", 3, (int?)3, false),
            ("DateDiff", 3, (int?)3, false),
            ("Coalesce", 2, (int?)null, false),
            ("Round", 1, (int?)2, false),
            ("JsonValue", 2, (int?)2, false),
            ("Count", 0, (int?)1, true),
            ("Sum", 1, (int?)1, true),
            ("Avg", 1, (int?)1, true),
            ("Min", 1, (int?)1, true),
            ("Max", 1, (int?)1, true)
        };

        Assert.Equal(expected.Length, SemanticFunctions.All.Count);
        Assert.Equal(expected.Select(item => item.Item1),
            SemanticFunctions.All.Select(function => function.Key));
        Assert.Equal(expected.Length, Enumerable.Count(
            SemanticFunctions.All.Select(function => function.Key)
                .Distinct(StringComparer.Ordinal)));

        for (var index = 0; index < expected.Length; index++)
        {
            var metadata = expected[index];
            var function = SemanticFunctions.All[index];
            Assert.False(string.IsNullOrWhiteSpace(function.Key));
            Assert.Equal(metadata.Item2, function.MinArguments);
            Assert.Equal(metadata.Item3, function.MaxArguments);
            Assert.Equal(metadata.Item4, function.IsAggregate);
        }
    }

    [Fact]
    public void Semantic_function_catalog_exposes_exactly_the_registered_static_ids()
    {
        var expectedNames = new[]
        {
            nameof(SemanticFunctions.Concat),
            nameof(SemanticFunctions.Substring),
            nameof(SemanticFunctions.Length),
            nameof(SemanticFunctions.CurrentDateTime),
            nameof(SemanticFunctions.DateAdd),
            nameof(SemanticFunctions.DateDiff),
            nameof(SemanticFunctions.Coalesce),
            nameof(SemanticFunctions.Round),
            nameof(SemanticFunctions.JsonValue),
            nameof(SemanticFunctions.Count),
            nameof(SemanticFunctions.Sum),
            nameof(SemanticFunctions.Avg),
            nameof(SemanticFunctions.Min),
            nameof(SemanticFunctions.Max)
        };
        var publicIds = typeof(SemanticFunctions)
            .GetProperties(BindingFlags.Public | BindingFlags.Static)
            .Where(property => property.PropertyType == typeof(SemanticFunctionId))
            .Select(property => property.Name)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(expectedNames.OrderBy(name => name, StringComparer.Ordinal), publicIds);
        Assert.All(SemanticFunctions.All, function =>
            Assert.Contains(function, expectedNames.Select(name =>
                (SemanticFunctionId)typeof(SemanticFunctions).GetProperty(name)!.GetValue(null)!)));
    }

    [Fact]
    public void Semantic_function_lookup_is_exact_and_catalog_is_read_only()
    {
        Assert.True(SemanticFunctions.TryGet("Length", out var length));
        Assert.Same(SemanticFunctions.Length, length);
        Assert.False(SemanticFunctions.TryGet("length", out _));
        Assert.False(SemanticFunctions.TryGet("Unknown", out _));
        Assert.Throws<ArgumentNullException>(() => SemanticFunctions.TryGet(null!, out _));
        AssertReadOnly(SemanticFunctions.All, SemanticFunctions.Length);
    }

    [Fact]
    public void Semantic_function_id_is_immutable_internal_only_metadata_with_key_equality()
    {
        Assert.True(typeof(SemanticFunctionId).IsSealed);
        Assert.Empty(typeof(SemanticFunctionId).GetConstructors());
        Assert.All(typeof(SemanticFunctionId).GetProperties(),
            property => Assert.Null(property.SetMethod));

        var equal = CreateSemanticFunction("Length", 1, 1, false);
        var differentCase = CreateSemanticFunction("length", 1, 1, false);

        Assert.Equal(SemanticFunctions.Length, equal);
        Assert.Equal(SemanticFunctions.Length.GetHashCode(), equal.GetHashCode());
        Assert.NotEqual(SemanticFunctions.Length, differentCase);
        Assert.Equal("Length", SemanticFunctions.Length.ToString());
    }

    [Theory]
    [InlineData(null, 0, null)]
    [InlineData("", 0, null)]
    [InlineData("  ", 0, null)]
    [InlineData("Invalid", -1, null)]
    [InlineData("Invalid", 2, 1)]
    public void Semantic_function_id_internal_constructor_rejects_invalid_metadata(
        string? key, int minimumArguments, int? maximumArguments)
    {
        var exception = Assert.Throws<TargetInvocationException>(() =>
            CreateSemanticFunction(key!, minimumArguments, maximumArguments, false));

        Assert.IsAssignableFrom<ArgumentException>(exception.InnerException);
    }

    [Fact]
    public void Expression_nodes_are_closed_immutable_models()
    {
        var nodeTypes = new[]
        {
            typeof(ColumnExpression),
            typeof(ParameterExpression),
            typeof(NullExpression),
            typeof(BooleanExpression),
            typeof(BinaryExpression),
            typeof(UnaryExpression),
            typeof(InExpression),
            typeof(BetweenExpression),
            typeof(CaseExpression),
            typeof(CastExpression),
            typeof(SubqueryExpression),
            typeof(ExistsExpression),
            typeof(AggregateExpression),
            typeof(FunctionExpression)
        };

        Assert.All(nodeTypes, type =>
        {
            Assert.True(type.IsSealed, type.FullName);
            Assert.True(typeof(SqlExpression).IsAssignableFrom(type), type.FullName);
            Assert.All(type.GetProperties(BindingFlags.Instance | BindingFlags.Public),
                property => Assert.Null(property.SetMethod));
        });

        Assert.True(typeof(CaseWhenClause).IsSealed);
        Assert.All(typeof(CaseWhenClause).GetProperties(),
            property => Assert.Null(property.SetMethod));
    }

    [Fact]
    public void Expression_api_has_no_arbitrary_literal_or_raw_function_escape_hatch()
    {
        var expressionTypes = typeof(SqlExpression).Assembly.GetTypes()
            .Where(type => type.Namespace == typeof(SqlExpression).Namespace &&
                           typeof(SqlExpression).IsAssignableFrom(type))
            .ToArray();

        Assert.DoesNotContain(expressionTypes, type =>
            type.Name.Contains("Constant", StringComparison.OrdinalIgnoreCase) ||
            type.Name.Contains("Literal", StringComparison.OrdinalIgnoreCase) ||
            type.Name.Contains("RawSql", StringComparison.OrdinalIgnoreCase));
        Assert.DoesNotContain(expressionTypes.SelectMany(type => type.GetConstructors()),
            constructor => constructor.GetParameters().Any(parameter =>
                parameter.ParameterType == typeof(string) ||
                parameter.ParameterType == typeof(object)));
        Assert.DoesNotContain(typeof(FunctionExpression).GetConstructors()
                .SelectMany(constructor => constructor.GetParameters()),
            parameter => parameter.ParameterType == typeof(string));
    }

    private static ColumnExpression Column(string name) =>
        new(new SqlIdentifier(name));

    private static ParameterDefinition Parameter(
        string name, LogicalDbType logicalType = LogicalDbType.String) =>
        new(name, new SqlTypeDescriptor(logicalType));

    private static SemanticFunctionId CreateSemanticFunction(
        string key, int minimumArguments, int? maximumArguments, bool isAggregate)
    {
        var constructor = typeof(SemanticFunctionId).GetConstructor(
            BindingFlags.Instance | BindingFlags.NonPublic,
            binder: null,
            new[] { typeof(string), typeof(int), typeof(int?), typeof(bool) },
            modifiers: null);
        Assert.NotNull(constructor);
        return (SemanticFunctionId)constructor.Invoke(
            new object?[] { key, minimumArguments, maximumArguments, isAggregate });
    }

    private static void AssertReadOnly<T>(IReadOnlyList<T> values, T additionalValue)
    {
        Assert.False(values is List<T>);
        var list = Assert.IsAssignableFrom<IList>(values);
        Assert.True(list.IsReadOnly);
        Assert.Throws<NotSupportedException>(() => list.Add(additionalValue));
    }

    private sealed class PlaceholderQueryNode : SqlNode
    {
    }
}

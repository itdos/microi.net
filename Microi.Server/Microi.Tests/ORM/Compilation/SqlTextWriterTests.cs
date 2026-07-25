using System.Collections;
using System.Globalization;
using System.Reflection;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Tests.Compilation;

public sealed class SqlTextWriterTests
{
    [Fact]
    public void Dialect_family_is_internal_closed_and_exact()
    {
        var type = typeof(SqlTextDialectFamily);

        Assert.True(type.IsEnum);
        Assert.False(type.IsPublic);
        Assert.Equal(
            new[]
            {
                "MySql",
                "PostgreSql",
                "KingbaseEs",
                "SqlServer",
                "Oracle"
            },
            Enum.GetNames(type));
    }

    [Fact]
    public void Writer_surface_is_internal_sealed_and_token_only()
    {
        var type = typeof(SqlTextWriter);

        Assert.False(type.IsPublic);
        Assert.True(type.IsSealed);

        var constructor = Assert.Single(type.GetConstructors(
            BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic));
        Assert.True(constructor.IsAssembly);
        Assert.Equal(
            new[] { typeof(SqlTextDialectFamily) },
            constructor.GetParameters().Select(parameter => parameter.ParameterType));

        Assert.Empty(type.GetMembers(
            BindingFlags.DeclaredOnly | BindingFlags.Instance | BindingFlags.Public));

        var methods = type.GetMethods(
                BindingFlags.DeclaredOnly | BindingFlags.Instance |
                BindingFlags.NonPublic)
            .Where(method => method.IsAssembly && !method.IsSpecialName)
            .OrderBy(method => method.Name, StringComparer.Ordinal)
            .ToArray();
        Assert.Equal(
            new[]
            {
                "AppendCloseParenthesis",
                "AppendComma",
                "AppendDot",
                "AppendEscapedSchemaLiteral",
                "AppendIdentifierSegment",
                "AppendKeyword",
                "AppendOpenParenthesis",
                "AppendOperator",
                "AppendParameter",
                "AppendSpace",
                "AppendStructuralInt",
                "Snapshot"
            },
            methods.Select(method => method.Name));
        Assert.All(methods, method => Assert.True(method.IsAssembly));
        Assert.DoesNotContain(type.GetMethods(
                BindingFlags.DeclaredOnly | BindingFlags.Instance |
                BindingFlags.Public | BindingFlags.NonPublic), method =>
            method.Name.Contains("Raw", StringComparison.Ordinal) ||
            (method.Name == "Append" &&
             method.GetParameters().Any(parameter =>
                 parameter.ParameterType == typeof(string))) ||
            method.GetParameters().Any(parameter =>
                typeof(Delegate).IsAssignableFrom(parameter.ParameterType)));
    }

    [Theory]
    [InlineData((int)SqlTextDialectFamily.MySql,
        "`sales order`.`display name` = ?p0")]
    [InlineData((int)SqlTextDialectFamily.PostgreSql,
        "\"sales order\".\"display name\" = @p0")]
    [InlineData((int)SqlTextDialectFamily.KingbaseEs,
        "\"sales order\".\"display name\" = :p0")]
    [InlineData((int)SqlTextDialectFamily.SqlServer,
        "[sales order].[display name] = @p0")]
    [InlineData((int)SqlTextDialectFamily.Oracle,
        "\"sales order\".\"display name\" = :p0")]
    public void Dialect_mapping_fixes_identifier_quotes_and_parameter_prefix(
        int familyValue,
        string expected)
    {
        var family = (SqlTextDialectFamily)familyValue;
        var definition = Parameter("id");
        var writer = new SqlTextWriter(family);

        writer.AppendIdentifierSegment("sales order");
        writer.AppendDot();
        writer.AppendIdentifierSegment("display name");
        writer.AppendSpace();
        writer.AppendOperator(SqlOperatorToken.Equal);
        writer.AppendSpace();
        writer.AppendParameter(Slot(0, definition));

        var snapshot = writer.Snapshot();
        Assert.Equal(expected, snapshot.CommandText);
        Assert.Same(definition, Assert.Single(snapshot.Parameters));
    }

    [Fact]
    public void Snapshot_preserves_sparse_parameter_placeholders_in_first_use_order()
    {
        var late = Parameter("late");
        var early = Parameter("early");
        var writer = new SqlTextWriter(SqlTextDialectFamily.PostgreSql);

        writer.AppendParameter(Slot(7, late));
        writer.AppendComma();
        writer.AppendParameter(Slot(2, early));
        writer.AppendComma();
        writer.AppendParameter(Slot(7, late));

        var snapshot = writer.Snapshot();

        Assert.Equal("@p7,@p2,@p7", snapshot.CommandText);
        Assert.Equal(new[] { "late", "early" },
            snapshot.Parameters.Select(parameter => parameter.Name));
        Assert.Equal(new[] { "p7", "p2" },
            snapshot.ParameterPlaceholders);
    }

    [Fact]
    public void Every_operator_has_an_exact_closed_mapping()
    {
        var expected = new Dictionary<SqlOperatorToken, string>
        {
            [SqlOperatorToken.Equal] = "=",
            [SqlOperatorToken.NotEqual] = "<>",
            [SqlOperatorToken.GreaterThan] = ">",
            [SqlOperatorToken.GreaterThanOrEqual] = ">=",
            [SqlOperatorToken.LessThan] = "<",
            [SqlOperatorToken.LessThanOrEqual] = "<=",
            [SqlOperatorToken.Add] = "+",
            [SqlOperatorToken.Subtract] = "-",
            [SqlOperatorToken.Multiply] = "*",
            [SqlOperatorToken.Divide] = "/",
            [SqlOperatorToken.Modulo] = "%",
            [SqlOperatorToken.Concat] = "||"
        };

        Assert.Equal(Enum.GetValues<SqlOperatorToken>().Length, expected.Count);
        foreach (var pair in expected)
        {
            var writer = new SqlTextWriter(SqlTextDialectFamily.PostgreSql);
            writer.AppendOperator(pair.Key);
            Assert.Equal(pair.Value, writer.Snapshot().CommandText);
        }
    }

    [Fact]
    public void Every_keyword_has_a_closed_nonempty_mapping()
    {
        foreach (var keyword in Enum.GetValues<SqlKeyword>())
        {
            var writer = new SqlTextWriter(SqlTextDialectFamily.PostgreSql);
            writer.AppendKeyword(keyword);
            var text = writer.Snapshot().CommandText;

            Assert.False(string.IsNullOrWhiteSpace(text));
            Assert.Equal(text.ToUpperInvariant(), text);
            Assert.DoesNotContain("`", text, StringComparison.Ordinal);
            Assert.DoesNotContain("\"", text, StringComparison.Ordinal);
            Assert.DoesNotContain("[", text, StringComparison.Ordinal);
        }

        AssertKeyword(SqlKeyword.AutoIncrement, "AUTO_INCREMENT");
        AssertKeyword(SqlKeyword.CurrentTimestamp, "CURRENT_TIMESTAMP");
        AssertKeyword(SqlKeyword.DateTimeOffset, "DATETIMEOFFSET");
        AssertKeyword(SqlKeyword.DoublePrecision, "DOUBLE PRECISION");
        AssertKeyword(SqlKeyword.JsonExtract, "JSON_EXTRACT");
        AssertKeyword(SqlKeyword.JsonUnquote, "JSON_UNQUOTE");
        AssertKeyword(SqlKeyword.JsonValue, "JSON_VALUE");
        AssertKeyword(SqlKeyword.Serializable, "SERIALIZABLE");
        AssertKeyword(SqlKeyword.SkipLocked, "SKIP LOCKED");
        AssertKeyword(SqlKeyword.Updlock, "UPDLOCK");
    }

    [Fact]
    public void Parentheses_must_balance_and_punctuation_is_exact()
    {
        var writer = new SqlTextWriter(SqlTextDialectFamily.MySql);
        writer.AppendOpenParenthesis();
        writer.AppendIdentifierSegment("a");
        writer.AppendComma();
        writer.AppendSpace();
        writer.AppendIdentifierSegment("b");
        writer.AppendCloseParenthesis();
        writer.AppendDot();
        writer.AppendIdentifierSegment("c");

        Assert.Equal("(`a`, `b`).`c`", writer.Snapshot().CommandText);

        var missingClose = new SqlTextWriter(SqlTextDialectFamily.MySql);
        missingClose.AppendOpenParenthesis();
        Assert.Throws<InvalidOperationException>(() => missingClose.Snapshot());

        var extraClose = new SqlTextWriter(SqlTextDialectFamily.MySql);
        Assert.Throws<InvalidOperationException>(
            () => extraClose.AppendCloseParenthesis());
    }

    [Fact]
    public void Structural_integer_is_nonnegative_and_invariant_culture()
    {
        var priorCulture = CultureInfo.CurrentCulture;
        try
        {
            CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("ar-SA");
            var writer = new SqlTextWriter(SqlTextDialectFamily.PostgreSql);
            writer.AppendStructuralInt(1203045);

            Assert.Equal("1203045", writer.Snapshot().CommandText);
        }
        finally
        {
            CultureInfo.CurrentCulture = priorCulture;
        }

        var invalid = new SqlTextWriter(SqlTextDialectFamily.PostgreSql);
        Assert.Throws<ArgumentOutOfRangeException>(
            () => invalid.AppendStructuralInt(-1));
    }

    [Theory]
    [InlineData((int)SqlTextDialectFamily.MySql, "'吾码 O''Brien'")]
    [InlineData((int)SqlTextDialectFamily.PostgreSql, "'吾码 O''Brien'")]
    [InlineData((int)SqlTextDialectFamily.KingbaseEs, "'吾码 O''Brien'")]
    [InlineData((int)SqlTextDialectFamily.SqlServer, "N'吾码 O''Brien'")]
    [InlineData((int)SqlTextDialectFamily.Oracle, "'吾码 O''Brien'")]
    public void Schema_literal_uses_the_fixed_dialect_escaper(
        int familyValue,
        string expected)
    {
        var family = (SqlTextDialectFamily)familyValue;
        var writer = new SqlTextWriter(family);
        writer.AppendEscapedSchemaLiteral(new SqlSchemaLiteral("吾码 O'Brien"));

        Assert.Equal(expected, writer.Snapshot().CommandText);
    }

    [Fact]
    public void MySql_schema_literal_escapes_backslash_before_quote()
    {
        var writer = new SqlTextWriter(SqlTextDialectFamily.MySql);
        writer.AppendEscapedSchemaLiteral(
            new SqlSchemaLiteral("path\\O'Brien"));

        Assert.Equal("'path\\\\O''Brien'", writer.Snapshot().CommandText);
    }

    [Fact]
    public void Schema_literal_is_bounded_valid_unicode_without_controls()
    {
        Assert.Equal(string.Empty, new SqlSchemaLiteral(string.Empty).Value);
        Assert.Equal(new string('界', SqlSchemaLiteral.MaximumLength),
            new SqlSchemaLiteral(
                new string('界', SqlSchemaLiteral.MaximumLength)).Value);

        Assert.Throws<ArgumentNullException>(
            () => new SqlSchemaLiteral(null!));
        Assert.Throws<ArgumentException>(
            () => new SqlSchemaLiteral("line\nbreak"));
        Assert.Throws<ArgumentException>(
            () => new SqlSchemaLiteral("broken\uD800"));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SqlSchemaLiteral(
                new string('x', SqlSchemaLiteral.MaximumLength + 1)));
    }

    [Fact]
    public void Snapshot_defensively_freezes_exact_parameter_definitions()
    {
        var first = Parameter("first");
        var second = Parameter("second");
        var firstSlot = Slot(0, first);
        var writer = new SqlTextWriter(SqlTextDialectFamily.Oracle);

        writer.AppendParameter(firstSlot);
        writer.AppendComma();
        writer.AppendParameter(firstSlot);
        writer.AppendComma();
        writer.AppendParameter(Slot(3, second));

        var snapshot = writer.Snapshot();
        Assert.Equal(":p0,:p0,:p3", snapshot.CommandText);
        Assert.Equal(2, snapshot.Parameters.Count);
        Assert.Same(first, snapshot.Parameters[0]);
        Assert.Same(second, snapshot.Parameters[1]);
        Assert.False(snapshot.Parameters is ParameterDefinition[]);
        Assert.False(snapshot.Parameters is List<ParameterDefinition>);
        if (snapshot.Parameters is IList mutable)
        {
            Assert.Throws<NotSupportedException>(() =>
                mutable[0] = second);
        }
    }

    [Fact]
    public void Conflicting_definition_for_one_placeholder_is_rejected()
    {
        var writer = new SqlTextWriter(SqlTextDialectFamily.SqlServer);
        writer.AppendParameter(Slot(0, Parameter("first")));

        Assert.Throws<ArgumentException>(() =>
            writer.AppendParameter(Slot(0, Parameter("second"))));
    }

    [Fact]
    public void Snapshot_is_terminal_and_each_command_requires_a_fresh_writer()
    {
        var first = new SqlTextWriter(SqlTextDialectFamily.MySql);
        first.AppendKeyword(SqlKeyword.Select);
        var firstSnapshot = first.Snapshot();

        Assert.Equal("SELECT", firstSnapshot.CommandText);
        Assert.Throws<InvalidOperationException>(() => first.AppendSpace());
        Assert.Throws<InvalidOperationException>(() => first.Snapshot());

        var second = new SqlTextWriter(SqlTextDialectFamily.MySql);
        second.AppendKeyword(SqlKeyword.Select);
        second.AppendSpace();
        second.AppendStructuralInt(1);
        var secondSnapshot = second.Snapshot();

        Assert.Equal("SELECT 1", secondSnapshot.CommandText);
        Assert.Equal("SELECT", firstSnapshot.CommandText);
        Assert.NotSame(firstSnapshot, secondSnapshot);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("schema.table")]
    [InlineData("`quoted`")]
    [InlineData("[quoted]")]
    [InlineData("\"quoted\"")]
    [InlineData("line\nbreak")]
    public void Identifier_segment_rejects_non_segment_input(string value)
    {
        var writer = new SqlTextWriter(SqlTextDialectFamily.PostgreSql);
        Assert.Throws<ArgumentException>(() =>
            writer.AppendIdentifierSegment(value));
    }

    [Fact]
    public void Undefined_tokens_and_null_token_values_are_rejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SqlTextWriter((SqlTextDialectFamily)999));

        var writer = new SqlTextWriter(SqlTextDialectFamily.PostgreSql);
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            writer.AppendKeyword((SqlKeyword)999));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            writer.AppendOperator((SqlOperatorToken)999));
        Assert.Throws<ArgumentNullException>(() =>
            writer.AppendIdentifierSegment(null!));
        Assert.Throws<ArgumentNullException>(() =>
            writer.AppendParameter(null!));
        Assert.Throws<ArgumentNullException>(() =>
            writer.AppendEscapedSchemaLiteral(null!));
    }

    [Fact]
    public void Snapshot_and_schema_literal_types_are_internal_immutable_values()
    {
        AssertInternalImmutableValue(typeof(SqlCommandTextSnapshot));
        AssertInternalImmutableValue(typeof(SqlSchemaLiteral));

        Assert.DoesNotContain(
            typeof(SqlCommandTextSnapshot).GetProperties(
                BindingFlags.Instance | BindingFlags.Public |
                BindingFlags.NonPublic),
            property =>
                property.PropertyType == typeof(ParameterBag) ||
                property.PropertyType == typeof(BoundParameter) ||
                property.PropertyType == typeof(SqlParameterSlot));
    }

    private static void AssertKeyword(SqlKeyword keyword, string expected)
    {
        var writer = new SqlTextWriter(SqlTextDialectFamily.PostgreSql);
        writer.AppendKeyword(keyword);
        Assert.Equal(expected, writer.Snapshot().CommandText);
    }

    private static void AssertInternalImmutableValue(Type type)
    {
        Assert.False(type.IsPublic);
        Assert.True(type.IsSealed);
        Assert.Empty(type.GetFields(
            BindingFlags.Instance | BindingFlags.Public));
        Assert.All(type.GetProperties(
                BindingFlags.Instance | BindingFlags.Public |
                BindingFlags.NonPublic),
            property => Assert.Null(property.SetMethod));
    }

    private static ParameterDefinition Parameter(string name) =>
        new(name, new SqlTypeDescriptor(LogicalDbType.String));

    private static SqlParameterSlot Slot(
        int ordinal,
        ParameterDefinition definition) =>
        new(ordinal, "p" + ordinal.ToString(CultureInfo.InvariantCulture),
            definition);
}

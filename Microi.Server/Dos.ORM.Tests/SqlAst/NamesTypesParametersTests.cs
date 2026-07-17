using System.Collections;
using System.Data;
using System.Reflection;
using Dos.ORM.SqlAst;

namespace Dos.ORM.Tests.SqlAst;

public sealed class NamesTypesParametersTests
{
    [Fact]
    public void Sql_node_is_an_empty_abstract_base()
    {
        var declaredMembers = typeof(SqlNode).GetMembers(
            BindingFlags.Instance | BindingFlags.Static | BindingFlags.Public |
            BindingFlags.NonPublic | BindingFlags.DeclaredOnly);

        Assert.True(typeof(SqlNode).IsAbstract);
        Assert.DoesNotContain(declaredMembers, member =>
            member.MemberType is MemberTypes.Field or MemberTypes.Property or MemberTypes.Method);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" \t")]
    [InlineData(".")]
    [InlineData("dbo.User")]
    [InlineData("`User`")]
    [InlineData("[User]")]
    [InlineData("User]")]
    [InlineData("\"User\"")]
    [InlineData("User\n")]
    [InlineData("\u0001User")]
    public void Identifier_rejects_non_segment_text(string? value) =>
        Assert.ThrowsAny<ArgumentException>(() => new SqlIdentifier(value!));

    [Fact]
    public void Identifier_preserves_exact_text()
    {
        var identifier = new SqlIdentifier("Mixed_Case 名称");

        Assert.Equal("Mixed_Case 名称", identifier.Value);
        Assert.Equal("Mixed_Case 名称", identifier.ToString());
    }

    [Fact]
    public void Identifier_uses_ordinal_value_equality()
    {
        var first = new SqlIdentifier("Name");
        var equal = new SqlIdentifier("Name");
        var differentCase = new SqlIdentifier("name");

        Assert.Equal(first, equal);
        Assert.Equal(first.GetHashCode(), equal.GetHashCode());
        Assert.NotEqual(first, differentCase);
    }

    [Fact]
    public void Object_name_keeps_segments_separate_without_string_parsing()
    {
        var catalog = new SqlIdentifier("MainCatalog");
        var schema = new SqlIdentifier("app");
        var name = new SqlIdentifier("Users");

        var simple = new SqlObjectName(name);
        var qualified = new SqlObjectName(catalog, schema, name);
        var schemaOnly = new SqlObjectName(null!, schema, name);

        Assert.Null(simple.Catalog);
        Assert.Null(simple.Schema);
        Assert.Same(name, simple.Name);
        Assert.Same(catalog, qualified.Catalog);
        Assert.Same(schema, qualified.Schema);
        Assert.Same(name, qualified.Name);
        Assert.Null(schemaOnly.Catalog);
        Assert.Same(schema, schemaOnly.Schema);
        Assert.DoesNotContain(typeof(SqlObjectName).GetConstructors(), constructor =>
            constructor.GetParameters().Any(parameter => parameter.ParameterType == typeof(string)));
    }

    [Fact]
    public void Object_name_uses_segment_value_equality()
    {
        var first = new SqlObjectName(
            new SqlIdentifier("Catalog"),
            new SqlIdentifier("Schema"),
            new SqlIdentifier("Table"));
        var equal = new SqlObjectName(
            new SqlIdentifier("Catalog"),
            new SqlIdentifier("Schema"),
            new SqlIdentifier("Table"));
        var different = new SqlObjectName(
            new SqlIdentifier("Catalog"),
            new SqlIdentifier("schema"),
            new SqlIdentifier("Table"));

        Assert.Equal(first, equal);
        Assert.Equal(first.GetHashCode(), equal.GetHashCode());
        Assert.NotEqual(first, different);
    }

    [Fact]
    public void Alias_requires_an_identifier_and_uses_value_equality()
    {
        var identifier = new SqlIdentifier("u");
        var alias = new SqlAlias(identifier);

        Assert.Same(identifier, alias.Identifier);
        Assert.Equal(alias, new SqlAlias("u"));
        Assert.Equal(alias.GetHashCode(), new SqlAlias("u").GetHashCode());
        Assert.NotEqual(alias, new SqlAlias("U"));
        Assert.Throws<ArgumentNullException>(() => new SqlAlias((SqlIdentifier)null!));
    }

    [Fact]
    public void Logical_type_catalog_is_stable()
    {
        Assert.Equal(new[]
        {
            nameof(LogicalDbType.String),
            nameof(LogicalDbType.AnsiString),
            nameof(LogicalDbType.Int16),
            nameof(LogicalDbType.Int32),
            nameof(LogicalDbType.Int64),
            nameof(LogicalDbType.Decimal),
            nameof(LogicalDbType.Double),
            nameof(LogicalDbType.Boolean),
            nameof(LogicalDbType.Guid),
            nameof(LogicalDbType.Date),
            nameof(LogicalDbType.DateTime),
            nameof(LogicalDbType.DateTimeOffset),
            nameof(LogicalDbType.Binary),
            nameof(LogicalDbType.Json),
            nameof(LogicalDbType.Clob),
            nameof(LogicalDbType.Blob)
        }, Enum.GetNames(typeof(LogicalDbType)));
    }

    [Fact]
    public void Type_descriptor_preserves_facets_and_uses_value_equality()
    {
        var first = new SqlTypeDescriptor(
            LogicalDbType.Decimal, length: 32, precision: 18, scale: 4);
        var equal = new SqlTypeDescriptor(
            LogicalDbType.Decimal, length: 32, precision: 18, scale: 4);
        var different = new SqlTypeDescriptor(
            LogicalDbType.Decimal, length: 32, precision: 18, scale: 3);

        Assert.Equal(LogicalDbType.Decimal, first.LogicalType);
        Assert.Equal(32, first.Length);
        Assert.Equal(18, first.Precision);
        Assert.Equal(4, first.Scale);
        Assert.Equal(first, equal);
        Assert.Equal(first.GetHashCode(), equal.GetHashCode());
        Assert.NotEqual(first, different);
    }

    [Fact]
    public void Type_descriptor_rejects_undefined_logical_type() =>
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SqlTypeDescriptor((LogicalDbType)int.MaxValue));

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Type_descriptor_rejects_non_positive_length(int length) =>
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SqlTypeDescriptor(LogicalDbType.String, length: length));

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Type_descriptor_rejects_non_positive_precision(int precision) =>
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SqlTypeDescriptor(LogicalDbType.Decimal, precision: precision));

    [Fact]
    public void Type_descriptor_rejects_negative_scale() =>
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new SqlTypeDescriptor(LogicalDbType.Decimal, precision: 5, scale: -1));

    [Fact]
    public void Type_descriptor_rejects_scale_without_precision() =>
        Assert.Throws<ArgumentException>(() =>
            new SqlTypeDescriptor(LogicalDbType.Decimal, scale: 1));

    [Fact]
    public void Type_descriptor_rejects_scale_greater_than_precision() =>
        Assert.Throws<ArgumentException>(() =>
            new SqlTypeDescriptor(LogicalDbType.Decimal, precision: 5, scale: 6));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("@p0")]
    [InlineData(":p0")]
    [InlineData("?p0")]
    [InlineData("p\n0")]
    [InlineData("\u0001p0")]
    public void Parameter_definition_rejects_non_logical_names(string? name) =>
        Assert.ThrowsAny<ArgumentException>(() => new ParameterDefinition(
            name!, new SqlTypeDescriptor(LogicalDbType.String)));

    [Fact]
    public void Parameter_definition_is_immutable_metadata_without_runtime_value()
    {
        var type = new SqlTypeDescriptor(LogicalDbType.String, length: 200);
        var definition = new ParameterDefinition(
            "account", type, ParameterDirection.InputOutput, isNullable: false);

        Assert.Equal("account", definition.Name);
        Assert.Same(type, definition.Type);
        Assert.Equal(ParameterDirection.InputOutput, definition.Direction);
        Assert.False(definition.IsNullable);
        Assert.DoesNotContain(definition.GetType().GetProperties(),
            property => property.Name == "Value");
        Assert.All(definition.GetType().GetProperties(),
            property => Assert.Null(property.SetMethod));
    }

    [Fact]
    public void Parameter_definition_requires_a_type() =>
        Assert.Throws<ArgumentNullException>(() =>
            new ParameterDefinition("p0", null!));

    [Fact]
    public void Parameter_definition_rejects_undefined_direction() =>
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new ParameterDefinition(
                "p0", new SqlTypeDescriptor(LogicalDbType.String),
                (ParameterDirection)int.MaxValue));

    [Fact]
    public void Parameter_bag_uses_immutable_copy_on_add()
    {
        var empty = new ParameterBag();
        var one = empty.Add("account", "admin");
        var two = one.Add("status", 1);

        Assert.Equal(0, empty.Count);
        Assert.False(empty.Contains("account"));
        Assert.Equal(1, one.Count);
        Assert.True(one.Contains("account"));
        Assert.False(one.Contains("status"));
        Assert.Equal(2, two.Count);
        Assert.Equal("admin", two["account"]);
        Assert.Equal(1, two["status"]);
    }

    [Fact]
    public void Parameter_bag_rejects_exact_duplicates_without_mutating_the_source()
    {
        var bag = new ParameterBag().Add("account", "first-secret");

        var exception = Assert.Throws<ArgumentException>(() =>
            bag.Add("account", "second-secret"));

        Assert.Equal(1, bag.Count);
        Assert.Equal("first-secret", bag["account"]);
        Assert.DoesNotContain("first-secret", exception.Message);
        Assert.DoesNotContain("second-secret", exception.Message);
    }

    [Fact]
    public void Parameter_bag_accepts_null_and_distinguishes_missing_values()
    {
        var bag = new ParameterBag().Add("optional", null);

        Assert.True(bag.TryGetValue("optional", out var value));
        Assert.Null(value);
        Assert.Null(bag["optional"]);
        Assert.False(bag.TryGetValue("missing", out _));
        Assert.Throws<KeyNotFoundException>(() => bag["missing"]);
    }

    [Fact]
    public void Parameter_bag_names_are_ordinal_and_case_sensitive()
    {
        var bag = new ParameterBag()
            .Add("Name", 1)
            .Add("name", 2);

        Assert.Equal(2, bag.Count);
        Assert.Equal(1, bag["Name"]);
        Assert.Equal(2, bag["name"]);
        Assert.False(bag.Contains("NAME"));
    }

    [Fact]
    public void Parameter_bag_does_not_expose_a_mutable_backing_dictionary()
    {
        Assert.DoesNotContain(typeof(ParameterBag).GetProperties(), property =>
            typeof(IDictionary).IsAssignableFrom(property.PropertyType));
        Assert.All(typeof(ParameterBag).GetProperties(), property =>
            Assert.Null(property.SetMethod));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    [InlineData("p\n0")]
    public void Bound_parameter_rejects_invalid_placeholders(string? placeholder)
    {
        var definition = new ParameterDefinition(
            "p0", new SqlTypeDescriptor(LogicalDbType.String));

        Assert.ThrowsAny<ArgumentException>(() =>
            new BoundParameter(definition, placeholder!, "secret"));
    }

    [Fact]
    public void Bound_parameter_propagates_definition_facets_without_copying_metadata()
    {
        var type = new SqlTypeDescriptor(LogicalDbType.Decimal, precision: 18, scale: 2);
        var definition = new ParameterDefinition(
            "amount", type, ParameterDirection.InputOutput, isNullable: true);
        var value = new object();

        var parameter = new BoundParameter(definition, ":p0", value);

        Assert.Same(definition, parameter.Definition);
        Assert.Equal("amount", parameter.Name);
        Assert.Same(type, parameter.Type);
        Assert.Equal(LogicalDbType.Decimal, parameter.LogicalType);
        Assert.Null(parameter.Length);
        Assert.Equal(18, parameter.Precision);
        Assert.Equal(2, parameter.Scale);
        Assert.Equal(ParameterDirection.InputOutput, parameter.Direction);
        Assert.True(parameter.IsNullable);
        Assert.Equal(":p0", parameter.Placeholder);
        Assert.Same(value, parameter.Value);
        Assert.All(parameter.GetType().GetProperties(),
            property => Assert.Null(property.SetMethod));
    }

    [Theory]
    [InlineData(ParameterDirection.Input)]
    [InlineData(ParameterDirection.InputOutput)]
    public void Bound_parameter_rejects_null_for_non_nullable_input(
        ParameterDirection direction)
    {
        var definition = new ParameterDefinition(
            "required", new SqlTypeDescriptor(LogicalDbType.String),
            direction, isNullable: false);

        Assert.Throws<ArgumentException>(() =>
            new BoundParameter(definition, "@p0", null));
    }

    [Theory]
    [InlineData(ParameterDirection.Output)]
    [InlineData(ParameterDirection.ReturnValue)]
    public void Bound_parameter_allows_null_for_non_input_directions(
        ParameterDirection direction)
    {
        var definition = new ParameterDefinition(
            "result", new SqlTypeDescriptor(LogicalDbType.Int32),
            direction, isNullable: false);

        var parameter = new BoundParameter(definition, "@p0", null);

        Assert.Null(parameter.Value);
    }

    [Fact]
    public void Bound_parameter_allows_null_for_nullable_input()
    {
        var definition = new ParameterDefinition(
            "optional", new SqlTypeDescriptor(LogicalDbType.String),
            ParameterDirection.Input, isNullable: true);

        var parameter = new BoundParameter(definition, "@p0", null);

        Assert.Null(parameter.Value);
    }

    [Fact]
    public void Bound_parameter_to_string_redacts_runtime_value()
    {
        const string secret = "runtime-secret-value";
        var definition = new ParameterDefinition(
            "account", new SqlTypeDescriptor(LogicalDbType.String));
        var parameter = new BoundParameter(definition, "@p0", secret);

        var text = parameter.ToString();

        Assert.Contains("account", text);
        Assert.Contains("@p0", text);
        Assert.DoesNotContain(secret, text);
    }
}

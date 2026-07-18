using System.Data;
using System.Globalization;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;

namespace Dos.ORM.Tests.Compilation;

public sealed partial class CompilationCoreTests
{
    [Fact]
    public void Bind_null_arguments_use_exact_parameter_names()
    {
        var allocator = new SqlParameterAllocator();

        var slotsException = Assert.Throws<ArgumentNullException>(() =>
            allocator.Bind(null!, new ParameterBag()));
        var valuesException = Assert.Throws<ArgumentNullException>(() =>
            allocator.Bind(Array.Empty<SqlParameterSlot>(), null!));

        Assert.Equal("slots", slotsException.ParamName);
        Assert.Equal("values", valuesException.ParamName);
    }

    [Theory]
    [InlineData(ParameterDirection.Input)]
    [InlineData(ParameterDirection.Output)]
    [InlineData(ParameterDirection.InputOutput)]
    [InlineData(ParameterDirection.ReturnValue)]
    public void Present_value_is_used_for_every_parameter_direction(
        ParameterDirection direction)
    {
        var definition = BindingDefinition(
            "present_" + direction,
            direction,
            isNullable: false);
        var slot = BindingSlot(0, definition);
        var runtimeValue = new object();
        var values = new ParameterBag().Add(definition.Name, runtimeValue);

        var bound = Assert.Single(
            new SqlParameterAllocator().Bind(new[] { slot }, values));

        Assert.Same(definition, bound.Definition);
        Assert.Equal("p0", bound.Placeholder);
        Assert.Same(runtimeValue, bound.Value);
        Assert.Equal(direction, bound.Direction);
    }

    [Theory]
    [InlineData(ParameterDirection.Input, true)]
    [InlineData(ParameterDirection.Input, false)]
    [InlineData(ParameterDirection.InputOutput, true)]
    [InlineData(ParameterDirection.InputOutput, false)]
    public void Missing_input_value_is_rejected(
        ParameterDirection direction,
        bool isNullable)
    {
        var definition = BindingDefinition(
            "missing_input_secret_" + direction + "_" + isNullable,
            direction,
            isNullable);
        var slot = BindingSlot(0, definition);

        var exception = Assert.Throws<ArgumentException>(() =>
            new SqlParameterAllocator().Bind(
                new[] { slot },
                new ParameterBag()));

        BindingAssertValuesException(
            exception,
            "ParameterBag is missing a required input value.");
        Assert.DoesNotContain(definition.Name, exception.Message,
            StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(ParameterDirection.Output)]
    [InlineData(ParameterDirection.ReturnValue)]
    public void Missing_output_and_return_value_bind_null(
        ParameterDirection direction)
    {
        var definition = BindingDefinition(
            "missing_non_input_" + direction,
            direction,
            isNullable: false);
        var slot = BindingSlot(0, definition);

        var bound = Assert.Single(
            new SqlParameterAllocator().Bind(
                new[] { slot },
                new ParameterBag()));

        Assert.Same(definition, bound.Definition);
        Assert.Equal("p0", bound.Placeholder);
        Assert.Null(bound.Value);
    }

    [Theory]
    [InlineData(ParameterDirection.Input)]
    [InlineData(ParameterDirection.Output)]
    [InlineData(ParameterDirection.InputOutput)]
    [InlineData(ParameterDirection.ReturnValue)]
    public void Nullable_null_value_is_preserved(ParameterDirection direction)
    {
        var definition = BindingDefinition(
            "nullable_null_" + direction,
            direction,
            isNullable: true);
        var slot = BindingSlot(0, definition);
        var values = new ParameterBag().Add(definition.Name, null!);

        var bound = Assert.Single(
            new SqlParameterAllocator().Bind(new[] { slot }, values));

        Assert.Same(definition, bound.Definition);
        Assert.Null(bound.Value);
    }

    [Theory]
    [InlineData(ParameterDirection.Output)]
    [InlineData(ParameterDirection.ReturnValue)]
    public void Present_null_nonnullable_output_and_return_value_bind_null(
        ParameterDirection direction)
    {
        var definition = BindingDefinition(
            "present_nonnullable_null_" + direction,
            direction,
            isNullable: false);
        var slot = BindingSlot(0, definition);
        var values = new ParameterBag().Add(definition.Name, null!);

        var bound = Assert.Single(
            new SqlParameterAllocator().Bind(new[] { slot }, values));

        Assert.Same(definition, bound.Definition);
        Assert.Null(bound.Value);
    }

    [Theory]
    [InlineData(ParameterDirection.Input)]
    [InlineData(ParameterDirection.InputOutput)]
    public void Nonnullable_input_null_uses_actual_bound_parameter_exception(
        ParameterDirection direction)
    {
        var definition = BindingDefinition(
            "nonnull_secret_" + direction,
            direction,
            isNullable: false);
        var slot = BindingSlot(0, definition);
        var values = new ParameterBag().Add(definition.Name, null!);
        var expected = Assert.Throws<ArgumentException>(() =>
            new BoundParameter(definition, slot.Placeholder, null!));

        var exception = Assert.Throws<ArgumentException>(() =>
            new SqlParameterAllocator().Bind(new[] { slot }, values));

        Assert.Equal(expected.ParamName, exception.ParamName);
        Assert.Equal(expected.Message, exception.Message);
        Assert.DoesNotContain(definition.Name, exception.Message,
            StringComparison.Ordinal);
    }

    [Fact]
    public void Extra_parameter_bag_value_is_rejected_without_leak()
    {
        const string extraName = "extra_binding_secret_name";
        const string extraValue = "extra-binding-secret-value";
        var definition = BindingDefinition("required_value");
        var slot = BindingSlot(0, definition);
        var values = new ParameterBag()
            .Add(definition.Name, "required-runtime-value")
            .Add(extraName, extraValue);

        var exception = Assert.Throws<ArgumentException>(() =>
            new SqlParameterAllocator().Bind(new[] { slot }, values));

        BindingAssertValuesException(
            exception,
            "ParameterBag contains an unreferenced value.");
        Assert.DoesNotContain(extraName, exception.Message,
            StringComparison.Ordinal);
        Assert.DoesNotContain(extraValue, exception.Message,
            StringComparison.Ordinal);
    }

    [Fact]
    public void Missing_input_precedes_unreferenced_value_error()
    {
        const string extraName = "priority_extra_secret_name";
        const string extraValue = "priority-extra-secret-value";
        var definition = BindingDefinition(
            "priority_missing_secret",
            ParameterDirection.Input,
            isNullable: false);
        var values = new ParameterBag().Add(extraName, extraValue);

        var exception = Assert.Throws<ArgumentException>(() =>
            new SqlParameterAllocator().Bind(
                new[] { BindingSlot(0, definition) },
                values));

        BindingAssertValuesException(
            exception,
            "ParameterBag is missing a required input value.");
        Assert.DoesNotContain(definition.Name, exception.Message,
            StringComparison.Ordinal);
        Assert.DoesNotContain(extraName, exception.Message,
            StringComparison.Ordinal);
        Assert.DoesNotContain(extraValue, exception.Message,
            StringComparison.Ordinal);
    }

    [Fact]
    public void Bind_uses_actual_value_and_constructor_order()
    {
        var definition = BindingDefinition(
            "actual_value",
            ParameterDirection.Input,
            isNullable: false);
        var slot = BindingSlot(0, definition);
        var runtimeValue = new object();
        var values = new ParameterBag().Add(definition.Name, runtimeValue);

        var bound = Assert.Single(
            new SqlParameterAllocator().Bind(new[] { slot }, values));

        Assert.Same(definition, bound.Definition);
        Assert.Equal(definition.Name, bound.Name);
        Assert.Equal("p0", bound.Placeholder);
        Assert.Same(runtimeValue, bound.Value);
    }

    [Fact]
    public void Bind_calls_return_distinct_bound_parameter_instances()
    {
        var firstDefinition = BindingDefinition("fresh_bound_parameter_first");
        var secondDefinition = BindingDefinition("fresh_bound_parameter_second");
        var firstValue = new object();
        var secondValue = new object();
        var firstSlots = new[] { BindingSlot(0, firstDefinition) };
        var firstValues = new ParameterBag().Add(
            firstDefinition.Name,
            firstValue);
        var allocator = new SqlParameterAllocator();

        var first = allocator.Bind(firstSlots, firstValues);
        var sameInput = allocator.Bind(firstSlots, firstValues);
        var differentInput = allocator.Bind(
            new[] { BindingSlot(0, secondDefinition) },
            new ParameterBag().Add(secondDefinition.Name, secondValue));

        Assert.NotSame(first, sameInput);
        Assert.NotSame(first, differentInput);
        Assert.Single(first);
        Assert.Single(sameInput);
        Assert.Single(differentInput);
        Assert.NotSame(first[0], sameInput[0]);
        Assert.NotSame(first[0], differentInput[0]);
        Assert.Same(firstDefinition, first[0].Definition);
        Assert.Same(firstDefinition, sameInput[0].Definition);
        Assert.Same(secondDefinition, differentInput[0].Definition);
        Assert.Same(firstValue, first[0].Value);
        Assert.Same(firstValue, sameInput[0].Value);
        Assert.Same(secondValue, differentInput[0].Value);
    }

    [Fact]
    public void Bind_preserves_slot_order()
    {
        var firstDefinition = BindingDefinition("first_slot");
        var secondDefinition = BindingDefinition("second_slot");
        var thirdDefinition = BindingDefinition("third_slot");
        var firstValue = new object();
        var secondValue = new object();
        var thirdValue = new object();
        var slots = new[]
        {
            BindingSlot(0, firstDefinition),
            BindingSlot(1, secondDefinition),
            BindingSlot(2, thirdDefinition)
        };
        var values = new ParameterBag()
            .Add(thirdDefinition.Name, thirdValue)
            .Add(firstDefinition.Name, firstValue)
            .Add(secondDefinition.Name, secondValue);

        var bound = new SqlParameterAllocator().Bind(slots, values);

        Assert.Equal(
            new[] { "p0", "p1", "p2" },
            bound.Select(item => item.Placeholder));
        Assert.Equal(
            new[]
            {
                firstDefinition.Name,
                secondDefinition.Name,
                thirdDefinition.Name
            },
            bound.Select(item => item.Name));
        Assert.Same(firstValue, bound[0].Value);
        Assert.Same(secondValue, bound[1].Value);
        Assert.Same(thirdValue, bound[2].Value);
    }

    [Fact]
    public void Bind_accepts_ordinal_case_distinct_logical_names()
    {
        var lower = BindingDefinition("case_name");
        var upper = BindingDefinition("CASE_NAME");
        var lowerValue = new object();
        var upperValue = new object();
        var slots = new[]
        {
            BindingSlot(0, lower),
            BindingSlot(1, upper)
        };
        var values = new ParameterBag()
            .Add(upper.Name, upperValue)
            .Add(lower.Name, lowerValue);

        var bound = new SqlParameterAllocator().Bind(slots, values);

        Assert.Equal(new[] { lower.Name, upper.Name },
            bound.Select(item => item.Name));
        Assert.Same(lowerValue, bound[0].Value);
        Assert.Same(upperValue, bound[1].Value);
    }

    [Fact]
    public void Empty_slots_bind_to_fresh_read_only_empty_results()
    {
        var allocator = new SqlParameterAllocator();
        var values = new ParameterBag();

        var first = allocator.Bind(Array.Empty<SqlParameterSlot>(), values);
        var second = allocator.Bind(Array.Empty<SqlParameterSlot>(), values);

        Assert.Empty(first);
        Assert.Empty(second);
        Assert.NotSame(first, second);
        BindingAssertReadOnly(first);
        BindingAssertReadOnly(second);
    }

    [Fact]
    public void Empty_slots_reject_nonempty_parameter_bag_without_leak()
    {
        const string extraName = "empty_slots_extra_secret_name";
        const string extraValue = "empty-slots-extra-secret-value";
        var values = new ParameterBag().Add(extraName, extraValue);

        var exception = Assert.Throws<ArgumentException>(() =>
            new SqlParameterAllocator().Bind(
                Array.Empty<SqlParameterSlot>(),
                values));

        BindingAssertValuesException(
            exception,
            "ParameterBag contains an unreferenced value.");
        Assert.DoesNotContain(extraName, exception.Message,
            StringComparison.Ordinal);
        Assert.DoesNotContain(extraValue, exception.Message,
            StringComparison.Ordinal);
    }

    [Fact]
    public void Bind_results_are_read_only()
    {
        var definition = BindingDefinition("read_only_result");
        var slot = BindingSlot(0, definition);
        var slots = new[] { slot };
        var values = new ParameterBag().Add(definition.Name, new object());
        var bound = new SqlParameterAllocator().Bind(slots, values);

        slots[0] = BindingSlot(
            0,
            BindingDefinition("replacement_after_bind"));

        BindingAssertReadOnly(bound);
        Assert.Same(definition, Assert.Single(bound).Definition);
    }

    [Fact]
    public void Bind_does_not_mutate_slots_or_parameter_bags()
    {
        var definition = BindingDefinition("immutable_inputs");
        var slot = BindingSlot(0, definition);
        var slots = new[] { slot };
        var empty = new ParameterBag();
        var runtimeValue = new object();
        var values = empty.Add(definition.Name, runtimeValue);

        var bound = new SqlParameterAllocator().Bind(slots, values);

        Assert.Same(slot, slots[0]);
        Assert.Equal(0, slot.Ordinal);
        Assert.Equal("p0", slot.Placeholder);
        Assert.Same(definition, slot.Definition);
        Assert.Equal(0, empty.Count);
        Assert.False(empty.Contains(definition.Name));
        Assert.Equal(1, values.Count);
        Assert.True(values.TryGetValue(definition.Name, out var retained));
        Assert.Same(runtimeValue, retained);
        Assert.Same(runtimeValue, Assert.Single(bound).Value);
    }

    [Fact]
    public void Bind_does_not_convert_runtime_values()
    {
        var logicalTypes = Enum.GetValues(typeof(LogicalDbType))
            .Cast<LogicalDbType>()
            .ToArray();
        Assert.Equal(16, logicalTypes.Length);
        var definitions = logicalTypes
            .Select((logicalType, index) => new ParameterDefinition(
                "raw_type_" + index.ToString(CultureInfo.InvariantCulture),
                new SqlTypeDescriptor(logicalType)))
            .ToArray();
        var runtimeValues = logicalTypes
            .Select(_ => (object)new Uri("https://binding.invalid/no-conversion"))
            .ToArray();
        var slots = definitions
            .Select((definition, index) => BindingSlot(index, definition))
            .ToArray();
        var values = new ParameterBag();
        for (var index = 0; index < definitions.Length; index++)
        {
            values = values.Add(definitions[index].Name, runtimeValues[index]);
        }

        var bound = new SqlParameterAllocator().Bind(slots, values);

        Assert.Equal(runtimeValues.Length, bound.Count);
        for (var index = 0; index < runtimeValues.Length; index++)
        {
            Assert.Same(runtimeValues[index], bound[index].Value);
        }
    }

    [Theory]
    [MemberData(nameof(BindingInvalidSlotSnapshots))]
    public void Invalid_slot_snapshot_is_rejected_before_parameter_bag_access(
        string caseName,
        SqlParameterSlot[] slots)
    {
        Assert.False(string.IsNullOrWhiteSpace(caseName));
        var unreadableValues = Forge<ParameterBag>();

        var exception = Assert.Throws<ArgumentException>(() =>
            new SqlParameterAllocator().Bind(slots, unreadableValues));

        Assert.Equal("slots", exception.ParamName);
        Assert.Equal(
            new ArgumentException(
                "Parameter slot snapshot is invalid.",
                "slots").Message,
            exception.Message);
        Assert.DoesNotContain("binding_snapshot_secret", exception.Message,
            StringComparison.Ordinal);
    }

    public static IEnumerable<object[]> BindingInvalidSlotSnapshots()
    {
        var valid = BindingDefinition("binding_snapshot_valid");
        yield return BindingInvalidSnapshot(
            "null-slot",
            (SqlParameterSlot)null!);
        yield return BindingInvalidSnapshot(
            "negative-ordinal",
            BindingSlot(-1, "p0", valid));
        yield return BindingInvalidSnapshot(
            "first-ordinal-is-one",
            BindingSlot(1, "p0", valid));
        yield return BindingInvalidSnapshot(
            "ordinal-gap",
            BindingSlot(0, BindingDefinition("gap_zero")),
            BindingSlot(2, "p1", BindingDefinition("gap_two")));
        yield return BindingInvalidSnapshot(
            "duplicate-ordinal",
            BindingSlot(0, BindingDefinition("duplicate_ordinal_zero")),
            BindingSlot(
                0,
                "p1",
                BindingDefinition("duplicate_ordinal_later")));
        yield return BindingInvalidSnapshot(
            "reverse-order",
            BindingSlot(1, "p0", BindingDefinition("reverse_one")),
            BindingSlot(0, "p1", BindingDefinition("reverse_zero")));
        yield return BindingInvalidSnapshot(
            "null-placeholder",
            BindingSlot(0, null, valid));
        yield return BindingInvalidSnapshot(
            "empty-placeholder",
            BindingSlot(0, string.Empty, valid));
        yield return BindingInvalidSnapshot(
            "placeholder-does-not-match-index",
            BindingSlot(0, "p1", valid));
        yield return BindingInvalidSnapshot(
            "provider-prefixed-placeholder",
            BindingSlot(0, "@p0", valid));
        yield return BindingInvalidSnapshot(
            "uppercase-placeholder",
            BindingSlot(0, "P0", valid));
        yield return BindingInvalidSnapshot(
            "leading-zero-placeholder",
            BindingSlot(0, "p00", valid));
        yield return BindingInvalidSnapshot(
            "duplicate-logical-name",
            BindingSlot(0, BindingDefinition("binding_snapshot_secret_name")),
            BindingSlot(1, BindingDefinition("binding_snapshot_secret_name")));
        yield return BindingInvalidSnapshot(
            "null-definition",
            BindingSlot(0, "p0", null));
        yield return BindingInvalidSnapshot(
            "null-definition-name",
            BindingSlot(
                0,
                BindingForgedDefinition(
                    null,
                    BindingType(),
                    ParameterDirection.Input)));
        yield return BindingInvalidSnapshot(
            "whitespace-definition-name",
            BindingSlot(
                0,
                BindingForgedDefinition(
                    " ",
                    BindingType(),
                    ParameterDirection.Input)));
        yield return BindingInvalidSnapshot(
            "provider-prefixed-definition-name",
            BindingSlot(
                0,
                BindingForgedDefinition(
                    "@binding_snapshot_secret",
                    BindingType(),
                    ParameterDirection.Input)));
        yield return BindingInvalidSnapshot(
            "colon-prefixed-definition-name",
            BindingSlot(
                0,
                BindingForgedDefinition(
                    ":binding_snapshot_secret",
                    BindingType(),
                    ParameterDirection.Input)));
        yield return BindingInvalidSnapshot(
            "question-prefixed-definition-name",
            BindingSlot(
                0,
                BindingForgedDefinition(
                    "?binding_snapshot_secret",
                    BindingType(),
                    ParameterDirection.Input)));
        yield return BindingInvalidSnapshot(
            "control-definition-name",
            BindingSlot(
                0,
                BindingForgedDefinition(
                    "binding_snapshot_secret\u0001name",
                    BindingType(),
                    ParameterDirection.Input)));
        yield return BindingInvalidSnapshot(
            "null-definition-type",
            BindingSlot(
                0,
                BindingForgedDefinition(
                    "binding_snapshot_secret",
                    null,
                    ParameterDirection.Input)));
        yield return BindingInvalidSnapshot(
            "undefined-logical-type",
            BindingSlot(
                0,
                BindingForgedDefinition(
                    "binding_snapshot_secret",
                    BindingForgedType((LogicalDbType)int.MaxValue),
                    ParameterDirection.Input)));
        yield return BindingInvalidSnapshot(
            "nonpositive-length",
            BindingSlot(
                0,
                BindingForgedDefinition(
                    "binding_snapshot_secret",
                    BindingForgedType(LogicalDbType.String, length: 0),
                    ParameterDirection.Input)));
        yield return BindingInvalidSnapshot(
            "nonpositive-precision",
            BindingSlot(
                0,
                BindingForgedDefinition(
                    "binding_snapshot_secret",
                    BindingForgedType(LogicalDbType.Decimal, precision: 0),
                    ParameterDirection.Input)));
        yield return BindingInvalidSnapshot(
            "negative-scale",
            BindingSlot(
                0,
                BindingForgedDefinition(
                    "binding_snapshot_secret",
                    BindingForgedType(
                        LogicalDbType.Decimal,
                        precision: 4,
                        scale: -1),
                    ParameterDirection.Input)));
        yield return BindingInvalidSnapshot(
            "scale-without-precision",
            BindingSlot(
                0,
                BindingForgedDefinition(
                    "binding_snapshot_secret",
                    BindingForgedType(LogicalDbType.Decimal, scale: 1),
                    ParameterDirection.Input)));
        yield return BindingInvalidSnapshot(
            "scale-greater-than-precision",
            BindingSlot(
                0,
                BindingForgedDefinition(
                    "binding_snapshot_secret",
                    BindingForgedType(
                        LogicalDbType.Decimal,
                        precision: 2,
                        scale: 3),
                    ParameterDirection.Input)));
        yield return BindingInvalidSnapshot(
            "undefined-direction",
            BindingSlot(
                0,
                BindingForgedDefinition(
                    "binding_snapshot_secret",
                    BindingType(),
                    (ParameterDirection)int.MaxValue)));
    }

    private static ParameterDefinition BindingDefinition(
        string name,
        ParameterDirection direction = ParameterDirection.Input,
        bool isNullable = true) =>
        new(name, BindingType(), direction, isNullable);

    private static SqlTypeDescriptor BindingType() =>
        new(LogicalDbType.String, length: 128);

    private static ParameterDefinition BindingForgedDefinition(
        string? name,
        SqlTypeDescriptor? type,
        ParameterDirection direction,
        bool isNullable = true)
    {
        var definition = Forge<ParameterDefinition>();
        SetAutoProperty(definition, nameof(ParameterDefinition.Name), name);
        SetAutoProperty(definition, nameof(ParameterDefinition.Type), type);
        SetAutoProperty(
            definition,
            nameof(ParameterDefinition.Direction),
            direction);
        SetAutoProperty(
            definition,
            nameof(ParameterDefinition.IsNullable),
            isNullable);
        return definition;
    }

    private static SqlTypeDescriptor BindingForgedType(
        LogicalDbType logicalType,
        int? length = null,
        int? precision = null,
        int? scale = null)
    {
        var type = Forge<SqlTypeDescriptor>();
        SetAutoProperty(type, nameof(SqlTypeDescriptor.LogicalType), logicalType);
        SetAutoProperty(type, nameof(SqlTypeDescriptor.Length), length);
        SetAutoProperty(type, nameof(SqlTypeDescriptor.Precision), precision);
        SetAutoProperty(type, nameof(SqlTypeDescriptor.Scale), scale);
        return type;
    }

    private static SqlParameterSlot BindingSlot(
        int ordinal,
        ParameterDefinition definition) =>
        BindingSlot(
            ordinal,
            "p" + ordinal.ToString(CultureInfo.InvariantCulture),
            definition);

    private static SqlParameterSlot BindingSlot(
        int ordinal,
        string? placeholder,
        ParameterDefinition? definition)
    {
        var slot = Forge<SqlParameterSlot>();
        SetAutoProperty(slot, nameof(SqlParameterSlot.Ordinal), ordinal);
        SetAutoProperty(slot, nameof(SqlParameterSlot.Placeholder), placeholder);
        SetAutoProperty(slot, nameof(SqlParameterSlot.Definition), definition);
        return slot;
    }

    private static object[] BindingInvalidSnapshot(
        string caseName,
        params SqlParameterSlot[] slots) =>
        new object[] { caseName, slots };

    private static void BindingAssertValuesException(
        ArgumentException exception,
        string fixedMessage)
    {
        Assert.Equal("values", exception.ParamName);
        Assert.Equal(
            new ArgumentException(fixedMessage, "values").Message,
            exception.Message);
    }

    private static void BindingAssertReadOnly(
        IReadOnlyList<BoundParameter> bound)
    {
        Assert.False(bound is List<BoundParameter>);
        Assert.False(bound is BoundParameter[]);
        if (bound is ICollection<BoundParameter> collection)
        {
            Assert.True(collection.IsReadOnly);
            Assert.Throws<NotSupportedException>(() => collection.Add(null!));
        }
        if (bound.Count > 0 && bound is IList<BoundParameter> list)
        {
            Assert.Throws<NotSupportedException>(() =>
            {
                list[0] = bound[0];
            });
        }
    }
}

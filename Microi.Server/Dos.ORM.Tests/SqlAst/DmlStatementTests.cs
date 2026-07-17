using System.Collections;
using System.Reflection;
using Dos.ORM.SqlAst;

namespace Dos.ORM.Tests.SqlAst;

public sealed class DmlStatementTests
{
    [Fact]
    public void Assignment_requires_structured_column_and_expression()
    {
        var column = new SqlIdentifier("Status");
        var value = Parameter("status");

        var assignment = new SqlAssignment(column, value);

        Assert.Same(column, assignment.Column);
        Assert.Same(value, assignment.Value);
        Assert.Throws<ArgumentNullException>(() =>
            new SqlAssignment(null!, value));
        Assert.Throws<ArgumentNullException>(() =>
            new SqlAssignment(column, null!));
        Assert.DoesNotContain(
            typeof(SqlAssignment).GetConstructors()
                .SelectMany(constructor => constructor.GetParameters()),
            parameter => parameter.ParameterType == typeof(string) ||
                         parameter.ParameterType == typeof(object));
    }

    [Fact]
    public void Insert_row_requires_non_empty_values_and_copies_them()
    {
        var value = Parameter("id");
        var supplied = new List<SqlExpression> { value };

        var row = new SqlInsertRow(supplied);
        supplied.Clear();

        Assert.Single(row.Values);
        Assert.Same(value, row.Values[0]);
        AssertReadOnly(row.Values, NullExpression.Instance);
        Assert.Throws<ArgumentNullException>(() => new SqlInsertRow(null!));
        Assert.Throws<ArgumentException>(() =>
            new SqlInsertRow(Array.Empty<SqlExpression>()));
        Assert.Throws<ArgumentException>(() =>
            new SqlInsertRow(new SqlExpression[] { null! }));
    }

    [Fact]
    public void Returning_clause_requires_non_empty_projection_intent_and_copies_it()
    {
        var projection = new SelectProjection(Column("Id"));
        var supplied = new List<SelectProjection> { projection };

        var returning = new ReturningClause(supplied);
        supplied.Clear();

        Assert.Single(returning.Projections);
        Assert.Same(projection, returning.Projections[0]);
        AssertReadOnly(returning.Projections, projection);
        Assert.Throws<ArgumentNullException>(() => new ReturningClause(null!));
        Assert.Throws<ArgumentException>(() =>
            new ReturningClause(Array.Empty<SelectProjection>()));
        Assert.Throws<ArgumentException>(() =>
            new ReturningClause(new SelectProjection[] { null! }));
    }

    [Fact]
    public void Returning_clause_accepts_portable_projection_shapes_for_later_capability_checks()
    {
        var returning = new ReturningClause(
            new[] { new SelectProjection(new WildcardExpression()) });

        Assert.IsType<WildcardExpression>(
            returning.Projections[0].Expression);
    }

    [Fact]
    public void Conflict_policy_catalog_is_stable()
    {
        Assert.Equal(
            new[] { "UpdateExisting", "DoNothing" },
            Enum.GetNames(typeof(ConflictPolicy)));
    }

    [Fact]
    public void Insert_values_factory_exposes_only_rows()
    {
        var table = Table();
        var columns = Columns("Id", "Name");
        var first = Row(Parameter("id1"), Parameter("name1"));
        var second = Row(Parameter("id2"), Parameter("name2"));
        var returning = Returning("Id");

        var statement = InsertStatement.Values(
            table, columns, new[] { first, second }, returning);

        Assert.Same(table, statement.Table);
        Assert.Equal(columns, statement.Columns);
        Assert.Equal(new[] { first, second }, statement.Rows);
        Assert.Null(statement.Source);
        Assert.Same(returning, statement.Returning);
    }

    [Fact]
    public void Insert_select_factory_exposes_only_source_and_read_only_empty_rows()
    {
        var table = Table();
        var columns = Columns("Id", "Name");
        var source = SelectWithProjectionCount(1);
        var returning = Returning("Id");

        var statement = InsertStatement.FromSelect(
            table, columns, source, returning);

        Assert.Same(table, statement.Table);
        Assert.Equal(columns, statement.Columns);
        Assert.Same(source, statement.Source);
        Assert.Empty(statement.Rows);
        AssertReadOnly(statement.Rows, Row(Parameter("other")));
        Assert.Same(returning, statement.Returning);
        Assert.Null(InsertStatement.FromSelect(
            table, columns, source).Returning);
    }

    [Fact]
    public void Insert_has_only_two_named_unambiguous_factories()
    {
        var factories = typeof(InsertStatement)
            .GetMethods(BindingFlags.Public | BindingFlags.Static |
                        BindingFlags.DeclaredOnly)
            .Where(method => method.ReturnType == typeof(InsertStatement))
            .OrderBy(method => method.Name, StringComparer.Ordinal)
            .ToArray();

        Assert.Empty(typeof(InsertStatement).GetConstructors());
        Assert.Equal(new[] { "FromSelect", "Values" },
            factories.Select(method => method.Name));
        Assert.Equal(
            new[]
            {
                typeof(SqlObjectName),
                typeof(IEnumerable<SqlIdentifier>),
                typeof(SelectStatement),
                typeof(ReturningClause)
            },
            factories.Single(method => method.Name == "FromSelect")
                .GetParameters().Select(parameter => parameter.ParameterType));
        Assert.Equal(
            new[]
            {
                typeof(SqlObjectName),
                typeof(IEnumerable<SqlIdentifier>),
                typeof(IEnumerable<SqlInsertRow>),
                typeof(ReturningClause)
            },
            factories.Single(method => method.Name == "Values")
                .GetParameters().Select(parameter => parameter.ParameterType));
        Assert.All(factories, method =>
        {
            var parameters = method.GetParameters();
            Assert.False(parameters[0].IsOptional);
            Assert.False(parameters[1].IsOptional);
            Assert.False(parameters[2].IsOptional);
            Assert.True(parameters[3].IsOptional);
        });
    }

    [Fact]
    public void Insert_factories_require_table_columns_and_their_active_source()
    {
        var table = Table();
        var columns = Columns("Id");
        var rows = new[] { Row(Parameter("id")) };
        var source = SelectWithProjectionCount(1);

        Assert.Throws<ArgumentNullException>(() =>
            InsertStatement.Values(null!, columns, rows));
        Assert.Throws<ArgumentNullException>(() =>
            InsertStatement.Values(table, null!, rows));
        Assert.Throws<ArgumentNullException>(() =>
            InsertStatement.Values(table, columns, null!));
        Assert.Throws<ArgumentNullException>(() =>
            InsertStatement.FromSelect(null!, columns, source));
        Assert.Throws<ArgumentNullException>(() =>
            InsertStatement.FromSelect(table, null!, source));
        Assert.Throws<ArgumentNullException>(() =>
            InsertStatement.FromSelect(table, columns, null!));
    }

    [Fact]
    public void Insert_values_rejects_empty_or_null_item_collections()
    {
        var table = Table();
        var columns = Columns("Id");
        var row = Row(Parameter("id"));

        Assert.Throws<ArgumentException>(() =>
            InsertStatement.Values(
                table, Array.Empty<SqlIdentifier>(), new[] { row }));
        Assert.Throws<ArgumentException>(() =>
            InsertStatement.Values(
                table,
                new SqlIdentifier[] { null! },
                new[] { row }));
        Assert.Throws<ArgumentException>(() =>
            InsertStatement.Values(
                table, columns, Array.Empty<SqlInsertRow>()));
        Assert.Throws<ArgumentException>(() =>
            InsertStatement.Values(
                table, columns, new SqlInsertRow[] { null! }));
    }

    [Fact]
    public void Insert_rejects_duplicate_columns_and_row_arity_mismatch()
    {
        var table = Table();
        var id = new SqlIdentifier("Id");

        Assert.Throws<ArgumentException>(() =>
            InsertStatement.Values(
                table,
                new[] { id, new SqlIdentifier("Id") },
                new[] { Row(Parameter("first"), Parameter("second")) }));
        Assert.Throws<ArgumentException>(() =>
            InsertStatement.Values(
                table,
                Columns("Id", "Name"),
                new[] { Row(Parameter("id")) }));
        Assert.Throws<ArgumentException>(() =>
            InsertStatement.Values(
                table,
                Columns("Id"),
                new[]
                {
                    Row(Parameter("id1")),
                    Row(Parameter("id2"), Parameter("extra"))
                }));
    }

    [Fact]
    public void Insert_select_defers_projection_arity_to_binding_and_validation()
    {
        var statement = InsertStatement.FromSelect(
            Table(),
            Columns("Id", "Name"),
            SelectWithProjectionCount(1));

        Assert.Equal(2, statement.Columns.Count);
        Assert.Single(statement.Source.Projections);
    }

    [Fact]
    public void Insert_copies_columns_and_rows_and_exposes_read_only_views()
    {
        var column = new SqlIdentifier("Id");
        var row = Row(Parameter("id"));
        var columns = new List<SqlIdentifier> { column };
        var rows = new List<SqlInsertRow> { row };

        var statement = InsertStatement.Values(Table(), columns, rows);
        columns.Clear();
        rows.Clear();

        Assert.Single(statement.Columns);
        Assert.Single(statement.Rows);
        Assert.Same(column, statement.Columns[0]);
        Assert.Same(row, statement.Rows[0]);
        AssertReadOnly(statement.Columns, new SqlIdentifier("Other"));
        AssertReadOnly(statement.Rows, Row(Parameter("other")));
    }

    [Fact]
    public void Duplicate_column_guards_use_ordinal_identifier_equality()
    {
        var statement = InsertStatement.Values(
            Table(),
            Columns("Id", "id"),
            new[] { Row(Parameter("upper"), Parameter("lower")) });

        Assert.Equal(2, statement.Columns.Count);
    }

    [Fact]
    public void Update_requires_table_and_non_empty_unique_assignments()
    {
        var table = Table();
        var assignment = Assignment("Status", "status");

        Assert.Throws<ArgumentNullException>(() =>
            new UpdateStatement(
                null!, new[] { assignment }, BooleanExpression.False));
        Assert.Throws<ArgumentNullException>(() =>
            new UpdateStatement(
                table, null!, BooleanExpression.False));
        Assert.Throws<ArgumentException>(() =>
            new UpdateStatement(
                table,
                Array.Empty<SqlAssignment>(),
                BooleanExpression.False));
        Assert.Throws<ArgumentException>(() =>
            new UpdateStatement(
                table,
                new SqlAssignment[] { null! },
                BooleanExpression.False));
        Assert.Throws<ArgumentException>(() =>
            new UpdateStatement(
                table,
                new[]
                {
                    assignment,
                    Assignment("Status", "otherStatus")
                },
                BooleanExpression.False));
    }

    [Fact]
    public void Update_rejects_null_and_direct_true_without_explicit_all_rows()
    {
        var table = Table();
        var assignments = new[] { Assignment("Status", "status") };

        Assert.Throws<ArgumentException>(() =>
            new UpdateStatement(
                table, assignments, where: null, allowAllRows: false));
        Assert.Throws<ArgumentException>(() =>
            new UpdateStatement(
                table,
                assignments,
                where: BooleanExpression.True,
                allowAllRows: false));
    }

    [Fact]
    public void Update_allows_explicit_all_rows_and_defers_complex_true_shapes()
    {
        var table = Table();
        var assignments = new[] { Assignment("Status", "status") };
        var complexTrue = new UnaryExpression(
            SqlUnaryOperator.Not, BooleanExpression.False);

        var nullWhere = new UpdateStatement(
            table, assignments, where: null, allowAllRows: true);
        var directTrue = new UpdateStatement(
            table,
            assignments,
            where: BooleanExpression.True,
            allowAllRows: true);
        var deferred = new UpdateStatement(
            table,
            assignments,
            where: complexTrue,
            allowAllRows: false);

        Assert.True(nullWhere.AllowAllRows);
        Assert.Null(nullWhere.Where);
        Assert.True(directTrue.AllowAllRows);
        Assert.Same(BooleanExpression.True, directTrue.Where);
        Assert.False(deferred.AllowAllRows);
        Assert.Same(complexTrue, deferred.Where);
    }

    [Fact]
    public void Update_copies_assignments_and_preserves_returning()
    {
        var assignment = Assignment("Status", "status");
        var supplied = new List<SqlAssignment> { assignment };
        var returning = Returning("Id");

        var statement = new UpdateStatement(
            Table(),
            supplied,
            BooleanExpression.False,
            returning: returning);
        supplied.Clear();

        Assert.Single(statement.Assignments);
        Assert.Same(assignment, statement.Assignments[0]);
        Assert.Same(returning, statement.Returning);
        AssertReadOnly(
            statement.Assignments, Assignment("Other", "other"));
    }

    [Fact]
    public void Delete_rejects_null_table_null_where_and_direct_true_without_opt_in()
    {
        var table = Table();

        Assert.Throws<ArgumentNullException>(() =>
            new DeleteStatement(
                null!, BooleanExpression.False));
        Assert.Throws<ArgumentException>(() =>
            new DeleteStatement(
                table, where: null, allowAllRows: false));
        Assert.Throws<ArgumentException>(() =>
            new DeleteStatement(
                table,
                where: BooleanExpression.True,
                allowAllRows: false));
    }

    [Fact]
    public void Delete_allows_explicit_all_rows_and_defers_complex_true_shapes()
    {
        var table = Table();
        var complexTrue = new UnaryExpression(
            SqlUnaryOperator.Not, BooleanExpression.False);

        var nullWhere = new DeleteStatement(
            table, where: null, allowAllRows: true);
        var directTrue = new DeleteStatement(
            table,
            where: BooleanExpression.True,
            allowAllRows: true);
        var deferred = new DeleteStatement(
            table,
            where: complexTrue,
            allowAllRows: false);

        Assert.True(nullWhere.AllowAllRows);
        Assert.Null(nullWhere.Where);
        Assert.True(directTrue.AllowAllRows);
        Assert.Same(BooleanExpression.True, directTrue.Where);
        Assert.False(deferred.AllowAllRows);
        Assert.Same(complexTrue, deferred.Where);
    }

    [Fact]
    public void Delete_preserves_optional_returning()
    {
        var returning = Returning("Id");

        var statement = new DeleteStatement(
            Table(), BooleanExpression.False, returning: returning);

        Assert.Same(returning, statement.Returning);
        Assert.Null(new DeleteStatement(
            Table(), BooleanExpression.False).Returning);
    }

    [Fact]
    public void Upsert_has_one_constructor_with_trailing_optional_parameters()
    {
        var constructor = Assert.Single(
            typeof(UpsertStatement).GetConstructors());
        var parameters = constructor.GetParameters();

        Assert.Equal(
            new[]
            {
                typeof(SqlObjectName),
                typeof(IEnumerable<SqlIdentifier>),
                typeof(IEnumerable<SqlAssignment>),
                typeof(IEnumerable<SqlAssignment>),
                typeof(ConflictPolicy),
                typeof(ReturningClause)
            },
            parameters.Select(parameter => parameter.ParameterType));
        Assert.All(parameters.Take(4), parameter =>
            Assert.False(parameter.IsOptional));
        Assert.True(parameters[4].IsOptional);
        Assert.Equal(ConflictPolicy.UpdateExisting,
            parameters[4].DefaultValue);
        Assert.True(parameters[5].IsOptional);
        Assert.Null(parameters[5].DefaultValue);
    }

    [Fact]
    public void Default_upsert_updates_existing_and_preserves_structured_state()
    {
        var table = Table();
        var conflictKey = new SqlIdentifier("Id");
        var insertId = new SqlAssignment(conflictKey, Parameter("id"));
        var insertName = Assignment("Name", "insertName");
        var updateName = Assignment("Name", "updateName");

        var statement = new UpsertStatement(
            table,
            new[] { conflictKey },
            new[] { insertId, insertName },
            new[] { updateName });

        Assert.Same(table, statement.Table);
        Assert.Same(conflictKey, statement.ConflictKeys[0]);
        Assert.Equal(new[] { insertId, insertName },
            statement.InsertAssignments);
        Assert.Same(updateName, statement.UpdateAssignments[0]);
        Assert.Equal(ConflictPolicy.UpdateExisting, statement.Policy);
        Assert.Null(statement.Returning);
    }

    [Fact]
    public void Do_nothing_upsert_requires_zero_updates_and_preserves_returning_intent()
    {
        var conflictKey = new SqlIdentifier("Id");
        var returning = Returning("Id");

        var statement = new UpsertStatement(
            Table(),
            new[] { conflictKey },
            new[] { new SqlAssignment(conflictKey, Parameter("id")) },
            Array.Empty<SqlAssignment>(),
            ConflictPolicy.DoNothing,
            returning);

        Assert.Equal(ConflictPolicy.DoNothing, statement.Policy);
        Assert.Empty(statement.UpdateAssignments);
        AssertReadOnly(
            statement.UpdateAssignments,
            Assignment("Name", "name"));
        Assert.Same(returning, statement.Returning);
    }

    [Fact]
    public void Upsert_requires_table_and_all_collection_inputs()
    {
        var table = Table();
        var key = new SqlIdentifier("Id");
        var insert = new SqlAssignment(key, Parameter("id"));
        var update = Assignment("Name", "name");

        Assert.Throws<ArgumentNullException>(() =>
            new UpsertStatement(
                null!,
                new[] { key },
                new[] { insert },
                new[] { update }));
        Assert.Throws<ArgumentNullException>(() =>
            new UpsertStatement(
                table, null!, new[] { insert }, new[] { update }));
        Assert.Throws<ArgumentNullException>(() =>
            new UpsertStatement(
                table, new[] { key }, null!, new[] { update }));
        Assert.Throws<ArgumentNullException>(() =>
            new UpsertStatement(
                table, new[] { key }, new[] { insert }, null!));
    }

    [Fact]
    public void Upsert_rejects_empty_or_null_item_required_collections()
    {
        var table = Table();
        var key = new SqlIdentifier("Id");
        var insert = new SqlAssignment(key, Parameter("id"));
        var update = Assignment("Name", "name");

        Assert.Throws<ArgumentException>(() =>
            new UpsertStatement(
                table,
                Array.Empty<SqlIdentifier>(),
                new[] { insert },
                new[] { update }));
        Assert.Throws<ArgumentException>(() =>
            new UpsertStatement(
                table,
                new SqlIdentifier[] { null! },
                new[] { insert },
                new[] { update }));
        Assert.Throws<ArgumentException>(() =>
            new UpsertStatement(
                table,
                new[] { key },
                Array.Empty<SqlAssignment>(),
                new[] { update }));
        Assert.Throws<ArgumentException>(() =>
            new UpsertStatement(
                table,
                new[] { key },
                new SqlAssignment[] { null! },
                new[] { update }));
        Assert.Throws<ArgumentException>(() =>
            new UpsertStatement(
                table,
                new[] { key },
                new[] { insert },
                new SqlAssignment[] { null! }));
    }

    [Fact]
    public void Upsert_rejects_duplicate_keys_and_assignment_targets()
    {
        var table = Table();
        var key = new SqlIdentifier("Id");
        var insert = new SqlAssignment(key, Parameter("id"));
        var update = Assignment("Name", "name");

        Assert.Throws<ArgumentException>(() =>
            new UpsertStatement(
                table,
                new[] { key, new SqlIdentifier("Id") },
                new[] { insert },
                new[] { update }));
        Assert.Throws<ArgumentException>(() =>
            new UpsertStatement(
                table,
                new[] { key },
                new[]
                {
                    insert,
                    new SqlAssignment(
                        new SqlIdentifier("Id"), Parameter("otherId"))
                },
                new[] { update }));
        Assert.Throws<ArgumentException>(() =>
            new UpsertStatement(
                table,
                new[] { key },
                new[] { insert },
                new[]
                {
                    update,
                    Assignment("Name", "otherName")
                }));
    }

    [Fact]
    public void Upsert_requires_every_conflict_key_in_insert_assignments()
    {
        Assert.Throws<ArgumentException>(() =>
            new UpsertStatement(
                Table(),
                Columns("Id"),
                new[] { Assignment("Name", "name") },
                new[] { Assignment("Name", "updatedName") }));
    }

    [Fact]
    public void Upsert_rejects_updates_to_conflict_key_columns()
    {
        var key = new SqlIdentifier("Id");

        Assert.Throws<ArgumentException>(() =>
            new UpsertStatement(
                Table(),
                new[] { key },
                new[] { new SqlAssignment(key, Parameter("id")) },
                new[] { Assignment("Id", "updatedId") }));
    }

    [Fact]
    public void Upsert_policy_controls_update_assignment_arity()
    {
        var key = new SqlIdentifier("Id");
        var insert = new SqlAssignment(key, Parameter("id"));

        Assert.Throws<ArgumentException>(() =>
            new UpsertStatement(
                Table(),
                new[] { key },
                new[] { insert },
                Array.Empty<SqlAssignment>(),
                ConflictPolicy.UpdateExisting));
        Assert.Throws<ArgumentException>(() =>
            new UpsertStatement(
                Table(),
                new[] { key },
                new[] { insert },
                new[] { Assignment("Name", "name") },
                ConflictPolicy.DoNothing));
    }

    [Fact]
    public void Upsert_rejects_undefined_policy()
    {
        var key = new SqlIdentifier("Id");

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new UpsertStatement(
                Table(),
                new[] { key },
                new[]
                {
                    new SqlAssignment(key, Parameter("id")),
                    Assignment("Name", "insertName")
                },
                new[] { Assignment("Name", "updateName") },
                (ConflictPolicy)int.MaxValue));
    }

    [Fact]
    public void Upsert_copies_all_collections_and_exposes_read_only_views()
    {
        var key = new SqlIdentifier("Id");
        var insertId = new SqlAssignment(key, Parameter("id"));
        var insertName = Assignment("Name", "insertName");
        var updateName = Assignment("Name", "updateName");
        var keys = new List<SqlIdentifier> { key };
        var inserts = new List<SqlAssignment> { insertId, insertName };
        var updates = new List<SqlAssignment> { updateName };

        var statement = new UpsertStatement(
            Table(), keys, inserts, updates);
        keys.Clear();
        inserts.Clear();
        updates.Clear();

        Assert.Single(statement.ConflictKeys);
        Assert.Equal(2, statement.InsertAssignments.Count);
        Assert.Single(statement.UpdateAssignments);
        AssertReadOnly(
            statement.ConflictKeys, new SqlIdentifier("Other"));
        AssertReadOnly(
            statement.InsertAssignments,
            Assignment("Other", "otherInsert"));
        AssertReadOnly(
            statement.UpdateAssignments,
            Assignment("Other", "otherUpdate"));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Bulk_insert_rejects_non_positive_batch_maximum(int batchSize)
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new BulkInsertOperation(
                Table(),
                Columns("Id"),
                new[] { Row(Parameter("id")) },
                batchSize));
    }

    [Fact]
    public void Bulk_insert_requires_table_columns_rows_and_non_null_items()
    {
        var table = Table();
        var columns = Columns("Id");
        var rows = new[] { Row(Parameter("id")) };

        Assert.Throws<ArgumentNullException>(() =>
            new BulkInsertOperation(null!, columns, rows, 100));
        Assert.Throws<ArgumentNullException>(() =>
            new BulkInsertOperation(table, null!, rows, 100));
        Assert.Throws<ArgumentNullException>(() =>
            new BulkInsertOperation(table, columns, null!, 100));
        Assert.Throws<ArgumentException>(() =>
            new BulkInsertOperation(
                table, Array.Empty<SqlIdentifier>(), rows, 100));
        Assert.Throws<ArgumentException>(() =>
            new BulkInsertOperation(
                table,
                new SqlIdentifier[] { null! },
                rows,
                100));
        Assert.Throws<ArgumentException>(() =>
            new BulkInsertOperation(
                table,
                columns,
                Array.Empty<SqlInsertRow>(),
                100));
        Assert.Throws<ArgumentException>(() =>
            new BulkInsertOperation(
                table,
                columns,
                new SqlInsertRow[] { null! },
                100));
    }

    [Fact]
    public void Bulk_insert_rejects_duplicate_columns_and_row_arity_mismatch()
    {
        var table = Table();

        Assert.Throws<ArgumentException>(() =>
            new BulkInsertOperation(
                table,
                Columns("Id", "Id"),
                new[] { Row(Parameter("id"), Parameter("otherId")) },
                100));
        Assert.Throws<ArgumentException>(() =>
            new BulkInsertOperation(
                table,
                Columns("Id", "Name"),
                new[] { Row(Parameter("id")) },
                100));
        Assert.Throws<ArgumentException>(() =>
            new BulkInsertOperation(
                table,
                Columns("Id"),
                new[]
                {
                    Row(Parameter("id1")),
                    Row(Parameter("id2"), Parameter("extra"))
                },
                100));
    }

    [Fact]
    public void Bulk_batch_size_is_a_positive_caller_maximum_hint()
    {
        var operation = new BulkInsertOperation(
            Table(),
            Columns("Id"),
            new[] { Row(Parameter("id")) },
            batchSize: 250);

        Assert.Equal(250, operation.BatchSize);
        Assert.DoesNotContain(
            typeof(BulkInsertOperation).GetProperties(),
            property =>
                property.Name.Contains("Exact", StringComparison.OrdinalIgnoreCase) ||
                property.Name.Contains("Minimum", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Bulk_insert_copies_columns_and_rows_and_has_no_returning_shape()
    {
        var column = new SqlIdentifier("Id");
        var row = Row(Parameter("id"));
        var columns = new List<SqlIdentifier> { column };
        var rows = new List<SqlInsertRow> { row };

        var operation = new BulkInsertOperation(
            Table(), columns, rows, 100);
        columns.Clear();
        rows.Clear();

        Assert.Single(operation.Columns);
        Assert.Single(operation.Rows);
        Assert.Same(column, operation.Columns[0]);
        Assert.Same(row, operation.Rows[0]);
        AssertReadOnly(operation.Columns, new SqlIdentifier("Other"));
        AssertReadOnly(operation.Rows, Row(Parameter("other")));
        Assert.DoesNotContain(
            typeof(BulkInsertOperation).GetProperties(),
            property => property.PropertyType == typeof(ReturningClause));
        Assert.DoesNotContain(
            typeof(BulkInsertOperation).GetConstructors()
                .SelectMany(constructor => constructor.GetParameters()),
            parameter => parameter.ParameterType == typeof(ReturningClause));
        Assert.Null(typeof(BulkInsertOperation).Assembly.GetType(
            "Dos.ORM.SqlAst.BulkInsertStatement"));
    }

    [Fact]
    public void Returning_clause_is_available_on_each_non_bulk_write_shape()
    {
        var returning = Returning("Id");
        var key = new SqlIdentifier("Id");
        var insertAssignment = new SqlAssignment(key, Parameter("id"));
        var insert = InsertStatement.Values(
            Table(),
            new[] { key },
            new[] { Row(Parameter("insertId")) },
            returning);
        var update = new UpdateStatement(
            Table(),
            new[] { Assignment("Name", "updateName") },
            BooleanExpression.False,
            returning: returning);
        var delete = new DeleteStatement(
            Table(),
            BooleanExpression.False,
            returning: returning);
        var upsert = new UpsertStatement(
            Table(),
            new[] { key },
            new[] { insertAssignment },
            Array.Empty<SqlAssignment>(),
            ConflictPolicy.DoNothing,
            returning);

        Assert.Same(returning, insert.Returning);
        Assert.Same(returning, update.Returning);
        Assert.Same(returning, delete.Returning);
        Assert.Same(returning, upsert.Returning);
    }

    [Fact]
    public void Do_nothing_upsert_keeps_returning_clause_and_empty_update_shape()
    {
        var returning = Returning("Id");
        var key = new SqlIdentifier("Id");
        var upsert = new UpsertStatement(
            Table(),
            new[] { key },
            new[] { new SqlAssignment(key, Parameter("id")) },
            Array.Empty<SqlAssignment>(),
            ConflictPolicy.DoNothing,
            returning);

        // Compiler contract: a conflict returns zero rows, never the existing row.
        Assert.Same(returning, upsert.Returning);
        Assert.Equal(ConflictPolicy.DoNothing, upsert.Policy);
        Assert.Empty(upsert.UpdateAssignments);
    }

    [Fact]
    public void Returning_clause_stays_projection_only_and_lowering_neutral()
    {
        // Compiler contract: insert/update/upsert return the written row image;
        // delete returns the pre-delete image; multi-row order is undefined.
        // If a dialect cannot do that atomically, compilation must report the
        // feature as unsupported instead of using an unlocked write-then-read.
        Assert.Equal(
            new[] { nameof(ReturningClause.Projections) },
            typeof(ReturningClause).GetProperties()
                .Select(property => property.Name));
        Assert.DoesNotContain(
            typeof(ReturningClause).GetProperties(),
            property =>
                property.Name.Contains("Order", StringComparison.OrdinalIgnoreCase) ||
                property.Name.Contains("Existing", StringComparison.OrdinalIgnoreCase) ||
                property.Name.Contains("Fallback", StringComparison.OrdinalIgnoreCase) ||
                property.Name.Contains("ReadBack", StringComparison.OrdinalIgnoreCase) ||
                property.Name.Contains("Unlocked", StringComparison.OrdinalIgnoreCase) ||
                property.Name.Contains("Atomic", StringComparison.OrdinalIgnoreCase) ||
                property.Name.Contains("Provider", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Dml_model_is_immutable_structured_and_provider_neutral()
    {
        var concreteTypes = new[]
        {
            typeof(SqlAssignment),
            typeof(SqlInsertRow),
            typeof(ReturningClause),
            typeof(InsertStatement),
            typeof(UpdateStatement),
            typeof(DeleteStatement),
            typeof(UpsertStatement),
            typeof(BulkInsertOperation)
        };

        Assert.All(concreteTypes, type =>
        {
            Assert.True(type.IsSealed, type.FullName);
            Assert.True(typeof(SqlNode).IsAssignableFrom(type), type.FullName);
            Assert.All(
                type.GetProperties(BindingFlags.Instance | BindingFlags.Public),
                property => Assert.Null(property.SetMethod));
        });
        Assert.All(
            new[]
            {
                typeof(InsertStatement),
                typeof(UpdateStatement),
                typeof(DeleteStatement),
                typeof(UpsertStatement),
                typeof(BulkInsertOperation)
            },
            type => Assert.True(
                typeof(SqlStatement).IsAssignableFrom(type), type.FullName));

        var publicParameters = concreteTypes
            .SelectMany(type => type.GetConstructors())
            .SelectMany(constructor => constructor.GetParameters())
            .Concat(typeof(InsertStatement)
                .GetMethods(BindingFlags.Public | BindingFlags.Static |
                            BindingFlags.DeclaredOnly)
                .SelectMany(method => method.GetParameters()))
            .ToArray();
        Assert.DoesNotContain(
            publicParameters,
            parameter => parameter.ParameterType == typeof(string) ||
                         parameter.ParameterType == typeof(object));

        var properties = concreteTypes
            .SelectMany(type => type.GetProperties())
            .ToArray();
        var valueProperty = Assert.Single(
            properties, property => property.Name == "Value");
        Assert.Equal(typeof(SqlAssignment), valueProperty.DeclaringType);
        Assert.Equal(typeof(SqlExpression), valueProperty.PropertyType);
        Assert.DoesNotContain(properties, property =>
            property.Name.Contains("DatabaseType", StringComparison.OrdinalIgnoreCase) ||
            property.Name.Contains("Provider", StringComparison.OrdinalIgnoreCase) ||
            property.Name.Contains("Dialect", StringComparison.OrdinalIgnoreCase) ||
            property.Name.Contains("RawSql", StringComparison.OrdinalIgnoreCase) ||
            property.PropertyType == typeof(string) ||
            property.PropertyType == typeof(object));
    }

    private static SqlObjectName Table(string name = "Users") =>
        new(new SqlIdentifier(name));

    private static SqlIdentifier[] Columns(params string[] names) =>
        names.Select(name => new SqlIdentifier(name)).ToArray();

    private static ColumnExpression Column(string name) =>
        new(new SqlIdentifier(name));

    private static ParameterExpression Parameter(string name) =>
        new(new ParameterDefinition(
            name, new SqlTypeDescriptor(LogicalDbType.String)));

    private static SqlAssignment Assignment(
        string column, string parameter) =>
        new(new SqlIdentifier(column), Parameter(parameter));

    private static SqlInsertRow Row(params SqlExpression[] values) =>
        new(values);

    private static ReturningClause Returning(params string[] columns) =>
        new(columns.Select(column =>
            new SelectProjection(Column(column))));

    private static SelectStatement SelectWithProjectionCount(int count)
    {
        var projections = Enumerable.Range(0, count)
            .Select(index => new SelectProjection(
                index % 2 == 0
                    ? BooleanExpression.True
                    : BooleanExpression.False))
            .ToArray();
        return new SelectStatement(projections);
    }

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

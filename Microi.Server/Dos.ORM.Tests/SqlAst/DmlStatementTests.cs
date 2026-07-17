using System.Collections;
using System.Reflection;
using System.Reflection.Emit;
using System.Runtime.CompilerServices;
using System.Text;
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
    public void Insert_select_columns_reject_empty_null_items_and_duplicates()
    {
        var table = Table();
        var source = SelectWithProjectionCount(1);

        Assert.Throws<ArgumentException>(() =>
            InsertStatement.FromSelect(
                table, Array.Empty<SqlIdentifier>(), source));
        Assert.Throws<ArgumentException>(() =>
            InsertStatement.FromSelect(
                table, new SqlIdentifier[] { null! }, source));
        Assert.Throws<ArgumentException>(() =>
            InsertStatement.FromSelect(
                table, Columns("Id", "Id"), source));
    }

    [Fact]
    public void Insert_select_columns_are_copied_and_read_only()
    {
        var column = new SqlIdentifier("Id");
        var columns = new List<SqlIdentifier> { column };

        var statement = InsertStatement.FromSelect(
            Table(), columns, SelectWithProjectionCount(1));
        columns.Clear();

        Assert.Single(statement.Columns);
        Assert.Same(column, statement.Columns[0]);
        AssertReadOnly(statement.Columns, new SqlIdentifier("Other"));
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
    public void Bulk_batch_size_records_the_positive_caller_maximum_request()
    {
        var operation = new BulkInsertOperation(
            Table(),
            Columns("Id"),
            new[] { Row(Parameter("id")) },
            batchSize: 250);

        Assert.Equal(250, operation.BatchSize);

        // Mandatory later compiler acceptance tests must prove every emitted or
        // native batch is <= BatchSize. They must also cover a platform limit
        // below 250, proving lowering may shrink this request but never enlarge it.
        // This AST-only test intentionally proves storage, not execution behavior.
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
    public void Returning_clause_stays_projection_only_for_later_lowering_tests()
    {
        // Mandatory later compiler tests must verify written row images for
        // insert/update/upsert, the pre-delete image for delete, zero rows for a
        // DoNothing conflict, no ordering promise, and an unsupported-capability
        // error instead of an unlocked write-then-read fallback.
        // This AST-only test freezes only the projection/lowering-neutral shape.
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

        var properties = concreteTypes
            .SelectMany(type => type.GetProperties(
                BindingFlags.Public | BindingFlags.Instance |
                BindingFlags.Static | BindingFlags.DeclaredOnly))
            .ToArray();
        var valueProperty = Assert.Single(
            properties, property => property.Name == "Value");
        Assert.Equal(typeof(SqlAssignment), valueProperty.DeclaringType);
        Assert.Equal(typeof(SqlExpression), valueProperty.PropertyType);
    }

    [Fact]
    public void Dml_declared_public_surface_has_only_structured_neutral_types()
    {
        const BindingFlags flags = BindingFlags.Public |
                                   BindingFlags.Instance |
                                   BindingFlags.Static |
                                   BindingFlags.DeclaredOnly;

        foreach (var type in DmlPublicTypes())
        {
            foreach (var field in type.GetFields(flags))
            {
                AssertNeutralImplementationName(
                    field.Name, $"public field {type.FullName}.{field.Name}");
                AssertPublicSurfaceType(
                    field.FieldType,
                    $"public field {type.FullName}.{field.Name}");
            }

            foreach (var constructor in type.GetConstructors(flags))
            {
                AssertNeutralImplementationName(
                    constructor.Name,
                    $"public constructor {type.FullName}");
                Assert.All(constructor.GetParameters(), parameter =>
                {
                    AssertNeutralImplementationName(
                        parameter.Name ?? string.Empty,
                        $"parameter on {type.FullName}.{constructor.Name}");
                    AssertPublicSurfaceType(
                        parameter.ParameterType,
                        $"parameter {parameter.Name} on " +
                        $"{type.FullName}.{constructor.Name}");
                });
            }

            foreach (var method in type.GetMethods(flags))
            {
                AssertNeutralImplementationName(
                    method.Name, $"public method {type.FullName}.{method.Name}");
                AssertPublicSurfaceType(
                    method.ReturnType,
                    $"return type of {type.FullName}.{method.Name}");
                Assert.All(method.GetParameters(), parameter =>
                {
                    AssertNeutralImplementationName(
                        parameter.Name ?? string.Empty,
                        $"parameter on {type.FullName}.{method.Name}");
                    AssertPublicSurfaceType(
                        parameter.ParameterType,
                        $"parameter {parameter.Name} on " +
                        $"{type.FullName}.{method.Name}");
                });
            }

            foreach (var property in type.GetProperties(flags))
            {
                AssertNeutralImplementationName(
                    property.Name,
                    $"public property {type.FullName}.{property.Name}");
                AssertPublicSurfaceType(
                    property.PropertyType,
                    $"public property {type.FullName}.{property.Name}");
                Assert.All(property.GetIndexParameters(), parameter =>
                    AssertPublicSurfaceType(
                        parameter.ParameterType,
                        $"index parameter {parameter.Name} on " +
                        $"{type.FullName}.{property.Name}"));
            }
        }
    }

    [Fact]
    public void Dml_declared_implementation_il_has_no_forbidden_dependencies()
    {
        const BindingFlags flags = BindingFlags.Public |
                                   BindingFlags.NonPublic |
                                   BindingFlags.Instance |
                                   BindingFlags.Static |
                                   BindingFlags.DeclaredOnly;

        foreach (var type in DmlImplementationTypes())
        {
            AssertNeutralImplementationName(
                type.FullName ?? type.Name, $"implementation type {type.Name}");

            foreach (var field in type.GetFields(flags))
            {
                var context = $"field {type.FullName}.{field.Name}";
                AssertNeutralImplementationName(field.Name, context);
                AssertNoRuntimeObjectHolder(field.FieldType, context);
                Assert.False(
                    field.FieldType == typeof(string),
                    $"{context} must not hold SQL/provider text.");
            }

            foreach (var property in type.GetProperties(flags))
            {
                var context = $"property {type.FullName}.{property.Name}";
                AssertNeutralImplementationName(property.Name, context);
                AssertNoRuntimeObjectHolder(property.PropertyType, context);
                Assert.False(
                    property.PropertyType == typeof(string),
                    $"{context} must not hold SQL/provider text.");
            }

            var methods = type.GetMethods(flags).Cast<MethodBase>()
                .Concat(type.GetConstructors(flags));
            foreach (var method in methods)
            {
                var context = $"method {type.FullName}.{method.Name}";
                AssertNeutralImplementationName(method.Name, context);
                if (method is MethodInfo methodInfo)
                {
                    AssertNoRuntimeObjectHolder(
                        methodInfo.ReturnType, $"return type of {context}");
                }

                Assert.All(method.GetParameters(), parameter =>
                    AssertNoRuntimeObjectHolder(
                        parameter.ParameterType,
                        $"parameter {parameter.Name} on {context}"));

                foreach (var operand in ReadIlOperands(method))
                {
                    if (operand is string literal)
                    {
                        AssertNeutralIlLiteral(literal, context);
                    }
                    else if (operand is MemberInfo referencedMember)
                    {
                        AssertNeutralImplementationName(
                            referencedMember.Name,
                            $"IL reference from {context}");
                        if (referencedMember.DeclaringType != null)
                        {
                            AssertNeutralImplementationName(
                                referencedMember.DeclaringType.FullName ??
                                referencedMember.DeclaringType.Name,
                                $"IL reference from {context}");
                        }
                    }
                }
            }
        }
    }

    [Fact]
    public void Dml_source_has_no_forbidden_dependencies_outside_comments()
    {
        var sourcePath = Task5ProductionSourcePath();
        Assert.True(File.Exists(sourcePath), sourcePath);

        var sourceWithoutComments = RemoveCSharpComments(
            File.ReadAllText(sourcePath));

        // XML API contracts may legitimately name compiler/provider concepts.
        // Scanning comment-free source retains executable identifiers and string
        // literals while avoiding false positives from that documentation.
        AssertNeutralImplementationName(
            sourceWithoutComments, "Task 5 production source");
        AssertNeutralIlLiteral(
            sourceWithoutComments, "Task 5 production source");
        Assert.DoesNotContain(
            ReadCSharpIdentifiers(sourceWithoutComments),
            identifier => identifier.Equals(
                "object", StringComparison.OrdinalIgnoreCase));
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

    private static Type[] DmlPublicTypes() =>
    [
        typeof(ConflictPolicy),
        typeof(SqlAssignment),
        typeof(SqlInsertRow),
        typeof(ReturningClause),
        typeof(InsertStatement),
        typeof(UpdateStatement),
        typeof(DeleteStatement),
        typeof(UpsertStatement),
        typeof(BulkInsertOperation)
    ];

    private static Type[] DmlImplementationTypes()
    {
        var guard = typeof(SqlAssignment).Assembly.GetType(
            "Dos.ORM.SqlAst.DmlAstGuard");
        Assert.NotNull(guard);
        return DmlPublicTypes().Append(guard).ToArray()!;
    }

    private static void AssertPublicSurfaceType(Type type, string context)
    {
        Assert.False(
            type == typeof(string) || type == typeof(object),
            $"{context} exposes unstructured type {type.FullName}.");
        AssertNoRuntimeObjectHolder(type, context);
    }

    private static void AssertNoRuntimeObjectHolder(Type type, string context)
    {
        Assert.False(
            type == typeof(object),
            $"{context} stores an arbitrary runtime object.");
        AssertNeutralImplementationName(
            type.FullName ?? type.Name, context);

        if (type.HasElementType && type.GetElementType() is Type elementType)
        {
            AssertNoRuntimeObjectHolder(elementType, context);
        }

        foreach (var argument in type.GetGenericArguments())
        {
            AssertNoRuntimeObjectHolder(argument, context);
        }
    }

    private static void AssertNeutralImplementationName(
        string value, string context)
    {
        var forbiddenTerms = new[]
        {
            "DatabaseType", "Provider", "Dialect", "RawSql", "SqlText",
            "Render", "SqlCompiler", "Command", "Connection",
            "DbParameter", "IDataParameter",
            "SqlClient", "Npgsql", "MySql", "Oracle", "Postgre",
            "Kingbase", "Dameng", "DmProvider", "RuntimeValue"
        };
        var forbiddenTerm = forbiddenTerms.FirstOrDefault(term =>
            value.Contains(term, StringComparison.OrdinalIgnoreCase));
        Assert.True(
            forbiddenTerm == null,
            $"{context} contains forbidden term {forbiddenTerm}.");
        Assert.False(
            value.StartsWith("Render", StringComparison.OrdinalIgnoreCase) ||
            value.StartsWith("Compile", StringComparison.OrdinalIgnoreCase) ||
            value.StartsWith("ToSql", StringComparison.OrdinalIgnoreCase) ||
            value.StartsWith("BuildSql", StringComparison.OrdinalIgnoreCase),
            $"{context} contains forbidden implementation name {value}.");
    }

    private static void AssertNeutralIlLiteral(string value, string context)
    {
        var forbiddenTerms = new[]
        {
            "database type", "provider", "dialect", "mysql", "oracle",
            "postgres", "npgsql", "sql server", "sqlserver", "kingbase",
            "dameng", "dmdb", "sqlite"
        };
        var forbiddenTerm = forbiddenTerms.FirstOrDefault(term =>
            value.Contains(term, StringComparison.OrdinalIgnoreCase));
        Assert.True(
            forbiddenTerm == null,
            $"{context} contains forbidden literal term {forbiddenTerm}.");

        var containsSelect =
            value.Contains("SELECT ", StringComparison.OrdinalIgnoreCase) &&
            value.Contains(" FROM ", StringComparison.OrdinalIgnoreCase);
        var containsUpdate =
            value.Contains("UPDATE ", StringComparison.OrdinalIgnoreCase) &&
            value.Contains(" SET ", StringComparison.OrdinalIgnoreCase);
        var containsRawSql =
            containsSelect || containsUpdate ||
            value.Contains("INSERT INTO ", StringComparison.OrdinalIgnoreCase) ||
            value.Contains("DELETE FROM ", StringComparison.OrdinalIgnoreCase) ||
            value.Contains("MERGE INTO ", StringComparison.OrdinalIgnoreCase);
        Assert.False(
            containsRawSql,
            $"{context} embeds raw SQL literal: {value}");
    }

    private static IEnumerable<object> ReadIlOperands(MethodBase method)
    {
        var body = method.GetMethodBody();
        var il = body?.GetILAsByteArray();
        if (il == null)
        {
            yield break;
        }

        var typeArguments = method.DeclaringType?.GetGenericArguments();
        var methodArguments = method.IsGenericMethod
            ? method.GetGenericArguments()
            : null;
        var offset = 0;
        while (offset < il.Length)
        {
            short opcodeValue = il[offset++];
            if (opcodeValue == 0xfe)
            {
                opcodeValue = unchecked((short)(0xfe00 | il[offset++]));
            }

            if (!IlOpCodes.TryGetValue(opcodeValue, out var opcode))
            {
                throw new InvalidOperationException(
                    $"Unknown IL opcode 0x{opcodeValue:x4} in {method}.");
            }

            switch (opcode.OperandType)
            {
                case OperandType.InlineNone:
                    break;
                case OperandType.ShortInlineBrTarget:
                case OperandType.ShortInlineI:
                case OperandType.ShortInlineVar:
                    offset += 1;
                    break;
                case OperandType.InlineVar:
                    offset += 2;
                    break;
                case OperandType.InlineBrTarget:
                case OperandType.InlineI:
                case OperandType.ShortInlineR:
                case OperandType.InlineSig:
                    offset += 4;
                    break;
                case OperandType.InlineI8:
                case OperandType.InlineR:
                    offset += 8;
                    break;
                case OperandType.InlineSwitch:
                    var targetCount = BitConverter.ToInt32(il, offset);
                    offset += 4 + (targetCount * 4);
                    break;
                case OperandType.InlineString:
                    var stringToken = BitConverter.ToInt32(il, offset);
                    offset += 4;
                    yield return method.Module.ResolveString(stringToken);
                    break;
                case OperandType.InlineField:
                case OperandType.InlineMethod:
                case OperandType.InlineTok:
                case OperandType.InlineType:
                    var memberToken = BitConverter.ToInt32(il, offset);
                    offset += 4;
                    var resolvedMember = method.Module.ResolveMember(
                        memberToken, typeArguments, methodArguments);
                    if (resolvedMember == null)
                    {
                        throw new InvalidOperationException(
                            $"Cannot resolve IL token {memberToken} in {method}.");
                    }
                    yield return resolvedMember;
                    break;
                default:
                    throw new InvalidOperationException(
                        $"Unsupported IL operand {opcode.OperandType} in {method}.");
            }
        }
    }

    private static readonly IReadOnlyDictionary<short, OpCode> IlOpCodes =
        typeof(OpCodes)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(field => field.FieldType == typeof(OpCode))
            .Select(field => (OpCode)field.GetValue(null)!)
            .ToDictionary(opcode => opcode.Value);

    private static string Task5ProductionSourcePath(
        [CallerFilePath] string testFilePath = "") =>
        Path.GetFullPath(Path.Combine(
            Path.GetDirectoryName(testFilePath)!,
            "..", "..", "Dos.ORM", "SqlAst", "SqlStatements.cs"));

    private static string RemoveCSharpComments(string source)
    {
        var result = new StringBuilder(source.Length);
        var inLineComment = false;
        var inBlockComment = false;
        var inString = false;
        var inVerbatimString = false;
        var inCharacter = false;

        for (var index = 0; index < source.Length; index++)
        {
            var current = source[index];
            var next = index + 1 < source.Length
                ? source[index + 1]
                : '\0';

            if (inLineComment)
            {
                if (current == '\r' || current == '\n')
                {
                    inLineComment = false;
                    result.Append(current);
                }
                continue;
            }

            if (inBlockComment)
            {
                if (current == '*' && next == '/')
                {
                    inBlockComment = false;
                    result.Append(' ');
                    index++;
                }
                else if (current == '\r' || current == '\n')
                {
                    result.Append(current);
                }
                continue;
            }

            if (inVerbatimString)
            {
                result.Append(current);
                if (current == '"')
                {
                    if (next == '"')
                    {
                        result.Append(next);
                        index++;
                    }
                    else
                    {
                        inVerbatimString = false;
                    }
                }
                continue;
            }

            if (inString || inCharacter)
            {
                result.Append(current);
                if (current == '\\' && next != '\0')
                {
                    result.Append(next);
                    index++;
                }
                else if (inString && current == '"')
                {
                    inString = false;
                }
                else if (inCharacter && current == '\'')
                {
                    inCharacter = false;
                }
                continue;
            }

            if (current == '/' && next == '/')
            {
                inLineComment = true;
                result.Append(' ');
                index++;
            }
            else if (current == '/' && next == '*')
            {
                inBlockComment = true;
                result.Append(' ');
                index++;
            }
            else if (current == '@' && next == '"')
            {
                inVerbatimString = true;
                result.Append(current);
                result.Append(next);
                index++;
            }
            else
            {
                result.Append(current);
                inString = current == '"';
                inCharacter = current == '\'';
            }
        }

        return result.ToString();
    }

    private static IEnumerable<string> ReadCSharpIdentifiers(string source)
    {
        var identifier = new StringBuilder();
        foreach (var current in source)
        {
            if (char.IsLetterOrDigit(current) || current == '_')
            {
                identifier.Append(current);
            }
            else if (identifier.Length > 0)
            {
                yield return identifier.ToString();
                identifier.Clear();
            }
        }

        if (identifier.Length > 0)
        {
            yield return identifier.ToString();
        }
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

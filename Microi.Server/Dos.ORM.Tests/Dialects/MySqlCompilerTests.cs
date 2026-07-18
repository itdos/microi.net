using System.Data;
using Dos.ORM.Dialects.MySql;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;
using Dos.ORM.Tests.TestInfrastructure;

namespace Dos.ORM.Tests.Dialects;

public sealed class MySqlCompilerTests
{
    [Fact]
    public void MySql_pagination_is_count_then_data_with_structural_integers()
    {
        var compiler = new MySqlCompiler();

        var plan = compiler.Compile(PagedUsers(), TestOptions.MySql80);

        var data = PlanAssert.PaginationDataStep(plan);
        Assert.Contains("`Sys_User`", data.CommandText, StringComparison.Ordinal);
        Assert.Contains("LIMIT 20 OFFSET 40", data.CommandText,
            StringComparison.Ordinal);
        Assert.Empty(data.Parameters);
        PlanAssert.IsCountThenData(plan);
        Assert.All(
            plan.Steps.OfType<SqlCommandStep>(),
            command => Assert.Equal(
                TestOptions.MySql80.StorageContract.Fingerprint,
                command.InternalValueContract.StorageContractFingerprint));
    }

    [Fact]
    public void MySql_parameters_are_question_prefixed_and_identifiers_are_segmented()
    {
        var compiler = new MySqlCompiler();

        var command = PlanAssert.SingleSql(compiler.Compile(
            AstSamples.UserByAccountAndStatus(), TestOptions.MySql80));

        Assert.Contains("`u`.`Account` = ?p0", command.CommandText,
            StringComparison.Ordinal);
        Assert.Contains("`u`.`Status` = ?p1", command.CommandText,
            StringComparison.Ordinal);
        Assert.Equal(new[] { "account", "status" },
            command.Parameters.Select(parameter => parameter.Name));
    }

    [Fact]
    public void Equivalent_distinct_parameter_definitions_reuse_one_slot()
    {
        var first = Input("shared", LogicalDbType.String, 50);
        var equivalent = Input("shared", LogicalDbType.String, 50);
        Assert.NotSame(first, equivalent);
        var query = new SelectStatement(new[]
        {
            new SelectProjection(new ParameterExpression(first)),
            new SelectProjection(new ParameterExpression(equivalent))
        });

        var command = PlanAssert.SingleSql(
            new MySqlCompiler().Compile(query, TestOptions.MySql80));

        Assert.Equal("SELECT ?p0,?p0", command.CommandText);
        Assert.Same(first, Assert.Single(command.Parameters));
        Assert.Equal("p0", Assert.Single(command.InternalParameterPlaceholders));
    }

    [Fact]
    public void MySql_functions_use_the_certified_native_spellings()
    {
        var first = Input("first", LogicalDbType.String, 50);
        var second = Input("second", LogicalDbType.String, 50);
        var json = Input("json", LogicalDbType.Json);
        var path = Input("path", LogicalDbType.String, 100);
        var query = new SelectStatement(new[]
        {
            Projection(SemanticFunctions.Coalesce,
                new ParameterExpression(first),
                new ParameterExpression(second)),
            Projection(SemanticFunctions.Concat,
                new ParameterExpression(first),
                new ParameterExpression(second)),
            Projection(SemanticFunctions.CurrentDateTime),
            Projection(SemanticFunctions.JsonValue,
                new ParameterExpression(json),
                new ParameterExpression(path))
        });

        var command = PlanAssert.SingleSql(
            new MySqlCompiler().Compile(query, TestOptions.MySql80));

        Assert.Contains("COALESCE(?p0,?p1)", command.CommandText,
            StringComparison.Ordinal);
        Assert.Contains("CONCAT(?p0,?p1)", command.CommandText,
            StringComparison.Ordinal);
        Assert.Contains("CURRENT_TIMESTAMP", command.CommandText,
            StringComparison.Ordinal);
        Assert.Contains("JSON_UNQUOTE(JSON_EXTRACT(?p2,?p3))",
            command.CommandText,
            StringComparison.Ordinal);
    }

    [Fact]
    public void MySql_upsert_is_one_atomic_on_duplicate_key_command()
    {
        var id = Input("id", LogicalDbType.Int64);
        var name = Input("name", LogicalDbType.String, 200);
        var updated = Input("updated", LogicalDbType.String, 200);
        var statement = new UpsertStatement(
            ObjectName("Sys_User"),
            new[] { Id("Id") },
            new[]
            {
                new SqlAssignment(Id("Id"), new ParameterExpression(id)),
                new SqlAssignment(Id("Name"), new ParameterExpression(name))
            },
            new[]
            {
                new SqlAssignment(
                    Id("Name"), new ParameterExpression(updated))
            });

        var command = PlanAssert.SingleSql(
            new MySqlCompiler().Compile(statement, TestOptions.MySql80));

        Assert.Contains("INSERT INTO `Sys_User`", command.CommandText,
            StringComparison.Ordinal);
        Assert.Contains("ON DUPLICATE KEY UPDATE", command.CommandText,
            StringComparison.Ordinal);
        Assert.Contains("`Name` = ?p2", command.CommandText,
            StringComparison.Ordinal);
        Assert.Equal(SqlResultShape.AffectedRows, command.ResultShape);
        Assert.Equal(PlanResultRole.Final, command.ResultRole);
    }

    [Fact]
    public void MySql_schema_uses_auto_increment_and_native_json_type()
    {
        var table = new TableDefinition(
            ObjectName("Diy_Test"),
            new[]
            {
                new ColumnDefinition(
                    Id("Id"),
                    new SqlTypeDescriptor(LogicalDbType.Int64),
                    ColumnNullability.NotNullable,
                    new IdentityGenerationDefinition(1, 1)),
                new ColumnDefinition(
                    Id("Payload"),
                    new SqlTypeDescriptor(LogicalDbType.Json),
                    ColumnNullability.Nullable)
            },
            new ConstraintDefinition[]
            {
                new PrimaryKeyDefinition(Id("PK_Diy_Test"),
                    new[] { Id("Id") })
            });
        var operation = new CreateTableOperation(
            table, CreateObjectBehavior.AlreadySatisfiedIfExists);

        var command = PlanAssert.SingleSql(
            new MySqlCompiler().Compile(operation, TestOptions.MySql80));

        Assert.Contains("CREATE TABLE IF NOT EXISTS `Diy_Test`",
            command.CommandText, StringComparison.Ordinal);
        Assert.Contains("`Id` BIGINT NOT NULL AUTO_INCREMENT",
            command.CommandText, StringComparison.Ordinal);
        Assert.Contains("`Payload` JSON NULL", command.CommandText,
            StringComparison.Ordinal);
        Assert.Equal(PlanTransactionBehavior.ImplicitCommit,
            command.TransactionBehavior);
    }

    [Fact]
    public void MySql_metadata_queries_information_schema()
    {
        var operation = new ListColumnsOperation(ObjectName("Sys_User"));

        var command = PlanAssert.SingleSql(
            new MySqlCompiler().Compile(operation, TestOptions.MySql80));

        Assert.Contains("`information_schema`.`COLUMNS`", command.CommandText,
            StringComparison.OrdinalIgnoreCase);
        Assert.Contains("TABLE_SCHEMA", command.CommandText,
            StringComparison.OrdinalIgnoreCase);
        Assert.Contains("DATABASE()", command.CommandText,
            StringComparison.OrdinalIgnoreCase);
        Assert.Equal(SqlResultShape.Metadata, command.ResultShape);
    }

    [Fact]
    public void MySql_admin_operations_use_the_administrative_route()
    {
        var operation = new CreateDatabaseOperation(
            Id("microi_test"), CreateObjectBehavior.FailIfExists);

        var plan = new MySqlCompiler().Compile(operation, TestOptions.MySql80);

        var step = Assert.IsType<AdminStep>(Assert.Single(plan.Steps));
        Assert.Same(operation, step.Operation);
        Assert.Equal(PlanConnectionRole.Administrative, step.ConnectionRole);
        Assert.Equal(PlanTransactionBehavior.ImplicitCommit,
            step.TransactionBehavior);
    }

    [Fact]
    public void MySql_bulk_fails_closed_until_the_bulk_lowering_task()
    {
        var value = Input("bulk_value", LogicalDbType.Int32);
        var operation = new BulkInsertOperation(
            ObjectName("Diy_Test"),
            new[] { Id("Value") },
            new[]
            {
                new SqlInsertRow(new SqlExpression[]
                {
                    new ParameterExpression(value)
                })
            },
            batchSize: 100);

        var exception = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => new MySqlCompiler().Compile(
                operation, TestOptions.MySql80));

        Assert.Equal("mysql.bulk_insert", exception.Feature);
        Assert.Equal("$", exception.NodePath);
    }

    [Fact]
    public void MySql57_share_lock_fails_closed_instead_of_emitting_for_share()
    {
        var query = new SelectStatement(
            new[]
            {
                new SelectProjection(BooleanExpression.True)
            },
            lockSpec: new LockSpec(SqlLockMode.Share));

        var exception = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => new MySqlCompiler().Compile(
                query,
                new SqlCompilationOptions(TestProfiles.MySql57)));

        Assert.Equal("mysql57.share_lock", exception.Feature);
        Assert.Equal("$.Lock", exception.NodePath);
    }

    [Fact]
    public void MySql_cast_fails_closed_until_a_cast_specific_type_map_exists()
    {
        var query = new SelectStatement(new[]
        {
            new SelectProjection(new CastExpression(
                BooleanExpression.True,
                new SqlTypeDescriptor(LogicalDbType.Int64)))
        });

        var exception = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => new MySqlCompiler().Compile(query, TestOptions.MySql80));

        Assert.Equal("mysql.cast", exception.Feature);
    }

    [Fact]
    public void MySql_current_date_default_is_not_changed_to_current_timestamp()
    {
        var table = new TableDefinition(
            ObjectName("Date_Default"),
            new[]
            {
                new ColumnDefinition(
                    Id("Value"),
                    new SqlTypeDescriptor(LogicalDbType.Date),
                    ColumnNullability.NotNullable,
                    defaultValue: new SemanticDefaultDefinition(
                        SemanticDefaultKind.CurrentDate))
            });

        var exception = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => new MySqlCompiler().Compile(
                new CreateTableOperation(
                    table, CreateObjectBehavior.FailIfExists),
                TestOptions.MySql80));

        Assert.Equal("mysql.current_date_default", exception.Feature);
    }

    [Fact]
    public void MySql_list_tables_all_fails_closed_instead_of_narrowing_scope()
    {
        var exception = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => new MySqlCompiler().Compile(
                new ListTablesOperation(SchemaScope.All()),
                TestOptions.MySql80));

        Assert.Equal("mysql.metadata_all_schemas", exception.Feature);
    }

    [Fact]
    public void MySql_auto_increment_without_a_key_fails_closed()
    {
        var table = new TableDefinition(
            ObjectName("Bad_Identity"),
            new[]
            {
                new ColumnDefinition(
                    Id("Id"),
                    new SqlTypeDescriptor(LogicalDbType.Int64),
                    ColumnNullability.NotNullable,
                    new IdentityGenerationDefinition(1, 1))
            });

        var exception = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => new MySqlCompiler().Compile(
                new CreateTableOperation(
                    table, CreateObjectBehavior.FailIfExists),
                TestOptions.MySql80));

        Assert.Equal("mysql.auto_increment_key", exception.Feature);
    }

    [Fact]
    public void MySql_unrepresentable_numeric_defaults_fail_closed()
    {
        var signed = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => CompileSingleDefault(
                new SqlTypeDescriptor(LogicalDbType.Int64),
                new Int64DefaultDefinition(-1)));
        var decimalValue =
            Assert.Throws<UnsupportedDatabaseCapabilityException>(() =>
                CompileSingleDefault(
                    new SqlTypeDescriptor(
                        LogicalDbType.Decimal, precision: 10, scale: 2),
                    new DecimalDefaultDefinition(1.25m)));

        Assert.Equal("mysql.signed_int64_default", signed.Feature);
        Assert.Equal("mysql.decimal_default", decimalValue.Feature);
    }

    [Fact]
    public void MySql_datetime_default_requires_exact_datetime6_precision()
    {
        var baseValue = new DateTime(2020, 1, 2, 3, 4, 5);
        var rejected = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => CompileSingleDefault(
                new SqlTypeDescriptor(LogicalDbType.DateTime),
                new DateTimeDefaultDefinition(
                    baseValue.AddTicks(1234567))));

        var command = CompileSingleDefault(
            new SqlTypeDescriptor(LogicalDbType.DateTime),
            new DateTimeDefaultDefinition(baseValue.AddTicks(1234560)));

        Assert.Equal("mysql.datetime_default_precision", rejected.Feature);
        Assert.Contains("2020-01-02 03:04:05.123456",
            command.CommandText, StringComparison.Ordinal);
    }

    [Fact]
    public void MySql_date_default_requires_an_exact_date_value()
    {
        var command = CompileSingleDefault(
            new SqlTypeDescriptor(LogicalDbType.Date),
            new DateTimeDefaultDefinition(new DateTime(2020, 1, 2)));
        var rejected = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => CompileSingleDefault(
                new SqlTypeDescriptor(LogicalDbType.Date),
                new DateTimeDefaultDefinition(
                    new DateTime(2020, 1, 2, 3, 4, 5))));

        Assert.Contains("DEFAULT '2020-01-02'", command.CommandText,
            StringComparison.Ordinal);
        Assert.DoesNotContain("00:00:00", command.CommandText,
            StringComparison.Ordinal);
        Assert.Equal("mysql.date_default_time", rejected.Feature);
    }

    [Fact]
    public void MySql_datetime_defaults_preserve_kind_and_server_range()
    {
        var utc = Assert.Throws<UnsupportedDatabaseCapabilityException>(() =>
            CompileSingleDefault(
                new SqlTypeDescriptor(LogicalDbType.DateTime),
                new DateTimeDefaultDefinition(
                    new DateTime(
                        2020, 1, 2, 0, 0, 0, DateTimeKind.Utc))));
        var range = Assert.Throws<UnsupportedDatabaseCapabilityException>(() =>
            CompileSingleDefault(
                new SqlTypeDescriptor(LogicalDbType.DateTime),
                new DateTimeDefaultDefinition(new DateTime(999, 1, 2))));

        Assert.Equal("mysql.datetime_default_kind", utc.Feature);
        Assert.Equal("mysql.datetime_default_range", range.Feature);
    }

    [Fact]
    public void MySql_defaults_respect_declared_column_bounds()
    {
        var text = Assert.Throws<UnsupportedDatabaseCapabilityException>(() =>
            CompileSingleDefault(
                new SqlTypeDescriptor(LogicalDbType.String, length: 3),
                new StringDefaultDefinition("four")));
        var precision =
            Assert.Throws<UnsupportedDatabaseCapabilityException>(() =>
                CompileSingleDefault(
                    new SqlTypeDescriptor(
                        LogicalDbType.Decimal, precision: 2, scale: 0),
                    new DecimalDefaultDefinition(999m)));
        var integerDigits =
            Assert.Throws<UnsupportedDatabaseCapabilityException>(() =>
                CompileSingleDefault(
                    new SqlTypeDescriptor(
                        LogicalDbType.Decimal, precision: 3, scale: 2),
                    new DecimalDefaultDefinition(12m)));

        Assert.Equal("mysql.string_default_length", text.Feature);
        Assert.Equal("mysql.decimal_default_bounds", precision.Feature);
        Assert.Equal("mysql.decimal_default_bounds", integerDigits.Feature);
    }

    [Fact]
    public void MySql_current_datetime_default_matches_datetime6_fsp()
    {
        var command = CompileSingleDefault(
            new SqlTypeDescriptor(LogicalDbType.DateTime),
            new SemanticDefaultDefinition(
                SemanticDefaultKind.CurrentDateTime));

        Assert.Contains("DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)",
            command.CommandText, StringComparison.Ordinal);
    }

    [Fact]
    public void MySql_expression_defaults_and_computed_columns_fail_closed()
    {
        var guid = Assert.Throws<UnsupportedDatabaseCapabilityException>(() =>
            CompileSingleDefault(
                new SqlTypeDescriptor(LogicalDbType.Guid),
                new SemanticDefaultDefinition(SemanticDefaultKind.NewGuid)));
        var table = new TableDefinition(
            ObjectName("Computed_Test"),
            new[]
            {
                new ColumnDefinition(
                    Id("Source"),
                    new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.NotNullable),
                new ColumnDefinition(
                    Id("Derived"),
                    new SqlTypeDescriptor(LogicalDbType.Int32),
                    ColumnNullability.Nullable,
                    new ComputedGenerationDefinition(
                        new ColumnExpression(Id("Source")),
                        ComputedStorageKind.Virtual))
            });
        var computed = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => new MySqlCompiler().Compile(
                new CreateTableOperation(
                    table, CreateObjectBehavior.FailIfExists),
                TestOptions.MySql80));

        Assert.Equal("mysql.new_guid_default", guid.Feature);
        Assert.Equal("mysql.computed_column", computed.Feature);
    }

    [Fact]
    public void MySql_identity_column_alterations_fail_without_key_context()
    {
        var identity = new ColumnDefinition(
            Id("Id"),
            new SqlTypeDescriptor(LogicalDbType.Int64),
            ColumnNullability.NotNullable,
            new IdentityGenerationDefinition(1, 1));
        var plain = new ColumnDefinition(
            Id("Id"),
            new SqlTypeDescriptor(LogicalDbType.Int64),
            ColumnNullability.NotNullable);
        var compiler = new MySqlCompiler();

        var add = Assert.Throws<UnsupportedDatabaseCapabilityException>(() =>
            compiler.Compile(
                new AddColumnOperation(ObjectName("Diy_Test"), identity),
                TestOptions.MySql80));
        var alter = Assert.Throws<UnsupportedDatabaseCapabilityException>(() =>
            compiler.Compile(
                new AlterColumnOperation(
                    ObjectName("Diy_Test"), plain, identity),
                TestOptions.MySql80));

        Assert.Equal("mysql.add_identity_column", add.Feature);
        Assert.Equal("mysql.alter_identity_column", alter.Feature);
    }

    [Fact]
    public void MySql_nullable_auto_increment_fails_closed()
    {
        var id = Id("Id");
        var table = new TableDefinition(
            ObjectName("Nullable_Identity"),
            new[]
            {
                new ColumnDefinition(
                    id,
                    new SqlTypeDescriptor(LogicalDbType.Int64),
                    ColumnNullability.Nullable,
                    new IdentityGenerationDefinition(1, 1))
            },
            new ConstraintDefinition[]
            {
                new UniqueConstraintDefinition(Id("UQ_Id"), new[] { id })
            });

        var exception = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => new MySqlCompiler().Compile(
                new CreateTableOperation(
                    table, CreateObjectBehavior.FailIfExists),
                TestOptions.MySql80));

        Assert.Equal("mysql.auto_increment_nullability", exception.Feature);
    }

    [Fact]
    public void MySql_upsert_do_nothing_fails_closed_without_side_effects()
    {
        var id = Input("do_nothing_id", LogicalDbType.Int64);
        var statement = new UpsertStatement(
            ObjectName("Diy_Test"),
            new[] { Id("Id") },
            new[]
            {
                new SqlAssignment(Id("Id"), new ParameterExpression(id))
            },
            Array.Empty<SqlAssignment>(),
            ConflictPolicy.DoNothing);

        var exception = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => new MySqlCompiler().Compile(
                statement, TestOptions.MySql80));

        Assert.Equal("mysql.upsert_do_nothing", exception.Feature);
    }

    [Fact]
    public void MySql_drop_table_cascade_fails_closed()
    {
        var operation = new DropTableOperation(
            ObjectName("Diy_Test"),
            DropObjectBehavior.FailIfMissing,
            DropScope.Cascade);

        var exception = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => new MySqlCompiler().Compile(
                operation, TestOptions.MySql80));

        Assert.Equal("mysql.drop_table_cascade", exception.Feature);
    }

    [Fact]
    public void MySql57_descending_index_fails_closed()
    {
        var index = new IndexDefinition(
            Id("IX_Diy_Test_Value"),
            new[]
            {
                new IndexColumnDefinition(
                    Id("Value"), SqlSortDirection.Descending)
            },
            IndexUniqueness.NonUnique);
        var operation = new CreateIndexOperation(
            ObjectName("Diy_Test"),
            index,
            CreateObjectBehavior.FailIfExists);

        var exception = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => new MySqlCompiler().Compile(
                operation,
                new SqlCompilationOptions(TestProfiles.MySql57)));

        Assert.Equal("mysql57.descending_index", exception.Feature);
    }

    [Fact]
    public void MySql_set_operations_fail_closed_until_associative_lowering()
    {
        var right = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.False)
        });
        var query = new SelectStatement(
            new[]
            {
                new SelectProjection(BooleanExpression.True)
            },
            setOperations: new[]
            {
                new SetOperationClause(SqlSetOperator.UnionAll, right)
            });

        var exception = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => new MySqlCompiler().Compile(query, TestOptions.MySql80));

        Assert.Equal("mysql.set_operation", exception.Feature);
    }

    [Fact]
    public void MySql_lob_and_json_defaults_fail_closed()
    {
        var json = Assert.Throws<UnsupportedDatabaseCapabilityException>(() =>
            CompileSingleDefault(
                new SqlTypeDescriptor(LogicalDbType.Json),
                new StringDefaultDefinition("{}")));
        var unboundedText =
            Assert.Throws<UnsupportedDatabaseCapabilityException>(() =>
                CompileSingleDefault(
                    new SqlTypeDescriptor(LogicalDbType.String),
                    new StringDefaultDefinition("text")));

        Assert.Equal("mysql.lob_default", json.Feature);
        Assert.Equal("mysql.lob_default", unboundedText.Feature);
    }

    [Fact]
    public void MySql_capability_factory_accepts_only_exact_certified_bands()
    {
        var mysql57 = MySqlCapabilities.For(TestProfiles.MySql57);
        var mysql80 = MySqlCapabilities.For(TestProfiles.MySql80);

        Assert.True(mysql57.SupportsLimitOffsetPagination);
        Assert.True(mysql57.SupportsOnDuplicateKeyUpsert);
        Assert.True(mysql57.SupportsJson);
        Assert.False(mysql57.SupportsWindowFunctions);
        Assert.False(mysql57.SupportsCommonTableExpressions);
        Assert.False(mysql57.SupportsSkipLocked);
        Assert.False(mysql57.SupportsNoWait);
        Assert.True(mysql80.SupportsWindowFunctions);
        Assert.True(mysql80.SupportsCommonTableExpressions);
        Assert.True(mysql80.SupportsSkipLocked);
        Assert.True(mysql80.SupportsNoWait);
        Assert.Equal(65535, mysql80.MaxParametersPerCommand);
        Assert.Equal(1048576, mysql80.MaxCommandTextLength);
        Assert.Equal(1000, mysql80.MaxBulkRowsPerBatch);
        Assert.Equal(PlanTransactionBehavior.ImplicitCommit,
            mysql80.DdlTransactionBehavior);
        Assert.True(mysql80.SupportsSchemas);
        Assert.False(mysql80.SupportsCatalogs);
        Assert.True(mysql80.SupportsCreateDatabase);
        Assert.True(mysql80.SupportsDropDatabase);
        Assert.False(mysql80.SupportsNativeBulk);

        Assert.NotNull(MySqlCapabilities.For(Profile(5, 7, 44, 99)));
        Assert.NotNull(MySqlCapabilities.For(Profile(8, 0, 40, 7)));
        AssertUnsupported(Profile(5, 7, 7, 99));
        AssertUnsupported(Profile(5, 8, 0, 0));
        AssertUnsupported(Profile(8, 0, 10, 99));
        AssertUnsupported(Profile(8, 1, 0, 0));
        AssertUnsupported(new DialectProfile(
            DatabaseType.MySql, new Version(8, 0, 11, 0), "mysql"));
        AssertUnsupported(new DialectProfile(
            DatabaseType.PostgreSql, new Version(17, 0, 0, 0), string.Empty));
        Assert.Throws<ArgumentNullException>(() =>
            MySqlCapabilities.For(null!));
    }

    [Fact]
    public async Task Shared_MySql_compiler_is_stateless_and_deterministic()
    {
        var compiler = new MySqlCompiler();
        var statement = PagedUsers();
        var options = TestOptions.MySql80;
        var tasks = Enumerable.Range(0, 50).Select(_ => Task.Run(() =>
            PlanAssert.Snapshot(compiler.Compile(statement, options))));

        var snapshots = await Task.WhenAll(tasks);

        Assert.All(snapshots,
            snapshot => Assert.Equal(snapshots[0], snapshot));
    }

    private static void AssertUnsupported(DialectProfile profile)
    {
        var exception = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => MySqlCapabilities.For(profile));
        Assert.Equal(profile.DatabaseType, exception.DatabaseType);
        Assert.Equal(profile.ServerVersion, exception.ServerVersion);
        Assert.Equal("mysql.profile", exception.Feature);
        Assert.Equal("$", exception.NodePath);
    }

    private static SqlCommandStep CompileSingleDefault(
        SqlTypeDescriptor type,
        ColumnDefaultDefinition defaultValue)
    {
        var table = new TableDefinition(
            ObjectName("Default_Test"),
            new[]
            {
                new ColumnDefinition(
                    Id("Value"),
                    type,
                    ColumnNullability.NotNullable,
                    defaultValue: defaultValue)
            });
        return PlanAssert.SingleSql(new MySqlCompiler().Compile(
            new CreateTableOperation(
                table, CreateObjectBehavior.FailIfExists),
            TestOptions.MySql80));
    }

    private static SelectStatement PagedUsers()
    {
        var users = new SqlAlias("u");
        return new SelectStatement(
            new NamedTableSource(ObjectName("Sys_User"), users),
            new[]
            {
                new SelectProjection(new ColumnExpression(Id("Id"), users)),
                new SelectProjection(
                    new ColumnExpression(Id("Account"), users))
            },
            orderBy: new[]
            {
                new OrderByExpression(
                    new ColumnExpression(Id("Id"), users),
                    SqlSortDirection.Ascending)
            },
            page: new OffsetPageSpec(40, 20));
    }

    private static SelectProjection Projection(
        SemanticFunctionId function,
        params SqlExpression[] arguments) =>
        new(new FunctionExpression(function, arguments));

    private static ParameterDefinition Input(
        string name,
        LogicalDbType type,
        int? length = null) =>
        new(
            name,
            new SqlTypeDescriptor(type, length),
            ParameterDirection.Input,
            isNullable: false);

    private static DialectProfile Profile(
        int major, int minor, int build, int revision) =>
        new(
            DatabaseType.MySql,
            new Version(major, minor, build, revision),
            string.Empty);

    private static SqlIdentifier Id(string value) => new(value);

    private static SqlObjectName ObjectName(string name) => new(Id(name));
}

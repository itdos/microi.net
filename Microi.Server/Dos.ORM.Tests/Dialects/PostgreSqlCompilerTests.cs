using System.Data;
using Dos.ORM.Dialects.PostgreSql;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;
using Dos.ORM.Tests.TestInfrastructure;

namespace Dos.ORM.Tests.Dialects;

public sealed class PostgreSqlCompilerTests
{
    [Theory]
    [MemberData(nameof(DialectCases.PostgreSqlFamily),
        MemberType = typeof(DialectCases))]
    public void PostgreSql_family_profiles_keep_their_own_parameter_contract(
        Func<ISqlCompiler> createCompiler,
        SqlCompilationOptions options,
        string expectedParameterPrefix)
    {
        var command = PlanAssert.SingleSql(createCompiler().Compile(
            ParameterAndBooleanQuery(), options));

        Assert.Contains(expectedParameterPrefix + "p0", command.CommandText,
            StringComparison.Ordinal);
        Assert.Equal("p0", Assert.Single(
            command.InternalParameterPlaceholders));
    }

    [Fact]
    public void PostgreSql_query_golden_uses_double_quotes_at_parameters_and_boolean()
    {
        var command = PlanAssert.SingleSql(new PostgreSqlCompiler().Compile(
            ParameterAndBooleanQuery(), PostgreSql17Options()));

        Assert.Equal("SELECT @p0 AS \"Value\",TRUE AS \"Enabled\"",
            command.CommandText);
        Assert.Equal(new[] { "value" },
            command.Parameters.Select(parameter => parameter.Name));
        Assert.Equal(
            PostgreSql17Options().StorageContract.Fingerprint,
            command.InternalValueContract.StorageContractFingerprint);
    }

    [Fact]
    public void PostgreSql_pagination_is_count_then_data_with_structural_integers()
    {
        var plan = new PostgreSqlCompiler().Compile(
            PagedUsers(), PostgreSql17Options());

        var data = PlanAssert.PaginationDataStep(plan);
        Assert.Contains("\"Sys_User\"", data.CommandText,
            StringComparison.Ordinal);
        Assert.EndsWith("LIMIT 20 OFFSET 40", data.CommandText,
            StringComparison.Ordinal);
        Assert.Empty(data.Parameters);
        Assert.DoesNotContain(";", data.CommandText,
            StringComparison.Ordinal);
        PlanAssert.IsCountThenData(plan);
    }

    [Fact]
    public void PostgreSql_pagination_applies_lock_only_to_the_data_command()
    {
        var users = new SqlAlias("u");
        var query = new SelectStatement(
            new NamedTableSource(ObjectName("Sys_User"), users),
            new[]
            {
                new SelectProjection(new ColumnExpression(Id("Id"), users))
            },
            orderBy: new[]
            {
                new OrderByExpression(
                    new ColumnExpression(Id("Id"), users))
            },
            page: new OffsetPageSpec(0, 10),
            lockSpec: new LockSpec(SqlLockMode.Update));

        var plan = new PostgreSqlCompiler().Compile(
            query, PostgreSql17Options());
        var commands = plan.Steps.Cast<SqlCommandStep>().ToArray();

        Assert.DoesNotContain("FOR UPDATE", commands[0].CommandText,
            StringComparison.Ordinal);
        Assert.EndsWith("FOR UPDATE", commands[1].CommandText,
            StringComparison.Ordinal);
    }

    [Fact]
    public void PostgreSql_json_value_fails_closed_until_jsonpath_lowering()
    {
        var exception = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => new PostgreSqlCompiler().Compile(
                JsonQuery(), PostgreSql17Options()));

        Assert.Equal("postgresql.json_value_path", exception.Feature);
        Assert.Equal("$.Function", exception.NodePath);
    }

    [Fact]
    public void PostgreSql_returning_and_on_conflict_are_native()
    {
        var writeCommand = PlanAssert.SingleSql(
            new PostgreSqlCompiler().Compile(
                UpsertReturning(), PostgreSql17Options()));

        Assert.Equal(
            "INSERT INTO \"Sys_User\" (\"Id\",\"Name\") VALUES (@p0,@p1) "
            + "ON CONFLICT (\"Id\") DO UPDATE SET \"Name\" = @p2 "
            + "RETURNING \"Sys_User\".\"Id\"",
            writeCommand.CommandText);
        Assert.Equal(SqlResultShape.RowSet, writeCommand.ResultShape);
    }

    [Fact]
    public void PostgreSql_type_mapper_uses_certified_native_types()
    {
        var mapper = new PostgreSqlTypeMapper();
        Assert.Equal("TEXT", Map(mapper,
            new SqlTypeDescriptor(LogicalDbType.String)));
        Assert.Equal("VARCHAR(200)", Map(mapper,
            new SqlTypeDescriptor(LogicalDbType.String, length: 200)));
        Assert.Equal("UUID", Map(mapper,
            new SqlTypeDescriptor(LogicalDbType.Guid)));
        Assert.Equal("TIMESTAMP WITH TIME ZONE", Map(mapper,
            new SqlTypeDescriptor(LogicalDbType.DateTimeOffset)));
        Assert.Equal("BYTEA", Map(mapper,
            new SqlTypeDescriptor(LogicalDbType.Binary)));
        Assert.Equal("JSONB", Map(mapper,
            new SqlTypeDescriptor(LogicalDbType.Json)));
    }

    [Fact]
    public void PostgreSql_capabilities_accept_only_exact_certified_profiles()
    {
        var postgres14 = PostgreSqlCapabilities.For(TestProfiles.PostgreSql14);
        var postgres17 = PostgreSqlCapabilities.For(TestProfiles.PostgreSql17);

        Assert.True(postgres14.SupportsOnConflictUpsert);
        Assert.False(postgres14.SupportsMergeUpsert);
        Assert.True(postgres17.SupportsMergeUpsert);
        Assert.Equal(65535, postgres17.MaxParametersPerCommand);
        Assert.Equal(PlanTransactionBehavior.Enlistable,
            postgres17.DdlTransactionBehavior);
        Assert.NotNull(PostgreSqlCapabilities.For(Profile(14, 9, 8, 7)));
        Assert.NotNull(PostgreSqlCapabilities.For(Profile(17, 2, 1, 9)));
        AssertProfileRejected(Profile(13, 9, 9, 9));
        AssertProfileRejected(Profile(15, 0, 0, 0));
        AssertProfileRejected(new DialectProfile(
            DatabaseType.PostgreSql,
            new Version(17, 0, 0, 0),
            "PostgreSQL"));
        AssertProfileRejected(new DialectProfile(
            DatabaseType.KingBase,
            new Version(17, 0, 0, 0),
            string.Empty));
        Assert.Throws<ArgumentNullException>(() =>
            PostgreSqlCapabilities.For(null!));
    }

    [Fact]
    public void PostgreSql_unproved_bulk_set_and_cast_fail_closed()
    {
        var compiler = new PostgreSqlCompiler();

        Assert.Equal("postgresql.bulk_insert", Assert.Throws<
            UnsupportedDatabaseCapabilityException>(() => compiler.Compile(
                Bulk(), PostgreSql17Options())).Feature);
        Assert.Equal("postgresql.set_operation", Assert.Throws<
            UnsupportedDatabaseCapabilityException>(() => compiler.Compile(
                SetQuery(), PostgreSql17Options())).Feature);
        Assert.Equal("postgresql.cast", Assert.Throws<
            UnsupportedDatabaseCapabilityException>(() => compiler.Compile(
                CastQuery(), PostgreSql17Options())).Feature);
    }

    [Fact]
    public async Task Shared_PostgreSql_compiler_is_stateless_and_deterministic()
    {
        var compiler = new PostgreSqlCompiler();
        var statement = PagedUsers();
        var options = PostgreSql17Options();
        var tasks = Enumerable.Range(0, 50).Select(_ => Task.Run(() =>
            PlanAssert.Snapshot(compiler.Compile(statement, options))));

        var snapshots = await Task.WhenAll(tasks);

        Assert.All(snapshots,
            snapshot => Assert.Equal(snapshots[0], snapshot));
    }

    private static string Map(
        PostgreSqlTypeMapper mapper,
        SqlTypeDescriptor type)
    {
        var options = PostgreSql17Options();
        var writer = new SqlTextWriter(SqlTextDialectFamily.PostgreSql);
        mapper.Write(type, writer, new SqlLoweringContext(
            options,
            PostgreSqlCapabilities.For(options.DialectProfile),
            null));
        return writer.Snapshot().CommandText;
    }

    private static void AssertProfileRejected(DialectProfile profile)
    {
        var exception = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => PostgreSqlCapabilities.For(profile));
        Assert.Equal("postgresql.profile", exception.Feature);
        Assert.Equal("$", exception.NodePath);
    }

    private static SqlCompilationOptions PostgreSql17Options() =>
        new(TestProfiles.PostgreSql17);

    private static DialectProfile Profile(
        int major, int minor, int build, int revision) =>
        new(
            DatabaseType.PostgreSql,
            new Version(major, minor, build, revision),
            string.Empty);

    private static SelectStatement ParameterAndBooleanQuery()
    {
        var value = Input("value", LogicalDbType.String, 200);
        return new SelectStatement(new[]
        {
            new SelectProjection(
                new ParameterExpression(value), new SqlAlias("Value")),
            new SelectProjection(
                BooleanExpression.True, new SqlAlias("Enabled"))
        });
    }

    private static SelectStatement JsonQuery()
    {
        var json = Input("json", LogicalDbType.Json);
        var path = Input("path", LogicalDbType.String, 100);
        return new SelectStatement(new[]
        {
            new SelectProjection(new FunctionExpression(
                SemanticFunctions.JsonValue,
                new SqlExpression[]
                {
                    new ParameterExpression(json),
                    new ParameterExpression(path)
                }))
        });
    }

    private static UpsertStatement UpsertReturning()
    {
        var id = Input("id", LogicalDbType.Int64);
        var name = Input("name", LogicalDbType.String, 200);
        var updated = Input("updated", LogicalDbType.String, 200);
        return new UpsertStatement(
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
            },
            returning: new ReturningClause(new[]
            {
                new SelectProjection(new ColumnExpression(Id("Id")))
            }));
    }

    private static SelectStatement PagedUsers()
    {
        var users = new SqlAlias("u");
        return new SelectStatement(
            new NamedTableSource(ObjectName("Sys_User"), users),
            new[]
            {
                new SelectProjection(new ColumnExpression(Id("Id"), users))
            },
            orderBy: new[]
            {
                new OrderByExpression(
                    new ColumnExpression(Id("Id"), users))
            },
            page: new OffsetPageSpec(40, 20));
    }

    private static BulkInsertOperation Bulk()
    {
        var value = Input("bulk", LogicalDbType.Int32);
        return new BulkInsertOperation(
            ObjectName("Diy_Test"),
            new[] { Id("Value") },
            new[]
            {
                new SqlInsertRow(new SqlExpression[]
                {
                    new ParameterExpression(value)
                })
            },
            100);
    }

    private static SelectStatement SetQuery() =>
        new(
            new[] { new SelectProjection(BooleanExpression.True) },
            setOperations: new[]
            {
                new SetOperationClause(
                    SqlSetOperator.UnionAll,
                    new SelectStatement(new[]
                    {
                        new SelectProjection(BooleanExpression.False)
                    }))
            });

    private static SelectStatement CastQuery() =>
        new(new[]
        {
            new SelectProjection(new CastExpression(
                BooleanExpression.True,
                new SqlTypeDescriptor(LogicalDbType.Int64)))
        });

    private static ParameterDefinition Input(
        string name,
        LogicalDbType type,
        int? length = null) =>
        new(
            name,
            new SqlTypeDescriptor(type, length),
            ParameterDirection.Input,
            isNullable: false);

    private static SqlIdentifier Id(string value) => new(value);

    private static SqlObjectName ObjectName(string value) => new(Id(value));
}

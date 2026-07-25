using System.Data;
using Dos.ORM.Dialects.KingbaseEs;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;
using Dos.ORM.Tests.TestInfrastructure;

namespace Dos.ORM.Tests.Dialects;

public sealed class KingbaseEsCompilerTests
{
    [Fact]
    public void Kingbase_query_golden_uses_colon_parameters_and_own_writer_family()
    {
        var value = Input("value", LogicalDbType.String, 200);
        var query = new SelectStatement(new[]
        {
            new SelectProjection(
                new ParameterExpression(value), new SqlAlias("Value")),
            new SelectProjection(
                BooleanExpression.True, new SqlAlias("Enabled"))
        });

        var command = PlanAssert.SingleSql(new KingbaseEsCompiler().Compile(
            query, KingbaseOptions()));

        Assert.Equal("SELECT :p0 AS \"Value\",TRUE AS \"Enabled\"",
            command.CommandText);
        Assert.Equal(new[] { "value" },
            command.Parameters.Select(parameter => parameter.Name));
        Assert.Equal("p0", Assert.Single(
            command.InternalParameterPlaceholders));
    }

    [Fact]
    public void Kingbase_pagination_returning_and_on_conflict_are_native()
    {
        var compiler = new KingbaseEsCompiler();
        var plan = compiler.Compile(PagedUsers(), KingbaseOptions());
        var upsert = PlanAssert.SingleSql(compiler.Compile(
            UpsertReturning(), KingbaseOptions()));

        var data = PlanAssert.PaginationDataStep(plan);
        Assert.EndsWith("LIMIT 20 OFFSET 40", data.CommandText,
            StringComparison.Ordinal);
        Assert.DoesNotContain(";", data.CommandText,
            StringComparison.Ordinal);
        PlanAssert.IsCountThenData(plan);
        Assert.Equal(
            "INSERT INTO \"Sys_User\" (\"Id\",\"Name\") VALUES (:p0,:p1) "
            + "ON CONFLICT (\"Id\") DO UPDATE SET \"Name\" = :p2 "
            + "RETURNING \"Sys_User\".\"Id\"",
            upsert.CommandText);
        Assert.Equal(SqlResultShape.RowSet, upsert.ResultShape);
    }

    [Fact]
    public void Kingbase_json_value_fails_closed_until_jsonpath_lowering()
    {
        var exception = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => new KingbaseEsCompiler().Compile(
                JsonQuery(), KingbaseOptions()));

        Assert.Equal("kingbasees.json_value_path", exception.Feature);
        Assert.Equal("$.Function", exception.NodePath);
    }

    [Fact]
    public void Kingbase_type_mapper_uses_certified_native_types()
    {
        var mapper = new KingbaseEsTypeMapper();
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
    public void Kingbase_capabilities_accept_only_exact_profile_and_mode()
    {
        var capabilities = KingbaseEsCapabilities.For(
            TestProfiles.KingbaseEsV9);

        Assert.True(capabilities.SupportsLimitOffsetPagination);
        Assert.True(capabilities.SupportsReturningClause);
        Assert.True(capabilities.SupportsOnConflictUpsert);
        Assert.True(capabilities.SupportsMergeUpsert);
        Assert.Equal(32767, capabilities.MaxParametersPerCommand);
        Assert.Equal(PlanTransactionBehavior.Enlistable,
            capabilities.DdlTransactionBehavior);
        Assert.NotNull(KingbaseEsCapabilities.For(Profile(9, 4, 12, 9)));
        Assert.NotNull(KingbaseEsCapabilities.For(Profile(9, 4, 99, 0)));
        AssertProfileRejected(Profile(9, 4, 11, 99));
        AssertProfileRejected(Profile(9, 5, 0, 0));
        AssertProfileRejected(Profile(10, 0, 0, 0));
        AssertProfileRejected(new DialectProfile(
            DatabaseType.KingBase,
            new Version(9, 4, 12, 0),
            "postgresql"));
        AssertProfileRejected(new DialectProfile(
            DatabaseType.PostgreSql,
            new Version(9, 4, 12, 0),
            "PostgreSQL"));
        Assert.Throws<ArgumentNullException>(() =>
            KingbaseEsCapabilities.For(null!));
    }

    [Fact]
    public void Kingbase_bulk_fails_closed_without_Npgsql_substitution()
    {
        var value = Input("bulk", LogicalDbType.Int32);
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
            100);

        var exception = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => new KingbaseEsCompiler().Compile(
                operation, KingbaseOptions()));

        Assert.Equal("kingbasees.bulk_insert", exception.Feature);
        Assert.Equal("$", exception.NodePath);
    }

    [Fact]
    public async Task Shared_Kingbase_compiler_is_stateless_and_deterministic()
    {
        var compiler = new KingbaseEsCompiler();
        var statement = PagedUsers();
        var options = KingbaseOptions();
        var tasks = Enumerable.Range(0, 50).Select(_ => Task.Run(() =>
            PlanAssert.Snapshot(compiler.Compile(statement, options))));

        var snapshots = await Task.WhenAll(tasks);

        Assert.All(snapshots,
            snapshot => Assert.Equal(snapshots[0], snapshot));
    }

    private static string Map(
        KingbaseEsTypeMapper mapper,
        SqlTypeDescriptor type)
    {
        var options = KingbaseOptions();
        var writer = new SqlTextWriter(SqlTextDialectFamily.KingbaseEs);
        mapper.Write(type, writer, new SqlLoweringContext(
            options,
            KingbaseEsCapabilities.For(options.DialectProfile),
            null));
        return writer.Snapshot().CommandText;
    }

    private static void AssertProfileRejected(DialectProfile profile)
    {
        var exception = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => KingbaseEsCapabilities.For(profile));
        Assert.Equal("kingbasees.profile", exception.Feature);
        Assert.Equal("$", exception.NodePath);
    }

    private static SqlCompilationOptions KingbaseOptions() =>
        new(TestProfiles.KingbaseEsV9);

    private static DialectProfile Profile(
        int major, int minor, int build, int revision) =>
        new(
            DatabaseType.KingBase,
            new Version(major, minor, build, revision),
            "PostgreSQL");

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

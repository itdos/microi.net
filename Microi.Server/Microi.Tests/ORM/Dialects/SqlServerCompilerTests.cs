using System.Data;
using Dos.ORM.Dialects.SqlServer;
using Dos.ORM.Platform;
using Dos.ORM.SqlAst;
using Dos.ORM.SqlCompilation;
using Dos.ORM.Tests.TestInfrastructure;

namespace Dos.ORM.Tests.Dialects;

public sealed class SqlServerCompilerTests
{
    [Fact]
    public void SqlServer_pagination_is_count_then_data_with_stable_order()
    {
        var plan = new SqlServerCompiler().Compile(
            PagedUsers(), Options(TestProfiles.SqlServer2022));

        var data = PlanAssert.PaginationDataStep(plan);
        Assert.Equal(
            "SELECT [u].[Id],[u].[Account] FROM [app].[Sys_User] AS [u] " +
            "ORDER BY [u].[Id] ASC OFFSET 40 ROWS FETCH NEXT 20 ROWS ONLY",
            data.CommandText);
        Assert.Empty(data.Parameters);
        PlanAssert.IsCountThenData(plan);
        Assert.DoesNotContain(";", data.CommandText, StringComparison.Ordinal);
    }

    [Fact]
    public void SqlServer_offset_requires_order_by()
    {
        var statement = new SelectStatement(
            new[] { new SelectProjection(BooleanExpression.True) },
            page: new OffsetPageSpec(0, 10));

        var exception = Assert.Throws<SqlAstValidationException>(() =>
            new SqlServerCompiler().Compile(
                statement, Options(TestProfiles.SqlServer2022)));

        Assert.Equal("AST_PAGE_ORDER_REQUIRED", exception.Feature);
    }

    [Fact]
    public void SqlServer_identifiers_are_segmented_and_parameters_are_at_prefixed()
    {
        var command = PlanAssert.SingleSql(new SqlServerCompiler().Compile(
            AstSamples.UserByAccountAndStatus(),
            Options(TestProfiles.SqlServer2022)));

        Assert.Contains("[u].[Account] = @p0", command.CommandText,
            StringComparison.Ordinal);
        Assert.Contains("[u].[Status] = @p1", command.CommandText,
            StringComparison.Ordinal);
        Assert.Equal(new[] { "account", "status" },
            command.Parameters.Select(parameter => parameter.Name));
        Assert.Equal(new[] { "p0", "p1" },
            command.InternalParameterPlaceholders);
    }

    [Fact]
    public void SqlServer_functions_use_certified_native_spellings()
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
                new ParameterExpression(path)),
            Projection(SemanticFunctions.Length,
                new ParameterExpression(first))
        });

        var command = PlanAssert.SingleSql(new SqlServerCompiler().Compile(
            query, Options(TestProfiles.SqlServer2022)));

        Assert.Equal(
            "SELECT COALESCE(@p0,@p1),CONCAT(@p0,@p1),SYSDATETIME()," +
            "JSON_VALUE(@p2,@p3),LEN(@p0)",
            command.CommandText);
    }

    [Fact]
    public void SqlServer_dml_returning_uses_output_with_correct_row_image()
    {
        var id = Input("id", LogicalDbType.Int64);
        var name = Input("name", LogicalDbType.String, 200);
        var returning = Returning("Id", "Name");
        var compiler = new SqlServerCompiler();
        var options = Options(TestProfiles.SqlServer2022);

        var insert = PlanAssert.SingleSql(compiler.Compile(
            InsertStatement.Values(
                ObjectName("Sys_User", "dbo"),
                new[] { Id("Id"), Id("Name") },
                new[]
                {
                    new SqlInsertRow(new SqlExpression[]
                    {
                        new ParameterExpression(id),
                        new ParameterExpression(name)
                    })
                },
                returning),
            options));
        var update = PlanAssert.SingleSql(compiler.Compile(
            new UpdateStatement(
                ObjectName("Sys_User", "dbo"),
                new[]
                {
                    new SqlAssignment(
                        Id("Name"), new ParameterExpression(name))
                },
                new BinaryExpression(
                    new ColumnExpression(Id("Id")),
                    SqlBinaryOperator.Equal,
                    new ParameterExpression(id)),
                returning: returning),
            options));
        var delete = PlanAssert.SingleSql(compiler.Compile(
            new DeleteStatement(
                ObjectName("Sys_User", "dbo"),
                new BinaryExpression(
                    new ColumnExpression(Id("Id")),
                    SqlBinaryOperator.Equal,
                    new ParameterExpression(id)),
                returning: returning),
            options));

        Assert.Equal(
            "INSERT INTO [dbo].[Sys_User] ([Id],[Name]) " +
            "OUTPUT INSERTED.[Id],INSERTED.[Name] VALUES (@p0,@p1)",
            insert.CommandText);
        Assert.Equal(
            "UPDATE [dbo].[Sys_User] SET [Name] = @p0 " +
            "OUTPUT INSERTED.[Id],INSERTED.[Name] " +
            "WHERE ([Sys_User].[Id] = @p1)",
            update.CommandText);
        Assert.Equal(
            "DELETE FROM [dbo].[Sys_User] " +
            "OUTPUT DELETED.[Id],DELETED.[Name] " +
            "WHERE ([Sys_User].[Id] = @p0)",
            delete.CommandText);
        Assert.All(new[] { insert, update, delete }, command =>
        {
            Assert.Equal(SqlResultShape.ReturningRows, command.ResultShape);
            Assert.Equal(PlanResultRole.Final, command.ResultRole);
        });
    }

    [Fact]
    public void SqlServer_upsert_uses_locked_atomic_plan_not_merge()
    {
        var options = Options(
            TestProfiles.SqlServer2022,
            AtomicityRequirement.Required);

        var plan = new SqlServerCompiler().Compile(UpsertUser(), options);

        Assert.Equal(2, plan.Steps.Count);
        Assert.Equal(AtomicityRequirement.Required, plan.Atomicity);
        Assert.Equal(SqlResultShape.AffectedRows, plan.ResultShape);
        Assert.All(plan.Steps.Cast<SqlCommandStep>(), command =>
        {
            Assert.Equal(PlanResultRole.Aggregate, command.ResultRole);
            Assert.Equal(
                PlanTransactionBehavior.Enlistable,
                command.TransactionBehavior);
            Assert.DoesNotContain(
                "MERGE", command.CommandText,
                StringComparison.OrdinalIgnoreCase);
        });
        var update = Assert.IsType<SqlCommandStep>(plan.Steps[0]);
        var insert = Assert.IsType<SqlCommandStep>(plan.Steps[1]);
        Assert.Equal(
            "UPDATE [dbo].[Sys_User] WITH (UPDLOCK,SERIALIZABLE) " +
            "SET [Name] = @p2 WHERE ([Id] = @p0)",
            update.CommandText);
        Assert.Equal(new[] { "updated", "id" },
            update.Parameters.Select(parameter => parameter.Name));
        Assert.Equal(new[] { "p2", "p0" },
            update.InternalParameterPlaceholders);
        Assert.Equal(
            "INSERT INTO [dbo].[Sys_User] ([Id],[Name]) SELECT @p0,@p1 " +
            "WHERE NOT EXISTS (SELECT * FROM [dbo].[Sys_User] " +
            "WITH (UPDLOCK,SERIALIZABLE) WHERE ([Id] = @p0))",
            insert.CommandText);
        Assert.Equal(new[] { "id", "name" },
            insert.Parameters.Select(parameter => parameter.Name));
        Assert.Equal(new[] { "p0", "p1" },
            insert.InternalParameterPlaceholders);
    }

    [Theory]
    [InlineData(AtomicityRequirement.None)]
    [InlineData(AtomicityRequirement.BestEffort)]
    public void SqlServer_upsert_rejects_non_required_atomicity(
        AtomicityRequirement requestedAtomicity)
    {
        var options = Options(
            TestProfiles.SqlServer2022, requestedAtomicity);

        var exception =
            Assert.Throws<UnsupportedDatabaseCapabilityException>(() =>
                new SqlServerCompiler().Compile(UpsertUser(), options));

        Assert.Equal("sqlserver.upsert_atomicity", exception.Feature);
    }

    [Fact]
    public void SqlServer_schema_maps_identity_json_and_datetimeoffset_types()
    {
        var table = new TableDefinition(
            ObjectName("Diy_Test", "app"),
            new[]
            {
                new ColumnDefinition(
                    Id("Id"),
                    new SqlTypeDescriptor(LogicalDbType.Int64),
                    ColumnNullability.NotNullable,
                    new IdentityGenerationDefinition(1, 1)),
                new ColumnDefinition(
                    Id("Title"),
                    new SqlTypeDescriptor(LogicalDbType.String, length: 200),
                    ColumnNullability.NotNullable),
                new ColumnDefinition(
                    Id("Payload"),
                    new SqlTypeDescriptor(LogicalDbType.Json),
                    ColumnNullability.Nullable),
                new ColumnDefinition(
                    Id("OccurredAt"),
                    new SqlTypeDescriptor(LogicalDbType.DateTimeOffset),
                    ColumnNullability.NotNullable)
            },
            new ConstraintDefinition[]
            {
                new PrimaryKeyDefinition(
                    Id("PK_Diy_Test"), new[] { Id("Id") })
            });

        var command = PlanAssert.SingleSql(new SqlServerCompiler().Compile(
            new CreateTableOperation(
                table, CreateObjectBehavior.FailIfExists),
            Options(TestProfiles.SqlServer2022)));

        Assert.Equal(
            "CREATE TABLE [app].[Diy_Test] (" +
            "[Id] BIGINT IDENTITY(1,1) NOT NULL," +
            "[Title] NVARCHAR(200) NOT NULL," +
            "[Payload] NVARCHAR(MAX) NULL," +
            "[OccurredAt] DATETIMEOFFSET(7) NOT NULL," +
            "CONSTRAINT [PK_Diy_Test] PRIMARY KEY ([Id]))",
            command.CommandText);
        Assert.Equal(
            PlanTransactionBehavior.Enlistable,
            command.TransactionBehavior);
    }

    [Fact]
    public void SqlServer_schema_supports_core_alter_and_index_operations()
    {
        var compiler = new SqlServerCompiler();
        var options = Options(TestProfiles.SqlServer2017);
        var column = new ColumnDefinition(
            Id("Code"),
            new SqlTypeDescriptor(LogicalDbType.AnsiString, length: 50),
            ColumnNullability.NotNullable);
        var index = new IndexDefinition(
            Id("IX_Diy_Test_Code"),
            new[]
            {
                new IndexColumnDefinition(
                    Id("Code"), SqlSortDirection.Descending)
            },
            IndexUniqueness.Unique);

        var add = PlanAssert.SingleSql(compiler.Compile(
            new AddColumnOperation(ObjectName("Diy_Test", "app"), column),
            options));
        var createIndex = PlanAssert.SingleSql(compiler.Compile(
            new CreateIndexOperation(
                ObjectName("Diy_Test", "app"),
                index,
                CreateObjectBehavior.FailIfExists),
            options));

        Assert.Equal(
            "ALTER TABLE [app].[Diy_Test] ADD [Code] VARCHAR(50) NOT NULL",
            add.CommandText);
        Assert.Equal(
            "CREATE UNIQUE INDEX [IX_Diy_Test_Code] ON [app].[Diy_Test] " +
            "([Code] DESC)",
            createIndex.CommandText);
    }

    [Fact]
    public void SqlServer_metadata_uses_sys_catalog_and_admin_uses_admin_route()
    {
        var compiler = new SqlServerCompiler();
        var options = Options(TestProfiles.SqlServer2022);

        var metadata = PlanAssert.SingleSql(compiler.Compile(
            new ListColumnsOperation(ObjectName("Sys_User", "dbo")),
            options));
        var operation = new CreateDatabaseOperation(
            Id("microi_test"), CreateObjectBehavior.FailIfExists);
        var adminPlan = compiler.Compile(operation, options);
        var admin = Assert.IsType<AdminStep>(Assert.Single(adminPlan.Steps));

        Assert.Contains("[sys].[columns]", metadata.CommandText,
            StringComparison.OrdinalIgnoreCase);
        Assert.Contains("[sys].[tables]", metadata.CommandText,
            StringComparison.OrdinalIgnoreCase);
        Assert.Contains("[sys].[schemas]", metadata.CommandText,
            StringComparison.OrdinalIgnoreCase);
        Assert.Equal(SqlResultShape.Metadata, metadata.ResultShape);
        Assert.Same(operation, admin.Operation);
        Assert.Equal(PlanConnectionRole.Administrative, admin.ConnectionRole);
        Assert.Equal(
            PlanTransactionBehavior.NotEnlistable,
            admin.TransactionBehavior);
    }

    [Fact]
    public void SqlServer_capabilities_accept_only_engine_14_or_16_empty_mode()
    {
        var sql2017 = SqlServerCapabilities.For(TestProfiles.SqlServer2017);
        var sql2022 = SqlServerCapabilities.For(TestProfiles.SqlServer2022);

        Assert.True(sql2017.SupportsOffsetFetchPagination);
        Assert.True(sql2017.SupportsOutputClause);
        Assert.True(sql2017.SupportsLockedUpdateThenInsertUpsert);
        Assert.True(sql2017.SupportsUpdateLockHint);
        Assert.True(sql2017.SupportsNoWait);
        Assert.False(sql2017.SupportsMergeUpsert);
        Assert.False(sql2017.SupportsReturningClause);
        Assert.Equal(2100, sql2022.MaxParametersPerCommand);
        Assert.Equal(1048576, sql2022.MaxCommandTextLength);
        Assert.Equal(1000, sql2022.MaxBulkRowsPerBatch);
        Assert.Equal(
            PlanTransactionBehavior.Enlistable,
            sql2022.DdlTransactionBehavior);
        Assert.True(sql2022.SupportsSchemas);
        Assert.True(sql2022.SupportsCatalogs);
        Assert.True(sql2022.SupportsCreateDatabase);
        Assert.True(sql2022.SupportsDropDatabase);
        Assert.False(sql2022.SupportsNativeBulk);

        Assert.NotNull(SqlServerCapabilities.For(Profile(14, 0, 3456, 7)));
        Assert.NotNull(SqlServerCapabilities.For(Profile(16, 0, 1115, 1)));
        AssertProfileRejected(Profile(9, 0, 0, 0));
        AssertProfileRejected(Profile(15, 0, 0, 0));
        AssertProfileRejected(Profile(17, 0, 0, 0));
        AssertProfileRejected(new DialectProfile(
            DatabaseType.SqlServer, new Version(16, 0, 0, 0), "MSSQL"));
        AssertProfileRejected(new DialectProfile(
            DatabaseType.MySql, new Version(16, 0, 0, 0), string.Empty));
        Assert.Throws<ArgumentNullException>(() =>
            SqlServerCapabilities.For(null!));
    }

    [Fact]
    public void SqlServer_advanced_unimplemented_semantics_fail_closed()
    {
        var compiler = new SqlServerCompiler();
        var options = Options(TestProfiles.SqlServer2022);
        var value = Input("bulk_value", LogicalDbType.Int32);
        var bulk = new BulkInsertOperation(
            ObjectName("Diy_Test", "dbo"),
            new[] { Id("Value") },
            new[]
            {
                new SqlInsertRow(new SqlExpression[]
                {
                    new ParameterExpression(value)
                })
            },
            batchSize: 100);
        var cast = new SelectStatement(new[]
        {
            new SelectProjection(new CastExpression(
                new ParameterExpression(value),
                new SqlTypeDescriptor(LogicalDbType.Int64)))
        });
        var right = new SelectStatement(new[]
        {
            new SelectProjection(BooleanExpression.False)
        });
        var set = new SelectStatement(
            new[] { new SelectProjection(BooleanExpression.True) },
            setOperations: new[]
            {
                new SetOperationClause(SqlSetOperator.UnionAll, right)
            });

        AssertFeature("sqlserver.bulk_insert", () =>
            compiler.Compile(bulk, options));
        AssertFeature("sqlserver.cast", () =>
            compiler.Compile(cast, options));
        AssertFeature("sqlserver.set_operation", () =>
            compiler.Compile(set, options));
    }

    [Fact]
    public async Task Shared_SqlServer_compiler_is_stateless_and_deterministic()
    {
        var compiler = new SqlServerCompiler();
        var statement = PagedUsers();
        var options = Options(TestProfiles.SqlServer2022);
        var tasks = Enumerable.Range(0, 50).Select(_ => Task.Run(() =>
            PlanAssert.Snapshot(compiler.Compile(statement, options))));

        var snapshots = await Task.WhenAll(tasks);

        Assert.All(snapshots,
            snapshot => Assert.Equal(snapshots[0], snapshot));
    }

    private static void AssertFeature(string feature, Action action)
    {
        var exception =
            Assert.Throws<UnsupportedDatabaseCapabilityException>(action);
        Assert.Equal(feature, exception.Feature);
        Assert.StartsWith("$", exception.NodePath, StringComparison.Ordinal);
    }

    private static void AssertProfileRejected(DialectProfile profile)
    {
        var exception = Assert.Throws<UnsupportedDatabaseCapabilityException>(
            () => SqlServerCapabilities.For(profile));
        Assert.Equal(profile.DatabaseType, exception.DatabaseType);
        Assert.Equal(profile.ServerVersion, exception.ServerVersion);
        Assert.Equal("sqlserver.profile", exception.Feature);
        Assert.Equal("$", exception.NodePath);
    }

    private static SqlCompilationOptions Options(
        DialectProfile profile,
        AtomicityRequirement atomicity = AtomicityRequirement.None) =>
        new(profile, atomicity);

    private static SelectStatement PagedUsers()
    {
        var users = new SqlAlias("u");
        return new SelectStatement(
            new NamedTableSource(ObjectName("Sys_User", "app"), users),
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

    private static UpsertStatement UpsertUser()
    {
        var id = Input("id", LogicalDbType.Int64);
        var name = Input("name", LogicalDbType.String, 200);
        var updated = Input("updated", LogicalDbType.String, 200);
        return new UpsertStatement(
            ObjectName("Sys_User", "dbo"),
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
    }

    private static ReturningClause Returning(params string[] columns) =>
        new(columns.Select(column =>
            new SelectProjection(new ColumnExpression(Id(column)))));

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
            DatabaseType.SqlServer,
            new Version(major, minor, build, revision),
            string.Empty);

    private static SqlIdentifier Id(string value) => new(value);

    private static SqlObjectName ObjectName(
        string name,
        string? schema = null) =>
        new(
            null,
            schema == null ? null : Id(schema),
            Id(name));
}

# Dos.ORM Legacy API to AST Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Route the existing Dos.ORM public APIs through the new AST/compiler platform while preserving source compatibility and preventing double execution.

**Architecture:** Existing Field, Clip, Section, DbSession, DML, SqlFunc, Upsert, BulkCopy, CodeFirst, and IMicroiORM entry points become compatibility facades. Legacy, Compare, and Ast modes permit staged verification; Compare compiles both paths but executes only the legacy path, and each migrated module deletes its frozen legacy generator after switching to Ast.

**Tech Stack:** Existing Dos.ORM netstandard2.1 API, new SQL AST/compiler platform, xUnit compatibility tests, fake DbConnection/DbCommand capture tests.

## Global Constraints

- Existing public and protected signatures remain source-compatible; add overloads instead of changing signatures.
- IMicroiORM receives no new members.
- DbProvider receives no new abstract members.
- Legacy FromSql(string) remains opaque and retains historical behavior.
- New platform-owned operations use FromAst/ExecuteAst and never use FromSql as an escape hatch.
- Compare mode never executes both write plans.
- AST commands bypass Provider regex SQL rewriting.
- Runtime parameters are bound through IDbDriverAdapter and the active transaction.
- Bulk fallback uses the caller transaction and database parameter limits.
- CodeFirst, DDL, metadata, pagination, functions, Upsert, and Bulk database differences remain entirely inside Dos.ORM.

---

### Task 1: Bind ProviderFactory and DbProvider to the platform registry

**Files:**
- Modify: Microi.Server/Dos.ORM/Provider/DbProvider.cs
- Modify: Microi.Server/Dos.ORM/Provider/ProviderFactory.cs
- Modify: Microi.Server/Dos.ORM/Provider/MySqlProvider.cs
- Modify: Microi.Server/Dos.ORM/Provider/SqlServerProvider.cs
- Modify: Microi.Server/Dos.ORM/Provider/SqlServer9Provider.cs
- Modify: Microi.Server/Dos.ORM/Provider/OracleProvider.cs
- Modify: Microi.Server/Dos.ORM/Provider/PostgreSqlProvider.cs
- Modify: Microi.Server/Dos.ORM/Provider/DaMengProvider.cs
- Modify: Microi.Server/Dos.ORM/Provider/KingBaseProvider.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/ProviderPlatformBindingTests.cs

**Interfaces:**
- Consumes: DatabasePlatformRegistry.
- Produces: DbProvider.Platform, DbProvider.SqlCompiler, DbProvider.Capabilities.

- [ ] **Step 1: Write failing provider binding tests**

~~~csharp
[Theory]
[InlineData(DatabaseType.MySql)]
[InlineData(DatabaseType.SqlServer)]
[InlineData(DatabaseType.Oracle)]
[InlineData(DatabaseType.PostgreSql)]
[InlineData(DatabaseType.DaMeng)]
[InlineData(DatabaseType.KingBase)]
public void Official_provider_is_bound_to_matching_platform(DatabaseType type)
{
    var provider = ProviderTestFactory.Create(type);
    Assert.Equal(type, provider.Platform.Type);
    Assert.Same(provider.Platform.Compiler, provider.SqlCompiler);
}

[Fact]
public void Provider_cache_key_contains_database_type()
{
    var mysql = ProviderFactory.CreateDbProvider(
        null, "mysql", TestConnections.Placeholder, DatabaseType.MySql);
    var sqlServer = ProviderFactory.CreateDbProvider(
        null, "sqlserver", TestConnections.Placeholder, DatabaseType.SqlServer);
    Assert.NotSame(mysql, sqlServer);
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~ProviderPlatformBindingTests --nologo
~~~

Expected: FAIL because DbProvider has no Platform property.

- [ ] **Step 3: Add non-abstract compatibility properties**

~~~csharp
public DatabasePlatformDescriptor Platform { get; internal set; }
public ISqlCompiler SqlCompiler => Platform?.Compiler;
public DatabaseCapabilities Capabilities => Platform?.Capabilities;
~~~

Replace the official-six creation switch with registry-driven provider construction while preserving explicit MsAccess, Sqlite3, and SqlServer9 legacy paths. Include database type and DialectProfile in the cache key. Unknown official aliases throw; they do not fall through to SQL Server.

- [ ] **Step 4: Run and verify GREEN**

Run the focused command from Step 2 and PublicApiBaselineTests. Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/Provider Microi.Server/Dos.ORM.Tests/Compatibility/ProviderPlatformBindingTests.cs
git commit -m "refactor: bind Dos.ORM providers to dialect registry"
~~~

### Task 2: Materialize AST plans into commands without provider string rewriting

**Files:**
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlCommandMaterializer.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/IDbDriverAdapter.cs
- Modify: Microi.Server/Dos.ORM/Db/Database.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/FakeDbDriver.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/TestConnections.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/PlanSamples.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/SqlCommandMaterializerTests.cs

**Interfaces:**
- Produces: SqlCommandMaterializer.Materialize(DatabaseExecutionPlan, ParameterBag, DbConnection, DbTransaction).

- [ ] **Step 1: Write failing command capture tests**

~~~csharp
[Fact]
public void Materializer_binds_values_and_current_transaction_once()
{
    var connection = new CapturingDbConnection();
    var transaction = connection.BeginTransaction();
    var plan = PlanSamples.UserById();
    var bag = new ParameterBag().Add("id", Guid.Empty);

    var commands = new SqlCommandMaterializer(TestDrivers.PostgreSql)
        .Materialize(plan, bag, connection, transaction);

    Assert.Single(commands);
    Assert.Same(transaction, commands[0].Transaction);
    Assert.Single(commands[0].Parameters);
    Assert.Equal(Guid.Empty,
        ((DbParameter)commands[0].Parameters[0]).Value);
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~SqlCommandMaterializerTests --nologo
~~~

Expected: FAIL because materializer and driver adapter do not exist.

- [ ] **Step 3: Add the AST-only command path**

~~~csharp
public interface IDbDriverAdapter
{
    DbCommand CreateCommand(DbConnection connection);
    DbParameter CreateParameter(BoundParameter parameter);
    string NormalizeConnectionString(string connectionString);
}

public IReadOnlyList<DbCommand> Materialize(
    DatabaseExecutionPlan plan, ParameterBag values,
    DbConnection connection, DbTransaction transaction);
~~~

Database receives an internal execution overload for materialized AST commands. That overload must not call DbProvider.PrepareCommand; legacy string commands continue to call it until their module migrates.

- [ ] **Step 4: Run and verify GREEN**

Run the focused command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/SqlCompilation Microi.Server/Dos.ORM/Db/Database.cs Microi.Server/Dos.ORM.Tests/Compatibility/SqlCommandMaterializerTests.cs
git commit -m "feat: materialize AST commands with driver adapters"
~~~

### Task 3: Add DbSession, DbTrans, and SafeTransactionProxy AST/native entry points

**Files:**
- Modify: Microi.Server/Dos.ORM/Db/DbSession.cs
- Modify: Microi.Server/Dos.ORM/Db/DbTrans.cs
- Modify: Microi.Server/Dos.ORM/Db/SafeTransactionProxy.cs
- Modify: Microi.Server/Dos.ORM/Section/Section.cs
- Modify: Microi.Server/Dos.ORM/Section/SqlSection.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/AstExecutionEntryPointTests.cs

**Interfaces:**
- Produces: DbSession.FromAst, ExecuteAst, FromNativeSql; matching DbTrans virtual methods and SafeTransactionProxy forwarding.

- [ ] **Step 1: Write failing entry-point tests**

~~~csharp
[Fact]
public void Safe_proxy_forwards_ast_execution_to_inner_transaction()
{
    var inner = new RecordingDbTrans();
    var proxy = new SafeTransactionProxy(inner, "test");
    proxy.ExecuteAst(AstSamples.DeleteUser(), new ParameterBag().Add("id", "1"));
    Assert.Equal(1, inner.ExecuteAstCalls);
}

[Fact]
public void Legacy_from_sql_remains_native_and_untranslated()
{
    var db = SessionTestFactory.Create(DatabaseType.PostgreSql);
    var section = db.FromSql("select vendor_specific_function()");
    Assert.Equal("select vendor_specific_function()", section.SqlString);
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~AstExecutionEntryPointTests --nologo
~~~

Expected: FAIL because AST methods do not exist.

- [ ] **Step 3: Add overloads without changing old signatures**

~~~csharp
public SqlSection FromAst(SqlStatement statement, ParameterBag values);
public int ExecuteAst(SqlStatement statement, ParameterBag values);
public SqlSection FromNativeSql(NativeSqlText sql);
~~~

Add virtual equivalents to DbTrans and forwarding overrides to SafeTransactionProxy. FromNativeSql verifies the declared target database but does not translate text.

- [ ] **Step 4: Run and verify GREEN**

Run the focused test plus PublicApiBaselineTests. Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/Db Microi.Server/Dos.ORM/Section Microi.Server/Dos.ORM.Tests/Compatibility/AstExecutionEntryPointTests.cs
git commit -m "feat: expose transactional AST execution entry points"
~~~

### Task 4: Adapt Field, Expression, WhereClip, GroupByClip, and OrderByClip

**Files:**
- Create: Microi.Server/Dos.ORM/SqlAst/Compatibility/LegacyFieldAdapter.cs
- Create: Microi.Server/Dos.ORM/SqlAst/Compatibility/LegacyExpressionAdapter.cs
- Modify: Microi.Server/Dos.ORM/Common/Field.cs
- Modify: Microi.Server/Dos.ORM/Expression/Expression.cs
- Modify: Microi.Server/Dos.ORM/Expression/WhereClip.cs
- Modify: Microi.Server/Dos.ORM/Expression/OrderByClip.cs
- Modify: Microi.Server/Dos.ORM/Expression/GroupByClip.cs
- Modify: Microi.Server/Dos.ORM/Expression/ExpressionToClip.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/ExpressionCompatibilityTests.cs

**Interfaces:**
- Produces: internal AstNode properties on legacy value objects and adapters for existing string-created clips.

- [ ] **Step 1: Write failing legacy-to-AST equivalence tests**

~~~csharp
[Fact]
public void Field_comparison_keeps_legacy_parameters_and_builds_ast()
{
    var where = new Field("Account", "Sys_User") == "admin";
    var ast = LegacyExpressionAdapter.ToAst(where);
    var binary = Assert.IsType<BinaryExpression>(ast);
    Assert.Equal(SqlBinaryOperator.Equal, binary.Operator);
    Assert.IsType<ParameterExpression>(binary.Right);
    Assert.Single(where.Parameters);
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~ExpressionCompatibilityTests --nologo
~~~

Expected: FAIL because compatibility adapters do not exist.

- [ ] **Step 3: Add parallel AST state to legacy objects**

Keep every constructor, operator, implicit conversion, Parameters collection, and ToString behavior. New members are internal. Raw string constructors create LegacyRawExpression diagnostics and are forbidden for new platform call sites.

~~~csharp
internal SqlExpression AstNode { get; set; }

internal static SqlExpression ToAst(WhereClip clip)
{
    if (clip == null || WhereClip.IsNullOrEmpty(clip))
        return null;
    return clip.AstNode ?? new LegacyRawExpression(
        clip.ToString(), clip.Parameters);
}
~~~

- [ ] **Step 4: Run focused and public API tests**

Expected: both suites PASS and old reflection signatures remain.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/Common/Field.cs Microi.Server/Dos.ORM/Expression Microi.Server/Dos.ORM/SqlAst/Compatibility Microi.Server/Dos.ORM.Tests/Compatibility/ExpressionCompatibilityTests.cs
git commit -m "refactor: adapt legacy expressions to SQL AST"
~~~

### Task 5: Adapt FromSection and fix SqlSection pagination

**Files:**
- Create: Microi.Server/Dos.ORM/SqlAst/Compatibility/LegacyFromSectionAdapter.cs
- Modify: Microi.Server/Dos.ORM/Section/FromSection.cs
- Modify: Microi.Server/Dos.ORM/Section/SqlSection.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/FromSectionCompatibilityTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/SqlSectionPaginationTests.cs

**Interfaces:**
- Produces: FromSection.SelectAst, compiler-derived SqlString/CountSqlString, portable ToPageList/Async.

- [ ] **Step 1: Write failing six-provider paging tests**

~~~csharp
[Theory]
[MemberData(nameof(DialectCases.AllCertified))]
public void SqlSection_page_list_uses_dialect_plan_not_unconditional_limit(
    CertifiedDialectCase dialect)
{
    var section = SectionTestFactory.Create(dialect);
    section.Page(20, 2);
    var command = section.BuildAstCommandForTest();
    Assert.Equal(dialect.ExpectedPagingToken, command.PagingToken);
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter "FullyQualifiedName~FromSectionCompatibilityTests|FullyQualifiedName~SqlSectionPaginationTests" --nologo
~~~

Expected: FAIL because FromSection is still string-only and SqlSection always uses LIMIT/OFFSET.

- [ ] **Step 3: Build SelectStatement incrementally**

Each existing fluent method updates the internal immutable SelectStatement and still returns the same legacy type. SqlString and CountSqlString compile the AST lazily. ToPageList executes separate Count and Data plans under the same transaction or consistency context; it does not concatenate queries with semicolons.

- [ ] **Step 4: Run and verify GREEN**

Run focused tests and the full Dos.ORM.Tests project. Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/Section Microi.Server/Dos.ORM/SqlAst/Compatibility/LegacyFromSectionAdapter.cs Microi.Server/Dos.ORM.Tests/Compatibility
git commit -m "refactor: route query sections through SQL AST"
~~~

### Task 6: Adapt CommandCreator Insert, Update, and Delete

**Files:**
- Modify: Microi.Server/Dos.ORM/Db/CommandCreator.cs
- Modify: Microi.Server/Dos.ORM/Db/DbSession.cs
- Modify: Microi.Server/Dos.ORM/Db/DbTrans.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/CommandCreatorTestHarness.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/CommandCreatorCompatibilityTests.cs

**Interfaces:**
- Produces: AST-backed CreateInsertCommand, CreateUpdateCommand, CreateDeleteCommand with unchanged return types.

- [ ] **Step 1: Write failing command capture tests**

~~~csharp
[Theory]
[MemberData(nameof(DialectCases.AllCertified))]
public void Entity_dml_uses_parameters_and_the_current_transaction(
    CertifiedDialectCase dialect)
{
    var command = CommandCreatorTestHarness.UpdateUser(dialect);
    Assert.DoesNotContain("new-name", command.CommandText);
    Assert.Contains(command.Parameters.Cast<DbParameter>(),
        parameter => Equals(parameter.Value, "new-name"));
    Assert.Same(dialect.Transaction, command.Transaction);
}
~~~

- [ ] **Step 2: Run and verify RED**

Run CommandCreatorCompatibilityTests. Expected: at least one dialect still uses legacy text generation.

- [ ] **Step 3: Replace internal command generation with DML AST**

Entity metadata creates SqlObjectName, SqlAssignment, keys, and ParameterBag. CommandCreator compiles and materializes the plan, then returns the same DbCommand type expected by callers.

- [ ] **Step 4: Run and verify GREEN**

Run focused tests, public API tests, and Dos.ORM.Tests. Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/Db/CommandCreator.cs Microi.Server/Dos.ORM/Db/DbSession.cs Microi.Server/Dos.ORM/Db/DbTrans.cs Microi.Server/Dos.ORM.Tests/Compatibility/CommandCreatorCompatibilityTests.cs
git commit -m "refactor: compile entity DML from SQL AST"
~~~

### Task 7: Adapt SqlFunc, Upsert, and BulkCopy

**Files:**
- Modify: Microi.Server/Dos.ORM/Db/SqlFunc.cs
- Modify: Microi.Server/Dos.ORM/Db/Upsert.cs
- Modify: Microi.Server/Dos.ORM/Db/BulkCopy.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/BulkTestHarness.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/SqlFuncCompatibilityTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/UpsertCompatibilityTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/BulkCopyCompatibilityTests.cs

**Interfaces:**
- Preserves: all existing public extension signatures.
- Produces: semantic-function lowering, atomic Upsert plans, transaction-safe native/fallback Bulk.

- [ ] **Step 1: Write failing contract tests**

~~~csharp
[Theory]
[MemberData(nameof(DialectCases.AllCertified))]
public void Bulk_fallback_respects_transaction_and_parameter_limit(
    CertifiedDialectCase dialect)
{
    var result = BulkTestHarness.PlanRows(
        dialect, rowCount: 1000, columnsPerRow: 8);
    Assert.All(result.Commands,
        command => Assert.True(command.Parameters.Count <=
            dialect.Capabilities.MaxParametersPerCommand));
    Assert.All(result.Commands,
        command => Assert.Same(dialect.Transaction, command.Transaction));
}
~~~

- [ ] **Step 2: Run and verify RED**

Run the three focused compatibility suites. Expected: failures expose legacy database switches and the transactionless fallback.

- [ ] **Step 3: Route all three features through compiler capabilities**

SqlFunc creates SemanticFunctionId expressions; its legacy string-return helpers compile only a function projection through the current platform. Upsert compiles one semantic UpsertStatement. Bulk chooses the platform native executor when its connection type matches, otherwise compiles Insert batches without leaving the active transaction.

- [ ] **Step 4: Run and verify GREEN**

Run focused suites and Dos.ORM.Tests. Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/Db/SqlFunc.cs Microi.Server/Dos.ORM/Db/Upsert.cs Microi.Server/Dos.ORM/Db/BulkCopy.cs Microi.Server/Dos.ORM.Tests/Compatibility
git commit -m "refactor: centralize functions upsert and bulk"
~~~

### Task 8: Turn CodeFirst and IMicroiORM services into schema AST facades

**Files:**
- Create: Microi.Server/Dos.ORM/SqlAst/Compatibility/LegacySchemaAdapter.cs
- Modify: Microi.Server/Dos.ORM/DDL/CodeFirst.cs
- Modify: Microi.Server/Dos.ORM/DDL/DbServiceParam.cs
- Modify: Microi.Server/Dos.ORM/DDL/Services/MySqlService.cs
- Modify: Microi.Server/Dos.ORM/DDL/Services/SqlServerService.cs
- Modify: Microi.Server/Dos.ORM/DDL/Services/OracleService.cs
- Modify: Microi.Server/Dos.ORM/DDL/Services/PostgreSqlService.cs
- Modify: Microi.Server/Dos.ORM/DDL/Services/DaMengService.cs
- Modify: Microi.Server/Dos.ORM/DDL/Services/KingBaseService.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/CodeFirstCompatibilityTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/LegacyDdlServiceCompatibilityTests.cs

**Interfaces:**
- Preserves: IMicroiORM unchanged.
- Produces: one LegacySchemaAdapter implementation path shared by all six service facades.

- [ ] **Step 1: Write failing schema facade tests**

~~~csharp
[Theory]
[MemberData(nameof(DialectCases.AllCertified))]
public void Legacy_add_field_compiles_schema_ast(
    CertifiedDialectCase dialect)
{
    var service = LegacyDdlTestFactory.Create(dialect);
    service.AddField(new DbServiceParam
    {
        TableName = "ContractTable",
        FieldName = "DisplayName",
        FieldType = "nvarchar",
        FieldLength = 200
    });
    Assert.IsType<AddColumnOperation>(
        dialect.CapturedSchemaOperation);
}
~~~

- [ ] **Step 2: Run and verify RED**

Run CodeFirstCompatibilityTests and LegacyDdlServiceCompatibilityTests. Expected: services still render separate SQL.

- [ ] **Step 3: Delegate every legacy member to Schema AST**

Keep IMicroiORM untouched. Six service classes become thin constructors/facades over LegacySchemaAdapter. CodeFirst maps entity metadata to TableDefinition and calls the same schema planner. Remove catch-all ExecuteSilent behavior; ignore only explicitly classified already-exists outcomes.

- [ ] **Step 4: Run and verify GREEN**

Run both focused suites, PublicApiBaselineTests, Dos.ORM.Tests, and the solution build. Expected: PASS and 0 build errors.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/DDL Microi.Server/Dos.ORM/SqlAst/Compatibility/LegacySchemaAdapter.cs Microi.Server/Dos.ORM.Tests/Compatibility
git commit -m "refactor: route legacy schema APIs through AST"
~~~

### Task 9: Add Legacy, Compare, and Ast pipeline modes and make Ast the verified default

**Files:**
- Create: Microi.Server/Dos.ORM/SqlAst/Compatibility/SqlPipelineMode.cs
- Create: Microi.Server/Dos.ORM/SqlAst/Compatibility/SqlPipelineComparison.cs
- Modify: Microi.Server/Dos.ORM/Db/Database.cs
- Modify: Microi.Server/Dos.ORM/Db/DbSession.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/PipelineHarness.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/PipelineModeTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/LegacyCallSiteCompileTests.cs

**Interfaces:**
- Produces: SqlPipelineMode.Legacy/Compare/Ast and comparison diagnostics without parameter values.

- [ ] **Step 1: Write failing no-double-write tests**

~~~csharp
[Fact]
public void Compare_mode_executes_only_legacy_write()
{
    var harness = PipelineHarness.Create(SqlPipelineMode.Compare);
    harness.ExecuteUpdate();
    Assert.Equal(1, harness.LegacyExecuteCount);
    Assert.Equal(0, harness.AstExecuteCount);
    Assert.Single(harness.Comparisons);
}
~~~

- [ ] **Step 2: Run and verify RED**

Run PipelineModeTests. Expected: mode types do not exist.

- [ ] **Step 3: Implement frozen-legacy comparison**

Compare normalized command structure, parameter definitions, result shape, and atomicity without logging values. Read-only test mode may execute both against isolated fixtures; production Compare never double-executes. Set the default to Ast only after every compatibility suite is green.

- [ ] **Step 4: Run the complete adapter gate**

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --nologo
dotnet test .\Dos.Common.Tests\Dos.Common.Tests.csproj --nologo
dotnet build .\Microi.net.sln --no-restore --nologo
~~~

Expected: all tests pass and build has 0 errors.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM Microi.Server/Dos.ORM.Tests
git commit -m "feat: switch verified Dos.ORM paths to SQL AST"
~~~

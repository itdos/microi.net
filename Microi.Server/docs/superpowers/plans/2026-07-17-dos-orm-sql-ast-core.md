# Dos.ORM SQL AST Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Build the immutable, database-neutral SQL AST, parameter model, execution-plan model, normalization, and validation core without changing the existing Dos.ORM execution path.

**Architecture:** Existing Dos.ORM public APIs remain untouched in this plan. New netstandard2.1-compatible types under Dos.ORM.SqlAst and Dos.ORM.SqlCompilation model intent without database syntax or runtime parameter values; later plans add six compilers and legacy adapters.

**Tech Stack:** C# on netstandard2.1, .NET 10 xUnit tests, Microsoft.NET.Test.Sdk 17.14.1, xUnit 2.9.3.

## Global Constraints

- Production target remains netstandard2.1.
- Production code must not use record, init, required, ArgumentNullException.ThrowIfNull, FrozenDictionary, IReadOnlySet<T>, or other net10-only APIs.
- DatabaseType numeric values remain SqlServer=0, MsAccess=1, SqlServer9=2, Oracle=3, Sqlite3=4, MySql=5, PostgreSql=6, DaMeng=7, KingBase=8.
- All AST nodes are immutable after construction and defensive-copy collection inputs.
- AST and cached plans never contain runtime parameter values.
- Dynamic values are ParameterExpression references resolved from ParameterBag only at execution binding time.
- A SqlIdentifier represents exactly one unquoted segment and rejects dots, quote characters, brackets, control characters, empty text, and whitespace-only text.
- Existing DbSession, DbProvider, ProviderFactory, FromSection, SqlFunc, CodeFirst, IMicroiORM, Upsert, and BulkCopy behavior is not changed by this plan.
- User-authored raw SQL is opaque and is never parsed or translated by the AST pipeline.
- At the later legacy-adapter Task 2 Step 0, after adapter Task 1 is green but
  before Task 2 changes production or public API, its tests capture one
  immutable canonical snapshot of the complete then-current Dos.ORM public/
  protected type/member/base/interface/interface-map surface. This core plan
  and the six-dialect plan are already green, so the exact compiler and plan-
  model APIs—including legitimate plan returns—enter that baseline and are
  never misclassified as managed execution delta; the Task 2 public authorizer
  does not.

---

### Task 1: Add the Dos.ORM test project and freeze the public API baseline

**Files:**
- Create: Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/PublicApiBaselineTests.cs
- Modify: Microi.Server/Microi.net.sln
- Modify: Microi.Server/Microi.Anderson.sln

**Interfaces:**
- Consumes: Existing Dos.ORM public assembly.
- Produces: A test project used by all later plans and initial compatibility
  characterization for DatabaseType and selected legacy entry points. The
  exhaustive assembly-wide canonical snapshot is deliberately captured later,
  at legacy-adapter Task 2 Step 0 after core/compiler and adapter Task 1 exist
  but before Task 2 introduces any production/API delta.

- [ ] **Step 1: Create the test project**

~~~xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="coverlet.collector" Version="6.0.4" />
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.1" />
    <PackageReference Include="xunit" Version="2.9.3" />
    <PackageReference Include="xunit.runner.visualstudio" Version="3.1.4" />
  </ItemGroup>
  <ItemGroup>
    <Using Include="Xunit" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\Dos.ORM\Dos.ORM.csproj" />
  </ItemGroup>
</Project>
~~~

- [ ] **Step 2: Write the public API characterization test**

~~~csharp
using System.Reflection;
using Dos.ORM;

namespace Dos.ORM.Tests.Compatibility;

public sealed class PublicApiBaselineTests
{
    [Fact]
    public void DatabaseType_numeric_values_are_stable()
    {
        Assert.Equal(0, (int)DatabaseType.SqlServer);
        Assert.Equal(1, (int)DatabaseType.MsAccess);
        Assert.Equal(2, (int)DatabaseType.SqlServer9);
        Assert.Equal(3, (int)DatabaseType.Oracle);
        Assert.Equal(4, (int)DatabaseType.Sqlite3);
        Assert.Equal(5, (int)DatabaseType.MySql);
        Assert.Equal(6, (int)DatabaseType.PostgreSql);
        Assert.Equal(7, (int)DatabaseType.DaMeng);
        Assert.Equal(8, (int)DatabaseType.KingBase);
    }

    [Theory]
    [InlineData(typeof(DbSession), "FromSql")]
    [InlineData(typeof(DbTrans), "FromSql")]
    [InlineData(typeof(ProviderFactory), "CreateDbProvider")]
    [InlineData(typeof(DbProvider), "BuildParameterName")]
    [InlineData(typeof(DbProvider), "BuildTableName")]
    public void Legacy_public_members_remain_available(Type type, string member)
    {
        Assert.Contains(type.GetMethods(BindingFlags.Instance | BindingFlags.Static |
                                        BindingFlags.Public | BindingFlags.NonPublic),
            method => method.Name == member);
    }
}
~~~

These initial high-risk signature checks are not the exhaustive assembly gate.
The legacy-adapter Task 2 Step 0 extends this test project with the canonical
full-assembly snapshot/serializer and permanent baseline-subset assertion; no
later task may regenerate that snapshot. Legacy Task 3 only adds the final
literal exact-delta allowlist/assertion against the already-committed baseline.

- [ ] **Step 3: Add the project to both solutions**

Run:

~~~powershell
dotnet sln .\Microi.net.sln add .\Dos.ORM.Tests\Dos.ORM.Tests.csproj
dotnet sln .\Microi.Anderson.sln add .\Dos.ORM.Tests\Dos.ORM.Tests.csproj
~~~

Expected: both commands report that Dos.ORM.Tests was added.

- [ ] **Step 4: Run the characterization test**

Run:

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~PublicApiBaselineTests --nologo
~~~

Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM.Tests Microi.Server/Microi.net.sln Microi.Server/Microi.Anderson.sln
git commit -m "test: freeze Dos.ORM public API baseline"
~~~

### Task 2: Implement identifiers, logical types, and the three-layer parameter model

**Files:**
- Create: Microi.Server/Dos.ORM/SqlAst/SqlNode.cs
- Create: Microi.Server/Dos.ORM/SqlAst/SqlNames.cs
- Create: Microi.Server/Dos.ORM/SqlAst/SqlTypes.cs
- Create: Microi.Server/Dos.ORM/SqlAst/SqlParameters.cs
- Create: Microi.Server/Dos.ORM.Tests/SqlAst/NamesTypesParametersTests.cs

**Interfaces:**
- Produces: SqlNode, SqlIdentifier, SqlObjectName, SqlAlias, LogicalDbType, SqlTypeDescriptor, ParameterDefinition, ParameterBag, BoundParameter.
- Consumers: every later AST node and compiler.

- [ ] **Step 1: Write failing identifier and parameter tests**

~~~csharp
using Dos.ORM.SqlAst;

namespace Dos.ORM.Tests.SqlAst;

public sealed class NamesTypesParametersTests
{
    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("dbo.User")]
    [InlineData("\u0060User\u0060")]
    [InlineData("[User]")]
    [InlineData("\"User\"")]
    public void Identifier_rejects_non_segment_text(string value) =>
        Assert.Throws<ArgumentException>(() => new SqlIdentifier(value));

    [Fact]
    public void Parameter_definition_never_contains_runtime_value()
    {
        var definition = new ParameterDefinition(
            "account",
            new SqlTypeDescriptor(LogicalDbType.String, length: 200));
        var bag = new ParameterBag().Add("account", "admin");

        Assert.Equal("account", definition.Name);
        Assert.True(bag.TryGetValue("account", out var value));
        Assert.Equal("admin", value);
        Assert.DoesNotContain(definition.GetType().GetProperties(),
            property => property.Name == "Value");
    }
}
~~~

- [ ] **Step 2: Run the tests and verify RED**

Run:

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~NamesTypesParametersTests --nologo
~~~

Expected: FAIL to compile because Dos.ORM.SqlAst types do not exist.

- [ ] **Step 3: Implement the minimal immutable model**

~~~csharp
namespace Dos.ORM.SqlAst
{
    public abstract class SqlNode { }

    public sealed class SqlIdentifier : IEquatable<SqlIdentifier>
    {
        public SqlIdentifier(string value)
        {
            if (string.IsNullOrWhiteSpace(value) ||
                value.IndexOf('.') >= 0 || value.IndexOf('\u0060') >= 0 ||
                value.IndexOf('[') >= 0 || value.IndexOf(']') >= 0 ||
                value.IndexOf('"') >= 0 || value.Any(char.IsControl))
                throw new ArgumentException("Identifier must be one unquoted segment.", nameof(value));
            Value = value;
        }
        public string Value { get; }
        public bool Equals(SqlIdentifier other) =>
            other != null && string.Equals(Value, other.Value, StringComparison.Ordinal);
        public override bool Equals(object obj) => Equals(obj as SqlIdentifier);
        public override int GetHashCode() => StringComparer.Ordinal.GetHashCode(Value);
    }

    public enum LogicalDbType
    {
        String, AnsiString, Int16, Int32, Int64, Decimal, Double, Boolean,
        Guid, Date, DateTime, DateTimeOffset, Binary, Json, Clob, Blob
    }
}
~~~

Implement SqlObjectName with separate catalog/schema/name properties, SqlAlias, SqlTypeDescriptor, ParameterDefinition without a Value property, ParameterBag with duplicate-name rejection, and BoundParameter created only from a definition, placeholder, and runtime value.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~NamesTypesParametersTests --nologo
~~~

Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/SqlAst Microi.Server/Dos.ORM.Tests/SqlAst/NamesTypesParametersTests.cs
git commit -m "feat: add immutable SQL AST names and parameters"
~~~

### Task 3: Implement expressions and the semantic function catalog

**Files:**
- Create: Microi.Server/Dos.ORM/SqlAst/SqlExpressions.cs
- Create: Microi.Server/Dos.ORM/SqlAst/SemanticFunctions.cs
- Create: Microi.Server/Dos.ORM.Tests/SqlAst/ExpressionAndFunctionTests.cs

**Interfaces:**
- Consumes: SqlNode, SqlIdentifier, ParameterDefinition.
- Produces: SqlExpression hierarchy and SemanticFunctionId catalog.

- [ ] **Step 1: Write failing expression tests**

~~~csharp
using Dos.ORM.SqlAst;

namespace Dos.ORM.Tests.SqlAst;

public sealed class ExpressionAndFunctionTests
{
    [Fact]
    public void Function_requires_registered_semantic_id()
    {
        var column = new ColumnExpression(
            new SqlIdentifier("Name"),
            new SqlAlias("u"));
        var function = new FunctionExpression(
            SemanticFunctions.Length,
            new[] { column });

        Assert.Same(SemanticFunctions.Length, function.Function);
        Assert.Single(function.Arguments);
    }

    [Fact]
    public void Expression_defensively_copies_arguments()
    {
        var arguments = new List<SqlExpression>
        {
            new ParameterExpression(new ParameterDefinition(
                "p0", new SqlTypeDescriptor(LogicalDbType.String)))
        };
        var function = new FunctionExpression(SemanticFunctions.Coalesce, arguments);
        arguments.Clear();
        Assert.Single(function.Arguments);
    }
}
~~~

- [ ] **Step 2: Run tests and verify RED**

Run:

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~ExpressionAndFunctionTests --nologo
~~~

Expected: FAIL because the expression types do not exist.

- [ ] **Step 3: Implement expression nodes**

Create abstract SqlExpression plus ColumnExpression, ParameterExpression, NullExpression, BooleanExpression, BinaryExpression, UnaryExpression, InExpression, BetweenExpression, CaseExpression, CastExpression, ExistsExpression, SubqueryExpression, AggregateExpression, and FunctionExpression.

Use these operators:

~~~csharp
public enum SqlBinaryOperator
{
    Equal, NotEqual, GreaterThan, GreaterThanOrEqual,
    LessThan, LessThanOrEqual, Add, Subtract, Multiply, Divide,
    And, Or, Like
}

public enum SqlUnaryOperator { Not, Negate, IsNull, IsNotNull }
~~~

Create internal-only SemanticFunctionId construction and public static identifiers Concat, Substring, Length, CurrentDateTime, DateAdd, DateDiff, Coalesce, Round, JsonValue, Count, Sum, Avg, Min, and Max.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~ExpressionAndFunctionTests --nologo
~~~

Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/SqlAst/SqlExpressions.cs Microi.Server/Dos.ORM/SqlAst/SemanticFunctions.cs Microi.Server/Dos.ORM.Tests/SqlAst/ExpressionAndFunctionTests.cs
git commit -m "feat: model SQL expressions and semantic functions"
~~~

### Task 4: Implement SELECT, joins, set operations, locks, and pagination AST

**Files:**
- Create: Microi.Server/Dos.ORM/SqlAst/SqlQueryNodes.cs
- Create: Microi.Server/Dos.ORM.Tests/SqlAst/SelectStatementTests.cs

**Interfaces:**
- Consumes: SqlExpression and structured names.
- Produces: SqlTableSource, NamedTableSource, DerivedTableSource, JoinSource, SelectProjection, OrderByExpression, PageSpec, LockSpec, CommonTableExpression, SelectStatement.

- [ ] **Step 1: Write the failing SELECT construction test**

~~~csharp
[Fact]
public void Select_requires_deterministic_order_for_offset_pagination()
{
    var statement = new SelectStatement(
        new NamedTableSource(new SqlObjectName(new SqlIdentifier("Sys_User")),
            new SqlAlias("u")),
        new[] { new SelectProjection(new ColumnExpression(
            new SqlIdentifier("Id"), new SqlAlias("u"))) },
        orderBy: Array.Empty<OrderByExpression>(),
        page: new OffsetPageSpec(20, 20));

    var errors = SqlAstRules.ValidateShape(statement);
    Assert.Contains(errors, error => error.Code == "AST_PAGE_ORDER_REQUIRED");
}
~~~

- [ ] **Step 2: Run tests and verify RED**

Run:

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~SelectStatementTests --nologo
~~~

Expected: FAIL because query nodes do not exist.

- [ ] **Step 3: Implement the immutable query model**

Implement inner/left/right/full/cross joins, CTE, derived tables, distinct, where, group by, having, order by, offset pagination, keyset pagination, row locks, Union, UnionAll, Intersect, and Except. Represent wildcard with a dedicated WildcardExpression; never encode it as SqlIdentifier("*").

- [ ] **Step 4: Run tests and verify GREEN**

Run:

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~SelectStatementTests --nologo
~~~

Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/SqlAst/SqlQueryNodes.cs Microi.Server/Dos.ORM.Tests/SqlAst/SelectStatementTests.cs
git commit -m "feat: add portable SELECT AST"
~~~

### Task 5: Implement DML and safe write semantics

**Files:**
- Create: Microi.Server/Dos.ORM/SqlAst/SqlStatements.cs
- Create: Microi.Server/Dos.ORM.Tests/SqlAst/DmlStatementTests.cs

**Interfaces:**
- Produces: InsertStatement, UpdateStatement, DeleteStatement, UpsertStatement, BulkInsertOperation, assignment and conflict-policy models.

- [ ] **Step 1: Write failing safe-write tests**

~~~csharp
[Fact]
public void Update_without_where_requires_explicit_allow_all_rows()
{
    Assert.Throws<ArgumentException>(() => new UpdateStatement(
        new SqlObjectName(new SqlIdentifier("Sys_User")),
        new[] { new SqlAssignment(new SqlIdentifier("Status"),
            new ParameterExpression(new ParameterDefinition(
                "status", new SqlTypeDescriptor(LogicalDbType.Int32)))) },
        where: null,
        allowAllRows: false));
}

[Fact]
public void Upsert_requires_at_least_one_conflict_key()
{
    Assert.Throws<ArgumentException>(() => new UpsertStatement(
        new SqlObjectName(new SqlIdentifier("Sys_User")),
        Array.Empty<SqlIdentifier>(),
        Array.Empty<SqlAssignment>(),
        Array.Empty<SqlAssignment>()));
}
~~~

- [ ] **Step 2: Run tests and verify RED**

Run:

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~DmlStatementTests --nologo
~~~

Expected: FAIL because DML nodes do not exist.

- [ ] **Step 3: Implement DML nodes**

Implement values and insert-select forms, update assignments, guarded delete, semantic UpsertStatement with ConflictPolicy, optional returning semantics, and BulkInsertOperation as a database-neutral operation rather than assumed SQL text.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~DmlStatementTests --nologo
~~~

Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/SqlAst/SqlStatements.cs Microi.Server/Dos.ORM.Tests/SqlAst/DmlStatementTests.cs
git commit -m "feat: add safe portable DML AST"
~~~

### Task 6: Implement schema, metadata, diagnostics, and admin operations

**Files:**
- Create: Microi.Server/Dos.ORM/SqlAst/SchemaModels.cs
- Create: Microi.Server/Dos.ORM/SqlAst/SchemaStatements.cs
- Create: Microi.Server/Dos.ORM.Tests/SqlAst/SchemaAndAdminStatementTests.cs

**Interfaces:**
- Produces: TableDefinition, ColumnDefinition, IndexDefinition, ConstraintDefinition, SequenceDefinition, SchemaOperation, MigrationPlan, metadata and diagnostics operations, CreateDatabaseOperation, DropDatabaseOperation.

- [ ] **Step 1: Write failing destructive-migration tests**

~~~csharp
[Fact]
public void Destructive_schema_steps_are_disabled_by_default()
{
    var plan = new MigrationPlan(new SchemaOperation[]
    {
        new DropColumnOperation(
            new SqlObjectName(new SqlIdentifier("Sys_User")),
            new SqlIdentifier("LegacyField"))
    });

    Assert.True(plan.ContainsDestructiveSteps);
    Assert.False(plan.CanApplyDestructiveSteps);
}
~~~

- [ ] **Step 2: Run tests and verify RED**

Run:

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~SchemaAndAdminStatementTests --nologo
~~~

Expected: FAIL because schema models do not exist.

- [ ] **Step 3: Implement neutral schema and admin models**

Include create/alter/drop table, add/alter/rename/drop column, primary/unique/foreign constraints, indexes, sequences, comments, table/column/index introspection, database diagnostics, create/drop database, import/export requests, and explicit destructive-step approval.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~SchemaAndAdminStatementTests --nologo
~~~

Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/SqlAst/SchemaModels.cs Microi.Server/Dos.ORM/SqlAst/SchemaStatements.cs Microi.Server/Dos.ORM.Tests/SqlAst/SchemaAndAdminStatementTests.cs
git commit -m "feat: model portable schema and admin operations"
~~~

### Task 7: Implement execution plans and the explicit native SQL boundary

**Files:**
- Create: Microi.Server/Dos.ORM/Platform/DialectProfile.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/CompilationModels.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/ISqlCompiler.cs
- Create: Microi.Server/Dos.ORM/SqlAst/NativeSqlText.cs
- Create: Microi.Server/Dos.ORM.Tests/SqlAst/ExecutionPlanAndNativeSqlTests.cs

**Interfaces:**
- Produces: the one canonical DialectProfile; DatabaseExecutionPlan, DatabasePlanStep, SqlCommandStep, BulkStep, AdminStep, NativeScriptStep, AtomicityRequirement, SqlResultShape, ISqlCompiler, and NativeSqlText.
- Namespace ownership: SqlSafetyOrigin and NativeSqlCommandKind are declared in Dos.ORM.SqlAst/NativeSqlText.cs; the seven plan-only enums are declared in Dos.ORM.SqlCompilation.
- Downstream contract: the six-dialect plan consumes this DialectProfile
  instead of creating it. Public migration/admin preview may return an
  immutable plan for review, but every execution/materialization entry accepts
  only the exact source, values, requested atomicity, and its distinct
  compiled-approval overload; no execution entry accepts a caller-supplied
  plan.

- [ ] **Step 1: Write failing plan/value-separation tests**

~~~csharp
[Fact]
public void Cached_command_step_contains_definitions_but_not_values()
{
    Assert.DoesNotContain(
        typeof(DatabasePlanStep).Assembly.GetTypes()
            .Where(type => type.Namespace == "Dos.ORM.SqlCompilation")
            .SelectMany(type => type.GetProperties()),
        property => property.PropertyType == typeof(ParameterBag) ||
                    property.PropertyType == typeof(BoundParameter));
}

[Fact]
public void Native_script_is_bound_to_one_exact_profile_and_origin()
{
    var profile = new DialectProfile(
        DatabaseType.PostgreSql, new Version(17, 2), string.Empty);
    var text = NativeSqlText.UserProvided(
        "SELECT 1", profile, NativeSqlCommandKind.Read);
    Assert.Equal(SqlSafetyOrigin.UserProvided, text.Origin);
    Assert.Same(profile, text.TargetProfile);
    Assert.Equal(DatabaseType.PostgreSql, text.TargetDatabase);
}
~~~

Also freeze private plan construction, the six named internal source-aware
factories, exact family/safety/route coupling, requested-options identity,
ordered `[Scalar, RowSet] -> MultipleResultSets` pagination, recursive bulk
parameter-definition consistency, dual Task 6/compiled-impact gates, and the
five literal v1 digest/fingerprint vectors from the controller-reviewed Task 7
brief. Tests use reflection for internal contracts; do not add
InternalsVisibleTo.

- [ ] **Step 2: Run tests and verify RED**

Run:

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~ExecutionPlanAndNativeSqlTests --nologo
~~~

Expected: FAIL because execution plan and native SQL types do not exist.

- [ ] **Step 3: Implement plan models**

Use:

~~~csharp
public interface ISqlCompiler
{
    DatabaseExecutionPlan Compile(
        SqlStatement statement,
        SqlCompilationOptions options);

    DatabaseExecutionPlan CompileMigration(
        MigrationPlan plan,
        SqlCompilationOptions options);
}
~~~

DatabaseExecutionPlan exposes read-only steps, result shape, safety origin,
AtomicityRequirement, exact DialectProfile/SchemaToken, compiled fingerprint,
and effective-impact gate. Its constructor is private. Named internal factories
take the exact source plus SqlCompilationOptions and derive root identity;
native derives its profile from NativeSqlText and requires atomicity None and
null schema token. NativeSqlText factories are UserProvided,
LegacyAiGenerated, and LegacyUnknown; there is no platform migration raw-SQL
factory.

Required is static plan evidence only: CurrentDatabase+Enlistable for every
step. The later trusted executor must preflight one reference-identical live
DbConnection+DbTransaction, exact detected profile, source/neutral gate,
compiled gate, schema token, and plan fingerprint before creating any command.
No live object enters Task 7 models or fingerprints.

The later adapter must support deterministic source-safe approval handoff:
preview compiles the exact source against the active live profile/schema and
may return the closed plan; after external authorization the plan mints the
audit-only `CompiledImpactApproval`; execution receives the original source
and approval, recompiles against current live options, attaches only through
`WithEffectiveImpactApproval`, reauthorizes and checks both Task 6/Task 7
gates, then preflights. Missing/foreign/stale/needless approval creates zero
commands. The existing public mutable-command `CommandCreator` API is a
separate legacy boundary and never consumes this plan/ticket path.
The later adapter freezes that exception as the sole constructor plus six
complete public/protected/interface-aware `MethodInfo` descriptors. At its
Task 2 Step 0, after this plan, all six compilers, and adapter Task 1 are green
but before Task 2 changes production/API, it commits the canonical complete
Dos.ORM public/protected type/member/base/interface/interface-map snapshot.
Historical members, this plan's exact plan-model/`ISqlCompiler` returns, Task 1
provider properties, and the legacy factories remain baseline-only; the public
authorizer introduced later in Task 2 remains exact delta. The post-snapshot
delta is exactly allowlisted, and a cycle-safe recursive
type-graph scan starts from every delta signature. It rejects plans, commands,
runtime contexts, object/open-generic/delegate/request wrappers, and static
executor escapes at any reachable depth while treating `System.Object` only as
the terminal base sentinel of an already accepted user DTO.

- [ ] **Step 4: Run tests and verify GREEN**

Run:

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~ExecutionPlanAndNativeSqlTests --nologo
~~~

Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/Platform/DialectProfile.cs Microi.Server/Dos.ORM/SqlCompilation Microi.Server/Dos.ORM/SqlAst/NativeSqlText.cs Microi.Server/Dos.ORM.Tests/SqlAst/ExecutionPlanAndNativeSqlTests.cs
git commit -m "feat: add SQL execution plans and native boundary"
~~~

### Task 8: Implement normalization, validation, and deterministic parameter allocation

**Files:**
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlAstNormalizer.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlAstValidator.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlParameterAllocator.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/AstSamples.cs
- Create: Microi.Server/Dos.ORM.Tests/Compilation/CompilationCoreTests.cs

**Interfaces:**
- Consumes: all AST nodes and ParameterBag.
- Produces: normalized AST, validation diagnostics, deterministic parameter slots, runtime BoundParameter lists.

- [ ] **Step 1: Write failing normalization and concurrency tests**

~~~csharp
[Fact]
public void Null_equality_normalizes_to_is_null()
{
    var input = new BinaryExpression(
        new ColumnExpression(new SqlIdentifier("DeletedAt")),
        SqlBinaryOperator.Equal,
        NullExpression.Instance);
    var output = new SqlAstNormalizer().Normalize(input);
    Assert.IsType<UnaryExpression>(output);
    Assert.Equal(SqlUnaryOperator.IsNull,
        ((UnaryExpression)output).Operator);
}

[Fact]
public async Task Parameter_allocation_is_deterministic_under_concurrency()
{
    var statement = AstSamples.UserByAccountAndStatus();
    var allocator = new SqlParameterAllocator();
    var results = await Task.WhenAll(Enumerable.Range(0, 50)
        .Select(_ => Task.Run(() => allocator.Allocate(statement))));
    Assert.All(results, result =>
        Assert.Equal(new[] { "p0", "p1" },
            result.Select(slot => slot.Placeholder).ToArray()));
}
~~~

- [ ] **Step 2: Run tests and verify RED**

Run:

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~CompilationCoreTests --nologo
~~~

Expected: FAIL because normalizer, validator, allocator, and AstSamples do not exist.

- [ ] **Step 3: Implement the minimal pipeline core**

Normalize NULL comparisons and empty IN lists; validate identifier structure, safe writes, function arity, pagination order, parameter definitions, and atomicity requirements; allocate placeholders from a per-compilation context with stable depth-first traversal and no static counter.

- [ ] **Step 4: Run the focused and full tests**

Run:

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~CompilationCoreTests --nologo
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --nologo
dotnet build .\Dos.ORM\Dos.ORM.csproj -c Release --nologo
dotnet build .\Microi.net.sln --no-restore --nologo
~~~

Expected: all Dos.ORM tests pass; both builds finish with 0 errors.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/SqlCompilation Microi.Server/Dos.ORM.Tests
git commit -m "feat: validate and normalize SQL AST"
~~~

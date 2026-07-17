# Dos.ORM Six-Dialect Compiler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Compile the complete neutral AST into correct, parameterized execution plans for MySQL, SQL Server, Oracle, PostgreSQL, DM8, and KingbaseES V9.

**Architecture:** A single registry resolves DatabaseType and DialectProfile to an immutable DatabasePlatformDescriptor. The shared compiler pipeline performs normalization, validation, lowering, parameter allocation, rendering, and plan construction; each database owns its renderer, type mapper, schema compiler, metadata compiler, admin compiler, and capability profile.

**Tech Stack:** C# netstandard2.1, existing ADO.NET providers in Dos.ORM, xUnit golden and contract tests.

## Global Constraints

- Official certification targets are MySQL, SQL Server, Oracle, PostgreSQL, DM8, and KingbaseES V9.
- Unknown aliases and unsupported capabilities fail fast; there is no fallback to MySQL or SQL Server.
- SQL Server Upsert must not default to MERGE; use a transactionally safe update-then-conditional-insert plan with locking.
- Oracle and DM8 are independently compiled and tested even when they share a family base.
- PostgreSQL and KingbaseES are independently compiled and tested even when they share a family base.
- DM8 compatibility mode and KingbaseES compatibility mode are part of DialectProfile.
- Dynamic values never enter command text.
- Compiler plans contain parameter definitions only; runtime values are bound later.
- Platform DDL and migrations are AST-only; native scripts are not a compiler escape hatch.
- Unsupported semantic equivalence throws UnsupportedDatabaseCapabilityException with dialect, version, feature, and AST node path.

---

### Task 1: Add dialect profiles, capabilities, descriptors, and strict registry resolution

**Files:**
- Create: Microi.Server/Dos.ORM/Platform/DialectProfile.cs
- Create: Microi.Server/Dos.ORM/Platform/DatabaseCapabilities.cs
- Create: Microi.Server/Dos.ORM/Platform/DatabasePlatformDescriptor.cs
- Create: Microi.Server/Dos.ORM/Platform/DatabasePlatformRegistry.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/TestProfiles.cs
- Create: Microi.Server/Dos.ORM.Tests/Platform/DatabasePlatformRegistryTests.cs

**Interfaces:**
- Consumes: DatabaseType and ISqlCompiler.
- Produces: DialectProfile, DatabaseCapabilities, DatabasePlatformDescriptor, DatabasePlatformRegistry.Get/TryGet/Resolve.

- [ ] **Step 1: Write failing registry tests**

~~~csharp
[Theory]
[InlineData("mysql", DatabaseType.MySql)]
[InlineData("sqlserver", DatabaseType.SqlServer)]
[InlineData("oracle", DatabaseType.Oracle)]
[InlineData("postgresql", DatabaseType.PostgreSql)]
[InlineData("dm8", DatabaseType.DaMeng)]
[InlineData("kingbasees-v9", DatabaseType.KingBase)]
public void Alias_resolves_to_one_official_platform(
    string alias, DatabaseType expected)
{
    Assert.Equal(expected, DatabasePlatformRegistry.Resolve(alias).Type);
}

[Fact]
public void Unknown_alias_fails_instead_of_falling_back() =>
    Assert.Throws<NotSupportedException>(() =>
        DatabasePlatformRegistry.Resolve("unknown-db"));
~~~

- [ ] **Step 2: Run tests and verify RED**

Run:

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~DatabasePlatformRegistryTests --nologo
~~~

Expected: FAIL because Platform types do not exist.

- [ ] **Step 3: Implement the strict profile and registry API**

~~~csharp
public sealed class DialectProfile
{
    public DialectProfile(DatabaseType databaseType, Version serverVersion,
        string compatibilityMode)
    {
        DatabaseType = databaseType;
        ServerVersion = serverVersion ??
            throw new ArgumentNullException(nameof(serverVersion));
        CompatibilityMode = compatibilityMode ?? string.Empty;
    }
    public DatabaseType DatabaseType { get; }
    public Version ServerVersion { get; }
    public string CompatibilityMode { get; }
}

public static class DatabasePlatformRegistry
{
    public static DatabasePlatformDescriptor Get(
        DatabaseType type, DialectProfile profile);
    public static bool TryGet(
        DatabaseType type, DialectProfile profile,
        out DatabasePlatformDescriptor platform);
    public static DatabasePlatformDescriptor Resolve(
        string alias, DialectProfile profile = null);
}
~~~

Register aliases case-insensitively. MsAccess, Sqlite3, and SqlServer9 remain explicit legacy types; SqlServer9 may reuse a legacy SQL Server compiler profile but must not be reported as one of the six certified platforms.

- [ ] **Step 4: Run tests and verify GREEN**

Run the focused test command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/Platform Microi.Server/Dos.ORM.Tests/Platform
git commit -m "feat: register strict database dialect profiles"
~~~

### Task 2: Implement the eight-stage compiler base and SQL writer

**Files:**
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlCompilerBase.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlTextWriter.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlLoweringContext.cs
- Modify: Microi.Server/Dos.ORM.Tests/TestInfrastructure/AstSamples.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/DialectCases.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/Compilers.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/TestOptions.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/PlanAssert.cs
- Create: Microi.Server/Dos.ORM.Tests/Compilation/CompilationPipelineTests.cs

**Interfaces:**
- Consumes: SqlAstNormalizer, SqlAstValidator, SqlParameterAllocator.
- Produces: SqlCompilerBase.Compile and abstract Lower/Render hooks.

- [ ] **Step 1: Write a failing pipeline-order test**

~~~csharp
[Fact]
public void Compiler_runs_all_stages_in_contract_order()
{
    var compiler = new RecordingCompiler();
    compiler.Compile(AstSamples.SimpleSelect(),
        new SqlCompilationOptions(TestProfiles.PostgreSql17));
    Assert.Equal(new[]
    {
        "Bind", "Normalize", "Validate", "Lower",
        "Optimize", "AllocateParameters", "Render", "Plan"
    }, compiler.Events);
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~CompilationPipelineTests --nologo
~~~

Expected: FAIL because SqlCompilerBase does not exist.

- [ ] **Step 3: Implement the pipeline template**

~~~csharp
public abstract class SqlCompilerBase : ISqlCompiler
{
    public DatabaseExecutionPlan Compile(
        SqlStatement statement, SqlCompilationOptions options)
    {
        var bound = Bind(statement, options);
        var normalized = Normalize(bound, options);
        Validate(normalized, options);
        var lowered = Lower(normalized, options);
        var optimized = Optimize(lowered, options);
        var allocated = AllocateParameters(optimized, options);
        var rendered = Render(allocated, options);
        return BuildPlan(rendered, options);
    }

    protected abstract SqlNode Lower(
        SqlNode node, SqlCompilationOptions options);
    protected abstract RenderedSql Render(
        AllocatedSqlNode node, SqlCompilationOptions options);
}
~~~

SqlTextWriter exposes AppendKeyword, AppendIdentifierSegment, AppendParameter, AppendCommaSeparated, and AppendSpace. It must not accept arbitrary business SQL fragments.

- [ ] **Step 4: Run and verify GREEN**

Run the focused command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/SqlCompilation Microi.Server/Dos.ORM.Tests/Compilation/CompilationPipelineTests.cs
git commit -m "feat: add deterministic SQL compiler pipeline"
~~~

### Task 3: Implement MySQL compiler and type/schema mapping

**Files:**
- Create: Microi.Server/Dos.ORM/Dialects/MySql/MySqlCompiler.cs
- Create: Microi.Server/Dos.ORM/Dialects/MySql/MySqlTypeMapper.cs
- Create: Microi.Server/Dos.ORM/Dialects/MySql/MySqlSchemaCompiler.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/MySqlCompilerTests.cs

**Interfaces:**
- Produces: MySQL query, DML, function, pagination, schema, metadata, and admin rendering.

- [ ] **Step 1: Write failing MySQL golden tests**

~~~csharp
[Fact]
public void MySql_renders_limit_offset_and_question_parameters()
{
    var plan = Compilers.MySql80.Compile(
        AstSamples.PagedUsers(), TestOptions.MySql80);
    var sql = PlanAssert.SingleSql(plan);
    Assert.Contains("\u0060Sys_User\u0060", sql.CommandText);
    Assert.Contains("LIMIT ?p0 OFFSET ?p1", sql.CommandText);
    Assert.Equal(new[] { "p0", "p1" },
        sql.Parameters.Select(x => x.Name).ToArray());
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~MySqlCompilerTests --nologo
~~~

Expected: FAIL because MySqlCompiler does not exist.

- [ ] **Step 3: Implement MySQL 5.7 and 8.0 profiles**

Render segmented identifiers with the MySQL quote token, parameters as ?pN, LIMIT/OFFSET, COALESCE, CONCAT, CURRENT_TIMESTAMP, JSON_EXTRACT, AUTO_INCREMENT types, information-schema metadata through MetadataQueryStatement, and atomic Upsert with ON DUPLICATE KEY UPDATE. Keep 5.7 and 8.0 capability differences in profile data.

- [ ] **Step 4: Run and verify GREEN**

Run the focused command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/Dialects/MySql Microi.Server/Dos.ORM.Tests/Dialects/MySqlCompilerTests.cs
git commit -m "feat: compile SQL AST for MySQL"
~~~

### Task 4: Implement PostgreSQL and KingbaseES V9 as independently tested dialects

**Files:**
- Create: Microi.Server/Dos.ORM/Dialects/PostgreSql/PostgreSqlCompiler.cs
- Create: Microi.Server/Dos.ORM/Dialects/PostgreSql/PostgreSqlTypeMapper.cs
- Create: Microi.Server/Dos.ORM/Dialects/KingbaseEs/KingbaseEsCompiler.cs
- Create: Microi.Server/Dos.ORM/Dialects/KingbaseEs/KingbaseEsTypeMapper.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/PostgreSqlCompilerTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/KingbaseEsCompilerTests.cs

**Interfaces:**
- Produces: separate PostgreSQL 14/17 and KingbaseES V9 PostgreSQL-mode plans.

- [ ] **Step 1: Write separate failing contract tests**

~~~csharp
[Theory]
[MemberData(nameof(DialectCases.PostgreSqlFamily))]
public void PostgreSql_family_profiles_keep_their_own_parameter_contract(
    ISqlCompiler compiler, SqlCompilationOptions options,
    string expectedParameterPrefix)
{
    var step = PlanAssert.SingleSql(
        compiler.Compile(AstSamples.UserById(), options));
    Assert.Contains(expectedParameterPrefix + "p0", step.CommandText);
}
~~~

DialectCases.PostgreSqlFamily returns PostgreSQL with @ and KingbaseES with :, and each test file owns independent golden strings.

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter "FullyQualifiedName~PostgreSqlCompilerTests|FullyQualifiedName~KingbaseEsCompilerTests" --nologo
~~~

Expected: FAIL because both compilers are missing.

- [ ] **Step 3: Implement both compilers**

Share only a package-internal ANSI/PostgreSQL-family helper. Render LIMIT/OFFSET, Boolean, JSON, RETURNING, and ON CONFLICT per profile. Kingbase native Bulk must use Kdbndp and must never cast its connection to Npgsql.

- [ ] **Step 4: Run and verify GREEN**

Run the focused command from Step 2. Expected: both suites PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/Dialects/PostgreSql Microi.Server/Dos.ORM/Dialects/KingbaseEs Microi.Server/Dos.ORM.Tests/Dialects
git commit -m "feat: compile AST for PostgreSQL and KingbaseES"
~~~

### Task 5: Implement SQL Server compiler with safe Upsert planning

**Files:**
- Create: Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerCompiler.cs
- Create: Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerTypeMapper.cs
- Create: Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerSchemaCompiler.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/SqlServerCompilerTests.cs

**Interfaces:**
- Produces: SQL Server 2017/2022 plans and SqlServer9 legacy query profile.

- [ ] **Step 1: Write failing pagination and Upsert tests**

~~~csharp
[Fact]
public void SqlServer_offset_requires_order_by()
{
    var statement = AstSamples.PagedUsersWithoutOrder();
    Assert.Throws<SqlAstValidationException>(() =>
        Compilers.SqlServer2022.Compile(statement, TestOptions.SqlServer2022));
}

[Fact]
public void SqlServer_upsert_uses_locked_atomic_plan_not_merge()
{
    var plan = Compilers.SqlServer2022.Compile(
        AstSamples.UpsertUser(), TestOptions.SqlServer2022);
    var text = string.Join(" ", plan.Steps.OfType<SqlCommandStep>()
        .Select(step => step.CommandText));
    Assert.Contains("UPDLOCK", text);
    Assert.Contains("SERIALIZABLE", text);
    Assert.DoesNotContain("MERGE", text, StringComparison.OrdinalIgnoreCase);
    Assert.Equal(AtomicityRequirement.Required, plan.Atomicity);
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~SqlServerCompilerTests --nologo
~~~

Expected: FAIL because SqlServerCompiler does not exist.

- [ ] **Step 3: Implement SQL Server rendering**

Render bracket-quoted segmented identifiers, @pN parameters, TOP for single-row legacy paths, OFFSET/FETCH for stable pagination, OUTPUT for returning semantics, SQL Server logical types, sys-catalog metadata, and a required-transaction Upsert plan using an update with UPDLOCK and SERIALIZABLE followed by conditional insert.

- [ ] **Step 4: Run and verify GREEN**

Run the focused command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/Dialects/SqlServer Microi.Server/Dos.ORM.Tests/Dialects/SqlServerCompilerTests.cs
git commit -m "feat: compile SQL AST for SQL Server"
~~~

### Task 6: Implement Oracle and DM8 as separate compatibility profiles

**Files:**
- Create: Microi.Server/Dos.ORM/Dialects/Oracle/OracleCompiler.cs
- Create: Microi.Server/Dos.ORM/Dialects/Oracle/OracleTypeMapper.cs
- Create: Microi.Server/Dos.ORM/Dialects/Dm8/Dm8Compiler.cs
- Create: Microi.Server/Dos.ORM/Dialects/Dm8/Dm8TypeMapper.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/OracleCompilerTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/Dm8CompilerTests.cs

**Interfaces:**
- Produces: Oracle 11g/19c and DM8 Oracle-mode plans.

- [ ] **Step 1: Write separate failing pagination tests**

~~~csharp
[Fact]
public void Oracle11g_lowers_paging_before_final_ordering_boundary()
{
    var step = PlanAssert.SingleSql(Compilers.Oracle11g.Compile(
        AstSamples.PagedUsers(), TestOptions.Oracle11g));
    Assert.Contains("ROWNUM", step.CommandText);
    Assert.DoesNotContain("ORDER BY Id AND ROWNUM", step.CommandText);
}

[Fact]
public void Dm8_uses_its_own_profile_and_colon_parameters()
{
    var step = PlanAssert.SingleSql(Compilers.Dm8.Compile(
        AstSamples.UserById(), TestOptions.Dm8));
    Assert.Contains(":p0", step.CommandText);
    Assert.Equal(DatabaseType.DaMeng, TestOptions.Dm8.Profile.DatabaseType);
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter "FullyQualifiedName~OracleCompilerTests|FullyQualifiedName~Dm8CompilerTests" --nologo
~~~

Expected: FAIL because Oracle and DM8 compilers do not exist.

- [ ] **Step 3: Implement Oracle-family rendering**

Oracle 11g lowers pagination to nested ROWNUM queries; Oracle 19c uses OFFSET/FETCH when the profile supports it. Both use :pN parameters, sequences/identity profile capabilities, Oracle-style MERGE for semantic Upsert, ALL_TAB_COLUMNS metadata, and correct empty-string-as-NULL validation. DM8 has its own compiler and type mapper with independently declared supported syntax.

- [ ] **Step 4: Run and verify GREEN**

Run the focused command from Step 2. Expected: both suites PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/Dialects/Oracle Microi.Server/Dos.ORM/Dialects/Dm8 Microi.Server/Dos.ORM.Tests/Dialects
git commit -m "feat: compile AST for Oracle and DM8"
~~~

### Task 7: Complete cross-dialect functions, DML, Bulk fallback, DDL, metadata, admin, and diagnostics

**Files:**
- Create: Microi.Server/Dos.ORM.Tests/Dialects/FunctionCompilerContractTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/DmlCompilerContractTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/BulkCompilerContractTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/SchemaCompilerContractTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/MetadataAdminContractTests.cs
- Modify: all six compiler/type/schema files created in Tasks 3-6

**Interfaces:**
- Produces: complete compiler coverage for every platform-owned AST operation.

- [ ] **Step 1: Write the six-dialect contract matrix**

~~~csharp
[Theory]
[MemberData(nameof(DialectCases.AllCertified))]
public void Every_dialect_compiles_all_required_semantic_operations(
    CertifiedDialectCase dialect)
{
    PlanAssert.Parameterized(dialect.Compile(AstSamples.FunctionQuery()));
    PlanAssert.Parameterized(dialect.Compile(AstSamples.InsertUser()));
    PlanAssert.Parameterized(dialect.Compile(AstSamples.UpdateUser()));
    PlanAssert.Parameterized(dialect.Compile(AstSamples.DeleteUser()));
    PlanAssert.HasPlan(dialect.Compile(AstSamples.UpsertUser()));
    PlanAssert.HasPlan(dialect.Compile(AstSamples.CreateContractTable()));
    PlanAssert.HasPlan(dialect.Compile(AstSamples.TableMetadataQuery()));
    PlanAssert.HasPlan(dialect.Compile(AstSamples.DatabaseDiagnostics()));
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter "FullyQualifiedName~FunctionCompilerContractTests|FullyQualifiedName~DmlCompilerContractTests|FullyQualifiedName~BulkCompilerContractTests|FullyQualifiedName~SchemaCompilerContractTests|FullyQualifiedName~MetadataAdminContractTests" --nologo
~~~

Expected: FAIL for every not-yet-rendered semantic operation.

- [ ] **Step 3: Complete only the failing semantic mappings**

Add Concat, Substring, Length, CurrentDateTime, DateAdd, DateDiff, Coalesce, Round, JsonValue, aggregates, Boolean, NULL ordering, returning semantics, parameter-limit batching, create/alter/drop schema operations, metadata DTO queries, database create/drop, and diagnostics. If a profile cannot preserve semantics, throw UnsupportedDatabaseCapabilityException rather than emit guessed SQL.

- [ ] **Step 4: Run focused and total regression**

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --nologo
dotnet build .\Dos.ORM\Dos.ORM.csproj -c Release --nologo
dotnet build .\Microi.net.sln --no-restore --nologo
~~~

Expected: all compiler contracts PASS; builds have 0 errors.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/Dialects Microi.Server/Dos.ORM/Platform Microi.Server/Dos.ORM.Tests
git commit -m "feat: complete six-dialect SQL compilation"
~~~

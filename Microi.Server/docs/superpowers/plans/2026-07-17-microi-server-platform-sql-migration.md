# Microi.Server Platform SQL Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Remove all framework-owned database branching, provider references, and dialect SQL from Microi.Server projects by expressing operations through Dos.ORM AST and platform capabilities.

**Architecture:** A Roslyn-backed physical-source inventory guards the boundary, including ignored Microi.net and Microi.AI directories. Modules migrate in dependency order: configuration, FormEngine, DataSource, MCP, AI, upgrades, tenant lifecycle, and diagnostics; the findings baseline only decreases and is empty at completion.

**Tech Stack:** .NET 10 xUnit architecture/integration tests, Roslyn, Dos.ORM AST, existing netstandard2.1 Microi projects.

## Global Constraints

- All database compatibility behavior lives in Dos.ORM.
- Microi.Server outside Dos.ORM may read, store, display, validate, and pass DatabaseType configuration, but may not branch database behavior.
- Framework-owned SQL outside Dos.ORM is forbidden.
- Specific provider types outside Dos.ORM are forbidden.
- V8.Db.FromSql and DataSource user SQL remain opaque, are marked UserProvided, and are never translated.
- Native SQL is constructed from the session's exact detected DialectProfile and execution rechecks database type, Major, Minor, Build, Revision, and ordinal compatibility mode before creating a command; DatabaseType-only checks are forbidden.
- Public platform preview code may receive an immutable DatabaseExecutionPlan
  only from PreviewMigration/PreviewAdmin for review and approval minting.
  Execution resubmits the exact source, values, requested atomicity, and the
  distinct compiled approval overload; no platform execution/materialization
  method accepts a plan, materializer, raw command list, or execution ticket.
- Microi.Server outside Dos.ORM never references the public legacy
  CommandCreator/Create*Command mutable-command escape hatch; all migrated
  framework paths use managed source execution.
- NL2SQL default output is PortableQueryDocument converted to SelectStatement; legacy generated SQL is not part of portability certification and is zero on the final default path.
- Platform initialization and upgrades are AST-only with stable migration IDs and no vendor-script exception.
- Migration/admin execution requires the current Task 6 neutral/admin gate, exact source fingerprint, Task 7 compiled-impact gate, exact SchemaToken and compiled fingerprint; Required also uses one reference-identical live connection/transaction scope validated before any command is created.
- Elevated migration/admin flow is exact: preview current live options,
  externally authorize the current operator and preview, mint audit-only
  CompiledImpactApproval, execute from original source, deterministically
  recompile current live options, reauthorize, attach, and complete preflight.
  The preview plan is never execution input and approval is never a credential.
- Platform architecture tests first run the immutable complete-Dos.ORM pre-
  managed-delta public/protected baseline captured after legacy-adapter Task 1
  and before Task 2 production/API edits, plus the exact-delta gate. They scan
  every public/protected signature in the touched platform production inventory
  and each reachable Microi-owned request type with cycle detection; discovery
  never depends only on method names or a call graph. Direct, array, generic,
  wrapper, object/dynamic, open-generic, delegate, dictionary, static-executor,
  command, ticket, materializer, coordinator, and raw-context escapes all fail.
  `System.Object` stops only a user DTO's base chain, never a payload slot.
- Upgrade failure never advances ServerVersion.
- Ignored Microi.net and Microi.AI files are part of the physical scan and are force-added individually when committed.
- No test or log prints passwords, tokens, connection strings, or runtime parameter values.

---

### Task 1: Add the physical inventory and five architecture rules

**Files:**
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Microi.DatabaseArchitecture.Tests.csproj
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Infrastructure/PhysicalSourceInventory.cs
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Infrastructure/ArchitectureFinding.cs
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Rules/DatabaseBranchRule.cs
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Rules/PlatformSqlBoundaryRule.cs
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Rules/ProviderReferenceRule.cs
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Rules/SqlOriginRule.cs
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Rules/LegacyCommandCreatorRule.cs
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Baselines/database-findings.json
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/ArchitectureGateTests.cs
- Modify: Microi.Server/Microi.net.sln

**Interfaces:**
- Produces: MICROI_DB001, MICROI_DB002, MICROI_DB003, MICROI_DB004,
  MICROI_DB005 findings and a shrink-only baseline.

- [ ] **Step 1: Create the Roslyn test project**

~~~xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <IsTestProject>true</IsTestProject>
    <IsPackable>false</IsPackable>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.1" />
    <PackageReference Include="xunit" Version="2.9.3" />
    <PackageReference Include="xunit.runner.visualstudio" Version="3.1.4" />
    <PackageReference Include="Microsoft.CodeAnalysis.CSharp.Workspaces" Version="4.14.0" />
    <PackageReference Include="Microsoft.Build.Locator" Version="1.7.8" />
  </ItemGroup>
</Project>
~~~

- [ ] **Step 2: Write failing inventory coverage tests**

~~~csharp
[Fact]
public void Inventory_includes_ignored_runtime_projects()
{
    var files = PhysicalSourceInventory.Discover(Repository.Root);
    Assert.Contains(files, path =>
        path.EndsWith("Microi.Server/Microi.net/Common/TenantProvisioningService.cs",
            StringComparison.OrdinalIgnoreCase));
    Assert.Contains(files, path =>
        path.EndsWith("Microi.Server/Microi.AI/MicroiAI.cs",
            StringComparison.OrdinalIgnoreCase));
    Assert.DoesNotContain(files, path =>
        path.Contains("/bin/") || path.Contains("/obj/"));
}

[Fact]
public void Platform_source_cannot_reference_legacy_CommandCreator()
{
    const string source = """
        namespace Microi.Core;
        internal sealed class BadPath
        {
            private readonly Dos.ORM.CommandCreator creator;
        }
        """;

    var finding = ArchitectureRuleHarness.SingleFinding(
        new LegacyCommandCreatorRule(), source,
        "Microi.Server/Microi.Core/BadPath.cs");

    Assert.Equal("MICROI_DB005", finding.Rule);
}
~~~

- [ ] **Step 3: Run and verify RED**

~~~powershell
dotnet test .\tests\Microi.DatabaseArchitecture.Tests\Microi.DatabaseArchitecture.Tests.csproj --filter "FullyQualifiedName~Inventory_includes_ignored_runtime_projects|FullyQualifiedName~Platform_source_cannot_reference_legacy_CommandCreator" --nologo
~~~

Expected: FAIL because PhysicalSourceInventory and
LegacyCommandCreatorRule do not exist.

- [ ] **Step 4: Implement physical enumeration and semantic findings**

~~~csharp
public static IReadOnlyList<string> Discover(string repositoryRoot)
{
    return Directory.EnumerateFiles(
            Path.Combine(repositoryRoot, "Microi.Server"),
            "*.cs", SearchOption.AllDirectories)
        .Where(path => !PathSegments.Contains(path, "bin") &&
                       !PathSegments.Contains(path, "obj") &&
                       !path.EndsWith(".g.cs", StringComparison.OrdinalIgnoreCase))
        .OrderBy(path => path, StringComparer.OrdinalIgnoreCase)
        .ToArray();
}
~~~

DB001 detects database-type conditions affecting SQL/ADO/DDL/connection/execution.
DB002 follows string construction into execution calls and detects vendor
syntax. DB003 detects concrete provider symbols. DB004 detects raw SQL
execution without NativeSqlText origin. DB005 uses Roslyn symbol identity to
reject any `Dos.ORM.CommandCreator` type, constructor, or `Create*Command`
reference in Microi.Server production sources outside
`Microi.Server/Dos.ORM`; test projects that verify the boundary are not
production findings, while spelling aliases and fully qualified names do not
evade it. Baseline entries contain rule, relative path, syntax
fingerprint, and behavior fingerprint; tests fail on additions or
changed-location evasion. DB005 has no baseline exception at final migration.

- [ ] **Step 5: Capture the audited initial baseline and commit**

Run all architecture tests, write only confirmed current findings, then:

~~~powershell
git add Microi.Server/tests/Microi.DatabaseArchitecture.Tests Microi.Server/Microi.net.sln
git commit -m "test: enforce database compatibility boundary"
~~~

### Task 2: Centralize database configuration and session creation

**Files:**
- Modify: Microi.Server/Microi.Core/ORM/MicroiORMExtensions.cs
- Modify: Microi.Server/Microi.Core/MicroiEngine.cs
- Modify: Microi.Server/Microi.Core/SaaSEngine/OsClient.cs
- Modify: Microi.Server/Microi.net/Common/OsClient.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/CertifiedPlatforms.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/MicroiOrmTestHost.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/TestConnections.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/VendorSqlTokens.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/SessionCreationContractTests.cs
- Modify: Microi.Server/Microi.net.sln

**Interfaces:**
- Consumes: DatabasePlatformRegistry and ProviderFactory.
- Produces: one Dos.ORM session creation path with no business-layer database switch.

- [ ] **Step 1: Write a failing six-type session creation contract**

~~~csharp
[Theory]
[InlineData(DatabaseType.MySql)]
[InlineData(DatabaseType.SqlServer)]
[InlineData(DatabaseType.Oracle)]
[InlineData(DatabaseType.PostgreSql)]
[InlineData(DatabaseType.DaMeng)]
[InlineData(DatabaseType.KingBase)]
public void Microi_session_creation_delegates_to_registered_platform(
    DatabaseType type)
{
    var session = MicroiOrmTestHost.CreateSession(type,
        TestConnections.NonConnectingPlaceholder(type));
    Assert.Equal(type, session.DbProvider.Platform.Type);
}
~~~

- [ ] **Step 2: Run and verify RED**

Run SessionCreationContractTests. Expected: PostgreSQL, DM8, or Kingbase paths expose fallback or business switches.

- [ ] **Step 3: Remove business-layer provider selection**

MicroiORMExtensions keeps DI, logging, and localization only. MicroiEngine.ORM and both OsClient classes pass DatabaseType and connection configuration to Dos.ORM; MySQL connection-string repair moves to MySql IConnectionPolicy.

- [ ] **Step 4: Run focused tests, architecture tests, and builds**

~~~powershell
dotnet test .\tests\Microi.Server.IntegrationTests\Microi.Server.IntegrationTests.csproj --filter FullyQualifiedName~SessionCreationContractTests --nologo
dotnet test .\tests\Microi.DatabaseArchitecture.Tests\Microi.DatabaseArchitecture.Tests.csproj --nologo
dotnet build .\Microi.Core\Microi.Core.csproj --nologo
dotnet build .\Microi.net\Microi.net.csproj --nologo
~~~

Expected: focused tests pass and affected DB001/DB003 findings disappear.

- [ ] **Step 5: Commit tracked and ignored files explicitly**

~~~powershell
git add Microi.Server/Microi.Core Microi.Server/tests Microi.Server/Microi.net.sln
git add -f Microi.Server/Microi.net/Common/OsClient.cs
git commit -m "refactor: centralize Microi database session creation"
~~~

### Task 3: Migrate FormEngine reads, language, and permission queries

**Files:**
- Modify: Microi.Server/Microi.Core/FormEngine/FormEngine.cs
- Modify: Microi.Server/Microi.Core/FormEngine/FormEngineLang.cs
- Modify: Microi.Server/Microi.Core/Logic/SysRoleLimitLogic.cs
- Modify: Microi.Server/Microi.net/FormEngine/FormEngineGet.cs
- Modify: Microi.Server/Microi.net/FormEngine/FormEngineGetTableData.cs
- Modify: Microi.Server/Microi.net/FormEngine/FormEngineTreeLazyHelper.cs
- Modify: Microi.Server/Microi.net/FormEngine/FormEngineCommon.cs
- Modify: Microi.Server/Microi.net/FormEngine/Where.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/FormEngineHarness.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/FormEngineReadContractTests.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/FormEngineLangContractTests.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/PermissionContractTests.cs

**Interfaces:**
- Produces: AST-backed dynamic select, join, filter, aggregate, sorting, paging, language fallback, and permission queries.

- [ ] **Step 1: Write failing AST capture contracts**

~~~csharp
[Theory]
[MemberData(nameof(CertifiedPlatforms.All))]
public async Task FormEngine_query_contract_has_no_vendor_sql(
    DatabasePlatformDescriptor platform)
{
    var capture = await FormEngineHarness.BuildListQueryAsync(platform,
        table: "Sys_User",
        where: new[] { new object[] { "Status", "=", 1 } },
        pageIndex: 2, pageSize: 20);
    Assert.IsType<SelectStatement>(capture.Statement);
    Assert.DoesNotContain(capture.PlatformSourceFiles,
        text => VendorSqlTokens.ContainsAny(text));
}
~~~

- [ ] **Step 2: Run and verify RED**

Run the three focused suites. Expected: failures identify LIMIT, TOP, IFNULL, metadata SQL, quotes, or database branches.

- [ ] **Step 3: Replace query strings with AST builders**

Map validated table/field metadata to SqlObjectName and SqlIdentifier. Map existing Where conditions to SqlExpression, selection to SelectProjection, statistics to AggregateExpression, and paging to PageSpec. Language fallback uses Coalesce semantic function; role limits use Select/Exists/Upsert semantics from Dos.ORM.

- [ ] **Step 4: Verify focused tests, architecture shrinkage, and explicit ignored-project build**

Run both test projects plus Microi.Core and Microi.net builds. Expected: affected DB001/DB002 findings are removed.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Microi.Core Microi.Server/tests
git add -f Microi.Server/Microi.net/FormEngine/FormEngineGet.cs Microi.Server/Microi.net/FormEngine/FormEngineGetTableData.cs Microi.Server/Microi.net/FormEngine/FormEngineTreeLazyHelper.cs Microi.Server/Microi.net/FormEngine/FormEngineCommon.cs Microi.Server/Microi.net/FormEngine/Where.cs
git commit -m "refactor: migrate FormEngine reads to SQL AST"
~~~

### Task 4: Migrate FormEngine writes, field DDL, imports, and exports

**Files:**
- Modify: Microi.Server/Microi.net/FormEngine/FormEngineAdd.cs
- Modify: Microi.Server/Microi.net/FormEngine/FormEngineAddHelper.cs
- Modify: Microi.Server/Microi.net/FormEngine/FormEngineUpt.cs
- Modify: Microi.Server/Microi.net/FormEngine/FormEngineDel.cs
- Modify: Microi.Server/Microi.net/FormEngine/FormEngineField.cs
- Modify: Microi.Server/Microi.net/FormEngine/FormEngineTable.cs
- Modify: Microi.Server/Microi.net/FormEngine/FormEngineImport.cs
- Modify: Microi.Server/Microi.net/FormEngine/FormEngineExport.cs
- Modify: Microi.Server/Microi.net/FormEngine/FormEngineSqlDebugHelper.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/FormEngineWriteContractTests.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/FormEngineSchemaContractTests.cs

**Interfaces:**
- Produces: DML AST write plans and SchemaOperation plans that preserve current FormEngine transactions and V8 hooks.

- [ ] **Step 1: Write failing write and schema capture tests**

~~~csharp
[Theory]
[MemberData(nameof(CertifiedPlatforms.All))]
public async Task Add_update_delete_share_the_caller_transaction(
    DatabasePlatformDescriptor platform)
{
    var capture = await FormEngineHarness.CaptureCrudCycleAsync(platform);
    Assert.All(capture.MaterializedCommands,
        command => Assert.Same(capture.Transaction, command.Transaction));
    Assert.Collection(capture.Statements,
        statement => Assert.IsType<InsertStatement>(statement),
        statement => Assert.IsType<UpdateStatement>(statement),
        statement => Assert.IsType<DeleteStatement>(statement));
}
~~~

- [ ] **Step 2: Run and verify RED**

Expected: Oracle branches, string DML, or DDL service branches fail the contract.

- [ ] **Step 3: Replace write and DDL construction**

Preserve V8 before/after event order. Build ParameterBag from validated form values, use guarded Update/Delete, call SchemaOperation for field/table changes, and keep import/export data streaming independent from database syntax.

- [ ] **Step 4: Verify and build**

Run focused tests, architecture tests, Microi.net build, and Microi.net.Api build to .tmp/build/platform-sql-api. Expected: PASS and reduced findings.

- [ ] **Step 5: Commit ignored files explicitly**

~~~powershell
git add Microi.Server/tests
git add -f Microi.Server/Microi.net/FormEngine
git commit -m "refactor: migrate FormEngine writes and schema to AST"
~~~

### Task 5: Mark DataSource and V8 raw SQL boundaries without translating them

**Files:**
- Modify: Microi.Server/Microi.net/DataSourceEngine/DataSourceEngine.cs
- Modify: Microi.Server/Microi.Core/V8Engine/V8McpLogic.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/DataSourceHarness.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/DataSourceBoundaryTests.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/NativeSqlBoundaryTests.cs

**Interfaces:**
- Produces: FromNativeSql(NativeSqlText.UserProvided) call sites with the session's exact detected target profile, command kind, definitions, and invocation values.

- [ ] **Step 1: Write failing passthrough tests**

~~~csharp
[Fact]
public void User_sql_is_passed_unchanged_with_explicit_origin()
{
    const string sql = "select vendor_only_function(:p0)";
    var profile = new DialectProfile(
        DatabaseType.Oracle, new Version(19, 22, 0, 0), string.Empty);
    var capture = DataSourceHarness.Capture(sql, profile);
    Assert.Equal(sql, capture.NativeSql.Text);
    Assert.Equal(SqlSafetyOrigin.UserProvided, capture.NativeSql.Origin);
    Assert.Same(profile, capture.NativeSql.TargetProfile);
    Assert.Equal(DatabaseType.Oracle, capture.NativeSql.TargetDatabase);
}

[Theory]
[InlineData(NativeProfileMismatch.DatabaseType)]
[InlineData(NativeProfileMismatch.Major)]
[InlineData(NativeProfileMismatch.Minor)]
[InlineData(NativeProfileMismatch.Build)]
[InlineData(NativeProfileMismatch.Revision)]
[InlineData(NativeProfileMismatch.CompatibilityModeCase)]
[InlineData(NativeProfileMismatch.CompatibilityModeText)]
public void Any_native_profile_mismatch_starts_no_command(
    NativeProfileMismatch mismatch)
{
    var capture = DataSourceHarness.ProfileMismatch(mismatch);
    Assert.Throws<InvalidOperationException>(() => capture.Execute());
    Assert.Equal(0, capture.Driver.CreateCommandCalls);
    Assert.Equal(0, capture.Driver.ExecuteCalls);
}
~~~

- [ ] **Step 2: Run and verify RED**

Expected: old FromSql(string) path has no origin.

- [ ] **Step 3: Wrap only user-owned SQL**

DataSource read paths obtain the canonical detected profile from the active
Dos.ORM session, declare NativeSqlCommandKind.Read, and use a read-only account
or transaction. V8 preserves read/write capability according to its current
authorization, declares command kind, and binds definitions/values through
the typed native source API. The internal executor re-detects and compares
type plus all four version components and ordinal mode before command creation.
Do not construct a profile from DatabaseType alone, expose a compiled plan, or
add regex translation/security claims.

- [ ] **Step 4: Verify tests and DB004 findings**

Expected: boundary tests pass and only explicitly user-owned call sites are exempt from DB004 through semantic origin types.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Microi.Core/V8Engine/V8McpLogic.cs Microi.Server/tests
git add -f Microi.Server/Microi.net/DataSourceEngine/DataSourceEngine.cs
git commit -m "refactor: declare native SQL ownership boundaries"
~~~

### Task 6: Migrate MCP Blueprint, Flow, StateMachine, and ProcessMining

**Files:**
- Modify: Microi.Server/Microi.Core/V8Engine/V8McpLogic.Blueprint.cs
- Modify: Microi.Server/Microi.Core/V8Engine/V8McpLogic.FlowEngine.cs
- Modify: Microi.Server/Microi.Core/V8Engine/V8McpLogic.StateMachine.cs
- Modify: Microi.Server/Microi.Core/V8Engine/V8McpLogic.ProcessMining.cs
- Delete: Microi.Server/Microi.Core/Resource/business-blueprint-tables.sql
- Delete: Microi.Server/Microi.Core/Resource/flow-engine-tables.sql
- Delete: Microi.Server/Microi.Core/Resource/state-machine-tables.sql
- Create: Microi.Server/Microi.Core/V8Engine/Schema/McpSchemaDefinitions.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/McpContractTests.cs

**Interfaces:**
- Produces: reusable TableDefinition and data AST definitions for MCP subsystems.

- [ ] **Step 1: Write failing schema/resource tests**

~~~csharp
[Fact]
public void Mcp_schema_has_no_embedded_vendor_sql_resources()
{
    Assert.False(File.Exists(Path.Combine(Repository.Root,
        "Microi.Server/Microi.Core/Resource/flow-engine-tables.sql")));
    Assert.All(McpSchemaDefinitions.All,
        table => Assert.IsType<TableDefinition>(table));
}
~~~

- [ ] **Step 2: Run and verify RED**

Expected: SQL resources exist and definitions do not.

- [ ] **Step 3: Express schema and operations as AST**

Create strongly typed table definitions and idempotent SchemaOperation plans. Convert MCP list, state transition, process aggregation, and flow queries to Select/DML AST. Preserve result DTOs and transaction semantics.

- [ ] **Step 4: Run MCP contracts and architecture tests**

Expected: tests pass and MCP DB002 findings are zero.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Microi.Core Microi.Server/tests
git commit -m "refactor: migrate MCP persistence to SQL AST"
~~~

### Task 7: Migrate AI subscription storage and structured NL2SQL

**Files:**
- Modify: Microi.Server/Microi.AI/SubscriptionService.cs
- Modify: Microi.Server/Microi.AI/MicroiAI.cs
- Delete: Microi.Server/Microi.AI/Resource/subscription-tables.sql
- Create: Microi.Server/Microi.AI/PortableQueryDocument.cs
- Create: Microi.Server/Microi.AI/PortableQueryDocumentValidator.cs
- Create: Microi.Server/Microi.AI/PortableQueryAstConverter.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/AiSubscriptionContractTests.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/PortableQueryDocumentTests.cs

**Interfaces:**
- Produces: AST-backed AI quota/subscription persistence and versioned, read-only structured NL2SQL.

- [ ] **Step 1: Write failing structured-query tests**

~~~csharp
[Fact]
public void Portable_query_rejects_unknown_tables_and_write_operations()
{
    var validator = new PortableQueryDocumentValidator(
        SchemaFixture.For("Sys_User", "Id", "Account"));
    Assert.False(validator.Validate(
        PortableQueryDocument.Select("Missing_Table", "Id")).IsValid);
    Assert.False(validator.Validate(
        PortableQueryDocument.Delete("Sys_User")).IsValid);
}

[Fact]
public void Portable_query_converts_to_select_ast()
{
    var document = PortableQueryDocument.Select(
        "Sys_User", "Id", "Account");
    Assert.IsType<SelectStatement>(
        new PortableQueryAstConverter().Convert(document));
}
~~~

- [ ] **Step 2: Run and verify RED**

Expected: document types do not exist and existing prompt asks for MySQL SQL.

- [ ] **Step 3: Replace AI-owned SQL paths**

Subscription schema is TableDefinition; quota locking and logging use Select/Update/Insert AST. NL2SQL asks the model for versioned PortableQueryDocument JSON, validates tables, columns, operators, maximum rows, and read-only shape, converts to SelectStatement, then compiles through the current platform. LegacyAiGenerated remains disabled by default and its final default-path counter is zero.

- [ ] **Step 4: Verify AI tests, architecture tests, and ignored project build**

~~~powershell
dotnet test .\tests\Microi.Server.IntegrationTests\Microi.Server.IntegrationTests.csproj --filter "FullyQualifiedName~AiSubscriptionContractTests|FullyQualifiedName~PortableQueryDocumentTests" --nologo
dotnet test .\tests\Microi.DatabaseArchitecture.Tests\Microi.DatabaseArchitecture.Tests.csproj --nologo
dotnet build .\Microi.AI\Microi.AI.csproj --nologo
~~~

Expected: PASS and AI DB001/DB002 findings are zero.

- [ ] **Step 5: Commit ignored AI files explicitly**

~~~powershell
git add Microi.Server/tests
git add -f Microi.Server/Microi.AI/SubscriptionService.cs Microi.Server/Microi.AI/MicroiAI.cs Microi.Server/Microi.AI/PortableQueryDocument.cs Microi.Server/Microi.AI/PortableQueryDocumentValidator.cs Microi.Server/Microi.AI/PortableQueryAstConverter.cs
git add -f -u Microi.Server/Microi.AI/Resource/subscription-tables.sql
git commit -m "refactor: migrate AI storage and NL2SQL to AST"
~~~

### Task 8: Convert upgrades and resources to idempotent AST migrations

**Files:**
- Modify: Microi.Server/Microi.Upgrade/Upgrade.cs
- Modify: Microi.Server/Microi.Upgrade/MicroiUpgradeExtensions.cs
- Modify: Microi.Server/Microi.Upgrade/1-UpgradeAppDisplay.cs
- Modify: Microi.Server/Microi.Upgrade/2-UpgradeSysConfig.cs
- Modify: Microi.Server/Microi.Upgrade/3-UpgradeLang.cs
- Modify: Microi.Server/Microi.Upgrade/5-UpgradeApiEngine.cs
- Modify: Microi.Server/Microi.Upgrade/13-UpgradeAppStore.cs
- Modify: Microi.Server/Microi.Upgrade/Resource/app.microi.store.json
- Modify: Microi.Server/Microi.Upgrade/Resource/app.microi.module-engine.json
- Modify: Microi.Server/Microi.Upgrade/Resource/app.microi.form-engine.json
- Create: Microi.Server/Microi.Upgrade/Migrations/MicroiMigrationCatalog.cs
- Create: Microi.Server/Microi.Upgrade/Migrations/UpgradeSqlExecutionAuthorizer.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/UpgradeHarness.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/PlatformProductionSurfaceInventory.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/PlatformManagedExecutionSurfaceAssert.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Lifecycle/UpgradeIdempotencyTests.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Lifecycle/UpgradeFailureTests.cs

**Interfaces:**
- Consumes: the active session's exact `DialectProfile`, current `SchemaToken`,
  neutral Task 6 approval, `ISqlCompiler.CompileMigration`, and the
  current bootstrap/operator authorization context.
- Produces: stable migration IDs, `MigrationPlan`, `SchemaOperation`, typed
  data rows, a review-only preview plan, an audit-only compiled approval, and
  version advancement only after successful source-based validated execution.

- [ ] **Step 1: Write failing repeat/failure tests**

~~~csharp
[Fact]
public async Task Upgrade_is_idempotent_and_failure_does_not_advance_version()
{
    var first = await UpgradeHarness.RunAsync(failAtMigration: null);
    var second = await UpgradeHarness.RunAsync(failAtMigration: null);
    Assert.Equal(first.SchemaFingerprint, second.SchemaFingerprint);

    var failed = await UpgradeHarness.RunAsync(
        failAtMigration: "microi.appstore.schema.v2");
    Assert.False(failed.VersionAdvanced);
}

[Theory]
[InlineData(UpgradePreflightFailure.ProfileType)]
[InlineData(UpgradePreflightFailure.ProfileMajor)]
[InlineData(UpgradePreflightFailure.ProfileMinor)]
[InlineData(UpgradePreflightFailure.ProfileBuild)]
[InlineData(UpgradePreflightFailure.ProfileRevision)]
[InlineData(UpgradePreflightFailure.CompatibilityMode)]
[InlineData(UpgradePreflightFailure.Route)]
[InlineData(UpgradePreflightFailure.Enlistment)]
[InlineData(UpgradePreflightFailure.SourceFingerprint)]
[InlineData(UpgradePreflightFailure.NeutralGate)]
[InlineData(UpgradePreflightFailure.CompiledImpactGate)]
[InlineData(UpgradePreflightFailure.SchemaToken)]
[InlineData(UpgradePreflightFailure.CompiledFingerprint)]
[InlineData(UpgradePreflightFailure.RequiredConnectionScope)]
[InlineData(UpgradePreflightFailure.RequiredTransactionScope)]
public async Task Upgrade_preflight_failure_creates_no_command_and_does_not_advance_version(
    UpgradePreflightFailure failure)
{
    var failed = await UpgradeHarness.RunPreflightFailureAsync(failure);
    Assert.Equal(0, failed.Driver.CreateCommandCalls);
    Assert.Equal(0, failed.Driver.ExecuteCalls);
    Assert.False(failed.VersionAdvanced);
}

[Fact]
public async Task Elevated_upgrade_previews_authorizes_and_executes_from_source()
{
    var capture = UpgradeHarness.ElevatedMigration();
    var preview = await capture.PreviewAsync();
    Assert.True(preview.RequiresEffectiveImpactApproval);
    Assert.Equal(0, capture.Driver.CreateCommandCalls);

    capture.ExternalAuthorization.Authorize(preview);
    var approval = preview.CreateEffectiveImpactApproval(
        new ApprovalReference("upgrade-review-5"));
    var result = await capture.ExecuteSourceAsync(approval);

    Assert.True(result.VersionAdvanced);
    Assert.Equal(1, capture.ExecutionAuthorizer.DemandCalls);
}

[Theory]
[InlineData(UpgradeApprovalFailure.Missing)]
[InlineData(UpgradeApprovalFailure.ForeignSource)]
[InlineData(UpgradeApprovalFailure.SourceMutation)]
[InlineData(UpgradeApprovalFailure.StalePreviewPlan)]
[InlineData(UpgradeApprovalFailure.LiveProfile)]
[InlineData(UpgradeApprovalFailure.SchemaToken)]
[InlineData(UpgradeApprovalFailure.RequestedAtomicity)]
[InlineData(UpgradeApprovalFailure.CompiledFingerprint)]
[InlineData(UpgradeApprovalFailure.DeniedCurrentAuthorization)]
[InlineData(UpgradeApprovalFailure.ClosedNeutralGate)]
[InlineData(UpgradeApprovalFailure.NeedlessApproval)]
[InlineData(UpgradeApprovalFailure.NeedlessForeignApproval)]
public async Task Invalid_upgrade_approval_handoff_creates_no_command_or_version(
    UpgradeApprovalFailure failure)
{
    var result = await UpgradeHarness.RunApprovalFailureAsync(failure);
    Assert.Equal(0, result.Driver.CreateCommandCalls);
    Assert.Equal(0, result.Driver.ExecuteCalls);
    Assert.False(result.VersionAdvanced);
}

[Fact]
public void Upgrade_managed_execution_graph_has_no_escape_shape()
{
    PlatformManagedExecutionSurfaceAssert.AssertClosedPlatformInventory(
        PlatformProductionSurfaceInventory.Load(Repository.Root));
}

[Fact]
public async Task Exact_upgrade_approval_can_be_reused_for_deterministic_retry()
{
    var capture = UpgradeHarness.ExactRetry();
    var preview = await capture.PreviewAsync();
    capture.ExternalAuthorization.Authorize(preview);
    var approval = preview.CreateEffectiveImpactApproval(
        new ApprovalReference("upgrade-retry-8"));

    var first = await capture.ExecuteSourceAsync(approval);
    var retry = await capture.RetrySourceAsync(approval);

    Assert.True(first.VersionAdvanced);
    Assert.True(retry.AlreadyApplied || retry.VersionAdvanced);
}
~~~

`PlatformProductionSurfaceInventory` loads the production projects from
`Microi.net.sln` through Roslyn and overlays the ignored Microi.net/Microi.AI
physical files already enumerated by Task 1; it excludes test projects,
`bin`/`obj`, and generated sources. `AssertClosedPlatformInventory` treats
every public/protected method, constructor, field,
property/indexer, event/delegate, nested type, interface/base edge, operator,
conversion, accessor, and extension method signature in the touched platform
assemblies/files as a root. It does not require a managed-method call and does
not filter by `Execute*`, `Preview*`, `Materialize*`, or `Create*Command` names,
so an arbitrarily named wrapper is visible.

Starting from every signature it uses a visited set; strips arrays, by-ref,
pointers, nullable, and closed generics; recurses generic arguments, non-object
base types/interfaces, instance fields/properties, events/delegates, public
constructors, and public static factories of reachable Microi-owned request
types. Microi-owned means the assembly/file inventory under test or the
explicit mutation-fixture assembly; BCL containers contribute generic
arguments but their implementation members are not scanned. Exact
`System.Object` stops only the base edge of an already accepted user DTO;
`object`/`dynamic` in every root/member/generic/constructor/factory payload slot
is rejected.

The walker rejects plans, tickets, materializers, coordinators, commands/
command containers, raw connection/transaction contexts, open generics,
untyped dictionaries, and delegates. Exact source/value/atomicity/approval
types are leaves; exact return leaves are `void`, `int`, `SqlSection`,
`MigrationResult`, and `DatabaseAdminResult`. `DatabaseExecutionPlan` is a leaf
only as the direct return of the two exact Dos.ORM session previews, never a
platform signature. Platform implementation code may hold that review value
locally but no platform public/protected root accepts, returns, or wraps it.

Apply and restore mutation REDs for
`DatabaseExecutionPlan[]`, `List<DatabaseExecutionPlan>`, a request whose
field/property/constructor contains a plan, `ExecuteUpgrade(object request)`,
`ExecuteUpgrade<TRequest>(TRequest request)`, a public static executor, and a
command-returning executor. Also add an arbitrarily named public wrapper that
does not call a managed method. Every mutation must fail this inventory/type-
graph test before any driver command is created; a harmless approved-leaf DTO
whose base terminates at `System.Object` remains GREEN.

- [ ] **Step 2: Run and verify RED**

Expected: vendor SQL and premature version advancement fail.

- [ ] **Step 3: Convert every upgrade payload**

Each migration has an immutable ID, expected prior state, AST schema/data steps,
idempotency check, and success marker. Compile it only through
`ISqlCompiler.CompileMigration` with the active session's exact profile and the
explicit atomicity selected by the migration catalog. JSON resources store
neutral data, never executable MySQL SQL.

For provider-elevated impact, the upgrade service calls `PreviewMigration`
with the exact approved Task 6 source and explicit atomicity, externally
authorizes the current bootstrap/operator context plus preview, and mints the
audit-only CompiledImpactApproval. It then calls the distinct source execution
overload with that same source/values/atomicity/approval; it never passes the
preview plan. `UpgradeSqlExecutionAuthorizer` rechecks the current trusted
upgrade context during execution independently of the approval reference and
defaults to denial outside that context.

Before creating the first command, the internal executor revalidates the same
source migration by recompiling exact current live options, attaches the
compiled approval only through `WithEffectiveImpactApproval`, and revalidates
profile fields, schema token, source fingerprint, neutral approval, current
authorization, and compiled fingerprint. Missing, foreign, stale, or needless
approval fails before command creation. A `Required` plan uses
one live connection and one live transaction whose identities match every
step and each other by reference. If the dialect cannot honor that contract,
the catalog must select an explicit `BestEffort` design; execution never
silently downgrades `Required`. DDL implicit-commit profiles use recoverable
step state rather than false transaction claims. Any preflight failure creates
and executes zero commands and leaves the success marker and `ServerVersion`
unchanged.

- [ ] **Step 4: Run all upgrade tests and both managed-surface architecture gates**

Run the Dos.ORM `PublicApiBaselineTests` and `ManagedExecutionSurfaceTests` plus
the platform integration and architecture suites. Expected: immutable complete-
assembly baseline plus exact delta PASS, exact host/interface maps PASS, every
public/protected platform inventory signature recursively closed, repeat
upgrade no-op, injected failure leaves version unchanged, and Upgrade DB002
findings are zero.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Microi.Upgrade Microi.Server/tests
git commit -m "refactor: migrate upgrades to portable AST plans"
~~~

### Task 9: Migrate tenant lifecycle, empty database, diagnostics, and remaining platform SQL

**Files:**
- Modify: Microi.Server/Microi.net/Common/TenantProvisioningService.cs
- Modify: Microi.Server/Microi.net/Common/DbConnectionDiagnostics.cs
- Create: Microi.Server/Microi.net/Common/TenantSqlExecutionAuthorizer.cs
- Modify: Microi.Server/Microi.Core/Services/EmptyDatabaseReleaseService.cs
- Modify: Microi.Server/Microi.net.Api/Controllers/SystemMonitorController.cs
- Modify: Microi.Server/Microi.net.Api/Controllers/OsController.cs
- Modify: Microi.Server/Microi.net.Api/Handler/UEditor/Config.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/TenantHarness.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Lifecycle/TenantLifecycleTests.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Lifecycle/DatabaseDiagnosticsContractTests.cs

**Interfaces:**
- Consumes: `IDatabaseAdmin`, `IDatabaseDiagnostics`, `IConnectionPolicy`,
  Schema and DML AST, the active session's exact `DialectProfile`, and current
  Task 6 approvals/schema token plus authenticated tenant-operator policy.
- Produces: database-neutral create/drop/initialize/clone/import/export and
  unified diagnostics DTOs. Preview may return an immutable plan for external
  review; execution submits source operations or `NativeSqlText` plus
  definitions/values and optional-by-overload compiled approval. No execution
  accepts a plan or exposes a ticket, materializer, or managed command list.

- [ ] **Step 1: Write failing lifecycle and diagnostics contracts**

~~~csharp
[Theory]
[MemberData(nameof(CertifiedPlatforms.All))]
public async Task Tenant_lifecycle_delegates_all_vendor_behavior_to_DosOrm(
    DatabasePlatformDescriptor platform)
{
    var capture = await TenantHarness.RunLifecycleAsync(platform);
    Assert.Collection(capture.Operations,
        operation => Assert.IsType<CreateDatabaseOperation>(operation),
        operation => Assert.IsType<MigrationPlan>(operation),
        operation => Assert.IsType<DatabaseExportOperation>(operation),
        operation => Assert.IsType<DatabaseImportOperation>(operation),
        operation => Assert.IsType<DropDatabaseOperation>(operation));
}

[Theory]
[InlineData(LifecyclePreflightFailure.ProfileType)]
[InlineData(LifecyclePreflightFailure.ProfileMajor)]
[InlineData(LifecyclePreflightFailure.ProfileMinor)]
[InlineData(LifecyclePreflightFailure.ProfileBuild)]
[InlineData(LifecyclePreflightFailure.ProfileRevision)]
[InlineData(LifecyclePreflightFailure.CompatibilityMode)]
[InlineData(LifecyclePreflightFailure.Route)]
[InlineData(LifecyclePreflightFailure.Enlistment)]
[InlineData(LifecyclePreflightFailure.SourceFingerprint)]
[InlineData(LifecyclePreflightFailure.NeutralGate)]
[InlineData(LifecyclePreflightFailure.CompiledImpactGate)]
[InlineData(LifecyclePreflightFailure.SchemaToken)]
[InlineData(LifecyclePreflightFailure.CompiledFingerprint)]
[InlineData(LifecyclePreflightFailure.AdminOperationBinding)]
[InlineData(LifecyclePreflightFailure.RequiredConnectionScope)]
[InlineData(LifecyclePreflightFailure.RequiredTransactionScope)]
public async Task Lifecycle_preflight_failure_starts_no_command(
    LifecyclePreflightFailure failure)
{
    var failed = await TenantHarness.RunPreflightFailureAsync(failure);
    Assert.Equal(0, failed.Driver.CreateCommandCalls);
    Assert.Equal(0, failed.Driver.ExecuteCalls);
}

[Theory]
[InlineData(AdminElevationCase.DropDatabase)]
[InlineData(AdminElevationCase.ReplaceImport)]
public async Task Elevated_lifecycle_admin_uses_preview_approval_and_source_execution(
    AdminElevationCase adminCase)
{
    var capture = TenantHarness.ElevatedAdmin(adminCase);
    var preview = await capture.PreviewAsync();
    capture.ExternalAuthorization.Authorize(preview);
    var approval = preview.CreateEffectiveImpactApproval(
        new ApprovalReference("tenant-admin-11"));

    var result = await capture.ExecuteSourceAsync(approval);

    Assert.Equal(DatabaseAdminOutcome.Applied, result.Outcome);
    Assert.Equal(1, capture.ExecutionAuthorizer.DemandCalls);
    Assert.False(capture.ExecutionAcceptedPreviewPlan);
}

[Theory]
[InlineData(LifecycleApprovalFailure.Missing)]
[InlineData(LifecycleApprovalFailure.ForeignSource)]
[InlineData(LifecycleApprovalFailure.SourceMutation)]
[InlineData(LifecycleApprovalFailure.StalePreviewPlan)]
[InlineData(LifecycleApprovalFailure.LiveProfile)]
[InlineData(LifecycleApprovalFailure.SchemaToken)]
[InlineData(LifecycleApprovalFailure.RequestedAtomicity)]
[InlineData(LifecycleApprovalFailure.CompiledFingerprint)]
[InlineData(LifecycleApprovalFailure.EffectiveImpact)]
[InlineData(LifecycleApprovalFailure.ClosedAdminGate)]
[InlineData(LifecycleApprovalFailure.DeniedCurrentAuthorization)]
[InlineData(LifecycleApprovalFailure.NeedlessApproval)]
[InlineData(LifecycleApprovalFailure.NeedlessForeignApproval)]
public async Task Invalid_lifecycle_approval_handoff_starts_no_command(
    LifecycleApprovalFailure failure)
{
    var failed = await TenantHarness.RunApprovalFailureAsync(failure);
    Assert.Equal(0, failed.Driver.CreateCommandCalls);
    Assert.Equal(0, failed.Driver.ExecuteCalls);
}

[Fact]
public void MicroiServer_framework_never_uses_legacy_CommandCreator()
{
    PlatformSqlArchitectureAssert.NoLegacyCommandCreatorReference(
        Repository.Root, excludeDosOrm: true, productionOnly: true);
}

[Fact]
public void Platform_lifecycle_managed_graph_has_no_escape_shape()
{
    PlatformManagedExecutionSurfaceAssert.AssertClosedPlatformInventory(
        PlatformProductionSurfaceInventory.Load(Repository.Root));
}
~~~

- [ ] **Step 2: Run and verify RED**

Expected: direct MySqlConnection, script, metadata, and database branches fail.

- [ ] **Step 3: Delegate lifecycle and monitoring**

TenantProvisioning and EmptyDatabaseRelease submit neutral source requests only.
For elevated Drop/ReplaceImport, platform code calls `PreviewAdmin`, externally
authorizes the current tenant operator and exact preview, mints the audit-only
compiled approval, then calls the distinct source execution overload with the
same source/values/atomicity/approval. `TenantSqlExecutionAuthorizer` rechecks
the currently authenticated operator, tenant, target, and required permission
during execution; it never treats ApprovalReference or approval possession as
authorization.

The internal coordinator recompiles against the active session's current exact
profile/schema/options, attaches only an exact approval, then revalidates the
source operation, full profile, neutral and effective compiled-impact gates,
current authorization, source/compiled fingerprints, and exhaustive
administrative-operation binding before it creates the first command. Missing,
foreign, stale, or needless approval fails with zero commands. The preview
plan is review data and is never execution input. `Required` lifecycle work
additionally shares one
reference-identical live connection and transaction across every step, with no
partial prefix and no downgrade on mismatch.

User-uploaded SQL imports declare their command kind and pass through
`NativeSqlText.UserProvided`, constructed from that exact profile, without
translation. The executor re-detects all profile fields before creating a
command; a declared source/target database name is not a substitute for that
profile check. SystemMonitor calls `IDatabaseDiagnostics` and returns a common
DTO; errors are explicit rather than converted to zero. Outside the named
preview methods no platform caller receives a compiled plan; no platform path
receives an execution ticket, materializer, or managed command list, and no
Microi.Server framework file uses the legacy public CommandCreator boundary.
The lifecycle architecture test uses the same physical-inventory, all-
public/protected-signatures, cycle-safe graph walker as the upgrade test. It
does not depend on call reachability or method-name prefixes. A nested plan
array/container/request, object payload/open generic/delegate/dictionary
escape, public static executor, command return, or raw connection/transaction
context fails even when the forbidden type is not a direct method parameter;
only a user DTO's terminal `System.Object` base is ignored.

- [ ] **Step 4: Clear the architecture baseline and run all builds**

Remove each migrated fingerprint from database-findings.json. Run Dos.ORM
`PublicApiBaselineTests` plus `ManagedExecutionSurfaceTests`, platform
architecture tests with an empty findings baseline, all server integration
tests, explicit Microi.net/Microi.AI builds, and Microi.net.Api build.

Expected: DB001=0, DB002=0, DB003=0, DB004=0 outside approved typed user
boundaries, and DB005=0 without exception.

- [ ] **Step 5: Commit all remaining exact files**

~~~powershell
git add Microi.Server/Microi.Core Microi.Server/Microi.net.Api Microi.Server/tests
git add -f Microi.Server/Microi.net/Common/TenantProvisioningService.cs Microi.Server/Microi.net/Common/DbConnectionDiagnostics.cs Microi.Server/Microi.net/Common/TenantSqlExecutionAuthorizer.cs
git commit -m "refactor: centralize database lifecycle and diagnostics"
~~~

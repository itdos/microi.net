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
- NL2SQL default output is PortableQueryDocument converted to SelectStatement; legacy generated SQL is not part of portability certification and is zero on the final default path.
- Platform initialization and upgrades are AST-only with stable migration IDs and no vendor-script exception.
- Upgrade failure never advances ServerVersion.
- Ignored Microi.net and Microi.AI files are part of the physical scan and are force-added individually when committed.
- No test or log prints passwords, tokens, connection strings, or runtime parameter values.

---

### Task 1: Add the physical inventory and four architecture rules

**Files:**
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Microi.DatabaseArchitecture.Tests.csproj
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Infrastructure/PhysicalSourceInventory.cs
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Infrastructure/ArchitectureFinding.cs
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Rules/DatabaseBranchRule.cs
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Rules/PlatformSqlBoundaryRule.cs
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Rules/ProviderReferenceRule.cs
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Rules/SqlOriginRule.cs
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Baselines/database-findings.json
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/ArchitectureGateTests.cs
- Modify: Microi.Server/Microi.net.sln

**Interfaces:**
- Produces: MICROI_DB001, MICROI_DB002, MICROI_DB003, MICROI_DB004 findings and a shrink-only baseline.

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
~~~

- [ ] **Step 3: Run and verify RED**

~~~powershell
dotnet test .\tests\Microi.DatabaseArchitecture.Tests\Microi.DatabaseArchitecture.Tests.csproj --filter FullyQualifiedName~Inventory_includes_ignored_runtime_projects --nologo
~~~

Expected: FAIL because PhysicalSourceInventory does not exist.

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

DB001 detects database-type conditions affecting SQL/ADO/DDL/connection/execution. DB002 follows string construction into execution calls and detects vendor syntax. DB003 detects concrete provider symbols. DB004 detects raw SQL execution without NativeSqlText origin. Baseline entries contain rule, relative path, syntax fingerprint, and behavior fingerprint; tests fail on additions or changed-location evasion.

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
- Produces: FromNativeSql(NativeSqlText.UserProvided) call sites with declared target database and command kind.

- [ ] **Step 1: Write failing passthrough tests**

~~~csharp
[Fact]
public void User_sql_is_passed_unchanged_with_explicit_origin()
{
    const string sql = "select vendor_only_function(:p0)";
    var capture = DataSourceHarness.Capture(sql, DatabaseType.Oracle);
    Assert.Equal(sql, capture.NativeSql.Text);
    Assert.Equal(SqlSafetyOrigin.UserProvided, capture.NativeSql.Origin);
    Assert.Equal(DatabaseType.Oracle, capture.NativeSql.TargetDatabase);
}
~~~

- [ ] **Step 2: Run and verify RED**

Expected: old FromSql(string) path has no origin.

- [ ] **Step 3: Wrap only user-owned SQL**

DataSource read paths declare NativeSqlCommandKind.Read and use a read-only account or transaction. V8 preserves read/write capability according to its current authorization, declares command kind, and binds values through existing AddInParameter behavior. Do not add regex translation or regex security claims.

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
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/UpgradeHarness.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Lifecycle/UpgradeIdempotencyTests.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Lifecycle/UpgradeFailureTests.cs

**Interfaces:**
- Produces: stable migration IDs, MigrationPlan, SchemaOperation, typed data rows, and version advancement only after successful completion.

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
~~~

- [ ] **Step 2: Run and verify RED**

Expected: vendor SQL and premature version advancement fail.

- [ ] **Step 3: Convert every upgrade payload**

Each migration has an immutable ID, expected prior state, AST schema/data steps, idempotency check, and success marker. JSON resources store neutral data, never executable MySQL SQL. DDL implicit-commit profiles use recoverable step state rather than false transaction claims.

- [ ] **Step 4: Run all upgrade tests and architecture gate**

Expected: repeat upgrade is a no-op, injected failure leaves version unchanged, and Upgrade DB002 findings are zero.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Microi.Upgrade Microi.Server/tests
git commit -m "refactor: migrate upgrades to portable AST plans"
~~~

### Task 9: Migrate tenant lifecycle, empty database, diagnostics, and remaining platform SQL

**Files:**
- Modify: Microi.Server/Microi.net/Common/TenantProvisioningService.cs
- Modify: Microi.Server/Microi.net/Common/DbConnectionDiagnostics.cs
- Modify: Microi.Server/Microi.Core/Services/EmptyDatabaseReleaseService.cs
- Modify: Microi.Server/Microi.net.Api/Controllers/SystemMonitorController.cs
- Modify: Microi.Server/Microi.net.Api/Controllers/OsController.cs
- Modify: Microi.Server/Microi.net.Api/Handler/UEditor/Config.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/TenantHarness.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Lifecycle/TenantLifecycleTests.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Lifecycle/DatabaseDiagnosticsContractTests.cs

**Interfaces:**
- Consumes: IDatabaseAdmin, IDatabaseDiagnostics, IConnectionPolicy, Schema and DML AST.
- Produces: database-neutral create/drop/initialize/clone/import/export and unified diagnostics DTOs.

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
~~~

- [ ] **Step 2: Run and verify RED**

Expected: direct MySqlConnection, script, metadata, and database branches fail.

- [ ] **Step 3: Delegate lifecycle and monitoring**

TenantProvisioning and EmptyDatabaseRelease submit neutral requests only. User-uploaded SQL imports declare source/target database and pass through NativeSqlText.UserProvided without translation. SystemMonitor calls IDatabaseDiagnostics and returns a common DTO; errors are explicit rather than converted to zero.

- [ ] **Step 4: Clear the architecture baseline and run all builds**

Remove each migrated fingerprint from database-findings.json. Run architecture tests with an empty baseline, all server integration tests, explicit Microi.net/Microi.AI builds, and Microi.net.Api build.

Expected: DB001=0, DB002=0, DB003=0, DB004=0 outside approved typed user boundaries.

- [ ] **Step 5: Commit all remaining exact files**

~~~powershell
git add Microi.Server/Microi.Core Microi.Server/Microi.net.Api Microi.Server/tests
git add -f Microi.Server/Microi.net/Common/TenantProvisioningService.cs Microi.Server/Microi.net/Common/DbConnectionDiagnostics.cs
git commit -m "refactor: centralize database lifecycle and diagnostics"
~~~

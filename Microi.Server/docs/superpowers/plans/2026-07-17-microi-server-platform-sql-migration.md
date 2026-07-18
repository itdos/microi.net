# Microi.Server Platform SQL Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Remove all framework-owned database branching, provider references, and dialect SQL from Microi.Server projects by expressing operations through Dos.ORM AST and platform capabilities.

**Architecture:** A Roslyn-backed physical-source inventory guards the boundary, including the separate private Microi.net and Microi.AI repositories. Modules migrate in dependency order: configuration, FormEngine, DataSource, MCP, AI, upgrades, tenant lifecycle, and diagnostics; the findings baseline only decreases and is empty at completion.

**Tech Stack:** .NET 10 xUnit architecture/integration tests, Roslyn, Dos.ORM AST, existing netstandard2.1 Microi projects.

## Global Constraints

- Every command is run from the workspace root (`D:\Work\microi.net.all`).
  Project/file arguments use `./Microi.Server/...`; do not run the documented
  commands from inside `Microi.Server`, `Microi.Server/Microi.net`, or
  `Microi.Server/Microi.AI`.
- The workspace-root repository, `./Microi.Server/Microi.net`, and
  `./Microi.Server/Microi.AI` are three independent Git repositories. Run
  independent `git status`, `git add`, `git diff --cached`, and `git commit`
  commands with `git -C` for each touched repository. Never stage a child
  repository path from the root, never force-stage a private-repository path
  from the root, and never claim one commit contains changes from another repo.
- Build each touched repository independently: root-owned projects by their
  `./Microi.Server/...csproj`/solution path, private Microi.net by
  `./Microi.Server/Microi.net/Microi.net.csproj`, and private Microi.AI by
  `./Microi.Server/Microi.AI/Microi.AI.csproj`.
- All database compatibility behavior lives in Dos.ORM.
- Microi.Server outside Dos.ORM may read, store, display, validate, and pass DatabaseType configuration, but may not branch database behavior.
- Framework-owned SQL outside Dos.ORM is forbidden.
- Specific provider types outside Dos.ORM are forbidden.
- V8.Db.FromSql and DataSource user SQL remain opaque, are marked UserProvided, and are never translated.
- Native SQL is constructed from the session's exact detected DialectProfile and execution rechecks database type, Major, Minor, Build, Revision, and ordinal compatibility mode before creating a command; DatabaseType-only checks are forbidden.
- ProviderFactory is configuration-only. Microi.Server passes a configured
  `DatabaseType`, connection string, and exact configured mode; it never asks
  ProviderFactory for a compiler/platform and never constructs a live profile.
  After the connection is open, Dos.ORM's production bootstrap driver reads
  the vendor's authoritative version/mode probes, deterministically derives the
  exact four-part version under the frozen per-vendor padding/suffix rules, and
  resolves
  `DatabasePlatformRegistry.Get(exactLiveProfile)`.
- Private Microi.net/Microi.AI lifecycle, diagnostics, and session-bootstrap
  code cannot reference Dos.ORM internal
  `IDatabaseAdmin`, `IDatabaseDiagnostics`, `IConnectionPolicy`, platform
  definition, driver, ticket, coordinator, or materializer types. It calls the
  public source-only `DbSession` facade with AST/migration/admin source DTOs,
  values, and requested atomicity. Diagnostics are the actual
  `DatabaseDiagnosticOperation : SqlStatement` and use `FromAst`. No
  lifecycle/diagnostics/session facade or DTO accepts/returns compiled plans
  for execution, raw SQL text, `DbProvider`, a provider-specific connection,
  driver, command, or transaction. The two exact
  preview methods may return a plan only for external review as already frozen
  by the legacy-adapter public-surface contract.
- The sole lifecycle storage capability allowed across that public boundary is
  the already-frozen `IDatabaseResourceProvider`, whose complete surface is
  exactly `Stream OpenRead(DatabaseResourceHandle resource)` and
  `Stream OpenWrite(DatabaseResourceHandle resource)`. Microi injects it only
  through `DbSession(Database, IManagedSqlExecutionAuthorizer,
  IDatabaseResourceProvider)` and passes an opaque, digest-bearing resource
  handle in `DatabaseImportOperation`/`DatabaseExportOperation`; it never passes
  a path, SQL, provider-specific ADO, driver, plan, or caller-owned stream.
  Without that injection, non-resource operations continue to work but import
  and export fail before parsing or command creation. Dos.ORM owns stream
  disposal, bounded spooling, digest validation, and publish ordering.
- The one exception is the already-approved Task 5 DataSource/V8 user-owned
  SQL boundary: those exact call sites pass only `string`,
  `NativeSqlCommandKind`, ordered `ParameterDefinition` values, and
  `ParameterBag` to `DbSession.FromNativeSql`. The first terminal binds
  `NativeSqlText.UserProvided` internally to the exact live profile; callers
  never construct that type or receive a profile accessor. The boundary is not
  reusable for platform lifecycle work.
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
- Physically present Microi.net and Microi.AI files are part of the cross-repo
  source scan even though they are separate private repositories. They are
  staged and committed only inside their own repository, never force-staged by
  the workspace-root repository.
- No test or log prints passwords, tokens, connection strings, or runtime parameter values.

---

### Task 1: Add the physical inventory and five architecture rules

**Files:**
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Microi.DatabaseArchitecture.Tests.csproj
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Infrastructure/PhysicalSourceInventory.cs
- Create: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Infrastructure/PhysicalInventoryFixture.cs
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
public void Inventory_includes_private_runtime_projects()
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
public void Inventory_includes_tracked_generated_and_resource_text_but_not_build_or_links()
{
    using var tree = PhysicalInventoryFixture.Create();
    var files = PhysicalSourceInventory.Discover(tree.Root);
    Assert.Contains(tree.TrackedGeneratedCs, files);
    Assert.Contains(tree.EmbeddedSql, files);
    Assert.Contains(tree.RazorText, files);
    Assert.Contains(tree.ModuleScript, files);
    Assert.DoesNotContain(tree.ObjGeneratedCs, files);
    Assert.DoesNotContain(tree.TmpGeneratedCs, files);
    Assert.DoesNotContain(tree.TmpBuildGeneratedCs, files);
    Assert.DoesNotContain(tree.ArtifactGeneratedCs, files);
    Assert.DoesNotContain(tree.ExternalJunctionTarget, files);
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
dotnet test ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Microi.DatabaseArchitecture.Tests.csproj --filter "FullyQualifiedName~Inventory_includes_private_runtime_projects|FullyQualifiedName~Platform_source_cannot_reference_legacy_CommandCreator" --nologo
~~~

Expected: FAIL because PhysicalSourceInventory and
LegacyCommandCreatorRule do not exist.

- [ ] **Step 4: Implement physical enumeration and semantic findings**

~~~csharp
public static IReadOnlyList<string> Discover(string repositoryRoot)
{
    var serverRoot = Path.GetFullPath(
        Path.Combine(repositoryRoot, "Microi.Server"));
    var pending = new Stack<string>();
    var files = new List<string>();
    pending.Push(serverRoot);

    while (pending.Count != 0)
    {
        var directory = pending.Pop();
        foreach (var entry in Directory.EnumerateFileSystemEntries(
                     directory, "*", SearchOption.TopDirectoryOnly))
        {
            var fullPath = Path.GetFullPath(entry);
            if (!PathContainment.IsWithin(serverRoot, fullPath))
                throw new InvalidDataException("Inventory path escaped root.");

            var attributes = File.GetAttributes(fullPath);
            if ((attributes & FileAttributes.ReparsePoint) != 0)
                continue;
            if ((attributes & FileAttributes.Directory) != 0)
            {
                if (!PathSegments.IsExcludedBuildOrVcsOutput(fullPath))
                    pending.Push(fullPath);
                continue;
            }
            if (AuditedSourceExtensions.IsProductionTextSource(fullPath))
                files.Add(fullPath);
        }
    }

    return files.OrderBy(path => path,
        StringComparer.OrdinalIgnoreCase).ToArray();
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
`AuditedSourceExtensions` includes physical C# plus SQL-bearing production text
inputs (`.cs`, `.g.cs`, `.generated.cs`, `.sql`, `.json`, `.xml`, `.resx`,
`.config`, `.js`, `.mjs`, `.ts`, `.cshtml`, `.ps1`, `.sh`, `.props`, `.targets`,
and `.csproj`). This deliberately includes current Razor sources, upgrade module
scripts, and their fixtures. Roslyn semantic rules run on C#; the
origin/vendor-token rules also inspect the bounded decoded resource text and
require every embedded SQL resource outside Dos.ORM to disappear or be
explicitly user-authored opaque input. Files under tests/docs are classified
separately and cannot satisfy a production gate.
`PhysicalSourceInventory` receives the workspace root and walks physical
directories across all three repositories without consulting the root repository's
tracking/index state. It canonicalizes every path, requires root containment,
never follows reparse points/junctions/symlinks, and applies the exact excluded
segment test before pushing a directory, so excluded/unreadable output trees
are never traversed. Add temporary-tree fixtures
proving a physical `Microi.Core/TrackedSql.g.cs` and SQL resource are included,
`obj/Generated.g.cs` is excluded, an external junction is neither followed nor
looped, files that exist only in each private repository are still scanned, and
no scanner attempts to stage or rewrite them.

`PathSegments.IsExcludedBuildOrVcsOutput` is an ordinal-ignore-case segment
check for exactly `bin`, `obj`, `.git`, `.vs`, `.tmp`, `.tmp-build`,
`artifacts`, `TestResults`, `coverage`, `node_modules`, `dist`, and `publish`;
it never uses substring matching. Fixtures place SQL-bearing `.cs`, `.g.cs`,
`.mjs`, and `.cshtml` files under `.tmp`, `.tmp-build`, `artifacts`, `dist`, and
one non-excluded tracked directory. Only the non-excluded physical sources are
returned. The repository audit also asserts none of these output segments occur
in the final inventory, preventing local build evidence from changing the
DB001-DB005 baseline.

- [ ] **Step 5: Capture the audited initial baseline and commit**

Run all architecture tests, write only confirmed current findings, then:

~~~powershell
git status --short -- ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests ./Microi.Server/Microi.net.sln
git add -- ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Microi.DatabaseArchitecture.Tests.csproj ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Infrastructure/PhysicalSourceInventory.cs ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Infrastructure/PhysicalInventoryFixture.cs ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Infrastructure/ArchitectureFinding.cs ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Rules/DatabaseBranchRule.cs ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Rules/PlatformSqlBoundaryRule.cs ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Rules/ProviderReferenceRule.cs ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Rules/SqlOriginRule.cs ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Rules/LegacyCommandCreatorRule.cs ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Baselines/database-findings.json ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/ArchitectureGateTests.cs ./Microi.Server/Microi.net.sln
git diff --cached --name-only
git diff --cached --check
git commit -m "test: enforce database compatibility boundary"
~~~

### Task 2: Centralize database configuration and session creation

**Files:**
- Modify: Microi.Server/Microi.Core/ORM/MicroiORMExtensions.cs
- Modify: Microi.Server/Microi.Core/MicroiEngine.cs
- Modify: Microi.Server/Microi.Core/SaaSEngine/OsClient.cs
- Modify: Microi.Server/Microi.net/Common/OsClient.cs
- Modify/consume (created and added to the solution by seed-converter Task 5): Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/CertifiedPlatforms.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/MicroiOrmTestHost.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/TestConnections.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/VendorSqlTokens.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/SessionCreationSurfaceContract.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/SessionCreationContractTests.cs
- Modify: Microi.Server/Microi.net.sln

**Interfaces:**
- Consumes: the public configuration-only `DbSession` constructors and public
  source-only managed facade from the legacy-adapter plan. ProviderFactory
  remains an internal Dos.ORM configuration parser; Microi.Server does not
  consume `DatabasePlatformRegistry`, an internal platform definition, or an
  internal service interface.
- Produces: one Dos.ORM session creation path with no business-layer database
  switch and a test-visible capture proving live profile resolution happens
  only after connection open.

The integration project was created by seed Task 5 with conditional local
references to both private projects. This task verifies those exact
`$(MicroiNetProjectPath)`/`$(MicroiAIProjectPath)` references remain active
whenever the source checkouts exist; it must not replace them with package
fallback while testing private source. Later FormEngine, tenant, and AI tests
therefore compile against the changed private projects. Full/ReleaseFull
preflight still fails nonzero if either checkout or named test is absent.

- [ ] **Step 1: Write a failing six-type session creation contract**

~~~csharp
[Theory]
[MemberData(nameof(CertifiedPlatforms.SessionCreationCases),
    MemberType = typeof(CertifiedPlatforms))]
public void Microi_session_configuration_bootstraps_exact_live_profile_after_open(
    CertifiedPlatformCase sample)
{
    var capture = MicroiOrmTestHost.CreateUnopenedSession(
        sample.DatabaseType,
        sample.ConfiguredCompatibilityMode,
        TestConnections.FakeServer(sample));

    Assert.Equal(0, capture.Connection.OpenCalls);
    Assert.Equal(0, capture.ProfileDetectorCalls);
    Assert.Equal(0, capture.RegistryGetCalls);

    capture.ExecutePortableSelectProbe();

    Assert.Equal(1, capture.Connection.OpenCalls);
    Assert.True(capture.ProfileDetectedAfterOpen);
    Assert.Equal(sample.ExactLiveProfile, capture.DetectedProfile);
    Assert.Same(capture.DetectedProfile, capture.RegistryProfile);
    Assert.Null(typeof(DbProvider).GetProperty("Platform",
        BindingFlags.Public | BindingFlags.Instance));
}

[Fact]
public void Private_runtime_session_surface_is_source_only()
{
    SessionCreationSurfaceContract.AssertSessionBootstrapConsumersAcceptNo(
        Repository.Root,
        typeof(DatabaseExecutionPlan),
        typeof(DbProvider),
        typeof(DbCommand),
        typeof(DbConnection),
        typeof(DbTransaction),
        typeof(NativeSqlText));
    SessionCreationSurfaceContract.AssertNoDosOrmInternalInterfaceReferences(
        Repository.Root,
        "Microi.Server/Microi.net",
        "Microi.Server/Microi.AI");
}
~~~

`CertifiedPlatforms.SessionCreationCases` is a checked-in ten-row table and
returns a fresh `DialectProfile` per enumeration: MySQL `5.7.8.0` and
`8.0.11.0`; SQL Server `14.0.0.0` and `16.0.0.0`; Oracle `11.2.0.4` and
`19.0.0.0`; PostgreSQL `14.0.0.0` and `17.0.0.0`; DM8 `8.1.3.140` with configured
and detected canonical ordinal mode `"Oracle"`; and KingbaseES `9.4.12.0` with exact ordinal
mode `"PostgreSQL"`. The other eight rows use `string.Empty`. Every test asserts
the four version components separately; no major-only fixture or
DatabaseType-only registry lookup is permitted.

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter FullyQualifiedName~SessionCreationContractTests --nologo
~~~

Expected: PostgreSQL, DM8, or Kingbase paths expose fallback or business switches.

- [ ] **Step 3: Remove business-layer provider selection**

`MicroiORMExtensions` keeps DI, logging, and localization only.
`MicroiEngine.ORM` and both `OsClient` classes pass only `DatabaseType`, the
connection configuration, and the exact configured mode to the public Dos.ORM
session constructor. They neither parse provider class names nor resolve a
profile. The fixed configured modes are empty for MySQL/SQL Server/Oracle/
PostgreSQL, canonical ordinal `"Oracle"` for DM8, and ordinal `"PostgreSQL"` for
KingbaseES.

The DM8 driver queries raw `COMPATIBLE_MODE` only after the connection opens,
requires raw numeric `2`, and then constructs the live profile with canonical
`CompatibilityMode = "Oracle"`; raw `"2"` is never stored in a profile.

MySQL connection-string repair and every other connection-policy decision run
inside the selected production `IDbDriverAdapter` after Dos.ORM owns the
connection path; Microi.net does not reference or call internal
`IConnectionPolicy`. The first public source-only session operation opens the
connection, the bootstrap driver deterministically derives all four
server-version components from its authoritative vendor probes/padding rules
and detects exact mode, and Dos.ORM calls the registry with that exact profile. There
is no public/stored `DbProvider.Platform` shortcut and no provider cache of the
first server's profile.

- [ ] **Step 4: Run focused tests, architecture tests, and builds**

~~~powershell
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter FullyQualifiedName~SessionCreationContractTests --nologo
dotnet test ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Microi.DatabaseArchitecture.Tests.csproj --nologo
dotnet build ./Microi.Server/Microi.Core/Microi.Core.csproj --nologo
dotnet build ./Microi.Server/Microi.net/Microi.net.csproj --nologo
~~~

Expected: focused tests pass and affected DB001/DB003 findings disappear.

- [ ] **Step 5: Commit the root and private repositories independently**

~~~powershell
git status --short -- ./Microi.Server/Microi.Core ./Microi.Server/tests ./Microi.Server/Microi.net.sln
git add -- ./Microi.Server/Microi.Core/ORM/MicroiORMExtensions.cs ./Microi.Server/Microi.Core/MicroiEngine.cs ./Microi.Server/Microi.Core/SaaSEngine/OsClient.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj ./Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/CertifiedPlatforms.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/MicroiOrmTestHost.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/TestConnections.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/VendorSqlTokens.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/SessionCreationSurfaceContract.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/SessionCreationContractTests.cs ./Microi.Server/Microi.net.sln
git diff --cached --name-only
git diff --cached --check
git commit -m "refactor: centralize public Microi database session creation"

git -C ./Microi.Server/Microi.net status --short -- ./Common/OsClient.cs
git -C ./Microi.Server/Microi.net add -- ./Common/OsClient.cs
git -C ./Microi.Server/Microi.net diff --cached --name-only
git -C ./Microi.Server/Microi.net diff --cached --check
git -C ./Microi.Server/Microi.net commit -m "refactor: delegate session configuration to Dos.ORM"
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
[MemberData(nameof(CertifiedPlatforms.All),
    MemberType = typeof(CertifiedPlatforms))]
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

~~~powershell
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter "FullyQualifiedName~FormEngineReadContractTests|FullyQualifiedName~FormEngineLangContractTests|FullyQualifiedName~PermissionContractTests" --nologo
~~~

Expected: failures identify LIMIT, TOP, IFNULL, metadata SQL, quotes, or database branches.

- [ ] **Step 3: Replace query strings with AST builders**

Map validated table/field metadata to SqlObjectName and SqlIdentifier. Map existing Where conditions to SqlExpression, selection to SelectProjection, statistics to AggregateExpression, and paging to PageSpec. Language fallback uses Coalesce semantic function; role limits use Select/Exists/Upsert semantics from Dos.ORM.

- [ ] **Step 4: Verify focused tests, architecture shrinkage, and the private-project build**

~~~powershell
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter "FullyQualifiedName~FormEngineReadContractTests|FullyQualifiedName~FormEngineLangContractTests|FullyQualifiedName~PermissionContractTests" --nologo
dotnet test ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Microi.DatabaseArchitecture.Tests.csproj --nologo
dotnet build ./Microi.Server/Microi.Core/Microi.Core.csproj --nologo
dotnet build ./Microi.Server/Microi.net/Microi.net.csproj --nologo
~~~

Expected: affected DB001/DB002 findings are removed and both touched repository
builds pass independently.

- [ ] **Step 5: Commit**

~~~powershell
git status --short -- ./Microi.Server/Microi.Core ./Microi.Server/tests
git add -- ./Microi.Server/Microi.Core/FormEngine/FormEngine.cs ./Microi.Server/Microi.Core/FormEngine/FormEngineLang.cs ./Microi.Server/Microi.Core/Logic/SysRoleLimitLogic.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/FormEngineHarness.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/FormEngineReadContractTests.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/FormEngineLangContractTests.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/PermissionContractTests.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "refactor: migrate core FormEngine reads to SQL AST"

git -C ./Microi.Server/Microi.net status --short -- ./FormEngine
git -C ./Microi.Server/Microi.net add -- ./FormEngine/FormEngineGet.cs ./FormEngine/FormEngineGetTableData.cs ./FormEngine/FormEngineTreeLazyHelper.cs ./FormEngine/FormEngineCommon.cs ./FormEngine/Where.cs
git -C ./Microi.Server/Microi.net diff --cached --name-only
git -C ./Microi.Server/Microi.net diff --cached --check
git -C ./Microi.Server/Microi.net commit -m "refactor: migrate FormEngine reads to SQL AST"
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
[MemberData(nameof(CertifiedPlatforms.All),
    MemberType = typeof(CertifiedPlatforms))]
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

~~~powershell
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter "FullyQualifiedName~FormEngineWriteContractTests|FullyQualifiedName~FormEngineSchemaContractTests" --nologo
~~~

Expected: Oracle branches, string DML, or DDL service branches fail the contract.

- [ ] **Step 3: Replace write and DDL construction**

Preserve V8 before/after event order. Build ParameterBag from validated form values, use guarded Update/Delete, call SchemaOperation for field/table changes, and keep import/export data streaming independent from database syntax.

- [ ] **Step 4: Verify and build**

~~~powershell
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter "FullyQualifiedName~FormEngineWriteContractTests|FullyQualifiedName~FormEngineSchemaContractTests" --nologo
dotnet test ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Microi.DatabaseArchitecture.Tests.csproj --nologo
dotnet build ./Microi.Server/Microi.net/Microi.net.csproj --nologo
dotnet build ./Microi.Server/Microi.net.Api/Microi.net.Api.csproj --output ./.tmp/build/platform-sql-api --nologo
~~~

Expected: PASS and reduced findings; the private Microi.net and root-owned API
builds are independently evidenced.

- [ ] **Step 5: Commit the root and private repositories independently**

~~~powershell
git status --short -- ./Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/FormEngineWriteContractTests.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/FormEngineSchemaContractTests.cs
git add -- ./Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/FormEngineWriteContractTests.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/FormEngineSchemaContractTests.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "test: cover portable FormEngine writes and schema"

git -C ./Microi.Server/Microi.net status --short -- ./FormEngine
git -C ./Microi.Server/Microi.net add -- ./FormEngine/FormEngineAdd.cs ./FormEngine/FormEngineAddHelper.cs ./FormEngine/FormEngineUpt.cs ./FormEngine/FormEngineDel.cs ./FormEngine/FormEngineField.cs ./FormEngine/FormEngineTable.cs ./FormEngine/FormEngineImport.cs ./FormEngine/FormEngineExport.cs ./FormEngine/FormEngineSqlDebugHelper.cs
git -C ./Microi.Server/Microi.net diff --cached --name-only
git -C ./Microi.Server/Microi.net diff --cached --check
git -C ./Microi.Server/Microi.net commit -m "refactor: migrate FormEngine writes and schema to AST"
~~~

### Task 5: Mark DataSource and V8 raw SQL boundaries without translating them

**Files:**
- Modify: Microi.Server/Microi.net/DataSourceEngine/DataSourceEngine.cs
- Modify: Microi.Server/Microi.Core/V8Engine/V8McpLogic.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/DataSourceHarness.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/DataSourceBoundaryTests.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/NativeSqlBoundaryTests.cs
- Modify: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Rules/SqlOriginRule.cs
- Modify: Microi.Server/tests/Microi.DatabaseArchitecture.Tests/ArchitectureGateTests.cs

**Interfaces:**
- Produces: session-owned `FromNativeSql(string, NativeSqlCommandKind,
  definitions, values)` call sites. Dos.ORM alone binds
  `NativeSqlText.UserProvided` to the active session's exact detected target
  profile at terminal execution; platform callers cannot supply or read a
  profile.

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
    Assert.True(capture.ProfileDetectedBeforeNativeSourceCreated);
    Assert.Equal(0, capture.PublicProfileAccessorCalls);
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

~~~powershell
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter "FullyQualifiedName~DataSourceBoundaryTests|FullyQualifiedName~NativeSqlBoundaryTests" --nologo
~~~

Expected: old FromSql(string) path has no origin.

- [ ] **Step 3: Wrap only user-owned SQL**

DataSource read paths pass the unchanged user text, declare
`NativeSqlCommandKind.Read`, and use a read-only account or transaction. V8
preserves read/write capability according to its current authorization,
declares command kind, and binds definitions/values through the typed native
source API. Neither layer obtains or constructs a profile. At terminal,
Dos.ORM opens the owning connection, detects the canonical live type, all four
version components and ordinal mode, creates the internal UserProvided source,
then performs exact source/profile preflight before command creation. Do not
expose a profile accessor, accept caller-supplied `NativeSqlText`, construct a
profile from DatabaseType alone, expose a compiled plan, or add regex
translation/security claims.

DB004's final exception is a symbol-level literal allowlist for only the exact
containing members in `DataSourceEngine.cs` and `V8McpLogic.cs` that receive
already-authorized user text. It matches the four-parameter method symbol and
originating source path/member identity, not spelling. A third call site, an
overload, or any tenant lifecycle, upgrade, seed, AI, controller, or generated
file caller fails. Mutation fixtures move the same call into each forbidden
surface and must produce DB004 before execution.

- [ ] **Step 4: Verify tests and DB004 findings**

~~~powershell
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter "FullyQualifiedName~DataSourceBoundaryTests|FullyQualifiedName~NativeSqlBoundaryTests" --nologo
dotnet test ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Microi.DatabaseArchitecture.Tests.csproj --nologo
dotnet build ./Microi.Server/Microi.Core/Microi.Core.csproj --nologo
dotnet build ./Microi.Server/Microi.net/Microi.net.csproj --nologo
~~~

Expected: boundary tests pass and only explicitly user-owned call sites are
exempt from DB004 through semantic origin types.

- [ ] **Step 5: Commit**

~~~powershell
git status --short -- ./Microi.Server/Microi.Core/V8Engine/V8McpLogic.cs ./Microi.Server/tests
git add -- ./Microi.Server/Microi.Core/V8Engine/V8McpLogic.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/DataSourceHarness.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/DataSourceBoundaryTests.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/NativeSqlBoundaryTests.cs ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Rules/SqlOriginRule.cs ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/ArchitectureGateTests.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "refactor: declare core native SQL ownership boundary"

git -C ./Microi.Server/Microi.net status --short -- ./DataSourceEngine/DataSourceEngine.cs
git -C ./Microi.Server/Microi.net add -- ./DataSourceEngine/DataSourceEngine.cs
git -C ./Microi.Server/Microi.net diff --cached --name-only
git -C ./Microi.Server/Microi.net diff --cached --check
git -C ./Microi.Server/Microi.net commit -m "refactor: declare DataSource native SQL boundary"
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

~~~powershell
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter FullyQualifiedName~McpContractTests --nologo
~~~

Expected: SQL resources exist and definitions do not.

- [ ] **Step 3: Express schema and operations as AST**

Create strongly typed table definitions and idempotent SchemaOperation plans. Convert MCP list, state transition, process aggregation, and flow queries to Select/DML AST. Preserve result DTOs and transaction semantics.

- [ ] **Step 4: Run MCP contracts and architecture tests**

~~~powershell
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter FullyQualifiedName~McpContractTests --nologo
dotnet test ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Microi.DatabaseArchitecture.Tests.csproj --nologo
dotnet build ./Microi.Server/Microi.Core/Microi.Core.csproj --nologo
~~~

Expected: tests pass and MCP DB002 findings are zero.

- [ ] **Step 5: Commit**

~~~powershell
git status --short -- ./Microi.Server/Microi.Core ./Microi.Server/tests
git add -- ./Microi.Server/Microi.Core/V8Engine/V8McpLogic.Blueprint.cs ./Microi.Server/Microi.Core/V8Engine/V8McpLogic.FlowEngine.cs ./Microi.Server/Microi.Core/V8Engine/V8McpLogic.StateMachine.cs ./Microi.Server/Microi.Core/V8Engine/V8McpLogic.ProcessMining.cs ./Microi.Server/Microi.Core/V8Engine/Schema/McpSchemaDefinitions.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/McpContractTests.cs
git add -u -- ./Microi.Server/Microi.Core/Resource/business-blueprint-tables.sql ./Microi.Server/Microi.Core/Resource/flow-engine-tables.sql ./Microi.Server/Microi.Core/Resource/state-machine-tables.sql
git diff --cached --name-only
git diff --cached --check
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

~~~powershell
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter "FullyQualifiedName~AiSubscriptionContractTests|FullyQualifiedName~PortableQueryDocumentTests" --nologo
~~~

Expected: document types do not exist and existing prompt asks for MySQL SQL.

- [ ] **Step 3: Replace AI-owned SQL paths**

Subscription schema is TableDefinition; quota locking and logging use Select/Update/Insert AST. NL2SQL asks the model for versioned PortableQueryDocument JSON, validates tables, columns, operators, maximum rows, and read-only shape, converts to SelectStatement, then compiles through the current platform. LegacyAiGenerated remains disabled by default and its final default-path counter is zero.

- [ ] **Step 4: Verify AI tests, architecture tests, and the private AI build**

~~~powershell
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter "FullyQualifiedName~AiSubscriptionContractTests|FullyQualifiedName~PortableQueryDocumentTests" --nologo
dotnet test ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Microi.DatabaseArchitecture.Tests.csproj --nologo
dotnet build ./Microi.Server/Microi.AI/Microi.AI.csproj --nologo
~~~

Expected: PASS and AI DB001/DB002 findings are zero.

- [ ] **Step 5: Commit the root and private AI repositories independently**

~~~powershell
git status --short -- ./Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/AiSubscriptionContractTests.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/PortableQueryDocumentTests.cs
git add -- ./Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/AiSubscriptionContractTests.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/PlatformSql/PortableQueryDocumentTests.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "test: cover portable AI persistence and query documents"

git -C ./Microi.Server/Microi.AI status --short
git -C ./Microi.Server/Microi.AI add -- ./SubscriptionService.cs ./MicroiAI.cs ./PortableQueryDocument.cs ./PortableQueryDocumentValidator.cs ./PortableQueryAstConverter.cs
git -C ./Microi.Server/Microi.AI add -u -- ./Resource/subscription-tables.sql
git -C ./Microi.Server/Microi.AI diff --cached --name-only
git -C ./Microi.Server/Microi.AI diff --cached --check
git -C ./Microi.Server/Microi.AI commit -m "refactor: migrate AI storage and NL2SQL to AST"
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
`Microi.net.sln` through Roslyn and overlays the private Microi.net/Microi.AI
physical files already enumerated by Task 1; it excludes test projects and the
exact build/VCS output segments frozen by Task 1. Tracked physical `.g.cs` and
`.generated.cs` outside those directories remain production roots; only
compiler-emitted temporary files beneath excluded output directories are
absent. `AssertClosedPlatformInventory` treats
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
does not call a managed method, plus the same wrapper in tracked
`GeneratedEscape.g.cs` and `GeneratedEscape.generated.cs`. Every mutation must
fail this inventory/type-graph test before any driver command is created; the
generated-file mutations must identify their physical source path. A harmless
approved-leaf DTO whose base terminates at `System.Object` remains GREEN.

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter "FullyQualifiedName~UpgradeIdempotencyTests|FullyQualifiedName~UpgradeFailureTests" --nologo
~~~

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

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~PublicApiBaselineTests|FullyQualifiedName~ManagedExecutionSurfaceTests" --nologo
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter "FullyQualifiedName~UpgradeIdempotencyTests|FullyQualifiedName~UpgradeFailureTests" --nologo
dotnet test ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Microi.DatabaseArchitecture.Tests.csproj --nologo
dotnet build ./Microi.Server/Microi.Upgrade/Microi.Upgrade.csproj --nologo
~~~

Expected: immutable complete-
assembly baseline plus exact delta PASS, exact host/interface maps PASS, every
public/protected platform inventory signature recursively closed, repeat
upgrade no-op, injected failure leaves version unchanged, and Upgrade DB002
findings are zero.

- [ ] **Step 5: Commit**

~~~powershell
git status --short -- ./Microi.Server/Microi.Upgrade ./Microi.Server/tests
git add -- ./Microi.Server/Microi.Upgrade/Upgrade.cs ./Microi.Server/Microi.Upgrade/MicroiUpgradeExtensions.cs ./Microi.Server/Microi.Upgrade/1-UpgradeAppDisplay.cs ./Microi.Server/Microi.Upgrade/2-UpgradeSysConfig.cs ./Microi.Server/Microi.Upgrade/3-UpgradeLang.cs ./Microi.Server/Microi.Upgrade/5-UpgradeApiEngine.cs ./Microi.Server/Microi.Upgrade/13-UpgradeAppStore.cs ./Microi.Server/Microi.Upgrade/Resource/app.microi.store.json ./Microi.Server/Microi.Upgrade/Resource/app.microi.module-engine.json ./Microi.Server/Microi.Upgrade/Resource/app.microi.form-engine.json ./Microi.Server/Microi.Upgrade/Migrations/MicroiMigrationCatalog.cs ./Microi.Server/Microi.Upgrade/Migrations/UpgradeSqlExecutionAuthorizer.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/UpgradeHarness.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/PlatformProductionSurfaceInventory.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/PlatformManagedExecutionSurfaceAssert.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/Lifecycle/UpgradeIdempotencyTests.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/Lifecycle/UpgradeFailureTests.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "refactor: migrate upgrades to portable AST plans"
~~~

### Task 9: Migrate tenant lifecycle, empty database, diagnostics, and remaining platform SQL

**Files:**
- Create: Microi.Server/Dos.ORM/SqlCompilation/IDatabaseAdmin.cs (internal)
- Create: Microi.Server/Dos.ORM/SqlCompilation/IDatabaseDiagnostics.cs (internal)
- Create: Microi.Server/Dos.ORM/SqlCompilation/IConnectionPolicy.cs (internal)
- Create: Microi.Server/Dos.ORM/SqlCompilation/DatabaseAdminCoordinator.cs (internal)
- Create: Microi.Server/Dos.ORM/SqlCompilation/DatabaseDiagnosticsCoordinator.cs (internal)
- Modify: Microi.Server/Dos.ORM/Platform/DatabasePlatformDefinition.cs
- Modify: Microi.Server/Dos.ORM/Platform/DatabasePlatformRegistry.cs
- Modify: Microi.Server/Dos.ORM/SqlCompilation/Drivers/MySqlDbDriverAdapter.cs
- Modify: Microi.Server/Dos.ORM/SqlCompilation/Drivers/SqlServerDbDriverAdapter.cs
- Modify: Microi.Server/Dos.ORM/SqlCompilation/Drivers/OracleDbDriverAdapter.cs
- Modify: Microi.Server/Dos.ORM/SqlCompilation/Drivers/PostgreSqlDbDriverAdapter.cs
- Modify: Microi.Server/Dos.ORM/SqlCompilation/Drivers/DaMengDbDriverAdapter.cs
- Modify: Microi.Server/Dos.ORM/SqlCompilation/Drivers/KingBaseDbDriverAdapter.cs
- Modify: Microi.Server/Microi.net/Common/TenantProvisioningService.cs
- Modify: Microi.Server/Microi.net/Common/DbConnectionDiagnostics.cs
- Create: Microi.Server/Microi.net/Common/TenantSqlExecutionAuthorizer.cs
- Modify: Microi.Server/Microi.Core/Services/EmptyDatabaseReleaseService.cs
- Modify/consume (created by seed-converter Task 5): Microi.Server/Microi.Core/Services/MicroiDatabaseResourceProvider.cs
- Modify: Microi.Server/Microi.net.Api/Controllers/SystemMonitorController.cs
- Modify: Microi.Server/Microi.net.Api/Controllers/OsController.cs
- Modify: Microi.Server/Microi.net.Api/Handler/UEditor/Config.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/TenantHarness.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Lifecycle/TenantLifecycleTests.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Lifecycle/DatabaseDiagnosticsContractTests.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Lifecycle/DatabaseResourceBoundaryTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/DatabaseLifecycleFacadeTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/DatabaseDiagnosticsFacadeTests.cs

**Interfaces:**
- Dos.ORM consumes its own internal `IDatabaseAdmin`,
  `IDatabaseDiagnostics`, and `IConnectionPolicy` factories from the exact
  internal platform definition selected after live bootstrap.
- Microi.net consumes only the already-frozen public source-only `DbSession`
  methods: `ExecuteMigration` for neutral schema/data source,
  `PreviewAdmin`/`ExecuteAdmin` for `DatabaseAdminOperation` source DTOs, and
  `FromAst(DatabaseDiagnosticOperation, ParameterBag)` for diagnostics. The
  actual diagnostic type derives from `SqlStatement`, not
  `DatabaseAdminOperation`; Microi.net does not reference those internal
  interfaces or receive a database provider/platform/driver. For import/export
  only, session composition may inject the public two-stream
  `IDatabaseResourceProvider`; this is a storage capability, not a database
  provider, and no private lifecycle method widens or wraps its surface.
- Produces: database-neutral create/drop/initialize/clone/import/export and
  unified diagnostics DTOs. Preview may return an immutable plan for external
  review; execution resubmits only the source operation, values, requested
  atomicity, and optional-by-overload compiled approval. Lifecycle/
  diagnostics facades accept no compiled plan, SQL/native text, provider,
  driver, connection, transaction, command, ticket, materializer, or managed
  command list. Here `provider` means database/ADO provider; the one exact
  `IDatabaseResourceProvider` constructor dependency is the explicit allowed
  storage exception and exposes only opaque resource handles and streams.

`DatabaseAdminCoordinator` owns the exact `ReplaceTargetDatabase` reset
dispatch. For profiles with both literal database lifecycle capabilities it
uses the platform admin connection to drop/create the target database. Oracle
and DM8 instead use the exact platform driver's schema-owner reset: an elevated
reset connection enumerates the complete owned-object catalog, compiles and
validates every object type/owner before the first mutation, then executes
dependency-ordered object drops. A foreign/system or unrecognized object fails
with zero reset mutation; a residual object fails without claiming an empty
target. The coordinator disposes both reset and stale target scopes and opens a
new target scope. That new scope must rediscover the identical four-part profile/mode and
prove zero business/support objects before the import may write
`PendingImport`. The private `TenantProvisioningService` supplies only the
neutral source operation/authorization and registered connection configuration;
it cannot choose a reset strategy or issue vendor SQL. Capability false,
missing privilege/credential, catalog incompleteness, reconnect mismatch, or
nonempty proof is a hard failure before pending state or data DML.

The same coordinator defines `CreateDatabaseOperation` and
`DropDatabaseOperation` as logical tenant-target lifecycle at the facade: the
four database-capable profiles use literal database create/drop, while
Oracle/DM use elevated schema-owner/user create/drop and then reconnect through
the target connection. Secret material is resolved only from the registered
connection configuration and is redacted from plans/events; the neutral source
DTO contains only the logical target and behavior. Unit and real-lane tests
assert this schema-owner arm never calls the false literal database capability.

- [ ] **Step 1: Write failing lifecycle and diagnostics contracts**

~~~csharp
[Theory]
[MemberData(nameof(CertifiedPlatforms.All),
    MemberType = typeof(CertifiedPlatforms))]
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

[Fact]
public async Task Empty_seed_reuses_existing_digest_backed_import_source()
{
    var capture = await TenantHarness.CaptureEmptySeedImportAsync();
    var import = Assert.IsType<DatabaseImportOperation>(capture.Operation);

    Assert.Equal(DatabaseTransferFormat.ProviderNative, import.Format);
    Assert.Equal(DatabaseTransferScope.SchemaAndData, import.Scope);
    Assert.Equal(DatabaseImportConflictPolicy.FailOnConflict, import.Policy);
    Assert.Equal(capture.VerifiedManifest.ContentDigest,
        import.Resource.ContentDigest);
    Assert.True(capture.ResourceDigestVerifiedBeforeParser);
    Assert.Equal(1, capture.ResourceProvider.OpenReadCalls);
    Assert.Equal(0, capture.RawSqlFacadeCalls);
    Assert.DoesNotContain("SeedInstallRequest",
        capture.ProductionTypeNames, StringComparer.Ordinal);
    PlatformSqlArchitectureAssert.NoProductionIdentifier(
        Repository.Root, "SeedInstallRequest");
}

[Theory]
[InlineData(TenantResourceFailure.MissingProvider)]
[InlineData(TenantResourceFailure.DigestMismatch)]
[InlineData(TenantResourceFailure.NullStream)]
[InlineData(TenantResourceFailure.NotReadable)]
[InlineData(TenantResourceFailure.ProviderThrows)]
public async Task Seed_resource_failure_precedes_parser_and_driver(
    TenantResourceFailure failure)
{
    var capture = await TenantHarness.RunResourceFailureAsync(failure);
    Assert.Equal(0, capture.ParserCalls);
    Assert.Equal(0, capture.Driver.CreateCommandCalls);
    Assert.Equal(0, capture.Driver.ExecuteCalls);
}

[Fact]
public async Task Export_publishes_only_after_spool_digest_matches_handle()
{
    var capture = await TenantHarness.CaptureExportAsync();
    await capture.ExecuteAsync();

    Assert.True(capture.CompletedPrivateSpoolBeforeOpenWrite);
    Assert.Equal(capture.Operation.Resource.ContentDigest,
        capture.ReportedContentDigest);
    Assert.Equal(1, capture.ResourceProvider.OpenWriteCalls);
    Assert.True(capture.DestinationFlushedAndDisposed);
}

[Theory]
[MemberData(nameof(CertifiedPlatforms.All),
    MemberType = typeof(CertifiedPlatforms))]
public async Task Diagnostics_use_actual_statement_through_FromAst(
    DatabasePlatformDescriptor platform)
{
    var capture = await TenantHarness.CaptureDiagnosticsAsync(platform);
    Assert.IsType<DatabaseDiagnosticOperation>(capture.Statement);
    Assert.IsAssignableFrom<SqlStatement>(capture.Statement);
    Assert.Equal(1, capture.FromAstCalls);
    Assert.Equal(0, capture.ExecuteAdminCalls);
    Assert.Equal(0, capture.InternalServiceReferences);
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
[InlineData(DatabaseType.Oracle)]
[InlineData(DatabaseType.DaMeng)]
public async Task Replace_import_uses_schema_owner_reset_before_pending(
    DatabaseType databaseType)
{
    var capture = await TenantHarness.CaptureReplaceResetAsync(databaseType);

    Assert.False(capture.UsedCreateDatabase);
    Assert.False(capture.UsedDropDatabase);
    Assert.True(capture.ResetAuthorizationBeforeOwnedObjectEnumeration);
    Assert.True(capture.AllDropsUsedManagedAdminCompilation);
    Assert.True(capture.StaleTargetDisposedBeforeReconnect);
    Assert.True(capture.ExactProfileRedetectedBeforeEmptyProof);
    Assert.True(capture.EmptyProofBeforePendingImport);
    Assert.True(capture.ActiveReadBeforeFirstDataDml);
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

[Fact]
public void Private_lifecycle_and_diagnostics_depend_only_on_source_session_facade()
{
    PlatformManagedExecutionSurfaceAssert.AssertSourceOnlyPrivateConsumers(
        Repository.Root,
        new[]
        {
            "Microi.Server/Microi.net/Common/TenantProvisioningService.cs",
            "Microi.Server/Microi.net/Common/DbConnectionDiagnostics.cs",
            "Microi.Server/Microi.net/Common/TenantSqlExecutionAuthorizer.cs"
        },
        forbiddenDosOrmSymbols: new[]
        {
            "IDatabaseAdmin", "IDatabaseDiagnostics", "IConnectionPolicy",
            "DatabasePlatformDefinition", "IDbDriverAdapter",
            "DatabaseExecutionPlan", "NativeSqlText", "DbProvider",
            "DbCommand", "DbConnection", "DbTransaction"
        });

    PlatformManagedExecutionSurfaceAssert.AssertExactStorageCapabilityUse(
        Repository.Root,
        typeof(IDatabaseResourceProvider),
        exactMethods: new[] { "OpenRead", "OpenWrite" },
        allowedConstructors: new[]
        {
            typeof(DbSession).GetConstructor(new[]
            {
                typeof(Database), typeof(IManagedSqlExecutionAuthorizer),
                typeof(IDatabaseResourceProvider)
            }),
            typeof(TenantProvisioningService).GetConstructor(new[]
            {
                typeof(IDatabaseResourceProvider)
            }),
            typeof(EmptyDatabaseReleaseService).GetConstructor(new[]
            {
                typeof(string), typeof(IDatabaseResourceProvider)
            })
        },
        soleRegistrationFile:
            "Microi.Server/Microi.Core/ORM/MicroiORMExtensions.cs",
        soleImplementationFile:
            "Microi.Server/Microi.Core/Services/MicroiDatabaseResourceProvider.cs");
}
~~~

The storage-capability gate also allows the existing V8 extension to resolve
the public interface from initialized `MicroiEngine` solely to pass it into
`EmptyDatabaseReleaseService`; it rejects a lookup by concrete type. It proves
the Core implementation is the only assignable concrete class and the single
`TryAddSingleton` registration is the only interface binding. All other
constructors, service lookups, wrappers, subclasses, and registrations fail.

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~DatabaseLifecycleFacadeTests|FullyQualifiedName~DatabaseDiagnosticsFacadeTests" --nologo
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter "FullyQualifiedName~TenantLifecycleTests|FullyQualifiedName~DatabaseDiagnosticsContractTests|FullyQualifiedName~DatabaseResourceBoundaryTests" --nologo
dotnet test ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Microi.DatabaseArchitecture.Tests.csproj --nologo
~~~

Expected: direct MySqlConnection, script, metadata, and database branches fail.

- [ ] **Step 3: Delegate lifecycle and monitoring**

Implement admin/diagnostics/connection-policy variation behind the exact
registry-selected internal `DatabasePlatformDefinition`; this task extends that
definition with exactly one immutable admin, diagnostics, and connection-policy
factory for each platform. The six production driver files own connection
normalization and typed ADO binding; the internal admin/diagnostics coordinators
invoke only exact definition services after the same live-profile/ticket
preflight. These internal interfaces remain invisible to Microi.net and add no
public/protected Dos.ORM API delta. The permanent canonical-baseline-plus-exact-
delta test must remain GREEN.

TenantProvisioning and EmptyDatabaseRelease submit neutral source requests only.
The `internal sealed MicroiDatabaseResourceProvider` maps a validated opaque handle ID to the
signed artifact store and returns fresh streams only; it contains no SQL,
database provider, dialect, compiler, driver, connection, transaction, or
command dependency. For writes it stages privately and atomically publishes
only on successful flush/disposal with the expected digest. Composition creates
the session with the exact three-argument `DbSession` constructor for resource
operations; no private facade mirrors or broadens the provider interface.
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

The standard empty database and tenant initialization consume the signed,
hashed, deterministic full-schema-and-data artifact generated by
`2026-07-18-microi-empty-seed-converter.md`. After verifying its manifest and
constructing `DatabaseResourceHandle(id, verifiedContentDigest)`, they reuse
the existing source type exactly:

~~~csharp
var operation = new DatabaseImportOperation(
    targetDatabase,
    resourceHandle,
    DatabaseTransferFormat.ProviderNative,
    DatabaseTransferScope.SchemaAndData,
    DatabaseImportConflictPolicy.FailOnConflict);
~~~

There is no `SeedInstallRequest`, seed-specific execution facade, alternate
resource wrapper, or migration/raw-SQL fallback. Microi submits only this
operation, `new ParameterBag()`, requested atomicity, authorizer, and the exact
resource-provider injection; Dos.ORM calls `OpenRead`, validates the lower-hex
SHA-256 digest into its own bounded spool before the import parser, and owns
the stream lifetime. Export likewise completes and hashes Dos.ORM's private
spool before `OpenWrite`; the result reports the verified digest and the
provider atomically publishes only the matching bytes. Missing provider,
digest mismatch, null/wrong-capability stream, provider error, or spool limit
failure starts no parser or driver command and has no SQL fallback. Any
separately authorized DataSource/V8 user-owned SQL
continues to use only the exact Task 5 typed boundary and is not a lifecycle
fallback. The executor re-detects all profile fields before creating a command;
a declared source/target database name is not a substitute for that profile
check.

`DbConnectionDiagnostics` and `SystemMonitor` create the neutral
`DatabaseDiagnosticOperation : SqlStatement` and call public
`DbSession.FromAst(operation, values)`, then materialize the returned
`SqlSection` into the common diagnostics DTO. They never route diagnostics
through `ExecuteAdmin`. Dos.ORM's internal diagnostics coordinator supplies the
dialect plan; errors are explicit rather than converted to zero. Neither
private class can name or inject `IDatabaseDiagnostics`. Outside the named
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

Remove each migrated fingerprint from database-findings.json, then run:

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~PublicApiBaselineTests|FullyQualifiedName~ManagedExecutionSurfaceTests|FullyQualifiedName~ManagedSqlSectionTests|FullyQualifiedName~ManagedReaderLeaseTests|FullyQualifiedName~DatabaseResourceProviderTests|FullyQualifiedName~DatabaseLifecycleFacadeTests|FullyQualifiedName~DatabaseDiagnosticsFacadeTests" --nologo
dotnet test ./Microi.Server/tests/Microi.DatabaseArchitecture.Tests/Microi.DatabaseArchitecture.Tests.csproj --nologo
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --nologo
dotnet build ./Microi.Server/Dos.ORM/Dos.ORM.csproj --nologo
dotnet build ./Microi.Server/Microi.Core/Microi.Core.csproj --nologo
dotnet build ./Microi.Server/Microi.net.Api/Microi.net.Api.csproj --output ./.tmp/build/platform-sql-api-final --nologo
dotnet build ./Microi.Server/Microi.net/Microi.net.csproj --nologo
dotnet build ./Microi.Server/Microi.AI/Microi.AI.csproj --nologo

git status --short
git -C ./Microi.Server/Microi.net status --short
git -C ./Microi.Server/Microi.AI status --short
~~~

Expected: DB001=0, DB002=0, DB003=0, DB004=0 outside approved typed user
boundaries, and DB005=0 without exception.

- [ ] **Step 5: Commit all remaining exact files**

~~~powershell
git status --short -- ./Microi.Server/Dos.ORM ./Microi.Server/Dos.ORM.Tests ./Microi.Server/Microi.Core ./Microi.Server/Microi.net.Api ./Microi.Server/tests
git add -- ./Microi.Server/Dos.ORM/SqlCompilation/IDatabaseAdmin.cs ./Microi.Server/Dos.ORM/SqlCompilation/IDatabaseDiagnostics.cs ./Microi.Server/Dos.ORM/SqlCompilation/IConnectionPolicy.cs ./Microi.Server/Dos.ORM/SqlCompilation/DatabaseAdminCoordinator.cs ./Microi.Server/Dos.ORM/SqlCompilation/DatabaseDiagnosticsCoordinator.cs ./Microi.Server/Dos.ORM/Platform/DatabasePlatformDefinition.cs ./Microi.Server/Dos.ORM/Platform/DatabasePlatformRegistry.cs ./Microi.Server/Dos.ORM/SqlCompilation/Drivers/MySqlDbDriverAdapter.cs ./Microi.Server/Dos.ORM/SqlCompilation/Drivers/SqlServerDbDriverAdapter.cs ./Microi.Server/Dos.ORM/SqlCompilation/Drivers/OracleDbDriverAdapter.cs ./Microi.Server/Dos.ORM/SqlCompilation/Drivers/PostgreSqlDbDriverAdapter.cs ./Microi.Server/Dos.ORM/SqlCompilation/Drivers/DaMengDbDriverAdapter.cs ./Microi.Server/Dos.ORM/SqlCompilation/Drivers/KingBaseDbDriverAdapter.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/DatabaseLifecycleFacadeTests.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/DatabaseDiagnosticsFacadeTests.cs ./Microi.Server/Microi.Core/Services/EmptyDatabaseReleaseService.cs ./Microi.Server/Microi.Core/Services/MicroiDatabaseResourceProvider.cs ./Microi.Server/Microi.net.Api/Controllers/SystemMonitorController.cs ./Microi.Server/Microi.net.Api/Controllers/OsController.cs ./Microi.Server/Microi.net.Api/Handler/UEditor/Config.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/TenantHarness.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/Lifecycle/TenantLifecycleTests.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/Lifecycle/DatabaseDiagnosticsContractTests.cs ./Microi.Server/tests/Microi.Server.IntegrationTests/Lifecycle/DatabaseResourceBoundaryTests.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "refactor: centralize database lifecycle and diagnostics"

git -C ./Microi.Server/Microi.net status --short -- ./Common/TenantProvisioningService.cs ./Common/DbConnectionDiagnostics.cs ./Common/TenantSqlExecutionAuthorizer.cs
git -C ./Microi.Server/Microi.net add -- ./Common/TenantProvisioningService.cs ./Common/DbConnectionDiagnostics.cs ./Common/TenantSqlExecutionAuthorizer.cs
git -C ./Microi.Server/Microi.net diff --cached --name-only
git -C ./Microi.Server/Microi.net diff --cached --check
git -C ./Microi.Server/Microi.net commit -m "refactor: use source-only lifecycle and diagnostics facade"

git -C ./Microi.Server/Microi.AI status --short
~~~

# Dos.ORM Legacy API to AST Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Route the existing Dos.ORM public APIs through the new AST/compiler platform while preserving source compatibility and preventing double execution.

**Architecture:** Existing Field, Clip, Section, DbSession, DML, SqlFunc, Upsert, BulkCopy, CodeFirst, and IMicroiORM entry points become compatibility facades. Legacy, Compare, and Ast modes permit staged verification; Compare compiles both paths but executes only the legacy path, and each migrated module deletes its frozen legacy generator after switching to Ast.

**Tech Stack:** Existing Dos.ORM netstandard2.1 API, new SQL AST/compiler platform, xUnit compatibility tests, fake DbConnection/DbCommand capture tests.

## Global Constraints

- Every command in this plan is run from the workspace root
  (`D:\Work\microi.net.all`) and every project/file argument therefore starts
  with `./Microi.Server/...`. Do not change the working directory to
  `Microi.Server` and do not reinterpret the paths as relative to a child
  repository.
- Existing public and protected signatures remain source-compatible; add overloads instead of changing signatures.
- IMicroiORM receives no new members.
- DbProvider receives no new abstract members.
- Legacy FromSql(string) remains opaque and retains historical behavior.
- New platform-owned operations use FromAst/ExecuteAst and never use FromSql as an escape hatch.
- Compare mode never executes both write plans.
- AST commands bypass Provider regex SQL rewriting.
- Runtime parameters are bound through IDbDriverAdapter and the active transaction.
- ProviderFactory performs configuration parsing only: one exact recognized
  legacy alias maps to one configured `DatabaseType` and one configured ordinal
  compatibility-mode string. It never opens a connection, detects a server
  version, creates/resolves a `DialectProfile`, calls the platform registry, or
  caches a live profile. `DbProvider` exposes no public `Platform`, compiler,
  capability, driver, or live-profile property that could become stale.
- Only after the selected provider connection is open does the Dos.ORM bootstrap
  driver run the authoritative vendor probes and deterministically establish an
  exact `Major.Minor.Build.Revision` under the frozen vendor-specific padding/
  suffix rules plus exact ordinal mode. Malformed/overflowing/ambiguous data or
  a required-mode mismatch fails; then and only then call
  `DatabasePlatformRegistry.Get(exactLiveProfile)`.
- Public managed-execution APIs accept source AST/native requests, invocation
  values, requested atomicity, and the distinct compiled-approval overload.
  PreviewMigration/PreviewAdmin may return an immutable DatabaseExecutionPlan;
  no public/protected execution or materialization API accepts one, a
  materializer, ticket, or arbitrary DbConnection/DbTransaction context.
- `CreateDatabaseOperation`/`DropDatabaseOperation` are neutral logical-target
  requests at this public boundary. The internal admin coordinator maps them to
  literal database lifecycle only where the exact capabilities allow it;
  Oracle and DM8 map them to elevated schema-owner/user create/drop using
  secrets from registered connection configuration, never from the source DTO.
  This mapping does not change those profiles' false literal
  Create/DropDatabase capabilities.
- `FromAst`/`FromNativeSql` return the existing `SqlSection` only in an internal
  lazy managed mode holding source/definitions/`ParameterBag`; compile,
  preflight, command materialization, and execution occur only at a terminal
  `To*`/`ExecuteNonQuery` call. Managed parameter/transaction mutators poison
  and fail before command creation, while legacy `FromSql(string)` behavior is
  unchanged. No public SQL-text/command/managed-state property is added.
- Import/export resource bytes cross the public boundary only through the
  exact source-handle interface `IDatabaseResourceProvider`; Microi supplies a
  `DatabaseResourceHandle`, never SQL, a file path, provider-specific ADO, or a
  compiled plan. Its exact methods are
  `Stream OpenRead(DatabaseResourceHandle resource)` and
  `Stream OpenWrite(DatabaseResourceHandle resource)`.
- Import validates the handle's lower-hex SHA-256 `ContentDigest` while
  streaming into a Dos.ORM-owned bounded spool before any parser or database
  command runs. Export streams first into the same private spool, validates the
  completed digest, and only then opens/publishes the destination stream. A
  missing provider, null/wrong-capability stream, digest mismatch, or provider
  failure is fail-closed; no SQL/driver fallback exists.
- Commands materialized from a validated plan are created and executed only
  inside the registry-selected coordinator under a non-public single-use
  ticket; those commands never leave it.
- The ticket's private constructor carries the exact internal immutable
  platform definition and the exact driver instance selected after live
  bootstrap. `SqlCommandMaterializer` obtains command and parameter objects
  only through `ticket.Driver`; its driver call is exactly
  `CreateParameter(DbCommand command, PhysicalBoundParameter parameter)`.
- The existing public CommandCreator constructor and six mutable-command
  Insert/Update/Delete factories remain a separate caller-managed legacy
  escape hatch. They never consume a plan ticket or managed materializer and
  receive none of the managed gate, profile-preflight, replay, or atomicity
  guarantees.
- New AST/migration/admin/native entry points and migrated Microi.Server
  framework paths never call CommandCreator; only existing legacy Dos.ORM
  DbSession/DbBatch compatibility paths may continue to use it.
- Downstream Microi.net/Microi.AI code uses only the public source-only
  `DbSession` methods frozen in Task 3. It cannot name internal
  `IDatabaseAdmin`, `IDatabaseDiagnostics`, `IConnectionPolicy`, platform
  definition, driver, ticket, coordinator, or materializer types. Lifecycle
  requests use the admin source overloads; diagnostics use the existing
  `DatabaseDiagnosticOperation : SqlStatement` through `FromAst`. They require
  no internal-service-facing public method and accept no compiled plan, raw
  SQL, provider, driver, connection, transaction, or command.
- Before creating the first command, preflight validates the exact detected live DialectProfile, current Task 6 source fingerprint and neutral/admin gate, compiled-impact gate, SchemaToken, compiled fingerprint, and Required shared scope.
- Elevated migration/admin execution follows preview -> external authorization
  -> audit-only CompiledImpactApproval -> exact source recompile against current
  live options -> approval attachment -> current authorization and full
  preflight. Preview plans are never execution inputs.
- At Task 2 Step 0, after core, six-dialect, and Task 1 tests are green but
  before Task 2 changes production or public API, commit one immutable
  canonical snapshot of the complete Dos.ORM public/protected type/member/
  base/interface/interface-map surface. It excludes the public authorizer that
  Task 2 introduces. Task 2 thereafter runs only the permanent baseline-subset
  assertion; Task 3 first adds the final exact-delta assertion. Every later
  assembly delta must match the literal managed allowlist; no unclassified
  public/protected type, member, interface, or explicit-interface target is
  allowed, and the snapshot is never regenerated.
- A cycle-safe recursive type-graph gate starts only from every exact assembly
  delta signature and reachable user-owned request type. It rejects nested
  plan/ticket/materializer/coordinator/command/raw-context, object/dynamic,
  open-generic, untyped-dictionary, delegate, and request escape shapes.
  `System.Object` is a stop sentinel only as the terminal base of an already
  accepted user DTO, never an allowed payload.
- CommandCreator is a separate exact legacy exception: one public constructor,
  six complete public instance method descriptors, exact empty interface and
  protected surfaces, and no additional declared accessible member of any kind.
- Required binds every step to one reference-identical current DbConnection and one reference-identical DbTransaction; preflight failure creates and executes zero commands and never downgrades.
- Bulk fallback uses the caller transaction and database parameter limits.
- CodeFirst, DDL, metadata, pagination, functions, Upsert, and Bulk database differences remain entirely inside Dos.ORM.
- The six-dialect plan activates `DatabasePlatformRegistry` only in Task 6B,
  after all six real compilers and the Oracle private-IR allocation path pass.
  Its public sealed descriptor deliberately contains only Type, defensive
  Aliases, the exact Profile reference, non-null Compiler, and non-null
  Capabilities. Legacy Task 1 does not consume that descriptor at all; Task 2
  resolves it only after live bootstrap. Driver/Bulk/Admin/Schema services are
  never assumed to be public descriptor properties.
- Platform services are phased without public-surface drift. Type/schema/admin
  helpers remain internal to real compilers. Legacy Task 2 creates
  `IDbDriverAdapter` and extends the registry's private immutable platform
  definition with the driver factory before managed execution uses it; later
  Bulk/Admin/Diagnostics/ConnectionPolicy services follow the same internal
  definition pattern in their owning tasks. They never require public
  `DatabasePlatformDescriptor` growth. If a future reviewed design does require
  public descriptor growth, it must land before Task 2 Step 0 captures the
  canonical baseline; after capture it is forbidden unless present in the
  literal exact-delta allowlist.

---

### Task 1: Normalize exact legacy provider configuration without resolving a live platform

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
- Create: Microi.Server/Dos.ORM/Provider/ConfiguredProviderIdentity.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/LegacyProviderAliasCases.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/ProviderTestFactory.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/ProviderPlatformBindingTests.cs

**Interfaces:**
- Consumes: only legacy provider configuration (`assemblyName`, `className`,
  optional `DatabaseType`, connection string) and the fixed exact-alias table
  below. This task deliberately does not consume `DatabasePlatformRegistry`.
- Produces: an internal immutable `ConfiguredProviderIdentity` containing only
  `DatabaseType` and ordinal `CompatibilityMode`, retained by `DbProvider`
  without changing its public surface. Task 2 consumes that identity after a
  connection opens.

- [ ] **Step 1: Write failing provider binding tests**

~~~csharp
[Theory]
[MemberData(nameof(LegacyProviderAliasCases.OfficialSix),
    MemberType = typeof(LegacyProviderAliasCases))]
public void Exact_legacy_alias_maps_configuration_without_live_detection(
    string assemblyName,
    string className,
    DatabaseType expectedType,
    string expectedMode)
{
    var capture = ProviderTestFactory.CreateWithoutOpening(
        assemblyName, className);

    Assert.Equal(expectedType, capture.Provider.DatabaseType);
    Assert.Equal(expectedMode,
        capture.Provider.ConfiguredIdentity.CompatibilityMode);
    Assert.Equal(0, capture.Connection.OpenCalls);
    Assert.Equal(0, capture.ProfileDetectorCalls);
    Assert.Equal(0, capture.RegistryGetCalls);
    Assert.Null(typeof(DbProvider).GetProperty("Platform",
        BindingFlags.Public | BindingFlags.Instance));
}

[Theory]
[InlineData(null, "prefix.mysql.suffix")]
[InlineData(null, "Oracle.ManagedDataAccess.Client.Custom")]
[InlineData(null, "not-npgsql-wrapper")]
[InlineData(null, "kingbase-compatible")]
[InlineData("Custom.Provider.Assembly", "Dos.ORM.MySql.MySqlProvider")]
public void Substring_unknown_alias_or_unknown_assembly_fails_closed(
    string assemblyName, string className)
{
    Assert.Throws<NotSupportedException>(() =>
        ProviderTestFactory.CreateWithoutOpening(assemblyName, className));
}

[Theory]
[InlineData("Dos.ORM.MySql.MySqlProvider", DatabaseType.Oracle)]
[InlineData("Npgsql", DatabaseType.SqlServer)]
[InlineData("dm", DatabaseType.PostgreSql)]
public void Exact_alias_and_explicit_type_mismatch_fails_before_cache(
    string className, DatabaseType explicitType)
{
    var capture = ProviderTestFactory.CreateFailureCapture();
    Assert.Throws<InvalidOperationException>(() => capture.Create(
        null, className, explicitType));
    Assert.Equal(0, capture.ProviderCacheWrites);
    Assert.Equal(0, capture.Connection.OpenCalls);
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter FullyQualifiedName~ProviderPlatformBindingTests --nologo
~~~

Expected: FAIL because the current parser accepts substring aliases and no
configuration-only identity/fail-closed contract exists.

- [ ] **Step 3: Add the internal configuration identity and exact parser**

~~~csharp
internal sealed class ConfiguredProviderIdentity
{
    internal ConfiguredProviderIdentity(
        DatabaseType databaseType,
        string compatibilityMode)
    {
        DatabaseType = databaseType;
        CompatibilityMode = compatibilityMode ?? string.Empty;
    }

    internal DatabaseType DatabaseType { get; }
    internal string CompatibilityMode { get; }
}
~~~

Replace substring matching with one ordinal-ignore-case dictionary whose keys
are complete `(assemblyName, className)` tuples. Official merged-provider rows
accept only null/empty assembly or the exact historical matching assembly
(`Dos.ORM`, `Dos.ORM.MySql`, `Dos.ORM.SqlServer`, `Dos.ORM.Oracle`,
`Dos.ORM.PostgreSql`, `Dos.ORM.DaMeng`, or `Dos.ORM.KingBase` as applicable);
an arbitrary assembly with a valid class alias fails. Freeze these exact rows in
`LegacyProviderAliasCases.OfficialSix` and test every row: MySQL
`mysql`, `Dos.ORM.MySql`, `Dos.ORM.MySql.MySqlProvider` ->
`(MySql, "")`; SQL Server `System.Data.SqlClient`, `Dos.ORM.SqlServer`,
`Dos.ORM.SqlServer.SqlServerProvider` -> `(SqlServer, "")`; Oracle `oracle`,
`Dos.ORM.Oracle`, `Dos.ORM.Oracle.OracleProvider` -> `(Oracle, "")`;
PostgreSQL `postgresql`, `pgsql`, `Npgsql`, `Dos.ORM.PostgreSql`,
`Dos.ORM.PostgreSql.PostgreSqlProvider` -> `(PostgreSql, "")`; DM8 `dameng`,
`dm`, `dmprovider`, `Dos.ORM.DaMeng`, `Dos.ORM.DaMeng.DaMengProvider` ->
`(DaMeng, "Oracle")`; KingbaseES `kingbase`, `kdbndp`, `Dos.ORM.KingBase`,
`Dos.ORM.KingBase.KingBaseProvider` -> `(KingBase, "PostgreSQL")`.

The historical null/empty class-name default is one separately tested exact
configuration case for SQL Server; it is not a wildcard. Preserve explicit
MsAccess, Sqlite3, and SqlServer9 exact paths outside the official-six table.
If a non-null `databaseType` disagrees with the alias, throw before the provider
cache. The provider cache key contains the canonical provider class,
connection string, configured database type, and ordinal configured mode—but
never a `DialectProfile`, compiler, capabilities, detected version, or platform
descriptor. No code in this task calls `Resolve` or `Get` on the registry.

- [ ] **Step 4: Run and verify GREEN**

Run the focused command from Step 2 and PublicApiBaselineTests. Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git status --short -- ./Microi.Server/Dos.ORM/Provider ./Microi.Server/Dos.ORM.Tests
git add -- ./Microi.Server/Dos.ORM/Provider/DbProvider.cs ./Microi.Server/Dos.ORM/Provider/ProviderFactory.cs ./Microi.Server/Dos.ORM/Provider/MySqlProvider.cs ./Microi.Server/Dos.ORM/Provider/SqlServerProvider.cs ./Microi.Server/Dos.ORM/Provider/SqlServer9Provider.cs ./Microi.Server/Dos.ORM/Provider/OracleProvider.cs ./Microi.Server/Dos.ORM/Provider/PostgreSqlProvider.cs ./Microi.Server/Dos.ORM/Provider/DaMengProvider.cs ./Microi.Server/Dos.ORM/Provider/KingBaseProvider.cs ./Microi.Server/Dos.ORM/Provider/ConfiguredProviderIdentity.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/ProviderPlatformBindingTests.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/LegacyProviderAliasCases.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/ProviderTestFactory.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "refactor: normalize exact legacy provider configuration"
~~~

### Task 2: Validate and internally execute compiled plans without a public materialization bypass

**Files:**
- Modify: Microi.Server/Dos.ORM.Tests/Compatibility/PublicApiBaselineTests.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/CanonicalPublicApiSurface.cs
- Create: Microi.Server/Dos.ORM.Tests/Baselines/dos-orm-pre-managed-delta-public-api.txt
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlExecutionPreflight.cs (contains the nested private-constructible ticket)
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlExecutionCoordinator.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlCommandMaterializer.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/PhysicalBoundParameter.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/IDbDriverAdapter.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/DatabasePlatformBootstrap.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/DatabaseTargetIdentity.cs
- Create: Microi.Server/Dos.ORM/Diagnostics/ManagedBootstrapEventSource.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/ManagedBootstrapTrace.cs
- Create: Microi.Server/Dos.ORM/Diagnostics/ManagedAdminTransitionEventSource.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/ManagedAdminTransitionTrace.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/Drivers/MySqlDbDriverAdapter.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/Drivers/SqlServerDbDriverAdapter.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/Drivers/OracleDbDriverAdapter.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/Drivers/PostgreSqlDbDriverAdapter.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/Drivers/DaMengDbDriverAdapter.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/Drivers/KingBaseDbDriverAdapter.cs
- Modify: Microi.Server/Dos.ORM/Platform/DatabasePlatformDefinition.cs
- Modify: Microi.Server/Dos.ORM/Platform/DatabasePlatformRegistry.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/IManagedSqlExecutionAuthorizer.cs
- Modify: Microi.Server/Dos.ORM/Db/Database.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/FakeDbDriver.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/TestConnections.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/ExecutionHarness.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/DriverBootstrapCases.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/DriverVersionProbeCases.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/BootstrapEventCapture.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/AdminTransitionEventCapture.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/StorageContractCases.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/TargetIdentityCases.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/ManagedBootstrapDiagnosticsTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/ManagedAdminTransitionDiagnosticsTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/StorageContractPreflightTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/DatabaseTargetIdentityProbeTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/DriverBootstrapTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/SqlExecutionPreflightTests.cs

**Interfaces:**
- Produces only internal registry-selected managed coordinator/preflight/ticket/
  materializer execution; no public/protected managed command materialization
  API and no execution API accepting a plan.
- Consumes exact source AST/native request, invocation ParameterBag, requested
  atomicity, optional-by-overload compiled approval for elevated
  migration/admin, active Database-owned already-open connection/transaction,
  Task 1 configured identity, detected exact live `DialectProfile`, current
  SchemaToken, current authorization, exact internal platform definition, its
  registered compiler, and the exact production driver instance.

- [ ] **Step 0: Freeze the complete assembly surface before Task 2 production edits**

After Task 1 is committed, run all core, six-dialect, and adapter Task 1 tests
green. Before adding `IManagedSqlExecutionAuthorizer` or changing any Task 2
production/API file, implement `CanonicalPublicApiSurface` and use it once to
write and review `dos-orm-pre-managed-delta-public-api.txt`.

The canonical snapshot includes the public Task 1A 30-scalar capability class
and Task 6B descriptor/registry. Task 1 added only internal configuration state,
so the complete pre-existing public/protected `DbProvider` surface remains
unchanged and is captured exactly—there are no Task 1 `Platform`, compiler,
capabilities, driver, or live-profile compatibility properties.
It intentionally does not contain `SqlCompilerBase`, `SqlTextWriter`,
`SqlLoweringContext`, `AllocatedSqlNode`, `RenderedSql`, the private-IR
descriptor/resolver, or real dialect compiler classes because all are internal.
Those internal compiler components are not a public/protected delta and must
never be added to `Task7PublicApiDeltaAllowlist`.

Task 2 Step 0 owns the complete helper implementation. When
`CanonicalPublicApiSurface.cs` is created, it implements all three comparison
methods: `AssertExactCurrentMatchesBaseline`,
`AssertBaselineSubsetUnchanged`, and `AssertBaselinePlusExactDelta`. All three
consume the same canonical descriptor serializer/parser and ordinal key/shape
comparison rules. The third method accepts the independent expected-delta
descriptor-string set; it is not deferred to, created by, or modified in
Task 3.

The serializer walks every public top-level and public/protected nested type in
`typeof(Database).Assembly`. For each type it writes a stable ordinal-sorted
descriptor for kind/visibility/abstract/sealed/generic shape, exact `BaseType`,
exact `GetInterfaces()` set, every `GetInterfaceMap()` interface-method to
target-method/base-definition entry (including private explicit targets), and
every declared accessible method/constructor/field/property/indexer/event/
nested type. It enumerates with
`Public | NonPublic | Instance | Static | DeclaredOnly`, recognizes public,
family, family-or-assembly, and family-and-assembly visibility, and includes
operators/conversions/accessors/extension methods in the method set. Member
descriptors include full type identities, flags, generic constraints, ordered
parameter type/name/ref-out-array/`params`/optional/default shape, but exclude
metadata tokens and build paths.

Temporarily add the exact-current verification and permanently add the subset
test:

~~~csharp
[Fact]
public void Baseline_capture_matches_current_before_managed_delta()
{
    CanonicalPublicApiSurface.AssertExactCurrentMatchesBaseline(
        typeof(Database).Assembly,
        "Baselines/dos-orm-pre-managed-delta-public-api.txt");
    CanonicalPublicApiSurface.AssertBaselinePlusExactDelta(
        typeof(Database).Assembly,
        "Baselines/dos-orm-pre-managed-delta-public-api.txt",
        Array.Empty<string>());
}

[Fact]
public void Baseline_symbols_remain_present_with_identical_shape()
{
    CanonicalPublicApiSurface.AssertBaselineSubsetUnchanged(
        typeof(Database).Assembly,
        "Baselines/dos-orm-pre-managed-delta-public-api.txt");
}
~~~

Run both tests GREEN and separately record the literal/current SHA-256 equality
and the successful empty-delta comparison. Then delete the entire temporary
`Baseline_capture_matches_current_before_managed_delta` test, including both
calls; do not delete any of the three helper methods. Rerun the permanent subset
test GREEN, and commit the literal, complete three-method helper, and permanent
subset before Step 1:

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter FullyQualifiedName~PublicApiBaselineTests --nologo
git status --short -- ./Microi.Server/Dos.ORM.Tests
git add -- ./Microi.Server/Dos.ORM.Tests/Baselines/dos-orm-pre-managed-delta-public-api.txt ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/CanonicalPublicApiSurface.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/PublicApiBaselineTests.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "test: freeze complete Dos.ORM public API surface"
~~~

The committed tests expose no capture/update/accept mode. From this point
through the end of Task 2, run only
`Baseline_symbols_remain_present_with_identical_shape`; do not create the
final exact-delta assertion yet and never regenerate the literal.

- [ ] **Step 1: Write failing preflight and zero-partial-start tests**

~~~csharp
[Fact]
public void Required_uses_one_reference_identical_connection_and_transaction()
{
    var capture = ExecutionHarness.RequiredSuccess();
    capture.ExecuteThroughInternalCoordinator();

    Assert.NotEmpty(capture.Commands);
    Assert.All(capture.Commands, command =>
    {
        Assert.Same(capture.Connection, command.Connection);
        Assert.Same(capture.Transaction, command.Transaction);
    });
    Assert.Same(capture.Connection, capture.Transaction.Connection);
}

[Theory]
[InlineData(ExecutionFailure.SecondConnection)]
[InlineData(ExecutionFailure.SecondTransaction)]
[InlineData(ExecutionFailure.TransactionConnectionMismatch)]
[InlineData(ExecutionFailure.LiveProfileTypeMismatch)]
[InlineData(ExecutionFailure.LiveProfileMajorMismatch)]
[InlineData(ExecutionFailure.LiveProfileMinorMismatch)]
[InlineData(ExecutionFailure.LiveProfileBuildMismatch)]
[InlineData(ExecutionFailure.LiveProfileRevisionMismatch)]
[InlineData(ExecutionFailure.LiveProfileModeMismatch)]
[InlineData(ExecutionFailure.RouteMismatch)]
[InlineData(ExecutionFailure.EnlistmentMismatch)]
[InlineData(ExecutionFailure.StaleSchemaToken)]
[InlineData(ExecutionFailure.StaleSourceFingerprint)]
[InlineData(ExecutionFailure.ClosedNeutralGate)]
[InlineData(ExecutionFailure.ClosedAdminGate)]
[InlineData(ExecutionFailure.ClosedCompiledGate)]
[InlineData(ExecutionFailure.StaleCompiledFingerprint)]
[InlineData(ExecutionFailure.AdminOperationBindingMismatch)]
public void Preflight_failure_creates_and_executes_zero_commands(
    ExecutionFailure failure)
{
    var capture = ExecutionHarness.RequiredFailure(failure);
    Assert.Throws<InvalidOperationException>(
        () => capture.ExecuteThroughInternalCoordinator());
    Assert.Equal(0, capture.Driver.CreateCommandCalls);
    Assert.Equal(0, capture.ExecuteCalls);
}

[Fact]
public void Public_surface_has_no_plan_materialization_or_ticket_constructor()
{
    Assert.DoesNotContain(typeof(DbSession).Assembly.GetExportedTypes()
            .SelectMany(type => type.GetMethods(
                BindingFlags.Public | BindingFlags.NonPublic |
                BindingFlags.Instance | BindingFlags.Static)),
        method => (method.IsPublic || method.IsFamily ||
                   method.IsFamilyOrAssembly) &&
                  method.GetParameters().Any(parameter =>
                      parameter.ParameterType ==
                          typeof(DatabaseExecutionPlan)));
    var ticketType = typeof(DbSession).Assembly.GetType(
        "Dos.ORM.SqlCompilation.SqlExecutionPreflight+ValidatedExecutionTicket",
        throwOnError: true);
    Assert.Empty(ticketType.GetConstructors(
        BindingFlags.Public | BindingFlags.Instance));
    var constructor = Assert.Single(ticketType.GetConstructors(
        BindingFlags.NonPublic | BindingFlags.Instance));
    Assert.True(constructor.IsPrivate);
    Assert.Equal(new[]
    {
        "plan:DatabaseExecutionPlan",
        "platformDefinition:DatabasePlatformDefinition",
        "driver:IDbDriverAdapter",
        "connection:DbConnection",
        "transaction:DbTransaction",
        "liveProfile:DialectProfile",
        "schemaToken:SchemaToken",
        "storageContract:DatabaseStorageContract",
        "pendingImportContract:PendingImportStorageContract",
        "bootstrapTrace:ManagedBootstrapTrace"
    }, constructor.GetParameters().Select(parameter =>
        $"{parameter.Name}:{parameter.ParameterType.Name}"));
}

[Theory]
[MemberData(nameof(DriverBootstrapCases.Certified),
    MemberType = typeof(DriverBootstrapCases))]
public void Open_connection_detects_exact_profile_then_resolves_registry(
    DriverBootstrapCase sample)
{
    var capture = ExecutionHarness.Bootstrap(sample);
    Assert.Equal(0, capture.Driver.DetectProfileCalls);
    Assert.Equal(0, capture.RegistryGetCalls);

    capture.OpenAndBootstrap();
    capture.PreflightPortableSelect();

    Assert.Equal(ConnectionState.Open, capture.Connection.State);
    Assert.Equal(1, capture.Driver.DetectProfileCalls);
    Assert.Equal(1, capture.RegistryGetCalls);
    Assert.Equal(sample.DatabaseType, capture.LiveProfile.DatabaseType);
    Assert.Equal(sample.Major, capture.LiveProfile.ServerVersion.Major);
    Assert.Equal(sample.Minor, capture.LiveProfile.ServerVersion.Minor);
    Assert.Equal(sample.Build, capture.LiveProfile.ServerVersion.Build);
    Assert.Equal(sample.Revision, capture.LiveProfile.ServerVersion.Revision);
    Assert.Equal(sample.CompatibilityMode,
        capture.LiveProfile.CompatibilityMode, StringComparer.Ordinal);
    Assert.Same(capture.LiveProfile, capture.Descriptor.Profile);
    Assert.Same(capture.PlatformDefinition, capture.Ticket.PlatformDefinition);
    Assert.Same(capture.Driver, capture.Ticket.Driver);
    Assert.Equal(sample.ExpectedDriverType, capture.Driver.GetType());
}

[Fact]
public void Bootstrap_events_are_ordered_and_value_safe()
{
    using var listener = BootstrapEventCapture.Listen(
        "Dos-ORM-ManagedBootstrap");
    var capture = ExecutionHarness.Bootstrap(TestProfiles.PostgreSql17);
    capture.OpenBootstrapCompileAndPreflight();

    Assert.Equal(new[]
    {
        "ConnectionOpened", "ProfileDetected", "CompilerResolved",
        "DriverResolved", "ExecutionPlanCompiled"
    }, listener.Events.Select(x => x.Name));
    Assert.All(listener.Events, x =>
        BootstrapEventAssert.ContainsOnlySafeIdentityFields(x));
    Assert.All(listener.Events, x =>
        Assert.DoesNotContain(capture.SecretSentinels,
            sentinel => x.SerializedPayload.Contains(sentinel,
                StringComparison.Ordinal)));
}

[Theory]
[MemberData(nameof(StorageContractCases.Invalid),
    MemberType = typeof(StorageContractCases))]
public void Invalid_storage_contract_starts_no_business_command(
    StorageContractCase sample)
{
    var capture = ExecutionHarness.StorageContractFailure(sample);
    Assert.Throws<InvalidOperationException>(
        () => capture.ExecutePortableTextRoundTrip());
    Assert.Equal(0, capture.Driver.CreateBusinessCommandCalls);
    Assert.Equal(0, capture.Driver.ExecuteBusinessCalls);
    Assert.Equal(sample.ExpectedMetadataProbeCalls,
        capture.Driver.StorageContractProbeCalls);
}

[Theory]
[InlineData(DriverBootstrapFailure.ConnectionNotOpen)]
[InlineData(DriverBootstrapFailure.ConfiguredModeMismatch)]
[InlineData(DriverBootstrapFailure.DmModeTextInsteadOfRawTwo)]
[InlineData(DriverBootstrapFailure.KingbaseModeCaseMismatch)]
[InlineData(DriverBootstrapFailure.UnsupportedExactVersion)]
public void Bootstrap_failure_resolves_no_platform_and_creates_no_command(
    DriverBootstrapFailure failure)
{
    var capture = ExecutionHarness.BootstrapFailure(failure);
    Assert.ThrowsAny<Exception>(() => capture.OpenAndBootstrap());
    Assert.Equal(0, capture.SuccessfulRegistryResolutions);
    Assert.Equal(0, capture.Driver.CreateCommandCalls);
}

[Theory]
[MemberData(nameof(DriverVersionProbeCases.Valid),
    MemberType = typeof(DriverVersionProbeCases))]
public void Authoritative_probe_maps_real_vendor_version_deterministically(
    DriverVersionProbeCase sample)
{
    var capture = ExecutionHarness.VersionProbe(sample);
    capture.OpenAndBootstrap();

    Assert.Equal(sample.AuthoritativeProbeSqlSequence,
        capture.ExecutedProbeSqlSequence);
    Assert.Equal(sample.ExpectedExactVersion,
        capture.LiveProfile.ServerVersion);
    Assert.Equal(sample.ExpectedCanonicalMode,
        capture.LiveProfile.CompatibilityMode,
        StringComparer.Ordinal);
    Assert.Equal(1, capture.SuccessfulRegistryResolutions);
}

[Theory]
[MemberData(nameof(DriverVersionProbeCases.Invalid),
    MemberType = typeof(DriverVersionProbeCases))]
public void Malformed_overflow_or_ambiguous_probe_fails_before_resolution(
    DriverVersionProbeCase sample)
{
    var capture = ExecutionHarness.VersionProbe(sample);
    Assert.Throws<InvalidOperationException>(
        () => capture.OpenAndBootstrap());
    Assert.Equal(0, capture.SuccessfulRegistryResolutions);
    Assert.Equal(0, capture.Driver.CreateCommandCalls);
}

[Fact]
public void Same_configured_provider_does_not_cache_first_live_profile()
{
    var capture = ExecutionHarness.TwoPostgreSqlServers(
        new Version(14, 11, 0, 0),
        new Version(17, 2, 0, 0));

    capture.OpenBothAndBootstrap();

    Assert.Same(capture.ConfiguredProvider,
        capture.SecondConfiguredProvider);
    Assert.NotSame(capture.FirstLiveProfile, capture.SecondLiveProfile);
    Assert.Equal(new Version(14, 11, 0, 0),
        capture.FirstLiveProfile.ServerVersion);
    Assert.Equal(new Version(17, 2, 0, 0),
        capture.SecondLiveProfile.ServerVersion);
    Assert.Equal(2, capture.RegistryGetCalls);
}

[Fact]
public void Materializer_uses_only_ticket_driver_and_owning_command_for_parameters()
{
    var capture = ExecutionHarness.TwoParameterPortableSelect();
    capture.ExecuteThroughInternalCoordinator();

    Assert.Same(capture.BootstrappedDriver, capture.Ticket.Driver);
    Assert.Equal(capture.ExpectedBoundParameterCount,
        capture.BootstrappedDriver.CreateParameterCalls);
    Assert.All(capture.BootstrappedDriver.ParameterBindings, binding =>
        Assert.Same(binding.Command,
            binding.CommandObservedByCreateParameter));
    Assert.Equal(0, capture.MaterializerRegistryLookups);
    Assert.Equal(0, capture.MaterializerProviderFactoryLookups);
    Assert.Equal(0, capture.ProviderSpecificParameterConstructions);
}
~~~

`DriverBootstrapCases.Certified` contains ten fresh exact registry-boundary
cases: MySQL
`5.7.8.0` and `8.0.11.0`; SQL Server `14.0.0.0` and `16.0.0.0`; Oracle
`11.2.0.4` and `19.0.0.0`; PostgreSQL `14.0.0.0` and `17.0.0.0`; DM8
`8.1.3.140` with exact canonical ordinal mode `"Oracle"`; and KingbaseES
`9.4.12.0` with exact
ordinal mode `"PostgreSQL"`. All other modes are `string.Empty`. Each row names
one of the six concrete production adapter types and each enumeration returns
reference-distinct profile/case objects.

`DriverVersionProbeCases.Valid` additionally freezes real authoritative scalar
samples and their exact four-part mappings: MySQL `8.0.36` -> `8.0.36.0` and
`5.7.44-log` -> `5.7.44.0`; SQL Server `16.0.1000.6` remains
`16.0.1000.6`; Oracle `11.2.0.4` remains `11.2.0.4` and
`19.22.0.0.0` -> `19.22.0.0`; PostgreSQL `server_version_num=170002`
plus `server_version=17.2` -> `17.2.0.0`, and `140011` plus
`14.11 (Debian 14.11-1.pgdg120+1)` -> `14.11.0.0`; DM8's authoritative
`ID_CODE()` first component `03134284172` decodes to `8.1.3.140`, while raw
mode `2` maps to canonical mode `"Oracle"`; KingbaseES
`server_version=9.4.12` -> `9.4.12.0` and raw
`database_mode=pg` -> canonical mode `"PostgreSQL"`. The invalid table covers
null/empty scalars, illegal whitespace/control or suffix characters, component
overflow, an extra unaccounted numeric component, a discarded non-zero Oracle
fifth component, PostgreSQL text/numeric disagreement, invalid DM build/
edition/packed-ID/raw-mode grammar, and invalid Kingbase raw mode. Every invalid row resolves no
platform and creates no managed command.

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~DriverBootstrapTests|FullyQualifiedName~SqlExecutionPreflightTests|FullyQualifiedName~ManagedBootstrapDiagnosticsTests|FullyQualifiedName~ManagedAdminTransitionDiagnosticsTests|FullyQualifiedName~StorageContractPreflightTests|FullyQualifiedName~DatabaseTargetIdentityProbeTests" --nologo
~~~

Expected: FAIL because the old plan exposes no validated ticket/coordinator and the reviewed materializer surface has not been implemented.

- [ ] **Step 3: Add the internal validated execution path**

~~~csharp
internal interface IDbDriverAdapter
{
    DialectProfile DetectProfile(DbConnection openedConnection);
    SchemaToken ReadSchemaToken(DbConnection connection,
        DbTransaction transaction);
    DatabaseStorageContractReadResult ReadStorageContract(
        DbConnection connection,
        DbTransaction transaction,
        SchemaToken schemaToken);
    DatabaseTargetIdentityMaterial ReadTargetIdentity(
        DbConnection openedConnection);
    DbCommand CreateCommand(DbConnection connection);
    DbParameter CreateParameter(
        DbCommand command,
        PhysicalBoundParameter parameter);
    string NormalizeConnectionString(string connectionString);
}

public interface IManagedSqlExecutionAuthorizer
{
    void DemandMigrationExecution(
        MigrationPlan source);

    void DemandMigrationExecution(
        MigrationPlan source,
        CompiledImpactApproval approval);

    void DemandAdminExecution(
        DatabaseAdminOperation source);

    void DemandAdminExecution(
        DatabaseAdminOperation source,
        CompiledImpactApproval approval);
}

internal static class SqlExecutionPreflight
{
    internal sealed class ValidatedExecutionTicket
    {
        private ValidatedExecutionTicket(
            DatabaseExecutionPlan plan,
            DatabasePlatformDefinition platformDefinition,
            IDbDriverAdapter driver,
            DbConnection connection,
            DbTransaction transaction,
            DialectProfile liveProfile,
            SchemaToken schemaToken,
            DatabaseStorageContract storageContract,
            PendingImportStorageContract pendingImportContract,
            ManagedBootstrapTrace bootstrapTrace);

        internal DatabaseExecutionPlan Plan { get; }
        internal DatabasePlatformDefinition PlatformDefinition { get; }
        internal IDbDriverAdapter Driver { get; }
        internal DbConnection Connection { get; }
        internal DbTransaction Transaction { get; }
        internal DialectProfile LiveProfile { get; }
        internal SchemaToken SchemaToken { get; }
        internal DatabaseStorageContract StorageContract { get; }
        internal PendingImportStorageContract PendingImportContract { get; }
        internal ManagedBootstrapTrace BootstrapTrace { get; }
        internal bool TryConsume();
    }
}

internal sealed class SqlCommandMaterializer
{
    internal IReadOnlyList<DbCommand> Materialize(
        SqlExecutionPreflight.ValidatedExecutionTicket ticket,
        ParameterBag values);
}
~~~

`DatabaseTargetIdentity.cs` owns an internal immutable
`DatabaseTargetIdentityMaterial`, an internal value
`DatabaseTargetIdentityFingerprint`, and the sole internal
`DatabaseTargetIdentityProbe`. The probe asks the already selected exact driver
for two nonempty authoritative parts—server/cluster instance and current
logical target—then encodes fixed field names and length-prefixed UTF-8 values
under domain `dosorm-target-instance-v1` together with the exact live profile
fingerprint and returns lowercase SHA-256 (exactly 64 hex characters). Raw
identity material is hashed immediately, never cached/logged/returned, and the
fingerprint contains no reversible server, catalog, schema, user, endpoint, or
credential text. A connection string, configured DatabaseType, profile, schema
digest, or row digest alone is never an identity substitute.

The six driver authorities are frozen as follows: MySQL uses live
`server_uuid` plus current catalog; SQL Server uses live server-instance
identity plus current database GUID; Oracle uses DB identity plus container
identity (the non-CDB sentinel for 11.2) plus current schema principal ID;
PostgreSQL uses cluster system identifier plus current database OID; DM8 uses
its live database/instance GUID plus current schema principal ID; KingbaseES
uses cluster system identifier plus current database OID. Each is read through
a parameter-free metadata-only command owned by that driver. Missing privilege,
blank/malformed/duplicate fields, unsupported server response, a value change
between two reads on one open scope, or profile mismatch fails closed; there is
no endpoint/name fallback. Unit cases freeze the exact authority field set per
profile, same-target stability, cross-target and cross-instance inequality,
same-profile/same-schema/same-row-digest target switching, secret redaction,
and every failure before evidence publication. Real certification additionally
proves each live driver changes the fingerprint when its logical target is
switched.

For an ordinary ticket, `StorageContract` is active and
`PendingImportContract` is null. For an import-transition ticket,
`StorageContract` is the artifact's expected active contract and
`PendingImportContract` is the exact database state bound to that artifact;
the materializer permits only the reserved pending-header/schema/catalog/
activation fragment bound by that contract. The later seed
`PortableSeedImportCoordinator` is the only production producer of that
fragment; this legacy task does not reference the later type. It rejects Select,
business DML, Returning, Bulk, user native SQL, and any source/import-binding/
outer-resource fingerprint mismatch. After activation the transition ticket is
consumed and a fresh
ordinary active ticket is mandatory for data. Thus pending state does not
become a general bypass or a second command path.

Implement six production drivers in the six explicitly owned files listed in
this task—no generic fake/reflection driver in production. Each reads its
vendor's authoritative version/mode metadata from an already-open connection
and applies the following frozen mapping. A legal vendor omission is padded
with zero according to this table; no adapter guesses a patch/build number.
Extra components are validated before the stated truncation. Parsing fails
only for null/empty, malformed, inconsistent, or `Int32`-overflowing probe
data; a well-formed but uncertified exact profile reaches the registry and is
rejected there.

Common parser rules are ordinal/culture-invariant: do not trim or Unicode-
normalize probe text; numeric components contain ASCII `0-9` only; each raw
text scalar is 1..256 characters; each allowed vendor suffix is at most 192
characters; every component is parsed with checked `Int32` arithmetic. Only
the literal spaces in the anchored DM banner and the single PostgreSQL-style
parenthesized suffix grammar are legal whitespace.

| Driver | Authoritative probe(s) and exact mapping to `Version` |
|---|---|
| MySQL | `SELECT VERSION()`; accept exactly three or four invariant ASCII decimal components. Three maps to `major.minor.build.0`; four is preserved. An optional `-suffix` is discarded only after non-empty, bounded ASCII `[0-9A-Za-z._+~-]` validation. A fifth numeric component, whitespace/control, sign, empty component, or overflow is malformed. Thus `8.0.36` -> `8.0.36.0` and `5.7.44-log` -> `5.7.44.0`. |
| SQL Server | `SELECT CONVERT(varchar(128), SERVERPROPERTY('ProductVersion'))`; require exactly four invariant ASCII decimal components and no suffix, then preserve all four. Thus `16.0.1000.6` remains exact. |
| Oracle | First query `VERSION_FULL` for the single `PRODUCT LIKE 'Oracle Database%'` row in `PRODUCT_COMPONENT_VERSION`; only the specific pre-18 `ORA-00904` missing-column case may fall back to that row's `VERSION`. Require exactly four components, or five with the fifth exactly zero. Preserve the first four; reject any other count or a non-zero discarded fifth. Thus `11.2.0.4` remains exact and `19.22.0.0.0` -> `19.22.0.0`. |
| PostgreSQL | In one scalar row read `current_setting('server_version_num')` and `current_setting('server_version')`. For 10+, the invariant six-digit number maps `major = n / 10000`, `minor = n % 10000`, `build=revision=0`; the text must start with the same `major.minor`. For the documented pre-10 encoding, map `major=n/10000`, `minor=(n/100)%100`, `build=n%100`, `revision=0`. A remaining text suffix is accepted only as a bounded ASCII hyphen token or one balanced parenthesized vendor suffix with no control characters. Thus `170002` plus `17.2` -> `17.2.0.0`. |
| DM8 | Read `SVR_VERSION`, `BUILD_VERSION`, the scalar `ID_CODE()`, and the exact `PARA_NAME='COMPATIBLE_MODE'` `PARA_VALUE` from `V$INSTANCE`/`V$DM_INI`. Require the anchored V8 banner and a non-empty bounded build identifier, but derive the semantic four-part version only from the first hyphen-delimited `ID_CODE()` component: require two ASCII edition digits followed by an unsigned invariant decimal packed value in `0..UInt32.MaxValue`, then decode its four big-endian bytes as `major.minor.build.revision` and require major `8`. Preserve all four decoded components; never substitute the banner or image tag. Thus `03134284172-...` decodes to `8.1.3.140`. Parse raw mode as invariant ASCII integer and accept only `2`, then emit canonical ordinal mode `"Oracle"`; raw `"2"` is never stored in the profile. Malformed edition/packed values, overflow, inconsistent banner, or unsupported mode fail before registry resolution. |
| KingbaseES | In one scalar row read `current_setting('server_version_num')`, `current_setting('server_version')`, and `current_setting('database_mode')`. Decode the documented pre-10 numeric encoding to `major.minor.build.0`, require the text prefix to agree, and validate any remaining suffix by the PostgreSQL suffix rule. Accept only exact raw lower-case mode `pg`, then emit canonical ordinal mode `"PostgreSQL"`. Thus `90412` plus `9.4.12` -> `9.4.12.0`. |

Freeze the exact read-only probe text as adapter-private ordinal constants (the
Oracle fallback is the only conditional second probe):

~~~sql
-- MySQL
SELECT VERSION()
-- SQL Server
SELECT CONVERT(varchar(128), SERVERPROPERTY('ProductVersion'))
-- Oracle 18+; pre-18 ORA-00904 fallback substitutes VERSION for VERSION_FULL
SELECT VERSION_FULL FROM PRODUCT_COMPONENT_VERSION
WHERE PRODUCT LIKE 'Oracle Database%'
-- PostgreSQL
SELECT current_setting('server_version_num'), current_setting('server_version')
-- DM8
SELECT I.SVR_VERSION, I.BUILD_VERSION, ID_CODE(),
       (SELECT PARA_VALUE FROM V$DM_INI
        WHERE PARA_NAME = 'COMPATIBLE_MODE') AS COMPATIBLE_MODE
FROM V$INSTANCE I
-- KingbaseES
SELECT current_setting('server_version_num'),
       current_setting('server_version'), current_setting('database_mode')
~~~

Every probe must yield exactly one scalar row and the exact expected column
count. Bootstrap probe commands are internal driver-owned read-only metadata
commands, distinct from managed execution commands; any unexpected row/count,
provider error other than the one Oracle fallback code, null, or duplicate
mode row fails closed.

MySQL, SQL Server, Oracle, and PostgreSQL emit the empty ordinal compatibility
mode. DM8 and KingbaseES raw mode probes are driver inputs only; registry keys
contain their canonical strings. The certified case table and the real-probe
case table together cover all ten certified version families, all six exact
production adapter types, suffix validation, legal zero-padding, exact
component preservation, overflow, and text/numeric disagreement.

`DatabasePlatformBootstrap` first selects only the bootstrap driver from the
Task 1 configured `(DatabaseType, CompatibilityMode)` pair, and requires
`ConnectionState.Open`. The driver detects the full live profile; bootstrap
then compares configured type/mode ordinally and calls
`DatabasePlatformRegistry.Get(liveProfile)` with that exact object. Only after
that public exact-profile lookup succeeds may it obtain the corresponding
private immutable `DatabasePlatformDefinition`. Extend that internal
definition—not `DatabasePlatformDescriptor`'s public shape—with a non-null
driver factory and exact driver type for each official platform. No
DatabaseType-only compiler/platform lookup, public registration, fallback
profile, or provider-level live cache is added.

After exact platform/driver resolution, the Oracle and DM8 drivers read the
Dos.ORM-owned `DOSORM_STORAGE_CONTRACT` with metadata-only commands and return
the immutable catalog from Task 2 of the compiler plan. The other four drivers
return the definition-bound `NATIVE_V1` contract without querying or creating a
support table; its nonempty physical-support digest is deterministically bound
to the exact live profile and current `SchemaToken`. `DatabasePlatformBootstrap`
requires every active version/encoding/profile/catalog fingerprint to equal the
platform definition, requires Oracle/DM active column rows to equal the current
`SchemaToken`, and folds the active storage-contract fingerprint into the token
before ordinary compilation.

Missing or `PendingImport` Oracle/DM state fails every ordinary AST, migration,
diagnostic, native, and admin source before a business command. The sole
transition is an already-authorized `DatabaseImportOperation` whose complete
artifact has passed all hashes/profile/schema gates. `FailOnConflict` is
eligible only when metadata proves the target has no business object;
`ReplaceTargetDatabase` first passes its elevated current-operator approval,
then asks the internal admin coordinator for the exact-profile target-reset
strategy. MySQL, SQL Server, PostgreSQL, and KingbaseES may use a separately
configured admin connection to drop/create the database only when both frozen
capabilities are true. Oracle and DM8 must never invoke those unsupported
operations: their driver opens the separately configured elevated reset
connection bound to the exact target owner/schema, enumerates every owned
business and Dos.ORM support object through managed metadata, and validates the
whole immutable reset catalog before its first destructive command. A
foreign/system owner or unrecognized object type fails with zero reset
mutation. Only a fully covered catalog emits dependency-ordered schema-object
drops through the internal compiler/admin path; any residual object still
rejects success. It then closes the reset and stale target scopes,
opens a fresh target connection, redetects the same four-part profile/mode, and
proves both the business-object set and support contract absent. Only that fresh
empty proof permits the `PendingImport` write. Missing reset credentials,
privileges, profile equality, complete catalog coverage, reconnect, or empty
proof fails before `PendingImport`; `SkipExisting` is never eligible. None of
these dialect choices or credentials is exposed through the public source DTO.

The import transition writes a `PendingImport` header, runs only schema DDL
compiled against the artifact's expected active contract, re-reads the new
`SchemaToken`, writes and verifies all column rows, atomically changes the exact
pending import-binding fingerprint to `Active`, and re-reads the active
contract. The in-memory ticket independently retains the verified outer
resource digest; it is never written into deterministic vendor SQL.
Only then may the first business DML/query be compiled. Failure at any point
leaves a pending database that exposes no logical value and rejects all other
work. A retry may resume only after fresh authorization with the same artifact,
profile, expected schema, outer resource digest, and pending import binding;
otherwise only an
authorized `ReplaceTargetDatabase` restart is allowed. Tests inject failure
before/after every transition, theory both database-level and schema-owner reset
strategies, and prove no `PendingImport` or data DML precedes the fresh empty
proof and no data DML precedes active re-read. Real Oracle and DM8 reset,
reconnect, empty-proof, activation, and first-DML ordering is owned by the
certification plan rather than a fake driver.

A nonempty historical Oracle/DM database without an active contract cannot use
an in-place `MigrationPlan`: NULL values may already represent either original
NULL or a collapsed empty string, so a lossless backfill is not derivable.
It must use the reachable, elevated `ReplaceTargetDatabase` import with an
independently verified authoritative logical artifact. Ordinary migration,
`FailOnConflict`, raw export from the ambiguous database, and silent Native
fallback all fail before mutation; already-collapsed values are never claimed
recovered.

The internal sealed `ManagedBootstrapEventSource : EventSource` has exact source
name `Dos-ORM-ManagedBootstrap`, event IDs 1..5, and emits the five events
frozen above from the real production points. `ConnectionOpened` occurs only
after `Open`/`OpenAsync`; `ProfileDetected` only after the authoritative probe
has produced the canonical exact profile; compiler and managed-driver
resolution events only after exact registry success; `ExecutionPlanCompiled`
only after the first plan for that profile exists. Payload is limited to a
32-lower-hex operation ID, monotonic per-operation sequence, numeric
DatabaseType, exact profile fingerprint, and (only on event 5) exact plan
fingerprint. It never contains SQL/native text, connection
string/server/database/user, parameter name/value, schema name/token,
credential, command text, exception text, principal, or token.

`ManagedBootstrapTrace` is carried through the internal bootstrap result and
validated ticket; it owns the operation ID and an interlocked fail-closed state
machine `Opened -> ProfileDetected -> CompilerResolved -> DriverResolved ->
ExecutionPlanCompiled`. Illegal, duplicate, missing, or cross-operation
transitions fail even when no listener is enabled. Emission cannot authorize or
mutate database work, disabled listeners allocate no event payload, and
listener behavior cannot relax the state machine. The types and emitters remain
internal, add no IVT or public Dos.ORM surface, and integration tests observe
them only through BCL `EventListener`. Unit tests freeze source/event IDs and
parameter names/types, exercise concurrent operations and failure truncation,
and prove connection/SQL/parameter secret sentinels never occur in payloads.

The independently sealed `ManagedAdminTransitionEventSource : EventSource`
has exact source name `Dos-ORM-ManagedAdminTransition` and event IDs 1..12:
`ResetAuthorized`, `OwnedObjectsEnumerated`, `OwnedObjectsDropped`,
`StaleTargetDisposed`, `TargetReconnected`, `ExactProfileRedetected`,
`EmptyTargetProved`, `PendingImportWritten`, `SchemaCatalogVerified`,
`StorageContractActivated`, `ActiveContractRead`, and `FirstDataDml`. It exists
only for the production Oracle/DM `ReplaceTargetDatabase` schema-owner path.
Each event is emitted at the named production boundary, not inferred from a
test boolean. Payload is limited to the same safe operation ID, monotonic
sequence, numeric DatabaseType, and exact profile fingerprint; it contains no
target/schema/user/object/SQL/connection/credential/value or exception text.
`ManagedAdminTransitionTrace` is local to the coordinator's one import scope,
is not added to `ValidatedExecutionTicket` or any public result, and enforces
the exact interlocked 12-state sequence even with no listener. A listener can
observe but cannot authorize or advance it. Failure truncates the sequence and
forbids later stages. Unit tests freeze the source/IDs/signatures, poison every
transition, prove concurrent operation isolation and secret redaction, and
prove `FirstDataDml` is emitted only after the first real data DML succeeds and
cannot occur before `ActiveContractRead`.

The sync and async Database connection-open paths invoke this bootstrap only
after `Open`/`OpenAsync` returns successfully. A focused test proves every
official live profile resolves the matching internal definition/driver, two
servers sharing one configured provider resolve independently, wrong
version/mode fails before registry success and command creation, and driver
resolution cannot mutate shared compiler or capabilities.

`SqlExecutionCoordinator` is the sole caller of `SqlExecutionPreflight`, the
validated materializer, and Database's internal managed execution path. It is
the only component allowed to turn registry-selected compiler output into a
validated execution ticket. The separate legacy CommandCreator boundary may
use the compiler only for portable DML formatting and cannot enter any of
those managed components.
Preflight has distinct internal source-aware methods for SqlStatement,
MigrationPlan, and NativeSqlText; only those methods can call the private
ticket constructor. It detects the live full profile before command creation,
verifies exact profile/source/fingerprint/gates/schema, and for Required proves
all step scopes reference the one active connection/transaction and that
`ReferenceEquals(transaction.Connection, connection)`.

The ticket is single-use and invocation-scoped. Its only constructor is private
and receives the exact `DatabasePlatformDefinition`, exact bootstrapped
`IDbDriverAdapter`, storage contract, and bootstrap trace in addition to
plan/scope/profile/schema. Materialize
accepts no plan, platform, provider, driver, connection, or transaction
parameter and calls `TryConsume` before creating the first managed command. It
uses only `ticket.Driver.CreateCommand(ticket.Connection)`. For each logical
`BoundParameter`, it requires the compiled parameter value contract, produces a
private immutable `PhysicalBoundParameter` containing the logical definition,
encoded value, physical type, and contract fingerprint, and calls only
`ticket.Driver.CreateParameter(command, physicalParameter)`; it performs no
registry/provider lookup and never creates a provider-specific parameter
directly. NULL stays NULL and NonEmptyEnvelopeV1 encoding happens here, before
the provider sees a value. The coordinator retains and executes/adapts every command materialized
from a validated ticket through Database; those managed
commands never reach public callers. AST managed commands bypass
DbProvider.PrepareCommand. Legacy string commands and the explicitly separate
public CommandCreator boundary do not enter this coordinator/ticket path. Any
managed preflight failure occurs before `IDbDriverAdapter.CreateCommand`,
executes no prefix, and never retries with weaker atomicity.

- [ ] **Step 4: Run and verify GREEN**

Run the focused command from Step 2 plus only the permanent
`Baseline_symbols_remain_present_with_identical_shape` baseline test. Expected:
PASS with the Task 2 authorizer treated as an addition, every captured symbol
unchanged, zero public execution/materialization parameter accepting a plan,
no public ticket/materializer, and zero command creation for every injected
preflight failure. The final baseline-plus-exact-delta assertion does not exist
yet; public preview plan returns are added separately in Task 3.

- [ ] **Step 5: Commit**

~~~powershell
git status --short -- ./Microi.Server/Dos.ORM ./Microi.Server/Dos.ORM.Tests
git add -- ./Microi.Server/Dos.ORM/SqlCompilation/SqlExecutionPreflight.cs ./Microi.Server/Dos.ORM/SqlCompilation/SqlExecutionCoordinator.cs ./Microi.Server/Dos.ORM/SqlCompilation/SqlCommandMaterializer.cs ./Microi.Server/Dos.ORM/SqlCompilation/PhysicalBoundParameter.cs ./Microi.Server/Dos.ORM/SqlCompilation/IDbDriverAdapter.cs ./Microi.Server/Dos.ORM/SqlCompilation/DatabasePlatformBootstrap.cs ./Microi.Server/Dos.ORM/SqlCompilation/DatabaseTargetIdentity.cs ./Microi.Server/Dos.ORM/SqlCompilation/ManagedBootstrapTrace.cs ./Microi.Server/Dos.ORM/Diagnostics/ManagedBootstrapEventSource.cs ./Microi.Server/Dos.ORM/SqlCompilation/ManagedAdminTransitionTrace.cs ./Microi.Server/Dos.ORM/Diagnostics/ManagedAdminTransitionEventSource.cs ./Microi.Server/Dos.ORM/SqlCompilation/IManagedSqlExecutionAuthorizer.cs ./Microi.Server/Dos.ORM/SqlCompilation/Drivers/MySqlDbDriverAdapter.cs ./Microi.Server/Dos.ORM/SqlCompilation/Drivers/SqlServerDbDriverAdapter.cs ./Microi.Server/Dos.ORM/SqlCompilation/Drivers/OracleDbDriverAdapter.cs ./Microi.Server/Dos.ORM/SqlCompilation/Drivers/PostgreSqlDbDriverAdapter.cs ./Microi.Server/Dos.ORM/SqlCompilation/Drivers/DaMengDbDriverAdapter.cs ./Microi.Server/Dos.ORM/SqlCompilation/Drivers/KingBaseDbDriverAdapter.cs ./Microi.Server/Dos.ORM/Platform/DatabasePlatformDefinition.cs ./Microi.Server/Dos.ORM/Platform/DatabasePlatformRegistry.cs ./Microi.Server/Dos.ORM/Db/Database.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/DriverBootstrapTests.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/SqlExecutionPreflightTests.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/ManagedBootstrapDiagnosticsTests.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/ManagedAdminTransitionDiagnosticsTests.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/StorageContractPreflightTests.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/DatabaseTargetIdentityProbeTests.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/FakeDbDriver.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/TestConnections.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/ExecutionHarness.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/DriverBootstrapCases.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/DriverVersionProbeCases.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/BootstrapEventCapture.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/AdminTransitionEventCapture.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/StorageContractCases.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/TargetIdentityCases.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: validate and internally execute AST plans"
~~~

### Task 3: Add managed AST/native execution and migration/admin preview-approval entry points

**Files (Step 1A observable assertion RED):**
- Modify: Microi.Server/Dos.ORM.Tests/Compatibility/PublicApiBaselineTests.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/Task7PublicApiDeltaAllowlist.cs

**Files (Step 1B direct-reference compile RED):**
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/ApprovalExecutionHarness.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/ManagedExecutionSurfaceContract.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/ManagedExecutionSurfaceFixtures.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/DatabaseResourceProviderHarness.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/ManagedSqlSectionHarness.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/ManagedReaderLeaseHarness.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/LogicalTextMaterializationHarness.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/AstExecutionEntryPointTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/DatabaseResourceProviderTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/ManagedSqlSectionTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/ManagedReaderLeaseTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/LogicalTextMaterializationTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Architecture/ManagedExecutionSurfaceTests.cs

**Files (Step 2 implementation):**
- Create: Microi.Server/Dos.ORM/SqlAst/IDatabaseResourceProvider.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/DatabaseResourcePipeline.cs
- Modify: Microi.Server/Dos.ORM/SqlCompilation/SqlExecutionCoordinator.cs
- Modify: Microi.Server/Dos.ORM/SqlCompilation/SqlCommandMaterializer.cs
- Modify: Microi.Server/Dos.ORM/Db/DbSession.cs
- Modify: Microi.Server/Dos.ORM/Db/DbTrans.cs
- Modify: Microi.Server/Dos.ORM/Db/SafeTransactionProxy.cs
- Modify: Microi.Server/Dos.ORM/Section/Section.cs
- Modify: Microi.Server/Dos.ORM/Section/SqlSection.cs
- Create: Microi.Server/Dos.ORM/Section/ManagedSqlSectionState.cs (internal)
- Create: Microi.Server/Dos.ORM/Section/ManagedDataReaderLease.cs (internal)
- Create: Microi.Server/Dos.ORM/Section/SessionBoundNativeSqlSource.cs (internal)

**Interfaces:**
- Produces: public source-only `FromAst`, `ExecuteAst`, `FromNativeSql`,
  `PreviewMigration`, `PreviewAdmin`, and the exact migration/admin execution
  overload pairs; matching DbTrans virtual methods and SafeTransactionProxy
  forwarding. Preview may return `DatabaseExecutionPlan`; no execution or
  materialization method accepts one.
- Produces: `DbSession(Database, IManagedSqlExecutionAuthorizer)` for a
  non-null active-session authorizer. Existing constructors use a deny-by-
  default authorizer for every managed migration/admin execution.
- Produces: exact
  `DbSession(Database, IManagedSqlExecutionAuthorizer,
  IDatabaseResourceProvider)` injection for resource-backed admin sources.
  The two-argument authorizer constructor and every legacy constructor retain
  an internal unavailable-resource sentinel: non-resource operations remain
  valid, while import/export fail before any driver command.
- Consumes: the immutable complete-assembly canonical baseline and permanent
  subset test already committed in Task 2 Step 0, plus that step's already-
  implemented and empty-delta-verified `AssertBaselinePlusExactDelta` helper.
- Produces: the final exact managed-delta descriptor gate and a cycle-safe
  recursive type-graph gate. Every new public/protected type/member/interface/
  interface-map entry must match one exact managed descriptor; graph roots are
  every allowed delta signature and their reachable user-owned request types.

- [ ] **Step 1A: Add the symbol-independent exact-delta assertion and observe assertion RED**

Before changing any Task 3 production type, run all core, six-dialect, and
adapter Tasks 1-2 tests green. Verify the Task 2 Step 0 baseline literal hash is
unchanged and run only
`Baseline_symbols_remain_present_with_identical_shape` GREEN. Do not capture,
refresh, recreate the baseline, or modify `CanonicalPublicApiSurface` in this
task.

Now add the separate
`PublicApiBaselineTests.DosOrm_public_surface_equals_canonical_baseline_plus_exact_delta`
test shown below. It requires current-minus-baseline to equal
`Task7PublicApiDeltaAllowlist` exactly. At this point current-minus-baseline is
only the Task 2 `IManagedSqlExecutionAuthorizer` type and its four methods, so
the assertion is intentionally RED because the rest of the final literal
allowlist is absent. It becomes GREEN only after the exact implementation adds
the nine managed methods on each host, the exact two-method
`IDatabaseResourceProvider`, and both authorizer-bearing `DbSession`
constructors. No later task adds another public/protected helper, adapter,
pipeline mode, or wrapper. Never regenerate the snapshot to make either
permanent test pass.

`Task7PublicApiDeltaAllowlist.All` is a checked-in ordinal set made only from
independently typed literal canonical descriptor strings in the exact grammar
emitted by `CanonicalPublicApiSurface`. Manually transcribe the authorizer type
and four methods, the resource-provider type and two methods, all
three-times-nine host method descriptors, and both new constructor descriptors
from the frozen tables in this plan. The class must not
derive expected strings from current reflection and must not use `nameof`,
`MethodInfo`, expression trees, member lookup, or `typeof`/closed-generic
construction that references a not-yet-existing host member. Reflection is
used only on the actual current assembly inside
`AssertBaselinePlusExactDelta`; its canonical current descriptors are compared
to this independent literal set.

~~~csharp
[Fact]
public void DosOrm_surface_is_canonical_baseline_plus_exact_delta()
{
    CanonicalPublicApiSurface.AssertBaselinePlusExactDelta(
        typeof(Database).Assembly,
        "Baselines/dos-orm-pre-managed-delta-public-api.txt",
        Task7PublicApiDeltaAllowlist.All);
}
~~~

Run only the baseline tests before adding any direct reference to a missing
host API:

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter FullyQualifiedName~PublicApiBaselineTests --nologo
~~~

Expected: the test project compiles; the permanent baseline-subset test is
GREEN; the new exact-delta test executes and is assertion RED. Record that its
reported current-minus-baseline set is exactly the Task 2 public authorizer
type and four methods, while the literal expected set is the complete final
allowlist.

- [ ] **Step 1B: Add direct entry-point and graph tests and observe compile RED**

Only after preserving the Step 1A assertion output, add the following tests and
fixtures that directly reference the not-yet-existing host methods and
constructor.

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
    var db = SessionTestFactory.CreateCommandCapture(
        DatabaseType.PostgreSql);
    var section = db.FromSql("select vendor_specific_function()");
    section.ToArray();

    Assert.Equal("select vendor_specific_function()",
        db.ExecutedCommands.Single().CommandText);
    Assert.Equal(1, db.LegacyExecuteReaderCalls);
    Assert.Equal(0, db.ManagedCoordinatorCalls);
}

[Fact]
public void Public_native_boundary_binds_the_live_profile_only_at_terminal()
{
    var db = SessionTestFactory.Create(TestProfiles.PostgreSql17);
    var section = db.FromNativeSql(
        "select 1",
        NativeSqlCommandKind.Read,
        Array.Empty<ParameterDefinition>(),
        new ParameterBag());

    Assert.Equal(0, db.Driver.CreateCommandCalls);
    Assert.Equal(0, db.NativeSourceFactoryCalls);
    section.ToArray();

    Assert.Equal(1, db.NativeSourceFactoryCalls);
    Assert.Same(db.DetectedLiveProfile,
        db.ExecutedNativeSource.TargetProfile);
    Assert.Equal(SqlSafetyOrigin.UserProvided,
        db.ExecutedNativeSource.Origin);
    Assert.Equal(0, db.PublicDialectProfileAccessorCount);
}

[Theory]
[MemberData(nameof(ManagedSectionTerminalCases.All),
    MemberType = typeof(ManagedSectionTerminalCases))]
public async Task Managed_section_defers_compile_preflight_and_materialization_to_terminal(
    ManagedSectionTerminalCase terminal)
{
    var capture = ManagedSqlSectionHarness.PortableRead(terminal);
    var section = capture.CreateFromAst();

    Assert.Equal(0, capture.CompilerCalls);
    Assert.Equal(0, capture.Driver.CreateCommandCalls);
    Assert.Null(capture.PublicCommand);

    await capture.InvokeTerminalAsync(section);

    Assert.Equal(1, capture.ManagedCoordinatorCalls);
    Assert.Equal(terminal.ExpectedCompileCalls, capture.CompilerCalls);
    Assert.Equal(1, capture.PreflightCalls);
    Assert.Equal(terminal.ExpectedCommands.Count,
        capture.Driver.CreateCommandCalls);
    Assert.Equal(terminal.ExpectedCommands.Select(x => x.ResultShape),
        capture.ExecutedSteps.Select(x => x.ResultShape));
    Assert.Equal(terminal.ExpectedCommands.Select(x => x.CommandText),
        capture.ExecutedCommands.Select(x => x.CommandText));
    Assert.Equal(terminal.ExpectedCommands.Select(x => x.Bindings),
        capture.ExecutedBindingsByCommand);
    Assert.All(capture.ExecutedCommands, command =>
    {
        Assert.Same(capture.ValidatedConnection, command.Connection);
        Assert.Same(capture.ValidatedTransaction, command.Transaction);
    });
}

[Theory]
[InlineData(false)]
[InlineData(true)]
public async Task Managed_select_page_list_builds_exact_count_and_offset_steps(
    bool async)
{
    var capture = ManagedSqlSectionHarness.UnpagedSelect();
    var section = capture.CreateFromAst();

    await capture.InvokePageListAsync(section, pageIndex: 3, pageSize: 20,
        async: async);

    Assert.Equal(1, capture.CompilerCalls);
    Assert.Equal(1, capture.PreflightCalls);
    Assert.Collection(capture.ExecutedSteps,
        count => Assert.Equal(SqlResultShape.Scalar, count.ResultShape),
        data => Assert.Equal(SqlResultShape.RowSet, data.ResultShape));
    Assert.All(capture.ExecutedCommands, command =>
    {
        Assert.DoesNotContain(";", command.CommandText);
        Assert.Same(capture.ValidatedConnection, command.Connection);
        Assert.Same(capture.ValidatedTransaction, command.Transaction);
    });
    Assert.Equal(capture.ExpectedCountText,
        capture.ExecutedCommands[0].CommandText);
    Assert.Equal(capture.ExpectedOffsetPageText,
        capture.ExecutedCommands[1].CommandText);
    Assert.Equal(40, capture.CompiledOffsetPageSpec.Offset);
    Assert.Equal(20, capture.CompiledOffsetPageSpec.Limit);
}

[Theory]
[MemberData(nameof(ManagedPageFailureCases.All),
    MemberType = typeof(ManagedPageFailureCases))]
public void Unsafe_managed_page_source_fails_before_compile_or_command(
    ManagedPageFailureCase sample)
{
    var capture = ManagedSqlSectionHarness.PageFailure(sample);
    Assert.ThrowsAny<Exception>(() =>
        capture.Section.ToPageList<object>(sample.PageIndex, sample.PageSize));
    Assert.Equal(sample.ExpectedCompileCallsBeforeRejection,
        capture.CompilerCalls);
    Assert.Equal(0, capture.Driver.CreateCommandCalls);
}

[Theory]
[MemberData(nameof(ManagedMultipleResultCases.All),
    MemberType = typeof(ManagedMultipleResultCases))]
public void Multiple_result_requires_exact_step_count_and_shapes(
    ManagedMultipleResultCase sample)
{
    var capture = ManagedSqlSectionHarness.MultipleResult(sample);
    if (sample.IsValid)
    {
        capture.Invoke();
        Assert.Equal(sample.ExpectedCompileCalls, capture.CompilerCalls);
        Assert.Equal(1, capture.PreflightCalls);
        Assert.Equal(sample.ExpectedShapes,
            capture.ExecutedSteps.Select(x => x.ResultShape));
        Assert.Equal(sample.ExpectedCommandCount,
            capture.Driver.CreateCommandCalls);
        Assert.All(capture.ExecutedCommands, command =>
        {
            Assert.Same(capture.ValidatedConnection, command.Connection);
            Assert.Same(capture.ValidatedTransaction, command.Transaction);
        });
    }
    else
    {
        Assert.Throws<InvalidOperationException>(() => capture.Invoke());
        Assert.Equal(sample.ExpectedCompileCalls, capture.CompilerCalls);
        Assert.Equal(0, capture.Driver.CreateCommandCalls);
    }
}

[Theory]
[MemberData(nameof(ManagedSectionMutationCases.All),
    MemberType = typeof(ManagedSectionMutationCases))]
public void Managed_section_parameter_or_transaction_mutation_poison_fails_closed(
    ManagedSectionMutationCase mutation)
{
    var capture = ManagedSqlSectionHarness.PortableRead();
    var section = capture.CreateFromAst();

    Assert.Throws<InvalidOperationException>(
        () => capture.ApplyMutation(section, mutation));
    Assert.Throws<InvalidOperationException>(() => section.ToArray());
    Assert.Equal(0, capture.CompilerCalls);
    Assert.Equal(0, capture.Driver.CreateCommandCalls);
    Assert.Equal(0, capture.ExecuteCalls);
}

[Theory]
[MemberData(nameof(ManagedEnumerableLifetimeCases.All),
    MemberType = typeof(ManagedEnumerableLifetimeCases))]
public void Managed_enumerable_is_lazy_and_releases_lease_exactly_once(
    ManagedEnumerableLifetimeCase sample)
{
    var capture = ManagedReaderLeaseHarness.Enumerable(sample);
    var values = capture.Section.ToEnumerable<object>();
    Assert.Equal(0, capture.CompilerCalls);
    Assert.Equal(0, capture.Driver.CreateCommandCalls);

    using (var enumerator = values.GetEnumerator())
    {
        Assert.Equal(0, capture.CompilerCalls);
        Assert.Equal(0, capture.Driver.CreateCommandCalls);
        var error = Record.Exception(
            () => capture.ConsumeOrStopOrThrow(enumerator));
        Assert.Equal(sample.ExpectedExceptionType, error?.GetType());
    }

    Assert.Equal(1, capture.ReaderDisposeCalls);
    Assert.Equal(1, capture.PrivateCommandDisposeCalls);
    Assert.Equal(sample.SessionOwnedScope ? 1 : 0,
        capture.OwnedScopeDisposeCalls);
    Assert.Equal(0, capture.ExternalDbTransDisposeCalls);
}

[Theory]
[MemberData(nameof(ManagedReaderTerminationCases.All),
    MemberType = typeof(ManagedReaderTerminationCases))]
public void Managed_data_reader_returns_only_idempotent_internal_lease(
    ManagedReaderTerminationCase sample)
{
    var capture = ManagedReaderLeaseHarness.DataReader(sample);
    var reader = capture.Section.ToDataReader();

    Assert.IsAssignableFrom<IDataReader>(reader);
    Assert.Equal(1, capture.Driver.CreateCommandCalls);
    Assert.DoesNotContain(reader.GetType().GetProperties(
            BindingFlags.Public | BindingFlags.Instance),
        property => typeof(DbCommand).IsAssignableFrom(property.PropertyType));
    Assert.DoesNotContain(reader.GetType().GetFields(
            BindingFlags.Public | BindingFlags.Instance),
        field => typeof(DbCommand).IsAssignableFrom(field.FieldType));

    var error = Record.Exception(
        () => capture.TerminateByCloseDisposeEofOrException(reader));
    Assert.Equal(sample.ExpectedExceptionType, error?.GetType());
    reader.Dispose(); // proves idempotence after every termination mode

    Assert.Equal(1, capture.ReaderDisposeCalls);
    Assert.Equal(1, capture.PrivateCommandDisposeCalls);
    Assert.Equal(sample.SessionOwnedScope ? 1 : 0,
        capture.OwnedScopeDisposeCalls);
    Assert.Equal(0, capture.ExternalDbTransDisposeCalls);
}

[Fact]
public void DbTrans_managed_section_uses_only_reference_identical_owned_transaction()
{
    var capture = ManagedSqlSectionHarness.FromDbTrans();
    var section = capture.Transaction.FromAst(
        capture.Statement, capture.Values);
    section.ToArray();

    Assert.Same(capture.SessionConnection,
        capture.ExecutedCommands.Single().Connection);
    Assert.Same(capture.OwnedTransaction,
        capture.ExecutedCommands.Single().Transaction);
    Assert.Same(capture.SessionConnection,
        capture.OwnedTransaction.Connection);
    Assert.Equal(0, capture.ExternalTransactionAcceptCalls);
}

[Fact]
public void Managed_native_text_is_observed_only_at_internal_execution_capture()
{
    var capture = ManagedSqlSectionHarness.NativeRead(
        "select vendor_specific_function(@p0)");
    var section = capture.CreateFromNativeSql();
    Assert.Equal(0, capture.Driver.CreateCommandCalls);

    section.ToArray();

    Assert.Equal("select vendor_specific_function(@p0)",
        capture.ExecutedCommands.Single().CommandText);
    Assert.False(typeof(SqlSection).GetProperties(
        BindingFlags.Public | BindingFlags.Instance)
        .Any(property => property.Name == "SqlString"));
}

[Theory]
[MemberData(nameof(LogicalTextMaterializationCases.All),
    MemberType = typeof(LogicalTextMaterializationCases))]
public void Every_managed_result_surface_decodes_the_storage_contract(
    LogicalTextMaterializationCase sample)
{
    var capture = LogicalTextMaterializationHarness.Create(sample);
    var result = capture.Execute();

    Assert.Equal(sample.ExpectedLogicalValue, result.Value);
    Assert.Equal(sample.ExpectedLogicalValue, result.TypedGetterValue);
    Assert.Equal(sample.ExpectedLogicalValue, result.IndexerValue);
    Assert.Equal(sample.ExpectedLogicalValue, result.OutputParameterValue);
    Assert.True(result.ReaderAndCommandDisposedExactlyOnce);
}

// LogicalTextMaterializationCase and LogicalTextMaterializationCases are
// internal test-only types owned by LogicalTextMaterializationHarness.cs.

[Fact]
public void Exact_elevated_migration_preview_approval_recompile_executes()
{
    var capture = ApprovalExecutionHarness.ElevatedMigration();
    var preview = capture.Session.PreviewMigration(
        capture.Source, AtomicityRequirement.Required);

    Assert.True(preview.RequiresEffectiveImpactApproval);
    Assert.False(preview.CanApplyEffectiveImpact);
    Assert.Equal(0, capture.Driver.CreateCommandCalls);

    capture.ExternalPolicy.Authorize(preview);
    var approval = preview.CreateEffectiveImpactApproval(
        new ApprovalReference("review-42"));
    var result = capture.Session.ExecuteMigration(
        capture.Source,
        capture.Values,
        AtomicityRequirement.Required,
        approval);

    Assert.True(result.CanAdvanceVersion);
    Assert.Equal(1, capture.Authorizer.DemandCalls);
    Assert.NotEqual(0, capture.Driver.ExecuteCalls);
}

[Theory]
[InlineData(ApprovalExecutionFailure.MissingApproval)]
[InlineData(ApprovalExecutionFailure.ForeignSource)]
[InlineData(ApprovalExecutionFailure.SourceMutation)]
[InlineData(ApprovalExecutionFailure.StalePreviewPlan)]
[InlineData(ApprovalExecutionFailure.LiveProfile)]
[InlineData(ApprovalExecutionFailure.SchemaToken)]
[InlineData(ApprovalExecutionFailure.RequestedAtomicity)]
[InlineData(ApprovalExecutionFailure.CompiledCommand)]
[InlineData(ApprovalExecutionFailure.CompiledFingerprint)]
[InlineData(ApprovalExecutionFailure.EffectiveImpact)]
[InlineData(ApprovalExecutionFailure.ClosedNeutralGate)]
[InlineData(ApprovalExecutionFailure.ClosedAdminGate)]
[InlineData(ApprovalExecutionFailure.DeniedCurrentAuthorization)]
[InlineData(ApprovalExecutionFailure.NeedlessApproval)]
[InlineData(ApprovalExecutionFailure.NeedlessForeignApproval)]
public void Invalid_compiled_approval_handoff_creates_zero_commands(
    ApprovalExecutionFailure failure)
{
    var capture = ApprovalExecutionHarness.Failure(failure);
    Assert.ThrowsAny<Exception>(() => capture.Execute());
    Assert.Equal(0, capture.Driver.CreateCommandCalls);
    Assert.Equal(0, capture.Driver.ExecuteCalls);
}

[Theory]
[InlineData(AdminElevationCase.DropDatabase)]
[InlineData(AdminElevationCase.ReplaceImport)]
public void Exact_elevated_admin_preview_approval_recompile_executes(
    AdminElevationCase adminCase)
{
    var capture = ApprovalExecutionHarness.ElevatedAdmin(adminCase);
    var preview = capture.Session.PreviewAdmin(
        capture.Source, AtomicityRequirement.None);
    capture.ExternalPolicy.Authorize(preview);
    var approval = preview.CreateEffectiveImpactApproval(
        new ApprovalReference("review-admin-7"));

    var result = capture.Session.ExecuteAdmin(
        capture.Source,
        capture.Values,
        AtomicityRequirement.None,
        approval);

    Assert.Equal(DatabaseAdminOutcome.Applied, result.Outcome);
    Assert.Equal(1, capture.Authorizer.DemandCalls);
}

[Fact]
public void Exact_compiled_approval_can_be_reused_for_deterministic_retry()
{
    var capture = ApprovalExecutionHarness.ExactRetry();
    var preview = capture.PreviewSession.PreviewMigration(
        capture.Source, AtomicityRequirement.Required);
    capture.ExternalPolicy.Authorize(preview);
    var approval = preview.CreateEffectiveImpactApproval(
        new ApprovalReference("retry-9"));

    var first = capture.FirstExecutionSession.ExecuteMigration(
        capture.Source, capture.Values,
        AtomicityRequirement.Required, approval);
    var retry = capture.RetryExecutionSession.ExecuteMigration(
        capture.Source, capture.Values,
        AtomicityRequirement.Required, approval);

    Assert.True(first.CanAdvanceVersion);
    Assert.True(retry.CanAdvanceVersion);
}

[Fact]
public void Managed_hosts_and_authorizer_have_exact_type_and_interface_maps()
{
    ManagedExecutionSurfaceContract.AssertExactHost(
        typeof(DbSession), typeof(object), Type.EmptyTypes,
        ManagedDispatchShape.NonVirtual);
    ManagedExecutionSurfaceContract.AssertExactHost(
        typeof(DbTrans), typeof(object), new[] { typeof(IDisposable) },
        ManagedDispatchShape.VirtualDeclaration);
    ManagedExecutionSurfaceContract.AssertExactHost(
        typeof(SafeTransactionProxy), typeof(DbTrans),
        new[] { typeof(IDisposable) },
        ManagedDispatchShape.DbTransOverride);
    ManagedExecutionSurfaceContract.AssertDisposeMap(
        typeof(DbTrans), typeof(DbTrans), typeof(DbTrans));
    ManagedExecutionSurfaceContract.AssertDisposeMap(
        typeof(SafeTransactionProxy), typeof(SafeTransactionProxy),
        typeof(DbTrans));
    ManagedExecutionSurfaceContract.AssertExactAuthorizer(
        typeof(IManagedSqlExecutionAuthorizer), Type.EmptyTypes);
}

[Fact]
public void Managed_delta_and_reachable_request_graph_have_no_escape_shape()
{
    ManagedExecutionSurfaceContract.AssertClosedTypeGraph(
        Task7PublicApiDeltaAllowlist.All);
}

[Fact]
public void Approved_leaf_dto_self_and_mutual_cycles_are_safe()
{
    ManagedExecutionSurfaceContract.AssertSafeFixtureGraph(
        typeof(ApprovedLeafDto), typeof(SafeCycleA), typeof(SafeCycleB));
}

[Theory]
[InlineData(typeof(DirectPlanRequest))]
[InlineData(typeof(NestedPlanRequest))]
[InlineData(typeof(CyclicPlanRequest))]
public void Plan_hidden_in_equivalent_request_graph_is_rejected(Type request)
{
    Assert.Throws<PublicSurfaceContractException>(() =>
        ManagedExecutionSurfaceContract.AssertSafeFixtureGraph(request));
}

[Theory]
[MemberData(nameof(LegacyDbSessionConstructorCases.DenialMatrix),
    MemberType = typeof(LegacyDbSessionConstructorCases))]
public void Every_legacy_constructor_and_authorization_arity_denies_before_command(
    LegacyDbSessionConstructorCase constructor,
    DeniedAuthorizationCase executionCase)
{
    var capture = ApprovalExecutionHarness.LegacyConstructorDenied(
        constructor, executionCase);
    Assert.Same(DenyManagedSqlExecutionAuthorizer.Instance,
        capture.SessionAuthorizer);
    Assert.Throws<UnauthorizedAccessException>(() => capture.Execute());
    Assert.Equal(0, capture.Driver.CreateCommandCalls);
    Assert.Equal(0, capture.Driver.ExecuteCalls);
}

[Theory]
[MemberData(nameof(LegacyDbSessionConstructorCases.All),
    MemberType = typeof(LegacyDbSessionConstructorCases))]
public void Every_legacy_constructor_retains_singleton_in_transaction_and_proxy(
    LegacyDbSessionConstructorCase constructor)
{
    var capture = ApprovalExecutionHarness.AuthorizerIdentity(constructor);
    capture.AssertSameAuthorizerRetained(
        DenyManagedSqlExecutionAuthorizer.Instance);
    capture.AssertSameResourceProviderRetained(
        UnavailableDatabaseResourceProvider.Instance);
}

[Fact]
public void Explicit_authorizer_constructor_rejects_null_and_retains_identity()
{
    var capture = ApprovalExecutionHarness.ExplicitAuthorizerIdentity();
    Assert.Throws<ArgumentNullException>(() =>
        new DbSession(null, capture.Authorizer));
    Assert.Throws<ArgumentNullException>(() =>
        new DbSession(capture.Database, null));
    capture.AssertSameAuthorizerRetained(capture.Authorizer);
    capture.AssertSameResourceProviderRetained(
        UnavailableDatabaseResourceProvider.Instance);
}

[Fact]
public void Resource_provider_surface_and_injection_constructor_are_exact()
{
    ManagedExecutionSurfaceContract.AssertExactResourceProvider(
        typeof(IDatabaseResourceProvider),
        ("OpenRead", typeof(Stream),
            new[] { typeof(DatabaseResourceHandle) }),
        ("OpenWrite", typeof(Stream),
            new[] { typeof(DatabaseResourceHandle) }));

    var capture = DatabaseResourceProviderHarness.Valid();
    Assert.Throws<ArgumentNullException>(() => new DbSession(
        null, capture.Authorizer, capture.Provider));
    Assert.Throws<ArgumentNullException>(() => new DbSession(
        capture.Database, null, capture.Provider));
    Assert.Throws<ArgumentNullException>(() => new DbSession(
        capture.Database, capture.Authorizer, null));

    var session = new DbSession(
        capture.Database, capture.Authorizer, capture.Provider);
    capture.AssertSameProviderRetained(session);
    capture.AssertSameProviderRetained(session.BeginTransaction());
    capture.AssertSameProviderRetained(
        capture.CreateSafeTransactionProxy(session));
}

[Theory]
[InlineData(DatabaseResourceOperation.Import)]
[InlineData(DatabaseResourceOperation.Export)]
public void Missing_resource_provider_fails_before_driver_command(
    DatabaseResourceOperation operation)
{
    var capture = DatabaseResourceProviderHarness.WithoutProvider(operation);
    Assert.Throws<InvalidOperationException>(() => capture.Execute());
    Assert.Equal(0, capture.Driver.CreateCommandCalls);
    Assert.Equal(0, capture.ParserCalls);
    Assert.Equal(0, capture.ResourceOpenCalls);
}

[Theory]
[InlineData(ResourceReadFailure.DigestMismatch)]
[InlineData(ResourceReadFailure.NullStream)]
[InlineData(ResourceReadFailure.NotReadable)]
[InlineData(ResourceReadFailure.ReadThrows)]
public void Import_resource_is_digest_verified_before_parse_or_command(
    ResourceReadFailure failure)
{
    var capture = DatabaseResourceProviderHarness.ImportFailure(failure);
    Assert.ThrowsAny<Exception>(() => capture.Execute());
    Assert.Equal(0, capture.ParserCalls);
    Assert.Equal(0, capture.Driver.CreateCommandCalls);
    Assert.Equal(1, capture.ReadStreamDisposeCalls);
    Assert.DoesNotContain(capture.ContentSentinel, capture.ErrorText);
}

[Fact]
public void Export_validates_private_spool_before_opening_destination()
{
    var capture = DatabaseResourceProviderHarness.ExportSuccess();
    var result = capture.Execute();

    Assert.Equal(new[]
    {
        ResourceEvent.ExportCompletedToPrivateSpool,
        ResourceEvent.ContentDigestVerified,
        ResourceEvent.OpenWrite,
        ResourceEvent.CopyVerifiedBytes,
        ResourceEvent.Flush,
        ResourceEvent.DisposeDestination,
        ResourceEvent.DisposePrivateSpool
    }, capture.Events);
    Assert.Equal(capture.Operation.Resource.ContentDigest,
        Assert.IsType<DatabaseExportOperation>(result.Request)
            .Resource.ContentDigest);
    Assert.Equal(1, capture.WriteStreamDisposeCalls);
}
~~~

`ManagedSectionTerminalCases.All` covers every current sync/async terminal
family inherited or declared by `SqlSection` (`ToScalar`, scalar conversions,
first/list/array/enumerable, reader/data-set/data-table, multiple-result,
page-list, and `ExecuteNonQuery`) through a fake Database/driver capture. Each
case freezes its own exact compile count, command count, ordered result shapes,
texts, bindings, and validated scope; page-list is exactly one compiler call
whose plan contains `[Scalar,RowSet]` commands, while two/three-result cases carry their exact
rowset counts. `ManagedPageFailureCases.All` covers NativeSql, non-select,
invalid/overflowing arguments, and mismatched/pre-existing non-offset paging.
`ManagedMultipleResultCases.All` covers sync/async two/three-result success and
every shape/count mismatch. `ManagedEnumerableLifetimeCases.All` covers full,
early-stop, read-error, and deserializer-error enumeration in both session-
owned and external-DbTrans scopes; `ManagedReaderTerminationCases.All` covers
Close, Dispose, EOF, and delegated reader failure with repeated Dispose.
`ManagedSectionMutationCases.All` is the exact five-method set
`SetDbTransaction`, `AddParameter`, and all three `AddInParameter` overloads.
It passes fresh foreign parameters/transactions, expects the attempted mutation
to throw and poison only that managed section, then proves a caught exception
cannot be followed by execution. The same methods retain their historical
behavior on a `FromSql(string)` section.

`DatabaseResourceProviderTests` also theories export digest mismatch, null
write stream, non-writable stream, write/flush failure, provider throw, large
non-seekable input/output, and repeat-open aliasing. Digest mismatch must leave
`OpenWriteCalls == 0`; every acquired stream and private spool is disposed
exactly once on every success/failure path. A provider returning the same live
stream instance for two opens fails closed. Diagnostics expose only operation,
resource ID, expected/actual digest comparison, byte count, and category—never
resource bytes, SQL, filesystem paths, connection strings, or parameter values.

The exact ownership contract is: `OpenRead`/`OpenWrite` reject null handles,
return a fresh non-null stream, and transfer exclusive disposal ownership to
Dos.ORM. `OpenRead` may be non-seekable but must be readable; `OpenWrite` may be
non-seekable but must be writable. The provider stages writes and atomically
publishes only content whose SHA-256 matches `resource.ContentDigest`; partial
or mismatched disposal discards the staged object. Dos.ORM independently hashes
all bytes and flushes before disposal. No provider method receives a database,
SQL, dialect, plan, driver, connection, transaction, command, path, or caller
owned stream.

The two-method surface is implementable through an exact staged-stream state
machine, not by guessing whether `Dispose` followed a caught exception. A new
write stream starts `Writing`; every Write updates the provider-owned byte count
and SHA-256. A successful terminal `Flush`/`FlushAsync` is the only `Prepared`
transition: it first proves the expected length/digest, then seals the stream so
later writes fail. Any short write, mismatch, cancellation, Write failure, or
Flush failure transitions to `Aborted`. Dos.ORM performs the copy while
cancellation is observable, flushes once, and after Flush succeeds enters a
non-cancellable two-instruction commit window that only disposes the stream.
Disposing `Prepared` atomically publishes exactly once and returns success;
disposing `Writing`/`Aborted` discards. A provider must never publish and then
throw from Dispose. If atomic publish fails, it throws before visibility and
the staged object remains absent. Fault-injection tests cover cancellation
before/during Flush, cancellation signalled after successful Flush (commit is
already irrevocably prepared), write/flush/publish failures, repeated Dispose,
and no user callback or unrelated work between successful Flush and Dispose.

`ApprovalExecutionFailure.DeniedCurrentAuthorization` must use an otherwise
exact compiled approval and a non-default active authorizer that denies the
current principal, proving approval possession never bypasses live policy.

The Task 2 Step 0 capture commit already contains the literal snapshot,
serializer, permanent subset test, and recorded output/hash from the removed
temporary exact-current verification. Task 3 Step 1A adds only the
permanent current-minus-baseline equals final literal-delta assertion beside
that already-permanent subset assertion. It is intentionally RED against the
authorizer-only partial delta before Task 3 production exists; no post-change
test asserts that the complete current surface equals the pre-change baseline,
and the baseline file itself is unchanged.

`ManagedExecutionSurfaceFixtures` defines `ApprovedLeafDto` with only
`ParameterBag`/`AtomicityRequirement` members, `SafeCycleA` and `SafeCycleB`
with self/mutual references plus approved leaves, and direct/nested/cyclic
request variants whose corresponding member is `DatabaseExecutionPlan`.
The walker receives these test-assembly types explicitly as user-owned.

`LegacyDbSessionConstructorCases.All` contains the exact active
netstandard2.1 descriptors `()`, `(Database)`, `(DatabaseType,string)`, and
`(string,string,string)`, with fake-provider factories for each. Its static
initialization compares that set to the constructor entries in the canonical
baseline. `DenialMatrix` is `All` crossed with all four
`DeniedAuthorizationCase` values, producing sixteen rows rather than a
hand-selected constructor subset.

Run the Step 1B direct-reference tests separately:

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~AstExecutionEntryPointTests|FullyQualifiedName~DatabaseResourceProviderTests|FullyQualifiedName~ManagedSqlSectionTests|FullyQualifiedName~ManagedReaderLeaseTests|FullyQualifiedName~LogicalTextMaterializationTests|FullyQualifiedName~ManagedExecutionSurfaceTests" --nologo
~~~

Expected: compile RED on the direct references to missing `DbSession`,
`DbTrans`, and `SafeTransactionProxy` APIs, the missing resource-provider
interface, and both missing authorizer-bearing constructors. This compile RED
is recorded separately and does not obscure or
replace the already-recorded Step 1A subset GREEN/exact-delta assertion RED.

- [ ] **Step 2: Add overloads without changing old signatures**

~~~csharp
public interface IDatabaseResourceProvider
{
    Stream OpenRead(DatabaseResourceHandle resource);
    Stream OpenWrite(DatabaseResourceHandle resource);
}

public SqlSection FromAst(SqlStatement statement, ParameterBag values);
public int ExecuteAst(SqlStatement statement, ParameterBag values);
public DatabaseExecutionPlan PreviewMigration(
    MigrationPlan plan,
    AtomicityRequirement requestedAtomicity);
public DatabaseExecutionPlan PreviewAdmin(
    DatabaseAdminOperation operation,
    AtomicityRequirement requestedAtomicity);
public MigrationResult ExecuteMigration(
    MigrationPlan plan,
    ParameterBag values,
    AtomicityRequirement requestedAtomicity);
public MigrationResult ExecuteMigration(
    MigrationPlan plan,
    ParameterBag values,
    AtomicityRequirement requestedAtomicity,
    CompiledImpactApproval approval);
public DatabaseAdminResult ExecuteAdmin(
    DatabaseAdminOperation operation,
    ParameterBag values,
    AtomicityRequirement requestedAtomicity);
public DatabaseAdminResult ExecuteAdmin(
    DatabaseAdminOperation operation,
    ParameterBag values,
    AtomicityRequirement requestedAtomicity,
    CompiledImpactApproval approval);
public SqlSection FromNativeSql(
    string sql,
    NativeSqlCommandKind kind,
    IEnumerable<ParameterDefinition> parameters,
    ParameterBag values);
public DbSession(
    Database db,
    IManagedSqlExecutionAuthorizer authorizer);
public DbSession(
    Database db,
    IManagedSqlExecutionAuthorizer authorizer,
    IDatabaseResourceProvider resourceProvider);
~~~

`FromAst` and `FromNativeSql` use one internal `SqlSection` managed mode; they
must not compile or materialize a `DatabaseExecutionPlan`, create a
`DbCommand`, or copy text into the legacy public constructor before returning.
`ManagedSqlSectionState` stores only the immutable source (`SqlStatement` or an
internal pending user-native tuple of exact `string` text and
`NativeSqlCommandKind`), an eagerly enumerated immutable snapshot of the native
`ParameterDefinition` sequence, the immutable `ParameterBag`, the originating
session, an optional reference-identical `DbTrans` connection/transaction
scope, a validated timeout option, terminal intent, and poison state. It stores
no compiled plan, command, parameter, provider, platform definition, driver,
ticket, arbitrary transaction, or caller stream.

Every existing sync/async `Section`/`SqlSection` terminal first discriminates
legacy versus managed mode. Legacy `FromSql(string)` continues through its
historical `cmd`/`tran` path unchanged. A managed terminal calls only
`SqlExecutionCoordinator`, which at that moment opens/uses the owned scope,
detects the exact live profile, compiles, checks source/values/profile/schema/
gates, creates the private single-use ticket, materializes with `ticket.Driver`,
and executes/adapts the requested result without returning a command. For a
section originating from `DbTrans`, the only permitted scope is that
`DbTrans`'s reference-identical connection and transaction, including
`ReferenceEquals(transaction.Connection, connection)`; no public setter can
replace either. The public slow-SQL `Action<DbCommand,...>` callback is not
invoked for managed commands because that would leak a managed command;
sanitized internal telemetry may record duration/category only.

Managed `ToPageList<T>(pageIndex,pageSize)` and its async twin are a
single-compile/two-step terminal. They require a `SelectStatement`, positive
page arguments, and checked offset arithmetic.
When the source has no page, derive an immutable
`OffsetPageSpec((pageIndex-1)*pageSize, pageSize)`; when it already has an
`OffsetPageSpec`, require exact structural equality with those derived values
and do not layer a second page; any other page shape fails. Building a separate
count AST is forbidden here: attach the one exact page to the immutable source and call
the compiler exactly once. That compile internally derives the count/data
branches and returns exactly `[Scalar, RowSet]`; preflight the complete ordered
plan once, then execute both commands on the same reference-identical validated
scope. The terminal never calls `SqlString`/`CountSqlString`. No step contains a
semicolon or SQL text copied/wrapped by `SqlSection`. `NativeSqlText`, a
non-`SelectStatement`, invalid/overflowing page arguments, or incompatible
pre-existing paging fails before compiler or command creation.

Managed `ToMultipleResult<T1,T2>`/`<T1,T2,T3>` and async twins first compile
but then require the plan to declare `MultipleResultSets` with exactly two or
three ordered `RowSet` steps respectively. Wrong plan shape, step count, or
step shape fails before preflight materialization/command creation. The exact
terminal case table records per case expected compiler-call count, command
count, ordered result shapes, command texts, and bindings; no test assumes a
single command for page-list or multiple-result terminals. Sync and async
variants share the same matrix and golden expectations.

`ToEnumerable<T>` is truly lazy in managed mode: creating the enumerable and
its enumerator performs no compile/preflight/command work; the first
`MoveNext()` starts one fresh invocation. A `try/finally` around the iterator
owns an internal reader lease, so complete enumeration, early enumerator
disposal, `Read` failure, and deserializer failure each dispose the underlying
reader and private command exactly once. A separately enumerated instance
recompiles/repreflights as a separate invocation; poisoned state never runs.

Managed `ToDataReader()` accepts only a plan that can be represented by one
`RowSet` command and returns it through internal sealed
`ManagedDataReaderLease : IDataReader`, never the provider reader or command
directly. The lease delegates the `IDataReader` contract but exposes no public
command/connection/transaction/lease property. `Close`, `Dispose`, final EOF,
and any delegated reader exception converge through one interlocked idempotent
release path: dispose provider reader, dispose private command, then dispose
only a connection/transaction scope explicitly marked as session-owned for
that invocation. A scope supplied by `DbTrans` is never closed, committed,
rolled back, or disposed by the section/lease. The same ownership rules apply
to sync materializers that consume a lease internally.

For every AST-managed row/scalar/returning/output result, the internal ordered
`SqlResultValueContract` is mandatory. `ManagedDataReaderLease`, scalar/list/
entity materializers, `IDataRecord.GetValue`/`GetValues`/indexers/`GetString`/
`GetChars`, and output-parameter copyback decode NonEmptyEnvelopeV1 before any
logical value is exposed. `GetChars` maps the logical offset to physical offset
plus the one marker character without materializing a large CLOB. NULL remains
NULL, the marker alone becomes empty, and a non-NULL unmarked value poisons the
invocation, releases reader/command/scope exactly once, and throws a value-safe
storage-contract exception. NativeSqlText results deliberately have no logical
value contract and remain provider-specific physical values.

On managed sections, `SetDbTransaction`, `AddParameter`, and each of the three
`AddInParameter` overloads immediately mark the state poisoned and throw
`InvalidOperationException` before compilation/preflight/command creation.
Every later terminal on that poisoned section also fails before command
creation even when the caller catches the first exception. No supplied
`DbParameter`, value, or transaction is retained. `SetCommandTimeout` is not a
parameter/transaction bypass: for a positive value it records only timeout
metadata in managed state and the coordinator applies it after the validated
driver creates the private command; non-positive values preserve legacy no-op
semantics. No `SqlString`, command, transaction, parameter collection, managed
state, terminal-intent, or plan property is added to the public/protected
surface. Tests observe text and bindings only through the fake internal
Database/driver execution capture.

The public native method is the sole session-owned source factory: it implies
`SqlSafetyOrigin.UserProvided` and deliberately accepts neither
`DialectProfile` nor `NativeSqlText`. Only at a terminal, after the owning
connection is open and its canonical exact live profile has been detected, the
internal coordinator creates `NativeSqlText.UserProvided(sql, liveProfile,
kind)` and immediately runs the ordinary source/profile preflight. A profile
drift or forged internal source still fails before command creation. No managed
host exposes a profile property, profile-returning method, DatabaseType-only
factory, or overload accepting caller-supplied `NativeSqlText`; exact-profile
mismatch tests remain internal coordinator/preflight tests.

`CanonicalPublicApiSurface` first proves every complete assembly baseline entry
is unchanged, then requires every added type/member/interface/map descriptor to
equal `Task7PublicApiDeltaAllowlist`. `ManagedExecutionSurfaceContract` gives
the allowlisted hosts focused dispatch/type-graph diagnostics. Both use
`BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance |
BindingFlags.Static | BindingFlags.DeclaredOnly` and accessible visibility.
No managed-delta field/property/event/nested-type descriptor exists, so any
such addition fails. The exact method matrix is:

| Name | Return | Ordered parameter type/name pairs |
|---|---|---|
| `FromAst` | `SqlSection` | `SqlStatement statement`; `ParameterBag values` |
| `ExecuteAst` | `int` | `SqlStatement statement`; `ParameterBag values` |
| `FromNativeSql` | `SqlSection` | `string sql`; `NativeSqlCommandKind kind`; `IEnumerable<ParameterDefinition> parameters`; `ParameterBag values` |
| `PreviewMigration` | `DatabaseExecutionPlan` | `MigrationPlan plan`; `AtomicityRequirement requestedAtomicity` |
| `PreviewAdmin` | `DatabaseExecutionPlan` | `DatabaseAdminOperation operation`; `AtomicityRequirement requestedAtomicity` |
| `ExecuteMigration` | `MigrationResult` | `MigrationPlan plan`; `ParameterBag values`; `AtomicityRequirement requestedAtomicity` |
| `ExecuteMigration` | `MigrationResult` | `MigrationPlan plan`; `ParameterBag values`; `AtomicityRequirement requestedAtomicity`; `CompiledImpactApproval approval` |
| `ExecuteAdmin` | `DatabaseAdminResult` | `DatabaseAdminOperation operation`; `ParameterBag values`; `AtomicityRequirement requestedAtomicity` |
| `ExecuteAdmin` | `DatabaseAdminResult` | `DatabaseAdminOperation operation`; `ParameterBag values`; `AtomicityRequirement requestedAtomicity`; `CompiledImpactApproval approval` |

`CreateDatabaseOperation`, `DropDatabaseOperation`,
`DatabaseImportOperation`, and `DatabaseExportOperation` are source DTO
subtypes of `DatabaseAdminOperation`; private Microi.net lifecycle code uses the
two `ExecuteAdmin` source overloads. The actual
`DatabaseDiagnosticOperation : SqlStatement` goes through the existing
`FromAst` source overload and returns its `SqlSection` result path. Neither path
consumes an internal service interface. Only elevated preview code receives the
review-only plan. No additional public diagnostics/lifecycle helper is added
after the baseline freeze, and no lifecycle DTO carries `NativeSqlText` or
provider context.

Every method is public, instance, non-static, non-generic, and has only
ordinary non-by-ref/non-out/non-array/non-`params` parameters with
`IsOptional=false` and `HasDefaultValue=false`. `DbSession` requires
`IsVirtual=false`. `DbTrans` requires `IsVirtual=true`, `IsAbstract=false`, and
`IsFinal=false`. `SafeTransactionProxy` requires a non-final override whose
`GetBaseDefinition()` equals the corresponding `DbTrans` descriptor. Only the
two exact previews may directly return `DatabaseExecutionPlan`; only the two
four-parameter execution overloads may accept the final, non-null-by-contract
`approval`.

Freeze exact type and interface shapes in the focused contract:

| Type | Base | Exact interfaces | Exact map |
|---|---|---|---|
| `CommandCreator` | `object` | empty | empty |
| `DbSession` | `object` | empty | empty |
| `DbTrans` | `object` | `IDisposable` only | `IDisposable.Dispose -> DbTrans.Dispose`, base definition `DbTrans.Dispose` |
| `SafeTransactionProxy` | `DbTrans` | `IDisposable` only | `IDisposable.Dispose -> SafeTransactionProxy.Dispose`, base definition `DbTrans.Dispose` |
| `IManagedSqlExecutionAuthorizer` | null | empty | empty |
| `IDatabaseResourceProvider` | null | empty | empty |

Compare interface identity and every `GetInterfaceMap` method/target descriptor,
not only interface count. A private explicit target is part of this map.

The managed constructor delta is exactly these two public instance
constructors and no others:

~~~csharp
DbSession(Database db, IManagedSqlExecutionAuthorizer authorizer)
DbSession(Database db, IManagedSqlExecutionAuthorizer authorizer,
    IDatabaseResourceProvider resourceProvider)
~~~

Every parameter is ordinary/non-optional/no-default. Both constructors guard
`db` and `authorizer`; the three-argument constructor also guards
`resourceProvider`, and stores those exact supplied instances. No managed
constructor delta is permitted on `DbTrans` or `SafeTransactionProxy`.

Freeze `IManagedSqlExecutionAuthorizer` as a public non-generic interface with
`BaseType == null`, an exact empty `GetInterfaces()` base-interface set, no
property/field/event/nested-type expansion, and these exact public instance
abstract/virtual `void` descriptors:

~~~csharp
void DemandMigrationExecution(MigrationPlan source);
void DemandMigrationExecution(
    MigrationPlan source, CompiledImpactApproval approval);
void DemandAdminExecution(DatabaseAdminOperation source);
void DemandAdminExecution(
    DatabaseAdminOperation source, CompiledImpactApproval approval);
~~~

Freeze `IDatabaseResourceProvider` as a second public non-generic interface
with the same empty base-interface/property/field/event/nested-type shape and
exactly these two public instance abstract/virtual descriptors—no async,
path/string/byte-array, metadata, existence, delete, commit, SQL, provider,
driver, connection, transaction, or plan member is allowed:

~~~csharp
Stream OpenRead(DatabaseResourceHandle resource);
Stream OpenWrite(DatabaseResourceHandle resource);
~~~

Both parameters are ordinary and non-null-by-contract. Each successful call
returns a fresh, non-null stream and transfers exclusive disposal ownership to
Dos.ORM. `OpenRead` must be readable and may be non-seekable; `OpenWrite` must
be writable and may be non-seekable. The provider resolves only the opaque
handle and stages writes so a partially written or digest-mismatched export is
never published. The returned write stream implements the frozen
Writing/Prepared/Aborted protocol above: terminal Flush is prepare, Prepared
Dispose is the only atomic publish, and every unprepared/failed disposal
discards. This protocol is behavior of the returned Stream and adds no third
public provider method.

The recursive graph checker is iterative or recursive with an explicit
`HashSet<Type>` visited set and this exact traversal order:

`IsUserOwned` returns true for types in the Dos.ORM assembly and for the
explicit mutation-fixture assembly passed by the test. BCL closed-container
members are not traversed, but every generic argument is. Any foreign concrete
request signature already fails the exact managed descriptor matrix.

~~~text
Scan(type, slotContext):
  allow DatabaseExecutionPlan only when slot is the direct return of the exact
    PreviewMigration/PreviewAdmin descriptor
  if type == object:
    stop successfully only for TerminalBaseOfAcceptedUserClass
    otherwise reject object/dynamic payload
  reject generic parameter, ContainsGenericParameters, untyped dictionary,
    and delegate shape
  if array/by-ref/pointer: Scan(element type, Payload)
  if Nullable<T>: Scan(T, Payload)
  if closed generic: Scan(each generic argument, Payload)
  reject plan/plan-step, ValidatedExecutionTicket, materializer, coordinator,
    DbCommand/command collection, DbConnection/IDbConnection,
    DbTransaction/IDbTransaction, and assignable provider-specific contexts
  allow Stream only as the direct return of the exact
    IDatabaseResourceProvider.OpenRead/OpenWrite descriptors
  accept only exact source/value/atomicity/approval leaf types
  if user-owned and newly visited:
    if BaseType == object: Scan(object, TerminalBaseOfAcceptedUserClass)
    else if BaseType != null: Scan(BaseType, Payload)
    Scan(every interface, Payload)
    Scan(all declared instance field and property/indexer types, Payload)
    Scan(all declared event handler/delegate Invoke signatures, Payload)
    Scan(every public constructor parameter, Payload)
    Scan(every public static factory parameter and return, Payload)
~~~

Exact leaves are `SqlStatement`, `NativeSqlText`, `ParameterDefinition`,
`ParameterBag`, `MigrationPlan`, `DatabaseAdminOperation`,
`AtomicityRequirement`, and `CompiledImpactApproval`. Descriptor context alone
also allows `DatabaseResourceHandle` as the exact resource-provider parameter
leaf, `Database`/`IManagedSqlExecutionAuthorizer` in both new constructors,
`IDatabaseResourceProvider` only in the three-argument constructor,
`string`, `NativeSqlCommandKind`, and `IEnumerable<ParameterDefinition>` in
`FromNativeSql`, and the exact scalar/result return leaves `void`, `int`,
`SqlSection`, `MigrationResult`, and
`DatabaseAdminResult`. `DatabaseExecutionPlan` is a leaf only in the direct
return slot of the two exact previews. Mark user-owned types visited before
member descent so self and mutual cycles terminate. `System.Object` is not a
leaf; only the terminal-base context stops. A wrapper shape not present in the
matrix still fails the descriptor comparison even if its contents are
otherwise safe. The approved-leaf DTO/self-cycle/mutual-cycle fixtures must be
GREEN, while their direct/nested/cyclic plan counterparts fail the graph
assertion itself.

Add mutation-sensitive tests by applying and restoring each of these concrete
edits; each focused run must fail before the mutation is restored:

- add `ExecuteManaged(DatabaseExecutionPlan[] plans)`;
- add `ExecuteManaged(List<DatabaseExecutionPlan> plans)`;
- add a user request whose private field, public property, or public
  constructor parameter carries `DatabaseExecutionPlan`, including a
  self-referential request cycle;
- add `ExecuteManaged(object request)`,
  `ExecuteManaged<TRequest>(TRequest request)`, a delegate request, or an
  untyped dictionary request;
- add a public/protected static executor with otherwise valid source/value
  parameters;
- return `DbCommand`, `IReadOnlyList<DbCommand>`, a ticket, materializer, or
  coordinator from a managed method;
- add a public interface implemented explicitly/private by a managed host, or
  a base interface inherited by `IManagedSqlExecutionAuthorizer` or
  `IDatabaseResourceProvider`;
- add a property/event/third method to `IDatabaseResourceProvider`, make either
  method async/generic/static, accept a path/string/SQL/plan/provider/driver/
  connection/transaction/caller stream, or return `Stream` from any other
  public/protected slot;
- add a top-level public extension in `CommandCreator.cs` that accepts a plan
  and returns a command, and an arbitrarily named public adapter/wrapper in a
  different Dos.ORM file; and
- add a harmless but unclassified public type/member to prove exact allowlist
  equality is independent of dangerous-type detection.

Add virtual equivalents to DbTrans and forwarding overrides to
SafeTransactionProxy. Declare one internal
`DenyManagedSqlExecutionAuthorizer.Instance` and one internal
`UnavailableDatabaseResourceProvider.Instance`; initialize both readonly
session fields at field/common-object initialization, not only inside
`initDbSesion`. This covers the independent
`DbSession(string assemblyName, string className, string connStr)` path as well
as `()`, `(Database)`, and `(DatabaseType,string)`. The two-argument managed
constructor rejects null and assigns the exact supplied database/authorizer
while retaining the unavailable-resource sentinel. The three-argument form
also rejects null and assigns the exact supplied resource provider. `DbTrans`
reads those session fields; its copy constructor and `SafeTransactionProxy`
retain the same session/authorizer/resource-provider references. The authorizer
has distinct no-approval and approval methods for both source families; neither
accepts a nullable approval, and both recheck current authorization. The
sixteen legacy-constructor by dispatch-arity cases deny before command
creation, and all six constructor families (the four legacy families plus the
two managed forms) pass the transaction/proxy identity theory. `ExecuteAst`
rejects migration and all four admin source subtypes so callers cannot bypass
the typed overloads.

The coordinator routes only `DatabaseImportOperation` and
`DatabaseExportOperation` through `DatabaseResourcePipeline`. With the
unavailable sentinel they fail before provider invocation, parser/compiler,
driver command creation, or database execution; all non-resource statement,
migration, create, and drop operations continue normally. Import validates the
handle and lower-hex SHA-256 `ContentDigest`, opens exactly one readable stream,
and hashes it into a bounded Dos.ORM-owned spool before invoking any import
parser. Export first completes into a private bounded spool, hashes the exact
bytes, compares/reports the operation handle digest, and only then calls
`OpenWrite`, copies, flushes, and disposes. A digest mismatch, null/wrong-
capability stream, open/read/write/flush failure, oversize spool, or early EOF
publishes nothing and creates no fallback SQL path. The provider never sees
the database, selected driver, compiled plan, or generated SQL.

Preview detects the active live full profile, reads the current SchemaToken,
constructs exact options from that profile/token plus requested atomicity,
compiles the source, and returns the closed immutable plan without creating a
command. After external authorization, the preview alone mints the audit-only
CompiledImpactApproval. The approval execution overload re-detects/re-reads,
recompiles the exact source, validates/attaches only through
`WithEffectiveImpactApproval`, calls the matching active-authorizer overload
for the current principal, rechecks Task 6 neutral/admin gates, and then enters
Task 2 preflight. It never executes the preview plan. The no-approval overload
rejects an elevated recompile; the approval overload rejects null, foreign,
source-mutated, stale-preview/profile/schema/plan, exact-but-needless, or
foreign-and-needless approval before command creation. Exact deterministic
retry reuse is allowed only while
source/profile/schema/options/compiler output remain exact.

At the first managed terminal, `FromNativeSql` creates its internal source only
after detecting the live profile, then preflight revalidates the same database
type, Major, Minor, Build, Revision, and ordinal compatibility mode before
command creation. No caller supplies `TargetProfile`, and Dos.ORM never
translates the user text.
Every Required path uses the same validated connection/transaction ticket from
Task 2. `ApprovalReference` and `CompiledImpactApproval` remain audit evidence,
never authentication or a substitute for current authorization or Task 6.

- [ ] **Step 3: Run and verify GREEN**

Run the focused tests, `ManagedExecutionSurfaceTests`, and
`PublicApiBaselineTests`. Expected: PASS with the immutable complete-assembly
baseline preserved, current-minus-baseline equal to the literal delta, exactly
nine managed methods per host, exact host/authorizer/resource interfaces/maps,
the two exact managed constructor deltas, four exact authorizer methods, two
exact resource-provider methods, approved DTO/cycle
GREEN fixtures, nested-plan RED fixtures, and all sixteen constructor-denial
cases plus six identity families. Every managed-section terminal must show
zero eager command creation then its case-specific exact compiler/command/
shape/text/binding sequence on one validated scope; page-list must be two
semicolon-free `[Scalar,RowSet]` steps, and multiple-result mismatch must create
zero commands. Enumerable/reader full, early-stop, EOF, Close, Dispose, and
exception paths must release reader/private-command/session-owned scope exactly
once without disposing an external DbTrans. Every parameter/transaction
mutation case must poison and fail with zero command creation, while the legacy
`FromSql` fake execution capture preserves its original text and mutation
behavior. Apply and restore each interface/extension/
adapter/array/generic/wrapper/object/open-generic/delegate/static-executor/
command-return/resource-provider mutation and record the intended focused RED.

- [ ] **Step 4: Commit**

~~~powershell
git status --short -- ./Microi.Server/Dos.ORM/Db ./Microi.Server/Dos.ORM/Section ./Microi.Server/Dos.ORM.Tests
git add -- ./Microi.Server/Dos.ORM/Db/DbSession.cs ./Microi.Server/Dos.ORM/Db/DbTrans.cs ./Microi.Server/Dos.ORM/Db/SafeTransactionProxy.cs ./Microi.Server/Dos.ORM/Section/Section.cs ./Microi.Server/Dos.ORM/Section/SqlSection.cs ./Microi.Server/Dos.ORM/Section/ManagedSqlSectionState.cs ./Microi.Server/Dos.ORM/Section/ManagedDataReaderLease.cs ./Microi.Server/Dos.ORM/Section/SessionBoundNativeSqlSource.cs ./Microi.Server/Dos.ORM/SqlAst/IDatabaseResourceProvider.cs ./Microi.Server/Dos.ORM/SqlCompilation/DatabaseResourcePipeline.cs ./Microi.Server/Dos.ORM/SqlCompilation/SqlExecutionCoordinator.cs ./Microi.Server/Dos.ORM/SqlCompilation/SqlCommandMaterializer.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/PublicApiBaselineTests.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/AstExecutionEntryPointTests.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/DatabaseResourceProviderTests.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/ManagedSqlSectionTests.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/ManagedReaderLeaseTests.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/LogicalTextMaterializationTests.cs ./Microi.Server/Dos.ORM.Tests/Architecture/ManagedExecutionSurfaceTests.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/ApprovalExecutionHarness.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/DatabaseResourceProviderHarness.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/ManagedSqlSectionHarness.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/ManagedReaderLeaseHarness.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/LogicalTextMaterializationHarness.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/Task7PublicApiDeltaAllowlist.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/ManagedExecutionSurfaceContract.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/ManagedExecutionSurfaceFixtures.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: add managed AST preview and execution entry points"
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
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter FullyQualifiedName~ExpressionCompatibilityTests --nologo
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
git status --short -- ./Microi.Server/Dos.ORM/Common/Field.cs ./Microi.Server/Dos.ORM/Expression ./Microi.Server/Dos.ORM/SqlAst/Compatibility ./Microi.Server/Dos.ORM.Tests/Compatibility/ExpressionCompatibilityTests.cs
git add -- ./Microi.Server/Dos.ORM/Common/Field.cs ./Microi.Server/Dos.ORM/Expression/Expression.cs ./Microi.Server/Dos.ORM/Expression/WhereClip.cs ./Microi.Server/Dos.ORM/Expression/OrderByClip.cs ./Microi.Server/Dos.ORM/Expression/GroupByClip.cs ./Microi.Server/Dos.ORM/Expression/ExpressionToClip.cs ./Microi.Server/Dos.ORM/SqlAst/Compatibility/LegacyFieldAdapter.cs ./Microi.Server/Dos.ORM/SqlAst/Compatibility/LegacyExpressionAdapter.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/ExpressionCompatibilityTests.cs
git diff --cached --name-only
git diff --cached --check
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
[MemberData(nameof(DialectCases.AllCertified),
    MemberType = typeof(DialectCases))]
public void SqlSection_page_list_uses_dialect_plan_not_unconditional_limit(
    CertifiedDialectCase dialect)
{
    var section = SectionTestFactory.Create(dialect);
    section.Page(20, 2);
    var plan = section.BuildPagePlanForTest();
    Assert.Equal(SqlResultShape.MultipleResultSets, plan.ResultShape);
    Assert.Collection(plan.Steps,
        count => Assert.Equal(SqlResultShape.Scalar, count.ResultShape),
        data => Assert.Equal(SqlResultShape.RowSet, data.ResultShape));
    Assert.All(plan.Steps.Cast<SqlCommandStep>(),
        step => Assert.DoesNotContain(";", step.CommandText));
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~FromSectionCompatibilityTests|FullyQualifiedName~SqlSectionPaginationTests" --nologo
~~~

Expected: FAIL because FromSection is still string-only and SqlSection always uses LIMIT/OFFSET.

- [ ] **Step 3: Build SelectStatement incrementally**

Each existing fluent method updates the internal immutable SelectStatement and
still returns the same legacy type. SqlString and CountSqlString compile their
legacy display snapshots lazily, but neither display compilation participates
in execution. `ToPageList` constructs one ordered `SelectStatement` carrying
one `OffsetPageSpec` and submits it to the compiler exactly once. That one
source-aware plan contains the compiler-owned independent `[Scalar, RowSet]`
steps and derived `MultipleResultSets` shape under one validated execution
scope. The adapter reads the count scalar first and page rowset second into the
existing result contract; it never compiles a separate Count AST, derives
paging SQL itself, discards/reorders either result, or concatenates queries
with semicolons.

- [ ] **Step 4: Run and verify GREEN**

Run focused tests and the full Dos.ORM.Tests project. Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git status --short -- ./Microi.Server/Dos.ORM/Section ./Microi.Server/Dos.ORM/SqlAst/Compatibility/LegacyFromSectionAdapter.cs ./Microi.Server/Dos.ORM.Tests/Compatibility
git add -- ./Microi.Server/Dos.ORM/Section/FromSection.cs ./Microi.Server/Dos.ORM/Section/SqlSection.cs ./Microi.Server/Dos.ORM/SqlAst/Compatibility/LegacyFromSectionAdapter.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/FromSectionCompatibilityTests.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/SqlSectionPaginationTests.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "refactor: route query sections through SQL AST"
~~~

### Task 6: Adapt CommandCreator Insert, Update, and Delete

**Files:**
- Modify: Microi.Server/Dos.ORM/Db/CommandCreator.cs
- Modify: Microi.Server/Dos.ORM/Db/DbSession.cs
- Modify: Microi.Server/Dos.ORM/Db/DbTrans.cs
- Create: Microi.Server/Dos.ORM/SqlAst/Compatibility/LegacyCommandFactoryBinder.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/CommandCreatorTestHarness.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/CommandCreatorSurfaceContract.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/CommandCreatorCompatibilityTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Architecture/LegacyCommandCreatorBoundaryTests.cs

**Interfaces:**
- Preserves exactly the public `CommandCreator(Database)` constructor and the
  existing six `CreateInsertCommand`/`CreateUpdateCommand`/
  `CreateDeleteCommand` overloads returning mutable `DbCommand`.
- Produces: optional AST/compiler-backed ordinary DML formatting through a
  separate internal `LegacyCommandFactoryBinder`; never produces or consumes a
  managed execution ticket and never claims certified Task 7 execution.

- [ ] **Step 1: Write failing command capture tests**

~~~csharp
[Theory]
[MemberData(nameof(DialectCases.AllCertified),
    MemberType = typeof(DialectCases))]
public void Legacy_entity_dml_factory_returns_mutable_parameterized_command(
    CertifiedDialectCase dialect)
{
    var command = CommandCreatorTestHarness.UpdateUser(dialect);
    Assert.DoesNotContain("new-name", command.CommandText);
    Assert.Contains(command.Parameters.Cast<DbParameter>(),
        parameter => Equals(parameter.Value, "new-name"));

    command.CommandText = command.CommandText + " ";
    command.Transaction = dialect.Transaction;
    Assert.Same(dialect.Transaction, command.Transaction);
}

[Fact]
public void Accessible_command_factory_surface_is_exactly_the_legacy_dml_surface()
{
    CommandCreatorSurfaceContract.AssertExact(
        typeof(CommandCreator),
        new[]
        {
            MethodShape.GenericInstanceNonVirtual(
                "CreateUpdateCommand", typeof(DbCommand),
                GenericParameterShape.ExactBase(
                    "TEntity", typeof(Entity)),
                ParameterShape.Generic(0, "entity"),
                ParameterShape.Exact(typeof(WhereClip), "where")),
            MethodShape.GenericInstanceNonVirtual(
                "CreateUpdateCommand", typeof(DbCommand),
                GenericParameterShape.ExactBase(
                    "TEntity", typeof(Entity)),
                ParameterShape.Exact(typeof(Field[]), "fields"),
                ParameterShape.Exact(typeof(object[]), "values"),
                ParameterShape.Exact(typeof(WhereClip), "where")),
            MethodShape.NonGenericInstanceNonVirtual(
                "CreateDeleteCommand", typeof(DbCommand),
                ParameterShape.Exact(typeof(string), "tableName"),
                ParameterShape.Exact(typeof(string), "userName"),
                ParameterShape.Exact(typeof(WhereClip), "where")),
            MethodShape.GenericInstanceNonVirtual(
                "CreateDeleteCommand", typeof(DbCommand),
                GenericParameterShape.ExactBase(
                    "TEntity", typeof(Entity)),
                ParameterShape.Exact(typeof(WhereClip), "where")),
            MethodShape.GenericInstanceNonVirtual(
                "CreateInsertCommand", typeof(DbCommand),
                GenericParameterShape.ExactBase(
                    "TEntity", typeof(Entity)),
                ParameterShape.Exact(typeof(Field[]), "fields"),
                ParameterShape.Exact(typeof(object[]), "values")),
            MethodShape.GenericInstanceNonVirtual(
                "CreateInsertCommand", typeof(DbCommand),
                GenericParameterShape.ExactBase(
                    "TEntity", typeof(Entity)),
                ParameterShape.Generic(0, "entity"))
        },
        ConstructorShape.PublicInstance(
            ParameterShape.Exact(typeof(Database), "db")));
}

[Fact]
public void Legacy_factories_never_enter_the_validated_execution_path()
{
    ArchitectureAssert.CallGraphExcludes(
        typeof(CommandCreator),
        typeof(SqlExecutionCoordinator),
        typeof(SqlExecutionPreflight),
        typeof(SqlCommandMaterializer));
}

[Fact]
public void Managed_entrypoints_and_framework_never_call_CommandCreator()
{
    ArchitectureAssert.ManagedEntryPointsExcludeCommandCreator(
        typeof(DbSession), typeof(DbTrans), typeof(SafeTransactionProxy));
    ArchitectureAssert.NoCommandCreatorReferencesOutsideLegacyDosOrmFiles(
        Repository.Root,
        new[]
        {
            "Dos.ORM/Db/CommandCreator.cs",
            "Dos.ORM/Db/DbSession.cs",
            "Dos.ORM/Db/DbBatch.cs"
        },
        productionOnly: true);
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter FullyQualifiedName~CommandCreatorCompatibilityTests --nologo
~~~

Expected: at least one dialect still uses legacy text generation.

- [ ] **Step 3: Keep the public mutable-command factory outside managed execution**

Entity metadata may create `InsertStatement`, `UpdateStatement`, or
`DeleteStatement` plus `ParameterBag` and ask the owning Database's registered
compiler for a portable ordinary-DML template using its exact profile,
`AtomicityRequirement.None`, and no schema token. The internal
`LegacyCommandFactoryBinder` accepts only that exact ordinary-DML source, a
single no-Task6-impact CurrentDatabase command step, values, and the owning
Database; it creates the historical mutable `DbCommand` directly through the
driver. It is not `SqlCommandMaterializer` and cannot accept migration, schema,
admin, native, bulk, approval, ticket, or elevated plan shapes.

CommandCreator never calls `SqlExecutionCoordinator`,
`SqlExecutionPreflight`, `SqlCommandMaterializer`, or `ValidatedExecutionTicket`.
If the compiler is used, its transient plan is formatting input only and is
discarded after extracting the constrained DML template; no compiled approval
is attached and no managed-execution, PlatformGenerated certification,
profile-preflight, Task 6 gate, Required atomicity, single-use, mutation, or
replay guarantee is claimed. The external caller owns any later command text,
parameter, connection, transaction, execution, mutation, and disposal.

`CommandCreatorSurfaceContract` enumerates methods, constructors, fields,
properties/events, and nested types with
`BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.Instance |
BindingFlags.Static | BindingFlags.DeclaredOnly`, retaining public, family,
family-or-assembly, and family-and-assembly accessibility (or an accessible
property/event accessor / corresponding nested-type flag). Operators,
conversions, accessors, and factories participate in the method set. The
complete accessible method set equals the six descriptors above; there are no
protected methods. `MethodShape` requires public, instance, non-static, non-
virtual, exact `DbCommand` return, exact generic arity, and ordered parameter
types/names.
`ParameterShape` also requires by-ref/out=false, the exact rank-one array shape
where present, no `ParamArrayAttribute`, `IsOptional=false`, and
`HasDefaultValue=false`. `GenericParameterShape.ExactBase` requires exactly one
parameter named `TEntity`, sole constraint `Entity`, and no reference/value/
interface/default-constructor constraint; the table-delete method is exactly
non-generic.

The type assertion requires a public, non-abstract, non-sealed, non-generic
class with exact base `object`, exact empty `GetInterfaces()`, and no interface
map. The sole declared public/protected constructor is exactly the public
`CommandCreator(Database db)` with the same parameter flag checks. Declared
public/protected fields, properties, events, and nested types are empty.
Therefore a seventh instance method, a public/protected static method/factory,
operator/accessor, protected member, explicit interface, overload drift, or any
other accessible expansion fails even when it contains no managed type.
The recursive graph check additionally rejects `DatabaseExecutionPlan`, every
plan step, ticket/materializer/coordinator, `NativeSqlText`, `SchemaOperation`,
`MigrationPlan`, `DatabaseAdminOperation`, `CompiledImpactApproval`, and any
array/generic/request wrapper around them from all six parameter graphs.

Capture mutation REDs by changing a parameter type/order/name, removing the
`Entity` base constraint, adding an interface or `new()` constraint, converting
one method to static or virtual, adding a seventh public instance method, and
adding a public static `CreateInsertCommand` factory. Independently add
`protected DbCommand Materialize(DatabaseExecutionPlan plan)` and a public
`IPlanCommandEscape` whose method CommandCreator implements explicitly/private.
Each mutation must fail
`Accessible_command_factory_surface_is_exactly_the_legacy_dml_surface` for the
intended descriptor/protected/interface mismatch—not compilation, call graph,
or the assembly-wide fallback gate. Restore before the next mutation and
verify pre/post hashes match.

Existing legacy DbSession/DbBatch overloads may retain CommandCreator to remain
source compatible. Ast/preview/migration/admin/native methods never reference
it. The architecture test scans Microi.Server production sources outside the
three explicitly allowed legacy Dos.ORM files, excludes test projects that
verify the rule, and fails on any CommandCreator or Create*Command reference. A
mutation that routes a public factory through a validated ticket must fail even
when the returned command is otherwise equal.

- [ ] **Step 4: Run and verify GREEN**

Run both focused suites, public API tests, architecture tests, and
Dos.ORM.Tests. Expected: PASS with exact legacy signatures, no managed-type
parameter/return, exact empty protected/interface surface, no static/seventh/
member drift, no ticket-path call, and no platform caller. Run every parameter/
constraint/static/virtual/seventh/static-factory/protected/explicit-interface
mutation independently and record the intended focused RED.

- [ ] **Step 5: Commit**

~~~powershell
git status --short -- ./Microi.Server/Dos.ORM/Db ./Microi.Server/Dos.ORM/SqlAst/Compatibility ./Microi.Server/Dos.ORM.Tests
git add -- ./Microi.Server/Dos.ORM/Db/CommandCreator.cs ./Microi.Server/Dos.ORM/Db/DbSession.cs ./Microi.Server/Dos.ORM/Db/DbTrans.cs ./Microi.Server/Dos.ORM/SqlAst/Compatibility/LegacyCommandFactoryBinder.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/CommandCreatorCompatibilityTests.cs ./Microi.Server/Dos.ORM.Tests/Architecture/LegacyCommandCreatorBoundaryTests.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/CommandCreatorTestHarness.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/CommandCreatorSurfaceContract.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "refactor: isolate legacy entity command factories"
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
[MemberData(nameof(DialectCases.AllCertified),
    MemberType = typeof(DialectCases))]
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

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~SqlFuncCompatibilityTests|FullyQualifiedName~UpsertCompatibilityTests|FullyQualifiedName~BulkCopyCompatibilityTests" --nologo
~~~

Expected: failures expose legacy database switches and the transactionless fallback.

- [ ] **Step 3: Route all three features through compiler capabilities**

SqlFunc creates SemanticFunctionId expressions; its legacy string-return helpers compile only a function projection through the current platform. Upsert compiles one semantic UpsertStatement. Bulk chooses the platform native executor when its connection type matches, otherwise compiles Insert batches without leaving the active transaction.

- [ ] **Step 4: Run and verify GREEN**

Run focused suites and Dos.ORM.Tests. Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git status --short -- ./Microi.Server/Dos.ORM/Db ./Microi.Server/Dos.ORM.Tests/Compatibility
git add -- ./Microi.Server/Dos.ORM/Db/SqlFunc.cs ./Microi.Server/Dos.ORM/Db/Upsert.cs ./Microi.Server/Dos.ORM/Db/BulkCopy.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/BulkTestHarness.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/SqlFuncCompatibilityTests.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/UpsertCompatibilityTests.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/BulkCopyCompatibilityTests.cs
git diff --cached --name-only
git diff --cached --check
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
[MemberData(nameof(DialectCases.AllCertified),
    MemberType = typeof(DialectCases))]
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

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~CodeFirstCompatibilityTests|FullyQualifiedName~LegacyDdlServiceCompatibilityTests" --nologo
~~~

Expected: services still render separate SQL.

- [ ] **Step 3: Delegate every legacy member to Schema AST**

Keep IMicroiORM untouched. Six service classes become thin constructors/facades over LegacySchemaAdapter. CodeFirst maps entity metadata to TableDefinition and calls the same schema planner. Remove catch-all ExecuteSilent behavior; ignore only explicitly classified already-exists outcomes.

- [ ] **Step 4: Run and verify GREEN**

Run both focused suites, PublicApiBaselineTests, Dos.ORM.Tests, and the solution build. Expected: PASS and 0 build errors.

- [ ] **Step 5: Commit**

~~~powershell
git status --short -- ./Microi.Server/Dos.ORM/DDL ./Microi.Server/Dos.ORM/SqlAst/Compatibility/LegacySchemaAdapter.cs ./Microi.Server/Dos.ORM.Tests/Compatibility
git add -- ./Microi.Server/Dos.ORM/DDL/CodeFirst.cs ./Microi.Server/Dos.ORM/DDL/DbServiceParam.cs ./Microi.Server/Dos.ORM/DDL/Services/MySqlService.cs ./Microi.Server/Dos.ORM/DDL/Services/SqlServerService.cs ./Microi.Server/Dos.ORM/DDL/Services/OracleService.cs ./Microi.Server/Dos.ORM/DDL/Services/PostgreSqlService.cs ./Microi.Server/Dos.ORM/DDL/Services/DaMengService.cs ./Microi.Server/Dos.ORM/DDL/Services/KingBaseService.cs ./Microi.Server/Dos.ORM/SqlAst/Compatibility/LegacySchemaAdapter.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/CodeFirstCompatibilityTests.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/LegacyDdlServiceCompatibilityTests.cs
git diff --cached --name-only
git diff --cached --check
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
- Produces: internal `SqlPipelineMode.Legacy/Compare/Ast` and internal
  comparison diagnostics without parameter values. Tests use the existing
  friend-assembly boundary; Task 9 adds no public/protected Dos.ORM delta.

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

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter FullyQualifiedName~PipelineModeTests --nologo
~~~

Expected: mode types do not exist.

- [ ] **Step 3: Implement frozen-legacy comparison**

Compare normalized command structure, parameter definitions, result shape, and
atomicity without logging values. Keep both compatibility types and their
configuration path internal so the canonical baseline-plus-delta allowlist does
not expand. Read-only test mode may execute both against isolated fixtures;
production Compare never double-executes. Set the internal default to Ast only
after every compatibility suite is green.

- [ ] **Step 4: Run the complete adapter gate**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --nologo
dotnet test ./Microi.Server/Dos.Common.Tests/Dos.Common.Tests.csproj --nologo
dotnet build ./Microi.Server/Microi.net.sln --no-restore --nologo
~~~

Expected: all tests pass and build has 0 errors.

- [ ] **Step 5: Commit**

~~~powershell
git status --short -- ./Microi.Server/Dos.ORM ./Microi.Server/Dos.ORM.Tests
git add -- ./Microi.Server/Dos.ORM/SqlAst/Compatibility/SqlPipelineMode.cs ./Microi.Server/Dos.ORM/SqlAst/Compatibility/SqlPipelineComparison.cs ./Microi.Server/Dos.ORM/Db/Database.cs ./Microi.Server/Dos.ORM/Db/DbSession.cs ./Microi.Server/Dos.ORM.Tests/TestInfrastructure/PipelineHarness.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/PipelineModeTests.cs ./Microi.Server/Dos.ORM.Tests/Compatibility/LegacyCallSiteCompileTests.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: switch verified Dos.ORM paths to SQL AST"
~~~

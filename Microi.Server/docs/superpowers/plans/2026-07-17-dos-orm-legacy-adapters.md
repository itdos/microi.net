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
- Public managed-execution APIs accept source AST/native requests, invocation
  values, requested atomicity, and the distinct compiled-approval overload.
  PreviewMigration/PreviewAdmin may return an immutable DatabaseExecutionPlan;
  no public/protected execution or materialization API accepts one, a
  materializer, ticket, or arbitrary DbConnection/DbTransaction context.
- Commands materialized from a validated plan are created and executed only
  inside the registry-selected coordinator under a non-public single-use
  ticket; those commands never leave it.
- The existing public CommandCreator constructor and six mutable-command
  Insert/Update/Delete factories remain a separate caller-managed legacy
  escape hatch. They never consume a plan ticket or managed materializer and
  receive none of the managed gate, profile-preflight, replay, or atomicity
  guarantees.
- New AST/migration/admin/native entry points and migrated Microi.Server
  framework paths never call CommandCreator; only existing legacy Dos.ORM
  DbSession/DbBatch compatibility paths may continue to use it.
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
    var profile = TestProfiles.For(type);
    var provider = ProviderTestFactory.Create(profile);
    Assert.Equal(type, provider.Platform.Type);
    Assert.Same(provider.Platform.Compiler, provider.SqlCompiler);
    Assert.Same(profile, provider.Platform.Profile);
}

[Fact]
public void Provider_cache_key_contains_exact_dialect_profile()
{
    var exact = new DialectProfile(DatabaseType.PostgreSql,
        new Version(17, 2, 1, 4), "Oracle");
    var first = ProviderTestFactory.Create(exact);
    var mismatches = new[]
    {
        new DialectProfile(DatabaseType.MySql,
            new Version(17, 2, 1, 4), "Oracle"),
        new DialectProfile(DatabaseType.PostgreSql,
            new Version(18, 2, 1, 4), "Oracle"),
        new DialectProfile(DatabaseType.PostgreSql,
            new Version(17, 3, 1, 4), "Oracle"),
        new DialectProfile(DatabaseType.PostgreSql,
            new Version(17, 2, 2, 4), "Oracle"),
        new DialectProfile(DatabaseType.PostgreSql,
            new Version(17, 2, 1, 5), "Oracle"),
        new DialectProfile(DatabaseType.PostgreSql,
            new Version(17, 2, 1, 4), "oracle"),
        new DialectProfile(DatabaseType.PostgreSql,
            new Version(17, 2, 1, 4), string.Empty)
    };

    Assert.All(mismatches, mismatch =>
        Assert.NotSame(first, ProviderTestFactory.Create(mismatch)));
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

Replace the official-six creation switch with registry-driven provider
construction while preserving explicit MsAccess, Sqlite3, and SqlServer9
legacy paths. Detect/construct one canonical live DialectProfile and pass that
single object to the registry; do not pass an independent DatabaseType. The
provider/cache key includes type, Major, Minor, Build, Revision, and ordinal
compatibility mode. Unknown aliases and alias/profile mismatch throw; they do
not fall through to SQL Server.

- [ ] **Step 4: Run and verify GREEN**

Run the focused command from Step 2 and PublicApiBaselineTests. Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/Provider Microi.Server/Dos.ORM.Tests/Compatibility/ProviderPlatformBindingTests.cs
git commit -m "refactor: bind Dos.ORM providers to dialect registry"
~~~

### Task 2: Validate and internally execute compiled plans without a public materialization bypass

**Files:**
- Modify: Microi.Server/Dos.ORM.Tests/Compatibility/PublicApiBaselineTests.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/CanonicalPublicApiSurface.cs
- Create: Microi.Server/Dos.ORM.Tests/Baselines/dos-orm-pre-managed-delta-public-api.txt
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlExecutionPreflight.cs (contains the nested private-constructible ticket)
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlExecutionCoordinator.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlCommandMaterializer.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/IDbDriverAdapter.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/IManagedSqlExecutionAuthorizer.cs
- Modify: Microi.Server/Dos.ORM/Db/Database.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/FakeDbDriver.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/TestConnections.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/ExecutionHarness.cs
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/SqlExecutionPreflightTests.cs

**Interfaces:**
- Produces only internal registry-selected managed coordinator/preflight/ticket/
  materializer execution; no public/protected managed command materialization
  API and no execution API accepting a plan.
- Consumes exact source AST/native request, invocation ParameterBag, requested
  atomicity, optional-by-overload compiled approval for elevated
  migration/admin, active Database-owned connection/transaction, detected live
  DialectProfile, current SchemaToken, current authorization, registered
  compiler, and driver adapter.

- [ ] **Step 0: Freeze the complete assembly surface before Task 2 production edits**

After Task 1 is committed, run all core, six-dialect, and adapter Task 1 tests
green. Before adding `IManagedSqlExecutionAuthorizer` or changing any Task 2
production/API file, implement `CanonicalPublicApiSurface` and use it once to
write and review `dos-orm-pre-managed-delta-public-api.txt`.

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
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~PublicApiBaselineTests --nologo
git add Microi.Server/Dos.ORM.Tests/Baselines/dos-orm-pre-managed-delta-public-api.txt Microi.Server/Dos.ORM.Tests/TestInfrastructure/CanonicalPublicApiSurface.cs Microi.Server/Dos.ORM.Tests/Compatibility/PublicApiBaselineTests.cs
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
    Assert.All(ticketType.GetConstructors(
            BindingFlags.NonPublic | BindingFlags.Instance),
        constructor => Assert.True(constructor.IsPrivate));
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~SqlExecutionPreflightTests --nologo
~~~

Expected: FAIL because the old plan exposes no validated ticket/coordinator and the reviewed materializer surface has not been implemented.

- [ ] **Step 3: Add the internal validated execution path**

~~~csharp
internal interface IDbDriverAdapter
{
    DialectProfile DetectProfile(DbConnection connection);
    SchemaToken ReadSchemaToken(DbConnection connection,
        DbTransaction transaction);
    DbCommand CreateCommand(DbConnection connection);
    DbParameter CreateParameter(BoundParameter parameter);
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
            DbConnection connection,
            DbTransaction transaction,
            DialectProfile liveProfile,
            SchemaToken schemaToken);

        internal DatabaseExecutionPlan Plan { get; }
        internal DbConnection Connection { get; }
        internal DbTransaction Transaction { get; }
        internal DialectProfile LiveProfile { get; }
        internal SchemaToken SchemaToken { get; }
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

The ticket is single-use and invocation-scoped. Materialize accepts no plan,
connection, or transaction parameter and calls `TryConsume` before creating
the first managed command. The coordinator retains and executes/adapts every
command materialized from a validated ticket through Database; those managed
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
git add Microi.Server/Dos.ORM/SqlCompilation Microi.Server/Dos.ORM/Db/Database.cs Microi.Server/Dos.ORM.Tests/Compatibility/SqlExecutionPreflightTests.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure
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
- Create: Microi.Server/Dos.ORM.Tests/Compatibility/AstExecutionEntryPointTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Architecture/ManagedExecutionSurfaceTests.cs

**Files (Step 2 implementation):**
- Modify: Microi.Server/Dos.ORM/Db/DbSession.cs
- Modify: Microi.Server/Dos.ORM/Db/DbTrans.cs
- Modify: Microi.Server/Dos.ORM/Db/SafeTransactionProxy.cs
- Modify: Microi.Server/Dos.ORM/Section/Section.cs
- Modify: Microi.Server/Dos.ORM/Section/SqlSection.cs

**Interfaces:**
- Produces: public source-only `FromAst`, `ExecuteAst`, `FromNativeSql`,
  `PreviewMigration`, `PreviewAdmin`, and the exact migration/admin execution
  overload pairs; matching DbTrans virtual methods and SafeTransactionProxy
  forwarding. Preview may return `DatabaseExecutionPlan`; no execution or
  materialization method accepts one.
- Produces: `DbSession(Database, IManagedSqlExecutionAuthorizer)` for a
  non-null active-session authorizer. Existing constructors use a deny-by-
  default authorizer for every managed migration/admin execution.
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
the nine managed methods on each host and the new authorizer-bearing
`DbSession` constructor. No later task adds another public/protected helper,
adapter, pipeline mode, or wrapper. Never regenerate the snapshot to make
either permanent test pass.

`Task7PublicApiDeltaAllowlist.All` is a checked-in ordinal set made only from
independently typed literal canonical descriptor strings in the exact grammar
emitted by `CanonicalPublicApiSurface`. Manually transcribe the authorizer type
and four methods, all three-times-nine host method descriptors, and the new
constructor descriptor from the frozen tables in this plan. The class must not
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
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter FullyQualifiedName~PublicApiBaselineTests --nologo
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
    var db = SessionTestFactory.Create(DatabaseType.PostgreSql);
    var section = db.FromSql("select vendor_specific_function()");
    Assert.Equal("select vendor_specific_function()", section.SqlString);
}

[Fact]
public void Native_profile_mismatch_fails_before_command_creation()
{
    var db = SessionTestFactory.Create(TestProfiles.PostgreSql17);
    var text = NativeSqlText.UserProvided(
        "select 1",
        new DialectProfile(DatabaseType.PostgreSql,
            new Version(17, 2, 0, 1), string.Empty),
        NativeSqlCommandKind.Read);

    Assert.Throws<InvalidOperationException>(() =>
        db.FromNativeSql(
            text,
            Array.Empty<ParameterDefinition>(),
            new ParameterBag()));
    Assert.Equal(0, db.Driver.CreateCommandCalls);
}

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
}

[Fact]
public void Explicit_authorizer_constructor_rejects_null_and_retains_identity()
{
    var capture = ApprovalExecutionHarness.ExplicitAuthorizerIdentity();
    Assert.Throws<ArgumentNullException>(() =>
        new DbSession(capture.Database, null));
    capture.AssertSameAuthorizerRetained(capture.Authorizer);
}
~~~

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
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter "FullyQualifiedName~AstExecutionEntryPointTests|FullyQualifiedName~ManagedExecutionSurfaceTests" --nologo
~~~

Expected: compile RED on the direct references to missing `DbSession`,
`DbTrans`, and `SafeTransactionProxy` APIs and the missing authorizer-bearing
constructor. This compile RED is recorded separately and does not obscure or
replace the already-recorded Step 1A subset GREEN/exact-delta assertion RED.

- [ ] **Step 2: Add overloads without changing old signatures**

~~~csharp
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
    NativeSqlText sql,
    IEnumerable<ParameterDefinition> parameters,
    ParameterBag values);
public DbSession(
    Database db,
    IManagedSqlExecutionAuthorizer authorizer);
~~~

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
| `FromNativeSql` | `SqlSection` | `NativeSqlText sql`; `IEnumerable<ParameterDefinition> parameters`; `ParameterBag values` |
| `PreviewMigration` | `DatabaseExecutionPlan` | `MigrationPlan plan`; `AtomicityRequirement requestedAtomicity` |
| `PreviewAdmin` | `DatabaseExecutionPlan` | `DatabaseAdminOperation operation`; `AtomicityRequirement requestedAtomicity` |
| `ExecuteMigration` | `MigrationResult` | `MigrationPlan plan`; `ParameterBag values`; `AtomicityRequirement requestedAtomicity` |
| `ExecuteMigration` | `MigrationResult` | `MigrationPlan plan`; `ParameterBag values`; `AtomicityRequirement requestedAtomicity`; `CompiledImpactApproval approval` |
| `ExecuteAdmin` | `DatabaseAdminResult` | `DatabaseAdminOperation operation`; `ParameterBag values`; `AtomicityRequirement requestedAtomicity` |
| `ExecuteAdmin` | `DatabaseAdminResult` | `DatabaseAdminOperation operation`; `ParameterBag values`; `AtomicityRequirement requestedAtomicity`; `CompiledImpactApproval approval` |

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

Compare interface identity and every `GetInterfaceMap` method/target descriptor,
not only interface count. A private explicit target is part of this map.

The managed constructor delta is exactly the public instance
`DbSession(Database db, IManagedSqlExecutionAuthorizer authorizer)`, with
ordinary non-optional/no-default parameters and a null guard. No managed
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
allows `Database`/`IManagedSqlExecutionAuthorizer` in the new constructor,
`IEnumerable<ParameterDefinition>` in `FromNativeSql`, and the exact scalar/
result return leaves `void`, `int`, `SqlSection`, `MigrationResult`, and
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
  a base interface inherited by `IManagedSqlExecutionAuthorizer`;
- add a top-level public extension in `CommandCreator.cs` that accepts a plan
  and returns a command, and an arbitrarily named public adapter/wrapper in a
  different Dos.ORM file; and
- add a harmless but unclassified public type/member to prove exact allowlist
  equality is independent of dangerous-type detection.

Add virtual equivalents to DbTrans and forwarding overrides to
SafeTransactionProxy. Declare one internal
`DenyManagedSqlExecutionAuthorizer.Instance` and initialize the session's
readonly authorizer field to it at field/common-object initialization, not only
inside `initDbSesion`. This covers the independent
`DbSession(string assemblyName, string className, string connStr)` path as well
as `()`, `(Database)`, and `(DatabaseType,string)`. The new authorizer overload
rejects null and assigns only the exact supplied instance. `DbTrans` reads that
session field; its copy constructor and `SafeTransactionProxy` retain the same
session/authorizer reference. The authorizer has distinct no-approval and
approval methods for both source families; neither accepts a nullable approval,
and both recheck current authorization. The sixteen legacy-constructor by
dispatch-arity cases deny before command creation, and all five legacy/new
constructor families pass the transaction/proxy identity theory. `ExecuteAst`
rejects migration and all four admin source subtypes so callers cannot bypass
the typed overloads.

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

FromNativeSql compares the detected live profile's database type, Major,
Minor, Build, Revision, and ordinal compatibility mode with
`sql.TargetProfile` before command creation and never translates text.
Every Required path uses the same validated connection/transaction ticket from
Task 2. `ApprovalReference` and `CompiledImpactApproval` remain audit evidence,
never authentication or a substitute for current authorization or Task 6.

- [ ] **Step 3: Run and verify GREEN**

Run the focused tests, `ManagedExecutionSurfaceTests`, and
`PublicApiBaselineTests`. Expected: PASS with the immutable complete-assembly
baseline preserved, current-minus-baseline equal to the literal delta, exactly
nine managed methods per host, exact host/authorizer interfaces/maps, the sole
managed constructor delta, four exact authorizer methods, approved DTO/cycle
GREEN fixtures, nested-plan RED fixtures, and all sixteen constructor-denial
cases plus five identity families. Apply and restore each interface/extension/
adapter/array/generic/wrapper/object/open-generic/delegate/static-executor/
command-return mutation and record the intended focused RED.

- [ ] **Step 4: Commit**

~~~powershell
git add Microi.Server/Dos.ORM/Db Microi.Server/Dos.ORM/Section Microi.Server/Dos.ORM.Tests/Compatibility/PublicApiBaselineTests.cs Microi.Server/Dos.ORM.Tests/Compatibility/AstExecutionEntryPointTests.cs Microi.Server/Dos.ORM.Tests/Architecture/ManagedExecutionSurfaceTests.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/ApprovalExecutionHarness.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/Task7PublicApiDeltaAllowlist.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/ManagedExecutionSurfaceContract.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/ManagedExecutionSurfaceFixtures.cs
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
dotnet test .\Dos.ORM.Tests\Dos.ORM.Tests.csproj --filter "FullyQualifiedName~FromSectionCompatibilityTests|FullyQualifiedName~SqlSectionPaginationTests" --nologo
~~~

Expected: FAIL because FromSection is still string-only and SqlSection always uses LIMIT/OFFSET.

- [ ] **Step 3: Build SelectStatement incrementally**

Each existing fluent method updates the internal immutable SelectStatement and
still returns the same legacy type. SqlString and CountSqlString compile the
AST lazily. ToPageList submits Count AST then Data AST as one ordered plan with
two independent Aggregate contributors `[Scalar, RowSet]`, derived
MultipleResultSets, and one validated execution scope. The adapter reads the
count scalar first and page rowset second into the existing result contract;
it never discards/reorders either result or concatenates queries with
semicolons.

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
[MemberData(nameof(DialectCases.AllCertified))]
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

Run CommandCreatorCompatibilityTests. Expected: at least one dialect still uses legacy text generation.

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
git add Microi.Server/Dos.ORM/Db/CommandCreator.cs Microi.Server/Dos.ORM/Db/DbSession.cs Microi.Server/Dos.ORM/Db/DbTrans.cs Microi.Server/Dos.ORM/SqlAst/Compatibility/LegacyCommandFactoryBinder.cs Microi.Server/Dos.ORM.Tests/Compatibility/CommandCreatorCompatibilityTests.cs Microi.Server/Dos.ORM.Tests/Architecture/LegacyCommandCreatorBoundaryTests.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/CommandCreatorTestHarness.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/CommandCreatorSurfaceContract.cs
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

Run PipelineModeTests. Expected: mode types do not exist.

- [ ] **Step 3: Implement frozen-legacy comparison**

Compare normalized command structure, parameter definitions, result shape, and
atomicity without logging values. Keep both compatibility types and their
configuration path internal so the canonical baseline-plus-delta allowlist does
not expand. Read-only test mode may execute both against isolated fixtures;
production Compare never double-executes. Set the internal default to Ast only
after every compatibility suite is green.

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

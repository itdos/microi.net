# Dos.ORM Six-Dialect Compiler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Compile the complete neutral AST into correct, parameterized execution plans for MySQL, SQL Server, Oracle, PostgreSQL, DM8, and KingbaseES V9.

**Architecture:** The work is deliberately phased. Task 1A freezes only the
immutable capability contract and canonical test profiles; Tasks 2-6 build and
test real internal compilers directly, without a registry or placeholder
compiler. Task 6 adds the first reachable private lowering IR and the frozen
allocation-only resolver extension. Only after all six real compilers exist
does Task 6B activate the public descriptor/registry over immutable static
definitions.

**Tech Stack:** C# netstandard2.1, existing ADO.NET providers in Dos.ORM, xUnit golden and contract tests.

## Global Constraints

- Every command in this plan is run from workspace root
  `D:\Work\microi.net.all`; project paths therefore start with
  `./Microi.Server/`. Git paths use `Microi.Server/...` from that same root.
- Official certification targets are MySQL, SQL Server, Oracle, PostgreSQL, DM8, and KingbaseES V9.
- Unknown aliases and unsupported capabilities fail fast; there is no fallback to MySQL or SQL Server.
- SQL Server Upsert must not default to MERGE; use a transactionally safe update-then-conditional-insert plan with locking.
- Oracle and DM8 are independently compiled and tested even when they share a family base.
- PostgreSQL and KingbaseES are independently compiled and tested even when they share a family base.
- DM8 compatibility mode and KingbaseES compatibility mode are part of DialectProfile.
- DialectProfile is created only by SQL AST core Task 7. This plan consumes it and never declares a second profile type.
- Registry/compiler/native/live checks compare database type, all four
  `DialectProfile.ServerVersion` components, and ordinal compatibility mode;
  DatabaseType-only matching is forbidden.
- Dynamic values never enter command text.
- Every `OffsetPageSpec` compiles to exactly two plan steps—Scalar count then
  RowSet data—with no semicolon batch. Its validated nonnegative Offset and
  positive Limit are structural integers rendered directly by the closed
  writer, never parameter definitions or runtime values.
- Compiler plans contain parameter definitions only; runtime values are bound later.
- `SqlCompilerBase`, `SqlTextWriter`, `SqlLoweringContext`,
  `AllocatedSqlNode`, and `RenderedSql` are all internal. The only public
  compiler contract remains the Task 7 `ISqlCompiler`; no public/protected
  compiler extension base or wrapper is introduced.
- Every production compiler is real and stateless across calls. Shared compiler
  instances may retain only immutable capability/descriptor data; all writer,
  lowering, allocation, render, and plan state is created per call.
- Bind/Normalize/Validate operate only on the 93-node neutral AST. Lower and
  Optimize may later produce internal sealed dialect IR, but every runtime
  parameter in either vocabulary remains a reachable
  `ParameterExpression(ParameterDefinition)` leaf.
- `AllocatedSqlNode` and `RenderedSql` are value-free immutable wrappers. They
  never contain `ParameterBag`, `BoundParameter`, runtime values, connections,
  commands, transactions, provider objects, or approvals.
- Until Task 6 captures the first real Oracle 11g private-IR RED, allocation is
  neutral-only through Task 8's public `Allocate`. Task 6 alone adds the
  allocation-only exact-type descriptor path; neutral traversal always wins,
  unknown private nodes fail before Render, and neutral/private nodes share one
  depth/occurrence/collection budget.
- Recompiling the same exact source with structurally identical live
  DialectProfile, SchemaToken, and requested atomicity is deterministic and
  yields the identical compiled fingerprint; this is required for the public
  preview-to-approval-to-source-execution flow. Any compiler-output change
  intentionally invalidates the old compiled approval.
- Platform DDL and migrations are AST-only; native scripts are not a compiler escape hatch.
- Unsupported semantic equivalence throws
  `UnsupportedDatabaseCapabilityException` with value-safe profile, feature,
  and AST node path diagnostics defined in Task 2. Validation failures throw
  the value-safe `SqlAstValidationException`; neither exception may contain a
  runtime value, parameter value, connection string, SQL text, or secret.

---

### Task 1A: Freeze immutable capabilities and canonical test profiles

**Files:**
- Create: Microi.Server/Dos.ORM/Platform/DatabaseCapabilities.cs
- Create: Microi.Server/Dos.ORM/Properties/AssemblyInfo.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/TestProfiles.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/CapabilitySamples.cs
- Create: Microi.Server/Dos.ORM.Tests/Platform/DatabaseCapabilitiesTests.cs
- Modify: Microi.Server/Dos.ORM.Tests/SqlAst/ExecutionPlanAndNativeSqlTests.cs

**Interfaces:**
- Consumes: the canonical Task 7 `DialectProfile` only in test fixtures.
- Produces: the exact immutable `DatabaseCapabilities` contract below and
  canonical profile objects used by later direct-compiler tests.
- Does not create `DatabasePlatformDescriptor`, `DatabasePlatformRegistry`, a
  success registry test, a compiler factory, or any placeholder compiler.

- [ ] **Step 1: Write failing exact-surface and constructor-invariant tests**

~~~csharp
[Fact]
public void Capabilities_public_surface_is_exact_and_get_only()
{
    var expected = new[]
    {
        "SupportsLimitOffsetPagination:Boolean",
        "SupportsOffsetFetchPagination:Boolean",
        "SupportsRownumPagination:Boolean",
        "SupportsReturningClause:Boolean",
        "SupportsReturningIntoClause:Boolean",
        "SupportsOutputClause:Boolean",
        "SupportsIdentityColumns:Boolean",
        "SupportsSequences:Boolean",
        "SupportsOnDuplicateKeyUpsert:Boolean",
        "SupportsOnConflictUpsert:Boolean",
        "SupportsMergeUpsert:Boolean",
        "SupportsLockedUpdateThenInsertUpsert:Boolean",
        "SupportsJson:Boolean",
        "SupportsWindowFunctions:Boolean",
        "SupportsCommonTableExpressions:Boolean",
        "SupportsForUpdateLock:Boolean",
        "SupportsUpdateLockHint:Boolean",
        "SupportsSkipLocked:Boolean",
        "SupportsNoWait:Boolean",
        "SupportsMultipleStatements:Boolean",
        "SupportsMultipleResultSets:Boolean",
        "MaxParametersPerCommand:Int32",
        "MaxCommandTextLength:Int32",
        "MaxBulkRowsPerBatch:Int32",
        "DdlTransactionBehavior:PlanTransactionBehavior",
        "SupportsSchemas:Boolean",
        "SupportsCatalogs:Boolean",
        "SupportsCreateDatabase:Boolean",
        "SupportsDropDatabase:Boolean",
        "SupportsNativeBulk:Boolean"
    };
    var properties = typeof(DatabaseCapabilities).GetProperties(
        BindingFlags.Public | BindingFlags.Instance |
        BindingFlags.DeclaredOnly);
    var actual = properties.Select(x =>
        x.Name + ":" + x.PropertyType.Name)
        .OrderBy(x => x, StringComparer.Ordinal)
        .ToArray();
    Assert.Equal(expected.OrderBy(x => x, StringComparer.Ordinal), actual);
    Assert.All(properties, property => Assert.Null(property.SetMethod));
    Assert.Empty(typeof(DatabaseCapabilities).GetConstructors());
    var constructor = Assert.Single(typeof(DatabaseCapabilities)
        .GetConstructors(BindingFlags.NonPublic | BindingFlags.Instance));
    Assert.True(constructor.IsAssembly);
    Assert.Equal(30, constructor.GetParameters().Length);

    var expectedConstructor = new[]
    {
        "supportsLimitOffsetPagination:Boolean",
        "supportsOffsetFetchPagination:Boolean",
        "supportsRownumPagination:Boolean",
        "supportsReturningClause:Boolean",
        "supportsReturningIntoClause:Boolean",
        "supportsOutputClause:Boolean",
        "supportsIdentityColumns:Boolean",
        "supportsSequences:Boolean",
        "supportsOnDuplicateKeyUpsert:Boolean",
        "supportsOnConflictUpsert:Boolean",
        "supportsMergeUpsert:Boolean",
        "supportsLockedUpdateThenInsertUpsert:Boolean",
        "supportsJson:Boolean",
        "supportsWindowFunctions:Boolean",
        "supportsCommonTableExpressions:Boolean",
        "supportsForUpdateLock:Boolean",
        "supportsUpdateLockHint:Boolean",
        "supportsSkipLocked:Boolean",
        "supportsNoWait:Boolean",
        "supportsMultipleStatements:Boolean",
        "supportsMultipleResultSets:Boolean",
        "maxParametersPerCommand:Int32",
        "maxCommandTextLength:Int32",
        "maxBulkRowsPerBatch:Int32",
        "ddlTransactionBehavior:PlanTransactionBehavior",
        "supportsSchemas:Boolean",
        "supportsCatalogs:Boolean",
        "supportsCreateDatabase:Boolean",
        "supportsDropDatabase:Boolean",
        "supportsNativeBulk:Boolean"
    };
    Assert.Equal(expectedConstructor, constructor.GetParameters().Select(x =>
        x.Name + ":" + x.ParameterType.Name));

    Assert.Empty(typeof(DatabaseCapabilities).GetFields(
        BindingFlags.Public | BindingFlags.Instance |
        BindingFlags.Static | BindingFlags.DeclaredOnly));
    Assert.Empty(typeof(DatabaseCapabilities).GetEvents(
        BindingFlags.Public | BindingFlags.Instance |
        BindingFlags.Static | BindingFlags.DeclaredOnly));
    Assert.Empty(typeof(DatabaseCapabilities).GetNestedTypes(
        BindingFlags.Public));
    var declaredPublicMethods = typeof(DatabaseCapabilities).GetMethods(
        BindingFlags.Public | BindingFlags.Instance |
        BindingFlags.Static | BindingFlags.DeclaredOnly);
    Assert.Equal(properties.Select(x => x.GetMethod).OrderBy(x => x.Name),
        declaredPublicMethods.OrderBy(x => x.Name));
}

[Theory]
[InlineData(0, 1, 1)]
[InlineData(-1, 1, 1)]
[InlineData(1, 0, 1)]
[InlineData(1, -1, 1)]
[InlineData(1, 1, 0)]
[InlineData(1, 1, -1)]
public void All_numeric_limits_must_be_positive(
    int maxParameters, int maxCommandText, int maxBulkRows) =>
    Assert.Throws<ArgumentOutOfRangeException>(() =>
        CapabilitySamples.Create(maxParameters, maxCommandText, maxBulkRows));

[Fact]
public void Capability_invariants_fail_closed()
{
    Assert.Throws<ArgumentException>(() =>
        CapabilitySamples.CreateWithNoPagination());
    Assert.Throws<ArgumentOutOfRangeException>(() =>
        CapabilitySamples.Create(
            ddlTransactionBehavior: (PlanTransactionBehavior)(-1)));
    Assert.Throws<ArgumentOutOfRangeException>(() =>
        CapabilitySamples.Create(
            ddlTransactionBehavior: (PlanTransactionBehavior)999));
    Assert.Throws<ArgumentException>(() =>
        CapabilitySamples.Create(
            ddlTransactionBehavior: PlanTransactionBehavior.Opaque));
    Assert.Throws<ArgumentException>(() =>
        CapabilitySamples.Create(
            supportsForUpdateLock: false,
            supportsUpdateLockHint: false,
            supportsSkipLocked: true));
    Assert.Throws<ArgumentException>(() =>
        CapabilitySamples.Create(
            supportsForUpdateLock: false,
            supportsUpdateLockHint: false,
            supportsNoWait: true));

    var updateHint = CapabilitySamples.Create(
        supportsForUpdateLock: false,
        supportsUpdateLockHint: true,
        supportsSkipLocked: true,
        supportsNoWait: true);
    Assert.True(updateHint.SupportsUpdateLockHint);
    Assert.True(updateHint.SupportsSkipLocked);
    Assert.True(updateHint.SupportsNoWait);
}

[Fact]
public void Constructor_copies_every_one_of_thirty_positions_exactly()
{
    CapabilitySamples.AssertEveryConstructorPositionIsCopied();
}

[Fact]
public void Internal_test_access_and_fresh_profiles_are_exact()
{
    Assert.Equal(new[] { "Dos.ORM.Tests" },
        typeof(DatabaseCapabilities).Assembly
            .GetCustomAttributes<InternalsVisibleToAttribute>()
            .Select(x => x.AssemblyName)
            .OrderBy(x => x, StringComparer.Ordinal));
    Assert.NotSame(TestProfiles.PostgreSql17, TestProfiles.PostgreSql17);
    Assert.NotSame(
        TestProfiles.For(DatabaseType.PostgreSql),
        TestProfiles.For(DatabaseType.PostgreSql));
    Assert.Equal(TestProfiles.MySql80,
        TestProfiles.For(DatabaseType.MySql));
    Assert.Equal(TestProfiles.SqlServer2022,
        TestProfiles.For(DatabaseType.SqlServer));
    Assert.Equal(TestProfiles.Oracle19c,
        TestProfiles.For(DatabaseType.Oracle));
    Assert.Equal(TestProfiles.PostgreSql17,
        TestProfiles.For(DatabaseType.PostgreSql));
    Assert.Equal(TestProfiles.Dm8,
        TestProfiles.For(DatabaseType.DaMeng));
    Assert.Equal(TestProfiles.KingbaseEsV9,
        TestProfiles.For(DatabaseType.KingBase));
    Assert.Throws<NotSupportedException>(() =>
        TestProfiles.For(DatabaseType.Sqlite3));
    Assert.Throws<ArgumentOutOfRangeException>(() =>
        TestProfiles.For((DatabaseType)(-1)));
    Assert.Equal(new Version(5, 7, 8, 0), TestProfiles.MySql57.ServerVersion);
    Assert.Equal(new Version(8, 0, 11, 0), TestProfiles.MySql80.ServerVersion);
    Assert.Equal(new Version(14, 0, 0, 0), TestProfiles.SqlServer2017.ServerVersion);
    Assert.Equal(new Version(16, 0, 0, 0), TestProfiles.SqlServer2022.ServerVersion);
    Assert.Equal(new Version(11, 2, 0, 4), TestProfiles.Oracle11g.ServerVersion);
    Assert.Equal(new Version(19, 0, 0, 0), TestProfiles.Oracle19c.ServerVersion);
    Assert.Equal(new Version(14, 0, 0, 0), TestProfiles.PostgreSql14.ServerVersion);
    Assert.Equal(new Version(17, 0, 0, 0), TestProfiles.PostgreSql17.ServerVersion);
    Assert.Equal(new Version(8, 1, 3, 140), TestProfiles.Dm8.ServerVersion);
    Assert.Equal("Oracle", TestProfiles.Dm8.CompatibilityMode);
    Assert.Equal(new Version(9, 4, 12, 0), TestProfiles.KingbaseEsV9.ServerVersion);
    Assert.Equal("PostgreSQL", TestProfiles.KingbaseEsV9.CompatibilityMode);
    Assert.Equal(10, TestProfiles.All.Count);
    Assert.All(TestProfiles.All, profile =>
        Assert.Equal(4, profile.ServerVersion.ToString().Split('.').Length));
}
~~~

`Capabilities_public_surface_is_exact_and_get_only` also compares the complete
set of declared public instance methods against the property getters only; it
therefore rejects a newly added method, field, event, nested type, overload,
or public constructor rather than merely counting the 30 properties.
`AssertEveryConstructorPositionIsCopied` constructs a one-hot and one-cold row
for each Boolean position, distinct positive sentinels for the three integers,
one row per valid transaction enum, and compares every named property on every
row. This catches swapped Boolean assignments as well as missing copies.

In the existing
`ExecutionPlanAndNativeSqlTests.cs`, replace **both** old
`Assert.Empty(InternalsVisibleTo...)` assertions with an exact assertion that
the single friend name is `Dos.ORM.Tests`. No other friend, public compiler
base, or widened constructor is permitted. Run that entire existing suite in
Step 4; adding the IVT while leaving either empty assertion unchanged is not a
valid Task 1A implementation.

- [ ] **Step 2: Run tests and verify RED**

Run:

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter FullyQualifiedName~DatabaseCapabilitiesTests --nologo
~~~

Expected: FAIL because `DatabaseCapabilities`, the internal test-access
attribute, and fresh exact profiles do not exist.

- [ ] **Step 3: Implement the exact immutable capability contract**

~~~csharp
public sealed class DatabaseCapabilities
{
    internal DatabaseCapabilities(
        bool supportsLimitOffsetPagination,
        bool supportsOffsetFetchPagination,
        bool supportsRownumPagination,
        bool supportsReturningClause,
        bool supportsReturningIntoClause,
        bool supportsOutputClause,
        bool supportsIdentityColumns,
        bool supportsSequences,
        bool supportsOnDuplicateKeyUpsert,
        bool supportsOnConflictUpsert,
        bool supportsMergeUpsert,
        bool supportsLockedUpdateThenInsertUpsert,
        bool supportsJson,
        bool supportsWindowFunctions,
        bool supportsCommonTableExpressions,
        bool supportsForUpdateLock,
        bool supportsUpdateLockHint,
        bool supportsSkipLocked,
        bool supportsNoWait,
        bool supportsMultipleStatements,
        bool supportsMultipleResultSets,
        int maxParametersPerCommand,
        int maxCommandTextLength,
        int maxBulkRowsPerBatch,
        PlanTransactionBehavior ddlTransactionBehavior,
        bool supportsSchemas,
        bool supportsCatalogs,
        bool supportsCreateDatabase,
        bool supportsDropDatabase,
        bool supportsNativeBulk);

    public bool SupportsLimitOffsetPagination { get; }
    public bool SupportsOffsetFetchPagination { get; }
    public bool SupportsRownumPagination { get; }
    public bool SupportsReturningClause { get; }
    public bool SupportsReturningIntoClause { get; }
    public bool SupportsOutputClause { get; }
    public bool SupportsIdentityColumns { get; }
    public bool SupportsSequences { get; }
    public bool SupportsOnDuplicateKeyUpsert { get; }
    public bool SupportsOnConflictUpsert { get; }
    public bool SupportsMergeUpsert { get; }
    public bool SupportsLockedUpdateThenInsertUpsert { get; }
    public bool SupportsJson { get; }
    public bool SupportsWindowFunctions { get; }
    public bool SupportsCommonTableExpressions { get; }
    public bool SupportsForUpdateLock { get; }
    public bool SupportsUpdateLockHint { get; }
    public bool SupportsSkipLocked { get; }
    public bool SupportsNoWait { get; }
    public bool SupportsMultipleStatements { get; }
    public bool SupportsMultipleResultSets { get; }
    public int MaxParametersPerCommand { get; }
    public int MaxCommandTextLength { get; }
    public int MaxBulkRowsPerBatch { get; }
    public PlanTransactionBehavior DdlTransactionBehavior { get; }
    public bool SupportsSchemas { get; }
    public bool SupportsCatalogs { get; }
    public bool SupportsCreateDatabase { get; }
    public bool SupportsDropDatabase { get; }
    public bool SupportsNativeBulk { get; }
}
~~~

The following table is the frozen Task 1A truth source. Boolean columns are in
the exact constructor/property order: `LO` limit/offset, `OF` offset/fetch,
`RN` rownum, `R` RETURNING, `RI` RETURNING INTO, `O` OUTPUT, `ID` identity,
`SQ` sequence, `DK` ON DUPLICATE KEY, `OC` ON CONFLICT, `MG` MERGE, `LU`
locked-update-then-insert, `J` JSON, `W` window, `C` CTE, `FU` FOR UPDATE,
`UH` update-lock hint, `SL` SKIP LOCKED, `NW` NOWAIT, `MS` multiple
statements, and `MR` multiple result sets.

| Exact capability band | LO | OF | RN | R | RI | O | ID | SQ | DK | OC | MG | LU | J | W | C | FU | UH | SL | NW | MS | MR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MySQL `5.7.8.0+` in 5.7 | T | F | F | F | F | F | T | F | T | F | F | F | T | F | F | T | F | F | F | F | F |
| MySQL `8.0.11.0+` in 8.0 | T | F | F | F | F | F | T | F | T | F | F | F | T | T | T | T | F | T | T | F | F |
| SQL Server engine 14/16 | F | T | F | F | F | T | T | T | F | F | F | T | T | T | T | F | T | F | T | F | F |
| Oracle `11.2.0.4` | F | F | T | F | T | F | F | T | F | F | T | F | F | T | T | T | F | T | T | F | F |
| Oracle 19 | F | T | T | F | T | F | T | T | F | F | T | F | T | T | T | T | F | T | T | F | F |
| PostgreSQL 14 | T | T | F | T | F | F | T | T | F | T | F | F | T | T | T | T | F | T | T | F | F |
| PostgreSQL 17 | T | T | F | T | F | F | T | T | F | T | T | F | T | T | T | T | F | T | T | F | F |
| DM8, canonical Oracle mode after raw `COMPATIBLE_MODE=2` | T | T | T | F | T | F | T | T | F | F | T | F | F | T | T | T | F | T | T | F | F |
| KingbaseES `9.4.12.0+`, PostgreSQL mode | T | T | F | T | F | F | T | T | F | T | T | F | T | T | T | T | F | T | T | F | F |

| Capability band | MaxParameters | MaxCommandText | MaxBulkRows | DDL behavior | Schemas | Catalogs | Create DB | Drop DB | Native bulk |
| --- | ---: | ---: | ---: | --- | --- | --- | --- | --- | --- |
| MySQL 5.7/8.0 | 65535 | 1048576 | 1000 | ImplicitCommit | T | F | T | T | F |
| SQL Server 14/16 | 2100 | 1048576 | 1000 | Enlistable | T | T | T | T | F |
| Oracle 11.2/19 | 1000 | 65535 | 1000 | ImplicitCommit | T | F | F | F | F |
| PostgreSQL 14/17 | 65535 | 1048576 | 1000 | Enlistable | T | F | T | T | F |
| DM8 canonical Oracle mode | 2048 | 65535 | 1000 | ImplicitCommit | T | F | F | F | F |
| KingbaseES 9.4.12 PostgreSQL mode | 32767 | 1048576 | 1000 | Enlistable | T | F | T | T | F |

`SupportsCreateDatabase`/`SupportsDropDatabase` describe literal database-level
operations only. They intentionally remain false for Oracle and DM8. The later
`ReplaceTargetDatabase` import policy therefore cannot reinterpret them as
supported: Dos.ORM's internal admin coordinator must choose the independently
tested schema-owner reset strategy for those two profiles, close the stale
target scope, reconnect, and prove the logical target empty before import. The
other four certified platforms may use database drop/create only when both
capabilities are true. No caller or service layer selects this dialect strategy.
At the public neutral boundary, `CreateDatabaseOperation` and
`DropDatabaseOperation` name logical tenant-target lifecycle requests; the
coordinator maps their literal database arm only when these capabilities allow
it and maps the Oracle/DM arm to create/drop the configured schema owner through
the elevated admin service. That schema-owner arm is not a false capability and
is never rendered by an ordinary SQL compiler.

`SupportsMultipleStatements`, `SupportsMultipleResultSets`, and
`SupportsNativeBulk` deliberately start false for every static profile. A
later real-driver integration may enable one only for the exact tested driver,
server profile, protocol/configuration, and connection mode. Server syntax
support alone is insufficient. Effective bulk rows are
`min(1000, MaxParametersPerCommand / parametersPerRow)`; MySQL additionally
honors the live `max_allowed_packet`. `MaxCommandTextLength` and Oracle's 1000
parameter value are conservative Dos.ORM compiler limits, not claims about a
server hard maximum.

Factories compare all four `Version` components and compatibility mode with
`StringComparison.Ordinal`: MySQL accepts only the two rows at or above their
listed minimum within 5.7 or 8.0; SQL Server accepts engine major 14 or 16;
Oracle accepts 11.2.0.4 or the certified 19 band; PostgreSQL accepts major 14
or 17; the live detector must first prove DM8 raw server value
`COMPATIBLE_MODE=2`, then map it to the public canonical exact mode string
`"Oracle"`; the raw numeric value is never stored in `DialectProfile`;
KingbaseES accepts the certified `9.4.12.0+` band only in exact
`"PostgreSQL"` mode. Every factory test matrix includes null profile, wrong
database type, version just below/above every supported band,
null/empty/wrong/case-changed mode, and the exact valid profile. Build and
Revision changes **inside** a certified band are accepted while the exact
four-part `ServerVersion` remains part of profile identity and fingerprint;
only a band crossing fails. Unknown or not-yet-certified bands fail closed.

The matrix is backed by primary vendor material: [MySQL JSON 5.7](https://dev.mysql.com/doc/refman/5.7/en/json.html),
[MySQL 8 window functions](https://dev.mysql.com/doc/refman/8.0/en/window-functions.html),
[MySQL locking reads](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-reads.html),
[SQL Server capacity limits](https://learn.microsoft.com/en-us/sql/sql-server/maximum-capacity-specifications-for-sql-server),
[SQL Server lock hints](https://learn.microsoft.com/en-us/sql/t-sql/queries/hints-transact-sql-table),
[Oracle 19 SELECT](https://docs.oracle.com/en/database/oracle/oracle-database/19/sqlrf/SELECT.html),
[Oracle RETURNING INTO](https://docs.oracle.com/en/database/oracle/oracle-database/19/lnpls/RETURNING-INTO-clause.html),
[PostgreSQL 17 MERGE](https://www.postgresql.org/docs/17/sql-merge.html),
[PostgreSQL limits](https://www.postgresql.org/docs/17/limits.html),
[DM8 query/locking](https://eco.dameng.com/document/dm/zh-cn/pm/check-phrases.html),
[DM8 JSON modes](https://eco.dameng.com/document/dm/zh-cn/pm/json.html),
[KingbaseES V9 SQL SELECT](https://help.kingbase.com.cn/v9/development/sql-plsql/sql/SQL_Statements_10.html),
and [KingbaseES 9.4.12 parameter FAQ](https://help.kingbase.com.cn/v9.4.12/faq/faq-new/interface/jdbc.html).

The internal constructor requires at least one pagination boolean, rejects all
three non-positive numeric limits, rejects `PlanTransactionBehavior.Opaque`
and every undefined enum value (including negative values),
and requires
`SupportsForUpdateLock || SupportsUpdateLockHint` whenever
`SupportsSkipLocked` or `SupportsNoWait` is true. It copies exactly these 30
scalar values; there is no new capability enum,
collection, setter, mutable builder, default instance, or inference from
`DatabaseType`. Capability choice belongs to the dialect factories in Tasks
3-6, which compare the exact official version/mode rules there.

`Properties/AssemblyInfo.cs` contains only
`[assembly: InternalsVisibleTo("Dos.ORM.Tests")]`. An architecture test rejects
any other friend assembly and proves all compiler/capability constructors stay
internal while tests can construct them directly.

`CapabilitySamples.Create` is a test-only named-argument factory with defaults
of one enabled pagination style, `PlanTransactionBehavior.Enlistable`, positive
limits, base ForUpdate lock enabled, SkipLocked/NoWait disabled, and arbitrary
portable booleans. It exposes only the overrides used above plus
`CreateWithNoPagination`; every call invokes the internal 30-argument
constructor directly, so no production builder/default object is introduced.

`TestProfiles` creates fresh canonical profiles for MySQL 5.7/8.0, SQL Server
engine 14/16 (2017/2022), Oracle 11.2.0.4/19, PostgreSQL 14/17, DM8 major 8 in
canonical ordinal `"Oracle"` mode after raw mode 2 validation, and KingbaseES
9.4.12 in ordinal `PostgreSQL` mode.
Standard-mode profiles use `string.Empty`. Tests never use these fixtures as a
fake registry. Its test-only `For(DatabaseType)` maps the six types exactly to
the current Full targets MySql80, SqlServer2022, Oracle19c, PostgreSql17, Dm8,
and KingbaseEsV9; legacy/undefined types fail. Minimum-version tests always use
their explicit profile property, never an ambiguous `For` result.

- [ ] **Step 4: Run focused and full regression and verify GREEN**

Run:

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~DatabaseCapabilitiesTests|FullyQualifiedName~ExecutionPlanAndNativeSqlTests" --nologo
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --nologo
~~~

Expected: PASS, including both pre-existing IVT assertions now enforcing the
single exact friend.

- [ ] **Step 5: Commit**

~~~powershell
git add -- Microi.Server/Dos.ORM/Platform/DatabaseCapabilities.cs Microi.Server/Dos.ORM/Properties/AssemblyInfo.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/TestProfiles.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/CapabilitySamples.cs Microi.Server/Dos.ORM.Tests/Platform/DatabaseCapabilitiesTests.cs Microi.Server/Dos.ORM.Tests/SqlAst/ExecutionPlanAndNativeSqlTests.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: define immutable database capabilities"
~~~

### Task 2: Implement the eight-stage compiler base and SQL writer

**Files:**
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlCompilerBase.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlAstBinder.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlTextWriter.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlLoweringContext.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/AllocatedSqlNode.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/RenderedSql.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlAstValidationException.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/UnsupportedDatabaseCapabilityException.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/LogicalTextEncoding.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/SqlValueContracts.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/DatabaseStorageContract.cs
- Create: Microi.Server/Dos.ORM/SqlCompilation/LogicalTextEnvelopeCodec.cs
- Modify: Microi.Server/Dos.ORM/SqlCompilation/CompilationModels.cs
- Modify: Microi.Server/Dos.ORM.Tests/TestInfrastructure/AstSamples.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/TestOptions.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/PlanAssert.cs
- Create: Microi.Server/Dos.ORM.Tests/Compilation/CompilationPipelineTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compilation/SqlTextWriterTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compilation/CompilationExceptionTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compilation/SqlValueContractTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Compilation/LogicalTextEnvelopeCodecTests.cs
- Modify: Microi.Server/Dos.ORM.Tests/Compilation/CompilationCoreBindingTests.cs

**Interfaces:**
- Consumes: SqlAstNormalizer, SqlAstValidator, SqlParameterAllocator.
- Produces: an internal eight-stage base, internal value-free wrappers, exact
  `ISqlCompiler` entries, effective-impact derivation, and internal
  Lower/Optimize/Render hooks. It also produces internal-only value/storage
  contracts so later Oracle/DM8 lowering can preserve logical empty text
  without adding a public compiler option or putting runtime values in plans.
- Allocation in this task is neutral-only. It calls Task 8's public
  `SqlParameterAllocator.Allocate`; it adds no Task 8 file, private-IR
  descriptor, resolver overload, or base hook.

- [ ] **Step 1: Write a failing pipeline-order test**

~~~csharp
[Fact]
public void Compiler_runs_all_stages_in_contract_order()
{
    var observer = new RecordingStageObserver();
    var compiler = new RecordingCompiler(observer);
    compiler.Compile(AstSamples.SimpleSelect(),
        new SqlCompilationOptions(TestProfiles.PostgreSql17));
    Assert.Equal(new[]
    {
        SqlCompilationStage.Bind, SqlCompilationStage.Normalize,
        SqlCompilationStage.Validate, SqlCompilationStage.Lower,
        SqlCompilationStage.Optimize,
        SqlCompilationStage.AllocateParameters,
        SqlCompilationStage.Render, SqlCompilationStage.Plan
    }, observer.Stages);
}

[Fact]
public void Validation_diagnostics_throw_before_lower_and_are_value_safe()
{
    var observer = new RecordingStageObserver();
    var compiler = new RecordingCompiler(observer);
    var runtimeSentinel = "DO-NOT-LEAK-8f4cc3";
    var source = AstSamples.InvalidSelectWithRuntimeValue(runtimeSentinel);

    var error = Assert.Throws<SqlAstValidationException>(() =>
        compiler.Compile(source,
            new SqlCompilationOptions(TestProfiles.PostgreSql17)));

    Assert.Equal(new[]
    {
        SqlCompilationStage.Bind,
        SqlCompilationStage.Normalize,
        SqlCompilationStage.Validate
    }, observer.Stages);
    Assert.False(compiler.LowerWasCalled);
    Assert.DoesNotContain(runtimeSentinel, error.ToString());
    Assert.Empty(error.Data.Keys);
}

[Fact]
public void Every_migration_step_runs_the_same_base_owned_eight_stages()
{
    var observer = new RecordingStageObserver();
    var source = AstSamples.ThreeStepMigration();
    var plan = new RecordingCompiler(observer).CompileMigration(
        source, TestOptions.PostgreSql17RequiredMigration);

    Assert.Equal(source.Steps.Count * 8, observer.Stages.Count);
    Assert.All(Enumerable.Range(0, source.Steps.Count), index =>
        Assert.Equal(AllEightStages,
            observer.Stages.Skip(index * 8).Take(8)));
    Assert.Equal(source.Steps.Select(x => x.Id),
        ((MigrationPlanSafetyBinding)plan.Safety).Entries.Select(x =>
            x.StepId));
    Assert.Equal(source.Steps.Select(x => x.Id),
        plan.Steps.OfType<SqlCommandStep>()
            .Select(command => command.SourceMigrationStepId));
}

[Fact]
public void Task2_base_has_no_private_ir_extension_before_oracle_red()
{
    var source = ReadCompilerBaseSource();
    Assert.Contains(
        "new SqlParameterAllocator().Allocate(optimized)", source);
    Assert.DoesNotContain("AllocateAfterLowering", source);
    Assert.DoesNotContain("SqlParameterTraversalDescriptor", source);
    Assert.Null(typeof(SqlCompilerBase).Assembly.GetType(
        "Dos.ORM.SqlCompilation.SqlParameterTraversalDescriptor"));
}

private static string ReadCompilerBaseSource(
    [CallerFilePath] string testFile = "")
{
    var compilationDirectory = Path.GetDirectoryName(testFile);
    var testsDirectory = Directory.GetParent(compilationDirectory).FullName;
    var serverDirectory = Directory.GetParent(testsDirectory).FullName;
    var path = Path.Combine(serverDirectory, "Dos.ORM", "SqlCompilation",
        "SqlCompilerBase.cs");
    Assert.True(File.Exists(path), path);
    return File.ReadAllText(path);
}

[Fact]
public void Migration_compiler_preserves_options_and_derives_effective_impact()
{
    var compiler = new RecordingCompiler(new RecordingStageObserver());
    var source = AstSamples.OneStepMigration();
    var options = new SqlCompilationOptions(
        TestProfiles.PostgreSql17,
        AtomicityRequirement.Required,
        new SchemaToken("schema-v1"));

    var plan = compiler.CompileMigration(source, options);

    Assert.Same(options.DialectProfile, plan.DialectProfile);
    Assert.Same(options.SchemaToken, plan.SchemaToken);
    Assert.Equal(options.RequestedAtomicity, plan.Atomicity);
    Assert.Equal(source.Fingerprint,
        ((MigrationPlanSafetyBinding)plan.Safety).SourceFingerprint);
}

[Fact]
public void Value_contract_is_internal_immutable_and_part_of_command_identity()
{
    var contract = StorageContractSamples.NonEmptyEnvelopeV1();
    var command = PlanTestFactory.CommandWithStorageContract(contract);

    Assert.Equal(contract.Fingerprint,
        command.InternalValueContract.StorageContractFingerprint);
    Assert.NotEqual(command.Fingerprint,
        PlanTestFactory.CommandWithStorageContract(
            StorageContractSamples.Native()).Fingerprint);
    PublicSurfaceAssert.HasNoPublicStorageContractDelta();
}

[Theory]
[InlineData(null, null)]
[InlineData("", "\uE000")]
[InlineData("abc", "\uE000abc")]
[InlineData("\uE000x", "\uE000\uE000x")]
public void Non_empty_envelope_is_reversible(string logical, string physical)
{
    Assert.Equal(physical, LogicalTextEnvelopeCodec.Encode(logical));
    Assert.Equal(logical, LogicalTextEnvelopeCodec.Decode(physical));
}
~~~

`StorageContractSamples`, `PlanTestFactory`, and `PublicSurfaceAssert` in the
sample above are private nested helpers owned by
`SqlValueContractTests.cs`; they do not imply another production type, test
file, public API, or staging path.

`ThreeStepMigration` deliberately uses three operations that each render one
command, so the shown exact StepId/SourceMigrationStepId sequence is
unambiguous. Additional tests use multi-command operations and assert every
command in each contiguous fragment carries that source step ID before the next
fragment begins.

`Task2_base_has_no_private_ir_extension_before_oracle_red` is an intentional
phase gate. It remains committed and green through Tasks 3-5, then Task 6 Step
6 replaces it (after the captured Oracle RED and extension implementation) with
the permanent internal-extension/neutral-isolation tests named there. It must
not survive unchanged after Task 6.

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~CompilationPipelineTests|FullyQualifiedName~SqlTextWriterTests|FullyQualifiedName~CompilationExceptionTests|FullyQualifiedName~SqlValueContractTests|FullyQualifiedName~LogicalTextEnvelopeCodecTests" --nologo
~~~

Expected: FAIL because SqlCompilerBase does not exist.

`LogicalTextEncoding` has exactly `Native=0` and
`NonEmptyEnvelopeV1=1`. `SqlValueContract` freezes logical type/length and text
encoding; parameter/result contracts freeze definition or ordinal;
`SqlCommandValueContract` freezes ordered parameter/result contracts and an
ordinal deterministic fingerprint; `DatabaseStorageContract` freezes version,
encoding, catalog/profile fingerprint, exact encoded column keys, and its own
fingerprint. Every collection is defensively copied and duplicate columns or
ordinals fail. `SqlCommandStep` gains only an internal value-contract property,
and command/plan fingerprints include it.

The same internal file freezes `DatabaseStorageContractState` to exactly
`PendingImport=0` and `Active=1`, plus an internal immutable
`PendingImportStorageContract`. A pending value contains only a cycle-free
`ImportBindingFingerprint` derived from source-content digest, exact target
profile, expected logical schema/active-contract fingerprints, and compiler
version. It never embeds the final ZIP/resource digest (which would create a
hash cycle), a random nonce, runtime row value, or credential; the managed
execution ticket separately binds the already-verified outer resource digest.
It is never accepted as the
storage contract of an ordinary compiled command or cache entry. Only the
source-bound import transition may use it to compile schema-only DDL against
the artifact's expected active contract. Tests in `SqlValueContractTests.cs`
freeze both states, fingerprint coverage, pending/active inequality, and
ordinary-plan rejection without adding a public type or another file.
It also owns internal immutable `DatabaseStorageContractReadResult`, the closed
three-way result `Absent | PendingImport | Active`; exactly one corresponding
payload may be present. Drivers therefore report absence/pending without
inventing an active catalog, and ordinary compilation accepts only `Active`.

`LogicalTextEnvelopeCodec` is internal and value-only: logical NULL maps to
database NULL; every non-NULL text value maps to one leading U+E000 marker, so
empty maps to the marker and a logical value already starting with U+E000 maps
to two leading markers. Decode removes exactly one marker and rejects any
non-NULL unmarked physical value as storage-contract corruption. The marker
must be representable in the exact target charset; BYTE length expansion uses
its checked encoded byte count, CHAR length expansion is one character, and an
unrepresentable marker or vendor type/index overflow fails compilation rather
than truncating. Runtime row values never enter the contract fingerprint.

`SqlCompilationOptions` keeps its current public constructor and public
property surface exactly. An internal overload/property carries the exact
`DatabaseStorageContract`; the public path creates only the internal Native
contract. Oracle/DM8 column-dependent text compilation without an exact catalog
contract later fails closed rather than guessing Native. These contracts are
lowering/materialization metadata, not a private AST/IR traversal extension;
the Task 2 allocation phase gate below remains byte-for-byte effective.

- [ ] **Step 3: Implement the pipeline template**

~~~csharp
internal abstract class SqlCompilerBase : ISqlCompiler
{
    public DatabaseExecutionPlan Compile(
        SqlStatement statement, SqlCompilationOptions options)
    {
        GuardSourceAndOptions(statement, options);
        var result = RunThroughRender(statement, null, options);
        var compiled = BuildOrdinarySourceAwarePlan(
            statement, result.Rendered, result.EffectiveImpact, options);
        Observe(SqlCompilationStage.Plan);
        return compiled;
    }

    public DatabaseExecutionPlan CompileMigration(
        MigrationPlan plan, SqlCompilationOptions options)
    {
        GuardMigrationAndOptions(plan, options);
        var commands = new List<SqlCommandStep>();
        var impacts = new List<CompiledImpactEntry>();
        foreach (var sourceStep in plan.Steps)
        {
            var result = RunThroughRender(
                sourceStep.Operation, sourceStep.Id, options);
            var stepCommands = BuildMigrationStepCommands(
                sourceStep, result.Rendered);
            AssertMigrationStepCorrelation(sourceStep.Id, stepCommands);
            var impact = CreateImpactEntry(
                sourceStep, result.EffectiveImpact);
            commands.AddRange(stepCommands);
            impacts.Add(impact);
            Observe(SqlCompilationStage.Plan);
        }
        return DatabaseExecutionPlan.ForMigration(
            plan, impacts, commands, options);
    }

    internal abstract DatabaseCapabilities ResolveCapabilities(
        DialectProfile profile);
    internal abstract SqlNode Lower(
        SqlNode node, SqlLoweringContext context);
    internal abstract SqlNode Optimize(
        SqlNode node, SqlLoweringContext context);
    internal abstract RenderedSql Render(
        AllocatedSqlNode node, SqlLoweringContext context);
    internal abstract DestructiveImpact DeriveEffectiveImpact(
        SqlNode source, SqlNode lowered, SqlLoweringContext context);

    internal virtual void Observe(SqlCompilationStage stage) { }
}
~~~

The public entries are non-virtual. The production implementation keeps
`RunThroughRender`, `BuildOrdinarySourceAwarePlan`, migration ordering, its
per-step loop, impact-entry construction, and every stage transition private
inside the base. A dialect can implement only the internal hooks shown; it
cannot replace Compile, CompileMigration, Bind, Normalize, Validate, Allocate,
Plan, migration ordering, or skip a stage. For each ordinary source and for
**each** migration operation, `RunThroughRender` performs Bind -> Normalize ->
Validate -> Lower -> Optimize -> AllocateParameters -> Render. The base then
constructs the real source-aware plan or migration-step commands plus impact,
validates exact `SourceMigrationStepId`, and only then observes Plan. The final
`ForMigration` call only aggregates already correlated fragments; it cannot
repair or invent IDs. Validator diagnostics are sorted deterministically; any
nonempty result immediately throws `SqlAstValidationException`, and Lower is
not invoked. `SqlLoweringContext` receives the nullable source step ID, and
every migration renderer must place that exact reference on every command it
creates; ordinary commands require null.

Legacy `Field`/`WhereClip`/`FromSection` objects never enter this compiler;
the legacy plan's source adapters construct the neutral AST first. Bind here
accepts only the already supplied 93-node neutral graph and uses a new
deterministic internal closed-set binder to resolve column references to their
alias owners plus structural type metadata. It emits another neutral graph,
rejects unresolved/ambiguous owners with value-safe diagnostics, preserves
parameter definitions, has an exact disposition for all 93 nodes, and is not
an identity/no-op stage. If no external catalog is required, resolution is
limited to aliases/type metadata present in the AST; it never opens a database,
reads runtime values, or accepts a legacy source object.

`SqlCompilationStage` is an internal eight-value enum. The base's internal
virtual `Observe(SqlCompilationStage stage)` receives only that enum—no node,
SQL, profile, parameter, diagnostic, count, timing, or runtime value—and its
production implementation is empty. Only the friend-test `RecordingCompiler`
overrides it. Reflection tests prove all six real compilers neither override
Observe nor expose an observer-taking constructor; every real compiler keeps
stage transitions base-owned. No observer field, delegate, global registry, or
public API is added.

The two exception contracts are exact, public, and sealed:

~~~csharp
public sealed class SqlAstValidationException : InvalidOperationException
{
    internal SqlAstValidationException(
        DialectProfile profile,
        IReadOnlyList<SqlAstDiagnostic> diagnostics);
    public DatabaseType DatabaseType { get; }
    public Version ServerVersion { get; }
    public string CompatibilityMode { get; }
    public string Feature { get; }
    public string NodePath { get; }
    public IReadOnlyList<SqlAstDiagnostic> Diagnostics { get; }
}

public sealed class UnsupportedDatabaseCapabilityException
    : NotSupportedException
{
    internal UnsupportedDatabaseCapabilityException(
        DialectProfile profile, string feature, string nodePath);
    public DatabaseType DatabaseType { get; }
    public Version ServerVersion { get; }
    public string CompatibilityMode { get; }
    public string Feature { get; }
    public string NodePath { get; }
}
~~~

Constructors reject null profile/server version; validation additionally
rejects a null/empty diagnostic list, and unsupported-capability rejects a
null/blank feature or structural path. Validation defensively copies the full,
ordered diagnostic list into a read-only snapshot by recreating each
`SqlAstDiagnostic` from a known validator code, its fixed value-free message,
and validated structural path. `Feature`/`NodePath` are the first diagnostic's
code/path. Both exceptions copy all four version components and exact mode and
build a fixed-format Message only from safe profile/feature/path/count data.
They have no public constructor, SQL/value property, custom serialization
payload, inner exception, or source-node reference; constructors leave the
inherited Exception `Data` dictionary empty. Tests mutate the
source diagnostic list after construction, walk every declared public
property/constructor, and put a unique runtime value into AST/ParameterBag/
connection-shaped strings; the sentinel must be absent from Message, ToString,
Data, every diagnostic, and every declared property. Capability-factory and
compiler failures use the same safe contract.

`RenderedSql` is an internal immutable discriminated union with exact kind
`Commands`, `Bulk`, or `Admin` and exactly these mutually exclusive factories:

~~~csharp
internal static RenderedSql ForCommands(
    IReadOnlyList<SqlCommandStep> commands);
internal static RenderedSql ForBulk(BulkStep step);
internal static RenderedSql ForAdmin(AdminStep step);
~~~

`RequireCommands`, `RequireBulk`, and `RequireAdmin` reject the wrong kind;
constructors are private, inputs are defensively copied, and no instance can
hold more than one arm. The base alone dispatches ordinary sources to the exact
existing `DatabaseExecutionPlan.ForStatement`, `ForSchemaOperation`,
`ForBulk`, or `ForAdmin` factory. Migrations accept only the Commands arm and
the base invokes `ForMigration`. A dialect cannot smuggle bulk/admin through
an ordinary or migration command plan. Effective impact has exactly one source:
the base's `DeriveEffectiveImpact` result. It is never duplicated inside
`RenderedSql`; the base passes that one value to `ForSchemaOperation`,
`ForAdmin`, or the migration impact entry.

The declarations of `SqlCompilerBase`, `SqlTextWriter`,
`SqlLoweringContext`, `AllocatedSqlNode`, and `RenderedSql` are all `internal`;
reflection tests fail if any becomes public or protected through a public base.
`AllocatedSqlNode` contains only the optimized neutral root and a defensive
read-only `SqlParameterSlot` snapshot. Each `RenderedSql` union arm contains
only its immutable step template(s); **no arm contains effective impact** or
runtime values. `SqlLoweringContext` holds exact options/profile,
capabilities, and per-call deterministic services; it cannot accept a
`ParameterBag`, `BoundParameter`, connection, transaction, command, provider,
approval, clock, random source, or global ordinal.

`AllocateParameters` in Task 2 is exactly a per-call wrapper around
`new SqlParameterAllocator().Allocate(optimized)`. The test-only
`RecordingCompiler` returns neutral nodes from Lower/Optimize; it verifies
stage order only and is not registered or shipped as a platform compiler. No
production compiler stub, no placeholder SQL, and no identity Lower claim is
accepted as private-IR proof.

The base-owned migration loop runs the same eight stages for each ordered
SchemaOperation, preserves contiguous MigrationStepId correlation, and derives
one CompiledImpactEntry per source step. Effective impact may equal or elevate
neutral impact and never reduce it; unsupported/unprovable lowering is
PotentialDataLoss or throws. `BuildOrdinarySourceAwarePlan` dispatches to the exact
Task 7 named factory for ordinary statement, neutral schema operation, bulk,
or admin source; it never calls a generic plan constructor.

Both entries require non-null source/options and enforce the postcondition
that plan atomicity equals options.RequestedAtomicity, plan profile is the
same options.DialectProfile instance, and plan schema token is the same
nullable options.SchemaToken instance. Direct SchemaOperation compilation is
allowed only when neutral and effective impact both remain None; other schema
work must use CompileMigration.

Both entries are pure with respect to source/options: no time, randomness,
cache race, approval state, runtime value, or connection identity may alter
the plan. Two compilations of structurally identical source/options produce
the same command order, safety entries, and `CompiledPlanFingerprint`. The
managed source executor defined by the legacy-adapter plan relies on this to
attach an externally authorized preview
approval only after recompiling the source against the current live options;
the compiler itself never accepts an approval or a preview plan.

`SqlTextWriter` has a closed internal token API:
`AppendKeyword(SqlKeyword)`, `AppendIdentifierSegment(string)`,
`AppendParameter(SqlParameterSlot)`,
`AppendOperator(SqlOperatorToken)`, `AppendOpenParenthesis()`,
`AppendCloseParenthesis()`, `AppendComma()`, `AppendDot()`, `AppendSpace()`,
`AppendStructuralInt(int)`,
`AppendEscapedSchemaLiteral(SqlSchemaLiteral)`, and `Snapshot()`. Operators
and keywords are defined enums;
structural integers must be nonnegative validated AST values (including
Offset/Limit) and render invariant-culture without runtime parameters. Schema
literals are a dedicated value-free structural type: they allow bounded
Unicode, spaces, and quotes required by comments/default metadata, reject
controls/oversize content, and use the dialect literal escaper. They are never
constructed from a row value, `ParameterBag`, or `BoundParameter`.
`Snapshot()` defensively freezes only a value-free
`SqlCommandTextSnapshot` (text plus parameter definitions). The renderer then
constructs `SqlCommandStep` with explicit result shape/role,
connection/transaction behavior, and the context's source step ID. Every
command—including pagination count and data—uses a **fresh writer**; snapshot
is terminal and a writer cannot reset/reuse. Commands are never semicolon joined.
Reflection/source tests reject `AppendRaw`, generic `Append(string)`, format
strings, delegate writers, public writer members, and any value escape hatch.
Dedicated tests cover every operator, balanced parentheses, comma/dot
placement, structural integer bounds/culture, schema quote escaping,
per-command snapshots, and placeholder/definition correspondence. The writer
is instantiated once per command. A 50-task same-real-compiler concurrency
test is added as soon as Task 3 supplies the first real compiler.

- [ ] **Step 4: Run and verify GREEN**

Run the focused command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add -- Microi.Server/Dos.ORM/SqlCompilation/SqlCompilerBase.cs Microi.Server/Dos.ORM/SqlCompilation/SqlAstBinder.cs Microi.Server/Dos.ORM/SqlCompilation/SqlTextWriter.cs Microi.Server/Dos.ORM/SqlCompilation/SqlLoweringContext.cs Microi.Server/Dos.ORM/SqlCompilation/AllocatedSqlNode.cs Microi.Server/Dos.ORM/SqlCompilation/RenderedSql.cs Microi.Server/Dos.ORM/SqlCompilation/SqlAstValidationException.cs Microi.Server/Dos.ORM/SqlCompilation/UnsupportedDatabaseCapabilityException.cs Microi.Server/Dos.ORM/SqlCompilation/LogicalTextEncoding.cs Microi.Server/Dos.ORM/SqlCompilation/SqlValueContracts.cs Microi.Server/Dos.ORM/SqlCompilation/DatabaseStorageContract.cs Microi.Server/Dos.ORM/SqlCompilation/LogicalTextEnvelopeCodec.cs Microi.Server/Dos.ORM/SqlCompilation/CompilationModels.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/AstSamples.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/TestOptions.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/PlanAssert.cs Microi.Server/Dos.ORM.Tests/Compilation/CompilationPipelineTests.cs Microi.Server/Dos.ORM.Tests/Compilation/SqlTextWriterTests.cs Microi.Server/Dos.ORM.Tests/Compilation/CompilationExceptionTests.cs Microi.Server/Dos.ORM.Tests/Compilation/SqlValueContractTests.cs Microi.Server/Dos.ORM.Tests/Compilation/LogicalTextEnvelopeCodecTests.cs Microi.Server/Dos.ORM.Tests/Compilation/CompilationCoreBindingTests.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: add deterministic SQL compiler pipeline"
~~~

### Task 3: Implement MySQL compiler and type/schema mapping

**Files:**
- Create: Microi.Server/Dos.ORM/Dialects/MySql/MySqlCompiler.cs
- Create: Microi.Server/Dos.ORM/Dialects/MySql/MySqlCapabilities.cs
- Create: Microi.Server/Dos.ORM/Dialects/MySql/MySqlTypeMapper.cs
- Create: Microi.Server/Dos.ORM/Dialects/MySql/MySqlSchemaCompiler.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/MySqlCompilerTests.cs

**Interfaces:**
- Produces: an internal real `MySqlCompiler`, an internal exact-profile
  `MySqlCapabilities.For(DialectProfile)` factory, and MySQL query, DML,
  function, pagination, schema, metadata, and admin rendering.
- Tests construct `new MySqlCompiler()` directly through
  `InternalsVisibleTo`; no registry, descriptor, fake compiler, or static
  mutable compilation context exists.

- [ ] **Step 1: Write failing MySQL golden tests**

~~~csharp
[Fact]
public void MySql_pagination_is_count_then_data_with_structural_integers()
{
    var compiler = new MySqlCompiler();
    var plan = compiler.Compile(
        AstSamples.PagedUsers(), TestOptions.MySql80);
    var data = PlanAssert.PaginationDataStep(plan);
    Assert.Contains("\u0060Sys_User\u0060", data.CommandText);
    Assert.Contains("LIMIT 20 OFFSET 40", data.CommandText);
    Assert.Empty(data.Parameters);
    PlanAssert.IsCountThenData(plan);
}

[Fact]
public async Task Shared_MySql_compiler_is_stateless_and_deterministic()
{
    var compiler = new MySqlCompiler();
    var tasks = Enumerable.Range(0, 50).Select(_ => Task.Run(() =>
        PlanAssert.Snapshot(compiler.Compile(
            AstSamples.PagedUsers(), TestOptions.MySql80))));
    var snapshots = await Task.WhenAll(tasks);
    Assert.All(snapshots, snapshot => Assert.Equal(snapshots[0], snapshot));
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter FullyQualifiedName~MySqlCompilerTests --nologo
~~~

Expected: FAIL because MySqlCompiler does not exist.

- [ ] **Step 3: Implement MySQL 5.7 and 8.0 profiles and real compiler**

`MySqlCapabilities.For` accepts only `DatabaseType.MySql`, ordinal empty mode,
and either 5.7 at/after `5.7.8.0` within the 5.7 band or 8.0 at/after
`8.0.11.0` within the 8.0 band; every other version/mode throws the safe
`UnsupportedDatabaseCapabilityException`. In-band Build/Revision remain exact
profile/fingerprint data. It returns the
Task 1A exact capability object and owns the official 5.7/8.0 differences.

Render segmented identifiers with the MySQL quote token, parameters as ?pN,
LIMIT/OFFSET, COALESCE, CONCAT, CURRENT_TIMESTAMP, JSON_EXTRACT,
AUTO_INCREMENT types, information-schema metadata through
`MetadataQueryOperation`, and atomic Upsert with ON DUPLICATE KEY UPDATE. The
compiler is `internal sealed`; all per-call state lives in the Task 2 context.

- [ ] **Step 4: Run and verify GREEN**

Run the focused command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add -- Microi.Server/Dos.ORM/Dialects/MySql/MySqlCompiler.cs Microi.Server/Dos.ORM/Dialects/MySql/MySqlCapabilities.cs Microi.Server/Dos.ORM/Dialects/MySql/MySqlTypeMapper.cs Microi.Server/Dos.ORM/Dialects/MySql/MySqlSchemaCompiler.cs Microi.Server/Dos.ORM.Tests/Dialects/MySqlCompilerTests.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: compile SQL AST for MySQL"
~~~

### Task 4: Implement PostgreSQL and KingbaseES V9 as independently tested dialects

**Files:**
- Create: Microi.Server/Dos.ORM/Dialects/PostgreSql/PostgreSqlCompiler.cs
- Create: Microi.Server/Dos.ORM/Dialects/PostgreSql/PostgreSqlCapabilities.cs
- Create: Microi.Server/Dos.ORM/Dialects/PostgreSql/PostgreSqlTypeMapper.cs
- Create: Microi.Server/Dos.ORM/Dialects/KingbaseEs/KingbaseEsCompiler.cs
- Create: Microi.Server/Dos.ORM/Dialects/KingbaseEs/KingbaseEsCapabilities.cs
- Create: Microi.Server/Dos.ORM/Dialects/KingbaseEs/KingbaseEsTypeMapper.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/DialectCases.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/PostgreSqlCompilerTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/KingbaseEsCompilerTests.cs

**Interfaces:**
- Produces: separate internal real PostgreSQL and KingbaseES compilers plus
  separate internal exact-profile capability factories. Tests construct each
  compiler directly; the registry remains absent.

- [ ] **Step 1: Write separate failing contract tests**

~~~csharp
[Theory]
[MemberData(nameof(DialectCases.PostgreSqlFamily),
    MemberType = typeof(DialectCases))]
public void PostgreSql_family_profiles_keep_their_own_parameter_contract(
    Func<ISqlCompiler> createCompiler, SqlCompilationOptions options,
    string expectedParameterPrefix)
{
    var compiler = createCompiler();
    var step = PlanAssert.SingleSql(
        compiler.Compile(AstSamples.UserById(), options));
    Assert.Contains(expectedParameterPrefix + "p0", step.CommandText);
}
~~~

DialectCases.PostgreSqlFamily returns PostgreSQL with @ and KingbaseES with :, and each test file owns independent golden strings.

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~PostgreSqlCompilerTests|FullyQualifiedName~KingbaseEsCompilerTests" --nologo
~~~

Expected: FAIL because both compilers are missing.

- [ ] **Step 3: Implement both compilers**

`PostgreSqlCapabilities.For` accepts only PostgreSQL major 14 or 17 with
ordinal empty mode. `KingbaseEsCapabilities.For` accepts only the certified
Kingbase `9.4.12.0+` band with ordinal `PostgreSQL` mode. Build/Revision remain
part of the profile and fingerprint but do not create alternate capability
guesses. Wrong type,
version, mode text, or mode case fails explicitly.

Share only an internal ANSI/PostgreSQL-family helper. Render LIMIT/OFFSET,
Boolean, JSON, RETURNING, and ON CONFLICT per profile. Kingbase native Bulk
must use Kdbndp and must never cast its connection to Npgsql. Both compilers are
`internal sealed`, are independently constructed/tested, and retain no
per-call mutable state.

- [ ] **Step 4: Run and verify GREEN**

Run the focused command from Step 2. Expected: both suites PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add -- Microi.Server/Dos.ORM/Dialects/PostgreSql/PostgreSqlCompiler.cs Microi.Server/Dos.ORM/Dialects/PostgreSql/PostgreSqlCapabilities.cs Microi.Server/Dos.ORM/Dialects/PostgreSql/PostgreSqlTypeMapper.cs Microi.Server/Dos.ORM/Dialects/KingbaseEs/KingbaseEsCompiler.cs Microi.Server/Dos.ORM/Dialects/KingbaseEs/KingbaseEsCapabilities.cs Microi.Server/Dos.ORM/Dialects/KingbaseEs/KingbaseEsTypeMapper.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/DialectCases.cs Microi.Server/Dos.ORM.Tests/Dialects/PostgreSqlCompilerTests.cs Microi.Server/Dos.ORM.Tests/Dialects/KingbaseEsCompilerTests.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: compile AST for PostgreSQL and KingbaseES"
~~~

### Task 5: Implement SQL Server compiler with safe Upsert planning

**Files:**
- Create: Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerCompiler.cs
- Create: Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerCapabilities.cs
- Create: Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerTypeMapper.cs
- Create: Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerSchemaCompiler.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/SqlServerCompilerTests.cs

**Interfaces:**
- Produces: an internal real SQL Server compiler and internal capability
  factory for engine major 14 (2017) and 16 (2022). Tests construct it
  directly. SqlServer9 stays an explicit legacy path and is not registered or
  certified by this task.

- [ ] **Step 1: Write failing pagination and Upsert tests**

~~~csharp
[Fact]
public void SqlServer_offset_requires_order_by()
{
    var statement = AstSamples.PagedUsersWithoutOrder();
    Assert.Throws<SqlAstValidationException>(() =>
        new SqlServerCompiler().Compile(
            statement, TestOptions.SqlServer2022));
}

[Fact]
public void SqlServer_upsert_uses_locked_atomic_plan_not_merge()
{
    var required = new SqlCompilationOptions(
        TestProfiles.SqlServer2022,
        AtomicityRequirement.Required);
    var plan = new SqlServerCompiler().Compile(
        AstSamples.UpsertUser(), required);
    var text = string.Join(" ", plan.Steps.OfType<SqlCommandStep>()
        .Select(step => step.CommandText));
    Assert.Contains("UPDLOCK", text);
    Assert.Contains("SERIALIZABLE", text);
    Assert.DoesNotContain("MERGE", text, StringComparison.OrdinalIgnoreCase);
    Assert.Equal(AtomicityRequirement.Required, plan.Atomicity);
}

[Theory]
[InlineData(AtomicityRequirement.None)]
[InlineData(AtomicityRequirement.BestEffort)]
public void SqlServer_upsert_rejects_non_required_atomicity(
    AtomicityRequirement requestedAtomicity)
{
    var options = new SqlCompilationOptions(
        TestProfiles.SqlServer2022, requestedAtomicity);
    Assert.Throws<UnsupportedDatabaseCapabilityException>(() =>
        new SqlServerCompiler().Compile(AstSamples.UpsertUser(), options));
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter FullyQualifiedName~SqlServerCompilerTests --nologo
~~~

Expected: FAIL because SqlServerCompiler does not exist.

- [ ] **Step 3: Implement SQL Server rendering**

`SqlServerCapabilities.For` accepts only `DatabaseType.SqlServer`, ordinal empty
mode, and engine major 14 or 16. It rejects SqlServer9 and all guessed versions.
Render bracket-quoted segmented identifiers, @pN parameters, TOP for single-row
legacy paths, OFFSET/FETCH for stable pagination, OUTPUT for returning
semantics, SQL Server logical types, sys-catalog metadata, and a
required-transaction Upsert plan using an update with UPDLOCK and SERIALIZABLE
followed by conditional insert. Upsert accepts only an explicitly requested
`AtomicityRequirement.Required`; `None` and `BestEffort` fail before Render
instead of being upgraded or silently weakened. The compiler is `internal sealed` and
stateless across calls.

- [ ] **Step 4: Run and verify GREEN**

Run the focused command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

~~~powershell
git add -- Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerCompiler.cs Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerCapabilities.cs Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerTypeMapper.cs Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerSchemaCompiler.cs Microi.Server/Dos.ORM.Tests/Dialects/SqlServerCompilerTests.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: compile SQL AST for SQL Server"
~~~

### Task 6: Implement Oracle and DM8 as separate compatibility profiles

**Files:**
- Create: Microi.Server/Dos.ORM/Dialects/Oracle/OracleCompiler.cs
- Create: Microi.Server/Dos.ORM/Dialects/Oracle/OracleCapabilities.cs
- Create: Microi.Server/Dos.ORM/Dialects/Oracle/OracleTypeMapper.cs
- Create: Microi.Server/Dos.ORM/Dialects/Oracle/OracleLogicalTextLowerer.cs
- Create: Microi.Server/Dos.ORM/Dialects/Dm8/Dm8Compiler.cs
- Create: Microi.Server/Dos.ORM/Dialects/Dm8/Dm8Capabilities.cs
- Create: Microi.Server/Dos.ORM/Dialects/Dm8/Dm8TypeMapper.cs
- Create: Microi.Server/Dos.ORM/Dialects/Dm8/Dm8LogicalTextLowerer.cs
- Modify after the real Oracle RED: Microi.Server/Dos.ORM/SqlCompilation/SqlCompilerBase.cs
- Modify after the real Oracle RED: Microi.Server/Dos.ORM/SqlCompilation/SqlAstTraversal.cs
- Modify after the real Oracle RED: Microi.Server/Dos.ORM/SqlCompilation/SqlParameterAllocator.cs
- Modify after the real Oracle RED: Microi.Server/Dos.ORM.Tests/Compilation/CompilationPipelineTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/OracleCompilerTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/Dm8CompilerTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/LogicalTextStorageCompilerTests.cs
- Modify: Microi.Server/Dos.ORM.Tests/TestInfrastructure/AstSamples.cs

**Interfaces:**
- Produces: separate internal real Oracle/DM8 compilers and exact-profile
  capability factories. Oracle Task 6 is also the single chronological owner
  of the frozen Task 8 post-Lower allocation extension, but only after a public
  Oracle Compile test reaches a genuine private node and fails.
- `OracleCapabilities.For` accepts exact Oracle `11.2.0.4` or the certified 19
  band with ordinal empty mode.
  `Dm8Capabilities.For` accepts DM8 major 8 with ordinal `Oracle` mode. Wrong
  type/version/mode/case throws; no family inference is allowed.

- [ ] **Step 1: Write separate direct-compiler REDs**

~~~csharp
[Fact]
public void Oracle19c_uses_offset_fetch_for_stable_paging()
{
    var plan = new OracleCompiler().Compile(
        AstSamples.PagedUsers(), TestOptions.Oracle19c);
    var data = PlanAssert.PaginationDataStep(plan);
    Assert.Contains("OFFSET 40", data.CommandText);
    Assert.Contains("FETCH NEXT 20", data.CommandText);
    Assert.Empty(data.Parameters);
    PlanAssert.IsCountThenData(plan);
}

[Fact]
public void Dm8_uses_its_own_profile_and_colon_parameters()
{
    var step = PlanAssert.SingleSql(new Dm8Compiler().Compile(
        AstSamples.UserById(), TestOptions.Dm8));
    Assert.Contains(":p0", step.CommandText);
    Assert.Equal(DatabaseType.DaMeng,
        TestOptions.Dm8.DialectProfile.DatabaseType);
}

[Theory]
[MemberData(nameof(DialectCases.OracleAndDm),
    MemberType = typeof(DialectCases))]
public void Oracle_family_text_uses_the_exact_non_empty_envelope_contract(
    CompilerCase sample)
{
    var plan = sample.Compiler.Compile(
        AstSamples.LogicalTextRoundTripAndPredicates(),
        sample.OptionsWithStorageContract(
            StorageContractSamples.NonEmptyEnvelopeV1()));

    PlanAssert.AllTextParametersUse(
        plan, LogicalTextEncoding.NonEmptyEnvelopeV1);
    PlanAssert.AllTextResultsUse(
        plan, LogicalTextEncoding.NonEmptyEnvelopeV1);
    PlanAssert.CoversNullEmptyEqualityLikeOrderAndLength(plan);
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~OracleCompilerTests|FullyQualifiedName~Dm8CompilerTests|FullyQualifiedName~LogicalTextStorageCompilerTests" --nologo
~~~

Expected: FAIL because Oracle and DM8 compilers/capability factories do not
exist. Do not modify Task 8 files at this point.

- [ ] **Step 3: Implement neutral Oracle/DM8 paths and capability factories**

Implement Oracle 19c OFFSET/FETCH and all Oracle/DM8 operations that remain in
the neutral 93-node vocabulary. Both use :pN parameters,
sequence/identity capability data, Oracle-style MERGE only where the exact
profile factory declares it, ALL_TAB_COLUMNS metadata, and the exact
`NonEmptyEnvelopeV1` storage contract. DM8 has its own internal sealed compiler,
type mapper, and text lowerer; shared family code cannot replace its tests. Keep
Oracle 11g paging unimplemented so the next test is the first real private-IR
need.

Oracle 11g/19c and DM8 Oracle mode reserve the Dos.ORM-owned physical table
`DOSORM_STORAGE_CONTRACT`. Its Native-encoded header includes the exact state.
For a verified empty-target import, Dos.ORM first writes only a
`PendingImport` header bound to the cycle-free import fingerprint, live profile,
and expected logical schema/active-contract fingerprints. It then
executes only the source-bound schema DDL, re-reads the resulting
`SchemaToken`, writes one exact row for every encoded schema/table/column
logical type/length contract, compares that catalog to the new token, and uses
a guarded compare-and-swap over the pending import fingerprint to set `Active`.
Activation clears all pending-only binding fields; the active/support digest is
derived only from the active profile/schema/column contract. It re-reads the
active catalog and
fingerprint before the first business DML/query. Thus future-column rows are
never required to match an empty pre-DDL token.

An active header freezes version 1, contract ID
`NON_EMPTY_ENVELOPE_U_E000_V1`, exact profile/catalog/schema fingerprints, and
the complete column rows. The table is hidden only from the logical application
schema/table digest and has a separate mandatory physical-support digest.
Pending state, duplicate/missing/unknown rows, a failed state transition, or
any fingerprint mismatch blocks all ordinary work. Ordinary application AST
cannot name or mutate the table. The other four databases use active
`NATIVE_V1` in memory and create no support table.

For `String`, `AnsiString`, JSON text, fixed/variable text, and CLOB, logical
NULL stays physical NULL and every non-NULL value uses the Task 2 envelope.
CHAR lengths expand by one character; BYTE lengths expand by the checked marker
byte width in the exact charset; fixed logical text may use a non-padding
physical representation while the contract retains the logical type. A marker
that the charset cannot represent, or a type/key/index length that cannot be
expanded exactly, throws `UnsupportedDatabaseCapabilityException`; no value is
truncated and no column silently falls back to Native.

The two independent lowerers cover the complete text semantics: encoded
equality/inequality/IN/join/PK/UK/FK compare physical envelopes; IS NULL uses
physical NULL; LIKE encodes the pattern prefix but not its ESCAPE character;
range/BETWEEN/ORDER/null ordering/MIN/MAX use an explicit empty rank plus
`SUBSTR(value,2)`; LENGTH subtracts one; SUBSTRING, TRIM, CASE, COALESCE,
CONCAT, case conversion, CAST, JSON text results, defaults, Insert/Update/
InsertSelect/Upsert/Bulk/Returning, and prefix indexes unwrap/re-envelope with
correct null propagation. Any neutral text operation without an explicit rule
fails compilation rather than executing in the physical domain. Ordered
per-parameter and per-result `SqlCommandValueContract` metadata drives later
binding/readback; runtime values remain outside the plan/cache fingerprint.

Tests cover NULL, empty, one space, Chinese, emoji, a value beginning U+E000,
maximum text and CLOB; `=`, `<>`, IN, LIKE empty/`%`/`_`/ESCAPE, range/order,
null order, length, substring, trim, concat, default, unique (multiple NULL,
second empty rejected), empty foreign keys, and corrupt unmarked data. Opaque
`NativeSqlText` is explicitly a provider-specific physical escape hatch: it has
no AST context to distinguish stored strings, patterns, JSON paths, or result
columns, receives no envelope translation/decoding, and cannot count as logical
empty-string certification. Seed, framework, lifecycle, and certification
paths may not use that escape hatch.

- [ ] **Step 4: Add and capture the genuine Oracle 11g private-IR RED**

~~~csharp
[Fact]
public void Oracle11g_lowered_node_parameters_are_allocated_after_lowering()
{
    var sample = AstSamples.Oracle11gPagedUsersWithWhere();
    var plan = new OracleCompiler().Compile(
        sample.Statement, TestOptions.Oracle11g);
    var step = PlanAssert.PaginationDataStep(plan);

    Assert.Contains("ROWNUM <= 60", step.CommandText);
    Assert.Contains("__microi_rownum > 40", step.CommandText);
    Assert.Equal(new[] { "whereId" },
        step.Parameters.Select(x => x.Name).ToArray());
    Assert.Equal(new[] { ":p0" },
        PlanAssert.ExtractPlaceholders(step.CommandText));
    Assert.Same(sample.WhereParameterDefinition, step.Parameters[0]);
    PlanAssert.PlaceholdersMatchDefinitionsExactly(step);
    PlanAssert.IsCountThenData(plan);
}
~~~

First implement enough Oracle 11g `Lower` to return an internal sealed
`Oracle11gPaginationLoweredNode` wrapping the lowered inner query, while the
unchanged Task 2 base still calls public neutral `Allocate`. Run only this test
and record the exact RED: allocation rejects the private node before Render.
An identity Lower, a test-only private node, or a final-SQL-only ROWNUM assertion
does not satisfy this checkpoint.

Freeze that first private node exactly; no extra page-parameter or writer
property is allowed:

~~~csharp
internal sealed class Oracle11gPaginationLoweredNode : SqlNode
{
    internal Oracle11gPaginationLoweredNode(
        SqlNode innerQuery, int offset, int limit);
    internal SqlNode InnerQuery { get; }
    internal int Offset { get; }
    internal int Limit { get; }
}
~~~

The constructor requires non-null `InnerQuery`, `offset >= 0`, and `limit > 0`.
Reflection tests freeze those three get-only properties, types, constructor
parameter names/order, and the only allocation child order `[InnerQuery]`.
Offset and Limit are validated structural integers rendered by
`AppendStructuralInt`; they are never `ParameterDefinition`s or traversal
children. Render uses the exact double-nested Oracle 11g pattern: the inner
ROWNUM bound is checked `Offset + Limit` (`60` here), and the outer row-number
alias is greater than Offset (`40` here). Checked addition overflow throws the
safe validation exception before any partial SQL/plan is returned.

- [ ] **Step 5: Add the frozen allocation-only private-IR extension**

Only after Step 4's RED, make the five production/test ownership changes frozen
by the final Task 8 brief:

~~~csharp
internal sealed class SqlParameterTraversalDescriptor
{
    internal SqlParameterTraversalDescriptor(
        Type exactNodeType,
        Func<SqlNode, IReadOnlyList<SqlNode>> orderedChildren);

    internal Type ExactNodeType { get; }
    internal IReadOnlyList<SqlNode> GetOrderedChildren(SqlNode node);
}

internal sealed class SqlParameterTraversalDescriptorSet
{
    internal SqlParameterTraversalDescriptorSet(
        IEnumerable<SqlParameterTraversalDescriptor> descriptors);

    internal static SqlParameterTraversalDescriptorSet Empty { get; }
}

internal IReadOnlyList<SqlParameterSlot> AllocateAfterLowering(
    SqlNode root,
    SqlParameterTraversalDescriptorSet descriptors);

// Added to internal SqlCompilerBase only now.
private protected virtual SqlParameterTraversalDescriptorSet
    GetLoweredParameterDescriptors() =>
    SqlParameterTraversalDescriptorSet.Empty;
~~~

`SqlAstTraversal` gains allocation-only exact-type descriptor dispatch;
Normalize, Validate, and public Allocate remain closed over exactly the 93
neutral nodes. The immutable defensive descriptor set rejects null entries,
duplicate types, non-`SqlNode` types, and all neutral types. Neutral descriptors
are consulted first and can never be overridden. Unknown private nodes fail
before Render. Private and neutral occurrences share the same iterative depth
128, occurrence 4096, and collection-slot 16384 budgets and the same ordinal
parameter conflict/first-definition kernel.

The selector returns a non-null ordered snapshot of non-null `SqlNode`
children. It cannot return parameter definitions, values, bags, bound
parameters, SQL, profiles, writers, or providers. Every parameter remains a
reachable `ParameterExpression`. Oracle owns an immutable descriptor for exact
`Oracle11gPaginationLoweredNode` whose first child is `InnerQuery`.
The `Func<SqlNode, IReadOnlyList<SqlNode>>` constructor argument is the exact
API frozen by Task 8 brief lines 1463-1470; dialect definitions pass only a
single non-capturing static method group, never a closure or compiler-instance
target, and an architecture test rejects mutable delegate target state.
`SqlCompilerBase.AllocateParameters` now calls
`AllocateAfterLowering(optimized, GetLoweredParameterDescriptors())`; the base
Empty set keeps all earlier neutral compilers unchanged.

- [ ] **Step 6: Restore the Task 2 private-IR downstream contract tests**

Delete the temporary
`Task2_base_has_no_private_ir_extension_before_oracle_red` phase gate and add to
`CompilationPipelineTests` now—not in Task 2—the permanent test
`Post_oracle_extension_is_internal_and_neutral_catalog_is_unchanged` plus
`Lowered_private_node_allocates_after_optimize_before_render`,
`Private_ir_children_define_parameter_occurrence_order`,
`Private_ir_conflict_is_rejected_before_render`,
`Private_ir_uses_shared_depth_occurrence_and_collection_slot_budgets`, and
`Unknown_lowered_node_fails_before_render`. They use the friend-access direct
allocator harness for synthetic descriptor graphs and the real Oracle compiler
for end-to-end stage ordering (a test-assembly subclass cannot override the
`private protected` production hook). Together they prove neutral
precedence, first-definition reuse, conflict-before-Render, the same depth 128,
occurrence 4096, and collection-slot 16384 budgets,
and fail-closed unknown behavior. They do not add a public visitor, registry,
or fifth Task 8 public type.

- [ ] **Step 7: Run required GREEN, coverage, concurrency, and mutations**

Run the focused command from Step 2 (including
`LogicalTextStorageCompilerTests`), all `CompilationPipelineTests`, and all
`CompilationCoreTests`. Expected: PASS with the 93/93 neutral catalog unchanged.
Reflect every concrete type in each dialect IR namespace and prove exactly one
resolver disposition, no orphan/duplicate, and no neutral type. Run 50 tasks
through the same Oracle and DM8 compiler instances and compare exact plans.

Apply one at a time and restore exact hashes after each mandatory mutation:

1. Oracle descriptor returns `Array.Empty<SqlNode>()` instead of
   `[node.InnerQuery]`; the Step 4 test must lose p0 and RED.
2. Swap/remove a private child; exact placeholder order/count must RED.
3. Allow a private descriptor to claim a neutral `SelectStatement`; neutral
   precedence test must RED.
4. Omit one concrete private type; exact-coverage/unknown-before-Render must RED.
5. Give private traversal a fresh budget or let Render rediscover parameters;
   shared-budget or parameter/render-correspondence test must RED.

- [ ] **Step 8: Commit**

~~~powershell
git add -- Microi.Server/Dos.ORM/Dialects/Oracle/OracleCompiler.cs Microi.Server/Dos.ORM/Dialects/Oracle/OracleCapabilities.cs Microi.Server/Dos.ORM/Dialects/Oracle/OracleTypeMapper.cs Microi.Server/Dos.ORM/Dialects/Oracle/OracleLogicalTextLowerer.cs Microi.Server/Dos.ORM/Dialects/Dm8/Dm8Compiler.cs Microi.Server/Dos.ORM/Dialects/Dm8/Dm8Capabilities.cs Microi.Server/Dos.ORM/Dialects/Dm8/Dm8TypeMapper.cs Microi.Server/Dos.ORM/Dialects/Dm8/Dm8LogicalTextLowerer.cs Microi.Server/Dos.ORM/SqlCompilation/SqlCompilerBase.cs Microi.Server/Dos.ORM/SqlCompilation/SqlAstTraversal.cs Microi.Server/Dos.ORM/SqlCompilation/SqlParameterAllocator.cs Microi.Server/Dos.ORM.Tests/Dialects/OracleCompilerTests.cs Microi.Server/Dos.ORM.Tests/Dialects/Dm8CompilerTests.cs Microi.Server/Dos.ORM.Tests/Dialects/LogicalTextStorageCompilerTests.cs Microi.Server/Dos.ORM.Tests/Compilation/CompilationPipelineTests.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/AstSamples.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: compile Oracle and DM8 with private lowering IR"
~~~

### Task 6B: Activate the strict six-platform registry with real compilers

**Files:**
- Create: Microi.Server/Dos.ORM/Platform/DatabasePlatformDefinition.cs
- Create: Microi.Server/Dos.ORM/Platform/DatabasePlatformDescriptor.cs
- Create: Microi.Server/Dos.ORM/Platform/DatabasePlatformRegistry.cs
- Create: Microi.Server/Dos.ORM.Tests/Platform/DatabasePlatformRegistryTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Platform/DialectCapabilityFactoryContractTests.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/CapabilityFactoryCases.cs

**Interfaces:**
- Consumes: the exact input `DialectProfile`, Task 1A capabilities, and the six
  real internal compilers/capability factories from Tasks 3-6.
- Produces: public sealed `DatabasePlatformDescriptor` and public static
  `DatabasePlatformRegistry.Get/TryGet/Resolve`, each requiring one exact
  profile. There is no public registration, default, parameterless,
  `DatabaseType`-only, or compiler injection API.

`DatabasePlatformDefinition` is created here as an `internal sealed` immutable
registry record. Its exact Task 6B state is database type, defensive aliases,
one real compiler, one non-null exact-profile capability resolver, and one
expected immutable storage-contract policy. Oracle and DM8 bind
`NonEmptyEnvelopeV1`; the other four bind Native. Public lookups create fresh
descriptors from it and never expose the definition or storage contract.
Legacy-adapter Task 2 is the first later owner allowed to modify this file: once
the six driver adapter types exist, it adds the exact internal driver factory
and driver `Type`. Platform-migration Task 9 is the second and final later owner;
it adds the exact immutable admin, diagnostics, and connection-policy factory
trio consumed by lifecycle services. No other task may modify the definition or
invent a second definition, mutable registration, or public driver/compiler
selection surface.

Registry tests require every exact Oracle/DM profile to resolve the same
`NON_EMPTY_ENVELOPE_U_E000_V1` policy and every other profile to resolve Native;
wrong mode/version and a live storage-contract fingerprint that disagrees with
the definition fail after the driver's metadata-only storage probe but before
compiler resolution or any business command. The policy is internal and does
not expand `DatabasePlatformDescriptor`.

- [ ] **Step 1: Write the six official alias and exact-instance REDs**

~~~csharp
[Theory]
[InlineData("mysql", DatabaseType.MySql)]
[InlineData("sqlserver", DatabaseType.SqlServer)]
[InlineData("oracle", DatabaseType.Oracle)]
[InlineData("postgresql", DatabaseType.PostgreSql)]
[InlineData("dm8", DatabaseType.DaMeng)]
[InlineData("kingbasees-v9", DatabaseType.KingBase)]
public void Official_alias_resolves_only_after_all_real_compilers_exist(
    string alias, DatabaseType expected)
{
    var profile = TestProfiles.For(expected);
    var descriptor = DatabasePlatformRegistry.Resolve(alias, profile);
    var caseVariant = DatabasePlatformRegistry.Resolve(
        alias.ToUpperInvariant(), profile);
    Assert.Equal(expected, descriptor.Type);
    Assert.Equal(expected, caseVariant.Type);
    Assert.Same(profile, descriptor.Profile);
    Assert.NotNull(descriptor.Compiler);
    Assert.NotNull(descriptor.Capabilities);
}

[Fact]
public void Value_equal_distinct_profiles_keep_each_lookup_input_reference()
{
    var getProfile = TestProfiles.PostgreSql17;
    var resolveProfile = TestProfiles.Clone(getProfile);
    var tryProfile = TestProfiles.Clone(getProfile);
    Assert.Equal(getProfile, resolveProfile);
    Assert.Equal(getProfile, tryProfile);
    Assert.NotSame(getProfile, resolveProfile);
    Assert.NotSame(getProfile, tryProfile);

    var fromGet = DatabasePlatformRegistry.Get(getProfile);
    var fromResolve = DatabasePlatformRegistry.Resolve(
        "postgresql", resolveProfile);
    Assert.True(DatabasePlatformRegistry.TryGet(
        tryProfile, out var fromTryGet));

    Assert.Same(getProfile, fromGet.Profile);
    Assert.Same(resolveProfile, fromResolve.Profile);
    Assert.Same(tryProfile, fromTryGet.Profile);
    Assert.NotSame(fromGet, fromResolve);
    Assert.NotSame(fromGet, fromTryGet);
    Assert.Same(fromGet.Compiler, fromResolve.Compiler);
    Assert.Same(fromGet.Capabilities, fromTryGet.Capabilities);
}

[Fact]
public void Descriptor_aliases_are_defensive_and_registry_surface_is_closed()
{
    var registered = DatabasePlatformRegistry.Get(TestProfiles.PostgreSql17);
    var mutableAliases = new List<string> { "postgresql" };
    var descriptor = new DatabasePlatformDescriptor(
        DatabaseType.PostgreSql,
        mutableAliases,
        registered.Profile,
        registered.Compiler,
        registered.Capabilities);
    mutableAliases[0] = "mutated";
    Assert.Equal("postgresql", Assert.Single(descriptor.Aliases));
    Assert.NotSame(mutableAliases, descriptor.Aliases);
    Assert.Equal(typeof(IReadOnlyList<string>),
        typeof(DatabasePlatformDescriptor)
            .GetProperty(nameof(DatabasePlatformDescriptor.Aliases))
            .PropertyType);

    var publicMethods = typeof(DatabasePlatformRegistry).GetMethods(
        BindingFlags.Public | BindingFlags.Static |
        BindingFlags.DeclaredOnly);
    Assert.Equal(new[] { "Get", "Resolve", "TryGet" },
        publicMethods.Select(x => x.Name)
            .OrderBy(x => x, StringComparer.Ordinal));
    Assert.DoesNotContain(publicMethods,
        method => method.GetParameters().Any(parameter =>
            parameter.ParameterType == typeof(DatabaseType)));
}

[Fact]
public void Unknown_alias_and_alias_profile_mismatch_fail_closed()
{
    Assert.Throws<NotSupportedException>(() =>
        DatabasePlatformRegistry.Resolve(
            "unknown-db", TestProfiles.PostgreSql17));
    Assert.Throws<ArgumentException>(() =>
        DatabasePlatformRegistry.Resolve(
            "mysql", TestProfiles.PostgreSql17));
}

[Theory]
[MemberData(nameof(CapabilityFactoryCases.All),
    MemberType = typeof(CapabilityFactoryCases))]
public void Every_factory_has_exact_four_part_version_and_mode_matrix(
    CapabilityFactoryCase item)
{
    Assert.NotNull(item.Create(item.ValidProfile));
    Assert.All(item.InvalidProfiles, profile =>
        Assert.Throws<UnsupportedDatabaseCapabilityException>(() =>
            item.Create(profile)));
    Assert.Throws<ArgumentNullException>(() => item.Create(null));
}
~~~

`CapabilityFactoryCases` owns one row for every one of the ten canonical
profiles and calls the actual internal capability factory (not the registry).
Each row asserts the exact four `ServerVersion` components and mode, accepts
in-band Build/Revision variants while preserving their exact profile identity,
and includes wrong type, every adjacent unsupported version boundary,
null/empty/wrong/case-changed mode, plus null profile. It compares every one of
the 30 returned values to the frozen Task 1A table; sharing a family factory or
testing only `DatabaseType` is a failure.

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~DatabasePlatformRegistryTests|FullyQualifiedName~DialectCapabilityFactoryContractTests" --nologo
~~~

Expected: FAIL because descriptor/registry do not exist. No earlier task may
make these success tests green.

- [ ] **Step 3: Implement the exact descriptor and registry**

~~~csharp
public sealed class DatabasePlatformDescriptor
{
    internal DatabasePlatformDescriptor(
        DatabaseType type,
        IEnumerable<string> aliases,
        DialectProfile profile,
        ISqlCompiler compiler,
        DatabaseCapabilities capabilities);

    public DatabaseType Type { get; }
    public IReadOnlyList<string> Aliases { get; }
    public DialectProfile Profile { get; }
    public ISqlCompiler Compiler { get; }
    public DatabaseCapabilities Capabilities { get; }
}

public static class DatabasePlatformRegistry
{
    public static DatabasePlatformDescriptor Get(DialectProfile profile);
    public static bool TryGet(
        DialectProfile profile,
        out DatabasePlatformDescriptor descriptor);
    public static DatabasePlatformDescriptor Resolve(
        string alias,
        DialectProfile profile);
}
~~~

The internal descriptor constructor rejects null aliases/profile/compiler/
capabilities, null/blank/duplicate aliases, and type/profile mismatch. It
retains the exact profile reference, copies aliases with ordinal-ignore-case
duplicate validation, and exposes a read-only defensive snapshot. Compiler and
capabilities are non-null immutable references.

The exact official alias table is deliberately closed and case-insensitive:

| DatabaseType | Exact aliases |
| --- | --- |
| MySql | `mysql` |
| SqlServer | `sqlserver` |
| Oracle | `oracle` |
| PostgreSql | `postgresql` |
| DaMeng | `dm8` |
| KingBase | `kingbasees-v9` |

Provider class names and historical configuration strings are canonicalized by
the later legacy ProviderFactory adapter; they are not substring aliases in
this exact registry. Alias/profile database type mismatch throws. Unknown alias
or unsupported version/mode throws; `TryGet` returns false only for unsupported
profiles and does not swallow invalid null arguments.

Static registry definitions, compiler instances, capabilities, and alias data
are immutable. Each successful call constructs a fresh descriptor; no
descriptor or input profile is cached. The compiler/capability selected by
`Get` comes only from the real dialect mappings frozen in Tasks 3-6. Reflection
tests assert there is no public `Register`, reset, default platform,
parameterless lookup, `DatabaseType`-only overload, or mutable public
collection.

`MsAccess`, `Sqlite3`, and `SqlServer9` remain explicit legacy provider paths:
they are not official registry definitions, do not resolve through an official
alias, and are never counted among the six certified platforms. They may retain
their old compiler path until the legacy plan migrates or explicitly rejects
them, but cannot silently report another official platform.

- [ ] **Step 4: Run focused and full GREEN**

Run Step 2 plus all six dialect suites and `CompilationCoreTests`. Expected:
all PASS, six official aliases resolve through real compilers, all mismatch/
unknown/legacy cases fail exactly, aliases are defensive, and every lookup
returns a new descriptor retaining the exact input profile reference.

- [ ] **Step 5: Commit**

~~~powershell
git add -- Microi.Server/Dos.ORM/Platform/DatabasePlatformDefinition.cs Microi.Server/Dos.ORM/Platform/DatabasePlatformDescriptor.cs Microi.Server/Dos.ORM/Platform/DatabasePlatformRegistry.cs Microi.Server/Dos.ORM.Tests/Platform/DatabasePlatformRegistryTests.cs Microi.Server/Dos.ORM.Tests/Platform/DialectCapabilityFactoryContractTests.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/CapabilityFactoryCases.cs
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: activate strict six-database compiler registry"
~~~

### Task 7: Complete cross-dialect functions, DML, Bulk fallback, DDL, metadata, admin, and diagnostics

**Files:**
- Create: Microi.Server/Dos.ORM.Tests/Dialects/FunctionCompilerContractTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/DmlCompilerContractTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/BulkCompilerContractTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/SchemaCompilerContractTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/MetadataAdminContractTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/DialectDispositionContractTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Dialects/DialectGoldenSnapshotTests.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/DialectIrAssert.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/DialectDispositionCatalog.cs
- Modify: Microi.Server/Dos.ORM.Tests/TestInfrastructure/AstSamples.cs
- Modify: Microi.Server/Dos.ORM.Tests/TestInfrastructure/PlanAssert.cs
- Modify: Microi.Server/Dos.ORM/SqlAst/SchemaModels.cs
- Modify: Microi.Server/Dos.ORM/SqlAst/SchemaStatements.cs
- Modify: Microi.Server/Dos.ORM/SqlCompilation/SqlAstNormalizer.cs
- Modify: Microi.Server/Dos.ORM/SqlCompilation/SqlAstValidator.cs
- Modify: Microi.Server/Dos.ORM/SqlCompilation/SqlAstTraversal.cs
- Modify: Microi.Server/Dos.ORM.Tests/Compilation/CompilationCoreTests.cs
- Modify: Microi.Server/Dos.ORM.Tests/Compilation/CompilationCoreNormalizationPreservationTests.cs
- Modify: Microi.Server/Dos.ORM.Tests/Compilation/CompilationCoreNormalizationRewriteTests.cs
- Modify: Microi.Server/Dos.ORM.Tests/Compilation/CompilationCoreNormalizationSafetyTests.cs
- Modify: Microi.Server/Dos.ORM.Tests/SqlAst/SchemaAndAdminStatementTests.cs
- Modify: Microi.Server/Dos.ORM.Tests/SqlAst/ExecutionPlanAndNativeSqlTests.cs
- Create: Microi.Server/Dos.ORM.Tests/SqlAst/SchemaCompatibilitySemanticsTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Snapshots/mysql-5.7.8.0.approved.txt
- Create: Microi.Server/Dos.ORM.Tests/Snapshots/mysql-8.0.11.0.approved.txt
- Create: Microi.Server/Dos.ORM.Tests/Snapshots/sqlserver-14.0.0.0.approved.txt
- Create: Microi.Server/Dos.ORM.Tests/Snapshots/sqlserver-16.0.0.0.approved.txt
- Create: Microi.Server/Dos.ORM.Tests/Snapshots/oracle-11.2.0.4.approved.txt
- Create: Microi.Server/Dos.ORM.Tests/Snapshots/oracle-19.0.0.0.approved.txt
- Create: Microi.Server/Dos.ORM.Tests/Snapshots/postgresql-14.0.0.0.approved.txt
- Create: Microi.Server/Dos.ORM.Tests/Snapshots/postgresql-17.0.0.0.approved.txt
- Create: Microi.Server/Dos.ORM.Tests/Snapshots/dm8-8.1.3.140-oracle.approved.txt
- Create: Microi.Server/Dos.ORM.Tests/Snapshots/kingbasees-9.4.12.0-postgresql.approved.txt
- Modify: Microi.Server/Dos.ORM/Dialects/MySql/MySqlCompiler.cs
- Modify: Microi.Server/Dos.ORM/Dialects/MySql/MySqlCapabilities.cs
- Modify: Microi.Server/Dos.ORM/Dialects/MySql/MySqlTypeMapper.cs
- Modify: Microi.Server/Dos.ORM/Dialects/MySql/MySqlSchemaCompiler.cs
- Modify: Microi.Server/Dos.ORM/Dialects/PostgreSql/PostgreSqlCompiler.cs
- Modify: Microi.Server/Dos.ORM/Dialects/PostgreSql/PostgreSqlCapabilities.cs
- Modify: Microi.Server/Dos.ORM/Dialects/PostgreSql/PostgreSqlTypeMapper.cs
- Modify: Microi.Server/Dos.ORM/Dialects/KingbaseEs/KingbaseEsCompiler.cs
- Modify: Microi.Server/Dos.ORM/Dialects/KingbaseEs/KingbaseEsCapabilities.cs
- Modify: Microi.Server/Dos.ORM/Dialects/KingbaseEs/KingbaseEsTypeMapper.cs
- Modify: Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerCompiler.cs
- Modify: Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerCapabilities.cs
- Modify: Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerTypeMapper.cs
- Modify: Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerSchemaCompiler.cs
- Modify: Microi.Server/Dos.ORM/Dialects/Oracle/OracleCompiler.cs
- Modify: Microi.Server/Dos.ORM/Dialects/Oracle/OracleCapabilities.cs
- Modify: Microi.Server/Dos.ORM/Dialects/Oracle/OracleTypeMapper.cs
- Modify: Microi.Server/Dos.ORM/Dialects/Dm8/Dm8Compiler.cs
- Modify: Microi.Server/Dos.ORM/Dialects/Dm8/Dm8Capabilities.cs
- Modify: Microi.Server/Dos.ORM/Dialects/Dm8/Dm8TypeMapper.cs

**Interfaces:**
- Produces: complete Compile and CompileMigration coverage, exact effective-impact evidence, and source-aware Task 7 plans for every platform-owned AST operation.
- Consumes the Task 6B registry only after all six real compilers are active.
  It keeps the existing semantic-operation contract and additionally closes
  every real dialect-private-IR allocation/render correspondence gate.

MySQL and SQL Server keep their Task 3/5 schema mapping in the explicitly
listed `*SchemaCompiler.cs` files. PostgreSQL, KingbaseES, Oracle, and DM8 keep
their schema mapping inside their explicitly listed compiler files; Task 7 does
not create an unlisted parallel schema compiler. This exact ownership list is
also the staging boundary for the task.

- [ ] **Step 1: Write the six-dialect contract matrix**

~~~csharp
[Theory]
[MemberData(nameof(DialectCases.AllCertified),
    MemberType = typeof(DialectCases))]
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
    PlanAssert.HasPlan(dialect.Compile(AstSamples.DatabaseDiagnostic()));

    var migration = dialect.Compiler.CompileMigration(
        AstSamples.ContractMigration(), dialect.Options);
    Assert.Same(dialect.Options.DialectProfile,
        migration.DialectProfile);
    Assert.Same(dialect.Options.SchemaToken,
        migration.SchemaToken);
    Assert.Equal(dialect.Options.RequestedAtomicity,
        migration.Atomicity);
    Assert.IsType<MigrationPlanSafetyBinding>(migration.Safety);
}

[Theory]
[MemberData(nameof(DialectCases.AllCertified),
    MemberType = typeof(DialectCases))]
public void Pagination_is_count_then_data_without_semicolon_batch(
    CertifiedDialectCase dialect)
{
    var plan = dialect.Compile(AstSamples.PagedUsersWithCount());
    Assert.Equal(SqlResultShape.MultipleResultSets, plan.ResultShape);
    Assert.Collection(plan.Steps,
        count => Assert.Equal(SqlResultShape.Scalar, count.ResultShape),
        data => Assert.Equal(SqlResultShape.RowSet, data.ResultShape));
    Assert.All(plan.Steps.Cast<SqlCommandStep>(),
        step => Assert.DoesNotContain(";", step.CommandText));
    var data = Assert.IsType<SqlCommandStep>(plan.Steps[1]);
    Assert.DoesNotContain(data.Parameters,
        parameter => parameter.Name == "offset" || parameter.Name == "limit");
    Assert.Equal(dialect.ExpectedStructuralPagingSql,
        PlanAssert.ExtractPagingClause(data.CommandText));
}

[Theory]
[MemberData(nameof(DialectCases.AllCertified),
    MemberType = typeof(DialectCases))]
public async Task Every_dialect_private_ir_is_exact_closed_and_concurrent(
    CertifiedDialectCase dialect)
{
    DialectIrAssert.EveryConcreteNodeHasExactlyOneDisposition(
        dialect.Compiler);
    DialectIrAssert.NoNeutralNodeIsClaimed(dialect.Compiler);
    DialectIrAssert.UnknownPrivateNodeFailsBeforeRender(dialect.Compiler);
    DialectIrAssert.ParameterDefinitionsMatchRenderedPlaceholders(dialect);

    var tasks = Enumerable.Range(0, 50).Select(_ => Task.Run(() =>
        PlanAssert.Snapshot(dialect.Compile(AstSamples.AllSemantics()))));
    var snapshots = await Task.WhenAll(tasks);
    Assert.All(snapshots, snapshot => Assert.Equal(snapshots[0], snapshot));
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~FunctionCompilerContractTests|FullyQualifiedName~DmlCompilerContractTests|FullyQualifiedName~BulkCompilerContractTests|FullyQualifiedName~SchemaCompilerContractTests|FullyQualifiedName~MetadataAdminContractTests|FullyQualifiedName~DialectDispositionContractTests|FullyQualifiedName~DialectGoldenSnapshotTests|FullyQualifiedName~SchemaCompatibilitySemanticsTests" --nologo
~~~

Expected: FAIL for every not-yet-rendered semantic operation.

- [ ] **Step 3: Complete only the failing semantic mappings**

Add Concat, Substring, Length, CurrentDateTime, DateAdd, DateDiff, Coalesce,
Round, JsonValue, aggregates, Boolean, NULL ordering, returning semantics,
parameter-limit batching, create/alter/drop schema operations, metadata DTO
queries, database create/drop, and diagnostics. Compile migrations through
the exact named entry, preserve ordered source step IDs, derive effective
impact for the exact full profile, and use only the Task 7 source-aware plan
factories. Count pagination emits separate Scalar then RowSet commands and
never a semicolon batch. If a profile cannot preserve semantics or Required
plan evidence, throw UnsupportedDatabaseCapabilityException rather than emit
guessed SQL or downgrade atomicity.

Before the legacy public baseline is captured, extend the neutral schema model
for the three semantics proven present in the official seed. Preserve every
existing constructor signature and add only this exact public delta:

~~~csharp
public enum ColumnUpdateBehavior
{
    None,
    CurrentDateTime
}

public sealed class SchemaCollation : IEquatable<SchemaCollation>
{
    public SchemaCollation(
        string sourceName,
        bool isUnicode,
        bool isCaseSensitive,
        bool isAccentSensitive,
        bool isBinary);
    public string SourceName { get; }
    public bool IsUnicode { get; }
    public bool IsCaseSensitive { get; }
    public bool IsAccentSensitive { get; }
    public bool IsBinary { get; }
}

// Existing six-parameter overload remains byte-for-byte present.
public ColumnDefinition(
    SqlIdentifier name, SqlTypeDescriptor type,
    ColumnNullability nullability,
    ColumnGenerationDefinition generation,
    ColumnDefaultDefinition defaultValue,
    SchemaComment comment,
    SchemaCollation collation,
    ColumnUpdateBehavior updateBehavior);
public SchemaCollation Collation { get; }
public ColumnUpdateBehavior UpdateBehavior { get; }

// Existing two-parameter overload remains byte-for-byte present.
public IndexColumnDefinition(
    SqlIdentifier column, SqlSortDirection direction,
    int? prefixLength);
public int? PrefixLength { get; }
~~~

The old constructors delegate to the new overloads with null/None/null, so
binary and source compatibility plus old fingerprints remain unchanged. The
fingerprint/wire encoder writes **no extension tag or byte at all** when
Collation is null, UpdateBehavior is None, and PrefixLength is null; exact
pre-change frozen fingerprints for every old-constructor fixture must remain
byte-for-byte equal. Any non-default value writes a versioned, unambiguous tag
and all semantic fields, with mutation tests for each field.
`SchemaCollation` is an immutable value object, **not** a `SqlNode`, so the
neutral catalog stays exactly 93. It validates bounded value-safe source name
and a coherent binary/case/accent combination. UpdateBehavior rejects undefined
values and `CurrentDateTime` on non-date/time or generated columns. PrefixLength
must be positive and valid only for character/binary key columns, and validator
checks it against known logical length. Equality/hash, normalizer,
validator/traversal disposition, schema fingerprint wire encoding, public API
snapshots, all ten disposition rows, and all ten goldens include the new data.
`SchemaAndAdminStatementTests` updates its exact constructor/type/public-name
tables and fixture factory; preservation tests assert all new references/values
survive normalization, while rewrite/safety tests prove rewrites neither drop
nor fabricate them.
Every dialect maps a known collation intent and implements prefix semantics via
native prefix/function index or a deterministic computed-helper lowering; an
unprovable mapping fails closed. `CURRENT_TIMESTAMP ON UPDATE` is native where
available and otherwise lowered to the platform's semantically equivalent
trigger/default strategy owned by Dos.ORM. The seed plan consumes these already
frozen types and may not modify public AST or the 93-node catalog later.

Collation equivalence is deliberately limited to the frozen four dimensions:
Unicode repertoire, case sensitivity, accent sensitivity, binary-vs-linguistic
comparison, including their effect on unique constraints. It does not claim
byte-identical MySQL sort weights. Known source names such as
`utf8mb4_unicode_ci` map to an explicit per-profile collation/ICU/NLS strategy;
real lanes probe Chinese, emoji, case pairs, accent pairs, ordering, equality,
and a unique index. The seed manifest records this controlled transformation.
Unknown source names or a target unable to satisfy all four dimensions fail
closed; the audited official name must have an explicit six-dialect mapping.

`DialectDispositionCatalog` is a checked-in, reviewable exhaustive table—not a
table inferred from the compilers under test. For each of the ten exact
profiles it has exactly one `Native`, `Lowered`, or
`Rejected(feature,path)` disposition for every one of the 93 concrete neutral
`SqlNode` types, every defined unary/binary/comparison/set operator, every
`SemanticFunctionId`, every `LogicalDbType`, every DML/returning/locking/
pagination form, every schema/DDL operation, every metadata operation, every
admin operation, and Bulk native/fallback form. Reflection compares enum/type
sets to this table so a newly added node/operator/function/type/DDL form fails
until all ten dispositions are deliberately added. `Rejected` rows throw the
exact safe exception before Render; `Native`/`Lowered` rows compile. No
`default`, family inheritance, wildcard, or “not applicable” row can satisfy
coverage. The catalog separately asserts the neutral catalog remains exactly
93 nodes.

Every compilable disposition feeds the ten checked-in approved snapshots.
Snapshots contain exact command count/order/text, result roles/shapes,
transaction/connection behavior, parameter names/types/order/directions,
effective-impact entries, and fingerprint inputs, but never runtime values.
Tests compare exact normalized snapshots—`Contains` assertions are only local
diagnostics and never the acceptance oracle. A snapshot update requires a
reviewed disposition/capability change and corresponding official-version
test; the test runner never auto-accepts files.

Cross-dialect tests mutate only Build, Revision, compatibility-mode case, and
compatibility-mode text to prove profile-specific plan/fingerprint/effective
impact identity. They also prove Drop/Import safety references the exact admin
operation, Create/Export cannot be elevated, bulk batches never exceed the
caller maximum, and native SQL is never used as a schema/admin escape hatch.
For every internal dialect IR namespace, enumerate all concrete `SqlNode`
types and prove exact resolver coverage, neutral precedence, shared allocation
budgets, fail-closed unknown nodes, parameter-definition/rendered-placeholder
one-to-one correspondence, and same-compiler concurrency. Dialects with no
private IR must explicitly prove the empty closed set; family tests never
substitute for each database's matrix.

`DialectIrAssert` is a test-only reflection/source helper that enumerates exact
concrete `SqlNode` types under the compiler's own dialect namespace, invokes
the compiler's internal immutable descriptor set through friend access, and
compares exact `Type` identity. It never discovers production child order by
reflection. `AstSamples.AllSemantics` is added in this task as one neutral
statement/batch fixture covering every semantic branch used by the concurrent
snapshot; it contains definitions only, never runtime values.

- [ ] **Step 4: Run focused and total regression**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --nologo
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj -c Release --nologo
dotnet build ./Microi.Server/Dos.ORM/Dos.ORM.csproj -c Debug --nologo
dotnet build ./Microi.Server/Dos.ORM/Dos.ORM.csproj -c Release --nologo
dotnet build ./Microi.Server/Microi.net.sln -c Debug --no-restore --nologo
dotnet build ./Microi.Server/Microi.net.sln -c Release --no-restore --nologo
~~~

Expected: all compiler contracts PASS; builds have 0 errors.

- [ ] **Step 5: Commit**

~~~powershell
git add -- Microi.Server/Dos.ORM/SqlAst/SchemaModels.cs Microi.Server/Dos.ORM/SqlAst/SchemaStatements.cs Microi.Server/Dos.ORM/SqlCompilation/SqlAstNormalizer.cs Microi.Server/Dos.ORM/SqlCompilation/SqlAstValidator.cs Microi.Server/Dos.ORM/SqlCompilation/SqlAstTraversal.cs
git add -- Microi.Server/Dos.ORM/Dialects/MySql/MySqlCompiler.cs Microi.Server/Dos.ORM/Dialects/MySql/MySqlCapabilities.cs Microi.Server/Dos.ORM/Dialects/MySql/MySqlTypeMapper.cs Microi.Server/Dos.ORM/Dialects/MySql/MySqlSchemaCompiler.cs Microi.Server/Dos.ORM/Dialects/PostgreSql/PostgreSqlCompiler.cs Microi.Server/Dos.ORM/Dialects/PostgreSql/PostgreSqlCapabilities.cs Microi.Server/Dos.ORM/Dialects/PostgreSql/PostgreSqlTypeMapper.cs Microi.Server/Dos.ORM/Dialects/KingbaseEs/KingbaseEsCompiler.cs Microi.Server/Dos.ORM/Dialects/KingbaseEs/KingbaseEsCapabilities.cs Microi.Server/Dos.ORM/Dialects/KingbaseEs/KingbaseEsTypeMapper.cs
git add -- Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerCompiler.cs Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerCapabilities.cs Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerTypeMapper.cs Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerSchemaCompiler.cs Microi.Server/Dos.ORM/Dialects/Oracle/OracleCompiler.cs Microi.Server/Dos.ORM/Dialects/Oracle/OracleCapabilities.cs Microi.Server/Dos.ORM/Dialects/Oracle/OracleTypeMapper.cs Microi.Server/Dos.ORM/Dialects/Dm8/Dm8Compiler.cs Microi.Server/Dos.ORM/Dialects/Dm8/Dm8Capabilities.cs Microi.Server/Dos.ORM/Dialects/Dm8/Dm8TypeMapper.cs
git add -- Microi.Server/Dos.ORM.Tests/Dialects/FunctionCompilerContractTests.cs Microi.Server/Dos.ORM.Tests/Dialects/DmlCompilerContractTests.cs Microi.Server/Dos.ORM.Tests/Dialects/BulkCompilerContractTests.cs Microi.Server/Dos.ORM.Tests/Dialects/SchemaCompilerContractTests.cs Microi.Server/Dos.ORM.Tests/Dialects/MetadataAdminContractTests.cs Microi.Server/Dos.ORM.Tests/Dialects/DialectDispositionContractTests.cs Microi.Server/Dos.ORM.Tests/Dialects/DialectGoldenSnapshotTests.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/DialectIrAssert.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/DialectDispositionCatalog.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/AstSamples.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/PlanAssert.cs
git add -- Microi.Server/Dos.ORM.Tests/Compilation/CompilationCoreTests.cs Microi.Server/Dos.ORM.Tests/Compilation/CompilationCoreNormalizationPreservationTests.cs Microi.Server/Dos.ORM.Tests/Compilation/CompilationCoreNormalizationRewriteTests.cs Microi.Server/Dos.ORM.Tests/Compilation/CompilationCoreNormalizationSafetyTests.cs Microi.Server/Dos.ORM.Tests/SqlAst/SchemaAndAdminStatementTests.cs Microi.Server/Dos.ORM.Tests/SqlAst/ExecutionPlanAndNativeSqlTests.cs Microi.Server/Dos.ORM.Tests/SqlAst/SchemaCompatibilitySemanticsTests.cs Microi.Server/Dos.ORM.Tests/Snapshots/mysql-5.7.8.0.approved.txt Microi.Server/Dos.ORM.Tests/Snapshots/mysql-8.0.11.0.approved.txt Microi.Server/Dos.ORM.Tests/Snapshots/sqlserver-14.0.0.0.approved.txt Microi.Server/Dos.ORM.Tests/Snapshots/sqlserver-16.0.0.0.approved.txt Microi.Server/Dos.ORM.Tests/Snapshots/oracle-11.2.0.4.approved.txt Microi.Server/Dos.ORM.Tests/Snapshots/oracle-19.0.0.0.approved.txt Microi.Server/Dos.ORM.Tests/Snapshots/postgresql-14.0.0.0.approved.txt Microi.Server/Dos.ORM.Tests/Snapshots/postgresql-17.0.0.0.approved.txt Microi.Server/Dos.ORM.Tests/Snapshots/dm8-8.1.3.140-oracle.approved.txt Microi.Server/Dos.ORM.Tests/Snapshots/kingbasees-9.4.12.0-postgresql.approved.txt
git diff --cached --name-only
git diff --cached --check
git commit -m "feat: complete six-dialect SQL compilation"
~~~

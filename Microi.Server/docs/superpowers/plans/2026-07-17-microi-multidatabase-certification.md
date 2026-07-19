# Microi Six-Database Certification and E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Provide strict, reproducible Quick, Full, and ReleaseFull certification for Dos.ORM, the current official complete Microi empty database, Microi.net.Api, and Microi.Client across the approved database/version matrix.

**Architecture:** Quick is an offline compiler/component gate and is never database certification. Full and ReleaseFull download the current official MySQL 5.7 seed, create a dynamic manifest, import it into a real MySQL 5.7 reference lane, then restore and compare the complete schema and data on each target lane. One global lease permits exactly one database lane at a time; each lane runs identity, ORM, API, and deterministic bundled-Chromium UI gates before unconditional cleanup.

**Tech Stack:** PowerShell 7, Docker Compose, .NET 10, xUnit, Dos.ORM source-only platform/seed facades, Node.js, Vue 3, Playwright 1.59.1 bundled Chromium.

## Global Constraints

- Every command runs from workspace root D:\Work\microi.net.all. Every repository path in a command starts with ./Microi.Server or ./Microi.Client.
- The prerequisite seed implementation is ./Microi.Server/docs/superpowers/plans/2026-07-18-microi-empty-seed-converter.md. Full and ReleaseFull must consume its current official source, neutral manifest, compilers, artifacts, and source-only apply/diagnostic facade; they may not recreate a converter in certification code.
- The authoritative source is https://static.itdos.com/install/microi_empty_mysql57.sql.zip. Full and ReleaseFull download it for the run, record ZIP and SQL SHA-256, and derive all object/row expectations dynamically. Historic counts such as 133 tables and 16,083 rows are evidence from one version, never acceptance constants.
- Full runs a MySQL 5.7 reference import first, then MySQL 8.0, SQL Server 2022, Oracle 19c, PostgreSQL 17, DM8, and KingbaseES V9. ReleaseFull runs the same reference and Full lanes, then SQL Server 2017, Oracle 11g R2 11.2.0.4, and PostgreSQL 14; its reference lane also executes the MySQL 5.7 functional/API/UI contracts.
- Every target restores the complete current structure and data. Acceptance
  compares every logical application table's canonical schema fingerprint, row
  count, ordered typed row digest, indexes, keys, defaults, comments, and
  declared behavior to the MySQL 5.7 reference manifest. Oracle/DM may add only
  the exact Dos.ORM-owned `DOSORM_STORAGE_CONTRACT`; it is excluded from the
  logical application table count but its exact storage-contract fingerprint,
  rows, and physical-support digest are mandatory and compared independently.
  The other four targets add no support table: their nonempty physical-support
  digest is the exact `NATIVE_V1` profile-plus-schema policy digest. Missing one
  logical table/digest or expected support row, and any missing/mismatched
  target support digest, fails the lane.
- Quick may use a small synthetic fixture only for parser/compiler/component feedback. Quick output must say NOT_DATABASE_CERTIFIED and may never create, copy, or sign a Full/ReleaseFull acceptance manifest.
- At most one database lane may exist or run. A global exclusive lease plus Docker labels enforce this before start, while running, and after cleanup. Every start is paired with finally cleanup that removes the lane container, network, and volume and proves zero labeled lane containers remain.
- Quick requires only its offline L0-L2 compiler/component toolchain and writes
  `NOT_DATABASE_CERTIFIED`; it neither probes nor requires Docker server,
  Compose, database images/digests, database credentials, commercial
  licenses/EULAs, the live source package, API credentials, TLS trust, or a
  browser. Full/ReleaseFull require every one of those applicable real-lane
  dependencies, and any missing Docker, image, immutable digest, license/EULA,
  font, source package, credential, trusted certificate, or browser is a
  nonzero failure. No required test uses Skip, return-success-on-blocked,
  continue-on-error, or partial certification language.
- Every resolved lane freezes and compares DatabaseType, exact four-part version, edition, charset, collation, canonical DialectProfile compatibilityMode, image reference, and image digest. SQL Server additionally freezes its databaseCompatibilityLevel outside DialectProfile. All applicable fields participate in identity equality and the evidence hash; no prefix, wildcard, or major-only comparison is allowed.
- The approved exact 30-scalar DatabaseCapabilities truth table and exact profile fingerprint from the six-dialect compiler plan are certification inputs. Registry capability/profile mismatch fails before restore; certification code does not invent an alternate capability table.
- Production Microi code and DbSession submit zero native SQL and never create NativeSqlText for seed work. Provider health, live profile discovery, driver selection, schema introspection, managed seed apply, and database diagnostics use only public source-only Dos.ORM operations. Two independent native restore paths exist only inside isolated certification tooling: importing the unchanged authoritative MySQL 5.7 dump into the reference oracle, and invoking each target vendor client against that artifact ZIP's vendor SQL. Neither path is reachable from production, DbSession, DatabaseSeedConverter, NativeSqlText, or a Microi service.
- The certification runner is the only formal serial seed/database acceptance entry point. Per-lane seed scripts require a runner-owned lease/context and are not user-facing commands. Seed-converter Task 7 must either delegate to Invoke-MicroiDatabaseCertification.ps1 -Gate SeedRestore or provide only helpers called by it; it must not create a second orchestration lifecycle, acceptance manifest, or competing Invoke-SeedRestore implementation.
- Playwright is exactly 1.59.1 and launches its bundled Chromium. System browser channels and executablePath are forbidden. The run fixes viewport, device scale, locale, timezone, color scheme, reduced motion, a run-scoped post-login visual clock anchor, and a SHA-verified supplied font, and records the actual browser version and executable provenance.
- Normal Full/ReleaseFull runs never update visual baselines. Baselines are tracked in the root repository, owned by the Microi.Client maintainers, and update only through a separate explicit approval command that records approver, before/after hashes, and review ticket.
- Credentials, tokens, cookies, licenses, connection strings, and row values come only from environment/private local configuration. Evidence contains structural hashes and booleans, never secret values.
- Evidence is written only under ./.tmp/microi-multidb/<run-id>. Formal source and approved screenshot baselines are tracked.
- Repository boundaries are fixed: root D:/Work/microi.net.all contains Microi.Server except both private children and also contains Microi.Client; ./Microi.Server/Microi.net and ./Microi.Server/Microi.AI are separate private Git repositories. Microi.Client is not a separate Git repository. Root git never stages a private-child path, and each private repository is built/status-checked independently.

---

### Task 1: Freeze the exact lane, identity, capability, and failure contracts

**Files:**
- Create: Microi.Server/tests/Microi.DatabaseCertification/certification-matrix.json
- Create: Microi.Server/tests/Microi.DatabaseCertification/README.md
- Create: Microi.Server/tests/Microi.DatabaseCertification.Tests/Microi.DatabaseCertification.Tests.csproj
- Create: Microi.Server/tests/Microi.DatabaseCertification.Tests/CertificationMatrixTests.cs
- Create: Microi.Server/tests/Microi.DatabaseCertification.Tests/RepositoryBoundaryTests.cs
- Modify: Microi.Server/Microi.net.sln

**Interfaces:**
- Consumes: exact TestProfiles and the exact 30-scalar DatabaseCapabilities truth table produced by the six-dialect compiler plan.
- Produces: immutable LaneDefinition values whose Version property is System.Version with nonnegative Major/Minor/Build/Revision, and exit codes 20 missing image/digest, 21 missing license/source, 22 health failure, 23 identity/profile mismatch, 24 parallel lane, 25 seed mismatch, 26 API/UI failure, and 27 visual-baseline failure.

- [ ] **Step 1: Write the matrix REDs**

~~~csharp
[Fact]
public void Every_lane_freezes_all_identity_components()
{
    var matrix = CertificationMatrix.Load(TestPaths.Matrix);
    foreach (var lane in matrix.AllLanes)
    {
        Assert.All(new[]
        {
            lane.Version.Major,
            lane.Version.Minor,
            lane.Version.Build,
            lane.Version.Revision
        }, value => Assert.True(value >= 0));
        Assert.False(string.IsNullOrWhiteSpace(lane.Edition));
        Assert.False(string.IsNullOrWhiteSpace(lane.Charset));
        Assert.False(string.IsNullOrWhiteSpace(lane.Collation));
        Assert.NotNull(lane.CompatibilityMode);
        Assert.False(string.IsNullOrWhiteSpace(lane.ImageRef));
        Assert.False(string.IsNullOrWhiteSpace(lane.ExpectedImageDigest));
        if (lane.DatabaseType == DatabaseType.SqlServer)
            Assert.Contains(lane.DatabaseCompatibilityLevel, new[] { 140, 160 });
        else
            Assert.Null(lane.DatabaseCompatibilityLevel);
    }
}

[Fact]
public void Oracle11g_is_exactly_11_2_0_4()
{
    Assert.Equal(new System.Version(11, 2, 0, 4),
        CertificationMatrix.Load(TestPaths.Matrix)
            .Lane("oracle11gr2").Version);
}

[Fact]
public void Canonical_modes_and_kingbase_certified_floor_are_exact()
{
    var matrix = CertificationMatrix.Load(TestPaths.Matrix);
    Assert.All(matrix.AllLanes.Where(x =>
            x.DatabaseType != DatabaseType.DaMeng &&
            x.DatabaseType != DatabaseType.KingBase),
        lane => Assert.Equal(string.Empty, lane.CompatibilityMode));
    Assert.Equal("Oracle", matrix.Lane("dm8").CompatibilityMode);
    Assert.Equal("PostgreSQL",
        matrix.Lane("kingbase-v9").CompatibilityMode);
    Assert.True(matrix.Lane("kingbase-v9").Version.CompareTo(
        new System.Version(9, 4, 12, 0)) >= 0);
}

[Theory]
[MemberData(nameof(CertificationProfiles.All),
    MemberType = typeof(CertificationProfiles))]
public void Registry_profile_and_all_thirty_capabilities_match_approved_truth(
    CertificationProfile expected)
{
    var actual = DatabasePlatformRegistry.Get(expected.Profile);
    Assert.Equal(expected.Profile.Fingerprint, actual.Profile.Fingerprint);
    CapabilityAssert.ExactThirtyScalarEquality(
        expected.Capabilities, actual.Capabilities);
}
~~~

- [ ] **Step 2: Run the RED command**

~~~powershell
dotnet test ./Microi.Server/tests/Microi.DatabaseCertification.Tests/Microi.DatabaseCertification.Tests.csproj --filter "FullyQualifiedName~CertificationMatrixTests|FullyQualifiedName~RepositoryBoundaryTests" --nologo
~~~

Expected: nonzero because the certification project, matrix loader, and boundary contract do not exist.

- [ ] **Step 3: Add the exact tracked matrix**

The tracked matrix has these exact lane values. Canonical identity adapters in Dos.ORM map provider-native text to these values without loosening equality.

| Mode | Lane | DatabaseType | Four-part version | Edition | Charset | Collation | DialectProfile compatibilityMode | databaseCompatibilityLevel | Image reference and expected digest |
|---|---|---|---|---|---|---|---|---:|---|
| reference | mysql57 | MySql | 5.7.44.0 | Community | utf8mb4 | utf8mb4_unicode_ci | <empty> | n/a | mysql:5.7.44@sha256:4bc6bc963e6d8443453676cae56536f4b8156d78bae03c0145cbe47c2aad73bb |
| Full | mysql80 | MySql | 8.0.46.0 | Community | utf8mb4 | utf8mb4_0900_ai_ci | <empty> | n/a | mysql:8.0.46@sha256:7dcddc01f13bab2f15cde676d44d01f61fc9f99fe7785e86196dfc07d358ae2b |
| Full | sqlserver2022 | SqlServer | 16.0.4205.1 | Developer | CP936 | Chinese_PRC_CI_AS | <empty> | 160 | mcr.microsoft.com/mssql/server:2022-CU20-ubuntu-22.04@sha256:7c29dfbac885ad7519e219c7fe4aee0e67283e21a10e9c252d13b0fbde1866f8 |
| Full | oracle19c | Oracle | 19.3.0.0 | Enterprise | AL32UTF8 | BINARY | <empty> | n/a | MICROI_CERT_ORACLE19C_IMAGE_REF / MICROI_CERT_ORACLE19C_IMAGE_DIGEST |
| Full | postgres17 | PostgreSql | 17.6.0.0 | Community | UTF8 | C.UTF-8 | <empty> | n/a | postgres:17.6@sha256:00bc86618629af00d2937fdc5a5d63db3ff8450acf52f0636ec813c7f4902929 |
| Full | dm8 | DaMeng | 8.1.3.140 | Enterprise | UTF-8 | SCHINESE_PINYIN_M | Oracle | n/a | MICROI_CERT_DM8_IMAGE_REF / MICROI_CERT_DM8_IMAGE_DIGEST |
| Full | kingbase-v9 | KingBase | exact MICROI_CERT_KINGBASE_VERSION, minimum 9.4.12.0 | Enterprise | UTF8 | C | PostgreSQL | n/a | MICROI_CERT_KINGBASE_IMAGE_REF / MICROI_CERT_KINGBASE_IMAGE_DIGEST |
| ReleaseFull | sqlserver2017 | SqlServer | 14.0.3456.2 | Developer | CP936 | Chinese_PRC_CI_AS | <empty> | 140 | mcr.microsoft.com/mssql/server:2017-CU31-ubuntu-18.04@sha256:7d194c54e34cb63bca083542369485c8f4141596805611e84d8c8bab2339eede |
| ReleaseFull | oracle11gr2 | Oracle | 11.2.0.4 | Enterprise | AL32UTF8 | BINARY | <empty> | n/a | MICROI_CERT_ORACLE11G_IMAGE_REF / MICROI_CERT_ORACLE11G_IMAGE_DIGEST |
| ReleaseFull | postgres14 | PostgreSql | 14.19.0.0 | Community | UTF8 | C.UTF-8 | <empty> | n/a | postgres:14.19@sha256:962ffbe9f6418387643411b127c1db27465e5a23b9a8849bfaf45fa6323963ce |

For Oracle and DM8, matrix fields imageRefEnv and expectedImageDigestEnv name the variables shown above. KingbaseES additionally requires versionEnv=MICROI_CERT_KINGBASE_VERSION; preflight resolves its exact four numeric components together with image ref and digest, rejects any version below 9.4.12.0, and passes that exact version to the registry capability/profile test. Preflight freezes all commercial values once into resolved-matrix.json, requires an immutable sha256 digest, hashes the resolved matrix, and never accepts a tag-only image. Missing or mismatched licensed-build identity fails; changing the licensed build requires reviewed resolved-matrix evidence, not a wildcard.

Identity equality compares all fields below:

~~~csharp
Assert.Equal(expected.DatabaseType, actual.DatabaseType);
Assert.Equal(expected.Version, actual.Version);
Assert.Equal(expected.Edition, actual.Edition);
Assert.Equal(expected.Charset, actual.Charset);
Assert.Equal(expected.Collation, actual.Collation);
Assert.Equal(expected.CompatibilityMode, actual.CompatibilityMode);
Assert.Equal(expected.ImageRef, actual.ImageRef);
Assert.Equal(expected.ExpectedImageDigest, actual.ImageDigest);
Assert.Equal(expected.DatabaseCompatibilityLevel,
    actual.DatabaseCompatibilityLevel);
~~~

DatabaseCompatibilityLevel is a nullable diagnostics identity field and is
never copied into DialectProfile. Canonical DialectProfile compatibilityMode
is exactly string.Empty for MySQL, SQL Server, Oracle, and PostgreSQL, Oracle
for DM8, and PostgreSQL for KingbaseES.

- [ ] **Step 4: Prove repository boundaries and matrix GREEN**

RepositoryBoundaryTests executes git rev-parse --show-toplevel and requires root for ./Microi.Client, private Microi.net root for ./Microi.Server/Microi.net, and private Microi.AI root for ./Microi.Server/Microi.AI.

~~~powershell
dotnet test ./Microi.Server/tests/Microi.DatabaseCertification.Tests/Microi.DatabaseCertification.Tests.csproj --filter "FullyQualifiedName~CertificationMatrixTests|FullyQualifiedName~RepositoryBoundaryTests" --nologo
~~~

Expected: exit 0 with no skipped test.

- [ ] **Step 5: Stage in the root repository**

~~~powershell
git -C . add -- Microi.Server/tests/Microi.DatabaseCertification/certification-matrix.json Microi.Server/tests/Microi.DatabaseCertification/README.md Microi.Server/tests/Microi.DatabaseCertification.Tests/Microi.DatabaseCertification.Tests.csproj Microi.Server/tests/Microi.DatabaseCertification.Tests/CertificationMatrixTests.cs Microi.Server/tests/Microi.DatabaseCertification.Tests/RepositoryBoundaryTests.cs Microi.Server/Microi.net.sln
git -C . diff --cached --name-only
git -C . diff --cached --check
git -C . commit -m "test: freeze exact database certification matrix"
~~~

### Task 2: Enforce strict preflight, immutable images, and one-lane lifecycle

**Files:**
- Create: Microi.Server/tests/Microi.DatabaseCertification/compose/compose.certification.yml
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-CertificationPreflight.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Enter-CertificationLease.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Assert-SingleDatabaseLane.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Start-DatabaseLane.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Stop-DatabaseLane.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification.Tests/LaneLifecycleTests.cs

**Interfaces:**
- Produces: a resolved immutable matrix, a global exclusive lease, and one Compose project labeled com.microi.certification.lane=<lane-id>.
- Consumes: only lane identity/source requests; provider connection, health, and identity remain Dos.ORM facade calls.

- [ ] **Step 1: Write lifecycle REDs**

~~~csharp
[Fact]
public void Runner_rejects_a_second_live_or_leased_lane()
{
    using var first = LaneLease.Acquire("mysql80");
    Assert.Throws<ParallelLaneException>(() => LaneLease.Acquire("postgres17"));
}

[Fact]
public void Missing_commercial_digest_is_failure_not_skip()
{
    var result = PreflightModel.Evaluate(
        CertificationMode.Full,
        MatrixSamples.Oracle19WithoutExpectedDigest());
    Assert.Equal(20, result.ExitCode);
    Assert.False(result.Passed);
    Assert.False(result.Skipped);
}

[Fact]
public void Quick_does_not_probe_real_database_or_browser_infrastructure()
{
    var result = PreflightModel.Evaluate(
        CertificationMode.Quick,
        MatrixSamples.OfflineToolchainOnly());
    Assert.True(result.Passed);
    Assert.Equal("NOT_DATABASE_CERTIFIED", result.CertificationStatus);
    Assert.Empty(result.ProbedDatabaseOrBrowserDependencies);
}
~~~

- [ ] **Step 2: Run the RED command**

~~~powershell
dotnet test ./Microi.Server/tests/Microi.DatabaseCertification.Tests/Microi.DatabaseCertification.Tests.csproj --filter FullyQualifiedName~LaneLifecycleTests --nologo
~~~

Expected: nonzero because lease, preflight, and lifecycle models do not exist.

- [ ] **Step 3: Implement preflight and lifecycle**

Preflight branches on `CertificationMode` before touching external
infrastructure. Quick checks only pwsh, dotnet, Node/npm, the offline solution
and lock files, already-restored .NET assets/local Node dependencies, and
sufficient local scratch disk for L0-L2 tests. The Quick runner uses
`dotnet test --no-restore` and local npm scripts with `npm_config_offline=true`;
it never calls restore/install. Missing offline assets fails nonzero without a
network fallback. Quick does not invoke Docker/Compose, inspect ports, read
database/source/API credentials or license variables, pull an image, validate
a browser/font/TLS certificate, or make a network request. Full/ReleaseFull
additionally require Docker
client/server, Compose, lane ports, exact Playwright lock version and bundled
Chromium, SHA-verified font, current source access, database/API credentials,
required EULAs/licenses, exact image refs, and expected digests. Only those real
modes pull immutable references and verify RepoDigests before start.

Enter-CertificationLease holds an OS file lock under ./.tmp/microi-multidb/.lane.lock for the entire run. Assert-SingleDatabaseLane requires zero labeled containers before a lane, exactly one current-lane database container while active, and zero after cleanup. Start-DatabaseLane refuses to run if either assertion or lease ownership fails.

Stop-DatabaseLane always runs docker compose down --volumes --remove-orphans for the exact project name, removes only that run's temporary network/volume, then polls until no labeled lane container remains. Cleanup failure replaces success with a nonzero result.

- [ ] **Step 4: Run lifecycle GREEN and a poison probe**

~~~powershell
dotnet test ./Microi.Server/tests/Microi.DatabaseCertification.Tests/Microi.DatabaseCertification.Tests.csproj --filter FullyQualifiedName~LaneLifecycleTests --nologo
pwsh -NoProfile -File ./Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-CertificationPreflight.ps1 -Mode Quick
~~~

Expected: tests and Quick preflight exit 0, Quick reports
`NOT_DATABASE_CERTIFIED`, and a poison fixture proves Docker, credential,
license, image, browser, font, and network probes were not called. A test-owned
second-lane Full attempt exits 24 and its finally block leaves zero labeled
containers.

- [ ] **Step 5: Stage in the root repository**

~~~powershell
git -C . add -- Microi.Server/tests/Microi.DatabaseCertification/compose/compose.certification.yml Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-CertificationPreflight.ps1 Microi.Server/tests/Microi.DatabaseCertification/scripts/Enter-CertificationLease.ps1 Microi.Server/tests/Microi.DatabaseCertification/scripts/Assert-SingleDatabaseLane.ps1 Microi.Server/tests/Microi.DatabaseCertification/scripts/Start-DatabaseLane.ps1 Microi.Server/tests/Microi.DatabaseCertification/scripts/Stop-DatabaseLane.ps1 Microi.Server/tests/Microi.DatabaseCertification.Tests/LaneLifecycleTests.cs
git -C . diff --cached --name-only
git -C . diff --cached --check
git -C . commit -m "test: enforce serial real database lanes"
~~~

### Task 3: Build the dynamic official-seed reference and full restore gate

**Files:**
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Get-CurrentOfficialSeed.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-MySql57ReferenceImport.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-SeedTargetRestore.ps1
- Modify: Microi.Server/tests/Microi.DatabaseCertification/Seed/Invoke-SeedArtifactLane.ps1
- Modify: Microi.Server/tests/Microi.DatabaseCertification/Seed/Compare-SeedManifest.ps1
- Consume: Microi.Server/tests/Microi.DatabaseCertification/Seed/seed-evidence.schema.json
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Seed/OfficialSeedReferenceTests.cs
- Modify: Microi.Server/tests/Microi.Server.IntegrationTests/Seed/SeedRestoreContractTests.cs

**Interfaces:**
- Consumes: the built Microi.SeedConverter CLI, public
  `DatabaseSeedConverter.InspectSource/Convert/Verify/InspectDatabase`, its
  `inspect-live` command, public DatabaseSeedSourceException, the seed plan's
  single Invoke-SeedArtifactLane.ps1 component and evidence schema/comparer,
  IDatabaseResourceProvider, DatabaseResourceHandle,
  DatabaseImportOperation(ProviderNative, SchemaAndData), and DbSession
  PreviewAdmin/ExecuteAdmin. Parser/model/compiler/artifact types remain
  internal and are never named or reflected into certification code.
- Produces: CLI/resource-operation evidence files source-manifest.json and mysql57-reference-manifest.json plus complete vendor-sql-manifest.json and managed-payload-manifest.json comparisons for each target, including separate logical schema/typed-row digests and target physical-support digest. These are versioned evidence JSON contracts, not public Dos.ORM model types.

- [ ] **Step 1: Write dynamic-manifest REDs**

~~~csharp
[Fact]
public void Acceptance_has_no_hard_coded_historic_counts()
{
    var source = File.ReadAllText(TestPaths.CertificationScripts);
    Assert.DoesNotContain("16083", source);
    Assert.DoesNotContain("133 tables", source,
        StringComparison.OrdinalIgnoreCase);
}

[Theory]
[InlineData("MissingTable")]
[InlineData("ManagedOnly")]
public void Unique_seed_comparer_rejects_incomplete_evidence(string poison)
{
    var start = new System.Diagnostics.ProcessStartInfo("pwsh")
    {
        UseShellExecute = false,
        RedirectStandardOutput = true,
        RedirectStandardError = true
    };
    start.ArgumentList.Add("-NoProfile");
    start.ArgumentList.Add("-File");
    start.ArgumentList.Add(TestPaths.CompareSeedManifest);
    start.ArgumentList.Add("-SelfTest");
    start.ArgumentList.Add(poison);
    using var process = System.Diagnostics.Process.Start(start)!;
    process.WaitForExit();
    Assert.NotEqual(0, process.ExitCode);
}
~~~

SeedRestoreContractTests contains only process invocation/exit/evidence-schema
assertions against Seed/Compare-SeedManifest.ps1. It declares no manifest row,
table, field, digest, equality, or comparison model and performs no comparison
in C#; MissingTable and ManagedOnly poison construction/comparison remain owned
by the single PowerShell comparer and seed-evidence.schema.json.

- [ ] **Step 2: Run the RED command**

~~~powershell
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter "FullyQualifiedName~OfficialSeedReferenceTests|FullyQualifiedName~SeedRestoreContractTests" --nologo
~~~

Expected: nonzero because certification wrappers and the unique comparer's
certification poison/evidence contract are not wired yet.

- [ ] **Step 3: Implement current-source and MySQL 5.7 reference import**

Get-CurrentOfficialSeed downloads the fixed official URL with cache revalidation and calls Microi.SeedConverter generate or public DatabaseSeedConverter.InspectSource(Stream, Stream). InspectSource writes the run's ZIP/SQL SHA and dynamic value-safe source-manifest.json evidence; Verify is used only for an already-generated target artifact against its exact profile. Certification never accesses the internal parser or neutral model and never substitutes a checked-in fixture in Full/ReleaseFull.

Start mysql57 under the global lease. Invoke-MySql57ReferenceImport is a thin
runner wrapper that validates the runner context and calls
Seed/Invoke-SeedArtifactLane.ps1 exactly once with phase Reference, the unchanged
source package, and dynamic source evidence. The seed component owns the mysql
client import, then launches the already-built `inspect-live` host with only the
lane DatabaseType/mode, connection-environment name, and output path. Only
`DatabaseSeedConverter.InspectDatabase` produces the schema-validated
mysql57-reference-manifest.json; the wrapper contains no split, rewrite,
translation, database readback, vendor command, or comparison logic.

Before any target starts, call only Seed/Compare-SeedManifest.ps1 to compare source and reference evidence: source SHA, complete table set, each canonical schema fingerprint, every table row count and typed row digest, indexes, PK/UK/FK, defaults, comments, collation, on-update behavior, prefix-index semantics, and large values. Then cleanup mysql57 and prove zero live lanes.

- [ ] **Step 4: Generate every exact certification-profile artifact**

DatabaseSeedConverter supports every exact certification DialectProfile through the six dialect compilers. Default generate still emits exactly the five non-MySQL current customer delivery ZIPs from checked-in `seed-targets.json`, but certification does not assume those profiles equal a licensed/live lane. It calls Convert with each immutable `resolved-matrix.json` exact profile and writes run-temporary artifacts for **all** Full/ReleaseFull targets, including the exact resolved KingbaseES version and MySQL 8/minimum-version lanes. A default ZIP may be byte-reused only when its full profile fingerprint equals the resolved lane and Verify succeeds; otherwise it is regenerated. Every ZIP is immediately checked with Verify against that exact profile; no internal seed type becomes public.

- [ ] **Step 5: Restore every target through both independent paths**

For each target, start only that lane and prove every applicable identity field
(including SQL Server databaseCompatibilityLevel outside DialectProfile), exact
capability/profile fingerprint, and required vendor client/version.
Invoke-SeedTargetRestore is a thin runner wrapper that calls the single
Seed/Invoke-SeedArtifactLane.ps1 first with phase VendorSql and the exact ZIP.
The seed component owns vendor entry extraction/client invocation, invokes
`inspect-live` after restore to create vendor-sql-manifest.json, and calls
Compare-SeedManifest.ps1; the wrapper contains no vendor command, database
readback, restore, digest, or comparison implementation.

The VendorSql phase deliberately leaves its verified target populated. The
wrapper then calls the same component with phase ManagedPayload and the same
ZIP/digest; it must not pre-drop, pre-clear, or switch away from that target. The seed
component registers the ZIP through
IDatabaseResourceProvider/DatabaseResourceHandle, constructs
DatabaseImportOperation with ProviderNative, SchemaAndData, and
`ReplaceTargetDatabase`, calls
PreviewAdmin/ExecuteAdmin, and invokes the same `inspect-live` executable to
create managed-payload-manifest.json before using its one comparer/schema for
the complete comparison. Vendor SQL, managed portable payload, and MySQL
reference must all equal each other. A missing/changed host executable, vendor
client, path, unsupported exact profile, artifact/profile mismatch, partial
restore, absent digest, or unequal paths exits 25; no smaller fixture fallback
exists.

The managed phase records the Dos.ORM reset/activation event order. MySQL, SQL
Server, PostgreSQL, and KingbaseES may record database drop/create when their
capabilities allow it. Oracle 19c/11.2 and DM8 must record elevated schema-owner
enumeration and dependency-ordered object reset, stale-target disposal, fresh
reconnect, exact-profile redetection, empty business/support proof,
`PendingImport`, schema/catalog completion, `Active` re-read, and only then the
first data DML. Any unsupported create/drop-database call, pre-cleared target,
missing event, reordered event, residual object, or first DML before Active
fails the real lane.

- [ ] **Step 6: Run GREEN against an explicitly selected real lane**

~~~powershell
$env:MICROI_CERT_COMPONENT_LANE = 'mysql80'
dotnet build ./Microi.Server/tools/Microi.SeedConverter/Microi.SeedConverter.csproj -c Release --nologo
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter "FullyQualifiedName~OfficialSeedReferenceTests|FullyQualifiedName~SeedRestoreContractTests" --nologo
Remove-Item Env:MICROI_CERT_COMPONENT_LANE
~~~

Expected: the test-owned runner context acquires the real lease, imports MySQL 5.7, generates the exact MySQL 8 ZIP, completes vendor-client and managed-payload restores of that same ZIP, compares every current source table, exits 0, and leaves zero labeled lane containers. Missing real infrastructure or vendor client exits nonzero instead.

- [ ] **Step 7: Stage in the root repository**

~~~powershell
git -C . add -- Microi.Server/tests/Microi.DatabaseCertification/scripts/Get-CurrentOfficialSeed.ps1 Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-MySql57ReferenceImport.ps1 Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-SeedTargetRestore.ps1 Microi.Server/tests/Microi.DatabaseCertification/Seed/Invoke-SeedArtifactLane.ps1 Microi.Server/tests/Microi.DatabaseCertification/Seed/Compare-SeedManifest.ps1 Microi.Server/tests/Microi.Server.IntegrationTests/Seed/OfficialSeedReferenceTests.cs Microi.Server/tests/Microi.Server.IntegrationTests/Seed/SeedRestoreContractTests.cs
git -C . diff --cached --name-only
git -C . diff --cached --check
git -C . commit -m "test: restore current Microi seed on real databases"
~~~

### Task 4: Certify live driver/profile timing, ORM semantics, and API contracts

**Files:**
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Dos.ORM.IntegrationTests.csproj
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Fixtures/ActiveDatabaseLane.cs
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Fixtures/ManagedBootstrapEventCollector.cs
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Fixtures/ManagedAdminTransitionEventCollector.cs
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Contracts/LiveProfileDispatchTests.cs
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Contracts/CrudAndTypeContractTests.cs
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Contracts/PaginationUpsertBulkTests.cs
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Contracts/TransactionLockSchemaTests.cs
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Contracts/TargetIdentityFingerprintTests.cs
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Contracts/TargetResetActivationTests.cs
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Start-MicroiApi.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Stop-MicroiApi.ps1
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Api/DatabaseLaneApiTests.cs
- Modify: Microi.Server/Microi.net.sln

**Interfaces:**
- Consumes: the current active restored lane, production Dos.ORM/Microi.net.Api
  paths, and the two value-safe internal production EventSources observed only
  through BCL `EventListener`: `Dos-ORM-ManagedBootstrap` for live dispatch and
  `Dos-ORM-ManagedAdminTransition` for Oracle/DM replacement ordering.
- Produces: proof that live four-part profile discovery precedes capability/compiler/driver dispatch and that API login/menu/FormEngine CRUD use the same profile.

- [ ] **Step 1: Write live-profile and API REDs**

~~~csharp
[Fact]
public async Task Live_profile_is_final_before_first_compile_and_driver_dispatch()
{
    await using var lane = ActiveDatabaseLane.Require();
    var trace = await lane.OpenThroughProductionProviderFactoryAsync();
    Assert.True(trace.ConnectionOpenedBeforeProfileDetection);
    Assert.True(trace.ProfileDetectionCompletedBeforeCompilerResolution);
    Assert.True(trace.ProfileDetectionCompletedBeforeDriverResolution);
    Assert.Equal(lane.ExpectedProfile.Fingerprint,
        trace.FirstExecutionPlan.DialectProfile.Fingerprint);
}

[Fact]
public async Task Login_and_formengine_contracts_succeed_on_active_lane()
{
    await using var api = await ApiProcessFixture.StartAsync();
    var login = await api.LoginAsync();
    Assert.Equal(1, login.JsonCode);
    Assert.True(login.HasNonEmptyToken);
    await api.AssertMenuListAddEditDetailDeleteAsync(login.RedactedHandle);
}

[Fact]
public async Task Same_profile_and_logical_data_on_second_target_changes_identity()
{
    await using var lane = ActiveDatabaseLane.Require();
    await using var second = await lane.CreateSecondaryLogicalTargetAsync();
    try
    {
        await second.ImportSameAuthoritativeArtifactAsync();
        var primary = await lane.InspectLiveAsync();
        var alternate = await second.InspectLiveAsync();

        Assert.Equal(primary.ExactProfileFingerprint,
            alternate.ExactProfileFingerprint);
        Assert.Equal(primary.LogicalSchemaDigest, alternate.LogicalSchemaDigest);
        Assert.Equal(primary.TypedRowDigest, alternate.TypedRowDigest);
        Assert.NotEqual(primary.TargetInstanceFingerprint,
            alternate.TargetInstanceFingerprint);
    }
    finally
    {
        await second.DropLogicalTargetAsync();
    }
}

[Fact]
public async Task Oracle_or_dm_replace_resets_schema_reconnects_and_activates()
{
    await using var lane = ActiveDatabaseLane.RequireOracleOrDm();
    await lane.InstallDirtyHistoricalTargetWithoutContractAsync();

    var trace = await lane.ReplaceFromAuthoritativeArtifactAsync();

    Assert.False(trace.UsedCreateDatabaseCapability);
    Assert.False(trace.UsedDropDatabaseCapability);
    Assert.Equal(new[]
    {
        "ResetAuthorized", "OwnedObjectsEnumerated", "OwnedObjectsDropped",
        "StaleTargetDisposed", "TargetReconnected", "ExactProfileRedetected",
        "EmptyTargetProved", "PendingImportWritten", "SchemaCatalogVerified",
        "StorageContractActivated", "ActiveContractRead", "FirstDataDml"
    }, trace.OrderedEvents);
}
~~~

`TargetResetActivationTests` is invoked only by the Oracle and DM8 lane
commands selected by the serial certification orchestrator; it never returns or
skips on another lane. Full evidence is incomplete unless both exact current
product lanes emit a passing result, and ReleaseFull additionally repeats the
Oracle 11.2 lane. The fixture uses production `PreviewAdmin/ExecuteAdmin` and
the independently verified authoritative artifact; it does not call a vendor
reset helper. `ManagedAdminTransitionEventCollector` listens to the frozen
`Dos-ORM-ManagedAdminTransition` IDs 1..12, groups by operation ID, and rejects
missing, duplicate, reordered, cross-operation, unsafe-payload, or synthetic
events; `trace.OrderedEvents` above comes only from that listener.

`TargetIdentityFingerprintTests` runs once on every real lane with no Skip. It
uses production neutral `CreateDatabaseOperation`/`DatabaseImportOperation` to
create a second logical target inside the already-running database container
(catalog/database for the four literal-database profiles, schema owner for
Oracle/DM), imports the same verified artifact, calls the frozen `inspect-live`
path on both targets, proves exact profile/schema/typed-row equality and target
fingerprint inequality, and removes the secondary target in `finally` through
production `DropDatabaseOperation`. It never starts a second container and
cannot inject a fingerprint. Missing elevated lifecycle permission or cleanup
fails the lane.

- [ ] **Step 2: Run the RED command**

~~~powershell
dotnet test ./Microi.Server/tests/Dos.ORM.IntegrationTests/Dos.ORM.IntegrationTests.csproj --filter FullyQualifiedName~LiveProfileDispatchTests --nologo
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter FullyQualifiedName~DatabaseLaneApiTests --nologo
~~~

Expected: both commands are nonzero because the production-lane fixtures and trace assertions do not exist.

- [ ] **Step 3: Implement production-path contracts**

The live connection is opened by the production provider factory, exact
profile/mode is detected through Dos.ORM, then compiler/capabilities/internal
managed driver are selected. `ActiveDatabaseLane` installs a BCL
`EventListener` before opening and consumes only event IDs 1..5,
`ConnectionOpened`, `ProfileDetected`, `CompilerResolved`, `DriverResolved`,
and `ExecutionPlanCompiled`; it never accesses internals or adds an
InternalsVisibleTo friend. Events are grouped by operation ID so concurrent
noise cannot satisfy the lane. The first execution plan and all subsequent
commands must retain that exact profile. Missing, duplicate, reordered, unsafe-
payload, cross-operation, or mismatched profile/plan fingerprint events fail.
Any compile/driver selection
before live detection fails the trace contract; tests must not inject a
preselected vendor driver or synthesize trace booleans.

For Oracle/DM replacement, the fixture separately installs
`ManagedAdminTransitionEventCollector` before `PreviewAdmin` and consumes only
the second production EventSource's exact IDs 1..12. The reset test cannot read
internal state or accept an application/test callback as evidence.

Add real contracts for Unicode, NULL, GUID, Boolean, date/time, decimal, long text, BLOB, reserved identifiers, count-plus-data paging, functions, Upsert atomicity, Bulk splitting, rollback, locks, DDL, metadata, diagnostics, and concurrent operations. Tests call neutral DbSession APIs only.

Every lane also runs `TargetIdentityFingerprintTests` before API/UI. The lane
result records the two safe fingerprint hashes, identical logical digest, test
result, and secondary-target cleanup proof; a constant fingerprint or a driver
that hashes only profile/data fails on the real server.

The text contract includes NULL versus empty versus one-space, leading U+E000,
LIKE empty/`%`/`_`/ESCAPE, ordering/range/length/substring/concat, unique empty,
empty foreign keys, Bulk/Upsert/returning and large CLOB readback. Oracle/DM
must expose the logical values while also proving the physical-support digest;
a missing/mismatched storage catalog creates zero business commands and fails
the lane. An unmarked physical value can be discovered only by the first
managed read: it exposes zero logical values, permits no subsequent command or
write, disposes the reader/command, and fails the lane.

Start-MicroiApi launches ./Microi.Server/Microi.net.Api with temporary environment configuration for the active lane and Redis, without editing appsettings. HTTP contracts assert login JSON Code equals 1, a nonempty token exists in the response contract, menu and workbench load, and list/add/edit/detail/delete/logout all return their expected DosResult codes. Logs and response evidence redact the token.

- [ ] **Step 4: Run GREEN on the active lane**

~~~powershell
if ([string]::IsNullOrWhiteSpace($env:MICROI_CERT_ACTIVE_DATABASE_TYPE)) { throw 'MICROI_CERT_ACTIVE_DATABASE_TYPE is required' }
dotnet test ./Microi.Server/tests/Dos.ORM.IntegrationTests/Dos.ORM.IntegrationTests.csproj --filter "FullyQualifiedName~TargetIdentityFingerprintTests" --nologo
dotnet test ./Microi.Server/tests/Dos.ORM.IntegrationTests/Dos.ORM.IntegrationTests.csproj --filter "FullyQualifiedName!~TargetIdentityFingerprintTests&FullyQualifiedName!~TargetResetActivationTests" --nologo
if ($env:MICROI_CERT_ACTIVE_DATABASE_TYPE -in @('Oracle', 'DaMeng')) {
    dotnet test ./Microi.Server/tests/Dos.ORM.IntegrationTests/Dos.ORM.IntegrationTests.csproj --filter "FullyQualifiedName~TargetResetActivationTests" --nologo
}
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter FullyQualifiedName~DatabaseLaneApiTests --nologo
dotnet build ./Microi.Server/Microi.net.Api/Microi.net.Api.csproj --nologo
~~~

Expected: exit 0 and no Skip while a real lane is active; without one, the
commands fail nonzero rather than substituting a mock. Non-Oracle/DM lanes do
not execute or report the reset test. The identity-switch command is a separate
process and must finish first; the ordinary ORM command explicitly excludes both
destructive identity/reset classes, so xUnit class parallelism cannot mutate the
primary target during its full logical digest. The serial Full/ReleaseFull
orchestrator must run the conditional third ORM command for every Oracle/DM lane
and rejects acceptance when
either current Oracle or current DM evidence is absent.

- [ ] **Step 5: Stage root files and verify private repositories remain separate**

~~~powershell
git -C . add -- Microi.Server/tests/Dos.ORM.IntegrationTests/Dos.ORM.IntegrationTests.csproj Microi.Server/tests/Dos.ORM.IntegrationTests/Fixtures/ActiveDatabaseLane.cs Microi.Server/tests/Dos.ORM.IntegrationTests/Fixtures/ManagedBootstrapEventCollector.cs Microi.Server/tests/Dos.ORM.IntegrationTests/Fixtures/ManagedAdminTransitionEventCollector.cs Microi.Server/tests/Dos.ORM.IntegrationTests/Contracts/LiveProfileDispatchTests.cs Microi.Server/tests/Dos.ORM.IntegrationTests/Contracts/CrudAndTypeContractTests.cs Microi.Server/tests/Dos.ORM.IntegrationTests/Contracts/PaginationUpsertBulkTests.cs Microi.Server/tests/Dos.ORM.IntegrationTests/Contracts/TransactionLockSchemaTests.cs Microi.Server/tests/Dos.ORM.IntegrationTests/Contracts/TargetIdentityFingerprintTests.cs Microi.Server/tests/Dos.ORM.IntegrationTests/Contracts/TargetResetActivationTests.cs Microi.Server/tests/Microi.DatabaseCertification/scripts/Start-MicroiApi.ps1 Microi.Server/tests/Microi.DatabaseCertification/scripts/Stop-MicroiApi.ps1 Microi.Server/tests/Microi.Server.IntegrationTests/Api/DatabaseLaneApiTests.cs Microi.Server/Microi.net.sln
git -C . diff --cached --name-only
git -C . diff --cached --check
git -C ./Microi.Server/Microi.net status --short --untracked-files=all
git -C ./Microi.Server/Microi.AI status --short --untracked-files=all
git -C . commit -m "test: certify ORM and API on live profiles"
~~~

### Task 5: Add deterministic bundled-Chromium login, CRUD, network, and visual gates

**Files:**
- Create: Microi.Client/playwright.multidb.config.mjs
- Create: Microi.Client/tests/e2e/multidb/fixtures/microi-test.mjs
- Create: Microi.Client/tests/e2e/multidb/support/network-guard.mjs
- Create: Microi.Client/tests/e2e/multidb/support/deterministic-ui.mjs
- Create: Microi.Client/tests/e2e/multidb/support/evidence-reporter.mjs
- Create: Microi.Client/tests/e2e/multidb/login-crud.spec.mjs
- Create through the one-time initialization gate only: Microi.Client/tests/e2e/multidb/snapshots/manifest.json
- Create through the same gate: Microi.Client/tests/e2e/multidb/snapshots/login.png
- Create through the same gate: Microi.Client/tests/e2e/multidb/snapshots/workbench.png
- Create through the same gate: Microi.Client/tests/e2e/multidb/snapshots/list.png
- Create through the same gate: Microi.Client/tests/e2e/multidb/snapshots/add.png
- Create through the same gate: Microi.Client/tests/e2e/multidb/snapshots/edit.png
- Create through the same gate: Microi.Client/tests/e2e/multidb/snapshots/detail.png
- Create through the same gate: Microi.Client/tests/e2e/multidb/snapshots/delete.png
- Create through the same gate: Microi.Client/tests/e2e/multidb/snapshots/logout.png
- Create: Microi.Client/tests/e2e/multidb/BASELINE_POLICY.md
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Update-VisualBaselines.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/New-CertificationTlsIdentity.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Remove-CertificationTlsIdentity.ps1
- Modify: Microi.Client/package.json
- Modify: Microi.Client/package-lock.json

**Interfaces:**
- Consumes: fixed FRONTEND=http://localhost:1988, fixed BACKEND=https://127.0.0.1:7266, a run-scoped trusted leaf certificate whose SAN contains only IP `127.0.0.1`, required MICROI_OSCLIENT with exact value iTdos, required secret MICROI_CERT_ACCOUNT, required secret MICROI_CERT_PASSWORD, active lane, SHA-verified font path, and acceptance output.
- Produces: assertions plus login.png, workbench.png, list.png, add.png, edit.png, detail.png, delete.png, and logout.png; actual browser version/executable hash is recorded.

- [ ] **Step 1: Write the UI RED**

~~~javascript
test('real login CRUD logout has strict response and stable views', async ({
  page, certification
}) => {
  await page.goto(
    'http://localhost:1988/?OsClient=' +
    encodeURIComponent(process.env.MICROI_OSCLIENT) +
    '#/login?redirect=/');
  await certification.screenshot(page, 'login.png');

  const responsePromise = page.waitForResponse(
    response => response.url().includes('/api/SysUser/Login'));
  await certification.login(page);
  const response = await responsePromise;
  const body = await response.json();
  expect(body.Code).toBe(1);
  expect(certification.extractToken(body, response.headers()).length)
    .toBeGreaterThan(0);

  await certification.assertWorkbench(page);
  await certification.screenshot(page, 'workbench.png');
  await certification.listAddEditDetailDelete(page);
  await certification.logout(page);
  await certification.screenshot(page, 'logout.png');
  certification.network.assertClean();
});
~~~

- [ ] **Step 2: Run the RED command**

~~~powershell
npm --prefix ./Microi.Client run test:e2e:multidb
~~~

Expected: nonzero because the script, config, fixtures, and approved baselines do not exist.

- [ ] **Step 3: Pin bundled Chromium and the deterministic environment**

Set @playwright/test to exactly 1.59.1, retain package-lock's exact playwright/playwright-core 1.59.1 resolution, install with npm ci, then install bundled Chromium:

~~~powershell
npm --prefix ./Microi.Client ci
npm --prefix ./Microi.Client exec -- playwright install chromium
~~~

Config uses browserName chromium only and rejects channel or executablePath. Fix viewport 1440x900, deviceScaleFactor 1, locale zh-CN, timezoneId Asia/Shanghai, colorScheme light, and reducedMotion reduce. Preflight captures one run-clock.json UTC anchor and later requires each API health Date/UTC probe to be within 60 seconds of real browser UTC before login. Authentication and token-expiry logic run on real time. Only after successful login, deterministic-ui applies the shared run anchor to client-rendered visual clock regions; all server timestamps and elapsed-time regions are masked in screenshots. Load MICROI_CERT_FONT_PATH as the sole injected UI font only after its SHA equals MICROI_CERT_FONT_SHA256. Record browser.version(), browserType.executablePath(), executable SHA, Playwright version, OS, viewport, locale, timezone, run anchor, observed backend skew, and font SHA; fail if executable provenance is outside Playwright's bundled browser cache.

Before Kestrel starts, `New-CertificationTlsIdentity.ps1` creates a run-scoped
private root and leaf with `CertificateRequest`. The leaf has server-auth EKU,
digital-signature/key-encipherment usage, `CA=false`, and an exact SAN IP entry
for `127.0.0.1` (no DNS fallback); the short-lived root has `CA=true`. Private
material and the random PFX password exist only under the ACL-restricted current
run directory/process environment. Install only that root fingerprint in the
CurrentUser Root store, verify chain policy and hostname/IP validation with a
normal `HttpClient`, inject the leaf PFX through Kestrel certificate environment
variables, and record only root/leaf SHA-256 fingerprints, SAN, validity, and
trust booleans. Playwright keeps `ignoreHTTPSErrors=false`; no command-line
certificate bypass is allowed.

Every Full/ReleaseFull lane stops browser and API before
`Remove-CertificationTlsIdentity.ps1` removes the exact root/leaf fingerprints,
deletes PFX/private material, and proves neither certificate remains in the
CurrentUser stores. Creation, trust, SAN, chain, Kestrel binding, HTTPS probe,
or cleanup failure exits nonzero and cannot write acceptance evidence. Quick
never creates or trusts a certificate.

- [ ] **Step 4: Implement login, eight screenshots, and the network guard**

Before browser launch, require MICROI_CERT_ACCOUNT, MICROI_CERT_PASSWORD, and MICROI_OSCLIENT, and require MICROI_OSCLIENT to equal iTdos ordinally. Any missing/blank/wrong variable exits 26. The account/password have no default and are injected only through the current local process environment. Scripts/tests must not echo, serialize, log, attach, screenshot, or copy either value into source, evidence, traces, videos, HAR, failure messages, or baseline provenance.

The login assertion fills only from MICROI_CERT_ACCOUNT/MICROI_CERT_PASSWORD, parses JSON, and requires Code == 1. Token extraction checks the supported JSON token fields and legacy authorization response header, requires a nonempty value, verifies authenticated browser storage, and immediately redacts the value from evidence. Capture login.png before filling inputs; mask password inputs and authenticated account/user identity regions in every later screenshot. Disable Playwright trace, video, and HAR for the credential-bearing UI test because action/request recordings can retain account/password/token material; failure evidence is limited to masked screenshots and structurally redacted logs.

Run the real sequence login, workbench, list, add, edit, detail, delete, logout and take one stable named screenshot at each state. Each state waits for a semantic UI marker and relevant Code == 1 network response, not a timeout.

Start Vite with --host localhost --port 1988 --strictPort and navigate only to the user acceptance URL http://localhost:1988/?OsClient=iTdos#/login?redirect=/. The guard treats that exact localhost origin as FRONTEND and https://127.0.0.1:7266 as the separately declared BACKEND; it never rewrites one hostname into the other, so loopback aliasing cannot produce a false same-origin decision. It allows only these two exact origins and explicitly reviewed local asset paths. It fails requestfailed, unapproved redirect/origin, any unapproved 4xx/5xx, invalid/empty JSON, string null, unexpected Code != 1, pageerror, console error, TypeError, ReferenceError, Vue recursive updates, and secret-bearing URL/query/log output.

Normal tests first require manifest.json and all eight expected baseline PNGs. If any is absent they exit 27 before Playwright can create a missing snapshot; they never use automatic missing-snapshot generation or --update-snapshots. Candidate captures always go under ./.tmp.

Update-VisualBaselines supports two mutually exclusive explicit paths:

1. One-time -InitializeBaselines requires the manifest and all eight tracked PNGs to be absent (partial state fails), -ImplementationAuthorization INITIALIZE_EIGHT_BASELINES, nonblank MICROI_VISUAL_BASELINE_INITIALIZER and MICROI_VISUAL_BASELINE_TICKET, git diff --cached --quiet, a currently healthy real-lane proof containing exact identity/seed/API/network evidence, and bundled-browser/font provenance. The script then launches an initialization-only capture mode that never calls toHaveScreenshot and can write only under the run's ./.tmp candidate directory. It requires exactly eight complete masked candidate PNGs before it copies all eight and atomically creates manifest.json with initializer, ticket, UTC, lane/profile, source/artifact SHA, browser/executable/font SHA, deterministic settings, masks, and all image hashes. It never records credentials or token data.
2. After initialization, only -ApproveBaselineUpdate with nonblank MICROI_VISUAL_BASELINE_APPROVER and MICROI_VISUAL_BASELINE_TICKET may replace baselines. It requires a clean tracked index, healthy real lane, all eight candidates, and records approver/ticket plus every before/after hash. It cannot initialize an absent or partial baseline set.

BASELINE_POLICY assigns ownership to Microi.Client maintainers and forbids ordinary tests or CI from initializing/updating automatically.

- [ ] **Step 5: Initialize once when absent, then run UI GREEN**

~~~powershell
pwsh -NoProfile -File ./Microi.Server/tests/Microi.DatabaseCertification/scripts/Update-VisualBaselines.ps1 -InitializeBaselines -ImplementationAuthorization INITIALIZE_EIGHT_BASELINES -Lane mysql80
npm --prefix ./Microi.Client run test:e2e:multidb
~~~

Expected: the initializer exits 0 only on the first authorized healthy real-lane run with a wholly absent baseline set; otherwise its strict preconditions fail. The subsequent normal test exits 0 without writing snapshots; eight comparisons pass; browser evidence says Playwright 1.59.1 bundled Chromium; login JSON Code is 1; a token exists but is absent from logs; network guard is clean.

- [ ] **Step 6: Stage through the root repository because Microi.Client is not independent**

~~~powershell
if ((git -C ./Microi.Client rev-parse --show-toplevel) -ne (git -C . rev-parse --show-toplevel)) { throw "Microi.Client repository boundary changed" }
git -C . add -- Microi.Client/playwright.multidb.config.mjs Microi.Client/tests/e2e/multidb/fixtures/microi-test.mjs Microi.Client/tests/e2e/multidb/support/network-guard.mjs Microi.Client/tests/e2e/multidb/support/deterministic-ui.mjs Microi.Client/tests/e2e/multidb/support/evidence-reporter.mjs Microi.Client/tests/e2e/multidb/login-crud.spec.mjs Microi.Client/tests/e2e/multidb/snapshots/manifest.json Microi.Client/tests/e2e/multidb/snapshots/login.png Microi.Client/tests/e2e/multidb/snapshots/workbench.png Microi.Client/tests/e2e/multidb/snapshots/list.png Microi.Client/tests/e2e/multidb/snapshots/add.png Microi.Client/tests/e2e/multidb/snapshots/edit.png Microi.Client/tests/e2e/multidb/snapshots/detail.png Microi.Client/tests/e2e/multidb/snapshots/delete.png Microi.Client/tests/e2e/multidb/snapshots/logout.png Microi.Client/tests/e2e/multidb/BASELINE_POLICY.md Microi.Client/package.json Microi.Client/package-lock.json Microi.Server/tests/Microi.DatabaseCertification/scripts/Update-VisualBaselines.ps1 Microi.Server/tests/Microi.DatabaseCertification/scripts/New-CertificationTlsIdentity.ps1 Microi.Server/tests/Microi.DatabaseCertification/scripts/Remove-CertificationTlsIdentity.ps1
git -C . diff --cached --name-only
git -C . diff --cached --check
git -C . commit -m "test: add deterministic multidatabase UI certification"
~~~

### Task 6: Orchestrate Quick, Full, and ReleaseFull with strict evidence

**Files:**
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-DatabaseLane.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-MicroiDatabaseCertification.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/New-AcceptanceManifest.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification.Tests/CertificationRunnerTests.cs

**Interfaces:**
- Produces: a nonzero failure or ./.tmp/microi-multidb/<run-id>/acceptance-manifest.json that covers every required lane and complete seed/UI evidence.

- [ ] **Step 1: Write runner REDs**

~~~csharp
[Fact]
public void Full_cannot_pass_without_reference_and_every_required_lane()
{
    var actual = new[] { LaneResult.Pass("mysql80") };
    var result = CertificationRunnerModel.Evaluate(
        CertificationMatrix.FullWithReferenceLaneIds, actual);
    Assert.False(result.Passed);
    Assert.Contains("missing", result.Reason,
        StringComparison.OrdinalIgnoreCase);
}

[Fact]
public void Quick_can_never_emit_database_certification()
{
    var result = CertificationRunnerModel.QuickPass();
    Assert.Equal("NOT_DATABASE_CERTIFIED", result.CertificationStatus);
    Assert.False(result.CanWriteAcceptanceManifest);
}

[Theory]
[InlineData(ManagedHandoffPoison.PreclearedTarget)]
[InlineData(ManagedHandoffPoison.TargetIdentityChanged)]
[InlineData(ManagedHandoffPoison.VendorStateDigestChanged)]
[InlineData(ManagedHandoffPoison.EmptyVendorEvidence)]
public void Full_rejects_invalid_vendor_to_managed_target_handoff(
    ManagedHandoffPoison poison)
{
    var actual = CertificationEvidenceSamples.FullWithManagedHandoffPoison(
        laneId: "oracle19c", poison);
    var result = CertificationRunnerModel.Evaluate(
        CertificationMatrix.FullWithReferenceLaneIds, actual);

    Assert.False(result.Passed);
    Assert.Contains("vendor target handoff", result.Reason,
        StringComparison.OrdinalIgnoreCase);
}
~~~

`CertificationEvidenceSamples` and `ManagedHandoffPoison` are private nested
test helpers in `CertificationRunnerTests.cs`. The real handoff proof records a
value-safe target-instance fingerprint plus the completed VendorSql logical
manifest digest and nonzero logical object/table counts. Immediately before
ManagedPayload calls `PreviewAdmin`, the component invokes the same frozen
`inspect-live` host against the same connection environment and requires the
target-instance fingerprint, full logical manifest digest, and counts to equal
the VendorSql proof and remain nonzero. Only then may it submit
`ReplaceTargetDatabase`. A script-side delete/clear, target switch, changed
vendor state, missing proof, or empty target fails before the admin call; the
script cannot manufacture the proof or query the database itself.

- [ ] **Step 2: Run the RED command**

~~~powershell
dotnet test ./Microi.Server/tests/Microi.DatabaseCertification.Tests/Microi.DatabaseCertification.Tests.csproj --filter FullyQualifiedName~CertificationRunnerTests --nologo
~~~

Expected: nonzero because runner model and orchestration scripts do not exist.

- [ ] **Step 3: Implement strict orchestration**

Quick runs parser/compiler/AST/component/unit tests against only the named
synthetic fixture, using the offline/no-restore commands frozen in Task 2, and
writes quick-report.json with NOT_DATABASE_CERTIFIED.

Full performs: strict preflight; one Release build of
`Microi.SeedConverter`; freeze the host DLL/dependency hashes for the run;
acquire global lease; download current official seed; generate dynamic source
evidence and exact-profile artifacts; MySQL 5.7 reference
start/import/`inspect-live`/compare/finally cleanup; then, serially for each six
target lanes, start, exact identity/capability and vendor-client check,
vendor-SQL restore/`inspect-live`/full compare while leaving the target
populated, then managed portable-payload restore with
`ReplaceTargetDatabase` on that same target/`inspect-live`/full compare from the
same ZIP, cross-path equality, ORM
contracts, API contracts, frontend at 1988, bundled-Chromium UI contract,
evidence hash, and finally stop API/frontend/database and assert zero database
lanes. Per-lane scripts execute only that frozen host and fail if its hash
changes.

Both target readbacks go through the public source-only Dos.ORM schema/row
diagnostic facade so Oracle/DM values are decoded by the storage contract before
the canonical logical digest is computed; certification scripts do not
reimplement the envelope. The vendor client and managed payload remain
independent restore paths, but both must report the same logical manifest and
the exact target physical-support digest. Tests explicitly compare NULL, empty,
space, leading U+E000, Unicode/emoji, JSON, indexed text and CLOB rows; raw
provider/native SQL output cannot satisfy this gate.

ReleaseFull performs the identical reference and Full sequence, temporarily generates exact-profile artifacts, and serially adds both restore paths for SQL Server 2017, Oracle 11.2.0.4, and PostgreSQL 14. During its first MySQL 5.7 reference lane it also runs ORM/API/UI, so all four minimum-version targets receive the same functional gate without starting MySQL twice.

Use a try/finally inside every lane and an outer finally for process/lease
cleanup. Stop at the first failed gate, but finish cleanup and preserve failure
artifacts. New-AcceptanceManifest refuses to write unless all expected lane IDs,
exact identities, both restore-path manifests from the same artifact digest,
the same-nonempty-target handoff proof, seed table evidence, test results, eight
screenshot hashes, browser version, network result, and cleanup proofs are
present and passed. Every target lane additionally requires its real
`TargetIdentityFingerprintTests` result, distinct primary/secondary safe hashes,
equal logical digest, and secondary-target cleanup proof. Oracle/DM lane entries
also require the exact
`TargetResetActivationTests` result and 12-event operation digest; Full requires
exact lane IDs `oracle19c` and `dm8`, and ReleaseFull also requires
`oracle11gr2`. Invoke-
MicroiDatabaseCertification.ps1 accepts -Gate All or -Gate SeedRestore; both
use this same lifecycle and manifest policy. It is the only formal serial entry
point.

- [ ] **Step 4: Run runner GREEN and Quick**

~~~powershell
dotnet test ./Microi.Server/tests/Microi.DatabaseCertification.Tests/Microi.DatabaseCertification.Tests.csproj --filter FullyQualifiedName~CertificationRunnerTests --nologo
pwsh -NoProfile -File ./Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-MicroiDatabaseCertification.ps1 -Mode Quick
~~~

Expected: exit 0; Quick says NOT_DATABASE_CERTIFIED and no acceptance-manifest.json exists.

- [ ] **Step 5: Run real Full and ReleaseFull**

~~~powershell
pwsh -NoProfile -File ./Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-MicroiDatabaseCertification.ps1 -Mode Full
pwsh -NoProfile -File ./Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-MicroiDatabaseCertification.ps1 -Mode ReleaseFull
~~~

Expected: each command exits 0 only when every required real lane passes. Missing licensed image, digest, source, or other infrastructure exits one of the documented nonzero codes, contains no Skip, writes no success manifest, and leaves zero labeled lane containers.

- [ ] **Step 6: Stage in the root repository**

~~~powershell
git -C . add -- Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-DatabaseLane.ps1 Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-MicroiDatabaseCertification.ps1 Microi.Server/tests/Microi.DatabaseCertification/scripts/New-AcceptanceManifest.ps1 Microi.Server/tests/Microi.DatabaseCertification.Tests/CertificationRunnerTests.cs
git -C . diff --cached --name-only
git -C . diff --cached --check
git -C . commit -m "test: automate strict multidatabase certification"
~~~

## Final Acceptance

Run from workspace root and do not combine database lanes:

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj -c Release --nologo
dotnet test ./Microi.Server/tests/Microi.DatabaseCertification.Tests/Microi.DatabaseCertification.Tests.csproj -c Release --nologo
dotnet build ./Microi.Server/Microi.net.sln -c Release --no-restore --nologo
dotnet build ./Microi.Server/Microi.net/Microi.net.csproj -c Release --nologo
dotnet build ./Microi.Server/Microi.AI/Microi.AI.csproj -c Release --nologo
npm --prefix ./Microi.Client ci
npm --prefix ./Microi.Client run build
pwsh -NoProfile -File ./Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-MicroiDatabaseCertification.ps1 -Mode Quick
pwsh -NoProfile -File ./Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-MicroiDatabaseCertification.ps1 -Mode Full
pwsh -NoProfile -File ./Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-MicroiDatabaseCertification.ps1 -Mode ReleaseFull
git -C . status --short --untracked-files=all
git -C ./Microi.Server/Microi.net status --short --untracked-files=all
git -C ./Microi.Server/Microi.AI status --short --untracked-files=all
~~~

Acceptance requires current-source MySQL 5.7 reference equivalence; vendor-client and managed-portable restores of the same exact ZIP on every target; complete per-table schema/count/digest equality among both paths and the reference; exact applicable identity fields (including separate SQL Server database compatibility level) and 30-scalar capability/profile equality; production driver/profile ordering; no skipped infrastructure; serial cleanup proof; API/UI CRUD; eight approved screenshots; bundled Chromium evidence; a clean network guard; and independent handling of the root and both private repositories.

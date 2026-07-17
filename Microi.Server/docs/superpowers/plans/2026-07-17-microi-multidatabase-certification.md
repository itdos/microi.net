# Microi Six-Database Certification and E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Provide one-command, strict, reproducible certification across six real databases, Microi.net.Api, Microi.Client, real iTdos UI login, CRUD, network guards, and screenshot comparison.

**Architecture:** Build once and run database lanes serially. Each lane starts an isolated real database, applies neutral AST schema and the minimum iTdos fixture, runs Dos.ORM and server contracts, starts API and frontend, performs Playwright UI login/CRUD/logout, records evidence, verifies database identity, and cleans up before the next lane.

**Tech Stack:** Docker Compose, PowerShell 7, xUnit, .NET 10, Playwright 1.59.1, Vue development server, existing Microi API.

## Global Constraints

- Full passes only when MySQL 8.0, SQL Server 2022, Oracle 19c, PostgreSQL 17, DM8, and KingbaseES V9 all pass with real identity fingerprints.
- ReleaseFull additionally runs MySQL 5.7, SQL Server 2017, Oracle 11g R2, and PostgreSQL 14.
- DM8 and KingbaseES require legal images or real test endpoints; missing sources fail instead of Skip.
- PostgreSQL cannot certify KingbaseES and Oracle cannot certify DM8.
- Credentials, licenses, tokens, connection strings, and runtime parameter values come only from environment/private local config and are redacted from evidence.
- Full never uses continue-on-error and never reports partial certification as success.
- Every lane performs database contracts, API smoke, real UI login, a cleanable FormEngine CRUD cycle, logout, network guards, and automatic screenshot comparison.
- One-time logs, screenshots, traces, videos, HAR, and reports go only under workspace .tmp.
- Formal reusable test source is tracked; Microi.Client/.microi-e2e remains untouched.

---

### Task 1: Define the certification matrix and strict preflight

**Files:**
- Create: Microi.Server/tests/Microi.DatabaseCertification/certification-matrix.json
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-CertificationPreflight.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification/README.md
- Create: Microi.Server/tests/Microi.DatabaseCertification.Tests/Microi.DatabaseCertification.Tests.csproj
- Create: Microi.Server/tests/Microi.DatabaseCertification.Tests/CertificationMatrixTests.cs
- Modify: Microi.Server/Microi.net.sln

**Interfaces:**
- Produces: validated lane definitions and exit codes 20 missing image, 21 license/source missing, 22 health failure, 23 identity/version mismatch.

- [ ] **Step 1: Write the tracked matrix without secrets**

~~~json
{
  "schemaVersion": 1,
  "full": [
    { "id": "mysql80", "databaseType": "MySql", "major": 8, "charset": "utf8mb4" },
    { "id": "sqlserver2022", "databaseType": "SqlServer", "major": 16 },
    { "id": "oracle19c", "databaseType": "Oracle", "major": 19, "charset": "AL32UTF8" },
    { "id": "postgres17", "databaseType": "PostgreSql", "major": 17, "charset": "UTF8" },
    { "id": "dm8", "databaseType": "DaMeng", "major": 8, "compatibilityMode": "Oracle" },
    { "id": "kingbase-v9", "databaseType": "KingBase", "major": 9, "compatibilityMode": "PostgreSql" }
  ],
  "releaseFullAdditional": [
    { "id": "mysql57", "databaseType": "MySql", "major": 5, "minor": 7 },
    { "id": "sqlserver2017", "databaseType": "SqlServer", "major": 14 },
    { "id": "oracle11gr2", "databaseType": "Oracle", "major": 11 },
    { "id": "postgres14", "databaseType": "PostgreSql", "major": 14 }
  ]
}
~~~

- [ ] **Step 2: Write failing matrix/preflight tests**

~~~csharp
[Fact]
public void Full_contains_six_unique_real_database_types()
{
    var matrix = CertificationMatrix.Load(TestPaths.Matrix);
    Assert.Equal(6, matrix.Full.Select(x => x.DatabaseType).Distinct().Count());
    Assert.Contains(matrix.Full, x => x.DatabaseType == DatabaseType.DaMeng);
    Assert.Contains(matrix.Full, x => x.DatabaseType == DatabaseType.KingBase);
}

[Fact]
public void Matrix_contains_no_secret_fields()
{
    var json = File.ReadAllText(TestPaths.Matrix);
    Assert.DoesNotMatch(
        "(?i)password|token|licenseKey|connectionString", json);
}
~~~

- [ ] **Step 3: Run and verify RED**

~~~powershell
dotnet test .\tests\Microi.DatabaseCertification.Tests\Microi.DatabaseCertification.Tests.csproj --filter FullyQualifiedName~CertificationMatrixTests --nologo
~~~

Expected: FAIL because loader and preflight do not exist.

- [ ] **Step 4: Implement preflight**

The script validates pwsh, dotnet, node, npm, Docker client/server, disk space, ports, matrix shape, pinned image references, required EULA flags, DM8/Kingbase source declarations, and output directories. It prints secret names and booleans only, never values.

~~~powershell
param([ValidateSet('Quick','Full','ReleaseFull')] [string]$Mode = 'Quick')
$ErrorActionPreference = 'Stop'
if ($Mode -ne 'Quick' -and -not (docker info 2>$null)) { exit 22 }
if ($Mode -ne 'Quick' -and -not $env:MICROI_TEST_DM8_IMAGE) { exit 20 }
if ($Mode -ne 'Quick' -and -not $env:MICROI_TEST_KINGBASE_IMAGE) { exit 20 }
~~~

- [ ] **Step 5: Run tests and commit**

~~~powershell
git add Microi.Server/tests/Microi.DatabaseCertification Microi.Server/tests/Microi.DatabaseCertification.Tests Microi.Server/Microi.net.sln
git commit -m "test: define strict database certification matrix"
~~~

### Task 2: Add isolated Compose lanes and identity probes

**Files:**
- Create: Microi.Server/tests/Microi.DatabaseCertification/compose/compose.certification.yml
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Wait-Database.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Get-DatabaseIdentity.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification.Tests/DatabaseIdentityTests.cs

**Interfaces:**
- Produces: one isolated compose project/network/volume per lane and a normalized identity JSON document.

- [ ] **Step 1: Write failing identity tests**

~~~csharp
[Theory]
[InlineData("PostgreSQL 17.2", "PostgreSql", 17)]
[InlineData("KingbaseES V009R001", "KingBase", 9)]
[InlineData("DM Database Server 64 V8", "DaMeng", 8)]
public void Identity_probe_distinguishes_vendor_and_major(
    string raw, string expectedVendor, int expectedMajor)
{
    var identity = DatabaseIdentityParser.Parse(raw);
    Assert.Equal(expectedVendor, identity.Vendor);
    Assert.Equal(expectedMajor, identity.Major);
}
~~~

- [ ] **Step 2: Run and verify RED**

Expected: parser and probe scripts are missing.

- [ ] **Step 3: Add Compose profiles**

Define MySQL, SQL Server, Oracle, PostgreSQL, DM8, KingbaseES, and shared Redis services with profile-specific health checks. Public image references are pinned by digest in private/local override environment; licensed image names are required environment variables. No password literal appears in YAML.

~~~yaml
services:
  dm8:
    profiles: [dm8]
    image: ${MICROI_TEST_DM8_IMAGE:?DM8 legal image is required}
    environment:
      DM_PASSWORD: ${MICROI_TEST_DB_PASSWORD:?database password is required}
  kingbase:
    profiles: [kingbase-v9]
    image: ${MICROI_TEST_KINGBASE_IMAGE:?Kingbase legal image is required}
    environment:
      KINGBASE_PASSWORD: ${MICROI_TEST_DB_PASSWORD:?database password is required}
~~~

- [ ] **Step 4: Verify vendor identity after health**

Wait-Database retries an actual provider connection with a bounded timeout. Get-DatabaseIdentity executes the platform identity probe, compares vendor, major, compatibility mode, charset, collation, and image digest to the matrix, and exits 23 on mismatch.

- [ ] **Step 5: Run tests and commit**

~~~powershell
git add Microi.Server/tests/Microi.DatabaseCertification Microi.Server/tests/Microi.DatabaseCertification.Tests
git commit -m "test: orchestrate real database certification lanes"
~~~

### Task 3: Add six-database Dos.ORM integration contracts

**Files:**
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Dos.ORM.IntegrationTests.csproj
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Fixtures/DatabaseMatrix.cs
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Fixtures/DatabaseFixture.cs
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Contracts/CrudContractTests.cs
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Contracts/IdentifierAndTypeContractTests.cs
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Contracts/PaginationContractTests.cs
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Contracts/UpsertBulkContractTests.cs
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Contracts/SchemaContractTests.cs
- Create: Microi.Server/tests/Dos.ORM.IntegrationTests/Contracts/TransactionLockContractTests.cs
- Modify: Microi.Server/Microi.net.sln

**Interfaces:**
- Consumes: lane-specific environment variables.
- Produces: identical semantic contracts on every real database.

- [ ] **Step 1: Write the first failing real CRUD contract**

~~~csharp
[Theory]
[MemberData(nameof(DatabaseMatrix.ActiveLane))]
public async Task Crud_round_trip_preserves_unicode_null_guid_boolean_and_time(
    DatabaseLane lane)
{
    await using var fixture = await DatabaseFixture.CreateAsync(lane);
    var id = Guid.NewGuid();
    await fixture.InsertContractRowAsync(id, "吾码", null, true);
    var row = await fixture.ReadContractRowAsync(id);
    Assert.Equal("吾码", row.DisplayName);
    Assert.Null(row.OptionalText);
    Assert.True(row.Enabled);
    await fixture.DeleteContractRowAsync(id);
    Assert.Null(await fixture.ReadContractRowAsync(id));
}
~~~

- [ ] **Step 2: Run and verify RED against one available lane**

~~~powershell
dotnet test .\tests\Dos.ORM.IntegrationTests\Dos.ORM.IntegrationTests.csproj --filter FullyQualifiedName~CrudContractTests --nologo
~~~

Expected: FAIL until the lane is running and fixture uses AST schema/DML.

- [ ] **Step 3: Implement the neutral fixture**

The fixture creates a unique schema/database through Dos.ORM Admin and Schema AST, exposes DbSession, and removes all objects in DisposeAsync. Add contracts for NULL, IN, LIKE, dates, Unicode, long text, BLOB, GUID, Boolean, reserved identifiers, stable paging, functions, concurrent Upsert, Bulk parameter splitting, transaction rollback, row locks, DDL, metadata, and diagnostics.

- [ ] **Step 4: Run the active lane contract**

Expected: every contract for the selected real lane passes without Skip.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/tests/Dos.ORM.IntegrationTests Microi.Server/Microi.net.sln
git commit -m "test: add real six-database ORM contracts"
~~~

### Task 4: Bootstrap the minimum iTdos tenant through neutral AST

**Files:**
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Fixtures/ITdosFixtureBuilder.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Fixtures/ITdosFixtureVerifier.cs
- Create: Microi.Server/tests/Microi.DatabaseCertification/fixtures/itdos.fixture.json
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Fixtures/ITdosFixtureTests.cs

**Interfaces:**
- Produces: tenant configuration, test administrator, role permissions, dynamic menu, and one disposable CRUD FormEngine table on an empty lane.

- [ ] **Step 1: Write failing fixture repeatability tests**

~~~csharp
[Fact]
public async Task ITdos_fixture_is_idempotent_and_login_ready()
{
    var first = await ITdosFixtureBuilder.ApplyAsync(TestLane.Current);
    var second = await ITdosFixtureBuilder.ApplyAsync(TestLane.Current);
    Assert.Equal(first.SchemaFingerprint, second.SchemaFingerprint);
    var state = await ITdosFixtureVerifier.ReadAsync(TestLane.Current);
    Assert.True(state.HasTenant);
    Assert.True(state.HasAdministrator);
    Assert.True(state.HasCrudMenu);
}
~~~

- [ ] **Step 2: Run and verify RED**

Expected: fixture builder does not exist.

- [ ] **Step 3: Implement AST-only bootstrap**

Read the login account/password only from environment, derive the password hash using the production password service, and create schema/data through MigrationPlan, InsertStatement, and UpsertStatement. Fixture JSON contains neutral table/field/menu labels and stable IDs but no password or executable SQL.

- [ ] **Step 4: Run twice and verify identical state**

Expected: both applications pass and login readiness is true.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/tests/Microi.Server.IntegrationTests/Fixtures Microi.Server/tests/Microi.DatabaseCertification/fixtures
git commit -m "test: bootstrap portable iTdos certification fixture"
~~~

### Task 5: Start the API per lane and run HTTP contracts

**Files:**
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Start-MicroiApi.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Stop-MicroiApi.ps1
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Fixtures/ApiProcessFixture.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Api/ApiSmokeTests.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Api/FormEngineApiContractTests.cs

**Interfaces:**
- Produces: a lane-bound https://127.0.0.1:7266 process and HTTP evidence.

- [ ] **Step 1: Write failing API smoke contracts**

~~~csharp
[Fact]
public async Task Login_and_FormEngine_return_valid_DosResult()
{
    await using var api = await ApiProcessFixture.StartAsync(TestLane.Current);
    var login = await api.LoginWithLocalCredentialsAsync();
    Assert.Equal(1, login.Code);
    Assert.True(login.HasToken);
    var rows = await api.GetCertificationRowsAsync(login.RedactedTokenHandle);
    Assert.Equal(1, rows.Code);
}
~~~

- [ ] **Step 2: Run and verify RED**

Expected: API fixture/start scripts do not exist.

- [ ] **Step 3: Implement lane-bound startup**

Start from Microi.Server/Microi.net.Api with the Microi.net.Api launch profile. Inject temporary environment variables for DatabaseType, connection, Redis, iTdos, and output paths; do not edit tracked appsettings. Capture stdout/stderr to .tmp, wait for 7266 and a real health request, and fail if the process exits.

- [ ] **Step 4: Run API contracts**

Expected: login, menu, list, pagination, add, update, readback, delete, and unauthenticated behavior all pass on the active lane.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/tests/Microi.DatabaseCertification/scripts Microi.Server/tests/Microi.Server.IntegrationTests
git commit -m "test: certify Microi API on each database lane"
~~~

### Task 6: Add real UI login, CRUD, network guard, and screenshot comparison

**Files:**
- Create: Microi.Client/playwright.multidb.config.mjs
- Create: Microi.Client/tests/e2e/multidb/fixtures/microi-test.mjs
- Create: Microi.Client/tests/e2e/multidb/support/network-guard.mjs
- Create: Microi.Client/tests/e2e/multidb/support/evidence-reporter.mjs
- Create: Microi.Client/tests/e2e/multidb/login-crud.spec.mjs
- Create: Microi.Client/tests/e2e/multidb/snapshots/.gitkeep
- Modify: Microi.Client/package.json

**Interfaces:**
- Consumes: FRONTEND, BACKEND, MICROI_OSCLIENT, PW_TEST_ACCOUNT, PW_TEST_PASSWORD, MICROI_DATABASE_LANE, MICROI_ACCEPTANCE_OUTPUT.
- Produces: UI assertions, snapshots, trace/video on failure, redacted network evidence.

- [ ] **Step 1: Write the failing real-login test**

~~~javascript
test('real iTdos login CRUD and logout', async ({ page }) => {
  const network = installNetworkGuard(page);
  await page.goto('/?OsClient=iTdos#/login?redirect=/');
  await page.locator('input[placeholder="请输入用户名"]')
    .fill(process.env.PW_TEST_ACCOUNT);
  await page.locator('input[placeholder="请输入密码"]')
    .fill(process.env.PW_TEST_PASSWORD);
  const loginResponse = page.waitForResponse(
    response => response.url().includes('/api/SysUser/Login'));
  await page.getByRole('button', { name: /登\s*录/ }).click();
  expect((await loginResponse).ok()).toBeTruthy();
  await expect(page).not.toHaveURL(/\/login/);
  await runCertificationCrud(page);
  await expect(page).toHaveScreenshot('workbench.png', {
    animations: 'disabled',
    mask: dynamicRegionLocators(page)
  });
  await logout(page);
  await expect(page).toHaveURL(/\/login/);
  network.assertClean();
});
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
npm --prefix ..\Microi.Client run test:e2e:multidb
~~~

Expected: FAIL because config, helpers, and script do not exist.

- [ ] **Step 3: Implement deterministic Playwright configuration**

Use viewport 1440x900, locale zh-CN, timezone Asia/Shanghai, reduced motion, a pinned system browser channel, trace/video on failure, screenshot comparison tolerance, and output directories under workspace .tmp. Network guard rejects requestfailed, unapproved 4xx/5xx, empty JSON, string null, unexpected Code=0, pageerror, TypeError, ReferenceError, and Vue recursive-update errors. Evidence reporter redacts authorization, cookie, token, password, and connection fields.

- [ ] **Step 4: Run against one healthy lane and inspect generated images**

Expected: login, workbench, list, edit/detail, and logout snapshots pass; failure artifacts are produced when an assertion is intentionally inverted, then the inversion is removed.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Client/playwright.multidb.config.mjs Microi.Client/tests/e2e/multidb Microi.Client/package.json
git commit -m "test: add multidatabase UI and visual certification"
~~~

### Task 7: Implement Quick, Full, and ReleaseFull orchestration and evidence manifest

**Files:**
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-DatabaseLane.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-MicroiDatabaseCertification.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification/scripts/New-AcceptanceManifest.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification.Tests/CertificationRunnerTests.cs

**Interfaces:**
- Produces: strict exit status and .tmp/reports/multidb/run-id/acceptance-manifest.json.

- [ ] **Step 1: Write failing runner-state tests**

~~~csharp
[Fact]
public void Full_fails_when_any_lane_is_missing_or_skipped()
{
    var result = CertificationRunnerModel.Evaluate(
        expected: CertificationMatrix.FullLaneIds,
        actual: new[] { LaneResult.Pass("mysql80") });
    Assert.False(result.Passed);
    Assert.Contains("missing", result.Reason, StringComparison.OrdinalIgnoreCase);
}
~~~

- [ ] **Step 2: Run and verify RED**

Expected: runner model and scripts do not exist.

- [ ] **Step 3: Implement serial orchestration**

Quick runs architecture, compiler, and component tests without databases. Full runs the six target lanes. ReleaseFull adds minimum-version lanes. Each lane: preflight, start DB/Redis, identity check, fixture, ORM tests, API tests, frontend, Playwright, cleanup, evidence hash. Stop immediately on failure while still running cleanup in finally.

~~~powershell
param([ValidateSet('Quick','Full','ReleaseFull')] [string]$Mode = 'Quick')
$ErrorActionPreference = 'Stop'
& $PSScriptRoot/Invoke-CertificationPreflight.ps1 -Mode $Mode
if ($Mode -eq 'Quick') { Invoke-QuickGate; exit $LASTEXITCODE }
foreach ($lane in Get-CertificationLanes -Mode $Mode) {
    Invoke-DatabaseLane -Lane $lane
}
New-AcceptanceManifest -Mode $Mode
~~~

- [ ] **Step 4: Verify the three entry points**

~~~powershell
pwsh -NoProfile -File .\tests\Microi.DatabaseCertification\scripts\Invoke-MicroiDatabaseCertification.ps1 -Mode Quick
pwsh -NoProfile -File .\tests\Microi.DatabaseCertification\scripts\Invoke-MicroiDatabaseCertification.ps1 -Mode Full
pwsh -NoProfile -File .\tests\Microi.DatabaseCertification\scripts\Invoke-MicroiDatabaseCertification.ps1 -Mode ReleaseFull
~~~

Expected: Quick passes locally after implementation. Full and ReleaseFull pass only when every required real lane is available; otherwise they fail with the documented nonzero code and never claim certification.

- [ ] **Step 5: Commit**

~~~powershell
git add Microi.Server/tests/Microi.DatabaseCertification Microi.Server/tests/Microi.DatabaseCertification.Tests
git commit -m "test: automate strict six-database certification"
~~~

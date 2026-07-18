# Microi Empty Seed Converter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Convert the continuously updated official MySQL 5.7
`microi_empty_temp.sql.zip` into deterministic, complete schema-and-data
artifacts for SQL Server 2022, Oracle 19c, PostgreSQL 17, DM8, and KingbaseES
V9, with all database semantics implemented inside Dos.ORM.

**Architecture:** A streaming MySQL 5.7 dump reader produces a value-safe
portable seed model and manifest. Dos.ORM normalizes charset/collation,
defaults, update behavior, physical names, prefix indexes, and streamed rows,
then six dialect-owned profile-aware writers emit ordered deterministic
artifacts (the default customer command still emits five non-MySQL targets).
Public CLI and
Microi hosts are thin source/request adapters; real restore certification is
strictly one database at a time.

**Tech Stack:** C# netstandard2.1 Dos.ORM, .NET 10 thin hosts, xUnit/property
tests, System.IO.Compression, SHA-256, PowerShell 7, real serial database lanes.

## Global Constraints

- All commands in this plan run from workspace root
  `D:\Work\microi.net.all`; project/script arguments start with
  `./Microi.Server/...`, root-repository Git pathspecs use
  `Microi.Server/...`, and private-repository pathspecs are relative to their
  explicit `git -C ./Microi.Server/{Microi.net|Microi.AI}` root.
- The authoritative default source is
  `https://static.itdos.com/install/microi_empty_temp.sql.zip`; an explicit
  local `.zip`/`.sql` override and offline content-addressed cache are supported.
- The audited 2026-07-18 source SHA fixture contains 133 tables, 2,403 columns,
  85 INSERT statements, and 16,083 rows. Those numbers belong only to that
  immutable SHA fixture/cache. For the continuously updated URL, expected
  counts and digests come from that run's manifest and become trusted only
  after an independent MySQL 5.7 reference import produces the same full
  schema/row digest. Every generated target artifact compares against that
  dynamic manifest (default customer generation emits five current non-MySQL
  targets, Full also emits MySQL 8, and ReleaseFull covers every exact certified
  profile); latest-source tests never hard-code the audited counts.
- Parsing is a streaming lexer/parser. Regex translation, line splitting,
  semicolon splitting, provider-script reuse, and loading the entire dump or
  all rows in memory are forbidden.
- The neutral seed and artifacts contain complete structure and data. A minimum
  login fixture, selected-table export, or schema-only package cannot satisfy
  this plan.
- Dynamic row values never enter compiler plan caches or logs. Large CLOB/BLOB
  values stream per table/batch and may exceed 3.54 MB per value.
- Unknown top-level SQL, object type, column type/modifier, default, collation,
  index form, trigger/event/view/routine, or malformed escape fails closed with
  a value-safe source offset/path diagnostic.
- Default generation does not connect, create, drop, or apply. Apply requires
  explicit target profile, artifact/source SHA, empty-target fingerprint, and
  authorization; replace import uses the reviewed preview/approval/source path.
- Output order, newline, UTF-8 encoding, ZIP entry order/time, physical names,
  manifests, and hashes are deterministic. Equal source bytes, compiler
  version, and target profile produce byte-identical ZIP bytes.
- The root repository and private `Microi.Server/Microi.net` repository are
  staged/committed independently. `Microi.Server/Microi.AI` is status/build
  verified independently even when this plan changes no AI file. Never use
  root `git add -f` for a private-repository path.
- The legacy plan's public baseline remains an exact subset gate. This plan's
  only additional public API is frozen in `SeedPublicApiDeltaAllowlist`; all
  parser/model/compiler/artifact types stay internal. The final public surface
  must equal `legacy baseline + managed execution delta + seed delta` exactly.

---

### Task 1: Securely acquire and stream-parse the MySQL 5.7 source

**Files:**
- Create: Microi.Server/Dos.ORM/SeedSources/DatabaseSeedSourceRequest.cs
- Create: Microi.Server/Dos.ORM/SeedSources/SecureSeedSourceReader.cs
- Create: Microi.Server/Dos.ORM/SeedSources/SecureSeedArchiveReader.cs
- Create: Microi.Server/Dos.ORM/SeedSources/MySql57DumpLexer.cs
- Create: Microi.Server/Dos.ORM/SeedSources/MySql57DumpReader.cs
- Create: Microi.Server/Dos.ORM/SeedSources/SeedSourceDiagnostic.cs
- Create: Microi.Server/Dos.ORM/SeedSources/DatabaseSeedSourceException.cs
- Create: Microi.Server/Dos.ORM.Tests/SeedSources/SecureSeedArchiveReaderTests.cs
- Create: Microi.Server/Dos.ORM.Tests/SeedSources/MySql57DumpReaderTests.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/SeedDumpSamples.cs

**Interfaces:**
- Produces: a forward-only token/statement stream with byte offset, structural
  path, and no raw-value diagnostic payload.
- Accepts: only the fixed official HTTPS URL, explicit local file, or verified
  offline cache entry; arbitrary remote URLs are rejected.
- The facade input is consistently named `mysql57SourcePackage`. The source
  reader magic-detects ZIP versus raw dump without trusting filename/extension:
  ZIP follows all archive gates; raw input must be bounded strict UTF-8 MySQL
  dump bytes. Unknown/truncated/polyglot magic fails before lexing.

- [ ] **Step 1: Write ZIP, lexer, and poison REDs**

~~~csharp
[Theory]
[MemberData(nameof(SeedDumpSamples.SemicolonAndEscapeCases),
    MemberType = typeof(SeedDumpSamples))]
public void String_content_never_splits_a_statement(byte[] utf8)
{
    var statements = MySql57DumpReader.Read(new MemoryStream(utf8));
    Assert.Single(statements.OfType<SeedInsertStatement>());
}

[Theory]
[InlineData(SeedArchivePoison.ParentTraversal)]
[InlineData(SeedArchivePoison.AbsolutePath)]
[InlineData(SeedArchivePoison.DuplicateEntry)]
[InlineData(SeedArchivePoison.ExcessiveRatio)]
[InlineData(SeedArchivePoison.InvalidUtf8)]
[InlineData(SeedArchivePoison.ShaMismatch)]
public void Unsafe_source_fails_before_parse(SeedArchivePoison poison)
{
    Assert.Throws<DatabaseSeedSourceException>(() =>
        SeedDumpSamples.OpenPoison(poison));
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~SecureSeedArchiveReaderTests|FullyQualifiedName~MySql57DumpReaderTests" --nologo
~~~

Expected: FAIL because source request, archive reader, lexer, and parser do not
exist.

- [ ] **Step 3: Implement bounded archive and lexical state machines**

The v1 archive accepts exactly one non-empty entry named
`microi_empty_temp.sql`; v2 additionally accepts exactly `manifest.json`.
The downloader enforces HTTPS, exact host/path, same-origin bounded redirects,
connect/read timeout, maximum wire bytes, content-addressed temp file + atomic
cache publish, and optional expected SHA before opening the ZIP.
Reject directories, absolute/parent paths, duplicate/case-colliding entries,
links, excessive entry count, compressed/uncompressed bytes, compression
ratio, total expansion, invalid UTF-8, and digest mismatch. Limits are named,
positive options and are tested at exact boundaries.

The lexer handles ordinary text, single/double/backtick quotes, MySQL
backslash escapes, doubled quotes, line/block comments, CRLF/LF, embedded
physical newlines, and semicolons without rereading bytes. The parser accepts
the audited envelope (`SET`, `DROP TABLE IF EXISTS`, `CREATE TABLE`, explicit-
column `INSERT ... VALUES`) and fails closed on every unrecognized top-level
form. Diagnostics expose category/offset/path/digest only, never token text or
row values.

`DatabaseSeedSourceException` is initially an `internal sealed`
`InvalidDataException` with an internal constructor and exact get-only
properties `Code:string`,
`ByteOffset:long`, `StructuralPath:string`, and
`SourceDigest:ResourceContentDigest`. It defensively copies/validates only
value-safe category/path/digest data; Message is fixed-format, `Data` is empty,
and no raw token, entry content/name beyond the allowlisted structural path,
row value, URL query, local path, SQL, inner exception, or source stream is
retained. Friend tests freeze this internal surface. Task 5 changes only its
accessibility to public in the same commit that creates and enforces
`SeedPublicApiDeltaAllowlist`; Tasks 1-4 therefore leave the already-frozen
managed-execution public surface unchanged and their full regressions remain
green.
Every other Task 1 type, including `DatabaseSeedSourceRequest`, reader, lexer,
parser, and diagnostics, is internal; hosts supply a stream through the Task 5
facade and cannot select arbitrary remote URLs through Dos.ORM.

- [ ] **Step 4: Run focused/full regression and commit root repository**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --nologo
git -C . status --short --untracked-files=all
git -C . add -- Microi.Server/Dos.ORM/SeedSources/DatabaseSeedSourceRequest.cs Microi.Server/Dos.ORM/SeedSources/SecureSeedSourceReader.cs Microi.Server/Dos.ORM/SeedSources/SecureSeedArchiveReader.cs Microi.Server/Dos.ORM/SeedSources/MySql57DumpLexer.cs Microi.Server/Dos.ORM/SeedSources/MySql57DumpReader.cs Microi.Server/Dos.ORM/SeedSources/SeedSourceDiagnostic.cs Microi.Server/Dos.ORM/SeedSources/DatabaseSeedSourceException.cs Microi.Server/Dos.ORM.Tests/SeedSources/SecureSeedArchiveReaderTests.cs Microi.Server/Dos.ORM.Tests/SeedSources/MySql57DumpReaderTests.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/SeedDumpSamples.cs
git -C . diff --cached --name-only
git -C . diff --cached --check
git -C . commit -m "feat: parse Microi MySQL seed safely"
~~~

### Task 2: Add the internal neutral streaming seed model

**Files:**
- Create: Microi.Server/Dos.ORM/SeedModel/PortableDatabaseSeed.cs
- Create: Microi.Server/Dos.ORM/SeedModel/PortableTableSeed.cs
- Create: Microi.Server/Dos.ORM/SeedModel/ISeedRowReader.cs
- Create: Microi.Server/Dos.ORM/SeedModel/SeedValue.cs
- Create: Microi.Server/Dos.ORM/SeedModel/SeedCollation.cs
- Create: Microi.Server/Dos.ORM/SeedModel/DatabaseSeedManifest.cs
- Create: Microi.Server/Dos.ORM/SeedModel/SeedManifestWireEncoder.cs
- Create: Microi.Server/Dos.ORM/SeedModel/CanonicalSeedRowDigest.cs
- Create: Microi.Server/Dos.ORM/SeedModel/SeedRowExternalSorter.cs
- Create: Microi.Server/Dos.ORM.Tests/SeedModel/PortableDatabaseSeedTests.cs
- Create: Microi.Server/Dos.ORM.Tests/SeedModel/SeedManifestTests.cs
- Create: Microi.Server/Dos.ORM.Tests/SeedModel/CanonicalSeedRowDigestTests.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/SeedAuditFixture.cs

**Interfaces:**
- Consumes: `SchemaCollation`, `ColumnUpdateBehavior`, and prefix-length schema
  semantics already added with normalizer/validator/traversal/fingerprint/
  93-node/golden coverage in six-dialect Task 7 **before** the legacy baseline.
- Produces: internal immutable schema metadata plus reopenable/forward-only
  per-table row readers, canonical physical-name intent, and per-table digests.
  It does not modify the public AST or add a 94th node.

- [ ] **Step 1: Write schema-semantics and streaming REDs**

~~~csharp
[Fact]
public void Seed_model_preserves_collation_on_update_and_prefix_index()
{
    var seed = SeedSamples.CollationOnUpdateAndPrefixIndex();
    Assert.Equal("utf8mb4_unicode_ci",
        seed.Tables[0].Columns[0].Collation.SourceName);
    Assert.Equal(ColumnUpdateBehavior.CurrentDateTime,
        seed.Tables[0].Columns[1].UpdateBehavior);
    Assert.Equal(191, seed.Tables[0].Indexes[0].Columns[0].PrefixLength);
}

[Fact]
public void Row_reader_never_materializes_all_rows()
{
    var source = new PoisonAfterCurrentRowSeedReader(
        SeedAuditFixture.TotalRowCount);
    var manifest = SeedCanonicalizer.Compute(source);
    Assert.Equal(SeedAuditFixture.TotalRowCount,
        manifest.TotalRowCount);
    Assert.Equal(1, source.MaximumSimultaneousRows);
}

[Fact]
public void No_primary_key_digest_preserves_duplicates_and_is_order_independent()
{
    var rows = SeedRows.NoPrimaryKeyWithDuplicateAndLargeLob();
    var forward = SeedCanonicalizer.ComputeRows(rows);
    var permuted = SeedCanonicalizer.ComputeRows(rows.Reverse());

    Assert.Equal(rows.Count, forward.RowCount);
    Assert.Equal(forward.Digest, permuted.Digest);
    Assert.NotEqual(forward.Digest,
        SeedCanonicalizer.ComputeRows(rows.DistinctCanonicalRows()).Digest);
}

[Fact]
public void Canonical_wire_keeps_null_and_empty_distinct()
{
    var nullWire = CanonicalSeedRowDigest.Encode(
        SeedValue.Null(LogicalDbType.String));
    var emptyWire = CanonicalSeedRowDigest.Encode(
        SeedValue.Text(string.Empty));

    Assert.NotEqual(nullWire, emptyWire);
    Assert.Equal("DISTINCT_NULL_EMPTY_V1",
        SeedSamples.NullAndEmpty().Manifest.LogicalTextSemanticsId);
}
~~~

- [ ] **Step 2: Run and verify RED**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~PortableDatabaseSeedTests|FullyQualifiedName~SeedManifestTests|FullyQualifiedName~CanonicalSeedRowDigestTests" --nologo
~~~

Expected: missing internal neutral seed contracts fail; the pre-existing
`SchemaCompatibilitySemanticsTests` from six-dialect Task 7 remain green.

- [ ] **Step 3: Implement immutable, value-safe semantics**

Normalize MySQL integer display widths away; preserve Unicode character
length, decimal precision/scale, Boolean bit literals, NULL/string/current-time
defaults, Blob/Clob, effective inherited charset/collation, comments, PK/UK/FK,
and prefix indexes by mapping into the already frozen AST semantics. All
SeedModel types are internal. The model retains source byte ranges/digests, not
a full SQL string. The audited SHA fixture may record its current
PK/composite-PK statistics, but a future latest package is not required to give
every table a primary key.

Canonical row digest encodes every value as a typed, null-aware,
length-prefixed wire in schema-column ordinal. For a PK table, canonical order
is the typed PK wire (full row wire is the deterministic tie-break and duplicate
PK fails validation). For a table without a PK, Dos.ORM sorts by row SHA-256 and
then the complete row wire as a collision-safe tie-break, preserving duplicate
multiplicity. `SeedRowExternalSorter` uses bounded chunks, private spill files,
streamed merge, atomic failure cleanup, and bounded per-value LOB handling; it
never loads all rows/LOBs into memory. Source/reference/target readers may return
any order and must not rely on database natural order or `ORDER BY` over LOBs.
MySQL reference diagnostics and every target diagnostic apply this same wire and
ordering definition to independently read rows. Tests cover no-PK duplicates,
permuted input order, injected hash collisions, empty/NULL differences,
composite PKs, and multi-megabyte LOBs.

The portable model and row wire always contain logical values, never the
Oracle/DM physical envelope. `DatabaseSeedManifest` freezes
`LogicalTextSemanticsId=DISTINCT_NULL_EMPTY_V1`; NULL and empty have different
type-tagged wire bytes and digests. Target storage contract ID/fingerprint and
physical-support digest are separate Task 4 artifact fields and never replace
the logical row digest.

- [ ] **Step 4: Verify and commit**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~PortableDatabaseSeedTests|FullyQualifiedName~SeedManifestTests|FullyQualifiedName~CanonicalSeedRowDigestTests|FullyQualifiedName~SchemaCompatibilitySemanticsTests" --nologo
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --nologo
dotnet build ./Microi.Server/Dos.ORM/Dos.ORM.csproj -c Release --nologo
git -C . status --short --untracked-files=all
git -C . add -- Microi.Server/Dos.ORM/SeedModel/PortableDatabaseSeed.cs Microi.Server/Dos.ORM/SeedModel/PortableTableSeed.cs Microi.Server/Dos.ORM/SeedModel/ISeedRowReader.cs Microi.Server/Dos.ORM/SeedModel/SeedValue.cs Microi.Server/Dos.ORM/SeedModel/SeedCollation.cs Microi.Server/Dos.ORM/SeedModel/DatabaseSeedManifest.cs Microi.Server/Dos.ORM/SeedModel/SeedManifestWireEncoder.cs Microi.Server/Dos.ORM/SeedModel/CanonicalSeedRowDigest.cs Microi.Server/Dos.ORM/SeedModel/SeedRowExternalSorter.cs Microi.Server/Dos.ORM.Tests/SeedModel/PortableDatabaseSeedTests.cs Microi.Server/Dos.ORM.Tests/SeedModel/SeedManifestTests.cs Microi.Server/Dos.ORM.Tests/SeedModel/CanonicalSeedRowDigestTests.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/SeedAuditFixture.cs
git -C . diff --cached --name-only
git -C . diff --cached --check
git -C . commit -m "feat: model portable database seeds"
~~~

### Task 3: Normalize the complete current package and build its manifest

**Files:**
- Create: Microi.Server/Dos.ORM/SeedNormalization/MySql57SeedNormalizer.cs
- Create: Microi.Server/Dos.ORM/SeedNormalization/SeedPhysicalNamePolicy.cs
- Create: Microi.Server/Dos.ORM/SeedNormalization/SeedCanonicalizer.cs
- Create: Microi.Server/Dos.ORM/SeedValidation/DatabaseSeedValidator.cs
- Create: Microi.Server/Dos.ORM.Tests/SeedNormalization/OfficialSeedContractTests.cs
- Create: Microi.Server/Dos.ORM.Tests/SeedNormalization/SeedDeterminismTests.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/OfficialSeedSource.cs

**Interfaces:**
- Consumes: caller-supplied official-package bytes through the Task 1 bounded
  reader. Live latest-URL acquisition belongs only to certification Full/
  ReleaseFull and the production CLI host, never this ordinary unit-test layer.
- Produces: one closed `PortableDatabaseSeed` and source manifest whose counts,
  table digests, and diagnostics contain no business values.

- [ ] **Step 1: Write offline official-format and dynamic-manifest REDs**

~~~csharp
[Fact]
public void Audited_official_seed_is_complete_closed_and_deterministic()
{
    var source = OfficialSeedSource.OpenAuditedContentAddressedPackage();
    var first = OfficialSeedSource.ParseNormalize(source.OpenFresh());
    var second = OfficialSeedSource.ParseNormalize(source.OpenFresh());
    Assert.True(first.Manifest.TableCount > 0);
    Assert.True(first.Manifest.ColumnCount >= first.Manifest.TableCount);
    Assert.True(first.Manifest.TotalRowCount > 0);
    Assert.Equal(first.Manifest.CanonicalBytes,
        second.Manifest.CanonicalBytes);
    Assert.Empty(first.Manifest.UnsupportedDiagnostics);

    SeedAuditFixture.AssertExactHistoricalManifest(first.Manifest);
    Assert.Equal(0, source.LiveNetworkCalls);
}
~~~

This ordinary test never accesses the network. Additional generated
future-shaped packages prove counts are derived from their own manifest and do
not inherit 133/2403/16083. The live latest-source contract belongs only to the
certification Full/ReleaseFull runner: it must download the fixed official URL,
record the observed digest, forbid fixture substitution, and fail
BLOCKED/nonzero (never Skip/PASS) if unavailable. Its parsed manifest remains a
candidate until Task 7 restores those exact bytes into the MySQL 5.7 reference
lane and proves independent full schema/row digests; only then may target
artifacts be published/certified. Historical counts remain exclusive to the
pinned audited-SHA fixture.

- [ ] **Step 2: Implement canonicalization and fail-closed validation**

Resolve inherited collations, validate every INSERT column/row arity, all
references, types, defaults, key lengths, and unsupported catalog entries.
Deterministically shorten physical index/constraint/helper names using target
profile length/scope/case plus a collision-resistant digest suffix. Manifest
records source ZIP/SQL SHA and sizes, source MySQL 5.7 four-part profile,
default charset/collation, parser/compiler versions, object/row counts, per-
table schema/row digests, transformations, and value-safe diagnostics.

- [ ] **Step 3: Prove determinism and bounded memory**

Run the audited 22.9 MB fixture, generated future-shaped PK/no-PK packages of
arbitrary bounded size, and an amplified fixture. Assert equal manifest bytes
for repeated identical bytes and input-order permutations, stable canonical
PK/no-PK order, maximum retained rows/batches/spill chunks below the tested
bound, private-temp cleanup, and no diagnostic contains sentinel row values.

- [ ] **Step 4: Verify and commit root repository**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~OfficialSeedContractTests|FullyQualifiedName~SeedDeterminismTests" --nologo
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --nologo
dotnet build ./Microi.Server/Dos.ORM/Dos.ORM.csproj -c Release --nologo
git -C . status --short --untracked-files=all
git -C . add -- Microi.Server/Dos.ORM/SeedNormalization/MySql57SeedNormalizer.cs Microi.Server/Dos.ORM/SeedNormalization/SeedPhysicalNamePolicy.cs Microi.Server/Dos.ORM/SeedNormalization/SeedCanonicalizer.cs Microi.Server/Dos.ORM/SeedValidation/DatabaseSeedValidator.cs Microi.Server/Dos.ORM.Tests/SeedNormalization/OfficialSeedContractTests.cs Microi.Server/Dos.ORM.Tests/SeedNormalization/SeedDeterminismTests.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/OfficialSeedSource.cs
git -C . diff --cached --name-only
git -C . diff --cached --check
git -C . commit -m "feat: normalize complete Microi seed"
~~~

### Task 4: Compile every certified target profile (default five artifacts)

**Files:**
- Create: Microi.Server/Dos.ORM/SeedCompilation/IDatabaseSeedCompiler.cs
- Create: Microi.Server/Dos.ORM/SeedCompilation/DatabaseSeedCompilerCatalog.cs
- Create: Microi.Server/Dos.ORM/SeedCompilation/DatabaseSeedArtifact.cs
- Create: Microi.Server/Dos.ORM/SeedCompilation/DatabaseSeedArtifactWriter.cs
- Create: Microi.Server/Dos.ORM/SeedCompilation/DeterministicSeedArchiveWriter.cs
- Create: Microi.Server/Dos.ORM/SeedCompilation/PortableSeedPayloadWriter.cs
- Create: Microi.Server/Dos.ORM/SeedCompilation/VendorSeedSqlWriter.cs
- Create: Microi.Server/Dos.ORM/SeedCompilation/SecureSeedArtifactReader.cs
- Create: Microi.Server/Dos.ORM/SeedCompilation/PortableSeedImportCoordinator.cs
- Modify: Microi.Server/Dos.ORM/SeedModel/DatabaseSeedManifest.cs
- Modify: Microi.Server/Dos.ORM/SeedModel/SeedManifestWireEncoder.cs
- Modify: Microi.Server/Dos.ORM/SqlCompilation/DatabaseResourcePipeline.cs
- Modify: Microi.Server/Dos.ORM/SqlCompilation/SqlExecutionCoordinator.cs
- Create: Microi.Server/Dos.ORM/Dialects/MySql/MySqlSeedCompiler.cs
- Create: Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerSeedCompiler.cs
- Create: Microi.Server/Dos.ORM/Dialects/Oracle/OracleSeedCompiler.cs
- Create: Microi.Server/Dos.ORM/Dialects/PostgreSql/PostgreSqlSeedCompiler.cs
- Create: Microi.Server/Dos.ORM/Dialects/Dm8/Dm8SeedCompiler.cs
- Create: Microi.Server/Dos.ORM/Dialects/KingbaseEs/KingbaseEsSeedCompiler.cs
- Create: Microi.Server/Dos.ORM.Tests/SeedCompilation/SeedCompilerContractTests.cs
- Create: Microi.Server/Dos.ORM.Tests/SeedCompilation/LargeValueCompilationTests.cs
- Create: Microi.Server/Dos.ORM.Tests/SeedCompilation/ArtifactDeterminismTests.cs
- Create: Microi.Server/Dos.ORM.Tests/SeedCompilation/SeedArtifactSecurityTests.cs
- Create: Microi.Server/Dos.ORM.Tests/SeedCompilation/ManagedSeedImportPipelineTests.cs
- Create: Microi.Server/Dos.ORM.Tests/SeedCompilation/LogicalTextSeedArtifactTests.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/SeedTargetProfiles.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/SeedCompilerHarness.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/ArtifactAssert.cs

**Interfaces:**
- Produces a target ZIP for every supported exact target profile: MySQL 8,
  SQL Server 2017/2022, Oracle 11g/19c, PostgreSQL 14/17, DM8, and KingbaseES.
  MySQL 5.7 remains the source/reference lane and is not regenerated. The
  default customer `generate` command emits exactly five current non-MySQL
  targets (SQL Server 2022, Oracle 19c, PostgreSQL 17, DM8, KingbaseES) using
  exact four-part versions, never capability-floor test profiles, while
  `--profile` and ReleaseFull generate other explicitly requested exact
  profiles. Each ZIP contains `manifest.json`,
  `checksums.sha256`, a canonical `portable-seed.bin` typed payload, and ordered
  vendor SQL files for customer offline restore. File enumeration order is
  never execution order; manifest ordinals are authoritative. The bundle is
  `DatabaseTransferFormat.ProviderNative`; it is not PortableJson.

- [ ] **Step 1: Write all-profile completeness and default-five REDs**

~~~csharp
[Theory]
[MemberData(nameof(SeedTargetProfiles.AllCertifiedTargets),
    MemberType = typeof(SeedTargetProfiles))]
public void Target_artifact_contains_complete_schema_and_data(
    DialectProfile target)
{
    var source = SeedCompilerHarness.CurrentSourceCandidate();
    var artifact = SeedCompilerHarness.Compile(source, target);
    Assert.Equal(source.Manifest.TableCount,
        artifact.Manifest.TableCount);
    Assert.Equal(source.Manifest.ColumnCount,
        artifact.Manifest.ColumnCount);
    Assert.Equal(source.Manifest.TotalRowCount,
        artifact.Manifest.TotalRowCount);
    Assert.Equal(source.Manifest.SchemaDigest,
        artifact.Manifest.SourceSchemaDigest);
    Assert.Equal(source.Manifest.RowDigest,
        artifact.Manifest.SourceRowDigest);
    Assert.Equal(target.Fingerprint,
        artifact.Manifest.TargetProfileFingerprint);
    Assert.Equal(DatabaseTransferFormat.ProviderNative,
        artifact.Manifest.TransferFormat);
    Assert.Equal(
        target.DatabaseType == DatabaseType.Oracle ||
        target.DatabaseType == DatabaseType.DaMeng
            ? "NON_EMPTY_ENVELOPE_U_E000_V1"
            : "NATIVE_V1",
        artifact.Manifest.TargetStorageContractId);
    Assert.False(string.IsNullOrWhiteSpace(
        artifact.Manifest.PhysicalSupportDigest));
    ArtifactAssert.HasPortablePayloadAndOfflineVendorSql(artifact);
    ArtifactAssert.AllFilesHaveHashesAndOrderedRoles(artifact);
}

[Fact]
public void Default_generation_is_exactly_five_current_non_mysql_targets()
{
    var targets = SeedTargetProfiles.DefaultCustomerTargets;
    Assert.Equal(new[]
    {
        DatabaseType.SqlServer, DatabaseType.Oracle,
        DatabaseType.PostgreSql, DatabaseType.DaMeng,
        DatabaseType.KingBase
    }, targets.Select(x => x.DatabaseType));
    Assert.Equal(new[]
    {
        new Version(16, 0, 4205, 1), new Version(19, 3, 0, 0),
        new Version(17, 6, 0, 0), new Version(8, 1, 3, 140),
        new Version(9, 4, 12, 0)
    }, targets.Select(x => x.ServerVersion));
    Assert.Equal(new[] { "", "", "", "Oracle", "PostgreSQL" },
        targets.Select(x => x.CompatibilityMode));
}
~~~

These are current exact customer-output defaults, distinct from the
capability-floor `TestProfiles` used by compiler unit tests. Task 5 checks the
same values into `seed-targets.json`; `--targets-file`/`--profile` can replace
them with any other exact supported customer versions. Certification never
assumes these defaults match a running commercial image: it generates each
lane from that run's immutable `resolved-matrix.json`, including the exact
`MICROI_CERT_KINGBASE_VERSION`, and exact-profile restore rejects any mismatch.

- [ ] **Step 2: Implement dialect-owned writers**

All identifier/type/default/collation/comment/on-update/prefix-index/foreign-key
behavior stays in each target compiler. SQL Server uses nvarchar(max) chunks,
persisted computed prefix helpers, and extended properties; Oracle uses
CLOB/BLOB-safe chunks/binds, functions/virtual columns, and COMMENT ON;
PostgreSQL uses collision-safe digest-derived dollar tags and expression
indexes; DM8 and KingbaseES have separate compilers/goldens and never inherit
certification from Oracle/PostgreSQL. Batch limits include rows, parameters,
SQL bytes, and a single-large-value path.
MySQL has its own profile-aware writer for the certified MySQL 8 target; every
writer accepts only its six-dialect capability-factory bands and validates the
exact four-part profile/mode before opening/writing the destination. MySQL 5.7,
unsupported bands, source profile, null profile, and wrong mode fail before the
first destination byte.

The portable payload and vendor SQL are two encodings of the same internal
typed seed and share per-table digests. Vendor SQL is a customer deliverable
only: static tests reject unsafe/unordered/truncated output and Task 7 restores
it in an isolated offline-verification sublane, but DbSession never passes it
to `NativeSqlText` or executes it. Managed `DatabaseImportOperation` verifies
the outer artifact/profile/content/manifest hashes, reads only
`portable-seed.bin`, rebuilds SchemaOperation + parameterized Insert/Upsert AST,
and executes through the ordinary compiler/driver path.

For Oracle and DM8 Oracle mode, both artifact paths are owned by the Dos.ORM
storage contract—no converter-local replacement exists. On a proven empty
target, vendor SQL first creates `DOSORM_STORAGE_CONTRACT` in `PendingImport`
state, creates the complete business schema, performs dialect-native metadata
assertions, writes the exact column rows, compare-and-swap activates the header,
and rechecks the active fingerprint before its first data DML. It expands
physical text types and encodes every non-NULL text/default/JSON/CLOB value
through `LogicalTextEnvelopeCodec` only after activation.
The script embeds only the cycle-free `ImportBindingFingerprint` derived from
source-content/profile/schema/contract/compiler identity; it never embeds its
own final ZIP, manifest, or vendor-entry digest. The managed ticket additionally
binds the verified outer ZIP digest in memory, outside deterministic SQL bytes.

`portable-seed.bin` keeps the original logical NULL/empty/text values. Managed
import performs the same source-bound state machine through
`PortableSeedImportCoordinator`: pending header, schema-only AST, fresh
`SchemaToken`, complete column catalog, guarded activation, active re-read, then
parameterized data AST whose ordinary binder encodes each value. A failed
vendor or managed transition remains pending and cannot emit an acceptance
manifest; managed retry requires the same verified artifact/state binding or a
fresh elevated `ReplaceTargetDatabase` restart.
The target manifest records logical schema/row digests separately from exact
storage-contract ID/fingerprint and physical-support digest. Native targets
record `NATIVE_V1`; their nonempty support digest is the deterministic
profile-plus-schema policy digest and neither artifact path creates a reserved
support table. A vendor/managed contract or support-digest mismatch fails
before publication/certification.

`LogicalTextSeedArtifactTests` cover NULL, empty, space, Chinese, emoji, leading
U+E000, maximum indexed text, JSON and multi-megabyte CLOB; inspect both artifact
paths; reject a missing/duplicate/corrupt support row or unmarked Oracle/DM
physical value; and prove the portable payload contains no physical marker.
They also mutate every pending/schema/catalog/activation/data boundary and prove
the first data statement follows a successful active re-read. Vendor SQL is
never sent through NativeSqlText, while managed import performs zero vendor-entry
reads.

This task owns that managed execution connection point, not a later platform
task. `DatabaseResourcePipeline` opens and outer-digest-checks the resource,
then delegates archive/hash/profile validation and payload decoding to
`SecureSeedArtifactReader`. It passes the internal typed stream to
`PortableSeedImportCoordinator`, which emits ordered neutral schema migrations
and bounded parameterized DML batches. `SqlExecutionCoordinator` compiles every
batch against the already detected exact live profile and materializes it
through the normal driver ticket; it never executes vendor SQL or creates a
second provider path. Required atomicity is preserved only where the target
capabilities prove it, failure closes/disposes every stream and transaction,
and no command starts until the full artifact and target-profile gates pass.
`ManagedSeedImportPipelineTests` freezes success, profile/digest/truncation
failure before command creation, pending-to-schema-to-active-to-data ordering,
same-artifact resume, foreign pending-state rejection, batching, rollback, and
vendor-entry-read count zero. Therefore Task 5/6 can call the existing
`PreviewAdmin`/`ExecuteAdmin` facade without waiting for platform Task 9.

- [ ] **Step 3: Prove ZIP and manifest determinism**

Use UTF-8 without BOM, one frozen newline convention, fixed ZIP timestamps,
stable compression, sorted archive entries, manifest execution ordinals, and
SHA-256 for every file and artifact. Compile twice in separate directories and
assert byte-for-byte equality. Mutating source digest, target profile, compiler
version, collation, on-update, or prefix length must change the artifact digest.
`manifest.json` records digests only for payload/vendor entries (including
`portable-seed.bin` and every ordered vendor SQL entry); it explicitly excludes
`manifest.json`, `checksums.sha256`, and the final ZIP digest. After canonical
manifest bytes are frozen, `checksums.sha256` covers every archive entry
**except itself**, therefore including `manifest.json`, in ordinal path order.
It never records its own digest. The returned
`ResourceContentDigest` is computed over the final closed ZIP bytes and is the
outer digest placed on `DatabaseResourceHandle`; tests prove this graph has no
hash cycle.
`SecureSeedArtifactReader` independently re-applies path traversal,
absolute/link/duplicate/case-collision, entry count/size/ratio/total expansion,
manifest canonical encoding, undeclared/missing entry, checksum, target profile,
portable-payload/vendor-SQL cross-digest, and truncation gates. Every poison
case fails before payload parsing or database connection and reports no bytes.

- [ ] **Step 4: Verify and commit**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter "FullyQualifiedName~SeedCompilerContractTests|FullyQualifiedName~LargeValueCompilationTests|FullyQualifiedName~ArtifactDeterminismTests|FullyQualifiedName~SeedArtifactSecurityTests|FullyQualifiedName~ManagedSeedImportPipelineTests|FullyQualifiedName~LogicalTextSeedArtifactTests" --nologo
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --nologo
dotnet build ./Microi.Server/Dos.ORM/Dos.ORM.csproj -c Debug --nologo
dotnet build ./Microi.Server/Dos.ORM/Dos.ORM.csproj -c Release --nologo
git -C . status --short --untracked-files=all
git -C . add -- Microi.Server/Dos.ORM/SeedCompilation/IDatabaseSeedCompiler.cs Microi.Server/Dos.ORM/SeedCompilation/DatabaseSeedCompilerCatalog.cs Microi.Server/Dos.ORM/SeedCompilation/DatabaseSeedArtifact.cs Microi.Server/Dos.ORM/SeedCompilation/DatabaseSeedArtifactWriter.cs Microi.Server/Dos.ORM/SeedCompilation/DeterministicSeedArchiveWriter.cs Microi.Server/Dos.ORM/SeedCompilation/PortableSeedPayloadWriter.cs Microi.Server/Dos.ORM/SeedCompilation/VendorSeedSqlWriter.cs Microi.Server/Dos.ORM/SeedCompilation/SecureSeedArtifactReader.cs Microi.Server/Dos.ORM/SeedCompilation/PortableSeedImportCoordinator.cs Microi.Server/Dos.ORM/SeedModel/DatabaseSeedManifest.cs Microi.Server/Dos.ORM/SeedModel/SeedManifestWireEncoder.cs Microi.Server/Dos.ORM/SqlCompilation/DatabaseResourcePipeline.cs Microi.Server/Dos.ORM/SqlCompilation/SqlExecutionCoordinator.cs Microi.Server/Dos.ORM/Dialects/MySql/MySqlSeedCompiler.cs Microi.Server/Dos.ORM/Dialects/SqlServer/SqlServerSeedCompiler.cs Microi.Server/Dos.ORM/Dialects/Oracle/OracleSeedCompiler.cs Microi.Server/Dos.ORM/Dialects/PostgreSql/PostgreSqlSeedCompiler.cs Microi.Server/Dos.ORM/Dialects/Dm8/Dm8SeedCompiler.cs Microi.Server/Dos.ORM/Dialects/KingbaseEs/KingbaseEsSeedCompiler.cs Microi.Server/Dos.ORM.Tests/SeedCompilation/SeedCompilerContractTests.cs Microi.Server/Dos.ORM.Tests/SeedCompilation/LargeValueCompilationTests.cs Microi.Server/Dos.ORM.Tests/SeedCompilation/ArtifactDeterminismTests.cs Microi.Server/Dos.ORM.Tests/SeedCompilation/SeedArtifactSecurityTests.cs Microi.Server/Dos.ORM.Tests/SeedCompilation/ManagedSeedImportPipelineTests.cs Microi.Server/Dos.ORM.Tests/SeedCompilation/LogicalTextSeedArtifactTests.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/SeedTargetProfiles.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/SeedCompilerHarness.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/ArtifactAssert.cs
git -C . diff --cached --name-only
git -C . diff --cached --check
git -C . commit -m "feat: compile deterministic seed artifacts"
~~~

### Task 5: Add a thin CLI and public release-service host

**Files:**
- Create: Microi.Server/tools/Microi.SeedConverter/Microi.SeedConverter.csproj
- Create: Microi.Server/tools/Microi.SeedConverter/Program.cs
- Create: Microi.Server/tools/Microi.SeedConverter/LiveDatabaseManifestCommand.cs
- Create: Microi.Server/tools/Microi.SeedConverter/seed-targets.json
- Create: Microi.Server/Dos.ORM/SeedCompilation/DatabaseSeedConverter.cs
- Modify: Microi.Server/Dos.ORM/SeedSources/DatabaseSeedSourceException.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/SeedIntegrationProfiles.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/SeedIntegrationSource.cs
- Create: Microi.Server/Microi.Core/Services/DatabaseSeedGenerationRequest.cs
- Create: Microi.Server/Microi.Core/Services/MicroiDatabaseResourceProvider.cs
- Modify: Microi.Server/Microi.Core/Services/EmptyDatabaseReleaseService.cs
- Modify: Microi.Server/Microi.Core/ORM/MicroiORMExtensions.cs
- Modify: Microi.Server/Microi.V8Engine/Extend/V8MethodExtend.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Seed/SeedConverterCliTests.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Seed/EmptyDatabaseReleaseServiceTests.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Seed/MicroiDatabaseResourceProviderTests.cs
- Create: Microi.Server/Dos.ORM.Tests/Architecture/SeedPublicApiDeltaAllowlistTests.cs
- Create: Microi.Server/Dos.ORM.Tests/TestInfrastructure/SeedPublicApiDeltaAllowlist.cs
- Modify: Microi.Server/Microi.net.sln

**Interfaces:**
- Produces: `generate`, `verify`, source-only `inspect-live`, and double-explicit
  `apply` CLI commands plus
  an authenticated background orchestration method. Hosts choose source/output,
  report redacted progress, and publish verified artifacts; they contain no SQL
  lexer, quote, type, DDL, value-format, or target-database branch.
- Produces the one formal Microi host implementation of the already frozen
  exact two-method `IDatabaseResourceProvider` contract:
  internal sealed `MicroiDatabaseResourceProvider` in Microi.Core.
  `AddMicroiORM` registers that inaccessible concrete type once as singleton
  behind the public `IDatabaseResourceProvider` interface. Release and tenant
  hosts resolve/inject only that interface; no other assembly can name the
  implementation and no private-repository alternate wrapper is allowed. It
  maps authorized `DatabaseResourceHandle` values to the configured
  resource store without parsing SQL/profile data, returns fresh owned streams,
  and enforces the read digest plus the frozen
  Writing/Prepared/Aborted staged-stream publish rules.
- Produces the plan's only non-exception public facade:

~~~csharp
public sealed class DatabaseSeedConverter
{
    public DatabaseSeedConverter();
    public ResourceContentDigest InspectSource(
        Stream mysql57SourcePackage,
        Stream targetEvidence);
    public ResourceContentDigest Convert(
        Stream mysql57SourcePackage,
        DialectProfile targetProfile,
        Stream targetArtifact);
    public ResourceContentDigest Verify(
        Stream targetArtifact,
        DialectProfile expectedTargetProfile);
    public ResourceContentDigest InspectDatabase(
        DbSession session,
        Stream targetEvidence);
}
~~~

All arguments are non-null and direction/capability checked. The source/artifact
methods neither open a connection nor accept URL/path/SQL/provider/
DatabaseType-only input. `InspectDatabase` accepts only a caller-owned
`DbSession` and output stream; it accepts no SQL, provider, connection, driver,
target profile, table allowlist, or caller-computed digest. The source reader
magic-detects bounded ZIP/raw input as frozen in Task 1. Null/source MySQL57/
unsupported target profile, wrong mode, unreadable source, unwritable or
aliasing destination all fail before the first destination byte. More strongly,
`InspectSource`, `Convert`, and `InspectDatabase` finish their complete work,
create and hash the evidence/ZIP in a bounded private spool, then copy to the
caller stream; any source, profile, compiler, archive, database-read, decode, or
digest failure leaves the destination untouched (`WriteCalls == 0`). Only a
failure during the final caller-stream copy can leave that destination
unusable. The facade never closes caller-owned streams/session, and a failed
output is never published.
`InspectSource` writes versioned canonical value-safe JSON containing source
package/SQL digests and sizes, parser version, MySQL 5.7 profile, structural
counts, per-table schema/row digests, and diagnostic codes/paths—never row
values, SQL/token text, URL, filesystem path, or credentials—and returns the
digest of those evidence bytes. `generate` calls InspectSource once against the
cached package, then passes a fresh read stream over the identical source bytes
to each Convert call. The CLI/certification consume only this evidence stream;
they never reference an internal manifest/model. All methods preserve
caller-owned stream lifetime and apply the private-spool/final-copy failure
contract above.

`InspectDatabase` is the single reusable logical readback implementation used
by certification. It first invokes Dos.ORM's sole internal
`DatabaseTargetIdentityProbe` through the supplied session and receives only
its 64-lower-hex safe fingerprint; the raw six-driver identity material never
crosses that boundary. It then submits public neutral `ListTablesOperation`,
table/column/index metadata operations, and parameter-free per-table
`SelectStatement` values through the supplied session. Its managed reader
performs Oracle/DM envelope decoding; the same internal canonical external
sorter/digest implementation used by source inspection computes schema and
typed-row digests. The reserved support table is excluded from logical counts,
while its active contract fingerprint and physical-support digest are recorded
separately. It never calls `FromNativeSql`; evidence contains the detected exact
live profile, `targetInstanceFingerprint`, and value-safe counts/digests, never
raw identity material, credentials, connection details, SQL, or row values.
Pending/corrupt storage state, unavailable/malformed target identity, and an
unmarked value fail with zero published output and no subsequent business query.

In this same Task 5 commit, and only after the RED allowlist test exists,
`DatabaseSeedSourceException` changes from internal to public without changing
its sealed base/constructor/property/message contract. Together with that
exception, this exact converter ctor/four-method surface is the entire
`SeedPublicApiDeltaAllowlist`; every other seed type is internal. Architecture
tests assert the old baseline is a subset and the final public delta is exactly
the union of managed-execution + seed allowlists. There is no intermediate
commit in which a public seed type exists outside the exact gate.

- [ ] **Step 1: Write default-source selection, cached generation, and no-side-effect REDs**

~~~csharp
[Fact]
public async Task Default_generate_selects_official_url_without_live_network_or_connection()
{
    var source = SeedSourceHarness.FixedContentAddressedCache();
    var result = await SeedCliHarness.RunAsync("generate", source);

    Assert.Equal(SeedIntegrationSource.OfficialUrl,
        source.RequestedDefaultUrl);
    Assert.Equal(0, source.LiveNetworkCalls);
    Assert.Equal(5, result.Artifacts.Count);
    Assert.Equal(0, result.ConnectionFactoryCalls);
    Assert.All(result.Artifacts, SeedArtifactAssert.ManifestAndHashesValid);
}

[Fact]
public void Late_invalid_source_never_touches_the_caller_destination()
{
    using var source = SeedSourceHarness.InvalidAtFinalValidation();
    using var target = new WriteCountingStream();

    Assert.Throws<DatabaseSeedSourceException>(() =>
        new DatabaseSeedConverter().Convert(
            source, SeedIntegrationProfiles.PostgreSql17Exact, target));
    Assert.Equal(0, target.WriteCalls);
    Assert.False(target.IsClosed);
}

[Fact]
public async Task Inspect_live_uses_managed_ast_and_decodes_logical_values()
{
    var lane = SeedCliHarness.LiveNullEmptyAndUnicodeLane();
    var result = await SeedCliHarness.RunAsync("inspect-live", lane);

    Assert.Equal(lane.ExpectedLogicalManifestDigest,
        result.LogicalManifestDigest);
    Assert.Equal(lane.ExpectedPhysicalSupportDigest,
        result.PhysicalSupportDigest);
    Assert.Equal(lane.ExpectedTargetInstanceFingerprint,
        result.TargetInstanceFingerprint);
    Assert.Matches("^[0-9a-f]{64}$", result.TargetInstanceFingerprint);
    Assert.Equal(0, lane.NativeSqlCalls);
    Assert.True(lane.ManagedReaderDecodedStorageContract);
    Assert.False(result.EvidenceContainsRawIdentityRowValuesOrConnectionText);
}
~~~

This ordinary regression injects a fake resolver backed by the pinned bounded
fixture/cache. It proves the production default URL selection and that generate
does not open a database, but it never downloads the live CDN package or builds
five large packages from changing network bytes. Only certification Full/
ReleaseFull may acquire the real latest URL; that lane records the observed
source digest, forbids fixture substitution, validates the MySQL 5.7 reference
first, and fails nonzero/BLOCKED when live infrastructure is unavailable.

`SeedIntegrationSource` and `SeedIntegrationProfiles` are owned by this
integration-test project and construct only public production DTOs. This
project never references `Dos.ORM.Tests`, `OfficialSeedSource`, `TestProfiles`,
or another test assembly. `MicroiDatabaseResourceProviderTests` resolves the
public `IDatabaseResourceProvider` after `AddMicroiORM`; it never names the
internal implementation or requires an IVT from Microi.Core.
`SeedSourceHarness`, `SeedCliHarness`, `WriteCountingStream`, and
`SeedArtifactAssert` in the examples are private nested helpers owned by
`SeedConverterCliTests.cs`; `SeedArtifactAssert` is intentionally not the
`Dos.ORM.Tests` helper named `ArtifactAssert` and creates no cross-test-project
reference or additional staging path.

Create the integration-test project in this step (it does not exist earlier):

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
    <PackageReference Include="coverlet.collector" Version="6.0.4" PrivateAssets="all" />
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.1" />
    <PackageReference Include="xunit" Version="2.9.3" />
    <PackageReference Include="xunit.runner.visualstudio" Version="3.1.4" PrivateAssets="all" />
  </ItemGroup>
  <ItemGroup>
    <Using Include="Xunit" />
    <ProjectReference Include="../../Dos.ORM/Dos.ORM.csproj" />
    <ProjectReference Include="../../Microi.Core/Microi.Core.csproj" />
  </ItemGroup>
  <ItemGroup Condition="'$(MicroiNetExists)' == 'true'">
    <ProjectReference Include="$(MicroiNetProjectPath)" />
  </ItemGroup>
  <ItemGroup Condition="'$(MicroiNetExists)' != 'true'">
    <PackageReference Include="Microi.net" Version="$(MicroiNetVersion)" />
  </ItemGroup>
  <ItemGroup Condition="'$(MicroiAIExists)' == 'true'">
    <ProjectReference Include="$(MicroiAIProjectPath)" />
  </ItemGroup>
  <ItemGroup Condition="'$(MicroiAIExists)' != 'true'">
    <PackageReference Include="Microi.AI" Version="$(MicroiNetVersion)" />
  </ItemGroup>
</Project>
~~~

When either private checkout is physically present, the conditional local
`ProjectReference` is mandatory so new source is never tested through an older
NuGet binary. Package fallback keeps the public-root ordinary solution
buildable for consumers after matching packages are published, but it is not
certification evidence. Full/ReleaseFull preflight requires both private source
projects and their named tests, and exits nonzero/BLOCKED if either is absent;
it never treats package fallback, removed tests, or a skipped test as PASS.

Then register it once and capture the intended RED:

~~~powershell
dotnet sln ./Microi.Server/Microi.net.sln add ./Microi.Server/tools/Microi.SeedConverter/Microi.SeedConverter.csproj
dotnet sln ./Microi.Server/Microi.net.sln add ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter "FullyQualifiedName~SeedConverterCliTests|FullyQualifiedName~EmptyDatabaseReleaseServiceTests|FullyQualifiedName~MicroiDatabaseResourceProviderTests" --nologo
~~~

Expected: project restore/build succeeds far enough to fail on the missing
converter/host behavior. Platform migration Task 2 later modifies/consumes this
same project; it must not recreate or re-register it.

- [ ] **Step 2: Implement thin hosts**

`generate` defaults to the fixed URL and supports `--source-file`, `--offline`,
`--expected-source-sha256`, `--targets-file`, repeated exact `--profile`, and
output directory. Checked-in `seed-targets.json` supplies the five exact
current defaults frozen in Task 4; it contains no credentials or image
location. It writes
`source-manifest.json` only through `InspectSource`, then creates target ZIPs
from fresh streams over the same content-addressed bytes. The CLI `verify`
command performs offline/static artifact validation only and delegates to the
instance `DatabaseSeedConverter.Verify` method; it never opens a database.
`LiveDatabaseManifestCommand` implements `inspect-live`: it accepts a configured
`DatabaseType`, canonical configured compatibility mode, the **name** of one
connection-string environment variable, and an output path. It reads the secret
only inside the current process, creates the ordinary production `Database`/
`DbSession` path without a provider-specific switch, and calls only
`DatabaseSeedConverter.InspectDatabase`. It accepts no SQL, exact-profile
override, expected digest, or table filter; the session detects the live profile
and the command writes only the converter's spooled evidence. The variable name
may be logged, but its value is never logged, serialized, or passed on the
command line. Missing/blank credentials, pending/corrupt contract, read/decode
failure, or output collision exits nonzero.
`apply` requires `--apply`, exact target profile, artifact/source SHA,
connection environment key, authorization, and conflict policy. The public
release service retains Microi authorization, sanitization workflow, object
storage, prior-version retention, and progress; it delegates every database
operation and artifact byte to Dos.ORM. Apply registers the artifact stream in
the existing `IDatabaseResourceProvider`, creates a
`DatabaseResourceHandle` with its verified content digest, constructs
`DatabaseImportOperation` with `ProviderNative + SchemaAndData`, then calls only
`DbSession.PreviewAdmin/ExecuteAdmin` with explicit conflict policy/approval.
There is no `SeedInstallRequest`, seed-specific DbSession overload, compiled
plan, SQL, or provider escape hatch.

`AddMicroiORM` uses
`TryAddSingleton<IDatabaseResourceProvider, MicroiDatabaseResourceProvider>()`;
this is the only interface-to-concrete registration in all three repositories.
`EmptyDatabaseReleaseService` accepts the public interface in its operational
constructor. The existing V8 extension keeps its public signature and obtains
that interface from the initialized `MicroiEngine` service provider before it
constructs the release service; it never names or constructs the internal
provider. Integration tests assert one singleton identity is reused by release
and later tenant hosts and that direct construction/alternate implementations
do not exist.

- [ ] **Step 3: Verify root and all repository statuses**

~~~powershell
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter "FullyQualifiedName~SeedConverterCliTests|FullyQualifiedName~EmptyDatabaseReleaseServiceTests|FullyQualifiedName~MicroiDatabaseResourceProviderTests" --nologo
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj --filter FullyQualifiedName~SeedPublicApiDeltaAllowlistTests --nologo
dotnet build ./Microi.Server/tools/Microi.SeedConverter/Microi.SeedConverter.csproj --nologo
dotnet build ./Microi.Server/Microi.Core/Microi.Core.csproj --nologo
git -C . status --short --untracked-files=all
git -C ./Microi.Server/Microi.net status --short --untracked-files=all
git -C ./Microi.Server/Microi.AI status --short --untracked-files=all
~~~

- [ ] **Step 4: Commit root repository only**

~~~powershell
git -C . add -- Microi.Server/tools/Microi.SeedConverter/Microi.SeedConverter.csproj Microi.Server/tools/Microi.SeedConverter/Program.cs Microi.Server/tools/Microi.SeedConverter/LiveDatabaseManifestCommand.cs Microi.Server/tools/Microi.SeedConverter/seed-targets.json Microi.Server/Dos.ORM/SeedCompilation/DatabaseSeedConverter.cs Microi.Server/Dos.ORM/SeedSources/DatabaseSeedSourceException.cs Microi.Server/Microi.Core/Services/DatabaseSeedGenerationRequest.cs Microi.Server/Microi.Core/Services/MicroiDatabaseResourceProvider.cs Microi.Server/Microi.Core/Services/EmptyDatabaseReleaseService.cs Microi.Server/Microi.Core/ORM/MicroiORMExtensions.cs Microi.Server/Microi.V8Engine/Extend/V8MethodExtend.cs Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/SeedIntegrationProfiles.cs Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/SeedIntegrationSource.cs Microi.Server/tests/Microi.Server.IntegrationTests/Seed/SeedConverterCliTests.cs Microi.Server/tests/Microi.Server.IntegrationTests/Seed/EmptyDatabaseReleaseServiceTests.cs Microi.Server/tests/Microi.Server.IntegrationTests/Seed/MicroiDatabaseResourceProviderTests.cs Microi.Server/Dos.ORM.Tests/Architecture/SeedPublicApiDeltaAllowlistTests.cs Microi.Server/Dos.ORM.Tests/TestInfrastructure/SeedPublicApiDeltaAllowlist.cs Microi.Server/Microi.net.sln
git -C . diff --cached --name-only
git -C . diff --cached --check
git -C . commit -m "feat: expose deterministic seed conversion"
git -C ./Microi.Server/Microi.net status --short --untracked-files=all
git -C ./Microi.Server/Microi.AI status --short --untracked-files=all
~~~

Confirm both private repository statuses are byte-identical before/after.

### Task 6: Replace private tenant provisioning with the existing source-only admin facade

**Files:**
- Modify: Microi.Server/Microi.net/Common/TenantProvisioningService.cs
- Create: Microi.Server/Microi.net/Common/TenantDatabaseImportOperationFactory.cs
- Modify: Microi.Server/Microi.net/Common/DiyStartup.cs
- Modify: Microi.Server/Microi.net/V8Engine/V8Method.cs
- Modify: Microi.Server/Microi.net/FormEngine/FormEngine.cs
- Modify: Microi.Server/Microi.net.Api/Controllers/SysUserController.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Seed/TenantSeedProvisioningTests.cs

**Interfaces:**
- The private service constructor accepts and reuses only the already frozen
  public `IDatabaseResourceProvider` contract. Task 5's sole internal Core
  implementation reaches it only through the registered interface and is
  never named by the private assembly. The service constructs the
  existing public source-only
  `DatabaseImportOperation` (`ProviderNative`, `SchemaAndData`) with exact
  resource handle/content digest, target, conflict policy, and authorization.
  It never receives a plan, internal installer/driver, SQL text, provider
  object, vendor SQL entry, or raw value list.
  The private repository does not implement/wrap/subclass that provider or add
  a seed-specific method. The shared provider retains the exact two-method
  `OpenRead(DatabaseResourceHandle)` / `OpenWrite(DatabaseResourceHandle)`
  contract. Read bytes are independently digest-checked by Dos.ORM, and staged
  writes publish only after digest-valid terminal Flush prepares the stream and
  the immediate non-cancellable Dispose atomically commits it, as required
  by the legacy resource contract.

- [ ] **Step 1: Write the current-package truncation regression RED**

~~~csharp
[Fact]
public async Task NonMySql_tenant_install_never_splits_source_SQL()
{
    var source = await TenantSeedHarness.VerifiedFutureShapedArtifactFixtureAsync();
    var capture = await TenantSeedHarness.InstallAsync(source);
    Assert.Equal(source.TotalRowCount, capture.Manifest.TotalRowCount);
    Assert.Equal(source.SchemaDigest, capture.Manifest.SchemaDigest);
    Assert.Equal(source.RowDigest, capture.Manifest.RowDigest);
    Assert.Equal(0, capture.LegacySplitSqlCalls);
    Assert.Equal(1, capture.DosOrmExecuteAdminCalls);
    Assert.Equal(0, capture.VendorSqlEntryReads);
    Assert.Equal(0, capture.LiveNetworkCalls);
}
~~~

This ordinary regression uses a content-addressed PK/no-PK, multi-row,
large-value fixture and derives every expected count/digest from that fixture's
manifest. It never downloads the changing official URL; certification Full/
ReleaseFull owns the real latest-package tenant/lifecycle gate.

- [ ] **Step 2: Implement the thin private host**

Remove `MySqlConnection`, `MySqlScript`, first-SQL-entry selection,
`SplitSqlStatements`, CDN no-cache coupling, and target database branches.
Resolve the verified artifact by manifest target-profile fingerprint and call
only `DbSession.PreviewAdmin/ExecuteAdmin` with the source operation. The
resource provider `OpenRead` returns the exact complete ZIP bytes, and the
handle digest equals the SHA-256 of that final outer ZIP. Dos.ORM verifies the
outer digest, safe archive shape, manifest, every declared entry hash, and
portable/vendor cross-digests, then executes only `portable-seed.bin`; it never
opens vendor SQL entries for execution. Installation
re-detects the live four-part profile/mode through Dos.ORM before any command.

`DiyStartup.AddMicroi` registers `TenantProvisioningService` through DI.
`TenantProvisioningService` requires `IDatabaseResourceProvider`; it has no
parameterless fallback and never constructs a provider. Replace every current
direct construction in `V8Method.cs` and `FormEngine.cs` with resolution of the
registered tenant service, and inject the same tenant service into
`SysUserController`, replacing both direct constructions there. The existing
V8 public methods/controller actions stay source compatible. Contract tests
enumerate all four files and fail on `new TenantProvisioningService`, a service
locator that asks for the concrete provider, or a second provider
implementation/registration.

- [ ] **Step 3: Build/test/status independently**

~~~powershell
dotnet build ./Microi.Server/Microi.net/Microi.net.csproj --nologo
dotnet build ./Microi.Server/Microi.AI/Microi.AI.csproj --nologo
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter FullyQualifiedName~TenantSeedProvisioningTests --nologo
git -C . status --short --untracked-files=all
git -C ./Microi.Server/Microi.net status --short --untracked-files=all
git -C ./Microi.Server/Microi.AI status --short --untracked-files=all
~~~

- [ ] **Step 4: Commit repositories independently**

~~~powershell
git -C . add -- Microi.Server/tests/Microi.Server.IntegrationTests/Seed/TenantSeedProvisioningTests.cs Microi.Server/Microi.net.Api/Controllers/SysUserController.cs
git -C . diff --cached --name-only
git -C . diff --cached --check
git -C . commit -m "refactor: inject tenant seed provisioning"
git -C ./Microi.Server/Microi.net add -- Common/TenantProvisioningService.cs Common/TenantDatabaseImportOperationFactory.cs Common/DiyStartup.cs V8Engine/V8Method.cs FormEngine/FormEngine.cs
git -C ./Microi.Server/Microi.net diff --cached --name-only
git -C ./Microi.Server/Microi.net diff --cached --check
git -C ./Microi.Server/Microi.net commit -m "refactor: install tenants from portable seed artifacts"
~~~

### Task 7: Provide the strict per-lane restore component to certification

**Files:**
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/Seed/SeedRestoreContractTests.cs
- Create: Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/PowerShellContractProcess.cs
- Create: Microi.Server/tests/Microi.DatabaseCertification/Seed/Invoke-SeedArtifactLane.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification/Seed/Compare-SeedManifest.ps1
- Create: Microi.Server/tests/Microi.DatabaseCertification/Seed/seed-evidence.schema.json

**Interfaces:**
- Produces: per-lane restore evidence comparing logical schema, all table row
  counts, canonical row digests, indexes, foreign keys, comments, defaults,
  on-update behavior, prefix index semantics, collation probes, and large
  values against the **current run's reference-verified dynamic manifest**.
- Produces the sole `seed-evidence.schema.json` v2 identity rule: source-parser
  evidence forbids `targetInstanceFingerprint`; every live reference/vendor/
  managed/pre-managed-handoff evidence requires exactly one lowercase 64-hex
  fingerprint produced by `InspectDatabase`. Logical equality intentionally
  excludes this field because a legitimate database-level Replace can create a
  new target identity; only the vendor-to-pre-managed handoff compares it for
  exact equality before reset.
- Does not create a second Full/ReleaseFull runner. The certification plan owns
  `Invoke-MicroiDatabaseCertification.ps1` and `Invoke-DatabaseLane.ps1`, and
  calls this component for reference/vendor-SQL/managed-payload phases. This
  Task 7 component is the **only** per-lane restore and manifest-comparison
  implementation: certification runner files may only validate orchestration
  arguments and invoke it; they may not duplicate dialect restore commands,
  artifact parsing, canonical digest, or manifest comparison logic.
- Consumes: the built `Microi.SeedConverter inspect-live` console host from
  Task 5 for every reference/vendor/managed database readback. PowerShell may
  pass only lane configuration and a connection-environment **name**; it cannot
  query rows, decode the envelope, or compute a database manifest itself.

- [ ] **Step 1: Write serial-lane and full-digest REDs**

~~~csharp
[Theory]
[InlineData("Complete", 0)]
[InlineData("MissingTableDigest", 25)]
[InlineData("MissingSchemaDigest", 25)]
[InlineData("RowCountMismatch", 25)]
[InlineData("MissingLiveTargetInstanceFingerprint", 25)]
[InlineData("MalformedLiveTargetInstanceFingerprint", 25)]
[InlineData("ChangedPreManagedTargetInstanceFingerprint", 25)]
public async Task Seed_manifest_acceptance_is_owned_only_by_the_script(
    string selfTestCase, int expectedExitCode)
{
    var result = await PowerShellContractProcess.RunAsync(
        "Microi.Server/tests/Microi.DatabaseCertification/Seed/Compare-SeedManifest.ps1",
        "-SelfTestCase", selfTestCase);
    Assert.Equal(expectedExitCode, result.ExitCode);
    Assert.DoesNotContain(result.SecretSentinel, result.CombinedOutput);
}
~~~

The C# helper only starts `pwsh -NoProfile`, captures bounded redacted output,
and returns the process exit code. It contains no manifest, schema, count,
digest, or acceptance model. `Compare-SeedManifest.ps1` is the sole comparison
implementation; the four self-test cases exercise that same production
function rather than a C# duplicate.

The changed-target self-test feeds two otherwise byte-identical live manifests
with the same exact profile/schema/row digests but different valid target
fingerprints and proves the vendor-to-pre-managed handoff gate fails. The
ordinary vendor-versus-post-managed logical comparison does not require their
fingerprints to match. Scripts can validate/compare the converter's fingerprint
field but cannot compute or replace it.

- [ ] **Step 2: Implement the fail-closed single-lane component contract**

The certification orchestrator must run the MySQL 5.7 reference lane **first**:
import the original current SQL,
invoke `inspect-live` to introspect every logical object and count/digest every
table with Task 2's canonical PK/no-PK ordering (independent managed reads; no
natural-order/LOB-ordering assumption),
and require exact equality with the parser candidate manifest. That equality
promotes the current manifest to the run's expected baseline. If the source SHA
equals the audited fixture SHA, additionally require 133/2403/16083; otherwise
no historical count is asserted.
The native MySQL import exists only inside isolated certification tooling as an
independent oracle; no production/service path, DbSession facade, or generated
target artifact can invoke it.

Then Full calls the component for MySQL 8, SQL Server 2022, Oracle 19c,
PostgreSQL 17, DM8, and KingbaseES. ReleaseFull additionally calls it for
SQL Server 2017, Oracle 11.2.0.4, and PostgreSQL 14. The orchestrator starts
only that database and proves vendor/four-part version/mode/image identity.
First restore the artifact's vendor SQL into an empty target and compare every
object/table/count/digest plus behavior probes to the dynamic manifest and leave
that target populated. Next apply the **same ZIP** to that same target through
`DatabaseImportOperation(ProviderNative, SchemaAndData)`, whose importer reads
only its portable payload, with `ReplaceTargetDatabase`; the certification
component must not pre-drop or pre-clear it. Dos.ORM performs the exact-profile
reset, fresh reconnect/empty proof, pending-to-active transition, and only then
data import before the component repeats the full compare.
Vendor-SQL and managed-payload results must equal each other and the MySQL
reference. Run Chinese/emoji/case/accent/order/equality/unique-index collation,
on-update, prefix-index, FK/default/comment, and large LOB probes, then remove
container/network/volume before the next lane.

For Oracle and DM8 that reset is the production schema-owner strategy, never a
literal create/drop database: elevated owned-object enumeration and managed
dependency-ordered drops, stale-target disposal, reconnect, exact-profile
redetection, and zero business/support-object proof precede `PendingImport`.
The component rejects any reordered/missing stage or residual object. The real
Oracle and DM8 assertions live in certification
`TargetResetActivationTests`; this task's self-test only validates the runner
contract and cannot claim those lanes passed.

`Invoke-SeedArtifactLane.ps1` accepts exactly one already-started lane identity,
one source package plus `InspectSource` dynamic evidence, and one phase
`Reference|VendorSql|ManagedPayload`; it never starts another database or loops
profiles. `Reference` rejects a target artifact and imports the unchanged source
package. `VendorSql` and `ManagedPayload` require the same exact-profile target
ZIP/digest; the first extracts only the verified offline SQL payload, while the
second submits only the whole ZIP through `DatabaseImportOperation`. It emits
only schema-validated value-safe evidence. After each restore it launches the
already-built host as follows (values shown are non-secret lane metadata):

~~~powershell
dotnet ./Microi.Server/tools/Microi.SeedConverter/bin/Release/net10.0/Microi.SeedConverter.dll inspect-live --database-type $Lane.DatabaseType --compatibility-mode $Lane.CompatibilityMode --connection-env $Lane.ConnectionEnvironmentName --output $phaseManifest
~~~

The script accepts the host's canonical JSON only after process exit 0, schema
validation, and evidence digest verification. It has no alternate vendor-client,
SQL, PowerShell, or C# test-helper logical readback path. Missing Docker,
image, license, endpoint, source package, or digest mismatch is
FAIL/BLOCKED with nonzero exit, never Skip/PASS. No two database containers run
at once; the certification orchestrator owns/enforces that global invariant.

- [ ] **Step 3: Run component tests (not program certification)**

~~~powershell
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter FullyQualifiedName~SeedRestoreContractTests --nologo
pwsh -NoProfile -File ./Microi.Server/tests/Microi.DatabaseCertification/Seed/Compare-SeedManifest.ps1 -SelfTest
pwsh -NoProfile -File ./Microi.Server/tests/Microi.DatabaseCertification/Seed/Invoke-SeedArtifactLane.ps1 -SelfTest
~~~

Expected: evidence schema/comparison/failure contracts pass without claiming a
real database certification. The later certification plan is the only owner of
the real MySQL 5.7 reference, Full six-current-product-lane (generated MySQL 8
plus the five default non-MySQL artifacts), and ReleaseFull all-exact-profile
orchestration and must exit nonzero on missing infrastructure.

- [ ] **Step 4: Final builds, three-repository status, and root commit**

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj -c Release --nologo
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj -c Release --nologo
dotnet build ./Microi.Server/tools/Microi.SeedConverter/Microi.SeedConverter.csproj -c Release --nologo
dotnet build ./Microi.Server/Microi.net.sln -c Release --no-restore --nologo
dotnet build ./Microi.Server/Microi.net/Microi.net.csproj -c Release --nologo
dotnet build ./Microi.Server/Microi.AI/Microi.AI.csproj -c Release --nologo
git -C . status --short --untracked-files=all
git -C ./Microi.Server/Microi.net status --short --untracked-files=all
git -C ./Microi.Server/Microi.AI status --short --untracked-files=all
git -C . add -- Microi.Server/tests/Microi.Server.IntegrationTests/Seed/SeedRestoreContractTests.cs Microi.Server/tests/Microi.Server.IntegrationTests/TestInfrastructure/PowerShellContractProcess.cs Microi.Server/tests/Microi.DatabaseCertification/Seed/Invoke-SeedArtifactLane.ps1 Microi.Server/tests/Microi.DatabaseCertification/Seed/Compare-SeedManifest.ps1 Microi.Server/tests/Microi.DatabaseCertification/Seed/seed-evidence.schema.json
git -C . diff --cached --name-only
git -C . diff --cached --check
git -C . commit -m "test: provide strict seed restore component"
~~~

## Final Acceptance

From workspace root:

~~~powershell
dotnet test ./Microi.Server/Dos.ORM.Tests/Dos.ORM.Tests.csproj -c Release --nologo
dotnet build ./Microi.Server/tools/Microi.SeedConverter/Microi.SeedConverter.csproj -c Release --nologo
dotnet build ./Microi.Server/Microi.net.sln --no-restore --nologo
dotnet build ./Microi.Server/Microi.net/Microi.net.csproj --nologo
dotnet build ./Microi.Server/Microi.AI/Microi.AI.csproj --nologo
dotnet test ./Microi.Server/tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj --filter FullyQualifiedName~SeedRestoreContractTests --nologo
pwsh -NoProfile -File ./Microi.Server/tests/Microi.DatabaseCertification/Seed/Invoke-SeedArtifactLane.ps1 -SelfTest
git -C . status --short --untracked-files=all
git -C ./Microi.Server/Microi.net status --short --untracked-files=all
git -C ./Microi.Server/Microi.AI status --short --untracked-files=all
~~~

This plan's acceptance requires deterministic default-five plus on-demand
all-certified-profile dual-payload artifacts, complete dynamic-manifest
components, strict evidence contracts, and no cross-repository staging. It does
**not** claim real-lane PASS. Program acceptance occurs only when the later
certification runner proves MySQL 5.7 reference equivalence and both vendor-SQL
and managed-payload restores for every Full/ReleaseFull target with no Skip.
Historical 133/2403/16083 applies only to the audited fixture digest.

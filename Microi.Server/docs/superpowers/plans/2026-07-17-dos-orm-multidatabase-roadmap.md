# Dos.ORM Multidatabase Implementation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this roadmap in order. Every task follows RED-GREEN-REFACTOR and is reviewed before the next task starts.

**Goal:** Deliver the approved SQL AST architecture, migrate all framework-owned database behavior into Dos.ORM, and certify Microi end to end on six real database products.

**Architecture:** Work proceeds through six dependency-ordered plans. Core AST
types land first; six compilers consume them; legacy Dos.ORM APIs are adapted
without signature breaks; the official MySQL 5.7 empty seed is converted by
Dos.ORM into five default current-target artifacts plus on-demand artifacts for
all certified exact profiles; Microi.Server call sites
migrate behind architecture gates; real database, API, UI, and screenshot
certification closes the program.

**Tech Stack:** .NET 10, Dos.ORM netstandard2.1, xUnit, Roslyn architecture tests, Docker Compose, PowerShell 7, Vue, Playwright.

## Execution Order

1. Execute `2026-07-17-dos-orm-sql-ast-core.md` completely.
2. Execute `2026-07-17-dos-orm-six-dialect-compilers.md` completely.
3. Execute `2026-07-17-dos-orm-legacy-adapters.md` completely.
4. Execute `2026-07-18-microi-empty-seed-converter.md` completely.
5. Execute `2026-07-17-microi-server-platform-sql-migration.md` completely.
6. Execute `2026-07-17-microi-multidatabase-certification.md` completely.

## Mandatory Gates

- A task starts with a focused test that is observed failing for the intended reason.
- A task ends only after focused tests, the affected project build, and all already-landed regression tests pass.
- Each task receives a specification review and a code-quality review before the next task.
- Existing public Dos.ORM signatures and `DatabaseType` numeric values remain compatible.
- Collation intent, on-update-current-time, and prefix-index neutral schema
  semantics land in six-dialect Task 7 (including 93-node/fingerprint/public
  surface/goldens) before the legacy exact baseline is captured; the later seed
  plan only consumes them and cannot silently expand the AST.
- Because seed precedes platform migration, seed Task 5 owns the first creation
  and solution registration of
  `tests/Microi.Server.IntegrationTests/Microi.Server.IntegrationTests.csproj`.
  Platform Task 2 consumes/modifies that existing project and must not declare a
  second Create. No seed test may reference a project that has not landed yet.
- Platform-owned SQL and provider-specific behavior outside `Microi.Server/Dos.ORM` must reach zero under DB001-DB005.
- User-authored V8/DataSource SQL remains opaque and explicitly tagged `UserProvided`.
- Full certification cannot skip, substitute, or proxy any of MySQL, SQL Server, Oracle, PostgreSQL, DM8, or KingbaseES V9.
- Credentials and connection strings remain environment-only and are never included in source, logs, screenshots, traces, or reports.
- The workspace contains three independent Git repositories: the root open
  repository, `Microi.Server/Microi.net`, and `Microi.Server/Microi.AI`.
  Every task records and verifies status, stages relative paths, commits, and
  builds in each affected repository independently. Root `git add -f` is never
  used to impersonate a private-repository commit.
- Seed conversion is not a test-only fixture shortcut. The audited source SHA
  fixture contains 133 tables, 2,403 columns, and 16,083 rows; those counts are
  asserted only for that SHA. Each latest-source run derives counts/digests
  dynamically from its manifest, first confirms them by independent MySQL 5.7
  reference import, then restores every generated target artifact against that
  same dynamic manifest in certification (Full: generated MySQL 8 plus the five
  default non-MySQL artifacts; ReleaseFull: all additional exact minimum-version
  targets).

## Final Acceptance Command

~~~powershell
pwsh -NoProfile -File ./Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-MicroiDatabaseCertification.ps1 -Mode Quick
pwsh -NoProfile -File ./Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-MicroiDatabaseCertification.ps1 -Mode Full
pwsh -NoProfile -File ./Microi.Server/tests/Microi.DatabaseCertification/scripts/Invoke-MicroiDatabaseCertification.ps1 -Mode ReleaseFull
~~~

Expected: Quick closes static/build contracts, Full reports the MySQL 5.7
reference plus six current product lanes (generated MySQL 8 plus the five
default non-MySQL artifacts), and the separately executed ReleaseFull command
additionally reports the still-supported minimum-version target lanes. Every required lane proves both
vendor-SQL and managed-payload full restore, identity, Dos.ORM/server contracts,
real iTdos login/CRUD/logout, network guards, screenshots, and redaction; no
required lane is skipped or replaced.

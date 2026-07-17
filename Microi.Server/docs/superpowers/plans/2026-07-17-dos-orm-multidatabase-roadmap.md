# Dos.ORM Multidatabase Implementation Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to execute this roadmap in order. Every task follows RED-GREEN-REFACTOR and is reviewed before the next task starts.

**Goal:** Deliver the approved SQL AST architecture, migrate all framework-owned database behavior into Dos.ORM, and certify Microi end to end on six real database products.

**Architecture:** Work proceeds through five dependency-ordered plans. Core AST types land first; six compilers consume them; legacy Dos.ORM APIs are adapted without signature breaks; Microi.Server call sites migrate behind architecture gates; real database, API, UI, and screenshot certification closes the program.

**Tech Stack:** .NET 10, Dos.ORM netstandard2.1, xUnit, Roslyn architecture tests, Docker Compose, PowerShell 7, Vue, Playwright.

## Execution Order

1. Execute `2026-07-17-dos-orm-sql-ast-core.md` completely.
2. Execute `2026-07-17-dos-orm-six-dialect-compilers.md` completely.
3. Execute `2026-07-17-dos-orm-legacy-adapters.md` completely.
4. Execute `2026-07-17-microi-server-platform-sql-migration.md` completely.
5. Execute `2026-07-17-microi-multidatabase-certification.md` completely.

## Mandatory Gates

- A task starts with a focused test that is observed failing for the intended reason.
- A task ends only after focused tests, the affected project build, and all already-landed regression tests pass.
- Each task receives a specification review and a code-quality review before the next task.
- Existing public Dos.ORM signatures and `DatabaseType` numeric values remain compatible.
- Platform-owned SQL and provider-specific behavior outside `Microi.Server/Dos.ORM` must reach zero under DB001-DB004.
- User-authored V8/DataSource SQL remains opaque and explicitly tagged `UserProvided`.
- Full certification cannot skip, substitute, or proxy any of MySQL, SQL Server, Oracle, PostgreSQL, DM8, or KingbaseES V9.
- Credentials and connection strings remain environment-only and are never included in source, logs, screenshots, traces, or reports.

## Final Acceptance Command

~~~powershell
pwsh .\Microi.Server\tests\Microi.DatabaseCertification\scripts\Invoke-MicroiDatabaseCertification.ps1 -Mode Full
~~~

Expected: all six identity probes, Dos.ORM contracts, server contracts, API checks, real iTdos login/CRUD/logout flows, network guards, and screenshot comparisons pass; the evidence manifest reports six successful real database lanes and no redaction failures.

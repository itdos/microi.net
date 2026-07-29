[CmdletBinding()]
param(
    [ValidateSet("Quick", "Full")]
    [string]$Mode = "Quick",

    [string]$Configuration = "Release",

    [string]$ResultsDirectory = ""
)

$ErrorActionPreference = "Stop"
$testRoot = $PSScriptRoot
$serverRoot = Split-Path -Parent $testRoot
$solution = Join-Path $serverRoot "Microi.Anderson.sln"
$project = Join-Path $testRoot "Microi.Tests.csproj"

if ([string]::IsNullOrWhiteSpace($ResultsDirectory)) {
    $ResultsDirectory = Join-Path $testRoot "TestResults"
}

$os = Get-CimInstance Win32_OperatingSystem
$totalBytes = [double]$os.TotalVisibleMemorySize * 1KB
$freeBytes = [double]$os.FreePhysicalMemory * 1KB
$reserveBytes = [Math]::Max(6GB, $totalBytes * 0.20)
Write-Host ("Microi.Tests: total={0:N1}GB free={1:N1}GB reserve-target={2:N1}GB" -f
    ($totalBytes / 1GB), ($freeBytes / 1GB), ($reserveBytes / 1GB))
if ($freeBytes -lt $reserveBytes) {
    throw "Available physical memory is below the Microi build reserve target. Close other heavy tasks or run later."
}

if ($Mode -eq "Full") {
    $required = @(
        "MICROI_TEST_API_BASE",
        "MICROI_TEST_OSCLIENT",
        "MICROI_TEST_TOKEN",
        "MICROI_TEST_FORM_ENGINE_KEY",
        "MICROI_TEST_API_ENGINE_KEY"
    )
    $missing = @($required | Where-Object {
        [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_))
    })
    if ($missing.Count -gt 0) {
        throw "Full release gate is missing environment variables: $($missing -join ', ')"
    }
    if ([Environment]::GetEnvironmentVariable("MICROI_TEST_ALLOW_WRITES") -ne "YES") {
        throw "Full release gate writes and cleans test rows. Set MICROI_TEST_ALLOW_WRITES=YES only for an isolated test tenant/table."
    }
}

New-Item -ItemType Directory -Path $ResultsDirectory -Force | Out-Null

$v8Test = Join-Path $testRoot "V8\empty-database-sanitization.test.mjs"
$v8Repository = Join-Path (Split-Path -Parent $serverRoot) "Microi-V8-Engine"
if (Test-Path -LiteralPath $v8Repository) {
    $v8TenantRoots = @(Get-ChildItem -LiteralPath $v8Repository -Directory | ForEach-Object {
        $candidate = Join-Path $_.FullName "iTdos.Product.Internal"
        if (Test-Path -LiteralPath $candidate) { $candidate }
    })
    if ($v8TenantRoots.Count -ne 1) {
        throw "Expected exactly one iTdos.Product.Internal source root, found $($v8TenantRoots.Count)."
    }
    $v8Sources = @(Get-ChildItem -LiteralPath $v8TenantRoots[0] -Recurse -File `
        -Filter "*admin_get_empty_database_sanitization_sql*.js" -ErrorAction SilentlyContinue)
    if ($v8Sources.Count -ne 1) {
        throw "Expected exactly one empty-database sanitization source, found $($v8Sources.Count)."
    }
    $v8Source = $v8Sources[0].FullName
    if (-not (Test-Path -LiteralPath $v8Test)) {
        throw "The unified V8 regression test is missing: $v8Test"
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js is required for the V8 interface-engine regression gate."
    }
    Write-Host "Checking and testing the empty-database V8 interface engine..."
    node --check $v8Source
    if ($LASTEXITCODE -ne 0) { throw "V8 interface-engine syntax check failed with exit code $LASTEXITCODE." }
    node --test $v8Test
    if ($LASTEXITCODE -ne 0) { throw "V8 interface-engine regression tests failed with exit code $LASTEXITCODE." }
}
else {
    Write-Host "Microi-V8-Engine is not present; skipping its repository-owned source gate."
}

Write-Host "Restoring Microi.Tests with one restore worker..."
dotnet restore $project --disable-parallel --force-evaluate -v:minimal
if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed with exit code $LASTEXITCODE." }

Write-Host "Building Microi.Tests and referenced backend projects..."
dotnet build $project `
    -c $Configuration `
    --no-restore `
    --disable-build-servers `
    -m:1 `
    -p:UseSharedCompilation=false `
    -v:minimal
if ($LASTEXITCODE -ne 0) { throw "dotnet build failed with exit code $LASTEXITCODE." }

Write-Host "Running deterministic unit/component regression tests..."
dotnet test $project `
    -c $Configuration `
    --no-build `
    --no-restore `
    --filter "Category!=FullStack" `
    --results-directory $ResultsDirectory `
    --logger "trx;LogFileName=microi-quick.trx" `
    --collect "XPlat Code Coverage" `
    -m:1
if ($LASTEXITCODE -ne 0) { throw "Quick regression tests failed with exit code $LASTEXITCODE." }

if ($Mode -eq "Full") {
    Write-Host "Building the complete backend solution..."
    dotnet restore $solution --disable-parallel --force-evaluate -v:minimal
    if ($LASTEXITCODE -ne 0) { throw "Solution restore failed with exit code $LASTEXITCODE." }

    dotnet build $solution `
        -c $Configuration `
        --no-restore `
        --disable-build-servers `
        -m:1 `
        -p:UseSharedCompilation=false `
        -v:minimal
    if ($LASTEXITCODE -ne 0) { throw "Solution build failed with exit code $LASTEXITCODE." }

    Write-Host "Running isolated-tenant FormEngine and ApiEngine full-stack tests..."
    dotnet test $project `
        -c $Configuration `
        --no-build `
        --no-restore `
        --filter "Category=FullStack" `
        --results-directory $ResultsDirectory `
        --logger "trx;LogFileName=microi-full-stack.trx" `
        -m:1
    if ($LASTEXITCODE -ne 0) { throw "Full-stack release gate failed with exit code $LASTEXITCODE." }

    Write-Host "Auditing vulnerable and deprecated NuGet dependencies..."
    $vulnerabilityJson = dotnet list $solution package `
        --vulnerable `
        --include-transitive `
        --format json `
        --no-restore
    if ($LASTEXITCODE -ne 0) { throw "NuGet vulnerability audit failed with exit code $LASTEXITCODE." }
    $vulnerabilityReport = $vulnerabilityJson | ConvertFrom-Json
    $vulnerabilities = @(
        foreach ($auditProject in $vulnerabilityReport.projects) {
            foreach ($framework in $auditProject.frameworks) {
                foreach ($kind in @("topLevelPackages", "transitivePackages")) {
                    foreach ($package in $framework.$kind) {
                        foreach ($vulnerability in @($package.vulnerabilities)) {
                            if ($null -ne $vulnerability) {
                                [pscustomobject]@{
                                    Project = $auditProject.path
                                    Package = $package.id
                                    Version = $package.resolvedVersion
                                    Severity = $vulnerability.severity
                                    Advisory = $vulnerability.advisoryUrl
                                }
                            }
                        }
                    }
                }
            }
        }
    )
    if ($vulnerabilities.Count -gt 0) {
        $vulnerabilities | Format-Table -AutoSize | Out-Host
        throw "NuGet vulnerability gate found $($vulnerabilities.Count) finding(s)."
    }
    Write-Host "NuGet vulnerability gate passed: 0 findings."

    # Deprecated packages are reported separately because maintained third-party
    # SDKs may still carry legacy compatibility dependencies. They remain visible
    # in the release evidence, but only known vulnerabilities block this gate.
    dotnet list $solution package --deprecated --include-transitive
    if ($LASTEXITCODE -ne 0) { throw "NuGet deprecation audit failed with exit code $LASTEXITCODE." }
}

Write-Host "Microi.Tests $Mode gate passed. Results: $ResultsDirectory"

[CmdletBinding()]
param(
    [ValidateSet("Quick", "Full", "Panel")]
    [string]$Mode = "Quick",

    [string]$Configuration = "Release",

    [string]$ResultsDirectory = "",

    [string]$SolutionPath = "",

    [ValidateSet("Bind", "Unit", "Core", "Acme", "Plugins", "Legacy", "Linux", "Verify")]
    [string]$PanelStage = "Verify",

    [string]$PanelImage = "",
    [string]$PanelPlugins = "",
    [string]$PanelLinuxEvidence = ""
)

$ErrorActionPreference = "Stop"
$testRoot = $PSScriptRoot
$serverRoot = Split-Path -Parent $testRoot
# 服务器面板独立于业务 API；真实 Docker、ACME、旧协议和两个 Linux 安装顺序走专项门禁。
# 不把这种有主机副作用的验收混进 Quick，也不让缺少任一专项的回执变成 Full 成功。
if ($Mode -eq "Panel") {
    if ([string]::IsNullOrWhiteSpace($ResultsDirectory)) {
        $ResultsDirectory = Join-Path (Split-Path -Parent $serverRoot) '.tmp/panel-acceptance/gate'
    }
    $panelArguments = @((Join-Path $testRoot 'Panel/run-panel-gate.mjs'), '--stage', $PanelStage, '--results', $ResultsDirectory)
    if ($PanelImage) { $panelArguments += @('--image', $PanelImage) }
    if ($PanelPlugins) { $panelArguments += @('--plugins', $PanelPlugins) }
    if ($PanelLinuxEvidence) { $panelArguments += @('--linux-evidence', $PanelLinuxEvidence) }
    node @panelArguments
    if ($LASTEXITCODE -ne 0) { throw "Panel $PanelStage gate failed with exit code $LASTEXITCODE." }
    return
}
$solution = if ([string]::IsNullOrWhiteSpace($SolutionPath)) {
    Join-Path $serverRoot "Microi.Anderson.sln"
} else {
    (Resolve-Path -LiteralPath $SolutionPath).Path
}
$project = Join-Path $testRoot "Microi.Tests.csproj"

if ([string]::IsNullOrWhiteSpace($ResultsDirectory)) {
    $ResultsDirectory = Join-Path $testRoot "TestResults"
}

$os = Get-CimInstance Win32_OperatingSystem
$totalBytes = [double]$os.TotalVisibleMemorySize * 1KB
$freeBytes = [double]$os.FreePhysicalMemory * 1KB
# 测试入口与工作区统一保留至少 1.5GB 或 5% 物理内存，避免旧的 6GB/20% 门槛在
# 容器已受独立内存上限保护时误拦截可安全串行执行的验证任务。
$reserveBytes = [Math]::Max(1.5GB, $totalBytes * 0.05)
Write-Host ("Microi.Tests: total={0:N1}GB free={1:N1}GB reserve-target={2:N1}GB" -f
    ($totalBytes / 1GB), ($freeBytes / 1GB), ($reserveBytes / 1GB))
if ($freeBytes -lt $reserveBytes) {
    throw "Available physical memory is below the Microi build reserve target. Close other heavy tasks or run later."
}

if ($Mode -eq "Full") {
    $required = @(
        "MICROI_TEST_API_BASE",
        "MICROI_TEST_PEER_API_BASE",
        "MICROI_TEST_OSCLIENT",
        "MICROI_TEST_TOKEN",
        "MICROI_TEST_FORM_ENGINE_KEY",
        "MICROI_TEST_API_ENGINE_KEY"
        "MICROI_TEST_CHILD_OSCLIENT"
        "MICROI_TEST_CHILD_TOKEN"
        "MICROI_UPGRADE_TEST_CONN"
        "MICROI_UPGRADE_SQLSERVER_TEST_CONN"
        "MICROI_TEST_SCHEDULE_REDIS"
        "MICROI_TEST_SCHEDULE_MYSQL"
        "MICROI_TEST_FRONTEND_BASE"
        "MICROI_TEST_ACCOUNT"
        "MICROI_TEST_PASSWORD"
        "MICROI_TEST_CHILD_ACCOUNT"
        "MICROI_TEST_CHILD_PASSWORD"
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

# 自动发现统一入口、应用包和 PC 端所有 node:test 回归；新增测试不得依赖手工补清单。
# 真正浏览器/数据库测试仍由下方 Full 环境入口执行，不能伪装成离线单元测试。
node (Join-Path $testRoot 'run-node-regressions.mjs') $ResultsDirectory
if ($LASTEXITCODE -ne 0) { throw "Discovered Node regression gate failed with exit code $LASTEXITCODE." }

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
dotnet restore $project --disable-parallel --force-evaluate -m:1 -nr:false -p:BuildInParallel=false -v:minimal
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
    dotnet restore $solution --disable-parallel --force-evaluate -m:1 -nr:false -p:BuildInParallel=false -v:minimal
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

    Write-Host "Validating real login and notification-center maintenance in isolated browser contexts..."
    node (Join-Path $testRoot 'FullStack\notification-center.e2e.mjs') $ResultsDirectory
    if ($LASTEXITCODE -ne 0) { throw "Notification-center browser release gate failed with exit code $LASTEXITCODE." }

    Write-Host "Validating platform reminders with real login, receipts, withdrawal and polling fallback..."
    node (Join-Path $testRoot 'FullStack\platform-reminders.e2e.mjs') $ResultsDirectory
    if ($LASTEXITCODE -ne 0) { throw "Platform-reminder browser release gate failed with exit code $LASTEXITCODE." }

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
    dotnet list $solution package --deprecated --include-transitive --no-restore
    if ($LASTEXITCODE -ne 0) { throw "NuGet deprecation audit failed with exit code $LASTEXITCODE." }
}

foreach ($name in @("microi-quick.trx") + $(if ($Mode -eq "Full") { @("microi-full-stack.trx") } else { @() })) {
    [xml]$report = Get-Content -LiteralPath (Join-Path $ResultsDirectory $name) -Raw
    $counters = $report.TestRun.ResultSummary.Counters
    if ([int]$counters.total -le 0 -or [int]$counters.failed -ne 0 -or [int]$counters.notExecuted -ne 0 -or [int]$counters.passed -ne [int]$counters.total) {
        throw "Release gate requires non-empty test results with no failures or skips: $name"
    }
}
Write-Host "Microi.Tests $Mode gate passed. Results: $ResultsDirectory"

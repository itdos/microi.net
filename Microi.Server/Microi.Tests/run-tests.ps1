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

if ($IsWindows -or $PSVersionTable.PSEdition -eq 'Desktop') {
    $os = Get-CimInstance Win32_OperatingSystem
    $totalBytes = [double]$os.TotalVisibleMemorySize * 1KB
    $freeBytes = [double]$os.FreePhysicalMemory * 1KB
}
elseif ($IsMacOS) {
    $totalBytes = [double](& sysctl -n hw.memsize)
    $vmStatistics = (& vm_stat) -join "`n"
    if ($LASTEXITCODE -ne 0 -or $vmStatistics -notmatch 'page size of (\d+) bytes') {
        throw 'Cannot read macOS physical-memory statistics for the build reserve gate.'
    }
    $pageBytes = [double]$Matches[1]
    $availablePages = 0.0
    # Inactive and speculative pages are reclaimable; do not count compressor or
    # purgeable subsets twice. Keep the same physical-memory reserve below.
    foreach ($label in @('free', 'inactive', 'speculative')) {
        if ($vmStatistics -notmatch ("Pages {0}:\s+(\d+)\." -f $label)) {
            throw "macOS memory statistics are missing Pages $label."
        }
        $availablePages += [double]$Matches[1]
    }
    $freeBytes = $availablePages * $pageBytes
}
elseif (Test-Path -LiteralPath '/proc/meminfo') {
    $memoryInfo = Get-Content -LiteralPath '/proc/meminfo' -Raw
    if ($memoryInfo -notmatch '(?m)^MemTotal:\s+(\d+)\s+kB') { throw 'Cannot read Linux MemTotal.' }
    $totalBytes = [double]$Matches[1] * 1KB
    if ($memoryInfo -notmatch '(?m)^MemAvailable:\s+(\d+)\s+kB') { throw 'Cannot read Linux MemAvailable.' }
    $freeBytes = [double]$Matches[1] * 1KB
}
else { throw 'This host cannot provide physical-memory statistics for the build reserve gate.' }
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
        "MICROI_TEST_MONGO_LEGACY"
        "MICROI_TEST_MONGO_CURRENT"
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

# 自动发现平台统一入口、平台内置应用包和 PC 端的 node:test 回归；新增平台测试不依赖手工清单。
# 独立业务应用、游戏及客户项目使用自己的测试入口，不通过转调文件进入平台 Quick/Full。
# 真正浏览器/数据库测试仍由下方 Full 环境入口执行，不能伪装成离线单元测试。
node (Join-Path $testRoot 'run-node-regressions.mjs') $ResultsDirectory
if ($LASTEXITCODE -ne 0) { throw "Discovered Node regression gate failed with exit code $LASTEXITCODE." }

# 创始人工作区中的 Microi Code 桌面应用以自身 package.json 的 Vitest 入口为
# 单一事实源。公开仓不带该闭源目录，因此只在应用存在时纳入统一门禁；Vitest
# 默认对零用例和失败用例返回非零，禁止把空的历史 tests/ 目录视作通过。
$workspaceRoot = Split-Path -Parent $serverRoot
$desktopRoot = Join-Path $workspaceRoot 'Microi.Agent/apps/microi-code'
# 平台插件的制品边界直接验收真实 ZIP，避免只测工作树清单而漏掉已打包的私有资料。
# 公开工作区没有内部插件仓时不引入其依赖；完整创始人工作区必须执行，失败停止 Full。
$vsixSafetyTests = Join-Path $workspaceRoot 'Microi.Agent/scripts/test-vsix-package.test.cjs'
if (Test-Path -LiteralPath $vsixSafetyTests) {
    node --test $vsixSafetyTests
    if ($LASTEXITCODE -ne 0) { throw "VSIX actual-archive safety gate failed with exit code $LASTEXITCODE." }
}
if (-not (Test-Path -LiteralPath (Join-Path $desktopRoot 'package.json'))) {
    $desktopRoot = Join-Path $workspaceRoot 'Microi.Code/apps/microi-code'
}
$desktopPackage = Join-Path $desktopRoot 'package.json'
if (Test-Path -LiteralPath $desktopPackage) {
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw 'npm is required for the Microi Code desktop regression gate.'
    }
    Write-Host 'Running Microi Code desktop Vitest regression tests...'
    Push-Location $desktopRoot
    $originalDesktopTestPath = $env:Path
    try {
        # The desktop Harness tests require Node 24 APIs; the platform Node
        # regressions above retain their own established runtime and TAP format.
        if ($env:MICROI_DESKTOP_NODE_HOME) {
            $desktopNodeName = if ($IsWindows -or $PSVersionTable.PSEdition -eq 'Desktop') { 'node.exe' } else { 'node' }
            $desktopNode = Join-Path $env:MICROI_DESKTOP_NODE_HOME $desktopNodeName
            if (-not (Test-Path -LiteralPath $desktopNode)) {
                throw "MICROI_DESKTOP_NODE_HOME does not contain ${desktopNodeName}: $env:MICROI_DESKTOP_NODE_HOME"
            }
            $env:Path = $env:MICROI_DESKTOP_NODE_HOME + [IO.Path]::PathSeparator + $originalDesktopTestPath
        }
        # 正式门禁与数据库、浏览器和双 API 同机运行；串行 Vitest worker 保留全部
        # 用例，同时避免 Windows 提交额度紧张时并发 worker 产生伪失败或争用插件目录。
        npm test -- --maxWorkers=1 --no-file-parallelism
        if ($LASTEXITCODE -ne 0) { throw "Microi Code desktop regression tests failed with exit code $LASTEXITCODE." }
    }
    finally {
        $env:Path = $originalDesktopTestPath
        Pop-Location
    }
}

$v8Test = Join-Path $testRoot "V8\empty-database-sanitization.test.mjs"
$v8Repository = Join-Path (Split-Path -Parent $serverRoot) "Microi-V8-Engine"
if (Test-Path -LiteralPath $v8Repository) {
    # 与六应用责任入口共用唯一源码契约；不能扫描 Product.Internal/default 多份副本择新。
    $suiteContractPath = Join-Path $workspaceRoot 'AI-Project/标准产品套件/source-contract.json'
    if (-not (Test-Path -LiteralPath $suiteContractPath -PathType Leaf)) {
        throw "The unique standard-suite source contract is missing: $suiteContractPath"
    }
    $suiteContract = Get-Content -LiteralPath $suiteContractPath -Raw | ConvertFrom-Json
    if ($suiteContract.schemaVersion -ne 1 -or $suiteContract.target.apiBase -cne 'https://api.itdos.com' -or $suiteContract.target.osClient -ine 'iTdos') {
        throw 'The standard-suite contract schema or official ApiBase/OsClient does not match.'
    }
    if ([string]::IsNullOrWhiteSpace($suiteContract.sourceParent) -or [IO.Path]::IsPathRooted($suiteContract.sourceParent)) {
        throw 'The standard-suite sourceParent must be a workspace-relative path.'
    }
    $suiteSourceParent = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $suiteContract.sourceParent))
    $workspacePrefix = [IO.Path]::GetFullPath($workspaceRoot).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if (-not $suiteSourceParent.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $suiteSourceParent -PathType Container)) {
        throw "The contracted standard-suite source root is missing or outside the workspace: $suiteSourceParent"
    }
    $v8TenantRoot = Split-Path -Parent $suiteSourceParent
    $v8Sources = @(Get-ChildItem -LiteralPath $v8TenantRoot -Recurse -File `
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
    # 平台内置应用有独立发行契约；当前官方正文是 cdn-security，旧 cdn-context
    # 不在官方完整文件清单内。中央发现入口仍执行该契约下的全部责任测试。
    $platformContractPath = Join-Path $serverRoot 'OfficialApplications/Resource/platform-service-release.json'
    $platformContract = Get-Content -LiteralPath $platformContractPath -Raw | ConvertFrom-Json
    if ($platformContract.SchemaVersion -ne 1 -or $platformContract.AppKey -cne 'microi-platform-service' -or
        [string]::IsNullOrWhiteSpace($platformContract.SourceRoot) -or [IO.Path]::IsPathRooted($platformContract.SourceRoot)) {
        throw 'The platform-service release source contract is invalid.'
    }
    $platformSourceRoot = [IO.Path]::GetFullPath((Join-Path $workspaceRoot $platformContract.SourceRoot))
    if (-not $platformSourceRoot.StartsWith($workspacePrefix, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'The platform-service release source root is outside the workspace.'
    }
    $cdnContextTest = Join-Path $platformSourceRoot 'test/cdn-security.test.mjs'
    if (-not (Test-Path -LiteralPath $cdnContextTest)) {
        throw "The platform service CDN security regression test is missing: $cdnContextTest"
    }
    node --test $cdnContextTest
    if ($LASTEXITCODE -ne 0) { throw "Platform service CDN security regression test failed with exit code $LASTEXITCODE." }
}
else {
    Write-Host "Microi-V8-Engine is not present; skipping its repository-owned source gate."
}

$fileCabinetOfficeTest = Join-Path (Split-Path -Parent $serverRoot) 'Microi.Client/tests/file-cabinet-office.spec.mjs'
if (-not (Test-Path -LiteralPath $fileCabinetOfficeTest)) {
    throw "File-cabinet Office regression test is missing: $fileCabinetOfficeTest"
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js is required for the file-cabinet Office regression gate.'
}
node --test $fileCabinetOfficeTest
if ($LASTEXITCODE -ne 0) { throw "File-cabinet Office regression tests failed with exit code $LASTEXITCODE." }

# Full 的 restore/build/test/list package 全部继承同一 SDK 输出目录。
# API 与 PC 可并行 Full，不写对方或长期开发服务的 bin/obj；只修改本 PowerShell 子进程环境。
if ($Mode -eq 'Full') {
    $env:ArtifactsPath = [IO.Path]::GetFullPath((Join-Path $ResultsDirectory '.net-artifacts'))
    $env:UseArtifactsOutput = 'true'
    Write-Host "Isolated Full build artifacts: $env:ArtifactsPath"
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

    # 低提交额度的正式发布机可在重型构建完成后再启动双 API 与前端。
    # 未设置该变量时保持原有行为；设置时必须由受控发布包装器写入就绪文件。
    if ($env:MICROI_TEST_RUNTIME_READY_FILE) {
        Write-Host "Waiting for staged Full runtime: $env:MICROI_TEST_RUNTIME_READY_FILE"
        $runtimeDeadline = (Get-Date).AddMinutes(3)
        while (-not (Test-Path -LiteralPath $env:MICROI_TEST_RUNTIME_READY_FILE)) {
            if ((Get-Date) -ge $runtimeDeadline) { throw 'Timed out waiting for the staged Full runtime.' }
            Start-Sleep -Milliseconds 500
        }
    }

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

    Write-Host "Validating incident evidence rendering, storage failures and mobile layout..."
    node (Join-Path $testRoot 'FullStack\incident-observability-component.mjs') $ResultsDirectory
    if ($LASTEXITCODE -ne 0) { throw "Incident evidence browser component gate failed with exit code $LASTEXITCODE." }

    Write-Host "Validating visible keyboard focus against the actual frontend host styles..."
    node (Join-Path $testRoot 'FullStack\button-keyboard-focus.component.mjs') $ResultsDirectory
    if ($LASTEXITCODE -ne 0) { throw "Button keyboard-focus browser component gate failed with exit code $LASTEXITCODE." }

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

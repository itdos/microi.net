[CmdletBinding()]
param(
    [ValidateSet("Quick", "Full", "Panel")]
    [string]$Mode = "Quick",

    [string]$Configuration = "Release",

    [string]$ResultsDirectory = "",

    [string]$SolutionPath = "",

    [string]$TestMatrixFile = $env:MICROI_TEST_MATRIX_FILE,

    [string]$SqlServerExemptionReceipt = "",

    [string]$SqlServerExemptionSha256 = "",

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
if (-not [string]::IsNullOrWhiteSpace($SqlServerExemptionReceipt) -or -not [string]::IsNullOrWhiteSpace($SqlServerExemptionSha256)) {
    throw 'SQL Server skip exemptions are retired. Full requires a frozen dependency matrix with selected providers and zero skips.'
}

if ([string]::IsNullOrWhiteSpace($ResultsDirectory)) {
    $ResultsDirectory = Join-Path $testRoot "TestResults"
}
$ResultsDirectory = [IO.Path]::GetFullPath($ResultsDirectory)

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
    $stagedRuntime = -not [string]::IsNullOrWhiteSpace($env:MICROI_TEST_RUNTIME_READY_FILE)
    if ($stagedRuntime -ne (-not [string]::IsNullOrWhiteSpace($env:MICROI_TEST_RUNTIME_ENVIRONMENT_FILE)) -or
        $stagedRuntime -ne (-not [string]::IsNullOrWhiteSpace($env:MICROI_TEST_RUNTIME_BUILD_FILE))) {
        throw 'Staged Full requires ready, final-build and private environment paths together.'
    }
    if ($stagedRuntime -and ((Test-Path -LiteralPath $env:MICROI_TEST_RUNTIME_READY_FILE) -or (Test-Path -LiteralPath $env:MICROI_TEST_RUNTIME_BUILD_FILE))) {
        throw 'Staged Full requires new signal files; previous runtime/build receipts cannot be reused.'
    }
    # 新 HTTP 门禁仅支持已经具备最终 DLL/进程/凭据身份核验的 staged runtime。
    # 预检在所有构建/数据库写入前失败，不把缺夹具变成 Skip。
    $admissionTool = Join-Path $testRoot 'ReleaseGate/fixtures/admission/runtime.mjs'
    node $admissionTool preflight $ResultsDirectory
    if ($LASTEXITCODE -ne 0) { throw 'Full admission fixture preflight failed. See Microi.Tests/README.md: Admission fixture.' }
    if ([string]::IsNullOrWhiteSpace($TestMatrixFile)) {
        throw 'Full requires MICROI_TEST_MATRIX_FILE with the verified MCP dependency versions and isolated fixture coordinates.'
    }
    $matrixTool = Join-Path $testRoot 'ReleaseGate/release-test-matrix.mjs'
    $matrixReceipt = Join-Path $ResultsDirectory 'release-test-matrix.json'
    # 常规矩阵由实际 MCP 依赖选择；未选提供商标记不适用，不能靠旧连接扩张或靠跳过放行。
    $matrixJson = node $matrixTool freeze $TestMatrixFile $matrixReceipt
    if ($LASTEXITCODE -ne 0) { throw 'Full dependency matrix validation failed before test execution.' }
    $matrixPlan = $matrixJson | ConvertFrom-Json
    $env:MICROI_TEST_MATRIX_FILE = $TestMatrixFile
    $required = @($matrixPlan.requiredEnvironment)
    # A staged runtime can obtain tokens only after this exact Full build. Every
    # other prerequisite still fails before restore/build; no test is deferred.
    $prebuildRequired = @($required | Where-Object { -not ($stagedRuntime -and $_ -in @('MICROI_TEST_TOKEN', 'MICROI_TEST_CHILD_TOKEN')) })
    $missing = @($prebuildRequired | Where-Object {
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

# 测试夹具包含真实 node:sqlite 与中文 SQLite 输入。统一使用任务已验证的
# Node 运行时及 Python UTF-8，防止 Windows PATH/代码页导致假失败；这些变量
# 仅属于测试进程，不进入生产 API 配置或数据库设置。
if ($env:MICROI_DESKTOP_NODE_HOME) {
    $testNodeName = if ($IsWindows -or $PSVersionTable.PSEdition -eq 'Desktop') { 'node.exe' } else { 'node' }
    $testNode = Join-Path $env:MICROI_DESKTOP_NODE_HOME $testNodeName
    if (-not (Test-Path -LiteralPath $testNode -PathType Leaf)) {
        throw "Configured test runtime does not contain ${testNodeName}: $env:MICROI_DESKTOP_NODE_HOME"
    }
    $env:Path = $env:MICROI_DESKTOP_NODE_HOME + [IO.Path]::PathSeparator + $env:Path
    Write-Host "Using configured Node test runtime: $(& $testNode --version)"
}
$env:PYTHONUTF8 = '1'
$env:PYTHONIOENCODING = 'utf-8'

function Get-MicroiDesktopTestPath {
    param([string]$OriginalPath, [string]$NodeHome, [bool]$WindowsHost)
    $prefixes = @()
    if (-not [string]::IsNullOrWhiteSpace($NodeHome)) { $prefixes += $NodeHome }
    if ($WindowsHost) {
        # Git Bash 的 GNU tar 把 D: 等盘符当作远端主机；原生 Windows 测试使用
        # 系统 API 返回的 bsdtar 目录，同时保留已核验的 Node 运行时最高优先级。
        $systemDirectory = [Environment]::GetFolderPath([Environment+SpecialFolder]::System)
        if ([string]::IsNullOrWhiteSpace($systemDirectory) -or
            -not [IO.File]::Exists((Join-Path $systemDirectory 'tar.exe'))) {
            throw 'Windows desktop regression requires the native system tar.exe.'
        }
        $prefixes += $systemDirectory
    }
    $prefixes += $OriginalPath
    return $prefixes -join [IO.Path]::PathSeparator
}

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
        # The desktop Harness and real SQLite fixtures share the configured
        # Node runtime; explicit TAP reporting keeps the summary format stable.
        if ($env:MICROI_DESKTOP_NODE_HOME) {
            $desktopNodeName = if ($IsWindows -or $PSVersionTable.PSEdition -eq 'Desktop') { 'node.exe' } else { 'node' }
            $desktopNode = Join-Path $env:MICROI_DESKTOP_NODE_HOME $desktopNodeName
            if (-not (Test-Path -LiteralPath $desktopNode)) {
                throw "MICROI_DESKTOP_NODE_HOME does not contain ${desktopNodeName}: $env:MICROI_DESKTOP_NODE_HOME"
            }
        }
        $env:Path = Get-MicroiDesktopTestPath -OriginalPath $originalDesktopTestPath -NodeHome $env:MICROI_DESKTOP_NODE_HOME -WindowsHost ($IsWindows -or $PSVersionTable.PSEdition -eq 'Desktop')
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

# 创始人桌面子门禁先失败即停，避免已知桌面问题在平台回归结束后才暴露。
# 所有平台 Node、.NET、双 API 和真实浏览器检查仍在同一次完整 Full 中执行。
# 自动发现平台统一入口、平台内置应用包和 PC 端的 node:test 回归；新增测试不依赖手工清单。
node (Join-Path $testRoot 'run-node-regressions.mjs') $ResultsDirectory
if ($LASTEXITCODE -ne 0) { throw "Discovered Node regression gate failed with exit code $LASTEXITCODE." }

$v8Test = Join-Path $testRoot "V8\empty-database-sanitization.test.mjs"
$v8Repository = Join-Path (Split-Path -Parent $serverRoot) "Microi-V8-Engine"
if (Test-Path -LiteralPath $v8Repository) {
    # 与六应用责任入口共用唯一源码契约；不能扫描 Product.Internal/default 多份副本择新。
    $suiteContractPath = Join-Path $workspaceRoot 'AI-Project/标准产品套件/source-contract.json'
    if (-not (Test-Path -LiteralPath $suiteContractPath -PathType Leaf)) {
        throw "The unique standard-suite source contract is missing: $suiteContractPath"
    }
    $suiteContract = Get-Content -LiteralPath $suiteContractPath -Raw | ConvertFrom-Json
    if ($suiteContract.schemaVersion -ne 1 -or $suiteContract.target.apiBase -cne 'https://api.microi.net' -or $suiteContract.target.osClient -ine 'iTdos') {
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
    if (-not (Test-Path -LiteralPath $v8Test)) {
        throw "The unified V8 regression test is missing: $v8Test"
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        throw "Node.js is required for the V8 interface-engine regression gate."
    }
    Write-Host "Checking and testing the empty-database V8 interface engine..."
    # 与行为回归使用同一个官方 Managed 包正文；不要求另有可能过时的租户拉取副本。
    node (Join-Path $testRoot 'ReleaseGate/official-v8-source.mjs') $workspaceRoot
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
$ownedArtifactTarget = $null
$ownedArtifactLink = $null
$retainedArtifactTarget = $null
$previousArtifactsPath = $env:ArtifactsPath
$previousUseArtifactsOutput = $env:UseArtifactsOutput
$artifactGateFailed = $false
. (Join-Path $serverRoot 'tools/Microi.TestArtifactCleanup.ps1')
try {
if ($Mode -eq 'Full') {
    $artifactTarget = [IO.Path]::GetFullPath((Join-Path $ResultsDirectory '.net-artifacts'))
    $workspaceRoot = [IO.Path]::GetFullPath((Split-Path -Parent $serverRoot))
    $linkRoot = [IO.Path]::GetFullPath((Join-Path $workspaceRoot '.tmp'))
    if (-not $linkRoot.StartsWith($workspaceRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Full artifact link directory escaped the workspace.'
    }
    if (-not (Test-Path -LiteralPath $artifactTarget)) {
        New-Item -ItemType Directory -Path $artifactTarget -ErrorAction Stop | Out-Null
        $ownedArtifactTarget = $artifactTarget
    } else {
        $retainedArtifactTarget = $artifactTarget
        Write-Warning "Existing artifact directory is preserved; use a fresh ResultsDirectory for automatic cleanup: $artifactTarget"
    }
    New-Item -ItemType Directory -Path $linkRoot -Force | Out-Null
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $targetBytes = [Text.Encoding]::UTF8.GetBytes($artifactTarget.ToUpperInvariant())
        $targetHash = [BitConverter]::ToString($sha.ComputeHash($targetBytes)).Replace('-', '').ToLowerInvariant()
    }
    finally { $sha.Dispose() }
    $artifactLink = Join-Path $linkRoot ('microi-full-artifacts-' + $targetHash.Substring(0, 24))
    $linkType = if ($IsWindows -or $PSVersionTable.PSEdition -eq 'Desktop') { 'Junction' } else { 'SymbolicLink' }
    $linkItem = Get-Item -LiteralPath $artifactLink -Force -ErrorAction SilentlyContinue
    if ($null -eq $linkItem) {
        # 源码契约测试从 AppContext.BaseDirectory 向上寻找仓库；联接保留仓内路径，实际字节仍落在隔离结果盘。
        New-Item -ItemType $linkType -Path $artifactLink -Target $artifactTarget -ErrorAction Stop | Out-Null
        if ($ownedArtifactTarget) { $ownedArtifactLink = $artifactLink }
        $linkItem = Get-Item -LiteralPath $artifactLink -Force -ErrorAction Stop
    }
    $existingTarget = @($linkItem.Target) | Select-Object -First 1
    if ($linkItem.LinkType -ne $linkType -or [string]::IsNullOrWhiteSpace($existingTarget) -or
        [IO.Path]::GetFullPath($existingTarget) -ne $artifactTarget) {
        throw "Full artifact link collision: $artifactLink"
    }
    $env:ArtifactsPath = $artifactLink
    $env:UseArtifactsOutput = 'true'
    Write-Host "Isolated Full build artifacts: $artifactTarget (workspace link: $artifactLink)"
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

    # 与一键发布使用同一 Release 重建图，覆盖方案外引用的 Clean/Build 顺序；
    # 保留父配置，不能靠预备 Release 文件或回退 Debug 掩盖引用产物缺失。
    dotnet build $solution `
        -c $Configuration `
        --no-restore `
        --no-incremental `
        --disable-build-servers `
        -m:1 `
        -p:UseSharedCompilation=false `
        -p:ShouldUnsetParentConfigurationAndPlatform=false `
        -v:minimal
    if ($LASTEXITCODE -ne 0) { throw "Solution build failed with exit code $LASTEXITCODE." }

    # 低提交额度的正式发布机可在重型构建完成后再启动双 API 与前端。
    # 未设置该变量时保持原有行为；设置时必须由受控发布包装器写入就绪文件。
    if ($env:MICROI_TEST_RUNTIME_READY_FILE) {
        $stagedTool = Join-Path $testRoot 'ReleaseGate/staged-full-runtime.mjs'
        node $stagedTool announce $artifactTarget $matrixReceipt $env:MICROI_TEST_RUNTIME_BUILD_FILE
        if ($LASTEXITCODE -ne 0) { throw 'The final Full build could not be bound to its staged runtime.' }
        Write-Host "Waiting for staged Full runtime: $env:MICROI_TEST_RUNTIME_READY_FILE"
        $runtimeDeadline = (Get-Date).AddMinutes(10)
        while (-not (Test-Path -LiteralPath $env:MICROI_TEST_RUNTIME_READY_FILE)) {
            if ($env:MICROI_TEST_RUNTIME_FAILED_FILE -and (Test-Path -LiteralPath $env:MICROI_TEST_RUNTIME_FAILED_FILE)) {
                throw 'Owned staged runtime failed; inspect the task runtime failure receipt.'
            }
            if ((Get-Date) -ge $runtimeDeadline) { throw 'Timed out waiting for the staged Full runtime.' }
            Start-Sleep -Milliseconds 500
        }
        $freshTokensJson = node $stagedTool verify-ready $env:MICROI_TEST_RUNTIME_BUILD_FILE $env:MICROI_TEST_RUNTIME_READY_FILE $env:MICROI_TEST_RUNTIME_ENVIRONMENT_FILE
        if ($LASTEXITCODE -ne 0) { throw 'Staged runtime identity, final DLL fingerprint or fresh login was rejected.' }
        $freshTokens = $freshTokensJson | ConvertFrom-Json
        $env:MICROI_TEST_TOKEN = $freshTokens.MICROI_TEST_TOKEN
        $env:MICROI_TEST_CHILD_TOKEN = $freshTokens.MICROI_TEST_CHILD_TOKEN
        $missingAfterRuntime = @($required | Where-Object { [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($_)) })
        if ($missingAfterRuntime.Count -gt 0) { throw "Full runtime is missing prerequisites: $($missingAfterRuntime -join ', ')" }
    }

    # 只有同次 verify-ready 成功后才允许准备独占租户；正式入口承担该生命周期。
    $admissionJson = node $admissionTool prepare $ResultsDirectory
    if ($LASTEXITCODE -ne 0) { throw 'Full admission fixture preparation failed; preserve its private receipts before retrying.' }
    $admissionReady = $admissionJson | ConvertFrom-Json
    $env:MICROI_ADMISSION_READY_FILE = $admissionReady.MICROI_ADMISSION_READY_FILE
    $env:MICROI_ADMISSION_ENVIRONMENT_FILE = $admissionReady.MICROI_ADMISSION_ENVIRONMENT_FILE

    Write-Host "Running isolated-tenant FormEngine and ApiEngine full-stack tests..."
    $fullStackExit = $null
    $fullStackLaunchError = $null
    $admissionCleanupExit = $null
    try {
        dotnet test $project `
            -c $Configuration `
            --no-build `
            --no-restore `
            --filter $matrixPlan.fullFilter `
            --results-directory $ResultsDirectory `
            --logger "trx;LogFileName=microi-full-stack.trx" `
            -m:1
        $fullStackExit = $LASTEXITCODE
    } catch {
        $fullStackLaunchError = $_
    } finally {
        try {
            node $admissionTool cleanup $ResultsDirectory
            $admissionCleanupExit = $LASTEXITCODE
        } catch { $admissionCleanupExit = 'LaunchFailed' }
    }
    # 清理失败不能掩盖原始测试退出码；TRX、私有意图与两个阶段结果均保留。
    if ($fullStackLaunchError -or $fullStackExit -ne 0 -or $admissionCleanupExit -ne 0) {
        throw "Full-stack failed: testExit=$fullStackExit; testLaunchFailed=$([bool]$fullStackLaunchError); admissionCleanupExit=$admissionCleanupExit. Preserve TRX and admission/private receipts."
    }

    Write-Host "Validating incident evidence rendering, storage failures and mobile layout..."
    node (Join-Path $testRoot 'FullStack\incident-observability-component.mjs') $ResultsDirectory
    if ($LASTEXITCODE -ne 0) { throw "Incident evidence browser component gate failed with exit code $LASTEXITCODE." }

    Write-Host "Validating visible keyboard focus against the actual frontend host styles..."
    node (Join-Path $testRoot 'FullStack\button-keyboard-focus.component.mjs') $ResultsDirectory
    if ($LASTEXITCODE -ne 0) { throw "Button keyboard-focus browser component gate failed with exit code $LASTEXITCODE." }

    Write-Host "Validating selected option labels in actual desktop/mobile selection components..."
    node (Join-Path $testRoot 'FullStack\selected-options.component.mjs')
    if ($LASTEXITCODE -ne 0) { throw "Selected option browser component gate failed with exit code $LASTEXITCODE." }

    Write-Host "Validating real login and notification-center maintenance in isolated browser contexts..."
    node (Join-Path $testRoot 'FullStack\notification-center.e2e.mjs') $ResultsDirectory
    if ($LASTEXITCODE -ne 0) { throw "Notification-center browser release gate failed with exit code $LASTEXITCODE." }

    Write-Host "Validating platform reminders with real login, receipts, withdrawal and polling fallback..."
    node (Join-Path $testRoot 'FullStack\platform-reminders.e2e.mjs') $ResultsDirectory
    if ($LASTEXITCODE -ne 0) { throw "Platform-reminder browser release gate failed with exit code $LASTEXITCODE." }

    Write-Host 'Validating search selection labels in real Element Plus at the selected desktop resolutions...'
    $clientRoot = Join-Path (Split-Path -Parent $serverRoot) 'Microi.Client'
    $geometryReport = Join-Path $ResultsDirectory 'search-select-label-geometry.json'
    Push-Location $clientRoot
    try {
        node (Join-Path $clientRoot 'node_modules/@playwright/test/cli.js') test tests/search-select-label-geometry.e2e.spec.mjs --workers=1 --reporter=json --output (Join-Path $ResultsDirectory 'search-select-label-geometry') | Out-File -LiteralPath $geometryReport -Encoding utf8
        if ($LASTEXITCODE -ne 0) { throw 'Search selection label browser release gate failed.' }
        $geometry = Get-Content -LiteralPath $geometryReport -Raw | ConvertFrom-Json
        if ($geometry.stats.expected -lt 2 -or $geometry.stats.unexpected -ne 0 -or $geometry.stats.skipped -ne 0 -or $geometry.stats.flaky -ne 0) {
            throw 'Search selection label browser release gate requires all selected desktop cases without failures or skips.'
        }
    } finally { Pop-Location }

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
if ($Mode -eq 'Full') {
    $matrixOutcomes = Join-Path $ResultsDirectory 'release-test-matrix-outcomes.json'
    & (Join-Path $testRoot 'ReleaseGate/read-release-matrix-trx.ps1') -ResultsDirectory $ResultsDirectory -OutputFile $matrixOutcomes
    node $matrixTool verify $matrixReceipt $matrixOutcomes (Join-Path $ResultsDirectory 'release-test-matrix-result.json')
    if ($LASTEXITCODE -ne 0) { throw 'Selected Full matrix has missing provider cases, source drift, or invalid storage/cleanup evidence.' }
    if ($env:MICROI_TEST_RUNTIME_READY_FILE) {
        # 先独立确认双 API/Vite 已退出并释放 DLL，保留原桥供加密后冒烟；禁止与 PrepareRelease 争抢进程。
        $transportReady = Join-Path (Split-Path -Parent $env:MICROI_TEST_RUNTIME_BUILD_FILE) 'transport-only-ready.json'
        node $stagedTool verify-transport-only $env:MICROI_TEST_RUNTIME_BUILD_FILE $env:MICROI_TEST_RUNTIME_READY_FILE $transportReady (Join-Path $ResultsDirectory 'release-test-matrix-result.json')
        if ($LASTEXITCODE -ne 0) { throw 'Owned runtimes did not exit or the same-attempt native bridges are unavailable before PrepareRelease.' }
    }
}
Write-Host "Microi.Tests $Mode gate passed. Results: $ResultsDirectory"

} catch {
    $artifactGateFailed = $true
    throw
} finally {
    $env:ArtifactsPath = $previousArtifactsPath
    $env:UseArtifactsOutput = $previousUseArtifactsOutput
    try {
        $cleanup = Remove-MicroiOwnedTestArtifacts -ArtifactTarget $ownedArtifactTarget -ArtifactLink $ownedArtifactLink -ResultsDirectory $ResultsDirectory
        $cleanup | Add-Member -NotePropertyName retainedExistingArtifactTarget -NotePropertyValue $retainedArtifactTarget
        $cleanup | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $ResultsDirectory 'artifact-cleanup.json') -Encoding UTF8
    } catch {
        $cleanupError = $_
        Write-Warning "Test artifact cleanup incomplete: $($cleanupError.Exception.Message); target: $ownedArtifactTarget; link: $ownedArtifactLink"
        try {
            [pscustomobject]@{cleaned=$false;artifactTarget=$ownedArtifactTarget;artifactLink=$ownedArtifactLink;error=$cleanupError.Exception.Message} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $ResultsDirectory 'artifact-cleanup.json') -Encoding UTF8
        } catch { Write-Warning "Cannot write cleanup receipt: $($_.Exception.Message)" }
        # 清理及回执写入失败不能覆盖原来的测试失败原因。
        if (-not $artifactGateFailed) { throw $cleanupError }
    }
}

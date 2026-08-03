[CmdletBinding()]
param(
    [ValidateSet('Status', 'PrepareRelease', 'StopBackend', 'StopFrontend')]
    [string]$Action = 'Status',
    [string]$WorkspaceRoot = '',
    [int]$BackendPort = 61501,
    [int]$FrontendPort = 61500
)

# 只读盘点：
# powershell -NoProfile -ExecutionPolicy Bypass -File Microi.Server/tools/Microi.LocalProcessManager.ps1 -Action Status
# 发布前精确清理：
# powershell -NoProfile -ExecutionPolicy Bypass -File Microi.Server/tools/Microi.LocalProcessManager.ps1 -Action PrepareRelease

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($WorkspaceRoot)) {
    $WorkspaceRoot = Join-Path $PSScriptRoot '..\..'
}

$resolvedWorkspace = (Resolve-Path -LiteralPath $WorkspaceRoot).Path.TrimEnd('\', '/')
$normalizedWorkspace = $resolvedWorkspace.Replace('/', '\').ToLowerInvariant()
$backendRoot = (Join-Path $resolvedWorkspace 'Microi.Server\Microi.net.Api').Replace('/', '\').ToLowerInvariant()
$frontendRoot = (Join-Path $resolvedWorkspace 'Microi.Client').Replace('/', '\').ToLowerInvariant()
$releaseOutput = Join-Path $resolvedWorkspace 'Microi.Server\Microi.net.Api\bin\Release'
$releaseLockDirectory = Join-Path $resolvedWorkspace '.tmp\microi-process-state\release.lock'

function Write-Info([string]$Message) {
    Write-Host "[Microi process manager] $Message"
}

function Get-ProcessSnapshot {
    $result = @{}
    Get-CimInstance Win32_Process -ErrorAction Stop | ForEach-Object {
        $result[[int]$_.ProcessId] = $_
    }
    return $result
}

function Get-CommandText($ProcessInfo) {
    if ($null -eq $ProcessInfo) { return '' }
    $commandLine = [string]$ProcessInfo.CommandLine
    $executablePath = [string]$ProcessInfo.ExecutablePath
    return (($commandLine + ' ' + $executablePath).Replace('/', '\').ToLowerInvariant())
}

function Test-IsWorkspaceBackend($ProcessInfo) {
    $processName = ([string]$ProcessInfo.Name).ToLowerInvariant()
    if ($processName -ne 'dotnet.exe' -and $processName -ne 'microi.net.api.exe') { return $false }
    $text = Get-CommandText $ProcessInfo
    if (-not $text.Contains($backendRoot)) { return $false }
    return $text.Contains('microi.net.api.dll') `
        -or $text.Contains('microi.net.api.exe') `
        -or $text.Contains('microi.net.api.csproj') `
        -or $text.Contains('dotnet run')
}

function Test-IsWorkspaceFrontend($ProcessInfo) {
    $processName = ([string]$ProcessInfo.Name).ToLowerInvariant()
    if ($processName -ne 'node.exe') { return $false }
    $text = Get-CommandText $ProcessInfo
    return $text.Contains($frontendRoot) -and ($text.Contains('vite') -or $text.Contains('npm-cli.js'))
}

function Get-ListeningProcessIds([int]$Port) {
    $ids = @()
    try {
        $ids = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop |
            Select-Object -ExpandProperty OwningProcess -Unique)
    }
    catch {
        $pattern = ':\s*' + [regex]::Escape([string]$Port) + '\s+.*LISTENING\s+(\d+)\s*$'
        $ids = @(netstat.exe -ano -p tcp 2>$null | ForEach-Object {
            if ($_ -match $pattern) { [int]$Matches[1] }
        } | Select-Object -Unique)
    }
    return @($ids | Where-Object { $_ -and [int]$_ -gt 0 })
}

function Get-WorkingSetMb([int]$ProcessId) {
    try {
        return [math]::Round((Get-Process -Id $ProcessId -ErrorAction Stop).WorkingSet64 / 1MB, 1)
    }
    catch {
        return 0
    }
}

function Get-ProcessSummary($ProcessInfo, [hashtable]$Snapshot) {
    if ($null -eq $ProcessInfo) { return '<进程已退出>' }
    $processId = [int]$ProcessInfo.ProcessId
    $parentId = [int]$ProcessInfo.ParentProcessId
    $parentMissing = $parentId -gt 0 -and -not $Snapshot.ContainsKey($parentId)
    $orphanLabel = if ($parentMissing) { '，父进程已不存在' } else { '' }
    $commandLine = ([string]$ProcessInfo.CommandLine).Trim()
    if ($commandLine.Length -gt 260) {
        $commandLine = $commandLine.Substring(0, 260) + '...'
    }
    return "PID=$processId，进程=$($ProcessInfo.Name)，内存=$(Get-WorkingSetMb $processId)MB$orphanLabel，命令=$commandLine"
}

function Assert-ListenerIdentity(
    [string]$Kind,
    [int]$Port,
    [int[]]$ProcessIds,
    [hashtable]$Snapshot
) {
    foreach ($processId in $ProcessIds) {
        $processInfo = $Snapshot[[int]$processId]
        if ($null -eq $processInfo) { continue }
        $valid = if ($Kind -eq 'backend') {
            Test-IsWorkspaceBackend $processInfo
        }
        else {
            Test-IsWorkspaceFrontend $processInfo
        }
        if (-not $valid) {
            $summary = Get-ProcessSummary $processInfo $Snapshot
            throw "端口 $Port 被非当前工作区的进程占用，拒绝自动结束：$summary"
        }
    }
}

function Stop-VerifiedProcessTree($ProcessInfo, [hashtable]$Snapshot, [string]$Reason) {
    if ($null -eq $ProcessInfo) { return }
    $processId = [int]$ProcessInfo.ProcessId
    if ($processId -eq $PID) {
        throw "拒绝结束进程管理器自身 PID=$processId"
    }
    if ($null -eq (Get-Process -Id $processId -ErrorAction SilentlyContinue)) { return }

    Write-Info "正在结束 $Reason：$(Get-ProcessSummary $ProcessInfo $Snapshot)"
    try {
        & taskkill.exe /PID $processId /T 2>&1 | Out-Null
    }
    catch {
        # taskkill 可能报告某个子进程已经先退出；随后以目标 PID 是否仍存在作为事实源。
    }

    $deadline = [DateTime]::UtcNow.AddSeconds(5)
    while ([DateTime]::UtcNow -lt $deadline -and (Get-Process -Id $processId -ErrorAction SilentlyContinue)) {
        Start-Sleep -Milliseconds 200
    }

    if (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
        Write-Info "PID=$processId 在 5 秒内未退出，正在强制结束其子进程树。"
        try {
            & taskkill.exe /PID $processId /T /F 2>&1 | Out-Null
        }
        catch {
            # 同上：忽略瞬时子进程竞态，下面继续按目标 PID 校验。
        }
    }

    $deadline = [DateTime]::UtcNow.AddSeconds(5)
    while ([DateTime]::UtcNow -lt $deadline -and (Get-Process -Id $processId -ErrorAction SilentlyContinue)) {
        Start-Sleep -Milliseconds 200
    }
    if (Get-Process -Id $processId -ErrorAction SilentlyContinue) {
        throw "无法结束 $Reason PID=$processId，请检查权限后重试。"
    }
}

function Get-ReleaseRuntimeProcessIds([hashtable]$Snapshot) {
    $ids = @()
    foreach ($entry in $Snapshot.GetEnumerator()) {
        $processInfo = $entry.Value
        if (-not (Test-IsWorkspaceBackend $processInfo)) { continue }
        $text = Get-CommandText $processInfo
        if ($text.Contains('\bin\release\') -or $text.Contains('\bin\release\publish\')) {
            $ids += [int]$processInfo.ProcessId
        }
    }
    return @($ids | Select-Object -Unique)
}

function Get-LockedReleaseFiles {
    if (-not (Test-Path -LiteralPath $releaseOutput -PathType Container)) { return @() }
    $locked = @()
    Get-ChildItem -LiteralPath $releaseOutput -Filter '*.dll' -File -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        $stream = $null
        try {
            $stream = [System.IO.File]::Open(
                $_.FullName,
                [System.IO.FileMode]::Open,
                [System.IO.FileAccess]::ReadWrite,
                [System.IO.FileShare]::None)
        }
        catch {
            $locked += [PSCustomObject]@{ Path = $_.FullName; Error = $_.Exception.Message }
        }
        finally {
            if ($null -ne $stream) { $stream.Dispose() }
        }
    }
    return @($locked)
}

function Assert-ReleaseFilesUnlocked {
    $locked = @()
    for ($attempt = 1; $attempt -le 20; $attempt++) {
        $locked = @(Get-LockedReleaseFiles)
        if ($locked.Count -eq 0) {
            Write-Info 'Release 输出 DLL 文件锁检查通过。'
            return
        }
        Start-Sleep -Milliseconds 250
    }

    $details = ($locked | Select-Object -First 10 | ForEach-Object { $_.Path }) -join "`n  - "
    throw "Release 输出仍有 $($locked.Count) 个 DLL 无法独占打开。`n  - $details"
}

function Show-Status {
    $snapshot = Get-ProcessSnapshot
    $backendIds = @(Get-ListeningProcessIds $BackendPort)
    $frontendIds = @(Get-ListeningProcessIds $FrontendPort)

    Write-Info "工作区：$resolvedWorkspace"
    if (Test-Path -LiteralPath $releaseLockDirectory) {
        $ownerFile = Join-Path $releaseLockDirectory 'owner.env'
        $ownerText = '无 owner.env'
        if (Test-Path -LiteralPath $ownerFile -PathType Leaf) {
            $ownerText = ((Get-Content -LiteralPath $ownerFile -Encoding UTF8 -ErrorAction SilentlyContinue) -join '，')
        }
        Write-Info "发布互斥锁：存在（发布进行中或上次异常退出），$ownerText"
    }
    else {
        Write-Info '发布互斥锁：无'
    }
    if ($backendIds.Count -eq 0) {
        Write-Info "后端端口 $BackendPort：未监听"
    }
    else {
        foreach ($processId in $backendIds) {
            Write-Info "后端端口 $BackendPort：$(Get-ProcessSummary $snapshot[[int]$processId] $snapshot)"
        }
    }
    if ($frontendIds.Count -eq 0) {
        Write-Info "前端端口 $FrontendPort：未监听"
    }
    else {
        foreach ($processId in $frontendIds) {
            Write-Info "前端端口 $FrontendPort：$(Get-ProcessSummary $snapshot[[int]$processId] $snapshot)"
        }
    }

    $releaseIds = @(Get-ReleaseRuntimeProcessIds $snapshot)
    foreach ($processId in $releaseIds) {
        if ($backendIds -contains $processId) { continue }
        Write-Info "额外 Release 后端：$(Get-ProcessSummary $snapshot[[int]$processId] $snapshot)"
    }

    $browserProcesses = @(Get-Process -ErrorAction SilentlyContinue |
        Where-Object { $_.ProcessName -match '^(chrome|msedge)$' })
    $browserMemoryBytes = if ($browserProcesses.Count -gt 0) {
        ($browserProcesses | Measure-Object WorkingSet64 -Sum).Sum
    }
    else {
        0
    }
    $browserMemory = [math]::Round($browserMemoryBytes / 1MB, 1)
    Write-Info "浏览器：$($browserProcesses.Count) 个进程，共约 ${browserMemory}MB；属于用户/浏览器会话，永不自动结束。"

    $playwrightServers = @($snapshot.Values | Where-Object {
        (Get-CommandText $_).Contains('playwright') -and (Get-CommandText $_).Contains('test-server')
    })
    Write-Info "Playwright Test Server：$($playwrightServers.Count) 个；VS Code 扩展持有时不视为可清理孤儿。"
}

function Invoke-StopBackend([hashtable]$Snapshot, [switch]$IncludeListener) {
    $ids = @(Get-ReleaseRuntimeProcessIds $Snapshot)
    if ($IncludeListener) {
        $listenerIds = @(Get-ListeningProcessIds $BackendPort)
        Assert-ListenerIdentity 'backend' $BackendPort $listenerIds $Snapshot
        $ids += $listenerIds
    }
    foreach ($processId in @($ids | Select-Object -Unique)) {
        $processInfo = $Snapshot[[int]$processId]
        if ($null -ne $processInfo -and (Test-IsWorkspaceBackend $processInfo)) {
            Stop-VerifiedProcessTree $processInfo $Snapshot 'Microi 后端'
        }
    }
}

function Invoke-StopFrontend([hashtable]$Snapshot) {
    $listenerIds = @(Get-ListeningProcessIds $FrontendPort)
    Assert-ListenerIdentity 'frontend' $FrontendPort $listenerIds $Snapshot
    foreach ($processId in $listenerIds) {
        $processInfo = $Snapshot[[int]$processId]
        if ($null -ne $processInfo -and (Test-IsWorkspaceFrontend $processInfo)) {
            Stop-VerifiedProcessTree $processInfo $Snapshot 'Microi Vite 前端'
        }
    }
}

try {
    switch ($Action) {
        'Status' {
            Show-Status
        }
        'StopBackend' {
            $snapshot = Get-ProcessSnapshot
            Invoke-StopBackend $snapshot -IncludeListener
            Assert-ReleaseFilesUnlocked
            Write-Info '后端清理完成。'
        }
        'StopFrontend' {
            $snapshot = Get-ProcessSnapshot
            Invoke-StopFrontend $snapshot
            Write-Info '前端清理完成。'
        }
        'PrepareRelease' {
            Write-Info '进入发布独占准备：只处理当前工作区的 61501 后端、61500 Vite 和额外 Release 后端。'
            $snapshot = Get-ProcessSnapshot
            Invoke-StopBackend $snapshot -IncludeListener
            $snapshot = Get-ProcessSnapshot
            Invoke-StopFrontend $snapshot

            if (@(Get-ListeningProcessIds $BackendPort).Count -gt 0) {
                throw "后端端口 $BackendPort 未释放。"
            }
            if (@(Get-ListeningProcessIds $FrontendPort).Count -gt 0) {
                throw "前端端口 $FrontendPort 未释放。"
            }
            Assert-ReleaseFilesUnlocked
            Write-Info '发布独占准备完成；未结束 Edge/Chrome、VS Code、Playwright Test Server、数据库或 Redis。'
        }
    }
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}

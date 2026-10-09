[CmdletBinding()]
param(
    [ValidateSet('Status', 'AssertServiceStart', 'PrepareRelease', 'StopBackend', 'StopFrontend')]
    [string]$Action = 'Status',
    [string]$WorkspaceRoot = '',
    [int]$BackendPort = 61501,
    [int]$FrontendPort = 61500,
    [ValidateSet('api', 'pc', 'all')]
    [string]$ReleaseScope = 'all'
)

# 只读盘点：
# powershell -NoProfile -ExecutionPolicy Bypass -File Microi.Server/tools/Microi.LocalProcessManager.ps1 -Action Status
# 发布前精确清理：
# powershell -NoProfile -ExecutionPolicy Bypass -File Microi.Server/tools/Microi.LocalProcessManager.ps1 -Action PrepareRelease

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$isWindowsHost = $env:OS -eq 'Windows_NT'

if ([string]::IsNullOrWhiteSpace($WorkspaceRoot)) {
    $WorkspaceRoot = Join-Path $PSScriptRoot '..\..'
}

$resolvedWorkspace = (Resolve-Path -LiteralPath $WorkspaceRoot).Path.TrimEnd('\', '/')
$normalizedWorkspace = $resolvedWorkspace.Replace('/', '\').ToLowerInvariant()
$backendRoot = (Join-Path $resolvedWorkspace 'Microi.Server\Microi.net.Api').Replace('/', '\').ToLowerInvariant()
$frontendRoot = (Join-Path $resolvedWorkspace 'Microi.Client').Replace('/', '\').ToLowerInvariant()
$releaseOutput = Join-Path $resolvedWorkspace 'Microi.Server\Microi.net.Api\bin\Release'
$releaseLockTool = Join-Path $PSScriptRoot 'release-lock.mjs'
$processCurrentDirectoryCache = @{}
if (-not $isWindowsHost) {
    # POSIX 身份保留路径大小写；命令行或 CWD 无法回读时仍失败关闭。
    $backendRoot = Join-Path $resolvedWorkspace 'Microi.Server/Microi.net.Api'
    $frontendRoot = Join-Path $resolvedWorkspace 'Microi.Client'
}


# Win32_Process 不公开进程当前目录。Vite 子进程由相对路径启动且父 npm/终端已经退出时，
# CommandLine 只剩 node_modules/vite/bin/vite.js，无法证明它属于哪个工作区。这里通过只读
# Windows 进程参数回读 CWD；读取失败时返回空，后续身份校验继续失败关闭。
if ($isWindowsHost -and $null -eq ('Microi.ProcessTools.NativeProcessInspector' -as [type])) {
    Add-Type -Language CSharp -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

namespace Microi.ProcessTools
{
    public static class NativeProcessInspector
    {
        [StructLayout(LayoutKind.Sequential)]
        private struct ProcessBasicInformation
        {
            public IntPtr Reserved1;
            public IntPtr PebBaseAddress;
            public IntPtr Reserved2_0;
            public IntPtr Reserved2_1;
            public IntPtr UniqueProcessId;
            public IntPtr Reserved3;
        }

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr OpenProcess(uint desiredAccess, bool inheritHandle, int processId);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool ReadProcessMemory(
            IntPtr processHandle,
            IntPtr baseAddress,
            [Out] byte[] buffer,
            IntPtr size,
            out IntPtr bytesRead);

        [DllImport("kernel32.dll")]
        private static extern bool CloseHandle(IntPtr handle);

        [DllImport("ntdll.dll")]
        private static extern int NtQueryInformationProcess(
            IntPtr processHandle,
            int processInformationClass,
            ref ProcessBasicInformation processInformation,
            int processInformationLength,
            out int returnLength);

        [DllImport("ntdll.dll")]
        private static extern int NtQueryInformationProcess(
            IntPtr processHandle,
            int processInformationClass,
            ref IntPtr processInformation,
            int processInformationLength,
            out int returnLength);

        private static byte[] ReadBytes(IntPtr processHandle, long address, int count)
        {
            var buffer = new byte[count];
            IntPtr bytesRead;
            if (!ReadProcessMemory(
                    processHandle,
                    new IntPtr(address),
                    buffer,
                    new IntPtr(count),
                    out bytesRead)
                || bytesRead.ToInt64() != count)
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }
            return buffer;
        }

        private static long ReadPointer(IntPtr processHandle, long address, int pointerSize)
        {
            var bytes = ReadBytes(processHandle, address, pointerSize);
            return pointerSize == 8
                ? BitConverter.ToInt64(bytes, 0)
                : BitConverter.ToUInt32(bytes, 0);
        }

        public static string GetCurrentDirectory(int processId)
        {
            const uint ProcessQueryInformation = 0x0400;
            const uint ProcessVmRead = 0x0010;
            var processHandle = OpenProcess(
                ProcessQueryInformation | ProcessVmRead,
                false,
                processId);
            if (processHandle == IntPtr.Zero)
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }

            try
            {
                var basicInformation = new ProcessBasicInformation();
                int returnLength;
                var status = NtQueryInformationProcess(
                    processHandle,
                    0,
                    ref basicInformation,
                    Marshal.SizeOf(typeof(ProcessBasicInformation)),
                    out returnLength);
                if (status != 0)
                {
                    throw new InvalidOperationException(
                        "NtQueryInformationProcess(ProcessBasicInformation) failed: " + status);
                }

                var pointerSize = IntPtr.Size;
                var pebAddress = basicInformation.PebBaseAddress.ToInt64();
                if (IntPtr.Size == 8)
                {
                    var wow64PebAddress = IntPtr.Zero;
                    status = NtQueryInformationProcess(
                        processHandle,
                        26,
                        ref wow64PebAddress,
                        IntPtr.Size,
                        out returnLength);
                    if (status == 0 && wow64PebAddress != IntPtr.Zero)
                    {
                        pointerSize = 4;
                        pebAddress = wow64PebAddress.ToInt64();
                    }
                }

                var processParametersOffset = pointerSize == 8 ? 0x20 : 0x10;
                var processParametersAddress = ReadPointer(
                    processHandle,
                    pebAddress + processParametersOffset,
                    pointerSize);
                if (processParametersAddress == 0) return string.Empty;

                var currentDirectoryOffset = pointerSize == 8 ? 0x38 : 0x24;
                var unicodeStringHeader = ReadBytes(
                    processHandle,
                    processParametersAddress + currentDirectoryOffset,
                    4);
                var byteLength = BitConverter.ToUInt16(unicodeStringHeader, 0);
                if (byteLength == 0 || byteLength > 32768 || byteLength % 2 != 0)
                {
                    return string.Empty;
                }

                var bufferOffset = pointerSize == 8 ? 8 : 4;
                var bufferAddress = ReadPointer(
                    processHandle,
                    processParametersAddress + currentDirectoryOffset + bufferOffset,
                    pointerSize);
                if (bufferAddress == 0) return string.Empty;

                return Encoding.Unicode
                    .GetString(ReadBytes(processHandle, bufferAddress, byteLength))
                    .TrimEnd('\0');
            }
            finally
            {
                CloseHandle(processHandle);
            }
        }
    }
}
'@
}

function Write-Info([string]$Message) {
    Write-Host "[Microi process manager] $Message"
}

function Get-PosixProcessSnapshot {
    $commands = @{}
    & ps -axo 'pid=,args=' | ForEach-Object {
        if ($_ -match '^\s*(\d+)\s+(.*)$') { $commands[[int]$Matches[1]] = $Matches[2] }
    }
    if ($LASTEXITCODE -ne 0) { throw '无法只读回读进程命令行，已停止。' }
    $result = @{}
    & ps -axo 'pid=,ppid=,comm=' | ForEach-Object {
        if ($_ -match '^\s*(\d+)\s+(\d+)\s+(.*)$') {
            $processId = [int]$Matches[1]
            $parentId = [int]$Matches[2]
            $executable = $Matches[3].Trim()
            $name = [System.IO.Path]::GetFileName($executable)
            $startTicks = 0L
            if ($name -match '^(node|dotnet|Microi\.net\.Api(?:\.exe)?)$') {
                try { $startTicks = (Get-Process -Id $processId -ErrorAction Stop).StartTime.Ticks } catch {}
            }
            $result[$processId] = [PSCustomObject]@{
                ProcessId = $processId; ParentProcessId = $parentId; Name = $name
                CommandLine = [string]$commands[$processId]; ExecutablePath = $executable
                StartTimeTicks = $startTicks
            }
        }
    }
    if ($LASTEXITCODE -ne 0) { throw '无法只读回读进程身份，已停止。' }
    return $result
}

function Get-ProcessSnapshot {
    if (-not $isWindowsHost) { return Get-PosixProcessSnapshot }
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

function Get-ProcessCurrentDirectory($ProcessInfo) {
    if ($null -eq $ProcessInfo) { return '' }
    $processId = [int]$ProcessInfo.ProcessId
    if ($processCurrentDirectoryCache.ContainsKey($processId)) {
        return [string]$processCurrentDirectoryCache[$processId]
    }

    $currentDirectory = ''
    try {
        if ($isWindowsHost) {
            $rawDirectory = [Microi.ProcessTools.NativeProcessInspector]::GetCurrentDirectory($processId)
        } else {
            $cwd = @(& lsof -a -p $processId -d cwd -Fn 2>$null | Where-Object { $_.StartsWith('n/') })
            if ($LASTEXITCODE -ne 0 -or $cwd.Count -ne 1) { throw '进程工作目录无法唯一回读。' }
            $rawDirectory = $cwd[0].Substring(1)
            $currentDirectory = [System.IO.Path]::GetFullPath($rawDirectory).TrimEnd('/')
            $processCurrentDirectoryCache[$processId] = $currentDirectory
            return $currentDirectory
        }
        if (-not [string]::IsNullOrWhiteSpace($rawDirectory)) {
            $currentDirectory = ([System.IO.Path]::GetFullPath($rawDirectory)).TrimEnd('\', '/').Replace('/', '\').ToLowerInvariant()
        }
    }
    catch {
        # 权限不足、位数不兼容或进程瞬时退出时保持空值；身份判断必须继续失败关闭。
    }
    $processCurrentDirectoryCache[$processId] = $currentDirectory
    return $currentDirectory
}

function Test-IsWorkspaceBackend($ProcessInfo) {
    if (-not $isWindowsHost) {
        $name = ([string]$ProcessInfo.Name).ToLowerInvariant()
        if ($name -eq 'microi.net.api') {
            # macOS/Linux 的 dotnet run 会启动无扩展名 apphost；可执行文件必须
            # 精确位于当前 API 项目的 bin 或 Full 的独立编译目录，并保留规范路径与 CWD 的身份校验。
            # 同名外部程序、路径越界或无法读取身份时均拒绝结束。
            $executable = [string]$ProcessInfo.ExecutablePath
            try { $canonicalExecutable = [System.IO.Path]::GetFullPath($executable) } catch { return $false }
            if ($executable -cne $canonicalExecutable) { return $false }
            $isProjectOutput = $executable.StartsWith($backendRoot + '/bin/', [StringComparison]::Ordinal)
            # Full 使用 UseArtifactsOutput 隔离编译；只接受当前工作区内固定协议的
            # 日期-时间-PID 目录与 API apphost，不能因 CWD 正确而接受任意外部文件。
            $gateRoot = Join-Path $resolvedWorkspace '.tmp/microi-release-gate'
            $gatePattern = '^' + [regex]::Escape($gateRoot) + '/[0-9]{8}-[0-9]{6}-[0-9]+/\.net-artifacts/bin/Microi\.net\.Api/(debug|release)/Microi\.net\.Api$'
            $isIsolatedFullOutput = [regex]::IsMatch($executable, $gatePattern, [System.Text.RegularExpressions.RegexOptions]::CultureInvariant)
            if (-not $isProjectOutput -and -not $isIsolatedFullOutput) { return $false }
            if ([System.IO.Path]::GetFileName($executable) -cne 'Microi.net.Api') { return $false }
            return (Get-ProcessCurrentDirectory $ProcessInfo) -ceq $backendRoot
        }
        if ($name -ne 'dotnet' -and $name -ne 'microi.net.api.exe') { return $false }
        $text = Get-CommandText $ProcessInfo
        if (-not ($text.Contains('microi.net.api.dll') -or $text.Contains('microi.net.api.exe') -or $text.Contains('microi.net.api.csproj') -or $text.Contains('dotnet run'))) { return $false }
        return (Get-ProcessCurrentDirectory $ProcessInfo) -ceq $backendRoot
    }
    $processName = ([string]$ProcessInfo.Name).ToLowerInvariant()
    if ($processName -ne 'dotnet.exe' -and $processName -ne 'microi.net.api.exe') { return $false }
    $text = Get-CommandText $ProcessInfo
    $isBackendEntry = $text.Contains('microi.net.api.dll') `
        -or $text.Contains('microi.net.api.exe') `
        -or $text.Contains('microi.net.api.csproj') `
        -or $text.Contains('dotnet run')
    if (-not $isBackendEntry) { return $false }
    if ($text.Contains($backendRoot)) { return $true }

    # Isolated integration tests can publish Microi.net.Api.exe to a temporary
    # output directory while deliberately keeping the real API project as CWD.
    # Accept only that exact executable + exact project-directory combination;
    # dotnet, another process name, an unreadable CWD, or any other directory
    # continues to fail closed.
    if ($processName -ne 'microi.net.api.exe' -or -not $text.Contains('microi.net.api.exe')) { return $false }
    return (Get-ProcessCurrentDirectory $ProcessInfo) -eq $backendRoot
}

function Test-IsWorkspaceFrontend($ProcessInfo) {
    if (-not $isWindowsHost) {
        if (([string]$ProcessInfo.Name).ToLowerInvariant() -ne 'node') { return $false }
        $text = Get-CommandText $ProcessInfo
        if (-not ($text.Contains('node_modules\') -and $text.Contains('\vite\bin\vite'))) { return $false }
        return (Get-ProcessCurrentDirectory $ProcessInfo) -ceq $frontendRoot
    }
    $processName = ([string]$ProcessInfo.Name).ToLowerInvariant()
    if ($processName -ne 'node.exe') { return $false }
    $text = Get-CommandText $ProcessInfo
    # npm on Windows may launch Vite through the `.bin\\..` shim, leaving a
    # command such as `node_modules\.bin\\..\vite\bin\vite.js`. Recognize the
    # stable node_modules + Vite entry suffix; ownership still requires either
    # the absolute frontend root in the command or an exact process CWD match.
    $isVite = $text.Contains('node_modules\') -and $text.Contains('\vite\bin\vite')
    if (-not $isVite -and -not $text.Contains('npm-cli.js')) { return $false }
    if ($text.Contains($frontendRoot)) { return $true }

    # npm/终端父进程退出后，Vite 的相对入口不会再携带工作区绝对路径。
    # 只有精确 Vite 入口且进程 CWD 等于本工作区 Microi.Client 时才接受；
    # “父进程不存在”本身永远不是归属证据。
    if (-not $isVite) { return $false }
    return (Get-ProcessCurrentDirectory $ProcessInfo) -eq $frontendRoot
}

function Get-ListeningProcessIds([int]$Port) {
    if (-not $isWindowsHost) {
        $ids = @(& lsof -nP "-iTCP:$Port" -sTCP:LISTEN -t 2>$null | Where-Object { $_ -match '^\d+$' } | Select-Object -Unique)
        if ($LASTEXITCODE -gt 1) { throw '无法回读监听端口，已停止。' }
        return @($ids | ForEach-Object { [int]$_ })
    }
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
    $currentDirectory = Get-ProcessCurrentDirectory $ProcessInfo
    $directoryLabel = if ([string]::IsNullOrWhiteSpace($currentDirectory)) {
        ''
    }
    else {
        "，工作目录=$currentDirectory"
    }
    $commandLine = ([string]$ProcessInfo.CommandLine).Trim()
    if ($commandLine.Length -gt 260) {
        $commandLine = $commandLine.Substring(0, 260) + '...'
    }
    return "PID=$processId，进程=$($ProcessInfo.Name)，内存=$(Get-WorkingSetMb $processId)MB$orphanLabel$directoryLabel，命令=$commandLine"
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

# POSIX 的已退出子进程可能等待父进程回收而暂时保留 PID；僵尸状态已不持有资源。
function Get-LivePosixProcess([int]$ProcessId) {
    $state = @(& /bin/ps -p $ProcessId -o stat= 2>$null)
    if ($LASTEXITCODE -ne 0 -or $state.Count -eq 0) { return $null }
    if ($state.Count -ne 1) { throw '进程状态无法唯一回读，已停止。' }
    if ($state[0].Trim().StartsWith('Z')) { return $null }
    return Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
}

function Stop-VerifiedProcessTree($ProcessInfo, [hashtable]$Snapshot, [string]$Reason) {
    if ($null -eq $ProcessInfo) { return }
    $processId = [int]$ProcessInfo.ProcessId
    if ($processId -eq $PID) {
        throw "拒绝结束进程管理器自身 PID=$processId"
    }
    if ($null -eq (Get-Process -Id $processId -ErrorAction SilentlyContinue)) { return }

    Write-Info "正在结束 $Reason：$(Get-ProcessSummary $ProcessInfo $Snapshot)"
    if (-not $isWindowsHost) {
        # 终止前复核进程启动时间，拒绝 PID 复用；只遍历这个已证明归属的根进程后代。
        $live = Get-LivePosixProcess $processId
        if ($null -eq $live) { return }
        if ($ProcessInfo.StartTimeTicks -le 0 -or $live.StartTime.Ticks -ne $ProcessInfo.StartTimeTicks) { throw '目标 PID 身份已变化，拒绝结束。' }
        $tree = [System.Collections.Generic.List[object]]::new()
        function Add-Descendant([int]$parent) {
            foreach ($child in $Snapshot.Values | Where-Object { [int]$_.ParentProcessId -eq $parent }) {
                if ([int]$child.ProcessId -eq $PID) { throw '拒绝结束进程管理器自身。' }
                Add-Descendant ([int]$child.ProcessId)
                try { $running = Get-LivePosixProcess ([int]$child.ProcessId); $tree.Add(@{ Id = $running.Id; Start = $running.StartTime.Ticks }) } catch {}
            }
        }
        Add-Descendant $processId
        $tree.Add(@{ Id = $processId; Start = $live.StartTime.Ticks })
        foreach ($target in $tree) {
            $running = Get-LivePosixProcess $target.Id
            if ($null -ne $running -and $running.StartTime.Ticks -eq $target.Start) { & /bin/kill -TERM $target.Id 2>$null }
        }
        $deadline = [DateTime]::UtcNow.AddSeconds(5)
        while ([DateTime]::UtcNow -lt $deadline -and (Get-LivePosixProcess $processId)) { Start-Sleep -Milliseconds 100 }
        foreach ($target in $tree) {
            $running = Get-LivePosixProcess $target.Id
            if ($null -ne $running -and $running.StartTime.Ticks -eq $target.Start) { & /bin/kill -KILL $target.Id 2>$null }
        }
        if (Get-LivePosixProcess $processId) { throw "无法结束已验证的根进程 PID=$processId" }
        return
    }
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
        # catch 中的 $_ 会变为 ErrorRecord，提前保留文件路径才能报告真正的占用原因。
        $releaseFilePath = $_.FullName
        $stream = $null
        try {
            $stream = [System.IO.File]::Open(
                $releaseFilePath,
                [System.IO.FileMode]::Open,
                [System.IO.FileAccess]::ReadWrite,
                [System.IO.FileShare]::None)
        }
        catch {
            $locked += [PSCustomObject]@{ Path = $releaseFilePath; Error = $_.Exception.Message }
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
    $lockJson = & node $releaseLockTool status platform $resolvedWorkspace
    if ($LASTEXITCODE -ne 0) { throw '无法核验发布锁范围。' }
    foreach ($releaseLock in @($lockJson | ConvertFrom-Json)) {
        Write-Info "发布锁 $($releaseLock.domain)：存在=$($releaseLock.exists)，路径=$($releaseLock.path)"
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
    # 服务与发布按产品范围匹配；官网与 Agent 不阻塞 API/PC 的启动或清理。
    $scopes = switch ($Action) {
        'StopBackend' { @('api') }
        'StopFrontend' { @('pc') }
        default { if ($ReleaseScope -eq 'all') { @('api', 'pc') } else { @($ReleaseScope) } }
    }
    if ($Action -ne 'Status') {
        $ownerToken = if ($Action -eq 'PrepareRelease') { $env:MICROI_RELEASE_LOCK_TOKEN } else { '' }
        foreach ($scope in $scopes) {
            & node $releaseLockTool assert $scope $resolvedWorkspace $ownerToken
            if ($LASTEXITCODE -ne 0) { throw "$scope 发布正在进行，禁止停止或重启该范围的共享服务。" }
        }
    }
    switch ($Action) {
        'AssertServiceStart' { Write-Info "服务启动锁检查通过：$($scopes -join ', ')。" }

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
            Write-Info "进入发布准备：仅处理所选范围 $($scopes -join ', ') 的本工作区服务。"
            if ($scopes -contains 'api') {
                $snapshot = Get-ProcessSnapshot
                Invoke-StopBackend $snapshot -IncludeListener
                if (@(Get-ListeningProcessIds $BackendPort).Count -gt 0) { throw "后端端口 $BackendPort 未释放。" }
                Assert-ReleaseFilesUnlocked
            }
            if ($scopes -contains 'pc') {
                $snapshot = Get-ProcessSnapshot
                Invoke-StopFrontend $snapshot
                if (@(Get-ListeningProcessIds $FrontendPort).Count -gt 0) { throw "前端端口 $FrontendPort 未释放。" }
            }
            Write-Info '发布准备完成；未处理其它发布范围、浏览器、VS Code、数据库或 Redis。'
        }
    }
}
catch {
    Write-Error $_.Exception.Message
    exit 1
}

[CmdletBinding()]
param([Parameter(Mandatory)][string]$ProcessIds, [Parameter(Mandatory)][string]$WorkspaceRoot, [switch]$AllowMissing)
$ErrorActionPreference = 'Stop'
$isWindowsHost = $env:OS -eq 'Windows_NT'
if ($isWindowsHost) {
    # Reuse the process manager's existing read-only native CWD inspector, without
    # invoking its service/lock operations or maintaining a second PEB implementation.
    $manager = Get-Content -LiteralPath (Join-Path $WorkspaceRoot 'Microi.Server/tools/Microi.LocalProcessManager.ps1') -Raw
    $start = $manager.IndexOf("if (`$isWindowsHost -and `$null -eq ('Microi.ProcessTools.NativeProcessInspector' -as [type])) {")
    $end = $manager.IndexOf('function Write-Info', $start)
    if ($start -lt 0 -or $end -le $start) { throw 'The trusted read-only process inspector is unavailable.' }
    & ([scriptblock]::Create($manager.Substring($start, $end - $start)))
}
if ($ProcessIds -notmatch '^[1-9][0-9]*(,[1-9][0-9]*)*$') { throw 'Invalid process identity selection.' }
# 同一轮只读取一次进程表和TCP监听表，避免四个PID触发四遍慢CIM扫描。
# 仅归并观察成本；仍逐PID检查存在性、完整身份、原生CWD和全部监听端口，不隐藏额外端口。
$selectedProcessIds = @($ProcessIds.Split(',') | ForEach-Object { [int]$_ })
$processFilter = ($selectedProcessIds | ForEach-Object { "ProcessId=$_" }) -join ' OR '
if (-not $isWindowsHost) { throw 'Staged runtime process identity currently requires the supported Windows native Full host.' }
$observedProcesses = @(Get-CimInstance Win32_Process -Filter $processFilter)
$observedListeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue)
$rows = @(foreach ($processIdText in $ProcessIds.Split(',')) {
    $processId = [int]$processIdText
    if ($isWindowsHost) {
        $process = $observedProcesses | Where-Object { $_.ProcessId -eq $processId }
        if ($null -eq $process -and $AllowMissing) { continue }
        if ($null -eq $process -or -not $process.CommandLine -or -not $process.ExecutablePath) { throw 'Owned runtime process is unavailable.' }
        [ordered]@{
            pid = [int]$process.ProcessId; parentPid = [int]$process.ParentProcessId
            exe = $process.ExecutablePath; commandLine = $process.CommandLine
            creationDate = $process.CreationDate.ToUniversalTime().ToString('o')
            cwd = [Microi.ProcessTools.NativeProcessInspector]::GetCurrentDirectory($processId)
            listeningPorts = @(($observedListeners | Where-Object { $_.OwningProcess -eq $processId }).LocalPort)
        }
    } else { throw 'Staged runtime process identity currently requires the supported Windows native Full host.' }
})
ConvertTo-Json -InputObject $rows -Depth 5 -Compress

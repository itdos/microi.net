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
$rows = @(foreach ($processIdText in $ProcessIds.Split(',')) {
    $processId = [int]$processIdText
    if ($isWindowsHost) {
        $process = Get-CimInstance Win32_Process -Filter "ProcessId=$processId"
        if ($null -eq $process -and $AllowMissing) { continue }
        if ($null -eq $process -or -not $process.CommandLine -or -not $process.ExecutablePath) { throw 'Owned runtime process is unavailable.' }
        [ordered]@{
            pid = [int]$process.ProcessId; parentPid = [int]$process.ParentProcessId
            exe = $process.ExecutablePath; commandLine = $process.CommandLine
            creationDate = $process.CreationDate.ToUniversalTime().ToString('o')
            cwd = [Microi.ProcessTools.NativeProcessInspector]::GetCurrentDirectory($processId)
            listeningPorts = @((Get-NetTCPConnection -State Listen -OwningProcess $processId -ErrorAction SilentlyContinue).LocalPort)
        }
    } else { throw 'Staged runtime process identity currently requires the supported Windows native Full host.' }
})
ConvertTo-Json -InputObject $rows -Depth 5 -Compress

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('Suspend', 'Resume')]
    [string]$Action,

    [Parameter(Mandatory = $true)]
    [ValidateRange(1, 2147483647)]
    [int]$RootPid
)

$ErrorActionPreference = 'Stop'

if (-not ('MicroiProcessMemoryControl.NativeMethods' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace MicroiProcessMemoryControl
{
    public static class NativeMethods
    {
        private const uint ProcessSuspendResume = 0x0800;

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern IntPtr OpenProcess(
            uint desiredAccess,
            bool inheritHandle,
            uint processId
        );

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool CloseHandle(IntPtr handle);

        [DllImport("ntdll.dll")]
        private static extern int NtSuspendProcess(IntPtr processHandle);

        [DllImport("ntdll.dll")]
        private static extern int NtResumeProcess(IntPtr processHandle);

        public static void SetSuspended(int processId, bool suspended)
        {
            IntPtr handle = OpenProcess(ProcessSuspendResume, false, unchecked((uint)processId));
            if (handle == IntPtr.Zero)
            {
                throw new InvalidOperationException(
                    "OpenProcess failed for PID " + processId + ", Win32Error=" +
                    Marshal.GetLastWin32Error()
                );
            }

            try
            {
                int status = suspended
                    ? NtSuspendProcess(handle)
                    : NtResumeProcess(handle);
                if (status != 0)
                {
                    throw new InvalidOperationException(
                        (suspended ? "NtSuspendProcess" : "NtResumeProcess") +
                        " failed for PID " + processId + ", NTSTATUS=0x" +
                        unchecked((uint)status).ToString("X8")
                    );
                }
            }
            finally
            {
                CloseHandle(handle);
            }
        }
    }
}
'@
}

$allProcesses = @(Get-CimInstance Win32_Process |
    Select-Object ProcessId, ParentProcessId)

$root = $allProcesses | Where-Object { $_.ProcessId -eq $RootPid } | Select-Object -First 1
if (-not $root) {
    Write-Output "Root PID $RootPid has already exited."
    exit 0
}

$childrenByParent = @{}
foreach ($process in $allProcesses) {
    $parentId = [int]$process.ParentProcessId
    if (-not $childrenByParent.ContainsKey($parentId)) {
        $childrenByParent[$parentId] = @()
    }
    $childrenByParent[$parentId] += $process
}

$targets = @([pscustomobject]@{ ProcessId = $RootPid; Depth = 0 })
Write-Verbose ("RootPid={0}; initial target count={1}" -f $RootPid, $targets.Count)
for ($index = 0; $index -lt $targets.Count; $index++) {
    $current = $targets[$index]
    if (-not $childrenByParent.ContainsKey([int]$current.ProcessId)) {
        continue
    }

    foreach ($child in $childrenByParent[[int]$current.ProcessId]) {
        $targets += [pscustomobject]@{
            ProcessId = [int]$child.ProcessId
            Depth = [int]$current.Depth + 1
        }
    }
}

# 深层子进程优先，根进程最后处理。
Write-Verbose ("Target count after discovery={0}" -f $targets.Count)
$orderedTargets = @($targets | Sort-Object -Property Depth -Descending)
$controlled = @()
Write-Verbose ("Discovered targets: {0}" -f (($orderedTargets | ForEach-Object { $_.ProcessId }) -join ','))

foreach ($target in $orderedTargets) {
    $processId = [int]$target.ProcessId
    Write-Verbose ("Controlling PID {0}" -f $processId)
    if (-not (Get-Process -Id $processId -ErrorAction SilentlyContinue)) {
        continue
    }

    [MicroiProcessMemoryControl.NativeMethods]::SetSuspended(
        $processId,
        $Action -eq 'Suspend'
    )
    $controlled += $processId
}

Write-Output ("{0} process tree: {1}" -f $Action, ($controlled -join ','))

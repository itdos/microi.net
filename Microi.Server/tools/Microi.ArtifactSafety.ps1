function Assert-MicroiArtifactPath {
    param([Parameter(Mandatory=$true)][string]$LiteralPath)
    $absolute = [IO.Path]::GetFullPath($LiteralPath)
    if ($absolute -eq [IO.Path]::GetPathRoot($absolute)) { throw 'Artifact cleanup refuses a filesystem root.' }
    # 逐级检查祖先，不能把链接后的字符串前缀当成真实边界。
    $ancestor = $absolute
    while ($ancestor) {
        $item = $null
        try { $item = Get-Item -LiteralPath $ancestor -Force -ErrorAction Stop }
        catch { if ($_.CategoryInfo.Category -ne 'ObjectNotFound') { throw } }
        if ($item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Artifact cleanup refused a reparse point: $ancestor" }
        $ancestor = [IO.Path]::GetDirectoryName($ancestor)
    }
}

function Assert-MicroiArtifactTree {
    param([Parameter(Mandatory=$true)][string]$LiteralPath)
    Assert-MicroiArtifactPath -LiteralPath $LiteralPath
    $absolute = [IO.Path]::GetFullPath($LiteralPath)
    $cwd = [IO.Path]::GetFullPath((Get-Location).Path)
    $prefix = $absolute.TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
    if ($cwd -eq $absolute -or $cwd.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { throw "Artifact cleanup refused its current working directory: $absolute" }
    if (-not (Test-Path -LiteralPath $absolute)) { return }
    $pending = [Collections.Generic.Stack[string]]::new()
    $pending.Push($absolute)
    while ($pending.Count -gt 0) {
        $entry = Get-Item -LiteralPath $pending.Pop() -Force -ErrorAction Stop
        if ($entry.Name -eq '.git' -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Artifact cleanup refused a Git marker or reparse point: $($entry.FullName)" }
        $protected = [IO.FileAttributes]::ReadOnly
        if ($env:OS -eq 'Windows_NT') { $protected = $protected -bor [IO.FileAttributes]::Hidden -bor [IO.FileAttributes]::System }
        if ($entry.Attributes -band $protected) { throw "Artifact cleanup preserved protected attributes: $($entry.FullName)" }
        if ($entry.PSIsContainer) {
            foreach ($child in Get-ChildItem -LiteralPath $entry.FullName -Force -ErrorAction Stop) { $pending.Push($child.FullName) }
        } elseif ($env:OS -eq 'Windows_NT') {
            # 删除任何文件或输出链接前检查占用；不终止进程、不清属性或修改 ACL。
            $stream = [IO.File]::Open($entry.FullName, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::None)
            $stream.Dispose()
        }
    }
}

function Remove-MicroiOrdinaryArtifact {
    param([Parameter(Mandatory=$true)][string]$LiteralPath, [Parameter(Mandatory=$true)][string]$ExpectedParent)
    $absolute = [IO.Path]::GetFullPath($LiteralPath)
    if ([IO.Path]::GetDirectoryName($absolute) -ne [IO.Path]::GetFullPath($ExpectedParent)) { throw 'Artifact cleanup target is not a direct child of its registered parent.' }
    Assert-MicroiArtifactTree -LiteralPath $absolute
    if (Test-Path -LiteralPath $absolute) { Remove-Item -LiteralPath $absolute -Recurse -ErrorAction Stop }
    if (Test-Path -LiteralPath $absolute) { throw "Artifact cleanup readback failed: $absolute" }
}

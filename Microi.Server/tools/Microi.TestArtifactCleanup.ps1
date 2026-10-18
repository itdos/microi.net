function Remove-MicroiOwnedTestArtifacts {
    [CmdletBinding()]
    param([string]$ArtifactTarget, [string]$ArtifactLink, [Parameter(Mandatory=$true)][string]$ResultsDirectory)

    # 只接收本次入口新建并记录的路径；已有目录不取得所有权。
    $results = [IO.Path]::GetFullPath($ResultsDirectory)
    if ($ArtifactTarget) {
        $target = [IO.Path]::GetFullPath($ArtifactTarget)
        $expected = [IO.Path]::GetFullPath((Join-Path $results '.net-artifacts'))
        if ($target -ne $expected -or $target -eq $results) { throw 'Owned test artifact target escaped its results directory.' }
        if (Test-Path -LiteralPath $target) {
            $pending = [Collections.Generic.Stack[string]]::new()
            $pending.Push($target)
            while ($pending.Count -gt 0) {
                $current = Get-Item -LiteralPath $pending.Pop() -Force -ErrorAction Stop
                if (($current.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Artifact cleanup refused a reparse point: $($current.FullName)" }
                foreach ($entry in Get-ChildItem -LiteralPath $current.FullName -Force -ErrorAction Stop) {
                    if ($entry.Name -eq '.git' -or ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                        throw "Artifact cleanup refused a Git marker or reparse point: $($entry.FullName)"
                    }
                    if ($entry.PSIsContainer) { $pending.Push($entry.FullName) }
                }
            }
        }
    }
    if ($ArtifactLink) {
        $link = [IO.Path]::GetFullPath($ArtifactLink)
        if (-not $ArtifactTarget) { throw 'An owned artifact link requires its owned target.' }
        $item = Get-Item -LiteralPath $link -Force -ErrorAction SilentlyContinue
        if ($null -ne $item) {
            $actualTarget = @($item.Target) | Select-Object -First 1
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0 -or
                [string]::IsNullOrWhiteSpace($actualTarget) -or [IO.Path]::GetFullPath($actualTarget) -ne $target) {
                throw "Owned artifact link identity changed: $link"
            }
            # 非递归移除链接本身，不能沿链接删除目标。
            [IO.Directory]::Delete($link)
        }
    }
    if ($ArtifactTarget -and (Test-Path -LiteralPath $target)) {
        Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction Stop
    }
    if (($ArtifactTarget -and (Test-Path -LiteralPath $target)) -or
        ($ArtifactLink -and (Get-Item -LiteralPath $link -Force -ErrorAction SilentlyContinue))) {
        throw 'Owned test artifact cleanup readback failed.'
    }
    [pscustomobject]@{ cleaned = $true; artifactTarget = $ArtifactTarget; artifactLink = $ArtifactLink }
}

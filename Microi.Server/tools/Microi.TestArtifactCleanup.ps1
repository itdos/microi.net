function Remove-MicroiOwnedTestArtifacts {
    [CmdletBinding()]
    param([string]$ArtifactTarget, [string]$ArtifactLink, [Parameter(Mandatory=$true)][string]$ResultsDirectory)
    . (Join-Path $PSScriptRoot 'Microi.ArtifactSafety.ps1')

    # 只接收本次入口新建并记录的路径；已有目录不取得所有权。
    $results = [IO.Path]::GetFullPath($ResultsDirectory)
    if ($ArtifactTarget) {
        $target = [IO.Path]::GetFullPath($ArtifactTarget)
        $expected = [IO.Path]::GetFullPath((Join-Path $results '.net-artifacts'))
        if ($target -ne $expected -or $target -eq $results) { throw 'Owned test artifact target escaped its results directory.' }
        Assert-MicroiArtifactTree -LiteralPath $target
    }
    if ($ArtifactLink) {
        $link = [IO.Path]::GetFullPath($ArtifactLink)
        if (-not $ArtifactTarget) { throw 'An owned artifact link requires its owned target.' }
        Assert-MicroiArtifactPath -LiteralPath ([IO.Path]::GetDirectoryName($link))
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
        Remove-Item -LiteralPath $target -Recurse -ErrorAction Stop
    }
    if (($ArtifactTarget -and (Test-Path -LiteralPath $target)) -or
        ($ArtifactLink -and (Get-Item -LiteralPath $link -Force -ErrorAction SilentlyContinue))) {
        throw 'Owned test artifact cleanup readback failed.'
    }
    [pscustomobject]@{ cleaned = $true; artifactTarget = $ArtifactTarget; artifactLink = $ArtifactLink }
}

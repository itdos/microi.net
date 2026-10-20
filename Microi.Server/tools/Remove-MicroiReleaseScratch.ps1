param([Parameter(Mandatory=$true)][string]$LiteralPath, [Parameter(Mandatory=$true)][string]$ExpectedParent)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
. (Join-Path $PSScriptRoot 'Microi.ArtifactSafety.ps1')
Remove-MicroiOrdinaryArtifact -LiteralPath $LiteralPath -ExpectedParent $ExpectedParent

[CmdletBinding()]
param([string]$ResultsDirectory, [string]$OutputFile, [string]$TrxFile)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
function Read-ReleaseTrx([string]$File) {
    $resolved = (Resolve-Path -LiteralPath $File).Path
    $bytes = [IO.File]::ReadAllBytes($resolved)
    $settings = [Xml.XmlReaderSettings]::new()
    $settings.DtdProcessing = [Xml.DtdProcessing]::Prohibit
    $settings.XmlResolver = $null
    $stream = [IO.MemoryStream]::new($bytes, $false)
    $reader = [Xml.XmlReader]::Create($stream, $settings)
    try {
        # 同一原始字节生成明细与指纹，禁用 DTD/外部实体，保留上游 TRX 读取的安全边界。
        $document = [Xml.XmlDocument]::new(); $document.XmlResolver = $null; $document.Load($reader)
        $namespaces = [Xml.XmlNamespaceManager]::new($document.NameTable)
        $namespaces.AddNamespace('t', 'http://microsoft.com/schemas/VisualStudio/TeamTest/2010')
        $summary = $document.SelectNodes('/t:TestRun/t:ResultSummary', $namespaces)
        $counterNodes = $document.SelectNodes('/t:TestRun/t:ResultSummary/t:Counters', $namespaces)
        $results = $document.SelectNodes('/t:TestRun/t:Results', $namespaces)
        if ($summary.Count -ne 1 -or $counterNodes.Count -ne 1 -or $results.Count -ne 1) { throw 'TRX requires unique results, summary and counter nodes.' }
        $counters = [ordered]@{}
        foreach ($attribute in $counterNodes[0].Attributes) {
            $number = 0
            if (-not [int]::TryParse($attribute.Value, [ref]$number) -or $number -lt 0) { throw 'Invalid TRX counter.' }
            $counters[$attribute.Name] = $number
        }
        $hasher = [Security.Cryptography.SHA256]::Create()
        try { $fingerprint = [BitConverter]::ToString($hasher.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant() } finally { $hasher.Dispose() }
        return [ordered]@{
            trxFile = $resolved; trxSha256 = $fingerprint; summaryOutcome = $summary[0].GetAttribute('outcome'); counters = $counters
            tests = @($document.SelectNodes('/t:TestRun/t:Results/t:UnitTestResult', $namespaces) | ForEach-Object {
                [ordered]@{ testName = $_.GetAttribute('testName'); outcome = $_.GetAttribute('outcome') }
            })
        }
    } finally { $reader.Dispose(); $stream.Dispose() }
}
if ($TrxFile) { Read-ReleaseTrx $TrxFile | ConvertTo-Json -Depth 8 -Compress; exit 0 }
$result = [ordered]@{}
foreach ($entry in @(@('quick', 'microi-quick.trx'), @('full', 'microi-full-stack.trx'))) {
    $result[$entry[0]] = Read-ReleaseTrx (Join-Path $ResultsDirectory $entry[1])
}
$geometryFile = Join-Path $ResultsDirectory 'search-select-label-geometry.json'
$geometry = Get-Content -LiteralPath $geometryFile -Raw | ConvertFrom-Json
function Geometry-Titles($Suites) {
    foreach ($suite in $Suites) {
        foreach ($spec in $suite.specs) { [string]$spec.title }
        if ($suite.suites) { Geometry-Titles $suite.suites }
    }
}
$result.geometry = [ordered]@{ stats = $geometry.stats; caseTitles = @(Geometry-Titles $geometry.suites); reportFile = [IO.Path]::GetFullPath($geometryFile); reportSha256 = (Get-FileHash -LiteralPath $geometryFile -Algorithm SHA256).Hash.ToLowerInvariant() }
[IO.File]::WriteAllText([IO.Path]::GetFullPath($OutputFile), ($result | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))

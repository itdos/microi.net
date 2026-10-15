param([Parameter(Mandatory = $true)][string]$TrxFile)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$file = (Resolve-Path -LiteralPath $TrxFile).Path
$bytes = [System.IO.File]::ReadAllBytes($file)
$settings = [System.Xml.XmlReaderSettings]::new()
$settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
$settings.XmlResolver = $null
$stream = [System.IO.MemoryStream]::new($bytes, $false)
$reader = [System.Xml.XmlReader]::Create($stream, $settings)
try {
    # 从同一次原始字节读取投影和指纹，禁用外部实体；JSON 回执不能替代权威 TRX。
    $document = [System.Xml.XmlDocument]::new()
    $document.XmlResolver = $null
    $document.Load($reader)
    $namespaces = [System.Xml.XmlNamespaceManager]::new($document.NameTable)
    $namespaces.AddNamespace('t', 'http://microsoft.com/schemas/VisualStudio/TeamTest/2010')
    $summaries = $document.SelectNodes('/t:TestRun/t:ResultSummary', $namespaces)
    $counters = $document.SelectNodes('/t:TestRun/t:ResultSummary/t:Counters', $namespaces)
    $results = $document.SelectNodes('/t:TestRun/t:Results', $namespaces)
    if ($summaries.Count -ne 1 -or $counters.Count -ne 1 -or $results.Count -ne 1) {
        throw 'TRX 必须具有唯一结果、汇总和统计节点。'
    }
    $counterValues = [ordered]@{}
    foreach ($attribute in $counters[0].Attributes) {
        $number = 0
        if (-not [int]::TryParse($attribute.Value, [ref]$number) -or $number -lt 0) { throw 'TRX 统计无效。' }
        $counterValues[$attribute.Name] = $number
    }
    $hash = [System.Security.Cryptography.SHA256]::Create()
    try { $fingerprint = [System.BitConverter]::ToString($hash.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant() }
    finally { $hash.Dispose() }
    [ordered]@{
        trxFile = $file
        trxSha256 = $fingerprint
        summaryOutcome = [string]$summaries[0].GetAttribute('outcome')
        counters = $counterValues
        tests = @($document.SelectNodes('/t:TestRun/t:Results/t:UnitTestResult', $namespaces) | ForEach-Object {
            [ordered]@{ testName = [string]$_.GetAttribute('testName'); outcome = [string]$_.GetAttribute('outcome') }
        })
    } | ConvertTo-Json -Depth 8 -Compress
}
finally { $reader.Dispose(); $stream.Dispose() }

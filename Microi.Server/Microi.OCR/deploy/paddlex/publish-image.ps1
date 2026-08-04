param(
    [string]$Image = 'registry.cn-hangzhou.aliyuncs.com/microios/paddlex-ocr:3.6.1-paddle3.2.2-cpu',
    [string]$ConfigPath = ''
)

$ErrorActionPreference = 'Stop'

$repositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..\..'))
if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
    $candidates = @(Get-ChildItem -LiteralPath $repositoryRoot -File -Filter 'Microi*.json')
    foreach ($candidate in $candidates) {
        try {
            $candidateConfig = Get-Content -LiteralPath $candidate.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($null -ne $candidateConfig.Username -and
                $null -ne $candidateConfig.Password -and
                $null -ne $candidateConfig.Namespace -and
                $null -ne $candidateConfig.Region) {
                $ConfigPath = $candidate.FullName
                break
            }
        }
        catch {
            continue
        }
    }
}
if ([string]::IsNullOrWhiteSpace($ConfigPath)) {
    throw 'Docker publish configuration was not found.'
}
$ConfigPath = [IO.Path]::GetFullPath($ConfigPath)
if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
    throw "Docker publish configuration does not exist: $ConfigPath"
}
if (-not (docker image inspect $Image 2>$null)) {
    throw "The local image does not exist: $Image"
}

$imageUri = [Uri]::new("https://$Image")
$registry = $imageUri.Host
$imagePathParts = $imageUri.AbsolutePath.Trim('/').Split('/')
if ($imagePathParts.Count -lt 2) {
    throw "The image must include a namespace: $Image"
}

$configuration = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
$username = ([string]$configuration.Username).Trim()
$password = [string]$configuration.Password
$namespace = ([string]$configuration.Namespace).Trim()
$region = ([string]$configuration.Region).Trim()
if ([string]::IsNullOrWhiteSpace($username) -or [string]::IsNullOrWhiteSpace($password)) {
    throw 'The Docker publish configuration is missing Username or Password.'
}
if ($imagePathParts[0] -ne $namespace) {
    throw 'The target image namespace does not match the publish configuration.'
}
if ($registry -notmatch [Regex]::Escape($region)) {
    throw 'The target registry region does not match the publish configuration.'
}

$temporaryRoot = Join-Path $repositoryRoot '.tmp\docker-auth'
New-Item -ItemType Directory -Force -Path $temporaryRoot | Out-Null
$temporaryRoot = (Resolve-Path -LiteralPath $temporaryRoot).Path
$dockerConfig = Join-Path $temporaryRoot ('ocr-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $dockerConfig | Out-Null

try {
    # Windows PowerShell pipelines append CRLF. Feed the password directly to
    # stdin so registry credentials containing punctuation stay byte-exact.
    $loginStartInfo = [Diagnostics.ProcessStartInfo]::new()
    $loginStartInfo.FileName = 'docker'
    $loginStartInfo.Arguments = "--config `"$dockerConfig`" login $registry --username `"$username`" --password-stdin"
    $loginStartInfo.UseShellExecute = $false
    $loginStartInfo.RedirectStandardInput = $true
    $loginStartInfo.RedirectStandardOutput = $true
    $loginStartInfo.RedirectStandardError = $true
    $loginProcess = [Diagnostics.Process]::new()
    $loginProcess.StartInfo = $loginStartInfo
    [void]$loginProcess.Start()
    $loginProcess.StandardInput.Write($password)
    $loginProcess.StandardInput.Close()
    $loginOutput = $loginProcess.StandardOutput.ReadToEnd()
    $loginError = $loginProcess.StandardError.ReadToEnd()
    $loginProcess.WaitForExit()
    if ($loginProcess.ExitCode -ne 0) {
        if (-not [string]::IsNullOrWhiteSpace($loginError)) {
            Write-Error $loginError.Trim()
        }
        throw 'Docker registry login failed.'
    }
    if (-not [string]::IsNullOrWhiteSpace($loginOutput)) {
        Write-Output $loginOutput.Trim()
    }

    docker --config $dockerConfig push $Image
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker image push failed.'
    }
}
finally {
    docker --config $dockerConfig logout $registry 2>$null | Out-Null
    if (Test-Path -LiteralPath $dockerConfig) {
        $resolvedDockerConfig = (Resolve-Path -LiteralPath $dockerConfig).Path
        $allowedPrefix = $temporaryRoot.TrimEnd('\') + '\'
        if (-not $resolvedDockerConfig.StartsWith($allowedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Refusing to remove an unexpected Docker authentication directory.'
        }
        Remove-Item -LiteralPath $resolvedDockerConfig -Recurse -Force
    }
}

# Read the public manifest from a fresh anonymous Docker configuration. A successful
# push is not sufficient evidence that users can pull the image anonymously.
$anonymousConfig = Join-Path $temporaryRoot ('anonymous-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $anonymousConfig | Out-Null
try {
    $remoteRaw = docker --config $anonymousConfig buildx imagetools inspect $Image --format '{{json .}}'
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($remoteRaw | Out-String))) {
        throw 'The image was pushed, but anonymous registry readback failed.'
    }
    $remote = ($remoteRaw | Out-String) | ConvertFrom-Json
    $remoteDigest = [string]$remote.manifest.digest
    if ([string]::IsNullOrWhiteSpace($remoteDigest)) {
        $remoteDigest = [string]$remote.digest
    }
    if ([string]::IsNullOrWhiteSpace($remoteDigest)) {
        throw 'Anonymous registry readback did not return an image digest.'
    }
    Write-Output "OCR_IMAGE_PUBLIC_DIGEST=$remoteDigest"
}
finally {
    if (Test-Path -LiteralPath $anonymousConfig) {
        $resolvedAnonymousConfig = (Resolve-Path -LiteralPath $anonymousConfig).Path
        $allowedPrefix = $temporaryRoot.TrimEnd('\') + '\'
        if (-not $resolvedAnonymousConfig.StartsWith($allowedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Refusing to remove an unexpected anonymous Docker configuration directory.'
        }
        Remove-Item -LiteralPath $resolvedAnonymousConfig -Recurse -Force
    }
}

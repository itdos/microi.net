import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const workspace=fileURLToPath(new URL('../../../',import.meta.url));
const source=path.join(workspace,'Microi.Server/tools/Microi.TestArtifactCleanup.ps1');
const runner=path.join(workspace,'Microi.Server/Microi.Tests/run-tests.ps1');
const powershell=process.env.MICROI_TEST_POWERSHELL||(process.platform==='win32'?'powershell':'pwsh');
function execute(t,body){
 const parent=path.join(workspace,'.tmp');fs.mkdirSync(parent,{recursive:true});
 const root=fs.mkdtempSync(path.join(parent,'artifact-cleanup-test-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const file=path.join(root,'check.ps1');
 fs.writeFileSync(file,`$ErrorActionPreference='Stop'\n. $env:MICROI_ARTIFACT_CLEANUP_SOURCE\n$root=$env:MICROI_ARTIFACT_TEST_ROOT\n${body}\n`);
 const result=spawnSync(powershell,['-NoProfile','-NonInteractive','-File',file],{encoding:'utf8',windowsHide:true,env:{...process.env,MICROI_ARTIFACT_CLEANUP_SOURCE:source,MICROI_ARTIFACT_TEST_ROOT:root,MICROI_ARTIFACT_RUNNER:runner}});
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 return root;
}
for(const fail of [false,true])test(`实际 Full 输出隔离及 finally 在${fail?'失败':'成功'}退出后回收编译树并保留报告`,t=>execute(t,`
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseInput([IO.File]::ReadAllText($env:MICROI_ARTIFACT_RUNNER,[Text.Encoding]::UTF8),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Runner parse errors'}
$block=@($ast.FindAll({param($n) $n -is [Management.Automation.Language.TryStatementAst] -and $n.Finally -and $n.Finally.Extent.Text.Contains('Remove-MicroiOwnedTestArtifacts')},$true))
if($block.Count -ne 1){throw 'Full build must have one real cleanup finally'}
$text=$block[0].Body.Extent.Text
$start=$text.IndexOf('if ($Mode -eq ''Full'')')
$end=$text.IndexOf('Write-Host "Restoring Microi.Tests')
if($start -lt 0 -or $end -lt $start){throw 'Actual output isolation block not found'}
$isolation=$text.Substring($start,$end-$start)
$serverRoot=Join-Path $root 'workspace/Microi.Server';New-Item -ItemType Directory -Path $serverRoot -Force | Out-Null
$ResultsDirectory=Join-Path $root 'results with space';New-Item -ItemType Directory -Path $ResultsDirectory | Out-Null
$Mode='Full';$ownedArtifactTarget=$null;$ownedArtifactLink=$null;$artifactGateFailed=$false;$retainedArtifactTarget=$null
$previousArtifactsPath=$env:ArtifactsPath;$previousUseArtifactsOutput=$env:UseArtifactsOutput
$run='try {'+$isolation+'; Set-Content -LiteralPath (Join-Path $artifactTarget "output.dll") -Value "fixture"; Set-Content -LiteralPath (Join-Path $ResultsDirectory "report.trx") -Value "evidence"; ${fail?'throw "expected failure"':'$true | Out-Null'} }'
$run+=' catch { $artifactGateFailed=$true; throw } finally '+$block[0].Finally.Extent.Text
$caught=$false;try{Invoke-Expression $run}catch{if($_.Exception.Message -ne 'expected failure'){Write-Output $_.ScriptStackTrace;throw};$caught=$true}
if($caught -ne $${fail?'true':'false'}){throw 'Original test outcome changed'}
if(Test-Path -LiteralPath $artifactTarget){throw 'Compiled output leaked'}
if(Get-Item -LiteralPath $artifactLink -Force -ErrorAction SilentlyContinue){throw 'Workspace artifact link leaked'}
if(-not(Test-Path -LiteralPath (Join-Path $ResultsDirectory 'report.trx'))){throw 'Evidence was removed'}
if(-not((Get-Content -LiteralPath (Join-Path $ResultsDirectory 'artifact-cleanup.json') -Raw | ConvertFrom-Json).cleaned)){throw 'Cleanup receipt missing'}
if($env:ArtifactsPath -ne $previousArtifactsPath -or $env:UseArtifactsOutput -ne $previousUseArtifactsOutput){throw 'Temporary build environment leaked'}
`));

test('清理拒绝越界、Git 和重解析点，并且没有所有权时保持既有目录',t=>execute(t,`
$results=Join-Path $root 'results [literal]';$target=Join-Path $results '.net-artifacts';New-Item -ItemType Directory -Path $target -Force | Out-Null
$outside=Join-Path $root 'protected';New-Item -ItemType Directory -Path $outside | Out-Null
Set-Content -LiteralPath (Join-Path $outside 'source.txt') -Value 'protected'
Remove-MicroiOwnedTestArtifacts -ResultsDirectory $results | Out-Null
if(-not(Test-Path -LiteralPath $target)){throw 'Preexisting directory was removed'}
$rejected=$false;try{Remove-MicroiOwnedTestArtifacts -ArtifactTarget $outside -ResultsDirectory $results}catch{$rejected=$true}
if(-not $rejected){throw 'Outside target accepted'}
New-Item -ItemType Directory -Path (Join-Path $target '.git') | Out-Null
$rejected=$false;try{Remove-MicroiOwnedTestArtifacts -ArtifactTarget $target -ResultsDirectory $results}catch{$rejected=$true}
if(-not $rejected -or -not(Test-Path -LiteralPath $target)){throw 'Git marker was not protected'}
Remove-Item -LiteralPath (Join-Path $target '.git')
$type=if($env:OS -eq 'Windows_NT'){'Junction'}else{'SymbolicLink'}
$link=Join-Path $target 'external';New-Item -ItemType $type -Path $link -Target $outside | Out-Null
$rejected=$false;try{Remove-MicroiOwnedTestArtifacts -ArtifactTarget $target -ResultsDirectory $results}catch{$rejected=$true}
if(-not $rejected -or -not(Test-Path -LiteralPath (Join-Path $outside 'source.txt'))){throw 'External link was followed'}
[IO.Directory]::Delete($link)
Remove-MicroiOwnedTestArtifacts -ArtifactTarget $target -ResultsDirectory $results | Out-Null
if(Test-Path -LiteralPath $target){throw 'Literal-path cleanup failed'}
`));

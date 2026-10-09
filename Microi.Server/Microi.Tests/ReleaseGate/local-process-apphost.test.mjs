import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const manager=fileURLToPath(new URL('../../tools/Microi.LocalProcessManager.ps1',import.meta.url));
const binaries=[process.env.MICROI_TEST_POWERSHELL,'pwsh','powershell'].filter(Boolean);
const harness=String.raw`
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$tokens=$null; $errors=$null
$ast=[System.Management.Automation.Language.Parser]::ParseFile($env:MICROI_PROCESS_MANAGER_TEST_SOURCE,[ref]$tokens,[ref]$errors)
if ($errors.Count -ne 0) { throw 'Actual process manager has PowerShell parse errors.' }
$loaded=@()
foreach ($name in @('Get-CommandText','Test-IsWorkspaceBackend','Get-PosixProcessSnapshot')) {
    $nodes=@($ast.FindAll({param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true))
    if ($nodes.Count -ne 1) { throw "Actual function must occur exactly once: $name" }
    Invoke-Expression $nodes[0].Extent.Text
    $loaded+=$name
}
# Never dot-source the dispatcher or import Stop-VerifiedProcessTree/Invoke-StopBackend.
function Get-ProcessCurrentDirectory($ProcessInfo) { return [string]$ProcessInfo.TestCwd }
$nativeWindows=[System.IO.Path]::DirectorySeparatorChar -eq '\'
$isWindowsHost=$false
$resolvedWorkspace='/tmp/workspace with space'
$backendRoot=$resolvedWorkspace+'/Microi.Server/Microi.net.Api'
$isolated=$resolvedWorkspace+'/.tmp/microi-release-gate/20261007-095710-29038/.net-artifacts/bin/Microi.net.Api/release/Microi.net.Api'
$good=$backendRoot+'/bin/Debug/net10.0/Microi.net.Api'
$identity=@(
    @{Key='debug-apphost'; Name='Microi.net.Api'; Exe=$good; Cwd=$backendRoot},
    @{Key='release-apphost'; Name='Microi.net.Api'; Exe=$backendRoot+'/bin/Release/net10.0/Microi.net.Api'; Cwd=$backendRoot},
    @{Key='isolated-full-release'; Name='Microi.net.Api'; Exe=$isolated; Cwd=$backendRoot},
    @{Key='isolated-full-debug'; Name='Microi.net.Api'; Exe=$isolated.Replace('/release/','/debug/'); Cwd=$backendRoot},
    @{Key='isolated-foreign-workspace'; Name='Microi.net.Api'; Exe=$isolated.Replace('workspace with space','foreign'); Cwd=$backendRoot},
    @{Key='isolated-invalid-directory'; Name='Microi.net.Api'; Exe=$isolated.Replace('20261007-095710-29038','arbitrary'); Cwd=$backendRoot},
    @{Key='isolated-other-project'; Name='Microi.net.Api'; Exe=$isolated.Replace('/bin/Microi.net.Api/','/bin/Other/'); Cwd=$backendRoot},
    @{Key='isolated-other-configuration'; Name='Microi.net.Api'; Exe=$isolated.Replace('/release/','/publish/'); Cwd=$backendRoot},
    @{Key='isolated-foreign-cwd'; Name='Microi.net.Api'; Exe=$isolated; Cwd='/tmp/foreign'},
    @{Key='isolated-path-traversal'; Name='Microi.net.Api'; Exe=$isolated.Replace('/release/','/release/../release/'); Cwd=$backendRoot},
    @{Key='isolated-sibling-prefix'; Name='Microi.net.Api'; Exe=$isolated.Replace('workspace with space','workspace with space-other'); Cwd=$backendRoot},
    @{Key='isolated-filename-case'; Name='Microi.net.Api'; Exe=$isolated.Replace('/release/Microi.net.Api','/release/microi.net.api'); Cwd=$backendRoot},
    @{Key='foreign-executable'; Name='Microi.net.Api'; Exe='/tmp/foreign/Microi.net.Api'; Cwd=$backendRoot},
    @{Key='sibling-prefix'; Name='Microi.net.Api'; Exe=$backendRoot+'-other/bin/Microi.net.Api'; Cwd=$backendRoot},
    @{Key='escaped-bin'; Name='Microi.net.Api'; Exe=$backendRoot+'/bin/../../foreign/Microi.net.Api'; Cwd=$backendRoot},
    @{Key='parent-normalization'; Name='Microi.net.Api'; Exe=$backendRoot+'/bin/Debug/../Release/Microi.net.Api'; Cwd=$backendRoot},
    @{Key='dot-normalization'; Name='Microi.net.Api'; Exe=$backendRoot+'/bin/./Debug/Microi.net.Api'; Cwd=$backendRoot},
    @{Key='double-separator'; Name='Microi.net.Api'; Exe=$backendRoot+'/bin//Debug/Microi.net.Api'; Cwd=$backendRoot},
    @{Key='foreign-cwd'; Name='Microi.net.Api'; Exe=$good; Cwd='/tmp/foreign'},
    @{Key='missing-cwd'; Name='Microi.net.Api'; Exe=$good; Cwd=''},
    @{Key='cwd-case'; Name='Microi.net.Api'; Exe=$good; Cwd=$backendRoot.Replace('workspace','Workspace')},
    @{Key='cwd-suffix'; Name='Microi.net.Api'; Exe=$good; Cwd=$backendRoot+'/'},
    @{Key='filename-case'; Name='Microi.net.Api'; Exe=$good.Replace('net10.0/Microi.net.Api','net10.0/microi.net.api'); Cwd=$backendRoot},
    @{Key='foreign-process-name'; Name='node'; Exe=$good; Cwd=$backendRoot},
    @{Key='empty-executable'; Name='Microi.net.Api'; Exe=''; Cwd=$backendRoot},
    @{Key='dotnet-project'; Name='dotnet'; Exe='/usr/bin/dotnet'; Cwd=$backendRoot; Command='dotnet run --launch-profile Microi.net.Api'},
    @{Key='dotnet-foreign-cwd'; Name='dotnet'; Exe='/usr/bin/dotnet'; Cwd='/tmp/foreign'; Command='dotnet run --launch-profile Microi.net.Api'}
)
$windowsRoot='c:\workspace\microi.server\microi.net.api'
$windowsIdentity=@(
        @{Key='win-project-exe'; Name='Microi.net.Api.exe'; Exe=$windowsRoot+'\bin\Debug\Microi.net.Api.exe'; Cwd='c:\different'},
        @{Key='win-project-dotnet'; Name='dotnet.exe'; Exe='c:\dotnet\dotnet.exe'; Command='dotnet '+$windowsRoot+'\bin\Microi.net.Api.dll'; Cwd='c:\different'},
        @{Key='win-isolated-exe-cwd'; Name='Microi.net.Api.exe'; Exe='c:\isolated\Microi.net.Api.exe'; Cwd=$windowsRoot},
        @{Key='win-isolated-exe-cwd-case'; Name='Microi.net.Api.exe'; Exe='c:\isolated\Microi.net.Api.exe'; Cwd=$windowsRoot.ToUpperInvariant()},
        @{Key='win-unreadable-cwd'; Name='Microi.net.Api.exe'; Exe='c:\isolated\Microi.net.Api.exe'; Cwd=''},
        @{Key='win-foreign-cwd'; Name='Microi.net.Api.exe'; Exe='c:\isolated\Microi.net.Api.exe'; Cwd='c:\foreign'},
        @{Key='win-sibling-cwd'; Name='Microi.net.Api.exe'; Exe='c:\isolated\Microi.net.Api.exe'; Cwd=$windowsRoot+'-other'},
        @{Key='win-cwd-suffix'; Name='Microi.net.Api.exe'; Exe='c:\isolated\Microi.net.Api.exe'; Cwd=$windowsRoot+'\'},
        @{Key='win-dotnet-cwd-alone'; Name='dotnet.exe'; Exe='c:\dotnet\dotnet.exe'; Command='dotnet run'; Cwd=$windowsRoot},
        @{Key='win-extensionless-apphost'; Name='Microi.net.Api'; Exe='c:\isolated\Microi.net.Api.exe'; Cwd=$windowsRoot},
        @{Key='win-node'; Name='node.exe'; Exe='c:\isolated\Microi.net.Api.exe'; Cwd=$windowsRoot},
        @{Key='win-browser'; Name='chrome.exe'; Exe='c:\isolated\Microi.net.Api.exe'; Cwd=$windowsRoot},
        @{Key='win-other-exe'; Name='other.exe'; Exe=$windowsRoot+'\Microi.net.Api.exe'; Cwd=$windowsRoot},
        @{Key='win-name-suffix'; Name='Microi.net.Api.exe.other'; Exe=$windowsRoot+'\Microi.net.Api.exe'; Cwd=$windowsRoot},
        @{Key='win-no-backend-entry'; Name='Microi.net.Api.exe'; Exe='c:\isolated\other.exe'; Command='c:\isolated\other.exe'; Cwd=$windowsRoot},
        @{Key='win-exe-cwd-without-command'; Name='Microi.net.Api.exe'; Exe='c:\isolated\Microi.net.Api.exe'; Command=''; Cwd=$windowsRoot},
        @{Key='win-other-dotnet-dll'; Name='dotnet.exe'; Exe='c:\dotnet\dotnet.exe'; Command='dotnet c:\isolated\other.dll'; Cwd=$windowsRoot},
        @{Key='win-dotnet-foreign-project'; Name='dotnet.exe'; Exe='c:\dotnet\dotnet.exe'; Command='dotnet c:\foreign\Microi.net.Api.dll'; Cwd=$windowsRoot},
        @{Key='win-command-alone-wrong-name'; Name='powershell.exe'; Exe=$windowsRoot+'\Microi.net.Api.exe'; Cwd=$windowsRoot},
        @{Key='win-frontend-node'; Name='node.exe'; Exe='c:\node\node.exe'; Command='node node_modules/vite/bin/vite.js'; Cwd=$windowsRoot}
    )
if ($nativeWindows) { $identity=@() }
$results=@()
foreach ($case in $identity) {
    $command=if ($case.ContainsKey('Command')) { $case.Command } else { $case.Exe }
    $row=[PSCustomObject]@{Name=$case.Name; ExecutablePath=$case.Exe; CommandLine=$command; TestCwd=$case.Cwd}
    $results+=[PSCustomObject]@{Key=$case.Key; Actual=[bool](Test-IsWorkspaceBackend $row)}
}
# Execute all Windows identity cases on POSIX too; these are actual string functions, not native PID tests.
$isWindowsHost=$true
$backendRoot=$windowsRoot
foreach ($case in $windowsIdentity) {
    $command=if ($case.ContainsKey('Command')) { $case.Command } else { $case.Exe }
    $row=[PSCustomObject]@{Name=$case.Name; ExecutablePath=$case.Exe; CommandLine=$command; TestCwd=$case.Cwd}
    $results+=[PSCustomObject]@{Key=$case.Key; Actual=[bool](Test-IsWorkspaceBackend $row)}
}
# Only synthetic ps/Get-Process responses are used: no live process enumeration or signals.
Remove-Item Alias:ps -Force -ErrorAction SilentlyContinue
$script:failedPs=''; $script:processReads=@()
$script:commands=@('101 dotnet run','102 native','103 exe','104 node app.js','105 unrelated','106 vanished')
$script:processRows=@('101 1 /usr/bin/dotnet','102 1 /tmp/api/bin/Debug/Microi.net.Api','103 1 /tmp/api/bin/Debug/Microi.net.Api.exe','104 1 /usr/bin/node','105 1 /tmp/foreign/Microi.net.Api.other','106 1 /tmp/api/bin/Debug/Microi.net.Api')
function ps {
    $kind=if (($args -join ' ') -match 'pid=,args=') {'commands'} else {'processes'}
    $global:LASTEXITCODE=if ($script:failedPs -eq $kind) {1} else {0}
    if ($kind -eq 'commands') { return $script:commands }
    return $script:processRows
}
function Get-Process {
    param([int]$Id,[object]$ErrorAction)
    $script:processReads+=$Id
    if ($Id -eq 106) { throw 'Synthetic exited process.' }
    return [PSCustomObject]@{StartTime=[DateTime]::new(638000000000000000L+$Id)}
}
$snapshot=Get-PosixProcessSnapshot
foreach ($id in @(101,102,103,104,105,106)) {
    $results+=[PSCustomObject]@{Key='snapshot-'+$id; Actual=[string]$snapshot[$id].StartTimeTicks; Command=$snapshot[$id].CommandLine; Name=$snapshot[$id].Name}
}
foreach ($kind in @('commands','processes')) {
    $script:failedPs=$kind; $rejected=$false
    try { $null=Get-PosixProcessSnapshot } catch { $rejected=$true }
    $results+=[PSCustomObject]@{Key='snapshot-'+$kind+'-failed'; Actual=$rejected}
}
[PSCustomObject]@{NativeWindows=$nativeWindows; LoadedFunctions=$loaded; Results=$results; NoProcessesStopped=$true; NoNetwork=$true; ProcessReadIds=$script:processReads} | ConvertTo-Json -Depth 6 -Compress
`;

let report;
test.before(()=>{
 assert.ok(fs.statSync(manager).isFile(),'Actual manager source must exist');
 let binary;
 for(const candidate of binaries){
  const probe=spawnSync(candidate,['-NoLogo','-NoProfile','-NonInteractive','-Command','$PSVersionTable.PSVersion.ToString()'],{encoding:'utf8',timeout:10000,windowsHide:true});
  if(probe.error?.code==='ENOENT')continue;
  assert.ifError(probe.error);assert.equal(probe.status,0,`${candidate}: ${probe.stderr}`);binary=candidate;break;
 }
 assert.ok(binary,'PowerShell is required for actual function behavior; set MICROI_TEST_POWERSHELL or provide pwsh/powershell on PATH. This responsibility never skips.');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'microi-apphost-functions-'));
 try{
  const script=path.join(directory,'identity.ps1');fs.writeFileSync(script,harness,'utf8');
  const run=spawnSync(binary,['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{encoding:'utf8',timeout:30000,maxBuffer:1024*1024,windowsHide:true,env:{...process.env,MICROI_PROCESS_MANAGER_TEST_SOURCE:manager}});
  assert.ifError(run.error);assert.equal(run.status,0,run.stderr);report=JSON.parse(run.stdout.trim());
  assert.deepEqual(report.LoadedFunctions,['Get-CommandText','Test-IsWorkspaceBackend','Get-PosixProcessSnapshot']);
  assert.equal(report.NativeWindows,process.platform==='win32');
  assert.equal(report.NoProcessesStopped,true);assert.equal(report.NoNetwork,true);
  const count=process.platform==='win32'?28:55;
  assert.equal(report.Results.length,count);assert.equal(new Set(report.Results.map(row=>row.Key)).size,count);
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
});

function result(key){const rows=report.Results.filter(row=>row.Key===key);assert.equal(rows.length,1,key);return rows[0];}
const posixCases=[
 ['debug-apphost',true],['release-apphost',true],['isolated-full-release',true],['isolated-full-debug',true],
 ...['isolated-foreign-workspace','isolated-invalid-directory','isolated-other-project','isolated-other-configuration','isolated-foreign-cwd','isolated-path-traversal','isolated-sibling-prefix','isolated-filename-case'].map(key=>[key,false]),
 ...['foreign-executable','sibling-prefix','escaped-bin','parent-normalization','dot-normalization','double-separator','foreign-cwd','missing-cwd','cwd-case','cwd-suffix','filename-case','foreign-process-name','empty-executable','dotnet-foreign-cwd'].map(key=>[key,false]),
 ['dotnet-project',true]
];
const windowsCases=[
 ...['win-project-exe','win-project-dotnet','win-isolated-exe-cwd','win-isolated-exe-cwd-case','win-exe-cwd-without-command'].map(key=>[key,true]),
 ...['win-unreadable-cwd','win-foreign-cwd','win-sibling-cwd','win-cwd-suffix','win-dotnet-cwd-alone','win-extensionless-apphost','win-node','win-browser','win-other-exe','win-name-suffix','win-no-backend-entry','win-other-dotnet-dll','win-dotnet-foreign-project','win-command-alone-wrong-name','win-frontend-node'].map(key=>[key,false])
];
for(const [key,expected] of [...(process.platform==='win32'?[]:posixCases),...windowsCases])test(`actual ${process.platform} backend function: ${key}`,()=>assert.equal(result(key).Actual,expected));
for(const [id,name,command] of [[101,'dotnet','dotnet run'],[102,'Microi.net.Api','native'],[103,'Microi.net.Api.exe','exe'],[104,'node','node app.js']])test(`actual POSIX snapshot captures startup ticks for ${name}`,()=>{
 const row=result(`snapshot-${id}`);assert.equal(BigInt(row.Actual),638000000000000000n+BigInt(id));assert.equal(row.Name,name);assert.equal(row.Command,command);
});
test('unrelated executable names never gain apphost startup identity',()=>{assert.equal(result('snapshot-105').Actual,'0');assert.ok(!report.ProcessReadIds.includes(105));});
test('unreadable apphost startup time remains zero for stop guard rejection',()=>assert.equal(result('snapshot-106').Actual,'0'));
for(const kind of ['commands','processes'])test(`POSIX snapshot fails closed when ${kind} enumeration fails`,()=>assert.equal(result(`snapshot-${kind}-failed`).Actual,true));

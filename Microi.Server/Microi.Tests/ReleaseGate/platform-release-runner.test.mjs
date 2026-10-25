import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const server = fileURLToPath(new URL('../../', import.meta.url));
const powershell = [process.env.MICROI_TEST_POWERSHELL, 'pwsh', 'powershell'].filter(Boolean).find(binary =>
  spawnSync(binary, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], {windowsHide:true}).status === 0);

function runFixture(kind, mode = 'PlatformRelease', inheritedEnvironment = {}, allPlatformTests = false, platformFrontendTests = false) {
  assert.ok(powershell, 'PowerShell is required to execute the actual release runner');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'microi-platform-release-'));
  const fixtureServer = path.join(root, 'Microi.Server'), fixtureTests = path.join(fixtureServer, 'Microi.Tests');
  const results = path.join(root, 'results'), commands = path.join(root, 'commands.jsonl');
  try {
    for (const relative of ['Microi.Server/Microi.Tests/ReleaseGate', 'Microi.Server/tools', 'Microi.Client/tests', 'Microi.Agent/apps/microi-code', 'Microi.Agent/scripts', 'results']) {
      fs.mkdirSync(path.join(root, relative), {recursive:true});
    }
    for (const relative of ['Microi.Tests/run-tests.ps1', 'Microi.Tests/ReleaseGate/read-release-matrix-trx.ps1', 'tools/Microi.TestArtifactCleanup.ps1', 'tools/Microi.ArtifactSafety.ps1']) {
      fs.copyFileSync(path.join(server, relative), path.join(fixtureServer, relative));
    }
    fs.writeFileSync(path.join(root, 'Microi.Agent/apps/microi-code/package.json'), '{}');
    fs.writeFileSync(path.join(root, 'Microi.Agent/scripts/test-vsix-package.test.cjs'), '');
    fs.writeFileSync(path.join(root, 'Microi.Client/tests/file-cabinet-office.spec.mjs'), '');
    fs.writeFileSync(path.join(root, 'candidate.json'), '{}');
    if (kind === 'partial-v8') {
      // 只有平台短信等局部引擎；六业务应用没有被拉取或选入当前发行。
      fs.mkdirSync(path.join(root, 'Microi-V8-Engine'));
      fs.mkdirSync(path.join(fixtureTests, 'V8'));
      fs.writeFileSync(path.join(fixtureTests, 'V8/empty-database-sanitization.test.mjs'), '');
      const sourceRoot = 'Microi.Server/OfficialApplications/PlatformService';
      fs.mkdirSync(path.join(root, sourceRoot, 'test'), {recursive:true});
      fs.writeFileSync(path.join(root, sourceRoot, 'test/cdn-security.test.mjs'), '');
      const contractRoot = path.join(fixtureServer, 'OfficialApplications/Resource');
      fs.mkdirSync(contractRoot, {recursive:true});
      fs.writeFileSync(path.join(contractRoot, 'platform-service-release.json'), JSON.stringify({SchemaVersion:1, AppKey:'microi-platform-service', SourceRoot:sourceRoot}));
    }
    if (kind === 'stale') fs.writeFileSync(path.join(results, 'platform-release-tests.json'), '{"old":true}');
    const driver = path.join(root, 'driver.ps1');
    // 执行原入口和真实 TRX/清理实现，仅替换外部编译器及产品测试进程，禁止测试启动服务或构建。
    fs.writeFileSync(driver, `﻿$ErrorActionPreference='Stop'
[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
function Record-Command($name,$values) {
  [IO.File]::AppendAllText($env:PLATFORM_FIXTURE_COMMANDS,(@{name=$name;args=@($values)}|ConvertTo-Json -Compress)+[Environment]::NewLine)
}
function Get-CimInstance { [pscustomobject]@{TotalVisibleMemorySize=33554432;FreePhysicalMemory=16777216} }
function node {
  Record-Command 'node' $args
  $global:LASTEXITCODE=0
  if ($args[0] -like '*fixtures/admission/runtime.mjs') { $global:LASTEXITCODE=17; return }
  if ($args[1] -eq 'freeze-platform') { '{}' | Set-Content -LiteralPath $args[3]; return }
  if ($args[1] -eq 'verify-platform') { '{"scope":"PlatformRelease","status":"Passed"}' | Set-Content -LiteralPath $args[4]; return }
  if ($args[1] -eq 'freeze') { '{"fullFilter":"Category=FullStack","requiredEnvironment":[]}' ; return }
  if ($args[0] -like '*platform-all-tests.mjs') {
    if ($env:PLATFORM_FIXTURE_KIND -eq 'all-preflight-fail') { $global:LASTEXITCODE=19; return }
    if ($args[1] -in @('preflight','frontend-preflight')) { '{}' ; return }
    if ($args[1] -in @('browser','frontend-browser')) { '{"tests":2,"passed":2,"failed":0,"skipped":0}' ; return }
  }
  if ($args[0] -like '*run-node-regressions.mjs') {
    $skip=if($env:PLATFORM_FIXTURE_KIND -eq 'node-skip'){1}else{0}
    ConvertTo-Json -InputObject @(@{root='Microi.Server/Microi.Tests';files=@('fixture.test.mjs');tests=1;pass=1;fail=0;cancelled=0;skipped=$skip;todo=0}) -Depth 5 | Set-Content -LiteralPath (Join-Path $args[1] 'node-regressions.json')
  }
}
function npm { Record-Command 'npm' $args; throw 'Code/Agent must not run during PlatformRelease' }
function dotnet {
  Record-Command 'dotnet' $args
  $global:LASTEXITCODE=0
  if ($args[0] -eq 'build' -and $env:PLATFORM_FIXTURE_KIND -eq 'cleanup-fail') {
    New-Item -ItemType Directory -Path (Join-Path $env:ArtifactsPath '.git') | Out-Null
  }
  if ($args[0] -eq 'test') {
    $resultIndex=[Array]::IndexOf($args,'--results-directory');$loggerIndex=[Array]::IndexOf($args,'--logger')
    $file=Join-Path $args[$resultIndex+1] ($args[$loggerIndex+1] -replace '^trx;LogFileName=','')
    $outcome=if($env:PLATFORM_FIXTURE_KIND -eq 'trx-skip'){'NotExecuted'}else{'Passed'}
    $pass=if($outcome -eq 'Passed'){1}else{0};$skip=1-$pass
    '<TestRun xmlns="http://microsoft.com/schemas/VisualStudio/TeamTest/2010"><Results><UnitTestResult testName="Platform.Component" outcome="'+$outcome+'" /></Results><ResultSummary outcome="Completed"><Counters total="1" passed="'+$pass+'" failed="0" notExecuted="'+$skip+'" /></ResultSummary></TestRun>' | Set-Content -LiteralPath $file
    if($env:PLATFORM_FIXTURE_KIND -eq 'test-fail'){$global:LASTEXITCODE=42}
  }
}
& (Join-Path $env:PLATFORM_FIXTURE_ROOT 'Microi.Server/Microi.Tests/run-tests.ps1') -Mode $env:PLATFORM_FIXTURE_MODE -AllPlatformTests:($env:PLATFORM_FIXTURE_ALL -eq '1') -PlatformFrontendTests:($env:PLATFORM_FIXTURE_FRONTEND -eq '1') -ResultsDirectory (Join-Path $env:PLATFORM_FIXTURE_ROOT 'results')
`);
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('MICROI_TEST_') && key !== 'MICROI_DESKTOP_NODE_HOME'));
    const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-File', driver], {cwd:root, env:{...env,
      MICROI_RELEASE_CANDIDATE:path.join(root, 'candidate.json'), PLATFORM_FIXTURE_ROOT:root,
      PLATFORM_FIXTURE_COMMANDS:commands, PLATFORM_FIXTURE_KIND:kind, PLATFORM_FIXTURE_MODE:mode,PLATFORM_FIXTURE_ALL:allPlatformTests?'1':'0',PLATFORM_FIXTURE_FRONTEND:platformFrontendTests?'1':'0',...inheritedEnvironment},
      encoding:'utf8', windowsHide:true, timeout:30000});
    assert.ifError(result.error);
    const calls = fs.existsSync(commands) ? fs.readFileSync(commands,'utf8').trim().split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line.replace(/^\uFEFF/,''))) : [];
    const read = name => fs.existsSync(path.join(results,name)) ? JSON.parse(fs.readFileSync(path.join(results,name),'utf8').replace(/^\uFEFF/,'')) : null;
    return {result,calls,receipt:read('platform-release-tests.json'),matrix:read('platform-release-result.json'),cleanup:read('artifact-cleanup.json'),artifactExists:fs.existsSync(path.join(results,'.net-artifacts'))};
  } finally {
    // 本夹具唯一根目录来自 mkdtemp，保留实际 runner 失败结果后只移除本测试临时数据。
    fs.rmSync(root,{recursive:true});
  }
}

test('PlatformRelease executes platform regressions and returns scoped evidence after real cleanup without Code/Agent or admission', () => {
  const {result,calls,receipt,matrix,cleanup,artifactExists} = runFixture('success');
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  assert.deepEqual(calls.filter(row=>row.name==='dotnet').map(row=>row.args[0]),['restore','build','test']);
  const component = calls.find(row=>row.name==='dotnet' && row.args[0]==='test');
  assert.equal(component.args[component.args.indexOf('--filter')+1],'Category!=FullStack');
  assert.equal(component.args[component.args.indexOf('--logger')+1],'trx;LogFileName=microi-platform.trx');
  assert.equal(calls.some(row=>row.name==='npm' || row.args.some(arg=>/Microi\.(Agent|Code)|admission|notification-center|platform-reminders/.test(String(arg)))),false);
  assert.ok(calls.some(row=>String(row.args[0]).endsWith('run-node-regressions.mjs')));
  assert.ok(calls.find(row=>String(row.args[0]).endsWith('run-node-regressions.mjs')).args.includes('--regular-platform'));
  assert.ok(calls.some(row=>String(row.args[1]).endsWith('file-cabinet-office.spec.mjs')));
  assert.equal(receipt.scope,'PlatformRelease');assert.equal(receipt.status,'Passed');
  assert.equal(receipt.dotnet.tests,1);assert.equal(receipt.dotnet.passed,1);assert.equal(receipt.node.tests,1);
  assert.match(receipt.dotnet.trxSha256,/^[a-f0-9]{64}$/);assert.match(receipt.node.reportSha256,/^[a-f0-9]{64}$/);
  assert.equal(matrix.scope,'PlatformRelease');assert.equal(cleanup.cleaned,true);assert.equal(artifactExists,false);
  assert.deepEqual(calls.filter(row=>row.args[1]==='freeze-platform'||row.args[1]==='verify-platform').map(row=>row.args[1]),['freeze-platform','verify-platform']);
});

test('局部 V8 目录不引入六业务应用前置，平台 Managed V8 与 CDN 安全回归仍执行', () => {
  const {result,calls,receipt} = runFixture('partial-v8');
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  assert.equal(receipt.scope,'PlatformRelease');
  for (const name of ['official-v8-source.mjs','empty-database-sanitization.test.mjs','cdn-security.test.mjs'])
    assert.ok(calls.some(row=>row.args.some(arg=>String(arg).endsWith(name))), name+' remains selected');
  assert.ok(calls.some(row=>row.name==='dotnet'&&row.args[0]==='test'));
});

test('显式全平台范围仍拒绝缺少标准业务应用契约', () => {
  const {result,calls,receipt} = runFixture('partial-v8','PlatformRelease',{MICROI_TEST_MATRIX_FILE:'existing.json',MICROI_TEST_ALLOW_WRITES:'YES'},true);
  assert.notEqual(result.status,0);
  assert.match(result.stdout+'\n'+result.stderr,/unique standard-suite source contract is missing/);
  assert.equal(receipt,null);
  assert.equal(calls.some(row=>row.name==='dotnet'),false);
});

for (const kind of ['test-fail','trx-skip','node-skip','cleanup-fail']) test(`PlatformRelease rejects ${kind} without accepted scope evidence`, () => {
  const {result,calls,receipt,matrix} = runFixture(kind);
  assert.notEqual(result.status,0,result.stdout+'\n'+result.stderr);
  assert.equal(receipt,null);assert.equal(matrix,null);
  assert.equal(calls.some(row=>row.args[1]==='verify-platform'),false);
});

test('PlatformRelease refuses stale results before launching any regression', () => {
  const {result,calls,receipt,matrix} = runFixture('stale');
  assert.notEqual(result.status,0);assert.deepEqual(calls,[]);assert.deepEqual(receipt,{old:true});assert.equal(matrix,null);
});

test('PlatformRelease ignores inherited desktop runtime and Full signals without starting either scope', () => {
  const {result,calls,receipt} = runFixture('success','PlatformRelease',{
    MICROI_DESKTOP_NODE_HOME:path.join(os.tmpdir(),'nonexistent-retired-agent-runtime'),
    MICROI_RELEASE_TEST_POLICY:'Full',MICROI_TEST_MATRIX_FILE:'old-full-matrix.json',
    MICROI_TEST_RUNTIME_READY_FILE:'old-full-ready.json',MICROI_TEST_ALLOW_WRITES:'YES'
  });
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
  assert.equal(receipt.scope,'PlatformRelease');
  assert.equal(calls.some(row=>row.name==='npm'||row.args.some(arg=>/Microi\.(Agent|Code)|admission|notification-center|platform-reminders/.test(String(arg)))),false);
});

test('explicit Full preserves its own prerequisites before any regression', () => {
  const {result,calls,receipt} = runFixture('success','Full');
  assert.notEqual(result.status,0);assert.equal(receipt,null);
  assert.equal(calls.some(row=>row.name==='dotnet'||row.args[1]==='prepare'),false);
  assert.match(result.stdout+'\n'+result.stderr,/Full (?:requires MICROI_TEST_MATRIX_FILE|admission fixture preflight failed)/);
});

test('regular platform frontend release runs general browsers and component C# without Full matrix, admission or maintenance authorization',()=>{
 const {result,calls,receipt}=runFixture('success','PlatformRelease',{MICROI_TEST_ALLOW_WRITES:'YES',MICROI_TEST_RUNTIME_READY_FILE:'stale-unused-full-signal'},false,true);
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 const dotnet=calls.find(row=>row.name==='dotnet'&&row.args[0]==='test');
 assert.equal(dotnet.args[dotnet.args.indexOf('--filter')+1],'Category!=FullStack');
 assert.ok(calls.some(row=>row.args[1]==='frontend-preflight'));
 assert.ok(calls.some(row=>row.args[1]==='frontend-browser'));
 assert.ok(calls.some(row=>row.args.includes('--platform-frontend-tests')));
 assert.equal(calls.some(row=>row.args[1]==='freeze'||row.name==='npm'||row.args.some(arg=>/admission|notification-center/.test(String(arg)))),false);
 assert.equal(receipt.allPlatformTests,false);assert.equal(receipt.platformFrontendTests,true);assert.equal(receipt.browser.passed,2);
 assert.ok(receipt.excludedScopes.includes('RealPaidAI'));
});

test('platform release rejects inherited Docker fixture selectors before any test or provisioning process',()=>{
 for(const inherited of [{MICROI_GATE_TEST_MYSQL_AUTO:'1'},{MICROI_GATE_TEST_MYSQL_CONTAINER:'old-container'}]){
  const {result,calls,receipt}=runFixture('success','PlatformRelease',inherited,false,true);
  assert.notEqual(result.status,0);assert.equal(receipt,null);assert.deepEqual(calls,[]);
  assert.match(result.stdout+'\n'+result.stderr,/automatic Docker test provisioning is not allowed/);
 }
});

test('all-platform release executes unfiltered C# and every browser responsibility without Code/Agent',()=>{
 const {result,calls,receipt}=runFixture('success','PlatformRelease',{MICROI_TEST_MATRIX_FILE:'existing.json',MICROI_TEST_ALLOW_WRITES:'YES'},true);
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 const dotnet=calls.find(row=>row.name==='dotnet'&&row.args[0]==='test');
 assert.equal(dotnet.args.includes('--filter'),false);
 assert.ok(calls.some(row=>String(row.args[0]).endsWith('platform-all-tests.mjs')&&row.args[1]==='browser'));
 assert.ok(calls.some(row=>row.args.includes('--all-platform-tests')));
 assert.ok(calls.some(row=>row.args[1]==='freeze'&&row.args.includes('--platform-only')));
 assert.equal(calls.find(row=>String(row.args[0]).endsWith('run-node-regressions.mjs')).args.includes('--regular-platform'),false);
 assert.equal(calls.some(row=>row.name==='npm'),false);
 assert.equal(receipt.allPlatformTests,true);assert.equal(receipt.filter,'AllPlatformTests');assert.equal(receipt.browser.passed,2);
});

test('all-platform missing existing fixture prerequisites stops before any compiler, browser or provisioner',()=>{
 const {result,calls,receipt}=runFixture('all-preflight-fail','PlatformRelease',{},true);
 assert.notEqual(result.status,0);assert.equal(receipt,null);
 assert.equal(calls.some(row=>row.name==='dotnet'||row.name==='npm'),false);
 assert.equal(calls.some(row=>row.args[1]==='browser'),false);
});

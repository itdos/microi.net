import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import test from 'node:test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const source=fs.readFileSync(path.join(root,'Microi一键编译发布.sh'),'utf8');
const begin=source.indexOf('# 在升版、官方资源写入、NuGet/Docker 推送之前执行完整业务回归。');
const end=source.indexOf('# 编译/发布会改写共享输出目录',begin);
assert.ok(begin>0&&end>begin,'The release script must contain the actual full-test gate');
const gate=source.slice(begin,end);
const gitExec=process.platform==='win32'?execFileSync('git',['--exec-path'],{encoding:'utf8'}).trim():'';
const bash=process.platform==='win32'?path.resolve(gitExec,'../../..','bin/bash.exe'):'bash';

test('release JSON reader handles numeric ports, escaped strings, BOM and nested settings',()=>{
 const directory=path.join(root,'.tmp','release-json-reader-fixture');fs.mkdirSync(directory,{recursive:true});
 const filename=path.join(directory,'config.json');
 fs.writeFileSync(filename,'\uFEFF'+JSON.stringify({AppSettings:{OsClientRedisPort:62629,Value:'a"b\\c',Nothing:null}}));
 const helper=source.slice(source.indexOf('json_value() {'),source.indexOf('# 自动递增版本号'));
 const quoted="'"+filename.replaceAll('\\','/').replaceAll("'","'\\''")+"'";
 try{
  for(const [key,expected] of [['OsClientRedisPort','62629'],['Value','a"b\\c'],['Nothing',''],['Missing','']]){
   const run=spawnSync(bash,['--noprofile','--norc','-s'],{encoding:'utf8',input:helper+'\njson_value '+key+' '+quoted+'\n'});
   assert.ifError(run.error);assert.equal(run.status,0,run.stderr);assert.equal(run.stdout,expected);
  }
 }finally{fs.unlinkSync(filename);fs.rmdirSync(directory);}
});

test('same-version Docker hotfix keeps full gates and excludes version and remote-resource publication',()=>{
 assert.match(source,/if \[ "\$\{1:-\}" = "--docker-only-hotfix" \]/);
 const hotfix=source.slice(source.indexOf('if [ "$MICROI_DOCKER_ONLY_HOTFIX" = true ]'),source.indexOf('if [ "$MICROI_DOCKER_ONLY_HOTFIX" = true ]')+750);
 for(const marker of ['VERSION="$CURRENT_VERSION"','BUMP_VERSION=false','PUSH_NUGET=false']) assert.ok(hotfix.includes(marker),marker);
 assert.match(source,/if \[ "\$PUBLISH_BACKEND" = true \] && \[ "\$MICROI_DOCKER_ONLY_HOTFIX" != true \]; then[\s\S]*?refresh-resources\.mjs --publish/);
 assert.match(gate,/-Mode Full -Configuration Release/);
 assert.doesNotMatch(gate,/MICROI_DOCKER_ONLY_HOTFIX/);
 assert.ok(gate.includes('-SolutionPath "$SLN_FILE"'),'Full gate must use the detected solution in an isolated checkout');
});

for(const scenario of [
 {name:'failed full tests prevent platform publication',backend:true,client:false,exit:19,passed:false,called:true},
 {name:'successful full tests allow platform publication',backend:true,client:false,exit:0,passed:true,called:true},
 {name:'frontend publication also requires full tests',backend:false,client:true,exit:19,passed:false,called:true},
 {name:'prebuilt Docker push cannot bypass failed tests',backend:false,client:false,docker:true,exit:19,passed:false,called:true},
 {name:'documentation-only work avoids the backend gate',backend:false,client:false,exit:19,passed:true,called:false}
])test(scenario.name,()=>{
 const result=spawnSync(bash,['--noprofile','--norc','-s'],{encoding:'utf8',input:`
print_phase(){ :; }
print_success(){ :; }
print_fail(){ exit 1; }
pwsh(){ printf 'TEST_ARGUMENTS=%s\\n' "$*"; return ${scenario.exit}; }
node(){ printf 'CANDIDATE_ARGUMENTS=%s\\n' "$*"; return 0; }
PUBLISH_BACKEND=${scenario.backend}
BUILD_CLIENT=${scenario.client}
PLATFORM_DOCKER_SELECTED=${scenario.docker||false}
${gate}
printf 'PUBLICATION_REACHED\\n'
`});
 assert.ifError(result.error);
 assert.equal(result.status,scenario.passed?0:1,result.stderr);
 assert.equal(result.stdout.includes('PUBLICATION_REACHED'),scenario.passed);
 assert.equal(result.stdout.includes('TEST_ARGUMENTS='),scenario.called);
 if(scenario.called)assert.match(result.stdout,/-Mode Full -Configuration Release/);
});

test('prebuilt artifacts require Full source provenance and are rechecked before every push',()=>{
 assert.match(source,/PLATFORM_DOCKER_SELECTED=true/);
 const start=source.indexOf('docker_push_plan() {'),end=source.indexOf('if [ ${#SELECTED_API_PLANS',start);
 const push=source.slice(start,end);
 assert.match(push,/local receipt_mode=verify/);
 assert.match(push,/release-artifact\.mjs "\$receipt_mode"/);
 assert.ok(push.lastIndexOf('release-artifact.mjs verify')<push.lastIndexOf('docker push'));
 assert.match(push,/release-artifact\.mjs verify[\s\S]*?print_fail/);
});

for(const mode of ['capture','verify'])test(`candidate ${mode} failure prevents publication`,()=>{
 const result=spawnSync(bash,['--noprofile','--norc','-s'],{encoding:'utf8',input:`
print_phase(){ :; }
print_success(){ :; }
print_fail(){ exit 1; }
pwsh(){ return 0; }
node(){ [ "$2" != "${mode}" ]; }
PUBLISH_BACKEND=true
BUILD_CLIENT=false
${gate}
printf 'PUBLICATION_REACHED\\n'
`});
 assert.ifError(result.error);assert.equal(result.status,1);assert.equal(result.stdout.includes('PUBLICATION_REACHED'),false);
});

test('publication refuses resource merge drift and preserves the independent Panel version',()=>{
 assert.match(source,/refresh-resources\.mjs --publish[^\n]*--require-unchanged-candidate/);
 assert.match(source,/find Microi\.Server[^\n]*-not -path "\*\/Microi\.Panel\/\*"/);
});

test('full tests precede version edits, resource publication and platform pushes',()=>{
 for(const marker of ['# ─── 阶段（条件）: 更新版本号','refresh-resources.mjs --publish','dotnet nuget push']){
  const offset=source.indexOf(marker);assert.ok(offset>end,`${marker} must follow the full-test gate`);
 }
});

test('real schedule stores belong to Full and their settings fail fast before builds',()=>{
 const runner=fs.readFileSync(path.join(root,'Microi.Server/Microi.Tests/run-tests.ps1'),'utf8');
 const preflight=runner.slice(runner.indexOf('if ($Mode -eq "Full")'),runner.indexOf('New-Item -ItemType Directory'));
 for(const name of ['MICROI_TEST_SCHEDULE_REDIS','MICROI_TEST_SCHEDULE_MYSQL'])assert.ok(preflight.includes(name),name);
 for(const name of ['MicroiTaskSchedulingCacheTests','MicroiTaskSchedulingSharedStoreTests']){
  const fixture=fs.readFileSync(path.join(root,'Microi.Server/Microi.Tests/Common',name+'.cs'),'utf8');
  assert.match(fixture,/\[Trait\("Category", "FullStack"\)\]/);
  assert.doesNotMatch(fixture,/Assert\.Skip\(/);
 }
});

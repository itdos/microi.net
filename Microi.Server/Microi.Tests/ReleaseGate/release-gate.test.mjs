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

for(const scenario of [
 {name:'failed full tests prevent platform publication',backend:true,client:false,exit:19,passed:false,called:true},
 {name:'successful full tests allow platform publication',backend:true,client:false,exit:0,passed:true,called:true},
 {name:'frontend publication also requires full tests',backend:false,client:true,exit:19,passed:false,called:true},
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
${gate}
printf 'PUBLICATION_REACHED\\n'
`});
 assert.ifError(result.error);
 assert.equal(result.status,scenario.passed?0:1,result.stderr);
 assert.equal(result.stdout.includes('PUBLICATION_REACHED'),scenario.passed);
 assert.equal(result.stdout.includes('TEST_ARGUMENTS='),scenario.called);
 if(scenario.called)assert.match(result.stdout,/-Mode Full -Configuration Release/);
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

test('publication refuses resource merge drift and preserves the independent Ops version',()=>{
 assert.match(source,/refresh-resources\.mjs --publish[^\n]*--require-unchanged-candidate/);
 assert.match(source,/find Microi\.Server[^\n]*-not -path "\*\/Microi\.Ops\/\*"/);
});

test('full tests precede version edits, resource publication and platform pushes',()=>{
 for(const marker of ['# ─── 阶段（条件）: 更新版本号','refresh-resources.mjs --publish','dotnet nuget push']){
  const offset=source.indexOf(marker);assert.ok(offset>end,`${marker} must follow the full-test gate`);
 }
});

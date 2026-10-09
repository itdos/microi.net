import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { acquireReleaseLock, releaseReleaseLock, assertReleaseAvailable, inspectLocks } from '../../tools/release-lock.mjs';

const tool = fileURLToPath(new URL('../../tools/release-lock.mjs', import.meta.url));
const manager = fileURLToPath(new URL('../../tools/Microi.LocalProcessManager.ps1', import.meta.url));
const token = 'test-owner-0000000000000001';
// Windows 的 PATH 可能先找到 WSL bash；此门禁必须执行正式发布所用的 Git Bash。
const gitExec = process.platform === 'win32' ? execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim() : '';
const bash = process.platform === 'win32' ? path.resolve(gitExec, '../../..', 'bin/bash.exe') : 'bash';
if (process.platform === 'win32') assert.ok(fs.existsSync(bash), 'The release regression requires the actual Git Bash executable.');
function fixture() { return fs.mkdtempSync(path.join(os.tmpdir(), 'microi-lock-domain-')); }
function owner(root, name, text) {
    const lock = path.join(root, '.tmp/microi-process-state', name);
    fs.mkdirSync(lock, {recursive:true}); fs.writeFileSync(path.join(lock, 'owner.env'), text); return lock;
}
function withFixture(fn) { const root=fixture(); try { fn(root); } finally { fs.rmSync(root,{recursive:true,force:true}); } }

test('API, PC, website and Agent own independent live locks concurrently; same scope remains exclusive', () => withFixture(root => {
    const scopes=['api','pc','website','agent'];
    const locks=scopes.map((scope,i)=>acquireReleaseLock(root,scope,process.pid,token+i));
    assert.equal(inspectLocks(root).filter(row=>row.exists).length,4);
    for(const scope of scopes){
        assert.throws(()=>acquireReleaseLock(root,scope,process.pid,token+'9'),/被占用/);
        assertReleaseAvailable(root,scope,locks.find(lock=>lock.domain===scope).token);
    }
    releaseReleaseLock(root,'website',process.pid,locks[2].token);
    assertReleaseAvailable(root,'website');
    for(const scope of ['api','pc','agent'])assert.throws(()=>assertReleaseAvailable(root,scope),/被占用/);
    for(const lock of locks.filter(lock=>lock.domain!=='website'))releaseReleaseLock(root,lock.domain,process.pid,lock.token);
}));
test('API service starts are blocked by API release, and only its preparation token is exempt',()=>withFixture(root=>{
    acquireReleaseLock(root,'api',process.pid,token);
    assert.throws(()=>assertReleaseAvailable(root,'api'),/被占用/);
    assert.throws(()=>assertReleaseAvailable(root,'api','incorrect'),/被占用/);
    assertReleaseAvailable(root,'api',token);
    assertReleaseAvailable(root,'agent');
}));
test('unknown live legacy lock still protects every domain',()=>withFixture(root=>{
    owner(root,'release.lock',`pid=${process.pid}\nworkspace=${root}\n`);
    for(const domain of ['api','pc','website','agent']) assert.throws(()=>assertReleaseAvailable(root,domain),/被占用/);
}));
test('an Agent label without a verified live Agent command never bypasses legacy protection',()=>withFixture(root=>{
    owner(root,'release.lock',`pid=${process.pid}\nworkspace=${root}\ntask=agent-forged-label\n`);
    assert.throws(()=>assertReleaseAvailable(root,'api'),/被占用/);
}));
test('missing legacy owner remains blocked rather than deleting an initializing lock',()=>withFixture(root=>{
    fs.mkdirSync(path.join(root,'.tmp/microi-process-state/release.lock'),{recursive:true});
    assert.throws(()=>acquireReleaseLock(root,'api',process.pid,token),/被占用/);
}));
test('release refuses another token or PID and preserves the exact original owner',()=>withFixture(root=>{
    const lock=acquireReleaseLock(root,'api',process.pid,token);
    const before=fs.readFileSync(path.join(lock.path,'owner.env'),'utf8');
    assert.throws(()=>releaseReleaseLock(root,'api',process.pid,'wrong'),/只能释放/);
    assert.throws(()=>releaseReleaseLock(root,'api',process.pid+1,token),/只能释放/);
    assert.equal(fs.readFileSync(path.join(lock.path,'owner.env'),'utf8'),before);
    assert.equal(releaseReleaseLock(root,'api',process.pid,token),true);
    assert.equal(releaseReleaseLock(root,'api',process.pid,token),false);
}));
test('invalid domains cannot escape the state directory',()=>withFixture(root=>{
    for(const domain of ['../foreign','legacy','platform',''])assert.throws(()=>acquireReleaseLock(root,domain,process.pid,token),/范围/);
}));
test('dead domain and legacy locks recover without touching other live domain owner',()=>withFixture(root=>{
    const gone=spawnSync(process.execPath,['-e','process.exit(0)']);assert.equal(gone.status,0);
    owner(root,'release.lock',`pid=${gone.pid}\nworkspace=${root}\n`);
    owner(root,'api-release.lock',`pid=${gone.pid}\ndomain=platform\n`);
    const agent=acquireReleaseLock(root,'agent',process.pid,token);
    acquireReleaseLock(root,'api',process.pid,token+'2');
    assert.ok(fs.existsSync(agent.path));assert.ok(!fs.existsSync(path.join(root,'.tmp/microi-process-state/release.lock')));
}));
test('dead lock with unexpected files fails closed without recursively deleting files',()=>withFixture(root=>{
    const gone=spawnSync(process.execPath,['-e','process.exit(0)']);
    const lock=owner(root,'api-release.lock',`pid=${gone.pid}\n`);fs.writeFileSync(path.join(lock,'foreign.txt'),'retain');
    assert.throws(()=>acquireReleaseLock(root,'api',process.pid,token),/未知文件/);
    assert.equal(fs.readFileSync(path.join(lock,'foreign.txt'),'utf8'),'retain');
}));
test('actual legacy Agent subprocess is recognized; API proceeds without modifying its lock',async()=>{
    const root=fixture();const script=path.join(root,'.tmp/agent-test/run-release.py');
    fs.mkdirSync(path.dirname(script),{recursive:true});fs.writeFileSync(script,'setInterval(()=>{},1000);');
    const child=spawn(process.execPath,[script],{stdio:'ignore'});
    try{
        await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
        const lock=owner(root,'release.lock',`pid=${child.pid}\nworkspace=${root}\ntask=agent-test-release\n`);
        const original=fs.readFileSync(path.join(lock,'owner.env'),'utf8');
        // 原实现只看目录存在，必然阻塞；新实现读取真实进程所属的发布范围。
        assert.ok(fs.existsSync(lock));assertReleaseAvailable(root,'api');
        acquireReleaseLock(root,'api',process.pid,token);
        assert.throws(()=>assertReleaseAvailable(root,'agent'),/被占用/);
        assert.equal(fs.readFileSync(path.join(lock,'owner.env'),'utf8'),original);
    }finally{child.kill();await new Promise(resolve=>child.once('exit',resolve));fs.rmSync(root,{recursive:true,force:true});}
});
for (const sameCwd of [true,false]) test('relative legacy Agent Python build entry requires its actual workspace cwd: '+sameCwd,async()=>{
    const root=fixture(), foreign=fixture(), cwd=sameCwd?root:foreign;
    const relative='.tmp/agent-test/build-windows-under-transfer.py',script=path.join(cwd,relative);
    fs.mkdirSync(path.dirname(script),{recursive:true});fs.writeFileSync(script,'setInterval(()=>{},1000);');
    const child=spawn(process.execPath,[relative],{cwd,stdio:'ignore'});
    try {
        await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
        const lock=owner(root,'release.lock',`pid=${child.pid}\nworkspace=${root}\ntask=agent-test-release\n`);
        const before=fs.readFileSync(path.join(lock,'owner.env'),'utf8');
        if(sameCwd && process.platform!=='win32')assertReleaseAvailable(root,'api');
        else assert.throws(()=>assertReleaseAvailable(root,'api'),/被占用/);
        assert.throws(()=>assertReleaseAvailable(root,'agent'),/被占用/);
        assert.equal(fs.readFileSync(path.join(lock,'owner.env'),'utf8'),before);
    }finally{child.kill();await new Promise(resolve=>child.once('exit',resolve));fs.rmSync(root,{recursive:true,force:true});fs.rmSync(foreign,{recursive:true,force:true});}
});
test('actual CLI blocks API restart but permits Agent under an API lock',()=>withFixture(root=>{
    acquireReleaseLock(root,'api',process.pid,token);
    const blocked=spawnSync(process.execPath,[tool,'assert','api',root],{encoding:'utf8'});
    assert.equal(blocked.status,1);assert.match(blocked.stderr,/被占用/);
    assert.equal(spawnSync(process.execPath,[tool,'assert','agent',root]).status,0);
}));
test('actual process manager service guard follows the same domain rules without stopping processes',()=>withFixture(root=>{
    let binary;
    for(const value of [process.env.MICROI_TEST_POWERSHELL,'pwsh','powershell'].filter(Boolean)) {
        const probe=spawnSync(value,['-NoProfile','-Command','$PSVersionTable.PSVersion.ToString()'],{encoding:'utf8',timeout:10000});
        if(probe.error?.code==='ENOENT')continue;assert.ifError(probe.error);assert.equal(probe.status,0,probe.stderr);binary=value;break;
    }
    assert.ok(binary,'PowerShell is required; this regression never skips.');
    const run=(scope='all')=>spawnSync(binary,['-NoProfile','-File',manager,'-Action','AssertServiceStart','-WorkspaceRoot',root,'-ReleaseScope',scope],{encoding:'utf8',timeout:15000});
    acquireReleaseLock(root,'agent',process.pid,token);assert.equal(run().status,0);
    acquireReleaseLock(root,'api',process.pid,token+'2');const blocked=run();assert.equal(blocked.status,1);assert.match(blocked.stderr,/api 发布/);
    assert.equal(run('pc').status,0);assert.equal(run('api').status,1);
    acquireReleaseLock(root,'website',process.pid,token+'3');assert.equal(run('pc').status,0);
}));

test('actual Bash combined release functions release their original workspace lock after changing directories',()=>withFixture(root=>{
    const original=fs.readFileSync(fileURLToPath(new URL('../../../Microi一键编译发布.sh',import.meta.url)),'utf8');
    const start=original.indexOf('release_workspace_lock() {');const end=original.indexOf('\nprepare_release_workspace()',start);
    const target=path.join(root,'Microi.Server/tools');fs.mkdirSync(target,{recursive:true});fs.copyFileSync(tool,path.join(target,'release-lock.mjs'));
    const run=spawnSync(bash,['-c',`set -e; print_info(){ :; }; print_fail(){ exit 1; }; MICROI_RELEASE_LOCK_HELD=false; ${original.slice(start,end)}
BUILD_BACKEND=true; BUILD_CLIENT=true; PUBLISH_DOC=true; MICROI_FULL_ONLY=false; SELECTED_API_PLANS=(); SELECTED_CLIENT_PLANS=(); acquire_workspace_lock; cd /; release_workspace_lock`],{cwd:root,encoding:'utf8',timeout:15000});
    assert.equal(run.status,0,run.stderr);for(const scope of ['api','pc','website'])assert.ok(!fs.existsSync(path.join(root,'.tmp/microi-process-state/'+scope+'-release.lock')));
}));
test('actual Agent entry uses only its domain and releases its lock when the desktop build fails',()=>withFixture(root=>{
    const original=fileURLToPath(new URL('../../../Microi一键编译发布.sh',import.meta.url));
    fs.copyFileSync(original,path.join(root,'publish.sh'));
    const target=path.join(root,'Microi.Server/tools');fs.mkdirSync(target,{recursive:true});fs.copyFileSync(tool,path.join(target,'release-lock.mjs'));
    fs.mkdirSync(path.join(root,'Microi.Agent/apps/microi-code'),{recursive:true});fs.writeFileSync(path.join(root,'Microi.Agent/apps/microi-code/package.json'),'{}');
    fs.writeFileSync(path.join(root,'Microi.Agent/一键打包Mac.sh'),'#!/bin/bash\nnode Microi.Server/tools/release-lock.mjs status platform "$PWD" >/dev/null\nexit 7\n');
    acquireReleaseLock(root,'api',process.pid,token);
    const run=spawnSync(bash,[path.join(root,'publish.sh'),'--microi-code','--mac'],{cwd:root,encoding:'utf8',timeout:15000});
    assert.equal(run.status,7,run.stderr);assert.ok(!fs.existsSync(path.join(root,'.tmp/microi-process-state/agent-release.lock')),run.stdout+run.stderr);
    assert.ok(fs.existsSync(path.join(root,'.tmp/microi-process-state/api-release.lock')));
}));

test('unknown old platform lock protects API, PC and website while Agent remains independent',()=>withFixture(root=>{
    owner(root,'platform-release.lock',`pid=${process.pid}\nworkspace=${root}\ndomain=platform\n`);
    for(const scope of ['api','pc','website'])assert.throws(()=>assertReleaseAvailable(root,scope),/被占用/);
    assertReleaseAvailable(root,'agent');
}));
test('verified old API hotfix process permits PC and website without changing its original lock',async()=>{
    const root=fixture(),script=path.join(root,'Microi一键编译发布.sh');
    fs.writeFileSync(script,'setInterval(()=>{},1000);');
    const child=spawn(process.execPath,[script,'--docker-only-hotfix'],{cwd:root,stdio:'ignore'});
    try{
        await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});
        const lock=owner(root,'platform-release.lock',`pid=${child.pid}\nworkspace=${root}\ndomain=platform\n`);
        const before=fs.readFileSync(path.join(lock,'owner.env'),'utf8');
        assert.throws(()=>assertReleaseAvailable(root,'api'),/被占用/);
        for(const scope of ['pc','website','agent'])assertReleaseAvailable(root,scope);
        assert.equal(fs.readFileSync(path.join(lock,'owner.env'),'utf8'),before);
    }finally{child.kill();await new Promise(resolve=>child.once('exit',resolve));fs.rmSync(root,{recursive:true,force:true});}
});
test('combined Bash acquisition failure releases only locks obtained by that invocation',()=>withFixture(root=>{
    const original=fs.readFileSync(fileURLToPath(new URL('../../../Microi一键编译发布.sh',import.meta.url)),'utf8');
    const start=original.indexOf('release_workspace_lock() {'),end=original.indexOf('\nprepare_release_workspace()',start);
    const target=path.join(root,'Microi.Server/tools');fs.mkdirSync(target,{recursive:true});fs.copyFileSync(tool,path.join(target,'release-lock.mjs'));
    const pc=acquireReleaseLock(root,'pc',process.pid,token);
    const before=fs.readFileSync(path.join(pc.path,'owner.env'),'utf8');
    const run=spawnSync(bash,['-c',`set -e; print_info(){ :; }; print_fail(){ exit 1; }; MICROI_RELEASE_LOCK_HELD=false; ${original.slice(start,end)}
BUILD_BACKEND=true; BUILD_CLIENT=true; PUBLISH_DOC=false; MICROI_FULL_ONLY=false; SELECTED_API_PLANS=(); SELECTED_CLIENT_PLANS=(); acquire_workspace_lock`],{cwd:root,encoding:'utf8',timeout:15000});
    assert.equal(run.status,1);assert.ok(!fs.existsSync(path.join(root,'.tmp/microi-process-state/api-release.lock')));
    assert.equal(fs.readFileSync(path.join(pc.path,'owner.env'),'utf8'),before);
}));

for(const [scope,flags] of [
    ['api','BUILD_BACKEND=true; BUILD_CLIENT=false; PUBLISH_DOC=false'],
    ['pc','BUILD_BACKEND=false; BUILD_CLIENT=true; PUBLISH_DOC=false'],
    ['website','BUILD_BACKEND=false; BUILD_CLIENT=false; PUBLISH_DOC=true']
])test('actual Bash single '+scope+' release acquires only its selected scope',()=>withFixture(root=>{
    const original=fs.readFileSync(fileURLToPath(new URL('../../../Microi一键编译发布.sh',import.meta.url)),'utf8');
    const start=original.indexOf('release_workspace_lock() {'),end=original.indexOf('\nprepare_release_workspace()',start);
    const target=path.join(root,'Microi.Server/tools');fs.mkdirSync(target,{recursive:true});fs.copyFileSync(tool,path.join(target,'release-lock.mjs'));
    const run=spawnSync(bash,['-c',`set -e; print_info(){ :; }; print_fail(){ exit 1; }; MICROI_RELEASE_LOCK_HELD=false; ${original.slice(start,end)}
${flags}; MICROI_FULL_ONLY=false; SELECTED_API_PLANS=(); SELECTED_CLIENT_PLANS=(); acquire_workspace_lock
node Microi.Server/tools/release-lock.mjs status ${scope} "$PWD"
release_workspace_lock`],{cwd:root,encoding:'utf8',timeout:15000});
    assert.equal(run.status,0,run.stderr);
    const active=JSON.parse(run.stdout.split('\n').find(line=>line.startsWith('['))).filter(lock=>lock.exists);
    assert.deepEqual(active.map(lock=>lock.domain),[scope]);
    assert.equal(active[0].running,true,'The actual shell owner must remain live in the native Node PID namespace.');
}));

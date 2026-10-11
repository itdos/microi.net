import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const resources=import.meta.dirname;
const root=path.resolve(resources,'../../..');
const temporaryRoot=path.join(root,'.tmp');
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');

function fixture(){
 fs.mkdirSync(temporaryRoot,{recursive:true});
 const directory=fs.mkdtempSync(path.join(temporaryRoot,'platform-bootstrap-coherence-'));
 const resourcePath=path.join(directory,'Microi.Server/OfficialApplications/Resource');
 const upgradePath=path.join(directory,'Microi.Server/Microi.Upgrade/Resource');
 // 真实脚本在独占副本上运行；故障注入和清理绝不修改正式源码或同一机器的其它候选。
 fs.cpSync(resources,resourcePath,{recursive:true});
 const contract=JSON.parse(fs.readFileSync(path.join(resources,'platform-service-release.json'),'utf8'));
 fs.cpSync(path.join(root,contract.SourceRoot),path.join(directory,contract.SourceRoot),{
  recursive:true,filter:source=>!source.split(path.sep).includes('node_modules')
 });
 fs.mkdirSync(upgradePath,{recursive:true});
 for(const name of ['app.microi.bootstrap.json','import-package.js'])fs.copyFileSync(path.join(root,'Microi.Server/Microi.Upgrade/Resource',name),path.join(upgradePath,name));
 const run=(name,args=[])=>spawnSync(process.execPath,['--max-old-space-size=512',path.join(resourcePath,name),...args],{cwd:directory,encoding:'utf8',windowsHide:true,timeout:30000,maxBuffer:1024*1024});
 const bootstrap=path.join(upgradePath,'app.microi.bootstrap.json');
 const corrupt=()=>{const value=JSON.parse(fs.readFileSync(bootstrap,'utf8'));value.ApplicationBundles[0].MicroService.UpdateTime='2000-01-01 00:00:00';fs.writeFileSync(bootstrap,JSON.stringify(value,null,2)+'\n');};
 const cleanup=()=>{const resolved=path.resolve(directory);assert.equal(path.dirname(resolved),path.resolve(temporaryRoot));assert.ok(path.basename(resolved).startsWith('platform-bootstrap-coherence-'));fs.rmSync(resolved,{recursive:true,force:true});};
 return {directory,resourcePath,upgradePath,bootstrap,run,corrupt,cleanup};
}

test('仅验证共享运行包也拒绝漂移的启动恢复投影，且不改写文件',()=>{
 const f=fixture();try {
  f.corrupt();const before=hash(f.bootstrap);
  const result=f.run('embed-platform-service-bundle.mjs',['--verify-only']);
  assert.notEqual(result.status,0,'启动恢复投影漂移必须在打包器验证入口被拒绝');
  assert.match(result.stderr,/启动资源漂移/);
  assert.equal(hash(f.bootstrap),before,'verify-only 不得顺便修复或覆盖文件');
 }finally{f.cleanup();}
});

test('共享运行包生成后自动同步最小恢复资源，原始投影校验及再次验证通过',()=>{
 const f=fixture();try {
  f.corrupt();
  const generated=f.run('embed-platform-service-bundle.mjs',['--timestamp=2026-10-06T22:19:17.000Z']);assert.equal(generated.status,0,generated.stderr.slice(0,1200));
  const checked=f.run('build-bootstrap-package.mjs',['--check']);assert.equal(checked.status,0,checked.stderr.slice(0,1200));
  const value=JSON.parse(fs.readFileSync(f.bootstrap,'utf8'));
  assert.equal(value.PackageInfo.AppId,'app.microi.bootstrap');assert.deepEqual(value.DataSets,[]);assert.deepEqual(value.ScheduleJobs,[]);
  assert.deepEqual(value.ApplicationBundles[0].Routes.map(r=>r.RoutePath),['/marketplace']);
  const names=['app.microi.saas-engine.json','app.microi.store.json','app.microi.message-notification.json','app.microi.sys-log.json'];
  const before=names.map(name=>hash(path.join(f.resourcePath,name))).concat(hash(f.bootstrap),hash(path.join(f.upgradePath,'import-package.js')));
  const verified=f.run('embed-platform-service-bundle.mjs',['--verify-only']);assert.equal(verified.status,0,verified.stderr.slice(0,1200));
  assert.deepEqual(names.map(name=>hash(path.join(f.resourcePath,name))).concat(hash(f.bootstrap),hash(path.join(f.upgradePath,'import-package.js'))),before);
 }finally{f.cleanup();}
});

test('恢复导入脚本漂移同样在共享运行包验证入口被拒绝',()=>{
 const f=fixture();try {
  const generated=f.run('build-bootstrap-package.mjs');assert.equal(generated.status,0);
  const importer=path.join(f.upgradePath,'import-package.js');fs.appendFileSync(importer,'\n// 独占测试的漂移注入\n');const before=hash(importer);
  const result=f.run('embed-platform-service-bundle.mjs',['--verify-only']);assert.notEqual(result.status,0);assert.match(result.stderr,/启动资源漂移/);assert.equal(hash(importer),before);
 }finally{f.cleanup();}
});

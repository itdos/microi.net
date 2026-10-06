import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const contractFile=path.join(repo,'AI-Project/标准产品套件/source-contract.json');
const contract=JSON.parse(fs.readFileSync(contractFile,'utf8'));
// 契约使用仓库相对路径，跨设备只改变仓库根；不得探测多份目录后任选最新副本。
function inside(root,relative,label){
  assert.ok(typeof relative==='string'&&relative.length>0&&!path.isAbsolute(relative),label+'必须为仓库相对路径');
  const resolved=path.resolve(root,relative),child=path.relative(root,resolved);
  assert.ok(child!==''&&!child.startsWith('..'+path.sep)&&child!=='..'&&!path.isAbsolute(child),label+'越过仓库根');
  assert.ok(fs.existsSync(resolved),label+'缺失：'+resolved);
  const actual=fs.realpathSync(resolved),actualChild=path.relative(fs.realpathSync(root),actual);
  assert.ok(actualChild!==''&&!actualChild.startsWith('..'+path.sep)&&actualChild!=='..'&&!path.isAbsolute(actualChild),label+'实际路径越过仓库根');
  assert.ok(fs.statSync(actual).isDirectory(),label+'必须为目录');return actual;
}
function resolveContract(model){
  assert.equal(model.schemaVersion,1,'不支持的唯一源码契约版本');
  assert.equal(model.target?.apiBase,'https://api.itdos.com','官方发布ApiBase不匹配');
  assert.equal(String(model.target?.osClient||'').toLowerCase(),'itdos','官方发布OsClient不匹配');
  const requirements=inside(repo,model.requirementsRoot,'需求根'),parent=inside(repo,model.sourceParent,'责任源码根');
  assert.equal(requirements,path.dirname(fs.realpathSync(contractFile)),'契约必须位于声明的需求根');
  assert.ok(Array.isArray(model.applications)&&model.applications.length===6,'标准套件必须声明六个责任应用');
  const keys=new Set(),packages=new Set();
  const apps=model.applications.map(app=>{
    assert.match(app.appKey,/^[a-z0-9][a-z0-9_-]*$/,'AppKey不是安全目录名');
    assert.ok(!keys.has(app.appKey)&&typeof app.packageKey==='string'&&!packages.has(app.packageKey),'重复应用或包归属');
    keys.add(app.appKey);packages.add(app.packageKey);
    const root=inside(parent,app.appKey,app.appKey+'源码');
    return {...app,root,tests:inside(root,'tests',app.appKey+'测试')};
  });return {requirements,parent,apps};
}
const sources=resolveContract(contract);
// 唯一源码契约驱动发现，不能从同步镜像或旧发行产物择新，也不能零用例放行。
function discover(folder){return fs.readdirSync(folder,{withFileTypes:true}).flatMap(x=>x.isDirectory()?(/^(node_modules|bin|obj|TestResults|\.git)$/.test(x.name)?[]:discover(path.join(folder,x.name))):/\.(?:test|spec)\.[cm]?js$/.test(x.name)?[path.join(folder,x.name)]:[]).sort();}
test('唯一源码契约从当前仓库解析六应用且保持官方发布身份',()=>{
  assert.equal(sources.apps.length,6);assert.equal(sources.requirements,path.dirname(fs.realpathSync(contractFile)));
  for(const app of sources.apps)assert.ok(app.root.startsWith(sources.parent+path.sep));
});
test('唯一源码契约拒绝缺失及越界源码而不探测其它副本',()=>{
  for(const sourceParent of ['/tmp','../missing-standard-suite','Microi-V8-Engine/__missing-standard-suite__'])assert.throws(()=>resolveContract({...contract,sourceParent}),/相对路径|越过|缺失/);
});
test('唯一源码契约拒绝发布身份漂移及应用目录伪造',()=>{
  assert.throws(()=>resolveContract({...contract,target:{...contract.target,apiBase:'https://example.com'}}),/ApiBase/);
  assert.throws(()=>resolveContract({...contract,target:{...contract.target,osClient:'other'}}),/OsClient/);
  assert.throws(()=>resolveContract({...contract,applications:[]}),/六个/);
  assert.throws(()=>resolveContract({...contract,applications:contract.applications.map((app,i)=>i===0?{...app,appKey:'../other'}:app)}),/安全目录名/);
  assert.throws(()=>resolveContract({...contract,applications:contract.applications.map((app,i)=>i===1?contract.applications[0]:app)}),/重复应用/);
});
for(const app of sources.apps){
  const files=discover(app.tests);assert.ok(files.length>0,'缺少应用责任测试');
  // 每份责任文件独立使用原有60秒、768MB限额；串行执行全部发现文件。
  // 不把多个本来各自合格的文件合并进同一个60秒预算，也不放宽任何单文件限额。
  const groupSize=1;
  const groups=Array.from({length:Math.ceil(files.length/groupSize)},(_,i)=>files.slice(i*groupSize,(i+1)*groupSize));
  assert.deepEqual(groups.flat(),files,'责任测试分组必须完整且不重复');
  test(app.name+'责任源码离线回归',{timeout:65000*groups.length},t=>{
    const env={...process.env};delete env.NODE_TEST_CONTEXT;let total=0;
    for(const [index,group] of groups.entries()){
      const r=spawnSync(process.execPath,['--max-old-space-size=768','--test','--test-concurrency=1','--test-reporter=tap',...group],{cwd:app.root,env,windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
      const label=app.appKey+'组'+(index+1)+'/'+groups.length+'：'+group.map(f=>path.relative(app.tests,f)).join(', ');
      assert.ok(!r.error,label+'\n'+(r.error?.message||'')+'\n'+(r.stdout||'')+(r.stderr||''));assert.equal(r.status,0,label+'\n'+(r.stdout||'')+(r.stderr||''));
      const count=label=>Number([...r.stdout.matchAll(new RegExp('^# '+label+' (\\d+)\\r?$','gm'))].at(-1)?.[1]??NaN);
      assert.ok(count('tests')>0,'零用例不能作为回归证据');
      assert.equal(count('pass'),count('tests'),'应用测试数与通过数不一致');
      for(const label of ['fail','cancelled','skipped','todo'])assert.equal(count(label),0,'应用测试存在'+label);
      total+=count('tests');t.diagnostic(app.appKey+'组'+(index+1)+'/'+groups.length+'：'+group.length+'份文件、'+count('tests')+'项全部通过');
    }
    t.diagnostic(app.appKey+'：'+files.length+'份测试文件，'+total+'项责任回归通过，零失败/取消/跳过/待办');
  });
}

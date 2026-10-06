import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
// 执行生产导出器原文的持久日志归一化分支；FormEngine读取使用本地夹具，非真实数据库验收。
const source=fs.readFileSync(new URL('./export-package.js',import.meta.url),'utf8');
const begin=source.indexOf("        var persistTitle = '';");
const end=source.indexOf('        var packageJson = JSON.stringify(packageData);',begin);
assert.ok(begin>=0&&end>begin,'必须找到生产持久化分支，不能以替代实现通过');
const script=new vm.Script(source.slice(begin,end));
const valid={Version:'v8.4.20',Title:'修复日志分类',Content:'真实修复说明',ChangeType:'Fix',ReleaseTime:'2026-10-04 08:00:00',Sort:100};
function run({incoming=valid,rows=[],prepared={Version:'v8.4.20',ChangeLog:{...valid,ChangeType:'Feature'},ChangeHistory:'保留历史'},minimum='v8.4.0'}={}){
  let reads=0;
  const context={PersistChangeLog:incoming,PersistStoreId:'store',exactPackageVersion:'v8.4.20',copyArray:a=>Array.from(a),packageData:{PackageInfo:structuredClone(prepared)},storeRow:{AppName:'商城',AppKey:'app.microi.store',ApplicationType:'Platform',ServerMinVersion:minimum,ClientMinVersion:minimum},PackageName:'商城',PersistAppKey:'app.microi.store',RequestedServerMinVersion:'',RequestedClientMinVersion:'',V8:{FormEngine:{GetTableData(name,args){assert.equal(name,'sys_microistore_changelog');assert.ok(args._Where.some(x=>x.includes('v8.4.20')));reads++;return{Code:1,Data:structuredClone(rows)};}}}};
  script.runInNewContext(context,{timeout:1000});
  return {info:JSON.parse(JSON.stringify(context.packageData.PackageInfo)),reads};
}
for(const ChangeType of ['Feature','Improvement','Fix','Security','Breaking'])test('新正式日志分类保留 '+ChangeType,()=>{
  const value={...valid,ChangeType};const {info,reads}=run({incoming:value});
  assert.deepEqual(info.ChangeLog,{Version:value.Version,Title:value.Title,ChangeType,Content:value.Content,ReleaseTime:value.ReleaseTime});
  assert.equal(info.ChangeHistory,'保留历史');assert.equal(info.ServerMinVersion,'v8.4.0');assert.equal(reads,2);
});
for(const ChangeType of [undefined,'',' ','Unknown','feature',4])test('新日志非法或缺分类拒绝 '+String(ChangeType),()=>{
  const value={...valid,ChangeType};assert.throws(()=>run({incoming:value}),/ChangeType|日志/);
});
test('已有正式日志回放保留分类和正文，不采用Prepared的不同分类',()=>{
  assert.equal(run({incoming:null,rows:[valid]}).info.ChangeLog.ChangeType,'Fix');
  assert.equal(run({rows:[valid]}).info.ChangeLog.Content,valid.Content);
});
test('已有正式日志缺失或未知分类失败，不默补历史',()=>{
  for(const ChangeType of [undefined,'','Unknown'])assert.throws(()=>run({incoming:null,rows:[{...valid,ChangeType}]}),/ChangeType/);
});
test('同版本已存在但分类不同拒绝',()=>assert.throws(()=>run({rows:[{...valid,ChangeType:'Feature'}]}),/不一致/));
test('无正式日志且无新日志拒绝；重复正式日志拒绝',()=>{
  assert.throws(()=>run({incoming:null}),/仅维护一条/);assert.throws(()=>run({rows:[valid,valid]}),/重复/);
});
test('原有必填内容门禁保留',()=>{
  for(const field of ['Title','Content','ReleaseTime'])assert.throws(()=>run({incoming:{...valid,[field]:''}}),/必须包含/);
});

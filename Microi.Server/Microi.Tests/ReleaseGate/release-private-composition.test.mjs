import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {snapshotCandidate,changedCandidate} from '../../tools/release-candidate.mjs';
import {verifyArtifact} from '../../tools/release-artifact.mjs';

async function fixture(){
 const root=await mkdtemp(path.join(tmpdir(),'microi-release-composition-'));
 execFileSync('git',['init','--quiet'],{cwd:root});
 await writeFile(path.join(root,'.gitignore'),'private-app/\n.tmp/\n');
 const sources=['private-app/Rules.cs','private-app/Rules.csproj','private-app/composition.targets','.tmp/ApprovedBootstrap.cs','Core.csproj'];
 for(const name of sources){await mkdir(path.dirname(path.join(root,name)),{recursive:true});await writeFile(path.join(root,name),'before');}
 const properties={CustomAfterMicrosoftCommonTargets:'private-app/composition.targets',PrivateRulesProject:'private-app/Rules.csproj',ApprovedRulesBootstrapSource:'.tmp/ApprovedBootstrap.cs',MicroiCoreProject:'Core.csproj'};
 const manifest='.tmp/composition.json';
 const composition={schema:1,properties,files:sources.filter(x=>x!=='private-app/Rules.cs'),directories:['private-app'],artifacts:[{path:'publish/Rules.dll',sha256:'a'.repeat(64)}]};
 await writeFile(path.join(root,manifest),JSON.stringify(composition));
 const environment=Object.fromEntries(Object.entries(properties).map(([key,value])=>[key,path.join(root,value)]));
 return {root,manifest,composition,environment,options:{compositionManifest:manifest,environment}};
}
async function cleanup(root){
 // 只删除本用例在系统临时目录中新建的目录；失败时不能越过临时目录边界。
 assert.equal(path.resolve(path.dirname(root)),path.resolve(tmpdir()));assert.ok(path.basename(root).startsWith('microi-release-composition-'));
 await rm(root,{recursive:true,force:true});
}
test('显式私有编译组合必须覆盖根仓忽略的规则源码，Full 后修改不能继续发布',async()=>{
 const f=await fixture();
 try{
  const before=await snapshotCandidate(f.root,['.'],f.options);
  await writeFile(path.join(f.root,'private-app/Rules.cs'),'changed after Full');
  assert.deepEqual(changedCandidate(before,await snapshotCandidate(f.root,['.'],f.options)),['private-app/Rules.cs']);
 }finally{await cleanup(f.root);}
});
test('新增、删除私有代码及静态审批正文均进入候选，不把 bin/obj 构建投影视为源码',async()=>{
 const f=await fixture();
 try{
  const before=await snapshotCandidate(f.root,['.'],f.options);
  await mkdir(path.join(f.root,'private-app/bin'));await writeFile(path.join(f.root,'private-app/bin/generated.dll'),'output');
  assert.deepEqual(changedCandidate(before,await snapshotCandidate(f.root,['.'],f.options)),[]);
  await writeFile(path.join(f.root,'private-app/Added.cs'),'new');await rm(path.join(f.root,'private-app/Rules.cs'));await writeFile(path.join(f.root,'.tmp/ApprovedBootstrap.cs'),'changed approval');
  assert.deepEqual(changedCandidate(before,await snapshotCandidate(f.root,['.'],f.options)),['.tmp/ApprovedBootstrap.cs','private-app/Added.cs','private-app/Rules.cs']);
 }finally{await cleanup(f.root);}
});
test('实际 MSBuild 参数必须匹配冻结契约，缺失契约、源文件或未知配置均拒绝',async()=>{
 const f=await fixture();
 try{
  await assert.rejects(snapshotCandidate(f.root,['.'],{environment:f.environment}),/require.*COMPOSITION_FILE/);
  await assert.rejects(snapshotCandidate(f.root,['.'],{...f.options,environment:{...f.environment,PrivateRulesProject:path.join(f.root,'Core.csproj')}}),/Actual MSBuild property differs/);
  const altered=structuredClone(f.composition);altered.properties.Unknown='Core.csproj';await writeFile(path.join(f.root,f.manifest),JSON.stringify(altered));
  await assert.rejects(snapshotCandidate(f.root,['.'],f.options),/four fixed/);
  await writeFile(path.join(f.root,f.manifest),JSON.stringify(f.composition));await rm(path.join(f.root,'.tmp/ApprovedBootstrap.cs'));
  await assert.rejects(snapshotCandidate(f.root,['.'],f.options),/ENOENT/);
 }finally{await cleanup(f.root);}
});
test('私有契约禁止越界路径和链接，不能读取未绑定的外部工作区',async()=>{
 const f=await fixture();
 try{
  const altered=structuredClone(f.composition);altered.files.push('../outside.cs');await writeFile(path.join(f.root,f.manifest),JSON.stringify(altered));
  await assert.rejects(snapshotCandidate(f.root,['.'],f.options),/escapes/);
  await writeFile(path.join(f.root,f.manifest),JSON.stringify(f.composition));
  // Windows 目录联接不需要开发者模式；同样属于禁止的重解析路径。
  await symlink(path.join(f.root,'private-app'),path.join(f.root,'link'),'junction');
  const linked=structuredClone(f.composition);linked.directories=['link'];await writeFile(path.join(f.root,f.manifest),JSON.stringify(linked));
  await assert.rejects(snapshotCandidate(f.root,['.'],f.options),/symbolic link/);
  await rm(path.join(f.root,'link'));
 }finally{await cleanup(f.root);}
});
test('后台审批 DLL 缺失或 hash 不同阻止 API 制品，PC 制品仍按自身上下文验收',async()=>{
 const candidate={files:{'source.cs':'before'},composition:{schema:1,artifacts:[{path:'publish/Rules.dll',sha256:'a'.repeat(64)}]}};
 const files={'Dockerfile':'recipe','publish/api.dll':'api','publish/Rules.dll':'a'.repeat(64)};
 const receipt={schema:1,gate:'Full',candidate,files};assert.doesNotThrow(()=>verifyArtifact(receipt,candidate,files));
 for(const value of [undefined,'b'.repeat(64)]){const changed={...files};if(value===undefined)delete changed['publish/Rules.dll'];else changed['publish/Rules.dll']=value;assert.throws(()=>verifyArtifact({...receipt,files:changed},candidate,changed),/Private approved artifact/);}
 const client={'Dockerfile':'recipe','default.conf':'nginx','dist/main.js':'client'};assert.doesNotThrow(()=>verifyArtifact({...receipt,files:client},candidate,client,'client'));
});
test('无私有组合的旧候选与制品保持原有门禁语义',async()=>{
 const f=await fixture();
 try{
  const before=await snapshotCandidate(f.root,['.'],{environment:{}});assert.equal(before.composition,undefined);
  await writeFile(path.join(f.root,'private-app/Rules.cs'),'independent application source');
  assert.deepEqual(changedCandidate(before,await snapshotCandidate(f.root,['.'],{environment:{}})),[]);
  const after={...before,composition:{schema:1}};assert.deepEqual(changedCandidate(before,after),['<private-build-composition>']);
 }finally{await cleanup(f.root);}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {snapshotCandidate,changedCandidate} from '../../tools/release-candidate.mjs';

test('candidate detects edited, newly added and deleted source across repository boundaries',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'microi-release-candidate-'));
 try{
  for(const repo of ['.','private']){
   const cwd=path.resolve(root,repo);await mkdir(cwd,{recursive:true});
   execFileSync('git',['init','--quiet'],{cwd});
   await writeFile(path.join(cwd,'source.cs'),'before');
   execFileSync('git',['add','source.cs'],{cwd});
  }
  await writeFile(path.join(root,'.gitignore'),'private/\n');
  const before=await snapshotCandidate(root,['.','private']);
  await writeFile(path.join(root,'source.cs'),'after');
  await writeFile(path.join(root,'new.cs'),'new source');
  await rm(path.join(root,'private','source.cs'));
  assert.deepEqual(changedCandidate(before,await snapshotCandidate(root,['.','private'])),['new.cs','private/source.cs','source.cs']);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('generated outputs do not hide changed embedded application package source',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'microi-release-candidate-'));
 try{
  execFileSync('git',['init','--quiet'],{cwd:root});
  await mkdir(path.join(root,'dist'));await mkdir(path.join(root,'.resource-sync-base'));
  await writeFile(path.join(root,'package.json'),'{"Version":"1"}');
  const before=await snapshotCandidate(root,['.']);
  await writeFile(path.join(root,'dist','bundle.js'),'build result');
  await writeFile(path.join(root,'.resource-sync-base','package.json'),'publication receipt');
  assert.deepEqual(changedCandidate(before,await snapshotCandidate(root,['.'])),[]);
  await writeFile(path.join(root,'package.json'),'{"Version":"2"}');
  assert.deepEqual(changedCandidate(before,await snapshotCandidate(root,['.'])),['package.json']);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('independent UniApp delivery does not invalidate PC API images but shared SDK and image inputs remain guarded',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'microi-release-candidate-'));
 try{
  execFileSync('git',['init','--quiet'],{cwd:root});
  const contents={
   'microi.uniapp/package.json':'{"version":"1"}',
   'microi.uniapp/src/pages/customer.vue':'mobile before',
   'microi.uniapp/src/utils/microi.v8.js':'sdk before',
   'Microi.Client/src/main.js':'client before',
   'Microi.Server/Microi.Upgrade/Resource/app.json':'package before'
  };
  for(const [name,content]of Object.entries(contents)){
   await mkdir(path.dirname(path.join(root,name)),{recursive:true});
   await writeFile(path.join(root,name),content);
  }
  const before=await snapshotCandidate(root,['.']);
  await writeFile(path.join(root,'microi.uniapp/package.json'),'{"version":"2"}');
  await writeFile(path.join(root,'microi.uniapp/src/pages/customer.vue'),'mobile after');
  assert.deepEqual(changedCandidate(before,await snapshotCandidate(root,['.'])),[]);
  for(const name of ['microi.uniapp/src/utils/microi.v8.js','Microi.Client/src/main.js','Microi.Server/Microi.Upgrade/Resource/app.json']){
   await writeFile(path.join(root,name),'after');
  }
  assert.deepEqual(changedCandidate(before,await snapshotCandidate(root,['.'])),[
   'Microi.Client/src/main.js','Microi.Server/Microi.Upgrade/Resource/app.json','microi.uniapp/src/utils/microi.v8.js'
  ]);
 }finally{await rm(root,{recursive:true,force:true});}
});

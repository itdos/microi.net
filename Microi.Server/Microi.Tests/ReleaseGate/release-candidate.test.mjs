import test, {beforeEach, afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {snapshotCandidate,changedCandidate} from '../../tools/release-candidate.mjs';

// Fixture roots must not consume the parent release process's private smoke configuration.
let inheritedSmokeConfig;
beforeEach(()=>{ inheritedSmokeConfig=process.env.MICROI_RELEASE_SMOKE_CONFIG;delete process.env.MICROI_RELEASE_SMOKE_CONFIG; });
afterEach(()=>{ if(inheritedSmokeConfig===undefined)delete process.env.MICROI_RELEASE_SMOKE_CONFIG;else process.env.MICROI_RELEASE_SMOKE_CONFIG=inheritedSmokeConfig; });

async function smokeFixture(t){
 const root=await mkdtemp(path.join(tmpdir(),'microi-release-smoke-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 execFileSync('git',['init','--quiet'],{cwd:root});
 const api='Microi.Server/Microi.net.Api';
 await mkdir(path.join(root,api),{recursive:true});
 await writeFile(path.join(root,'.gitignore'),`${api}/.microi-local\n${api}/appsettings.*.json\n.tmp/\n`);
 const marker=path.join(root,api,'.microi-local'),config=path.join(root,api,'appsettings.IsolatedSmoke.json');
 await writeFile(marker,'IsolatedSmoke\n');
 await writeFile(config,JSON.stringify({AppSettings:{OsClient:'IsolatedSmoke',OsClientDbConn:'private-fixture-secret'}}));
 return {root,api,marker,config};
}

test('PlatformRelease excludes exactly Agent and Code products while freezing platform sources and root HEAD',async t=>{
 const f=await smokeFixture(t);
 execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','--quiet','-m','fixture'],{cwd:f.root});
 const platform='Microi.Client/src/platform.js';await mkdir(path.dirname(path.join(f.root,platform)),{recursive:true});await writeFile(path.join(f.root,platform),'before');
 const snapshot=()=>snapshotCandidate(f.root,['.','Microi.Agent'],{testPolicy:'PlatformRelease'});
 const before=await snapshot();assert.equal(before.scope,'PlatformRelease');assert.match(before.sourceHead,/^[a-f0-9]{40}$/);
 for(const product of ['Microi.Agent','Microi.Code']){await mkdir(path.join(f.root,product),{recursive:true});await writeFile(path.join(f.root,product,'source.js'),'independent');}
 assert.deepEqual(changedCandidate(before,await snapshot()),[]);
 await writeFile(path.join(f.root,'Microi.Agent/source.js'),'changed');await rm(path.join(f.root,'Microi.Code'),{recursive:true});
 assert.deepEqual(changedCandidate(before,await snapshot()),[]);
 await writeFile(path.join(f.root,platform),'after');assert.deepEqual(changedCandidate(before,await snapshot()),[platform]);
 assert.ok(changedCandidate(before,{...before,scope:'pc-api-docker-with-mobile-sdk-contracts'}).includes('<candidate-scope>'));
 assert.ok(changedCandidate(before,{...before,sourceHead:'b'.repeat(40)}).includes('<candidate-head>'));
});

test('complete platform candidate binds website sources and rejects changing the selected website scope',async t=>{
 const f=await smokeFixture(t);
 execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','--allow-empty','--quiet','-m','fixture'],{cwd:f.root});
 const files=['microi.doc/docs/doc/guide.md','microi.doc/package.json','microi.doc/pnpm-lock.yaml'];
 for(const name of files){await mkdir(path.dirname(path.join(f.root,name)),{recursive:true});await writeFile(path.join(f.root,name),'before');}
 const snapshot=includeDocumentation=>snapshotCandidate(f.root,['.'],{testPolicy:'PlatformRelease',includeDocumentation});
 const before=await snapshot(true),local=await snapshot(false);
 assert.equal(before.documentationIncluded,true);for(const name of files)assert.match(before.files[name],/^[a-f0-9]{64}$/);
 assert.ok(changedCandidate(before,local).includes('<documentation-scope>'));
 for(const name of files)await writeFile(path.join(f.root,name),'after');
 assert.deepEqual(changedCandidate(before,await snapshot(true)),files.sort());
 assert.deepEqual(changedCandidate(local,await snapshot(false)),[],'Explicit partial platform release keeps the independent website scope');
});

test('ignored local smoke marker and exact selected configuration are frozen without disclosing secrets',async t=>{
 const f=await smokeFixture(t),before=await snapshotCandidate(f.root,['.']);
 assert.match(before.files[`${f.api}/.microi-local`],/^[a-f0-9]{64}$/);
 assert.match(before.files[`${f.api}/appsettings.IsolatedSmoke.json`],/^[a-f0-9]{64}$/);
 assert.doesNotMatch(JSON.stringify(before),/private-fixture-secret/);
 await writeFile(f.config,JSON.stringify({AppSettings:{OsClient:'IsolatedSmoke',OsClientDbConn:'changed-fixture-secret'}}));
 assert.deepEqual(changedCandidate(before,await snapshotCandidate(f.root,['.'])),[`${f.api}/appsettings.IsolatedSmoke.json`]);
});

test('local smoke marker appearance and removal cannot evade an earlier Full candidate',async t=>{
 const f=await smokeFixture(t);await rm(f.marker);
 const absent=await snapshotCandidate(f.root,['.']);
 await writeFile(f.marker,'IsolatedSmoke\n');
 const present=await snapshotCandidate(f.root,['.']);
 assert.deepEqual(changedCandidate(absent,present),[`${f.api}/.microi-local`,`${f.api}/appsettings.IsolatedSmoke.json`]);
 await rm(f.marker);assert.deepEqual(changedCandidate(present,await snapshotCandidate(f.root,['.'])),[`${f.api}/.microi-local`,`${f.api}/appsettings.IsolatedSmoke.json`]);
});

test('explicit isolated smoke configuration is frozen and changes invalidate the candidate',async t=>{
 const f=await smokeFixture(t);
 process.env.MICROI_RELEASE_SMOKE_CONFIG=f.config;
 const before=await snapshotCandidate(f.root,['.']);
 assert.match(before.files['@smoke-config'],/^[a-f0-9]{64}$/);
 assert.equal(before.files[`${f.api}/.microi-local`],undefined);
 assert.doesNotMatch(JSON.stringify(before),/private-fixture-secret/);
 await writeFile(f.config,JSON.stringify({AppSettings:{OsClient:'IsolatedSmoke',OsClientDbConn:'changed-fixture-secret'}}));
 assert.deepEqual(changedCandidate(before,await snapshotCandidate(f.root,['.'])),['@smoke-config']);
 await writeFile(f.config,JSON.stringify({AppSettings:{OsClient:'IsolatedSmoke',ExtraBusinessSwitch:1}}));
 await assert.rejects(snapshotCandidate(f.root,['.']),/AppSettings/);
});

test('missing, malformed or non-whitelisted smoke configuration and unsafe environment names fail closed',async t=>{
 const f=await smokeFixture(t);
 await rm(f.config);await assert.rejects(snapshotCandidate(f.root,['.']),/smoke|local environment/i);
 await writeFile(f.config,'{bad json');await assert.rejects(snapshotCandidate(f.root,['.']),/smoke|local environment/i);
 await writeFile(f.config,JSON.stringify({AppSettings:{OsClient:'IsolatedSmoke',ExtraBusinessSwitch:1}}));
 await assert.rejects(snapshotCandidate(f.root,['.']),/AppSettings/);
 for(const value of ['', '..', '../outside', 'a/b', 'a\\b', 'a\nb']){
  await writeFile(f.marker,value);await assert.rejects(snapshotCandidate(f.root,['.']),/local environment/i);
 }
});

test('smoke configuration links and linked parent directories cannot escape the candidate',async t=>{
 const f=await smokeFixture(t),privateRoot=path.join(f.root,'.tmp');await mkdir(privateRoot);
 const outside=path.join(privateRoot,'outside.json');await writeFile(outside,'{}');
 await rm(f.config);await symlink(outside,f.config,'file');
 await assert.rejects(snapshotCandidate(f.root,['.']),/link|regular file/i);
 await rm(f.config);await writeFile(f.config,'{}');
 await rm(path.join(f.root,f.api),{recursive:true,force:true});
 await writeFile(path.join(privateRoot,'.microi-local'),'IsolatedSmoke');
 await writeFile(path.join(privateRoot,'appsettings.IsolatedSmoke.json'),'{}');
 await symlink(privateRoot,path.join(f.root,f.api),'junction');
 await assert.rejects(snapshotCandidate(f.root,['.']),/link|directory/i);
});

test('only documented plugin build timestamps are ignored; versions, hashes and executable source stay guarded',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'microi-release-candidate-'));
 const name='Microi.Agent/plugins/microi/assets/build-meta.json';
 try{
  execFileSync('git',['init','--quiet'],{cwd:root});
  await mkdir(path.dirname(path.join(root,name)),{recursive:true});
  const meta={builtAt:'2026-09-14T00:00:00.000Z',version:'5.6.3',hashes:{mcpServer:'before'},nested:{builtAt:'behavior'}};
  await writeFile(path.join(root,name),JSON.stringify(meta));
  const before=await snapshotCandidate(root,['.']);
  meta.builtAt='2026-09-14T00:01:00.000Z';
  await writeFile(path.join(root,name),JSON.stringify(meta));
  assert.deepEqual(changedCandidate(before,await snapshotCandidate(root,['.'])),[]);
  for(const mutate of [m=>m.version='5.6.4',m=>m.hashes.mcpServer='after',m=>m.nested.builtAt='changed']){
   const changed=structuredClone(meta);mutate(changed);
   await writeFile(path.join(root,name),JSON.stringify(changed));
   assert.deepEqual(changedCandidate(before,await snapshotCandidate(root,['.'])),[name]);
  }
 }finally{await rm(root,{recursive:true,force:true});}
});

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
   'Microi.Server/OfficialApplications/Resource/app.json':'package before'
  };
  for(const [name,content]of Object.entries(contents)){
   await mkdir(path.dirname(path.join(root,name)),{recursive:true});
   await writeFile(path.join(root,name),content);
  }
  const before=await snapshotCandidate(root,['.']);
  await writeFile(path.join(root,'microi.uniapp/package.json'),'{"version":"2"}');
  await writeFile(path.join(root,'microi.uniapp/src/pages/customer.vue'),'mobile after');
  assert.deepEqual(changedCandidate(before,await snapshotCandidate(root,['.'])),[]);
  for(const name of ['microi.uniapp/src/utils/microi.v8.js','Microi.Client/src/main.js','Microi.Server/OfficialApplications/Resource/app.json']){
   await writeFile(path.join(root,name),'after');
  }
  assert.deepEqual(changedCandidate(before,await snapshotCandidate(root,['.'])),[
   'Microi.Client/src/main.js','Microi.Server/OfficialApplications/Resource/app.json','microi.uniapp/src/utils/microi.v8.js'
  ]);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('all website inputs are published by the website gate without invalidating PC API Full',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'microi-release-candidate-'));
 try{
  execFileSync('git',['init','--quiet'],{cwd:root});
  const names=[
   'microi.doc/docs/doc/about/update-log.md',
   'microi.doc/docs/doc/more/hdfs.md',
   'microi.doc/docs/en/guide.md',
   'microi.doc/docs/.vitepress/theme/index.ts',
   'microi.doc/scripts/build.mjs',
   'microi.doc/package.json',
   'Microi.Client/src/main.js',
   'microi.skills/workspace-conventions/SKILL.md'
  ];
  for(const name of names){
   await mkdir(path.dirname(path.join(root,name)),{recursive:true});
   await writeFile(path.join(root,name),'before');
  }
  const before=await snapshotCandidate(root,['.']);
  for(const name of names)await writeFile(path.join(root,name),'after');
  assert.deepEqual(changedCandidate(before,await snapshotCandidate(root,['.'])),[
   'Microi.Client/src/main.js','microi.skills/workspace-conventions/SKILL.md'
  ]);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('the exact internal maintenance log can change while runtime skills, sources and publication guards remain frozen',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'microi-release-maintenance-'));
 try{
  execFileSync('git',['init','--quiet'],{cwd:root});
  const names=['Microi.Agent/维护交接与更新记录.md','Microi.Agent/src/extension.ts','Microi.Agent/publish.js','Microi.Agent/scripts/verify-vsix-package.cjs','Microi.Agent/plugins/microi/skills/workspace-conventions/SKILL.md'];
  for(const name of names){await mkdir(path.dirname(path.join(root,name)),{recursive:true});await writeFile(path.join(root,name),'before');}
  const before=await snapshotCandidate(root,['.']);await writeFile(path.join(root,names[0]),'Periodic store status log only');
  assert.deepEqual(changedCandidate(before,await snapshotCandidate(root,['.'])),[]);
  for(const name of names.slice(1))await writeFile(path.join(root,name),'after');
  assert.deepEqual(changedCandidate(before,await snapshotCandidate(root,['.'])),names.slice(1).sort());
 }finally{await rm(root,{recursive:true,force:true});}
});

test('desktop source exercised by Full stays frozen while the unused upstream checkout remains independent',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'microi-release-candidate-'));
 try{
  execFileSync('git',['init','--quiet'],{cwd:root});
  const names=[
   'Microi.Agent/apps/microi-code/src/main/runtime/harness-runtime.ts',
   'Microi.Agent/upstream/dsh-desktop/src/main.ts',
   'Microi.Agent/plugins/microi/package.json',
   'Microi.Agent/server-engines/microi_code_update_latest.js',
   'Microi.Server/Microi.MCP/Microi.MCP.csproj'
  ];
  for(const name of names){
   await mkdir(path.dirname(path.join(root,name)),{recursive:true});
   await writeFile(path.join(root,name),'before');
  }
  await writeFile(path.join(root,'Microi.Agent/apps/microi-code/package.json'),'{"name":"microi-code","scripts":{"test":"vitest run"}}');
  const before=await snapshotCandidate(root,['.']);
  for(const name of names)await writeFile(path.join(root,name),'after');
  assert.deepEqual(changedCandidate(before,await snapshotCandidate(root,['.'])),[
   'Microi.Agent/apps/microi-code/src/main/runtime/harness-runtime.ts',
   'Microi.Agent/plugins/microi/package.json',
   'Microi.Agent/server-engines/microi_code_update_latest.js',
   'Microi.Server/Microi.MCP/Microi.MCP.csproj'
  ]);
 }finally{await rm(root,{recursive:true,force:true});}
});

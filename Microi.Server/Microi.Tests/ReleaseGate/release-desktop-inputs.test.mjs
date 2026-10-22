import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {snapshotDesktopInputs} from '../../tools/release-desktop-inputs.mjs';
import {changedCandidate} from '../../tools/release-candidate.mjs';

async function fixture(t,desktop='Microi.Agent/apps/microi-code'){
 const root=await mkdtemp(path.join(tmpdir(),'microi-desktop-full-'));
 t.after(()=>rm(root,{recursive:true,force:true}));
 execFileSync('git',['init','--quiet'],{cwd:root});
 const put=async(name,value='before')=>{
  const full=path.join(root,desktop,name);await mkdir(path.dirname(full),{recursive:true});await writeFile(full,value);
 };
 await put('package.json','{"name":"microi-code","scripts":{"test":"vitest run"}}');
 return{root,desktop,put,snapshot:async()=>({files:await snapshotDesktopInputs(root)})};
}

test('desktop Full freezes edited, added, deleted source, lockfiles and exact build inputs',async t=>{
 const f=await fixture(t);
 const names=['test/contract.test.ts','package-lock.json','scripts/build-microi-worker.mjs','packages/microi-code-client-ui/build-client.mjs','build/microi-installer.nsh'];
 for(const name of names)await f.put(name);
 execFileSync('git',['add','.'],{cwd:f.root});
 const before=await f.snapshot();
 for(const name of names.slice(1))await f.put(name,'changed');
 await rm(path.join(f.root,f.desktop,names[0]));await f.put('test/added.test.ts');
 assert.deepEqual(changedCandidate(before,await f.snapshot()),[...names,'test/added.test.ts'].map(name=>f.desktop+'/'+name).sort());
});

test('only known pretest outputs are excluded and sibling source remains frozen',async t=>{
 const f=await fixture(t);
 const generated=['build/microi-platform-worker.cjs','packages/microi-code-client-ui/client.bundle.js','.build/ppt-runtime/packages/output.js','build/microi-skills/microi/SKILL.md','node_modules/package/index.js'];
 for(const name of generated)await f.put(name);
 const before=await f.snapshot();
 for(const name of generated)await f.put(name,'regenerated');
 assert.deepEqual(changedCandidate(before,await f.snapshot()),[]);
 await f.put('build/microi-platform-worker-source.cjs','source');
 await f.put('packages/microi-code-client-ui/client.js','source');
 assert.deepEqual(changedCandidate(before,await f.snapshot()),['build/microi-platform-worker-source.cjs','packages/microi-code-client-ui/client.js'].map(name=>f.desktop+'/'+name));
});

test('desktop selection matches Full fallback and preferred package removal cannot retain its receipt',async t=>{
 const f=await fixture(t,'Microi.Code/apps/microi-code');
 const fallback=await f.snapshot();assert.equal(Object.keys(fallback.files).length,1);
 const preferred='Microi.Agent/apps/microi-code/package.json';
 await mkdir(path.dirname(path.join(f.root,preferred)),{recursive:true});await writeFile(path.join(f.root,preferred),'{}');
 const selected=await f.snapshot();assert.deepEqual(Object.keys(selected.files),[preferred]);
 await rm(path.join(f.root,preferred));
 assert.deepEqual(changedCandidate(selected,await f.snapshot()),[preferred,f.desktop+'/package.json']);
});

test('desktop source files and parent directories reject links outside the candidate',async t=>{
 const f=await fixture(t);await f.put('real/source.ts');
 await symlink(path.join(f.root,f.desktop,'real'),path.join(f.root,f.desktop,'linked'),'junction');
 await assert.rejects(f.snapshot(),/link|regular file/i);
});

test('an ignored Desktop source root cannot silently run outside the Full fingerprint',async t=>{
 const f=await fixture(t);
 await writeFile(path.join(f.root,'.gitignore'),'Microi.Agent/\n');
 await assert.rejects(f.snapshot(),/Git-visible/);
});

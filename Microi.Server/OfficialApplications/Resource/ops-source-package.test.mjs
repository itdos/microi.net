import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const code=readFileSync(new URL('./ai-app-publish-store.js',import.meta.url),'utf8');
const start=code.indexOf('function currentSourceFiles('),end=code.indexOf('function getLatestVersion(',start);
const context={text:v=>String(v??'').trim(),isBlank:v=>!String(v??'').trim(),sourceArchivePath:v=>String(v??'').replace(/\\/g,'/')};
vm.runInNewContext(code.slice(start,end),context);
test('offline source selects only active private snapshot and preserves all current files',()=>{
  const current={FilePath:'src/a.vue',HdfsPath:'/active/src/a.vue',StorageScope:'Private',VersionId:null};
  const result=context.currentSourceFiles([current,{...current,VersionId:'history'},{...current,HdfsPath:'/old/src/a.vue'},{...current,StorageScope:'Public'}, {...current,FilePath:'src/b.vue',HdfsPath:'/active/src/b.vue'}],'/active');
  assert.deepEqual(Array.from(result,x=>x.FilePath),['src/a.vue','src/b.vue']);
});
test('ambiguous current duplicate fails instead of silently selecting older source',()=>{
  const row={FilePath:'a.vue',HdfsPath:'/active/a.vue',StorageScope:'Private'};
  assert.throws(()=>context.currentSourceFiles([row,{...row,FilePath:'A.vue'}],'/active'),/重复路径/);
});

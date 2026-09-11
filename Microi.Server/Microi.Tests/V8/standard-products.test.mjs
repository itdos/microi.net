import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const contract=JSON.parse(fs.readFileSync(path.join(repo,'AI-Project/标准产品套件/source-contract.json'),'utf8'));
// 唯一源码契约驱动发现，不能从同步镜像或旧发行产物择新，也不能零用例放行。
function discover(folder){return fs.readdirSync(folder,{withFileTypes:true}).flatMap(x=>x.isDirectory()?discover(path.join(folder,x.name)):/\.test\.mjs$/.test(x.name)?[path.join(folder,x.name)]:[]).sort();}
for(const app of contract.applications)test(app.name+'责任源码离线回归',{timeout:65000},()=>{
  const root=path.resolve(repo,contract.sourceParent,app.appKey);
  assert.ok(root.startsWith(path.resolve(repo,contract.sourceParent)+path.sep));
  const files=discover(path.join(root,'tests'));assert.ok(files.length>0,'缺少应用责任测试');
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  const r=spawnSync(process.execPath,['--max-old-space-size=768','--test','--test-concurrency=1','--test-reporter=tap',...files],{cwd:root,env,windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024});
  assert.ifError(r.error);assert.equal(r.status,0,(r.stdout||'')+(r.stderr||''));
  const count=Number(r.stdout.match(/^# tests (\d+)$/m)?.[1]||0);
  assert.ok(count>0,'零用例不能作为回归证据');
  for(const label of ['fail','cancelled','skipped','todo'])assert.match(r.stdout,new RegExp('^# '+label+' 0$','m'));
});

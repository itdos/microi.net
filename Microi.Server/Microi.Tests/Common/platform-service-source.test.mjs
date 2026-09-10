import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
test('平台内置微服务责任源码的行为测试纳入统一回归',{timeout:65000},()=>{
 const contract=JSON.parse(fs.readFileSync(path.join(root,'Microi.Server/Microi.Upgrade/Resource/platform-service-release.json'),'utf8'));
 const app=path.resolve(root,contract.SourceRoot);assert.ok(app.startsWith(root+path.sep));
 const tests=fs.readdirSync(path.join(app,'test')).filter(file=>file.endsWith('.test.mjs')).map(file=>path.join(app,'test',file));assert.ok(tests.length>0);
 // 只运行发布契约指定的事实源，不从同步镜像或旧产物择新。
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,['--max-old-space-size=512','--test','--test-reporter=tap','--test-concurrency=1',...tests],{cwd:app,env,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:4*1024*1024});
 assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);
 const count=Number(result.stdout.match(/^# tests (\d+)$/m)?.[1]||0);assert.ok(count>0);assert.match(result.stdout,new RegExp('^# pass '+count+'$','m'));
 for(const label of ['fail','cancelled','skipped','todo'])assert.match(result.stdout,new RegExp('^# '+label+' 0$','m'));
});

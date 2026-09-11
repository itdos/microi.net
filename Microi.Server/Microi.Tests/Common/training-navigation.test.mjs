import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
test('培训正文搜索与浏览器快捷键纳入平台统一回归',()=>{
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 const result=spawnSync(process.execPath,['--test','--test-reporter=tap','tests/training-syllabus-search.test.mjs'],{cwd:path.join(root,'microi.doc'),env,encoding:'utf8',windowsHide:true,timeout:30000});
 assert.ifError(result.error);assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/# tests 3\b/);assert.match(result.stdout,/# pass 3\b/);
 for(const key of ['fail','cancelled','skipped','todo'])assert.match(result.stdout,new RegExp('# '+key+' 0\\b'));
});

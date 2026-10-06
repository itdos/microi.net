import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {discoverTests,regressionLogFileName} from '../run-node-regressions.mjs';

function fixture(t,files){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'microi-regression-discovery-'));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 for(const [name,source] of Object.entries(files))fs.writeFileSync(path.join(directory,name),source);
 return directory;
}

test('Node responsibility import barrels remain discovered exactly once',t=>{
 const root=fixture(t,{'entry.test.mjs':"// aggregate responsibility\nimport './behavior.mjs'\nimport './contract.mjs'\n",
  'behavior.mjs':"import test from 'node:test';test('behavior',()=>{});",
  'contract.mjs':"import assert from 'node:assert/strict';assert.equal(1,1);"});
 assert.deepEqual(discoverTests(root),[path.join(root,'entry.test.mjs')]);
});

test('missing aggregate children fail discovery rather than being skipped',t=>{
 const root=fixture(t,{'entry.test.mjs':"import './missing.mjs'\n"});
 assert.throws(()=>discoverTests(root),/Missing regression import/);
});

test('unknown and browser aggregate children cannot masquerade as Node regressions',t=>{
 // 运行时拼接子夹具的真实 import，避免收集器把本文件中的示例文本识别为浏览器入口。
 for(const source of ["export const value=1;","import test from "+JSON.stringify('@playwright/test')+";import assert from 'node:assert';"]){
  const root=fixture(t,{'entry.test.mjs':"import './child.mjs'\n",'child.mjs':source});
  assert.throws(()=>discoverTests(root),/Unclassified regression import/);
 }
 const root=fixture(t,{'empty.test.mjs':'// no responsibility tests\n'});
 assert.throws(()=>discoverTests(root),/Unclassified regression test/);
});

test('Node reports use the same single filename for Windows and POSIX responsibility paths',()=>{
 const expected='Microi.Server-OfficialApplications-PlatformService-test.tap';
 for(const root of ['Microi.Server/OfficialApplications/PlatformService/test','Microi.Server\\OfficialApplications\\PlatformService\\test'])
  assert.equal(regressionLogFileName(root),expected);
});

test('a discovered responsibility report is written without creating nested result directories',t=>{
 const directory=fixture(t,{}),name=regressionLogFileName('Microi.Server\\OfficialApplications\\PlatformService\\test');
 assert.equal(path.win32.dirname(name),'.');assert.equal(path.posix.dirname(name),'.');
 const file=path.join(directory,name);fs.writeFileSync(file,'# tests 1\n# pass 1\n# fail 0\n');
 assert.equal(fs.readFileSync(file,'utf8'),'# tests 1\n# pass 1\n# fail 0\n');
 assert.deepEqual(fs.readdirSync(directory),[name]);
});

test('the discovery responsibility self-tests are part of the mandatory Node gate',()=>{
 const self=fileURLToPath(import.meta.url);
 assert.ok(discoverTests(path.dirname(self)).includes(self),'Self-test fixture text must not silently exclude this responsibility');
});

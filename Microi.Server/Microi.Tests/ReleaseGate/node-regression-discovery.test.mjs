import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {discoverTests, regressionLogFile, roots} from '../run-node-regressions.mjs';

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
 for(const source of ["export const value=1;","import test from '@playwright/test';import assert from 'node:assert';"]){
  const root=fixture(t,{'entry.test.mjs':"import './child.mjs'\n",'child.mjs':source});
  assert.throws(()=>discoverTests(root),/Unclassified regression import/);
 }
 const root=fixture(t,{'empty.test.mjs':'// no responsibility tests\n'});
 assert.throws(()=>discoverTests(root),/Unclassified regression test/);
});

test('Windows and POSIX responsibility roots write a flat TAP path inside the result directory', t=>{
 const directory=fixture(t,{});
 for(const root of ['Microi.Server/OfficialApplications/PlatformService/test','Microi.Server\\OfficialApplications\\PlatformService\\test']){
  const log=regressionLogFile(directory,root);
  assert.equal(path.dirname(log),directory);
  assert.equal(path.basename(log),'Microi.Server-OfficialApplications-PlatformService-test.tap');
  fs.writeFileSync(log,'original TAP bytes\n');
  assert.equal(fs.readFileSync(log,'utf8'),'original TAP bytes\n');
 }
 assert.equal(roots.at(-1).includes('\\'),false,'discovery summaries use platform-independent relative roots');
});

test('browser module names inside fixture strings do not omit real Node responsibility tests', t=>{
 const root=fixture(t,{'actual.test.mjs':"import test from 'node:test';\nconst fixture = \"import test from '@playwright/test';\";\ntest('actual',()=>{});"});
 assert.deepEqual(discoverTests(root),[path.join(root,'actual.test.mjs')]);
});

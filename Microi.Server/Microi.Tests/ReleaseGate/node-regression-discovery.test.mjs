import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {discoverTests} from '../run-node-regressions.mjs';

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

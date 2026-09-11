import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyArtifact} from '../../tools/release-artifact.mjs';
import {assertTestSummary} from '../run-node-regressions.mjs';
const candidate={files:{'source.cs':'before'}},files={'Dockerfile':'a','publish/api.dll':'b'};
const receipt={schema:1,gate:'Full',candidate,files};
test('only an unchanged artifact of the Full-tested candidate can be republished',()=>{
 assert.doesNotThrow(()=>verifyArtifact(receipt,candidate,files));
 assert.throws(()=>verifyArtifact({...receipt,gate:'Quick'},candidate,files),/Full/);
 assert.throws(()=>verifyArtifact(receipt,{files:{'source.cs':'after'}},files),/different source/);
 assert.throws(()=>verifyArtifact(receipt,candidate,{...files,'publish/api.dll':'changed'}),/changed after/);
 assert.throws(()=>verifyArtifact({},candidate,files),/Full/);
});
test('zero tests, missing summaries and skipped/cancelled/todo tests block publication',()=>{
 const good='# tests 3\n# pass 3\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';
 assert.equal(assertTestSummary(good).pass,3);
 for(const bad of ['',good.replace('# tests 3','# tests 0'),good.replace('# skipped 0','# skipped 1'),good.replace('# cancelled 0','# cancelled 1'),good.replace('# todo 0','# todo 1'),good.replace('# fail 0','# fail 1')])assert.throws(()=>assertTestSummary(bad));
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {verifyPanelGate,requiredPluginChecks,legacyScripts,compareGeneratedEndpoints} from './panel-gate-contract.mjs';
const current={sourceHash:'a'.repeat(64),imageId:'sha256:'+'b'.repeat(64),catalog:[{id:'nginx',versions:[{id:'1'},{id:'2'}]}]};
function evidence(){const common={completed:true,sourceHash:current.sourceHash,imageId:current.imageId,checks:1,failed:0,skipped:0};return[
 {...common,stage:'unit',counts:{csharp:1,node:1,legacy:1}},
 {...common,stage:'core',counts:{docker:24,browser:9,platformEntry:5}},
 {...common,stage:'acme',checks:5},
 {...common,stage:'legacy',scripts:[...legacyScripts]},
 {...common,stage:'linux',installOrders:['panel-baota-onepanel','baota-onepanel-panel'],realThirdPartyPanels:true,rebootVerified:true},
 {...common,stage:'plugins',results:['1','2'].map(version=>({plugin:'nginx',version,success:true,checks:[...requiredPluginChecks]}))},
 ];}
test('Panel gate accepts complete current-candidate evidence',()=>assert.equal(verifyPanelGate(evidence(),current).completed,true));
test('Panel gate rejects missing stages, failed, skipped and zero-case receipts',()=>{
 for(const alter of [r=>r.pop(),r=>r[0].completed=false,r=>r[0].failed=1,r=>r[0].skipped=1,r=>r[0].checks=0,r=>r.splice(4,1)]){const r=evidence();alter(r);assert.throws(()=>verifyPanelGate(r,current));}
});
test('Panel gate rejects stale source or a different tested image',()=>{
 for(const key of ['sourceHash','imageId']){const r=evidence();r[0][key]='changed';assert.throws(()=>verifyPanelGate(r,current));}
});
test('Panel gate cannot substitute simulated or one-direction coexistence',()=>{
 for(const alter of [r=>r[4].realThirdPartyPanels=false,r=>r[4].rebootVerified=false,r=>r[4].installOrders.pop()]){const r=evidence();alter(r);assert.throws(()=>verifyPanelGate(r,current));}
});
test('Panel gate requires every real version and retained-data reinstall',()=>{
 for(const alter of [r=>r[5].results.pop(),r=>r[5].results[1].version='1',r=>r[5].results[0].checks.pop(),r=>r[5].results[0].success=false]){const r=evidence();alter(r);assert.throws(()=>verifyPanelGate(r,current));}
});
test('Generated manifest comparison accepts only valid build timestamp differences',()=>{
 const original={ManifestType:'Publish',Endpoints:[{Route:'index.html',AssetFile:'index.html',ResponseHeaders:[{Name:'Last-Modified',Value:'Wed, 09 Sep 2026 20:41:54 GMT'},{Name:'ETag',Value:'content-hash'}]}]};
 const rebuilt=structuredClone(original);rebuilt.Endpoints[0].ResponseHeaders[0].Value='Thu, 10 Sep 2026 01:00:00 GMT';
 assert.equal(compareGeneratedEndpoints(original,rebuilt).length,2);
 for(const alter of [x=>x.Endpoints[0].Route='different',x=>x.Endpoints[0].ResponseHeaders[1].Value='different',x=>x.Endpoints[0].ResponseHeaders[0].Value='invalid',x=>x.Endpoints[0].AssetFile='../secret']){
  const changed=structuredClone(rebuilt);alter(changed);assert.throws(()=>compareGeneratedEndpoints(original,changed));
 }
});

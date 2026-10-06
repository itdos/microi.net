import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const source=fs.readFileSync(process.env.MICROI_CONTROL_SOURCE||new URL('./official-resource-api.js',import.meta.url),'utf8'),sha=s=>createHash('sha256').update(s).digest('hex');
const code=n=>'/* ApiEngineKey: export-microi-store-package\n * Version: v1.3.'+n+' */\nreturn {Code:1};';
function fixture({initial=code(6),content=code(7),expected=sha(initial),authorized=true,name='export-package.js'}={}){
 const state={Id:'export-id',ApiEngineKey:'export-microi-store-package',ApiV8Code:initial},writes=[],locks=[];
 const ctx={V8:{OsClient:'iTdos',Param:{Action:'PublishBatch',Resources:[{Name:name,Content:content,ExpectedRemoteSha256:expected}]},EncryptHelper:{Sha256Hex:sha},Method:{AuthorizeOfficialResourcePublish:()=>({Code:authorized?1:0})},Cache:{Remove(){}},
 Db:{FromSql:s=>({ToArray(){locks.push(s);return[];}})},FormEngine:{GetFormData:()=>({Code:1,Data:{...state}}),UptFormData:(t,row)=>{writes.push({t,row});Object.assign(state,row);return{Code:1};}}}};
 const result=vm.runInNewContext('(function(){'+source+'\n})()',ctx,{timeout:1000});return{result,state,writes,locks};
}
test('export source participates in same fixed-key lock + expected hash CAS and independent byte readback',()=>{const f=fixture();assert.equal(f.result.Code,1,f.result.Msg);assert.equal(f.state.ApiV8Code,code(7));assert.equal(f.result.Data[0].Sha256,sha(code(7)));assert.match(f.locks[0],/'export-microi-store-package'/);});
test('same input and exact current hash preserve bytes and return Updated=false',()=>{const f=fixture({initial:code(7)});assert.equal(f.result.Code,1,f.result.Msg);assert.equal(f.result.Data[0].Updated,false);assert.equal(f.state.ApiV8Code,code(7));});
test('changed remote source and wrong hash both reject before writes',()=>{for(const options of [{initial:code(8),expected:sha(code(6))},{expected:'0'.repeat(64)}]){const f=fixture(options);assert.equal(f.result.Code,0);assert.equal(f.writes.length,0);assert.match(f.result.Msg,/拒绝覆盖/);}});
test('old authorization and whitelist fail closed',()=>{assert.equal(fixture({authorized:false}).writes.length,0);const f=fixture({name:'arbitrary-engine.js'});assert.equal(f.result.Code,0);assert.equal(f.writes.length,0);});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('./mic_home_work_todo_badge.js',import.meta.url),'utf8');
const run=new Function('V8',source);
function fixture(method){
 const calls={count:0,list:0,writes:0};const cache=new Map();
 return {calls,V8:{CurrentUser:{Id:'user'},OsClient:'tenant',Method:method,
 Cache:{Get:key=>cache.get(key),Set:(key,value)=>{cache.set(key,value);calls.writes++;}},
 FormEngine:{GetTableDataCount:()=>{calls.count++;return {Code:1,DataCount:2};},GetTableData:()=>{calls.list++;return {Code:1,Data:[],DataCount:0};}}}};
}
test('native query failure is returned without replaying all legacy counts',()=>{
 const f=fixture({GetCurrentUserWorkflowStats:()=>({Code:0,Msg:'database timeout'})});
 const result=run(f.V8);assert.equal(result.Code,0);assert.equal(result.Msg,'database timeout');
 assert.deepEqual(f.calls,{count:0,list:0,writes:0});
});
test('native exception does not amplify failing database load',()=>{
 const f=fixture({GetCurrentUserWorkflowStats:()=>{throw new Error('database unavailable');}});
 assert.equal(run(f.V8).Code,0);assert.deepEqual(f.calls,{count:0,list:0,writes:0});
});
test('old backend without the native method keeps compatible statistics',()=>{
 const f=fixture({});const r=run(f.V8);assert.equal(r.Code,1);assert.equal(r.Data.Value,2);
 assert.deepEqual(f.calls,{count:4,list:1,writes:1});
});
test('backend without the workflow plugin keeps the legacy compatibility path',()=>{
 const f=fixture({GetCurrentUserWorkflowStats:()=>({Code:0,Msg:'Microi.WorkFlow 插件尚未注册。'})});
 assert.equal(run(f.V8).Code,1);assert.deepEqual(f.calls,{count:4,list:1,writes:1});
});
test('native success and user cache retain the full five-tab result',()=>{
 let nativeCalls=0;const data={Value:3,Todo:2,Copy:1,Sender:4,Done:5,Connect:6,Buttons:{mic_home_work_tab_todo:2}};
 const f=fixture({GetCurrentUserWorkflowStats:()=>{nativeCalls++;return {Code:1,Data:data};}});
 assert.deepEqual(run(f.V8).Data,data);assert.deepEqual(run(f.V8).Data,data);assert.equal(nativeCalls,1);
 assert.deepEqual(f.calls,{count:0,list:0,writes:1});
});

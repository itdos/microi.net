import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=file=>fs.readFileSync(new URL(file.split('/').at(-1),import.meta.url),'utf8');
const code=read('Microi.Server/Microi.Upgrade/Resource/platform-reminder-model.js');
const model=new Function(code+';return createPlatformReminderModel()')();
const now=Date.now(),admin={Administrator:true,IsMainTenant:true,IsOfficialPlatform:true,ProtocolVersion:2,RestartEpoch:'202609100900000000000-'+'a'.repeat(32)};
const seed={Title:'版本介绍',Content:'欢迎使用',ScopeType:'Editions',TargetKeys:['OpenSource'],AccountScope:'SuperAdmins',StartsAt:new Date(now-1000).toISOString(),EndsAt:new Date(now+86400000).toISOString()};
test('restricted notices fail closed for ordinary accounts and older receivers',()=>{
 const rule=model.normalize(seed,admin,now),batch={Id:'a'.repeat(32),State:'Published',SnapshotJson:JSON.stringify(rule)};
 assert.equal(model.project(batch,'Official',now,{...admin,Administrator:false}),null);
 assert.equal(model.project(batch,'Official',now,{...admin,ProtocolVersion:1}),null);
 assert.equal(model.project(batch,'Official',now,admin).Title,'版本介绍');
 assert.equal(model.acceptsAccount({...rule,AccountScope:'Unknown'},admin),false);
 assert.equal(model.acceptsAccount({...rule,MinimumReceiverProtocol:'invalid'},admin),false);
 assert.throws(()=>model.normalize(seed,{...admin,ProtocolVersion:1},now),/更新/);
});
test('restart occurrence uses server epoch and remains stable across page IDs',()=>{
 const rule=model.normalize({...seed,DisplayMode:'AfterServerRestart'},admin,now),batch={Id:'a'.repeat(32),State:'Published',SnapshotJson:JSON.stringify(rule)};
 const first=model.project(batch,'Official',now,{...admin,EntryId:'page-a'});
 assert.equal(first.Id,model.project(batch,'Official',now,{...admin,EntryId:'page-b'}).Id);
 assert.notEqual(first.Id,model.project(batch,'Official',now,{...admin,RestartEpoch:'202609100901000000000-'+'b'.repeat(32)}).Id);
 assert.equal(model.project(batch,'Official',now,{...admin,RestartEpoch:''}),null);
 assert.equal(model.project(batch,'Official',now,{...admin,RestartEpoch:'forged'}),null);
});
test('legacy all-account snapshots retain their original delivery scope',()=>{
 const rule=model.normalize({...seed,AccountScope:undefined},admin,now);
 assert.equal(rule.AccountScope,'AllAccounts');
 assert.equal(model.acceptsAccount(rule,{ProtocolVersion:1}),true);
});
test('official feed withholds restricted and restart announcements from protocol 1',()=>{
 const feed=read('Microi.Server/Microi.Upgrade/Resource/platform-reminder-official-feed.js');
 const rules=[model.normalize(seed,admin,now),model.normalize({...seed,AccountScope:'AllAccounts'},admin,now),model.normalize({...seed,AccountScope:'AllAccounts',DisplayMode:'AfterServerRestart'},admin,now)];
 const batches=rules.map((rule,i)=>({Id:String(i),State:'Published',SnapshotJson:JSON.stringify(rule)}));
 function run(version){return new Function('V8',feed)({Param:{Edition:'OpenSource',ReceiverProtocolVersion:version},Method:{RunPlatformApiRuntime:()=>({Code:1,Data:admin})},FormEngine:{GetTableData:()=>({Code:1,Data:batches})}})}
 assert.deepEqual(run(1).Data.map(x=>x.Id),['1']);assert.equal(run(2).Data.length,3);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const source=fs.readFileSync(new URL('platform-reminder-model.js',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('platform-reminder-runtime.body.js',import.meta.url),'utf8');
function fixture(){
 const records=new Map(),now=Date.now(),batch={Id:'a'.repeat(32),State:'Published',SnapshotJson:JSON.stringify({Title:'启动版本介绍',Content:'说明',ScopeType:'Users',AllTargets:true,AccountScope:'SuperAdmins',MinimumReceiverProtocol:2,DisplayMode:'AfterServerRestart',StartsAt:new Date(now-1000).toISOString(),EndsAt:new Date(now+86400000).toISOString(),RepeatMode:'None'})};
 let current={UserId:'admin',Administrator:true,ProductEdition:'OpenSource',ProtocolVersion:2,RestartEpoch:'202609100900000000000-'+'a'.repeat(32)};
 let concurrentEntry='',staleReads=0;
 const atoms=[];
 const V8={Param:{},OsClient:'tenant-one',DbTrans:{},EncryptHelper:{Sha256Hex:value=>createHash('sha256').update(value).digest('hex')},Method:{RunPlatformApiRuntime:p=>{atoms.push(p);return {Code:1,Data:p.Action==='Context'?current:[]}}},
  FormEngine:{GetTableData(table,q){const data=table==='mci_platform_reminder_batch'?[batch]:[...records.values()].filter(row=>q._Where[0][2].includes(row.Id)&&row.ReceiverUserId===current.UserId);return {Code:1,Data:data}},
   GetFormData(table,q){if(staleReads>0){staleReads--;return {Code:2}}const row=records.get(q.Id);return row?{Code:1,Data:row}:{Code:2}},
   AddFormData(table,row){assert.equal(table,'mci_platform_reminder_receipt');if(concurrentEntry){records.set(row.Id,{...row,EntryId:concurrentEntry});concurrentEntry='';staleReads=1;return {Code:0,Msg:'unique Id'}}if(records.has(row.Id))return {Code:0,Msg:'unique Id'};records.set(row.Id,{...row});return {Code:1}},
   UptFormData(table,row){assert.equal(table,'mci_platform_reminder_receipt');Object.assign(records.get(row.Id),row);return {Code:1}}
  }};
 return {records,atoms,batch,race(entry){concurrentEntry=entry},identity(p){current={...current,...p}},tenant(value){V8.OsClient=value},run(p){V8.Param=p;return new Function('V8',source)(V8)}};
}
test('唯一插入竞争且事务快照未刷新时失败关闭，原会话重试不重复领取',()=>{
 const f=fixture(),item=f.run({Action:'Inbox'}).Data[0];f.race('winning-document-001');
 assert.equal(f.run({Action:'Presented',Id:item.Id,EntryId:'losing-document-0001'}).Code,0);
 assert.equal(f.records.size,1);assert.equal(f.run({Action:'Inbox'}).Data.length,0);
 assert.equal(f.run({Action:'Presented',Id:item.Id,EntryId:'losing-document-0001'}).Data.Claimed,false);
 assert.equal(f.run({Action:'Presented',Id:item.Id,EntryId:'winning-document-001'}).Data.Claimed,true);
});
test('真实接口引擎正文先持久领取，另一页面不能抢走，同页丢回包可回读恢复',()=>{
 const f=fixture(),item=f.run({Action:'Inbox',EntryId:'document-00000001'}).Data[0];
 const first=f.run({Action:'Presented',Id:item.Id,EntryId:'document-00000001'});assert.equal(first.Data.Claimed,true);assert.equal(f.records.size,1);
 assert.ok([...f.records.values()][0].ShownAt);assert.equal([...f.records.values()][0].ClosedAt,'');
 assert.equal(f.run({Action:'Presented',Id:item.Id,EntryId:'document-00000002'}).Data.Claimed,false);
 assert.equal(f.run({Action:'Presented',Id:item.Id,EntryId:'document-00000001'}).Data.Claimed,true);
 const inbox=f.run({Action:'Inbox',EntryId:'document-00000002'});assert.equal(inbox.Data.length,0);assert.deepEqual(inbox.DataAppend.ActiveIds,[item.Id]);
 f.run({Action:'Acknowledge',Id:item.Id,EntryId:'document-00000001'});assert.ok([...f.records.values()][0].ClosedAt);
 assert.equal(f.run({Action:'Presented',Id:item.Id,EntryId:'document-00000001'}).Data.Claimed,false);
});
test('普通用户和伪造管理员参数没有收件资格，匿名和无效会话不能领取',()=>{
 const f=fixture();f.identity({Administrator:false});assert.equal(f.run({Action:'Inbox',Administrator:true}).Data.length,0);assert.equal(f.records.size,0);
 assert.ok(f.atoms.every(p=>Object.keys(p).sort().join(',')==='Action,RuntimeKey'));
 f.identity({Administrator:true});const item=f.run({Action:'Inbox'}).Data[0];assert.equal(f.run({Action:'Presented',Id:item.Id,EntryId:'bad'}).Code,0);assert.equal(f.records.size,0);
 f.identity({UserId:''});assert.equal(f.run({Action:'Inbox'}).Code,1001);
});
test('同批次重登不再领取，服务新批次、不同帐号和不同租户分别隔离',()=>{
 const f=fixture(),first=f.run({Action:'Inbox'}).Data[0];f.run({Action:'Presented',Id:first.Id,EntryId:'document-00000001'});
 assert.equal(f.run({Action:'Inbox',EntryId:'new-login-000001'}).Data.length,0);
 f.identity({RestartEpoch:'202609100901000000000-'+'b'.repeat(32)});const next=f.run({Action:'Inbox'}).Data[0];assert.notEqual(next.Id,first.Id);
 f.identity({RestartEpoch:'202609100900000000000-'+'a'.repeat(32),UserId:'another-admin'});assert.equal(f.run({Action:'Inbox'}).Data.length,1);
 f.identity({UserId:'admin'});f.tenant('tenant-two');assert.equal(f.run({Action:'Inbox'}).Data.length,1);
});
test('撤回、过期或可信启动批次缺失不再投递，也不制造回执',()=>{
 const f=fixture(),first=f.run({Action:'Inbox'}).Data[0];f.batch.State='Withdrawn';assert.equal(f.run({Action:'Inbox'}).Data.length,0);
 assert.equal(f.run({Action:'Presented',Id:first.Id,EntryId:'document-00000001'}).Data.NoLongerActive,true);assert.equal(f.records.size,0);
 f.batch.State='Published';const snapshot=JSON.parse(f.batch.SnapshotJson);snapshot.EndsAt=new Date(Date.now()-1000).toISOString();f.batch.SnapshotJson=JSON.stringify(snapshot);assert.equal(f.run({Action:'Inbox'}).Data.length,0);
 snapshot.EndsAt=new Date(Date.now()+60000).toISOString();f.batch.SnapshotJson=JSON.stringify(snapshot);f.identity({RestartEpoch:''});assert.equal(f.run({Action:'Inbox'}).Data.length,0);
});

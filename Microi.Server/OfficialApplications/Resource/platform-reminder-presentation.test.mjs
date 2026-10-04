import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const source=fs.readFileSync(new URL('platform-reminder-model.js',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('license-expiry-model.js',import.meta.url),'utf8')+'\n'+fs.readFileSync(new URL('platform-reminder-runtime.body.js',import.meta.url),'utf8');
function fixture(){
 const records=new Map(),now=Date.now(),batch={Id:'a'.repeat(32),State:'Published',SnapshotJson:JSON.stringify({Title:'启动版本介绍',Content:'说明',ScopeType:'Users',AllTargets:true,AccountScope:'SuperAdmins',MinimumReceiverProtocol:2,DisplayMode:'AfterServerRestart',StartsAt:new Date(now-1000).toISOString(),EndsAt:new Date(now+86400000).toISOString(),RepeatMode:'None'})};
 let current={UserId:'admin',Administrator:true,ProductEdition:'OpenSource',ProtocolVersion:2,RestartEpoch:'202609100900000000000-'+'a'.repeat(32)};
 let concurrentEntry='',staleReads=0;
 const atoms=[],policies={},official=[];
 const V8={Param:{},OsClient:'tenant-one',DbTrans:{},EncryptHelper:{Sha256Hex:value=>createHash('sha256').update(value).digest('hex')},Method:{RunPlatformApiRuntime:p=>{atoms.push(p);return {Code:1,Data:p.Action==='Context'?current:p.Action==='ParentLicensePolicy'?policies.parent:p.Action==='Official'?official:[],DataAppend:{LicenseExpiryPolicy:policies.official}}}},
  FormEngine:{GetTableData(table,q){const data=table==='mci_platform_reminder_batch'?[batch]:[...records.values()].filter(row=>q._Where[0][2].includes(row.Id)&&row.ReceiverUserId===current.UserId);return {Code:1,Data:data}},
   GetFormData(table,q){if(staleReads>0){staleReads--;return {Code:2}}const row=records.get(q.Id);return row?{Code:1,Data:row}:{Code:2}},
   AddFormData(table,row){assert.equal(table,'mci_platform_reminder_receipt');if(concurrentEntry){records.set(row.Id,{...row,EntryId:concurrentEntry});concurrentEntry='';staleReads=1;return {Code:0,Msg:'unique Id'}}if(records.has(row.Id))return {Code:0,Msg:'unique Id'};records.set(row.Id,{...row});return {Code:1}},
   UptFormData(table,row){assert.equal(table,'mci_platform_reminder_receipt');Object.assign(records.get(row.Id),row);return {Code:1}}
  }};
 return {records,atoms,batch,policies,official,race(entry){concurrentEntry=entry},identity(p){current={...current,...p}},tenant(value){V8.OsClient=value},run(p){V8.Param=p;return new Function('V8',source)(V8)}};
}
test('开源版官方欢迎公告按重启批次分别投递给三名超级管理员',()=>{
 const f=fixture(); f.batch.State='Withdrawn';
 const rule={Title:'欢迎使用 Microi吾码，了解适合你的版本',Content:'开源版介绍',ScopeType:'Editions',TargetKeys:['OpenSource'],AllTargets:false,
  AccountScope:'SuperAdmins',MinimumReceiverProtocol:2,DisplayMode:'AfterServerRestart',StartsAt:new Date(Date.now()-1000).toISOString(),EndsAt:new Date(Date.now()+86400000).toISOString(),RepeatMode:'None'};
 f.official.push({Id:'b'.repeat(32),State:'Published',SnapshotJson:JSON.stringify(rule)});
 f.identity({SystemProductEdition:'OpenSource',LicenseExpirationDate:'0001-01-01T00:00:00Z',LoginId:'c'.repeat(32)});
 for(const user of ['admin','super-admin-2','super-admin-3']) {
  f.identity({UserId:user,Administrator:true});
  const items=f.run({Action:'Inbox'}).Data;
  assert.deepEqual(items.map(item=>item.Title),[rule.Title]);
  assert.equal(items[0].Source,'Official');
  assert.equal(f.run({Action:'Presented',Id:items[0].Id,EntryId:'document-0000-'+user}).Data.Claimed,true);
  f.run({Action:'Acknowledge',Id:items[0].Id,EntryId:'document-0000-'+user});
  assert.equal(f.run({Action:'Inbox'}).Data.length,0);
  f.identity({LoginId:'d'.repeat(32)});
  assert.equal(f.run({Action:'Inbox'}).Data.length,0);
 }
 f.identity({UserId:'ordinary-user',Administrator:false});
 assert.equal(f.run({Action:'Inbox'}).Data.length,0);
 f.identity({UserId:'level-only-super-admin',Administrator:false,SuperAdministratorRecipient:true});
 assert.deepEqual(f.run({Action:'Inbox'}).Data.map(item=>item.Title),[rule.Title]);
 assert.equal(f.run({Action:'LicensePolicyGet',ScopeType:'Editions'}).Code,0);
 f.identity({SuperAdministratorRecipient:false});
 assert.equal(f.run({Action:'Inbox'}).Data.length,0);
 f.identity({UserId:'admin',Administrator:true,SuperAdministratorRecipient:true,RestartEpoch:'202609100901000000000-'+'b'.repeat(32)});
 assert.deepEqual(f.run({Action:'Inbox'}).Data.map(item=>item.Title),[rule.Title]);
});
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

test('signed license at seven days warns once per trusted login, including expired licenses',()=>{
 const f=fixture(); f.batch.State='Withdrawn';
 const end=new Date(Date.now()+7*86400000).toISOString();
 f.identity({LoginId:'c'.repeat(32),LicenseExpirationDate:end,SystemProductEdition:'Enterprise'});
 const first=f.run({Action:'Inbox'}).Data[0]; assert.equal(first.Source,'SystemLicense'); assert.equal(first.Severity,'error');
 f.run({Action:'Acknowledge',Id:first.Id}); assert.equal(f.run({Action:'Inbox'}).Data.length,0);
 // Refresh and a second page keep the trusted login id; a new sign-in gets a new occurrence.
 assert.equal(f.run({Action:'Inbox',LoginId:'forged',EntryId:'new-document-00001'}).Data.length,0);
 f.identity({LoginId:'d'.repeat(32)}); const next=f.run({Action:'Inbox'}).Data[0]; assert.notEqual(next.Id,first.Id);
 f.identity({LicenseExpirationDate:new Date(Date.now()-86400000).toISOString()}); assert.equal(f.run({Action:'Inbox'}).Data[0].Severity,'error');
 f.identity({LicenseExpirationDate:new Date(Date.now()+8*86400000).toISOString()}); assert.equal(f.run({Action:'Inbox'}).Data.length,0);
 f.identity({LicenseExpirationDate:end,Administrator:false}); assert.equal(f.run({Action:'Inbox',Administrator:true}).Data.length,0);
 f.identity({Administrator:true,LoginId:''}); assert.equal(f.run({Action:'Inbox'}).Data.length,0);
});

test('官方30天与主租户7天独立投递和确认，非admin超级管理员也能接收',()=>{
 const f=fixture();f.batch.State='Withdrawn';
 f.policies.official={Enterprise:{AdvanceDays:30,Content:'官方{版本} {倒计时}'}};
 f.policies.parent={Personal:{AdvanceDays:7,Content:'请向主租户续费，到期{到期时间}'}};
 f.identity({UserId:'second-super-admin',Administrator:true,LoginId:'e'.repeat(32),SystemProductEdition:'Enterprise',TenantProductEdition:'Personal',LicenseExpirationDate:new Date(Date.now()+20*86400000).toISOString(),TenantLicenseExpirationDate:new Date(Date.now()+3*86400000).toISOString()});
 const all=f.run({Action:'Inbox'}).Data;assert.deepEqual(all.map(x=>x.Source),['SystemLicense','TenantLicense']);
 assert.match(all[0].Content,/官方企业版/);assert.match(all[1].Content,/请向主租户续费/);assert.match(all[1].Content,/倒计时3天/);
 f.run({Action:'Acknowledge',Id:all[0].Id});assert.deepEqual(f.run({Action:'Inbox'}).Data.map(x=>x.Source),['TenantLicense']);
 f.policies.official.Enterprise.Content='变更文案不会清除回执';assert.deepEqual(f.run({Action:'Inbox'}).Data.map(x=>x.Source),['TenantLicense']);
 f.identity({LicenseExpirationDate:new Date(Date.now()+40*86400000).toISOString()});assert.deepEqual(f.run({Action:'Inbox'}).Data.map(x=>x.Source),['TenantLicense']);
 f.identity({ProductEdition:'OpenSource',LicenseExpirationDate:new Date(Date.now()-86400000).toISOString(),TenantLicenseExpirationDate:new Date(Date.now()-2*86400000).toISOString()});
 assert.deepEqual(f.run({Action:'Inbox'}).Data.map(x=>x.Source),['SystemLicense','TenantLicense']);
});

test('授权策略只允许官方或主租户管理，普通公告动作不能撤回策略',()=>{
 const f=fixture();f.identity({IsMainTenant:false,IsOfficialPlatform:false});
 for(const ScopeType of ['Editions','Tenants'])assert.equal(f.run({Action:'LicensePolicyGet',ScopeType}).Code,0);
 f.identity({IsMainTenant:true});assert.equal(f.run({Action:'LicensePolicyGet',ScopeType:'Tenants'}).Data.Revision,0);
 assert.equal(f.run({Action:'LicensePolicySave',ScopeType:'Tenants'}).Code,0);
 assert.equal(f.run({Action:'LicensePolicyValidate',ScopeType:'Tenants',Policy:{Enterprise:{AdvanceDays:0}}}).Code,0);
 const id='f'.repeat(32);f.records.set(id,{Id:id,Revision:1,ReminderType:'LicenseExpiry',Status:'Published'});
 for(const Action of ['Withdraw','Publish'])assert.match(f.run({Action,Id:id,ExpectedRevision:1}).Msg,/授权到期提醒设置/);
});

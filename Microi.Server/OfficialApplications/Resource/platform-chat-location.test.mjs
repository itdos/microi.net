import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fixture, factorySource} from './platform-chat-location-fixture.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const candidate=()=>fs.readFileSync(path.join(root,'platform-chat-runtime.js'),'utf8');
function seed(f,id,db=f.base,table='chat_2025',extra={}){const row=f.message(id,{CreateTime:'2025-12-31T23:59:59.000Z',...extra});f.seed(db,table,row);return row;}
const send={Action:'PersistMessage',PeerUserId:'user-2',RequestId:'old-year-request',Content:'hello',Type:'text'};
test('runtime and maintenance publish the same location protocol implementation',()=>{
 const maintenance=fs.readFileSync(path.join(root,'platform-chat-maintenance.js'),'utf8');
 assert.equal(factorySource(candidate(),'var locationIndex=createLegacyLocationIndex'),factorySource(maintenance,'function messageIdFor'));
});
test('install compatibility: absent migration state retains whole legacy protocol and does not start maintenance',()=>{
  const f=fixture();seed(f,send.RequestId);const result=f.runRuntime(candidate(),send);
  assert.equal(result.Code,1);assert.equal(f.api.status().Data,null);
  assert.equal(f.calls.filter(([m,r])=>r.PhysicalRows||r.EnsureIndex).length,0);
  assert.equal(f.physicalRows().length,2,'known legacy defect remains until explicit activation; this test must not label it fixed');
});
test('administrator cannot fabricate trusted maintenance by boolean or caller FenceId',()=>{
  const f=fixture();delete f.v8.Method.RequireManagedStorageMaintenance;
  assert.equal(f.start().Reason,'CapabilityMissing');assert.equal(f.api.status().Data,null);
  assert.equal(f.calls.filter(([m])=>m==='AddFormData').length,0);
});
test('native physical/index capability missing fails before creating migration state',()=>{
  for(const options of [{physical:false},{collectionPage:false}]){const f=fixture(options);assert.equal(f.start().Code,0);assert.equal(f.api.status().Data,null);}
});
test('single Annual old body becomes one canonical locator and cross-year replay returns original',()=>{
  const f=fixture();const row=seed(f,send.RequestId);const original=JSON.stringify(f.physicalRows());
  const result=f.migrate(1);assert.equal(result.Data.Phase,'Completed');assert.equal(result.Data.Scanned,1);
  const replay=f.api.persist(f.message(send.RequestId));assert.equal(replay.Code,1);assert.equal(replay.Duplicate,true);assert.equal(replay.Data.CreateTime,row.CreateTime);
  assert.equal(JSON.stringify(f.physicalRows()),original);assert.equal(f.api.unread('user-2','').Data,1);
});
test('replay different content conflicts and never writes current-year body',()=>{
  const f=fixture();seed(f,send.RequestId);f.migrate();
  assert.equal(f.api.persist(f.message(send.RequestId,{Content:'different'})).Reason,'Conflict');assert.equal(f.physicalRows().length,1);
});
test('same payload hash delimiter collision is still rejected by exact immutable fields',()=>{
  const f=fixture();const row=seed(f,'collision',f.base,'chat_2025',{Type:'type|part',Content:'body'});f.migrate();
  const forged=f.message('collision',{Type:'type',Content:'part|body'});assert.equal(forged.PayloadHash,row.PayloadHash);
  assert.equal(f.api.persist(forged).Reason,'Conflict');assert.equal(f.physicalRows().length,1);
});
test('both equal-body and different-body same Id physical duplicates require conflict; all originals retained',()=>{
  for(const changed of [false,true]){const f=fixture();seed(f,'duplicate');seed(f,'duplicate',f.base+'_2026','chat_202601',{CreateTime:'2026-01-01T01:00:00Z',Content:changed?'other':'hello'});const original=JSON.stringify(f.physicalRows());
    const migration=f.migrate(1);assert.equal(migration.Data.Phase,'Conflict');assert.equal(migration.Data.ScanComplete,true);assert.equal(f.api.unread('user-2','').Reason,'Conflict');assert.equal(f.api.history('user-1','user-2','',10).Reason,'Conflict');assert.equal(JSON.stringify(f.physicalRows()),original);
  }
});
test('Annual, compact monthly, separated monthly, base/year database all index without moving bodies',()=>{
  const f=fixture();const shapes=[[f.base,'chat_2024'],[f.base+'_2024','chat_2024'],[f.base,'chat_202512'],[f.base+'_2025','chat_2025_12']];
  shapes.forEach(([db,table],i)=>seed(f,'shape-'+i,db,table));assert.equal(f.migrate(2).Data.Phase,'Completed');assert.equal(f.physicalRows().length,4);
  assert.equal(f.api.unread('user-2','').Data,4);for(let i=0;i<4;i++)assert.equal(f.api.persist(f.message('shape-'+i)).Duplicate,true);
});
test('preexisting Month pointer is safely normalized and references its original body',()=>{
  const f=fixture();const row=seed(f,'pointer',f.base+'_2025','chat_202512');f.seed(f.base,'chat_message_location',{_id:row.MessageId,Month:'202512',PayloadHash:row.PayloadHash,CreateTime:row.CreateTime});
  assert.equal(f.migrate().Data.Phase,'Completed');assert.equal(f.api.persist(f.message('pointer')).Duplicate,true);
  const mutation=f.calls.find(([m,r])=>m==='UptFormDataByWhere'&&r.TableName==='chat_message_location'&&r._FormData.Schema===1);assert.ok(mutation);assert.ok(mutation[1]._Where.some(c=>c[0]==='Schema'&&c[1]==='<>'&&c[2]===1));
});
test('read status changed after original send does not invalidate original payload hash',()=>{
  const f=fixture();const row=seed(f,'read');f.collection(f.base,'chat_2025').get(row.MessageId).IsRead=true;assert.equal(f.migrate().Data.Phase,'Completed');
  assert.equal(f.api.persist(f.message('read')).Duplicate,true);assert.equal(f.api.unread('user-2','').Data,0);
});
test('bounded migration resumes pages and same final operation only returns persisted receipt',()=>{
  const f=fixture();for(let i=0;i<5;i++)seed(f,'batch-'+i);let state=f.start().Data;
  const a=f.api.step({OperationId:'batch-operation-1',ExpectedRevision:state.Revision,PageSize:2});assert.equal(a.Data.Scanned,2);assert.equal(a.Data.Phase,'Running');
  const before=f.calls.length;const replay=f.api.step({OperationId:'batch-operation-1',ExpectedRevision:0,PageSize:2});assert.equal(replay.Duplicate,true);assert.equal(f.calls.slice(before).some(([m,r])=>r.PhysicalRows),false);
  let next=a;for(let i=2;next.Data.Phase==='Running';i++)next=f.api.step({OperationId:'batch-operation-'+i,ExpectedRevision:next.Data.Revision,PageSize:2});assert.equal(next.Data.Scanned,5);assert.equal(next.Data.Phase,'Completed');
});
test('migration Pending stops legacy hooks and all writes before partial history becomes visible',()=>{
  const f=fixture();seed(f,'pending');f.start();let hooks=0;f.v8.ApiEngine.Run=()=>{hooks++;return {Code:1};};const n=f.physicalRows().length;
  const result=f.runRuntime(candidate(),send);assert.equal(result.Reason,'Pending');assert.equal(hooks,0);assert.equal(f.physicalRows().length,n);assert.equal(f.api.history('user-1','user-2','',1).Reason,'Pending');
});
test('ordinary send hot path after migration never enumerates partitions and unknown ack recovers same fixed entity',()=>{
  let fail=true;const f=fixture({fault:({method,request,stage})=>{if(fail&&method==='AddFormData'&&/^chat_\d+$/.test(request.TableName)&&stage==='after'){fail=false;throw Error('lost ack');}}});f.migrate();const n=f.calls.length;
  const sent=f.api.persist(f.message('new-message'));assert.equal(sent.Code,1);assert.equal(f.physicalRows().length,1);assert.equal(f.api.persist(f.message('new-message')).Duplicate,true);
  assert.equal(f.calls.slice(n).some(([m,r])=>r.PhysicalRows),false);assert.equal(f.calls.slice(n).some(([m,r])=>r.EnsureIndex),false);
});
test('unknown pointer read never means absent and never writes new physical entity',()=>{
  let armed=false;const f=fixture({fault:({method,request,stage})=>{if(armed&&method==='GetFormData'&&request.TableName==='chat_message_location'&&stage==='before')throw Error('network');}});f.migrate();armed=true;
  assert.equal(f.api.persist(f.message('unknown')).Code,0);assert.equal(f.physicalRows().length,0);
});
test('lost migration progress ack is resolved only by matching persisted operation/revision',()=>{
  let lost=false;const f=fixture({fault:({method,request,stage})=>{if(!lost&&method==='UptFormDataByWhere'&&request._FormData.LastOperationId&&stage==='after'){lost=true;throw Error('lost ack');}}});seed(f,'ack');assert.equal(f.migrate().Data.Phase,'Completed');assert.equal(lost,true);
});
test('expired lease prevents completion even when physical scan returned rows',()=>{
  let f,armed=false;f=fixture({fault:({method,request,stage})=>{if(armed&&method==='GetPartitionedTableData'&&request.PhysicalRows&&stage==='after'){armed=false;f.tick(120001);}}});seed(f,'lease');const state=f.start().Data;armed=true;
  const result=f.api.step({OperationId:'lease-operation-1',ExpectedRevision:state.Revision,PageSize:10});assert.equal(result.Reason,'LeaseLost');assert.equal(f.api.status().Data.Phase,'Running');assert.equal(f.api.status().Data.Scanned,0);
});
test('changed physical directory fails closed and does not advance cursor',()=>{
  const f=fixture();seed(f,'directory');const state=f.start().Data;f.changeDirectory();assert.equal(f.api.step({OperationId:'directory-operation',ExpectedRevision:state.Revision}).Code,0);assert.equal(f.api.status().Data.Scanned,0);
});
test('history cursor crosses years and months and unread comes from same canonical entities',()=>{
  const f=fixture();for(let i=0;i<5;i++)seed(f,'history-'+i,i<2?f.base:f.base+'_2026',i<2?'chat_2025':'chat_202601',{CreateTime:i<2?'2025-12-'+(29+i)+'T12:00:00Z':'2026-01-0'+(i-1)+'T12:00:00Z'});
  assert.equal(f.migrate(2).Data.Phase,'Completed');let cursor='',ids=[];do{const page=f.api.history('user-1','user-2',cursor,2);assert.equal(page.Code,1);ids.push(...page.Data.Rows.map(r=>r.MessageId));cursor=page.Data.NextCursor;}while(cursor);
  assert.equal(ids.length,5);assert.equal(new Set(ids).size,5);assert.equal(f.api.unread('user-2','').Data,5);
  assert.equal(f.api.markRead(ids[0],'user-1').Reason,'Forbidden');assert.equal(f.api.markRead(ids[0],'user-2').Code,1);assert.equal(f.api.unread('user-2','').Data,4);assert.equal(f.api.history('user-1','user-2','',2).Data.Rows[0].IsRead,true);
});
test('tenant and conversation cursor cannot be reused and foreign physical bodies are not migrated',()=>{
  const f=fixture();seed(f,'tenant-1');seed(f,'tenant-2');f.seed('diy_chat_other','chat_2025',f.message('foreign',{CreateTime:'2025-01-01T00:00:00Z'}));assert.equal(f.migrate().Data.Scanned,2);
  const page=f.api.history('user-1','user-2','',1);assert.equal(f.api.history('user-1','user-3',page.Data.NextCursor,1).Code,0);
});
test('malformed completed receipt and missing index fail closed rather than full collection fallback',()=>{
  const f=fixture();f.migrate();f.indexes.clear();assert.equal(f.api.unread('user-2','').Code,0);
  const state=f.api.status().Data;delete f.collection(f.base,'chat_location_migration').get(state._id).ScanComplete;assert.equal(f.api.persist(f.message('forged-complete')).Reason,'Conflict');
});
test('full assembled Managed runtime rejects unprivileged migration and replays single original after indexed migration',()=>{
  const f=fixture();seed(f,send.RequestId);f.v8.CurrentUser.Level=1;assert.equal(f.runRuntime(candidate(),{Action:'LegacyLocationStart',MaintenanceConfirmed:true,FenceId:'caller-fake-0001'}).Code,0);f.v8.CurrentUser.Level=9999;
  assert.equal(f.migrate().Data.Phase,'Completed');const result=f.runRuntime(candidate(),send);assert.equal(result.Code,1);assert.equal(result.DataAppend.Duplicate,true);assert.equal(f.physicalRows().length,1);
});
test('legacy old-pointer newer physical copy is read before normalization and causes conflict',()=>{
  const f=fixture();const old=seed(f,'pointer-duplicate');const newer=seed(f,'pointer-duplicate',f.base+'_2026','chat_202601',{CreateTime:'2026-01-02T00:00:00Z'});
  f.seed(f.base,'chat_message_location',{_id:old.MessageId,Month:'202601',PayloadHash:newer.PayloadHash});
  assert.equal(f.migrate(1).Data.Phase,'Conflict');assert.equal(f.physicalRows().length,2);
  assert.ok(f.calls.some(([m,r])=>m==='GetFormData'&&r.DbName===f.base+'_2026'&&r.TableName==='chat_202601'));
});
test('invalid historic timezone stops at durable conflict without changing original data',()=>{
  const f=fixture();seed(f,'ambiguous-time',f.base,'chat_2025',{CreateTime:'2025-12-31 23:59:59'});const original=JSON.stringify(f.physicalRows());
  const result=f.migrate();assert.equal(result.Data.Phase,'Conflict');assert.equal(result.Data.ScanComplete,false);assert.match(result.Data.LastError,/时区/);assert.equal(JSON.stringify(f.physicalRows()),original);
});
test('canonical page hydrates one physical partition in one bounded indexed query',()=>{
  const f=fixture();for(let i=0;i<40;i++)seed(f,'many-'+i);f.migrate(50);const before=f.calls.length;
  const page=f.api.history('user-1','user-2','',40);assert.equal(page.Data.Rows.length,40);
  const reads=f.calls.slice(before).filter(([m])=>m==='GetTableData');assert.equal(reads.length,1);assert.equal(reads[0][1]._Where[0][0],'_id');assert.equal(reads[0][1]._Where[0][2].length,40);
});
test('final migration receipt can be recovered after trusted fence is closed without replaying writes',()=>{
  const f=fixture();seed(f,'final-ack');const started=f.start();const finished=f.api.step({OperationId:'final-operation-1',ExpectedRevision:started.Data.Revision,PageSize:10});assert.equal(finished.Data.Phase,'Completed');
  delete f.v8.Method.RequireManagedStorageMaintenance;const before=f.calls.length;const replay=f.api.step({OperationId:'final-operation-1',ExpectedRevision:started.Data.Revision});assert.equal(replay.Duplicate,true);assert.equal(f.calls.slice(before).some(([m])=>m.startsWith('Add')||m.startsWith('Upt')),false);
});
test('partial mark-read projection keeps canonical history and unread aligned until acknowledged',()=>{
  let armed=false;const f=fixture({fault:({method,request,stage})=>{if(armed&&method==='UptFormDataByWhere'&&request.TableName==='chat_message_location'&&request._FormData.IsRead===true&&stage==='before')throw Error('write not sent');}});const row=seed(f,'read-projection');f.migrate();armed=true;
  assert.equal(f.api.markRead(row.MessageId,'user-2').Reason,'Pending');assert.equal(f.api.unread('user-2','').Data,1);assert.equal(f.api.history('user-1','user-2','',10).Data.Rows[0].IsRead,false);
  armed=false;assert.equal(f.api.markRead(row.MessageId,'user-2').Code,1);assert.equal(f.api.unread('user-2','').Data,0);
});
test('assembled canonical runtime never converts unread timeout to a real zero after durable message write',()=>{
  let armed=false;const f=fixture({fault:({method,request,stage})=>{if(armed&&method==='GetPartitionedTableData'&&request.CountOnly&&!request.EnsureIndex&&stage==='before')throw Error('count timeout');}});f.migrate();armed=true;
  const result=f.runRuntime(candidate(),{...send,RequestId:'count-unknown'});assert.equal(result.Code,1);assert.equal(result.DataAppend.StorageCommitted,true);assert.equal(result.Data.ActorUnreadCount,null);assert.equal(result.Data.TargetUnreadCount,null);assert.equal(result.DataAppend.UnreadCountPending,true);
});
test('legacy and canonical SignalR paths each consume the trusted one-shot host context exactly once',()=>{
  for(const migrate of [false,true]){const f=fixture();if(migrate)f.migrate();const result=f.runRuntime(candidate(),{...send,RequestId:'signalr-'+migrate,_InvokeType:'Client'});assert.equal(result.Code,1);assert.equal(f.protocolConsumes,1);}
});
test('existing Reserved without a body reports new creation only when this call receives body insert ACK',()=>{
  let reject=true;const f=fixture({fault:({method,request,stage})=>{if(reject&&method==='AddFormData'&&/^chat_\d+$/.test(request.TableName)&&stage==='before')throw Error('not sent');}});f.migrate();
  assert.equal(f.api.persist(f.message('reserved')).Reason,'Pending');reject=false;
  const created=f.api.persist(f.message('reserved'));assert.equal(created.Code,1);assert.equal(created.Duplicate,false);assert.equal(f.physicalRows().length,1);
});
test('contending call that recovers another writer body reports Duplicate true with one physical entity',()=>{
  let f,armed=true,nested;f=fixture({fault:({method,request,stage})=>{if(armed&&method==='GetFormData'&&/^chat_\d+$/.test(request.TableName)&&stage==='before'){armed=false;nested=f.api.persist(f.message('contended'));}}});f.migrate();
  const outer=f.api.persist(f.message('contended'));assert.equal(nested.Code,1);assert.equal(nested.Duplicate,false);assert.equal(outer.Code,1);assert.equal(outer.Duplicate,true);assert.equal(f.physicalRows().length,1);
});
test('empty physical partitions consume a bounded budget and empty HasMore page must advance',()=>{
  const f=fixture();for(let year=2010;year<2019;year++)f.collection(f.base,'chat_'+year);seed(f,'late-empty',f.base,'chat_2025');
  const state=f.start();const first=f.api.step({OperationId:'empty-budget-0001',ExpectedRevision:state.Data.Revision,PageSize:10});assert.equal(first.Data.Phase,'Running');assert.equal(first.Data.Scanned,0);assert.ok(first.Data.Cursor);
  const second=f.api.step({OperationId:'empty-budget-0002',ExpectedRevision:first.Data.Revision,PageSize:10});assert.equal(second.Data.Phase,'Completed');assert.equal(second.Data.Scanned,1);
});
test('a missing old-pointer body is a read-only miss and cannot create a phantom physical partition',()=>{
  const f=fixture();const row=seed(f,'missing-pointer-body');f.seed(f.base,'chat_message_location',{_id:row.MessageId,Month:'202601',PayloadHash:row.PayloadHash});const before=[...f.storage.keys()].filter(k=>/chat_\d/.test(k));
  assert.equal(f.migrate().Data.Phase,'Completed');assert.deepEqual([...f.storage.keys()].filter(k=>/chat_\d/.test(k)),before);assert.equal(f.api.persist(f.message('missing-pointer-body')).Duplicate,true);
});

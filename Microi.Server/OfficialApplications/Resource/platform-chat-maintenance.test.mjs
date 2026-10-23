import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fixture} from './platform-chat-location-fixture.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const maintenance=read('platform-chat-maintenance.js');
const patched='../../';

test('host admission types are forbidden through existing V8 member/type resolver',()=>{
 const code=read(patched+'Microi.Core/V8Engine/Runtime/V8Engine.cs');
 const list=code.slice(code.indexOf('_blockedExactTypes'),code.indexOf('private static bool IsBlockedMember'));
 for(const type of ['ManagedStorageAdmissionRuntime','IManagedStorageAdmissionStore','MongoManagedStorageAdmissionStore','ManagedStorageTicket','ManagedStorageGate'])assert.ok(list.includes('"Microi.net.'+type+'"'));
 assert.match(code,/if \(_blockedExactTypes\.Contains\(fullName\)\) return true;/);
});
test('native facade binds fixed maintenance key, authoritative tenant admin and plain JSON projection',()=>{
 const code=read(patched+'Microi.Core/V8Engine/Runtime/V8Method.ManagedStorageMaintenance.cs');
 assert.equal((code.match(/ResolveTrustedManagedCurrentUser\(ManagedStorageAdmissionRuntime\.MaintenanceKey, true,/g)||[]).length,2);
 assert.equal((code.match(/DiyCommon.MaxRoleLevel, out var tenant, out var user/g)||[]).length,2);
 assert.ok(!code.includes('CurrentUser]')&&!code.includes('WritersDrained ='));
 assert.ok(code.includes('ManagedStorageAdmissionRuntime.RequireControlContext(tenant)'));
 assert.equal((code.match(/new DosResult\(1, JObject.FromObject/g)||[]).length,2);
});
test('all five actual Mongo mutation bodies and explicit index creation retain using guard',()=>{
 const code=read(patched+'Microi.MongoDB/V8MongoDB.cs');
 for(const name of ['AddFormData','UptFormData','UptFormDataByWhere','DelFormData','DelFormDataByWhere']){
  const body=code.slice(code.indexOf('public DosResult '+name+'('));assert.ok(body.slice(0,250).includes('using var managedMutation = ManagedStorageAdmissionRuntime.BeginMutation();'));
 }
 assert.match(read(patched+'Microi.MongoDB/V8MongoDB.CollectionPage.cs'),/using var managedIndexMutation = ensureIndex \? ManagedStorageAdmissionRuntime.BeginMutation\(\) : null/);
});

function controller(f,operation,extra={}){
 f.v8.Param={Operation:operation,...extra};return new Function('V8',maintenance)(f.v8);
}
function hostFixture(){const f=fixture();let ended=0;f.v8.Method.ManageManagedStorageMaintenance=p=>{
 assert.equal(p.Scope,'platform-chat-runtime');if(p.Operation==='End'){assert.equal(p.ExpectedRevision,99);ended++;return {Code:1,Data:{Phase:'Open'}};}
 return {Code:1,Data:{Epoch:'fixture-fence-epoch',Revision:99,Phase:'Maintenance',WritersDrained:true,WriteAdmissionClosed:true}};
 };return {f,ended:()=>ended};}
test('maintenance controller returns native authorization failure without touching index',()=>{
 const {f}=hostFixture();f.v8.Method.ManageManagedStorageMaintenance=()=>({Code:1001,Msg:'Denied'});
 assert.equal(controller(f,'Start',{MaintenanceConfirmed:true,FenceId:'valid-fence-id'}).Code,1001);assert.equal(f.calls.length,0);
});
test('maintenance controller will not end before complete authoritative indexed receipt',()=>{
 const {f,ended}=hostFixture();assert.equal(controller(f,'End').Code,0);assert.equal(ended(),0);
});
test('maintenance controller permits abort only before any migration state exists',()=>{
 const {f,ended}=hostFixture();assert.equal(controller(f,'AbortUnstarted').Code,1);assert.equal(ended(),1);
 f.start();assert.equal(controller(f,'AbortUnstarted').Code,0);assert.equal(ended(),1);
});
test('ordinary runtime rejects even administrator maintenance action without mutation',()=>{
 const f=fixture();f.v8.CurrentUser.Level=9999;const before=f.calls.length;
 const result=f.runRuntime(read('platform-chat-runtime.js'),{Action:'LegacyLocationStart',MaintenanceConfirmed:true,FenceId:'fake-fence'});
 assert.equal(result.Code,0);assert.equal(f.calls.slice(before).some(([method])=>method.startsWith('Add')||method.startsWith('Upt')),false);
});
test('official mixed-case iTdos identity accepts same-tenant normalized native fence',()=>{
 const f=fixture({tenant:'iTdos'});const before=f.v8.Method.RequireManagedStorageMaintenance;
 f.v8.Method.RequireManagedStorageMaintenance=()=>{const result=before();result.Data.OsClient='itdos';return result;};
 assert.equal(f.migrate().Data.Phase,'Completed');
});
test('maintenance complete receipt can reopen, but mismatched epoch cannot',()=>{
 const {f,ended}=hostFixture();const state=f.migrate();assert.equal(state.Data.Phase,'Completed');
 assert.equal(controller(f,'End',{Epoch:'fixture-fence-epoch'}).Code,0);assert.equal(ended(),0);
 f.v8.Method.ManageManagedStorageMaintenance=p=>{if(p.Operation==='End'){assert.equal(p.Epoch,state.Data.FenceEpoch);assert.equal(p.ExpectedRevision,101);return {Code:1,Data:{Phase:'Open'}};}return {Code:1,Data:{Epoch:state.Data.FenceEpoch,Revision:101}};};
 assert.equal(controller(f,'End',{Epoch:state.Data.FenceEpoch}).Code,1);
});
test('Abort uses authoritative pre-read revision and cannot replace it with request input',()=>{
 const {f}=hostFixture();let revision=10,ended=0;
 f.v8.Method.ManageManagedStorageMaintenance=p=>{if(p.Operation==='Status')return {Code:1,Data:{Epoch:'fixture-fence-epoch',Revision:revision}};
  if(p.Operation==='End'){assert.equal(p.ExpectedRevision,10);ended++;return {Code:p.ExpectedRevision===revision?1:0};}throw Error('unexpected action');};
 const read=f.v8.MongoDb.GetFormData;f.v8.MongoDb.GetFormData=p=>{const result=read(p);revision+=2;return result;};
 assert.equal(controller(f,'AbortUnstarted',{ExpectedRevision:12}).Code,0);assert.equal(ended,1);
});

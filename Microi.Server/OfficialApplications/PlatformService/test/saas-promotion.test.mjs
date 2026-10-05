import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { fileURLToPath } from 'node:url'
import { csvCell,safeTaskSnapshot,tenantCsv,summarizeUsage } from '../src/saas-promotion-model.js'
const root=fileURLToPath(new URL('../',import.meta.url))
const source=name=>fs.readFileSync(root+'engines/'+name+'.js','utf8')
function execute(name,V8){return vm.runInNewContext('(function(){'+source(name)+'})()', {V8,System:{DateTime:{UtcNow:new Date('2026-10-05T12:00:00Z')}}})}
const actor={UserId:'sales-a',UserName:'Sales A',OsClient:'main',OsClientType:'Product',OsClientNetwork:'Internal',CanViewAll:false,CanConfigure:false}
function manager(params,owner=actor){const queries=[];const V8={Param:params,Method:{AuthorizeSaasPromotion:()=>({Code:1,Data:owner})},Db:{FromSql(sql){const bound={};return {AddInParameter(k,v){bound[k]=v;return this},ToArray(){queries.push({sql,bound});if(sql.includes('FROM sys_user'))return [{Id:'sales-a',Name:'Sales A'}];if(sql.includes('FROM sys_osclients'))return [];return []},ExecuteNonQuery(){queries.push({sql,bound});return 0}}}}};return {result:execute('platform-saas-promotion',V8),queries}}
test('salesperson tenant scope is fixed to fresh native identity, despite supplied actor and tenant',()=>{const r=manager({Action:'Tenants',UserId:'sales-b',CanViewAll:true,OsClient:'other',ReferralUserId:'sales-b'});assert.equal(r.result.Code,1);const q=r.queries.find(q=>q.sql.includes('FROM sys_osclients'));assert.match(q.sql,/ReferralUserId=@actor/);assert.equal(q.bound['@actor'],'sales-a');assert.equal(q.bound['@main'],'main');assert.equal(q.bound['@network'],'Internal')})
test('manager scope still excludes main and other runtime partitions',()=>{const r=manager({Action:'Tenants'},{...actor,CanViewAll:true});const q=r.queries.find(q=>q.sql.includes('FROM sys_osclients'));assert.doesNotMatch(q.sql,/ReferralUserId=@actor/);assert.match(q.sql,/OsClient<>@main/);assert.match(q.sql,/OsClientType=@type AND OsClientNetwork=@network/)})
test('native authorization denial stops all reads and writes',()=>{let read=false;const result=execute('platform-saas-promotion',{Param:{Action:'Tenants'},Method:{AuthorizeSaasPromotion:()=>({Code:1002})},Db:{FromSql(){read=true}}});assert.equal(result.Code,1002);assert.equal(read,false)})
test('dashboard timestamps use UTC when the host maps DateTime to a JavaScript Date',()=>{const r=manager({Action:'Dashboard'});assert.equal(r.result.Code,1);assert.match(r.result.Data.ServerTime,/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);const actual=new Date(r.result.Data.ServerTime.replace(' ','T')+'Z').getTime();assert.ok(Math.abs(actual-Date.now())<2000)})
test('salesperson cannot configure public signup or manager roles',()=>{const r=manager({Action:'SaveSettings',Enabled:true,ManagerRoleIds:['admin']});assert.equal(r.result.Code,1002);assert.equal(r.queries.length,0)})
test('unknown tenant identifier does not allow assign or notes update',()=>{const r=manager({Action:'UpdateFollowup',Id:'other',Stage:'Converted'});assert.equal(r.result.Code,1002);assert.equal(r.queries.length,1)})
test('public form rejects connection credentials and authority fields before native queue',()=>{for(const field of ['DbConn','RoleIds','TemplateUrl','Level','PasswordHash','OwnerUserId']){let called=false;const result=execute('platform-saas-public-trial',{Param:{Action:'Create',[field]:'attack'},Method:{SaasPublicTrialAtom(){called=true}}});assert.equal(result.Code,0);assert.equal(called,false)}})
test('public form canonicalizes queue fields and never forwards forged current user',()=>{let captured;execute('platform-saas-public-trial',{Param:{Action:'Create',RequestId:'id',SystemName:'Test',_CurrentUser:{Id:'admin'},OsClient:'main'},Method:{SaasPublicTrialAtom(p){captured=p;return {Code:1}}}});assert.equal(captured.Action,'Queue');assert.equal(captured.SystemName,'Test');assert.equal(captured._CurrentUser,undefined);assert.equal(captured.OsClient,undefined)})
test('public progress only forwards the scoped progress ticket',()=>{let captured;execute('platform-saas-public-trial',{Param:{Action:'Progress',RequestId:'id',ProgressToken:'ticket'},Method:{SaasPublicTrialAtom(p){captured=p;return {Code:1}}}});assert.deepEqual(Object.keys(captured).sort(),['Action','ProgressToken','RequestId'])})
test('native HTTP protocol context is discarded while business authority fields stay rejected',()=>{
 const protocol={OsClient:'main',ApiEngineKey:'platform-saas-public-trial',ApiAddress:'/trial',_CurrentUser:{Id:'forged',Level:9999},_DeviceId:'device',_InvokeType:'Client',_HttpMethod:'POST',_RequestPath:'/apiengine/platform-saas-public-trial',_RequestScheme:'https',_RequestHost:'localhost:61501',_RequestPathBase:'',_RawBody:'{}',_ContentType:'application/json',_RouteValues:{Level:9999},_BackgroundTaskId:'forged',_BackgroundTaskFenceToken:999};
 let captured;
 const result=execute('platform-saas-public-trial',{Param:{Action:'Create',RequestId:'request',SystemName:'Test',...protocol},Method:{SaasPublicTrialAtom(p){captured=p;return {Code:1}}}});
 assert.equal(result.Code,1);assert.deepEqual(Object.keys(captured).sort(),['Action','RequestId','SystemName']);
 for(const field of ['DbConn','RoleIds','TemplateUrl','Level','PasswordHash','OwnerUserId']){
  const denied=execute('platform-saas-public-trial',{Param:{Action:'Create',...protocol,[field]:'attack'},Method:{SaasPublicTrialAtom(){throw Error('must not reach native atom')}}});
  assert.equal(denied.Code,0);
 }
})
test('public form blocks honeypot and control characters',()=>{for(const p of [{Action:'Create',Website:'spam'},{Action:'Create',SystemName:'test\nnewline'}]){const result=execute('platform-saas-public-trial',{Param:p});assert.equal(result.Code,0)}})
test('legacy host test placeholder is bounded and cannot pass authority to public provisioning',()=>{
 let captured;execute('platform-saas-public-trial',{Param:{Action:'Bootstrap',TestParam1:'test'},Method:{SaasPublicTrialAtom(p){captured=p;return {Code:1}}}});
 assert.deepEqual(Object.keys(captured),['Action']);
 for(const value of [{Level:9999},'x'.repeat(201)])assert.equal(execute('platform-saas-public-trial',{Param:{Action:'Bootstrap',TestParam1:value}}).Code,0);
})
test('worker forwards only encrypted grant and relies on trusted execution atom',()=>{let captured;execute('platform-saas-public-trial-worker',{Param:{GrantCipher:'cipher',Level:9999,TenantKey:'main'},Method:{ProvisionPublicSaasTrial(p){captured=p;return {Code:1}}}});assert.deepEqual(Object.keys(captured),['GrantCipher'])})
test('browser progress snapshot contains no password, contact or grant',()=>{const v=safeTaskSnapshot({RequestId:'id',ProgressToken:'ticket',TaskId:'task',AdminPassword:'secret',GrantCipher:'grant',ContactPhone:'phone'});assert.deepEqual(v,{RequestId:'id',ProgressToken:'ticket',TaskId:'task'});assert.equal(safeTaskSnapshot(null),null)})
test('CSV protects formulas, escapes quotes, and exports server authorized rows only',()=>{assert.equal(csvCell(' =HYPERLINK("bad")'),'"\' =HYPERLINK(""bad"")"');const csv=tenantCsv([{ClientName:'=danger',OsClient:'tenant',TrialState:'Trial'}]);assert.match(csv,/"'\=danger"/);assert.match(csv,/试用中/);assert.equal(csv.split('\r\n').length,2)})

test('fleet totals count every authorized target once and exclude unknown metrics',()=>{const v=summarizeUsage([{Id:'a',Status:'Ready',Forms:3,Users:0,CollectedAt:'2026-10-05T12:00:00Z'},{Id:'b',Status:'Partial',Users:7,CollectedAt:'2026-10-05T11:00:00Z'},{Id:'c',Status:'Unavailable',Forms:999},{Id:'a',Status:'Ready',Forms:100},{Id:'outside',Status:'Ready',Forms:999}],[{Id:'a',ReferralUserId:'sales-a'},{Id:'b',ReferralUserId:'sales-a'},{Id:'c',ReferralUserId:'sales-b'}]);assert.equal(v.Total,3);assert.equal(v.Readable,2);assert.deepEqual(v.Metrics.Forms,{Value:3,Covered:1});assert.deepEqual(v.Metrics.Users,{Value:7,Covered:2});assert.deepEqual(v.Metrics.ApiEngines,{Value:null,Covered:0});assert.equal(v.OldestCollectedAt,'2026-10-05T11:00:00Z');assert.equal(v.Team['sales-a'].Readable,2);assert.equal(v.Team['sales-b'].Metrics.Forms.Value,null)})
test('an actually empty authorized scope has zero totals',()=>{const v=summarizeUsage([],[]);assert.equal(v.Total,0);assert.deepEqual(v.Metrics.Forms,{Value:0,Covered:0})})
test('fleet totals reject non numeric, negative and infinite metrics',()=>{const v=summarizeUsage([{Id:'a',Status:'Ready',Forms:'10',Users:-1,Menus:Infinity}],[{Id:'a'}]);for(const key of ['Forms','Users','Menus'])assert.equal(v.Metrics[key].Value,null)})

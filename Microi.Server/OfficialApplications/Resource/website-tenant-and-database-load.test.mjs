import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../../..');
const profile=fs.readFileSync(path.join(root,'microi.doc/docs/.vitepress/theme/components/ProfilePage.vue'),'utf8');
async function submitTenant({valid=true,response={Code:1,Msg:'accepted'},networkError=false}={}){
  const start=profile.indexOf('async function createTenant()'),end=profile.indexOf('function startTenantProgress(',start);
  assert.ok(start>=0&&end>start,'Canonical tenant submit function missing');
  const requests=[],progress=[],stops=[];
  const state={isCreating:{value:false},createError:{value:''},tenantProgress:{value:''}};
  const sandbox={...state,tenantKey:{value:' ExampleTenant '},systemName:{value:'QA系统'},locale:{value:'zh-CN'},OS_CLIENT:'iTdos',validateTenantCreation:()=>valid,createTraceId:()=> 'original-trace-id',currentProfileUserId:()=> 'ordinary-owner-id',startTenantProgress:id=>progress.push(id),stopTenantProgress:()=>stops.push(true),t:x=>x,apiEngineUrl:key=>'/apiengine/'+key,authenticatedFetch:async(url,request)=>{requests.push({url,...request,parsed:JSON.parse(request.body)});if(networkError)throw Error('connection interrupted');return{json:async()=>response};}};
  await vm.runInNewContext(profile.slice(start,end)+';createTenant()',sandbox);
  return{requests,progress,stops,...state};
}
test('actual website submission targets the trusted native worker with original user trace and tenant concurrency',async()=>{
  const r=await submitTenant(),request=r.requests[0],body=request.parsed;
  assert.equal(r.requests.length,1);
  assert.equal(request.url,'/apiengine/platform-background-task');
  assert.equal(request.method,'POST');
  assert.equal(request.headers.osclient,'iTdos');
  assert.equal(request.headers['Content-Type'],'application/json');
  assert.deepEqual(body,{OsClient:'iTdos',Action:'RunApiEngine',TargetApiEngineKey:'official_create_tenant_worker',Title:'createTenant',Param:{TenantKey:' ExampleTenant ',SystemName:'QA系统',TraceId:'original-trace-id',TaskId:'original-trace-id',_Lang:'zh-CN'},Options:{IdempotencyKey:'official-create-tenant:ordinary-owner-id:original-trace-id',ConcurrencyKey:'official-create-tenant:exampletenant',MaxAttempts:1,RetryOnFailure:false}});
  assert.deepEqual(r.progress,['original-trace-id']);
  assert.equal(r.isCreating.value,true);
  assert.equal(r.tenantProgress.value,'accepted');
  assert.equal(r.stops.length,0);
});
test('validation failure creates neither queue request nor pending progress',async()=>{
  const r=await submitTenant({valid:false});
  assert.equal(r.requests.length,0);assert.equal(r.progress.length,0);assert.equal(r.isCreating.value,false);
});
test('known business rejection stops pending progress and presents the native reason',async()=>{
  const r=await submitTenant({response:{Code:0,Msg:'quota exhausted'}});
  assert.equal(r.requests.length,1);assert.equal(r.stops.length,1);assert.equal(r.isCreating.value,false);assert.equal(r.createError.value,'quota exhausted');assert.equal(r.tenantProgress.value,'quota exhausted');
});
test('uncertain network response keeps the same original trace polling without resubmitting',async()=>{
  const r=await submitTenant({networkError:true});
  assert.equal(r.requests.length,1);assert.deepEqual(r.progress,['original-trace-id']);assert.equal(r.stops.length,0);assert.equal(r.isCreating.value,true);assert.equal(r.createError.value,'');assert.equal(r.tenantProgress.value,'connectionInterrupted');
});
test('queue target matches the private managed worker and native trusted background identity boundary',()=>{
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'Microi.Server/OfficialApplications/Resource/app.microi.saas-engine.json'),'utf8'));
  const worker=pkg.SysApiEngines.filter(e=>e.ApiEngineKey==='official_create_tenant_worker');
  assert.equal(worker.length,1);assert.equal(worker[0].StopHttp,1);assert.equal(worker[0].AllowAnonymous,0);assert.equal(worker[0].IsEnable,1);
  assert.equal(pkg.ResourcePolicies.ApiEngines.official_create_tenant_worker.UpgradePolicy,'Managed');
  const native=fs.readFileSync(path.join(root,'Microi.Server/Microi.Core/V8Engine/Runtime/V8Method.cs'),'utf8');
  const body=native.slice(native.indexOf('public DosResult ProvisionTenant('),native.indexOf('public DosResult ProvisionAdminTenant('));
  assert.match(body,/ResolveCurrentManagedBackgroundTask\(\s*json,\s*"official_create_tenant_worker"/);
  assert.match(body,/if \(taskDenied != null\) return taskDenied;/);
  assert.ok(body.indexOf('ResolveCurrentManagedBackgroundTask(')<body.indexOf('.ProvisionTenantAsync('));
});
test('OAuth form encoding preserves the trusted return URL including its fragment',async()=>{
  const source=profile.slice(profile.indexOf('async function beginGiteeStarOAuth()'),profile.indexOf('function isGiteeStarReturn()'));
  let request;
  const state={value:false};
  const sandbox={URL,URLSearchParams,window:{location:{origin:'https://microi.net',assign:()=>{}}},isStartingGiteeOAuth:{value:false},isCheckingGiteeStar:state,isCreating:state,validateTenantCreation:()=>true,saveGiteeStarTenantDraft:()=>true,giteeStarError:{value:''},tenantKey:{value:'demo'},locale:{value:'zh-CN'},t:x=>x,apiEngineUrl:x=>x,isSessionExpiredResult:()=>false,isTrustedGiteeAuthorizeUrl:()=>true,localizeServerMessage:x=>x,authenticatedFetch:async(_,r)=>{request=r;return {json:async()=>({Code:1,Data:{AuthorizeUrl:'https://gitee.com/oauth/authorize'}})}}};
  await vm.runInNewContext(source+';beginGiteeStarOAuth()',sandbox);
  assert.equal(request.headers['Content-Type'],'application/x-www-form-urlencoded');
  assert.equal(new URLSearchParams(request.body).get('ReturnUrl'),'https://microi.net/profile.html#/create');
});
function run(selected, response={Code:1}){
  const requests=[],tips=[],loading=[];
  const V8={Form:{NotDiyTable:selected,Id:'db-id',DbName:'database'},FieldSet:(...args)=>loading.push(args),Tips:(...args)=>tips.push(args),Http:{Post:async args=>{requests.push(args);if(response instanceof Error)throw response;return response;}}};
  const code=fs.readFileSync(path.join(root,'Microi.Server/OfficialApplications/Resource/database-load-nondiy-table.js'),'utf8');
  return Promise.resolve(vm.runInNewContext('(async()=>{'+code+'})()',{V8,window:{GetNotDiyTable:()=>{}},console})).then(()=>({requests,tips,loading}));
}
test('database import accepts current text selections and legacy objects',async()=>{
  for(const value of ['orders',{TableName:'orders'},JSON.stringify({TableName:'orders'})]){
    const r=await run(value);assert.equal(r.requests[0]?.PostParam.Name,'orders');assert.equal(r.requests[0]?.PostParam.DataBaseId,'db-id');assert.equal(r.loading.at(-1)?.[2],false);
  }
});
test('empty and malformed selections cannot submit a table import',async()=>{
  for(const value of [null,undefined,'',{},[],{TableName:''}]){
    const r=await run(value);assert.equal(r.requests.length,0);assert.ok(r.tips.length);
  }
});
test('business failure resets loading and reports an actionable error',async()=>{
  const r=await run('orders',{Code:0,Msg:'数据库连接失败'});assert.equal(r.loading.at(-1)?.[2],false);assert.match(r.tips.at(-1)?.[0],/数据库连接失败/);
});
test('network exceptions always release the import button',async()=>{
  const r=await run('orders',new Error('网络中断'));assert.equal(r.loading.at(-1)?.[2],false);assert.match(r.tips.at(-1)?.[0],/网络中断/);
});
test('both distribution packages carry the canonical button and complete database structure',()=>{
  const code=fs.readFileSync(path.join(root,'Microi.Server/OfficialApplications/Resource/database-load-nondiy-table.js'),'utf8');
  for(const file of ['app.microi.saas-engine.json','StandaloneApplications/app.microi.dbs.json']){
    const p=JSON.parse(fs.readFileSync(path.join(root,'Microi.Server/OfficialApplications/Resource',file),'utf8'));
    const table=p.DiyTables.find(x=>x.Name==='microi_database');assert.ok(table);
    const field=p.DiyFields.find(x=>x.TableId===table.Id&&x.Name==='BtnLoadNotDiyTable');assert.ok(field);
    assert.equal(Buffer.from(JSON.parse(field.Config).V8Code,'base64').toString('utf8'),code);
    const columns=p.PhysicalColumns.filter(x=>x.TABLE_NAME==='microi_database');assert.equal(columns.length,17);
    assert.ok(columns.some(x=>x.COLUMN_NAME==='BtnLoadNotDiyTable'));
    assert.equal(new Set(columns.map(x=>x.COLUMN_NAME)).size,columns.length);
    assert.ok(p.DDLStatements.some(x=>x.TableName==='microi_database'));
    assert.ok(!(p.DataSets||[]).some(x=>x.TableName==='microi_database'));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../../..');
const profile=fs.readFileSync(path.join(root,'microi.doc/docs/.vitepress/theme/components/ProfilePage.vue'),'utf8');
test('website sends the background target and serializes tenant parameters as the queue contract requires',()=>{
  const body=profile.slice(profile.indexOf('async function createTenant()'),profile.indexOf('async function createTenant()')+2300);
  assert.match(body,/TargetApiEngineKey:\s*'official_create_tenant'/);
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
  const code=fs.readFileSync(path.join(root,'Microi.Server/Microi.Upgrade/Resource/database-load-nondiy-table.js'),'utf8');
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
  const code=fs.readFileSync(path.join(root,'Microi.Server/Microi.Upgrade/Resource/database-load-nondiy-table.js'),'utf8');
  for(const file of ['app.microi.saas-engine.json','StandaloneApplications/app.microi.dbs.json']){
    const p=JSON.parse(fs.readFileSync(path.join(root,'Microi.Server/Microi.Upgrade/Resource',file),'utf8'));
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

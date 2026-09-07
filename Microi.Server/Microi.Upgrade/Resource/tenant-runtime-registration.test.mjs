import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./platform-tenant-runtime-registration.js',import.meta.url),'utf8').trimEnd();
function run(p,level=9999,method=()=>({Code:1,Data:{Changed:false}})) {
 let calls=0;
 const value=vm.runInNewContext('(function(){'+source+'})()', {V8:{Param:p,CurrentUser:{Id:'admin',Level:level},Method:{EnsureOwnedTenantRuntimeRegistration:args=>{calls++;return method(args)},AddSysLog(){}}}});
 return {value,calls};
}
test('unauthorized and unconfirmed requests never reach the registration atom',()=>{
 assert.equal(run({TenantKey:'tenant-a',TargetNetwork:'Internal'},1).calls,0);
 assert.equal(run({TenantKey:'tenant-a',TargetNetwork:'Internal',Apply:true}).calls,0);
 assert.equal(run({TenantKey:'../bad',TargetNetwork:'Internal'}).calls,0);
});
test('inspection remains read-only and confirmed registration forwards only its allowlist',()=>{
 assert.equal(run({TenantKey:'tenant-a',TargetNetwork:'Internal'},9999,p=>{assert.equal(p.Apply,false);return {Code:1}}).value.Code,1);
 assert.equal(run({TenantKey:'tenant-a',TargetNetwork:'Internal',Apply:true,Confirm:'REGISTER:tenant-a:Internal',DbConn:'must-not-forward'},9999,p=>{
  assert.deepEqual(Object.keys(p).sort(),['Apply','TargetNetwork','TenantKey']);return {Code:1};
 }).value.Code,1);
});
test('SaaS package delivers the exact managed recovery endpoint',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./app.microi.saas-engine.json',import.meta.url),'utf8'));
 const e=p.SysApiEngines.find(e=>e.ApiEngineKey==='platform-tenant-runtime-registration');
 assert.ok(e);assert.equal(e.ApiV8Code.replace(/\r\n/g,'\n').trimEnd(),source.replace(/\r\n/g,'\n'));
 assert.equal(e.AllowAnonymous,0);assert.equal(e.EnableLog,0);
  assert.equal(p.ResourcePolicies.ApiEngines[e.ApiEngineKey].UpgradePolicy,'Managed');
});
test('personal center counts a tenant once across networks even on older backend binaries',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('./app.microi.saas-engine.json',import.meta.url),'utf8'));
 const e=p.SysApiEngines.find(e=>e.ApiEngineKey==='official_tenant_center');
 const rows=[{Id:'row-1',OsClient:'Tenant-A'},{Id:'row-2',OsClient:'tenant-a'},{Id:'row-3',OsClient:'tenant-b'}];
 const result=vm.runInNewContext('(function(){'+e.ApiV8Code+'})()', {V8:{CurrentUser:{Id:'owner'},
  Method:{GetUserTenants:()=>({Code:1,Data:{TenantDatabaseQuota:4,UsedQuota:3}})},
  FormEngine:{GetFormData:()=>({Code:1,Data:{Id:'owner'}})},
  Db:{FromSql:()=>({AddInParameter(){},ToArray:()=>rows})}}});
 assert.equal(result.Code,1);assert.equal(result.Data.TenantCount,2);assert.equal(result.Data.UsedQuota,2);
 assert.equal(result.Data.RemainingQuota,2);
});

test('legacy credential repair is confirmed, administrative, secret-free and delivered as Managed',()=>{
 const code=fs.readFileSync(new URL('./platform-tenant-admin-credential-repair.js',import.meta.url),'utf8').trimEnd();
 const execute=(p,level)=>{let calls=0;const result=vm.runInNewContext('(function(){'+code+'})()', {V8:{Param:p,CurrentUser:{Level:level},Method:{
  RepairOwnedTenantAdminPasswordEncoding(args){calls++;assert.deepEqual(Object.keys(args).sort(),['Apply','TenantKey']);return {Code:1,Data:{Changed:false}};}
 }}});return {result,calls};};
 assert.equal(execute({TenantKey:'tenant-a'},1).calls,0);
 assert.equal(execute({TenantKey:'tenant-a',Apply:true},9999).calls,0);
 assert.equal(execute({TenantKey:'tenant-a',Apply:true,Confirm:'REPAIR-ENCODING:tenant-a',Pwd:'must-not-forward'},9999).calls,1);
 const p=JSON.parse(fs.readFileSync(new URL('./app.microi.saas-engine.json',import.meta.url),'utf8'));
 const e=p.SysApiEngines.find(e=>e.ApiEngineKey==='platform-tenant-admin-credential-repair');
 assert.equal(e.ApiV8Code.replace(/\r\n/g,'\n').trimEnd(),code.replace(/\r\n/g,'\n'));assert.equal(e.AllowAnonymous,0);assert.equal(e.EnableLog,0);
 assert.equal(p.ResourcePolicies.ApiEngines[e.ApiEngineKey].UpgradePolicy,'Managed');
});

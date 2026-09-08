import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL(name,import.meta.url),'utf8');
function run(name,param,user={Id:'real-user',Name:'Real'}){
 let captured;
 const V8={Param:param,CurrentUser:user,OsClient:'tenant-a',Method:{
  RunPlatformApiRuntime(p){captured=p;return {Code:1,Data:'2026/09/08 12:34:56'};},
  AddSysLog(p){captured=p;return {Code:1};}
 },ApiEngine:{Run(){return {Code:1};}}};
 V8.Method.ManageSystemDirectory=p=>{captured=p;return {Code:1,Data:[]};};
 const result=vm.runInNewContext('(function(){'+read(name)+'})()',{V8});
 return {result,captured};
}
for(const path of ['/api/os/getDateTimeNow','/API/OS/GETDATETIMENOW','/api/Os/GetDateTimeNow--OsClient--tenant-a--?x=1']){
 test('legacy clock pins action: '+path,()=>{
  const r=run('platform-os-legacy-compatibility.js',{_RequestPath:path,Action:'GetHID',ApiAddress:'/evil'});
  assert.equal(r.result.Code,1);assert.equal(r.captured.Action,'GetDateTimeNow');assert.equal(r.captured.RuntimeKey,'LegacyOs');
 });
}
test('canonical OS URL preserves explicit action and rejects unknown actions',()=>{
 const r=run('platform-os-legacy-compatibility.js',{_RequestPath:'/apiengine/platform-os-legacy-compatibility',Action:'getdatetimenow'});
 assert.equal(r.captured.Action,'GetDateTimeNow');
 assert.equal(run('platform-os-legacy-compatibility.js',{Action:'Unknown'}).result.Code,0);
});
test('legacy client log takes actor from server and bounds payload',()=>{
 const r=run('platform-client-log.js',{title:' Test ',content:'x'.repeat(21000),UserId:'evil',OsClient:'evil',Source:'Audit'});
 assert.equal(r.result.Code,1);assert.equal(r.captured.UserId,'real-user');assert.equal(r.captured.OsClient,'tenant-a');
 assert.equal(r.captured.Category,'Legacy');assert.equal(r.captured.Action,'ClientLog');assert.equal(r.captured.Title,'Test');
 assert.equal(r.captured.Content.length,20001);
});
test('legacy log rejects anonymous calls and forged audit data',()=>{
 assert.equal(run('platform-client-log.js',{Title:'Test'},null).result.Code,1001);
 for(const p of [{Type:'用户登录'},{category:'Audit'},{Action:'Login'},{Title:''},{Title:'x'.repeat(501)}]){
  const r=run('platform-client-log.js',{Title:'Test',...p});assert.equal(r.result.Code,0);assert.equal(r.captured,undefined);
 }
});
for(const path of ['/api/SysMenu/GetSysMenuStep','/API/SYSMENU/GETSYSMENUMODEL','/api/sysmenu/getSysMenu--OsClient--tenant-a--?x=1']){
 test('legacy menu resolves path without Action and pins it over body: '+path,()=>{
  const expected=path.toLowerCase().includes('getsysmenustep')?'GetSysMenuStep':path.toLowerCase().includes('getsysmenumodel')?'GetSysMenuModel':'GetSysMenu';
  for(const Action of [undefined,'DelSysMenu']){
   const r=run('platform-sys-menu.js',{_RequestPath:path,Action});
   assert.equal(r.result.Code,1);assert.equal(r.captured.Action,expected);
  }
 });
}
test('menu canonical actions and anonymous rejection remain intact',()=>{
 const p={_RequestPath:'/apiengine/platform-sys-menu',Action:'getrolepermissiontree'};
 assert.equal(run('platform-sys-menu.js',p).captured.Action,'GetRolePermissionTree');
 assert.equal(run('platform-sys-menu.js',p,null).result.Code,1001);
 assert.equal(run('platform-sys-menu.js',{Action:'Unknown'}).result.Code,0);
});
test('SaaS package owns each compatibility engine exactly once with old aliases',()=>{
 const expected=[['platform-os-legacy-compatibility','/api/Os/GetDateTimeNow','platform-os-legacy-compatibility.js'],['platform-client-log','/api/SysLog/AddSysLog','platform-client-log.js']];
 const root=new URL('.',import.meta.url),packages=fs.readdirSync(root).filter(n=>/^app\..+\.json$/.test(n));
 for(const [key,route,file] of expected){
  const owners=packages.filter(n=>(JSON.parse(read(n)).SysApiEngines||[]).some(e=>e.ApiEngineKey===key));
  assert.deepEqual(owners,['app.microi.saas-engine.json']);
  const pkg=JSON.parse(read(owners[0])),engine=pkg.SysApiEngines.find(e=>e.ApiEngineKey===key);
  assert.ok(engine.ApiRoutes.split(';').some(x=>x.toLowerCase()===route.toLowerCase()));
  assert.equal(engine.ApiV8Code.replaceAll('\r\n','\n'),read(file).replaceAll('\r\n','\n'));
  assert.equal(pkg.ResourcePolicies.ApiEngines[key].UpgradePolicy,'Managed');
  assert.equal(engine.AllowAnonymous,key==='platform-client-log'?0:1);
 }
});

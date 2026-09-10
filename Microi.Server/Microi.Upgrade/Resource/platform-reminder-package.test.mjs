import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {validateOfficialPackageInstallContracts,validateOfficialPackageChangeLog} from './resource-sync-core.mjs';
const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
const message=read('app.microi.message-notification.json'),saas=read('app.microi.saas-engine.json');
const reminderTables=['mci_platform_reminder','mci_platform_reminder_batch','mci_platform_reminder_target','mci_platform_reminder_receipt'];
test('notification package delivers reminder schema, managed engines and one recoverable schedule',()=>{
 for(const name of reminderTables){assert.equal(message.DiyTables.filter(t=>t.Name===name).length,1);assert.ok(message.DDLStatements.some(d=>d.TableName===name));}
 for(const key of ['platform-reminder-runtime','platform-reminder-official-feed','platform-reminder-tick','platform-message-notification-config']){
  assert.equal(message.SysApiEngines.filter(e=>e.ApiEngineKey===key).length,1);
  assert.equal(message.ResourcePolicies.ApiEngines[key].UpgradePolicy,'Managed');
 }
 assert.equal(message.SysApiEngines.find(e=>e.ApiEngineKey==='platform-reminder-official-feed').AllowAnonymous,1);
 assert.equal(message.SysApiEngines.find(e=>e.ApiEngineKey==='platform-reminder-runtime').AllowAnonymous,0);
 assert.equal(message.SysApiEngines.find(e=>e.ApiEngineKey==='platform-reminder-tick').StopHttp,1);
 assert.equal(message.ScheduleJobs.filter(j=>j.JobName==='platform-reminder-tick').length,1);
 assert.equal(message.ScheduleJobs.find(j=>j.JobName==='platform-reminder-tick').CronExpression,'0 * * * * ?');
 const manifest=read('platform-reminder-manifest.json');
 for(const p of [message,saas]) for(const table of manifest.tables) for(const index of table.indexes||[]) {
  const ddl=p.DDLStatements.filter(d=>d.TableName===table.name&&d.DDL.includes('`'+index.name+'`'));
  assert.equal(ddl.length,1,index.name+' must survive export and reinstall');
  if(index.unique)assert.match(ddl[0].DDL,/CREATE UNIQUE INDEX/);
  for(const column of index.columns)assert.ok(ddl[0].DDL.includes('`'+column+'`'));
 }
 assert.doesNotMatch(JSON.stringify(message.DataSets),/Codex 平台提醒验收/);
 const originalConfig=message.DiyTables.find(t=>t.Name==='mic_msgset');assert.ok(originalConfig);
 assert.ok(message.DiyFields.some(f=>f.TableId===originalConfig.Id&&f.Name==='ConfigRevision'&&f.Type==='int'));
 for(const p of [message,saas]){const receipts=p.DiyTables.find(t=>t.Name==='mci_platform_reminder_receipt');assert.ok(p.DiyFields.some(f=>f.TableId===receipts.Id&&f.Name==='ShownAt'));}
 assert.ok(!saas.DiyTables.some(t=>t.Name==='mic_msgset'),'原业务配置仍由消息通知包单一维护');
});
test('official publication validates complete reminder ownership and rejects a missing engine',()=>{
 const source=readFileSync(new URL('official-resource-api.js',import.meta.url),'utf8');
 const validate=new Function('V8',source.slice(0,source.indexOf('var action ='))+'\nreturn validatePublishResource;')({Param:{}});
 assert.doesNotThrow(()=>validate('app.microi.message-notification.json',JSON.stringify(message)));
 const broken=structuredClone(message);broken.SysApiEngines=broken.SysApiEngines.filter(e=>e.ApiEngineKey!=='platform-reminder-tick');
 broken.PackageInfo.ApiEngineCount=broken.SysApiEngines.length;
 assert.throws(()=>validate('app.microi.message-notification.json',JSON.stringify(broken)),/唯一所有权闭包/);
 const missingConfig=structuredClone(message);missingConfig.SysApiEngines=missingConfig.SysApiEngines.filter(e=>e.ApiEngineKey!=='platform-message-notification-config');missingConfig.PackageInfo.ApiEngineCount=missingConfig.SysApiEngines.length;
 assert.throws(()=>validate('app.microi.message-notification.json',JSON.stringify(missingConfig)),/唯一所有权闭包/);
});
test('reminder configuration has one System Engine entry and retires all legacy SaaS entry points',()=>{
 const table=saas.DiyTables.find(t=>t.Name==='sys_osclients');
 assert(!saas.DiyFields.some(f=>f.TableId===table.Id&&f.Name==='PlatformReminders'));
 assert(!JSON.parse(table.Tabs).some(t=>t.Id==='mci-platform-reminder-tab'||t.Name==='系统提醒'));
 const menu=saas.SysMenus.find(m=>m.Url==='/osclients');
 for(const key of ['MoreBtns','PageBtns','BatchSelectMoreBtns','FormBtns','ExportMoreBtns'])assert.doesNotMatch(menu[key]||'',/platform-reminder-|platform-reminders|系统提醒/);
 const ddl=saas.DDLStatements.find(d=>d.TableName==='sys_osclients').DDL;
 assert(!ddl.includes('`PlatformReminders`'));
 for(const name of ['ApiEngineStreamMaxChunkKB','ApiEngineStreamMaxTotalMB','ApiEngineStreamHeartbeatSeconds'])assert.ok(ddl.includes('`'+name+'`'));
 assert.deepEqual(saas.DiyFieldRetirements.find(f=>f.Name==='PlatformReminders'),{TableName:'sys_osclients',Name:'PlatformReminders',ExpectedComponent:'DevComponent',ExpectedConfig:{DevComponentPath:'/platform/system-reminders'}});
 for(const p of [message,saas]){
  const entries=p.SysMenus.filter(m=>m.Url==='/micro-app/microi-platform-service/platform-reminders');
  assert.equal(entries.length,1);assert.equal(entries[0].Name,'消息通知');
  assert.equal(p.SysMenus.find(m=>m.Id===entries[0].ParentId)?.Name,'系统引擎');
  for(const legacy of p.SysMenus.filter(m=>m.Url==='/xiaoxitongzhisz')){assert.equal(Number(legacy.Display),0);assert.equal(Number(legacy.AppDisplay),0);}
 }
});
test('every declared platform-service package independently delivers the current reminder page',()=>{
 const contract=read('platform-service-release.json');assert.equal(contract.PackageTargets.length,4);
 const hashes=new Set();
 for(const file of contract.PackageTargets){
  const name=file.split('/').at(-1),p=read(name),text=JSON.stringify(p);
  validateOfficialPackageInstallContracts(name,text);validateOfficialPackageChangeLog(name,text);
  const bundles=p.ApplicationBundles.filter(b=>b.Application.AppKey==='microi-platform-service');assert.equal(bundles.length,1);
  const b=bundles[0];assert.equal(b.IncludeSource,false);assert.equal(b.SourceFiles.length,0);assert.ok(b.BuildAssets.length>0);
  assert.ok(b.Routes.some(r=>r.RoutePath==='/platform-reminders'));hashes.add(b.MicroService.DistHash);
 }
 assert.equal(hashes.size,1);
});

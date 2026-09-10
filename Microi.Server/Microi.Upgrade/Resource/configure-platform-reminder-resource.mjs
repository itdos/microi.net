import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';

// 输入固定来自官方 MCP 母版；只修改系统提醒拥有的资源，保留并行应用变更。
const input=process.argv.find(x=>x.startsWith('--mother='))?.slice(9);
if(!input)throw Error('需要 --mother=<通过 microi_itdos 导出的母版 JSON>');
const mother=JSON.parse(await readFile(resolve(input),'utf8'));
const dir=dirname(fileURLToPath(import.meta.url));
const names=['mci_platform_reminder','mci_platform_reminder_batch','mci_platform_reminder_target','mci_platform_reminder_receipt','mic_msgset'];
const key=x=>String(x||'').toLowerCase();
const tables=mother.DiyTables.filter(t=>names.includes(t.Name));assert.equal(tables.length,5);
const tableIds=new Set(tables.map(t=>key(t.Id)));
const fields=mother.DiyFields.filter(f=>tableIds.has(key(f.TableId))||names.includes(f.TableName));
const ddls=mother.DDLStatements.filter(d=>names.includes(d.TableName));assert.equal(ddls.length,5);
// 母版导出包含列但不包含索引；索引来自已在母版执行的 Manifest。
// 独立 CREATE INDEX 由商城导入器检查是否存在，兼容新安装和同版本重装。
const manifest=JSON.parse(await readFile(resolve(dir,'platform-reminder-manifest.json'),'utf8'));
for(const table of manifest.tables) for(const index of table.indexes||[]) {
  for(const value of [table.name,index.name,...index.columns]) assert.match(value,/^[A-Za-z0-9_]+$/);
  ddls.push({TableName:table.name,DDL:`CREATE ${index.unique?'UNIQUE ':''}INDEX \`${index.name}\` ON \`${table.name}\` (${index.columns.map(c=>'`'+c+'`').join(',')});`});
}
const columns=mother.PhysicalColumns.filter(c=>names.includes(c.TABLE_NAME));
const merge=(all,rows,identity)=>{const map=new Map(all.map(x=>[identity(x),x]));for(const row of rows)map.set(identity(row),row);return [...map.values()]};
const ddlIdentity=d=>key(d.TableName)+':'+key(d.DDL.match(/^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\s+`?([A-Za-z0-9_]+)/i)?.[1]||'table');
function addTables(p,includeMessageConfig=true){
 const selected=tables.filter(t=>includeMessageConfig||t.Name!=='mic_msgset'),ids=new Set(selected.map(t=>key(t.Id))),selectedNames=new Set(selected.map(t=>t.Name));
 p.DiyTables=merge(p.DiyTables,selected,t=>key(t.Name));
 p.DiyFields=merge(p.DiyFields,fields.filter(f=>ids.has(key(f.TableId))||selectedNames.has(f.TableName)),f=>key(f.Id));
 p.DDLStatements=merge(p.DDLStatements,ddls.filter(d=>selectedNames.has(d.TableName)),ddlIdentity);
 p.PhysicalColumns=merge(p.PhysicalColumns,columns.filter(c=>selectedNames.has(c.TABLE_NAME)),c=>key(c.TABLE_NAME)+':'+key(c.COLUMN_NAME));
}
function counts(p){const i=p.PackageInfo;i.MenuCount=p.SysMenus.length;i.TableCount=p.DiyTables.length;i.FieldCount=p.DiyFields.length;i.DDLCount=p.DDLStatements.length;i.PhysicalColumnCount=p.PhysicalColumns.length;i.ApiEngineCount=p.SysApiEngines.length;i.JobCount=(p.ScheduleJobs||[]).length}
const messagePath=resolve(dir,'app.microi.message-notification.json'),saasPath=resolve(dir,'app.microi.saas-engine.json');
const message=JSON.parse(await readFile(messagePath,'utf8')),saas=JSON.parse(await readFile(saasPath,'utf8'));
addTables(message);addTables(saas,false);
const reminderMenu=mother.SysMenus.find(m=>m.Url==='/micro-app/microi-platform-service/platform-reminders');assert.ok(reminderMenu);
assert.equal(reminderMenu.Name,'消息通知');
const engineRoot=mother.SysMenus.find(m=>m.Id===reminderMenu.ParentId);assert.equal(engineRoot?.Name,'系统引擎');
message.SysMenus=merge(message.SysMenus,[engineRoot],m=>key(m.Id));
saas.SysMenus=merge(saas.SysMenus,[engineRoot],m=>key(m.Id));
message.SysMenus=merge(message.SysMenus,[{...reminderMenu,MicroServiceKey:'microi-platform-service',MsKey:'microi-platform-service'}],m=>key(m.Id));
saas.SysMenus=merge(saas.SysMenus,[{...reminderMenu,MicroServiceKey:'microi-platform-service',MsKey:'microi-platform-service'}],m=>key(m.Id));
// 保留旧菜单身份与表引用，以便原字段关系继续可解析；导航只显示统一入口。
for(const p of [message,saas])for(const menu of p.SysMenus){
  if(menu.Url==='/xiaoxitongzhisz'){menu.Display=0;menu.AppDisplay=0;}
}
const saasMenu=mother.SysMenus.find(m=>m.Url==='/osclients');assert.ok(saasMenu);
// 提醒统一在系统引擎配置，不再向 SaaS 表单、行或工具栏投放入口。
const targetMenu=saas.SysMenus.find(m=>m.Id===saasMenu.Id);assert.ok(targetMenu);
for(const field of ['MoreBtns','PageBtns','BatchSelectMoreBtns','FormBtns','ExportMoreBtns']){
  const parse=value=>typeof value==='string'?JSON.parse(value||'[]'):(value||[]);
  assert(!parse(saasMenu[field]).some(b=>String(b.Id).startsWith('platform-reminder-')));
  targetMenu[field]=JSON.stringify(parse(targetMenu[field]).filter(b=>!String(b.Id).startsWith('platform-reminder-')).map(b=>{
    if(b.Id==='bulk-update-child-tenant-platform-apps-page-btn')return {...b,RunBackground:true};
    return b;
  }));
}
const sysTable=saas.DiyTables.find(t=>t.Name==='sys_osclients');
const parse=value=>typeof value==='string'?JSON.parse(value||'[]'):(value||[]);
sysTable.Tabs=JSON.stringify(parse(sysTable.Tabs).filter(t=>t.Id!=='mci-platform-reminder-tab'&&t.Name!=='系统提醒'));
saas.DiyFields=saas.DiyFields.filter(f=>!(key(f.TableId)===key(sysTable.Id)&&key(f.Name)==='platformreminders'));
saas.PhysicalColumns=saas.PhysicalColumns.filter(c=>!(key(c.TABLE_NAME)==='sys_osclients'&&key(c.COLUMN_NAME)==='platformreminders'));
// 旧安装只软删布局元数据，不删物理列或业务数据。当前包也不再为新安装创建该列。
saas.DiyFieldRetirements=merge(saas.DiyFieldRetirements||[],[{TableName:'sys_osclients',Name:'PlatformReminders',
  ExpectedComponent:'DevComponent',ExpectedConfig:{DevComponentPath:'/platform/system-reminders'}}],r=>key(r.TableName)+':'+key(r.Name));
const saasDdl=saas.DDLStatements.find(d=>d.TableName==='sys_osclients');
saasDdl.DDL=saasDdl.DDL.split(/\r?\n/).filter(line=>!/^\s*`PlatformReminders`\s/.test(line)).join('\n');
const engines=mother.SysApiEngines.filter(e=>e.ApiEngineKey.startsWith('platform-reminder-')||e.ApiEngineKey==='platform-message-notification-config');assert.equal(engines.length,4);
message.SysApiEngines=merge(message.SysApiEngines,engines,e=>key(e.ApiEngineKey));
for(const e of engines){
  message.ResourcePolicies.ApiEngines[e.ApiEngineKey]={Ownership:'Platform',UpgradePolicy:'Managed'};
  const marker='ApiEngine:'+e.ApiEngineKey;
  if(!message.PackageInfo.RequiredPlatformCapabilities.includes(marker))message.PackageInfo.RequiredPlatformCapabilities.push(marker);
}
message.ScheduleJobs=merge(message.ScheduleJobs||[],[{JobName:'platform-reminder-tick',JobType:'1',ApiEngineKey:'platform-reminder-tick',CronExpression:'0 * * * * ?',
 JobParam:'{}',JobDesc:'平台提醒每分钟唤醒在线收件箱；定时计算和回执以数据库为准。',CronDesc:'每分钟扫描',TimeZoneId:'UTC'}],j=>key(j.JobName));
message.PackageInfo.Description='统一消息通知：系统公告、邮件/短信/微信/平台内部业务通知与投递记录；保留原配置，支持 MCP、跨租户帐号范围及后端重启后首次登录提醒。需要平台接收协议 2。';
counts(message);counts(saas);
await writeFile(messagePath,JSON.stringify(message,null,2)+'\n');await writeFile(saasPath,JSON.stringify(saas,null,2)+'\n');
console.log(JSON.stringify({reminderTables:tables.length,fields:fields.length,engines:engines.length,scheduleJobs:message.ScheduleJobs.length,centralMenu:reminderMenu.Id,tenantEmbedRemoved:true}));

// 系统全局函数发行组装：输入必须来自官方 MCP 的 export-microi-store-package 回读，保留包内其它资源。
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dir=path.dirname(fileURLToPath(import.meta.url));
const input=process.argv[2];
const eventsDir=process.argv[3];
if(!input || !eventsDir) throw new Error('需要官方 MCP 导出的增量 JSON 和已回读的事件目录');
const incoming=JSON.parse(fs.readFileSync(input,'utf8'));
const child=incoming.DiyTables.find(t=>t.Name==='mci_global_function');
const parent=incoming.DiyTables.find(t=>t.Name.toLowerCase()==='sys_config');
if(!child || !parent || incoming.DataSets?.[0]?.Rows?.length!==6) throw new Error('官方导出未包含完整函数表与六条种子');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
const save=(n,p)=>fs.writeFileSync(path.join(dir,n),JSON.stringify(p,null,2)+'\n','utf8');
const merge=(target,rows,key)=>{for(const row of rows){const i=target.findIndex(x=>key(x)===key(row));if(i<0)target.push(row);else target[i]=row;}};
function release(p,version,title,content){
 const info=p.PackageInfo;info.Version=version;
 const line=`2026-09-06 ${version} ${content}`;
 if(!(info.ChangeHistory||'').startsWith(line))info.ChangeHistory=line+'\n'+(info.ChangeHistory||'');
 info.ChangeLog={Version:version,Title:title,ChangeType:'Fix',Content:content,ReleaseTime:'2026-09-06 12:30:00'};
 for(const [key,array] of [['TableCount','DiyTables'],['FieldCount','DiyFields'],['MenuCount','SysMenus'],['DDLCount','DDLStatements'],['PhysicalColumnCount','PhysicalColumns'],['DataSetCount','DataSets']])info[key]=(p[array]||[]).length;
 info.DataRowCount=(p.DataSets||[]).reduce((sum,x)=>sum+(x.Rows||[]).length,0);
}
const sys=read('app.microi.sys-config.json');
merge(sys.DiyTables,[child],x=>x.Id);
sys.DiyTables.find(x=>x.Name.toLowerCase()==='sys_config').Tabs=parent.Tabs;
merge(sys.DiyFields,incoming.DiyFields.filter(x=>x.TableId===child.Id||x.Name==='GlobalFunctions'),x=>x.Id);
merge(sys.SysMenus,incoming.SysMenus,x=>x.Id);
merge(sys.PhysicalColumns,incoming.PhysicalColumns.filter(x=>x.TABLE_NAME.toLowerCase()==='mci_global_function'||x.TABLE_NAME.toLowerCase()==='sys_config'&&x.COLUMN_NAME==='GlobalFunctions'),x=>`${x.TABLE_NAME.toLowerCase()}:${x.COLUMN_NAME.toLowerCase()}`);
merge(sys.DDLStatements,incoming.DDLStatements.filter(x=>x.TableName==='mci_global_function'),x=>x.TableName);
const parentDdl=sys.DDLStatements.find(x=>x.TableName.toLowerCase()==='sys_config');
if(!parentDdl.DDL.includes('`GlobalFunctions`'))parentDdl.DDL=parentDdl.DDL.replace(/\n\) ENGINE/,",\n  `GlobalFunctions` varchar(50) NULL COMMENT '全局函数'\n) ENGINE");
if(!sys.DDLStatements.some(x=>x.DDL.includes('ux_global_function_config_runtime_name')))
 sys.DDLStatements.push({TableName:child.Name,TableId:child.Id,DDL:'CREATE UNIQUE INDEX `ux_global_function_config_runtime_name` ON `mci_global_function` (`SysConfigId`,`Runtime`,`FunctionName`);'});
sys.DataSets=sys.DataSets||[];
const dataset=structuredClone(incoming.DataSets[0]);
dataset.ParentBinding={Field:'SysConfigId',TableName:'sys_config',MatchField:'IsEnable',MatchValue:1};
merge(sys.DataSets,[dataset],x=>x.TableName);
sys.PackageInfo.ServerMinVersion='8.1.11';
sys.PackageInfo.RequiredPlatformCapabilities=[...new Set([...(sys.PackageInfo.RequiredPlatformCapabilities||[]),'V8.Method.ValidateGlobalFunction','ServerFeature:SystemGlobalFunctionsV1','Importer:DataSetParentBindingV1'])];
release(sys,'v6.4.0','全局函数库与日期基础能力','新增系统设置全局函数子表及前后端 DateNow/DateFormat/DateAdd 六条幂等种子；按目标启用配置绑定外键，不覆盖已有全局代码或函数源码；运行时按租户缓存，真实提交后跨节点失效。需配套更新后端。');
save('app.microi.sys-config.json',sys);
for(const [file,version] of [['app.microi.form-engine.json','v7.7.2'],['app.microi.saas-engine.json','v8.1.0']]){
 const p=read(file);let api=p.DiyTables.find(x=>x.Name.toLowerCase()==='sys_apiengine');
 // 接口引擎属于核心引导表，旧包只带物理依赖、没有交付其事件。
 // 用官方实时回读的声明式事件补丁补齐，不改写现有布局或其它表级事件。
 if(!api){api=JSON.parse(fs.readFileSync(path.join(eventsDir,'official-api-events.json'),'utf8'));delete api._RawDescription;p.DiyTables.push(api);}
 for(const ev of ['SubmitBeforeServerV8','SubmitFormV8'])api[ev]=fs.readFileSync(path.join(eventsDir,'api-'+ev+'.js'),'utf8');
 // SaaS 空库模板与系统设置包共享父表，更新顺序不能把“全局函数”Tab 再覆盖掉。
 if(file==='app.microi.saas-engine.json')p.DiyTables.find(x=>x.Name.toLowerCase()==='sys_config').Tabs=parent.Tabs;
 release(p,version,'旧客户端接口引擎保存兼容','接口引擎修改历史子表的空字符串占位在前后端保存事件中规范为0，避免旧版客户端将空串写入 ChangeHistoryRows 整数列；保留现有路由校验、历史明细及业务代码。'+(file==='app.microi.saas-engine.json'?' 同步系统设置全局函数Tab，避免全部应用更新时被旧的空库模板覆盖。':''));
 save(file,p);
}
// 只同步本次变动的两个内嵌引擎，不把并行任务未发布的其它源码混进发行包。
const store=read('app.microi.store.json');
for(const [file,key] of [['import-package.js','import-microi-store-package'],['export-package.js','export-microi-store-package']]){
 const e=store.SysApiEngines.find(x=>x.ApiEngineKey===key);if(!e)throw new Error('商城缺少 '+key);
 e.ApiV8Code=fs.readFileSync(path.join(dir,file),'utf8');e.Version=e.ApiV8Code.match(/Version:\s*(v[\d.]+)/)[1];
}
release(store,'v8.2.1','升级物理列兼容与配置种子绑定','保留 MySQL BIT 布尔物理类型，整数显示宽度和注释差异不触发大表改列；仅默认值变化使用 ALTER COLUMN 并强回读，禁止 COPY 回退；新增配置子表种子 ParentBinding，仅绑定目标库唯一父记录并保持 InsertIfMissing。');
save('app.microi.store.json',store);
console.log('已更新四个发行包；未修改 .resource-sync-base，等待官方 CAS 发布和回读。');

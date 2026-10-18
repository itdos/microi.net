import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const directory=path.dirname(fileURLToPath(import.meta.url));
const check=process.argv.includes('--check');
if(process.argv.includes('--sync-base'))throw Error('共同基线仅由正式发布后回读推进。');
const source=JSON.parse(fs.readFileSync(path.join(directory,'framework-appearance-fields.json'),'utf8'));
const preferenceSource=fs.readFileSync(path.join(directory,'platform-user-update-preferences.js'),'utf8').replaceAll('\r\n','\n');
const preferenceVersion=preferenceSource.match(/Version:\s*(v[\d.]+)/)?.[1];
if(source.schema!==1||!preferenceVersion)throw Error('框架外观母版或接口版本无效。');
const releases={
  'module-engine':'数据表格更多功能改为简约入口，并支持模块级隐藏更多功能。',
  'sys-config':'补齐全局显示模式、界面密度、渐变/阴影/按钮图标开关、隐藏框架功能及四种登录界面风格；个人恢复默认继承系统。',
  'sys_user':'账号偏好支持全框架密度、视觉关闭开关与登录风格；恢复默认清除覆盖，后续系统调整继续生效。',
  'saas-engine':'新租户初始化包含完整框架主题默认字段及个人偏好字段；配置值继续由租户维护。',
};
const reports=[];
for(const [name,content] of Object.entries(releases)) {
  const filename=`app.microi.${name}.json`,file=path.join(directory,filename);
  const before=fs.readFileSync(file,'utf8'),model=JSON.parse(before);
  const tables=new Map(model.DiyTables.map(t=>[String(t.Name).toLowerCase(),t]));
  for(const original of source.fields) {
    const table=tables.get(original.TableName);
    if(!table)continue;
    // 元数据与物理定义来自已回读的官方母版；仅更新精确字段，保持其它资源和租户种子。
    const field={...original,TableId:table.Id,TableName:table.Name};
    const fieldIndex=model.DiyFields.findIndex(f=>f.TableId===table.Id&&f.Name===field.Name);
    if(fieldIndex<0)model.DiyFields.push(field);else model.DiyFields[fieldIndex]=field;
    const physical=source.columns.find(c=>c.TABLE_NAME.toLowerCase()===original.TableName&&c.COLUMN_NAME===field.Name);
    if(!physical)throw Error(`母版缺少物理列 ${original.TableName}.${field.Name}`);
    const column={...physical,TABLE_NAME:table.Name};
    const columnIndex=model.PhysicalColumns.findIndex(c=>c.TABLE_NAME.toLowerCase()===original.TableName&&c.COLUMN_NAME===field.Name);
    if(columnIndex<0)model.PhysicalColumns.push(column);else model.PhysicalColumns[columnIndex]=column;
    const ddl=model.DDLStatements.find(d=>d.TableName.toLowerCase()===original.TableName&&/^CREATE TABLE/i.test(d.DDL));
    if(!ddl)throw Error(`责任包缺少建表DDL ${original.TableName}`);
    const definition=source.columnDdl[original.TableName+'.'+field.Name];
    if(!definition)throw Error('官方母版未导出列定义。');
    if(!ddl.DDL.includes('`'+field.Name+'` ')) {
      const closing=ddl.DDL.lastIndexOf('\n)');
      if(closing<0)throw Error('不识别的官方建表DDL形状。');
      ddl.DDL=ddl.DDL.slice(0,closing)+',\n  '+definition+ddl.DDL.slice(closing);
    }
  }
  if(name==='sys_user') {
    const engines=model.SysApiEngines.filter(e=>e.ApiEngineKey==='platform-user-update-preferences');
    if(engines.length!==1)throw Error('系统账号必须唯一拥有个人偏好接口。');
    engines[0].ApiV8Code=preferenceSource;engines[0].Version=preferenceVersion;
    const capabilities=model.PackageInfo.RequiredPlatformCapabilities||[];
    model.PackageInfo.RequiredPlatformCapabilities=capabilities.map(c=>String(c).startsWith('ApiEngine:platform-user-update-preferences@')?'ApiEngine:platform-user-update-preferences@'+preferenceVersion:c);
  }
  const counts={MenuCount:'SysMenus',TableCount:'DiyTables',FieldCount:'DiyFields',DDLCount:'DDLStatements',PhysicalColumnCount:'PhysicalColumns',ApiEngineCount:'SysApiEngines'};
  for(const [count,key] of Object.entries(counts))model.PackageInfo[count]=(model[key]||[]).length;
  const changed=JSON.stringify(model)!==JSON.stringify(JSON.parse(before));
  if(changed&&check)throw Error(filename+' 尚未同步框架外观母版。');
  if(changed) {
    // 同一尚未发布的配置生成批次只升版一次；修订母版回读不制造连续空版本。
    const currentLog=model.PackageInfo.ChangeLog;
    const sameBatch=currentLog?.Title==='框架主题与登录体验完善'&&currentLog?.Content===content&&currentLog?.ReleaseTime==='2026-10-16 17:15:00';
    const parts=String(model.PackageInfo.Version).replace(/^v/,'').split('.').map(Number);
    if(!sameBatch)parts[parts.length-1]++;
    const version='v'+parts.join('.');model.PackageInfo.Version=version;
    if(!sameBatch)model.PackageInfo.ChangeHistory=`2026-10-16 ${version} ${content}\n${model.PackageInfo.ChangeHistory||''}`;
    model.PackageInfo.ChangeLog={Version:version,Title:'框架主题与登录体验完善',ChangeType:'Feature',Content:content,ReleaseTime:'2026-10-16 17:15:00'};
    fs.writeFileSync(file,JSON.stringify(model,null,2)+'\n');
  }
  reports.push({file:filename,changed,version:model.PackageInfo.Version});
}
console.log(JSON.stringify({check,reports},null,2));

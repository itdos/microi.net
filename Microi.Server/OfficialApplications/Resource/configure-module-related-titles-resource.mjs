import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const directory=path.dirname(fileURLToPath(import.meta.url));
const source=JSON.parse(fs.readFileSync(path.join(directory,'framework-appearance-fields.json'),'utf8'));
export const relatedTitleNames=['DataLogTitle','DataCommentTitle','DataVersionTitle'];

// 三列来自官方元数据回读；共用 sys_menu 快照必须一致，字段控件仅归模块引擎母版。
export function configureModuleRelatedTitles(model) {
  if(!(model.PhysicalColumns||[]).some(c=>c.TABLE_NAME.toLowerCase()==='sys_menu'))return false;
  const before=JSON.stringify(model);
  const table=(model.DiyTables||[]).find(t=>t.Name.toLowerCase()==='sys_menu');
  for(const name of relatedTitleNames) {
    const original=source.fields.find(f=>f.TableName==='sys_menu'&&f.Name===name);
    const column=source.columns.find(c=>c.TABLE_NAME==='sys_menu'&&c.COLUMN_NAME===name);
    if(!original||!column)throw Error('官方模块标签母版缺失 '+name);
    const existing=model.PhysicalColumns.findIndex(c=>c.TABLE_NAME.toLowerCase()==='sys_menu'&&c.COLUMN_NAME===name);
    if(existing<0)model.PhysicalColumns.push({...column});else model.PhysicalColumns[existing]={...column};
    if(table) {
      const field={...original,TableId:table.Id,TableName:table.Name};
      const i=model.DiyFields.findIndex(f=>f.TableId===table.Id&&f.Name===name);
      if(i<0)model.DiyFields.push(field);else model.DiyFields[i]=field;
    }
    for(const ddl of (model.DDLStatements||[]).filter(d=>d.TableName.toLowerCase()==='sys_menu'&&/^CREATE TABLE/i.test(d.DDL))) {
      if(ddl.DDL.includes('`'+name+'` '))continue;
      const end=ddl.DDL.lastIndexOf('\n)');if(end<0)throw Error('不识别 sys_menu DDL');
      ddl.DDL=ddl.DDL.slice(0,end)+',\n  '+source.columnDdl['sys_menu.'+name]+ddl.DDL.slice(end);
    }
  }
  if(model.PackageInfo) {
    model.PackageInfo.FieldCount=(model.DiyFields||[]).length;
    model.PackageInfo.PhysicalColumnCount=model.PhysicalColumns.length;
  }
  return before!==JSON.stringify(model);
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const check=process.argv.includes('--check'),changed=[];
  for(const filename of fs.readdirSync(directory).filter(n=>n.endsWith('.json'))) {
    const file=path.join(directory,filename),model=JSON.parse(fs.readFileSync(file,'utf8'));
    if(!configureModuleRelatedTitles(model))continue;
    changed.push(filename);if(!check)fs.writeFileSync(file,JSON.stringify(model,null,2)+'\n');
  }
  console.log(JSON.stringify({check,changed}));if(check&&changed.length)process.exitCode=1;
}

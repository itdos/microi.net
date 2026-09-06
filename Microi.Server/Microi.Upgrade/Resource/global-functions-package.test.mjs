import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>JSON.parse(fs.readFileSync(new URL(name,import.meta.url),'utf8'));
const settings=read('./app.microi.sys-config.json'),saas=read('./app.microi.saas-engine.json');
const table=packageData=>packageData.DiyTables.find(x=>x.Name.toLowerCase()==='sys_config');
test('系统设置和 SaaS 空库模板的全局函数 Tab 一致，不受应用安装顺序影响',()=>{
 const tab=JSON.parse(table(settings).Tabs).find(x=>x.Id==='system-global-functions');
 assert.ok(tab);
 assert.deepEqual(JSON.parse(table(saas).Tabs).find(x=>x.Id===tab.Id),tab);
 const field=settings.DiyFields.find(x=>x.Name==='GlobalFunctions');
 assert.equal(field.Tab,tab.Id);
 const child=settings.DiyTables.find(x=>x.Name==='mci_global_function');
 assert.equal(JSON.parse(field.Config).TableChildTableId,child.Id);
 assert.ok(settings.SysMenus.some(x=>x.DiyTableId===child.Id));
});
test('全局函数种子是六条可执行的单函数，不覆盖租户既有函数或全局设置值',()=>{
 const data=settings.DataSets.find(x=>x.TableName==='mci_global_function');
 assert.equal(data.ConflictPolicy,'InsertIfMissing');
 assert.deepEqual(data.ConflictFields,['SysConfigId','Runtime','FunctionName']);
 assert.equal(data.ParentBinding.TableName,'sys_config');
 assert.equal(data.Rows.length,6);
 for(const runtime of ['Client','Server']){
  const rows=data.Rows.filter(x=>x.Runtime===runtime);
  assert.deepEqual(rows.map(x=>x.FunctionName).sort(),['DateAdd','DateFormat','DateNow']);
  const context={};vm.createContext(context);
  for(const row of rows){const code=row.Code.startsWith('function')?row.Code:Buffer.from(row.Code,'base64').toString();vm.runInContext(code,context);}
  assert.equal(context.DateAdd('2024-01-31T00:00:00','M',1,'yyyy-MM-dd'),'2024-02-29');
  assert.match(context.DateNow(),/^\d{4}-\d{2}-\d{2} /);
 }
 assert.ok(settings.DDLStatements.some(x=>x.DDL.includes('ux_global_function_config_runtime_name')));
});

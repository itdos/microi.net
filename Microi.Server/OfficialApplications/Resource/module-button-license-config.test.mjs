import fs from 'node:fs';import test from 'node:test';import assert from 'node:assert/strict';
const read=name=>JSON.parse(fs.readFileSync(new URL(`app.microi.${name}.json`,import.meta.url),'utf8'));
test('模块应用交付导入导出条件和代码显示配置，SaaS 不混入无主表的字段',()=>{
 assert.equal(read('saas-engine').DiyFields.filter(f=>f.TableId==='1d28e502-70ea-4a2b-9793-699b3f42234e').length,0);
 for(const pkg of [read('module-engine')]){
  for(const name of ['ImportCodeShowV8','ExportCodeShowV8']){
   const f=pkg.DiyFields.find(f=>f.Name===name&&f.TableId==='1d28e502-70ea-4a2b-9793-699b3f42234e');assert.ok(f);
   assert.equal(f.Component,'CodeEditor');assert.equal(f.Visible,1);assert.equal(f.Tab,'01KGA478B18MCNQRBDWGX548DE');
   assert.equal(JSON.parse(f.Config).CodeEditor.DisplayMode,'Dialog');
   assert.ok(pkg.PhysicalColumns.some(c=>c.TABLE_NAME.toLowerCase()==='sys_menu'&&c.COLUMN_NAME===name));
   assert.ok(pkg.DDLStatements.find(d=>d.TableName.toLowerCase()==='sys_menu').DDL.includes('`'+name+'`'));
  }
  for(const name of ['AddCodeShowV8','EditCodeShowV8','DelCodeShowV8','DetailPageV8'])assert.equal(JSON.parse(pkg.DiyFields.find(f=>f.Name===name).Config).CodeEditor.DisplayMode,'Dialog');
 }
});
test('授权版本隐藏开关可配置且默认关闭，基础包不改变现有租户设置值',()=>{
 for(const pkg of [read('sys-config'),read('saas-engine')]){
  const f=pkg.DiyFields.find(f=>f.Name==='HideSystemLicenseVersion');assert.ok(f);assert.equal(String(f.DefaultValue),'0');assert.equal(f.Component,'Switch');
  const c=pkg.PhysicalColumns.find(c=>c.COLUMN_NAME===f.Name);assert.equal(c.IS_NULLABLE,'YES');
  assert.ok(pkg.DDLStatements.find(d=>d.TableName.toLowerCase()==='sys_config').DDL.includes('`'+f.Name+'`'));
 }
});

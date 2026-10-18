import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
const dir=new URL('.',import.meta.url);
const definition=JSON.parse(fs.readFileSync(new URL('framework-appearance-fields.json',dir),'utf8'));
const read=name=>JSON.parse(fs.readFileSync(new URL(`app.microi.${name}.json`,dir),'utf8'));
const expectedFields=[
  'sys_user.LoginStyle','sys_user.DisableButtonIcon','sys_user.DisableShadow','sys_user.DisableGradient','sys_user.UiDensityScale',
  'sys_user.NavigationLayout','sys_user.ThemeMode','sys_user.SidebarWidth','sys_user.RoleTreeWidth','sys_user.SidebarCollapsed','sys_user.RoleTreeCollapsed',
  'sys_config.LoginStyle','sys_config.HideFrameworkFunctions','sys_config.DisableButtonIcon','sys_config.DisableShadow',
  'sys_config.DisableGradient','sys_config.UiDensityScale','sys_config.ThemeMode','sys_config.NavigationLayout',
  'sys_menu.HideMoreFunctions','sys_menu.DataCommentTitle','sys_menu.DataLogTitle','sys_menu.DataVersionTitle',
];
test('official mother definitions cover all settings without business defaults',()=>{
  const fieldKeys=definition.fields.map(f=>f.TableName+'.'+f.Name);
  const columnKeys=definition.columns.map(c=>c.TABLE_NAME.toLowerCase()+'.'+c.COLUMN_NAME);
  assert.equal(definition.fields.length,23);assert.equal(definition.columns.length,23);
  assert.equal(new Set(fieldKeys).size,23);assert.equal(new Set(columnKeys).size,23);
  assert.deepEqual(fieldKeys.sort(),[...expectedFields].sort());
  assert.deepEqual(columnKeys.sort(),[...expectedFields].sort());
  assert.match(definition.snapshotSha256,/^[a-f0-9]{64}$/);
  const hidden=definition.fields.find(f=>f.Name==='HideFrameworkFunctions');
  assert.equal(hidden.Component,'Checkbox');
  assert.deepEqual(JSON.parse(hidden.Data).map(x=>x.Key),['Chat','BackgroundTasks','Search','Language','Theme','AI','Bluetooth','SystemStyle','FullScreen']);
  assert.equal(definition.fields.find(f=>f.TableName==='sys_user'&&f.Name==='ThemeMode').DefaultValue,'System');
  for(const [name,component] of [['SidebarWidth','NumberText'],['RoleTreeWidth','NumberText'],['SidebarCollapsed','Switch'],['RoleTreeCollapsed','Switch']]) {
    const field=definition.fields.find(f=>f.TableName==='sys_user'&&f.Name===name);
    assert.equal(field.Component,component);assert.equal(field.DefaultValue,'');
    assert.ok(field.FormWidth==null,`sys_user.${name} must use automatic field width`);
  }
  for(const name of ['DataCommentTitle','DataLogTitle','DataVersionTitle']) {
    const field=definition.fields.find(f=>f.TableName==='sys_menu'&&f.Name===name);
    assert.equal(field.Component,'Text');assert.equal(field.DefaultValue,undefined);
    assert.ok(field.FormWidth==null,`sys_menu.${name} must use automatic field width`);
  }
});
test('new and existing tenants get each appearance field from the responsible packages',()=>{
  for(const name of ['module-engine','sys-config','sys_user','saas-engine']) {
    const pkg=read(name),tables=new Map(pkg.DiyTables.map(t=>[t.Name.toLowerCase(),t]));
    for(const field of definition.fields) {
      const table=tables.get(field.TableName);if(!table)continue;
      const matches=pkg.DiyFields.filter(f=>f.TableId===table.Id&&f.Name===field.Name);
      assert.equal(matches.length,1,`${name}.${field.Name}`);
      assert.equal(matches[0].Id,field.Id);assert.equal(matches[0].Component,field.Component);
      const columns=pkg.PhysicalColumns.filter(c=>c.TABLE_NAME.toLowerCase()===field.TableName&&c.COLUMN_NAME===field.Name);
      assert.equal(columns.length,1);assert.equal(columns[0].IS_NULLABLE,'YES');
      const ddl=pkg.DDLStatements.find(d=>d.TableName.toLowerCase()===field.TableName&&/^CREATE TABLE/.test(d.DDL));
      assert.ok(ddl.DDL.includes('`'+field.Name+'` '));
      assert.equal(matches[0].FormWidth,field.FormWidth,`${name}.${field.Name} must preserve the mother width`);
      assert.ok(matches[0].FormWidth==null,`${name}.${field.Name} must use automatic field width`);
    }
  }
});
test('appearance generation is idempotent and check cannot update the shared sync base',()=>{
  const result=JSON.parse(execFileSync(process.execPath,[new URL('configure-framework-appearance-resource.mjs',dir).pathname.replace(/^\/([A-Za-z]:)/,'$1'),'--check'],{encoding:'utf8'}));
  assert.ok(result.reports.every(r=>r.changed===false));
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
const dir=new URL('.',import.meta.url);
const definition=JSON.parse(fs.readFileSync(new URL('framework-appearance-fields.json',dir),'utf8'));
const read=name=>JSON.parse(fs.readFileSync(new URL(`app.microi.${name}.json`,dir),'utf8'));
test('official mother definitions cover all settings without business defaults',()=>{
  assert.equal(definition.fields.length,16);assert.equal(definition.columns.length,16);
  assert.match(definition.snapshotSha256,/^[a-f0-9]{64}$/);
  const hidden=definition.fields.find(f=>f.Name==='HideFrameworkFunctions');
  assert.equal(hidden.Component,'Checkbox');
  assert.deepEqual(JSON.parse(hidden.Data).map(x=>x.Key),['Chat','BackgroundTasks','Search','Language','Theme','AI','Bluetooth','SystemStyle','FullScreen']);
  assert.equal(definition.fields.find(f=>f.TableName==='sys_user'&&f.Name==='ThemeMode').DefaultValue,'System');
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
      assert.equal(matches[0].FormWidth,undefined);
    }
  }
});
test('appearance generation is idempotent and check cannot update the shared sync base',()=>{
  const result=JSON.parse(execFileSync(process.execPath,[new URL('configure-framework-appearance-resource.mjs',dir).pathname.replace(/^\/([A-Za-z]:)/,'$1'),'--check'],{encoding:'utf8'}));
  assert.ok(result.reports.every(r=>r.changed===false));
});

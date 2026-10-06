import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=new URL('./',import.meta.url);
test('comments declare parent binding and indexed primary reads without changing scheduler history policy',()=>{
  const p=JSON.parse(fs.readFileSync(new URL('app.microi.form-engine.json',source),'utf8'));
  const table=p.DiyTables.find(x=>x.Name==='diy_comment');
  assert.equal(table.ReadPrimary,1);
  assert.ok(p.DiyFields.some(x=>x.TableId===table.Id&&x.Name==='ParentTableId'&&x.Type==='varchar(36)'));
  assert.ok(p.PhysicalColumns.some(x=>x.TABLE_NAME==='diy_comment'&&x.COLUMN_NAME==='ParentTableId'&&x.IS_NULLABLE==='YES'));
  assert.ok(p.DDLStatements.some(x=>x.DDL==='CREATE INDEX `ix_diy_comment_parent_row_time` ON `diy_comment` (`ParentTableId`,`TableRowId`,`CreateTime`);'));
  assert.ok(p.DDLStatements.some(x=>x.DDL==='CREATE INDEX `ix_mic_data_version_table_row_time` ON `mic_data_version` (`TableId`,`TableRowId`,`CreateTime`);'));
  assert.equal(p.PackageInfo.FieldCount,p.DiyFields.length);
  assert.equal(p.PackageInfo.DDLCount,p.DDLStatements.length);
});

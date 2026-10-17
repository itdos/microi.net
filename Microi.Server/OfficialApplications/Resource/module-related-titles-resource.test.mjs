import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {configureModuleRelatedTitles,relatedTitleNames} from './configure-module-related-titles-resource.mjs';
const directory=new URL('./',import.meta.url);
test('every shared menu snapshot carries the exact nullable physical title columns',()=>{
  let snapshots=0;
  for(const file of fs.readdirSync(directory).filter(n=>n.endsWith('.json'))) {
    const resource=JSON.parse(fs.readFileSync(new URL(file,directory),'utf8'));
    if(!(resource.PhysicalColumns||[]).some(c=>c.TABLE_NAME.toLowerCase()==='sys_menu'))continue;
    snapshots++;
    for(const name of relatedTitleNames) {
      const columns=resource.PhysicalColumns.filter(c=>c.TABLE_NAME.toLowerCase()==='sys_menu'&&c.COLUMN_NAME===name);
      assert.equal(columns.length,1,file+':'+name);assert.equal(columns[0].COLUMN_TYPE,'varchar(100)');assert.equal(columns[0].IS_NULLABLE,'YES');assert.equal(columns[0].COLUMN_DEFAULT,null);
    }
    assert.equal(configureModuleRelatedTitles(resource),false,file+' generator drift');
  }
  assert.ok(snapshots>=11);
});
test('module title controls use actual official identities and leave user values unseeded',()=>{
  const model=JSON.parse(fs.readFileSync(new URL('app.microi.module-engine.json',directory),'utf8'));
  const ids={DataCommentTitle:'01M54TM1DS2GA1Q3JCTP3HRZKP',DataLogTitle:'01M54TM42P747Z14H2M30KA3E2',DataVersionTitle:'01M54TM82008V9KR7ZDTZ2FEQC'};
  for(const name of relatedTitleNames) {
    const fields=model.DiyFields.filter(f=>f.Name===name);assert.equal(fields.length,1);
    const f=fields[0];assert.equal(f.Id,ids[name]);assert.equal(f.Component,'Text');assert.equal(f.Tab,'01KGA478B1CH5KJKZKWMGGPH4C');assert.equal(f.FormWidth,null);assert.equal(f.Config,'{}');assert.equal(f.Visible,1);assert.equal(f.AppVisible,1);
    assert.match(model.DDLStatements.find(d=>d.TableName.toLowerCase()==='sys_menu').DDL,new RegExp('`'+name+'` varchar\\(100\\) NULL'));
    assert.ok(model.SysMenus.every(m=>!Object.hasOwn(m,name)),'不写入租户模块标题种子');
  }
});

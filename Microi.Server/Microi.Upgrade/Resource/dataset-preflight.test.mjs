import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source=fs.readFileSync(new URL('./import-package.js',import.meta.url),'utf8');
const helper=source.match(/var validateDataSetTablePrerequisites = function \(\) \{[\s\S]*?\n    \};/)[0];
function fixture(dialect, exists, declared=false) {
  const calls=[];
  const context={
    Package:{DataSets:[{TableName:'microi_icon',Rows:[]}],
      DiyTables:declared?[{Name:'microi_icon'}]:[],
      DDLStatements:declared?[{TableName:'microi_icon',DDL:'CREATE TABLE IF NOT EXISTS `microi_icon` (`Id` varchar(36))'}]:[]},
    runtimeIsSqlServer:dialect==='SqlServer',runtimeIsOracle:dialect==='Oracle',
    V8:{Db:{FromSql(sql){const call={sql};calls.push(call);return {
      AddInParameter(key,value){call[key]=value;return this;},ToArray(){return exists?[{TABLE_NAME:'microi_icon'}]:[];}
    };}}}
  };
  vm.runInNewContext(helper,context);
  return {run:context.validateDataSetTablePrerequisites,calls,context};
}
for (const dialect of ['MySql','SqlServer','Oracle']) {
  test(`missing dataset table fails before writes on ${dialect}`,()=>{
    const f=fixture(dialect,false);
    assert.throws(f.run,/数据集依赖预检失败.*microi_icon/);
    assert.equal(f.calls.length,1);
    assert.match(f.calls[0].sql,/^SELECT /);
    assert.equal(f.calls[0]['@p0'],'microi_icon');
    assert.match(f.calls[0].sql,dialect==='SqlServer'?/DB_NAME\(\)/:dialect==='Oracle'?/USER_TABLES/:/DATABASE\(\)/);
  });
}
test('complete package declares the table without querying or writing tenant data',()=>{
  const f=fixture('MySql',false,true);assert.doesNotThrow(f.run);assert.equal(f.calls.length,0);
});
test('old packages may reuse an already installed dependency without recreating it',()=>{
  const f=fixture('MySql',true);assert.doesNotThrow(f.run);assert.equal(f.calls.length,1);
});
test('unsafe dataset table identifiers are rejected without SQL execution',()=>{
  const f=fixture('MySql',true);f.context.Package.DataSets[0].TableName='icons; DELETE FROM users';
  assert.throws(f.run,/目标表名无效/);assert.equal(f.calls.length,0);
});

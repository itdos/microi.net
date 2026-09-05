import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./import-package.js',import.meta.url),'utf8');
const helper=source.match(/var repairDeclaredLegacyIdentifierStorage = function[\s\S]*?(?=\s*var ddlTablesChecked)/)[0];
function fixture(options={}) {
  const columns={id:{COLUMN_NAME:'Id',COLUMN_TYPE:'char(36)'},parentid:{COLUMN_NAME:'ParentId',COLUMN_TYPE:'char(36)'},businesscode:{COLUMN_NAME:'BusinessCode',COLUMN_TYPE:'char(36)'},customid:{COLUMN_NAME:'CustomId',COLUMN_TYPE:'char(36)'}};
  const statements=[];
  const original="CREATE TABLE `runtime` (\n  `Id` char(36) COLLATE utf8mb4_bin NOT NULL COMMENT 'keep,id',\n  `ParentId` char(36) DEFAULT '',\n  `BusinessCode` char(36) DEFAULT NULL,\n  `CustomId` char(36) DEFAULT NULL,\n  PRIMARY KEY (`Id`)\n) ENGINE=InnoDB";
  const scope={runtimeIsSqlServer:!!options.sqlServer,runtimeIsOracle:!!options.oracle,Package:{DiyTables:options.unowned?[]:[{Name:'runtime'}]},isSafeIdentifier:x=>/^[A-Za-z_][A-Za-z0-9_]*$/.test(x),getTargetPhysicalColumns:()=>structuredClone(columns),normalizeSqlType:x=>x.toLowerCase(),quotePhysicalIdentifier:x=>'`'+x+'`',getPhysicalValue:(x,keys)=>keys.map(k=>x?.[k]).find(v=>v!==undefined),debugLog:{},V8:{Db:{FromSql(sql){if(sql.startsWith('SELECT COUNT(*) AS ForeignKeyCount'))return{AddInParameter(){return this;},ToArray:()=>[{ForeignKeyCount:options.foreignKeys?1:0}]};if(sql.startsWith('SHOW'))return{ToArray:()=>[{'Create Table':options.invalidDdl?'broken':original}]}; statements.push(sql);return{ExecuteNonQuery(){if(options.writeError)throw new Error('DDL denied');if(!options.dropWrite){columns.id.COLUMN_TYPE='varchar(36)';columns.parentid.COLUMN_TYPE='varchar(50)';}return 1;}};}}}};
  if(options.foreignKeys&&!options.nativeMissing)scope.V8.Db.WidenMySqlIdentifierColumns=(table,specifications)=>{statements.push('NATIVE '+table+' '+specifications);columns.id.COLUMN_TYPE='varchar(36)';columns.parentid.COLUMN_TYPE='varchar(50)';return 2;};
  vm.runInNewContext(helper+'\nrun=repairDeclaredLegacyIdentifierStorage;',scope);
  const ddl={TableName:'runtime',DDL:'CREATE TABLE IF NOT EXISTS `runtime` (`Id` varchar(36),`ParentId` varchar(50),`BusinessCode` varchar(50),`CustomId` varchar(20))'};
  return{run:()=>scope.run(ddl),statements,columns};
}
test('declared identifier widening preserves defaults collation comments and key definition; replay is a no-op',()=>{
  const f=fixture();assert.equal(f.run(),2);
  assert.equal(f.statements.length,1);
  assert.match(f.statements[0],/`Id` varchar\(36\) COLLATE utf8mb4_bin NOT NULL COMMENT 'keep,id'/);
  assert.match(f.statements[0],/`ParentId` varchar\(50\) DEFAULT ''/);
  assert.doesNotMatch(f.statements[0],/BusinessCode|CustomId|PRIMARY|DROP|DELETE/);
  assert.equal(f.run(),0);assert.equal(f.statements.length,1);
  assert.equal(f.columns.businesscode.COLUMN_TYPE,'char(36)');
  assert.equal(f.columns.customid.COLUMN_TYPE,'char(36)');
});
test('identifier bootstrap refuses uncertain schema or failed readback, and leaves other providers/unowned tables alone',()=>{
  for(const options of [{sqlServer:true},{oracle:true},{unowned:true}]){const f=fixture(options);assert.equal(f.run(),0);assert.equal(f.statements.length,0);}
  assert.throws(()=>fixture({invalidDdl:true}).run(),/无法保留原始定义/);
  assert.throws(()=>fixture({writeError:true}).run(),/DDL denied/);
  assert.throws(()=>fixture({dropWrite:true}).run(),/回读失败/);
});
test('application lookup does not turn provider/read failures into missing rows or duplicate inserts',()=>{
  const lookup=source.match(/var getApplicationRow = function[\s\S]*?(?=\s*var upsertApplicationRow)/)[0];
  for(const result of [{Code:0,Msg:'Unrecognized Guid format'},{Code:0,Msg:'replica connection failed'},null]){
    const context={V8:{FormEngine:{GetFormData:()=>result}}};vm.runInNewContext(lookup+'\nrun=getApplicationRow;',context);
    assert.throws(()=>context.run('sys_microiservice','x',[['MsKey','=','app']]),/读取应用资源失败/);
    assert.throws(()=>context.run('sys_microiservice','',[['MsKey','=','app']]),/读取应用资源失败/);
  }
});

test('foreign key identifiers use the isolated backend method and refuse unsupported backends before DDL',()=>{
 const f=fixture({foreignKeys:true});assert.equal(f.run(),2);assert.equal(f.statements.length,1);assert.match(f.statements[0],/^NATIVE runtime /);assert.equal(f.run(),0);
 const old=fixture({foreignKeys:true,nativeMissing:true});assert.throws(()=>old.run(),/先升级平台框架/);assert.equal(old.statements.length,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(process.env.MICROI_IMPORTER_TEST_SOURCE || new URL('./import-package.js',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const extract=name=>{const start=source.indexOf('    var '+name+' = function');assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n    };',start)+7);};
function context(sqlServer=false){
 const c={runtimeIsSqlServer:sqlServer,isSafeIdentifier:n=>/^[\w]+$/.test(n),getPhysicalValue:(r,keys)=>keys.map(k=>r[k]).find(v=>v!=null),mapToMySQLType:t=>t,
  quotePhysicalIdentifier:n=>sqlServer?'['+n+']':'`'+n+'`',sqlString:s=>s.replaceAll("'","''")};
 vm.runInNewContext(['mysqlCurrentTimestampDefault','physicalColumnRequiresNotNull','buildPhysicalColumnDefinition'].map(extract).join('\n'),c);return c;
}
test('package columns retain non-Id/composite primary keys and identity while ordinary required columns allow NULL',()=>{
 for(const server of [false,true]){
  const c=context(server);
  for(const metadata of [{COLUMN_KEY:'PRI'},{ColumnKey:'PRI'},{EXTRA:'auto_increment'},{IS_IDENTITY:1},{IsIdentity:true}]){
   const definition=c.buildPhysicalColumnDefinition({COLUMN_NAME:'i_id',COLUMN_TYPE:'int',IS_NULLABLE:'NO',...metadata},false);
   assert.match(definition,/ int NOT NULL/);assert.doesNotMatch(definition,/PRIMARY KEY/,'sync must not recreate a primary key');
  }
  assert.match(c.buildPhysicalColumnDefinition({COLUMN_NAME:'RequiredBusinessValue',COLUMN_TYPE:'int',IS_NULLABLE:'NO',COLUMN_DEFAULT:0},false),/ int NULL DEFAULT '0'/);
  assert.match(c.buildPhysicalColumnDefinition({COLUMN_NAME:'i_id',COLUMN_TYPE:'int',COLUMN_KEY:'PRI'},true),/NOT NULL PRIMARY KEY$/);
 }
});
test('existing tenant primary/auto increment constraints survive old package metadata and are not mutated',()=>{
 const c=context();const incoming={COLUMN_NAME:'i_id',COLUMN_TYPE:'int',IS_NULLABLE:'YES'},target={COLUMN_NAME:'i_id',COLUMN_KEY:'PRI',EXTRA:'auto_increment'};
 const before=JSON.stringify({incoming,target});
 assert.equal(c.buildPhysicalColumnDefinition(incoming,false,'bigint',target),'`i_id` bigint NOT NULL auto_increment');
 assert.equal(JSON.stringify({incoming,target}),before);
});
test('legacy CREATE TABLE preserves both members of named composite primary key without matching comments or unique indexes',()=>{
 const c={runtimeIsSqlServer:false};vm.runInNewContext(extract('normalizePackageDdlNullability'),c);
 const ddl="CREATE TABLE `u8_archive` (`company_id` int NOT NULL, `i_id` int NOT NULL, `Label` varchar(20) NOT NULL COMMENT 'PRIMARY KEY (`Label`)', `Code` int NOT NULL, CONSTRAINT `pk_archive` PRIMARY KEY (`company_id`,`i_id`), UNIQUE KEY `ux_code` (`Code`))";
 const result=c.normalizePackageDdlNullability(ddl);
 assert.match(result,/`company_id` int NOT NULL/);assert.match(result,/`i_id` int NOT NULL/);
 assert.match(result,/`Label` varchar\(20\) NULL COMMENT 'PRIMARY KEY \(`Label`\)'/);assert.match(result,/`Code` int NULL/);
 assert.match(result,/CONSTRAINT `pk_archive` PRIMARY KEY \(`company_id`,`i_id`\), UNIQUE KEY `ux_code` \(`Code`\)/);
 assert.equal(c.normalizePackageDdlNullability(result),result);
});
test('catalog reads actual primary and identity metadata on both databases',()=>{
 for(const server of [false,true]){
  const c={runtimeIsSqlServer:server,isSafeIdentifier:()=>true,V8:{Db:{FromSql(sql){
   assert.match(sql,/COLUMN_KEY/);if(server){assert.match(sql,/is_primary_key=1/);assert.match(sql,/IsIdentity/);assert.match(sql,/TABLE_SCHEMA/);}else assert.match(sql,/EXTRA/);
   return {AddInParameter(name,value){assert.equal(name,'@p0');assert.equal(value,'u8_project_archive');return this;},ToArray(){return [{COLUMN_NAME:'i_id',COLUMN_KEY:'PRI'}];}};
  }}}};vm.runInNewContext(extract('readTargetPhysicalColumns'),c);assert.equal(c.readTargetPhysicalColumns('u8_project_archive')[0].COLUMN_KEY,'PRI');
 }
});
test('existing non-Id primary and identity columns issue no NULL DDL on replay for MySQL and SQL Server',()=>{
 for(const server of [false,true])for(const targetMeta of [{COLUMN_KEY:'PRI'},{EXTRA:'auto_increment'},{IS_IDENTITY:1}]){
  const c=context(server),target={COLUMN_NAME:'i_id',COLUMN_TYPE:'int',IS_NULLABLE:'NO',COLUMN_DEFAULT:null,...targetMeta};
  Object.assign(c,{Package:{DiyTables:[{Name:'u8_project_archive'}]},debugLog:{},normalizeSqlType:t=>t,chooseCompatibleColumnType:(s,t)=>t,chooseSqlServerTextExpansion:(s,t)=>t,
   isNumericSqlType:()=>true,groupPackagePhysicalColumns:()=>({archive:{TableName:'u8_project_archive',Columns:[{COLUMN_NAME:'i_id',COLUMN_TYPE:'int',IS_NULLABLE:'YES',COLUMN_DEFAULT:null}]}}),
   getTargetPhysicalColumns:()=>({i_id:target}),V8:{Db:{FromSql(){throw Error('No DDL or data mutation expected');}}}});
  vm.runInNewContext(extract('packageOwnsPhysicalTable')+'\n'+extract('syncPhysicalColumnsFromPackage'),c);
  for(let i=0;i<2;i++){const result=c.syncPhysicalColumnsFromPackage(null);assert.equal(result.Errors,0,JSON.stringify(c.debugLog));assert.equal(result.Skipped,1);assert.equal(result.Modified,0);}
 }
});

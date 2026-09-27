import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';import test from 'node:test';
const source=fs.readFileSync(new URL('./export-package.js',import.meta.url),'utf8'),publisher=fs.readFileSync(new URL('./ai-app-publish-store.js',import.meta.url),'utf8');
const tables=[{Id:'tags',Name:'biz_tag'},{Id:'links',Name:'biz_link'}],fields=[['tags','SiteId'],['tags','Code'],['tags','MergeId'],['links','TagId']].map(([TableId,Name])=>({TableId,Name,Type:'varchar(50)'}));
const primary=t=>({TABLE_NAME:t,INDEX_NAME:'PRIMARY',COLUMN_NAME:'Id',SEQ_IN_INDEX:1,NON_UNIQUE:0,INDEX_TYPE:'BTREE',SORT_ORDER:'A'});
const indexes=[primary('biz_tag'),primary('biz_link'),{TABLE_NAME:'biz_tag',INDEX_NAME:'ux_site_code',COLUMN_NAME:'SiteId',SEQ_IN_INDEX:1,NON_UNIQUE:0,INDEX_TYPE:'BTREE',SORT_ORDER:'A'},{TABLE_NAME:'biz_tag',INDEX_NAME:'ux_site_code',COLUMN_NAME:'Code',SEQ_IN_INDEX:2,NON_UNIQUE:0,INDEX_TYPE:'BTREE',SORT_ORDER:'A'},{TABLE_NAME:'biz_tag',INDEX_NAME:'ix_merge',COLUMN_NAME:'MergeId',SEQ_IN_INDEX:1,NON_UNIQUE:1,INDEX_TYPE:'BTREE',SORT_ORDER:'A'}];
function exported(rows=indexes,{provider='MySql',error,owned=tables}={}){
 const queries=[],context={exportTables:owned,exportFields:fields,fixedDiyField:[{Name:'Id',Type:'varchar(36)'}],mapToMySQLType:x=>x,debugLog:{},isSafeIdentifier:x=>/^[A-Za-z0-9_]+$/.test(x),V8:{OsClientModel:{DbType:provider},Db:{FromSql(sql){const args={};queries.push({sql,args});return{AddInParameter(k,v){args[k]=v;return this;},ToArray(){if(error)throw Error('catalog unavailable');return rows;}};}}}};
 const start=source.indexOf('    // PACKAGE_PHYSICAL_INDEX_EXPORT_V1'),end=source.indexOf('    // 为每个表生成DDL');
 if(start>=0)vm.runInNewContext(source.slice(start,end),context);
 vm.runInNewContext(source.slice(end,source.indexOf('    debugLog.ddlStatementsCount',end)),context);
 return{ddl:JSON.parse(JSON.stringify(context.ddlStatements)),queries};
}
test('owned physical unique and composite indexes survive an export after table DDL',()=>{
 const {ddl,queries}=exported();assert.equal(ddl.length,4);assert.equal(queries.length,1);assert.match(queries[0].sql,/INFORMATION_SCHEMA.STATISTICS/);assert.deepEqual(Object.values(queries[0].args),['biz_tag','biz_link']);
 assert.deepEqual(ddl.filter(x=>/^CREATE.*INDEX/.test(x.DDL)).map(x=>x.DDL),['CREATE INDEX `ix_merge` ON `biz_tag` (`MergeId`);','CREATE UNIQUE INDEX `ux_site_code` ON `biz_tag` (`SiteId`,`Code`);']);
 assert.ok(ddl.findIndex(x=>x.DDL.startsWith('CREATE TABLE')&&x.TableName==='biz_tag')<ddl.findIndex(x=>x.DDL.startsWith('CREATE INDEX')));
});
test('catalog failure aborts export instead of silently dropping constraints',()=>{assert.throws(()=>exported(indexes,{error:true}),/catalog unavailable/);});
for(const [title,patch]of [['prefix',{SUB_PART:10}],['expression',{COLUMN_NAME:null}],['descending',{SORT_ORDER:'D'}],['fulltext',{INDEX_TYPE:'FULLTEXT'}],['missing column',{COLUMN_NAME:'Unknown'}],['invalid identifier',{INDEX_NAME:'x`;DROP TABLE biz_tag'}],['inconsistent uniqueness',{NON_UNIQUE:1}],['incomplete sequence',{SEQ_IN_INDEX:3}]])test('unsafe or unsupported index rejected: '+title,()=>{const rows=structuredClone(indexes);Object.assign(rows[3],patch);assert.throws(()=>exported(rows),/索引/);});
test('duplicate table selection queries and exports each index once',()=>{const r=exported(indexes,{owned:[tables[0],tables[1],tables[0]]});assert.equal(r.queries.length,1);assert.equal(r.ddl.filter(x=>/^CREATE.*INDEX/.test(x.DDL)).length,2);});
test('unselected catalog tables cannot enter the package',()=>{assert.throws(()=>exported([...indexes,{...indexes[4],TABLE_NAME:'sys_user'}]),/索引/);});
test('no tables do not issue catalog query',()=>{const r=exported([],{owned:[]});assert.equal(r.queries.length,0);assert.deepEqual(r.ddl,[]);});
test('unsupported source provider is explicit instead of returning a partial index package',()=>{assert.throws(()=>exported(indexes,{provider:'Oracle'}),/当前源数据库/);});
test('missing catalog table and non-Id primary key stop incomplete packages',()=>{assert.throws(()=>exported(indexes.filter(x=>x.TABLE_NAME!=='biz_link')),/物理索引/);const rows=structuredClone(indexes);rows[0].COLUMN_NAME='Code';assert.throws(()=>exported(rows),/非Id主键/);});
function merged(left,right){const start=publisher.indexOf('function mergeUniqueRows('),end=publisher.indexOf('function exportScheduleJobs(',start),statement=publisher.match(/infrastructure\.DDLStatements = ([^\n]+);/)[0];const c={toArray:x=>x||[],infrastructure:{DDLStatements:left},selectedExport:{DDLStatements:right}};vm.runInNewContext(publisher.slice(start,end)+statement,c);return JSON.parse(JSON.stringify(c.infrastructure.DDLStatements));}
test('AI application combination retains same-table multiple indexes and skips exact duplicates',()=>{const table={TableName:'biz_tag',DDL:'CREATE TABLE `biz_tag` (`Id` varchar(36));'},one={TableName:'biz_tag',DDL:'CREATE INDEX `ix_one` ON `biz_tag` (`Id`);'},two={TableName:'biz_tag',DDL:'CREATE UNIQUE INDEX `ux_two` ON `biz_tag` (`Id`);'};assert.deepEqual(merged([table],[table,one,two,one]),[table,one,two]);});
test('DDL object merge rejects conflicting index definitions rather than hiding a collision',()=>{const a={TableName:'biz_tag',DDL:'CREATE INDEX `ix_one` ON `biz_tag` (`Id`);'},b={TableName:'biz_tag',DDL:'CREATE INDEX `ix_one` ON `biz_tag` (`Code`);'};assert.throws(()=>merged([a],[b]),/索引|DDL/);});

import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';
const source=fs.readFileSync(process.env.MICROI_SPARSE_IMPORTER || new URL('./import-package.js',import.meta.url),'utf8');
const dependency={TableId:'shared',TableName:'Sys_Config',SelectionMode:'Ids',RowIds:[],Where:[],ConflictPolicy:'InsertIfMissing',ConflictFields:['Id'],Rows:[]};
const defaults=Array.from({length:4},(_,i)=>({Id:'source-'+i,ConfigKey:'Key'+i,ConfigValue:'default-'+i,IsPublic:0,IsSecret:0,IsEnabled:1}));
function execute(dataSets,{physical=true,metadata=true,existing=[]}={}){
 const reads=[],writes=[],rows=structuredClone(existing),stats={DataSetCount:0,DataInserted:0,DataUpdated:0,DataSkipped:0};
 const ctx={Package:{DataSets:structuredClone(dataSets),DiyTables:[{Id:'shared',Name:'Sys_Config'}],DDLStatements:[]},runtimeIsSqlServer:false,runtimeIsOracle:false,stats,debugLog:{},reportProgress(){},remapPackageDataRowReferences:(_t,r)=>r,
 V8:{OsClient:'fixture',Db:{FromSql(sql){reads.push(sql);return{AddInParameter(){return this;},ToArray(){return physical?[{TABLE_NAME:'exists'}]:[];}};}},FormEngine:{GetFormData(table,q){reads.push({table,q});if(table==='diy_table')return metadata?{Code:1,Data:{Id:'target-table',Name:q._Where[0][2]}}:{Code:2};const found=q.Id?rows.find(x=>x.Id===q.Id):rows.find(x=>q._Where.every(([k,_op,v])=>x[k]===v));return found?{Code:1,Data:found}:{Code:2};},GetTableData(){return{Code:1,Data:[]};},AddFormData(t,r){writes.push({t,r});rows.push(structuredClone(r));return{Code:1};},UptFormData(t,r){writes.push({t,r});Object.assign(rows.find(x=>x.Id===r.Id),r);return{Code:1};}}}};
 const begin=source.indexOf('    var validateDataSetTablePrerequisites = function () {'),end=source.indexOf('    // ==================== 步骤0：',begin);
 const dataStart=source.indexOf('    // ==================== 步骤8：导入应用随包数据'),dataEnd=source.indexOf("    debugLog.step8Result",dataStart);
 const helperStart=source.indexOf('function isEmptySharedTablePrerequisite('),helperEnd=source.indexOf('// INSTALLED_RUNTIME_SUMMARY_V1',helperStart);
 try{vm.runInNewContext((helperStart>=0?source.slice(helperStart,helperEnd):'')+source.slice(begin,end)+source.slice(dataStart,dataEnd),ctx,{timeout:1000});return{ok:true,rows,reads,writes,stats};}catch(error){return{ok:false,error,rows,reads,writes,stats};}
}
test('actual protected Sys_Config empty dependency passes without any row write',()=>{const r=execute([dependency]);assert.equal(r.ok,true,r.error?.message);assert.equal(r.writes.length,0);assert.equal(r.stats.DataSetCount,1);});
test('missing shared physical table fails in actual preflight before metadata or data writes',()=>{const r=execute([dependency],{physical:false});assert.equal(r.ok,false);assert.match(r.error.message,/尚未创建/);assert.equal(r.writes.length,0);assert.ok(r.reads.every(x=>typeof x==='string'&&x.startsWith('SELECT ')));});
test('missing shared metadata does not create an incomplete table',()=>{const r=execute([dependency],{metadata:false});assert.equal(r.ok,false);assert.equal(r.writes.length,0);});
test('protected-table rows and malformed empty dependency never obtain write permission',()=>{for(const change of [{Rows:[{Id:'x',FeatureEnabled:1}]},{Where:[['Id','=','x']]},{RowIds:['x']},{ConflictFields:['FeatureEnabled']},{MetadataFieldsIfExists:['ConfigValue']},{ConflictPolicy:'UpsertById'},{Unexpected:true}]){const r=execute([{...dependency,...change}]);assert.equal(r.ok,false,JSON.stringify(change));assert.equal(r.writes.length,0);}});
test('actual InsertIfMissing loop preserves four tenant values and inserts only missing defaults',()=>{
 const set={TableId:'settings',TableName:'mci_system_setting',SelectionMode:'Ids',RowIds:defaults.map(x=>x.Id),Where:[],ConflictPolicy:'InsertIfMissing',ConflictFields:['ConfigKey'],Rows:defaults};
 const tenant=defaults.map((x,i)=>({...x,Id:'tenant-'+i,ConfigValue:'custom-'+i}));
 const r=execute([set],{existing:tenant});assert.equal(r.ok,true,r.error?.message);assert.deepEqual(r.rows,tenant);assert.equal(r.writes.length,0);assert.equal(r.stats.DataSkipped,4);
 const fresh=execute([set]);assert.equal(fresh.ok,true,fresh.error?.message);assert.equal(fresh.writes.length,4);assert.equal(fresh.stats.DataInserted,4);
 const repeat=execute([set],{existing:fresh.rows});assert.equal(repeat.ok,true);assert.equal(repeat.writes.length,0);
});
test('sparse table metadata copy cannot reset existing Tabs or Column',()=>{
 const begin=source.indexOf('        var modelCopy = {};',source.indexOf('    // ==================== 步骤1：处理diy_table数据'));
 const end=source.indexOf('        if (exists) {',begin);assert.ok(begin>=0&&end>begin);
 const tenant={Id:'target-table',Name:'Sys_Config',Tabs:'custom-layout',Column:4,Description:'tenant-text'};
 const ctx={table:{Id:'target-table',Name:'Sys_Config'},V8:{OsClient:'tenant'}};vm.runInNewContext(source.slice(begin,end),ctx);
 const applied={...tenant,...ctx.modelCopy};assert.equal(applied.Tabs,tenant.Tabs);assert.equal(applied.Column,4);assert.equal(applied.Description,tenant.Description);
});
test('actual physical sync adds only the selected missing column without changing unrelated columns or indexes',()=>{
 const start=source.indexOf('    var isUnusedWorkflowPhysicalSchema = function'),end=source.indexOf('    var buildPhysicalTableFilter',start);
 const target={id:{COLUMN_NAME:'Id',COLUMN_TYPE:'varchar(36)'},tenantowned:{COLUMN_NAME:'TenantOwned',COLUMN_TYPE:'varchar(255)',COLUMN_DEFAULT:'keep'}};
 const frozen=structuredClone(target),indexes=[{INDEX_NAME:'IX_tenant',COLUMN_NAME:'TenantOwned'}],sql=[];
 const ctx={Package:{DiyTables:[{Id:'shared',Name:'Sys_Config'}],PhysicalColumns:[{TABLE_NAME:'Sys_Config',COLUMN_NAME:'FeatureEnabled',COLUMN_TYPE:'int',COLUMN_DEFAULT:0}],DDLStatements:[]},
 isSafeIdentifier:x=>/^[A-Za-z_][A-Za-z0-9_]*$/.test(x),getPhysicalValue:(r,keys)=>keys.map(k=>r[k]).find(v=>v!==undefined),getTargetPhysicalColumns:()=>target,
 buildPhysicalColumnDefinition:r=>'`'+r.COLUMN_NAME+'` int DEFAULT 0',quotePhysicalIdentifier:n=>'`'+n+'`',runtimeIsSqlServer:false,
 mysqlOffpageTypeOverrides:{},mysqlOffpageOverrideKey:(t,c)=>t+'.'+c,debugLog:{},V8:{Db:{FromSql(s){sql.push(s);return{ExecuteNonQuery(){return 1;}};}}}};
 vm.runInNewContext(source.slice(start,end)+'globalThis.result=syncPhysicalColumnsFromPackage(null);',ctx,{timeout:1000});
 assert.equal(ctx.result.Errors,0);assert.equal(ctx.result.Added,1);assert.equal(ctx.result.Modified,0);
 assert.deepEqual(sql,['ALTER TABLE `Sys_Config` ADD COLUMN `FeatureEnabled` int DEFAULT 0']);
 assert.deepEqual(target,frozen);assert.deepEqual(indexes,[{INDEX_NAME:'IX_tenant',COLUMN_NAME:'TenantOwned'}]);
});

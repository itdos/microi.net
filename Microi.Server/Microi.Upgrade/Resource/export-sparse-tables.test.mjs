import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source=fs.readFileSync(process.env.MICROI_SPARSE_EXPORTER || new URL('./export-package.js',import.meta.url),'utf8');
const importer=fs.readFileSync(process.env.MICROI_SPARSE_IMPORTER || new URL('./import-package.js',import.meta.url),'utf8');
const coreNames=['sys_menu','diy_table','diy_field','wf_flowdesign','wf_node','wf_line','sys_apiengine'];
const tables=[...coreNames.map(Name=>({Id:Name,Name})),{Id:'shared',Name:'biz_shared',Tabs:'tenant-layout',Column:4},{Id:'settings',Name:'biz_setting',Tabs:'tenant-settings',Column:2},{Id:'owned',Name:'biz_owned'}];
const fields=[...coreNames.flatMap(TableId=>['Id','TableId','Name','Type','Label','Tabs','Column'].map(Name=>({Id:TableId+'-'+Name,TableId,Name,Type:'varchar(255)'}))),
 {Id:'chosen',TableId:'shared',Name:'FeatureEnabled',Type:'int',Component:'Switch',DefaultValue:'0'},
 {Id:'unrelated',TableId:'shared',Name:'TenantOwned',Type:'varchar(255)',Component:'Text',DefaultValue:'keep'},
 ...['Id','ConfigKey','ConfigValue','IsPublic','IsSecret','IsEnabled'].map(Name=>({Id:'settings-'+Name,TableId:'settings',Name,Type:Name.startsWith('Is')?'int':'varchar(255)'})),
 {Id:'owned-id',TableId:'owned',Name:'Id',Type:'varchar(36)'},{Id:'owned-code',TableId:'owned',Name:'Code',Type:'varchar(255)'}];
const physical=fields.filter(x=>!coreNames.includes(x.TableId)).map(x=>({TABLE_NAME:tables.find(t=>t.Id===x.TableId).Name,COLUMN_NAME:x.Name,COLUMN_TYPE:x.Type,DATA_TYPE:x.Type,IS_NULLABLE:'YES',COLUMN_DEFAULT:x.DefaultValue??null,COLUMN_KEY:x.Name==='Id'?'PRI':'',EXTRA:'',ORDINAL_POSITION:1}));
const defaults=Array.from({length:4},(_,i)=>({Id:'setting-'+i,ConfigKey:'Key'+i,ConfigValue:'default'+i,IsPublic:0,IsSecret:0,IsEnabled:1}));
const settingSelection={TableId:'settings',FieldIds:fields.filter(x=>x.TableId==='settings').map(x=>x.Id)};
const settingData={TableId:'settings',SelectionMode:'Ids',RowIds:defaults.map(x=>x.Id),ConflictPolicy:'InsertIfMissing',ConflictFields:['ConfigKey']};
function run(params={},options={}) {
 const calls=[],writes=[];let tableReads=0;const tb=structuredClone(options.tables||tables),fl=structuredClone(options.fields||fields),ph=structuredClone(options.physical||physical);
 const unwrap=value=>typeof value==='string'?JSON.parse(value):value;
 const ctx={V8:{Param:{SparseTableSelections:[{TableId:'shared',FieldIds:['chosen']}],...params},InvokeType:'Client',CurrentUser:{Level:9999},OsClientModel:{DbType:'MySql'},FormEngine:{
  GetTableData(name,q){calls.push({name,q});let data;
   if(name==='diy_table'){tableReads++;const ids=q._Where[0][0]==='Name'?unwrap(q._Where[0][2]):unwrap(q._Where[0][2]);data=tb.filter(t=>ids.includes(q._Where[0][0]==='Name'?t.Name:t.Id));}
   else if(name==='diy_field'){const ids=unwrap(q._Where[0][2]);data=fl.filter(f=>ids.includes(f.TableId));}
   else if(name==='biz_setting'){data=structuredClone(options.rows||defaults);if(q._SelectFields && !options.ignoreProjection)data=data.map(row=>Object.fromEntries(Object.entries(row).filter(([k])=>q._SelectFields.includes(k))));}
   else throw Error('Unexpected table '+name);
   return {Code:1,Data:data,DataCount:data.length};
  },AddFormData(...a){writes.push(a);throw Error('export must not write');},UptFormData(...a){writes.push(a);throw Error('export must not write');}},Db:{FromSql(sql){const args={};calls.push({sql,args});return {AddInParameter(k,v){args[k]=v;return this;},ToArray(){if(sql.includes('COLUMNS'))return ph.filter(c=>c.TABLE_NAME.toLowerCase()===String(args['@p0']).toLowerCase());if(sql.includes('STATISTICS'))return Object.values(args).map(TABLE_NAME=>({TABLE_NAME,INDEX_NAME:'PRIMARY',COLUMN_NAME:'Id',SEQ_IN_INDEX:1,NON_UNIQUE:0,INDEX_TYPE:'BTREE',SORT_ORDER:'A'}));throw Error('Unexpected SQL');}};}},ApiEngine:{Run(){throw Error('unexpected nested engine');}}}};
 const result=vm.runInNewContext('(function(){'+source+'\n})()',ctx,{timeout:2000});return {result:JSON.parse(JSON.stringify(result)),calls,writes,tableReads};
}
test('full exporter selects only authoritative requested fields and preserves shared layout ownership',()=>{
 const {result:r,calls,writes}=run();assert.equal(r.Code,1,r.Msg);const m=r.Data;
 assert.deepEqual(m.DiyTables,[{Id:'shared',Name:'biz_shared'}]);assert.deepEqual(m.DiyFields.map(x=>x.Id),['chosen']);
 assert.deepEqual(m.PhysicalColumns.map(x=>x.COLUMN_NAME),['FeatureEnabled']);assert.deepEqual(m.DDLStatements,[]);
 assert.equal(m.DataSets.length,1);assert.deepEqual(m.DataSets[0].Rows,[]);assert.equal(m.DataSets[0].ConflictPolicy,'InsertIfMissing');
 assert.equal(calls.some(x=>x.sql?.includes('STATISTICS')),false);assert.equal(writes.length,0);assert.equal(m.PackageInfo.DataRowCount,0);
});
test('four private defaults are selected exactly, insert-only, with no shared CREATE or INDEX',()=>{
 const {result:r,calls}=run({SparseTableSelections:[settingSelection],DataSelections:[settingData]});assert.equal(r.Code,1,r.Msg);
 assert.equal(r.Data.DataSets.length,1);assert.deepEqual(r.Data.DataSets[0].Rows,defaults);assert.equal(r.Data.PackageInfo.DataRowCount,4);assert.deepEqual(r.Data.DDLStatements,[]);
 assert.deepEqual(Array.from(calls.find(x=>x.name==='biz_setting').q._SelectFields).sort(),fields.filter(x=>x.TableId==='settings').map(x=>x.Name).sort());
});
test('owned full tables retain normal DDL while sparse shared tables remain only explicit fields',()=>{
 const {result:r}=run({TableIds:['owned']});assert.equal(r.Code,1,r.Msg);assert.ok(r.Data.DDLStatements.some(x=>x.TableName==='biz_owned'));assert.ok(r.Data.DDLStatements.every(x=>x.TableName!=='biz_shared'));
});
for(const [name,value] of [['object',{}],['emptyfields',[{TableId:'shared',FieldIds:[]}]],['extraMetadata',[{TableId:'shared',FieldIds:['chosen'],Tabs:'overwrite'}]],['badfield',[{TableId:'shared',FieldIds:[{}]}]],['duplicatefield',[{TableId:'shared',FieldIds:['chosen','chosen']}]],['duplicatetable',[{TableId:'shared',FieldIds:['chosen']},{TableId:'shared',FieldIds:['unrelated']}]],['unknownfield',[{TableId:'shared',FieldIds:['missing']}]],['foreignfield',[{TableId:'shared',FieldIds:['settings-Id']}]],['unknowntable',[{TableId:'missing',FieldIds:['chosen']}]]])test('rejects invalid sparse selection: '+name,()=>{const r=run({SparseTableSelections:value});assert.equal(r.result.Code,0);assert.equal(r.writes.length,0);});
test('full and sparse selection conflict is rejected before table reads',()=>{const r=run({TableIds:['shared']});assert.equal(r.result.Code,0);assert.equal(r.tableReads,0);});
test('missing physical source column fails instead of publishing metadata-only success',()=>{const r=run({}, {physical:physical.filter(x=>x.COLUMN_NAME!=='FeatureEnabled')});assert.equal(r.result.Code,0);assert.match(r.result.Msg,/权威物理列/);});
test('soft deleted and virtual selected fields cannot enter sparse package',()=>{for(const patch of [{IsDeleted:1},{Type:'1'}]){const f=structuredClone(fields);Object.assign(f.find(x=>x.Id==='chosen'),patch);assert.equal(run({}, {fields:f}).result.Code,0);}});
test('shared defaults forbid overwrite and incomplete conflict key projection',()=>{assert.equal(run({SparseTableSelections:[settingSelection],DataSelections:[{...settingData,ConflictPolicy:'UpsertById'}]}).result.Code,0);assert.equal(run({SparseTableSelections:[{...settingSelection,FieldIds:settingSelection.FieldIds.filter(x=>x!=='settings-ConfigKey')}],DataSelections:[settingData]}).result.Code,0);});
test('old omitted sparse parameter keeps ordinary full table export unchanged',()=>{const r=run({SparseTableSelections:undefined,TableIds:['shared']});assert.equal(r.result.Code,1,r.result.Msg);assert.equal(r.result.Data.DiyTables[0].Tabs,'tenant-layout');assert.equal(r.result.Data.DiyFields.length,2);});

function oldInstallPrerequisite(model,exists) {
 const start=importer.indexOf('    var validateDataSetTablePrerequisites = function () {'),end=importer.indexOf('    // ==================== 步骤0：',start);assert.ok(start>=0&&end>start);
 const calls=[],ctx={Package:structuredClone(model),runtimeIsSqlServer:false,runtimeIsOracle:false,V8:{FormEngine:{GetFormData:()=>({Code:1,Data:{Id:'existing'}})},Db:{FromSql(sql){calls.push(sql);return {AddInParameter(){return this;},ToArray(){return exists?[{TABLE_NAME:'existing'}]:[];}};}}}};
 const hs=importer.indexOf('function isEmptySharedTablePrerequisite('),he=importer.indexOf('// INSTALLED_RUNTIME_SUMMARY_V1',hs);
 try{vm.runInNewContext((hs<0?'':importer.slice(hs,he))+importer.slice(start,end),ctx,{timeout:500});return {ok:true,calls};}catch(error){return {ok:false,error,calls};}
}
test('actual existing importer preflight rejects missing shared physical tables before any write',()=>{
 const {result:r}=run();assert.equal(r.Code,1,r.Msg);const absent=oldInstallPrerequisite(r.Data,false);assert.equal(absent.ok,false);assert.match(absent.error.message,/尚未创建/);assert.ok(absent.calls.length>0&&absent.calls.every(x=>/^SELECT /.test(x)));
 assert.equal(oldInstallPrerequisite(r.Data,true).ok,true);
});


// 执行完整导出器正文；仅数据库返回行是可控夹具，不替换 cleanObject 或最终导出形状。
const sparseDefaultParams={SparseTableSelections:[settingSelection],DataSelections:[settingData]};
function withFirstRow(patch){const rows=structuredClone(defaults);Object.assign(rows[0],patch);return rows;}
test('selected sparse source empty string is retained with actual numeric zero and strict importer accepts shape',()=>{
 const {result:r}=run(sparseDefaultParams,{rows:withFirstRow({ConfigValue:''})});assert.equal(r.Code,1,r.Msg);
 assert.equal(Object.hasOwn(r.Data.DataSets[0].Rows[0],'ConfigValue'),true);assert.equal(r.Data.DataSets[0].Rows[0].ConfigValue,'');assert.equal(r.Data.DataSets[0].Rows[0].IsSecret,0);
 const a=importer.indexOf('function isEmptySharedTablePrerequisite('),b=importer.indexOf('function validateSharedTableTargets(',a);assert.ok(a>=0&&b>a);
 assert.doesNotThrow(()=>vm.runInNewContext(importer.slice(a,b)+'\nvalidateSparseSharedTableContract(model)',{model:r.Data},{timeout:500}));
});
test('sparse null, undefined and missing fields do not invent empty string or zero',()=>{
 for(const mode of ['null','undefined','missing']){const rows=withFirstRow({ConfigValue:null,IsSecret:null});if(mode==='undefined'){rows[0].ConfigValue=undefined;rows[0].IsSecret=undefined;}if(mode==='missing'){delete rows[0].ConfigValue;delete rows[0].IsSecret;}
 const {result:r}=run(sparseDefaultParams,{rows});assert.equal(r.Code,1,r.Msg);assert.equal(Object.hasOwn(r.Data.DataSets[0].Rows[0],'ConfigValue'),false);assert.equal(Object.hasOwn(r.Data.DataSets[0].Rows[0],'IsSecret'),false);}
});
test('unselected source empty string is not included even if data provider over-returns',()=>{
 const {result:r}=run(sparseDefaultParams,{rows:withFirstRow({OtherValue:''}),ignoreProjection:true});assert.equal(r.Code,1,r.Msg);assert.equal(Object.hasOwn(r.Data.DataSets[0].Rows[0],'OtherValue'),false);
});
test('unselected nonempty source field remains rejected instead of broadening sparse contract',()=>{
 const {result:r}=run(sparseDefaultParams,{rows:withFirstRow({OtherValue:'private'}),ignoreProjection:true});assert.equal(r.Code,0);assert.match(r.Msg,/稀疏/);
});
test('empty selected conflict value still fails because emptiness does not satisfy uniqueness',()=>{
 const {result:r}=run(sparseDefaultParams,{rows:withFirstRow({ConfigKey:''})});assert.equal(r.Code,0);assert.match(r.Msg,/冲突字段缺少值/);
});
test('ordinary non-sparse data export keeps historic empty omission semantics',()=>{
 const {result:r}=run({SparseTableSelections:[],TableIds:['settings'],DataSelections:[settingData]},{rows:withFirstRow({ConfigValue:''})});assert.equal(r.Code,1,r.Msg);assert.equal(Object.hasOwn(r.Data.DataSets[0].Rows[0],'ConfigValue'),false);assert.equal(r.Data.DataSets[0].Rows[0].IsSecret,0);
});
function actualCleaner(){const a=source.indexOf('    var cleanObject = function (obj'),b=source.indexOf('\n    var isSafeIdentifier',a);assert.ok(a>=0&&b>a);const c={};vm.runInNewContext(source.slice(a,b),c,{timeout:500});return c.cleanObject;}
test('selected empty source values never restore cross-tenant or hidden metadata exclusions',()=>{
 const row={OsClient:'',CreateUserId:'',UpdateUserId:'',CreateUser:'',UpdateUser:'',_RawValue:'',_Secret:'',Value:''};const cleaned=actualCleaner()(row,Object.keys(row));assert.deepEqual(JSON.parse(JSON.stringify(cleaned)),{Value:''});
});
test('Array.map numeric index remains compatible with cleaner optional argument',()=>{
 const result=[{Id:'a',Value:''},{Id:'b',Value:''},{Id:'c',Value:null}].map(actualCleaner());assert.deepEqual(JSON.parse(JSON.stringify(result)),[{Id:'a'},{Id:'b'},{Id:'c'}]);
});
test('inherited empty property is never treated as a selected source column',()=>{
 const row=Object.create({Inherited:''});row.Own='';const cleaned=actualCleaner()(row,['Inherited','Own']);assert.equal(Object.hasOwn(cleaned,'Inherited'),false);assert.equal(cleaned.Own,'');
});
test('sparse empty retention still emits no shared DDL or layout writes',()=>{
 const {result:r,writes}=run(sparseDefaultParams,{rows:withFirstRow({ConfigValue:''})});assert.equal(r.Code,1,r.Msg);assert.deepEqual(r.Data.DDLStatements,[]);assert.deepEqual(r.Data.DiyTables,[{Id:'settings',Name:'biz_setting'}]);assert.deepEqual(writes,[]);
});

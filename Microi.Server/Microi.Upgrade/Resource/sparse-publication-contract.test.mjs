import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const { validateOfficialDataSetSchemaClosure: validate } = await import(process.env.MICROI_SPARSE_GATE ? pathToFileURL(process.env.MICROI_SPARSE_GATE).href : './resource-sync-core.mjs');
function model() { return {
 PackageInfo:{SparseTableSelections:[{TableId:'shared',FieldIds:['flag']}],DataSetCount:1,DataRowCount:0},
 DiyTables:[{Id:'shared',Name:'Sys_Config'}],DiyFields:[{Id:'flag',TableId:'shared',Name:'FeatureEnabled',Type:'int'}],
 PhysicalColumns:[{TABLE_NAME:'Sys_Config',COLUMN_NAME:'FeatureEnabled',DATA_TYPE:'int'}],DDLStatements:[],
 DataSets:[{TableId:'shared',TableName:'Sys_Config',SelectionMode:'Ids',RowIds:[],Where:[],ConflictPolicy:'InsertIfMissing',ConflictFields:['Id'],Rows:[]}]
}; }
test('strict shared table dependency publishes without owning its full layout or CREATE TABLE',()=>assert.doesNotThrow(()=>validate('fixture',model())));
const invalid={
 'unselected layout':m=>m.DiyTables[0].Tabs='[]', 'table column overwrite':m=>m.DiyTables[0].Column=3,
 'CREATE shared table':m=>m.DDLStatements.push({TableName:'Sys_Config',DDL:'CREATE TABLE Sys_Config (Id int)'}),
 'INDEX shared table':m=>m.DDLStatements.push({TableName:'Sys_Config',DDL:'CREATE INDEX IX ON Sys_Config (Id)'}),
 'unselected field':m=>m.DiyFields.push({Id:'extra',TableId:'shared',Name:'Other',Type:'int'}),
 'missing physical column':m=>m.PhysicalColumns=[], 'unselected physical column':m=>m.PhysicalColumns.push({TABLE_NAME:'Sys_Config',COLUMN_NAME:'Id'}),
 'missing prerequisite':m=>{m.DataSets=[];m.PackageInfo.DataSetCount=0;},
 'wrong table identity':m=>m.DataSets[0].TableId='other', 'non-array empty rows':m=>m.DataSets[0].RowIds='',
 'hidden metadata override':m=>m.DataSets[0].MetadataFieldsIfExists=['ConfigValue'],
 'upsert is forbidden':m=>m.DataSets[0].ConflictPolicy='UpsertById',
 'unknown selector property':m=>m.PackageInfo.SparseTableSelections[0].Fields=[],
 'invalid numeric field id':m=>m.PackageInfo.SparseTableSelections[0].FieldIds=[1],
 'duplicate table':m=>m.PackageInfo.SparseTableSelections.push({...m.PackageInfo.SparseTableSelections[0]}),
 'count cannot bypass':m=>m.PackageInfo.DataRowCount=1,
};
for (const [name,mutate] of Object.entries(invalid)) test(`reject ${name}`,()=>{const m=model();mutate(m);assert.throws(()=>validate('fixture',m));});
test('ordinary dataset still requires full physical schema even beside valid sparse dependency',()=>{const m=model();m.DataSets.push({TableName:'business',Rows:[]});m.PackageInfo.DataSetCount=2;assert.throws(()=>validate('fixture',m),/完整建表资源/);});
test('removing explicit sparse declaration never exempts ordinary dataset closure',()=>{const m=model();delete m.PackageInfo.SparseTableSelections;assert.throws(()=>validate('fixture',m),/完整建表资源/);});
test('sparse defaults require every row and conflict field selected, without updating tenant values',()=>{
 const m=model();m.DiyTables[0].Name='mci_system_setting';m.PackageInfo.SparseTableSelections[0].FieldIds=['id','key','value'];
 m.DiyFields=['Id','ConfigKey','ConfigValue'].map((Name,i)=>({Id:['id','key','value'][i],TableId:'shared',Name,Type:'varchar(128)'}));
 m.PhysicalColumns=m.DiyFields.map(f=>({TABLE_NAME:'mci_system_setting',COLUMN_NAME:f.Name}));
 Object.assign(m.DataSets[0],{TableName:'mci_system_setting',ConflictFields:['ConfigKey'],Rows:[{Id:'a',ConfigKey:'feature',ConfigValue:'0'}]});m.PackageInfo.DataRowCount=1;
 assert.doesNotThrow(()=>validate('fixture',m));m.DataSets[0].Rows[0].SecretCipher='secret';assert.throws(()=>validate('fixture',m),/未选择字段/);
});

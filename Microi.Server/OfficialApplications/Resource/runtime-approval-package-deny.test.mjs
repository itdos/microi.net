import fs from 'node:fs';import vm from 'node:vm';import test from 'node:test';import assert from 'node:assert/strict';
const importer=fs.readFileSync(process.env.MICROI_APPROVAL_IMPORTER||new URL('./import-package.js',import.meta.url),'utf8');
const exporter=fs.readFileSync(process.env.MICROI_APPROVAL_EXPORTER||new URL('./export-package.js',import.meta.url),'utf8');
const empty={TableId:'approval-table',TableName:'mci_runtime_installation',SelectionMode:'Ids',RowIds:[],Where:[],Rows:[],ConflictFields:['Id'],ConflictPolicy:'InsertIfMissing'};
test('direct incoming approval rows are rejected before bootstrap/DDL/DB calls, even when restoring revoked records',()=>{
 for(const row of [{Id:'a',Status:'Approved'},{Id:'a',RevokedAt:null},{Id:'a',Status:'Revoked'}]){
  let calls=0;const context={V8:{Param:{Package:{DataSets:[{...empty,Rows:[row]}]}}},JSON};
  const body=importer.slice(0,importer.indexOf('// SQLSERVER_PHYSICAL_SCHEMA_DIALECT_V1'));
  context.V8.Db=new Proxy({},{get(){calls++;throw Error('no DB before approval rejection');}});
  const r=vm.runInNewContext('(function(){'+body+'\nreturn {Code:1};})()',context,{timeout:1000});assert.equal(r.Code,0);assert.match(r.Msg,/审批数据/);assert.equal(calls,0);
 }
});
test('strict zero-row dependency allowed, unknown nonempty shape fails',()=>{
 const start=importer.indexOf('function isEmptySharedTablePrerequisite('),end=importer.indexOf('// INSTALLED_RUNTIME_SUMMARY_V1',start);assert.ok(start>=0);
 const context={};vm.runInNewContext(importer.slice(start,end),context);assert.doesNotThrow(()=>context.validateRuntimeApprovalData({DataSets:[empty]}));
 for(const patch of [{Rows:{}},{Rows:[] ,Where:[['Status','=','Approved']]},{Rows:[],MetadataFieldsIfExists:['Status']}])assert.throws(()=>context.validateRuntimeApprovalData({DataSets:[{...empty,...patch}]}));
});
test('export and import protected-data guards include approval table, without banning its structure',()=>{
 for(const source of [exporter,importer]){const block=source.match(/var protectedDataTables = \{[\s\S]*?\n    \};/)?.[0];assert.ok(block);const context={};vm.runInNewContext(block,context);assert.equal(context.protectedDataTables.mci_runtime_installation,true);assert.equal(context.protectedDataTables.biz_example,undefined);}
});
test('downloaded package performs approval preflight before any per-package resources',()=>{const p=importer.indexOf('validateRuntimeApprovalData(Package);');assert.ok(p>0);assert.ok(p<importer.indexOf('var validateDataSetTablePrerequisites = function'));});
test('actual exporter selection loop rejects approval data before reading any seed row',()=>{
 const start=exporter.indexOf('    var protectedDataTables = {'),end=exporter.indexOf('        var selectionMode = ',start);assert.ok(start>=0&&end>start);
 for(const policy of ['InsertIfMissing','UpsertById']){const ctx={DataSelections:[{TableId:'approval',SelectionMode:'Ids',RowIds:['approved-id'],ConflictPolicy:policy}],exportTables:[{Id:'approval',Name:'mci_runtime_installation'}]};assert.throws(()=>vm.runInNewContext(exporter.slice(start,end)+'\n}',ctx),/安全表/);}
});

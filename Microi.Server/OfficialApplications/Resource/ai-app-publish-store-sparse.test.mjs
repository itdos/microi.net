import assert from 'node:assert/strict';
import test from 'node:test';
import {runRuntimePublisher} from './ai-app-publish-store-runtime-assets-only.test.mjs';

const selection=[{TableId:'shared',FieldIds:['chosen']}];
const selectedExport={PackageInfo:{SparseTableSelections:selection},DDLStatements:[],PhysicalColumns:[{TABLE_NAME:'biz_shared',COLUMN_NAME:'FeatureEnabled',COLUMN_TYPE:'int'}],DiyTables:[{Id:'shared',Name:'biz_shared'}],DiyFields:[{Id:'chosen',TableId:'shared',Name:'FeatureEnabled',Type:'int'}],DataSets:[{TableId:'shared',TableName:'biz_shared',SelectionMode:'Ids',RowIds:[],Where:[],ConflictPolicy:'InsertIfMissing',ConflictFields:['Id'],Rows:[]}],SysApiEngines:[]};
const run=(extra={})=>runRuntimePublisher({app:{AppPakcet:'{}',...extra.app},selectedExport:extra.selectedExport||selectedExport,parameters:{RuntimeAssetsOnly:false,SparseTableSelections:selection,SelectTable:undefined,...extra.parameters},proof:extra.proof,version:extra.version});
test('full V3 publisher forwards exact sparse selection and includes all sparse resources in snapshot',()=>{
 const {result:r,calls,writes}=run();assert.equal(r.Code,1,r.Msg);
 assert.deepEqual(JSON.parse(JSON.stringify(calls.find(x=>x.engine==='export-microi-store-package').params.SparseTableSelections)),selection);
 const res=r.Data.ResourceSnapshot.Resources;assert.equal(res.DiyTables.length,7);assert.equal(res.DDLStatements.length,6);
 assert.ok(res.DiyTables.find(t=>t.Name==='biz_shared'&&!('Tabs' in t)&&!('Column' in t)));
 assert.ok(res.DiyFields.find(f=>f.Id==='chosen'));assert.equal(res.DataSets.length,1);assert.equal(writes.length,0);
});
test('old exporter without exact sparse confirmation cannot publish a whole-table fallback',()=>{const e=structuredClone(selectedExport);delete e.PackageInfo.SparseTableSelections;const r=run({selectedExport:e});assert.equal(r.result.Code,0);assert.match(r.result.Msg,/更新官方/);assert.equal(r.writes.length,0);});
test('RuntimeAssetsOnly rejects sparse resources before export',()=>{const r=run({parameters:{RuntimeAssetsOnly:true}});assert.equal(r.result.Code,0);assert.match(r.result.Msg,/RuntimeAssetsOnly/);assert.equal(r.calls.some(x=>x.engine),false);});
test('stored sparse selections require explicit refresh, never expand to whole tables',()=>{
 const app={SelectTable:JSON.stringify(selection)};
 const r=run({app,parameters:{SparseTableSelections:undefined}});assert.equal(r.result.Code,0);assert.match(r.result.Msg,/显式刷新/);
 const empty=run({app,parameters:{SparseTableSelections:[],TableIds:[]}});assert.equal(empty.result.Code,1,empty.result.Msg);assert.equal(empty.calls.some(x=>x.engine),false);
});
test('display SelectTable cannot differ from authoritative full + sparse selection',()=>{const r=run({parameters:{SelectTable:['different']}});assert.equal(r.result.Code,0);assert.match(r.result.Msg,/SelectTable/);assert.equal(r.writes.length,0);});
test('changed field definition or private default changes same V3 resource hash',()=>{
 const a=run().result.Data.ResourceSnapshotHash,e=structuredClone(selectedExport);e.DiyFields[0].Label='changed';const b=run({selectedExport:e}).result.Data.ResourceSnapshotHash;assert.notEqual(a,b);
 const d=structuredClone(selectedExport);d.DataSets[0].Rows=[{Id:'default',Value:'changed'}];assert.notEqual(a,run({selectedExport:d}).result.Data.ResourceSnapshotHash);
});
test('V3 Publish wrong resource CAS and changed committed runtime both fail before writes',()=>{
 const r=run({parameters:{Action:'Publish',ExpectedResourceSnapshotHash:'e'.repeat(64)}});assert.equal(r.result.Code,0);assert.match(r.result.Msg,/快照|CAS/);assert.equal(r.writes.length,0);
 const changed=run({proof:{PublishFence:'changed'}});assert.equal(changed.result.Code,0);assert.equal(changed.writes.length,0);
});

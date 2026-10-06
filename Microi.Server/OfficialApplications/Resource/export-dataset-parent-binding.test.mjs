import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const source=fs.readFileSync(process.env.MICROI_PARENT_BINDING_SOURCE||new URL('./export-package.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
const importer=fs.readFileSync(process.env.MICROI_PARENT_BINDING_IMPORTER||new URL('./import-package.js',import.meta.url),'utf8');
const begin=source.indexOf('        exportDataRowCount += cleanRows.length;'),end=source.indexOf('\n    }\n    exportDataSets=addSparseTablePrerequisites',begin);
assert.ok(begin>=0&&end>begin,'extract actual exporter dataset construction');
const fragment=source.slice(begin,end);
const is=importer.indexOf('function isEmptySharedTablePrerequisite('),ie=importer.indexOf('function validateSharedTableTargets(',is);
assert.ok(is>=0&&ie>is,'extract unchanged importer source preflight');
function exported(selection={}){
 const c={selection,exportDataRowCount:0,exportDataSets:[],selectedTable:{Id:'setting-table',Name:'biz_setting',Description:'配置'},selectionMode:'Ids',rowIds:['r1'],safeWhere:[],conflictPolicy:'InsertIfMissing',conflictFields:['ConfigKey'],cleanRows:[{Id:'r1',ConfigKey:'Key',Value:0}]};
 vm.runInNewContext(fragment,c,{timeout:500});return c.exportDataSets[0];
}
// 本地显式模拟已观察到的宿主 undefined→null 边界；不声称此 Node 用例启动了真实 Jint。
const wire=v=>JSON.parse(JSON.stringify(v,(_k,x)=>x===undefined?null:x));
function packageWith(set){return {PackageInfo:{SparseTableSelections:[{TableId:'setting-table',FieldIds:['id','key','value']}]},DiyTables:[{Id:'setting-table',Name:'biz_setting'}],DiyFields:[['id','Id'],['key','ConfigKey'],['value','Value']].map(([Id,Name])=>({Id,Name,TableId:'setting-table',Type:'varchar(200)'})),PhysicalColumns:['Id','ConfigKey','Value'].map(COLUMN_NAME=>({TABLE_NAME:'biz_setting',COLUMN_NAME,COLUMN_TYPE:'varchar(200)'})),DDLStatements:[],DataSets:[wire(set)]};}
function validate(set){const c={model:packageWith(set)};return vm.runInNewContext(importer.slice(is,ie)+'\nvalidateSparseSharedTableContract(model)',c,{timeout:500});}
test('unbound dataset has no own ParentBinding key before host serialization',()=>assert.equal(Object.hasOwn(exported(),'ParentBinding'),false));
test('unbound sparse dataset survives observed undefined-to-null host boundary and actual importer',()=>assert.doesNotThrow(()=>validate(exported())));
test('explicit ordinary parent binding is preserved exactly',()=>{const binding={Field:'ParentId',TableName:'biz_parent',Where:[['Code','=','base']]};assert.deepEqual(wire(exported({ParentBinding:binding})).ParentBinding,binding);});
test('explicit sparse parent binding still fails unchanged strict importer gate',()=>assert.throws(()=>validate(exported({ParentBinding:{Field:'ParentId',TableName:'biz_parent'}})),/稀疏默认数据/));
test('null selection means no binding property, not a serialized null key',()=>assert.equal(Object.hasOwn(exported({ParentBinding:null}),'ParentBinding'),false));
test('empty optional binding preserves legacy no-binding semantics',()=>{for(const value of ['',false,0])assert.equal(Object.hasOwn(exported({ParentBinding:value}),'ParentBinding'),false);});
test('dataset identity, conflicts and row zero values are unchanged',()=>{const s=wire(exported());assert.equal(s.Rows[0].Value,0);assert.deepEqual(s.RowIds,['r1']);assert.deepEqual(s.ConflictFields,['ConfigKey']);assert.equal(s.ConflictPolicy,'InsertIfMissing');});
test('cleanObject preserves numeric zero while removing null and empty string',()=>{const b=source.indexOf('    var cleanObject = function (obj'),e=source.indexOf('\n    var isSafeIdentifier',b);assert.ok(b>=0&&e>b);const c={};vm.runInNewContext(source.slice(b,e),c,{timeout:500});assert.deepEqual(wire(c.cleanObject({Zero:0,Null:null,Empty:'',Text:'x'})),{Zero:0,Text:'x'});});

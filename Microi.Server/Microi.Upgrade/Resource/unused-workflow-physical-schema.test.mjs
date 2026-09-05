import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import {validateOfficialPackageInstallContracts} from './resource-sync-core.mjs';
const source=fs.readFileSync(new URL('./import-package.js',import.meta.url),'utf8');
const helpers=source.slice(source.indexOf('    var isUnusedWorkflowPhysicalSchema ='),source.indexOf('    var syncPhysicalColumnsFromPackage ='));
function group(Package){const c={Package,isSafeIdentifier:x=>/^[A-Za-z_][A-Za-z0-9_]*$/.test(x),getPhysicalValue:(r,keys)=>keys.map(k=>r[k]).find(v=>v!==undefined)};vm.runInNewContext(helpers,c);return c.groupPackagePhysicalColumns(['wf_flowdesign','wf_node','wf_line','custom','sys_menu'].map(TABLE_NAME=>({TABLE_NAME,COLUMN_NAME:'Id'})),null);}
test('legacy unused workflow columns neither require nor modify optional workflow tables',()=>{
 assert.deepEqual(Object.keys(group({})),['custom','sys_menu']);
});
test('explicit workflow resources and dependencies remain strict',()=>{
 for(const key of ['WfFlowDesigns','WfNodes','WfLines'])assert.equal(Object.keys(group({[key]:[{}]})).length,5);
 for(const [key,row] of [['DiyTables',{Name:'wf_flowdesign'}],['DDLStatements',{TableName:'wf_flowdesign'}],['DataSets',{TableName:'wf_flowdesign'}],['SysMenus',{DiyTableName:'wf_flowdesign'}]])assert.ok(group({[key]:[row]}).wf_flowdesign);
});
test('publication rejects accidental optional workflow schema before any tenant install',()=>{
 const p={PhysicalColumns:[{TABLE_NAME:'wf_flowdesign',COLUMN_NAME:'Id'}]};
 assert.throws(()=>validateOfficialPackageInstallContracts('app.microi.store.json',JSON.stringify(p)),/未使用的工作流物理依赖/);
 for(const extra of [{WfFlowDesigns:[{}]},{DiyTables:[{Id:'wf',Name:'wf_flowdesign'}]}])assert.doesNotThrow(()=>validateOfficialPackageInstallContracts('app.microi.store.json',JSON.stringify({...p,...extra})));
});
test('export omits unrelated workflow columns and preserves selected tables or actual flow dependencies',()=>{
 const s=fs.readFileSync(new URL('./export-package.js',import.meta.url),'utf8');
 const block=s.slice(s.indexOf('    var physicalTableNameMap ='),s.indexOf('    var physicalColumns = getPhysicalColumns'));
 function names(owned,flows){const c={exportTables:owned?[{Name:'wf_flowdesign'}]:[],exportFlows:flows?[{}]:[],exportNodes:[],exportLines:[],someTableList:[{Name:'diy_field'},{Name:'wf_flowdesign'},{Name:'wf_node'}],addUniqueTableName:(m,l,n)=>{if(!m[n]){m[n]=true;l.push(n);}}};vm.runInNewContext(block,c);return [...c.physicalTableNames];}
 assert.deepEqual(names(false,false),['diy_field']);
 assert.deepEqual(names(true,false),['wf_flowdesign','diy_field']);
 assert.deepEqual(names(false,true),['diy_field','wf_flowdesign','wf_node']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('import-package.js',import.meta.url),'utf8');
function load(){
 const start=source.indexOf('// PACKAGE_LAYOUT_FIELD_RETIREMENTS_V1');
 const end=source.indexOf('// ==================== 参数接收与校验',start);
 assert(start>=0&&end>start,'installer must apply explicit metadata retirements');
 return new Function(source.slice(start,end)+';return retirePackageLayoutFields;')();
}
function scenario(){
 const pkg={DiyTables:[{Id:'source-table',Name:'sys_osclients'}],DiyFields:[],
  DiyFieldRetirements:[{TableName:'sys_osclients',Name:'PlatformReminders',ExpectedComponent:'DevComponent',ExpectedConfig:{DevComponentPath:'/platform/system-reminders'}}]};
 const state={field:{Id:'target-field',TableId:'target-table',Name:'PlatformReminders',Component:'DevComponent',Config:'{"DevComponentPath":"/platform/system-reminders"}'},deletes:[],cache:[],queries:[]};
 const form={
  GetFormData(table,query){state.queries.push({table,query});return table==='diy_table'?{Code:1,Data:{Id:'target-table',Name:'sys_osclients'}}:state.field?{Code:1,Data:state.field}:{Code:2};},
  DelFormData(table,query){state.deletes.push({table,query});state.field=null;return{Code:1};}
 };
 return{pkg,state,form,cache:{Remove:key=>state.cache.push(key)}};
}
test('layout retirement removes only matched metadata and is idempotent across resume',()=>{
 const f=load(),s=scenario();assert.equal(f(s.pkg,s.form,s.cache,'tenant-a').Retired,1);
 assert.deepEqual(s.state.deletes,[{table:'diy_field',query:{Id:'target-field'}}]);
 assert(s.state.cache.some(k=>k.includes(':tenant-a:')&&k.includes('target-table')));
 assert.equal(f(s.pkg,s.form,s.cache,'tenant-a').Retired,0);assert.equal(s.state.deletes.length,1);
});
test('fresh installation skips missing legacy fields without creating phantom metadata',()=>{
 const f=load(),s=scenario();s.state.field=null;assert.equal(f(s.pkg,s.form,s.cache,'tenant-a').Retired,0);assert.equal(s.state.deletes.length,0);
});
test('retirement rejects undeclared tables, data fields and active package field conflicts',()=>{
 const f=load();
 for(const mutate of [s=>s.pkg.DiyTables=[],s=>s.pkg.DiyFieldRetirements[0].Name='Id',
  s=>s.pkg.DiyFieldRetirements[0].ExpectedComponent='Text',
  s=>s.pkg.DiyFields=[{TableId:'source-table',Name:'PlatformReminders'}]]){
  const s=scenario();mutate(s);assert.throws(()=>f(s.pkg,s.form,s.cache,'tenant-a'));assert.equal(s.state.deletes.length,0);
 }
});
test('retirement preserves customized component/config and propagates read/delete failures',()=>{
 const f=load();
 for(const mutate of [s=>s.state.field.Component='Text',s=>s.state.field.Config='{"DevComponentPath":"/custom"}',
  s=>s.form.GetFormData=()=>({Code:0,Msg:'database unavailable'}),
  s=>s.form.DelFormData=()=>({Code:0,Msg:'delete failed'})]){
  const s=scenario();mutate(s);assert.throws(()=>f(s.pkg,s.form,s.cache,'tenant-a'));assert(s.state.field);
 }
});
test('installer applies retirement in PostSchema before schedule continuation and version commit',()=>{
 load();const marker=source.indexOf('var layoutRetirements = retirePackageLayoutFields(');
 assert(marker>0);assert(source.slice(marker-150,marker).includes("backgroundCheckpointPhase == 'PostSchema'"));
 assert(marker<source.indexOf("activeImportStage = '最终强回读与版本记录'"));
});


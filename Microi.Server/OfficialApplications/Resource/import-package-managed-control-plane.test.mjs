import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const source=await readFile(new URL('./import-package.js',import.meta.url),'utf8');
const start=source.indexOf('    // ==================== 步骤7：处理sys_apiengine数据（可选）');
const end=source.indexOf('    // ==================== 步骤8：导入应用随包数据',start);
assert.ok(start>=0&&end>start);
const key='get-microi-upgrade-resource';
const incoming={Id:'package-control-id',ApiEngineKey:key,ApiV8Code:'trusted-official-control-source',Version:'v1.4.4',IsEnable:1,StopHttp:0,AllowAnonymous:0};

function run({existing=null,policy='Managed',writeFails=false}={}){
  let row=existing&&structuredClone(existing);
  const writes=[],states=[],invalidations=[];
  const context={Package:{SysApiEngines:[structuredClone(incoming)]},debugLog:{},stats:{ApiEngineUpdated:0,ApiEngineInserted:0,ApiEngineSkipped:0,ApiEngineDuplicatesRetired:0},
    trustedOfficialPlatformPackage:true,reportProgress(){},getApiEngineResourcePolicy(){return {UpgradePolicy:policy,Ownership:'Platform'};},
    selectApiEngineIdentityCanonical(rows){assert.equal(rows.length,1);return rows[0];},
    recordApiEngineResourceState(engine,resourcePolicy){states.push({Engine:structuredClone(engine),Policy:resourcePolicy.UpgradePolicy});},
    apiEngineHash(code){return createHash('sha256').update(String(code)).digest('hex');},findPreviousApiEngineState(){return {};},
    parseApiEngineVersion(engine){return engine.Version.slice(1).split('.').map(Number);},
    decideManagedApiEngineUpdate(ownership,base,local,next){return local===next?'Apply':'ApplyPackageManagedOverwrite';},
    normalizeApiEngineModel(){},reclaimApiEngineRoutes(){},removeApiEngineCacheAliases(engine){invalidations.push(engine.Id);},
    applyLiteralSwitchDefaults(){},getNewResourceSwitchDefaults(){return {};},
    refreshApiEngineCache(engineKey,id){assert.equal(engineKey,key);assert.equal(row.Id,id);return structuredClone(row);},
    reconcilePersistedApiEngineFlags(model,actual){return actual;},assertPersistedApiEngine(model,actual){assert.deepEqual(JSON.parse(JSON.stringify(actual)),JSON.parse(JSON.stringify(model)));},
    V8:{OsClient:'isolated-test-tenant',Method:{NewGuid(){return 'new-control-id';}},Db:{FromSql(sql){const parameters={};return {
      AddInParameter(name,value){parameters[name]=value;return this;},
      ToArray(){if(sql==='SELECT * FROM sys_apiengine WHERE Id=@p0')return row&&row.Id===parameters['@p0']?[structuredClone(row)]:[];assert.match(sql,/^SELECT \* FROM sys_apiengine WHERE LOWER\(ApiEngineKey\)=LOWER\(@p0\)/);assert.equal(parameters['@p0'],key);return row?[structuredClone(row)]:[];},
      ExecuteNonQuery(){assert.equal(sql,'UPDATE sys_apiengine SET IsDeleted=0 WHERE Id=@p0');assert.equal(parameters['@p0'],row.Id);row.IsDeleted=0;return 1;}
    };}},FormEngine:{
      UptFormData(table,model){assert.equal(table,'sys_apiengine');assert.equal(model.Id,row.Id);writes.push(structuredClone(model));if(writeFails)return {Code:0,Msg:'fixture storage failure'};row=structuredClone(model);return {Code:1};},
      AddFormData(table,model){assert.equal(table,'sys_apiengine');assert.equal(row,null);writes.push(structuredClone(model));row=structuredClone(model);return {Code:1};}
    }}
  };
  vm.runInNewContext(source.slice(start,end),context,{timeout:1000});
  return {Row:row,Writes:writes,States:states,Invalidations:invalidations,Stats:context.stats,Debug:context.debugLog};
}

for(const [name,version,deleted]of [['older','v1.4.1',0],['same version with drift','v1.4.4',0],['newer local drift','v9.0.0',0],['soft deleted','v1.4.4',1]]){
  test('package Managed control-plane resource overwrites '+name+' at its stable tenant Id',()=>{
    const old={...incoming,Id:'tenant-stable-id',ApiV8Code:'local-drift',Version:version,IsDeleted:deleted};
    const actual=run({existing:old});
    assert.equal(actual.Writes.length,1);assert.equal(actual.Row.Id,old.Id);assert.equal(actual.Row.ApiV8Code,incoming.ApiV8Code);assert.equal(actual.Row.Version,incoming.Version);assert.equal(actual.Row.OsClient,'isolated-test-tenant');assert.equal(actual.Row.IsDeleted,0);assert.equal(actual.Stats.ApiEngineUpdated,1);assert.equal(actual.States.length,1);assert.equal(actual.States[0].Policy,'Managed');assert.deepEqual(actual.Invalidations,[old.Id]);
  });
}
test('Managed control-plane resource creates the declared missing engine',()=>{
  const actual=run();assert.equal(actual.Row.ApiV8Code,incoming.ApiV8Code);assert.equal(actual.Row.Id,incoming.Id);assert.equal(actual.Row.IsDeleted,0);assert.equal(actual.Stats.ApiEngineInserted,1);assert.equal(actual.Writes.length,1);
});
for(const policy of ['LegacyOverwrite','CreateIfMissing'])test('undeclared Managed policy keeps the historical protected control-plane boundary: '+policy,()=>{
  const old={...incoming,Id:'tenant-id',IsDeleted:1,ApiV8Code:'tenant-owned-source'};const actual=run({existing:old,policy});assert.deepEqual(actual.Row,old);assert.equal(actual.Writes.length,0);assert.equal(actual.States.length,0);assert.equal(actual.Invalidations.length,0);
});
test('control-plane Managed storage failure remains a failed import',()=>{
  assert.throws(()=>run({existing:{...incoming,Id:'tenant-id',ApiV8Code:'old',IsDeleted:0},writeFails:true}),/更新接口引擎失败.*fixture storage failure/);
});

const control=await readFile(new URL('./official-resource-api.js',import.meta.url),'utf8');
for(const Action of ['Publish','PublishBatch','ReconcilePublishedApiEngines'])test('installing control-plane source does not grant a foreign tenant official '+Action+' authorization',()=>{
  let checks=0;const denied={Code:0,Msg:'official tenant required'};
  const actual=new vm.Script('(function(){'+control+'\n})()').runInNewContext({V8:{Param:{Action},Method:{AuthorizeOfficialResourcePublish(){checks++;return denied;}}}},{timeout:1000});
  assert.equal(actual,denied);assert.equal(checks,1);
});

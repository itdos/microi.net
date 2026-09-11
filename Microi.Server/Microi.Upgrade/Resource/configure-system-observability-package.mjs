import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const dir=import.meta.dirname;
// 官方母版元数据与共享运行时分别维护；禁止在监控包中冻结一份旧微服务源码或 dist。
const model=JSON.parse(await fs.readFile(path.join(dir,'system-observability-package-source.json'),'utf8'));
const saas=JSON.parse(await fs.readFile(path.join(dir,'app.microi.saas-engine.json'),'utf8'));
const runtime=saas.ApplicationBundles.filter(x=>x.Application?.AppKey==='microi-platform-service');
assert.equal(runtime.length,1);assert.equal(runtime[0].IncludeSource,false);
assert.equal(runtime[0].AssetStoragePolicy.Build,'DatabaseOnly');
model.ApplicationBundles=structuredClone(runtime);
Object.assign(model.PackageInfo,{MenuCount:model.SysMenus.length,TableCount:model.DiyTables.length,
 FieldCount:model.DiyFields.length,DDLCount:model.DDLStatements.length,PhysicalColumnCount:model.PhysicalColumns.length,
 ApiEngineCount:model.SysApiEngines.length,AiApplicationCount:1,DataSetCount:(model.DataSets||[]).length,DataRowCount:0});
const out=path.join(dir,'app.microi.sys-log.json'),content=JSON.stringify(model,null,2)+'\n';
if(process.argv.includes('--verify-only'))assert.equal(await fs.readFile(out,'utf8'),content,'系统日志包与官方母版事实源/共享运行时不同，请重新生成并升应用包版本');
else {
  let previous;try{previous=JSON.parse(await fs.readFile(out,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  if(previous && JSON.stringify(previous)!==JSON.stringify(model)){
    const parts=v=>String(v).replace(/^v/,'').split('.').map(Number);
    const a=parts(model.PackageInfo.Version),b=parts(previous.PackageInfo.Version);
    const differing=a.findIndex((n,i)=>n!==b[i]);
    const refresh=process.argv.includes('--refresh-candidate') && model.PackageInfo.Version===previous.PackageInfo.Version;
    assert.ok(refresh||(differing>=0&&a[differing]>b[differing]),'系统日志包正文变化必须先在母版事实源提高版本；未发布同版候选需明确 --refresh-candidate');
  }
  await fs.writeFile(out,content);
}
console.log(JSON.stringify({package:out,version:model.PackageInfo.Version,runtimeVersion:runtime[0].VersionNo,distHash:runtime[0].MicroService.DistHash,bytes:Buffer.byteLength(content),verified:process.argv.includes('--verify-only')}));

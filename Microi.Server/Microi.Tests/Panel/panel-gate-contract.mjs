import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,relative} from 'node:path';

export const requiredStages=['unit','core','acme','legacy','linux'];
export const legacyScripts=['docker-e2e.mjs','platform-protocol.e2e.mjs','registry-scheduler.e2e.mjs','platform-login.e2e.mjs','https-proxy.e2e.mjs','bootstrap.e2e.mjs','browser-smoke.mjs','platform-menu.e2e.mjs'];
export const requiredPluginChecks=['install-healthy-pinned-image','real-authenticated-business-probe','restart-and-persistence','stop-start-business-readback','uninstall-preserves-volume','reinstall-same-image-and-preserved-business-data'];
export const backupFamilies=['mysql','postgresql','sqlserver','oracle','redis','mongodb','minio'];
export const sha256=value=>createHash('sha256').update(value).digest('hex');
// ASP.NET 静态资源清单记录每次构建的文件修改时间。只允许这个已识别的生成时间差异；
// 路由、响应语义、ETag、完整性和实际资源字节继续严格比较，不允许忽略整个生成文件。
export function compareGeneratedEndpoints(actual,expected){
 const times=[];
 function normalize(value,side){
  const copy=structuredClone(value);assert.equal(copy.ManifestType,'Publish');assert(Array.isArray(copy.Endpoints)&&copy.Endpoints.length>0);
  for(const item of copy.Endpoints){
   assert(typeof item.AssetFile==='string'&&!item.AssetFile.split('/').includes('..'));
   const header=item.ResponseHeaders?.find(h=>h.Name==='Last-Modified');assert(header,'Missing static asset Last-Modified');
   assert.equal(new Date(header.Value).toUTCString(),header.Value,'Invalid generated HTTP timestamp');
   times.push({side,assetFile:item.AssetFile,lastModified:header.Value});header.Value='<verified build timestamp>';
  }return copy;
 }
 assert.deepEqual(normalize(actual,'image'),normalize(expected,'source'),'Static asset manifests differ beyond build timestamps');
 return times;
}
export async function fingerprintPanelSource(root){
 const inputs=['Microi.Server/Microi.Panel','Microi.Server/Microi.Tests/Panel','Microi.UI/src','Microi.UI/package.json','数据库、案例、文档、资料/install-microi-panel.sh'];
 const files=[];
 async function collect(path){
  const {stat}=await import('node:fs/promises');const info=await stat(path);
  if(info.isDirectory())for(const entry of await readdir(path,{withFileTypes:true})){
   if(entry.isDirectory()&&/^(bin|obj|node_modules|dist|wwwroot|TestResults|\.git)$/.test(entry.name))continue;
   if(entry.isSymbolicLink())throw Error('Source fingerprint rejects symbolic links: '+path+'/'+entry.name);
   if(entry.isDirectory()||entry.isFile())await collect(resolve(path,entry.name));
  }else files.push({path:relative(root,path).replaceAll('\\','/'),sha256:sha256(await readFile(path)),size:info.size});
 }
 for(const input of inputs)await collect(resolve(root,input));
 files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
 return {sha256:sha256(files.map(x=>`${x.path}\t${x.sha256}\t${x.size}`).join('\n')),files};
}
export function verifyPanelGate(receipts,{sourceHash,imageId,catalog}){
 assert.match(sourceHash,/^[a-f0-9]{64}$/);assert.match(imageId,/^sha256:[a-f0-9]{64}$/);
 for(const receipt of receipts){assert.equal(receipt.completed,true,'Incomplete stage: '+receipt.stage);assert.equal(receipt.sourceHash,sourceHash,'Source changed since '+receipt.stage);assert.equal(receipt.imageId,imageId,'Candidate image mismatch: '+receipt.stage);assert(receipt.checks>0,'Zero checks in '+receipt.stage);assert.equal(receipt.failed,0);assert.equal(receipt.skipped,0);}
 for(const stage of requiredStages)assert.equal(receipts.filter(r=>r.stage===stage).length,1,'Missing or duplicated stage: '+stage);
 const unit=receipts.find(r=>r.stage==='unit');assert(unit.counts.csharp>0&&unit.counts.node>0&&unit.counts.legacy>0,'Unit coverage is incomplete');
 const core=receipts.find(r=>r.stage==='core');assert(core.counts.docker>=24&&core.counts.browser>=9&&core.counts.platformEntry>=5,'Core behavior coverage is incomplete');
 assert(receipts.find(r=>r.stage==='acme').checks>=5,'Real ACME coverage is incomplete');
 const legacy=receipts.find(r=>r.stage==='legacy');assert.deepEqual([...legacy.scripts].sort(),[...legacyScripts].sort(),'Legacy protocol suite is incomplete');
 const linux=receipts.find(r=>r.stage==='linux');
 assert.deepEqual([...linux.installOrders].sort(),['baota-onepanel-panel','panel-baota-onepanel']);assert.equal(linux.realThirdPartyPanels,true);assert.equal(linux.rebootVerified,true);
 const expected=catalog.flatMap(plugin=>plugin.versions.map((version,index)=>({key:plugin.id+':'+version.id,backup:index===0&&backupFamilies.includes(plugin.id)})));
 assert(expected.length>0,'Actual candidate catalog is missing');
 const plugins=receipts.filter(r=>r.stage.startsWith('plugins')).flatMap(r=>r.results||[]);
 assert.equal(plugins.length,expected.length,'Plugin version coverage differs from the actual catalog');
 assert.equal(new Set(plugins.map(x=>x.plugin+':'+x.version)).size,expected.length,'Plugin versions were duplicated across shards');
 for(const item of expected){const result=plugins.find(x=>x.plugin+':'+x.version===item.key);assert(result?.success,'Missing successful real plugin: '+item.key);for(const check of requiredPluginChecks)assert(result.checks.includes(check),item.key+' is missing '+check);if(item.backup)for(const check of ['cold-backup-and-resume','new-volume-restore-and-old-volume-preserved','backup-file-deletion'])assert(result.checks.includes(check),item.key+' is missing '+check);}
 return {completed:true,sourceHash,imageId,stages:receipts.length,pluginVersions:expected.length,checks:receipts.reduce((sum,r)=>sum+r.checks,0),failed:0,skipped:0};
}

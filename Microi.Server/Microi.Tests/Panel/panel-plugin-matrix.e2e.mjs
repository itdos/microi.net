// Real Linux Docker acceptance for every published plugin version; each instance belongs to this run.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import {freemem,totalmem} from 'node:os';
import {createPluginProbe} from './panel-plugin-probes.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const {request}=createRequire(resolve(root,'Microi.Client/package.json'))('@playwright/test');
const run=process.env.PANEL_MATRIX_RUN_ID||'panel-matrix-'+new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
assert(/^[a-z][a-z0-9-]{5,60}$/.test(run),'Invalid isolated matrix run id');
const work=resolve(process.env.PANEL_TEST_RESULTS||resolve(root,'.tmp/panel-acceptance'),run),labelKey='io.microi.panel.test';
const selectedIds=process.env.PANEL_PLUGIN_IDS?.split(',').filter(Boolean);
const basePort=Number(process.env.PANEL_MATRIX_PORT||61990),servicePort=basePort+10,base=`http://localhost:${basePort}`;
const panelImage=process.env.PANEL_TEST_IMAGE||'microi-panel:dev-20260910';
const admin='matrix-test',adminPassword=randomBytes(30).toString('base64url');
const results=[];let context,csrf='',owner='',catalog=[],panelImageId='';
function memoryGuard(){assert(freemem()>=Math.max(1.5*1024**3,totalmem()*0.05),'Host memory guard: below max(1.5 GiB, 5%) reserve; preserve the operation and stop this fixture');}
function docker(args,options={}){
 try{return execFileSync('docker',args,{cwd:root,windowsHide:true,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:4*1024*1024,...options}).trim();}
 catch(e){throw Error(`Docker ${args[0]} failed: ${String(e.stderr||e.stdout||e.message).slice(-1400)}`);}
}
const inspect=name=>JSON.parse(docker(['inspect',name]))[0];
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,title,seconds=120){const deadline=Date.now()+seconds*1000;while(Date.now()<deadline){memoryGuard();const value=await fn();if(value)return value;await delay(1500);}throw Error(title);}
async function api(path,data,expected=data===undefined?200:202){const response=await context.fetch('/ops-api/'+path,{method:data===undefined?'GET':'POST',data,headers:{Origin:base,'X-Ops-CSRF':csrf}});const body=await response.text();assert.equal(response.status(),expected,`${path}: ${response.status()} ${body.slice(0,1000)}`);return body?JSON.parse(body):{};}
async function completed(operation){return until(async()=>{const task=await api('panel/operations/'+operation.id);if(task.state==='Failed')throw Error(JSON.stringify(task));return task.state==='Succeeded'?task:false;},'Plugin operation did not finish: '+operation.id,2700);}
async function action(id,action){await completed(await api(`panel/resources/${id}/actions`,{requestId:randomUUID(),confirm:id,action}));}
async function resource(id){return(await api('panel/snapshot')).resources.find(x=>x.id===id);}
function owned(container){assert.equal(container.Config.Labels['io.microi.panel.owner'],owner);return container;}
const probe=createPluginProbe({docker,servicePort});
await mkdir(work,{recursive:true});await writeFile(resolve(work,'panel.env'),`OPS_ADMIN_USERNAME=${admin}\nOPS_ADMIN_PASSWORD=${adminPassword}\nOPS_PUBLIC_URL=${base}\n`);
try{
 memoryGuard();
 assert.equal(docker(['ps','-q','--filter','label=io.microi.panel.controller=true']),'','Another Panel controller is running on this Docker Engine');
 assert.equal(docker(['ps','-q','--filter','label=io.microi.ops.controller=true']),'','Another Ops controller is running on this Docker Engine');
 panelImageId=JSON.parse(docker(['image','inspect',panelImage]))[0].Id;
 docker(['volume','create','--label',`${labelKey}=${run}`,run+'-data']);
 docker(['run','-d','--name',run,'--label',`${labelKey}=${run}`,'--memory','512m','--cpus','1','--env-file',resolve(work,'panel.env'),'-p',`127.0.0.1:${basePort}:8080`,'-v','/var/run/docker.sock:/var/run/docker.sock','-v',run+'-data:/microi/ops/data',panelImageId]);
 context=await request.newContext({baseURL:base,timeout:30000});await until(async()=>{try{return(await context.get('/health')).ok();}catch{return false;}},'Panel startup');
 csrf=(await api('session')).csrfToken;await api('login',{account:admin,password:adminPassword},200);csrf=(await api('session')).csrfToken;
 owner=(await api('panel/snapshot')).ownerId;catalog=await api('panel/catalog');
 if(selectedIds){assert(selectedIds.length>0&&new Set(selectedIds).size===selectedIds.length);for(const id of selectedIds)assert(catalog.some(p=>p.id===id),'Unknown plugin shard: '+id);}
 const selectedCatalog=selectedIds?catalog.filter(p=>selectedIds.includes(p.id)):catalog;
 await writeFile(resolve(work,'catalog.json'),JSON.stringify(catalog,null,2));
 await writeFile(resolve(work,'context.json'),JSON.stringify({run,work,owner,base,basePort,panelImage,panelImageId},null,2));
 // 分片只控制这一轮进程的资源峰值；发布门禁仍须合并实际目录的全部版本，缺一即失败。
 for(const plugin of selectedCatalog){
  for(const [index,version] of plugin.versions.entries()){
   const id=plugin.id+'-v'+(index+1),password='Pa9!'+randomBytes(24).toString('base64url'),started=Date.now(),checks=[];
   let item;
   const result={plugin:plugin.id,version:version.id,instance:id,checks,success:false};results.push(result);
   try{
    const ports=Object.fromEntries(plugin.ports.map((port,index)=>[port.name,servicePort+index]));
    const install={requestId:randomUUID(),name:id,confirm:id,pluginId:plugin.id,version:version.id,password,username:'paneltest',database:'microi',edition:'Developer',acceptLicense:true,ports};
    const operation=await api('panel/install',install);await completed(operation);item=await resource(id);
    const actual=owned(inspect(item.containerName));assert.equal(actual.State.Health.Status,'healthy');assert.equal(actual.HostConfig.Privileged,false);assert.equal(actual.Mounts.find(x=>x.Name===item.volumeName)?.Destination,plugin.dataPath);
    checks.push('install-healthy-pinned-image');result.digest=item.digest;result.imageId=item.imageId;result.architecture=JSON.parse(docker(['image','inspect',item.imageId]))[0].Architecture;
    await probe(plugin,item,password,'write');checks.push('real-authenticated-business-probe');
    await action(id,'Restart');await probe(plugin,await resource(id),password);checks.push('restart-and-persistence');
    // One complete cold restore per database/object-store family; every selectable version still runs a real restart/data check.
    if(index===0 && ['mysql','postgresql','sqlserver','oracle','redis','mongodb','minio'].includes(plugin.id)){
     const backupOp=await api(`panel/resources/${id}/backups`,{requestId:randomUUID(),confirm:id,allowInterruption:true,maximumGiB:10});await completed(backupOp);
     const backup=(await api('panel/backups')).find(x=>x.id===backupOp.id);assert.equal(backup.state,'Ready');assert(backup.size>0);checks.push('cold-backup-and-resume');
     await probe(plugin,item,password,'change');
     const restoreOp=await api(`panel/resources/${id}/restore`,{requestId:randomUUID(),confirm:id,backupId:backup.id,allowInterruption:true});await completed(restoreOp);
     const restored=await resource(id);assert.notEqual(restored.volumeName,item.volumeName);assert.equal(owned(inspect(item.containerId)).State.Running,false);await probe(plugin,restored,password);checks.push('new-volume-restore-and-old-volume-preserved');item=restored;
     await completed(await api(`panel/backups/${backup.id}/delete`,{requestId:randomUUID(),confirm:backup.id}));checks.push('backup-file-deletion');
    }
    await action(id,'Stop');assert.equal(owned(inspect(item.containerName)).State.Running,false);await action(id,'Start');await probe(plugin,item,password);checks.push('stop-start-business-readback');
    await action(id,'Uninstall');assert.equal(docker(['ps','-aq','--filter','name=^/'+item.containerName+'$']),'');const volume=JSON.parse(docker(['volume','inspect',item.volumeName]))[0];assert.equal(volume.Labels['io.microi.panel.owner'],owner);checks.push('uninstall-preserves-volume');
    await action(id,'Reinstall');const reinstalled=await resource(id);assert.equal(reinstalled.volumeName,item.volumeName);assert.equal(reinstalled.imageId,item.imageId);await probe(plugin,reinstalled,password);checks.push('reinstall-same-image-and-preserved-business-data');
    await action(id,'Uninstall');
    result.success=true;console.log(`PASS ${plugin.id} ${version.id}: ${checks.join(', ')}`);
   }catch(error){result.error=String(error.message).replaceAll(password,'<redacted>');console.error(`FAIL ${plugin.id} ${version.id}: ${result.error}`);
    // Never run another plugin while a timed-out operation could still mutate this host.
    const active=(await api('panel/snapshot')).operations.find(x=>x.resourceId===id&&['Running','Queued'].includes(x.state));if(active)throw error;
    item=await resource(id);if(item?.containerId){const actual=owned(inspect(item.containerId));if(actual.State.Running)docker(['stop','--time','60',actual.Id]);}
   }finally{result.seconds=Math.round((Date.now()-started)/1000);await writeFile(resolve(work,'report.json'),JSON.stringify({run,owner,panelImageId,results,completed:false},null,2));}
  }
 }
 const expected=selectedCatalog.reduce((total,item)=>total+item.versions.length,0);assert(expected>0);assert.equal(results.length,expected);assert(results.every(x=>x.success),'At least one plugin version failed; see report');
 await writeFile(resolve(work,'report.json'),JSON.stringify({run,owner,panelImageId,selectedIds:selectedCatalog.map(x=>x.id),results,completed:true},null,2));
}finally{
 await context?.dispose();
 if(docker(['ps','-aq','--filter','name=^/'+run+'$'])){
  const panel=inspect(run);assert.equal(panel.Config.Labels[labelKey],run);if(panel.State.Running)docker(['stop',run]);
 }
 // Stop only this fixture after its controller has checkpointed; keep all containers, jobs and volumes for diagnosis/recovery.
 if(owner)for(const id of docker(['ps','-q','--filter',`label=io.microi.panel.owner=${owner}`]).split(/\s+/).filter(Boolean)){
  const container=owned(inspect(id));if(container.State.Running)docker(['stop','--time','60',container.Id]);
 }
 console.log('Report '+resolve(work,'report.json'));
}

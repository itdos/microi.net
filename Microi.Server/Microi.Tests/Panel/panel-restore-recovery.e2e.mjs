import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
// 只接受既有专项的明确编号；用于修复后继续原失败任务，防止用新任务掩盖恢复缺陷。
const [run,operationId]=process.argv.slice(2);
assert.match(run||'',/^panel-\d{14}$/);assert.match(operationId||'',/^[a-f0-9]{32}$/);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const work=resolve(root,'.tmp/panel-20260910',run);
const env=Object.fromEntries((await readFile(resolve(work,'panel.env'),'utf8')).trim().split(/\r?\n/).map(line=>{const i=line.indexOf('=');return[line.slice(0,i),line.slice(i+1)];}));
assert(['localhost','127.0.0.1'].includes(new URL(env.OPS_PUBLIC_URL).hostname));
const docker=args=>execFileSync('docker',args,{windowsHide:true,encoding:'utf8'}).trim();
const controller=JSON.parse(docker(['inspect',run]))[0];assert.equal(controller.Config.Labels['io.microi.panel.test'],run);
const {request}=createRequire(resolve(root,'Microi.Client/package.json'))('@playwright/test');
const context=await request.newContext({baseURL:env.OPS_PUBLIC_URL});let csrf='';
async function api(path,data){const result=await context.fetch('/ops-api/'+path,{method:data===undefined?'GET':'POST',data,headers:{Origin:env.OPS_PUBLIC_URL,'X-Ops-CSRF':csrf}});assert(result.ok(),await result.text());return result.json();}
try{
 csrf=(await api('session')).csrfToken;await api('login',{account:env.OPS_ADMIN_USERNAME,password:env.OPS_ADMIN_PASSWORD});csrf=(await api('session')).csrfToken;
 const previous=await api('panel/operations/'+operationId);assert.equal(previous.action,'RestoreBackup');assert.equal(previous.state,'Failed');
 const original=(await api('panel/snapshot')).resources.find(x=>x.id===previous.resourceId);assert.equal(original.pluginId,'redis');
 assert.equal((await api('panel/operations/'+operationId+'/retry',{confirm:operationId})).id,operationId);
 const end=Date.now()+240000;let result;
 do{await new Promise(resolve=>setTimeout(resolve,500));result=await api('panel/operations/'+operationId);if(result.state==='Failed')throw Error(result.error);}while(result.state!=='Succeeded'&&Date.now()<end);
 assert.equal(result.state,'Succeeded');const restored=(await api('panel/snapshot')).resources.find(x=>x.id===previous.resourceId);
 assert.notEqual(restored.volumeName,original.volumeName);assert.equal(docker(['exec',restored.containerName,'redis-cli','GET','panel-test']),'persisted');
 assert.equal(JSON.parse(docker(['inspect',original.containerId]))[0].State.Running,false);
 const report={completed:true,operationId,originalContainer:original.containerId,restoredContainer:restored.containerId,oldVolume:original.volumeName,newVolume:restored.volumeName};
 await writeFile(resolve(work,'restore-recovery-report.json'),JSON.stringify(report,null,2));console.log('PASS same failed restore operation recovers original Redis contents and preserves prior data');
}finally{await context.dispose();}

import * as legacy from './fixture-context.mjs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),work=resolve(root,legacy.work),folder=resolve(work,'bootstrap-runs',randomUUID());
const image=legacy.image;
const expectedVersion=JSON.parse(await readFile(resolve(root,'Microi.Server/Microi.Panel/Client/package.json'),'utf8')).version;
const {request}=createRequire(resolve(root,'Microi.Client/package.json'))('@playwright/test');
const docker=args=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
await mkdir(folder,{recursive:true});await mkdir(resolve(folder,'logs'),{recursive:true});
const command=['run','--rm','--label',legacy.label,'--memory','256m','--cpus','1','-v','/var/run/docker.sock:/var/run/docker.sock','-v',`${folder}:/microi/ops`,'-v',`${resolve(folder,'logs')}:/microi/logs/ops`,
 '-e','OPS_BOOTSTRAP_API_NAME='+legacy.names.api,'-e','OPS_BOOTSTRAP_WEB_NAME='+legacy.names.web,'-e','OPS_BOOTSTRAP_IMAGE='+image,'-e','OPS_HTTP_PORT=61886','-e','OPS_BOOTSTRAP_INITIAL_MODE=Manual',image,'--bootstrap'];
docker(command);
const credentialBytes=await readFile(resolve(folder,'config/ops.env'));const env=credentialBytes.toString();
assert(env.includes('OPS_ADMIN_USERNAME=opsadmin'));assert(env.includes('OPS_TRUSTED_PROXY_IPS='));assert(env.includes('OPS_LOG_DIR=/microi/logs/ops'));assert(env.includes('OPS_PUBLIC_URL=http://localhost:61886'));
assert.throws(()=>docker(command));assert.equal(createHash('sha256').update(await readFile(resolve(folder,'config/ops.env'))).digest('hex'),createHash('sha256').update(credentialBytes).digest('hex'));
const compose=JSON.parse(await readFile(resolve(folder,'docker-compose.yml'),'utf8')),deployment=JSON.parse(await readFile(resolve(folder,'config/deployment.json'),'utf8'));
assert.equal(deployment.services.length,2);assert(deployment.services.find(x=>x.role==='api').readyUrl.includes('platform-ops-readiness'));assert(!deployment.services.find(x=>x.role==='api').allowAutomatic);
const name=legacy.names.bootstrap,service=compose.services['microi-ops'];service.container_name=name;service.labels={'io.microi.ops.test':legacy.run};
assert.equal(service.image,image,'Generated Compose must use the current candidate image');
service.env_file=[resolve(folder,'config/ops.env')];service.volumes=service.volumes.map(v=>v.replace('/microi/ops/config:',resolve(folder,'config')+':').replace('/microi/ops/data:',resolve(folder,'data')+':').replace('/microi/logs/ops:',resolve(folder,'logs')+':'));compose.name='microi-ops-bootstrap-e2e';
const path=resolve(folder,'test-compose.json');await writeFile(path,JSON.stringify(compose));docker(['compose','-f',path,'config','--quiet']);
const context=await request.newContext({baseURL:'http://localhost:61886'});
const originalController=JSON.parse(docker(['inspect',legacy.names.ops]))[0];
assert.equal(originalController.Config.Labels['io.microi.ops.test'],legacy.run);
try{
 // 同一 Docker Engine 只允许一个活动控制器；先停止本轮原控制器，最后恢复原状态。
 if(originalController.State.Running)docker(['stop',legacy.names.ops]);
 docker(['compose','-f',path,'up','-d']);for(let i=0;i<40;i++){try{if((await context.get('/health')).ok())break;}catch{}await new Promise(r=>setTimeout(r,500));}
 assert.equal((await(await context.get('/health')).json()).version,expectedVersion,'Bootstrap browser endpoint must run the candidate version');
 const csrf=(await(await context.get('/ops-api/session')).json()).csrfToken;
 const login=await context.post('/ops-api/login',{data:{account:'opsadmin',password:env.match(/^OPS_ADMIN_PASSWORD=(.*)$/m)[1]},headers:{'X-Ops-CSRF':csrf,Origin:'http://localhost:61886'}});assert(login.ok());
 const snapshot=await(await context.get('/ops-api/snapshot')).json();assert.equal(snapshot.policy.mode,'Manual');assert.equal(snapshot.logDirectory,'/microi/logs/ops');
 await writeFile(resolve(work,'bootstrap-result.json'),JSON.stringify({passed:['Docker bootstrap derives actual API/Web deployment','second bootstrap preserves generated credential','generated Compose starts with independent random login','offline initial policy stays Manual'],logDirectory:snapshot.logDirectory},null,2));
 console.log('PASS Docker bootstrap, generated Compose login, config preservation and offline Manual policy');
}finally{await context.dispose();let c;try{c=JSON.parse(docker(['inspect',name]))[0];}catch{}if(c){assert.equal(c.Config.Labels['io.microi.ops.test'],legacy.run);docker(['rm','-f',name]);}if(originalController.State.Running)docker(['start',legacy.names.ops]);}

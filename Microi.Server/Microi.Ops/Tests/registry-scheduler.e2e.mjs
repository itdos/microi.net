import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..'),work=resolve(root,'.tmp/microi-ops-20260906'),fixture=resolve(work,'private-registry');
// 每轮使用独立持久卷目录；本轮重启继续复用，历史成功任务不能满足新一轮的调度断言。
const runStorage=resolve(work,'registry-runs',randomUUID());
await mkdir(resolve(runStorage,'data'),{recursive:true});await mkdir(resolve(runStorage,'logs'),{recursive:true});
const {request}=createRequire(resolve(root,'Microi.Client/package.json'))('@playwright/test');
const ops='microi-ops-e2e-20260906',web='microi-ops-e2e-web-20260906',registry='microi-ops-e2e-registry-20260906',watch='microi-ops-e2e-watchtower-20260906',label='io.microi.ops.test=20260906';
const repository='127.0.0.1:61884/microi-fixture',docker=args=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const inspect=name=>JSON.parse(docker(['inspect',name]))[0];
function remove(name){let c;try{c=inspect(name);}catch{return;}assert.equal(c.Config.Labels['io.microi.ops.test'],'20260906');docker(['rm','-f',name]);}
async function until(fn,seconds=50){const deadline=Date.now()+seconds*1000;let last;while(Date.now()<deadline){try{const v=await fn();if(v)return v;}catch(e){last=e;}await new Promise(r=>setTimeout(r,700));}throw new Error('Timed out: '+(last?.message||''));}
await mkdir(fixture,{recursive:true});docker(['save','microi-ops-fixture:v2','-o',resolve(fixture,'base.tar')]);
// 使用工作目录下的相对文件名，兼容把 Windows 盘符冒号解释为远程主机的 GNU tar。
execFileSync('tar',['-xf','base.tar'],{cwd:fixture});
const sha=b=>createHash('sha256').update(b).digest('hex');
const blob=async d=>readFile(resolve(fixture,'blobs/sha256',d.replace('sha256:','')));
const put=async b=>{const digest='sha256:'+sha(b);await writeFile(resolve(fixture,'blobs/sha256',sha(b)),b);return{digest,size:b.length};};
let manifest=JSON.parse(await readFile(resolve(fixture,'index.json'),'utf8'));
while(manifest.manifests){const descriptor=manifest.manifests.find(x=>!x.platform||x.platform.architecture==='amd64')||manifest.manifests[0];manifest=JSON.parse(await blob(descriptor.digest));}
const config=JSON.parse(await blob(manifest.config.digest));
function entry(name,data){const h=Buffer.alloc(512);h.write(name);for(const[o,n,v]of[[100,8,420],[108,8,0],[116,8,0],[124,12,data.length],[136,12,0]])h.write(v.toString(8).padStart(n-1,'0')+'\0',o,n);h.fill(32,148,156);h.write('0',156);h.write('ustar\0',257);h.write('00',263);h.write([...h].reduce((a,b)=>a+b,0).toString(8).padStart(6,'0')+'\0 ',148,8);return Buffer.concat([h,data,Buffer.alloc((512-data.length%512)%512)]);}
const layer=Buffer.concat([entry('www/index.html',Buffer.from('microi-ops-fixture-private-v3')),entry('tmp/microi-ops-download-probe',randomBytes(2*1024*1024)),Buffer.alloc(1024)]);
config.rootfs.diff_ids.push('sha256:'+sha(layer));config.history.push({created_by:'Microi.Ops isolated registry regression'});
manifest.config={...manifest.config,...await put(Buffer.from(JSON.stringify(config)))};manifest.layers.push({mediaType:'application/vnd.oci.image.layer.v1.tar+gzip',...await put(gzipSync(layer))});
const descriptor=await put(Buffer.from(JSON.stringify(manifest))),registryPassword=randomBytes(24).toString('base64url');
await writeFile(resolve(fixture,'registry-auth.json'),JSON.stringify({auth:'Basic '+Buffer.from('ops-test:'+registryPassword).toString('base64'),digest:descriptor.digest,mediaType:manifest.mediaType}));
await writeFile(resolve(fixture,'server.mjs'),String.raw`import http from 'node:http';import fs from 'node:fs';const c=JSON.parse(fs.readFileSync('/registry/registry-auth.json'));http.createServer((q,s)=>{if(q.headers.authorization!==c.auth){s.writeHead(401,{'WWW-Authenticate':'Basic realm="Microi Ops test registry"'});return s.end();}const p=new URL(q.url,'http://localhost').pathname;if(p==='/v2/'){s.writeHead(200,{'Docker-Distribution-API-Version':'registry/2.0'});return s.end('{}');}const m=p.match(/^\/v2\/microi-fixture\/(manifests|blobs)\/(.+)$/);if(!m){s.writeHead(404);return s.end();}const digest=m[2]==='v3'?c.digest:m[2],f='/registry/blobs/sha256/'+digest.replace('sha256:','');if(!/^sha256:[0-9a-f]{64}$/.test(digest)||!fs.existsSync(f)){s.writeHead(404);return s.end();}s.writeHead(200,{'Content-Type':m[1]==='manifests'?c.mediaType:'application/octet-stream','Content-Length':fs.statSync(f).size,'Docker-Content-Digest':digest,'Docker-Distribution-API-Version':'registry/2.0'});if(q.method==='HEAD')return s.end();const input=fs.createReadStream(f,{highWaterMark:65536});input.on('data',chunk=>{input.pause();s.write(chunk);setTimeout(()=>input.resume(),80)});input.on('end',()=>s.end());}).listen(5000,'0.0.0.0');`);
const auth={auths:{'127.0.0.1:61884':{auth:Buffer.from('ops-test:'+registryPassword).toString('base64')}}};
await writeFile(resolve(fixture,'ops-registry.json'),JSON.stringify(auth));
const originalDeployment=await readFile(resolve(work,'deployment.json'),'utf8');const env=await readFile(resolve(work,'ops-test.env'),'utf8'),password=env.match(/^OPS_ADMIN_PASSWORD=(.*)$/m)[1];
const spec={id:'ops-registry-test',name:'Private registry scheduler test',watchtowerName:watch,allowedImageRepositories:[repository],services:[{name:web,role:'web',repository,tag:'v3',requireDockerHealth:true,allowAutomatic:true,imageRollbackCompatible:true,readyTimeoutSeconds:15,stopTimeoutSeconds:2}]};
function start(original=false){docker(['run','-d','--name',ops,'--label',label,'--memory','512m','--cpus','1','--env-file',resolve(work,'ops-test.env'),'--network','microi-ops-e2e-network','-p','127.0.0.1:61880:8080',
 '-e','OPS_REGISTRY_CONFIG_FILE='+(original?'':'/etc/microi-ops/registry.json'),'-v','/var/run/docker.sock:/var/run/docker.sock','-v',`${resolve(work,'deployment.json')}:/etc/microi-ops/deployment.json:ro`,'-v',`${resolve(work,'platform.cer')}:/etc/microi-ops/platform.cer:ro`,
 '-v',`${resolve(fixture,'ops-registry.json')}:/etc/microi-ops/registry.json:ro`,'-v',`${original?resolve(work,'data'):resolve(runStorage,'data')}:/microi/ops/data`,'-v',`${original?resolve(work,'logs'):resolve(runStorage,'logs')}:/microi/logs/ops`,'microi-ops:local-20260906']);}
const context=await request.newContext({baseURL:'http://localhost:61880'});let csrf;
async function raw(path,data,method=data?'POST':'GET'){return context.fetch('/ops-api/'+path,{method,data,headers:{'X-Ops-CSRF':csrf||'',Origin:'http://localhost:61880'}});}
async function api(path,data,method){const r=await raw(path,data,method);assert(r.ok(),path+': '+await r.text());const t=await r.text();return t?JSON.parse(t):{};}
const passed=[];const pass=s=>{passed.push(s);console.log('PASS '+s);};
const policy=(mode,start=0,end=0)=>api('policy',{mode,intervalSeconds:60,timeZone:'UTC',windowStartHour:start,windowEndHour:end},'PUT');
try{
 remove(registry);docker(['run','-d','--name',registry,'--label',label,'--memory','128m','--cpus','0.5','-p','127.0.0.1:61884:5000','-v',`${fixture}:/registry:ro`,'node:22-bookworm-slim','node','/registry/server.mjs']);
 await writeFile(resolve(work,'deployment.json'),JSON.stringify(spec));remove(ops);start();docker(['start',web]);
 await until(async()=>(await context.get('/health')).ok());csrf=(await api('session')).csrfToken;await api('login',{account:'ops-test',password});csrf=(await api('session')).csrfToken;await policy('Manual');
 const old=inspect(web),oldVolume=old.Mounts.find(x=>x.Destination==='/data').Name;
 await writeFile(resolve(fixture,'ops-registry.json'),'{}');assert.equal((await raw('plans',{services:[web],targets:{}})).status(),502);await writeFile(resolve(fixture,'ops-registry.json'),JSON.stringify(auth));
 const plan=await api('plans',{services:[web],targets:{}});assert.equal(plan.services[0].targetDigest,descriptor.digest);pass('private registry rejects missing credentials and resolves authenticated digest');
 const download=await api('tasks',{planId:plan.id,fingerprint:plan.fingerprint,requestId:randomUUID(),downloadOnly:true,confirmInterruption:false});
 const prepared=await until(async()=>{const t=await api('tasks/'+download.id);assert(!['Failed','NeedsAttention'].includes(t.state),t.error);return t.state==='Succeeded'&&t;},75);
 assert.equal(inspect(web).Id,old.Id);assert(Object.values(prepared.downloadTotals).some(x=>x>=2*1024*1024));pass('authenticated streamed image download records real bytes without stopping Web');
 await writeFile(resolve(fixture,'Dockerfile.watchtower'),`FROM alpine:3.21\nENTRYPOINT ["sh","-c","trap 'exit 0' TERM; while :; do sleep 1; done"]\n`);
 docker(['build','-f',resolve(fixture,'Dockerfile.watchtower'),'-t','microi-ops-watchtower-fixture:local',fixture]);remove(watch);
 docker(['create','--name',watch,'--label',label,'--stop-timeout','2','--restart','unless-stopped','microi-ops-watchtower-fixture:local','--interval','300',web]);
 await api('watchtower',{confirm:watch,enabled:true});assert(inspect(watch).State.Running);await api('watchtower',{confirm:watch,enabled:false});assert(!inspect(watch).State.Running);pass('registered Watchtower-shaped container starts and stops through scoped Docker control');
 await policy('Notify');assert.equal((await raw('watchtower',{confirm:watch,enabled:true})).status(),409);
 await until(async()=>(await api('snapshot')).policy.lastCheck,75);assert.equal(inspect(web).Id,old.Id);assert((await api('events')).some(x=>x.action==='UpdateAvailable'));pass('Notify records a new image without recreating Web and excludes Watchtower competition');
 const hour=new Date().getUTCHours();await policy('Automatic',(hour+1)%24,(hour+2)%24);const before=(await api('snapshot')).policy.lastCheck;
 await until(async()=>{const p=(await api('snapshot')).policy;return p.lastCheck&&p.lastCheck!==before;},75);assert.equal(inspect(web).Id,old.Id);pass('automatic policy stays outside the maintenance window');
 await policy('Automatic');
 await until(async()=>{const s=await api('snapshot');const task=s.tasks.find(x=>x.actor==='scheduler'&&!x.downloadOnly);if(task&&['Failed','NeedsAttention','RolledBack'].includes(task.state))throw new Error(task.error);return task?.state==='Succeeded';},110);
 assert.equal(await(await fetch('http://localhost:61882')).text(),'microi-ops-fixture-private-v3');assert.equal(inspect(web).Mounts.find(x=>x.Destination==='/data').Name,oldVolume);pass('maintenance-window scheduler replaces Web with authenticated pinned image and preserves volume');
 await policy('Manual');docker(['restart',ops]);await until(async()=>(await context.get('/health')).ok());assert.equal((await api('snapshot')).policy.mode,'Manual');
 const noChange=await api('plans',{services:[web],targets:{}});assert.equal(noChange.services[0].changed,false);pass('disabled automation survives restart and pinned current image has no repeat update');
 await writeFile(resolve(work,'registry-scheduler-result.json'),JSON.stringify({passed,targetDigest:descriptor.digest,downloadBytes:prepared.downloadTotals},null,2));
}finally{await context.dispose();remove(ops);remove(watch);remove(registry);await writeFile(resolve(work,'deployment.json'),originalDeployment);start(true);}

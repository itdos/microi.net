// 用隔离 Pebble CA 验证真实 HTTP-01、严格 TLS、原任务恢复和定时换证，不跳过域名验证。
import assert from 'node:assert/strict';
import {diskGuardMount} from '../../Microi.Panel/Tests/disk-guard-fixture.mjs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const {request}=createRequire(resolve(root,'Microi.Client/package.json'))('@playwright/test');
const run=process.env.PANEL_RUN_ID||'panel-acme-'+new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14),work=resolve(process.env.PANEL_TEST_RESULTS||resolve(root,'.tmp/panel-acceptance'),run);
assert(/^[a-z][a-z0-9-]{5,60}$/.test(run));
const port=Number(process.env.PANEL_ACME_PORT||62100),base=`http://localhost:${port}`,labelKey='io.microi.panel.test';
const panelImage=process.env.PANEL_TEST_IMAGE;
assert(panelImage,'PANEL_TEST_IMAGE must identify the explicitly selected candidate');
assert(work.startsWith(resolve(root,'.tmp')+sep),'ACME fixtures must remain in workspace task scratch');
const caImage='sha256:5080492187bea12909c053d7a2b90a9e95104ef1c82381828e7823db71ce7e54';
const caReference='registry.cn-hangzhou.aliyuncs.com/microios/pebble@'+caImage;
const guardDirectory=process.env.PANEL_HOST_GUARD_DIR||'/run/microi-auth-guard';
assert(/^\/[a-zA-Z0-9/_-]+$/.test(guardDirectory),'The real host guard directory must be an absolute Linux path');
const password=randomBytes(30).toString('base64url'),domain='panel-acme.example.test',passed=[];
let context,csrf='',owner='',gateway,panelImageId='',failure,completed=false,runReserved=false;
const cleanup={containers:[],networks:[],volumes:[],errors:[],passed:false};
function docker(args,options={}){try{return execFileSync('docker',args,{cwd:root,windowsHide:true,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:4*1024*1024,...options}).trim();}catch(e){throw Error(`Docker ${args[0]} failed: ${String(e.stderr||e.message).slice(-1800)}`);}}
const inspect=name=>JSON.parse(docker(['inspect',name]))[0],delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,title,seconds=180){const end=Date.now()+seconds*1000;while(Date.now()<end){const value=await fn();if(value)return value;await delay(1000);}throw Error(title);}
async function api(path,data,expected=data===undefined?200:202){const response=await context.fetch('/ops-api/'+path,{method:data===undefined?'GET':'POST',data,headers:{Origin:base,'X-Ops-CSRF':csrf}});const body=await response.text();assert.equal(response.status(),expected,`${path}: ${response.status()} ${body.slice(0,1200)}`);return body?JSON.parse(body):{};}
async function terminal(operation,success=true){return until(async()=>{const value=await api('panel/operations/'+operation.id);if(!['Failed','Succeeded'].includes(value.state))return false;assert.equal(value.state,success?'Succeeded':'Failed',JSON.stringify(value));return value;},'ACME task did not finish: '+operation.id,360);}
function get(port,path,servername,ca){return new Promise((resolve,reject)=>{const req=(ca?https:http).get({host:'127.0.0.1',port,path,servername,headers:{Host:servername},ca,rejectUnauthorized:true,agent:false,timeout:15000},response=>{let content='';const certificate=ca?response.socket.getPeerCertificate():null;response.on('data',chunk=>content+=chunk);response.on('end',()=>resolve({status:response.statusCode,content,certificate}));});req.on('error',reject);req.on('timeout',()=>req.destroy(Error('HTTP/TLS timeout')));});}
let first,second;
async function save(){await writeFile(resolve(work,'report.json'),JSON.stringify({run,owner,panelImageId,passed,completed,first,second,failure,cleanup,scope:'Real Nginx and local Pebble ACME test CA; no public CA issuance or third-party panel acceptance'},null,2));}
async function pass(name){passed.push(name);console.log('PASS '+name);await save();}
await mkdir(dirname(work),{recursive:true});
await mkdir(work); // 已有 run 目录不能被本轮接管，也不能借其标签取得资源清理权。
await writeFile(resolve(work,'owner.json'),JSON.stringify({run,purpose:'isolated real ACME acceptance',createdAt:new Date().toISOString()},null,2));
try{
 assert.equal(docker(['ps','-q','--filter','label=io.microi.panel.controller=true']),'','Stop only the previous owned test controller before this isolated acceptance');
 assert.equal(docker(['ps','-aq','--filter',`label=${labelKey}=${run}`]),'','The run label is already used');
 assert.equal(docker(['volume','ls','-q','--filter',`label=${labelKey}=${run}`]),'','The run volume label is already used');
 assert.equal(docker(['network','ls','-q','--filter',`label=${labelKey}=${run}`]),'','The run network label is already used');
 panelImageId=JSON.parse(docker(['image','inspect',panelImage]))[0].Id;
 // Docker save/load 保留实际镜像 ID，但可能不保留仓库 RepoDigest 别名；离线加载仍严格核对同一摘要。
 try{docker(['image','inspect',caImage]);}catch{docker(['pull',caReference]);}
 assert.equal(JSON.parse(docker(['image','inspect',caImage]))[0].Id,caImage,'The local CA fixture must match the pinned image');
 runReserved=true;
 docker(['volume','create','--label',`${labelKey}=${run}`,run+'-data']);
 // 凭据仅由子进程环境传递，避免写入命令行、报告或持久 env 文件。
 docker(['run','-d','--name',run,'--label',`${labelKey}=${run}`,'--memory','512m','--cpus','1','-e','OPS_ADMIN_USERNAME','-e','OPS_ADMIN_PASSWORD','-e','OPS_PUBLIC_URL','-p',`127.0.0.1:${port}:8080`,'-v','/var/run/docker.sock:/var/run/docker.sock','--mount',`type=bind,source=${guardDirectory},target=/run/microi-auth-guard,readonly`,...diskGuardMount(docker),'-v',run+'-data:/microi/ops/data',panelImageId],{env:{...process.env,OPS_ADMIN_USERNAME:'acme-test',OPS_ADMIN_PASSWORD:password,OPS_PUBLIC_URL:base}});
 context=await request.newContext({baseURL:base,timeout:30000});await until(async()=>{try{return(await context.get('/health')).ok();}catch{return false;}},'Panel startup');
 csrf=(await api('session')).csrfToken;await api('login',{account:'acme-test',password},200);csrf=(await api('session')).csrfToken;
 owner=(await api('panel/snapshot')).ownerId;
 await writeFile(resolve(work,'context.json'),JSON.stringify({run,work,base,port,owner,panelImage},null,2));
 await terminal(await api('panel/install',{requestId:randomUUID(),name:'gateway',confirm:'gateway',pluginId:'nginx',version:'1.30.4',ports:{http:port+1,https:port+2}}));
 gateway=(await api('panel/snapshot')).resources.find(x=>x.id==='gateway');
 const network=Object.keys(inspect(gateway.containerId).NetworkSettings.Networks)[0];
 let website=await api('panel/nginx/gateway');
 const configuration={sites:[{id:'application',name:'ACME 验收网站',domains:[domain],kind:'Static',enabled:true,httpsPublicPort:port+2,routes:[]}]};
 await terminal(await api('panel/nginx/gateway/publish',{requestId:randomUUID(),confirm:'gateway',expectedRevision:website.revision,configuration}));
 await terminal(await api('panel/nginx/gateway/files',{requestId:randomUUID(),confirm:'index.html',siteId:'application',action:'Write',path:'index.html',contentBase64:Buffer.from('<h1>ACME protocol acceptance</h1>').toString('base64'),expectedHash:'',sourceOperationId:''}));
 assert.match((await get(port+1,'/',domain)).content,/ACME protocol acceptance/);
 docker(['create','--name',run+'-ca','--label',`${labelKey}=${run}`,'--network',network,'--network-alias','pebble','--memory','128m','--cpus','0.5','--cap-drop','ALL','--security-opt','no-new-privileges','-e','PEBBLE_VA_NOSLEEP=1','-p',`127.0.0.1:${port+3}:15000`,caImage,'-config','/test/panel-config.json','-dnsserver','127.0.0.11:53','-strict=true']);
 docker(['cp',run+'-ca:/test/certs/pebble.minica.pem',resolve(work,'pebble-root.pem')]);
 docker(['cp',run+'-ca:/test/config/pebble-config.json',resolve(work,'pebble-config.json')]);
 const fixture=JSON.parse(await readFile(resolve(work,'pebble-config.json'),'utf8'));
 fixture.pebble.httpPort=80;fixture.pebble.tlsPort=443;
 // Pebble randomly chooses a profile when the ACME order does not name one
 // (upstream wfe.NewOrder). Bound every fixture profile, then verify the actual
 // leaf lifetime below; otherwise a six-day profile silently delays this test.
 for(const profile of Object.values(fixture.pebble.profiles))profile.validityPeriod=300;
 await writeFile(resolve(work,'pebble-config.json'),JSON.stringify(fixture));docker(['cp',resolve(work,'pebble-config.json'),run+'-ca:/test/panel-config.json']);docker(['start',run+'-ca']);
 const trust=await readFile(resolve(work,'pebble-root.pem'),'utf8');
 const rootCa=await until(async()=>{try{const value=await get(port+3,'/roots/0','pebble',trust);return value.status===200?value.content:false;}catch{return false;}},'Trusted CA management endpoint');
 website=await api('panel/nginx/gateway');
 const issue={requestId:randomUUID(),resourceId:'gateway',siteId:'application',email:'panel@example.test',provider:'Custom',directoryUrl:'https://pebble:14000/dir',rootCertificatePem:'',autoRenew:false,acceptTerms:true,expectedRevision:website.revision,expectedAcmeRevision:'',confirm:'application'};
 const untrusted=await terminal(await api('panel/acme',issue),false);assert.match(untrusted.error,/certificate|证书|x509/i);assert.equal((await api('panel/certificates')).length,0);
 await pass('untrusted CA is rejected without publishing a certificate or breaking HTTP');
 let registration=(await api('panel/acme'))[0];
 const trustedIssue={...issue,requestId:randomUUID(),rootCertificatePem:trust,expectedAcmeRevision:registration.revision};
 const dnsOperation=await api('panel/acme',trustedIssue);assert.equal((await api('panel/acme',trustedIssue)).id,dnsOperation.id);
 const dnsFailure=await terminal(dnsOperation,false);assert.match(dnsFailure.error,/NXDOMAIN|no such host|DNS problem|could not resolve URL|urn:ietf:params:acme:error:dns/i);
 assert.match((await get(port+1,'/',domain)).content,/ACME protocol acceptance/);
 await pass('real missing DNS validation fails and leaves the original site available');
 // 修正测试域名的 Docker DNS 记录后继续同一持久任务，既有 ACME 账号和请求保持可恢复。
 assert.equal(inspect(gateway.containerId).Config.Labels['io.microi.panel.owner'],owner);
 docker(['network','disconnect',network,gateway.containerId]);docker(['network','connect','--alias',domain,network,gateway.containerId]);
 const retried=await api('panel/operations/'+dnsOperation.id+'/retry',{confirm:dnsOperation.id});assert.equal(retried.id,dnsOperation.id);
 await terminal(retried);first=(await api('panel/certificates'))[0];assert(first?.thumbprint);assert(!JSON.stringify(first).includes('PRIVATE KEY'));
 assert.equal(Date.parse(first.notAfter)-Date.parse(first.notBefore),299000,'The real CA must issue the intended five-minute fixture certificate');
 const firstTls=await get(port+2,'/',domain,rootCa);assert.equal(firstTls.status,200);assert.match(firstTls.content,/ACME protocol acceptance/);
 assert.equal(firstTls.certificate.fingerprint.replaceAll(':',''),first.thumbprint);
 assert.equal(docker(['ps','-aq','--filter','label=io.microi.panel.acme-operation='+dnsOperation.id]),'');
 await pass('same failed task recovers through real HTTP-01 and deploys a trusted SAN certificate');
 // 故意提交无法解析的真实上游，验证 nginx -t 拒绝后旧 HTTPS 仍返回原证书和正文。
 website=await api('panel/nginx/gateway');
 const broken=structuredClone(website.configuration);broken.sites[0].kind='Proxy';broken.sites[0].routes=[{prefix:'/',upstream:'http://missing-upstream.invalid:8080'}];
 await terminal(await api('panel/nginx/gateway/publish',{requestId:randomUUID(),confirm:'gateway',expectedRevision:website.revision,configuration:broken}),false);
 assert.equal((await api('panel/nginx/gateway')).revision,website.revision);
 const preservedTls=await get(port+2,'/',domain,rootCa);assert.equal(preservedTls.status,200);assert.match(preservedTls.content,/ACME protocol acceptance/);assert.equal(preservedTls.certificate.fingerprint.replaceAll(':',''),first.thumbprint);
 await pass('real nginx configuration rejection preserves the active HTTPS site and certificate');
 // 仅在本轮受管容器注入一次 reload 失败：原 Nginx worker 不停止，回滚命令仍执行真实 nginx。
 // 这是明确的故障注入，不能当作第三方面板或任意生产故障均已覆盖。
 assert.equal(inspect(gateway.containerId).Config.Labels['io.microi.panel.owner'],owner);
 const nginxBinary=docker(['exec',gateway.containerId,'sh','-c','command -v nginx']);assert.equal(nginxBinary,'/usr/sbin/nginx');
 const originalBinary='/usr/sbin/nginx.panel-acme-original',failFlag='/tmp/panel-acme-fail-reload';
 const wrapperPath=resolve(work,'nginx-reload-fault.sh');
 await writeFile(wrapperPath,'#!/bin/sh\nif [ "$1" = "-s" ] && [ "$2" = "reload" ] && [ -f '+failFlag+' ]; then\n  rm '+failFlag+'\n  echo "injected reload command failure" >&2\n  exit 71\nfi\nexec '+originalBinary+' "$@"\n');
 let binaryMoved=false;
 try{
  docker(['exec',gateway.containerId,'test','!','-e',originalBinary]);
  docker(['exec',gateway.containerId,'mv',nginxBinary,originalBinary]);binaryMoved=true;
  docker(['cp',wrapperPath,gateway.containerId+':'+nginxBinary]);docker(['exec',gateway.containerId,'chmod','755',nginxBinary]);docker(['exec',gateway.containerId,'touch',failFlag]);
  const reloadFailure=await terminal(await api('panel/nginx/gateway/publish',{requestId:randomUUID(),confirm:'gateway',expectedRevision:website.revision,configuration:website.configuration}),false);
  assert.match(reloadFailure.error,/injected reload command failure/);
  assert.equal((await api('panel/nginx/gateway')).revision,website.revision);
  const recoveredTls=await get(port+2,'/',domain,rootCa);assert.equal(recoveredTls.status,200);assert.match(recoveredTls.content,/ACME protocol acceptance/);assert.equal(recoveredTls.certificate.fingerprint.replaceAll(':',''),first.thumbprint);
 }finally{
  if(binaryMoved){assert.equal(inspect(gateway.containerId).Config.Labels['io.microi.panel.owner'],owner);docker(['exec',gateway.containerId,'mv',originalBinary,nginxBinary]);}
 }
 await pass('injected reload failure rolls back to the verified previous real HTTPS configuration');
 registration=(await api('panel/acme'))[0];
 const enabled=await api('panel/acme/'+registration.id+'/policy',{revision:registration.revision,enabled:true,confirm:registration.id},200);
 await api('panel/acme/'+registration.id+'/policy',{revision:registration.revision,enabled:false,confirm:registration.id},409);
 assert(new Date(enabled.nextCheck)<new Date(first.notAfter),'short-lived certificate must be checked before expiration');
 // 强制重启面板；定时器必须从 SQLite 恢复，而不是依赖测试修改时间或直接触发续期。
 docker(['kill',run]);docker(['start',run]);await until(async()=>{try{return(await context.get('/health')).ok();}catch{return false;}},'Panel restart');
 second=await until(async()=>{const cert=(await api('panel/certificates'))[0];return cert?.thumbprint!==first.thumbprint?cert:false;},'Scheduled ACME renewal did not rotate the certificate',600);
 assert.equal(Date.parse(second.notAfter)-Date.parse(second.notBefore),299000,'Renewal must also use the bounded CA fixture profile');
 const secondTls=await get(port+2,'/',domain,rootCa);assert.equal(secondTls.status,200);assert.equal(secondTls.certificate.fingerprint.replaceAll(':',''),second.thumbprint);
 const renewals=(await api('panel/snapshot')).operations.filter(x=>x.action==='AcmeRenew');assert(renewals.some(x=>x.state==='Succeeded'));
 await pass('automatic renewal survives controller restart and rotates the real HTTPS certificate');
 registration=(await api('panel/acme'))[0];const paused=await api('panel/acme/'+registration.id+'/policy',{revision:registration.revision,enabled:false,confirm:registration.id},200);assert.equal(paused.autoRenew,false);
 const before=(await api('panel/snapshot')).operations.filter(x=>x.action==='AcmeRenew').length;
 await delay(95000);assert.equal((await api('panel/snapshot')).operations.filter(x=>x.action==='AcmeRenew').length,before);
 await pass('paused policy prevents the next due renewal and stale edits are rejected');
 completed=true;
}catch(error){
 failure=String(error.message).replaceAll(password,'[redacted]');throw error;
}finally{
 try{await context?.dispose();}catch(error){cleanup.errors.push('HTTP context: '+error.message);}
 // 成功/失败均回收本轮精确标签资源；先停止控制器避免调度器在清理时创建新任务容器。
 // owner 只来自刚创建的独占数据卷，第三方服务与以前的验收记录不获得清理授权。
 const scopes=runReserved?[[labelKey,run],...(owner?[['io.microi.panel.owner',owner]]:[])]:[];
 for(const [key,value] of scopes){
  try{for(const id of docker(['ps','-aq','--filter',`label=${key}=${value}`]).split(/\s+/).filter(Boolean)){
   const item=inspect(id);assert.equal(item.Config.Labels[key],value);docker(['rm','-f','-v',id]);cleanup.containers.push(id);
  }}catch(error){cleanup.errors.push('containers: '+error.message);}
 }
 for(const kind of ['network','volume'])for(const [key,value] of scopes){
  try{for(const id of docker([kind,'ls','-q','--filter',`label=${key}=${value}`]).split(/\s+/).filter(Boolean)){
   const item=JSON.parse(docker([kind,'inspect',id]))[0];assert.equal(item.Labels[key],value);docker([kind,'rm',id]);cleanup[kind==='network'?'networks':'volumes'].push(id);
  }}catch(error){cleanup.errors.push(kind+': '+error.message);}
 }
 for(const [key,value] of scopes)for(const args of [['ps','-aq'],['network','ls','-q'],['volume','ls','-q']]){
  try{assert.equal(docker([...args,'--filter',`label=${key}=${value}`]),'','Owned resources remain after teardown');}catch(error){cleanup.errors.push('readback: '+error.message);}
 }
 cleanup.passed=cleanup.errors.length===0;if(!cleanup.passed)completed=false;await save();
 console.log('Report '+resolve(work,'report.json'));
 if(!cleanup.passed&&!failure)throw Error('ACME teardown failed: '+cleanup.errors.join('; '));
}

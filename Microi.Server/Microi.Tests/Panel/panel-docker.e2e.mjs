// 真实 Docker 专项验收：只操作本轮标签归属的实例，测试结果不能替代真实第三方面板安装验收。
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import https from 'node:https';
import nodeHttp from 'node:http';

const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { request } = createRequire(resolve(workspace, 'Microi.Client/package.json'))('@playwright/test');
const run = process.env.PANEL_RUN_ID || 'panel-' + new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0,14);
assert(/^[a-z][a-z0-9-]{5,60}$/.test(run));
const work = resolve(process.env.PANEL_TEST_RESULTS || resolve(workspace, '.tmp/panel-acceptance'), run);
const names = { panel: run, fixture: run + '-external' };
const labelKey = 'io.microi.panel.test', label = `${labelKey}=${run}`;
const basePort = Number(process.env.PANEL_TEST_PORT || 61980);
const base = `http://localhost:${basePort}`;
const password = randomBytes(30).toString('base64url');
const admin = 'panel-test';
let context, csrf = '', owner = '', panelImageId = '';
const passed = [];
function docker(args, options = {}) {
  try { return execFileSync('docker', args, { cwd: workspace, windowsHide: true, encoding: 'utf8', stdio: ['ignore','pipe','pipe'], maxBuffer: 4 * 1024 * 1024, ...options }).trim(); }
  catch (e) { throw new Error(`Docker ${args[0]} failed: ${String(e.stderr || e.message).slice(-2500)}`); }
}
const inspect = name => JSON.parse(docker(['inspect', name]))[0];
const pass = title => { passed.push(title); console.log('PASS ' + title); };
async function until(fn, title, seconds = 90) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) { const value = await fn(); if (value) return value; await new Promise(r => setTimeout(r,350)); }
  throw new Error(title);
}
async function api(path, data, expected = 200) {
  const response = await context.fetch('/ops-api/' + path, { method: data === undefined ? 'GET' : 'POST', data, headers: { Origin: base, 'X-Ops-CSRF': csrf } });
  const text = await response.text();
  assert.equal(response.status(), expected, `${path} -> ${response.status()} ${text.slice(0,1800)}`);
  return text ? JSON.parse(text) : {};
}
async function completed(operation, success = true) {
  return until(async () => {
    const result = await api('panel/operations/' + operation.id);
    if (result.state === 'Failed') { if (success) throw new Error(JSON.stringify(result)); return result; }
    if (result.state === 'Succeeded') { assert(success, 'expected failure but operation succeeded'); return result; }
    return false;
  }, 'operation did not reach a terminal state: ' + operation.id, 240);
}
async function http(path = '/', host = 'app.example.test') {
  // Node Fetch 会重写 Host，虚拟主机验收必须使用真实可控的 HTTP Host 请求头。
  return new Promise((resolve, reject) => {
    const req = nodeHttp.get({ host:'127.0.0.1',port:basePort+1,path,headers:{Host:host},agent:false,timeout:10000 }, response => {
      let content=''; response.on('data',chunk=>{content+=chunk;}); response.on('end',()=>resolve({status:response.statusCode,content,location:response.headers.location}));
    }); req.on('timeout',()=>req.destroy(Error('HTTP timeout'))); req.on('error',reject);
  });
}
function tls(cert, path = '/') {
  return new Promise((resolve, reject) => {
    const req = https.get({ host: 'localhost', port: basePort + 2, servername: 'app.example.test', ca: cert, path, headers: { Host: 'app.example.test' }, timeout: 10000 }, res => {
      let body = ''; const authorized = res.socket.authorized; res.on('data', chunk => { body += chunk; }); res.on('end', () => resolve({ status: res.statusCode, body, authorized }));
    }); req.on('timeout', () => req.destroy(Error('HTTPS timeout'))); req.on('error', reject);
  });
}
function certificate() {
  if (process.platform === 'win32') {
    const script = `$key=[System.Security.Cryptography.RSA]::Create(2048)
$request=[System.Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=app.example.test',$key,[System.Security.Cryptography.HashAlgorithmName]::SHA256,[System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
$san=[System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
$san.AddDnsName('app.example.test')
$request.CertificateExtensions.Add($san.Build())
$cert=$request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-1),[DateTimeOffset]::UtcNow.AddDays(7))
@{certificatePem=$cert.ExportCertificatePem();privateKeyPem=$key.ExportPkcs8PrivateKeyPem()} | ConvertTo-Json -Compress`;
    return JSON.parse(execFileSync('pwsh', ['-NoProfile','-Command',script], { windowsHide:true,encoding:'utf8' }));
  }
  execFileSync(process.env.PANEL_TEST_OPENSSL || 'openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',resolve(work,'tls.key'),'-out',resolve(work,'tls.crt'),'-days','7','-subj','/CN=app.example.test','-addext','subjectAltName=DNS:app.example.test'], {stdio:'pipe'});
  return Promise.all([readFile(resolve(work,'tls.crt'),'utf8'),readFile(resolve(work,'tls.key'),'utf8')]).then(([certificatePem,privateKeyPem])=>({certificatePem,privateKeyPem}));
}

await mkdir(work, { recursive: true });
await writeFile(resolve(work, 'panel.env'), `OPS_ADMIN_USERNAME=${admin}\nOPS_ADMIN_PASSWORD=${password}\nOPS_PUBLIC_URL=${base}\n`);
const fixtureImage = 'registry.cn-hangzhou.aliyuncs.com/microios/nginx:1.30.4-alpine';
const panelImage = process.env.PANEL_TEST_IMAGE || 'microi-panel:dev-20260910';
try {
  panelImageId = inspectImage(panelImage);
  docker(['pull',fixtureImage]);
  // 后续 Redis 明确使用离线安装路径，先准备该精确标签，不能依赖另一轮测试留下的镜像缓存。
  docker(['pull','registry.cn-hangzhou.aliyuncs.com/microios/redis:7.4.11']);
  docker(['run','-d','--name',names.fixture,'--label',label,'--memory','128m','-p',`127.0.0.1:${basePort+3}:80`,fixtureImage]);
  const originalFixture = inspect(names.fixture);
  docker(['volume','create','--label',label,run+'-data']); docker(['volume','create','--label',label,run+'-logs']);
  docker(['run','-d','--name',names.panel,'--label',label,'--memory','512m','--cpus','1','--env-file',resolve(work,'panel.env'),'-p',`127.0.0.1:${basePort}:8080`,'-v','/var/run/docker.sock:/var/run/docker.sock','-v',run+'-data:/microi/ops/data','-v',run+'-logs:/microi/logs/ops',panelImageId]);
  context = await request.newContext({ baseURL: base, timeout: 15000 });
  await until(async () => { try { return (await context.get('/health')).ok(); } catch { return false; } },'panel did not start');
  await api('panel/snapshot',undefined,401); pass('anonymous host access is rejected');
  csrf = (await api('session')).csrfToken;
  await api('login',{account:admin,password}); csrf=(await api('session')).csrfToken;
  owner=(await api('panel/snapshot')).ownerId;
  await writeFile(resolve(work,'context.json'),JSON.stringify({run,work,names,base,owner,basePort,panelImage:panelImageId},null,2));
  const forbidden = await context.post('/ops-api/panel/install',{data:{},headers:{Origin:base}}); assert.equal(forbidden.status(),400); pass('mutations require CSRF');
  const crossOrigin = await context.post('/ops-api/panel/install',{data:{},headers:{Origin:'https://untrusted.example.test','X-Ops-CSRF':csrf}}); assert.equal(crossOrigin.status(),403); pass('cross-origin host mutations are rejected');
  const install = { requestId:randomUUID(),name:'gateway',pluginId:'nginx',version:'1.30.4',ports:{http:basePort+1,https:basePort+2},confirm:'gateway' };
  const installed=await api('panel/install',install,202); assert.equal((await api('panel/install',install,202)).id,installed.id);
  await completed(installed); pass('real Nginx install pulls a pinned digest and becomes ready');
  let snapshot=await api('panel/snapshot'); owner=snapshot.ownerId;
  const gateway=snapshot.resources.find(x=>x.id==='gateway'); assert.match(gateway.digest,/^sha256:[a-f0-9]{64}$/); assert(gateway.imageId);
  assert.equal((await http('/','unknown.example.test')).status,404);
  docker(['network','connect','mci-panel-'+owner,names.fixture]);
  const site={id:'main',name:'网站验收',domains:['app.example.test'],kind:'Proxy',routes:[{prefix:'/',upstream:`http://${names.fixture}:80`}]};
  let configuration={sites:[site]}, revision='initial';
  const publish = async (value=configuration, success=true) => {
    const cmd={requestId:randomUUID(),confirm:'gateway',expectedRevision:revision,configuration:value};
    const op=await api('panel/nginx/gateway/publish',cmd,202); await completed(op,success);
    if(success) { assert.equal((await api('panel/nginx/gateway/publish',cmd,202)).id,op.id); revision=(await api('panel/nginx/gateway')).revision; }
    return op;
  };
  await publish(); assert.match((await http()).content,/Welcome to nginx/); pass('published proxy forwards real HTTP traffic and duplicate publish stays idempotent');
  await api('panel/nginx/gateway/publish',{requestId:randomUUID(),confirm:'gateway',expectedRevision:'initial',configuration},409); pass('stale website editor cannot overwrite current config');
  const broken=JSON.parse(JSON.stringify(configuration)); broken.sites[0].routes[0].upstream='http://missing-upstream.invalid:8080';
  await publish(broken,false); assert.match((await http()).content,/Welcome to nginx/); assert.equal((await api('panel/nginx/gateway')).revision,revision); pass('nginx -t failure preserves the active website');
  const cert=await certificate(); const imported=await api('panel/certificates',{id:'site-cert',name:'验收证书',...cert,confirm:'site-cert'});
  assert(!JSON.stringify(imported).includes('PRIVATE KEY')); assert(!JSON.stringify(await api('panel/certificates')).includes('PRIVATE KEY'));
  site.certificateId='site-cert'; site.redirectHttps=true; site.httpsPublicPort=basePort+2;
  await publish(); const redirect=await http(); assert.equal(redirect.status,308); assert.equal(redirect.location,`https://app.example.test:${basePort+2}/`);
  const secure=await tls(cert.certificatePem); assert.equal(secure.status,200); assert.equal(secure.authorized,true); assert.match(secure.body,/Welcome to nginx/); pass('real HTTPS verifies certificate chain, hostname and proxy response');
  configuration.sites.push({id:'static',name:'文件验收网站',domains:['static.example.test'],kind:'Static'}); await publish();
  const fileBase='panel/nginx/gateway/sites/static';
  const fileCommand=async (action,path,content='',expectedHash='',sourceOperationId='',success=true) => {
    const command={requestId:randomUUID(),siteId:'static',action,path,confirm:path,contentBase64:action==='Write'?Buffer.from(content).toString('base64'):'',expectedHash,sourceOperationId};
    const task=await api('panel/nginx/gateway/files',command,202); await completed(task,success);
    assert.equal((await api('panel/nginx/gateway/files',command,202)).id,task.id);return task;
  };
  await fileCommand('Write','index.html','<h1>文件版本一</h1>');
  assert.match((await http('/','static.example.test')).content,/文件版本一/);
  let file=await api(fileBase+'/file?path=index.html');assert.equal(file.editable,true);assert.equal(file.text,'<h1>文件版本一</h1>');
  const originalHash=file.hash;const changed=await fileCommand('Write','index.html','<h1>文件版本二</h1>',file.hash);
  assert.match((await http('/','static.example.test')).content,/文件版本二/);
  const download=await context.get('/ops-api/'+fileBase+'/download?path=index.html');assert.equal(await download.text(),'<h1>文件版本二</h1>');assert.match(download.headers()['content-disposition'],/^attachment/);
  pass('website upload edit download and real static HTTP readback agree');
  await fileCommand('Write','index.html','stale content',originalHash,'',false);assert.match((await http('/','static.example.test')).content,/文件版本二/);
  pass('stale file hash cannot overwrite newer website content');
  file=await api(fileBase+'/file?path=index.html');await fileCommand('Restore','index.html','',file.hash,changed.id);assert.match((await http('/','static.example.test')).content,/文件版本一/);
  file=await api(fileBase+'/file?path=index.html');const removed=await fileCommand('Trash','index.html','',file.hash);
  await api(fileBase+'/file?path=index.html',undefined,404);const history=await api(fileBase+'/history');assert(history.some(x=>x.operationId===removed.id));
  await fileCommand('Restore','index.html','','',removed.id);assert.match((await http('/','static.example.test')).content,/文件版本一/);
  pass('previous file and recycled file restore from persisted history');
  await fileCommand('Mkdir','资源目录');await fileCommand('Write','资源目录/页面.txt','UTF-8 路径');assert.equal((await api(fileBase+'/files?path='+encodeURIComponent('资源目录'))).entries[0].name,'页面.txt');
  await api(fileBase+'/file?path='+encodeURIComponent('../current.conf'),undefined,400);
  docker(['exec',gateway.containerName,'ln','-s','/etc','/srv/panel/sites/static/escape']);
  await api(fileBase+'/file?path=escape/passwd',undefined,400);
  const symlinkOp=await fileCommand('Write','escape/panel-test','forbidden','','',false);assert.match(symlinkOp.id,/^[a-f0-9]{32}$/);
  assert.equal(docker(['exec',gateway.containerName,'test','!','-e','/etc/panel-test']),'');
  pass('Unicode directories work while traversal and symlink escape are rejected');
  const unsafeBackup=await api('panel/resources/gateway/backups',{requestId:randomUUID(),confirm:'gateway',allowInterruption:true,maximumGiB:1},202);
  await completed(unsafeBackup,false);assert.equal(inspect(gateway.containerName).State.Running,true);assert.match((await http('/','static.example.test')).content,/文件版本一/);
  docker(['exec',gateway.containerName,'rm','--','/srv/panel/sites/static/escape']);
  pass('unsafe archive abort resumes original website service');
  const conflict={...install,requestId:randomUUID(),name:'port-conflict',confirm:'port-conflict',ports:{http:basePort+3,https:basePort+5},localOnly:true};
  await completed(await api('panel/install',conflict,202),false); assert.equal(inspect(names.fixture).Id,originalFixture.Id); assert.equal(inspect(names.fixture).State.Running,true); pass('occupied port fails without stopping the external container');
  const resumeCommand={requestId:randomUUID(),confirm:'gateway',expectedRevision:revision,configuration};
  const resume=await api('panel/nginx/gateway/publish',resumeCommand,202); docker(['kill',names.panel]); docker(['start',names.panel]);
  await until(async()=>{try{return(await context.get('/health')).ok();}catch{return false;}},'panel restart');
  await completed(resume); assert.equal((await api('panel/nginx/gateway/publish',resumeCommand,202)).id,resume.id); assert.equal((await tls(cert.certificatePem)).status,200); pass('panel kill and restart preserves session and resumes the same website task');
  const redis={requestId:randomUUID(),name:'cache',pluginId:'redis',version:'7.4.11',password:randomBytes(24).toString('base64url'),ports:{database:basePort+4},localOnly:true,confirm:'cache'};
  await completed(await api('panel/install',redis,202)); const cache=(await api('panel/snapshot')).resources.find(x=>x.id==='cache');
  assert.equal(docker(['exec',cache.containerName,'redis-cli','SET','panel-test','persisted']),'OK');
  await completed(await api('panel/resources/cache/actions',{action:'Restart',requestId:randomUUID(),confirm:'cache'},202)); assert.equal(docker(['exec',cache.containerName,'redis-cli','GET','panel-test']),'persisted'); pass('real Redis restart preserves authenticated data');
  await api('panel/resources/cache/backups',{requestId:randomUUID(),confirm:'cache',allowInterruption:false,maximumGiB:1},400);
  const backupTask=await api('panel/resources/cache/backups',{requestId:randomUUID(),confirm:'cache',allowInterruption:true,maximumGiB:1},202);await completed(backupTask);
  const backup=(await api('panel/backups')).find(x=>x.id===backupTask.id);assert.equal(backup.state,'Ready');assert(backup.size>0);assert.equal(inspect(cache.containerName).State.Running,true);
  const backupResponse=await context.get('/ops-api/panel/backups/'+backup.id+'/download');assert.equal(backupResponse.status(),200);const backupBytes=await backupResponse.body();assert.equal(createHash('sha256').update(backupBytes).digest('hex'),backup.sha256);
  pass('cold Redis backup downloads with matching hash and original service resumes');
  docker(['exec',cache.containerName,'redis-cli','SET','panel-test','after-backup']);
  await completed(await api('panel/resources/cache/restore',{requestId:randomUUID(),backupId:backup.id,confirm:'cache',allowInterruption:true},202));
  const restored=(await api('panel/snapshot')).resources.find(x=>x.id==='cache');assert.notEqual(restored.volumeName,cache.volumeName);assert.notEqual(restored.containerId,cache.containerId);
  assert.equal(docker(['exec',restored.containerName,'redis-cli','GET','panel-test']),'persisted');assert.equal(inspect(cache.containerId).State.Running,false);assert(JSON.parse(docker(['volume','inspect',cache.volumeName]))[0]);
  pass('verified restore switches to a new data volume and preserves original container and data');
  const corruptFile=resolve(work,'corrupt-backup.tar');await writeFile(corruptFile,'tampered backup');docker(['cp',corruptFile,names.panel+':/microi/ops/data/backups/'+backup.id+'.tar']);
  await completed(await api('panel/resources/cache/restore',{requestId:randomUUID(),backupId:backup.id,confirm:'cache',allowInterruption:true},202),false);assert.equal(inspect(restored.containerName).Id,restored.containerId);assert.equal(docker(['exec',restored.containerName,'redis-cli','GET','panel-test']),'persisted');
  await completed(await api('panel/backups/'+backup.id+'/delete',{requestId:randomUUID(),confirm:backup.id},202));assert(!(await api('panel/backups')).some(x=>x.id===backup.id));
  pass('tampered archive is rejected before switching service and explicit deletion removes only that backup');
  const scheduleCommand={id:'nightly-cache',resourceId:'cache',action:'Backup',enabled:true,intervalHours:24,firstRun:new Date(Date.now()+15000).toISOString(),maximumGiB:1,expectedRevision:'',confirm:'nightly-cache',allowInterruption:true};
  await api('panel/schedules',scheduleCommand);docker(['kill',names.panel]);docker(['start',names.panel]);
  await until(async()=>{try{return(await context.get('/health')).ok();}catch{return false;}},'scheduled panel restart');
  const schedule=await until(async()=>{const value=(await api('panel/schedules')).find(x=>x.schedule.id===scheduleCommand.id);return value?.operation?value:false;},'scheduled operation did not enqueue',70);
  await completed(schedule.operation);const scheduledBackup=(await api('panel/backups')).find(x=>x.id===schedule.operation.id);assert.equal(scheduledBackup.state,'Ready');
  assert.equal((await api('panel/snapshot')).operations.filter(x=>x.actor==='scheduler'&&x.action==='Backup').length,1);
  await api('panel/schedules',{...scheduleCommand,enabled:false,expectedRevision:schedule.schedule.revision,firstRun:schedule.schedule.nextRun});
  assert.equal((await api('panel/schedules')).find(x=>x.schedule.id===scheduleCommand.id).schedule.enabled,false);pass('persistent schedule survives panel restart, enqueues once and can be paused');
  await completed(await api('panel/resources/cache/actions',{action:'Uninstall',requestId:randomUUID(),confirm:'cache'},202));
  assert(JSON.parse(docker(['volume','inspect',cache.volumeName]))[0]); pass('uninstall preserves the persistent volume');
  snapshot=await api('panel/snapshot'); assert(!JSON.stringify(snapshot).includes(redis.password)); assert(!JSON.stringify(snapshot).includes('PRIVATE KEY'));
  pass('resource and task readback omits stored credentials');
  const metrics=await until(async()=>{const s=await api('panel/snapshot');return s.containers.find(x=>x.id===gateway.containerId)?.metrics?s:false;},'managed container metrics');
  assert.equal(metrics.dockerAvailable,true);assert(metrics.host.memoryBytes>0);assert(metrics.containers.find(x=>x.id===gateway.containerId).metrics.memoryBytes>0);pass('live host and container resource metrics are read from Docker');
  const offlineName=run+'-offline';docker(['stop',names.panel]);
  try {
    docker(['run','-d','--name',offlineName,'--label',label,'--memory','512m','--env-file',resolve(work,'panel.env'),'-p',`127.0.0.1:${basePort}:8080`,'-v',run+'-data:/microi/ops/data','-v',run+'-logs:/microi/logs/ops',panelImageId]);
    await until(async()=>{try{return(await context.get('/health')).ok();}catch{return false;}},'offline panel startup');
    const offline=await api('panel/snapshot');assert.equal(offline.dockerAvailable,false);assert(offline.resources.some(x=>x.id==='gateway'));assert(offline.operations.length>0);pass('Docker unavailability keeps persistent resources and task history readable');
  } finally {if(inspect(offlineName).Config.Labels[labelKey]!==run)throw Error('Offline test owner mismatch');docker(['stop',offlineName]);docker(['start',names.panel]);}
  await until(async()=>{try{return(await context.get('/health')).ok();}catch{return false;}},'online panel resumed');
  await writeFile(resolve(workspace,'.tmp/panel-20260910/latest-docker-context.json'),JSON.stringify({run,work,names,base,owner,basePort,panelImage},null,2));
} finally {
  await writeFile(resolve(work,'report.json'),JSON.stringify({run,passed,completed:passed.length===24,owner,names,base,panelImageId},null,2));
  await context?.dispose();
  console.log('Report '+resolve(work,'report.json'));
  // 保留当前候选供真实浏览器验收。专项清理器必须逐项检查标签，不能删除其它对话容器。
}
function inspectImage(reference){return JSON.parse(docker(['image','inspect',reference]))[0].Id;}

import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createWriteStream} from 'node:fs';
import {readFile,readdir,mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve,dirname,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {freemem,totalmem} from 'node:os';
import {fingerprintPanelSource,verifyPanelGate,legacyScripts,sha256,compareGeneratedEndpoints} from './panel-gate-contract.mjs';
import {discoverTests,assertTestSummary} from '../run-node-regressions.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const parameters=new Map();
for(let i=2;i<process.argv.length;i+=2){assert(process.argv[i]?.startsWith('--')&&process.argv[i+1],'Every gate option requires a value');parameters.set(process.argv[i].slice(2),process.argv[i+1]);}
const stage=(parameters.get('stage')||'verify').toLowerCase();
assert(['bind','unit','core','acme','plugins','legacy','linux','verify'].includes(stage),'Unknown Panel gate stage');
const directory=resolve(parameters.get('results')||resolve(root,'.tmp/panel-acceptance/gate'));
assert(directory.startsWith(resolve(root,'.tmp')+sep),'Panel gate output must stay in the workspace .tmp directory');
await mkdir(directory,{recursive:true});
const json=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
const save=(file,value)=>writeFile(file,JSON.stringify(value,null,2));
const reserve=Math.max(1.5*1024**3,totalmem()*0.05);
const command=(file,args,options={})=>execFileSync(file,args,{cwd:root,windowsHide:true,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024,...options}).trim();
const docker=args=>command('docker',args);
const stamp=new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
const runId='panel-gate-'+stage+'-'+stamp;
const imageReference=parameters.get('image')||process.env.PANEL_TEST_IMAGE;
assert(imageReference,'Specify --image or PANEL_TEST_IMAGE; never silently select another candidate');
const image=JSON.parse(docker(['image','inspect',imageReference]))[0];
assert.equal(image.Config.Labels['io.microi.panel.controller'],'true');
const imageId=image.Id;
const fingerprint=await fingerprintPanelSource(root);
const bindingFile=resolve(directory,'candidate-binding.json');
let binding;

function stopTree(child){
 if(!child.pid)return;
 if(process.platform==='win32')execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
 else process.kill(-child.pid,'SIGTERM');
}
async function run(name,file,args,{cwd=root,env={}}={}){
 assert(freemem()>reserve+384*1024**2,'Insufficient physical memory for the next serial gate process');
 const path=resolve(directory,name+'.log'),stream=createWriteStream(path);
 const child=spawn(file,args,{cwd,env:{...process.env,...env},windowsHide:true,detached:process.platform!=='win32'});
 let output='',reason='',checking=false;
 child.stdout.on('data',chunk=>{stream.write(chunk);output+=chunk;if(output.length>24*1024**2)output=output.slice(-24*1024**2);});
 child.stderr.on('data',chunk=>{stream.write(chunk);output+=chunk;});
 await save(resolve(directory,name+'-process.json'),{pid:child.pid,startedAt:new Date().toISOString(),file,args,log:path});
 console.log(`START ${name}: PID ${child.pid}; log ${path}`);
 // 子进程树与主机余量由执行入口持续检查；只终止本次启动的树，不按程序名清理共享进程。
 const timer=setInterval(()=>{
  if(checking)return;checking=true;
  try{
   let resident=0;
   if(process.platform==='win32'){
    const script=`$all=Get-CimInstance Win32_Process;$ids=[System.Collections.Generic.HashSet[int]]::new();[void]$ids.Add(${child.pid});do{$added=0;foreach($p in $all){if($ids.Contains([int]$p.ParentProcessId) -and $ids.Add([int]$p.ProcessId)){$added++}}}while($added);[long](($all|Where-Object{$ids.Contains([int]$_.ProcessId)}|Measure-Object WorkingSetSize -Sum).Sum)`;
    resident=Number(command('pwsh',['-NoProfile','-Command',script]));
   }
   stream.write(`\nGATE MEMORY free=${freemem()} tree=${resident}\n`);
   if(freemem()<reserve||resident>totalmem()*0.25){reason='Host/process memory protection stopped this gate; unfinished operations are retained';stopTree(child);}
  }catch(error){reason='Unable to monitor owned process: '+error.message;try{stopTree(child);}catch{}}
  finally{checking=false;}
 },20000);
 const code=await new Promise((resolveExit,reject)=>{child.on('error',reject);child.on('close',resolveExit);}).finally(()=>{clearInterval(timer);stream.end();});
 assert.equal(code,0,`${name} failed (${code}): ${reason||'inspect '+path}\n${output.slice(-2200)}`);
 console.log('PASS '+name);return {output,path};
}
const node=(name,script,env)=>run(name,process.execPath,[resolve(root,script)],{env});
async function evidence(file){const bytes=await readFile(file);return{file:relative(root,file).replaceAll('\\','/'),sha256:sha256(bytes),size:bytes.length};}
async function receipt(value,files){
 assert.equal((await fingerprintPanelSource(root)).sha256,fingerprint.sha256,'Source changed while acceptance was running');
 const result={stage,completed:true,failed:0,skipped:0,sourceHash:fingerprint.sha256,imageId,finishedAt:new Date().toISOString(),...value,evidence:await Promise.all(files.map(evidence))};
 await save(resolve(directory,stage+(stage==='plugins'?'-'+stamp:'')+'-receipt.json'),result);console.log(JSON.stringify({stage,checks:result.checks,completed:true}));
}
async function childReport(parent,prefix){const entries=await readdir(parent,{withFileTypes:true});const matches=entries.filter(e=>e.isDirectory()&&e.name.startsWith(prefix));assert.equal(matches.length,1,'Expected exactly one current-run report '+prefix);return resolve(parent,matches[0].name,'report.json');}
async function cleanup(run,owner){
 // 执行失败也只停止自己的 fixture，保留所有数据卷、任务和镜像供恢复。
 for(const [key,value] of [['io.microi.panel.test',run],['io.microi.ops.test',run],...(owner?[['io.microi.panel.owner',owner]]:[])]){
  for(const id of docker(['ps','-q','--filter',`label=${key}=${value}`]).split(/\s+/).filter(Boolean)){
   const item=JSON.parse(docker(['inspect',id]))[0];assert.equal(item.Config.Labels[key],value);docker(['stop','--time','60',id]);
  }
 }
}
if(stage==='bind'){
 // 候选绑定必须重新从当前源码生成产物，再逐字节比较镜像中的实际 /app；旧 DLL 不能借用新源码成绩。
 await run('bind-ui',process.execPath,['node_modules/vite/bin/vite.js','build'],{cwd:resolve(root,'Microi.Server/Microi.Panel/Client')});
 const publish=resolve(directory,'source-publish');
 await run('bind-publish','dotnet',['publish','Microi.Server/Microi.Panel/Microi.Panel.csproj','-c','Release','-o',publish,'--no-restore','--disable-build-servers','-m:1','-p:UseSharedCompilation=false','-v:minimal']);
 const name=runId+'-artifact';docker(['create','--name',name,'--label','io.microi.panel.test='+runId,imageId]);
 const exported=resolve(directory,'image-publish');await mkdir(exported,{recursive:true});
 try{docker(['cp',name+':/app/.',exported]);}finally{const item=JSON.parse(docker(['inspect',name]))[0];assert.equal(item.Config.Labels['io.microi.panel.test'],runId);docker(['rm',name]);}
 async function manifest(folder){const output=[];async function visit(path){for(const e of await readdir(path,{withFileTypes:true})){const file=resolve(path,e.name);assert(!e.isSymbolicLink());if(e.isDirectory())await visit(file);else output.push({path:relative(folder,file).replaceAll('\\','/'),sha256:sha256(await readFile(file))});}}await visit(folder);return output.sort((a,b)=>a.path.localeCompare(b.path));}
 const files=await manifest(publish),imageFiles=await manifest(exported),generatedTimestamps=[];assert(files.length>10);assert.deepEqual(imageFiles.map(x=>x.path),files.map(x=>x.path),'Candidate contains different files');
 for(const [index,file] of files.entries()){
  const actual=imageFiles[index];if(actual.sha256===file.sha256)continue;
  assert.equal(file.path,'Microi.Panel.staticwebassets.endpoints.json','Current source differs from candidate artifact: '+file.path);
  const timestamps=compareGeneratedEndpoints(await json(resolve(exported,file.path)),await json(resolve(publish,file.path)));
  for(const value of timestamps){const source=value.side==='image'?exported:publish;const asset=resolve(source,'wwwroot',value.assetFile);assert(asset.startsWith(resolve(source,'wwwroot')+sep));assert(Math.abs((await stat(asset)).mtimeMs-Date.parse(value.lastModified))<1000,'Generated timestamp does not match actual artifact file time');}
  generatedTimestamps.push({path:file.path,imageSha256:actual.sha256,sourceSha256:file.sha256,timestamps});
 }
 assert.equal((await fingerprintPanelSource(root)).sha256,fingerprint.sha256,'Source drift during candidate binding');
 binding={completed:true,sourceHash:fingerprint.sha256,imageId,repoDigests:image.RepoDigests,createdAt:new Date().toISOString(),files:imageFiles,sourcePublishFiles:files,generatedTimestamps,sourceFiles:fingerprint.files};
 await save(bindingFile,binding);console.log('PASS candidate code/assets match freshly compiled source: '+files.length+' files; generated timestamp manifests: '+generatedTimestamps.length);process.exit(0);
}
binding=await json(bindingFile);assert.equal(binding.completed,true);assert.equal(binding.sourceHash,fingerprint.sha256,'Candidate source changed; bind/retest the new candidate');assert.equal(binding.imageId,imageId,'Different candidate image');
const environment={PANEL_TEST_IMAGE:imageId,PANEL_TEST_RESULTS:directory,PANEL_RUN_ID:runId,PANEL_MATRIX_RUN_ID:runId,PANEL_LEGACY_RUN_ID:runId};
if(stage==='unit'){
 const trx=resolve(directory,'panel-unit.trx');
 await run('unit-csharp','dotnet',['test','Microi.Server/Microi.Tests/Panel/Microi.Panel.Tests.csproj','-c','Release','--no-restore','--disable-build-servers','-m:1','-p:UseSharedCompilation=false','--results-directory',directory,'--logger','trx;LogFileName=panel-unit.trx']);
 const xml=await readFile(trx,'utf8'),counter=xml.match(/<Counters\b([^>]+)\/>/);assert(counter,'No TRX counters');const values=Object.fromEntries([...counter[1].matchAll(/(\w+)="(\d+)"/g)].map(m=>[m[1],Number(m[2])]));
 assert(values.total>0&&values.total===values.passed&&values.executed===values.total);for(const key of ['failed','error','timeout','aborted','inconclusive','notRunnable','notExecuted','disconnected','warning'])assert.equal(values[key],0,'TRX '+key);
 const nodeFiles=discoverTests(resolve(root,'Microi.Server/Microi.Tests/Panel'));
 const nodeResult=await run('unit-node',process.execPath,['--test','--test-concurrency=1','--test-reporter=tap',...nodeFiles]);const nodeCounts=assertTestSummary(nodeResult.output);
 await run('unit-legacy-build','dotnet',['build','Microi.Server/Microi.Panel/Tests/Microi.Ops.Tests.csproj','-c','Release','--no-restore','--disable-build-servers','-m:1','-p:UseSharedCompilation=false','-v:minimal']);
 const legacy=await run('unit-legacy','dotnet',['Microi.Server/Microi.Panel/Tests/bin/Release/net10.0/Microi.Ops.Tests.dll',resolve(directory,'legacy-unit-'+stamp)]);
 const legacyCount=Number(legacy.output.match(/All (\d+) Ops regression checks passed/)?.[1]);assert(legacyCount>0);
 await receipt({checks:values.total+nodeCounts.tests+legacyCount,counts:{csharp:values.total,node:nodeCounts.tests,legacy:legacyCount}},[trx,nodeResult.path,legacy.path]);
}else if(stage==='core'){
 const work=resolve(directory,runId);let owner;
 try{
  await node('core-docker','Microi.Server/Microi.Tests/Panel/panel-docker.e2e.mjs',environment);
  const context=await json(resolve(work,'context.json'));owner=context.owner;
  await node('core-browser','Microi.Server/Microi.Tests/Panel/panel-browser.e2e.mjs',{...environment,PANEL_BROWSER_CONTEXT:resolve(work,'context.json')});
  const entryDirectory=resolve(directory,runId+'-entry');await node('core-platform-entry','Microi.Server/Microi.Tests/Panel/panel-platform-entry.e2e.mjs',{...environment,PANEL_TEST_RESULTS:entryDirectory});
  const paths=[resolve(work,'report.json'),await childReport(work,'browser-'),await childReport(entryDirectory,'platform-entry-')];const reports=await Promise.all(paths.map(json));for(const r of reports)assert.equal(r.completed,true);assert.equal(reports[0].panelImageId,imageId);
  const counts=Object.fromEntries(['docker','browser','platformEntry'].map((key,i)=>[key,reports[i].passed.length]));await receipt({checks:Object.values(counts).reduce((a,b)=>a+b),counts},paths);
 }finally{if(!owner)try{owner=(await json(resolve(work,'report.json'))).owner;}catch{}await cleanup(runId,owner);}
}else if(stage==='acme'){
 try{await node('acme','Microi.Server/Microi.Tests/Panel/panel-acme.e2e.mjs',environment);const path=resolve(directory,runId,'report.json'),r=await json(path);assert.equal(r.completed,true);await receipt({checks:r.passed.length},[path]);}
 finally{let owner;try{owner=(await json(resolve(directory,runId,'context.json'))).owner;}catch{}await cleanup(runId,owner);}
}else if(stage==='plugins'){
 const ids=parameters.get('plugins');assert(ids,'Specify the exact comma-separated plugin families for this resource-bounded shard');
 try{await node('plugins-'+stamp,'Microi.Server/Microi.Tests/Panel/panel-plugin-matrix.e2e.mjs',{...environment,PANEL_PLUGIN_IDS:ids});
 const path=resolve(directory,runId,'report.json'),r=await json(path);assert.equal(r.completed,true);assert.equal(r.panelImageId,imageId);const catalogPath=resolve(directory,runId,'catalog.json');
 await save(resolve(directory,'candidate-catalog.json'),await json(catalogPath));await receipt({checks:r.results.reduce((sum,x)=>sum+x.checks.length,0),results:r.results},[path,catalogPath]);}
 finally{let owner;try{owner=(await json(resolve(directory,runId,'context.json'))).owner;}catch{}await cleanup(runId,owner);}
}else if(stage==='legacy'){
 const outputNames=['test-result.json','protocol-result.json','registry-scheduler-result.json','platform-result.json','https-proxy-result.json','bootstrap-result.json','browser-result.json','platform-menu-result.json'];
 const paths=[],work=resolve(root,'.tmp/panel-acceptance',runId);let checks=0;
 try{
  // 每轮生成独立证书和私钥，旧协议验收不能依赖历史临时目录里偶然存在的证书。
  await run('legacy-fixture-build','dotnet',['build','Microi.Server/Microi.Panel/Tests/Microi.Ops.Tests.csproj','-c','Release','--no-restore','--disable-build-servers','-m:1','-p:UseSharedCompilation=false','-v:minimal']);
  await run('legacy-fixture-certificate','dotnet',['Microi.Server/Microi.Panel/Tests/bin/Release/net10.0/Microi.Ops.Tests.dll','--certificate',resolve(work,'fixture-tls')]);
  for(const [i,script] of legacyScripts.entries()){
  await node('legacy-'+script.replace('.mjs',''),'Microi.Server/Microi.Panel/Tests/'+script,environment);
  const path=resolve(work,outputNames[i]),report=await json(path);assert.deepEqual(report.errors||[],[]);const count=report.passed?.length||(script==='platform-login.e2e.mjs'&&report.lastSync&&report.pendingEvents===0?1:0);assert(count>0,'Legacy script produced no successful checks: '+script);checks+=count;paths.push(path);
 }await receipt({checks,scripts:legacyScripts},paths);}finally{await cleanup(runId);}
}else if(stage==='linux'){
 const file=parameters.get('linux-evidence');assert(file,'Linux requires real isolated-host evidence for both installation orders');const inputs=await json(resolve(file));
 assert.equal(inputs.length,2);let checks=0;const paths=[resolve(file)];
 for(const input of inputs){
  const path=resolve(input.report),r=await json(path);paths.push(path);assert(r.runId&&r.baseline);
  for(const phase of input.order==='panel-baota-onepanel'?['baseline','after-baota','after-1panel','post-reboot']:['baseline','post-reboot']){const p=r.phases[phase];assert.equal(p?.completed,true,phase);assert(binding.repoDigests.some(d=>d.includes(p.state.imageDigest))||p.state.imageDigest===imageId,'Linux ran a different image');checks+=p.passed.length;}
  for(const browserPath of input.browserReports){const p=await json(resolve(browserPath));assert.equal(p.completed,true);assert.equal(p.runId,r.runId);assert(p.passed.includes('real BaoTa browser login page remains usable'));assert(p.passed.includes('real 1Panel browser login page remains usable'));checks+=p.passed.length;paths.push(resolve(browserPath));}
  assert(input.browserReports.length>=2,'Require browser before and after reboot');
  if(input.order==='baota-onepanel-panel'){
   const neighborPath=resolve(input.neighborReport),n=await json(neighborPath);for(const phase of ['before-panel','after-panel','post-reboot']){assert.equal(n.phases[phase]?.completed,true);checks+=n.phases[phase].passed.length;}assert.notEqual(n.phases['post-reboot'].state.bootId,n.baseline.bootId);paths.push(neighborPath);
   const upgradePath=resolve(input.upgradeReport),u=await json(upgradePath);assert.equal(u.completed,true);assert.equal(u.originalImageId,imageId);assert.equal(u.finalImageId,imageId);assert(u.passed.length>=4);assert.equal(u.installerSha256,sha256(await readFile(resolve(root,'数据库、案例、文档、资料/install-microi-panel.sh'))));checks+=u.passed.length;paths.push(upgradePath);
  }
 }
 await receipt({checks,installOrders:inputs.map(x=>x.order),realThirdPartyPanels:true,rebootVerified:true},paths);
}else if(stage==='verify'){
 const files=(await readdir(directory)).filter(f=>f.endsWith('-receipt.json'));const receipts=await Promise.all(files.map(f=>json(resolve(directory,f))));
 for(const r of receipts)for(const proof of r.evidence){const bytes=await readFile(resolve(root,proof.file));assert.equal(sha256(bytes),proof.sha256,'Acceptance evidence was modified: '+proof.file);assert.equal(bytes.length,proof.size);}
 const result=verifyPanelGate(receipts,{sourceHash:fingerprint.sha256,imageId,catalog:await json(resolve(directory,'candidate-catalog.json'))});
 await save(resolve(directory,'panel-gate-completed.json'),{...result,finishedAt:new Date().toISOString(),binding:await evidence(bindingFile),receipts:await Promise.all(files.map(f=>evidence(resolve(directory,f))))});console.log(JSON.stringify(result));
}

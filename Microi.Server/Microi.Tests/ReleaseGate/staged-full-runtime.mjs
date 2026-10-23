import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../../..');
const check=(value,message)=>{if(!value)throw Error(message);};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const normalized=value=>path.resolve(value).replaceAll('\\','/').replace(/\/$/,'').toLowerCase();
const same=(a,b)=>normalized(a)===normalized(b);
const read=file=>{check(path.isAbsolute(file),'Staged paths must be absolute.');const stat=fs.lstatSync(file);check(stat.isFile()&&!stat.isSymbolicLink(),'Staged files must be ordinary files.');return fs.readFileSync(file);};
const json=file=>JSON.parse(read(file).toString('utf8').replace(/^\uFEFF/,''));
const head=()=>execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',windowsHide:true}).trim();
const write=(file,value)=>{check(path.isAbsolute(file),'Signal must be absolute.');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});};
export function runtimeManifest(runtime){
 const files=fs.readdirSync(runtime).sort().filter(name=>fs.statSync(path.join(runtime,name)).isFile()).map(name=>({name,sha256:hash(read(path.join(runtime,name)))}));
 for(const name of ['Microi.net.Api.dll','Microi.net.Api.exe','Microi.net.Api.deps.json','Microi.net.Api.runtimeconfig.json'])check(files.some(row=>row.name===name),'Fresh Full runtime file is missing: '+name);
 return {files,sha256:hash(JSON.stringify(files))};
}
// The release entry verifies the same storage proof after Full removes its large
// build directory. Keep the exact tested HDFS bytes outside that cleanup scope.
export function preserveHdfsEvidence(runtime,resultsDirectory){
 const bytes=read(path.join(runtime,'Microi.HDFS.dll'));
 const directory=path.join(resultsDirectory,'runtime-evidence');
 fs.mkdirSync(directory,{recursive:true});
 const file=path.join(directory,'Microi.HDFS.dll');
 fs.writeFileSync(file,bytes,{flag:'wx'});
 return {hdfsDllSha256:hash(bytes),hdfsEvidenceFile:file};
}
export function verifyHdfsEvidence(build){
 const expected=path.join(build.resultsDirectory,'runtime-evidence','Microi.HDFS.dll');
 check(typeof build.hdfsEvidenceFile==='string'&&same(build.hdfsEvidenceFile,expected),'HDFS evidence must belong to this Full results directory.');
 const digest=hash(read(expected));
 check(digest===build.hdfsDllSha256,'Preserved Full HDFS evidence changed.');
 const live=path.join(build.runtimeDirectory,'Microi.HDFS.dll');
 if(fs.existsSync(live))check(hash(read(live))===digest,'Live and preserved Full HDFS bytes differ.');
 return digest;
}
export function nativeBridgePorts(credentials){
 const configured=credentials?.nativeBridgePorts;
 if(configured===undefined)return [63960,63962,63963,63964];
 const names=['mysql','redis','mongo','scheduleRedis'];
 check(configured&&typeof configured==='object'&&!Array.isArray(configured)&&JSON.stringify(Object.keys(configured).sort())===JSON.stringify([...names].sort()),'Native bridge profile must declare exactly mysql, redis, mongo and scheduleRedis.');
 const ports=names.map(name=>configured[name]);
 check(ports.every(port=>Number.isInteger(port)&&port>=1024&&port<=65535)&&new Set(ports).size===4,'Native bridge profile ports must be four distinct integers in range.');
 return ports.sort((a,b)=>a-b);
}
function validateCredentialBinding(build,ready,credentials,environment){
 check(credentials.sourceHead===build.sourceHead&&credentials.buildId===build.buildId&&credentials.credentialsRefreshedAt===ready.credentialsRefreshedAt&&Date.parse(credentials.credentialsRefreshedAt)>=Date.parse(build.builtAt),'Fresh login did not occur after the final Full build.');
 for(const name of ['MICROI_TEST_OSCLIENT','MICROI_TEST_CHILD_OSCLIENT','MICROI_TEST_DID'])check(credentials.env[name]===environment[name],'Staged login tenant/device drift: '+name);
}
// 端口仅来自已冻结且由 CLI 校验 ACL/SHA 的凭据 profile；不能从任意继承 env 改验收目标。
// 回执只记录归属；仍重读创建时间、父进程、CWD 与监听端口，防止 PID 复用冒充原协调器。
function validateSupervisor(ready,actual,environment,ports){
 const expected=ready.supervisor,profile=path.dirname(path.dirname(environment.MICROI_TEST_RUNTIME_ENVIRONMENT_FILE||''));
 const expectedExe=path.join(environment.MICROI_DESKTOP_NODE_HOME||'',process.platform==='win32'?'node.exe':'node');
 check(expected&&actual&&expected.pid===ready.supervisorPid&&actual.pid===expected.pid&&actual.parentPid===expected.parentPid&&actual.parentPid>0&&actual.creationDate===expected.creationDate&&actual.commandLine===expected.commandLine&&same(actual.cwd,profile)&&same(expected.cwd,profile)&&same(actual.exe,expectedExe)&&same(expected.exe,expectedExe)&&actual.commandLine.includes(path.join(profile,'runtime-coordinator.mjs')),'Native transport supervisor PID, parent, CWD, executable or command line differs.');
 const ordered=value=>[...(value||[])].sort((a,b)=>a-b);
 check(JSON.stringify(ordered(actual.listeningPorts))===JSON.stringify(ports),'The original native transport supervisor must own exactly the four bridge ports.');
}
export function validateReady(build,ready,credentials,current,environment){
 check(build.schemaVersion===1&&ready.schemaVersion===1&&ready.sourceHead===build.sourceHead&&ready.buildId===build.buildId,'Staged ready receipt belongs to another candidate/build.');
 check(ready.apiDllSha256===build.apiDllSha256&&ready.runtimeManifestSha256===build.runtimeManifestSha256,'Staged runtime DLL or dependency fingerprint differs from the final Full build.');
 validateCredentialBinding(build,ready,credentials,environment);
 check(ready.health?.api===true&&ready.health?.peerApi===true&&ready.health?.frontend===true,'Both APIs and frontend must be healthy before Full.');
 check(ready.processes?.length===3&&new Set(ready.processes.map(row=>row.pid)).size===3,'Staged runtime requires three distinct owned processes.');
 check(typeof ready.task==='string'&&ready.task.length>0&&ready.attempt===path.basename(path.dirname(environment.MICROI_TEST_RUNTIME_BUILD_FILE||''))&&!ready.processes.some(row=>row.pid===ready.supervisorPid),'Staged runtime task, attempt or supervisor identity differs.');
 validateSupervisor(ready,current.find(row=>row.pid===ready.supervisorPid),environment,nativeBridgePorts(credentials));
 const specs=[['api',environment.MICROI_TEST_API_BASE,'Microi.Server/Microi.net.Api'],['peerApi',environment.MICROI_TEST_PEER_API_BASE,'Microi.Server/Microi.net.Api'],['frontend',environment.MICROI_TEST_FRONTEND_BASE,'Microi.Client']];
 for(const [kind,url,cwd]of specs){
  const records=ready.processes.filter(row=>row.kind===kind);check(records.length===1,'Missing staged process role.');const record=records[0],actual=current.find(row=>row.pid===record.pid),port=Number(new URL(url).port);
  check(actual&&actual.parentPid===ready.supervisorPid&&actual.creationDate===record.creationDate&&actual.commandLine===record.commandLine&&same(actual.exe,record.exe)&&same(actual.cwd,path.join(root,cwd))&&same(record.cwd,path.join(root,cwd))&&actual.listeningPorts?.includes(port),'Owned runtime PID, CWD, command line, executable or listening port differs.');
  if(kind!=='frontend')check(same(actual.exe,path.join(build.runtimeDirectory,'Microi.net.Api.exe'))&&actual.commandLine.includes('--contentRoot'),'API did not start from the final Full runtime.');
 }
 for(const name of ['MICROI_TEST_TOKEN','MICROI_TEST_CHILD_TOKEN'])check(typeof credentials.env[name]==='string'&&credentials.env[name].length>=20,'Fresh staged login token is missing.');
 return {MICROI_TEST_TOKEN:credentials.env.MICROI_TEST_TOKEN,MICROI_TEST_CHILD_TOKEN:credentials.env.MICROI_TEST_CHILD_TOKEN};
}
// Full 完成后退出加载 DLL 的双 API 和 Vite，释放发行构建文件锁；四个原生依赖桥保留给加密后冒烟。
// “已停止”回执不能代替实时 PID 不存在及原协调器仍持有桥接端口的独立核验。
export function validateTransportOnly(build,ready,transport,supervisor,remaining,environment,accepted,receiptSha256,credentials){
 check(build.schemaVersion===1&&ready.schemaVersion===1&&transport.schemaVersion===1&&ready.sourceHead===build.sourceHead&&ready.buildId===build.buildId&&transport.sourceHead===build.sourceHead&&transport.buildId===build.buildId,'Transport-only receipt belongs to another candidate/build.');
 check(transport.task===ready.task&&transport.attempt===ready.attempt&&ready.attempt===path.basename(path.dirname(environment.MICROI_TEST_RUNTIME_BUILD_FILE||''))&&transport.supervisorPid===ready.supervisorPid&&transport.ownerPid===ready.supervisor?.parentPid&&transport.phase==='TransportOnlyForEncryptedSmoke'&&transport.runtimeStopped===true,'Transport-only task, attempt or owner differs.');
 check(accepted?.accepted===true&&accepted.sourceHead===build.sourceHead&&accepted.runtimeBuildId===build.buildId&&/^[a-f0-9]{64}$/.test(receiptSha256)&&transport.fullReceiptSha256===receiptSha256&&Number.isFinite(Date.parse(transport.at))&&Date.parse(transport.at)>=Date.parse(accepted.verifiedAt),'Transport-only proof predates or differs from the accepted Full receipt.');
 check(ready.processes?.length===3&&new Set(ready.processes.map(row=>row.pid)).size===3&&Array.isArray(remaining)&&remaining.length===0,'Owned API/Vite PIDs must independently be absent before PrepareRelease.');
 check(transport.cleanup?.length===3&&ready.processes.every(process=>transport.cleanup.filter(row=>row.kind===process.kind&&row.pid===process.pid&&(row.stopped===true||row.alreadyExited===true)).length===1),'Transport-only proof is missing an owned runtime exit.');
 if(credentials!==undefined)validateCredentialBinding(build,ready,credentials,environment);
 const ports=nativeBridgePorts(credentials);
 check(JSON.stringify([...(transport.retainedBridgePorts||[])].sort((a,b)=>a-b))===JSON.stringify(ports),'Transport-only bridge port scope differs.');
 validateSupervisor(ready,supervisor,environment,ports);return true;
}
export async function waitForTransportOnly(file,failedFile,timeoutMs=60000,pollMs=100){
 const deadline=Date.now()+timeoutMs;
 while(true){
  check(!failedFile||!fs.existsSync(failedFile),'Owned staged runtime failed before the PrepareRelease transport barrier.');
  if(fs.existsSync(file))return;
  check(Date.now()<deadline,'PrepareRelease transport barrier timed out.');await delay(pollMs);
 }
}
export function processIdentities(processIds,{allowMissing=false}={}){
 const args=['-NoProfile','-File',path.join(here,'read-staged-runtime-identity.ps1'),'-ProcessIds',processIds.join(','),'-WorkspaceRoot',root];if(allowMissing)args.push('-AllowMissing');
 const output=execFileSync('pwsh',args,{encoding:'utf8',windowsHide:true,timeout:20000});
 return JSON.parse(output.replace(/^\uFEFF/,''));
}
function verifyPrivate(file){
 if(process.platform!=='win32'){check((fs.statSync(file).mode&0o077)===0,'Staged credential file permissions are not private.');return;}
 const python=process.env.MICROI_GATE_TEST_MYSQL_NATIVE_PYTHON;check(python,'Staged credentials require the registered native client for ACL verification.');
 execFileSync(python,['-c',"import importlib.util,sys; s=importlib.util.spec_from_file_location('acl',sys.argv[2]); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); m.verify_private_acl(__import__('pathlib').Path(sys.argv[1]))",file,path.join(here,'fixtures/native-mysql-client.py')],{windowsHide:true,stdio:'pipe',timeout:10000});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,...args]=process.argv.slice(2);
 if(mode==='announce'){
  const [artifacts,matrixFile,signal]=args,plan=json(matrixFile);check(plan.sourceHead===head()&&hash(read(plan.matrixFile))===plan.matrixSha256,'Candidate or dependency matrix changed before final build announcement.');
  const runtime=path.join(artifacts,'bin','Microi.net.Api','release'),manifest=runtimeManifest(runtime);
  write(signal,{schemaVersion:1,sourceHead:head(),buildId:randomUUID(),builtAt:new Date().toISOString(),resultsDirectory:path.dirname(matrixFile),runtimeDirectory:runtime,runtimeManifestSha256:manifest.sha256,apiDllSha256:manifest.files.find(row=>row.name==='Microi.net.Api.dll').sha256,...preserveHdfsEvidence(runtime,path.dirname(matrixFile)),matrixReceiptSha256:hash(read(matrixFile))});
 }else if(mode==='verify-ready'){
  const [buildFile,readyFile,credentialsFile]=args,build=json(buildFile),ready=json(readyFile);verifyPrivate(credentialsFile);const bytes=read(credentialsFile);
  check(build.sourceHead===head()&&runtimeManifest(build.runtimeDirectory).sha256===build.runtimeManifestSha256,'Final Full candidate/runtime changed after build.');
  check(hash(bytes)===ready.credentialsFileSha256,'Fresh credential file differs from ready receipt.');
  // Only these two values enter the calling PowerShell process; the CLI never
  // prints the private envelope, passwords or connection strings.
  const result=validateReady(build,ready,JSON.parse(bytes),processIdentities([...ready.processes.map(row=>row.pid),ready.supervisorPid]),process.env);
  process.stdout.write(JSON.stringify(result));
 }else if(mode==='verify-transport-only'){
  const [buildFile,readyFile,transportFile,acceptedFile]=args;
  check(same(buildFile,process.env.MICROI_TEST_RUNTIME_BUILD_FILE)&&same(readyFile,process.env.MICROI_TEST_RUNTIME_READY_FILE)&&same(transportFile,path.join(path.dirname(buildFile),'transport-only-ready.json')),'PrepareRelease requires this attempt\'s unique transport-ready path.');
  await waitForTransportOnly(transportFile,process.env.MICROI_TEST_RUNTIME_FAILED_FILE);
  const build=json(buildFile),ready=json(readyFile),transport=json(transportFile);
  check(build.sourceHead===head()&&runtimeManifest(build.runtimeDirectory).sha256===build.runtimeManifestSha256&&same(acceptedFile,path.join(build.resultsDirectory,'release-test-matrix-result.json')),'Full candidate, runtime or accepted receipt changed before PrepareRelease.');
  const bytes=read(acceptedFile),accepted=JSON.parse(bytes);
  const credentialsFile=process.env.MICROI_TEST_RUNTIME_ENVIRONMENT_FILE;verifyPrivate(credentialsFile);const credentialBytes=read(credentialsFile);
  check(hash(credentialBytes)===ready.credentialsFileSha256,'Fresh credential file differs from ready receipt.');
  validateTransportOnly(build,ready,transport,processIdentities([ready.supervisorPid])[0],processIdentities(ready.processes.map(row=>row.pid),{allowMissing:true}),process.env,accepted,hash(bytes),JSON.parse(credentialBytes));
  console.log('PrepareRelease barrier passed: owned runtime PIDs exited and the original four native bridges remain ready.');
 }else throw Error('Usage: staged-full-runtime.mjs announce | verify-ready | verify-transport-only');
}

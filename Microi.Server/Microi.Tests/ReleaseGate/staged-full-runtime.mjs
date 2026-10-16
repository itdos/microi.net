import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
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
export function validateReady(build,ready,credentials,current,environment){
 check(build.schemaVersion===1&&ready.schemaVersion===1&&ready.sourceHead===build.sourceHead&&ready.buildId===build.buildId,'Staged ready receipt belongs to another candidate/build.');
 check(ready.apiDllSha256===build.apiDllSha256&&ready.runtimeManifestSha256===build.runtimeManifestSha256,'Staged runtime DLL or dependency fingerprint differs from the final Full build.');
 check(credentials.sourceHead===build.sourceHead&&credentials.buildId===build.buildId&&credentials.credentialsRefreshedAt===ready.credentialsRefreshedAt&&Date.parse(credentials.credentialsRefreshedAt)>=Date.parse(build.builtAt),'Fresh login did not occur after the final Full build.');
 for(const name of ['MICROI_TEST_OSCLIENT','MICROI_TEST_CHILD_OSCLIENT','MICROI_TEST_DID'])check(credentials.env[name]===environment[name],'Staged login tenant/device drift: '+name);
 check(ready.health?.api===true&&ready.health?.peerApi===true&&ready.health?.frontend===true,'Both APIs and frontend must be healthy before Full.');
 check(ready.processes?.length===3&&new Set(ready.processes.map(row=>row.pid)).size===3,'Staged runtime requires three distinct owned processes.');
 const specs=[['api',environment.MICROI_TEST_API_BASE,'Microi.Server/Microi.net.Api'],['peerApi',environment.MICROI_TEST_PEER_API_BASE,'Microi.Server/Microi.net.Api'],['frontend',environment.MICROI_TEST_FRONTEND_BASE,'Microi.Client']];
 for(const [kind,url,cwd]of specs){
  const records=ready.processes.filter(row=>row.kind===kind);check(records.length===1,'Missing staged process role.');const record=records[0],actual=current.find(row=>row.pid===record.pid),port=Number(new URL(url).port);
  check(actual&&actual.parentPid===ready.supervisorPid&&actual.creationDate===record.creationDate&&actual.commandLine===record.commandLine&&same(actual.exe,record.exe)&&same(actual.cwd,path.join(root,cwd))&&same(record.cwd,path.join(root,cwd))&&actual.listeningPorts?.includes(port),'Owned runtime PID, CWD, command line, executable or listening port differs.');
  if(kind!=='frontend')check(same(actual.exe,path.join(build.runtimeDirectory,'Microi.net.Api.exe'))&&actual.commandLine.includes('--contentRoot'),'API did not start from the final Full runtime.');
 }
 for(const name of ['MICROI_TEST_TOKEN','MICROI_TEST_CHILD_TOKEN'])check(typeof credentials.env[name]==='string'&&credentials.env[name].length>=20,'Fresh staged login token is missing.');
 return {MICROI_TEST_TOKEN:credentials.env.MICROI_TEST_TOKEN,MICROI_TEST_CHILD_TOKEN:credentials.env.MICROI_TEST_CHILD_TOKEN};
}
export function processIdentities(processIds){
 const output=execFileSync('pwsh',['-NoProfile','-File',path.join(here,'read-staged-runtime-identity.ps1'),'-ProcessIds',processIds.join(','),'-WorkspaceRoot',root],{encoding:'utf8',windowsHide:true,timeout:20000});
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
  write(signal,{schemaVersion:1,sourceHead:head(),buildId:randomUUID(),builtAt:new Date().toISOString(),resultsDirectory:path.dirname(matrixFile),runtimeDirectory:runtime,runtimeManifestSha256:manifest.sha256,apiDllSha256:manifest.files.find(row=>row.name==='Microi.net.Api.dll').sha256,matrixReceiptSha256:hash(read(matrixFile))});
 }else if(mode==='verify-ready'){
  const [buildFile,readyFile,credentialsFile]=args,build=json(buildFile),ready=json(readyFile);verifyPrivate(credentialsFile);const bytes=read(credentialsFile);
  check(build.sourceHead===head()&&runtimeManifest(build.runtimeDirectory).sha256===build.runtimeManifestSha256,'Final Full candidate/runtime changed after build.');
  check(hash(bytes)===ready.credentialsFileSha256,'Fresh credential file differs from ready receipt.');
  // Only these two values enter the calling PowerShell process; the CLI never
  // prints the private envelope, passwords or connection strings.
  const result=validateReady(build,ready,JSON.parse(bytes),processIdentities(ready.processes.map(row=>row.pid)),process.env);
  process.stdout.write(JSON.stringify(result));
 }else throw Error('Usage: staged-full-runtime.mjs announce <artifacts> <matrix-receipt> <signal> | verify-ready <signal> <ready> <private-environment>');
}

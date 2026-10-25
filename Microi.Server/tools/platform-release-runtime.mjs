// The complete platform release borrows an explicitly owned existing fixture.
// No Docker, tenant provisioning, application installation or desktop tests are started here.
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {startNativeBridges} from './platform-release-bridges.mjs';
import {prepareBrowserFixtureConfig,prepareBrowserFixtureConfigAsync} from '../Microi.Tests/ReleaseGate/prepare-browser-fixture.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),self=fileURLToPath(import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
const check=(ok,message)=>{if(!ok)throw Error(message);};
function regular(file,{directory=false}={}){
 check(typeof file==='string'&&path.isAbsolute(file),'Runtime paths must be absolute.');
 let current=path.resolve(file);
 while(true){if(fs.existsSync(current))check(!fs.lstatSync(current).isSymbolicLink(),'Runtime paths cannot cross a reparse point.');const parent=path.dirname(current);if(parent===current)break;current=parent;}
 check(fs.existsSync(file)&&(directory?fs.statSync(file).isDirectory():fs.statSync(file).isFile()),'Runtime input is missing or has the wrong type.');
 return file;
}
function command(exe,args,options={}){
 const result=spawnSync(exe,args,{windowsHide:true,encoding:'utf8',timeout:30000,...options});
 check(!result.error&&result.status===0,'Runtime private input verification failed.');
 return result.stdout;
}
function privateAcl(python,file){
 regular(file,{directory:fs.statSync(file).isDirectory()});
 const guard=path.resolve(here,'../Microi.Tests/ReleaseGate/fixtures/native-mysql-client.py');
 command(python,['-B','-c',"import importlib.util,pathlib,sys;s=importlib.util.spec_from_file_location('guard',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.verify_private_acl(pathlib.Path(sys.argv[2]))",guard,file]);
}
function createPrivate(directory,python){
 check(!fs.existsSync(directory),'Owned private output already exists.');fs.mkdirSync(directory,{mode:0o700});
 if(process.platform==='win32'){
  const code="$p='"+directory.replaceAll("'","''")+"';$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;$acl=New-Object System.Security.AccessControl.DirectorySecurity;$acl.SetOwner($sid);$acl.SetAccessRuleProtection($true,$false);foreach($s in @($sid,(New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')))){$rule=New-Object System.Security.AccessControl.FileSystemAccessRule($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$acl.AddAccessRule($rule)};Set-Acl -LiteralPath $p -AclObject $acl";
  command('pwsh',['-NoProfile','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')]);
 }
 privateAcl(python,directory);
}
export function validateProfile(profile){
 check(profile?.schemaVersion===1&&typeof profile.ownerTask==='string'&&profile.ownerTask&&typeof profile.authorization==='string'&&profile.authorization,'Existing fixture authority is missing.');
 for(const name of ['nodeExecutable','pythonExecutable','environmentFile','apiSettings','bridgeScopeFile','nativeMysqlConfig','richTextConfig'])check(typeof profile[name]==='string'&&profile[name],'Runtime profile path is missing: '+name);
 const ports=[profile.ports?.api,profile.ports?.peerApi,profile.ports?.frontend,profile.ports?.smoke,...['mysql','mongo','redis','scheduleRedis'].map(k=>profile.ports?.bridges?.[k])];
 check(ports.every(p=>Number.isInteger(p)&&p>=1024&&p<=65535)&&new Set(ports).size===ports.length,'Runtime profile ports must be distinct local ports.');
 return profile;
}
export function profileEnvironment(profile,source,control){
 const env={...(source.env||source)};
 for(const name of Object.keys(env))if(/TOKEN|MICROI_TEST_MATRIX_FILE|MICROI_TEST_ALLOW_APPLICATION_MAINTENANCE|MICROI_ADMISSION_|MICROI_DESKTOP_|MICROI_PLATFORM_RUNTIME_|MICROI_TEST_RUNTIME_|MICROI_GATE_TEST_MYSQL_(?:AUTO|CONTAINER)|SQLSERVER/i.test(name))delete env[name];
 check(env.MICROI_TEST_ALLOW_WRITES==='YES'&&env.MICROI_TEST_OSCLIENT,'Explicit existing-fixture write authorization is absent.');
 for(const [name,port] of [['MICROI_TEST_API_BASE',profile.ports.api],['MICROI_TEST_PEER_API_BASE',profile.ports.peerApi],['MICROI_TEST_FRONTEND_BASE',profile.ports.frontend]]){
  const url=new URL(env[name]);check(url.hostname==='127.0.0.1'&&url.protocol==='http:'&&Number(url.port)===port&&!url.username&&!url.password&&!url.search&&!url.hash,'Runtime fixture endpoint differs from its profile.');
 }
 Object.assign(env,{
  MICROI_TEST_DID:'PlatformRelease:'+path.basename(control),
  MICROI_GATE_TEST_MYSQL_NATIVE_PYTHON:profile.paths.pythonExecutable,
  MICROI_GATE_TEST_MYSQL_NATIVE_CONFIG:profile.paths.nativeMysqlConfig,
  PW_RICHTEXT_FIXTURE_CONFIG:profile.paths.richTextConfig,
  MICROI_TEST_UI_FIXTURE_APPSETTINGS:profile.paths.apiSettings,
  MICROI_RELEASE_SMOKE_CONFIG:profile.paths.apiSettings,
  MICROI_PLATFORM_RUNTIME_CONTROL:control
 });
 return Object.fromEntries(Object.entries(env).map(([key,value])=>[key,String(value)]));
}
export function loadProfile(workspace,filename=process.env.MICROI_PLATFORM_RELEASE_PROFILE){
 workspace=path.resolve(workspace);filename=path.resolve(filename||path.join(workspace,'.microi-e2e/platform-release/profile.json'));regular(filename);
 const directory=path.dirname(filename),profile=validateProfile(read(filename));
 const paths=Object.fromEntries(['nodeExecutable','pythonExecutable','environmentFile','apiSettings','bridgeScopeFile','nativeMysqlConfig','richTextConfig'].map(name=>[name,regular(path.resolve(directory,profile[name]))]));
 const nodeVersion=command(paths.nodeExecutable,['--version']).trim();check(/^v(?:2[2-9]|[3-9][0-9])\./.test(nodeVersion),'The configured native frontend runtime requires Node 22 or newer.');
 const relative=path.relative(workspace,filename);
 if(!relative.startsWith('..')&&!path.isAbsolute(relative))check(spawnSync('git',['check-ignore','-q','--',relative],{cwd:workspace,windowsHide:true}).status===0,'A private release profile inside the repository must be gitignored.');
 privateAcl(paths.pythonExecutable,directory);for(const file of [filename,...['environmentFile','apiSettings','bridgeScopeFile','nativeMysqlConfig','richTextConfig'].map(name=>paths[name])])privateAcl(paths.pythonExecutable,file);
 const scope=read(paths.bridgeScopeFile);check(scope.task===profile.ownerTask&&scope.authorization===profile.authorization,'Native bridge authority differs from the private release profile.');
 const config=read(paths.apiSettings);const keys=['OsClient','OsClientType','OsClientNetwork','OsClientDbType','OsClientDbConn','OsClientRedisHost','OsClientRedisPort','OsClientRedisPwd','OsClientRedisDataBase','OsClientDbMongoConn'];
 check(config.AppSettings&&Object.keys(config.AppSettings).length===10&&Object.keys(config.AppSettings).every(k=>keys.includes(k)),'API bootstrap must contain exactly the ten approved settings.');
 const source=read(paths.environmentFile);
 const loaded={...profile,paths,filename,source,workspace,sourceHashes:Object.fromEntries([filename,...Object.values(paths).filter(p=>p!==paths.nodeExecutable&&p!==paths.pythonExecutable)].map(file=>[file,hash(fs.readFileSync(file))]))};
 profileEnvironment(loaded,source,'profile-preflight');
 return loaded;
}
function binding(control){
 regular(control,{directory:true});const identity=read(path.join(control,'owner.json')),profile=loadProfile(identity.workspace,identity.profile);
 check(JSON.stringify(profile.sourceHashes)===JSON.stringify(identity.sourceHashes),'Release profile changed during this candidate.');
 return {identity,profile};
}
export async function waitForRuntime(control,name,timeout=30000){
 const end=Date.now()+timeout;
 while(!fs.existsSync(path.join(control,name))){
  check(!fs.existsSync(path.join(control,'failed.json')),'Owned platform runtime failed; inspect its private diagnostics.');
  check(Date.now()<end,'Owned platform runtime readiness timed out.');await delay(100);
 }
 return read(path.join(control,name));
}
export function runProfileCommand(control,args,run=spawnSync,resolveBinding=binding){
 const {profile}=resolveBinding(control);check(args.length>0,'A test command is required.');
 const environment=profileEnvironment(profile,profile.source,control);
 const inherited=Object.fromEntries(Object.entries(process.env).filter(([name])=>!(/^(?:MICROI_|PW_|OsClient|ASPNETCORE_|DOTNET_|COMPlus_|DOS_ORM_)/i.test(name)&&!/^MICROI_RELEASE_/i.test(name))));
 const result=run(args[0],args.slice(1),{cwd:profile.workspace,env:{...inherited,...environment,PATH:path.dirname(profile.paths.nodeExecutable)+path.delimiter+process.env.PATH,NODE_OPTIONS:'--max-old-space-size=3072'},stdio:'inherit',windowsHide:true});
 return result.error?1:result.status??1;
}
export async function startRuntime(workspace,gate,profileFile,ownerPid){
 const profile=loadProfile(workspace,profileFile),control=path.join(path.resolve(gate),'native-'+Date.now()+'-'+randomUUID().slice(0,8));
 regular(path.resolve(gate),{directory:true});fs.mkdirSync(control);createPrivate(path.join(control,'private'),profile.paths.pythonExecutable);
 fs.writeFileSync(path.join(control,'owner.json'),JSON.stringify({schemaVersion:1,workspace:profile.workspace,profile:profile.filename,sourceHashes:profile.sourceHashes,ownerPid:Number(ownerPid)||null,createdAt:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
 const fd=fs.openSync(path.join(control,'private/supervisor.log'),'a');
 const child=spawn(profile.paths.nodeExecutable,[self,'supervise',control],{cwd:profile.workspace,windowsHide:true,detached:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);child.unref();
 fs.writeFileSync(path.join(control,'supervisor.json'),JSON.stringify({pid:child.pid,exe:profile.paths.nodeExecutable,control})+'\n',{flag:'wx'});
 try{await waitForRuntime(control,'transport-ready.json',60000);return control;}
 catch(error){fs.writeFileSync(path.join(control,'shutdown.json'),'{}\n');throw error;}
}
export async function stopRuntime(control){
 regular(control,{directory:true});const owner=read(path.join(control,'owner.json')),supervisor=read(path.join(control,'supervisor.json'));
 check(owner.schemaVersion===1&&path.resolve(supervisor.control)===path.resolve(control)&&Number.isSafeInteger(supervisor.pid)&&supervisor.pid>0,'Owned runtime control identity is invalid.');
 // Cleanup remains available even when a private input drifts and testing is rejected.
 fs.writeFileSync(path.join(control,'shutdown.json'),'{}\n');
 const end=Date.now()+30000;
 while(!fs.existsSync(path.join(control,'supervisor-stopped.json'))){check(Date.now()<end,'Owned supervisor has not stopped; retain its receipt for precise cleanup.');await delay(100);}
 const receipt=read(path.join(control,'supervisor-stopped.json'));check(receipt.stopped===true,'Owned runtime cleanup failed.');return receipt;
}
const cleanEnvironment=()=>Object.fromEntries(Object.entries(process.env).filter(([name])=>!/^MICROI_|^OsClient|^DOS_ORM_|^ASPNETCORE_|^DOTNET_|^COMPlus_|^MCP_/i.test(name)&&!/TOKEN|PASSWORD|PWD|SECRET|CONN/i.test(name)));
export async function supervise(control){
 const {identity,profile}=binding(control),owned=[],environment=profileEnvironment(profile,profile.source,control);
 const registry={schemaVersion:1,task:profile.ownerTask,supervisorPid:process.pid,workspace:profile.workspace,phase:'PreparingTransport',processes:[]};
 const write=(name,value)=>fs.writeFileSync(path.join(control,name),JSON.stringify(value,null,2)+'\n');
 const status=phase=>{registry.phase=phase;write('runtime.json',registry);};
 const stopping=()=>fs.existsSync(path.join(control,'shutdown.json'));
 let bridges,failure,cleanupFailed=false;
 function start(kind,exe,args,cwd,env,port){
  const fd=fs.openSync(path.join(control,'private',kind+'.log'),'a'),child=spawn(exe,args,{cwd,env,windowsHide:true,stdio:['ignore',fd,fd]});fs.closeSync(fd);owned.push(child);
  const row={kind,pid:child.pid,exe,cwd,port,startedAt:new Date().toISOString()};registry.processes.push(row);
  child.once('error',()=>{row.spawnFailed=true;});child.once('exit',(code,signal)=>{Object.assign(row,{exitCode:code,signal,exitedAt:new Date().toISOString()});write('runtime.json',registry);});status('Starting');return child;
 }
 const exited=child=>child.exitCode!==null||child.signalCode!==null;
 async function stopOwned(){
  for(const child of [...owned].reverse())if(!exited(child))child.kill();
  await Promise.all(owned.map(child=>exited(child)?Promise.resolve():new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,10000);})));
  check(owned.every(exited),'An owned platform process has not stopped.');
 }
 async function health(url,child){
  const end=Date.now()+120000;
  while(Date.now()<end){check(!stopping()&&!exited(child),'Owned API/frontend stopped before readiness.');try{if((await fetch(url,{signal:AbortSignal.timeout(2000)})).ok)return;}catch{}await delay(500);}
  throw Error('Owned API/frontend health deadline exceeded.');
 }
 async function login(child){
  const p=child?'MICROI_TEST_CHILD_':'MICROI_TEST_',e=environment;
  const response=await fetch(new URL('api/SysUser/Login',e[p+'API_BASE']),{method:'POST',headers:{'Content-Type':'application/json',osclient:e[p+'OSCLIENT'],did:e.MICROI_TEST_DID},body:JSON.stringify({Account:e[p+'ACCOUNT'],Pwd:e[p+'PASSWORD'],OsClient:e[p+'OSCLIENT'],_ClientType:'PC',_AutomationTestLogin:true}),signal:AbortSignal.timeout(30000)});
  const result=await response.json();check(Number(result.Code)===1,'Existing fixture credential login failed.');
  const token=response.headers.get('authorization')||result.Data?.Token||result.Token;check(typeof token==='string'&&token.length>20,'Fresh fixture token is missing.');return token;
 }
 try{
  bridges=await startNativeBridges(profile.paths.bridgeScopeFile,{ownerTask:profile.ownerTask,authorization:profile.authorization,ports:profile.ports.bridges});
  await prepareBrowserFixtureConfigAsync(profile.workspace,control,environment);
  status('WaitingForFormalBuild');write('transport-ready.json',{ready:true,createdContainers:0,createdTenants:0});
  while(!fs.existsSync(path.join(control,'build.json'))&&!stopping())await delay(250);
  if(!stopping()){
   const build=read(path.join(control,'build.json')),apiDll=path.join(build.runtimeDirectory,'Microi.net.Api.dll');
   check(build.workspace===profile.workspace&&hash(fs.readFileSync(apiDll))===build.apiDllSha256,'Formal runtime build differs from the selected candidate.');
   registry.sourceHead=build.sourceHead;registry.buildSha256=hash(JSON.stringify(build));registry.apiDllSha256=build.apiDllSha256;
   for(const [kind,port] of [['api',profile.ports.api],['peerApi',profile.ports.peerApi]]){
    const contentRoot=path.join(control,'private',kind);fs.mkdirSync(contentRoot);fs.copyFileSync(profile.paths.apiSettings,path.join(contentRoot,'appsettings.json'));
    const config=read(profile.paths.apiSettings),env={...cleanEnvironment(),...Object.fromEntries(Object.entries(config.AppSettings).map(([k,v])=>[k,String(v)])),ASPNETCORE_ENVIRONMENT:'PlatformRelease',DOTNET_ENVIRONMENT:'PlatformRelease',ASPNETCORE_URLS:'http://127.0.0.1:'+port,DOTNET_GCHeapHardLimit:'0x48000000',COMPlus_GCHeapHardLimit:'0x48000000'};
    const executable=process.platform==='win32'?path.join(build.runtimeDirectory,'Microi.net.Api.exe'):'dotnet',args=process.platform==='win32'?[]:[apiDll];
    const child=start(kind,executable,[...args,'--urls','http://127.0.0.1:'+port,'--contentRoot',contentRoot],path.join(profile.workspace,'Microi.Server/Microi.net.Api'),env,port);
    await health('http://127.0.0.1:'+port+'/api/Diagnostics/liveness',child);
   }
   const frontend=start('frontend',profile.paths.nodeExecutable,['--max-old-space-size=1536',path.join(here,'platform-release-vite.mjs'),profile.workspace,control,String(profile.ports.frontend)],path.join(profile.workspace,'Microi.Client'),cleanEnvironment(),profile.ports.frontend);
   await health(environment.MICROI_TEST_FRONTEND_BASE,frontend);
   environment.MICROI_TEST_TOKEN=await login(false);environment.MICROI_TEST_CHILD_TOKEN=await login(true);
   const refreshedAt=new Date().toISOString();fs.writeFileSync(path.join(control,'private/environment.json'),JSON.stringify({env:environment,sourceHead:build.sourceHead,credentialsRefreshedAt:refreshedAt},null,2)+'\n',{mode:0o600});
   registry.health={api:true,peerApi:true,frontend:true};registry.credentialsRefreshedAt=refreshedAt;status('CandidateRuntimeReady');write('ready.json',registry);
   while(!fs.existsSync(path.join(control,'stop.json'))&&!stopping()){check(owned.every(child=>!exited(child)),'Owned runtime exited during browser tests.');await delay(250);}
   await stopOwned();status('TransportOnlyForEncryptedSmoke');write('stopped.json',{stopped:true,at:new Date().toISOString()});
   while(!stopping())await delay(500);
  }
 }catch(error){failure=error;write('failed.json',{failed:true,phase:registry.phase,message:'Owned platform runtime failed; inspect its private log.'});console.error(error.name+': '+error.message);}
 finally{
  try{await stopOwned();}catch{cleanupFailed=true;}
  try{if(bridges)await bridges.close();}catch{cleanupFailed=true;}
  status(cleanupFailed?'CleanupFailed':'Stopped');write('supervisor-stopped.json',{stopped:!cleanupFailed,failed:Boolean(failure),at:new Date().toISOString()});
 }
 if(failure||cleanupFailed)throw Error('Owned platform runtime failed.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===self){
 try{
  const [action,...args]=process.argv.slice(2);
  if(action==='start')console.log(await startRuntime(...args));
  else if(action==='supervise')await supervise(args[0]);
  else if(action==='stop')await stopRuntime(args[0]);
  else if(action==='run-tests')process.exitCode=runProfileCommand(args[0],args.slice(1).filter((arg,i)=>!(i===0&&arg==='--')));
  else if(action==='info'){const {profile}=binding(args[0]);const values={smokeConfig:profile.paths.apiSettings,smokePort:profile.ports.smoke,nodeHome:path.dirname(profile.paths.nodeExecutable)};check(Object.hasOwn(values,args[1]),'Unknown public runtime binding.');console.log(values[args[1]]);}
  else if(action==='dry-preflight'){const profile=loadProfile(args[0],args[1]),env=profileEnvironment(profile,profile.source,'dry-preflight');prepareBrowserFixtureConfig(profile.workspace,profile.workspace,env);console.log(JSON.stringify({profileConfigured:true,privateAclVerified:true,existingOwnerVerified:true,createdContainers:0,createdTenants:0,openedPorts:0}));}
  else throw Error('Unknown platform runtime action.');
 }catch{
  if(process.argv[2]==='supervise'){
   const control=process.argv[3];
   if(control&&fs.existsSync(path.join(control,'owner.json'))&&!fs.existsSync(path.join(control,'supervisor-stopped.json'))){
    fs.writeFileSync(path.join(control,'failed.json'),' {"failed":true,"phase":"PrivateInputValidation"}\n');
    fs.writeFileSync(path.join(control,'supervisor-stopped.json'),'{"stopped":true,"failed":true,"processesStarted":0}\n');
   }
  }
  console.error('Platform runtime profile/ownership/start/cleanup verification failed. Preserve the private profile and owned control receipt.');process.exitCode=1;
 }
}

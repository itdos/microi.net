import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {configureContext,PROTOCOL_PATHS,sha} from './contracts.mjs';
import {bindPreparation,main as stage,REQUIRED_APPLICATION} from './prepare.mjs';

const HERE=path.dirname(fileURLToPath(import.meta.url));
export const ROOT=path.resolve(HERE,'../../../../..');
const SETTINGS=['OsClient','OsClientType','OsClientNetwork','OsClientDbType','OsClientDbConn','OsClientRedisHost','OsClientRedisPort','OsClientRedisPwd','OsClientRedisDataBase','OsClientDbMongoConn'];
const json=bytes=>JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
const same=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();

export function regular(file,{directory=false,missing=false}={}) {
  assert.ok(typeof file==='string'&&path.isAbsolute(file),'Fixture paths must be absolute');
  let current=path.resolve(file);
  while(true){
    if(fs.existsSync(current)){const s=fs.lstatSync(current);assert.ok(!s.isSymbolicLink(),'Fixture path cannot cross a reparse point');}
    else assert.ok(missing,'Fixture path does not exist');
    const parent=path.dirname(current);if(parent===current)break;current=parent;
  }
  if(fs.existsSync(file)){const s=fs.lstatSync(file);assert.ok(directory?s.isDirectory():s.isFile(),'Unexpected fixture path type');}
  else assert.ok(missing,'Missing fixture input');
  return path.resolve(file);
}
const read=file=>fs.readFileSync(regular(file));
function command(exe,args,{timeout=30000,input}={}) {
  const result=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,timeout,maxBuffer:1024*1024,input});
  // 子进程错误可能含连接串；仅私有阶段回执可查看，控制台只给固定边界信息。
  assert.equal(result.error,undefined,'Fixture process could not complete');
  assert.equal(result.status,0,'Fixture process failed; preserve private intents and inspect before retry');
  return result.stdout;
}
function privateAcl(python,file) {
  regular(file,{directory:fs.statSync(file).isDirectory()});
  command(python,['-B','-c',"import importlib.util,pathlib,sys;s=importlib.util.spec_from_file_location('acl',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.verify_private_acl(pathlib.Path(sys.argv[2]))",path.join(HERE,'../native-mysql-client.py'),file]);
}
export function createPrivate(directory,python) {
  regular(directory,{directory:true,missing:true});assert.ok(!fs.existsSync(directory),'Private admission directory already exists; never adopt a previous attempt');
  fs.mkdirSync(directory,{mode:0o700});
  if(process.platform==='win32'){
    // 只保护本次新建目录；不改借用夹具、用户目录或旧回执的 ACL。
    const script="$p=$args[0];$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;$acl=New-Object System.Security.AccessControl.DirectorySecurity;$acl.SetOwner($sid);$acl.SetAccessRuleProtection($true,$false);foreach($s in @($sid,(New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')))){$rule=New-Object System.Security.AccessControl.FileSystemAccessRule($s,'FullControl','ContainerInherit,ObjectInherit','None','Allow');$acl.AddAccessRule($rule)};Set-Acl -LiteralPath $p -AclObject $acl";
    const bound="$args=@('"+directory.replaceAll("'","''")+"');"+script;
    command('pwsh',['-NoProfile','-EncodedCommand',Buffer.from(bound,'utf16le').toString('base64')]);
  }
  privateAcl(python,directory);
}
function write(file,value){regular(file,{missing:true});assert.ok(!fs.existsSync(file),'Evidence is immutable');fs.writeFileSync(file,Buffer.isBuffer(value)?value:JSON.stringify(value,null,2)+'\n',{flag:'wx',mode:0o600});}

export function validateProfile(value) {
  assert.deepEqual(Object.keys(value||{}).sort(),['schema','task','expectedParentOwner','bootstrapFiles','python'].sort());
  assert.equal(value.schema,1);assert.match(value.task,/^[A-Za-z0-9][A-Za-z0-9_-]{7,66}$/);
  assert.match(value.expectedParentOwner,/^[A-Za-z0-9][A-Za-z0-9_-]{7,100}$/);
  assert.ok(Array.isArray(value.bootstrapFiles)&&value.bootstrapFiles.length===2&&new Set(value.bootstrapFiles).size===2);
  for(const file of [...value.bootstrapFiles,value.python])assert.ok(typeof file==='string'&&path.isAbsolute(file));
  return value;
}
// 支持连接字符串中的引号/分号，拒绝别名重复，不能用宽松 split 猜密码或目标。
export function mysqlConnection(text) {
  assert.equal(typeof text,'string');const parts=[];let part='',quote='';
  for(let i=0;i<text.length;i++){const c=text[i];if(quote){if(c===quote){if(text[i+1]===quote){part+=c;i++;}else quote='';}else part+=c;}
    else if(c==='"'||c==="'")quote=c;else if(c===';'){parts.push(part);part='';}else part+=c;}
  assert.equal(quote,'','Unclosed connection string quote');parts.push(part);const values={};
  for(const p of parts.filter(p=>p.trim())){const i=p.indexOf('=');assert.ok(i>0);const key=p.slice(0,i).trim().toLowerCase(),v=p.slice(i+1).trim();assert.ok(!(key in values));values[key]=v;}
  const one=(aliases,required=true)=>{const keys=aliases.filter(k=>k in values);assert.ok(keys.length===(required?1:Math.min(1,keys.length)),'Ambiguous connection string aliases');return keys.length?values[keys[0]]:undefined;};
  const host=one(['server','host','data source']),port=Number(one(['port'],false)||3306),database=one(['database','initial catalog']),user=one(['uid','user id','user','username']),password=one(['pwd','password']);
  assert.equal(host,'127.0.0.1');assert.ok(Number.isInteger(port)&&port>=1024&&port<=65535);assert.match(database,/^[A-Za-z0-9_]{1,64}$/);assert.ok(user&&password);
  return {host,port,database,user,password};
}
export function bootstrapSettings(objects,mainTenant) {
  assert.equal(objects.length,2);for(const o of objects)assert.deepEqual(Object.keys(o.AppSettings||{}).sort(),[...SETTINGS].sort());
  assert.deepEqual(objects[0].AppSettings,objects[1].AppSettings,'Both runtime APIs must use the same bootstrap');
  const s=objects[0].AppSettings;assert.equal(s.OsClient,mainTenant);assert.equal(s.OsClientType,'Product');assert.equal(s.OsClientNetwork,'Internal');assert.equal(String(s.OsClientDbType).toLowerCase(),'mysql');
  const db=mysqlConnection(s.OsClientDbConn),redis={host:s.OsClientRedisHost,port:Number(s.OsClientRedisPort),password:s.OsClientRedisPwd,database:Number(s.OsClientRedisDataBase)};
  assert.equal(redis.host,'127.0.0.1');assert.ok(redis.password&&Number.isInteger(redis.port)&&redis.port>=1024&&redis.port<=65535&&Number.isInteger(redis.database)&&redis.database>=0&&redis.database<=15);
  const mongo=new URL(s.OsClientDbMongoConn);assert.equal(mongo.protocol,'mongodb:');assert.equal(mongo.hostname,'127.0.0.1');assert.ok(Number(mongo.port)>=1024&&Number(mongo.port)<=65535);assert.ok(!mongo.searchParams.has('replicaSet'));
  return {parentDatabase:db.database,mysql:{host:db.host,port:db.port,user:db.user,password:db.password},redis,mongo:{localUri:s.OsClientDbMongoConn}};
}
function sourceManifest(){
  const relative=file=>path.relative(ROOT,file).replaceAll('\\','/');
  const walk=folder=>fs.readdirSync(regular(folder,{directory:true}),{withFileTypes:true}).flatMap(entry=>{
    const file=path.join(folder,entry.name);assert.ok(!entry.isSymbolicLink(),'MCP source/dependency cannot cross links');
    return entry.isDirectory()?walk(file):[relative(file)];
  });
  const files=[...PROTOCOL_PATHS,REQUIRED_APPLICATION,...fs.readdirSync(HERE).filter(n=>/\.(mjs|py)$/.test(n)).map(n=>relative(path.join(HERE,n))),relative(path.join(HERE,'../native-mysql-client.py')),
    'microi.mcp/package.json','microi.mcp/package-lock.json','microi.mcp/tsconfig.json',
    ...walk(path.join(ROOT,'microi.mcp/src')),...walk(path.join(ROOT,'microi.mcp/dist')),
    ...walk(path.join(ROOT,'microi.mcp/node_modules/@modelcontextprotocol/sdk/dist/esm'))];
  return Object.fromEntries(files.sort().map(file=>[file,sha(read(path.join(ROOT,file)))]));
}
export function requireStaged(env){
  assert.ok(['MICROI_TEST_RUNTIME_BUILD_FILE','MICROI_TEST_RUNTIME_READY_FILE','MICROI_TEST_RUNTIME_ENVIRONMENT_FILE','MICROI_ADMISSION_PROFILE_FILE'].every(k=>env[k]&&path.isAbsolute(env[k])),
    'Full admission HTTP gate requires the staged runtime and MICROI_ADMISSION_PROFILE_FILE; see Microi.Server/Microi.Tests/README.md (Admission fixture). Non-staged Full is not supported.');
}
function loadProfile(env){
  requireStaged(env);const file=regular(env.MICROI_ADMISSION_PROFILE_FILE),value=validateProfile(json(read(file)));regular(value.python);privateAcl(value.python,file);
  for(const p of value.bootstrapFiles)privateAcl(value.python,p);
  command(value.python,['-B','-c','import pymysql,redis']);
  const settings=bootstrapSettings(value.bootstrapFiles.map(p=>json(read(p))),env.MICROI_TEST_OSCLIENT);
  return {file,value,settings,sha256:sha(read(file)),bootstrapFiles:value.bootstrapFiles.map(p=>({path:p,sha256:sha(read(p))}))};
}
function dependencyPreflight(){
  // 只加载 SDK/解析声明依赖，不启动 MCP 服务；缺少运输依赖必须在创建 owner 前失败。
  const script="import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';const root=process.argv[1],pkg=path.join(root,'microi.mcp/package.json'),require=createRequire(pkg);for(const name of Object.keys(JSON.parse(fs.readFileSync(pkg)).dependencies))if(name!=='@modelcontextprotocol/sdk')require.resolve(name);for(const name of ['index.js','stdio.js'])await import(pathToFileURL(path.join(root,'microi.mcp/node_modules/@modelcontextprotocol/sdk/dist/esm/client',name)));";
  command(process.execPath,['--input-type=module','-e',script,ROOT]);
}
export function preflight(results,env=process.env){
  const p=loadProfile(env);dependencyPreflight();regular(results,{directory:true,missing:true});fs.mkdirSync(results,{recursive:true});
  const receipt={schema:1,task:p.value.task,profile:{path:p.file,sha256:p.sha256},bootstrapFiles:p.bootstrapFiles,sourceHashes:sourceManifest(),at:new Date().toISOString()};
  write(path.join(results,'admission-profile.json'),receipt);return {preflight:true,profileSha256:p.sha256};
}
export async function prepareRuntime(results,env=process.env){
  const p=loadProfile(env),pre=json(read(path.join(results,'admission-profile.json')));
  assert.equal(pre.profile.sha256,p.sha256);assert.deepEqual(pre.bootstrapFiles,p.bootstrapFiles);assert.deepEqual(pre.sourceHashes,sourceManifest());
  // 每个真正写入阶段前重新核实同一进程、最终 DLL、源 HEAD、双 API 和私有凭据。
  const verify=()=>command(process.execPath,[path.join(HERE,'../../staged-full-runtime.mjs'),'verify-ready',env.MICROI_TEST_RUNTIME_BUILD_FILE,env.MICROI_TEST_RUNTIME_READY_FILE,env.MICROI_TEST_RUNTIME_ENVIRONMENT_FILE]);
  verify();const build=json(read(env.MICROI_TEST_RUNTIME_BUILD_FILE)),ready=json(read(env.MICROI_TEST_RUNTIME_READY_FILE));
  assert.ok(same(build.resultsDirectory,results));assert.equal(ready.task,p.value.task);
  privateAcl(p.value.python,env.MICROI_TEST_RUNTIME_ENVIRONMENT_FILE);const credentials=json(read(env.MICROI_TEST_RUNTIME_ENVIRONMENT_FILE));
  assert.equal(sha(read(env.MICROI_TEST_RUNTIME_ENVIRONMENT_FILE)),ready.credentialsFileSha256);assert.equal(credentials.env.MICROI_TEST_API_BASE,env.MICROI_TEST_API_BASE);
  const owner32=sha(build.buildId+'\0'+ready.attempt).slice(0,32),directory=path.join(results,'admission');
  assert.ok(!fs.existsSync(directory),'Admission already started; inspect retained intent/readback instead of replaying preparation');fs.mkdirSync(directory);
  const privateDirectory=path.join(directory,'private');createPrivate(privateDirectory,p.value.python);
  const runtimeBuildFile=path.join(privateDirectory,'runtime-build.json'),runtimeReadyFile=path.join(privateDirectory,'runtime-ready.json');
  write(runtimeBuildFile,read(env.MICROI_TEST_RUNTIME_BUILD_FILE));write(runtimeReadyFile,read(env.MICROI_TEST_RUNTIME_READY_FILE));
  const context={schema:1,task:ready.task,owner32,tenant:'adm_'+owner32,mainTenant:env.MICROI_TEST_OSCLIENT,fixtureOwner:p.value.expectedParentOwner,
    ...p.settings,privateDirectory,candidateRoot:ROOT,python:p.value.python,bootstrapFiles:p.bootstrapFiles,sourceHashes:pre.sourceHashes,
    mainCredentials:{account:credentials.env.MICROI_TEST_ACCOUNT,password:credentials.env.MICROI_TEST_PASSWORD},sourceHead:build.sourceHead,buildId:build.buildId,attempt:ready.attempt,
    runtimeBuildFile,runtimeBuildSha256:sha(read(runtimeBuildFile)),runtimeReadyFile,runtimeReadySha256:sha(read(runtimeReadyFile)),base:env.MICROI_TEST_API_BASE};
  assert.ok(context.mainCredentials.account&&context.mainCredentials.password);
  configureContext(context);const contextFile=path.join(privateDirectory,'context.json');write(contextFile,context);privateAcl(context.python,contextFile);const contextSha256=sha(read(contextFile));bindPreparation(contextFile,contextSha256);
  const native=(action)=>{verify();const output=command(context.python,['-B',path.join(HERE,'register_fixture.py'),'--context',contextFile,'--context-sha256',contextSha256,action],{timeout:90000});return json(Buffer.from(output));};
  native('check-parent');verify();await stage(['owner',owner32]);native('preflight');verify();await stage(['tenant',owner32]);native('registration');verify();await stage(['resources',owner32]);native('inspect');native('claim');verify();
  const identity=await stage(['identities',owner32]);const identityRecord=json(read(path.join(privateDirectory,identity.identityFile)));verify();
  const environmentPath=path.join(privateDirectory,'environment.json'),controlScript=path.join(HERE,'admission_engine_fixture.py');
  const controls={MICROI_ADMISSION_CONTROL_PYTHON:context.python,MICROI_ADMISSION_CONTROL_SCRIPT:controlScript,MICROI_ADMISSION_CONTROL_SHA256:sha(read(controlScript)),MICROI_ADMISSION_CONTEXT_FILE:contextFile,MICROI_ADMISSION_CONTEXT_SHA256:contextSha256};
  write(environmentPath,{schema:1,task:ready.task,sourceHead:build.sourceHead,buildId:build.buildId,attempt:ready.attempt,credentialsRefreshedAt:identityRecord.at,env:{...identityRecord.env,...controls}});privateAcl(context.python,environmentPath);
  const admissionReadyFile=path.join(directory,'admission-ready.json');
  write(admissionReadyFile,{schema:1,task:ready.task,sourceHead:build.sourceHead,buildId:build.buildId,attempt:ready.attempt,runtimeBuildSha256:context.runtimeBuildSha256,runtimeReadySha256:context.runtimeReadySha256,environmentPath,environmentSha256:sha(read(environmentPath)),contextFile,contextSha256,tenant:context.tenant,owner32,createdAt:new Date().toISOString()});
  return {MICROI_ADMISSION_READY_FILE:admissionReadyFile,MICROI_ADMISSION_ENVIRONMENT_FILE:environmentPath};
}
export async function cleanupRuntime(results,env=process.env){
  const p=loadProfile(env),readyFile=path.join(results,'admission/admission-ready.json'),ready=json(read(readyFile));
  command(process.execPath,[path.join(HERE,'../../staged-full-runtime.mjs'),'verify-ready',env.MICROI_TEST_RUNTIME_BUILD_FILE,env.MICROI_TEST_RUNTIME_READY_FILE,env.MICROI_TEST_RUNTIME_ENVIRONMENT_FILE]);
  assert.equal(ready.runtimeBuildSha256,sha(read(env.MICROI_TEST_RUNTIME_BUILD_FILE)));assert.equal(ready.runtimeReadySha256,sha(read(env.MICROI_TEST_RUNTIME_READY_FILE)));
  privateAcl(p.value.python,ready.contextFile);assert.equal(ready.contextSha256,sha(read(ready.contextFile)));
  const context=json(read(ready.contextFile));assert.equal(context.task,p.value.task);assert.ok(same(context.privateDirectory,path.join(results,'admission/private')));
  configureContext(context);bindPreparation(ready.contextFile,ready.contextSha256);
  // 只撤销本次新租户的访问密钥/普通测试用户；保留租户、主库 owner 和完整原文供明确清理审查。
  await stage(['revoke',context.owner32]);await stage(['remove-ordinary',context.owner32]);
  write(path.join(results,'admission/identity-cleanup.json'),{schema:1,task:context.task,buildId:context.buildId,attempt:context.attempt,tenant:context.tenant,accessKeyRevoked:true,ordinaryUserRemoved:true,tenantRetained:true,mainOwnerRetained:true,at:new Date().toISOString()});
  return {identityCleanup:true,tenantRetained:true};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const [action,results]=process.argv.slice(2);assert.ok(['preflight','prepare','cleanup'].includes(action));process.stdout.write(JSON.stringify(action==='preflight'?preflight(results):action==='prepare'?await prepareRuntime(results):await cleanupRuntime(results)));}
  catch(error){process.stderr.write('Admission fixture stopped: '+(error.message.startsWith('Full admission HTTP')?error.message:'private input/runtime/ownership/stage check failed; preserve private receipts and inspect before retry')+'\n');process.exitCode=1;}
}

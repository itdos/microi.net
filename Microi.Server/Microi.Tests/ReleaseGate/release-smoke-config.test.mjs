import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {injectSmokeConfig,restoreSmokeConfig,verifyPublishedConfig,verifyPublishedImage} from '../../tools/release-smoke-config.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const script=fs.readFileSync(path.join(root,'Microi一键编译发布.sh'),'utf8');
const tool=path.join(root,'Microi.Server/tools/release-smoke-config.mjs');
const gitExec=process.platform==='win32'?execFileSync('git',['--exec-path'],{encoding:'utf8'}).trim():'';
const bash=process.platform==='win32'?path.resolve(gitExec,'../../..','bin/bash.exe'):'bash';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const quote=value=>"'"+value.replaceAll("'","'\\''")+"'";
function fixture(){
 const parent=path.join(root,'.tmp');fs.mkdirSync(parent,{recursive:true});
 const directory=fs.mkdtempSync(path.join(parent,'smoke-config-')),publish=path.join(directory,'publish');fs.mkdirSync(publish);
 const template=path.join(directory,'public.json'),source=path.join(directory,'private.json'),state=path.join(directory,'smoke-config.json');
 const original=Buffer.from(JSON.stringify({AppSettings:{OsClient:'public',OsClientDbType:'MySql',OsClientDbConn:'',OsClientRedisHost:'',OsClientRedisPwd:'',OsClientDbMongoConn:''},Logging:{LogLevel:{Default:'Warning'}},AllowedHosts:'*'})+'\r\n');
 const secret='fixture-only-'+randomUUID();
 const input=Buffer.from(JSON.stringify({AppSettings:{OsClient:'existing-test-tenant',OsClientDbConn:secret,OsClientRedisHost:'localhost',OsClientRedisPwd:secret,OsClientDbMongoConn:secret},DevLoginBypass:{Enabled:true,Password:secret}}));
 fs.writeFileSync(template,original);fs.writeFileSync(source,input);fs.writeFileSync(path.join(publish,'appsettings.json'),original);
 return {directory,publish,template,source,state,secret,input,original,inject(){return injectSmokeConfig(publish,template,source,state);},restore(){return restoreSmokeConfig(publish,state);},verify(){return verifyPublishedConfig(publish,template);},dispose(){assert.ok(directory.startsWith(parent+path.sep));fs.rmSync(directory,{recursive:true});}};
}
function shellFunctions(){
 const restore=script.slice(script.indexOf('restore_smoke_config() {'),script.indexOf('# 只清理本进程新建并登记的 scratch'));
 const finish=script.slice(script.indexOf('finish_windows_session() {'),script.indexOf('if [[ "$OSTYPE" == "msys"',script.indexOf('finish_windows_session() {')));
 const interrupt=script.slice(script.indexOf('handle_session_interrupt() {'),script.indexOf('finish_windows_session() {'));
 assert.ok(restore.includes('restore "$MICROI_SMOKE_CONFIG_PUBLISH"')&&finish.includes('restore_smoke_config'),'Use the actual release lifecycle');
 return restore+interrupt+finish;
}
test('temporary host receives only existing bootstrap settings; source and public template stay byte exact',()=>{
 const f=fixture();try{
  const result=f.inject(),injected=JSON.parse(fs.readFileSync(path.join(f.publish,'appsettings.json')));
  assert.equal(injected.AppSettings.OsClientDbConn,f.secret);assert.equal(injected.DevLoginBypass,undefined);assert.deepEqual(injected.Logging,{LogLevel:{Default:'Warning'}});
  assert.equal(result.sourceSha256,sha(f.input));assert.ok(!fs.readFileSync(f.state,'utf8').includes(f.secret));
  assert.throws(()=>f.verify(),/private connection/);
  f.restore();f.restore();assert.deepEqual(fs.readFileSync(f.source),f.input);assert.deepEqual(fs.readFileSync(f.template),f.original);assert.equal(f.verify().sha256,sha(f.original));
 }finally{f.dispose();}
});
for(const failure of ['missing-source','invalid-json','unknown-bootstrap','unsafe-template','already-injected','state-in-publish'])test(`injection fails closed before touching publish: ${failure}`,()=>{
 const f=fixture();try{
  let state=f.state;
  if(failure==='missing-source')fs.unlinkSync(f.source);
  if(failure==='invalid-json')fs.writeFileSync(f.source,'{"private":"'+f.secret+'", broken');
  if(failure==='unknown-bootstrap'){const value=JSON.parse(f.input);value.AppSettings.Secret=f.secret;fs.writeFileSync(f.source,JSON.stringify(value));}
  if(failure==='unsafe-template'){const value=JSON.parse(f.original);value.DevLoginBypass={Enabled:true};fs.writeFileSync(f.template,JSON.stringify(value));fs.writeFileSync(path.join(f.publish,'appsettings.json'),JSON.stringify(value));}
  if(failure==='already-injected')fs.writeFileSync(state,'existing-owner');
  if(failure==='state-in-publish')state=path.join(f.publish,'smoke-config.json');
  const before=fs.readFileSync(path.join(f.publish,'appsettings.json'));
  assert.throws(()=>injectSmokeConfig(f.publish,f.template,f.source,state),error=>{assert.ok(!error.message.includes(f.secret));return true;});
  assert.deepEqual(fs.readFileSync(path.join(f.publish,'appsettings.json')),before);
 }finally{f.dispose();}
});
for(const entry of ['appsettings.iTdos.json','AppSettings.Production.JSON','appsettings.json.smoke.bak','.microi-local','smoke-config.json'])test(`Docker input rejects residual ${entry}`,()=>{
 const f=fixture();try{fs.writeFileSync(path.join(f.publish,entry),f.secret);assert.throws(()=>f.verify(),/configuration|metadata/);assert.ok(fs.existsSync(path.join(f.publish,entry)));}finally{f.dispose();}
});
for(const damaged of ['partial-injection','missing-target'])test(`saved safe bytes recover ${damaged}`,()=>{
 const f=fixture();try{f.inject();if(damaged==='missing-target')fs.unlinkSync(path.join(f.publish,'appsettings.json'));else fs.writeFileSync(path.join(f.publish,'appsettings.json'),'{"AppSettings":');f.restore();assert.equal(f.verify().sha256,sha(f.original));}finally{f.dispose();}
});
for(const damaged of ['wrong-directory','backup-hash','missing-state'])test(`damaged recovery record blocks publication: ${damaged}`,()=>{
 const f=fixture();try{
  f.inject();const record=JSON.parse(fs.readFileSync(f.state));
  if(damaged==='wrong-directory')record.publish=path.dirname(f.publish);else if(damaged==='backup-hash')record.templateSha256='0'.repeat(64);
  if(damaged==='missing-state')fs.unlinkSync(f.state);else fs.writeFileSync(f.state,JSON.stringify(record));
  assert.throws(()=>f.restore());assert.throws(()=>f.verify());
 }finally{f.dispose();}
});
test('changed public template cannot recertify a restored candidate',()=>{
 const f=fixture();try{f.inject();f.restore();fs.appendFileSync(f.template,'\n');assert.throws(()=>f.verify(),/differs/);}finally{f.dispose();}
});
test('linked publish ancestor and linked recovery directory are rejected',()=>{
 const f=fixture();const link=path.join(f.directory,'alias');
 try{fs.symlinkSync(f.publish,link,process.platform==='win32'?'junction':'dir');assert.throws(()=>verifyPublishedConfig(link,f.template),/link/);assert.throws(()=>injectSmokeConfig(f.publish,f.template,f.source,path.join(link,'state.json')),/link/);}
 finally{if(fs.existsSync(link))fs.unlinkSync(link);f.dispose();}
});
test('restore never follows a dangling configuration link outside its owned publish directory',()=>{
 const f=fixture(),target=path.join(f.publish,'appsettings.json'),outside=path.join(f.directory,'must-not-create.json');
 try{f.inject();fs.unlinkSync(target);fs.symlinkSync(outside,target,'file');assert.throws(()=>f.restore(),/link/);assert.equal(fs.existsSync(outside),false);}
 finally{if(fs.lstatSync(target).isSymbolicLink())fs.unlinkSync(target);f.dispose();}
});
for(const scenario of [
 {name:'success',body:'exit 0',code:0},
 {name:'changed working directory',body:'cd /; exit 0',code:0},
 {name:'precheck or runtime failure',body:'exit 23',code:23},
 {name:'INT',body:'kill -INT "$BASHPID"',code:130},
 {name:'TERM',body:'kill -TERM "$BASHPID"',code:143},
 {name:'HUP',body:'kill -HUP "$BASHPID"',code:143},
 {name:'missing recovery stops successful exit before cleanup',body:`node -e 'require("fs").unlinkSync(process.argv[1])' "$MICROI_SMOKE_CONFIG_STATE"; exit 0`,code:1,damaged:true,missingState:true},
 {name:'damaged recovery keeps original failure and retains scratch',body:`node -e 'const f=require("fs");const p=process.argv[1];const r=JSON.parse(f.readFileSync(p));r.templateSha256="0".repeat(64);f.writeFileSync(p,JSON.stringify(r));' "$MICROI_SMOKE_CONFIG_STATE"; exit 23`,code:23,damaged:true}
])test(`actual release EXIT lifecycle restores before cleanup: ${scenario.name}`,()=>{
 const f=fixture();try{
  const run=spawnSync(bash,['--noprofile','--norc','-s'],{cwd:f.directory,encoding:'utf8',input:`
MICROI_SMOKE_CONFIG_TOOL=${quote(tool)}
MICROI_SMOKE_CONFIG_TEMPLATE=${quote(f.template)}
MICROI_SMOKE_CONFIG_STATE=${quote(f.state)}
MICROI_SMOKE_CONFIG_PUBLISH=${quote(f.publish)}
PUBLISH_DIR=${quote(f.publish)}
MICROI_RELEASE_DEADLINE=''; MICROI_SKIP_EXIT_PAUSE=true
node(){ ${quote(process.execPath)} "$@"; }
stop_active_client_build(){ :; }
cleanup_release_scratch(){ node "$MICROI_SMOKE_CONFIG_TOOL" verify "$PUBLISH_DIR" ${quote(f.template)} || return 29; printf 'CLEANUP_REACHED\\n'; }
release_workspace_lock(){ printf 'LOCK_RELEASE_REACHED\\n'; }
is_windows_shell(){ return 1; }
${shellFunctions()}
trap finish_windows_session EXIT
trap 'handle_session_interrupt INT' INT
trap 'handle_session_interrupt TERM' TERM
trap 'handle_session_interrupt HUP' HUP
node "$MICROI_SMOKE_CONFIG_TOOL" inject "$PUBLISH_DIR" ${quote(f.template)} ${quote(f.source)} "$MICROI_SMOKE_CONFIG_STATE" || exit 31
${scenario.body}
`});
  assert.ifError(run.error);assert.equal(run.status,scenario.code,run.stderr+run.stdout);
  assert.equal(run.stdout.includes('CLEANUP_REACHED'),!scenario.damaged);
  assert.equal(run.stdout.includes(f.secret)||run.stderr.includes(f.secret),false);
  assert.equal(fs.existsSync(f.state),!scenario.missingState);assert.deepEqual(fs.readFileSync(f.source),f.input);
  if(scenario.damaged)assert.throws(()=>f.verify());else assert.equal(f.verify().sha256,sha(f.original));
 }finally{f.dispose();}
});
for(const bad of [false,true])test(`immutable image configuration byte check ${bad?'rejects leakage':'passes safe template'} without running a container`,()=>{
 const f=fixture();const calls=[];try{
  const run=(_command,args)=>{calls.push(args);if(args[0]==='image')return 'sha256:'+'a'.repeat(64);if(args[0]==='create')return 'b'.repeat(64);if(args[0]==='cp'){fs.writeFileSync(args.at(-1),bad?f.input:f.original);return '';}if(args[0]==='rm')return '';throw Error('Unexpected Docker operation');};
  if(bad)assert.throws(()=>verifyPublishedImage('fixture-image',f.template,run),/section|private/);else assert.equal(verifyPublishedImage('fixture-image',f.template,run).configuration.sha256,sha(f.original));
  assert.ok(calls.every(args=>!['run','start','build','push'].includes(args[0])));assert.equal(calls.find(args=>args[0]==='create').at(-1),'sha256:'+'a'.repeat(64));assert.equal(calls.at(-1)[0],'rm');
 }finally{f.dispose();}
});
test('normal release protects reused artifacts, each Docker retry and every API image independent of encryption',()=>{
 const artifact=fs.readFileSync(path.join(root,'Microi.Server/tools/release-artifact.mjs'),'utf8');
 assert.ok(artifact.indexOf('verifyPublishedConfig(path.join(directory')<artifact.indexOf('const files=await artifactFiles(directory'));
 assert.ok(script.indexOf('restore_smoke_config;',script.indexOf('finish_windows_session()'))<script.indexOf('cleanup_release_scratch;',script.indexOf('finish_windows_session()')));
 const builds=script.slice(script.indexOf('while [ "$_docker_build_attempt"'),script.indexOf('# 固定版本标签在任何 latest'));
 assert.equal(builds.match(/validate_publish_artifacts "\$PUBLISH_DIR"/g)?.length,2);
 const push=script.slice(script.indexOf('for _img_tag in "${_images[@]}"'),script.indexOf('print_success "$plan_name'));
 assert.ok(push.indexOf('"$MICROI_SMOKE_CONFIG_TOOL" image')<push.indexOf('[ "$HAS_ENCRYPT" = true ]'));
 assert.ok(script.includes('publish/appsettings.json.*'));
});
